import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ADMIN_IP_ERROR_CODE,
  adminIpPolicy,
  isIpAllowed,
  normalizeIp,
} from './admin-ip';

/**
 * Corta el pedido si no viene de un equipo autorizado (ADMIN_ALLOWED_IPS).
 * La IP es `req.ip`: en Render, gracias a `trust proxy` (main.ts), es la del
 * visitante y no se puede falsificar mandando un X-Forwarded-For propio.
 *
 * Lo usan el login y JwtAuthGuard (o sea, todas las rutas del panel): así no
 * depende de que alguien se acuerde de agregarlo en cada controlador nuevo.
 */
export function assertAdminIp(request: Request): void {
  const ip = normalizeIp(request.ip);
  if (isIpAllowed(adminIpPolicy(), ip)) return;
  // La IP del propio visitante se le muestra a él (no es un dato ajeno): es
  // justamente la que el dueño tiene que agregar a la lista si es su equipo.
  throw new ForbiddenException({
    code: ADMIN_IP_ERROR_CODE,
    message:
      'Acceso restringido: este equipo no está autorizado para usar el panel.',
    ip: ip ?? 'desconocida',
  });
}

@Injectable()
export class AdminIpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertAdminIp(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
