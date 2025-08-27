import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisHealthIndicator } from './redis-health.indicator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Get the overall health status of the application including database, Redis, memory, and disk usage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check passed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          example: {
            database: { status: 'up' },
            redis: { status: 'up' },
            memory_heap: { status: 'up' },
            memory_rss: { status: 'up' },
            storage: { status: 'up' },
          },
        },
        error: { type: 'object' },
        details: {
          type: 'object',
          example: {
            database: { status: 'up' },
            redis: { status: 'up' },
            memory_heap: { status: 'up' },
            memory_rss: { status: 'up' },
            storage: { status: 'up' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Health check failed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        info: { type: 'object' },
        error: {
          type: 'object',
          example: {
            database: {
              status: 'down',
              message: 'Connection failed',
            },
          },
        },
        details: { type: 'object' },
      },
    },
  })
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck('database'),
      
      // Redis health check
      () => this.redis.isHealthy('redis'),
      
      // Memory health checks
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),   // 150MB
      
      // Disk health check
      () => this.disk.checkStorage('storage', {
        path: '/',
        thresholdPercent: 0.9, // 90% threshold
      }),
    ]);
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Check if the application is ready to serve requests. Validates critical dependencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            database: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
            redis: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
          },
        },
        details: { type: 'object' },
      },
    },
  })
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness check',
    description: 'Check if the application is alive and responsive.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @HealthCheck()
  liveness() {
    return this.health.check([
      // Just check if the application can respond
      () => ({ alive: { status: 'up' } }),
    ]);
  }
}
