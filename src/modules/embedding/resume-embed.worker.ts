import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { EmbeddingService } from './embedding.service';
import { ResumeService } from '../resume/resume.service';

@Processor('resume.embed')
export class ResumeEmbedWorker extends WorkerHost {
  private readonly logger = new Logger(ResumeEmbedWorker.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly resumeService: ResumeService,
    @InjectQueue('match.compute') private readonly matchQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ resumeId: string }>) {
    const resume = await this.resumeService.findById(job.data.resumeId);
    if (!resume || !resume.parsedText) {
      this.logger.warn(`Resume not ready for embedding: ${job.data.resumeId}`);
      return;
    }

    if (resume.embedding && resume.embedding.length > 0) {
      this.logger.log(`Resume already embedded: ${resume.id}`);
      return;
    }

    const embedding = await this.embeddingService.embed(resume.parsedText);

    if (embedding.length > 0) {
      await this.resumeService.updateEmbedding(
        resume.id,
        embedding,
        this.embeddingService.modelName,
        this.embeddingService.modelVersion,
      );

      // Enqueue matching for this user
      await this.matchQueue.add('match-user-resume', {
        userId: resume.userId,
        resumeId: resume.id,
      });
    }
  }
}
