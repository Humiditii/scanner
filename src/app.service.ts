import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getApplicationInfo() {
    return {
      message: 'DataUlinzi Vulnerability Scanner API',
      version: this.configService.get<string>('npm_package_version', '1.0.0'),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      status: 'healthy'
    };
  }
}
