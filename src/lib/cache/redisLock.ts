import { randomUUID } from "node:crypto";
import Redis from "ioredis";

export type RedisLock = {
  key: string;
  token: string;
  release(): Promise<boolean>;
};

const releaseLockScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

export async function acquireRedisLock({
  key,
  ttlMs,
}: {
  key: string;
  ttlMs: number;
}): Promise<RedisLock | null> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required for Redis locks.");
  }

  const redis = createRedis(redisUrl);
  const token = randomUUID();

  try {
    await redis.connect();
    const acquired = await redis.set(key, token, "PX", ttlMs, "NX");

    if (acquired !== "OK") {
      redis.disconnect();
      return null;
    }

    return {
      key,
      token,
      async release() {
        try {
          const released = await redis.eval(releaseLockScript, 1, key, token);
          return released === 1;
        } finally {
          redis.disconnect();
        }
      },
    };
  } catch (error) {
    redis.disconnect();
    throw error;
  }
}

function createRedis(redisUrl: string) {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });

  redis.on("error", () => undefined);
  return redis;
}
