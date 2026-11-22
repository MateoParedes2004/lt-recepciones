/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument --
   Prisma se simula con jest.fn(): leer sus .mock.calls es justo lo que verifican estas pruebas. */
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

type U = { id: number; role: string; isActive: boolean };

function setup(users: U[]) {
  const tx = {
    $queryRaw: jest.fn(() =>
      Promise.resolve(
        users
          .filter((u) => u.role === 'ADMIN' && u.isActive)
          .map((u) => ({ id: u.id })),
      ),
    ),
    user: {
      update: jest.fn(({ data }) => Promise.resolve({ id: 1, ...data })),
    },
  };
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(users.find((u) => u.id === where.id) ?? null),
      ),
      findFirst: jest.fn(() => Promise.resolve(null)),
      update: jest.fn(() => Promise.resolve({})),
      create: jest.fn(({ data }) => Promise.resolve({ id: 99, ...data })),
    },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { service: new UsersService(prisma as any), prisma, tx };
}

describe('UsersService', () => {
  it('nadie puede quitarse a sí mismo el acceso de dueño (ni desactivarse)', async () => {
    const { service } = setup([
      { id: 1, role: 'ADMIN', isActive: true },
      { id: 2, role: 'ADMIN', isActive: true },
    ]);
    await expect(service.update(1, { role: 'VENDEDOR' }, 1)).rejects.toThrow(
      /a vos mismo/,
    );
    await expect(service.update(1, { isActive: false }, 1)).rejects.toThrow(
      /a vos mismo/,
    );
  });

  it('siempre queda al menos un dueño activo', async () => {
    // El dueño 1 intenta degradar al 2, pero el 1 ya está inactivo en la base: el 2 es el único.
    const { service } = setup([
      { id: 1, role: 'ADMIN', isActive: false },
      { id: 2, role: 'ADMIN', isActive: true },
    ]);
    await expect(service.update(2, { isActive: false }, 1)).rejects.toThrow(
      /al menos un dueño/,
    );
  });

  it('con otro dueño activo, se puede degradar o desactivar a un dueño', async () => {
    const { service, tx } = setup([
      { id: 1, role: 'ADMIN', isActive: true },
      { id: 2, role: 'ADMIN', isActive: true },
    ]);
    await service.update(2, { role: 'VENDEDOR' }, 1);
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({
      role: 'VENDEDOR',
      tokenVersion: { increment: 1 },
    });
  });

  it('desactivar a alguien corta sus sesiones; cambiarle solo el nombre, no', async () => {
    const { service, tx } = setup([
      { id: 1, role: 'ADMIN', isActive: true },
      { id: 3, role: 'VENDEDOR', isActive: true },
    ]);
    await service.update(3, { isActive: false }, 1);
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({
      isActive: false,
      tokenVersion: { increment: 1 },
    });
    await service.update(3, { name: 'Nuevo nombre' }, 1);
    expect(tx.user.update.mock.calls[1][0].data).toEqual({
      name: 'Nuevo nombre',
    });
  });

  it('pedido vacío → error claro; usuario inexistente → 404', async () => {
    const { service } = setup([{ id: 1, role: 'ADMIN', isActive: true }]);
    await expect(service.update(1, {}, 1)).rejects.toThrow(/nada para cambiar/);
    // Así llega del validador un PATCH vacío: claves presentes con valor undefined.
    await expect(
      service.update(
        1,
        { name: undefined, role: undefined, isActive: undefined },
        1,
      ),
    ).rejects.toThrow(/nada para cambiar/);
    await expect(service.update(50, { name: 'X' }, 1)).rejects.toThrow(
      /no existe/,
    );
  });

  it('correo repetido (sin importar mayúsculas) → 409', async () => {
    const { service, prisma } = setup([]);
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1 } as never);
    await expect(
      service.create({
        name: 'Ana',
        email: 'ana@x.com',
        password: '12345678',
        role: 'VENDEDOR',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('la contraseña se guarda cifrada, nunca en texto', async () => {
    const { service, prisma } = setup([]);
    await service.create({
      name: 'Ana',
      email: 'ana@x.com',
      password: 'secreta123',
      role: 'VENDEDOR',
    });
    const saved = prisma.user.create.mock.calls[0][0].data.password as string;
    expect(saved).not.toBe('secreta123');
    expect(saved.startsWith('$2')).toBe(true);
  });
});
