import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const body =
      typeof message === 'object' && message !== null && 'message' in message
        ? (message as { message: string | string[] })
        : { message };

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${JSON.stringify(body)}`,
    );

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] || 'Error',
      ...(typeof body === 'object' && body !== null ? body : { message: body }),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
