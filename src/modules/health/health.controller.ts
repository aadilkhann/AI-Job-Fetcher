import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: parseInt(this.config.get('REDIS_PORT', '6379'), 10),
      lazyConnect: true,
    });
  }

  @Get()
  async check() {
    const dbOk = this.ds.isInitialized;
    let redisOk = false;
    try {
      await this.redis.ping();
      redisOk = true;
    } catch {}
    const allOk = dbOk && redisOk;
    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      db: dbOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
    };
  }
}
