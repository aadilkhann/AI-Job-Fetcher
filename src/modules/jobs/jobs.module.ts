import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { Source } from './entities/source.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Job, Source])],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule implements OnModuleInit {
  constructor(private readonly jobsService: JobsService) {}

  async onModuleInit() {
    await this.jobsService.seedSources();
  }
}
