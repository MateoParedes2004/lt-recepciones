import { poolConfigFor } from './database-ssl';

const PEM = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';
const URL_ =
  'postgres://avnadmin:pass@host.example.com:17261/defaultdb?sslmode=require';

describe('poolConfigFor', () => {
  it('sin certificado deja la URL tal cual (comportamiento de siempre)', () => {
    expect(poolConfigFor(URL_, undefined)).toEqual({ connectionString: URL_ });
    expect(poolConfigFor(URL_, '   ')).toEqual({ connectionString: URL_ });
  });

  it('con certificado quita sslmode de la URL y verifica contra ese certificado', () => {
    const cfg = poolConfigFor(URL_, PEM);
    expect(cfg.connectionString).toBe(
      'postgres://avnadmin:pass@host.example.com:17261/defaultdb',
    );
    expect(cfg.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it('conserva los demás parámetros de la URL', () => {
    const cfg = poolConfigFor(
      'postgres://u:p@h:1/db?sslmode=require&application_name=lt&connect_timeout=10',
      PEM,
    );
    expect(cfg.connectionString).toBe(
      'postgres://u:p@h:1/db?application_name=lt&connect_timeout=10',
    );
  });

  it('acepta el certificado con "\\n" escrito literal (paneles que aplastan los saltos de línea)', () => {
    const flat = PEM.replace(/\n/g, '\\n');
    expect(poolConfigFor(URL_, flat).ssl).toEqual({
      ca: PEM,
      rejectUnauthorized: true,
    });
  });

  it('no rompe si falta DATABASE_URL', () => {
    expect(poolConfigFor(undefined, PEM)).toEqual({
      connectionString: undefined,
    });
  });
});
