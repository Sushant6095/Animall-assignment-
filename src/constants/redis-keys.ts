/**
 * Redis key format constants and helper functions
 */

export const REDIS_KEY_PATTERNS = {
  ACTIVE_SESSION: 'active_session',
  LOCK_MILKING: 'lock:milking',
  HISTORY: 'history',
} as const;

/**
 * Generate Redis key for active session
 * @param userId - User ID
 * @returns Redis key: active_session:{userId}
 */
export const getActiveSessionKey = (userId: string): string => {
  return `${REDIS_KEY_PATTERNS.ACTIVE_SESSION}:${userId}`;
};

/**
 * Generate Redis key for milking lock
 * @param userId - User ID
 * @returns Redis key: lock:milking:{userId}
 */
export const getMilkingLockKey = (userId: string): string => {
  return `${REDIS_KEY_PATTERNS.LOCK_MILKING}:${userId}`;
};

/**
 * Generate Redis key for user history
 * @param userId - User ID
 * @returns Redis key: history:{userId}
 */
export const getHistoryKey = (userId: string): string => {
  return `${REDIS_KEY_PATTERNS.HISTORY}:${userId}`;
};
