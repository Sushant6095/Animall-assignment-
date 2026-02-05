import { prisma } from './prisma';
import { ActiveSession } from './session-storage';

/**
 * Persist a completed session to the database
 * Ensures idempotency by checking for existing session with same userId and startTime
 * 
 * @param session - Active session from Redis
 * @returns Created or existing MilkingSession record
 */
export const persistCompletedSession = async (
  session: ActiveSession
): Promise<{ id: string; created: boolean }> => {
  try {
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
    return {
      id: milkingSession.id,
      created: true,
    };
  } catch (error) {
    console.error('Error persisting session:', error);
    throw error;
  }
};
