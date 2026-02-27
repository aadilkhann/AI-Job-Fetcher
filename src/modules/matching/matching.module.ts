import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { MatchWorker } from './matching.worker';
import { JobMatch } from './entities/job-match.entity';
import { Job } from '../jobs/entities/job.entity';
import { Resume } from '../resume/entities/resume.entity';
import { UserSearchProfile } from '../users/entities/user-search-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobMatch, Job, Resume, UserSearchProfile]),
    BullModule.registerQueue(
      { name: 'match.compute' },
      { name: 'notify.prepare' },
    ),
  ],
  controllers: [MatchingController],
  providers: [MatchingService, MatchWorker],
  exports: [MatchingService],
})
export class MatchingModule {}
