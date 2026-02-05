import express, { Express } from 'express';
import { Server as HttpServer } from 'http';
import routes from './routes';

/**
 * Create and configure Express application
 */
const createApp = (): Express => {
  const app = express();

  // JSON and URL-encoded body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.use('/', routes);

  return app;
};

/**
 * Create HTTP server from Express app (required for Socket.IO)
 */
export const createHttpServer = (app: Express): HttpServer => {
  return new HttpServer(app);
};

export default createApp;
