import { get, setWithTTL, del, getTTL, isRedisConnected } from './redis';
import { getActiveSessionKey } from '../constants/redis-keys';

/**
 * Default TTL for active sessions (1 hour)
 */
const DEFAULT_SESSION_TTL_SECONDS = 3600;

/**
 * Session status enum
 */
export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

/**
 * Active session data structure
 */
export interface ActiveSession {
  userId: string;
  status: SessionStatus;
  startTime: number; // Unix timestamp in milliseconds
  lastUpdateTime: number; // Unix timestamp in milliseconds
  elapsedTime: number; // Total elapsed time in seconds (excluding paused time)
  pausedAt?: number; // Unix timestamp when paused (if paused)
  totalPausedTime: number; // Total time spent paused in seconds
}

/**
 * In-memory fallback storage for when Redis is unavailable
 */
const inMemorySessions = new Map<string, { session: ActiveSession; expiresAt: number }>();

/**
 * Create a new active session
 * 
 * @param userId - User ID
 * @param ttlSeconds - Optional TTL for the session (default: 3600 seconds / 1 hour)
 * @returns Created session object
 * @throws Error if session creation fails
 */
export const createSession = async (
  userId: string,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS
): Promise<ActiveSession> => {
  const now = Date.now();
  const session: ActiveSession = {
    userId,
    status: SessionStatus.ACTIVE,
    startTime: now,
    lastUpdateTime: now,
    elapsedTime: 0,
    totalPausedTime: 0,
  };

  const sessionKey = getActiveSessionKey(userId);
  const redisAvailable = await isRedisConnected();
  
  if (redisAvailable) {
    try {
      await setWithTTL(sessionKey, JSON.stringify(session), ttlSeconds);
    } catch (error) {
      // Fallback to in-memory if Redis write fails
      console.warn('Redis write failed, using in-memory storage');
      inMemorySessions.set(sessionKey, {
        session,
        expiresAt: now + ttlSeconds * 1000,
      });
    }
  } else {
    // Use in-memory storage when Redis is unavailable
    inMemorySessions.set(sessionKey, {
      session,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  return session;
};

/**
 * Fetch active session by userId
 * 
 * @param userId - User ID
 * @returns Session object if exists, null otherwise
 */
export const getSession = async (userId: string): Promise<ActiveSession | null> => {
  const sessionKey = getActiveSessionKey(userId);
  const redisAvailable = await isRedisConnected();
  
  if (redisAvailable) {
    try {
      const sessionData = await get(sessionKey);
      if (sessionData) {
        return JSON.parse(sessionData) as ActiveSession;
      }
    } catch (error) {
      console.warn('Redis read failed, checking in-memory storage');
    }
  }
  
  // Fallback to in-memory storage
  const inMemoryData = inMemorySessions.get(sessionKey);
  if (inMemoryData) {
    // Check if expired
    if (Date.now() > inMemoryData.expiresAt) {
      inMemorySessions.delete(sessionKey);
      return null;
    }
    return inMemoryData.session;
  }
  
  return null;
};

/**
 * Update elapsed time for an active session
 * Automatically extends TTL to prevent expiration during active use
 * 
 * @param userId - User ID
 * @returns Updated session object, or null if session doesn't exist
 */
export const updateElapsedTime = async (userId: string): Promise<ActiveSession | null> => {
  try {
    const session = await getSession(userId);
    if (!session) {
      return null;
    }

    // Check if session is paused - don't update elapsed time if paused
    if (session.status === SessionStatus.PAUSED) {
      return session;
    }

    const now = Date.now();
    const timeSinceLastUpdate = (now - session.lastUpdateTime) / 1000; // Convert to seconds

    // Update elapsed time (only count active time, not paused time)
    session.elapsedTime += timeSinceLastUpdate;
    session.lastUpdateTime = now;

    // Get current TTL and extend it if needed (TTL safety)
    const sessionKey = getActiveSessionKey(userId);
    let currentTTL = await getTTL(sessionKey);

    // If TTL is -1 (no expiration) or -2 (key doesn't exist), use default
    if (currentTTL < 0) {
      currentTTL = DEFAULT_SESSION_TTL_SECONDS;
    }

    // Extend TTL to ensure session doesn't expire during active use
    // Refresh TTL to default value to give full time window
    const redisAvailable = await isRedisConnected();
    if (redisAvailable) {
      try {
        await setWithTTL(sessionKey, JSON.stringify(session), DEFAULT_SESSION_TTL_SECONDS);
      } catch (error) {
        // Fallback to in-memory
        inMemorySessions.set(sessionKey, {
          session,
          expiresAt: Date.now() + DEFAULT_SESSION_TTL_SECONDS * 1000,
        });
      }
    } else {
      // Update in-memory storage
      inMemorySessions.set(sessionKey, {
        session,
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_SECONDS * 1000,
      });
    }

    return session;
  } catch (error) {
    console.error(`Failed to update elapsed time for user ${userId}:`, error);
    return null;
  }
};

/**
 * Pause an active session
 * 
 * @param userId - User ID
 * @returns Updated session object, or null if session doesn't exist
 */
export const pauseSession = async (userId: string): Promise<ActiveSession | null> => {
  try {
    const session = await getSession(userId);
    if (!session) {
      return null;
    }

    if (session.status === SessionStatus.PAUSED) {
      return session; // Already paused
    }

    // Update elapsed time before pausing
    const now = Date.now();
    const timeSinceLastUpdate = (now - session.lastUpdateTime) / 1000;
    session.elapsedTime += timeSinceLastUpdate;
    session.lastUpdateTime = now;

    // Mark as paused
    session.status = SessionStatus.PAUSED;
    session.pausedAt = now;

    // Update session with TTL extension
    const sessionKey = getActiveSessionKey(userId);
    const redisAvailable = await isRedisConnected();
    if (redisAvailable) {
      try {
        let currentTTL = await getTTL(sessionKey);
        if (currentTTL < 0) {
          currentTTL = DEFAULT_SESSION_TTL_SECONDS;
        }
        await setWithTTL(sessionKey, JSON.stringify(session), DEFAULT_SESSION_TTL_SECONDS);
      } catch (error) {
        // Fallback to in-memory
        inMemorySessions.set(sessionKey, {
          session,
          expiresAt: Date.now() + DEFAULT_SESSION_TTL_SECONDS * 1000,
        });
      }
    } else {
      // Update in-memory storage
      inMemorySessions.set(sessionKey, {
        session,
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_SECONDS * 1000,
      });
    }

    return session;
  } catch (error) {
    console.error(`Failed to pause session for user ${userId}:`, error);
    return null;
  }
};

/**
 * Resume a paused session
 * 
 * @param userId - User ID
 * @returns Updated session object, or null if session doesn't exist
 */
export const resumeSession = async (userId: string): Promise<ActiveSession | null> => {
  try {
    const session = await getSession(userId);
    if (!session) {
      return null;
    }

    if (session.status !== SessionStatus.PAUSED) {
      return session; // Not paused, return as-is
    }

    // Calculate total paused time
    const now = Date.now();
    if (session.pausedAt) {
      const pausedDuration = (now - session.pausedAt) / 1000; // Convert to seconds
      session.totalPausedTime += pausedDuration;
    }

    // Resume session
    session.status = SessionStatus.ACTIVE;
    session.lastUpdateTime = now;
    session.pausedAt = undefined;

    // Update session with TTL extension
    const sessionKey = getActiveSessionKey(userId);
    const redisAvailable = await isRedisConnected();
    if (redisAvailable) {
      try {
        let currentTTL = await getTTL(sessionKey);
        if (currentTTL < 0) {
          currentTTL = DEFAULT_SESSION_TTL_SECONDS;
        }
        await setWithTTL(sessionKey, JSON.stringify(session), DEFAULT_SESSION_TTL_SECONDS);
      } catch (error) {
        // Fallback to in-memory
        inMemorySessions.set(sessionKey, {
          session,
          expiresAt: Date.now() + DEFAULT_SESSION_TTL_SECONDS * 1000,
        });
      }
    } else {
      // Update in-memory storage
      inMemorySessions.set(sessionKey, {
        session,
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_SECONDS * 1000,
      });
    }

    return session;
  } catch (error) {
    console.error(`Failed to resume session for user ${userId}:`, error);
    return null;
  }
};

/**
 * Delete session on completion
 * 
 * @param userId - User ID
 * @returns true if session was deleted, false if it didn't exist
 */
export const deleteSession = async (userId: string): Promise<boolean> => {
  const sessionKey = getActiveSessionKey(userId);
  const redisAvailable = await isRedisConnected();
  
  let deleted = false;
  if (redisAvailable) {
    try {
      const redisDeleted = await del(sessionKey);
      deleted = redisDeleted > 0;
    } catch (error) {
      console.warn('Redis delete failed, checking in-memory storage');
    }
  }
  
  // Also delete from in-memory storage
  if (inMemorySessions.delete(sessionKey)) {
    deleted = true;
  }
  
  return deleted;
};

