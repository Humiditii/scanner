import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Vulnerability Scanner API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Application Health', () => {
    it('/api/v1 (GET) - should return application info', () => {
      return request(app.getHttpServer())
        .get('/api/v1')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('message');
          expect(res.body.data).toHaveProperty('version');
          expect(res.body.data).toHaveProperty('environment');
        });
    });

    it('/api/v1/health/live (GET) - should return liveness check', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
        });
    });
  });

  describe('Scan API', () => {
    it('/api/v1/scan/statistics (GET) - should return scan statistics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/scan/statistics')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('totalScans');
          expect(res.body.data).toHaveProperty('completedScans');
          expect(res.body.data).toHaveProperty('failedScans');
        });
    });

    it('/api/v1/scan/history (GET) - should return scan history with pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/scan/history?page=1&limit=10')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('meta');
          expect(res.body.data.meta).toHaveProperty('page', 1);
          expect(res.body.data.meta).toHaveProperty('limit', 10);
        });
    });

    it('/api/v1/scan (POST) - should validate scan request', () => {
      return request(app.getHttpServer())
        .post('/api/v1/scan')
        .send({
          repoUrl: 'invalid-url',
          provider: 'github',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('message');
        });
    });

    it('/api/v1/scan (POST) - should accept valid scan request', () => {
      return request(app.getHttpServer())
        .post('/api/v1/scan')
        .send({
          repoUrl: 'https://github.com/octocat/Hello-World',
          provider: 'github',
          forceRescan: false,
          verifiedOnly: false,
        })
        .expect((res) => {
          // Should return either 200 (cached) or 202 (new scan)
          expect([200, 202]).toContain(res.status);
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('scanId');
          expect(res.body.data).toHaveProperty('repoUrl');
          expect(res.body.data).toHaveProperty('provider');
        });
    });

    it('/api/v1/scan/history (GET) - should filter by provider', () => {
      return request(app.getHttpServer())
        .get('/api/v1/scan/history?provider=github')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('data');
          expect(Array.isArray(res.body.data.data)).toBe(true);
        });
    });

    it('/api/v1/scan/history (GET) - should validate pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/scan/history?page=0&limit=101')
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
        });
    });

    it('/api/v1/scan/:id (GET) - should return 404 for non-existent scan', () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      return request(app.getHttpServer())
        .get(`/api/v1/scan/${nonExistentId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body.message).toContain('not found');
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid endpoint gracefully', () => {
      return request(app.getHttpServer())
        .get('/api/v1/non-existent-endpoint')
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body).toHaveProperty('path', '/api/v1/non-existent-endpoint');
        });
    });

    it('should handle malformed JSON in request body', () => {
      return request(app.getHttpServer())
        .post('/api/v1/scan')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should enforce rate limiting', async () => {
      const requests = Array(15).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/v1/scan/statistics')
      );

      const responses = await Promise.all(requests);
      const tooManyRequestsResponses = responses.filter(res => res.status === 429);
      
      // Should have at least some rate limited responses
      expect(tooManyRequestsResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', () => {
      return request(app.getHttpServer())
        .get('/api/v1')
        .expect((res) => {
          expect(res.headers).toHaveProperty('x-content-type-options');
          expect(res.headers).toHaveProperty('x-frame-options');
          expect(res.headers).toHaveProperty('x-xss-protection');
        });
    });
  });
});
