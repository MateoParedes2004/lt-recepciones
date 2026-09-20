"use client";

import { useState, useEffect } from "react";
import {
  DollarSign, ShoppingBag, Users, Calendar, Filter, Loader2, Send, ArrowRight,
  Clock, Hourglass, MapPin, Tags, CheckCircle2, Wallet, TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, usePlotArea } from 'recharts';
import { apiFetch } from "../../lib/api";

const formatPYG = (amount: number) => `Gs. ${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const formatPct = (n: number) => `${n.toFixed(1)}%`;
// Nunca mostramos días negativos: un alquiler cargado después de la fecha del
// evento (carga retroactiva) daría una anticipación negativa sin sentido.
const formatDias = (n: number) => `${Math.max(0, n).toFixed(1)} días`;

// Colores fijos por serie/entidad — se reutilizan igual en el gráfico de
// actividad, el embudo y cualquier otro lugar que hable de la misma métrica,
// para que el color siempre identifique lo mismo en toda la pestaña.
const COLOR_VISITAS = "#a855f7"; // purple-500
const COLOR_PEDIDOS_WSP = "#14b8a6"; // teal-500
const COLOR_ALQUILERES = "#f59e0b"; // amber-500

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
  // En la vista anual el nombre trae el año ("Ene 2026"): en el eje sobra.
  const tickName = (name: string) => (mode === "anual" ? name.replace(/ \d{4}$/, "") : name);

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

      {/* Los mismos datos como tabla, para lectores de pantalla */}
      <table className="sr-only">
        <caption>Visitas al sitio por período, comparadas con el {anteriorLabel.toLowerCase()}</caption>
        <thead><tr><th scope="col">Período</th><th scope="col">Visitas</th><th scope="col">{anteriorLabel}</th></tr></thead>
        <tbody>
          {data.map((p) => (<tr key={p.name}><th scope="row">{p.name}</th><td>{p.visitas}</td><td>{p.visitasAnterior}</td></tr>))}
        </tbody>
      </table>
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
}

interface ProductoStat { id: number; nombre: string; alquileres: number; ingresos: number; }
interface CategoriaStat { categoria: string; alquileres: number; ingresos: number; }
interface CiudadStat { ciudad: string; alquileres: number; ingresos: number; }

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
  picoBucket: { name: string; ingresos: number } | null;
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
      <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: `${accent}1a`, color: accent }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function RankedTable({ icon, title, subtitle, rows, emptyLabel, unitLabel, isLoading }: {
  icon: React.ReactNode; title: string; subtitle?: string; isLoading: boolean;
  rows: { key: string; nombre: string; alquileres: number; ingresos: number }[];
  emptyLabel: string; unitLabel: string;
}) {
  return (
    <div aria-busy={isLoading} className={`bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 flex items-center">
          {icon} {title}
          {subtitle && <span className="text-slate-400 font-normal text-sm ml-2">{subtitle}</span>}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
              <th className="p-4 font-medium px-6">Posición</th>
              <th className="p-4 font-medium text-center">{unitLabel}</th>
              <th className="p-4 font-medium text-right px-6">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-8 text-slate-500">{emptyLabel}</td></tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.key} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>#{index + 1}</div>
                      <span className="font-semibold text-slate-900">{row.nombre}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center text-slate-600 font-medium tabular-nums">{row.alquileres}</td>
                  <td className="p-4 px-6 text-right font-bold text-emerald-600 tabular-nums">{formatPYG(row.ingresos)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StatisticsTab() {
  const [viewMode, setViewMode] = useState<"diario" | "mensual" | "anual">("mensual");

  const today = new Date();
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYearStr = String(today.getFullYear());

  const [selectedDay, setSelectedDay] = useState(currentDayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [availableYears, setAvailableYears] = useState<number[]>([today.getFullYear()]);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [topProductos, setTopProductos] = useState<ProductoStat[]>([]);
  const [ingresosPorCategoria, setIngresosPorCategoria] = useState<CategoriaStat[]>([]);
  const [demandaPorCiudad, setDemandaPorCiudad] = useState<CiudadStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Comparar en % contra el período anterior solo tiene sentido si el período
  // elegido ya terminó: un mes (o año) a medias contra uno completo siempre
  // daría una caída engañosa.
  const periodoTerminado = viewMode === "mensual" ? selectedMonth < currentMonthStr : selectedYear < currentYearStr;

  useEffect(() => {
    apiFetch('/analytics/years').then(async (res) => {
      if (res.ok) {
        const years = await res.json();
        if (Array.isArray(years) && years.length) setAvailableYears(years);
      }
    }).catch(() => {});
  }, []);

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
          setTopProductos(data.topProductos);
          setIngresosPorCategoria(data.ingresosPorCategoria);
          setDemandaPorCiudad(data.demandaPorCiudad);
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

      {/* CABECERA Y FILTROS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden">
        {isLoading && <div className="absolute top-0 left-0 w-full h-1 bg-blue-100"><div className="h-full bg-blue-600 animate-pulse w-1/3 rounded-r-full"></div></div>}

        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            Rendimiento del Negocio {isLoading && <Loader2 className="w-5 h-5 ml-3 animate-spin text-blue-600"/>}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Ingresos, productos, conversión de visitantes y demanda por zona.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 w-full lg:w-auto">
          <div className="flex items-center text-slate-500 font-medium text-sm px-2"><Filter className="w-4 h-4 mr-2" /> Filtrar por:</div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full sm:w-auto">
            <button onClick={() => setViewMode("diario")} aria-pressed={viewMode === "diario"} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${viewMode === "diario" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}>Día</button>
            <button onClick={() => setViewMode("mensual")} aria-pressed={viewMode === "mensual"} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${viewMode === "mensual" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}>Mes</button>
            <button onClick={() => setViewMode("anual")} aria-pressed={viewMode === "anual"} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${viewMode === "anual" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}>Año</button>
          </div>
          <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
          <div className="relative w-full sm:w-auto">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
            {viewMode === "diario" ? (
              <input type="date" aria-label="Día a consultar" value={selectedDay} onChange={(e) => { if (e.target.value) setSelectedDay(e.target.value); }} className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer w-full sm:w-auto shadow-sm" />
            ) : viewMode === "mensual" ? (
              <input type="month" aria-label="Mes a consultar" value={selectedMonth} onChange={(e) => { if (e.target.value) setSelectedMonth(e.target.value); }} className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer w-full sm:w-auto shadow-sm" />
            ) : (
              <select aria-label="Año a consultar" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer w-full sm:w-auto appearance-none shadow-sm">
                {availableYears.map((y) => (<option key={y} value={y}>Año {y}</option>))}
              </select>
            )}
          </div>
        </div>
      </div>

      {loadError && !isLoading && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl">
          <p className="flex-1 text-sm font-medium">No se pudieron cargar las estadísticas de este período. Lo que ves abajo puede ser del período anterior.</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 cursor-pointer">Reintentar</button>
        </div>
      )}

      {/* FILA DE KPIs */}
      <div aria-busy={isLoading} className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
        <StatTile icon={<Wallet className="w-5 h-5" />} label="Ingresos totales" value={formatPYG(kpis?.totalIngresos ?? 0)} accent="#059669" />
        <StatTile icon={<ShoppingBag className="w-5 h-5" />} label="Alquileres confirmados" value={String(kpis?.totalAlquileres ?? 0)} accent={COLOR_ALQUILERES} />
        <StatTile icon={<TrendingUp className="w-5 h-5" />} label="Ticket promedio" value={formatPYG(kpis?.ticketPromedio ?? 0)} accent="#2563eb" />
        <StatTile icon={<Users className="w-5 h-5" />} label="Visitas al sitio" value={String(kpis?.totalVisitas ?? 0)} accent={COLOR_VISITAS} />
        <StatTile icon={<Send className="w-5 h-5" />} label="Pedidos por WhatsApp" value={String(kpis?.totalPedidosWhatsapp ?? 0)} accent={COLOR_PEDIDOS_WSP} />
        <StatTile icon={<Clock className="w-5 h-5" />} label="Duración prom. de alquiler" value={formatDias(kpis?.duracionPromedioDias ?? 0)} accent="#0ea5e9" />
        <StatTile icon={<Hourglass className="w-5 h-5" />} label="Anticipación prom. de reserva" value={formatDias(kpis?.anticipacionPromedioDias ?? 0)} accent="#8b5cf6" />
        <StatTile icon={<CheckCircle2 className="w-5 h-5" />} label="Activos / Devueltos" value={`${kpis?.alquileresActivos ?? 0} / ${kpis?.alquileresDevueltos ?? 0}`} accent="#64748b" />
      </div>

      {/* EMBUDO DE CONVERSIÓN */}
      <div aria-busy={isLoading} className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Embudo: de visitante a cliente</h3>
        <p className="text-slate-500 text-xs mb-6">
          El último tramo depende de que cada venta cerrada por WhatsApp se cargue como alquiler en este panel — es una tasa aproximada, no una atribución exacta.
        </p>
        <div className="flex flex-col md:flex-row items-stretch gap-3">
          <div className="flex-1 rounded-2xl p-5 border" style={{ borderColor: `${COLOR_VISITAS}33`, backgroundColor: `${COLOR_VISITAS}0d` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: COLOR_VISITAS }}><Users className="w-5 h-5" /><span className="text-sm font-bold">Visitas</span></div>
            <p className="text-3xl font-bold text-slate-900">{kpis?.totalVisitas ?? 0}</p>
          </div>

          <div className="flex md:flex-col items-center justify-center px-2 gap-1 shrink-0">
            <ArrowRight className="w-5 h-5 text-slate-300 rotate-90 md:rotate-0" />
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{formatPct(kpis?.tasaVisitaPedido ?? 0)}</span>
          </div>

          <div className="flex-1 rounded-2xl p-5 border" style={{ borderColor: `${COLOR_PEDIDOS_WSP}33`, backgroundColor: `${COLOR_PEDIDOS_WSP}0d` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: COLOR_PEDIDOS_WSP }}><Send className="w-5 h-5" /><span className="text-sm font-bold">Pedidos por WhatsApp</span></div>
            <p className="text-3xl font-bold text-slate-900">{kpis?.totalPedidosWhatsapp ?? 0}</p>
          </div>

          <div className="flex md:flex-col items-center justify-center px-2 gap-1 shrink-0">
            <ArrowRight className="w-5 h-5 text-slate-300 rotate-90 md:rotate-0" />
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{formatPct(kpis?.tasaPedidoAlquiler ?? 0)}</span>
          </div>

          <div className="flex-1 rounded-2xl p-5 border" style={{ borderColor: `${COLOR_ALQUILERES}33`, backgroundColor: `${COLOR_ALQUILERES}0d` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: COLOR_ALQUILERES }}><ShoppingBag className="w-5 h-5" /><span className="text-sm font-bold">Alquileres confirmados</span></div>
            <p className="text-3xl font-bold text-slate-900">{kpis?.totalAlquileres ?? 0}</p>
          </div>
        </div>
      </div>

      {/* GRÁFICOS — con un solo día seleccionado un gráfico de un punto no
          aporta nada (ver KPIs y embudo arriba), así que se ocultan */}
      {viewMode !== "diario" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative">
            {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 rounded-3xl flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center"><DollarSign className="w-5 h-5 mr-2 text-emerald-500" /> Historial de Recaudación</h3>
              {kpis?.picoBucket && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                  Pico: {kpis.picoBucket.name} · {formatPYG(kpis.picoBucket.ingresos)}
                </span>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="none" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `Gs. ${value / 1000000}M`} />
                  <Tooltip formatter={(value) => [formatPYG(Number(value) || 0), "Ingresos"]} cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative">
            {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 rounded-3xl flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center"><Users className="w-5 h-5 mr-2 text-purple-500" /> Visitas al Sitio Web</h3>
              {kpis && (
                <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                  {kpis.totalVisitas} visitas
                  {kpis.totalVisitasAnterior > 0 && periodoTerminado
                    ? ` · ${kpis.totalVisitas >= kpis.totalVisitasAnterior ? "+" : ""}${Math.round(((kpis.totalVisitas - kpis.totalVisitasAnterior) / kpis.totalVisitasAnterior) * 100)}% vs ${viewMode === "mensual" ? "mes" : "año"} anterior`
                    : ""}
                </span>
              )}
            </div>
            <VisitasChart data={chartData} mode={viewMode === "anual" ? "anual" : "mensual"} isLoading={isLoading} />
          </div>
        </div>
      )}

      {/* TABLA DE PRODUCTOS TOP */}
      <RankedTable
        icon={<ShoppingBag className="w-5 h-5 mr-2 text-blue-500" />}
        title="Top 4 Productos por Ingresos"
        subtitle="(En el periodo seleccionado)"
        rows={topProductos.map((p) => ({ key: String(p.id), nombre: p.nombre, alquileres: p.alquileres, ingresos: p.ingresos }))}
        emptyLabel="No hay datos de alquileres para este periodo."
        unitLabel="Unidades alquiladas"
        isLoading={isLoading}
      />

      {/* NUEVAS SECCIONES: CATEGORÍA Y CIUDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankedTable
          icon={<Tags className="w-5 h-5 mr-2 text-indigo-500" />}
          title="Ingresos por Categoría"
          rows={ingresosPorCategoria.map((c) => ({ key: c.categoria, nombre: c.categoria, alquileres: c.alquileres, ingresos: c.ingresos }))}
          emptyLabel="No hay datos para este periodo."
          unitLabel="Unidades alquiladas"
          isLoading={isLoading}
        />
        <RankedTable
          icon={<MapPin className="w-5 h-5 mr-2 text-rose-500" />}
          title="Demanda por Ciudad"
          rows={demandaPorCiudad.map((c) => ({ key: c.ciudad, nombre: c.ciudad, alquileres: c.alquileres, ingresos: c.ingresos }))}
          emptyLabel="No hay datos para este periodo."
          unitLabel="Alquileres"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
