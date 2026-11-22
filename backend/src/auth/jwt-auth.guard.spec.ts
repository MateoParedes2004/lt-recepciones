import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AllowRoles } from './roles';
import { forgetSession } from './session-state';

// Controladores de mentira con los mismos decoradores que usa el sistema.
class OwnerOnlyController {
  route() {}
}
@AllowRoles('VENDEDOR')
class SellerController {
  route() {}
  @AllowRoles()
  ownerOnlyInside() {}
}

const jwt = new JwtService({ secret: 'secreto-de-prueba' });
let user: {
  role: string;
  email: string;
  name: string;
  isActive: boolean;
  tokenVersion: number;
} | null;
const prisma = {
  user: { findUnique: jest.fn(() => Promise.resolve(user)) },
} as unknown as PrismaService;
const guard = new JwtAuthGuard(jwt, prisma, new Reflector());

const ctx = (
  token: string | undefined,
  cls: new () => object,
  method: string,
) => {
  const request = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as Request & { user?: unknown };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => (cls.prototype as Record<string, unknown>)[method],
      getClass: () => cls,
    } as unknown as ExecutionContext,
  };
};
const token = (extra: Record<string, unknown> = {}) =>
  jwt.signAsync({ sub: 7, email: 'x@y.z', role: 'ADMIN', tv: 0, ...extra });

describe('JwtAuthGuard (roles y sesiones)', () => {
  beforeEach(() => {
    forgetSession(7);
    user = {
      role: 'ADMIN',
      email: 'x@y.z',
      name: 'X',
      isActive: true,
      tokenVersion: 0,
    };
  });

  it('sin token o con token roto → 401', async () => {
    await expect(
      guard.canActivate(ctx(undefined, OwnerOnlyController, 'route').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(ctx('basura', OwnerOnlyController, 'route').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('el dueño entra a todo, y el rol que vale es el de la base (no el del token)', async () => {
    const { context, request } = ctx(
      await token({ role: 'VENDEDOR' }),
      OwnerOnlyController,
      'route',
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 7, role: 'ADMIN' });
  });

  it('el Vendedor entra a lo marcado para él y NO a lo que es solo del dueño (cerrado por defecto)', async () => {
    user!.role = 'VENDEDOR';
    await expect(
      guard.canActivate(ctx(await token(), SellerController, 'route').context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        ctx(await token(), OwnerOnlyController, 'route').context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('@AllowRoles() vacío en una ruta la deja solo para el dueño aunque el controlador permita más', async () => {
    user!.role = 'VENDEDOR';
    await expect(
      guard.canActivate(
        ctx(await token(), SellerController, 'ownerOnlyInside').context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un rol desconocido no entra a nada protegido', async () => {
    user!.role = 'CHOFER';
    await expect(
      guard.canActivate(ctx(await token(), SellerController, 'route').context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cuenta desactivada o borrada → 401 aunque el token siga vigente', async () => {
    user!.isActive = false;
    await expect(
      guard.canActivate(
        ctx(await token(), OwnerOnlyController, 'route').context,
      ),
    ).rejects.toThrow(/desactivada/);
    forgetSession(7);
    user = null;
    await expect(
      guard.canActivate(
        ctx(await token(), OwnerOnlyController, 'route').context,
      ),
    ).rejects.toThrow(/desactivada/);
  });

  it('si cambió la versión de sesión (contraseña nueva, acceso cortado), el token viejo deja de servir', async () => {
    user!.tokenVersion = 1;
    await expect(
      guard.canActivate(
        ctx(await token({ tv: 0 }), OwnerOnlyController, 'route').context,
      ),
    ).rejects.toThrow(/se cerró/);
    forgetSession(7);
    await expect(
      guard.canActivate(
        ctx(await token({ tv: 1 }), OwnerOnlyController, 'route').context,
      ),
    ).resolves.toBe(true);
  });

  it('los tokens emitidos antes de este cambio (sin versión) siguen valiendo mientras la cuenta no cambie', async () => {
    const old = await jwt.signAsync({ sub: 7, email: 'x@y.z', role: 'ADMIN' });
    await expect(
      guard.canActivate(ctx(old, OwnerOnlyController, 'route').context),
    ).resolves.toBe(true);
  });

  it('guarda el estado unos segundos y forgetSession lo vuelve a leer (corte inmediato tras un cambio)', async () => {
    const calls = (prisma.user.findUnique as jest.Mock).mock.calls.length;
    await guard.canActivate(
      ctx(await token(), OwnerOnlyController, 'route').context,
    );
    await guard.canActivate(
      ctx(await token(), OwnerOnlyController, 'route').context,
    );
    expect(
      (prisma.user.findUnique as jest.Mock).mock.calls.length - calls,
    ).toBe(1);
    user!.isActive = false;
    forgetSession(7);
    await expect(
      guard.canActivate(
        ctx(await token(), OwnerOnlyController, 'route').context,
      ),
    ).rejects.toThrow(/desactivada/);
  });
});
