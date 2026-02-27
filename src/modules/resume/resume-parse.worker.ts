import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs/promises';

import { ResumeService } from './resume.service';

@Processor('resume.parse')
export class ResumeParseWorker extends WorkerHost {
  private readonly logger = new Logger(ResumeParseWorker.name);

  constructor(
    private readonly resumeService: ResumeService,
    @InjectQueue('resume.embed') private readonly embedQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ resumeId: string }>) {
    const resume = await this.resumeService.findById(job.data.resumeId);
    if (!resume) {
      this.logger.warn(`Resume not found: ${job.data.resumeId}`);
      return;
    }

    try {
      const buffer = await fs.readFile(resume.fileUrl);
      let text: string;

      if (
        resume.mimeType === 'application/pdf' ||
        resume.fileUrl.endsWith('.pdf')
      ) {
        text = await this.parsePdf(buffer);
      } else if (
        resume.mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        resume.fileUrl.endsWith('.docx')
      ) {
        text = await this.parseDocx(buffer);
      } else {
        // Fallback: treat as plain text
        text = buffer.toString('utf8');
      }

      // Normalize whitespace
      text = text.replace(/\s+/g, ' ').trim();

      await this.resumeService.updateParsed(resume.id, text, 'parsed');

      // Enqueue embedding generation
      await this.embedQueue.add('embed-resume', { resumeId: resume.id });

      this.logger.log(
        `Resume parsed: ${resume.id} (${text.length} chars)`,
      );
    } catch (err: any) {
      this.logger.error(`Parse failed for ${resume.id}: ${err.message}`);
      await this.resumeService.updateParsed(resume.id, '', 'failed');
    }
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const result = await (pdfParse as any)(buffer);
    return result.text;
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}
