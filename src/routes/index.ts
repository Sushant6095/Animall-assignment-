import { Router } from 'express';
import healthRouter from './health';
import sessionsRouter from './sessions';

/**
 * Main router combining all route modules
 */
const router = Router();

router.use('/', healthRouter);
router.use('/', sessionsRouter);

export default router;
