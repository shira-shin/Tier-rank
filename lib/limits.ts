import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { getRedis } from "@/lib/upstash";

type LimitVariant = "user" | "guest";
type LimitType = "score" | "web";

type LimitConfig = {
  window: `${number} ${"d" | "h" | "m" | "s"}`;
  limit: number;
  prefix: string;
};

const LIMITS: Record<LimitType, Record<LimitVariant, LimitConfig>> = {
  score: {
    user: { limit: 50, window: "1 d", prefix: "ratelimit:score" },
    guest: { limit: 5, window: "1 d", prefix: "ratelimit:score:guest" },
  },
  web: {
    user: { limit: 10, window: "1 d", prefix: "ratelimit:web" },
    guest: { limit: 2, window: "1 d", prefix: "ratelimit:web:guest" },
  },
};

const limiterCache = new Map<string, Ratelimit>();
let cachedRedis: Redis | null | undefined;

function resolveRedis(): Redis | null {
  if (cachedRedis === undefined) {
    cachedRedis = getRedis();
  }
  return cachedRedis ?? null;
}

function getLimiter(type: LimitType, variant: LimitVariant): Ratelimit | null {
  const cacheKey = `${type}:${variant}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const redis = resolveRedis();
  if (!redis) {
    return null;
  }

  const config = LIMITS[type][variant];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    prefix: config.prefix,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

export type RateCheck = {
  remaining: number;
  reset: Date;
  success: boolean;
};

function fallbackResult(): RateCheck {
  return {
    remaining: Number.POSITIVE_INFINITY,
    reset: new Date(Date.now() + 60_000),
    success: true,
  };
}

async function checkLimit(
  identifier: string,
  type: LimitType,
  variant: LimitVariant,
): Promise<RateCheck> {
  const limiter = getLimiter(type, variant);
  if (!limiter) {
    return fallbackResult();
  }

  const result = await limiter.limit(identifier);
  const resetAt =
    typeof result.reset === "number"
      ? new Date(result.reset * 1000)
      : (result.reset as Date);

  return {
    remaining: result.remaining,
    reset: resetAt,
    success: result.success,
  };
}

export async function checkScoreLimit(
  identifier: string,
  options: { loggedIn?: boolean } = {},
): Promise<RateCheck> {
  const variant: LimitVariant = options.loggedIn ? "user" : "guest";
  return checkLimit(identifier, "score", variant);
}

export async function checkWebLimit(
  identifier: string,
  options: { loggedIn?: boolean } = {},
): Promise<RateCheck> {
  const variant: LimitVariant = options.loggedIn ? "user" : "guest";
  return checkLimit(identifier, "web", variant);
}

export async function applyLimit(
  identifier: string,
  options: { loggedIn: boolean; type: LimitType },
): Promise<RateCheck> {
  if (options.type === "score") {
    return checkScoreLimit(identifier, { loggedIn: options.loggedIn });
  }
  return checkWebLimit(identifier, { loggedIn: options.loggedIn });
}
