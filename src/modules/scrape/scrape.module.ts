import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { ScrapeService } from './scrape.service';
import { ScrapeWorker } from './scrape.worker';
import { RateLimiter } from './rate-limiter';
import { ScrapeRun } from './entities/scrape-run.entity';
import {
  GreenhouseConnector,
  LeverConnector,
  AshbyConnector,
  WorkdayConnector,
  SmartRecruitersConnector,
} from './connectors';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScrapeRun]),
    BullModule.registerQueue(
      { name: 'scrape.target' },
      { name: 'job.embed' },
    ),
    JobsModule,
  ],
  providers: [
    ScrapeService,
    ScrapeWorker,
    RateLimiter,
    GreenhouseConnector,
    LeverConnector,
    AshbyConnector,
    WorkdayConnector,
    SmartRecruitersConnector,
  ],
  exports: [ScrapeService],
})
export class ScrapeModule {}
