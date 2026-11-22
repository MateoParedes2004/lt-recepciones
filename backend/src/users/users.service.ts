import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { forgetSession } from '../auth/session-state';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/**
 * Accesos al panel (solo el dueño los administra). No se borran usuarios: se
 * desactivan, así sus presupuestos y facturas siguen diciendo quién los hizo.
 *
 * Resguardo: siempre tiene que quedar al menos UN dueño activo, y nadie puede
 * desactivarse ni quitarse el rol de dueño a sí mismo (se quedaría afuera).
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: PUBLIC_USER,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateUserDto) {
    const taken = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (taken)
      throw new ConflictException('Ya existe un usuario con ese correo.');
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        password: await bcrypt.hash(dto.password, 10),
      },
      select: PUBLIC_USER,
    });
  }

  async update(id: number, dto: UpdateUserDto, actingUserId: number) {
    // Ojo: el validador deja las propiedades no enviadas como `undefined` (las
    // claves existen igual), por eso se cuentan los valores, no las claves.
    if (Object.values(dto).every((v) => v === undefined))
      throw new BadRequestException('No hay nada para cambiar.');
    const target = await this.findOrFail(id);
    const losesOwnerAccess =
      target.role === 'ADMIN' &&
      target.isActive &&
      (dto.role === 'VENDEDOR' || dto.isActive === false);

    if (id === actingUserId && losesOwnerAccess) {
      throw new ConflictException(
        'No podés quitarte a vos mismo el acceso de dueño: te quedarías afuera.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Bloqueo de los dueños activos: dos cambios al mismo tiempo no pueden
      // dejar al sistema sin ningún dueño.
      if (losesOwnerAccess) {
        const owners = await tx.$queryRaw<{ id: number }[]>`
          SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "isActive" = true FOR UPDATE`;
        if (owners.filter((o) => o.id !== id).length === 0) {
          throw new ConflictException(
            'Tiene que quedar al menos un dueño activo.',
          );
        }
      }
      const cutsSessions =
        dto.isActive === false ||
        (dto.role !== undefined && dto.role !== target.role);
      return tx.user.update({
        where: { id },
        data: {
          ...dto,
          // Desactivar o cambiar el rol corta las sesiones abiertas de esa persona al instante.
          ...(cutsSessions ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: PUBLIC_USER,
      });
    });
    forgetSession(id);
    return updated;
  }

  /** El dueño le pone una contraseña nueva a alguien (ej. la olvidó). Corta sus sesiones abiertas. */
  async resetPassword(id: number, dto: ResetPasswordDto) {
    await this.findOrFail(id);
    await this.prisma.user.update({
      where: { id },
      data: {
        password: await bcrypt.hash(dto.password, 10),
        tokenVersion: { increment: 1 },
      },
    });
    forgetSession(id);
    return {
      message:
        'Contraseña cambiada. Esa persona tiene que volver a ingresar con la nueva.',
    };
  }

  private async findOrFail(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException(`El usuario con ID ${id} no existe.`);
    return user;
  }
}
