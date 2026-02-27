import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { EmbeddingService } from './embedding.service';
import { JobEmbedWorker } from './job-embed.worker';
import { ResumeEmbedWorker } from './resume-embed.worker';
import { JobsModule } from '../jobs/jobs.module';
import { ResumeModule } from '../resume/resume.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'job.embed' },
      { name: 'resume.embed' },
      { name: 'match.compute' },
    ),
    JobsModule,
    ResumeModule,
  ],
  providers: [EmbeddingService, JobEmbedWorker, ResumeEmbedWorker],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
