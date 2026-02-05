import app, { createHttpServer } from './app';
import { config } from './config/env';
import { initializeSocketIO } from './socket/socket-handler';

/**
 * Start the HTTP server with WebSocket support
 */
const startServer = () => {
  const port = config.port;

  // Create HTTP server (required for Socket.IO)
  const httpServer = createHttpServer(app);

  // Initialize WebSocket server
  initializeSocketIO(httpServer);

  // Start listening
  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`WebSocket server initialized`);
  });
};

startServer();
