import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScanService } from './scan.service';
import { TruffleHogService } from './trufflehog.service';
import { CacheService } from '../../cache/cache.service';
import { ScanResult, ScanStatus, GitProvider } from '../entities/scan-result.entity';
import { BadRequestException } from '@nestjs/common';

describe('ScanService', () => {
  let service: ScanService;
  let repository: Repository<ScanResult>;
  let cacheService: CacheService;
  let truffleHogService: TruffleHogService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    }),
  };

  const mockCacheService = {
    getScanResult: jest.fn(),
    setScanResult: jest.fn(),
    deleteScanResult: jest.fn(),
  };

  const mockTruffleHogService = {
    validateRepositoryUrl: jest.fn(),
    scanRepository: jest.fn(),
    getScannerInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScanService,
        {
          provide: getRepositoryToken(ScanResult),
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: TruffleHogService,
          useValue: mockTruffleHogService,
        },
      ],
    }).compile();

    service = module.get<ScanService>(ScanService);
    repository = module.get<Repository<ScanResult>>(getRepositoryToken(ScanResult));
    cacheService = module.get<CacheService>(CacheService);
    truffleHogService = module.get<TruffleHogService>(TruffleHogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scanRepository', () => {
    const validScanRequest = {
      repoUrl: 'https://github.com/octocat/Hello-World',
      provider: GitProvider.GITHUB,
      forceRescan: false,
      verifiedOnly: false,
    };

    it('should throw BadRequestException for invalid URL', async () => {
      mockTruffleHogService.validateRepositoryUrl.mockReturnValue(false);

      await expect(
        service.scanRepository({
          ...validScanRequest,
          repoUrl: 'invalid-url',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return cached result when available and not forcing rescan', async () => {
      const cachedResult = {
        scanId: 'test-id',
        repoUrl: validScanRequest.repoUrl,
        provider: validScanRequest.provider,
        status: ScanStatus.COMPLETED,
      };

      mockTruffleHogService.validateRepositoryUrl.mockReturnValue(true);
      mockCacheService.getScanResult.mockResolvedValue(cachedResult);

      const result = await service.scanRepository(validScanRequest);

      expect(result).toEqual({ ...cachedResult, fromCache: true });
      expect(mockCacheService.getScanResult).toHaveBeenCalledWith(
        validScanRequest.repoUrl,
        validScanRequest.provider,
      );
    });

    it('should create new scan when no cache available', async () => {
      const newScan = {
        id: 'new-scan-id',
        repoUrl: validScanRequest.repoUrl,
        provider: validScanRequest.provider,
        status: ScanStatus.PENDING,
        createdAt: new Date(),
        scanDuration: 0,
        vulnerabilityCount: 0,
        verifiedVulnerabilityCount: 0,
      };

      mockTruffleHogService.validateRepositoryUrl.mockReturnValue(true);
      mockCacheService.getScanResult.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(newScan);
      mockRepository.save.mockResolvedValue(newScan);

      const result = await service.scanRepository(validScanRequest);

      expect(result.scanId).toBe(newScan.id);
      expect(result.status).toBe(ScanStatus.PENDING);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return existing running scan', async () => {
      const runningScan = {
        id: 'running-scan-id',
        repoUrl: validScanRequest.repoUrl,
        provider: validScanRequest.provider,
        status: ScanStatus.RUNNING,
        createdAt: new Date(),
        scanDuration: 0,
        vulnerabilityCount: 0,
        verifiedVulnerabilityCount: 0,
        isRunning: () => true,
      };

      mockTruffleHogService.validateRepositoryUrl.mockReturnValue(true);
      mockCacheService.getScanResult.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(runningScan);

      const result = await service.scanRepository(validScanRequest);

      expect(result.scanId).toBe(runningScan.id);
      expect(result.status).toBe(ScanStatus.RUNNING);
    });
  });

  describe('getScanHistory', () => {
    it('should return paginated scan history', async () => {
      const mockScans = [
        {
          id: 'scan-1',
          repoUrl: 'https://github.com/test/repo1',
          provider: GitProvider.GITHUB,
          status: ScanStatus.COMPLETED,
          createdAt: new Date(),
          scanDuration: 30,
          vulnerabilityCount: 2,
          verifiedVulnerabilityCount: 1,
        },
      ];

      const query = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      mockRepository.findAndCount.mockResolvedValue([mockScans, 1]);

      const result = await service.getScanHistory(query);

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply filters correctly', async () => {
      const query = {
        repoUrl: 'github.com/test',
        provider: GitProvider.GITHUB,
        status: ScanStatus.COMPLETED,
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.getScanHistory(query);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: GitProvider.GITHUB,
            status: ScanStatus.COMPLETED,
          }),
        }),
      );
    });
  });

  describe('getScanStatistics', () => {
    it('should return comprehensive scan statistics', async () => {
      mockRepository.count
        .mockResolvedValueOnce(100) // total scans
        .mockResolvedValueOnce(80)  // completed scans
        .mockResolvedValueOnce(15)  // failed scans
        .mockResolvedValueOnce(5);  // running scans

      mockRepository.createQueryBuilder().getRawOne.mockResolvedValue({ sum: '240' });
      mockRepository.createQueryBuilder().getRawMany.mockResolvedValue([
        { detectortypes: '["AWS", "GitHub"]' },
        { detectortypes: '["AWS", "Stripe"]' },
      ]);

      const result = await service.getScanStatistics();

      expect(result).toEqual({
        totalScans: 100,
        completedScans: 80,
        failedScans: 15,
        runningScans: 5,
        totalVulnerabilities: 240,
        averageVulnerabilitiesPerScan: 3,
        topDetectors: expect.any(Array),
        successRate: 80,
      });
    });
  });

  describe('deleteScan', () => {
    it('should delete scan and invalidate cache', async () => {
      const scanToDelete = {
        id: 'scan-to-delete',
        repoUrl: 'https://github.com/test/repo',
        provider: GitProvider.GITHUB,
      };

      mockRepository.findOne.mockResolvedValue(scanToDelete);
      mockRepository.remove.mockResolvedValue(scanToDelete);

      await service.deleteScan(scanToDelete.id);

      expect(mockCacheService.deleteScanResult).toHaveBeenCalledWith(
        scanToDelete.repoUrl,
        scanToDelete.provider,
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(scanToDelete);
    });

    it('should throw NotFoundException for non-existent scan', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteScan('non-existent-id')).rejects.toThrow();
    });
  });
});
