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
 * Greenhouse ATS Connector
 * Uses public board JSON API: https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
 */
@Injectable()
export class GreenhouseConnector implements ScraperConnector {
  readonly sourceName = 'greenhouse';
  private readonly logger = new Logger(GreenhouseConnector.name);
  private readonly userAgent: string;

  constructor(private readonly config: ConfigService) {
    this.userAgent = this.config.get(
      'SCRAPE_USER_AGENT',
      'AIJobFetcher/1.0',
    );
  }

  canHandle(url: string): boolean {
    return (
      url.includes('boards.greenhouse.io') ||
      url.includes('boards-api.greenhouse.io')
    );
  }

  async discoverJobs(targetUrl: string): Promise<CanonicalJob[]> {
    const boardToken = this.extractBoardToken(targetUrl);
    if (!boardToken) {
      this.logger.warn(`Cannot extract board token from: ${targetUrl}`);
      return [];
    }

    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;

    const res = await request(apiUrl, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent },
    });

    if (res.statusCode !== 200) {
      this.logger.warn(`Greenhouse API returned ${res.statusCode} for ${boardToken}`);
      return [];
    }

    const body = await res.body.json() as any;
    const jobs: CanonicalJob[] = (body.jobs || []).map((j: any) => {
      const desc = j.content || '';
      return {
        externalJobId: String(j.id),
        sourceJobUrl: j.absolute_url || `https://boards.greenhouse.io/${boardToken}/jobs/${j.id}`,
        title: j.title,
        locationText: j.location?.name || null,
        descriptionText: stripHtml(desc),
        applyUrl: j.absolute_url || `https://boards.greenhouse.io/${boardToken}/jobs/${j.id}`,
        postedDate: j.updated_at ? j.updated_at.split('T')[0] : null,
        companyName: body.name || boardToken,
        contentHash: createHash('sha256')
          .update(j.title + desc)
          .digest('hex')
          .slice(0, 16),
      } satisfies CanonicalJob;
    });

    this.logger.log(`Greenhouse [${boardToken}]: found ${jobs.length} jobs`);
    return jobs;
  }

  private extractBoardToken(url: string): string | null {
    // https://boards.greenhouse.io/company or https://boards-api.greenhouse.io/v1/boards/company/jobs
    const match = url.match(
      /greenhouse\.io\/(?:v1\/boards\/)?([a-zA-Z0-9_-]+)/,
    );
    return match ? match[1] : null;
  }
}
