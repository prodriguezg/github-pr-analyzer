import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ReviewRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @MinLength(20)
  diff!: string;

  @IsOptional()
  @IsString()
  repoContext?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(['balanced', 'strict', 'security'])
  reviewProfile?: 'balanced' | 'strict' | 'security';
}
