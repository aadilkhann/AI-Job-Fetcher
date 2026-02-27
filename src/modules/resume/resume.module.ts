import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';

import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';
import { ResumeParseWorker } from './resume-parse.worker';
import { Resume } from './entities/resume.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resume]),
    BullModule.registerQueue(
      { name: 'resume.parse' },
      { name: 'resume.embed' },
    ),
    MulterModule.register({ storage: undefined }), // memory storage
  ],
  controllers: [ResumeController],
  providers: [ResumeService, ResumeParseWorker],
  exports: [ResumeService],
})
export class ResumeModule {}
