import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly cacheService: CacheService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test Redis connection by setting and getting a test value
      const testKey = 'health-check-test';
      const testValue = 'ok';
      const timestamp = Date.now();

      // Set a test value with short TTL
      await this.cacheService.set(testKey, testValue, 10);
      
      // Get the test value
      const retrievedValue = await this.cacheService.get(testKey);
      
      // Clean up
      await this.cacheService.delete(testKey);

      if (retrievedValue === testValue) {
        const responseTime = Date.now() - timestamp;
        return this.getStatus(key, true, {
          status: 'up',
          responseTime: `${responseTime}ms`,
          message: 'Redis connection is healthy',
        });
      } else {
        throw new Error('Redis health check failed: value mismatch');
      }
    } catch (error) {
      const result = this.getStatus(key, false, {
        status: 'down',
        message: error.message || 'Redis connection failed',
      });
      
      throw new HealthCheckError('Redis check failed', result);
    }
  }
}
