"use client";

import { useEffect, useState } from "react";
import { TrendingUp, CalendarDays, MessageCircle, CircleCheck, ArrowRight, Loader2, Pencil, ClipboardList } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import {
  MONTHS, bestMonthOfYear, cumulativeByDay, daysInMonth, formatGs, formatGsShort, futureBooked,
  incomeVsLastMonth, isoOfDay, itemsSummary, oldestPending, mondayOf, monthIncome, occupancyByDay, paraguayTodayIdx, prevMonth, shortDate,
  stopsForDay, timeAgo, topUsedInMonth, unitsOutByDay, ymOfDay, type AgendaStop, type PanelAlert,
} from "../../lib/admin-metrics";
import type { CheckoutIntent, DispatchPlan, PlanStop, Product, Rental } from "../../types";
import { AlertRow } from "./AdminHeader";
import { useToast } from "./ToastProvider";

interface HomeSummary {
  cierre: { dias: number; pedidos: number; confirmados: number; anterior: { pedidos: number; confirmados: number } };
  metaMensual: number | null;
}

const CARD = "bg-white border border-slate-200 rounded-[20px] p-5 sm:p-6";
const H2 = "text-lg font-bold text-slate-900";

function KpiCard({ label, value, note, icon: Icon, highlight = false }: {
  label: string; value: string; note: React.ReactNode; icon: React.ElementType; highlight?: boolean;
}) {
  return (
    <div className={`rounded-[20px] p-5 flex flex-col gap-2.5 border ${highlight ? "bg-[#e8f0f8] border-[#c9dbee]" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[13px] font-bold ${highlight ? "text-[#004080]" : "text-slate-600"}`}>{label}</span>
        <span className={`w-9 h-9 rounded-[10px] inline-flex items-center justify-center ${highlight ? "bg-[#004080] text-white" : "bg-[#e8f0f8] text-[#004080]"}`}>
          <Icon className="w-4.5 h-4.5" strokeWidth={1.5} aria-hidden="true" />
        </span>
      </div>
      <span className="text-[26px] leading-tight font-black text-slate-900 tabular-nums">{value}</span>
      <span className="text-xs text-slate-600">{note}</span>
    </div>
  );
}

function Delta({ pct, suffix = "%" }: { pct: number | null; suffix?: string }) {
  if (pct === null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return (
    <b className={up ? "text-[#0f7a4d]" : "text-[#b42318]"}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(pct))}{suffix}
    </b>
  );
}

const STOP_CHIP: Record<AgendaStop["kind"], string> = {
  ENTREGA: "bg-[#e8f0f8] text-[#004080]",
  RETIRO: "bg-[#fef3c7] text-[#92400e]",
};

/** Estado de la parada según la ruta guardada (si la hay). */
function stopStatus(stop: AgendaStop, planStop: PlanStop | undefined, hasPlan: boolean): { label: string; cls: string } {
  if (planStop?.completedAt) return { label: stop.kind === "ENTREGA" ? "Entregado" : "Retirado", cls: "bg-[#e7f6ee] text-[#0f7a4d]" };
  if (planStop?.arrivedAt) return { label: "En el lugar", cls: "bg-[#004080] text-white" };
  if (planStop) return { label: `Llega ≈ ${planStop.arrive}`, cls: "bg-slate-100 text-slate-700" };
  if (hasPlan) return { label: "Fuera de la ruta", cls: "bg-[#fef3c7] text-[#92400e]" };
  return { label: "Sin ruta", cls: "bg-slate-100 text-slate-600" };
}

function Gauge({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(1, pct / 100));
  const ang = Math.PI * (1 - p);
  const x = (100 + 80 * Math.cos(ang)).toFixed(1);
  const y = (100 - 80 * Math.sin(ang)).toFixed(1);
  return (
    <svg viewBox="0 0 200 116" className="w-full max-w-70 self-center" role="img" aria-label={`${Math.round(pct)}% de la meta alcanzado`}>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#e8f0f8" strokeWidth="16" strokeLinecap="round" />
      {p > 0 && <path d={`M20 100 A80 80 0 0 1 ${x} ${y}`} fill="none" stroke={pct >= 100 ? "#0f7a4d" : "#004080"} strokeWidth="16" strokeLinecap="round" />}
      <text x="100" y="88" textAnchor="middle" className="fill-slate-900" style={{ font: "900 30px var(--font-lato), sans-serif" }}>{Math.round(pct)}%</text>
    </svg>
  );
}

function occColor(pct: number): { bg: string; fg: string } {
  if (pct >= 90) return { bg: "#00294f", fg: "#ffffff" };
  if (pct >= 70) return { bg: "#3b78c0", fg: "#ffffff" };
  if (pct >= 40) return { bg: "#9cc0e6", fg: "#0f172a" };
  return { bg: "#e8f0f8", fg: "#0f172a" };
}

const WEEK_HEAD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const GRID_DAYS = 35;

export default function HomeTab({
  rentals, products, pendingOrders, alerts, isLoadingData, now, onOpenAlert, onOpenRoutes, ownerView,
}: {
  rentals: Rental[];
  products: Product[];
  pendingOrders: CheckoutIntent[];
  alerts: PanelAlert[];
  isLoadingData: boolean;
  /** El "ahora" del panel (se renueva con cada recarga): Inicio y los avisos miran el mismo día. */
  now: number;
  onOpenAlert: (a: PanelAlert) => void;
  onOpenRoutes: (dateIso: string) => void;
  /**
   * true = dueño (todo). false = Vendedor: sin ingresos, metas, tasa de cierre
   * ni rutas (el servidor tampoco se los da); sí la agenda, la ocupación y lo pendiente.
   */
  ownerView: boolean;
}) {
  const toast = useToast();
  // Sin useMemo a mano: el React Compiler del proyecto ya memoriza estos cálculos.
  const today = paraguayTodayIdx(now);
  const { year, month } = ymOfDay(today);

  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [plans, setPlans] = useState<Record<string, DispatchPlan | null>>({});
  const [agendaDay, setAgendaDay] = useState<"hoy" | "manana">("hoy");
  const [occProduct, setOccProduct] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    // El Vendedor no tiene acceso a estos datos (ingresos y rutas): ni se piden.
    if (!ownerView) return;
    const controller = new AbortController();
    apiFetch("/analytics/inicio", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setSummary(await res.json());
      })
      .catch(() => { if (!controller.signal.aborted) setSummaryError(true); });
    // Rutas guardadas de hoy y mañana: dan el estado de cada parada.
    for (const day of [today, today + 1]) {
      const iso = isoOfDay(day);
      apiFetch(`/routing/runs/${iso}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          setPlans((p) => ({ ...p, [iso]: data && Array.isArray(data.routes) ? (data as DispatchPlan) : null }));
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [today, ownerView]);

  // ---- Indicadores ----
  const income = incomeVsLastMonth(rentals, today);
  const booked = futureBooked(rentals, today);
  const oldestOrder = oldestPending(pendingOrders);
  const closeRate = summary && summary.cierre.pedidos > 0 ? (summary.cierre.confirmados / summary.cierre.pedidos) * 100 : null;
  const prevCloseRate = summary && summary.cierre.anterior.pedidos > 0 ? (summary.cierre.anterior.confirmados / summary.cierre.anterior.pedidos) * 100 : null;

  // ---- Agenda ----
  const agendaIdx = agendaDay === "hoy" ? today : today + 1;
  const agendaIso = isoOfDay(agendaIdx);
  const stopsToday = stopsForDay(rentals, today);
  const stopsTomorrow = stopsForDay(rentals, today + 1);
  const stops = agendaDay === "hoy" ? stopsToday : stopsTomorrow;
  const plan = plans[agendaIso] ?? null;
  const planStops = new Map<string, PlanStop>();
  for (const r of plan?.routes ?? []) for (const s of r.stops) planStops.set(`${s.kind}-${s.rentalId}`, s);

  // ---- Meta del mes ----
  const goal = summary?.metaMensual ?? null;
  const goalPct = goal ? (income.current / goal) * 100 : 0;
  const pm = prevMonth(year, month);
  const lastMonthTotal = monthIncome(rentals, pm.year, pm.month);
  const best = bestMonthOfYear(rentals, year);
  const daysLeft = daysInMonth(year, month) - ymOfDay(today).date;

  const saveGoal = async (monto: number | null) => {
    setSavingGoal(true);
    try {
      const res = await apiFetch("/analytics/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "No se pudo guardar la meta."));
      const data = await res.json();
      setSummary((s) => (s ? { ...s, metaMensual: data.metaMensual } : s));
      setEditingGoal(false);
      toast.success(monto === null ? "Meta borrada." : "Meta del mes guardada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la meta.");
    } finally {
      setSavingGoal(false);
    }
  };

  // ---- Ocupación ----
  const gridStart = mondayOf(today);
  const units = unitsOutByDay(rentals, gridStart, GRID_DAYS, today);
  const grid = occupancyByDay(units, products, gridStart, GRID_DAYS, occProduct);
  const occProducts = products.filter((p) => !p.isArchived && p.totalStock > 0).sort((a, b) => a.name.localeCompare(b.name));

  // ---- Ingresos acumulados ----
  const cumThis = cumulativeByDay(rentals, year, month);
  const cumPrev = cumulativeByDay(rentals, pm.year, pm.month);
  const top = topUsedInMonth(rentals, products, year, month, today);

  const loading = isLoadingData && rentals.length === 0;
  const openQuotes = rentals.filter((r) => r.status === "PRESUPUESTO").length;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* INDICADORES (el Vendedor ve lo que le sirve para vender, sin plata del negocio) */}
      {!ownerView && (
        <section aria-label="Para hoy" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            highlight
            icon={MessageCircle}
            label="Pedidos por WhatsApp"
            value={`${pendingOrders.length} sin confirmar`}
            note={pendingOrders.length === 0 ? "Ninguno esperando respuesta" : oldestOrder === null ? "Esperando respuesta" : <>El más antiguo espera hace <b className="text-[#92400e]">{timeAgo(oldestOrder, now)}</b></>}
          />
          <KpiCard
            icon={ClipboardList}
            label="Presupuestos abiertos"
            value={loading ? "…" : String(openQuotes)}
            note={openQuotes === 0 ? "Ninguno esperando que el cliente confirme" : "Esperando que el cliente confirme"}
          />
          <KpiCard
            icon={CalendarDays}
            label="Entregas y retiros de hoy"
            value={loading ? "…" : String(stopsToday.length)}
            note={`Mañana: ${stopsTomorrow.length}`}
          />
        </section>
      )}
      {ownerView && (
      <section aria-label="Resumen del mes" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          highlight
          icon={TrendingUp}
          label={`Ingresos de ${MONTHS[month - 1]}`}
          value={loading ? "…" : formatGs(income.current)}
          note={income.pct === null
            ? "Sin datos del mes pasado para comparar"
            : <><Delta pct={income.pct} /> vs. {MONTHS[income.prevMonth - 1]} al día {income.prevDate}</>}
        />
        <KpiCard
          icon={CalendarDays}
          label="Reservado a futuro"
          value={loading ? "…" : formatGs(booked.total)}
          note={booked.count === 0 ? "Sin eventos confirmados desde mañana" : `${booked.count} ${booked.count === 1 ? "evento confirmado" : "eventos confirmados"} desde mañana`}
        />
        <KpiCard
          icon={MessageCircle}
          label="Pedidos por WhatsApp"
          value={`${pendingOrders.length} sin confirmar`}
          note={pendingOrders.length === 0 ? "Ninguno esperando respuesta" : oldestOrder === null ? "Esperando respuesta" : <>El más antiguo espera hace <b className="text-[#92400e]">{timeAgo(oldestOrder, now)}</b></>}
        />
        <KpiCard
          icon={CircleCheck}
          label={`Tasa de cierre · ${summary?.cierre.dias ?? 30} días`}
          value={closeRate === null ? (summaryError ? "—" : summary ? "Sin pedidos" : "…") : `${Math.round(closeRate)}%`}
          note={summaryError
            ? "No se pudo cargar"
            : summary
              ? summary.cierre.pedidos > 0
                ? <>{summary.cierre.confirmados} de {summary.cierre.pedidos} pedidos terminaron en alquiler {closeRate !== null && prevCloseRate !== null && <> · <Delta pct={closeRate - prevCloseRate} suffix=" pts" /></>}</>
                : "Nadie pidió por WhatsApp en los últimos 30 días"
              : "Cargando…"}
        />
      </section>
      )}

      {/* AGENDA + META */}
      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="agenda-t" className={`${CARD} flex-[2_1_34rem] min-w-0 flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="agenda-t" className={`${H2} flex-[1_1_14rem]`}>Agenda de reparto</h2>
            <div role="group" aria-label="Día" className="inline-flex p-1 bg-slate-100 rounded-xl">
              {(["hoy", "manana"] as const).map((d) => (
                <button key={d} type="button" aria-pressed={agendaDay === d} onClick={() => setAgendaDay(d)}
                  className={`min-h-9 px-3.5 rounded-[9px] text-[13px] font-bold cursor-pointer ${agendaDay === d ? "bg-white text-[#004080] shadow-sm" : "text-slate-600"}`}>
                  {d === "hoy" ? "Hoy" : "Mañana"} · {(d === "hoy" ? stopsToday : stopsTomorrow).length}
                </button>
              ))}
            </div>
            {ownerView && (
              <button type="button" onClick={() => onOpenRoutes(agendaIso)} className="inline-flex items-center gap-1.5 min-h-11 text-sm font-bold text-[#004080] hover:text-[#00294f] cursor-pointer">
                {plan ? "Ver la ruta" : "Armar la ruta"} <ArrowRight className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : stops.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No hay entregas ni retiros {agendaDay === "hoy" ? "hoy" : "mañana"} ({shortDate(agendaIdx)}).</p>
          ) : (
            <ol className="flex flex-col">
              {stops.map((s) => {
                const st = stopStatus(s, planStops.get(s.key), plan !== null);
                const place = s.rental.city?.name ?? (s.rental.cityId == null ? "Retira en el local" : "Sin ciudad");
                return (
                  <li key={s.key} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 py-3.5 border-t border-slate-100">
                    <span className="w-24 text-sm font-black text-slate-900 tabular-nums">{s.window ?? <span className="font-bold text-slate-500">Sin horario</span>}</span>
                    <span className={`inline-flex items-center min-h-6.5 px-2.5 rounded-lg text-xs font-black ${STOP_CHIP[s.kind]}`}>{s.kind === "ENTREGA" ? "Entrega" : "Retiro"}</span>
                    <div className="flex-[1_1_14rem] min-w-0">
                      <p className="text-[15px] font-bold text-slate-900 truncate">{s.rental.clientName}</p>
                      <p className="text-[13px] text-slate-500 truncate">{place} · {itemsSummary(s.rental)}</p>
                    </div>
                    {ownerView && <span className={`inline-flex items-center min-h-7 px-3 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {ownerView && (
        <section aria-labelledby="meta-t" className={`${CARD} flex-[1_1_18rem] min-w-0 flex flex-col gap-2`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="meta-t" className={H2}>Meta de {MONTHS[month - 1]}</h2>
            {goal !== null && !editingGoal && (
              <button type="button" onClick={() => { setGoalDraft(String(goal)); setEditingGoal(true); }}
                className="inline-flex items-center gap-1.5 min-h-11 text-[13px] font-bold text-[#004080] cursor-pointer">
                <Pencil className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" /> Cambiar
              </button>
            )}
          </div>
          {editingGoal || (goal === null && summary !== null) ? (
            <form
              className="flex flex-col gap-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                const monto = Number(goalDraft.replace(/\D/g, ""));
                if (!monto) { toast.error("Escribí un monto mayor a cero."); return; }
                saveGoal(monto);
              }}
            >
              <p className="text-sm text-slate-600">
                {goal === null ? "Definí cuánto querés facturar por mes y seguí el avance desde acá." : "Nueva meta mensual:"}
              </p>
              <label className="flex items-center gap-2 min-h-11 px-3.5 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-[#004080]/25">
                <span className="text-sm font-bold text-slate-500">Gs.</span>
                <span className="sr-only">Meta mensual en guaraníes</span>
                <input
                  inputMode="numeric"
                  autoFocus={editingGoal}
                  value={goalDraft ? Number(goalDraft.replace(/\D/g, "") || 0).toLocaleString("es-PY") : ""}
                  onChange={(e) => setGoalDraft(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="25.000.000"
                  className="flex-1 min-w-0 outline-none text-base font-bold text-slate-900 tabular-nums"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={savingGoal} className="min-h-11 px-4 rounded-xl bg-[#004080] text-white text-sm font-bold hover:bg-[#00294f] disabled:opacity-60 cursor-pointer">
                  {savingGoal ? "Guardando…" : "Guardar meta"}
                </button>
                {editingGoal && (
                  <button type="button" onClick={() => setEditingGoal(false)} className="min-h-11 px-4 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
                )}
                {editingGoal && goal !== null && (
                  <button type="button" disabled={savingGoal} onClick={() => saveGoal(null)} className="min-h-11 px-4 rounded-xl text-sm font-bold text-[#b42318] hover:bg-red-50 cursor-pointer">Quitar meta</button>
                )}
              </div>
            </form>
          ) : goal !== null ? (
            <>
              <Gauge pct={goalPct} />
              <p className="-mt-2 text-center text-xs text-slate-600">de {formatGs(goal)}</p>
              <p className="text-center text-sm text-slate-700">
                {income.current >= goal
                  ? <><b className="text-[#0f7a4d]">¡Meta cumplida!</b> {formatGs(income.current - goal)} por encima.</>
                  : <>Faltan <b>{formatGs(goal - income.current)}</b>{daysLeft > 0 ? ` en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}` : ""}.</>}
              </p>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">{summaryError ? "No se pudo cargar la meta." : "Cargando…"}</p>
          )}
          <div className="grid grid-cols-2 gap-2 mt-auto pt-2">
            <div className="bg-[#f4f7fb] rounded-xl px-3 py-2.5">
              <p className="text-xs text-slate-500">{MONTHS[pm.month - 1][0].toUpperCase() + MONTHS[pm.month - 1].slice(1)}</p>
              <p className="text-[15px] font-black text-slate-900 tabular-nums">{formatGsShort(lastMonthTotal)}</p>
            </div>
            <div className="bg-[#f4f7fb] rounded-xl px-3 py-2.5">
              <p className="text-xs text-slate-500">Mejor mes de {year}</p>
              <p className="text-[15px] font-black text-slate-900 tabular-nums">{best ? `${formatGsShort(best.total)} · ${MONTHS[best.month - 1].slice(0, 3)}` : "—"}</p>
            </div>
          </div>
        </section>
        )}
      </div>

      {/* OCUPACIÓN + PARA RESOLVER */}
      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="ocu-t" className={`${CARD} flex-[2_1_34rem] min-w-0 flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 id="ocu-t" className={`${H2} flex-[1_1_14rem]`}>Ocupación del inventario · 5 semanas</h2>
            <label className="inline-flex items-center gap-2 text-[13px] text-slate-600">
              Producto
              <select
                value={occProduct ?? ""}
                onChange={(e) => setOccProduct(e.target.value ? Number(e.target.value) : null)}
                className="min-h-10 max-w-52 border border-slate-200 rounded-[10px] px-2.5 text-[13px] text-slate-900 bg-white cursor-pointer"
              >
                <option value="">El más comprometido de cada día</option>
                {occProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[13px] text-slate-500">
            Qué parte del stock ya está reservada cada día. Los días oscuros son los que conviene cuidar antes de aceptar otro pedido grande.
          </p>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEK_HEAD.map((d) => <span key={d} className="text-center text-xs font-bold text-slate-500 pb-0.5">{d}</span>)}
            {grid.map((c) => {
              const past = c.day < today;
              const color = occColor(c.pct);
              const { date, month: m } = ymOfDay(c.day);
              const title = c.productName
                ? `${shortDate(c.day)}: ${Math.round(c.pct)}% reservado (${c.productName}: ${c.units} de ${c.stock})`
                : `${shortDate(c.day)}: nada reservado`;
              return (
                <div
                  key={c.day}
                  title={title}
                  className={`min-h-12 sm:min-h-14 rounded-[10px] px-1.5 sm:px-2 py-1.5 flex flex-col justify-between ${c.day === today ? "ring-2 ring-[#004080] ring-offset-1" : ""} ${past ? "opacity-45" : ""}`}
                  style={{ background: color.bg, color: color.fg }}
                >
                  <span className="text-[11px] opacity-85">{date === 1 ? `1/${m}` : date}</span>
                  <span className="text-xs sm:text-sm font-black tabular-nums">{Math.round(c.pct)}%</span>
                  <span className="sr-only">{title}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-600">
            {[["#e8f0f8", "Menos de 40%"], ["#9cc0e6", "40–69%"], ["#3b78c0", "70–89%"], ["#00294f", "90% o más"]].map(([bg, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-[#c9dbee]" style={{ background: bg }} />{label}</span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded ring-2 ring-[#004080]" />Hoy</span>
          </div>
        </section>

        <section aria-labelledby="al-t" className={`${CARD} flex-[1_1_18rem] min-w-0 flex flex-col gap-3`}>
          <h2 id="al-t" className={H2}>Para resolver</h2>
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Todo en orden: no hay nada pendiente.</p>
          ) : (
            alerts.map((a) => <AlertRow key={a.id} alert={a} onClick={() => onOpenAlert(a)} />)
          )}
        </section>
      </div>

      {/* INGRESOS ACUMULADOS + LO QUE MÁS SE ALQUILA */}
      <div className="flex flex-wrap gap-5">
        {ownerView && (
        <section aria-labelledby="ing-t" className={`${CARD} flex-[2_1_34rem] min-w-0 flex flex-col gap-2.5`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <h2 id="ing-t" className={`${H2} flex-[1_1_14rem]`}>¿Cómo vamos contra el mes pasado?</h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700"><span className="w-4.5 h-0.75 rounded bg-[#004080]" />{MONTHS[month - 1]}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700"><span className="w-4.5 h-0.75 rounded bg-slate-400" />{MONTHS[pm.month - 1]}</span>
            {goal !== null && <span className="inline-flex items-center gap-1.5 text-xs text-slate-700"><span className="w-4.5 border-t-2 border-dashed border-[#0f7a4d]" />Meta</span>}
          </div>
          <CumulativeChart current={cumThis} previous={cumPrev} todayDate={ymOfDay(today).date} goal={goal} />
          <p className="text-xs text-slate-500">Ingresos acumulados día por día según la fecha del evento. La línea de {MONTHS[month - 1]} incluye lo ya reservado para los días que faltan.</p>
        </section>
        )}

        <section aria-labelledby="top-t" className={`${CARD} flex-[1_1_18rem] min-w-0 flex flex-col gap-3.5`}>
          <div>
            <h2 id="top-t" className={H2}>Lo que más se alquila</h2>
            <p className="text-xs text-slate-500 mt-1">{MONTHS[month - 1][0].toUpperCase() + MONTHS[month - 1].slice(1)} · % de su capacidad (unidades × días)</p>
          </div>
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Todavía no hay alquileres este mes.</p>
          ) : (
            <ol className="flex flex-col gap-3.5">
              {top.map((p) => (
                <li key={p.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-bold text-slate-900 truncate">{p.name}</span>
                    <span className="text-slate-700 shrink-0"><b>{Math.round(p.pct)}%</b> · pico {p.peak} u.</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100 overflow-hidden">
                    <div className="h-full rounded bg-linear-to-r from-[#0d4a8a] to-[#00294f]" style={{ width: `${Math.min(100, Math.max(2, p.pct))}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/** Líneas de ingresos acumulados: este mes, el anterior y la meta. SVG propio (liviano). */
function CumulativeChart({ current, previous, todayDate, goal }: { current: number[]; previous: number[]; todayDate: number; goal: number | null }) {
  const W = 680, H = 250, L = 64, R = 12, T = 14, B = 30;
  const maxDays = Math.max(current.length, previous.length);
  const top = Math.max(1, ...current, ...previous, goal ?? 0) * 1.08;
  const X = (d: number) => L + ((d - 1) * (W - L - R)) / Math.max(1, maxDays - 1);
  const Y = (v: number) => T + (1 - v / top) * (H - T - B);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${X(i + 1).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const xTicks = [1, 5, 10, 15, 20, 25, maxDays].filter((d, i, a) => d <= maxDays && a.indexOf(d) === i);
  const curToday = current[Math.min(todayDate, current.length) - 1] ?? 0;
  const empty = current.every((v) => v === 0) && previous.every((v) => v === 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Ingresos acumulados: este mes ${formatGs(current[current.length - 1] ?? 0)}, mes pasado ${formatGs(previous[previous.length - 1] ?? 0)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="#eef2f7" />
            <text x={L - 8} y={Y(t) + 4} textAnchor="end" className="fill-slate-500" style={{ font: "11px var(--font-lato), sans-serif" }}>{t === 0 ? "0" : formatGsShort(t).replace("Gs. ", "")}</text>
          </g>
        ))}
        {goal !== null && <line x1={L} x2={W - R} y1={Y(goal)} y2={Y(goal)} stroke="#0f7a4d" strokeWidth="1.5" strokeDasharray="5 5" />}
        <path d={`${path(current)} L${X(current.length).toFixed(1)} ${Y(0)} L${X(1)} ${Y(0)} Z`} fill="#004080" fillOpacity="0.08" />
        <path d={path(previous)} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path(current)} fill="none" stroke="#004080" strokeWidth="3" strokeLinejoin="round" />
        <circle cx={X(Math.min(todayDate, current.length))} cy={Y(curToday)} r="5.5" fill="#004080" stroke="#fff" strokeWidth="2.5" />
        {xTicks.map((d) => (
          <text key={d} x={X(d)} y={H - 8} textAnchor="middle" className="fill-slate-500" style={{ font: "11px var(--font-lato), sans-serif" }}>{d}</text>
        ))}
      </svg>
      {empty && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Todavía no hay ingresos en estos dos meses.</p>}
    </div>
  );
}
