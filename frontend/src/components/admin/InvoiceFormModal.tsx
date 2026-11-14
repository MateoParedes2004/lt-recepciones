"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Download, PlusCircle, Receipt, Share2, Trash2, TriangleAlert, X } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { computeTotals, formatInvoiceNumber, formatThousands, isValidRuc, linesFromRental, MAX_INVOICE_TOTAL, numberToSpanishWords, toPrintable } from "../../lib/invoice";
import { useToast } from "./ToastProvider";
import { useInvoicePdf } from "./useInvoicePdf";
import ProductCombobox from "./ProductCombobox";
import type { CustomerType, Invoice, IvaRate, Product, Rental } from "../../types";

const formatPYG = (n: number) => `Gs. ${formatThousands(n)}`;

// Los <input> entregan texto mientras se editan.
interface FormLine { description: string; quantity: number | string; unitPrice: number | string; ivaRate: IvaRate; productId: number | null }
const EMPTY_LINE: FormLine = { description: "", quantity: 1, unitPrice: "", ivaRate: 10, productId: null };

const CUSTOMER_TYPES: { key: CustomerType; label: string }[] = [
  { key: "RUC", label: "Con RUC" },
  { key: "CI", label: "Con cédula" },
  { key: "SIN_NOMBRE", label: "Sin nombre" },
];

/**
 * Emite una factura. Si viene de un alquiler, se precarga con sus productos,
 * precios y envío (como "Transporte"); todo se puede corregir antes de emitir.
 */
export default function InvoiceFormModal({ rental, products, onClose, onIssued }: {
  rental?: Rental | null;
  products: Product[];
  onClose: () => void;
  onIssued: () => void;
}) {
  const toast = useToast();
  const { busyId, download, share } = useInvoicePdf();
  const [customerType, setCustomerType] = useState<CustomerType>("RUC");
  const [docNumber, setDocNumber] = useState("");
  const [name, setName] = useState(rental?.clientName ?? "");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(rental?.clientPhone ?? "");
  const [email, setEmail] = useState("");
  const [condition, setCondition] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [lines, setLines] = useState<FormLine[]>(() => (rental ? linesFromRental(rental).map((l) => ({ ...l, productId: l.productId ?? null })) : [EMPTY_LINE]));
  const [isSaving, setIsSaving] = useState(false);
  const [issued, setIssued] = useState<Invoice | null>(null);

  const parsed = lines.map((l) => ({ ...l, quantity: Number(l.quantity) || 0, unitPrice: Math.round(Number(l.unitPrice) || 0) }));
  const totals = computeTotals(parsed);
  const rucInvalid = customerType === "RUC" && docNumber.trim() !== "" && !isValidRuc(docNumber);

  const updateLine = (index: number, patch: Partial<FormLine>) => setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const addProduct = (id: string) => {
    const product = products.find((p) => p.id === Number(id));
    if (!product) return;
    const newLine: FormLine = { description: product.name, quantity: 1, unitPrice: Math.round(product.pricePerDay), ivaRate: 10, productId: product.id };
    // Si solo hay un renglón vacío, lo reemplaza en vez de dejarlo colgando.
    setLines(lines.length === 1 && !lines[0].description.trim() ? [newLine] : [...lines, newLine]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Emojis y símbolos raros no se pueden imprimir en el PDF (saldrían como basura): se limpian
    // y se muestra qué se quitó, SIN emitir todavía, para que se revise el resultado.
    const cleanName = toPrintable(name), cleanAddress = toPrintable(address), cleanLines = lines.map((l) => toPrintable(l.description));
    const removed = [...new Set([...cleanName.changed, ...cleanAddress.changed, ...cleanLines.flatMap((c) => c.changed)])];
    if (removed.length > 0) {
      setName(cleanName.text);
      setAddress(cleanAddress.text);
      setLines(lines.map((l, i) => ({ ...l, description: cleanLines[i].text })));
      toast.error(`Se quitaron o reemplazaron caracteres que no se pueden imprimir en la factura (${removed.join(" ")}). Revisá los datos y emití de nuevo.`);
      return;
    }
    if (rucInvalid) { toast.error("El RUC no es válido: revisá el número y el dígito verificador (ej. 80038950-6)."); return; }
    if (lines.some((l) => !l.description.trim())) { toast.error("Cada renglón necesita una descripción."); return; }
    if (lines.some((l) => !Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1)) { toast.error("La cantidad de cada renglón tiene que ser un número entero de al menos 1."); return; }
    // Los precios van en guaraníes enteros: se avisa en vez de redondear en silencio.
    if (lines.some((l) => !Number.isInteger(Number(l.unitPrice)) || Number(l.unitPrice) < 0)) { toast.error("Los precios van en guaraníes enteros, sin decimales ni negativos."); return; }
    if (totals.total <= 0) { toast.error("El total de la factura tiene que ser mayor a Gs. 0."); return; }
    if (totals.total > MAX_INVOICE_TOTAL) { toast.error(`El total (${formatPYG(totals.total)}) supera Gs. 2.000.000.000: revisá las cantidades y los precios (¿ceros de más?).`); return; }
    if (!window.confirm(`¿Emitir la factura por ${formatPYG(totals.total)} a nombre de ${customerType === "SIN_NOMBRE" ? "Sin Nombre" : name}? Una vez emitida no se puede editar (solo anular dentro de las 48 h).`)) return;

    setIsSaving(true);
    try {
      const res = await apiFetch("/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rentalId: rental?.id,
          condition,
          customerType,
          customerDocument: customerType === "SIN_NOMBRE" ? undefined : docNumber.trim(),
          customerName: customerType === "SIN_NOMBRE" ? "Sin Nombre" : name.trim(),
          customerAddress: address.trim() || undefined,
          customerPhone: phone.trim() || undefined,
          customerEmail: email.trim() || undefined,
          items: parsed.map((l) => ({ description: l.description.trim(), quantity: l.quantity, unitPrice: l.unitPrice, ivaRate: l.ivaRate, productId: l.productId ?? undefined })),
        }),
      });
      if (!res.ok) { toast.error(`No se pudo emitir la factura: ${await readApiError(res)}`); return; }
      const invoice: Invoice = await res.json();
      setIssued(invoice);
      onIssued();
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border rounded-xl text-slate-900";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <h3 className="text-xl font-bold text-slate-900 flex items-center">
            <Receipt className="w-6 h-6 mr-2 text-[#004080]" /> {issued ? "Factura emitida" : rental ? `Facturar alquiler de ${rental.clientName}` : "Nueva factura"}
          </h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
        </div>

        {issued ? (
          <div className="p-6 space-y-5 overflow-y-auto">
            {issued.status === "APROBADA" ? (
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-4 rounded-2xl">
                <CheckCircle className="w-6 h-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-bold">Factura {formatInvoiceNumber(issued)} aprobada por {formatPYG(issued.total)}.</p>
                  {issued.environment === "PRUEBA" && <p className="text-sm mt-1">Es de prueba: el PDF sale marcado &quot;SIN VALIDEZ FISCAL&quot;.</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 px-5 py-4 rounded-2xl">
                <TriangleAlert className="w-6 h-6 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">Factura {formatInvoiceNumber(issued)}: {issued.status === "RECHAZADA" ? "rechazada por la DNIT" : "pendiente"}.</p>
                  {issued.statusMessage && <p className="text-sm mt-1">{issued.statusMessage}</p>}
                  <p className="text-sm mt-1">La podés ver y reintentar desde la pestaña Factura Electrónica.</p>
                </div>
              </div>
            )}
            {issued.status === "APROBADA" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => share(issued)} disabled={busyId === issued.id} className="flex-1 flex items-center justify-center gap-2 bg-[#004080] text-white font-bold px-5 py-3 rounded-xl hover:bg-[#00294f] cursor-pointer disabled:opacity-60">
                  <Share2 className="w-5 h-5" /> Enviar PDF (WhatsApp, correo…)
                </button>
                <button onClick={() => download(issued)} disabled={busyId === issued.id} className="flex-1 flex items-center justify-center gap-2 bg-[#e8f0f8] text-[#004080] font-bold px-5 py-3 rounded-xl hover:bg-[#d3e3f2] cursor-pointer disabled:opacity-60">
                  <Download className="w-5 h-5" /> Descargar PDF
                </button>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl cursor-pointer">Listo</button>
            </div>
          </div>
        ) : (
          <>
            <form id="invoiceForm" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">1. Cliente</h4>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Cómo se identifica el cliente">
                  {CUSTOMER_TYPES.map((t) => (
                    <button
                      key={t.key} type="button" onClick={() => setCustomerType(t.key)} aria-pressed={customerType === t.key}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border cursor-pointer ${customerType === t.key ? "bg-[#004080] text-white border-[#004080]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {customerType === "SIN_NOMBRE" ? (
                  <p className="text-sm text-slate-600">Sale a nombre de &quot;Sin Nombre&quot; (consumidor final). Si el cliente necesita la factura para su contador, pedile su RUC.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{customerType === "RUC" ? "RUC (con dígito verificador)" : "Número de cédula"}</label>
                      <input
                        type="text" required inputMode={customerType === "CI" ? "numeric" : "text"} value={docNumber} onChange={(e) => setDocNumber(e.target.value)}
                        placeholder={customerType === "RUC" ? "Ej. 80038950-6" : "Ej. 4567890"}
                        className={`${inputClass} ${rucInvalid ? "border-red-300 bg-red-50" : ""}`}
                      />
                      {rucInvalid && <p className="mt-1 text-xs font-medium text-red-600">El dígito verificador no coincide: revisá el número.</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{customerType === "RUC" ? "Nombre o razón social" : "Nombre completo"}</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ej. Rotary Club de Asunción" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3"><label className="block text-sm font-medium text-slate-700 mb-1">Dirección <span className="text-slate-400">(opcional)</span></label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Teléfono <span className="text-slate-400">(opcional)</span></label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Correo <span className="text-slate-400">(opcional)</span></label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-700">
                  <span className="font-medium">Condición de venta:</span>
                  {(["CONTADO", "CREDITO"] as const).map((c) => (
                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="condition" checked={condition === c} onChange={() => setCondition(c)} /> {c === "CONTADO" ? "Contado" : "Crédito"}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">2. Detalle</h4>
                  <button type="button" onClick={() => setLines([...lines, EMPTY_LINE])} className="text-sm font-bold text-[#004080] hover:text-[#00294f] flex items-center bg-[#e8f0f8] px-3 py-1 rounded-lg cursor-pointer"><PlusCircle className="w-4 h-4 mr-1" /> Añadir renglón</button>
                </div>
                <div className="mb-3">
                  <ProductCombobox
                    value="" onChange={addProduct} placeholder="Agregar un producto del catálogo..."
                    options={products.map((p) => ({ id: p.id, searchText: p.name, label: p.name, meta: formatPYG(p.pricePerDay), disabled: false }))}
                  />
                </div>
                <div className="space-y-3">
                  {lines.map((line, index) => (
                    <div key={index} className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="text" required maxLength={150} placeholder="Descripción" aria-label="Descripción" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} className="flex-1 min-w-40 px-3 py-2 border rounded-lg text-sm text-slate-900" />
                        <input type="number" required min="1" step="1" placeholder="Cant." aria-label="Cantidad" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="w-20 px-3 py-2 border rounded-lg text-sm text-center font-bold text-slate-900" />
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">Gs.</span>
                          <input type="number" required min="0" step="1" placeholder="Precio" aria-label="Precio unitario con IVA" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} className="w-full pl-8 pr-2 py-2 border rounded-lg text-sm text-right font-bold text-slate-900" />
                        </div>
                        <select aria-label="Tasa de IVA" value={line.ivaRate} onChange={(e) => updateLine(index, { ivaRate: Number(e.target.value) as IvaRate })} className="px-2 py-2 border rounded-lg text-sm bg-white text-slate-900">
                          <option value={10}>IVA 10 %</option>
                          <option value={5}>IVA 5 %</option>
                          <option value={0}>Exenta</option>
                        </select>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))} aria-label="Quitar este renglón" title="Quitar este renglón" className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 className="w-5 h-5" /></button>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">Subtotal: <span className="font-bold text-[#004080]">{formatPYG(parsed[index].quantity * parsed[index].unitPrice)}</span></p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#e8f0f8] p-4 rounded-2xl border border-[#004080]/15 space-y-1">
                <p className="text-xs text-slate-500 mb-1">Precios con IVA incluido, como en el talonario.</p>
                {totals.exempt > 0 && <div className="flex justify-between text-sm text-slate-600"><span>Exentas</span><span>{formatPYG(totals.exempt)}</span></div>}
                {totals.iva5 > 0 && <div className="flex justify-between text-sm text-slate-600"><span>IVA 5 % incluido</span><span>{formatPYG(totals.iva5)}</span></div>}
                <div className="flex justify-between text-sm text-slate-600"><span>IVA 10 % incluido</span><span>{formatPYG(totals.iva10)}</span></div>
                <div className="flex justify-between text-base font-bold text-[#004080] pt-1 border-t border-[#004080]/15"><span>Total a pagar</span><span>{formatPYG(totals.total)}</span></div>
                {totals.total > 0 && totals.total <= MAX_INVOICE_TOTAL && <p className="text-xs text-slate-500 text-right">{numberToSpanishWords(totals.total)} guaraníes</p>}
              </div>
            </form>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/80">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl cursor-pointer">Cancelar</button>
              <button type="submit" form="invoiceForm" disabled={isSaving} className="px-6 py-2.5 bg-[#004080] text-white font-bold rounded-xl hover:bg-[#00294f] shadow-md flex items-center cursor-pointer disabled:opacity-60">
                {isSaving ? "Emitiendo..." : "Emitir factura"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
