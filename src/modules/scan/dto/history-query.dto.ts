import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { GitProvider, ScanStatus } from '../entities/scan-result.entity';

export class HistoryQueryDto {
  @ApiProperty({
    description: 'Repository URL to filter by',
    example: 'https://github.com/octocat/Hello-World',
    required: false,
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'] }, { message: 'Must be a valid HTTP/HTTPS URL' })
  @IsString()
  repoUrl?: string;

  @ApiProperty({
    description: 'Git provider to filter by',
    enum: GitProvider,
    example: GitProvider.GITHUB,
    required: false,
  })
  @IsOptional()
  @IsEnum(GitProvider)
  provider?: GitProvider;

  @ApiProperty({
    description: 'Scan status to filter by',
    enum: ScanStatus,
    example: ScanStatus.COMPLETED,
    required: false,
  })
  @IsOptional()
  @IsEnum(ScanStatus)
  status?: ScanStatus;

  @ApiProperty({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Number of results per page',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;

  @ApiProperty({
    description: 'Sort field',
    example: 'createdAt',
    default: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'scanDuration', 'vulnerabilityCount'],
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Sort order',
    example: 'DESC',
    default: 'DESC',
    enum: ['ASC', 'DESC'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 50,
  })
  totalItems: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrevious: boolean;
}

export class HistoryResponseDto {
  @ApiProperty({
    description: 'Array of scan results',
    type: [Object],
    example: [
      {
        scanId: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
        repoUrl: 'https://github.com/octocat/Hello-World',
        provider: 'github',
        status: 'completed',
        vulnerabilityCount: 3,
        verifiedVulnerabilityCount: 1,
        scanDuration: 45,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ],
  })
  data: any[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}
