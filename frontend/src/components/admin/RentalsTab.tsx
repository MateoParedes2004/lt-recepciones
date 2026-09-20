"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, X, CheckCircle, CalendarDays, PlusCircle, MapPin, Pencil, Ban, RotateCcw, TriangleAlert } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { useToast } from "./ToastProvider";
import type { Product, Rental, City, RentalPhase } from "../../types";

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

// eventDate/returnDate son fechas de calendario puras (se eligen en un
// <input type="date"> y se guardan como medianoche UTC por convención, sin
// hora real asociada). Formatearlas con la hora local del navegador puede
// correrlas un día para atrás; forzamos timeZone: "UTC" para leer siempre
// la fecha tal cual se eligió.
const formatFechaCalendario = (iso: string) => new Date(iso).toLocaleDateString('es-PY', { timeZone: 'UTC' });
// La misma fecha en el formato que entiende un <input type="date"> (aaaa-mm-dd).
const toInputDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

// Los <input> entregan texto: la cantidad puede ser string mientras se edita.
interface RentalFormItem { productId: string; quantity: number | string }
interface RentalForm { clientName: string; clientPhone: string; cityId: string; eventDate: string; returnDate: string; items: RentalFormItem[] }

const EMPTY_FORM: RentalForm = { clientName: "", clientPhone: "", cityId: "", eventDate: "", returnDate: "", items: [{ productId: "", quantity: 1 }] };

// Filtros por etapa. El orden es el de las pastillas en pantalla.
type PhaseFilter = "TODOS" | RentalPhase;
const FILTERS: { key: PhaseFilter; label: string }[] = [
  { key: "TODOS", label: "Todos" },
  { key: "ATRASADO", label: "Atrasados" },
  { key: "EN_USO", label: "En uso" },
  { key: "RESERVADO", label: "Reservados" },
  { key: "DEVUELTO", label: "Devueltos" },
  { key: "CANCELADO", label: "Anulados" },
];

// Lo que necesita atención va primero: atrasados, en uso, próximos por fecha, y al final el historial.
const PHASE_ORDER: Record<RentalPhase, number> = { ATRASADO: 0, EN_USO: 1, RESERVADO: 2, DEVUELTO: 3, CANCELADO: 4 };

function PhaseBadge({ rental }: { rental: Rental }) {
  const phase = rental.phase ?? (rental.status === "ACTIVO" ? "EN_USO" : rental.status);
  switch (phase) {
    case "ATRASADO":
      return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-200 whitespace-nowrap">ATRASADO · {rental.daysOverdue} {rental.daysOverdue === 1 ? "día" : "días"}</span>;
    case "EN_USO":
      return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200 animate-pulse">EN USO</span>;
    case "RESERVADO":
      return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold border border-blue-200">RESERVADO</span>;
    case "DEVUELTO":
      return <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">DEVUELTO</span>;
    default:
      return <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold border border-slate-200">ANULADO</span>;
  }
}

export default function RentalsTab({ rentals, products, cities, fetchData, isLoadingData }: { rentals: Rental[], products: Product[], cities: City[], fetchData: () => void, isLoadingData: boolean }) {
  const toast = useToast();
  const [searchRental, setSearchRental] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("TODOS");
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [isSavingRental, setIsSavingRental] = useState(false);
  // null = alquiler nuevo; un id = editando ese alquiler.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rentalForm, setRentalForm] = useState<RentalForm>(EMPTY_FORM);
  // Unidades libres por producto durante TODAS las fechas elegidas en el formulario (null = todavía sin fechas).
  const [availability, setAvailability] = useState<Record<number, number> | null>(null);

  const editingRental = editingId !== null ? rentals.find((r) => r.id === editingId) ?? null : null;
  // Uno devuelto o anulado ya no ocupa stock: solo se corrigen sus datos de contacto.
  const scheduleLocked = !!editingRental && editingRental.status !== "ACTIVO";

  const phaseOf = (r: Rental): RentalPhase => r.phase ?? (r.status === "ACTIVO" ? "EN_USO" : r.status);
  const counts = useMemo(() => {
    const c: Record<PhaseFilter, number> = { TODOS: rentals.length, ATRASADO: 0, EN_USO: 0, RESERVADO: 0, DEVUELTO: 0, CANCELADO: 0 };
    for (const r of rentals) c[r.phase ?? (r.status === "ACTIVO" ? "EN_USO" : r.status)] += 1;
    return c;
  }, [rentals]);

  const visibleRentals = useMemo(() => {
    const term = searchRental.toLowerCase();
    return rentals
      .filter((r) => r.clientName.toLowerCase().includes(term))
      .filter((r) => phaseFilter === "TODOS" || (r.phase ?? (r.status === "ACTIVO" ? "EN_USO" : r.status)) === phaseFilter)
      .sort((a, b) => {
        const pa = PHASE_ORDER[a.phase ?? (a.status === "ACTIVO" ? "EN_USO" : a.status)];
        const pb = PHASE_ORDER[b.phase ?? (b.status === "ACTIVO" ? "EN_USO" : b.status)];
        if (pa !== pb) return pa - pb;
        // Dentro de lo vigente, el que llega primero arriba; en el historial, lo más reciente arriba.
        return pa <= PHASE_ORDER.RESERVADO ? a.eventDate.localeCompare(b.eventDate) : b.createdAt.localeCompare(a.createdAt);
      });
  }, [rentals, searchRental, phaseFilter]);

  // Productos del selector: los del catálogo + los que ya tiene el alquiler que se edita
  // (aunque hayan sido dados de baja después, para no perderlos al editar).
  const productOptions = useMemo(() => {
    const list: { id: number; name: string; pricePerDay: number; totalStock: number; archived: boolean }[] =
      products.map((p) => ({ id: p.id, name: p.name, pricePerDay: p.pricePerDay, totalStock: p.totalStock, archived: false }));
    for (const item of editingRental?.items ?? []) {
      if (item.product && !list.some((p) => p.id === item.productId)) {
        list.push({ id: item.productId, name: item.product.name, pricePerDay: item.product.pricePerDay, totalStock: item.product.totalStock, archived: true });
      }
    }
    return list;
  }, [products, editingRental]);

  // Disponibilidad real para las fechas elegidas. El propio alquiler que se
  // edita no cuenta como ocupación (excludeRentalId), y se ignora una respuesta
  // vieja si las fechas cambiaron mientras esperábamos.
  const { eventDate, returnDate } = rentalForm;
  useEffect(() => {
    const controller = new AbortController();
    const valid = isRentalModalOpen && !scheduleLocked && eventDate && returnDate && returnDate >= eventDate;
    (async () => {
      if (!valid) { setAvailability(null); return; }
      try {
        const exclude = editingId !== null ? `&excludeRentalId=${editingId}` : "";
        const res = await apiFetch(`/rentals/availability?from=${eventDate}&to=${returnDate}${exclude}`, { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) return;
        const data: { products: { id: number; available: number }[] } = await res.json();
        setAvailability(Object.fromEntries(data.products.map((p) => [p.id, p.available])));
      } catch {
        // Sin conexión o petición cancelada: el servidor igual valida al guardar.
      }
    })();
    return () => controller.abort();
  }, [isRentalModalOpen, scheduleLocked, eventDate, returnDate, editingId]);

  const openNewRental = () => { setEditingId(null); setRentalForm(EMPTY_FORM); setAvailability(null); setIsRentalModalOpen(true); };
  const openEditRental = (r: Rental) => {
    setEditingId(r.id);
    setAvailability(null);
    setRentalForm({
      clientName: r.clientName,
      clientPhone: r.clientPhone ?? "",
      cityId: r.cityId ? String(r.cityId) : "",
      eventDate: toInputDate(r.eventDate),
      returnDate: toInputDate(r.returnDate),
      items: r.items.map((i) => ({ productId: String(i.productId), quantity: i.quantity })),
    });
    setIsRentalModalOpen(true);
  };
  const closeRentalModal = () => { setIsRentalModalOpen(false); setEditingId(null); setRentalForm(EMPTY_FORM); setAvailability(null); };

  const addRentalItem = () => { setRentalForm({ ...rentalForm, items: [...rentalForm.items, { productId: "", quantity: 1 }] }); };
  const removeRentalItem = (index: number) => { const newItems = rentalForm.items.filter((_, i) => i !== index); setRentalForm({ ...rentalForm, items: newItems }); };
  const updateRentalItem = (index: number, field: "productId" | "quantity", value: string | number) => {
    const newItems = rentalForm.items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    setRentalForm({ ...rentalForm, items: newItems });
  };

  // Cantidad pedida por producto (si el mismo producto está en dos filas se suman).
  const requestedByProduct = useMemo(() => {
    const m = new Map<number, number>();
    for (const item of rentalForm.items) {
      if (!item.productId) continue;
      const id = parseInt(item.productId);
      m.set(id, (m.get(id) ?? 0) + (Number(item.quantity) || 0));
    }
    return m;
  }, [rentalForm.items]);

  const handleSaveRental = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduleLocked) {
      if (new Date(rentalForm.returnDate) < new Date(rentalForm.eventDate)) {
        toast.error("La fecha de devolución no puede ser anterior a la fecha del evento.");
        return;
      }

      // Aviso rápido con la disponibilidad ya calculada para esas fechas; la
      // decisión final la toma el servidor de forma atómica al guardar.
      if (availability) {
        for (const [productId, quantity] of requestedByProduct) {
          const free = availability[productId];
          const name = productOptions.find((p) => p.id === productId)?.name ?? "el producto";
          if (free !== undefined && quantity > free) {
            toast.error(`No hay suficiente stock de "${name}" en esas fechas: pediste ${quantity} y solo hay ${free} libres.`);
            return;
          }
        }
      }
    }

    setIsSavingRental(true);
    try {
      const contact = {
        clientName: rentalForm.clientName,
        clientPhone: rentalForm.clientPhone,
        // Al editar, "Sin especificar" se envía como null para poder quitar la ciudad.
        cityId: rentalForm.cityId ? parseInt(rentalForm.cityId) : editingId !== null ? null : undefined,
      };
      const schedule = scheduleLocked ? {} : {
        eventDate: new Date(rentalForm.eventDate).toISOString(),
        returnDate: new Date(rentalForm.returnDate).toISOString(),
        items: rentalForm.items.map((item) => ({ productId: parseInt(item.productId), quantity: parseInt(item.quantity.toString()) })),
      };

      const res = await apiFetch(editingId !== null ? `/rentals/${editingId}` : "/rentals", {
        method: editingId !== null ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, ...schedule }),
      });
      if (res.ok) {
        closeRentalModal();
        fetchData();
        toast.success(editingId !== null ? "Alquiler actualizado." : "Alquiler registrado: el stock quedó reservado para esas fechas.");
      } else {
        toast.error(`No se pudo ${editingId !== null ? "guardar el alquiler" : "crear el alquiler"}: ${await readApiError(res)}`);
      }
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); } finally { setIsSavingRental(false); }
  };

  // Devolver, anular y reabrir no tocan contadores: el servidor calcula la
  // disponibilidad desde el estado de cada alquiler, así que solo cambia el estado.
  const changeStatus = async (r: Rental, action: "return" | "cancel" | "reopen") => {
    const texts = {
      return: { confirm: "¿Confirmás que el cliente devolvió todos los productos? Las unidades quedan libres de nuevo.", ok: "Devolución registrada: las unidades quedaron libres.", fail: "No se pudo registrar la devolución" },
      cancel: { confirm: `¿Anular el alquiler de ${r.clientName}? Las unidades reservadas quedan libres y el alquiler deja de contar en las estadísticas.`, ok: "Alquiler anulado: las unidades quedaron libres.", fail: "No se pudo anular el alquiler" },
      reopen: { confirm: `¿Reabrir el alquiler de ${r.clientName}? Vuelve a ocupar sus unidades (se comprueba que sigan libres).`, ok: "Alquiler reabierto.", fail: "No se pudo reabrir el alquiler" },
    }[action];
    if (!window.confirm(texts.confirm)) return;
    try {
      const res = action === "return"
        ? await apiFetch(`/rentals/${r.id}/return`, { method: "PUT" })
        : await apiFetch(`/rentals/${r.id}/${action}`, { method: "PATCH" });
      if (res.ok) { fetchData(); toast.success(texts.ok); }
      else toast.error(`${texts.fail}: ${await readApiError(res)}`);
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Buscar cliente..." aria-label="Buscar cliente" value={searchRental} onChange={(e) => setSearchRental(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none w-full sm:w-64" />
        </div>
        <button onClick={openNewRental} className="flex items-center bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-md cursor-pointer">
          <Plus className="w-5 h-5 mr-2" /> Nuevo Alquiler
        </button>
      </div>

      {/* Aviso de atrasos: la mercadería debería haber vuelto y sigue ocupando stock */}
      {counts.ATRASADO > 0 && (
        <div role="alert" className="mx-6 mt-5 flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl">
          <TriangleAlert className="w-5 h-5 shrink-0 text-red-500" />
          <p className="flex-1 text-sm font-medium">
            {counts.ATRASADO === 1 ? "Hay 1 alquiler atrasado" : `Hay ${counts.ATRASADO} alquileres atrasados`}: la fecha de devolución ya pasó y no se marcaron como devueltos. Mientras tanto siguen ocupando stock.
          </p>
          {phaseFilter !== "ATRASADO" && (
            <button onClick={() => setPhaseFilter("ATRASADO")} className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 cursor-pointer">Ver atrasados</button>
          )}
        </div>
      )}

      {/* Filtros por etapa */}
      <div className="px-6 pt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setPhaseFilter(f.key)}
            aria-pressed={phaseFilter === f.key}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
              phaseFilter === f.key
                ? "bg-blue-900 text-white border-blue-900"
                : f.key === "ATRASADO" && counts.ATRASADO > 0
                  ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label} <span className="opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Cliente & Evento</th>
              <th className="px-6 py-4 font-medium">Productos Llevados</th>
              <th className="px-6 py-4 font-medium">Total</th>
              <th className="px-6 py-4 font-medium">Estado</th>
              <th className="px-6 py-4 font-medium text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingData ? <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando...</td></tr> :
             visibleRentals.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-slate-500"><CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3"/>{rentals.length === 0 ? "No hay alquileres." : "No hay alquileres con ese filtro."}</td></tr> :
             visibleRentals.map((rental) => (
                <tr key={rental.id} className={`hover:bg-slate-50 transition-colors ${phaseOf(rental) === "ATRASADO" ? "bg-red-50/40" : ""}`}>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 text-lg">{rental.clientName}</p>
                    <p className="text-sm text-slate-500 mb-1">{rental.clientPhone || 'Sin teléfono'}</p>
                    {rental.city?.name && (
                      <p className="text-xs text-blue-700 mb-1 flex items-center"><MapPin className="w-3 h-3 mr-1" />{rental.city.name}</p>
                    )}
                    <div className="text-xs bg-slate-100 inline-block px-2 py-1 rounded text-slate-600">
                      <strong>Uso:</strong> {formatFechaCalendario(rental.eventDate)} <br/>
                      <strong>Devolución:</strong> {formatFechaCalendario(rental.returnDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <ul className="text-sm text-slate-600 space-y-1">
                      {rental.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="font-bold text-blue-900 bg-blue-50 px-1.5 rounded">{item.quantity}x</span>
                          <span className="truncate w-40 block">{item.product?.name || 'Producto borrado'}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={`px-6 py-4 font-bold ${rental.status === "CANCELADO" ? "text-slate-400 line-through" : "text-slate-900"}`}>{formatPYG(Number(rental.totalPrice))}</td>
                  <td className="px-6 py-4">
                    <PhaseBadge rental={rental} />
                    {rental.status === "DEVUELTO" && rental.returnedAt && (
                      <p className="text-xs text-slate-500 mt-1.5">Devuelto el {new Date(rental.returnedAt).toLocaleDateString('es-PY')}</p>
                    )}
                    {rental.status === "CANCELADO" && rental.cancelledAt && (
                      <p className="text-xs text-slate-500 mt-1.5">Anulado el {new Date(rental.cancelledAt).toLocaleDateString('es-PY')}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-end gap-2">
                      {rental.status === "ACTIVO" && (
                        <button onClick={() => changeStatus(rental, "return")} className="flex items-center justify-end w-full text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors cursor-pointer">
                          <CheckCircle className="w-4 h-4 mr-1" /> Marcar Devuelto
                        </button>
                      )}
                      {rental.status !== "ACTIVO" && (
                        <button onClick={() => changeStatus(rental, "reopen")} className="flex items-center justify-end w-full text-sm font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors cursor-pointer">
                          <RotateCcw className="w-4 h-4 mr-1" /> Reabrir
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditRental(rental)} aria-label={`Editar el alquiler de ${rental.clientName}`} title="Editar" className="p-2 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><Pencil className="w-4 h-4" /></button>
                        {rental.status === "ACTIVO" && (
                          <button onClick={() => changeStatus(rental, "cancel")} aria-label={`Anular el alquiler de ${rental.clientName}`} title="Anular" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"><Ban className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
             ))
            }
          </tbody>
        </table>
      </div>

      {isRentalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-xl font-bold text-slate-900 flex items-center"><CalendarDays className="w-6 h-6 mr-2 text-emerald-600"/> {editingId !== null ? "Editar Alquiler" : "Registrar Alquiler"}</h3>
              <button onClick={closeRentalModal} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 overflow-y-auto">
              {scheduleLocked && (
                <p className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
                  Este alquiler está {editingRental?.status === "DEVUELTO" ? "devuelto" : "anulado"}: solo se pueden corregir los datos del cliente. Para cambiar fechas o productos, reabrilo primero.
                </p>
              )}
              <form id="rentalForm" onSubmit={handleSaveRental} className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">1. Datos del Cliente y Fechas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label><input type="text" required value={rentalForm.clientName} onChange={(e) => setRentalForm({...rentalForm, clientName: e.target.value})} className="w-full px-4 py-2 border rounded-xl" placeholder="Ej. Juan Pérez" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label><input type="text" value={rentalForm.clientPhone} onChange={(e) => setRentalForm({...rentalForm, clientPhone: e.target.value})} className="w-full px-4 py-2 border rounded-xl" placeholder="09XX XXX XXX" /></div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad de Entrega</label>
                      <select value={rentalForm.cityId} onChange={(e) => setRentalForm({...rentalForm, cityId: e.target.value})} className="w-full px-4 py-2 border rounded-xl bg-white">
                        <option value="">Sin especificar</option>
                        {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha del Evento (Uso)</label><input type="date" required disabled={scheduleLocked} value={rentalForm.eventDate} onChange={(e) => setRentalForm({...rentalForm, eventDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl disabled:bg-slate-100 disabled:text-slate-500" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Devolución</label><input type="date" required disabled={scheduleLocked} min={rentalForm.eventDate || undefined} value={rentalForm.returnDate} onChange={(e) => setRentalForm({...rentalForm, returnDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl disabled:bg-slate-100 disabled:text-slate-500" /></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">2. Productos Solicitados</h4>
                    {!scheduleLocked && <button type="button" onClick={addRentalItem} className="text-sm font-bold text-blue-900 hover:text-blue-700 flex items-center bg-blue-50 px-3 py-1 rounded-lg cursor-pointer"><PlusCircle className="w-4 h-4 mr-1"/> Añadir Producto</button>}
                  </div>
                  {!scheduleLocked && (
                    <p className="text-xs text-slate-500 mb-3">
                      {availability ? "Se muestran las unidades libres durante TODAS las fechas elegidas." : "Elegí las fechas para ver cuántas unidades hay libres en ese período."}
                    </p>
                  )}

                  <div className="space-y-3">
                    {rentalForm.items.map((item, index) => {
                      const productId = item.productId ? parseInt(item.productId) : null;
                      const free = productId !== null && availability ? availability[productId] : undefined;
                      const requested = productId !== null ? requestedByProduct.get(productId) ?? 0 : 0;
                      const over = free !== undefined && requested > free;
                      return (
                        <div key={index} className={`bg-white p-3 border rounded-xl shadow-sm ${over ? "border-red-300" : "border-slate-200"}`}>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <select required disabled={scheduleLocked} value={item.productId} onChange={(e) => updateRentalItem(index, 'productId', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-sm disabled:bg-slate-100">
                                <option value="" disabled>Seleccionar producto...</option>
                                {productOptions.map(p => {
                                  const optFree = availability ? availability[p.id] : undefined;
                                  const unavailable = availability ? (optFree ?? 0) <= 0 : p.totalStock === 0;
                                  return (
                                    <option key={p.id} value={p.id} disabled={unavailable && String(p.id) !== item.productId}>
                                      {p.name}{p.archived ? " (dado de baja)" : ""} - {formatPYG(p.pricePerDay)} ({availability ? `Libres: ${optFree ?? 0}` : `Stock total: ${p.totalStock}`})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="w-24">
                              <input type="number" required min="1" disabled={scheduleLocked} placeholder="Cant." value={item.quantity} onChange={(e) => updateRentalItem(index, 'quantity', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-center font-bold disabled:bg-slate-100" />
                            </div>
                            {rentalForm.items.length > 1 && !scheduleLocked && (
                              <button type="button" onClick={() => removeRentalItem(index)} aria-label="Quitar este producto" title="Quitar este producto" className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 className="w-5 h-5"/></button>
                            )}
                          </div>
                          {over && (
                            <p role="alert" className="text-xs font-medium text-red-600 mt-2">
                              En esas fechas solo hay {free} libres y estás pidiendo {requested}.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/80">
              <button type="button" onClick={closeRentalModal} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl cursor-pointer">Cancelar</button>
              <button type="submit" form="rentalForm" disabled={isSavingRental} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md flex items-center cursor-pointer">
                {isSavingRental ? "Procesando..." : editingId !== null ? "Guardar Cambios" : "Confirmar y Reservar Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
