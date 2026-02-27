/**
 * Canonical job shape returned by all scrapers after normalization.
 */
export interface CanonicalJob {
  externalJobId: string;
  sourceJobUrl: string;
  title: string;
  locationText?: string | null;
  descriptionText?: string | null;
  applyUrl: string;
  postedDate?: string | null;
  companyName?: string;
  contentHash?: string;
}

/**
 * Base interface for all ATS scraper connectors.
 */
export interface ScraperConnector {
  /** Source name (must match sources table) */
  readonly sourceName: string;

  /** Check if this connector can handle the given URL */
  canHandle(url: string): boolean;

  /** Discover and return all jobs from the target URL */
  discoverJobs(targetUrl: string): Promise<CanonicalJob[]>;
}
