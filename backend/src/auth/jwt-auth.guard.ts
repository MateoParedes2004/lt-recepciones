import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_ROLES_KEY, type Role } from './roles';
import { loadSessionState } from './session-state';

/** Lo que va firmado dentro del token de sesión. */
export interface TokenPayload {
  sub: number;
  email: string;
  role: string;
  /** Versión de sesión de la cuenta al firmar (ver User.tokenVersion). Tokens viejos no la tienen = 0. */
  tv?: number;
  /** "Recordarme": la sesión dura 30 días en vez de 1. */
  rem?: boolean;
}

/** El usuario del pedido, con el rol ACTUAL (leído de la base, no del token). */
export interface AuthenticatedUser {
  sub: number;
  email: string;
  role: Role;
  /** La sesión se inició con "Recordarme" (30 días). */
  remember: boolean;
}

// JwtModule y PrismaModule son globales, así que este guard se puede usar en
// cualquier módulo con @UseGuards(JwtAuthGuard) sin importar nada más.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token)
      throw new UnauthorizedException('Falta el token de autenticación');

    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // El rol y si la cuenta sigue habilitada se leen de la base (no del token):
    // así desactivar a alguien, cambiarle el rol o su contraseña corta sus
    // sesiones abiertas sin esperar a que el token venza.
    const state = await loadSessionState(this.prisma, payload.sub);
    if (!state || !state.isActive) {
      throw new UnauthorizedException(
        'Esta cuenta está desactivada. Pedile acceso al dueño.',
      );
    }
    if ((payload.tv ?? 0) !== state.tokenVersion) {
      throw new UnauthorizedException(
        'La sesión se cerró (cambió la contraseña o el acceso). Volvé a ingresar.',
      );
    }

    // Cerrado por defecto: sin @AllowRoles, solo el dueño.
    const allowed =
      this.reflector.getAllAndOverride<Role[] | undefined>(ALLOW_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (state.role !== 'ADMIN' && !allowed.includes(state.role as Role)) {
      throw new ForbiddenException('Tu usuario no tiene permiso para esto.');
    }

    (request as Request & { user: AuthenticatedUser }).user = {
      sub: payload.sub,
      email: state.email,
      role: state.role as Role,
      remember: payload.rem === true,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
