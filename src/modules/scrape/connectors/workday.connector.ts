import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ScraperConnector, CanonicalJob } from './connector.interface';

/**
 * Workday Connector
 * Workday career sites typically expose a search API at:
 * https://{company}.wd{N}.myworkdayjobs.com/wday/cxs/{company}/{site}/jobs
 */
@Injectable()
export class WorkdayConnector implements ScraperConnector {
  readonly sourceName = 'workday';
  private readonly logger = new Logger(WorkdayConnector.name);
  private readonly userAgent: string;

  constructor(private readonly config: ConfigService) {
    this.userAgent = this.config.get('SCRAPE_USER_AGENT', 'AIJobFetcher/1.0');
  }

  canHandle(url: string): boolean {
    return url.includes('myworkdayjobs.com');
  }

  async discoverJobs(targetUrl: string): Promise<CanonicalJob[]> {
    const parsed = this.parseWorkdayUrl(targetUrl);
    if (!parsed) {
      this.logger.warn(`Cannot parse Workday URL: ${targetUrl}`);
      return [];
    }

    const { baseUrl, company, site } = parsed;
    const searchUrl = `${baseUrl}/wday/cxs/${company}/${site}/jobs`;
    const allJobs: CanonicalJob[] = [];
    let offset = 0;
    const limit = 20;

    const { default: undici } = await import('undici');

    while (true) {
      const res = await undici.request(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit,
          offset,
          searchText: '',
        }),
      });

      if (res.statusCode !== 200) {
        this.logger.warn(`Workday API returned ${res.statusCode}`);
        break;
      }

      const body = (await res.body.json()) as any;
      const postings = body.jobPostings || [];

      for (const j of postings) {
        const jobUrl = `${baseUrl}${j.externalPath}`;
        allJobs.push({
          externalJobId: j.bulletFields?.[0] || j.externalPath,
          sourceJobUrl: jobUrl,
          title: j.title,
          locationText: j.locationsText || null,
          descriptionText: '', // Detail requires separate fetch
          applyUrl: jobUrl,
          postedDate: j.postedOn
            ? new Date(j.postedOn).toISOString().split('T')[0]
            : null,
          companyName: company,
          contentHash: createHash('sha256')
            .update(j.title + (j.locationsText || ''))
            .digest('hex')
            .slice(0, 16),
        });
      }

      if (postings.length < limit || allJobs.length >= body.total) break;
      offset += limit;
    }

    this.logger.log(`Workday [${company}/${site}]: found ${allJobs.length} jobs`);
    return allJobs;
  }

  private parseWorkdayUrl(
    url: string,
  ): { baseUrl: string; company: string; site: string } | null {
    // Pattern: https://company.wd5.myworkdayjobs.com/en-US/External_Career_Site
    const match = url.match(
      /(https?:\/\/[^/]+\.myworkdayjobs\.com)(?:\/[a-z-]+)?\/([a-zA-Z0-9_-]+)/,
    );
    if (!match) return null;
    const baseUrl = match[1];
    const site = match[2];
    const companyMatch = baseUrl.match(/\/\/([^.]+)\./);
    const company = companyMatch ? companyMatch[1] : site;
    return { baseUrl, company, site };
  }
}
