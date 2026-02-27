import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ScrapeModule } from './modules/scrape/scrape.module';
import { ResumeModule } from './modules/resume/resume.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { MatchingModule } from './modules/matching/matching.module';
import { NotifyModule } from './modules/notify/notify.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // ── Global config ──
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // ── Database ──
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: cfg.getOrThrow<number>('DB_PORT'),
        username: cfg.get('DB_USERNAME', 'aijobfetcher'),
        password: cfg.get('DB_PASSWORD', 'changeme'),
        database: cfg.get('DB_DATABASE', 'aijobfetcher'),
        autoLoadEntities: true,
        synchronize: cfg.get('NODE_ENV') !== 'production',
        logging: cfg.get('NODE_ENV') !== 'production',
      }),
    }),

    // ── BullMQ queues ──
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get('REDIS_HOST', 'localhost'),
          port: cfg.getOrThrow<number>('REDIS_PORT'),
        },
      }),
    }),

    // ── Feature modules ──
    AuthModule,
    UsersModule,
    CompaniesModule,
    JobsModule,
    ScrapeModule,
    ResumeModule,
    EmbeddingModule,
    MatchingModule,
    NotifyModule,
    SchedulerModule,
    HealthModule,
  ],
})
export class AppModule {}
