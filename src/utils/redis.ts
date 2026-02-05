import { createClient, RedisClientType } from 'redis';
import { config } from '../config/env';

let redisClient: RedisClientType | null = null;

export const getRedisClient = (): RedisClientType => {
  if (redisClient) {
    return redisClient;
  }

  const client = createClient({
    url: config.redisUrl,
    password: config.redisPassword,
    socket: {
      host: config.redisHost,
      port: config.redisPort,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          return new Error('Too many reconnection attempts');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
  });

  client.on('disconnect', () => {
    console.log('Redis Client Disconnected');
  });

  redisClient = client as RedisClientType;
  return redisClient;
};

export const connectRedis = async (): Promise<void> => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
};

export const isRedisConnected = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
};

// TTL-based key operations
export const setWithTTL = async (
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  await client.setEx(key, ttlSeconds, value);
};

export const get = async (key: string): Promise<string | null> => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return await client.get(key);
};

export const del = async (key: string): Promise<number> => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return await client.del(key);
};

export const exists = async (key: string): Promise<boolean> => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  const result = await client.exists(key);
  return result === 1;
};

export const getTTL = async (key: string): Promise<number> => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return await client.ttl(key);
};

/**
 * Set key with value only if it doesn't exist (NX) and set TTL
 * @param key - Redis key
 * @param value - Value to set
 * @param ttlSeconds - Time to live in seconds
 * @returns true if key was set, false if key already exists
 */
export const setNxWithTTL = async (
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean> => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  const result = await client.set(key, value, {
    EX: ttlSeconds,
    NX: true,
  });
  return result === 'OK';
};
