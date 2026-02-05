import { setNxWithTTL, del, exists } from './redis';
import { getMilkingLockKey } from '../constants/redis-keys';

/**
 * Default TTL for session locks (5 minutes)
 */
const DEFAULT_LOCK_TTL_SECONDS = 300;

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
  try {
    const lockKey = getMilkingLockKey(userId);
    const lockValue = `locked:${Date.now()}`;
    
    const acquired = await setNxWithTTL(lockKey, lockValue, ttlSeconds);
    
    if (!acquired) {
      return false; // Lock already exists, fail gracefully
    }
    
    return true;
  } catch (error) {
    // Fail gracefully - log error but don't throw
    console.error(`Failed to acquire session lock for user ${userId}:`, error);
    return false;
  }
};

/**
 * Release a distributed lock for a milking session
 * 
 * @param userId - User ID to release lock for
 * @returns true if lock was released, false if lock didn't exist or release failed
 * @throws Error if Redis operation fails
 */
export const releaseSessionLock = async (userId: string): Promise<boolean> => {
  try {
    const lockKey = getMilkingLockKey(userId);
    const deleted = await del(lockKey);
    
    return deleted > 0; // Returns true if key was deleted (existed)
  } catch (error) {
    // Fail gracefully - log error but don't throw
    console.error(`Failed to release session lock for user ${userId}:`, error);
    return false;
  }
};

/**
 * Check if a session lock exists for a user
 * 
 * @param userId - User ID to check
 * @returns true if lock exists, false otherwise
 */
export const hasSessionLock = async (userId: string): Promise<boolean> => {
  try {
    const lockKey = getMilkingLockKey(userId);
    return await exists(lockKey);
  } catch (error) {
    console.error(`Failed to check session lock for user ${userId}:`, error);
    return false;
  }
};
