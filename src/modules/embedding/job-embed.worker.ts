import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { EmbeddingService } from './embedding.service';
import { JobsService } from '../jobs/jobs.service';

@Processor('job.embed')
export class JobEmbedWorker extends WorkerHost {
  private readonly logger = new Logger(JobEmbedWorker.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly jobsService: JobsService,
    @InjectQueue('match.compute') private readonly matchQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string }>) {
    const { jobId } = job.data;
    this.logger.log(`Embedding job: ${jobId}`);

    // Look up the specific job by ID
    const targetJob = await this.jobsService.findById(jobId);

    if (!targetJob || targetJob.embedding) {
      // Already embedded or not found
      return;
    }

    const textToEmbed = `${targetJob.title} ${targetJob.locationText ?? ''} ${targetJob.descriptionText ?? ''}`.trim();

    if (!textToEmbed) {
      this.logger.warn(`No text for job ${jobId}`);
      return;
    }

    const embedding = await this.embeddingService.embed(textToEmbed);

    if (embedding.length > 0) {
      await this.jobsService.updateEmbedding(
        jobId,
        embedding,
        this.embeddingService.modelName,
        this.embeddingService.modelVersion,
      );

      // Enqueue matching for this new job
      await this.matchQueue.add('match-new-job', { jobId });
    }
  }
}
