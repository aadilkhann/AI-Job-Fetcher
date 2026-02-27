import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { JobMatch } from './entities/job-match.entity';
import { Job as JobEntity } from '../jobs/entities/job.entity';
import { Resume } from '../resume/entities/resume.entity';
import { UserSearchProfile } from '../users/entities/user-search-profile.entity';

// ── Score weights ──
const W_KEYWORD = 0.35;
const W_VECTOR = 0.45;
const W_RECENCY = 0.15;
const W_FIT = 0.05;

// ── Thresholds ──
const THRESHOLD_REALTIME = 0.75;
const THRESHOLD_DIGEST = 0.60;

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(JobMatch)
    private readonly matchRepo: Repository<JobMatch>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(Resume)
    private readonly resumeRepo: Repository<Resume>,
    @InjectRepository(UserSearchProfile)
    private readonly profileRepo: Repository<UserSearchProfile>,
    @InjectQueue('notify.prepare')
    private readonly notifyQueue: Queue,
  ) {}

  /**
   * Match a single new job against all users with embeddings.
   */
  async matchNewJob(jobId: string): Promise<number> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || !job.embedding || job.embedding.length === 0) return 0;

    const resumes = await this.resumeRepo
      .createQueryBuilder('r')
      .where('r.embedding IS NOT NULL')
      .getMany();

    let matchCount = 0;
    for (const resume of resumes) {
      const score = await this.computeMatch(resume, job);
      if (score && score.finalScore >= THRESHOLD_DIGEST) {
        matchCount++;
      }
    }

    return matchCount;
  }

  /**
   * Match a user's resume against recent jobs.
   */
  async matchUserResume(userId: string, resumeId: string): Promise<number> {
    const resume = await this.resumeRepo.findOne({ where: { id: resumeId } });
    if (!resume || !resume.embedding || resume.embedding.length === 0) return 0;

    const recentJobs = await this.jobRepo
      .createQueryBuilder('j')
      .where('j.embedding IS NOT NULL')
      .andWhere('j.status = :status', { status: 'active' })
      .andWhere('j.firstSeenAt >= :since', {
        since: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      })
      .getMany();

    let matchCount = 0;
    for (const job of recentJobs) {
      const score = await this.computeMatch(resume, job);
      if (score && score.finalScore >= THRESHOLD_DIGEST) {
        matchCount++;
      }
    }

    return matchCount;
  }

  /**
   * Core scoring: keyword + vector + recency + fit.
   */
  private async computeMatch(
    resume: Resume,
    job: JobEntity,
  ): Promise<JobMatch | null> {
    const modelVersion = resume.embeddingVersion || 'v1';

    // Check if already matched
    const existing = await this.matchRepo.findOne({
      where: {
        userId: resume.userId,
        jobId: job.id,
        modelVersion,
      },
    });
    if (existing) return existing;

    // ── Keyword score ──
    const profile = await this.profileRepo.findOne({
      where: { userId: resume.userId },
    });
    const keywordScore = this.computeKeywordScore(job, profile);

    // ── Vector similarity ──
    const vectorScore = this.cosineSimilarity(
      resume.embedding!,
      job.embedding!,
    );

    // ── Recency score ──
    const recencyScore = this.computeRecencyScore(job);

    // ── Fit score ──
    const fitScore = this.computeFitScore(job, profile);

    // ── Final blended score ──
    const finalScore =
      W_KEYWORD * keywordScore +
      W_VECTOR * vectorScore +
      W_RECENCY * recencyScore +
      W_FIT * fitScore;

    if (finalScore < THRESHOLD_DIGEST) return null;

    const match = this.matchRepo.create({
      userId: resume.userId,
      jobId: job.id,
      keywordScore,
      vectorScore,
      finalScore,
      modelVersion,
      reasonJson: {
        keyword: keywordScore,
        vector: vectorScore,
        recency: recencyScore,
        fit: fitScore,
        weights: { W_KEYWORD, W_VECTOR, W_RECENCY, W_FIT },
      },
    });

    try {
      await this.matchRepo.save(match);
    } catch (err: any) {
      // Unique constraint — already matched
      if (err.code === '23505') return null;
      throw err;
    }

    // Determine notification type
    const notifType =
      finalScore >= THRESHOLD_REALTIME ? 'realtime' : 'digest';
    await this.notifyQueue.add('prepare', {
      userId: resume.userId,
      jobId: job.id,
      matchId: match.id,
      score: finalScore,
      type: notifType,
    });

    this.logger.log(
      `Match: user=${resume.userId} job=${job.id} score=${finalScore.toFixed(3)} type=${notifType}`,
    );

    return match;
  }

  /**
   * Keyword matching based on user profile include/exclude lists.
   */
  private computeKeywordScore(
    job: JobEntity,
    profile?: UserSearchProfile | null,
  ): number {
    if (!profile || profile.keywordsInclude.length === 0) return 0.5; // neutral

    const text = `${job.title} ${job.descriptionText ?? ''}`.toLowerCase();
    let hits = 0;

    for (const kw of profile.keywordsInclude) {
      if (text.includes(kw.toLowerCase())) hits++;
    }

    // Penalize if excluded keywords found
    for (const kw of profile.keywordsExclude) {
      if (text.includes(kw.toLowerCase())) return 0;
    }

    return Math.min(hits / Math.max(profile.keywordsInclude.length, 1), 1);
  }

  /**
   * Cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Recency decay: jobs posted recently get higher scores.
   */
  private computeRecencyScore(job: JobEntity): number {
    const postedMs = job.postedDate
      ? new Date(job.postedDate).getTime()
      : job.firstSeenAt.getTime();
    const ageHours = (Date.now() - postedMs) / (1000 * 3600);
    // Exponential decay: half-life of 7 days (168 hours)
    return Math.exp(-0.693 * (ageHours / 168));
  }

  /**
   * Fit score based on location/remote preferences.
   */
  private computeFitScore(
    job: JobEntity,
    profile?: UserSearchProfile | null,
  ): number {
    if (!profile) return 0.5;

    let score = 0.5;
    const loc = (job.locationText ?? '').toLowerCase();

    // Location match
    if (profile.preferredLocations.length > 0) {
      const locationMatch = profile.preferredLocations.some((l) =>
        loc.includes(l.toLowerCase()),
      );
      score = locationMatch ? 1 : 0.2;
    }

    // Remote preference
    if (profile.remotePref === 'remote') {
      if (loc.includes('remote')) score = Math.max(score, 0.9);
    }

    return score;
  }

  /**
   * Get matches for a user, sorted by score.
   */
  async getUserMatches(
    userId: string,
    limit = 50,
  ): Promise<JobMatch[]> {
    return this.matchRepo.find({
      where: { userId },
      order: { finalScore: 'DESC', matchedAt: 'DESC' },
      take: limit,
      relations: ['job'],
    });
  }
}
