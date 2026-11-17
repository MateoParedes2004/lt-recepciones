"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Truck, Package, RotateCcw, Navigation, Phone, MessageCircle, CheckCircle2, Undo2, TriangleAlert, Loader2, Save, ExternalLink, ShieldCheck, Route as RouteIcon, Clock, Flag, MapPin } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { toWhatsappNumber, whatsappLinkTo } from "../../lib/site";
import type { DispatchPlan, PlanRoute, PlanStop } from "../../types";
import { useToast } from "./ToastProvider";

// Cuánto se alargan los tiempos de viaje por tráfico. Los tiempos del servicio
// de rutas son "sin tráfico": estos tres puntos de partida son estimaciones, no
// mediciones (cuando haya suficientes paradas con hora real, se calibran).
const TRAFFIC_OPTIONS = [
  { value: 1, label: "Sin tráfico (×1,0)" },
  { value: 1.3, label: "Moderado (×1,3)" },
  { value: 1.6, label: "Pesado (×1,6)" },
];

/** Hoy en Paraguay como AAAA-MM-DD (en-CA da ese formato). */
const todayParaguay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });

/** Suma días a una fecha AAAA-MM-DD sin pasar por la zona horaria del navegador. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const formatLongDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("es-PY", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function formatDuration(min: number): string {
  const total = Math.round(min);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

const formatKm = (km: number) => `${km.toLocaleString("es-PY", { maximumFractionDigits: 1 })} km`;

/** Hora real (de una marca de tiempo) en hora de Paraguay. */
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false });

function Chip({ tone, children }: { tone: "slate" | "amber" | "red" | "green" | "blue"; children: React.ReactNode }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-[#e8f0f8] text-[#004080] border-[#004080]/20",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

// initialDate: desde Inicio se abre directo en el día que se estaba mirando (hoy o mañana).
export default function RoutesTab({ initialDate }: { initialDate?: string } = {}) {
  const toast = useToast();
  const [date, setDate] = useState(() => initialDate ?? todayParaguay());
  const [vehicles, setVehicles] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [traffic, setTraffic] = useState(1.3);
  const [includeDeliveries, setIncludeDeliveries] = useState(true);
  const [includePickups, setIncludePickups] = useState(true);

  const [plan, setPlan] = useState<DispatchPlan | null>(null);
  const [busy, setBusy] = useState<"load" | "calc" | "save" | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [busyStop, setBusyStop] = useState<number | null>(null);
  // Para ignorar la respuesta de una consulta vieja si el admin cambió de día mientras llegaba.
  const requestId = useRef(0);

  // Al elegir un día, se muestra la ruta que ya esté guardada para ese día (si hay).
  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    (async () => {
      setBusy("load");
      setError(null);
      try {
        const res = await apiFetch(`/routing/runs/${date}`, { signal: controller.signal });
        if (id !== requestId.current) return;
        if (!res.ok) { setPlan(null); setError(await readApiError(res)); return; }
        const body = (await res.json()) as DispatchPlan | { run: null };
        if ("run" in body) { setPlan(null); return; }
        setPlan(body);
        // Los controles reflejan cómo se armó la ruta guardada.
        setVehicles(body.vehicles);
        setStartTime(body.startTime);
        setTraffic(body.trafficFactor);
      } catch {
        if (id === requestId.current && !controller.signal.aborted) { setPlan(null); setError("No se pudo conectar con el servidor."); }
      } finally {
        if (id === requestId.current) setBusy(null);
      }
    })();
    return () => controller.abort();
  }, [date]);

  // Calcula (o calcula y guarda) la ruta. Devuelve el mensaje del servidor si
  // guardar choca con una ruta ya iniciada (para preguntar si se reemplaza).
  const request = useCallback(async (mode: "calc" | "save", replace: boolean): Promise<string | null> => {
    const id = ++requestId.current;
    setBusy(mode);
    setError(null);
    try {
      const res = await apiFetch("/routing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, vehicles, startTime, trafficFactor: traffic, includeDeliveries, includePickups, ...(mode === "save" ? { save: true, replace } : {}) }),
      });
      if (id !== requestId.current) return null;
      if (res.status === 409 && mode === "save" && !replace) return await readApiError(res);
      if (!res.ok) { setError(await readApiError(res)); return null; }
      setPlan((await res.json()) as DispatchPlan);
      if (mode === "save") toast.success("Ruta guardada. Ya podés marcar las paradas a medida que avanzás.");
      return null;
    } catch {
      if (id === requestId.current) setError("Error de conexión. Revisá tu internet e intentá de nuevo.");
      return null;
    } finally {
      if (id === requestId.current) setBusy(null);
    }
  }, [date, vehicles, startTime, traffic, includeDeliveries, includePickups, toast]);

  const run = useCallback(async (mode: "calc" | "save") => {
    const conflict = await request(mode, false);
    // La ruta guardada ya tiene paradas marcadas: reemplazarla borra ese avance, así que se confirma.
    if (conflict && window.confirm(conflict)) await request(mode, true);
  }, [request]);

  const markStop = async (stop: PlanStop, action: "arrive" | "complete" | "reset") => {
    if (stop.stopId === undefined) return;
    setBusyStop(stop.stopId);
    try {
      const res = await apiFetch(`/routing/stops/${stop.stopId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) { toast.error(`No se pudo guardar: ${await readApiError(res)}`); return; }
      const saved = (await res.json()) as { stopId: number; arrivedAt: string | null; completedAt: string | null };
      setPlan((prev) => prev && { ...prev, routes: prev.routes.map((r) => ({ ...r, stops: r.stops.map((s) => (s.stopId === saved.stopId ? { ...s, arrivedAt: saved.arrivedAt, completedAt: saved.completedAt } : s)) })) });
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); } finally { setBusyStop(null); }
  };

  const deleteRun = async () => {
    if (!window.confirm("¿Borrar la ruta guardada de este día? Se pierde el avance marcado (llegadas y entregas).")) return;
    try {
      const res = await apiFetch(`/routing/runs/${date}`, { method: "DELETE" });
      if (res.ok) { setPlan(null); toast.success("Ruta borrada."); } else toast.error(`No se pudo borrar: ${await readApiError(res)}`);
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
  };

  // Si cambian los controles después de calcular, lo que se ve ya no corresponde.
  const stale = plan !== null && !plan.saved && (plan.date !== date || plan.vehicles !== vehicles || plan.startTime !== startTime || plan.trafficFactor !== traffic);
  const savedStale = plan?.saved != null && (plan.vehicles !== vehicles || plan.startTime !== startTime || plan.trafficFactor !== traffic);
  const allStops = plan?.routes.flatMap((r) => r.stops) ?? [];
  const doneCount = allStops.filter((s) => s.completedAt).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* CONTROLES */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center"><Truck className="w-6 h-6 mr-2 text-[#004080]" /> Ruta del día</h2>
            <p className="text-sm text-slate-500 mt-0.5">Ordena las entregas y los retiros para manejar lo menos posible.</p>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Atajos de fecha">
            <button type="button" onClick={() => setDate(todayParaguay())} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">Hoy</button>
            <button type="button" onClick={() => setDate(addDays(todayParaguay(), 1))} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">Mañana</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <label className="col-span-2 md:col-span-1 block text-sm font-medium text-slate-700">Día
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-xl text-slate-900" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Salida del depósito
            <input type="time" value={startTime} onChange={(e) => e.target.value && setStartTime(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-xl text-slate-900" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Camiones
            <select value={vehicles} onChange={(e) => setVehicles(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border rounded-xl bg-white text-slate-900">
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="col-span-2 block text-sm font-medium text-slate-700">Tráfico
            <select value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border rounded-xl bg-white text-slate-900">
              {TRAFFIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={includeDeliveries} onChange={(e) => setIncludeDeliveries(e.target.checked)} className="w-4 h-4 accent-[#004080]" /> Entregas</label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={includePickups} onChange={(e) => setIncludePickups(e.target.checked)} className="w-4 h-4 accent-[#004080]" /> Retiros (incluye los atrasados)</label>
          <div className="flex-1" />
          <button type="button" onClick={() => run("calc")} disabled={busy !== null || (!includeDeliveries && !includePickups)} className="inline-flex items-center gap-2 bg-[#004080] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#00294f] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-md">
            {busy === "calc" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RouteIcon className="w-4 h-4" />} {busy === "calc" ? "Calculando..." : plan?.saved ? "Recalcular" : "Calcular ruta"}
          </button>
          {plan && !plan.saved && (
            <button type="button" onClick={() => run("save")} disabled={busy !== null || stale || plan.totals.stops === 0} title={stale ? "Recalculá primero: cambiaste los datos" : "Guarda la ruta para marcar el avance"} className="inline-flex items-center gap-2 bg-[#e8f0f8] text-[#004080] px-5 py-2.5 rounded-xl font-bold hover:bg-[#d3e3f2] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar ruta
            </button>
          )}
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl text-sm"><TriangleAlert className="w-5 h-5 shrink-0 text-red-500" /> {error}</div>}

      {busy === "load" && !plan && <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>}

      {!plan && busy !== "load" && !error && (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">Todavía no hay una ruta para el {formatLongDate(date)}.</p>
          <p className="text-sm mt-1">Tocá <strong>Calcular ruta</strong> para armar el recorrido con las entregas y los retiros de ese día. Para que un alquiler entre, tiene que tener la ubicación exacta de entrega cargada.</p>
        </div>
      )}

      {plan && (
        <>
          {(stale || savedStale) && (
            <div role="status" className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3 rounded-2xl text-sm">
              <TriangleAlert className="w-5 h-5 shrink-0 text-amber-500" /> Cambiaste el día, la hora, los camiones o el tráfico: lo que ves corresponde a los datos anteriores. Tocá <strong className="mx-1">{plan.saved ? "Recalcular" : "Calcular ruta"}</strong> para actualizarlo.
            </div>
          )}

          {/* RESUMEN */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"><p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Paradas</p><p className="text-2xl font-bold text-slate-900">{plan.totals.stops}</p><p className="text-xs text-slate-500">{plan.totals.deliveries} entregas · {plan.totals.pickups} retiros</p></div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"><p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Manejando</p><p className="text-2xl font-bold text-slate-900">{formatKm(plan.totals.km)}</p><p className="text-xs text-slate-500">{formatDuration(plan.totals.travelMin)} de viaje</p></div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"><p className="text-xs font-medium text-slate-500 uppercase tracking-wide">En los lugares</p><p className="text-2xl font-bold text-slate-900">{formatDuration(plan.totals.serviceMin)}</p><p className="text-xs text-slate-500">{plan.totals.waitMin > 0 ? `+ ${formatDuration(plan.totals.waitMin)} de espera` : "sin esperas"}</p></div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"><p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Termina</p><p className="text-2xl font-bold text-slate-900">{plan.totals.stops > 0 ? plan.totals.finishTime : "—"}</p><p className="text-xs text-slate-500">de vuelta en el depósito</p></div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {plan.totals.stops > 0 && (plan.solver.optimal
              ? <Chip tone="green"><ShieldCheck className="w-3.5 h-3.5" /> Mejor ruta posible (verificada)</Chip>
              : <Chip tone="blue"><RouteIcon className="w-3.5 h-3.5" /> Ruta optimizada</Chip>)}
            {plan.matrix.method === "estimate" && plan.totals.stops > 0 && <Chip tone="amber"><TriangleAlert className="w-3.5 h-3.5" /> Tiempos aproximados</Chip>}
            {plan.saved && <Chip tone="green"><Save className="w-3.5 h-3.5" /> Guardada · {doneCount} de {plan.totals.stops} listas</Chip>}
            <Chip tone="slate"><Clock className="w-3.5 h-3.5" /> Salida {plan.startTime} · tráfico ×{plan.trafficFactor.toLocaleString("es-PY")}</Chip>
            {plan.saved && <button type="button" onClick={deleteRun} className="ml-auto text-xs text-slate-500 underline hover:text-red-600 cursor-pointer">Borrar ruta guardada</button>}
          </div>

          {plan.warnings.length > 0 && (
            <ul className="space-y-2" aria-label="Avisos">
              {plan.warnings.map((w, i) => <li key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-sm"><TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" /> {w}</li>)}
            </ul>
          )}

          {/* RECORRIDOS */}
          {plan.routes.map((route) => <RouteCard key={route.vehicle} route={route} multiple={plan.routes.length > 1} saved={!!plan.saved} busyStop={busyStop} onMark={markStop} />)}

          {plan.skipped.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-2">No entraron en la ruta ({plan.skipped.length})</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {plan.skipped.map((s, i) => <li key={i}><strong className="text-slate-800">{s.kind === "ENTREGA" ? "Entrega" : "Retiro"} de {s.clientName}:</strong> {s.reason}</li>)}
              </ul>
            </div>
          )}

          {plan.matrix.provider === "Geoapify" && (
            <p className="text-[11px] text-slate-400">
              Rutas: <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Powered by Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function RouteCard({ route, multiple, saved, busyStop, onMark }: { route: PlanRoute; multiple: boolean; saved: boolean; busyStop: number | null; onMark: (stop: PlanStop, action: "arrive" | "complete" | "reset") => void }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" aria-label={multiple ? `Camión ${route.vehicle}` : "Recorrido"}>
      <header className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="font-bold text-slate-900 flex items-center"><Truck className="w-5 h-5 mr-2 text-[#004080]" /> {multiple ? `Camión ${route.vehicle}` : "Recorrido"}</h3>
        <span className="text-sm text-slate-600">{route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"} · {formatKm(route.km)} · {formatDuration(route.durationMin)} en total · vuelve a las {route.endTime}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {route.mapsUrls.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#004080] bg-[#e8f0f8] hover:bg-[#d3e3f2] px-3 py-1.5 rounded-lg">
              <ExternalLink className="w-4 h-4" /> Abrir en Google Maps{route.mapsUrls.length > 1 ? ` (tramo ${i + 1} de ${route.mapsUrls.length})` : ""}
            </a>
          ))}
        </div>
      </header>

      <ol className="divide-y divide-slate-100">
        <li className="px-6 py-3 text-sm text-slate-500 flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center"><Flag className="w-4 h-4" /></span> Sale del depósito</li>
        {route.stops.map((stop, i) => <StopRow key={stop.key} stop={stop} index={i + 1} saved={saved} busy={busyStop === stop.stopId} onMark={onMark} />)}
      </ol>
    </section>
  );
}

function StopRow({ stop, index, saved, busy, onMark }: { stop: PlanStop; index: number; saved: boolean; busy: boolean; onMark: (stop: PlanStop, action: "arrive" | "complete" | "reset") => void }) {
  const delivery = stop.kind === "ENTREGA";
  const done = !!stop.completedAt;
  const phone = toWhatsappNumber(stop.clientPhone);
  const firstName = stop.clientName.trim().split(/\s+/)[0];
  const message = delivery
    ? `¡Hola ${firstName}! Te escribimos de LT Recepciones: ya vamos en camino con tu pedido. Llegamos aproximadamente a las ${stop.arrive}.`
    : `¡Hola ${firstName}! Te escribimos de LT Recepciones: pasamos a retirar los productos aproximadamente a las ${stop.arrive}.`;

  return (
    <li className={`px-6 py-4 ${done ? "bg-emerald-50/40" : ""}`}>
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? "bg-emerald-500 text-white" : "bg-[#004080] text-white"}`}>{done ? <CheckCircle2 className="w-4 h-4" /> : index}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-bold text-slate-900 tabular-nums">{stop.arrive}{stop.nextDay ? " (+1)" : ""}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide ${delivery ? "text-[#004080]" : "text-amber-700"}`}>{delivery ? <Package className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}{delivery ? "Entrega" : "Retiro"}</span>
            <span className="font-semibold text-slate-900 truncate">{stop.clientName}</span>
          </div>

          <p className="text-sm text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {(stop.cityName || stop.address) && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{[stop.cityName, stop.address].filter(Boolean).join(" · ")}</span>}
            <span>{stop.units} {stop.units === 1 ? "unidad" : "unidades"} · ~{stop.serviceMin} min en el lugar</span>
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone="slate">{stop.legMin} min · {formatKm(stop.legKm)} desde la anterior</Chip>
            {(stop.windowFrom || stop.windowTo) && <Chip tone="blue"><Clock className="w-3 h-3" /> Pidió {stop.windowFrom ?? "…"}–{stop.windowTo ?? "…"}</Chip>}
            {stop.waitMin >= 1 && <Chip tone="amber">Espera {stop.waitMin} min</Chip>}
            {stop.lateMin >= 1 && <Chip tone="red">{stop.lateMin} min tarde</Chip>}
            {stop.overdueDays > 0 && <Chip tone="red">Atrasado {stop.overdueDays} {stop.overdueDays === 1 ? "día" : "días"}</Chip>}
            {stop.arrivedAt && <Chip tone="green">Llegó {timeOf(stop.arrivedAt)}</Chip>}
            {stop.completedAt && <Chip tone="green">{delivery ? "Entregado" : "Retirado"} {timeOf(stop.completedAt)}</Chip>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a href={stop.directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#004080] hover:underline"><Navigation className="w-4 h-4" /> Cómo llegar</a>
            {stop.clientPhone && <a href={`tel:${stop.clientPhone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:underline"><Phone className="w-4 h-4" /> {stop.clientPhone}</a>}
            {phone && <a href={whatsappLinkTo(phone, message)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"><MessageCircle className="w-4 h-4" /> Avisar por WhatsApp</a>}
            <div className="flex-1" />
            {saved && stop.stopId !== undefined && (
              <div className="flex items-center gap-2">
                {!stop.arrivedAt && <button type="button" disabled={busy} onClick={() => onMark(stop, "arrive")} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#e8f0f8] text-[#004080] hover:bg-[#d3e3f2] disabled:opacity-50 cursor-pointer">Llegué</button>}
                {!stop.completedAt && <button type="button" disabled={busy} onClick={() => onMark(stop, "complete")} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">{delivery ? "Entregado" : "Retirado"}</button>}
                {(stop.arrivedAt || stop.completedAt) && <button type="button" disabled={busy} onClick={() => onMark(stop, "reset")} aria-label="Deshacer" title="Deshacer" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"><Undo2 className="w-4 h-4" /></button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
