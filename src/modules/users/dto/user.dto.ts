import { IsOptional, IsString, IsArray, IsIn } from 'class-validator';

export class UpdateSearchProfileDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywordsInclude?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywordsExclude?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredLocations?: string[];

  @IsString()
  @IsOptional()
  seniority?: string;

  @IsString()
  @IsIn(['remote', 'hybrid', 'onsite'])
  @IsOptional()
  remotePref?: string;
}

export class UpdateNotificationPrefsDto {
  @IsString()
  @IsIn(['realtime', 'digest', 'off'])
  @IsOptional()
  mode?: string;

  @IsString()
  @IsOptional()
  timezone?: string;
}
