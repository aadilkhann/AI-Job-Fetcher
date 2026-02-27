import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MatchingService } from './matching.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get()
  getMatches(@Request() req: any, @Query('limit') limit?: string) {
    const l = Math.min(Math.max(limit ? parseInt(limit, 10) || 50 : 50, 1), 200);
    return this.matchingService.getUserMatches(req.user.userId, l);
  }
}
