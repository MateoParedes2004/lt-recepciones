"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, Bell, Plus, Package, ClipboardList } from "lucide-react";
import type { Product, Rental } from "../../types";
import type { PanelAlert } from "../../lib/admin-metrics";
import { formatGs, dayOf, shortDate } from "../../lib/admin-metrics";

/** Sin tildes ni mayúsculas, para buscar "jose" y encontrar "José". */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const PHASE_LABEL: Record<string, string> = {
  PRESUPUESTO: "Presupuesto", RESERVADO: "Reservado", EN_USO: "En uso", ATRASADO: "Atrasado", DEVUELTO: "Devuelto", CANCELADO: "Anulado",
};

export type SearchPick = { kind: "rental"; term: string } | { kind: "product"; term: string };

function GlobalSearch({ rentals, products, onPick }: { rentals: Rental[]; products: Product[]; onPick: (p: SearchPick) => void }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const q = norm(term);
  const digits = term.replace(/\D/g, "");
  const results = useMemo(() => {
    if (q.length < 2) return { rentals: [] as Rental[], products: [] as Product[] };
    const r = rentals
      .filter((x) => norm(x.clientName).includes(q) || (digits.length >= 3 && (x.clientPhone ?? "").replace(/\D/g, "").includes(digits)))
      .sort((a, b) => dayOf(b.eventDate) - dayOf(a.eventDate))
      .slice(0, 6);
    const p = products.filter((x) => !x.isArchived && norm(x.name).includes(q)).slice(0, 4);
    return { rentals: r, products: p };
  }, [q, digits, rentals, products]);

  // Clic afuera cierra la lista.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (p: SearchPick) => { setOpen(false); setTerm(""); onPick(p); };
  const empty = q.length >= 2 && results.rentals.length === 0 && results.products.length === 0;

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0 sm:max-w-md">
      <label className="flex items-center gap-2.5 min-h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-slate-500 focus-within:ring-2 focus-within:ring-[#004080]/25 focus-within:border-[#004080]">
        <Search className="w-4.5 h-4.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="sr-only">Buscar en el panel</span>
        <input
          type="search"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder="Buscar cliente, teléfono o producto"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && q.length >= 2}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500"
        />
      </label>
      {open && q.length >= 2 && (
        <div id={listId} className="absolute z-40 mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          {empty && <p className="px-4 py-5 text-sm text-slate-500 text-center">Nada coincide con “{term.trim()}”.</p>}
          {results.rentals.length > 0 && (
            <div className="py-1.5">
              <p className="px-4 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Alquileres</p>
              {results.rentals.map((r) => (
                <button key={r.id} type="button" onClick={() => pick({ kind: "rental", term: r.clientName })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 focus:bg-slate-50 outline-none cursor-pointer">
                  <ClipboardList className="w-4.5 h-4.5 text-[#004080] shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900 truncate">{r.clientName}</span>
                    <span className="block text-xs text-slate-500">{shortDate(dayOf(r.eventDate))} · {PHASE_LABEL[r.phase ?? r.status] ?? r.status}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-700 tabular-nums">{formatGs(Number(r.totalPrice) || 0)}</span>
                </button>
              ))}
            </div>
          )}
          {results.products.length > 0 && (
            <div className="py-1.5 border-t border-slate-100">
              <p className="px-4 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Productos</p>
              {results.products.map((p) => (
                <button key={p.id} type="button" onClick={() => pick({ kind: "product", term: p.name })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 focus:bg-slate-50 outline-none cursor-pointer">
                  <Package className="w-4.5 h-4.5 text-[#004080] shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{p.name}</span>
                  <span className="text-xs text-slate-500 tabular-nums">{p.availableStock ?? p.totalStock} libres hoy</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TONE: Record<PanelAlert["tone"], { bg: string; dot: string }> = {
  rojo: { bg: "bg-[#fdecea]", dot: "bg-[#b42318]" },
  ambar: { bg: "bg-[#fef3c7]", dot: "bg-[#b45309]" },
  azul: { bg: "bg-[#e8f0f8]", dot: "bg-[#004080]" },
};

export function AlertRow({ alert, onClick }: { alert: PanelAlert; onClick: () => void }) {
  const t = TONE[alert.tone];
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-start gap-3 min-h-11 px-3.5 py-3 rounded-2xl text-left ${t.bg} hover:brightness-[0.97] cursor-pointer`}>
      <span className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 ${t.dot}`} aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-900">{alert.title}</span>
        <span className="block text-xs text-slate-600 mt-0.5">{alert.detail}</span>
      </span>
    </button>
  );
}

function NotificationsBell({ alerts, onOpenAlert }: { alerts: PanelAlert[]; onOpenAlert: (a: PanelAlert) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={alerts.length ? `Avisos: ${alerts.length} para resolver` : "Avisos: nada para resolver"}
        className="relative w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center hover:bg-slate-50 cursor-pointer"
      >
        <Bell className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
        {alerts.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#b42318] border-2 border-white" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-2xl border border-slate-200 shadow-xl p-3">
          <p className="px-1 pb-2 text-sm font-black text-slate-900">Para resolver</p>
          {alerts.length === 0 ? (
            <p className="px-1 py-4 text-sm text-slate-500">Todo en orden: no hay nada pendiente.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {alerts.map((a) => <AlertRow key={a.id} alert={a} onClick={() => { setOpen(false); onOpenAlert(a); }} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Cabecera de cada sección del panel: título, buscador, avisos y "Nuevo alquiler". */
export default function AdminHeader({
  title, subtitle, rentals, products, alerts, onSearchPick, onOpenAlert, onNewRental,
}: {
  title: string;
  subtitle?: string;
  rentals: Rental[];
  products: Product[];
  alerts: PanelAlert[];
  onSearchPick: (p: SearchPick) => void;
  onOpenAlert: (a: PanelAlert) => void;
  onNewRental: () => void;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center">
      <div className="flex-1 min-w-0">
        <h1 className="text-[28px] sm:text-3xl font-bold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2.5 xl:w-auto xl:min-w-136 xl:justify-end">
        <GlobalSearch rentals={rentals} products={products} onPick={onSearchPick} />
        <NotificationsBell alerts={alerts} onOpenAlert={onOpenAlert} />
        <button
          type="button"
          onClick={onNewRental}
          className="shrink-0 inline-flex items-center gap-2 min-h-11 px-3.5 sm:px-4.5 rounded-xl bg-linear-to-br from-[#0d4a8a] to-[#00294f] text-white text-sm font-bold shadow-[0_6px_16px_rgba(0,64,128,0.22)] hover:brightness-110 cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">Nuevo alquiler</span>
          <span className="sr-only sm:hidden">Nuevo alquiler</span>
        </button>
      </div>
    </header>
  );
}
