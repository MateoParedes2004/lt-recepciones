import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Normaliza todas las respuestas de error: las excepciones conocidas de Nest
// (BadRequestException, NotFoundException, errores del ValidationPipe, etc.)
// mantienen su status y mensaje tal cual. Cualquier error no controlado
// (ej. una excepción cruda de Prisma) se convierte en un 500 genérico y
// el detalle real solo se loguea en el servidor, nunca se expone al cliente.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? exception.getResponse()
      : 'Ocurrió un error inesperado. Intentá de nuevo más tarde.';

    if (!isHttpException) {
      this.logger.error(
        `${request.method} ${request.url} -> error no controlado`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body =
      typeof message === 'string'
        ? { statusCode: status, message }
        : { statusCode: status, ...message };

    response.status(status).json(body);
  }
}
