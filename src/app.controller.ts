import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Application information',
    description: 'Get basic information about the vulnerability scanner API'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Application information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'DataUlinzi Vulnerability Scanner API' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'development' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        uptime: { type: 'number', example: 3600 }
      }
    }
  })
  getHello() {
    return this.appService.getApplicationInfo();
  }
}
