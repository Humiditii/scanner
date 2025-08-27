import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, body, query, params, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = headers['x-forwarded-for'] || request.connection.remoteAddress;

    // Log incoming request
    const requestLog = {
      timestamp: new Date().toISOString(),
      method,
      url,
      userAgent,
      ip,
      body: this.sanitizeBody(body),
      query,
      params,
    };

    this.logger.log(`Incoming ${method} ${url}`, requestLog);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - now;
          const responseLog = {
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            userAgent,
            ip,
            responseSize: JSON.stringify(data).length,
          };

          this.logger.log(`Completed ${method} ${url} - ${response.statusCode}`, responseLog);
        },
        error: (error) => {
          const duration = Date.now() - now;
          const errorLog = {
            timestamp: new Date().toISOString(),
            method,
            url,
            duration: `${duration}ms`,
            userAgent,
            ip,
            error: error.message || error,
          };

          this.logger.error(`Failed ${method} ${url}`, errorLog);
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
