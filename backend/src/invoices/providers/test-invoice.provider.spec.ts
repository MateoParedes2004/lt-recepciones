import { mod11CheckDigit } from '../fiscal';
import { buildCdc } from './test-invoice.provider';

describe('buildCdc', () => {
  it('arma 44 dígitos con la estructura del SIFEN y un dígito verificador válido', () => {
    // 23:30 del 5/11/2026 en Paraguay = 03:30 UTC del 6/11: la fecha del CDC debe ser la de Paraguay.
    const issuedAt = new Date('2026-11-06T03:30:00Z');
    const cdc = buildCdc(
      { establishment: '001', expeditionPoint: '001', number: 120, issuedAt },
      '5726203-9',
    );
    expect(cdc).toMatch(/^\d{44}$/);
    expect(cdc.slice(0, 2)).toBe('01');
    expect(cdc.slice(2, 11)).toBe('057262039');
    expect(cdc.slice(11, 24)).toBe('0010010000120');
    expect(cdc.slice(25, 33)).toBe('20261105');
    expect(Number(cdc[43])).toBe(mod11CheckDigit(cdc.slice(0, 43)));
  });
});
