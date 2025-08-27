import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.keyPrefix = this.configService.get<string>('cache.keyPrefix', 'vuln-scanner:');
    this.defaultTtl = this.configService.get<number>('CACHE_TTL', 3600);
  }

  /**
   * Generate cache key for scan results
   */
  private generateScanKey(repoUrl: string, provider: string): string {
    const cleanUrl = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
    return `${this.keyPrefix}scan:${provider}:${cleanUrl}`;
  }

  /**
   * Get scan result from cache
   */
  async getScanResult(repoUrl: string, provider: string): Promise<any | null> {
    try {
      const key = this.generateScanKey(repoUrl, provider);
      const cachedResult = await this.cacheManager.get(key);
      
      if (cachedResult) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return cachedResult;
      }
      
      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      this.logger.error('Error getting scan result from cache', error.stack);
      return null;
    }
  }

  /**
   * Set scan result in cache
   */
  async setScanResult(
    repoUrl: string,
    provider: string,
    result: any,
    ttl?: number,
  ): Promise<void> {
    try {
      const key = this.generateScanKey(repoUrl, provider);
      const cacheTtl = ttl || this.defaultTtl;
      
      await this.cacheManager.set(key, result, cacheTtl * 1000); // Convert to milliseconds
      
      this.logger.debug(`Cache set for key: ${key}, TTL: ${cacheTtl}s`);
    } catch (error) {
      this.logger.error('Error setting scan result in cache', error.stack);
      throw error;
    }
  }

  /**
   * Delete scan result from cache
   */
  async deleteScanResult(repoUrl: string, provider: string): Promise<void> {
    try {
      const key = this.generateScanKey(repoUrl, provider);
      await this.cacheManager.del(key);
      
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting scan result from cache', error.stack);
      throw error;
    }
  }

  /**
   * Check if scan result exists in cache
   */
  async hasScanResult(repoUrl: string, provider: string): Promise<boolean> {
    try {
      const key = this.generateScanKey(repoUrl, provider);
      const result = await this.cacheManager.get(key);
      return result !== null && result !== undefined;
    } catch (error) {
      this.logger.error('Error checking scan result in cache', error.stack);
      return false;
    }
  }

  /**
   * Invalidate cache for a specific pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Note: This would require a Redis-specific implementation
      // For now, we'll log the intent
      this.logger.warn(`Cache invalidation for pattern "${pattern}" not fully implemented`);
      // TODO: Implement Redis SCAN and DEL for pattern matching
    } catch (error) {
      this.logger.error('Error invalidating cache pattern', error.stack);
      throw error;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.warn('All cache cleared');
    } catch (error) {
      this.logger.error('Error clearing all cache', error.stack);
      throw error;
    }
  }

  /**
   * Get cache statistics (if available)
   */
  async getStats(): Promise<any> {
    try {
      // This would be Redis-specific implementation
      return {
        message: 'Cache stats not fully implemented',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting cache stats', error.stack);
      return null;
    }
  }

  /**
   * Generic get method
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = `${this.keyPrefix}${key}`;
      return await this.cacheManager.get<T>(fullKey);
    } catch (error) {
      this.logger.error(`Error getting key ${key} from cache`, error.stack);
      return null;
    }
  }

  /**
   * Generic set method
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = `${this.keyPrefix}${key}`;
      const cacheTtl = ttl || this.defaultTtl;
      await this.cacheManager.set(fullKey, value, cacheTtl * 1000);
    } catch (error) {
      this.logger.error(`Error setting key ${key} in cache`, error.stack);
      throw error;
    }
  }

  /**
   * Generic delete method
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = `${this.keyPrefix}${key}`;
      await this.cacheManager.del(fullKey);
    } catch (error) {
      this.logger.error(`Error deleting key ${key} from cache`, error.stack);
      throw error;
    }
  }
}
