import { randomInt } from 'crypto';
import type { Invoice } from '@prisma/client';
import { utcToParaguayDate } from '../../common/timezone';
import { mod11CheckDigit } from '../fiscal';
import { EmitResult, InvoiceProvider } from './invoice-provider';

/**
 * Arma un CDC (código de control de 44 dígitos) con la misma estructura que
 * el SIFEN: tipo de documento, RUC, establecimiento, número, fecha, código de
 * seguridad y dígito verificador. En producción el CDC lo arma el proveedor
 * real; acá sirve para que las facturas de prueba se vean como las reales.
 */
export function buildCdc(
  invoice: Pick<
    Invoice,
    'establishment' | 'expeditionPoint' | 'number' | 'issuedAt'
  >,
  ruc: string,
): string {
  const [base, dv] = ruc.split('-');
  // Fecha de emisión en hora de Paraguay (el servidor corre en UTC).
  const { year, month, day } = utcToParaguayDate(invoice.issuedAt);
  const date = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  const body =
    '01' + // 01 = factura electrónica
    base.padStart(8, '0') +
    dv +
    invoice.establishment +
    invoice.expeditionPoint +
    String(invoice.number).padStart(7, '0') +
    '1' + // 1 = persona física
    date +
    '1' + // 1 = emisión normal
    String(randomInt(0, 1_000_000_000)).padStart(9, '0');
  return body + mod11CheckDigit(body);
}

/** Aprueba todo al instante, sin conectarse a nada. Las facturas quedan marcadas como PRUEBA. */
export class TestInvoiceProvider implements InvoiceProvider {
  readonly isTest = true;
  readonly label = 'Modo prueba (sin conexión con la DNIT)';

  emit(invoice: Invoice): Promise<EmitResult> {
    const ruc = (invoice.issuer as { ruc: string }).ruc;
    const cdc = buildCdc(invoice, ruc);
    return Promise.resolve({
      status: 'APROBADA',
      cdc,
      qrUrl: `DOCUMENTO DE PRUEBA SIN VALIDEZ FISCAL - CDC ${cdc}`,
    });
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }
}
