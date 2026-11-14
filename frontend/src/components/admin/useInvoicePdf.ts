"use client";

import { useState } from "react";
import { downloadBlob, formatInvoiceNumber, sharePdf } from "../../lib/invoice";
import { useToast } from "./ToastProvider";
import type { Invoice } from "../../types";

/**
 * Descargar o enviar el PDF de una factura. La librería de PDF se carga recién
 * acá (import dinámico), así no pesa en el resto del panel. busyId = factura
 * cuyo PDF se está armando, para deshabilitar sus botones mientras tanto.
 */
export function useInvoicePdf() {
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);

  const build = async (invoice: Invoice) => {
    const { invoicePdf, invoiceFileName } = await import("../../lib/invoice-pdf");
    return { blob: await invoicePdf(invoice), fileName: invoiceFileName(invoice) };
  };

  const run = async (invoice: Invoice, action: (blob: Blob, fileName: string) => Promise<void>) => {
    setBusyId(invoice.id);
    try {
      const { blob, fileName } = await build(invoice);
      await action(blob, fileName);
    } catch {
      toast.error("No se pudo generar el PDF. Probá de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  const download = (invoice: Invoice) => run(invoice, async (blob, fileName) => downloadBlob(blob, fileName));

  const share = (invoice: Invoice) =>
    run(invoice, async (blob, fileName) => {
      const result = await sharePdf(blob, fileName, `Factura ${formatInvoiceNumber(invoice)} de ${invoice.issuer.tradeName}`);
      if (result === "downloaded") toast.info("El PDF se descargó: adjuntalo en WhatsApp o en el correo.");
    });

  return { busyId, download, share };
}
