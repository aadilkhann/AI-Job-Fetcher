import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

/**
 * Redis-based token-bucket rate limiter per domain.
 * Prevents hammering any single host beyond the configured limit.
 */
@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private readonly redis: Redis;
  private readonly maxPerSecond: number;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.getOrThrow<number>('REDIS_PORT'),
    });
    this.maxPerSecond = parseInt(
      this.config.get('SCRAPE_RATE_LIMIT_PER_DOMAIN', '2'),
      10,
    );
  }

  /**
   * Wait until we can make a request to the given domain.
   * Uses a sliding-window counter in Redis.
   */
  async waitForSlot(domain: string): Promise<void> {
    const key = `ratelimit:${domain}`;
    while (true) {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 1); // 1-second window
      }
      if (count <= this.maxPerSecond) {
        return;
      }
      // Wait for window to expire
      const ttl = await this.redis.pttl(key);
      const waitMs = Math.max(ttl, 100);
      this.logger.debug(`Rate limited on ${domain}, waiting ${waitMs}ms`);
      await this.sleep(waitMs);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
