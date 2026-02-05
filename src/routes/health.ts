import { Router, Request, Response } from 'express';
import { isRedisConnected } from '../utils/redis';

const router = Router();

/**
 * Health check endpoint
 * Returns server status and Redis connection status
 */
router.get('/health', async (req: Request, res: Response) => {
  const redisStatus = await isRedisConnected();

  const status = redisStatus ? 'ok' : 'degraded';
  const statusCode = redisStatus ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      redis: redisStatus ? 'connected' : 'disconnected',
    },
  });
});

export default router;
