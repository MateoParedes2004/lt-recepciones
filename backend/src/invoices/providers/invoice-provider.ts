import type { Invoice, InvoiceItem } from '@prisma/client';

/**
 * Quien firma la factura y la envía a la DNIT (SIFEN). Hoy existe solo el de
 * prueba; cuando se elija el proveedor real (Neosystem, BillPy, etc.) se
 * agrega otra clase que implemente esta interfaz y se activa con la variable
 * de entorno INVOICE_PROVIDER, sin tocar el resto del sistema.
 *
 * IMPORTANTE para el proveedor real: `emit` y `cancel` se pueden llamar DOS
 * VECES para la misma factura (un reintento tras un corte de red, o dos
 * clics simultáneos). Tienen que ser idempotentes: usar (timbrado,
 * establecimiento, punto, número) como clave para que el segundo intento
 * devuelva el mismo resultado en vez de emitir o cancelar otra vez. Además, los
 * montos que devuelva la DNIT son los oficiales: si difieren por redondeo de
 * los calculados acá (IVA por renglón vs. sobre el total), hay que guardar
 * los del proveedor y usarlos en el PDF.
 */
export interface InvoiceProvider {
  /** true = las facturas NO tienen validez fiscal (se guardan como ambiente PRUEBA). */
  readonly isTest: boolean;
  readonly label: string;

  /**
   * Envía la factura. Si la DNIT responde, devuelve el resultado (aprobada o
   * rechazada con su motivo). Si no se pudo comunicar, lanza un error: la
   * factura queda PENDIENTE para reintentarla.
   */
  emit(invoice: Invoice & { items: InvoiceItem[] }): Promise<EmitResult>;

  /** Evento de cancelación ante la DNIT. Lanza un error si no se pudo. */
  cancel(invoice: Invoice, reason: string): Promise<void>;
}

export type EmitResult =
  | { status: 'APROBADA'; cdc: string; qrUrl: string }
  | { status: 'RECHAZADA'; message: string };

export const INVOICE_PROVIDER = Symbol('INVOICE_PROVIDER');
