import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  const [[code]] = status.mock.calls as [[number]];
  const [[body]] = json.mock.calls as [[{ message: string }]];
  return { code, body };
}

describe('AllExceptionsFilter', () => {
  it('un cuerpo demasiado grande es 413, no un 500', () => {
    const { code, body } = run(
      Object.assign(new Error('request entity too large'), {
        status: 413,
        type: 'entity.too.large',
      }),
    );
    expect(code).toBe(413);
    expect(body.message).toMatch(/demasiado grande/);
  });

  it('un JSON roto (4xx del servidor web) es 4xx, no un 500', () => {
    expect(
      run(
        Object.assign(new SyntaxError('Unexpected token'), {
          status: 400,
          type: 'entity.parse.failed',
        }),
      ).code,
    ).toBe(400);
  });

  it('un id fuera de rango (P2020) es 400, no un 500', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Value out of range', {
      code: 'P2020',
      clientVersion: 'x',
    });
    expect(run(err).code).toBe(400);
  });

  it('un 5xx con "status" no se disfraza: sigue siendo 500 genérico', () => {
    const { code, body } = run(
      Object.assign(new Error('boom'), { status: 503 }),
    );
    expect(code).toBe(500);
    expect(body.message).not.toMatch(/boom/);
  });

  it('un error cualquiera es 500 sin mostrar el detalle', () => {
    const { code, body } = run(new Error('secreto interno'));
    expect(code).toBe(500);
    expect(body.message).not.toMatch(/secreto/);
  });

  it('las excepciones de Nest conservan su status', () => {
    expect(run(new NotFoundException('no está')).code).toBe(404);
  });
});
