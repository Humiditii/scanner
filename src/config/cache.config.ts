import { registerAs } from '@nestjs/config';

export const cacheConfig = registerAs('cache', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  ttl: parseInt(process.env.CACHE_TTL, 10) || 3600, // 1 hour default
  max: 1000, // Maximum number of items in cache
  keyPrefix: 'vuln-scanner:',
}));
