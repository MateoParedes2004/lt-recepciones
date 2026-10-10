import { StockModelMigration } from './stock-model-migration.service';
import { PrismaService } from '../prisma/prisma.service';

/** Error con la misma forma que lanza Prisma para P1001/P1002/P1008/P1017. */
function connectionError(code = 'P1001'): Error {
  return Object.assign(new Error('Base de datos inalcanzable (simulado)'), {
    code,
  });
}

function schemaError(): Error {
  // Error sin "code" de conexión: representa, por ejemplo, una tabla faltante.
  return new Error('relation "AppMeta" does not exist (simulado)');
}

describe('StockModelMigration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reintenta tras una falla de conexión y termina bien cuando la base despierta', async () => {
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(connectionError())
      .mockRejectedValueOnce(connectionError())
      .mockResolvedValueOnce(undefined);
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const migration = new StockModelMigration(prisma);

    const init = migration.onModuleInit();
    // Deja que cada intento fallido se registre antes de avanzar el reloj.
    for (let i = 0; i < 2; i++) {
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(30_000); // cubre cualquier demora (3s, 6s, ...)
    }
    await init;

    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('no espera entre intentos para un error que NO es de conexión (falla rápido)', async () => {
    const transaction = jest.fn().mockRejectedValue(schemaError());
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const migration = new StockModelMigration(prisma);

    await expect(migration.onModuleInit()).rejects.toThrow(/AppMeta/);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('se rinde si la base nunca responde dentro del presupuesto de 10 minutos', async () => {
    const transaction = jest.fn().mockRejectedValue(connectionError('P1002'));
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const migration = new StockModelMigration(prisma);

    const init = migration.onModuleInit();
    const rejection = expect(init).rejects.toThrow(/inalcanzable/);
    // Avanza bastante más que los 10 minutos de presupuesto, en pasos, para
    // que cada reintento intermedio se ejecute (y no solo el reloj salte).
    for (let i = 0; i < 40; i++) {
      await jest.advanceTimersByTimeAsync(30_000);
    }
    await rejection;

    // Con backoff 3s,6s,12s,24s,30s,30s... en 10 minutos caben bastantes intentos,
    // pero finitos: confirma que efectivamente se detuvo (no reintentó para siempre).
    expect(transaction.mock.calls.length).toBeGreaterThan(5);
    expect(transaction.mock.calls.length).toBeLessThan(100);
  });
});
