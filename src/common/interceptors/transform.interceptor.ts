import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path: string;
  message?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // Don't transform if response is already in the desired format
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Don't transform for specific routes (like Swagger docs)
        if (request.url.includes('/docs') || request.url.includes('/health')) {
          return data;
        }

        // Check if the response is empty (for DELETE operations, etc.)
        if (response.statusCode === 204 || data === null || data === undefined) {
          return {
            success: true,
            data: null,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Operation completed successfully',
          };
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
