import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

const PRISMA_USER_MESSAGES: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'This record already exists.' },
  P2003: { status: HttpStatus.BAD_REQUEST, message: 'Invalid reference.' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found.' },
  P2024: { status: HttpStatus.REQUEST_TIMEOUT, message: 'Request timed out. Please try again.' },
};

function getUserFriendlyResponse(exception: unknown): { status: number; message: string } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    const message = typeof res === 'object' && res !== null && 'message' in res
      ? (Array.isArray((res as { message: string | string[] }).message)
          ? (res as { message: string[] }).message[0]
          : (res as { message: string }).message)
      : String(res);
    return { status, message };
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_USER_MESSAGES[exception.code];
    if (mapped) return mapped;
    return { status: HttpStatus.BAD_REQUEST, message: 'This action could not be completed. Please try again.' };
  }
  if (exception instanceof Prisma.PrismaClientValidationError) {
    return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request. Please check your input.' };
  }
  if (exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError) {
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong. Please try again later.' };
  }
  if (exception instanceof Error && exception.constructor?.name?.startsWith('Prisma')) {
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong. Please try again later.' };
  }
  if (exception instanceof Error) {
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong. Please try again.' };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong. Please try again.' };
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = getUserFriendlyResponse(exception);

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${exception instanceof Error ? exception.message : String(exception)}`,
    );

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] || 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
