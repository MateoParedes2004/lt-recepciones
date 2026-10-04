import { CategoriesService } from './categories.service';
import { CategoryOrderMigration } from './category-order-migration.service';

// Prisma simulado: solo lo que usan estos servicios.
const makePrisma = () => {
  const tx = { $executeRaw: jest.fn() };
  return {
    category: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    tx,
  };
};

describe('CategoriesService (orden de rubros)', () => {
  it('lista por sortOrder y, a igual posición, por id', async () => {
    const prisma = makePrisma();
    prisma.category.findMany.mockResolvedValue([]);
    await new CategoriesService(prisma as any).findAll();
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('un rubro nuevo sin posición va al final: último número + 10', async () => {
    const prisma = makePrisma();
    prisma.category.aggregate.mockResolvedValue({ _max: { sortOrder: 40 } });
    prisma.category.create.mockResolvedValue({ id: 9 });
    await new CategoriesService(prisma as any).create({ name: 'Manteles' });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Manteles', sortOrder: 50 },
    });
  });

  it('sin rubros previos arranca en 10', async () => {
    const prisma = makePrisma();
    prisma.category.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    await new CategoriesService(prisma as any).create({ name: 'Primero' });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Primero', sortOrder: 10 },
    });
  });

  it('si se manda una posición al crear, se respeta', async () => {
    const prisma = makePrisma();
    await new CategoriesService(prisma as any).create({ name: 'Manteles', sortOrder: 21 });
    expect(prisma.category.aggregate).not.toHaveBeenCalled();
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Manteles', sortOrder: 21 },
    });
  });

  it('al editar, un sortOrder null no llega a Prisma (la columna no admite nulos)', async () => {
    const prisma = makePrisma();
    await new CategoriesService(prisma as any).update(3, { name: 'Mesas', description: null, sortOrder: null });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: 'Mesas', description: null },
    });
  });

  it('al editar, una posición nueva sí se guarda', async () => {
    const prisma = makePrisma();
    await new CategoriesService(prisma as any).update(3, { name: 'Mesas', sortOrder: 20 });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: 'Mesas', sortOrder: 20 },
    });
  });
});

describe('CategoryOrderMigration', () => {
  it('inicializa el orden (id × 10) una sola vez', async () => {
    const prisma = makePrisma();
    prisma.tx.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(5);
    await new CategoryOrderMigration(prisma as any).onModuleInit();
    expect(prisma.tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('si la marca ya existe, no vuelve a tocar los rubros', async () => {
    const prisma = makePrisma();
    prisma.tx.$executeRaw.mockResolvedValueOnce(0);
    await new CategoryOrderMigration(prisma as any).onModuleInit();
    expect(prisma.tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('si falla, no tira abajo el arranque del backend', async () => {
    const prisma = makePrisma();
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error('columna inexistente'));
    await expect(new CategoryOrderMigration(prisma as any).onModuleInit()).resolves.toBeUndefined();
  });
});
