import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScrapeService } from './scrape.service';

@Processor('scrape.target')
export class ScrapeWorker extends WorkerHost {
  private readonly logger = new Logger(ScrapeWorker.name);

  constructor(private readonly scrapeService: ScrapeService) {
    super();
  }

  async process(job: Job<{ targetUrl: string; sourceHint?: string }>) {
    this.logger.log(`Processing scrape job: ${job.data.targetUrl}`);
    return this.scrapeService.scrapeTarget(
      job.data.targetUrl,
      job.data.sourceHint,
    );
  }
}
