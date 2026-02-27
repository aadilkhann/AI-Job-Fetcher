import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotifyService } from './notify.service';

@Processor('notify.prepare')
export class NotifyWorker extends WorkerHost {
  private readonly logger = new Logger(NotifyWorker.name);

  constructor(private readonly notifyService: NotifyService) {
    super();
  }

  async process(
    job: Job<{
      userId: string;
      jobId: string;
      matchId: string;
      score: number;
      type: 'realtime' | 'digest';
    }>,
  ) {
    await this.notifyService.prepareAndSend(
      job.data.userId,
      job.data.jobId,
      job.data.matchId,
      job.data.score,
      job.data.type,
    );
  }
}
