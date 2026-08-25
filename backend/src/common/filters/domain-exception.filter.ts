import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError, ErrorCode } from '../errors/domain-error';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

/**
 * Single place where anything thrown becomes an HTTP response, so every
 * rejection the client sees has the same shape and a stable machine-readable
 * `error` code. The frontend maps codes to copy; it never parses messages.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toBody(exception, request.url);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, path: string): ErrorResponseBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainError) {
      return {
        statusCode: exception.status,
        error: exception.code,
        message: exception.message,
        path,
        timestamp,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as
        | string
        | { message?: string | string[]; error?: string };

      if (typeof res === 'string') {
        return { statusCode: status, error: ErrorCode.VALIDATION_FAILED, message: res, path, timestamp };
      }

      const messages = Array.isArray(res.message) ? res.message : [res.message ?? exception.message];
      return {
        statusCode: status,
        error: status === 400 ? ErrorCode.VALIDATION_FAILED : (res.error ?? ErrorCode.INTERNAL_ERROR),
        message: messages[0] ?? exception.message,
        details: messages.length > 1 ? messages : undefined,
        path,
        timestamp,
      };
    }

    return {
      statusCode: 500,
      error: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
      path,
      timestamp,
    };
  }
}
