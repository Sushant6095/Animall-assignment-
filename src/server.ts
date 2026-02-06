import { Express } from 'express';
import createApp, { createHttpServer } from './app';
import { config } from './config/env';
import { initializeSocketIO } from './socket/socket-handler';

/**
 * Start the HTTP server with WebSocket support
 */
const startServer = () => {
  try {
    const port = config.port;

    // Create Express app
    const app: Express = createApp();

    // Create HTTP server (required for Socket.IO)
    const httpServer = createHttpServer(app);

    // Initialize WebSocket server
    initializeSocketIO(httpServer);

    // Start listening
    httpServer.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Sessions API: http://localhost:${port}/sessions`);
      console.log(`WebSocket server initialized`);
    });

    // Handle server errors
    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please stop the other process or use a different port.`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      httpServer.close(() => {
        process.exit(1);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      httpServer.close(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
