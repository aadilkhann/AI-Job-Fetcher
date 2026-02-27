import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyTargetDto } from './dto/company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post('targets')
  addTarget(@Request() req: any, @Body() dto: CreateCompanyTargetDto) {
    return this.companiesService.addTarget(req.user.userId, dto);
  }

  @Get('targets')
  listTargets(@Request() req: any) {
    return this.companiesService.listTargets(req.user.userId);
  }

  @Delete('targets/:id')
  removeTarget(@Request() req: any, @Param('id') id: string) {
    return this.companiesService.removeTarget(req.user.userId, id);
  }
}
