import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { UserCompanyTarget } from './entities/user-company-target.entity';
import { CreateCompanyTargetDto } from './dto/company.dto';
import { validateUrlSafety } from '../../common/utils/ssrf-guard';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(UserCompanyTarget)
    private readonly targetRepo: Repository<UserCompanyTarget>,
  ) {}

  async addTarget(
    userId: string,
    dto: CreateCompanyTargetDto,
  ): Promise<UserCompanyTarget> {
    // SSRF validation
    try {
      await validateUrlSafety(dto.careerUrl);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    let company: Company | null = null;
    if (dto.companyName) {
      const domain = new URL(dto.careerUrl).hostname;
      company = await this.companyRepo.findOne({
        where: { canonicalDomain: domain },
      });
      if (!company) {
        company = this.companyRepo.create({
          name: dto.companyName,
          canonicalDomain: domain,
        });
        await this.companyRepo.save(company);
      }
    }

    const target = this.targetRepo.create({
      userId,
      companyId: company?.id,
      careerUrl: dto.careerUrl,
      sourceHint: dto.sourceHint,
    });
    return this.targetRepo.save(target);
  }

  async listTargets(userId: string): Promise<UserCompanyTarget[]> {
    return this.targetRepo.find({
      where: { userId, active: true },
      relations: ['company'],
    });
  }

  async removeTarget(userId: string, targetId: string): Promise<void> {
    const target = await this.targetRepo.findOne({
      where: { id: targetId, userId },
    });
    if (!target) throw new NotFoundException('Target not found');
    target.active = false;
    await this.targetRepo.save(target);
  }

  async getAllActiveTargets(): Promise<UserCompanyTarget[]> {
    return this.targetRepo.find({
      where: { active: true },
      relations: ['company'],
    });
  }
}
