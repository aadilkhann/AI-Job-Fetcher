import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { Source } from './entities/source.entity';
import { CreateJobDto } from './dto/job.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(Source) private readonly sourceRepo: Repository<Source>,
  ) {}

  /** Seed default sources if missing */
  async seedSources(): Promise<void> {
    const names = [
      'greenhouse',
      'lever',
      'workday',
      'ashby',
      'smartrecruiters',
      'jobboard',
      'custom',
    ];
    for (const name of names) {
      const exists = await this.sourceRepo.findOne({ where: { name } });
      if (!exists) {
        await this.sourceRepo.save(this.sourceRepo.create({ name }));
      }
    }
  }

  /** Upsert a job with dedupe on (sourceId, externalJobId) */
  async upsertJob(dto: CreateJobDto): Promise<{ job: Job; isNew: boolean }> {
    const existing = await this.jobRepo.findOne({
      where: { sourceId: dto.sourceId, externalJobId: dto.externalJobId },
    });

    const now = new Date();

    if (existing) {
      // Update last-seen + any changed fields
      existing.lastSeenAt = now;
      if (dto.contentHash && dto.contentHash !== existing.contentHash) {
        existing.title = dto.title;
        existing.locationText = dto.locationText ?? existing.locationText;
        existing.descriptionText =
          dto.descriptionText ?? existing.descriptionText;
        existing.applyUrl = dto.applyUrl;
        existing.contentHash = dto.contentHash;
        // Clear embedding so it gets recomputed
        existing.embedding = undefined as any;
        existing.embeddingModel = undefined as any;
        existing.embeddingVersion = undefined as any;
      }
      await this.jobRepo.save(existing);
      return { job: existing, isNew: false };
    }

    const job = this.jobRepo.create({
      sourceId: dto.sourceId,
      externalJobId: dto.externalJobId,
      sourceJobUrl: dto.sourceJobUrl,
      companyId: dto.companyId,
      title: dto.title,
      locationText: dto.locationText,
      descriptionText: dto.descriptionText,
      applyUrl: dto.applyUrl,
      contentHash: dto.contentHash,
      postedDate: dto.postedDate ? new Date(dto.postedDate) : undefined,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'active',
    });
    await this.jobRepo.save(job);
    this.logger.log(`New job: ${job.title} [${job.externalJobId}]`);
    return { job, isNew: true };
  }

  async findJobsWithoutEmbeddings(limit = 100): Promise<Job[]> {
    return this.jobRepo
      .createQueryBuilder('job')
      .where('job.embedding IS NULL')
      .andWhere('job.status = :status', { status: 'active' })
      .orderBy('job.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async updateEmbedding(
    jobId: string,
    embedding: number[],
    model: string,
    version: string,
  ): Promise<void> {
    await this.jobRepo.update(jobId, {
      embedding,
      embeddingModel: model,
      embeddingVersion: version,
    });
  }

  async getRecentJobs(days = 7, limit = 500): Promise<Job[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.jobRepo
      .createQueryBuilder('job')
      .where('job.firstSeenAt >= :since', { since })
      .andWhere('job.status = :status', { status: 'active' })
      .orderBy('job.firstSeenAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getSourceByName(name: string): Promise<Source | null> {
    return this.sourceRepo.findOne({ where: { name } });
  }

  async findById(id: string): Promise<Job | null> {
    return this.jobRepo.findOne({ where: { id } });
  }
}
