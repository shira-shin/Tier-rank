import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/upstash";

export const scoreLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "1 d"),
  prefix: "ratelimit:score",
});

export const guestScoreLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 d"),
  prefix: "ratelimit:score:guest",
});

export const webLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 d"),
  prefix: "ratelimit:web",
});

export const guestWebLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "1 d"),
  prefix: "ratelimit:web:guest",
});

export type LimitResult = {
  remaining: number;
  reset: Date;
  success: boolean;
};

export async function applyLimit(identifier: string, options: {
  loggedIn: boolean;
  type: "score" | "web";
}): Promise<LimitResult> {
  const limiter = options.type === "score" ? (options.loggedIn ? scoreLimit : guestScoreLimit) : options.loggedIn ? webLimit : guestWebLimit;
  const result = await limiter.limit(identifier);
  // @upstash/ratelimit の reset は UNIX 秒(number)が返る。
  // UI 側で扱いやすいよう Date に正規化する。
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
