import { createClient, RedisClientType } from 'redis';
import { config } from '../config/env';

let redisClient: RedisClientType | null = null;
let lastErrorLogTime = 0;
const ERROR_LOG_THROTTLE_MS = 10000; // Only log errors every 10 seconds

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
        // Stop reconnecting after 3 attempts to reduce spam
        if (retries > 3) {
          return false; // Stop reconnecting
        }
        return Math.min(retries * 500, 2000);
      },
    },
  });

  client.on('error', (err) => {
    const now = Date.now();
    // Throttle error logging to prevent spam
    if (now - lastErrorLogTime > ERROR_LOG_THROTTLE_MS) {
      console.error('Redis Client Error (Redis server may not be running):', err.message);
      console.error('To fix: Start Redis server or set REDIS_URL environment variable');
      lastErrorLogTime = now;
    }
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
    lastErrorLogTime = 0; // Reset error log throttle on successful connection
  });

  client.on('disconnect', () => {
    console.log('Redis Client Disconnected');
  });

  redisClient = client as RedisClientType;
  return redisClient;
};

export const connectRedis = async (): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
  } catch (error) {
    // Connection failed - error is already logged by error handler
    // Don't throw to allow app to continue without Redis
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      redisClient = null;
    }
  } catch (error) {
    // Ignore disconnect errors
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
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    await client.setEx(key, ttlSeconds, value);
  } catch (error) {
    // Silently fail if Redis is unavailable - app can continue without Redis
    // Error is already logged by the error handler
    // Don't throw - let caller handle fallback
  }
};

export const get = async (key: string): Promise<string | null> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      // Add timeout for connection attempt
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 2000)
        )
      ]);
    }
    // Add timeout for get operation
    return await Promise.race([
      client.get(key),
      new Promise<string | null>((_, reject) => 
        setTimeout(() => reject(new Error('Redis get operation timeout')), 2000)
      )
    ]);
  } catch (error) {
    // Return null if Redis is unavailable
    return null;
  }
};

export const del = async (key: string): Promise<number> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return await client.del(key);
  } catch (error) {
    // Return 0 if Redis is unavailable (key not deleted)
    return 0;
  }
};

export const exists = async (key: string): Promise<boolean> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    // Return false if Redis is unavailable
    return false;
  }
};

export const getTTL = async (key: string): Promise<number> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return await client.ttl(key);
  } catch (error) {
    // Return -2 (key doesn't exist) if Redis is unavailable
    return -2;
  }
};

/**
 * Set key with value only if it doesn't exist (NX) and set TTL
 * @param key - Redis key
 * @param value - Value to set
 * @param ttlSeconds - Time to live in seconds
 * @returns true if key was set, false if key already exists or Redis is unavailable
 */
export const setNxWithTTL = async (
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    const result = await client.set(key, value, {
      EX: ttlSeconds,
      NX: true,
    });
    return result === 'OK';
  } catch (error) {
    // Return false if Redis is unavailable
    return false;
  }
};
