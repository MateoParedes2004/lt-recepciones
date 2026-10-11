import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AuthenticatedUser {
  sub: number;
  email: string;
  role: string;
}

// JwtModule está registrado como global (ver auth.module.ts), así que JwtService
// se puede inyectar en cualquier módulo sin necesidad de importar AuthModule.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }

    let payload: AuthenticatedUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Hoy todo usuario registrado es "ADMIN" (ver User.role en schema.prisma):
    // esta revisión no cambia nada en la práctica, pero deja escrito que el
    // panel es solo para administradores. Sin esto, el día que se sume un rol
    // con menos permisos (ej. un empleado), cualquier token válido —sin
    // importar su rol— seguiría entrando a todas las rutas protegidas por
    // este mismo guard, a menos que alguien se acuerde de agregar esta
    // revisión en cada lugar que la necesite.
    if (payload.role !== 'ADMIN') {
      throw new UnauthorizedException('Esta cuenta no tiene permiso para administrar el panel.');
    }

    (request as Request & { user: AuthenticatedUser }).user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
