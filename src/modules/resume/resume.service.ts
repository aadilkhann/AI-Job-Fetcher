import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Resume } from './entities/resume.entity';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepo: Repository<Resume>,
    @InjectQueue('resume.parse') private readonly parseQueue: Queue,
    private readonly config: ConfigService,
  ) {
    // For personal/local use: store files on disk instead of MinIO
    this.uploadDir = this.config.get('UPLOAD_DIR', './uploads/resumes');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Save uploaded resume file and queue for parsing.
   */
  async upload(
    userId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string },
  ): Promise<Resume> {
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    // Check if identical file already uploaded by this user
    const existing = await this.resumeRepo.findOne({
      where: { userId, sha256 },
    });
    if (existing) {
      this.logger.log(`Resume already uploaded: ${sha256}`);
      return existing;
    }

    // Save file to disk
    const ext = path.extname(file.originalname) || '.pdf';
    const filename = `${userId}_${sha256.slice(0, 12)}${ext}`;
    const filePath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const resume = this.resumeRepo.create({
      userId,
      fileUrl: filePath,
      mimeType: file.mimetype,
      sha256,
      parseStatus: 'pending',
    });
    await this.resumeRepo.save(resume);

    // Enqueue parsing
    await this.parseQueue.add('parse', { resumeId: resume.id });
    this.logger.log(`Resume queued for parsing: ${resume.id}`);

    return resume;
  }

  async findByUser(userId: string): Promise<Resume[]> {
    return this.resumeRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Resume | null> {
    return this.resumeRepo.findOne({ where: { id } });
  }

  async updateParsed(
    id: string,
    parsedText: string,
    status: string,
  ): Promise<void> {
    await this.resumeRepo.update(id, { parsedText, parseStatus: status });
  }

  async updateEmbedding(
    id: string,
    embedding: number[],
    model: string,
    version: string,
  ): Promise<void> {
    await this.resumeRepo.update(id, {
      embedding,
      embeddingModel: model,
      embeddingVersion: version,
    });
  }

  async findWithoutEmbeddings(): Promise<Resume[]> {
    return this.resumeRepo
      .createQueryBuilder('r')
      .where('r.parseStatus = :status', { status: 'parsed' })
      .andWhere('r.embedding IS NULL')
      .getMany();
  }
}
