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

    // Check Redis cache first
    const historyKey = getHistoryKey(userId);
    const cachedData = await get(historyKey);

    if (cachedData) {
      // Cache hit - return cached data
      const sessions = JSON.parse(cachedData);
      return res.status(200).json({
        userId,
        sessions,
        cached: true,
      });
    }

    // Cache miss - fetch from Prisma
    const sessions = await prisma.milkingSession.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        startTime: 'desc', // Sort by startTime descending (newest first)
      },
    });

    // Cache the result in Redis with TTL
    await setWithTTL(historyKey, JSON.stringify(sessions), HISTORY_CACHE_TTL_SECONDS);

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
