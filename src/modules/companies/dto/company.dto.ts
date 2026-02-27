import { IsString, IsUrl, IsOptional, IsIn } from 'class-validator';

export class CreateCompanyTargetDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsUrl()
  careerUrl: string;

  @IsString()
  @IsIn([
    'greenhouse',
    'lever',
    'workday',
    'ashby',
    'smartrecruiters',
    'generic',
  ])
  @IsOptional()
  sourceHint?: string;
}
