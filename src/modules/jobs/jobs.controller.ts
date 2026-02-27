import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('recent')
  getRecent(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobsService.getRecentJobs(
      days ? parseInt(days, 10) : 7,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
