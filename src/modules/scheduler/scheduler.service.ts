import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CompaniesService } from '../companies/companies.service';
import { NotifyService } from '../notify/notify.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue('scrape.target') private readonly scrapeQueue: Queue,
    private readonly companiesService: CompaniesService,
    private readonly notifyService: NotifyService,
  ) {}

  /**
   * Every 6 hours: enqueue all active company targets for scraping.
   */
  @Cron('0 */6 * * *')
  async scheduleScraping(): Promise<void> {
    this.logger.log('Scheduler: enqueueing scrape targets...');
    const targets = await this.companiesService.getAllActiveTargets();

    for (const target of targets) {
      await this.scrapeQueue.add(
        'scrape',
        {
          targetUrl: target.careerUrl,
          sourceHint: target.sourceHint,
        },
        {
          jobId: `scrape-${target.id}-${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      );
    }

    this.logger.log(`Scheduler: enqueued ${targets.length} scrape targets`);
  }

  /**
   * Daily at 9:00 UTC: send pending digest notifications.
   */
  @Cron('0 9 * * *')
  async sendDigests(): Promise<void> {
    this.logger.log('Scheduler: processing digest notifications...');
    const count = await this.notifyService.sendPendingDigests();
    this.logger.log(`Scheduler: sent ${count} digest notifications`);
  }
}
