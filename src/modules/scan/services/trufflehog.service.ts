import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface TruffleHogResult {
  vulnerabilities: Array<{
    finding: {
      DetectorType: string;
      DetectorName: string;
      DecoderName?: string;
      Verified: boolean;
      Raw: string;
      RawV2?: string;
      Redacted?: string;
      ExtraData?: Record<string, any>;
      StructuredData?: Record<string, any>;
    };
    sourceMetadata: {
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
    };
  }>;
  summary: {
    totalFindings: number;
    verifiedFindings: number;
    detectorTypes: string[];
    scanDuration: number;
    scannedFiles: number;
    scannedCommits: number;
  };
}

@Injectable()
export class TruffleHogService {
  private readonly logger = new Logger(TruffleHogService.name);
  private readonly truffleHogImage: string;
  private readonly tempDir: string;

  constructor(private readonly configService: ConfigService) {
    this.truffleHogImage = this.configService.get<string>(
      'TRUFFLE_HOG_IMAGE',
      'trufflesecurity/trufflehog:latest',
    );
    this.tempDir = '/tmp/vuln-scanner';
  }

  /**
   * Scan a Git repository for vulnerabilities using TruffleHog
   */
  async scanRepository(repoUrl: string): Promise<TruffleHogResult> {
    const startTime = Date.now();
    
    this.logger.log(`Starting mock TruffleHog scan for repository: ${repoUrl}`);

    // Mock scan delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Calculate scan duration
    const scanDuration = Math.round((Date.now() - startTime) / 1000);
    
    // Return mock results for demo
    const mockResult: TruffleHogResult = {
      vulnerabilities: [
        {
          finding: {
            DetectorType: 'AWS',
            DetectorName: 'AWS Access Key',
            Verified: false,
            Raw: 'AKIA1234567890123456',
            Redacted: 'AKIA****************',
            ExtraData: {
              account: '123456789012',
              arn: 'arn:aws:iam::123456789012:user/demo'
            }
          },
          sourceMetadata: {
            Data: {
              Git: {
                commit: 'abc123def456',
                file: 'config/aws-credentials.yaml',
                email: 'developer@example.com',
                repository: repoUrl,
                timestamp: new Date().toISOString(),
                line: 15,
                visibility: 'public'
              }
            }
          }
        },
        {
          finding: {
            DetectorType: 'GitHub',
            DetectorName: 'GitHub Token',
            Verified: true,
            Raw: 'ghp_1234567890abcdef1234567890abcdef12345678',
            Redacted: 'ghp_****************************************'
          },
          sourceMetadata: {
            Data: {
              Git: {
                commit: 'def456abc789',
                file: '.env',
                email: 'developer@example.com',
                repository: repoUrl,
                timestamp: new Date().toISOString(),
                line: 3
              }
            }
          }
        }
      ],
      summary: {
        totalFindings: 2,
        verifiedFindings: 1,
        detectorTypes: ['AWS', 'GitHub'],
        scanDuration,
        scannedFiles: 127,
        scannedCommits: 50
      }
    };

    this.logger.log(
      `Mock TruffleHog scan completed. Found ${mockResult.summary.totalFindings} vulnerabilities (${mockResult.summary.verifiedFindings} verified) in ${scanDuration}s`,
    );

    return mockResult;
  }

  /**
   * Build the TruffleHog command
   */
  private buildTruffleHogCommand(repoUrl: string, outputFile: string): string {
    // Use Docker to run TruffleHog in a container
    const dockerCommand = [
      'docker', 'run', '--rm',
      '-v', `${this.tempDir}:/tmp/output`,
      this.truffleHogImage,
      'git',
      repoUrl,
      '--json',
      '--no-update',
      '--fail',
      `> /tmp/output/${path.basename(outputFile)}`,
    ].join(' ');

    return dockerCommand;
  }

  /**
   * Parse TruffleHog JSON output
   */
  private async parseScanResults(outputFile: string): Promise<TruffleHogResult> {
    try {
      const fileContent = await fs.readFile(outputFile, 'utf-8');
      
      if (!fileContent.trim()) {
        // No vulnerabilities found
        return {
          vulnerabilities: [],
          summary: {
            totalFindings: 0,
            verifiedFindings: 0,
            detectorTypes: [],
            scanDuration: 0,
            scannedFiles: 0,
            scannedCommits: 0,
          },
        };
      }

      // Parse line-delimited JSON
      const lines = fileContent.trim().split('\\n');
      const vulnerabilities = [];
      const detectorTypesSet = new Set<string>();
      const filesSet = new Set<string>();
      const commitsSet = new Set<string>();

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const finding = JSON.parse(line);
          
          if (finding.Raw && finding.DetectorName) {
            vulnerabilities.push({
              finding: {
                DetectorType: finding.DetectorType || finding.DetectorName,
                DetectorName: finding.DetectorName,
                DecoderName: finding.DecoderName,
                Verified: finding.Verified || false,
                Raw: finding.Raw,
                RawV2: finding.RawV2,
                Redacted: finding.Redacted,
                ExtraData: finding.ExtraData,
                StructuredData: finding.StructuredData,
              },
              sourceMetadata: {
                Data: {
                  Git: {
                    commit: finding.SourceMetadata?.Data?.Git?.commit || '',
                    file: finding.SourceMetadata?.Data?.Git?.file || '',
                    email: finding.SourceMetadata?.Data?.Git?.email || '',
                    repository: finding.SourceMetadata?.Data?.Git?.repository || '',
                    timestamp: finding.SourceMetadata?.Data?.Git?.timestamp || '',
                    line: finding.SourceMetadata?.Data?.Git?.line || 0,
                    visibility: finding.SourceMetadata?.Data?.Git?.visibility,
                  },
                },
              },
            });

            detectorTypesSet.add(finding.DetectorType || finding.DetectorName);
            
            if (finding.SourceMetadata?.Data?.Git?.file) {
              filesSet.add(finding.SourceMetadata.Data.Git.file);
            }
            
            if (finding.SourceMetadata?.Data?.Git?.commit) {
              commitsSet.add(finding.SourceMetadata.Data.Git.commit);
            }
          }
        } catch (parseError) {
          this.logger.warn(`Failed to parse TruffleHog line: ${line}`, parseError.message);
        }
      }

      const verifiedCount = vulnerabilities.filter(
        (vuln) => vuln.finding.Verified,
      ).length;

      return {
        vulnerabilities,
        summary: {
          totalFindings: vulnerabilities.length,
          verifiedFindings: verifiedCount,
          detectorTypes: Array.from(detectorTypesSet),
          scanDuration: 0, // Will be updated by caller
          scannedFiles: filesSet.size,
          scannedCommits: commitsSet.size,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to parse scan results: ${error.message}`);
      throw new Error(`Failed to parse scan results: ${error.message}`);
    }
  }

  /**
   * Ensure the temporary directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create temp directory: ${error.message}`);
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore errors during cleanup
      this.logger.warn(`Failed to cleanup temp file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Validate repository URL format
   */
  validateRepositoryUrl(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get supported detector types
   */
  getSupportedDetectors(): string[] {
    return [
      'AWS', 'Azure', 'GCP', 'GitHub', 'GitLab', 'Slack', 'Stripe',
      'Docker', 'NPM', 'PyPI', 'Mailgun', 'SendGrid', 'Twilio',
      'Generic', 'PrivateKey', 'JWT', 'Database', 'URI',
    ];
  }

  /**
   * Get scanner version information
   */
  async getScannerInfo(): Promise<Record<string, any>> {
    try {
      const command = `docker run --rm ${this.truffleHogImage} --version`;
      const { stdout } = await execAsync(command, { timeout: 10000 });
      
      return {
        image: this.truffleHogImage,
        version: stdout.trim(),
        supportedDetectors: this.getSupportedDetectors(),
      };
    } catch (error) {
      this.logger.warn('Failed to get scanner info:', error.message);
      return {
        image: this.truffleHogImage,
        version: 'unknown',
        supportedDetectors: this.getSupportedDetectors(),
      };
    }
  }
}
