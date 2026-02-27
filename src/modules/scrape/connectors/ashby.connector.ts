import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { request } from 'undici';
import {
  ScraperConnector,
  CanonicalJob,
} from './connector.interface';

/**
 * Ashby ATS Connector
 * Uses public jobs API: https://api.ashbyhq.com/posting-api/job-board/{board}
 */
@Injectable()
export class AshbyConnector implements ScraperConnector {
  readonly sourceName = 'ashby';
  private readonly logger = new Logger(AshbyConnector.name);
  private readonly userAgent: string;

  constructor(private readonly config: ConfigService) {
    this.userAgent = this.config.get('SCRAPE_USER_AGENT', 'AIJobFetcher/1.0');
  }

  canHandle(url: string): boolean {
    return url.includes('ashbyhq.com') || url.includes('jobs.ashby.com');
  }

  async discoverJobs(targetUrl: string): Promise<CanonicalJob[]> {
    const board = this.extractBoard(targetUrl);
    if (!board) {
      this.logger.warn(`Cannot extract board from: ${targetUrl}`);
      return [];
    }

    const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${board}`;

    const res = await request(apiUrl, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent },
    });

    if (res.statusCode !== 200) {
      this.logger.warn(`Ashby API returned ${res.statusCode} for ${board}`);
      return [];
    }

    const body = (await res.body.json()) as any;
    const rawJobs = body.jobs || [];

    const jobs: CanonicalJob[] = rawJobs.map((j: any) => {
      const desc = j.descriptionPlain || j.description || '';
      return {
        externalJobId: j.id,
        sourceJobUrl: j.jobUrl || `https://jobs.ashby.com/${board}/${j.id}`,
        title: j.title,
        locationText: j.location || null,
        descriptionText: typeof desc === 'string' ? desc : '',
        applyUrl: j.applyUrl || j.jobUrl,
        postedDate: j.publishedAt
          ? new Date(j.publishedAt).toISOString().split('T')[0]
          : null,
        companyName: body.organizationName || board,
        contentHash: createHash('sha256')
          .update(j.title + desc)
          .digest('hex')
          .slice(0, 16),
      } satisfies CanonicalJob;
    });

    this.logger.log(`Ashby [${board}]: found ${jobs.length} jobs`);
    return jobs;
  }

  private extractBoard(url: string): string | null {
    const match = url.match(/(?:ashbyhq\.com|ashby\.com)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
}
