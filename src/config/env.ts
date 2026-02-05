import dotenv from 'dotenv';

dotenv.config();

/**
 * Application configuration interface
 */
interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
}

/**
 * Load and validate environment configuration
 */
const getConfig = (): Config => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl,
    redisUrl: redisUrl || `redis://${redisHost}:${redisPort}`,
    redisHost,
    redisPort,
    redisPassword,
  };
};

export const config = getConfig();
