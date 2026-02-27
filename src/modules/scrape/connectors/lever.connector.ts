import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { request } from 'undici';
import { stripHtml } from '../../../common/utils/html';
import {
  ScraperConnector,
  CanonicalJob,
} from './connector.interface';

/**
 * Lever ATS Connector
 * Uses public postings API: https://api.lever.co/v0/postings/{company}
 */
@Injectable()
export class LeverConnector implements ScraperConnector {
  readonly sourceName = 'lever';
  private readonly logger = new Logger(LeverConnector.name);
  private readonly userAgent: string;

  constructor(private readonly config: ConfigService) {
    this.userAgent = this.config.get('SCRAPE_USER_AGENT', 'AIJobFetcher/1.0');
  }

  canHandle(url: string): boolean {
    return url.includes('jobs.lever.co') || url.includes('api.lever.co');
  }

  async discoverJobs(targetUrl: string): Promise<CanonicalJob[]> {
    const company = this.extractCompany(targetUrl);
    if (!company) {
      this.logger.warn(`Cannot extract company from: ${targetUrl}`);
      return [];
    }

    const apiUrl = `https://api.lever.co/v0/postings/${company}?mode=json`;

    const res = await request(apiUrl, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent },
    });

    if (res.statusCode !== 200) {
      this.logger.warn(`Lever API returned ${res.statusCode} for ${company}`);
      return [];
    }

    const body = (await res.body.json()) as any[];
    const jobs: CanonicalJob[] = body.map((j: any) => {
      const desc = j.descriptionPlain || j.description || '';
      return {
        externalJobId: j.id,
        sourceJobUrl: j.hostedUrl || `https://jobs.lever.co/${company}/${j.id}`,
        title: j.text,
        locationText: j.categories?.location || null,
        descriptionText: typeof desc === 'string' ? desc : stripHtml(desc),
        applyUrl: j.applyUrl || j.hostedUrl,
        postedDate: j.createdAt
          ? new Date(j.createdAt).toISOString().split('T')[0]
          : null,
        companyName: company,
        contentHash: createHash('sha256')
          .update(j.text + desc)
          .digest('hex')
          .slice(0, 16),
      } satisfies CanonicalJob;
    });

    this.logger.log(`Lever [${company}]: found ${jobs.length} jobs`);
    return jobs;
  }

  private extractCompany(url: string): string | null {
    const match = url.match(/lever\.co\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
}
