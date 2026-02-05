import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket-events';
import {
  handleSessionStart,
  handleSessionPause,
  handleSessionResume,
  handleSessionStop,
  handleSessionSync,
  recoverSessionOnReconnect,
} from './session-handlers';
import { unregisterUserSocket, stopSessionTimer } from './session-timer';

let io: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null = null;

/**
 * Initialize Socket.IO server
 * 
 * @param httpServer - HTTP server instance from Express
 * @returns Socket.IO server instance
 */
export const initializeSocketIO = (
  httpServer: HttpServer
): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> => {
  if (io) {
    return io;
  }

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: '*', // Configure based on your frontend URL
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Check for userId in handshake query (for reconnection recovery)
    const userId = socket.handshake.query.userId as string | undefined;
    if (userId) {
      // Attempt to recover session on reconnect
      recoverSessionOnReconnect(socket, userId).catch((error) => {
        console.error(`Failed to recover session for user ${userId}:`, error);
      });
    }

    // Send connection confirmation
    socket.emit('connected', {
      socketId: socket.id,
      timestamp: Date.now(),
    });

    // Register session event handlers
    socket.on('SESSION_START', (data) => handleSessionStart(socket, data));
    socket.on('SESSION_PAUSE', (data) => handleSessionPause(socket, data));
    socket.on('SESSION_RESUME', (data) => handleSessionResume(socket, data));
    socket.on('SESSION_STOP', (data) => handleSessionStop(socket, data));
    socket.on('SESSION_SYNC', (data) => handleSessionSync(socket, data));

    // Handle ping
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      
      // Clean up user session if socket was associated with a user
      const userId = socket.data.userId;
      if (userId) {
        unregisterUserSocket(userId, socket.id);
        // Note: We don't stop the timer here because other sockets might still be connected
        // The timer will be stopped automatically when no sockets remain
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return io;
};

/**
 * Get the Socket.IO server instance
 * 
 * @returns Socket.IO server instance or null if not initialized
 */
export const getSocketIO = (): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null => {
  return io;
};

/**
 * Close Socket.IO server
 */
export const closeSocketIO = async (): Promise<void> => {
  if (io) {
    io.close();
    io = null;
  }
};
