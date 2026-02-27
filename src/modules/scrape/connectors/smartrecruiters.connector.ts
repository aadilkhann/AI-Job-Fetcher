import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ScraperConnector, CanonicalJob } from './connector.interface';

/**
 * SmartRecruiters Connector
 * Uses public API: https://api.smartrecruiters.com/v1/companies/{companyId}/postings
 */
@Injectable()
export class SmartRecruitersConnector implements ScraperConnector {
  readonly sourceName = 'smartrecruiters';
  private readonly logger = new Logger(SmartRecruitersConnector.name);
  private readonly userAgent: string;

  constructor(private readonly config: ConfigService) {
    this.userAgent = this.config.get('SCRAPE_USER_AGENT', 'AIJobFetcher/1.0');
  }

  canHandle(url: string): boolean {
    return url.includes('smartrecruiters.com');
  }

  async discoverJobs(targetUrl: string): Promise<CanonicalJob[]> {
    const companyId = this.extractCompanyId(targetUrl);
    if (!companyId) {
      this.logger.warn(`Cannot extract company from: ${targetUrl}`);
      return [];
    }

    const allJobs: CanonicalJob[] = [];
    let offset = 0;
    const limit = 100;

    const { default: undici } = await import('undici');

    while (true) {
      const apiUrl = `https://api.smartrecruiters.com/v1/companies/${companyId}/postings?limit=${limit}&offset=${offset}`;
      const res = await undici.request(apiUrl, {
        method: 'GET',
        headers: { 'User-Agent': this.userAgent },
      });

      if (res.statusCode !== 200) {
        this.logger.warn(`SmartRecruiters API returned ${res.statusCode}`);
        break;
      }

      const body = (await res.body.json()) as any;
      const postings = body.content || [];

      for (const j of postings) {
        const desc = j.jobAd?.sections?.jobDescription?.text || '';
        allJobs.push({
          externalJobId: j.id || j.uuid,
          sourceJobUrl: j.ref || `https://jobs.smartrecruiters.com/${companyId}/${j.id}`,
          title: j.name,
          locationText: j.location?.city
            ? `${j.location.city}, ${j.location.country}`
            : null,
          descriptionText: this.stripHtml(desc),
          applyUrl: j.applyUrl || j.ref,
          postedDate: j.releasedDate
            ? new Date(j.releasedDate).toISOString().split('T')[0]
            : null,
          companyName: j.company?.name || companyId,
          contentHash: createHash('sha256')
            .update(j.name + desc)
            .digest('hex')
            .slice(0, 16),
        });
      }

      if (postings.length < limit) break;
      offset += limit;
    }

    this.logger.log(`SmartRecruiters [${companyId}]: found ${allJobs.length} jobs`);
    return allJobs;
  }

  private extractCompanyId(url: string): string | null {
    const match = url.match(/smartrecruiters\.com\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
