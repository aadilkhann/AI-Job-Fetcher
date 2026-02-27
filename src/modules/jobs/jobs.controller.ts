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
    const d = Math.min(Math.max(days ? parseInt(days, 10) || 7 : 7, 1), 90);
    const l = Math.min(Math.max(limit ? parseInt(limit, 10) || 100 : 100, 1), 500);
    return this.jobsService.getRecentJobs(d, l);
  }
}
