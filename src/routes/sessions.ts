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
  try {
    const { userId } = req.query;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'userId query parameter is required',
      });
    }

    // Check Redis cache first (with timeout)
    const historyKey = getHistoryKey(userId);
    let cachedData: string | null = null;
    try {
      cachedData = await withTimeout(
        get(historyKey),
        3000, // 3 second timeout for Redis
        'Redis operation timed out'
      );
    } catch (redisError: any) {
      // Redis timeout or error - continue to database query
      console.warn('Redis cache check failed or timed out:', redisError?.message);
    }

    if (cachedData) {
      // Cache hit - return cached data
      try {
        const sessions = JSON.parse(cachedData);
        return res.status(200).json({
          userId,
          sessions,
          cached: true,
        });
      } catch (parseError) {
        // Invalid cache data - continue to database query
        console.warn('Failed to parse cached data, fetching from database');
      }
    }

    // Cache miss - fetch from Prisma (with timeout)
    let sessions = [];
    try {
      sessions = await withTimeout(
        prisma.milkingSession.findMany({
          where: {
            userId: userId,
          },
          orderBy: {
            startTime: 'desc', // Sort by startTime descending (newest first)
          },
        }),
        5000, // 5 second timeout for database
        'Database query timed out'
      );

      // Cache the result in Redis with TTL (if we got data) - don't wait for this
      if (sessions.length > 0) {
        setWithTTL(historyKey, JSON.stringify(sessions), HISTORY_CACHE_TTL_SECONDS).catch((err) => {
          // Ignore Redis caching errors
          console.warn('Failed to cache session history:', err?.message);
        });
      }
    } catch (dbError: any) {
      // Handle database errors gracefully
      if (dbError?.message?.includes('timed out')) {
        console.warn('Database query timed out - returning empty array');
        return res.status(200).json({
          userId,
          sessions: [],
          cached: false,
          message: 'Database query timed out. Please try again later.',
        });
      }
      if (dbError?.message?.includes('does not exist') || dbError?.code === '42P01' || dbError?.code === 'P1001') {
        // Database unavailable or table doesn't exist
        console.warn('Database unavailable for session history - returning empty array');
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
    return res.status(200).json({
      userId,
      sessions,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({
      error: 'Failed to fetch sessions',
    });
  }
});

export default router;
