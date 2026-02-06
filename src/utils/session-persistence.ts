import { prisma } from './prisma';
import { ActiveSession } from './session-storage';

let lastDbErrorLogTime = 0;
const DB_ERROR_LOG_THROTTLE_MS = 30000; // Only log errors every 30 seconds

/**
 * Check if database is available and tables exist
 */
const isDatabaseAvailable = async (): Promise<boolean> => {
  try {
    // Try a simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if table exists by trying to query it (with limit 0 to avoid data transfer)
    try {
      await prisma.$queryRaw`SELECT 1 FROM milking_sessions LIMIT 0`;
      return true;
    } catch (tableError: any) {
      // Table doesn't exist
      if (tableError?.message?.includes('does not exist') || tableError?.code === '42P01') {
        return false;
      }
      // Other error, assume available
      return true;
    }
  } catch (error) {
    return false;
  }
};

/**
 * Persist a completed session to the database
 * Ensures idempotency by checking for existing session with same userId and startTime
 * Gracefully handles database unavailability
 * 
 * @param session - Active session from Redis
 * @returns Created or existing MilkingSession record, or null if database unavailable
 */
export const persistCompletedSession = async (
  session: ActiveSession
): Promise<{ id: string; created: boolean } | null> => {
  try {
    // Check if database is available first
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      const now = Date.now();
      if (now - lastDbErrorLogTime > DB_ERROR_LOG_THROTTLE_MS) {
        console.warn('Database unavailable - session will not be persisted. Sessions will work but history may not be saved.');
        lastDbErrorLogTime = now;
      }
      return null;
    }

    const startTime = new Date(session.startTime);
    const endTime = new Date();
    const duration = Math.round(session.elapsedTime); // Round to nearest second

    // Check for existing session (idempotency check)
    // Using findFirst with the unique constraint fields
    const existingSession = await prisma.milkingSession.findFirst({
      where: {
        userId: session.userId,
        startTime: startTime,
      },
    });

    if (existingSession) {
      // Session already exists, return existing record
      console.log(`Session already persisted for user ${session.userId} at ${startTime.toISOString()}`);
      return {
        id: existingSession.id,
        created: false,
      };
    }

    // Create new session record
    const milkingSession = await prisma.milkingSession.create({
      data: {
        userId: session.userId,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        elapsedTime: session.elapsedTime,
        pausedTime: session.totalPausedTime,
      },
    });

    console.log(`Session persisted for user ${session.userId}: ${milkingSession.id}`);
    lastDbErrorLogTime = 0; // Reset error log throttle on success
    return {
      id: milkingSession.id,
      created: true,
    };
  } catch (error: any) {
    const now = Date.now();
    
    // Handle Prisma connection errors gracefully
    if (error?.code === 'P1001' || error?.message?.includes("Can't reach database server")) {
      if (now - lastDbErrorLogTime > DB_ERROR_LOG_THROTTLE_MS) {
        console.warn('Database connection error - session will not be persisted. Sessions will work but history may not be saved.');
        console.warn('To fix: Check your DATABASE_URL environment variable and ensure the database server is running.');
        lastDbErrorLogTime = now;
      }
      return null;
    }
    
    // Handle missing table error (migrations not run)
    if (error?.message?.includes('does not exist') || error?.code === 'P2021' || error?.code === '42P01') {
      if (now - lastDbErrorLogTime > DB_ERROR_LOG_THROTTLE_MS) {
        console.warn('Database table does not exist - session will not be persisted.');
        console.warn('To fix: Run database migrations with: npm run prisma:migrate');
        console.warn('Sessions will work but history will not be saved until migrations are run.');
        lastDbErrorLogTime = now;
      }
      return null;
    }
    
    // For other errors, log but don't throw
    if (now - lastDbErrorLogTime > DB_ERROR_LOG_THROTTLE_MS) {
      console.error('Error persisting session:', error?.message || error);
      lastDbErrorLogTime = now;
    }
    return null;
  }
};
