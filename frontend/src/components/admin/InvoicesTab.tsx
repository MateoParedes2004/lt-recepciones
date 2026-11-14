"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Building2, ChevronDown, ChevronUp, Download, FileText, Plus, RefreshCw, Search, Share2, TriangleAlert } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { formatInvoiceNumber, formatThousands, isValidRuc } from "../../lib/invoice";
import { useToast } from "./ToastProvider";
import { useInvoicePdf } from "./useInvoicePdf";
import InvoiceFormModal from "./InvoiceFormModal";
import type { Invoice, InvoiceSettings, InvoiceSettingsView, InvoiceStatus, Product } from "../../types";

const formatPYG = (n: number) => `Gs. ${formatThousands(n)}`;
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// La DNIT permite anular una factura aprobada dentro de las 48 horas (mismo plazo que el backend).
const CANCEL_WINDOW_MS = 48 * 60 * 60 * 1000;
const canCancel = (inv: Invoice) =>
  inv.status === "RECHAZADA" || (inv.status === "APROBADA" && !!inv.approvedAt && Date.now() - new Date(inv.approvedAt).getTime() <= CANCEL_WINDOW_MS);

const STATUS_STYLE: Record<InvoiceStatus, { label: string; className: string }> = {
  APROBADA: { label: "APROBADA", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDIENTE: { label: "PENDIENTE", className: "bg-amber-100 text-amber-800 border-amber-200" },
  RECHAZADA: { label: "RECHAZADA", className: "bg-red-100 text-red-800 border-red-200" },
  ANULADA: { label: "ANULADA", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

// Campos del formulario "Datos del emisor", en el orden en que se muestran.
const ISSUER_FIELDS: { key: keyof InvoiceSettings; label: string; placeholder?: string; full?: boolean; hint?: string }[] = [
  { key: "businessName", label: "Razón social (titular del RUC)" },
  { key: "ruc", label: "RUC", placeholder: "5726203-9" },
  { key: "tradeName", label: "Nombre de fantasía" },
  { key: "slogan", label: "Frase debajo del nombre" },
  { key: "address", label: "Dirección", full: true },
  { key: "city", label: "Ciudad" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo (opcional)" },
  { key: "establishment", label: "Establecimiento", placeholder: "001" },
  { key: "expeditionPoint", label: "Punto de expedición", placeholder: "001" },
  { key: "timbrado", label: "Timbrado electrónico", placeholder: "8 dígitos", hint: "Lo asigna la DNIT al habilitarte como facturador electrónico. No es el del talonario de papel." },
  { key: "timbradoStart", label: "Inicio de vigencia del timbrado" },
];

function InvoiceNumberCell({ inv }: { inv: Invoice }) {
  return (
    <div>
      <p className="font-bold text-slate-900 whitespace-nowrap">{formatInvoiceNumber(inv)}</p>
      <p className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(inv.issuedAt)}</p>
      {inv.environment === "PRUEBA" && <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Prueba</span>}
    </div>
  );
}

function CustomerCell({ inv }: { inv: Invoice }) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-slate-900">{inv.customerName}</p>
      <p className="text-sm text-slate-500">{inv.customerDocument ? `${inv.customerType === "RUC" ? "RUC" : "C.I."} ${inv.customerDocument}` : "Consumidor final"}</p>
      {inv.createdBy?.name && <p className="text-xs text-slate-400 mt-0.5">Emitida por {inv.createdBy.name}</p>}
    </div>
  );
}

function StatusCell({ inv }: { inv: Invoice }) {
  return (
    <div className="text-right sm:text-left">
      <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${STATUS_STYLE[inv.status].className}`}>{STATUS_STYLE[inv.status].label}</span>
      {inv.statusMessage && inv.status !== "APROBADA" && <p className="text-xs text-slate-500 mt-1.5 max-w-56">{inv.statusMessage}</p>}
      {inv.status === "ANULADA" && inv.cancelReason && <p className="text-xs text-slate-500 mt-1.5 max-w-56">Motivo: {inv.cancelReason}</p>}
    </div>
  );
}

export default function InvoicesTab({ products }: { products: Product[] }) {
  const toast = useToast();
  const { busyId, download, share } = useInvoicePdf();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [view, setView] = useState<InvoiceSettingsView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showIssuer, setShowIssuer] = useState(false);
  const [issuerForm, setIssuerForm] = useState<InvoiceSettings | null>(null);
  const [isSavingIssuer, setIsSavingIssuer] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invRes, setRes] = await Promise.all([apiFetch("/invoices"), apiFetch("/invoices/settings")]);
      if (!invRes.ok || !setRes.ok) throw new Error();
      setInvoices(await invRes.json());
      const settingsView: InvoiceSettingsView = await setRes.json();
      setView(settingsView);
      setIssuerForm(settingsView.settings);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial desde el servidor: los setState ocurren después de la respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = normalize(search);
    if (!term) return invoices;
    return invoices.filter((inv) =>
      [inv.customerName, inv.customerDocument ?? "", formatInvoiceNumber(inv)].some((t) => normalize(t).includes(term)),
    );
  }, [invoices, search]);

  // Facturado este mes (solo aprobadas y del ambiente actual, para no mezclar pruebas con reales).
  const monthSummary = useMemo(() => {
    const ym = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Asuncion" }).slice(0, 7);
    const current = ym(new Date().toISOString());
    const env = view?.provider.isTest ? "PRUEBA" : "PRODUCCION";
    const list = invoices.filter((i) => i.status === "APROBADA" && i.environment === env && ym(i.issuedAt) === current);
    return { count: list.length, total: list.reduce((s, i) => s + i.total, 0), iva: list.reduce((s, i) => s + i.iva10 + i.iva5, 0) };
  }, [invoices, view]);

  const replaceInvoice = (updated: Invoice) => setInvoices((list) => list.map((i) => (i.id === updated.id ? updated : i)));

  const retry = async (inv: Invoice) => {
    try {
      const res = await apiFetch(`/invoices/${inv.id}/retry`, { method: "POST" });
      if (!res.ok) { toast.error(`No se pudo reintentar: ${await readApiError(res)}`); return; }
      const updated: Invoice = await res.json();
      replaceInvoice(updated);
      if (updated.status === "APROBADA") toast.success(`Factura ${formatInvoiceNumber(updated)} aprobada.`);
      else toast.error(updated.statusMessage ?? "La factura sigue sin aprobarse.");
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
  };

  const cancel = async (inv: Invoice) => {
    const reason = window.prompt(`¿Por qué se anula la factura ${formatInvoiceNumber(inv)} de ${inv.customerName}? (la DNIT pide un motivo)`);
    if (reason === null) return;
    if (reason.trim().length < 5) { toast.error("Escribí un motivo de al menos 5 caracteres."); return; }
    try {
      const res = await apiFetch(`/invoices/${inv.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) { toast.error(`No se pudo anular: ${await readApiError(res)}`); return; }
      replaceInvoice(await res.json());
      toast.success("Factura anulada. Si era de un alquiler, ya lo podés volver a facturar.");
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
  };

  const saveIssuer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuerForm) return;
    if (!isValidRuc(issuerForm.ruc)) { toast.error("El RUC no es válido: revisá el número y el dígito verificador."); return; }
    setIsSavingIssuer(true);
    try {
      const { businessName, tradeName, slogan, ruc, activities, address, city, phone, email, establishment, expeditionPoint, timbrado, timbradoStart } = issuerForm;
      const res = await apiFetch("/invoices/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, tradeName, slogan, ruc, activities, address, city, phone, email, establishment, expeditionPoint, timbrado, timbradoStart: timbradoStart ? timbradoStart.slice(0, 10) : null }),
      });
      if (!res.ok) { toast.error(`No se pudo guardar: ${await readApiError(res)}`); return; }
      const updated: InvoiceSettingsView = await res.json();
      setView(updated);
      setIssuerForm(updated.settings);
      toast.success("Datos del emisor guardados. Se usan en las facturas que emitas desde ahora.");
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); } finally { setIsSavingIssuer(false); }
  };

  const actionButton = "p-2 rounded-lg cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const renderActions = (inv: Invoice, align: string) => (
    <div className={`flex items-center gap-1 ${align}`}>
      {inv.status === "PENDIENTE" && (
        <button onClick={() => retry(inv)} className="flex items-center text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg cursor-pointer"><RefreshCw className="w-4 h-4 mr-1" /> Reintentar</button>
      )}
      {(inv.status === "APROBADA" || inv.status === "ANULADA") && (
        <>
          <button onClick={() => share(inv)} disabled={busyId === inv.id} aria-label={`Enviar el PDF de la factura ${formatInvoiceNumber(inv)}`} title="Enviar PDF (WhatsApp, correo…)" className={`${actionButton} text-[#004080] hover:bg-[#e8f0f8]`}><Share2 className="w-4 h-4" /></button>
          <button onClick={() => download(inv)} disabled={busyId === inv.id} aria-label={`Descargar el PDF de la factura ${formatInvoiceNumber(inv)}`} title="Descargar PDF" className={`${actionButton} text-slate-500 hover:text-[#004080] hover:bg-[#e8f0f8]`}><Download className="w-4 h-4" /></button>
        </>
      )}
      {canCancel(inv) && (
        <button onClick={() => cancel(inv)} aria-label={`Anular la factura ${formatInvoiceNumber(inv)}`} title="Anular (hasta 48 h después de aprobada)" className={`${actionButton} text-slate-400 hover:text-red-600 hover:bg-red-50`}><Ban className="w-4 h-4" /></button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {view?.provider.isTest && (
        <div role="note" className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 px-5 py-4 rounded-2xl">
          <TriangleAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <p className="text-sm">
            <strong>Modo prueba.</strong> Todavía no hay conexión con la DNIT: las facturas se numeran aparte y el PDF sale marcado
            &quot;SIN VALIDEZ FISCAL&quot;. Sirve para practicar el circuito completo; cuando se conecte con la DNIT empiezan a ser reales.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Facturas aprobadas este mes", value: String(monthSummary.count) },
          { label: "Facturado este mes", value: formatPYG(monthSummary.total) },
          { label: "IVA incluido este mes", value: formatPYG(monthSummary.iva) },
        ].map((card) => (
          <div key={card.label} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{isLoading ? "…" : card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Buscar cliente, RUC o número..." aria-label="Buscar factura" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004080] focus:outline-none w-full sm:w-72 text-slate-900" />
          </div>
          <button onClick={() => setIsFormOpen(true)} disabled={!view} className="flex items-center justify-center bg-[#004080] text-white px-5 py-2.5 rounded-xl hover:bg-[#00294f] transition-colors font-medium shadow-md cursor-pointer disabled:opacity-60">
            <Plus className="w-5 h-5 mr-2" /> Nueva factura
          </button>
        </div>

        {loadFailed && !isLoading ? (
          <div className="p-10 text-center">
            <p className="text-slate-600 mb-3">No se pudieron cargar las facturas.</p>
            <button onClick={load} className="inline-flex items-center gap-2 bg-[#004080] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#00294f] cursor-pointer"><RefreshCw className="w-4 h-4" /> Reintentar</button>
          </div>
        ) : isLoading ? (
          <p className="text-center py-8 text-slate-500">Cargando...</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 px-6 text-slate-500">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            {invoices.length === 0 ? "Todavía no hay facturas. Emití una desde un alquiler (\"Realizar factura\") o con \"Nueva factura\"." : "No hay facturas con esa búsqueda."}
          </div>
        ) : (
          <>
            {/* Celular: tarjetas (una tabla de 5 columnas no entra en 390 px) */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {visible.map((inv) => (
                <li key={inv.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <InvoiceNumberCell inv={inv} />
                    <StatusCell inv={inv} />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <CustomerCell inv={inv} />
                    <p className={`font-bold whitespace-nowrap ${inv.status === "ANULADA" ? "text-slate-400 line-through" : "text-slate-900"}`}>{formatPYG(inv.total)}</p>
                  </div>
                  {renderActions(inv, "justify-start")}
                </li>
              ))}
            </ul>
            {/* Computadora / tablet: tabla */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Factura</th>
                    <th className="px-6 py-4 font-medium">Cliente</th>
                    <th className="px-6 py-4 font-medium">Total</th>
                    <th className="px-6 py-4 font-medium">Estado</th>
                    <th className="px-6 py-4 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4"><InvoiceNumberCell inv={inv} /></td>
                      <td className="px-6 py-4"><CustomerCell inv={inv} /></td>
                      <td className={`px-6 py-4 font-bold whitespace-nowrap ${inv.status === "ANULADA" ? "text-slate-400 line-through" : "text-slate-900"}`}>{formatPYG(inv.total)}</td>
                      <td className="px-6 py-4"><StatusCell inv={inv} /></td>
                      <td className="px-6 py-4">{renderActions(inv, "justify-end")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Datos del emisor: lo que sale impreso en el encabezado de cada factura */}
      {issuerForm && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <button onClick={() => setShowIssuer(!showIssuer)} aria-expanded={showIssuer} className="w-full px-6 py-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50">
            <span className="flex items-center font-bold text-slate-900"><Building2 className="w-5 h-5 mr-2 text-[#004080]" /> Datos del emisor</span>
            <span className="flex items-center gap-2 text-sm text-slate-500">
              {issuerForm.timbrado ? `Timbrado ${issuerForm.timbrado}` : "Sin timbrado electrónico todavía"}
              {showIssuer ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </span>
          </button>
          {showIssuer && (
            <form onSubmit={saveIssuer} className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-4">
              <p className="text-sm text-slate-500">Lo que sale en el encabezado de cada factura. Se precargó con los datos de tu talonario; los cambios valen para las facturas que se emitan desde ahora.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ISSUER_FIELDS.map((f) => (
                  <div key={f.key} className={f.full ? "md:col-span-2" : ""}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                    <input
                      type={f.key === "timbradoStart" ? "date" : "text"}
                      value={f.key === "timbradoStart" ? (issuerForm.timbradoStart ?? "").slice(0, 10) : String(issuerForm[f.key] ?? "")}
                      onChange={(e) => setIssuerForm({ ...issuerForm, [f.key]: e.target.value || (f.key === "timbradoStart" ? null : "") })}
                      placeholder={f.placeholder}
                      className="w-full px-4 py-2 border rounded-xl text-slate-900"
                    />
                    {f.hint && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Actividades económicas <span className="text-slate-400">(una por línea)</span></label>
                  <textarea rows={4} value={issuerForm.activities} onChange={(e) => setIssuerForm({ ...issuerForm, activities: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-slate-900" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={isSavingIssuer} className="px-6 py-2.5 bg-[#004080] text-white font-bold rounded-xl hover:bg-[#00294f] shadow-md cursor-pointer disabled:opacity-60">
                  {isSavingIssuer ? "Guardando..." : "Guardar datos del emisor"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isFormOpen && <InvoiceFormModal products={products} onClose={() => setIsFormOpen(false)} onIssued={load} />}
    </div>
  );
}
