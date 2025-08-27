import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ScanService } from './services/scan.service';
import { ScanRequestDto, ScanResponseDto } from './dto/scan-request.dto';
import { HistoryQueryDto, HistoryResponseDto } from './dto/history-query.dto';

@ApiTags('Vulnerability Scanning')
@Controller('scan')
@UseGuards(ThrottlerGuard)
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post()
  @ApiOperation({
    summary: 'Scan repository for vulnerabilities',
    description: 'Initiates a vulnerability scan for the specified Git repository. Returns cached results if available and not forced to rescan.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scan initiated successfully or cached result returned',
    type: ScanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Scan initiated and running in background',
    type: ScanResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data or repository URL',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' }, example: ['Invalid repository URL format'] },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: { type: 'string', example: 'ThrottlerException: Too Many Requests' },
        error: { type: 'string', example: 'Too Many Requests' },
      },
    },
  })
  async scanRepository(@Body() scanRequest: ScanRequestDto): Promise<ScanResponseDto> {
    return this.scanService.scanRepository(scanRequest);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get scan history',
    description: 'Retrieve historical scan results with optional filtering and pagination.',
  })
  @ApiQuery({ name: 'repoUrl', required: false, description: 'Filter by repository URL (partial match)' })
  @ApiQuery({ name: 'provider', required: false, description: 'Filter by Git provider' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by scan status' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (max 100)', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field', example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order', example: 'DESC' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scan history retrieved successfully',
    type: HistoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async getScanHistory(@Query() query: HistoryQueryDto): Promise<HistoryResponseDto> {
    return this.scanService.getScanHistory(query);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get scan statistics',
    description: 'Get overall scanning statistics and metrics.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalScans: { type: 'number', example: 150 },
        completedScans: { type: 'number', example: 120 },
        failedScans: { type: 'number', example: 15 },
        runningScans: { type: 'number', example: 5 },
        totalVulnerabilities: { type: 'number', example: 450 },
        averageVulnerabilitiesPerScan: { type: 'number', example: 3 },
        successRate: { type: 'number', example: 90 },
        topDetectors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              detector: { type: 'string', example: 'AWS' },
              count: { type: 'number', example: 45 },
            },
          },
        },
      },
    },
  })
  async getStatistics() {
    return this.scanService.getScanStatistics();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get scan result by ID',
    description: 'Retrieve a specific scan result by its unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Scan result UUID',
    example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scan result retrieved successfully',
    type: ScanResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Scan result not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Scan result not found: a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async getScanById(@Param('id') id: string): Promise<ScanResponseDto> {
    return this.scanService.getScanById(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete scan result',
    description: 'Delete a scan result and remove it from cache. This action cannot be undone.',
  })
  @ApiParam({
    name: 'id',
    description: 'Scan result UUID',
    example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Scan result deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Scan result not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Scan result not found: a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async deleteScan(@Param('id') id: string): Promise<void> {
    return this.scanService.deleteScan(id);
  }
}
