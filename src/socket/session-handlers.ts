import { Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket-events';
import {
  createSession,
  getSession,
  pauseSession,
  resumeSession,
  deleteSession,
  SessionStatus,
} from '../utils/session-storage';
import { acquireSessionLock, releaseSessionLock } from '../utils/session-lock';
import {
  startSessionTimer,
  stopSessionTimer,
  registerUserSocket,
  unregisterUserSocket,
} from './session-timer';
import { persistCompletedSession } from '../utils/session-persistence';

/**
 * Handle SESSION_START event
 */
export const handleSessionStart = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: { userId: string }
): Promise<void> => {
  try {
    const { userId } = data;

    // Try to acquire lock
    const lockAcquired = await acquireSessionLock(userId);
    if (!lockAcquired) {
      socket.emit('error', {
        message: 'Session already active or lock could not be acquired',
        code: 'SESSION_LOCK_FAILED',
      });
      return;
    }

    // Check if session already exists
    const existingSession = await getSession(userId);
    if (existingSession) {
      // Release lock if session exists
      await releaseSessionLock(userId);
      socket.emit('error', {
        message: 'Session already exists',
        code: 'SESSION_EXISTS',
      });
      return;
    }

    // Create new session in Redis
    const session = await createSession(userId);

    // Register socket for this user
    registerUserSocket(userId, socket.id);
    socket.data.userId = userId;

    // Start server-side timer
    const io = socket.server;
    startSessionTimer(io, userId);

    // Emit SESSION_STARTED event
    socket.emit('SESSION_STARTED', {
      userId: session.userId,
      startTime: session.startTime,
      elapsedTime: session.elapsedTime,
    });
  } catch (error) {
    console.error('Error handling SESSION_START:', error);
    socket.emit('error', {
      message: 'Failed to start session',
      code: 'SESSION_START_ERROR',
    });
  }
};

/**
 * Handle SESSION_PAUSE event
 */
export const handleSessionPause = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: { userId: string }
): Promise<void> => {
  try {
    const { userId } = data;

    // Verify socket is associated with this user
    if (socket.data.userId !== userId) {
      socket.emit('error', {
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Pause session in Redis
    const session = await pauseSession(userId);
    if (!session) {
      socket.emit('error', {
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
      return;
    }

    // Emit SESSION_PAUSED event
    socket.emit('SESSION_PAUSED', {
      userId: session.userId,
      elapsedTime: session.elapsedTime,
    });
  } catch (error) {
    console.error('Error handling SESSION_PAUSE:', error);
    socket.emit('error', {
      message: 'Failed to pause session',
      code: 'SESSION_PAUSE_ERROR',
    });
  }
};

/**
 * Handle SESSION_RESUME event
 */
export const handleSessionResume = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: { userId: string }
): Promise<void> => {
  try {
    const { userId } = data;

    // Verify socket is associated with this user
    if (socket.data.userId !== userId) {
      socket.emit('error', {
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Resume session in Redis
    const session = await resumeSession(userId);
    if (!session) {
      socket.emit('error', {
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
      return;
    }

    // Ensure timer is running
    const io = socket.server;
    startSessionTimer(io, userId);

    // Emit SESSION_RESUMED event
    socket.emit('SESSION_RESUMED', {
      userId: session.userId,
      elapsedTime: session.elapsedTime,
    });
  } catch (error) {
    console.error('Error handling SESSION_RESUME:', error);
    socket.emit('error', {
      message: 'Failed to resume session',
      code: 'SESSION_RESUME_ERROR',
    });
  }
};

/**
 * Handle SESSION_STOP event
 */
export const handleSessionStop = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: { userId: string }
): Promise<void> => {
  try {
    const { userId } = data;

    // Verify socket is associated with this user
    if (socket.data.userId !== userId) {
      socket.emit('error', {
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Get session before deleting
    const session = await getSession(userId);
    if (!session) {
      socket.emit('error', {
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
      return;
    }

    // Update elapsed time one last time
    const finalElapsedTime = session.status === SessionStatus.ACTIVE
      ? session.elapsedTime + (Date.now() - session.lastUpdateTime) / 1000
      : session.elapsedTime;

    // Update session with final elapsed time before persisting
    const finalSession: typeof session = {
      ...session,
      elapsedTime: finalElapsedTime,
      status: SessionStatus.COMPLETED,
    };

    // Persist completed session to database (with idempotency)
    const persisted = await persistCompletedSession(finalSession);
    if (persisted) {
      console.log(`Session persisted: ${persisted.id} (created: ${persisted.created})`);
    }
    // Continue with cleanup even if persistence fails (persisted will be null)

    // Stop timer
    stopSessionTimer(userId);

    // Clear Redis state
    await deleteSession(userId);

    // Release lock
    await releaseSessionLock(userId);

    // Unregister socket
    unregisterUserSocket(userId, socket.id);
    socket.data.userId = undefined;

    // Emit SESSION_STOPPED event
    socket.emit('SESSION_STOPPED', {
      userId,
      totalElapsedTime: finalElapsedTime,
    });
  } catch (error) {
    console.error('Error handling SESSION_STOP:', error);
    socket.emit('error', {
      message: 'Failed to stop session',
      code: 'SESSION_STOP_ERROR',
    });
  }
};

/**
 * Handle SESSION_SYNC event (for reconnection recovery)
 */
export const handleSessionSync = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: { userId: string }
): Promise<void> => {
  try {
    const { userId } = data;

    // Get current session from Redis
    const session = await getSession(userId);
    if (!session) {
      socket.emit('error', {
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
      return;
    }

    // Register socket for this user if not already registered
    if (socket.data.userId !== userId) {
      registerUserSocket(userId, socket.id);
      socket.data.userId = userId;
    }

    // Resume timer if session is active (recovery logic)
    if (session.status === SessionStatus.ACTIVE) {
      const io = socket.server;
      startSessionTimer(io, userId);
    }

    // Emit SESSION_SYNC response with current state
    socket.emit('SESSION_SYNC', {
      userId: session.userId,
      elapsedTime: session.elapsedTime,
      status: session.status,
      startTime: session.startTime,
    });

    // Also emit SESSION_STATE for recovery
    socket.emit('SESSION_STATE', {
      userId: session.userId,
      elapsedTime: session.elapsedTime,
      status: session.status,
      startTime: session.startTime,
      lastUpdateTime: session.lastUpdateTime,
    });
  } catch (error) {
    console.error('Error handling SESSION_SYNC:', error);
    socket.emit('error', {
      message: 'Failed to sync session',
      code: 'SESSION_SYNC_ERROR',
    });
  }
};

/**
 * Recover session state on reconnect
 * This is called automatically when a socket connects with a userId
 */
export const recoverSessionOnReconnect = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  userId: string
): Promise<void> => {
  try {
    // Get current session from Redis
    const session = await getSession(userId);
    if (!session) {
      // No active session to recover
      return;
    }

    // Register socket for this user
    registerUserSocket(userId, socket.id);
    socket.data.userId = userId;

    // Resume timer if session is active
    if (session.status === SessionStatus.ACTIVE) {
      const io = socket.server;
      startSessionTimer(io, userId);
    }

    // Emit SESSION_STATE for recovery
    socket.emit('SESSION_STATE', {
      userId: session.userId,
      elapsedTime: session.elapsedTime,
      status: session.status,
      startTime: session.startTime,
      lastUpdateTime: session.lastUpdateTime,
    });

    console.log(`Session recovered for user ${userId} on socket ${socket.id}`);
  } catch (error) {
    console.error(`Error recovering session for user ${userId}:`, error);
  }
};
