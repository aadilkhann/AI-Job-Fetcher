import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { ScrapeRun } from './entities/scrape-run.entity';
import { JobsService } from '../jobs/jobs.service';
import { RateLimiter } from './rate-limiter';
import {
  GreenhouseConnector,
  LeverConnector,
  AshbyConnector,
  WorkdayConnector,
  SmartRecruitersConnector,
  ScraperConnector,
} from './connectors';

@Injectable()
export class ScrapeService {
  private readonly logger = new Logger(ScrapeService.name);
  private readonly connectors: ScraperConnector[];

  constructor(
    @InjectRepository(ScrapeRun)
    private readonly scrapeRunRepo: Repository<ScrapeRun>,
    private readonly jobsService: JobsService,
    private readonly rateLimiter: RateLimiter,
    @InjectQueue('job.embed') private readonly embedQueue: Queue,
    greenhouse: GreenhouseConnector,
    lever: LeverConnector,
    ashby: AshbyConnector,
    workday: WorkdayConnector,
    smartRecruiters: SmartRecruitersConnector,
  ) {
    this.connectors = [greenhouse, lever, ashby, workday, smartRecruiters];
  }

  /**
   * Scrape a single target URL: resolve connector, fetch jobs, dedupe+persist.
   */
  async scrapeTarget(
    targetUrl: string,
    sourceHint?: string,
  ): Promise<{ fetched: number; newJobs: number }> {
    const connector = this.resolveConnector(targetUrl, sourceHint);
    if (!connector) {
      this.logger.warn(`No connector for URL: ${targetUrl}`);
      return { fetched: 0, newJobs: 0 };
    }

    const run = this.scrapeRunRepo.create({
      targetUrl,
      status: 'running',
    });

    const source = await this.jobsService.getSourceByName(connector.sourceName);
    if (source) run.sourceId = source.id;
    await this.scrapeRunRepo.save(run);

    try {
      const domain = new URL(targetUrl).hostname;
      await this.rateLimiter.waitForSlot(domain);

      const canonicalJobs = await connector.discoverJobs(targetUrl);
      let newCount = 0;

      for (const cj of canonicalJobs) {
        const { isNew, job } = await this.jobsService.upsertJob({
          sourceId: source?.id ?? 0,
          externalJobId: cj.externalJobId,
          sourceJobUrl: cj.sourceJobUrl,
          title: cj.title,
          locationText: cj.locationText ?? undefined,
          descriptionText: cj.descriptionText ?? undefined,
          applyUrl: cj.applyUrl,
          postedDate: cj.postedDate ?? undefined,
          contentHash: cj.contentHash,
        });
        if (isNew) {
          newCount++;
          // Enqueue for embedding generation
          await this.embedQueue.add('embed-job', { jobId: job.id });
        }
      }

      run.status = 'completed';
      run.jobsFetched = canonicalJobs.length;
      run.jobsNew = newCount;
      run.finishedAt = new Date();
      await this.scrapeRunRepo.save(run);

      this.logger.log(
        `Scraped ${targetUrl}: ${canonicalJobs.length} fetched, ${newCount} new`,
      );
      return { fetched: canonicalJobs.length, newJobs: newCount };
    } catch (err: any) {
      run.status = 'failed';
      run.errorCode = err.code || 'UNKNOWN';
      run.errorMessage = err.message?.slice(0, 500);
      run.finishedAt = new Date();
      await this.scrapeRunRepo.save(run);
      this.logger.error(`Scrape failed for ${targetUrl}: ${err.message}`);
      throw err;
    }
  }

  private resolveConnector(
    url: string,
    hint?: string,
  ): ScraperConnector | undefined {
    // Try hint-based match first
    if (hint) {
      const byHint = this.connectors.find((c) => c.sourceName === hint);
      if (byHint) return byHint;
    }
    // Fallback to URL-based detection
    return this.connectors.find((c) => c.canHandle(url));
  }
}
