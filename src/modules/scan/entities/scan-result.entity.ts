import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface VulnerabilityFinding {
  DetectorType: string;
  DetectorName: string;
  DecoderName?: string;
  Verified: boolean;
  Raw: string;
  RawV2?: string;
  Redacted?: string;
  ExtraData?: Record<string, any>;
  StructuredData?: Record<string, any>;
}

export interface SourceMetadata {
  Data: {
    Git: {
      commit: string;
      file: string;
      email: string;
      repository: string;
      timestamp: string;
      line: number;
      visibility?: string;
    };
  };
}

export enum ScanStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum GitProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
  AZURE_DEVOPS = 'azure_devops',
  GENERIC = 'generic',
}

@Entity('scan_results')
@Index(['repoUrl', 'provider'])
@Index(['createdAt'])
@Index(['status'])
export class ScanResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', name: 'repo_url' })
  @Index()
  repoUrl: string;

  @Column({
    type: 'enum',
    enum: GitProvider,
    default: GitProvider.GITHUB,
  })
  provider: GitProvider;

  @Column({
    type: 'enum',
    enum: ScanStatus,
    default: ScanStatus.PENDING,
  })
  status: ScanStatus;

  @Column({ type: 'jsonb', nullable: true })
  result: {
    vulnerabilities: Array<{
      finding: VulnerabilityFinding;
      sourceMetadata: SourceMetadata;
    }>;
    summary: {
      totalFindings: number;
      verifiedFindings: number;
      detectorTypes: string[];
      scanDuration: number;
      scannedFiles: number;
      scannedCommits: number;
    };
  };

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  scanDuration: number; // in seconds

  @Column({ type: 'int', default: 0 })
  vulnerabilityCount: number;

  @Column({ type: 'int', default: 0 })
  verifiedVulnerabilityCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    scannerVersion?: string;
    configUsed?: Record<string, any>;
    environmentInfo?: Record<string, any>;
    additionalInfo?: Record<string, any>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  updateSummary(): void {
    if (this.result?.vulnerabilities) {
      this.vulnerabilityCount = this.result.vulnerabilities.length;
      this.verifiedVulnerabilityCount = this.result.vulnerabilities.filter(
        (vuln) => vuln.finding.Verified,
      ).length;
    }
  }

  isCompleted(): boolean {
    return this.status === ScanStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === ScanStatus.FAILED;
  }

  isRunning(): boolean {
    return this.status === ScanStatus.RUNNING || this.status === ScanStatus.PENDING;
  }
}
