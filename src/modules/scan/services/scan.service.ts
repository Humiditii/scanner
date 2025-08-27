import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Like } from 'typeorm';
import { ScanResult, ScanStatus, GitProvider } from '../entities/scan-result.entity';
import { CacheService } from '../../cache/cache.service';
import { TruffleHogService, TruffleHogResult } from './trufflehog.service';
import { ScanRequestDto, ScanResponseDto } from '../dto/scan-request.dto';
import { HistoryQueryDto, HistoryResponseDto, PaginationMetaDto } from '../dto/history-query.dto';

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    @InjectRepository(ScanResult)
    private readonly scanResultRepository: Repository<ScanResult>,
    private readonly cacheService: CacheService,
    private readonly truffleHogService: TruffleHogService,
  ) {}

  /**
   * Scan a repository for vulnerabilities
   */
  async scanRepository(scanRequest: ScanRequestDto): Promise<ScanResponseDto> {
    const { repoUrl, provider = GitProvider.GITHUB, forceRescan = false, verifiedOnly = false } = scanRequest;

    this.logger.log(`Scan requested for ${repoUrl} (${provider}), forceRescan: ${forceRescan}`);

    // Validate repository URL
    if (!this.truffleHogService.validateRepositoryUrl(repoUrl)) {
      throw new BadRequestException('Invalid repository URL format');
    }

    // Check cache first (if not forcing rescan)
    if (!forceRescan) {
      const cachedResult = await this.cacheService.getScanResult(repoUrl, provider);
      if (cachedResult) {
        this.logger.log(`Returning cached result for ${repoUrl}`);
        return {
          ...cachedResult,
          fromCache: true,
        };
      }
    }

    // Check if there's an existing scan in progress
    const existingScan = await this.findExistingScan(repoUrl, provider);
    if (existingScan && existingScan.isRunning()) {
      this.logger.log(`Scan already in progress for ${repoUrl}`);
      return this.formatScanResponse(existingScan, false);
    }

    // Create new scan record
    const scanResult = this.scanResultRepository.create({
      repoUrl,
      provider,
      status: ScanStatus.PENDING,
    });

    await this.scanResultRepository.save(scanResult);
    this.logger.log(`Created new scan record: ${scanResult.id}`);

    // Start the scan asynchronously
    this.performScan(scanResult, verifiedOnly).catch((error) => {
      this.logger.error(`Async scan failed for ${scanResult.id}:`, error);
    });

    return this.formatScanResponse(scanResult, false);
  }

  /**
   * Get scan history with filtering and pagination
   */
  async getScanHistory(query: HistoryQueryDto): Promise<HistoryResponseDto> {
    const { repoUrl, provider, status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = query;

    // Build query conditions
    const where: any = {};
    if (repoUrl) {
      where.repoUrl = Like(`%${repoUrl}%`);
    }
    if (provider) {
      where.provider = provider;
    }
    if (status) {
      where.status = status;
    }

    // Build query options
    const options: FindManyOptions<ScanResult> = {
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    };

    // Execute query
    const [results, totalItems] = await this.scanResultRepository.findAndCount(options);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);
    const meta: PaginationMetaDto = {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };

    // Format results
    const data = results.map((scan) => this.formatScanResponse(scan, false));

    return { data, meta };
  }

  /**
   * Get scan result by ID
   */
  async getScanById(id: string): Promise<ScanResponseDto> {
    const scanResult = await this.scanResultRepository.findOne({ where: { id } });
    
    if (!scanResult) {
      throw new NotFoundException(`Scan result not found: ${id}`);
    }

    return this.formatScanResponse(scanResult, false);
  }

  /**
   * Delete scan result and invalidate cache
   */
  async deleteScan(id: string): Promise<void> {
    const scanResult = await this.scanResultRepository.findOne({ where: { id } });
    
    if (!scanResult) {
      throw new NotFoundException(`Scan result not found: ${id}`);
    }

    // Remove from cache
    await this.cacheService.deleteScanResult(scanResult.repoUrl, scanResult.provider);
    
    // Remove from database
    await this.scanResultRepository.remove(scanResult);
    
    this.logger.log(`Deleted scan result: ${id}`);
  }

  /**
   * Perform the actual vulnerability scan
   */
  private async performScan(scanResult: ScanResult, verifiedOnly: boolean): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to running
      scanResult.status = ScanStatus.RUNNING;
      await this.scanResultRepository.save(scanResult);

      this.logger.log(`Starting TruffleHog scan for ${scanResult.repoUrl}`);

      // Run TruffleHog scan
      const truffleHogResult: TruffleHogResult = await this.truffleHogService.scanRepository(scanResult.repoUrl);

      // Filter results if only verified vulnerabilities are requested
      let filteredResult = truffleHogResult;
      if (verifiedOnly) {
        filteredResult = {
          ...truffleHogResult,
          vulnerabilities: truffleHogResult.vulnerabilities.filter((vuln) => vuln.finding.Verified),
        };
        filteredResult.summary.totalFindings = filteredResult.vulnerabilities.length;
        filteredResult.summary.verifiedFindings = filteredResult.vulnerabilities.length;
      }

      // Calculate scan duration
      const scanDuration = Math.round((Date.now() - startTime) / 1000);

      // Update scan result
      scanResult.status = ScanStatus.COMPLETED;
      scanResult.result = filteredResult;
      scanResult.scanDuration = scanDuration;
      scanResult.updateSummary();
      scanResult.metadata = {
        scannerVersion: 'trufflehog-latest',
        configUsed: { verifiedOnly },
        environmentInfo: await this.truffleHogService.getScannerInfo(),
      };

      await this.scanResultRepository.save(scanResult);

      // Cache the result
      const responseData = this.formatScanResponse(scanResult, false);
      await this.cacheService.setScanResult(
        scanResult.repoUrl,
        scanResult.provider,
        responseData,
      );

      this.logger.log(
        `Scan completed for ${scanResult.repoUrl}: ${scanResult.vulnerabilityCount} vulnerabilities found`,
      );
    } catch (error) {
      this.logger.error(`Scan failed for ${scanResult.repoUrl}:`, error);

      // Update scan result with error
      scanResult.status = ScanStatus.FAILED;
      scanResult.errorMessage = error.message;
      scanResult.scanDuration = Math.round((Date.now() - startTime) / 1000);

      await this.scanResultRepository.save(scanResult);
    }
  }

  /**
   * Find existing scan for the repository
   */
  private async findExistingScan(repoUrl: string, provider: GitProvider): Promise<ScanResult | null> {
    return this.scanResultRepository.findOne({
      where: {
        repoUrl,
        provider,
        status: ScanStatus.RUNNING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Format scan result for API response
   */
  private formatScanResponse(scanResult: ScanResult, fromCache: boolean): ScanResponseDto {
    return {
      scanId: scanResult.id,
      repoUrl: scanResult.repoUrl,
      provider: scanResult.provider,
      status: scanResult.status,
      result: scanResult.result,
      scanDuration: scanResult.scanDuration,
      vulnerabilityCount: scanResult.vulnerabilityCount,
      verifiedVulnerabilityCount: scanResult.verifiedVulnerabilityCount,
      createdAt: scanResult.createdAt,
      fromCache,
      ...(scanResult.errorMessage && { errorMessage: scanResult.errorMessage }),
    };
  }

  /**
   * Get scan statistics
   */
  async getScanStatistics(): Promise<any> {
    const totalScans = await this.scanResultRepository.count();
    const completedScans = await this.scanResultRepository.count({ where: { status: ScanStatus.COMPLETED } });
    const failedScans = await this.scanResultRepository.count({ where: { status: ScanStatus.FAILED } });
    const runningScans = await this.scanResultRepository.count({ where: { status: ScanStatus.RUNNING } });

    // Get total vulnerabilities found
    const { sum } = await this.scanResultRepository
      .createQueryBuilder('scan')
      .select('SUM(scan.vulnerabilityCount)', 'sum')
      .where('scan.status = :status', { status: ScanStatus.COMPLETED })
      .getRawOne();

    const totalVulnerabilities = parseInt(sum || '0');

    // Get most common detector types
    const detectorStats = await this.scanResultRepository
      .createQueryBuilder('scan')
      .select('result->\'summary\'->>\'detectorTypes\' as detectorTypes')
      .where('scan.status = :status', { status: ScanStatus.COMPLETED })
      .andWhere('scan.result IS NOT NULL')
      .getRawMany();

    const detectorCounts = new Map<string, number>();
    detectorStats.forEach((stat) => {
      if (stat.detectortypes) {
        try {
          const types = JSON.parse(stat.detectortypes);
          types.forEach((type: string) => {
            detectorCounts.set(type, (detectorCounts.get(type) || 0) + 1);
          });
        } catch (error) {
          // Ignore parsing errors
        }
      }
    });

    const topDetectors = Array.from(detectorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([detector, count]) => ({ detector, count }));

    return {
      totalScans,
      completedScans,
      failedScans,
      runningScans,
      totalVulnerabilities,
      averageVulnerabilitiesPerScan: completedScans > 0 ? Math.round(totalVulnerabilities / completedScans) : 0,
      topDetectors,
      successRate: totalScans > 0 ? Math.round((completedScans / totalScans) * 100) : 0,
    };
  }

  /**
   * Clean up old scan results
   */
  async cleanupOldScans(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.scanResultRepository
      .createQueryBuilder()
      .delete()
      .from(ScanResult)
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old scan results`);
    return result.affected || 0;
  }
}
