import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import {
  ADMIN_IP_ERROR_CODE,
  isIpAllowed,
  normalizeIp,
  parseAllowList,
  resetAdminIpPolicyCache,
} from './admin-ip';
import { AdminIpGuard } from './admin-ip.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('normalizeIp', () => {
  it.each([
    ['203.0.113.10', '203.0.113.10'],
    [' 203.0.113.10 ', '203.0.113.10'],
    ['::ffff:203.0.113.10', '203.0.113.10'],
    ['::FFFF:10.0.0.1', '10.0.0.1'],
    ['2803:2a00:1::5', '2803:2a00:1::5'],
    ['fe80::1%eth0', 'fe80::1'],
    ['::1', '::1'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeIp(input)).toBe(expected);
  });

  it.each([undefined, null, '', 'hola', '999.1.1.1', '1.2.3', '1.2.3.4.5'])(
    'rechaza %p',
    (input) => {
      expect(normalizeIp(input)).toBeNull();
    },
  );
});

describe('parseAllowList + isIpAllowed', () => {
  const allowed = (raw: string | undefined, ip: string, prod = true) =>
    isIpAllowed(parseAllowList(raw, prod).policy, normalizeIp(ip));

  it('sin variable: cerrado en producción, abierto en desarrollo', () => {
    expect(allowed(undefined, '1.2.3.4', true)).toBe(false);
    expect(allowed('', '1.2.3.4', true)).toBe(false);
    expect(allowed(' , ', '1.2.3.4', true)).toBe(false);
    expect(allowed(undefined, '1.2.3.4', false)).toBe(true);
  });

  it('"*" abre el panel a cualquier IP', () => {
    expect(allowed('*', '8.8.8.8')).toBe(true);
    expect(allowed('1.2.3.4, *', '8.8.8.8')).toBe(true);
  });

  it('una IP exacta: entra solo esa', () => {
    expect(allowed('203.0.113.10', '203.0.113.10')).toBe(true);
    expect(allowed('203.0.113.10', '::ffff:203.0.113.10')).toBe(true);
    expect(allowed('203.0.113.10', '203.0.113.11')).toBe(false);
    expect(allowed('203.0.113.10', '3.0.113.10')).toBe(false);
  });

  it('varias IPs y espacios', () => {
    const raw = ' 203.0.113.10 ,190.1.2.3 ';
    expect(allowed(raw, '190.1.2.3')).toBe(true);
    expect(allowed(raw, '203.0.113.10')).toBe(true);
    expect(allowed(raw, '190.1.2.4')).toBe(false);
  });

  it('rangos IPv4 (CIDR)', () => {
    expect(allowed('203.0.113.0/24', '203.0.113.255')).toBe(true);
    expect(allowed('203.0.113.0/24', '203.0.114.0')).toBe(false);
    expect(allowed('203.0.0.0/16', '203.0.250.1')).toBe(true);
    expect(allowed('0.0.0.0/0', '8.8.8.8')).toBe(true);
  });

  it('IPv6 exacta y por rango, sin mezclar familias', () => {
    expect(allowed('2803:2a00::/32', '2803:2a00:1234::1')).toBe(true);
    expect(allowed('2803:2a00::/32', '2803:2a01::1')).toBe(false);
    expect(allowed('2803:2a00::5', '2803:2a00:0:0::5')).toBe(true);
    expect(allowed('2803:2a00::/32', '203.0.113.10')).toBe(false);
    expect(allowed('203.0.113.10', '2803:2a00::5')).toBe(false);
  });

  it('entradas inválidas se ignoran y se informan', () => {
    const { policy, invalid } = parseAllowList(
      '203.0.113.10, hola, 1.2.3.4/33, 1.2.3.4/x, 1.2.3.4/8/1, ::1/129',
      true,
    );
    expect(invalid).toEqual([
      'hola',
      '1.2.3.4/33',
      '1.2.3.4/x',
      '1.2.3.4/8/1',
      '::1/129',
    ]);
    expect(isIpAllowed(policy, '203.0.113.10')).toBe(true);
    expect(isIpAllowed(policy, '1.2.3.4')).toBe(false);
  });

  it('si TODAS son inválidas queda cerrado (nunca abierto por error)', () => {
    expect(allowed('hola, chau', '1.2.3.4', false)).toBe(false);
  });

  it('IP desconocida: no entra salvo con "*"', () => {
    const list = parseAllowList('1.2.3.4', true).policy;
    expect(isIpAllowed(list, null)).toBe(false);
    expect(isIpAllowed(parseAllowList('*', true).policy, null)).toBe(true);
  });
});

describe('guards con ADMIN_ALLOWED_IPS', () => {
  const saved = { ...process.env };
  const ctx = (ip: string | undefined, token?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () =>
          ({
            ip,
            headers: token ? { authorization: `Bearer ${token}` } : {},
          }) as unknown as Request,
      }),
    }) as ExecutionContext;

  const jwt = new JwtService({ secret: 'secreto-de-prueba' });

  beforeEach(() => resetAdminIpPolicyCache());
  afterEach(() => {
    process.env = { ...saved };
    resetAdminIpPolicyCache();
  });

  it('AdminIpGuard: 403 con código y la IP del visitante', () => {
    process.env.ADMIN_ALLOWED_IPS = '203.0.113.10';
    const guard = new AdminIpGuard();
    expect(guard.canActivate(ctx('203.0.113.10'))).toBe(true);
    expect(guard.canActivate(ctx('::ffff:203.0.113.10'))).toBe(true);
    try {
      guard.canActivate(ctx('8.8.8.8'));
      throw new Error('debía rechazar');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: ADMIN_IP_ERROR_CODE,
        ip: '8.8.8.8',
      });
    }
  });

  it('en Render sin variable: nadie entra', () => {
    delete process.env.ADMIN_ALLOWED_IPS;
    process.env.RENDER = 'true';
    expect(() => new AdminIpGuard().canActivate(ctx('1.2.3.4'))).toThrow(
      ForbiddenException,
    );
  });

  // La restricción está DESACTIVADA (ver el encabezado de admin-ip.ts): el
  // guard del panel no mira la IP aunque la variable exista. Al reactivarla,
  // esta prueba debe pasar a exigir 403 desde 8.8.8.8.
  it('desactivada: JwtAuthGuard NO revisa la IP', async () => {
    process.env.ADMIN_ALLOWED_IPS = '203.0.113.10';
    process.env.RENDER = 'true';
    const token = await jwt.signAsync({
      sub: 1,
      email: 'a@b.c',
      role: 'ADMIN',
    });
    await expect(
      new JwtAuthGuard(jwt).canActivate(ctx('8.8.8.8', token)),
    ).resolves.toBe(true);
  });
});
