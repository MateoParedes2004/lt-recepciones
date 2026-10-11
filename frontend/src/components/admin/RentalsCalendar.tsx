"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Rental, RentalPhase } from "../../types";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MAX_CHIPS_POR_DIA = 3;

// Mismos colores que PhaseBadge (arriba, en la vista de lista): un alquiler
// se ve igual sin importar en qué vista se lo mire.
const PHASE_STYLE: Record<RentalPhase, { chip: string; dot: string; label: string }> = {
  ATRASADO: { chip: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500", label: "Atrasado" },
  EN_USO: { chip: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500", label: "En uso" },
  RESERVADO: { chip: "bg-[#e8f0f8] text-[#004080] border-[#004080]/20", dot: "bg-[#004080]", label: "Reservado" },
  DEVUELTO: { chip: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", label: "Devuelto" },
  CANCELADO: { chip: "bg-slate-50 text-slate-400 border-slate-200 line-through", dot: "bg-slate-300", label: "Anulado" },
};

function phaseOf(r: Rental): RentalPhase {
  return r.phase ?? (r.status === "ACTIVO" ? "EN_USO" : r.status);
}

// Fechas de calendario puras (medianoche UTC por convención, igual que en
// el resto del panel): se comparan como días, nunca con hora/huso horario.
const toUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export default function RentalsCalendar({ rentals, onSelectRental }: { rentals: Rental[]; onSelectRental: (rental: Rental) => void }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11

  const goToMonth = (deltaMonths: number) => {
    const d = new Date(viewYear, viewMonth + deltaMonths, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  // Alquileres con sus fechas ya convertidas a "día UTC" (número comparable),
  // una sola vez por render en vez de recalcular por cada celda.
  const rentalSpans = useMemo(
    () =>
      rentals.map((r) => ({
        rental: r,
        start: toUtcDay(new Date(r.eventDate)),
        end: toUtcDay(new Date(r.returnDate)),
        phase: phaseOf(r),
      })),
    [rentals],
  );

  // Grilla de 6 semanas (42 días) empezando el lunes anterior (o el mismo
  // lunes) al día 1 del mes: así el mes queda completo sin cortar semanas,
  // igual en cualquier mes.
  const days = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
    // getUTCDay(): 0=domingo..6=sábado. Lo convertimos a "días desde el lunes".
    const offsetFromMonday = (firstOfMonth.getUTCDay() + 6) % 7;
    const gridStart = toUtcDay(firstOfMonth) - offsetFromMonday;
    return Array.from({ length: 42 }, (_, i) => gridStart + i * 86_400_000);
  }, [viewYear, viewMonth]);

  const todayUtcDay = toUtcDay(today);

  return (
    <div className="p-4 md:p-6">
      {/* NAVEGACIÓN DE MES */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900">{MESES[viewMonth]} {viewYear}</h3>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 text-xs font-bold text-[#004080] bg-[#e8f0f8] rounded-lg hover:bg-[#d3e3f2] cursor-pointer">Hoy</button>
          <button onClick={() => goToMonth(-1)} aria-label="Mes anterior" className="p-1.5 text-slate-500 hover:text-[#004080] hover:bg-slate-100 rounded-lg cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => goToMonth(1)} aria-label="Mes siguiente" className="p-1.5 text-slate-500 hover:text-[#004080] hover:bg-slate-100 rounded-lg cursor-pointer"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {/* REFERENCIA DE COLORES */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-500">
        {(Object.keys(PHASE_STYLE) as RentalPhase[]).map((phase) => (
          <span key={phase} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLE[phase].dot}`} /> {PHASE_STYLE[phase].label}
          </span>
        ))}
      </div>

      {/* ENCABEZADO DE DÍAS */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS.map((d) => (
          <div key={d} className="text-center text-[11px] font-bold text-slate-400 uppercase py-1">{d}</div>
        ))}
      </div>

      {/* GRILLA DEL MES */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((dayUtc) => {
          const d = new Date(dayUtc);
          const inMonth = d.getUTCMonth() === viewMonth;
          const isToday = dayUtc === todayUtcDay;
          const spans = rentalSpans.filter((s) => dayUtc >= s.start && dayUtc <= s.end);
          const visible = spans.slice(0, MAX_CHIPS_POR_DIA);
          const overflow = spans.length - visible.length;

          return (
            <div
              key={dayUtc}
              className={`min-h-20 md:min-h-24 rounded-lg border p-1 flex flex-col gap-0.5 ${inMonth ? "bg-white border-slate-100" : "bg-slate-50 border-slate-50"}`}
            >
              <span className={`text-[11px] font-bold self-end px-1.5 rounded-full ${isToday ? "bg-[#004080] text-white" : inMonth ? "text-slate-500" : "text-slate-300"}`}>
                {d.getUTCDate()}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {visible.map(({ rental, phase }) => (
                  <button
                    key={rental.id}
                    type="button"
                    onClick={() => onSelectRental(rental)}
                    title={`${rental.clientName} · ${PHASE_STYLE[phase].label}`}
                    className={`text-left text-[10px] font-bold px-1.5 py-0.5 rounded border truncate cursor-pointer hover:brightness-95 ${PHASE_STYLE[phase].chip}`}
                  >
                    {rental.clientName}
                  </button>
                ))}
                {overflow > 0 && <span className="text-[10px] text-slate-400 px-1.5">+{overflow} más</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
