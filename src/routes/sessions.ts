import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { get, setWithTTL } from '../utils/redis';
import { getHistoryKey } from '../constants/redis-keys';

const router = Router();

/**
 * Default cache TTL for session history (5 minutes)
 */
const HISTORY_CACHE_TTL_SECONDS = 300;

/**
 * Timeout wrapper to prevent operations from hanging indefinitely
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
};

/**
 * GET /sessions
 * Fetch completed sessions for a user
 * 
 * Query params:
 * - userId: string (required) - User ID to fetch sessions for
 */
router.get('/sessions', async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`[Sessions] Request received for userId: ${req.query.userId}`);
  
  try {
    const { userId } = req.query;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'userId query parameter is required',
      });
    }

    // Check Redis cache first (with shorter timeout to fail fast)
    const historyKey = getHistoryKey(userId);
    let cachedData: string | null = null;
    try {
      console.log(`[Sessions] Checking Redis cache for key: ${historyKey}`);
      // Use a very short timeout for Redis to fail fast
      cachedData = await Promise.race([
        get(historyKey),
        new Promise<string | null>((resolve) => 
          setTimeout(() => {
            console.warn('[Sessions] Redis operation timed out, skipping cache');
            resolve(null);
          }, 1500) // 1.5 second timeout - fail fast
        )
      ]);
      console.log(`[Sessions] Redis cache ${cachedData ? 'hit' : 'miss'}`);
    } catch (redisError: any) {
      // Redis timeout or error - continue to database query
      console.warn(`[Sessions] Redis cache check failed: ${redisError?.message}`);
      cachedData = null; // Ensure it's null
    }

    if (cachedData) {
      // Cache hit - return cached data
      try {
        const sessions = JSON.parse(cachedData);
        const duration = Date.now() - startTime;
        console.log(`[Sessions] Returning cached data (${sessions.length} sessions) in ${duration}ms`);
        return res.status(200).json({
          userId,
          sessions,
          cached: true,
        });
      } catch (parseError) {
        // Invalid cache data - continue to database query
        console.warn('[Sessions] Failed to parse cached data, fetching from database');
      }
    }

    // Cache miss - fetch from Prisma (with timeout)
    console.log(`[Sessions] Fetching from database for userId: ${userId}`);
    let sessions = [];
    try {
      // Use Promise.race for more reliable timeout
      sessions = await Promise.race([
        prisma.milkingSession.findMany({
          where: {
            userId: userId,
          },
          orderBy: {
            startTime: 'desc', // Sort by startTime descending (newest first)
          },
        }),
        new Promise<never[]>((_, reject) => 
          setTimeout(() => reject(new Error('Database query timed out')), 3000) // 3 second timeout
        )
      ]);
      console.log(`[Sessions] Database query successful, found ${sessions.length} sessions`);

      // Cache the result in Redis with TTL (if we got data) - don't wait for this
      if (sessions.length > 0) {
        setWithTTL(historyKey, JSON.stringify(sessions), HISTORY_CACHE_TTL_SECONDS).catch((err) => {
          // Ignore Redis caching errors
          console.warn('[Sessions] Failed to cache session history:', err?.message);
        });
      }
    } catch (dbError: any) {
      // Handle database errors gracefully
      console.error(`[Sessions] Database error:`, dbError?.message || dbError);
      
      if (dbError?.message?.includes('timed out')) {
        console.warn('[Sessions] Database query timed out - returning empty array');
        const duration = Date.now() - startTime;
        console.log(`[Sessions] Request completed in ${duration}ms (timeout)`);
        return res.status(200).json({
          userId,
          sessions: [],
          cached: false,
          message: 'Database query timed out. Please try again later.',
        });
      }
      if (dbError?.message?.includes('does not exist') || dbError?.code === '42P01' || dbError?.code === 'P1001') {
        // Database unavailable or table doesn't exist
        console.warn('[Sessions] Database unavailable - returning empty array');
        const duration = Date.now() - startTime;
        console.log(`[Sessions] Request completed in ${duration}ms (DB unavailable)`);
        return res.status(200).json({
          userId,
          sessions: [],
          cached: false,
          message: 'Database unavailable. Session history will be available once database is configured.',
        });
      }
      // Re-throw other errors to be caught by outer catch
      throw dbError;
    }

    // Return sorted sessions
    const duration = Date.now() - startTime;
    console.log(`[Sessions] Request completed successfully in ${duration}ms`);
    return res.status(200).json({
      userId,
      sessions,
      cached: false,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Sessions] Error after ${duration}ms:`, error?.message || error);
    return res.status(500).json({
      error: 'Failed to fetch sessions',
      message: error?.message || 'Unknown error',
    });
  }
});

export default router;
