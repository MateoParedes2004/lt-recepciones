import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Errores conocidos de Prisma que son situaciones normales de uso (no fallas
// del servidor) y por eso se traducen a un status y mensaje claros en vez de
// un 500 genérico. Se reconocen por su `code` (P2xxx), sin importar la clase.
function mapPrismaError(exception: unknown): { status: number; message: string } | null {
  const code = (exception as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return null;

  switch (code) {
    case 'P2002': // violación de unicidad (ej. dos categorías con el mismo nombre)
      return { status: HttpStatus.CONFLICT, message: 'Ya existe un registro con ese valor (por ejemplo, el mismo nombre o correo).' };
    case 'P2025': // el registro que se quería modificar/borrar no existe
      return { status: HttpStatus.NOT_FOUND, message: 'El registro solicitado no existe (puede que ya lo hayan eliminado).' };
    case 'P2003': // clave foránea: referencia algo que no existe, o está en uso
      return { status: HttpStatus.CONFLICT, message: 'No se pudo completar la operación: el registro apunta a algo que no existe o todavía está en uso por otros datos.' };
    default:
      return null;
  }
}

// Normaliza todas las respuestas de error: las excepciones conocidas de Nest
// (BadRequestException, NotFoundException, errores del ValidationPipe, etc.)
// mantienen su status y mensaje tal cual. Los errores conocidos de Prisma se
// traducen con mapPrismaError. Cualquier otro error no controlado se convierte
// en un 500 genérico y el detalle real solo se loguea en el servidor, nunca
// se expone al cliente.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const prismaError = isHttpException ? null : mapPrismaError(exception);

    const status = isHttpException
      ? exception.getStatus()
      : prismaError?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? exception.getResponse()
      : prismaError?.message ?? 'Ocurrió un error inesperado. Intentá de nuevo más tarde.';

    if (!isHttpException && !prismaError) {
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
