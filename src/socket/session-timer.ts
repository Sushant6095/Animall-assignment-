import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket-events';
import {
  createSession,
  getSession,
  updateElapsedTime,
  pauseSession,
  resumeSession,
  deleteSession,
  SessionStatus,
} from '../utils/session-storage';
import { acquireSessionLock, releaseSessionLock } from '../utils/session-lock';

/**
 * Map to track active timers for each user
 * Key: userId, Value: NodeJS.Timeout
 */
const activeTimers = new Map<string, NodeJS.Timeout>();

/**
 * Map to track socket IDs associated with user sessions
 * Key: userId, Value: Set of socket IDs
 */
const userSockets = new Map<string, Set<string>>();

/**
 * Start timer for a user session
 * Emits SESSION_TICK every second when session is ACTIVE
 */
export const startSessionTimer = (
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  userId: string
): void => {
  // Clear existing timer if any
  stopSessionTimer(userId);

  const timer = setInterval(async () => {
    try {
      const session = await getSession(userId);
      
      if (!session) {
        // Session doesn't exist, stop timer
        stopSessionTimer(userId);
        return;
      }

      // Only increment timer when status is ACTIVE (RUNNING)
      if (session.status === SessionStatus.ACTIVE) {
        // Update elapsed time in Redis
        const updatedSession = await updateElapsedTime(userId);
        
        if (updatedSession) {
          // Emit SESSION_TICK to all sockets for this user
          const sockets = userSockets.get(userId);
          if (sockets && sockets.size > 0) {
            const tickData = {
              userId,
              elapsedTime: updatedSession.elapsedTime,
              status: updatedSession.status,
            };
            // Emit to each socket for this user
            sockets.forEach((socketId) => {
              const socket = io.sockets.sockets.get(socketId);
              if (socket) {
                socket.emit('SESSION_TICK', tickData);
              }
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error in session timer for user ${userId}:`, error);
    }
  }, 1000); // Emit every second

  activeTimers.set(userId, timer);
};

/**
 * Stop timer for a user session
 */
export const stopSessionTimer = (userId: string): void => {
  const timer = activeTimers.get(userId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(userId);
  }
};

/**
 * Register a socket for a user
 */
export const registerUserSocket = (userId: string, socketId: string): void => {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socketId);
};

/**
 * Unregister a socket for a user
 */
export const unregisterUserSocket = (userId: string, socketId: string): void => {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
      // Stop timer if no sockets are connected
      stopSessionTimer(userId);
    }
  }
};

