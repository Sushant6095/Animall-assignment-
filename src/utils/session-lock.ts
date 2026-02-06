import { setNxWithTTL, del, exists, isRedisConnected } from './redis';
import { getMilkingLockKey } from '../constants/redis-keys';

/**
 * Default TTL for session locks (5 minutes)
 */
const DEFAULT_LOCK_TTL_SECONDS = 300;

/**
 * In-memory fallback for locks when Redis is unavailable
 */
const inMemoryLocks = new Map<string, number>(); // userId -> expiration timestamp

/**
 * Acquire a distributed lock for a milking session
 * Uses SET NX with TTL to ensure atomic lock acquisition
 * 
 * @param userId - User ID to acquire lock for
 * @param ttlSeconds - Optional TTL for the lock (default: 300 seconds / 5 minutes)
 * @returns true if lock was acquired, false if lock already exists
 * @throws Error if Redis operation fails
 */
export const acquireSessionLock = async (
  userId: string,
  ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
): Promise<boolean> => {
  const lockKey = getMilkingLockKey(userId);
  const redisAvailable = await isRedisConnected();
  
  if (redisAvailable) {
    try {
      const lockValue = `locked:${Date.now()}`;
      const acquired = await setNxWithTTL(lockKey, lockValue, ttlSeconds);
      
      if (!acquired) {
        return false; // Lock already exists
      }
      
      return true;
    } catch (error) {
      console.warn('Redis lock failed, using in-memory lock');
    }
  }
  
  // Fallback to in-memory lock
  const now = Date.now();
  const existingLock = inMemoryLocks.get(userId);
  if (existingLock && existingLock > now) {
    return false; // Lock already exists and hasn't expired
  }
  
  // Acquire lock
  inMemoryLocks.set(userId, now + ttlSeconds * 1000);
  return true;
};

/**
 * Release a distributed lock for a milking session
 * 
 * @param userId - User ID to release lock for
 * @returns true if lock was released, false if lock didn't exist or release failed
 * @throws Error if Redis operation fails
 */
export const releaseSessionLock = async (userId: string): Promise<boolean> => {
  const lockKey = getMilkingLockKey(userId);
  const redisAvailable = await isRedisConnected();
  
  let released = false;
  if (redisAvailable) {
    try {
      const deleted = await del(lockKey);
      released = deleted > 0;
    } catch (error) {
      console.warn('Redis lock release failed, checking in-memory');
    }
  }
  
  // Also release from in-memory
  if (inMemoryLocks.delete(userId)) {
    released = true;
  }
  
  return released;
};

/**
 * Check if a session lock exists for a user
 * 
 * @param userId - User ID to check
 * @returns true if lock exists, false otherwise
 */
export const hasSessionLock = async (userId: string): Promise<boolean> => {
  const lockKey = getMilkingLockKey(userId);
  const redisAvailable = await isRedisConnected();
  
  if (redisAvailable) {
    try {
      return await exists(lockKey);
    } catch (error) {
      console.warn('Redis lock check failed, checking in-memory');
    }
  }
  
  // Check in-memory lock
  const lockExpiry = inMemoryLocks.get(userId);
  if (lockExpiry) {
    if (Date.now() < lockExpiry) {
      return true; // Lock exists and hasn't expired
    } else {
      // Lock expired, clean it up
      inMemoryLocks.delete(userId);
    }
  }
  
  return false;
};
