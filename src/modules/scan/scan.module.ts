import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScanController } from './scan.controller';
import { ScanService } from './services/scan.service';
import { TruffleHogService } from './services/trufflehog.service';
import { ScanResult } from './entities/scan-result.entity';
import { CacheServiceModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScanResult]),
    CacheServiceModule,
  ],
  controllers: [ScanController],
  providers: [ScanService, TruffleHogService],
  exports: [ScanService, TruffleHogService],
})
export class ScanModule {}
