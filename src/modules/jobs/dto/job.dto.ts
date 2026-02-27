import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';

export class CreateJobDto {
  @IsNumber()
  sourceId: number;

  @IsString()
  externalJobId: string;

  @IsString()
  sourceJobUrl: string;

  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsString()
  @IsOptional()
  descriptionText?: string;

  @IsString()
  applyUrl: string;

  @IsDateString()
  @IsOptional()
  postedDate?: string;

  @IsString()
  @IsOptional()
  contentHash?: string;
}
