"use client";

import { useState, useEffect } from "react";
import {
  Users, Calendar, Loader2, Send, ArrowRight, MapPin, Tags, Eye, ShoppingCart, Search, SearchX, CalendarDays,
  Globe, MessageCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, usePlotArea } from "recharts";
import { apiFetch } from "../../lib/api";

const formatPYG = (amount: number) => `Gs. ${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const formatPct = (n: number) => `${n.toFixed(1)}%`;
// Eje de montos: "1,5M" / "800k" (antes, sin ingresos, mostraba "Gs. 0.000004M").
const formatEje = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("es-PY", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)} mil`;
  return `${Math.round(value)}`;
};
const formatCorto = (value: number) => `Gs. ${formatEje(value)}`;
// Nunca mostramos días negativos: un alquiler cargado después de la fecha del
// evento (carga retroactiva) daría una anticipación negativa sin sentido.
const formatDias = (n: number) => `${Math.max(0, n).toFixed(1)} días`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const CARD = "bg-white border border-slate-200 rounded-[20px] p-5 sm:p-6";
const H2 = "text-lg font-bold text-slate-900";

// Gráfico de visitas: áreas superpuestas sobre un fondo gris claro con franjas
// alternadas. Las visitas del período van al frente en degradé azul→turquesa
// (semitransparente, por eso donde se cruzan con el gris se ve más oscuro); el
// período anterior queda atrás en gris, para comparar de un vistazo.
const VISITAS_DEGRADE = ["#0a7fb5", "#22b3a3"];
const VISITAS_PUNTO = "#0e97b0";
const ANTERIOR_GRIS = "#b4b4b6";
const FONDO_GRAFICO = "#f4f4f5";
const FRANJA_GRAFICO = "#e7e7e9";
const SWATCH_VISITAS = `linear-gradient(90deg, ${VISITAS_DEGRADE[0]}, ${VISITAS_DEGRADE[1]})`;

// Franjas verticales alternadas entre un punto del eje X y el siguiente. Se
// dibujan con la posición real del área de trazado, sin capa propia: quedan
// detrás de las áreas y (con la grilla subida de capa) debajo de las líneas blancas.
function FranjasAlternadas({ count }: { count: number }) {
  const area = usePlotArea();
  if (!area || count < 2) return null;
  const step = area.width / (count - 1);
  return (
    <g aria-hidden="true">
      {Array.from({ length: count - 1 }, (_, i) =>
        i % 2 === 0 ? <rect key={i} x={area.x + i * step} y={area.y} width={step} height={area.height} fill={FRANJA_GRAFICO} /> : null
      )}
    </g>
  );
}

interface TooltipItem { dataKey?: string | number; value?: number | string }

// Un solo tooltip con las dos series en ese punto del eje X: el valor es lo
// destacado y el nombre de la serie va en segundo plano.
function VisitasTooltip({ active, payload, label, anteriorLabel }: {
  active?: boolean; payload?: readonly TooltipItem[]; label?: string | number; anteriorLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const valueOf = (key: string) => Number(payload.find((p) => p.dataKey === key)?.value ?? 0);
  const rows = [
    { key: "visitas", name: "Visitas", value: valueOf("visitas"), swatch: SWATCH_VISITAS },
    { key: "visitasAnterior", name: anteriorLabel, value: valueOf("visitasAnterior"), swatch: ANTERIOR_GRIS },
  ];
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-3.5 py-2.5 text-sm">
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 py-0.5">
          <span className="w-3 h-[3px] rounded-full shrink-0" style={{ background: r.swatch }} />
          <span className="font-bold text-slate-900 tabular-nums">{r.value}</span>
          <span className="text-xs text-slate-500">{r.name}</span>
        </div>
      ))}
    </div>
  );
}

function VisitasChart({ data, mode, isLoading }: { data: ChartPoint[]; mode: "mensual" | "anual"; isLoading: boolean }) {
  const anteriorLabel = mode === "mensual" ? "Mes anterior" : "Año anterior";
  const isEmpty = data.every((p) => p.visitas === 0 && p.visitasAnterior === 0);
  // En la vista anual el nombre trae el año ("Ene 2026") y en la mensual el
  // mes ("5 Sep"): en el eje sobran (el tooltip muestra el nombre completo).
  const tickName = (name: string) => (mode === "anual" ? name.replace(/ \d{4}$/, "") : name.replace(/ \S+$/, ""));

  return (
    <div>
      <div className="flex items-center gap-5 mb-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm" style={{ background: SWATCH_VISITAS }} /> Visitas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: ANTERIOR_GRIS }} /> {anteriorLabel}
        </span>
      </div>

      <div className="h-72 w-full rounded-2xl overflow-hidden relative" style={{ backgroundColor: FONDO_GRAFICO }} aria-busy={isLoading}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 36, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="degradeVisitas" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={VISITAS_DEGRADE[0]} />
                <stop offset="100%" stopColor={VISITAS_DEGRADE[1]} />
              </linearGradient>
            </defs>
            <FranjasAlternadas count={data.length} />
            <CartesianGrid vertical={false} stroke="#ffffff" strokeWidth={2} zIndex={50} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tickFormatter={tickName} tick={{ fill: "#3f3f46", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} allowDecimals={false} width={44} tick={{ fill: "#3f3f46", fontSize: 12 }} />
            <Tooltip content={<VisitasTooltip anteriorLabel={anteriorLabel} />} cursor={{ stroke: "#ffffff", strokeWidth: 2 }} />
            <Area type="monotone" dataKey="visitasAnterior" name={anteriorLabel} stroke="#ffffff" strokeWidth={2} fill={ANTERIOR_GRIS} fillOpacity={0.9}
              activeDot={{ r: 5, fill: ANTERIOR_GRIS, stroke: "#ffffff", strokeWidth: 2 }} />
            <Area type="monotone" dataKey="visitas" name="Visitas" stroke="#ffffff" strokeWidth={2} fill="url(#degradeVisitas)" fillOpacity={0.88}
              activeDot={{ r: 5, fill: VISITAS_PUNTO, stroke: "#ffffff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
        {isEmpty && !isLoading && (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-500 pointer-events-none">
            Todavía no hay visitas registradas en este período.
          </p>
        )}
      </div>

      {/* Los mismos datos como tabla, para lectores de pantalla. Va dentro de
          un div oculto: una <table> no respeta el ancho de 1px de sr-only y
          ensanchaba la página en el celular. */}
      <div className="sr-only">
      <table>
        <caption>Visitas al sitio por período, comparadas con el {anteriorLabel.toLowerCase()}</caption>
        <thead><tr><th scope="col">Período</th><th scope="col">Visitas</th><th scope="col">{anteriorLabel}</th></tr></thead>
        <tbody>
          {data.map((p) => (<tr key={p.name}><th scope="row">{p.name}</th><td>{p.visitas}</td><td>{p.visitasAnterior}</td></tr>))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

interface ChartPoint {
  name: string;
  ingresos: number;
  pedidos: number;
  visitas: number;
  visitasAnterior: number;
  pedidosWhatsapp: number;
  paginasVistas?: number;
}

interface RankedItem { key: string; nombre: string; cantidad: number; pedidos?: number }
interface Interes { masVistos: RankedItem[]; masAgregados: RankedItem[]; masPedidos: RankedItem[]; fechasConsultadas: RankedItem[] }
interface Busquedas { total: number; conResultados: RankedItem[]; sinResultados: RankedItem[] }
interface Trafico { fuentes: RankedItem[]; dispositivos: RankedItem[]; whatsapp: RankedItem[] }
interface PeriodoResumen { visitantes: number; paginasVistas: number }
interface Resumen { hoy: PeriodoResumen; ayer: PeriodoResumen; ultimos7: PeriodoResumen; mes: PeriodoResumen; anio: PeriodoResumen }
interface CategoriaStat { categoria: string; alquileres: number; ingresos: number }
interface CiudadStat { ciudad: string; alquileres: number; ingresos: number }

interface Kpis {
  totalIngresos: number;
  ticketPromedio: number;
  totalAlquileres: number;
  totalVisitas: number;
  totalVisitasAnterior: number;
  totalPedidosWhatsapp: number;
  tasaVisitaPedido: number;
  tasaPedidoAlquiler: number;
  duracionPromedioDias: number;
  anticipacionPromedioDias: number;
  alquileresActivos: number;
  alquileresDevueltos: number;
  totalPaginasVistas?: number;
  paginasPorVisita?: number;
  totalConsultasWhatsapp?: number;
  // null si no existe el rubro "Manteles" (ver AnalyticsService).
  manteles?: { conManteles: number; sinManteles: number } | null;
  alquileresReservados?: number;
}

interface KpisAnteriores { totalIngresos: number; totalAlquileres: number; ticketPromedio: number; totalVisitas: number; clientesRepitenPct: number }
type Sugerencia = "comprar_mas" | "sin_movimiento" | "sobra_stock" | null;
interface ProductoRendimiento {
  id: number; nombre: string; stock: number; archivado: boolean; ocupacionPct: number; picoPct: number; picoFecha: string | null;
  veces: number; unidades: number; ingresos: number; ingresoPorUnidad: number; sugerencia: Sugerencia;
}
// Lo que agregó el rediseño (opcional: un backend sin actualizar no lo manda).
interface Negocio {
  kpisAnteriores?: KpisAnteriores;
  clientes?: { total: number; repiten: number; pct: number };
  ingresosMensuales?: { anio: number; actual: number[]; anterior: number[] };
  rendimientoProductos?: ProductoRendimiento[];
  diasSemana?: number[];
  anticipacion?: { label: string; pct: number; count: number }[];
  pedidosSinCerrar?: number;
}

// Ranking con barras horizontales finas (un solo tono: es magnitud, no
// identidad). El número va en tinta de texto; la barra es proporcional al
// primero del ranking, o al total si se pide porcentaje.
function BarList({ icon, title, subtitle, rows, emptyLabel, unit, showShare, isLoading, extra }: {
  icon: React.ReactNode; title: string; subtitle?: string; rows: RankedItem[]; emptyLabel: string;
  unit: string; showShare?: boolean; isLoading: boolean; extra?: (row: RankedItem) => string | null;
}) {
  const total = rows.reduce((acc, r) => acc + r.cantidad, 0);
  const max = rows.reduce((acc, r) => Math.max(acc, r.cantidad), 0);
  return (
    <div aria-busy={isLoading} className={`${CARD} transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
      <h3 className={`${H2} text-base flex items-center`}>{icon} {title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row) => {
            const share = total ? (row.cantidad / total) * 100 : 0;
            const width = showShare ? share : max ? (row.cantidad / max) * 100 : 0;
            const note = extra?.(row);
            return (
              <li key={row.key} title={`${row.nombre}: ${row.cantidad} ${unit}${showShare ? ` (${share.toFixed(1)}%)` : ""}${note ? ` · ${note}` : ""}`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-800 font-medium truncate">{row.nombre}</span>
                  <span className="shrink-0 tabular-nums text-slate-900 font-bold">
                    {row.cantidad}
                    <span className="text-slate-500 font-normal text-xs ml-1">
                      {showShare ? `· ${share.toFixed(0)}%` : unit}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#004080]" style={{ width: `${Math.max(width, 2)}%` }} />
                </div>
                {note && <p className="text-[11px] text-slate-500 mt-1">{note}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Mini línea de tendencia de un indicador a lo largo del período. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const d = values.map((v, i) => {
    const x = 2 + (i * 92) / (values.length - 1);
    const y = 29 - (max === min ? 13 : ((v - min) / (max - min)) * 26);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 96 32" width="96" height="32" aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke="#3b78c0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function DeltaChip({ current, previous, enCurso, points = false }: { current: number; previous: number | undefined; enCurso: boolean; points?: boolean }) {
  const base = "inline-flex items-center min-h-6 px-2 rounded-md text-xs font-bold";
  if (enCurso) return <span className={`${base} bg-slate-100 text-slate-600`} title="El período todavía no terminó: compararlo con uno completo daría una caída engañosa.">En curso</span>;
  if (previous === undefined) return null;
  if (points) {
    const diff = current - previous;
    return <span className={`${base} ${diff >= 0 ? "bg-[#e7f6ee] text-[#0f7a4d]" : "bg-[#fdecea] text-[#b42318]"}`}>{diff >= 0 ? "▲" : "▼"} {Math.abs(Math.round(diff))} pts</span>;
  }
  if (!previous) return <span className={`${base} bg-slate-100 text-slate-600`}>Sin base para comparar</span>;
  const pct = ((current - previous) / previous) * 100;
  return <span className={`${base} ${pct >= 0 ? "bg-[#e7f6ee] text-[#0f7a4d]" : "bg-[#fdecea] text-[#b42318]"}`}>{pct >= 0 ? "▲" : "▼"} {Math.abs(Math.round(pct))}%</span>;
}

function KpiCard({ label, value, delta, spark, note }: { label: string; value: string; delta: React.ReactNode; spark?: number[]; note?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[20px] px-5 py-4.5 flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-slate-600">{label}</span>
      <span className="text-2xl font-black text-slate-900 tabular-nums leading-tight">{value}</span>
      <div className="flex items-end justify-between gap-2 min-h-8">
        <span>{delta}</span>
        {spark && <Sparkline values={spark} />}
      </div>
      {note && <span className="text-[11px] text-slate-500">{note}</span>}
    </div>
  );
}

const SUGERENCIAS: Record<Exclude<Sugerencia, null>, { label: string; cls: string; title: string }> = {
  comprar_mas: { label: "Comprar más", cls: "bg-[#004080] text-white", title: "Algún día del período salió el 90 % o más del stock: es probable que se hayan perdido pedidos por falta de unidades." },
  sin_movimiento: { label: "Sin alquileres", cls: "bg-[#fdecea] text-[#b42318]", title: "Tiene stock y no salió en todo el período." },
  sobra_stock: { label: "Sobra stock", cls: "bg-[#fef3c7] text-[#92400e]", title: "Ni el día de más demanda salió el 15 % de las unidades: tenés de más." },
};

function occColor(pct: number) {
  return pct >= 70 ? "#00294f" : pct >= 40 ? "#004080" : "#9cc0e6";
}

const FUENTE_COLORES = ["#00294f", "#004080", "#3b78c0", "#7aa7d9", "#9cc0e6", "#c9dbee", "#e2e8f0"];

// Tarjetas fijas de tráfico: hoy, ayer, últimos 7 días, este mes y este año.
function ResumenTrafico({ resumen }: { resumen: Resumen | null }) {
  const items: { label: string; data?: PeriodoResumen }[] = [
    { label: "Hoy", data: resumen?.hoy },
    { label: "Ayer", data: resumen?.ayer },
    { label: "Últimos 7 días", data: resumen?.ultimos7 },
    { label: "Este mes", data: resumen?.mes },
    { label: "Este año", data: resumen?.anio },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl bg-[#f4f7fb] p-4">
          <p className="text-xs font-medium text-slate-500">{it.label}</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums mt-0.5">{it.data?.visitantes ?? "–"}</p>
          <p className="text-xs text-slate-500 tabular-nums">{it.data ? `${it.data.paginasVistas} páginas vistas` : " "}</p>
        </div>
      ))}
    </div>
  );
}

export default function StatisticsTab() {
  const [viewMode, setViewMode] = useState<"diario" | "mensual" | "anual">("mensual");

  // "Hoy" según el calendario de Paraguay (no el del navegador, por si la
  // computadora tiene otra zona horaria).
  const [todayStr] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" }));
  const currentDayStr = todayStr;
  const currentMonthStr = todayStr.slice(0, 7);
  const currentYearStr = todayStr.slice(0, 4);

  const [selectedDay, setSelectedDay] = useState(currentDayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [availableYears, setAvailableYears] = useState<number[]>([Number(currentYearStr)]);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [ingresosPorCategoria, setIngresosPorCategoria] = useState<CategoriaStat[]>([]);
  const [demandaPorCiudad, setDemandaPorCiudad] = useState<CiudadStat[]>([]);
  const [interes, setInteres] = useState<Interes | null>(null);
  const [busquedas, setBusquedas] = useState<Busquedas | null>(null);
  const [trafico, setTrafico] = useState<Trafico | null>(null);
  const [negocio, setNegocio] = useState<Negocio>({});
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [verTodos, setVerTodos] = useState(false);

  // Comparar en % contra el período anterior solo tiene sentido si el período
  // elegido ya terminó: uno a medias contra uno completo siempre daría una
  // caída engañosa.
  const periodoTerminado = viewMode === "diario" ? selectedDay < currentDayStr : viewMode === "mensual" ? selectedMonth < currentMonthStr : selectedYear < currentYearStr;
  const enCurso = !periodoTerminado;

  useEffect(() => {
    apiFetch('/analytics/years').then(async (res) => {
      if (res.ok) {
        const years = await res.json();
        if (Array.isArray(years) && years.length) setAvailableYears(years);
      }
    }).catch(() => {});
    apiFetch('/analytics/resumen').then(async (res) => {
      if (res.ok) setResumen(await res.json());
    }).catch(() => {});
  }, [reloadKey]);

  useEffect(() => {
    // Si el usuario cambia de filtro rápido, las respuestas pueden llegar en
    // otro orden del que se pidieron. Cancelamos la petición anterior (y
    // ignoramos su resultado) para que solo se muestre lo del filtro actual.
    const controller = new AbortController();

    const fetchAnalytics = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        let url = `/analytics/dashboard`;
        if (viewMode === "diario") {
          const [y, m, d] = selectedDay.split('-');
          url += `?year=${y}&month=${m}&day=${d}`;
        } else if (viewMode === "mensual") {
          const [y, m] = selectedMonth.split('-');
          url += `?year=${y}&month=${m}`;
        } else {
          url += `?year=${selectedYear}`;
        }

        const res = await apiFetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          if (controller.signal.aborted) return;
          setKpis(data.kpis);
          setChartData(data.chartData);
          setIngresosPorCategoria(data.ingresosPorCategoria);
          setDemandaPorCiudad(data.demandaPorCiudad);
          setInteres(data.interes ?? null);
          setBusquedas(data.busquedas ?? null);
          setTrafico(data.trafico ?? null);
          setNegocio({
            kpisAnteriores: data.kpisAnteriores,
            clientes: data.clientes,
            ingresosMensuales: data.ingresosMensuales,
            rendimientoProductos: data.rendimientoProductos,
            diasSemana: data.diasSemana,
            anticipacion: data.anticipacion,
            pedidosSinCerrar: data.pedidosSinCerrar,
          });
        } else {
          setLoadError(true);
        }
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchAnalytics();
    return () => controller.abort();
  }, [viewMode, selectedDay, selectedMonth, selectedYear, reloadKey]);

  // Nombre del período elegido y del anterior, para los textos.
  const [selY, selM] = selectedMonth.split("-").map(Number);
  const comparadoCon = viewMode === "diario"
    ? "el día anterior"
    : viewMode === "mensual"
      ? MESES[(selM + 10) % 12]
      : String(Number(selectedYear) - 1);

  const prev = negocio.kpisAnteriores;
  const spark = (pick: (p: ChartPoint) => number) => (chartData.length > 1 ? chartData.map(pick) : undefined);
  const busy = isLoading ? "opacity-50" : "";

  // Ingresos por mes del año (barras): el año elegido contra el anterior.
  const mensuales = negocio.ingresosMensuales;
  const [curY, curM] = currentMonthStr.split("-").map(Number);
  const datosMensuales = mensuales
    ? MESES_CORTOS.map((name, i) => ({
        name,
        actual: mensuales.actual[i],
        anterior: mensuales.anterior[i],
        // Meses que todavía no terminaron: lo que hay es lo ya reservado.
        futuro: mensuales.anio > curY || (mensuales.anio === curY && i + 1 >= curM),
      }))
    : [];

  const productos = negocio.rendimientoProductos ?? [];
  const productosVisibles = verTodos ? productos : productos.slice(0, 8);
  const fuentesTotal = (trafico?.fuentes ?? []).reduce((a, f) => a + f.cantidad, 0);
  const dispositivosTotal = (trafico?.dispositivos ?? []).reduce((a, f) => a + f.cantidad, 0);
  const maxDia = Math.max(1, ...(negocio.diasSemana ?? [0]));
  const maxAnt = Math.max(1, ...(negocio.anticipacion ?? []).map((a) => a.pct));
  const maxZona = Math.max(1, ...demandaPorCiudad.map((c) => c.ingresos));
  const maxCat = Math.max(1, ...ingresosPorCategoria.map((c) => c.ingresos));
  const visitas = kpis?.totalVisitas ?? 0;

  const periodButtons: { id: typeof viewMode; label: string }[] = [
    { id: "diario", label: "Día" }, { id: "mensual", label: "Mes" }, { id: "anual", label: "Año" },
  ];

  return (
    <div className="flex flex-col gap-5 sm:gap-6">

      {/* PERÍODO */}
      <div className="flex flex-wrap items-center gap-3 relative">
        <div role="group" aria-label="Período" className="inline-flex p-1 bg-slate-200/70 rounded-xl">
          {periodButtons.map((b) => (
            <button key={b.id} type="button" onClick={() => setViewMode(b.id)} aria-pressed={viewMode === b.id}
              className={`min-h-9 px-4 rounded-[9px] text-[13px] font-bold transition-all cursor-pointer ${viewMode === b.id ? "bg-white text-[#004080] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#004080] pointer-events-none" />
          {viewMode === "diario" ? (
            <input type="date" aria-label="Día a consultar" value={selectedDay} max={currentDayStr} onChange={(e) => { if (e.target.value) setSelectedDay(e.target.value); }} className="min-h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#004080] focus:outline-none cursor-pointer" />
          ) : viewMode === "mensual" ? (
            <input type="month" aria-label="Mes a consultar" value={selectedMonth} onChange={(e) => { if (e.target.value) setSelectedMonth(e.target.value); }} className="min-h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#004080] focus:outline-none cursor-pointer" />
          ) : (
            <select aria-label="Año a consultar" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="min-h-11 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#004080] focus:outline-none cursor-pointer appearance-none">
              {availableYears.map((y) => (<option key={y} value={y}>Año {y}</option>))}
            </select>
          )}
        </div>
        <span className="text-xs text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-2">
          {enCurso ? "Período en curso" : `Comparado con ${comparadoCon}`}
        </span>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-[#004080]" aria-label="Cargando" />}
      </div>

      {loadError && !isLoading && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl">
          <p className="flex-1 text-sm font-medium">No se pudieron cargar las estadísticas de este período. Lo que ves abajo puede ser del período anterior.</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 cursor-pointer">Reintentar</button>
        </div>
      )}

      {/* INDICADORES */}
      <section aria-label="Indicadores principales" aria-busy={isLoading} className={`grid grid-cols-[repeat(auto-fit,minmax(min(100%,12.5rem),1fr))] gap-4 transition-opacity ${busy}`}>
        <KpiCard label="Ingresos" value={formatPYG(kpis?.totalIngresos ?? 0)} delta={<DeltaChip current={kpis?.totalIngresos ?? 0} previous={prev?.totalIngresos} enCurso={enCurso} />} spark={spark((p) => p.ingresos)} />
        <KpiCard label="Alquileres confirmados" value={String(kpis?.totalAlquileres ?? 0)} delta={<DeltaChip current={kpis?.totalAlquileres ?? 0} previous={prev?.totalAlquileres} enCurso={enCurso} />} spark={spark((p) => p.pedidos)} />
        <KpiCard label="Ticket promedio" value={formatPYG(kpis?.ticketPromedio ?? 0)} delta={<DeltaChip current={kpis?.ticketPromedio ?? 0} previous={prev?.ticketPromedio} enCurso={enCurso} />} spark={spark((p) => (p.pedidos ? p.ingresos / p.pedidos : 0))} />
        <KpiCard label="Visitantes del sitio" value={String(visitas)} delta={<DeltaChip current={visitas} previous={prev?.totalVisitas ?? kpis?.totalVisitasAnterior} enCurso={enCurso} />} spark={spark((p) => p.visitas)} />
        <KpiCard
          label="Clientes que repiten"
          value={negocio.clientes ? `${Math.round(negocio.clientes.pct)}%` : "–"}
          delta={negocio.clientes ? <DeltaChip current={negocio.clientes.pct} previous={prev?.clientesRepitenPct} enCurso={enCurso} points /> : null}
          note={negocio.clientes ? `${negocio.clientes.repiten} de ${negocio.clientes.total} ya te habían alquilado antes` : undefined}
        />
      </section>

      {/* INGRESOS POR MES + EMBUDO */}
      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="mes-t" className={`${CARD} flex-[3_1_34rem] min-w-0 flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <h2 id="mes-t" className={`${H2} flex-[1_1_14rem]`}>Ingresos por mes · {mensuales?.anio ?? selY}</h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700"><span className="w-3 h-3 rounded-[3px] bg-[#004080]" />{mensuales?.anio ?? selY}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700"><span className="w-3 h-3 rounded-[3px] bg-[#cbd5e1]" />{(mensuales?.anio ?? selY) - 1}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700"><span className="w-3 h-3 rounded-[3px] bg-[#7aa7d9]" />En curso / reservado</span>
          </div>
          <div className={`h-72 w-full transition-opacity ${busy}`}>
            {datosMensuales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosMensuales} barGap={2} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} width={54} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={formatEje} />
                  <Tooltip
                    cursor={{ fill: "#f4f7fb" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)" }}
                    formatter={(value, key) => [formatPYG(Number(value) || 0), key === "actual" ? String(mensuales?.anio) : String((mensuales?.anio ?? 0) - 1)]}
                  />
                  <Bar dataKey="anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={18}>
                    {datosMensuales.map((d) => <Cell key={d.name} fill={d.futuro ? "#7aa7d9" : "#004080"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="h-full flex items-center justify-center text-sm text-slate-500">Sin datos todavía.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="emb-t" aria-busy={isLoading} className={`${CARD} flex-[2_1_22rem] min-w-0 flex flex-col gap-3.5 transition-opacity ${busy}`}>
          <h2 id="emb-t" className={H2}>De visitante a cliente</h2>
          {[
            { label: "Visitantes", value: visitas, step: null as string | null, width: 100, color: "#9cc0e6", icon: Users },
            { label: "Pidieron por WhatsApp", value: kpis?.totalPedidosWhatsapp ?? 0, step: kpis ? `${formatPct(kpis.tasaVisitaPedido)} de las visitas` : null, width: visitas ? ((kpis?.totalPedidosWhatsapp ?? 0) / visitas) * 100 : 0, color: "#3b78c0", icon: Send },
            { label: "Alquiler confirmado", value: kpis?.totalAlquileres ?? 0, step: kpis ? `${formatPct(kpis.tasaPedidoAlquiler)} de los pedidos` : null, width: visitas ? ((kpis?.totalAlquileres ?? 0) / visitas) * 100 : 0, color: "#00294f", icon: ArrowRight },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-bold text-slate-900 inline-flex items-center gap-1.5"><s.icon className="w-4 h-4 text-[#004080]" strokeWidth={1.75} aria-hidden="true" />{s.label}</span>
                <span className="text-slate-700 text-right"><b className="text-base text-slate-900 tabular-nums">{s.value}</b>{s.step && <span className="text-xs"> · {s.step}</span>}</span>
              </div>
              <div className="h-7 rounded-lg bg-slate-100 overflow-hidden">
                <div className="h-full rounded-lg" style={{ width: `${Math.max(Math.min(s.width, 100), s.value ? 3 : 0)}%`, background: s.color }} />
              </div>
            </div>
          ))}
          {(negocio.pedidosSinCerrar ?? 0) > 0 && (
            <div className="flex gap-3 items-start px-3.5 py-3 rounded-2xl bg-[#fef3c7]">
              <span className="w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 bg-[#b45309]" aria-hidden="true" />
              <p className="text-[13px] text-[#422006]"><b>{negocio.pedidosSinCerrar} {negocio.pedidosSinCerrar === 1 ? "pedido no se cerró" : "pedidos no se cerraron"}</b> (descartados o todavía sin respuesta).</p>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-auto">
            El último tramo depende de que cada venta cerrada por WhatsApp se cargue como alquiler en el panel: es una tasa aproximada.
          </p>
        </section>
      </div>

      {/* RENDIMIENTO POR PRODUCTO */}
      <section aria-labelledby="prod-t" aria-busy={isLoading} className={`${CARD} flex flex-col gap-3 transition-opacity ${busy}`}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="prod-t" className={`${H2} flex-[1_1_14rem]`}>Rendimiento por producto</h2>
          <p className="text-xs text-slate-500">Qué conviene comprar más y qué está ocupando lugar en el depósito</p>
        </div>
        {productos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Sin datos de productos para este período.</p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-184 border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-3 py-2.5 border-b border-slate-200 font-bold">Producto</th>
                    <th scope="col" className="px-3 py-2.5 border-b border-slate-200 font-bold w-[26%]" title="Unidades × días alquilados sobre todo el stock del período">Ocupación</th>
                    <th scope="col" className="px-3 py-2.5 border-b border-slate-200 font-bold text-right" title="El día de más demanda: qué parte del stock salió">Pico</th>
                    <th scope="col" className="px-3 py-2.5 border-b border-slate-200 font-bold text-right">Alquileres</th>
                    <th scope="col" className="px-3 py-2.5 border-b border-slate-200 font-bold text-right">Ingresos</th>
                    <th scope="col" className="px-3 py-2.5 border-b border-slate-200 font-bold text-right" title="Ingresos del período divididos por las unidades que tenés">Por unidad</th>
                    <th scope="col" className="px-3 py-2.5 border-b border-slate-200 font-bold">Sugerencia</th>
                  </tr>
                </thead>
                <tbody>
                  {productosVisibles.map((p) => {
                    const sug = p.sugerencia ? SUGERENCIAS[p.sugerencia] : null;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <th scope="row" className="px-3 py-3 border-b border-slate-100 text-left font-bold text-slate-900">
                          {p.nombre}
                          <span className="block text-[11px] font-normal text-slate-500">{p.stock} u. en stock{p.archivado ? " · dado de baja" : ""}</span>
                        </th>
                        <td className="px-3 py-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                              <div className="h-full rounded" style={{ width: `${Math.min(100, Math.max(p.ocupacionPct > 0 ? 2 : 0, p.ocupacionPct))}%`, background: occColor(p.ocupacionPct) }} />
                            </div>
                            <span className="w-11 text-right font-bold tabular-nums">{Math.round(p.ocupacionPct)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 border-b border-slate-100 text-right tabular-nums" title={p.picoFecha ? `El ${p.picoFecha.split("-").reverse().join("/")}` : undefined}>{Math.round(p.picoPct)}%</td>
                        <td className="px-3 py-3 border-b border-slate-100 text-right tabular-nums">{p.veces}<span className="text-xs text-slate-500"> · {p.unidades} u.</span></td>
                        <td className="px-3 py-3 border-b border-slate-100 text-right font-bold tabular-nums">{formatPYG(p.ingresos)}</td>
                        <td className="px-3 py-3 border-b border-slate-100 text-right text-slate-700 tabular-nums">{p.stock ? formatPYG(p.ingresoPorUnidad) : "—"}</td>
                        <td className="px-3 py-3 border-b border-slate-100">
                          {sug ? <span title={sug.title} className={`inline-flex items-center min-h-6.5 px-2.5 rounded-full text-xs font-bold whitespace-nowrap ${sug.cls}`}>{sug.label}</span> : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {productos.length > 8 && (
              <button type="button" onClick={() => setVerTodos((v) => !v)} className="self-start min-h-11 text-sm font-bold text-[#004080] hover:text-[#00294f] cursor-pointer">
                {verTodos ? "Ver menos" : `Ver los ${productos.length} productos`}
              </button>
            )}
          </>
        )}
      </section>

      {/* DÍAS, ANTICIPACIÓN, ZONAS */}
      <div aria-busy={isLoading} className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 transition-opacity ${busy}`}>
        <section aria-labelledby="dias-t" className={`${CARD} flex flex-col gap-3`}>
          <h2 id="dias-t" className={H2}>¿Qué día son los eventos?</h2>
          {(kpis?.totalAlquileres ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin alquileres en este período.</p>
          ) : (
            <div className="flex items-end gap-2 h-44 pt-2" role="img" aria-label={DIAS_SEMANA.map((d, i) => `${d} ${Math.round(negocio.diasSemana?.[i] ?? 0)}%`).join(", ")}>
              {DIAS_SEMANA.map((d, i) => {
                const v = negocio.diasSemana?.[i] ?? 0;
                return (
                  <div key={d} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{Math.round(v)}%</span>
                    <div className="w-full max-w-9 rounded-t-md rounded-b-sm" style={{ height: `${Math.max(2, (v / maxDia) * 110)}px`, background: v >= 30 ? "#00294f" : v >= 12 ? "#004080" : "#9cc0e6" }} />
                    <span className="text-xs text-slate-600">{d}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="ant-t" className={`${CARD} flex flex-col gap-3`}>
          <h2 id="ant-t" className={H2}>¿Con cuánta anticipación reservan?</h2>
          {(kpis?.totalAlquileres ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin alquileres en este período.</p>
          ) : (
            <>
              {(negocio.anticipacion ?? []).map((a) => (
                <div key={a.label} className="flex items-center gap-2.5 text-[13px]" title={`${a.count} ${a.count === 1 ? "alquiler" : "alquileres"}`}>
                  <span className="w-28 text-slate-700 shrink-0">{a.label}</span>
                  <div className="flex-1 h-4.5 rounded-[5px] bg-slate-100 overflow-hidden"><div className="h-full rounded-[5px] bg-[#3b78c0]" style={{ width: `${(a.pct / maxAnt) * 100}%` }} /></div>
                  <span className="w-10 text-right font-bold tabular-nums">{Math.round(a.pct)}%</span>
                </div>
              ))}
              <p className="text-xs text-slate-500">Promedio: {formatDias(kpis?.anticipacionPromedioDias ?? 0)} entre que se carga el alquiler y el evento.</p>
            </>
          )}
        </section>

        <section aria-labelledby="zon-t" className={`${CARD} flex flex-col gap-3 md:col-span-2 xl:col-span-1`}>
          <h2 id="zon-t" className={`${H2} flex items-center gap-2`}><MapPin className="w-5 h-5 text-[#004080]" strokeWidth={1.75} aria-hidden="true" />Demanda por zona</h2>
          {demandaPorCiudad.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin alquileres en este período.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {demandaPorCiudad.slice(0, 6).map((c) => (
                <li key={c.ciudad} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-bold text-slate-900 truncate">{c.ciudad}</span>
                    <span className="text-slate-700 shrink-0">{c.alquileres} alq. · <b>{formatCorto(c.ingresos)}</b></span>
                  </div>
                  <div className="h-2 rounded bg-slate-100 overflow-hidden"><div className="h-full rounded bg-[#004080]" style={{ width: `${Math.max(2, (c.ingresos / maxZona) * 100)}%` }} /></div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* VISITAS */}
      <section aria-labelledby="vis-t" className={`${CARD} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="vis-t" className={`${H2} flex items-center gap-2`}><Users className="w-5 h-5 text-[#004080]" strokeWidth={1.75} aria-hidden="true" />Visitas al sitio</h2>
          <p className="text-xs text-slate-500">Visitantes = personas distintas por día · Páginas = todo lo que abrieron</p>
        </div>
        <ResumenTrafico resumen={resumen} />
        {viewMode !== "diario" && <VisitasChart data={chartData} mode={viewMode === "anual" ? "anual" : "mensual"} isLoading={isLoading} />}
      </section>

      {/* LO QUE MÁS QUIERE LA GENTE */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Lo que más quiere la gente</h2>
        <p className="text-slate-500 text-sm mt-1 mb-4">Qué productos miran, cuáles agregan a su cotización, cuáles piden por WhatsApp y para qué fechas consultan.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
          <BarList icon={<Eye className="w-5 h-5 mr-2 text-[#004080]" />} title="Más vistos" subtitle="Fichas de producto abiertas" rows={interes?.masVistos ?? []} unit="vistas" emptyLabel="Todavía no hay datos en este período." isLoading={isLoading} />
          <BarList icon={<ShoppingCart className="w-5 h-5 mr-2 text-[#004080]" />} title="Más agregados" subtitle="Veces que los sumaron a la cotización" rows={interes?.masAgregados ?? []} unit="veces" emptyLabel="Todavía no hay datos en este período." isLoading={isLoading} />
          <BarList icon={<Send className="w-5 h-5 mr-2 text-[#004080]" />} title="Más pedidos por WhatsApp" subtitle="Unidades pedidas en cotizaciones enviadas" rows={interes?.masPedidos ?? []} unit="u." emptyLabel="Todavía no hay pedidos en este período." isLoading={isLoading}
            extra={(r) => (r.pedidos ? `En ${r.pedidos} ${r.pedidos === 1 ? "pedido" : "pedidos"}` : null)} />
          <BarList icon={<CalendarDays className="w-5 h-5 mr-2 text-[#004080]" />} title="Fechas más consultadas" subtitle="Fechas de evento que buscaron o pidieron" rows={interes?.fechasConsultadas ?? []} unit="consultas" emptyLabel="Nadie consultó fechas en este período." isLoading={isLoading} />
        </div>
      </div>

      {/* QUÉ BUSCA LA GENTE */}
      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="bus-t" aria-busy={isLoading} className={`${CARD} flex-[1_1_22rem] min-w-0 flex flex-col gap-3 transition-opacity ${busy}`}>
          <h2 id="bus-t" className={`${H2} flex items-center gap-2`}><SearchX className="w-5 h-5 text-[#004080]" strokeWidth={1.75} aria-hidden="true" />Buscaron y no encontraron</h2>
          <p className="text-[13px] text-slate-500">Ideas de productos para sumar, o palabras para agregar a las descripciones.</p>
          {(busquedas?.sinResultados ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Ninguna búsqueda quedó sin resultados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {busquedas?.sinResultados.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-2 min-h-8.5 px-3 rounded-full bg-slate-100 text-[13px] text-slate-900">
                  {s.nombre} <b className="text-[#004080] tabular-nums">{s.cantidad}</b>
                </span>
              ))}
            </div>
          )}
        </section>
        <div className="flex-[1_1_22rem] min-w-0">
          <BarList icon={<Search className="w-5 h-5 mr-2 text-[#004080]" />} title={`Búsquedas más frecuentes${busquedas ? ` · ${busquedas.total} en total` : ""}`} rows={busquedas?.conResultados ?? []} unit="veces" emptyLabel="Todavía no hay búsquedas en este período." isLoading={isLoading} />
        </div>
      </div>

      {/* DE DÓNDE LLEGAN */}
      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="tra-t" aria-busy={isLoading} className={`${CARD} flex-[1_1_22rem] min-w-0 flex flex-col gap-4 transition-opacity ${busy}`}>
          <h2 id="tra-t" className={`${H2} flex items-center gap-2`}><Globe className="w-5 h-5 text-[#004080]" strokeWidth={1.75} aria-hidden="true" />De dónde llegan</h2>
          {fuentesTotal === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Todavía no hay datos en este período.</p>
          ) : (
            <>
              <div className="flex h-9 rounded-[10px] overflow-hidden gap-0.75" role="img" aria-label={(trafico?.fuentes ?? []).map((f) => `${f.nombre} ${Math.round((f.cantidad / fuentesTotal) * 100)}%`).join(", ")}>
                {(trafico?.fuentes ?? []).map((f, i) => (
                  <div key={f.key} title={`${f.nombre}: ${f.cantidad}`} style={{ flex: `${f.cantidad} 1 0`, background: FUENTE_COLORES[i % FUENTE_COLORES.length] }} />
                ))}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                {(trafico?.fuentes ?? []).map((f, i) => (
                  <li key={f.key} className="flex items-center gap-2 text-sm min-w-0">
                    <span className="w-3 h-3 rounded-[3px] shrink-0 border border-slate-200" style={{ background: FUENTE_COLORES[i % FUENTE_COLORES.length] }} />
                    <span className="flex-1 text-slate-700 truncate" title={f.nombre}>{f.nombre}</span>
                    <b className="tabular-nums">{Math.round((f.cantidad / fuentesTotal) * 100)}%</b>
                  </li>
                ))}
              </ul>
              {dispositivosTotal > 0 && (
                <p className="flex flex-wrap gap-x-3 gap-y-1 pt-3 border-t border-slate-100 text-[13px] text-slate-700">
                  {(trafico?.dispositivos ?? []).map((d) => <span key={d.key}>{d.nombre} <b>{Math.round((d.cantidad / dispositivosTotal) * 100)}%</b></span>)}
                </p>
              )}
            </>
          )}
        </section>
        <div className="flex-[1_1_22rem] min-w-0">
          <BarList icon={<MessageCircle className="w-5 h-5 mr-2 text-[#004080]" />} title="Botones de WhatsApp más usados" subtitle="Sin contar las cotizaciones enviadas desde el carrito" rows={trafico?.whatsapp ?? []} unit="toques" emptyLabel="Nadie tocó WhatsApp en este período." isLoading={isLoading} />
        </div>
      </div>

      {/* MÁS DATOS DEL PERÍODO */}
      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="mas-t" aria-busy={isLoading} className={`${CARD} flex-[2_1_30rem] min-w-0 flex flex-col gap-3 transition-opacity ${busy}`}>
          <h2 id="mas-t" className={H2}>Más datos del período</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ["Duración promedio", formatDias(kpis?.duracionPromedioDias ?? 0)],
              ["Activos / devueltos", `${kpis?.alquileresActivos ?? 0} / ${kpis?.alquileresDevueltos ?? 0}`],
              ["Reservados (sin usar aún)", String(kpis?.alquileresReservados ?? 0)],
              ["Páginas vistas", `${kpis?.totalPaginasVistas ?? 0}${kpis?.paginasPorVisita ? ` · ${kpis.paginasPorVisita.toFixed(1)} x visita` : ""}`],
              ["Consultas por WhatsApp", String(kpis?.totalConsultasWhatsapp ?? 0)],
              ...(kpis?.manteles ? [["Alquileres sin manteles", `${kpis.manteles.sinManteles} de ${kpis.totalAlquileres}`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f4f7fb] px-3.5 py-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-base font-black text-slate-900 tabular-nums mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="cat-t" aria-busy={isLoading} className={`${CARD} flex-[1_1_20rem] min-w-0 flex flex-col gap-3 transition-opacity ${busy}`}>
          <h2 id="cat-t" className={`${H2} flex items-center gap-2`}><Tags className="w-5 h-5 text-[#004080]" strokeWidth={1.75} aria-hidden="true" />Ingresos por categoría</h2>
          {ingresosPorCategoria.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin alquileres en este período.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {ingresosPorCategoria.map((c) => (
                <li key={c.categoria} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-bold text-slate-900 truncate">{c.categoria}</span>
                    <span className="text-slate-700 shrink-0">{c.alquileres} u. · <b>{formatCorto(c.ingresos)}</b></span>
                  </div>
                  <div className="h-2 rounded bg-slate-100 overflow-hidden"><div className="h-full rounded bg-[#004080]" style={{ width: `${Math.max(2, (c.ingresos / maxCat) * 100)}%` }} /></div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
