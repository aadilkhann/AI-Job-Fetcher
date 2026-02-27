import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MatchingService } from './matching.service';

@Processor('match.compute')
export class MatchWorker extends WorkerHost {
  private readonly logger = new Logger(MatchWorker.name);

  constructor(private readonly matchingService: MatchingService) {
    super();
  }

  async process(
    job: Job<
      | { jobId: string }
      | { userId: string; resumeId: string }
    >,
  ) {
    if ('jobId' in job.data) {
      // New job was discovered — match against all users
      const count = await this.matchingService.matchNewJob(job.data.jobId);
      this.logger.log(
        `Matched new job ${job.data.jobId} against ${count} users`,
      );
    } else if ('resumeId' in job.data) {
      // User uploaded/updated resume — match against recent jobs
      const count = await this.matchingService.matchUserResume(
        job.data.userId,
        job.data.resumeId,
      );
      this.logger.log(
        `Matched resume ${job.data.resumeId} against ${count} jobs`,
      );
    }
  }
}
