import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

    // Security middleware
    app.use(helmet());
    app.use(compression());

    // CORS configuration
    app.enableCors({
      origin: nodeEnv === 'production' ? false : true,
      credentials: true,
    });

    // Global prefix and versioning
    app.setGlobalPrefix(apiPrefix);
    app.enableVersioning({
      type: VersioningType.URI,
    });

    // Global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: nodeEnv === 'production',
        validateCustomDecorators: true,
      }),
    );

    // Global filters
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Global interceptors
    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new TransformInterceptor(),
    );

    // Swagger documentation
    if (configService.get<boolean>('SWAGGER_ENABLED', true)) {
      const config = new DocumentBuilder()
        .setTitle(
          configService.get<string>(
            'SWAGGER_TITLE',
            'DataUlinzi Vulnerability Scanner API',
          ),
        )
        .setDescription(
          configService.get<string>(
            'SWAGGER_DESCRIPTION',
            'API for scanning Git repositories for vulnerabilities using TruffleHog',
          ),
        )
        .setVersion(configService.get<string>('SWAGGER_VERSION', '1.0.0'))
        .addTag('Vulnerability Scanning', 'Repository vulnerability scanning endpoints')
        .addTag('Health', 'Application health and monitoring endpoints')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            name: 'Authorization',
            description: 'Enter JWT token',
            in: 'header',
          },
          'JWT-auth',
        )
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('docs', app, document, {
        customSiteTitle: 'Vulnerability Scanner API',
        customfavIcon: 'https://nestjs.com/img/logo_text.svg',
        customJs: [
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
        ],
        customCssUrl: [
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
        ],
      });

      logger.log(`📚 Swagger documentation available at http://localhost:${port}/docs`);
    }

    // Start the application
    await app.listen(port);

    logger.log(`🚀 Application started successfully`);
    logger.log(`🌍 Environment: ${nodeEnv}`);
    logger.log(`🔗 GraphQL Playground: http://localhost:${port}/${apiPrefix}`);
    logger.log(`📝 Health Check: http://localhost:${port}/${apiPrefix}/health`);
    
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

bootstrap();
