import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, Matches } from 'class-validator';
import { GitProvider } from '../entities/scan-result.entity';

export class ScanRequestDto {
  @ApiProperty({
    description: 'Git repository URL to scan for vulnerabilities',
    example: 'https://github.com/octocat/Hello-World',
    pattern: '^https?://.*',
  })
  @IsNotEmpty({ message: 'Repository URL is required' })
  @IsUrl({ protocols: ['http', 'https'] }, { message: 'Must be a valid HTTP/HTTPS URL' })
  @IsString()
  repoUrl: string;

  @ApiProperty({
    description: 'Git provider type',
    enum: GitProvider,
    example: GitProvider.GITHUB,
    default: GitProvider.GITHUB,
  })
  @IsEnum(GitProvider, { message: 'Provider must be one of: github, gitlab, bitbucket, azure_devops, generic' })
  @IsOptional()
  provider?: GitProvider = GitProvider.GITHUB;

  @ApiProperty({
    description: 'Force rescan even if cached result exists',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  forceRescan?: boolean = false;

  @ApiProperty({
    description: 'Include only verified vulnerabilities in results',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  verifiedOnly?: boolean = false;
}

export class ScanResponseDto {
  @ApiProperty({
    description: 'Unique scan identifier',
    example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
  })
  scanId: string;

  @ApiProperty({
    description: 'Repository URL that was scanned',
    example: 'https://github.com/octocat/Hello-World',
  })
  repoUrl: string;

  @ApiProperty({
    description: 'Git provider',
    enum: GitProvider,
    example: GitProvider.GITHUB,
  })
  provider: GitProvider;

  @ApiProperty({
    description: 'Scan status',
    example: 'completed',
  })
  status: string;

  @ApiProperty({
    description: 'Scan results',
    type: 'object',
    example: {
      vulnerabilities: [
        {
          finding: {
            DetectorType: 'AWS',
            DetectorName: 'AWS',
            Verified: true,
            Raw: 'AKIA1234567890123456',
            Redacted: 'AKIA****************',
          },
          sourceMetadata: {
            Data: {
              Git: {
                commit: 'abcd1234',
                file: 'config/credentials.yaml',
                line: 15,
                repository: 'https://github.com/octocat/Hello-World',
                timestamp: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      ],
      summary: {
        totalFindings: 1,
        verifiedFindings: 1,
        detectorTypes: ['AWS'],
        scanDuration: 45,
        scannedFiles: 127,
        scannedCommits: 50,
      },
    },
  })
  result?: any;

  @ApiProperty({
    description: 'Scan duration in seconds',
    example: 45,
  })
  scanDuration: number;

  @ApiProperty({
    description: 'Total number of vulnerabilities found',
    example: 3,
  })
  vulnerabilityCount: number;

  @ApiProperty({
    description: 'Number of verified vulnerabilities',
    example: 1,
  })
  verifiedVulnerabilityCount: number;

  @ApiProperty({
    description: 'Scan creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Whether result was served from cache',
    example: false,
  })
  fromCache?: boolean;

  @ApiProperty({
    description: 'Error message if scan failed',
    example: 'Repository not found or access denied',
    required: false,
  })
  errorMessage?: string;
}
