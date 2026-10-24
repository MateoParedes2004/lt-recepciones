'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Edit2, Save, X, MapPin, CheckCircle2, XCircle, Trash2, Plus, ArrowRightLeft, Calculator, ChevronDown } from 'lucide-react';
import { apiFetch, readApiError } from '../../lib/api';
import { quoteShipping } from '../../lib/shipping';
import type { City, ShippingSettings } from '../../types';
import { useToast } from './ToastProvider';

const formatGs = (n: number) => `Gs. ${Math.round(n).toLocaleString('es-PY')}`;
const formatKm = (km: number) => `${km.toLocaleString('es-PY', { maximumFractionDigits: 1 })} km`;

/** Cómo se muestra el precio de una ciudad (0 puede ser gratis o a coordinar). */
function priceLabel(city: City) {
    if (city.price > 0) return formatGs(city.price);
    return city.freeShipping ? 'Envío gratis' : 'A coordinar';
}

/** Precio que daría la fórmula para estos km, como texto. */
function quoteLabel(km: number, settings: ShippingSettings) {
    const q = quoteShipping(km, settings);
    if (q.kind === 'free') return 'Envío gratis';
    if (q.kind === 'coordinate') return 'A coordinar';
    return formatGs(q.price);
}

type SettingsDraft = Record<keyof ShippingSettings, string>;

const toDraft = (s: ShippingSettings): SettingsDraft => ({
    pricePerKm: String(s.pricePerKm),
    freeUnderKm: String(s.freeUnderKm),
    longDistanceFromKm: String(s.longDistanceFromKm),
    longDistancePricePerKm: String(s.longDistancePricePerKm),
    maxKm: s.maxKm === null ? '' : String(s.maxKm),
    roundTo: String(s.roundTo),
});

/** null si algún campo obligatorio está vacío o no es un número válido. */
function fromDraft(d: SettingsDraft): ShippingSettings | null {
    const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
    const s: ShippingSettings = {
        pricePerKm: num(d.pricePerKm),
        freeUnderKm: num(d.freeUnderKm),
        longDistanceFromKm: num(d.longDistanceFromKm),
        longDistancePricePerKm: num(d.longDistancePricePerKm),
        maxKm: d.maxKm.trim() === '' ? null : num(d.maxKm),
        roundTo: num(d.roundTo),
    };
    const values = [s.pricePerKm, s.freeUnderKm, s.longDistanceFromKm, s.longDistancePricePerKm, s.roundTo, s.maxKm ?? 0];
    if (values.some((v) => !Number.isFinite(v) || v < 0) || !Number.isInteger(s.roundTo)) return null;
    return s;
}

const EXAMPLE_KM = [5, 10, 15, 25, 35, 50];

// Recibe cities/fetchData del padre (admin/page.tsx) en vez de manejar su
// propio fetch: así una ciudad nueva o desactivada acá se refleja al toque
// en el selector de "Nuevo Alquiler" de RentalsTab, que usa ese mismo estado.
export default function CitiesTab({ cities, shippingSettings, fetchData, isLoadingData }: { cities: City[], shippingSettings: ShippingSettings | null, fetchData: () => void, isLoadingData: boolean }) {
    const toast = useToast();

    // 👇 AHORA TENEMOS DOS BUSCADORES INDEPENDIENTES
    const [activeSearch, setActiveSearch] = useState('');
    const [inactiveSearch, setInactiveSearch] = useState('');

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');
    const [editKm, setEditKm] = useState<string>('');
    const [editFromFormula, setEditFromFormula] = useState(false);

    const [isAdding, setIsAdding] = useState(false);
    const [newCityName, setNewCityName] = useState('');
    const [newCityPrice, setNewCityPrice] = useState<number>(0);
    const [newCityKm, setNewCityKm] = useState<string>('');

    // Fórmula de envío: borrador mientras se edita (null = tarjeta cerrada).
    const [formulaDraft, setFormulaDraft] = useState<SettingsDraft | null>(null);
    const [isSavingFormula, setIsSavingFormula] = useState(false);

    // Ventana "aplicar la fórmula": ids marcados (null = cerrada).
    const [applySelection, setApplySelection] = useState<Set<number> | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    // 👇 FILTRAMOS Y SEPARAMOS EN TIEMPO REAL CON SU RESPECTIVO BUSCADOR
    const activeCities = cities
        .filter(c => c.isActive)
        .filter(c => c.name.toLowerCase().includes(activeSearch.toLowerCase()));

    const inactiveCities = cities
        .filter(c => !c.isActive)
        .filter(c => c.name.toLowerCase().includes(inactiveSearch.toLowerCase()));

    // Ciudades activas con km cargados que todavía tienen el precio a mano.
    const formulaCandidates = cities
        .filter(c => c.isActive && c.distanceKm != null && !c.priceFromFormula)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    const handleAddCity = async () => {
        if (!newCityName.trim()) return toast.error("El nombre de la ciudad es obligatorio.");
        const km = newCityKm.trim() === '' ? null : Number(newCityKm);
        if (km !== null && (!Number.isFinite(km) || km < 0)) return toast.error("Los km tienen que ser un número positivo.");
        // Con km cargados y la fórmula disponible, el precio lo calcula la fórmula.
        const useFormula = km !== null && shippingSettings !== null;
        try {
            const response = await apiFetch('/cities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(useFormula
                    ? { name: newCityName, distanceKm: km, priceFromFormula: true }
                    : { name: newCityName, price: Number(newCityPrice), distanceKm: km }),
            });
            if (response.ok) {
                fetchData();
                setIsAdding(false); setNewCityName(''); setNewCityPrice(0); setNewCityKm('');
                toast.success(`Ciudad "${newCityName.trim()}" agregada.`);
            } else {
                toast.error(`No se pudo crear la ciudad: ${await readApiError(response)}`);
            }
        } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
    };

    const startEditing = (city: City) => {
        setEditingId(city.id);
        setEditPrice(String(city.price));
        setEditKm(city.distanceKm != null ? String(city.distanceKm) : '');
        setEditFromFormula(!!city.priceFromFormula);
    };

    const handleSaveCity = async (id: number) => {
        const km = editKm.trim() === '' ? null : Number(editKm);
        if (km !== null && (!Number.isFinite(km) || km < 0)) return toast.error("Los km tienen que ser un número positivo.");
        if (editFromFormula && km === null) return toast.error("Para calcular con la fórmula, cargá los km de la ciudad.");
        try {
            const response = await apiFetch(`/cities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFromFormula
                    ? { distanceKm: km, priceFromFormula: true }
                    : { distanceKm: km, priceFromFormula: false, price: Number(editPrice) || 0 }),
            });
            if (response.ok) { fetchData(); setEditingId(null); toast.success("Zona actualizada."); }
            else toast.error(`No se pudo guardar: ${await readApiError(response)}`);
        } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
    };

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        try {
            const response = await apiFetch(`/cities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentStatus }),
            });
            if (response.ok) fetchData();
            else toast.error(`No se pudo actualizar: ${await readApiError(response)}`);
        } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la ciudad "${name}"?`)) return;
        try {
            const response = await apiFetch(`/cities/${id}`, { method: 'DELETE' });
            if (response.ok) { fetchData(); toast.success(`Ciudad "${name}" eliminada.`); }
            else toast.error(`No se pudo eliminar: ${await readApiError(response)}`);
        } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
    };

    const draftSettings = formulaDraft ? fromDraft(formulaDraft) : null;
    // Ciudades que ya usan la fórmula y cambiarían de precio al guardar el borrador.
    const draftChanges = draftSettings
        ? cities.filter(c => c.priceFromFormula && c.distanceKm != null && quoteShipping(c.distanceKm, draftSettings).price !== c.price)
        : [];

    const handleSaveFormula = async () => {
        if (!draftSettings) return toast.error("Revisá la fórmula: todos los campos (salvo el límite) tienen que ser números positivos.");
        setIsSavingFormula(true);
        try {
            const response = await apiFetch('/shipping/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draftSettings),
            });
            if (response.ok) {
                const { recalculated } = await response.json() as { recalculated: number };
                fetchData();
                setFormulaDraft(null);
                toast.success(recalculated > 0 ? `Fórmula guardada: ${recalculated} ciudad(es) cambiaron de precio.` : "Fórmula guardada.");
            } else toast.error(`No se pudo guardar la fórmula: ${await readApiError(response)}`);
        } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
        finally { setIsSavingFormula(false); }
    };

    const openApply = () => {
        // Por defecto se marcan solo las que hoy están "a coordinar": un precio
        // que el admin puso a mano no se reemplaza sin que lo marque él.
        setApplySelection(new Set(formulaCandidates.filter(c => c.price === 0).map(c => c.id)));
    };

    const handleApplyFormula = async () => {
        if (!applySelection || applySelection.size === 0) return;
        setIsApplying(true);
        try {
            const response = await apiFetch('/cities/apply-formula', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [...applySelection] }),
            });
            if (response.ok) {
                const { applied } = await response.json() as { applied: number };
                fetchData();
                setApplySelection(null);
                toast.success(`Fórmula aplicada a ${applied} ciudad(es).`);
            } else toast.error(`No se pudo aplicar la fórmula: ${await readApiError(response)}`);
        } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
        finally { setIsApplying(false); }
    };

    if (isLoadingData) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando zonas de entrega...</div>;

    const totalActive = cities.filter(c => c.isActive).length;
    const totalInactive = cities.filter(c => !c.isActive).length;
    const totalFormula = cities.filter(c => c.priceFromFormula).length;

    const draftField = (key: keyof ShippingSettings, label: string, prefix: string, placeholder?: string) => (
        <div>
            <label className="block text-xs font-bold text-[#004080] mb-1 uppercase tracking-wider">{label}</label>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 focus-within:border-[#004080] focus-within:ring-1 focus-within:ring-[#004080] transition-all">
                <span className="text-sm font-medium text-slate-400">{prefix}</span>
                <input
                    type="number" min="0" step="any" placeholder={placeholder}
                    value={formulaDraft?.[key] ?? ''}
                    onChange={(e) => setFormulaDraft(d => d && { ...d, [key]: e.target.value })}
                    className="w-full py-2 bg-transparent outline-none text-slate-900"
                />
            </div>
        </div>
    );

    const applyModal = applySelection && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isApplying && setApplySelection(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Aplicar la fórmula de envío</h3>
                        <p className="text-sm text-slate-500 mt-1">Las ciudades marcadas pasan a calcular su precio con la fórmula y se actualizan solas si la cambiás. Las que tienen un precio puesto a mano no vienen marcadas.</p>
                    </div>
                    <button onClick={() => setApplySelection(null)} disabled={isApplying} aria-label="Cerrar" className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0 shadow-sm">
                            <tr className="text-xs uppercase text-slate-500">
                                <th className="px-4 py-2 w-10">
                                    <input
                                        type="checkbox" aria-label="Marcar todas"
                                        checked={applySelection.size === formulaCandidates.length}
                                        onChange={(e) => setApplySelection(new Set(e.target.checked ? formulaCandidates.map(c => c.id) : []))}
                                    />
                                </th>
                                <th className="px-2 py-2">Ciudad</th>
                                <th className="px-2 py-2 text-right">Distancia</th>
                                <th className="px-2 py-2 text-right">Hoy</th>
                                <th className="px-4 py-2 text-right">Con fórmula</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {formulaCandidates.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2">
                                        <input
                                            type="checkbox" aria-label={`Aplicar a ${c.name}`}
                                            checked={applySelection.has(c.id)}
                                            onChange={(e) => setApplySelection(prev => {
                                                const next = new Set(prev);
                                                if (e.target.checked) next.add(c.id); else next.delete(c.id);
                                                return next;
                                            })}
                                        />
                                    </td>
                                    <td className="px-2 py-2 font-medium text-slate-900">{c.name}</td>
                                    <td className="px-2 py-2 text-right text-slate-500">{formatKm(c.distanceKm!)}</td>
                                    <td className={`px-2 py-2 text-right ${c.price > 0 ? 'font-bold text-amber-700' : 'text-slate-500'}`}>{priceLabel(c)}</td>
                                    <td className="px-4 py-2 text-right font-bold text-[#004080]">{shippingSettings ? quoteLabel(c.distanceKm!, shippingSettings) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button onClick={() => setApplySelection(null)} disabled={isApplying} className="px-4 py-2 text-slate-600 font-medium rounded-lg hover:bg-slate-100">Cancelar</button>
                    <button onClick={handleApplyFormula} disabled={isApplying || applySelection.size === 0} className="px-5 py-2 bg-[#004080] text-white font-bold rounded-lg hover:bg-[#00294f] disabled:opacity-50">
                        {isApplying ? 'Aplicando...' : `Aplicar a ${applySelection.size} ciudad(es)`}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );

    return (
        <div className="flex flex-col h-[78vh] gap-6">
            {/* CABECERA PRINCIPAL */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#004080]/10 rounded-xl"><MapPin className="w-6 h-6 text-[#004080]" /></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Zonas de Entrega</h2>
                        <p className="text-sm text-slate-500">Gestiona las {cities.length} ciudades disponibles · {totalFormula} con precio por fórmula</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className={`px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 ${isAdding ? 'bg-slate-100 text-slate-600' : 'bg-[#004080] text-white hover:bg-[#00294f]'}`}
                >
                    {isAdding ? <><X className="w-5 h-5" /> Cancelar</> : <><Plus className="w-5 h-5" /> Nueva Ciudad</>}
                </button>
            </div>

            {/* FÓRMULA DE ENVÍO */}
            {shippingSettings && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 shrink-0">
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <Calculator className="w-5 h-5 text-[#004080] shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900">Fórmula de envío</p>
                                <p className="text-sm text-slate-500">
                                    {formatGs(shippingSettings.pricePerKm)}/km · gratis a menos de {formatKm(shippingSettings.freeUnderKm)} · desde {formatKm(shippingSettings.longDistanceFromKm)}, {formatGs(shippingSettings.longDistancePricePerKm)}/km · {shippingSettings.maxKm === null ? 'sin límite de distancia' : `a coordinar a más de ${formatKm(shippingSettings.maxKm)}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {formulaCandidates.length > 0 && (
                                <button onClick={openApply} className="px-4 py-2 rounded-xl font-bold text-sm bg-[#e8f0f8] text-[#004080] hover:bg-[#d5e4f2] transition-colors">
                                    Aplicar a ciudades ({formulaCandidates.length})
                                </button>
                            )}
                            <button
                                onClick={() => setFormulaDraft(formulaDraft ? null : toDraft(shippingSettings))}
                                className="px-4 py-2 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                                {formulaDraft ? 'Cerrar' : 'Editar fórmula'} <ChevronDown className={`w-4 h-4 transition-transform ${formulaDraft ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {formulaDraft && (
                        <div className="border-t border-slate-100 p-5 bg-[#e8f0f8]/40 rounded-b-2xl space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {draftField('pricePerKm', 'Precio por km', 'Gs.')}
                                {draftField('freeUnderKm', 'Gratis a menos de', 'km')}
                                {draftField('longDistanceFromKm', 'Tramo largo desde', 'km')}
                                {draftField('longDistancePricePerKm', 'Km del tramo largo', 'Gs.')}
                                {draftField('maxKm', 'A coordinar desde', 'km', 'Sin límite')}
                                {draftField('roundTo', 'Redondear a', 'Gs.')}
                            </div>
                            {draftSettings ? (
                                <div className="text-sm text-slate-600 space-y-1">
                                    <p>
                                        <span className="font-bold text-slate-800">Ejemplos: </span>
                                        {EXAMPLE_KM.map(km => `${km} km → ${quoteLabel(km, draftSettings)}`).join(' · ')}
                                    </p>
                                    <p>
                                        {draftChanges.length === 0
                                            ? 'Al guardar no cambia el precio de ninguna ciudad.'
                                            : `Al guardar cambia el precio de ${draftChanges.length} ciudad(es): ${draftChanges.slice(0, 6).map(c => `${c.name} ${priceLabel(c)} → ${quoteLabel(c.distanceKm!, draftSettings)}`).join(' · ')}${draftChanges.length > 6 ? '…' : ''}`}
                                    </p>
                                </div>
                            ) : (
                                <p role="alert" className="text-sm font-medium text-red-600">Todos los campos (salvo &quot;A coordinar desde&quot;) tienen que ser números positivos, y el redondeo un número entero.</p>
                            )}
                            <div className="flex justify-end">
                                <button onClick={handleSaveFormula} disabled={!draftSettings || isSavingFormula} className="px-6 py-2 bg-[#004080] text-white font-bold rounded-lg hover:bg-[#00294f] shadow-md disabled:opacity-50">
                                    {isSavingFormula ? 'Guardando...' : 'Guardar fórmula'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* FORMULARIO DE NUEVA CIUDAD (Desplegable) */}
            {isAdding && (
                <div className="bg-[#e8f0f8]/50 p-5 rounded-2xl border border-[#004080]/15 flex flex-wrap items-center gap-4 shadow-sm shrink-0">
                    <div className="flex-1 min-w-50">
                        <label className="block text-xs font-bold text-[#004080] mb-1 uppercase tracking-wider">Nombre de la Ciudad</label>
                        <input type="text" placeholder="Ej. Luque" value={newCityName} onChange={(e) => setNewCityName(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:border-[#004080] focus:ring-1 focus:ring-[#004080] outline-none transition-all text-slate-900" />
                    </div>
                    <div className="w-36">
                        <label className="block text-xs font-bold text-[#004080] mb-1 uppercase tracking-wider">Distancia</label>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 focus-within:border-[#004080] focus-within:ring-1 focus-within:ring-[#004080] transition-all">
                            <input type="number" min="0" step="0.1" placeholder="Opcional" value={newCityKm} onChange={(e) => setNewCityKm(e.target.value)} className="w-full py-2 bg-transparent outline-none text-slate-900" />
                            <span className="text-sm font-medium text-slate-400">km</span>
                        </div>
                    </div>
                    <div className="w-48">
                        <label className="block text-xs font-bold text-[#004080] mb-1 uppercase tracking-wider">Costo de Envío</label>
                        {newCityKm.trim() !== '' && shippingSettings && Number.isFinite(Number(newCityKm)) ? (
                            <div className="py-2 text-sm font-bold text-[#004080]">{quoteLabel(Number(newCityKm), shippingSettings)} <span className="font-normal text-slate-500">(fórmula)</span></div>
                        ) : (
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 focus-within:border-[#004080] focus-within:ring-1 focus-within:ring-[#004080] transition-all">
                                <span className="text-sm font-medium text-slate-400">Gs.</span>
                                <input type="number" placeholder="0" value={newCityPrice} onChange={(e) => setNewCityPrice(Number(e.target.value))} className="w-full py-2 bg-transparent outline-none text-slate-900" />
                            </div>
                        )}
                    </div>
                    <div className="mt-5">
                        <button onClick={handleAddCity} className="px-6 py-2 bg-[#004080] text-white font-bold rounded-lg hover:bg-[#00294f] shadow-md">Guardar</button>
                    </div>
                </div>
            )}

            {/* CONTENEDOR DE DOS COLUMNAS (Lado a lado en pantallas grandes) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

                {/* 🟢 COLUMNA 1: CIUDADES ACTIVAS */}
                <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-emerald-100 bg-emerald-50/30 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-bold text-emerald-900">Activas ({totalActive})</h3>
                        </div>
                        {/* Buscador Independiente Activas */}
                        <div className="relative w-48">
                            <Search className="w-4 h-4 text-emerald-600/50 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text" placeholder="Buscar..." value={activeSearch} onChange={(e) => setActiveSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900"
                            />
                        </div>
                    </div>

                    {/* 👇 SCROLL FIX: overscroll-contain evita que se mueva la página principal */}
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        <table className="w-full text-left">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-xs uppercase text-slate-500 font-bold w-1/2 border-b border-slate-100">Ciudad & Envío</th>
                                    <th className="px-4 py-3 text-xs uppercase text-slate-500 font-bold text-right border-b border-slate-100">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {activeCities.length === 0 ? (
                                    <tr><td colSpan={2} className="p-6 text-center text-slate-400 text-sm">No hay ciudades activas en la búsqueda.</td></tr>
                                ) : (
                                    activeCities.map((city) => (
                                        <tr key={city.id} className="hover:bg-slate-50 group">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-900">{city.name}</div>
                                                {editingId === city.id ? (
                                                    <div className="mt-1 space-y-1.5">
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" min="0" step="0.1" placeholder="—" value={editKm} onChange={(e) => setEditKm(e.target.value)} aria-label="Distancia en km" className="w-20 px-2 py-0.5 text-sm border border-slate-300 rounded focus:border-[#004080] outline-none text-slate-900" />
                                                            <span className="text-xs text-slate-400">km</span>
                                                        </div>
                                                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                                            <input type="checkbox" checked={editFromFormula} onChange={(e) => setEditFromFormula(e.target.checked)} disabled={!shippingSettings} />
                                                            Calcular con la fórmula
                                                        </label>
                                                        {editFromFormula ? (
                                                            <div className="text-sm font-bold text-[#004080]">
                                                                {shippingSettings && editKm.trim() !== '' && Number.isFinite(Number(editKm)) ? quoteLabel(Number(editKm), shippingSettings) : 'Cargá los km'}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-slate-400">Gs.</span>
                                                                <input type="number" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} aria-label="Precio de envío" className="w-24 px-2 py-0.5 text-sm border border-slate-300 rounded focus:border-[#004080] outline-none text-slate-900" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-[#004080] font-medium">
                                                        {priceLabel(city)}
                                                        <span className="ml-2 text-xs font-normal text-slate-400">
                                                            {city.distanceKm != null ? formatKm(city.distanceKm) : 'sin km'} · {city.priceFromFormula ? 'fórmula' : 'a mano'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {editingId === city.id ? (
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleSaveCity(city.id)} aria-label="Guardar" title="Guardar" className="p-1.5 bg-[#004080] text-white rounded hover:bg-[#00294f]"><Save className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => setEditingId(null)} aria-label="Cancelar edición" title="Cancelar edición" className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"><X className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEditing(city)} className="p-1.5 text-slate-400 hover:text-[#004080] bg-slate-100 hover:bg-[#e8f0f8] rounded" title="Editar precio y distancia" aria-label="Editar precio y distancia"><Edit2 className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleToggleActive(city.id, city.isActive)} className="p-1.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-500 rounded flex items-center gap-1 ml-2" title="Desactivar ciudad">
                                                            <ArrowRightLeft className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Desactivar</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 🔴 COLUMNA 2: CIUDADES INACTIVAS (Aplicada simetría roja) */}
                <div className="rounded-2xl border border-red-100 shadow-sm flex flex-col overflow-hidden bg-red-50/10">
                    <div className="p-4 border-b border-red-100 bg-red-50/30 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-500" />
                            <h3 className="font-bold text-red-900">Inactivas ({totalInactive})</h3>
                        </div>
                        {/* Buscador Independiente Inactivas (Rojo) */}
                        <div className="relative w-48">
                            <Search className="w-4 h-4 text-red-500/50 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text" placeholder="Buscar..." value={inactiveSearch} onChange={(e) => setInactiveSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900"
                            />
                        </div>
                    </div>

                    {/* 👇 SCROLL FIX: overscroll-contain para retener el scroll aquí */}
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-xs uppercase text-slate-500 font-bold w-1/2 border-b border-slate-100">Ciudad & Envío</th>
                                    <th className="px-4 py-3 text-xs uppercase text-slate-500 font-bold text-right border-b border-slate-100">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {inactiveCities.length === 0 ? (
                                    <tr><td colSpan={2} className="p-6 text-center text-slate-400 text-sm">No hay ciudades inactivas en la búsqueda.</td></tr>
                                ) : (
                                    inactiveCities.map((city) => (
                                        <tr key={city.id} className="hover:bg-red-50/50 group transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-600 line-through">{city.name}</div>
                                                <div className="text-sm text-slate-500 font-medium">{priceLabel(city)}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleDelete(city.id, city.name)} className="p-1.5 text-red-400 hover:text-white bg-red-50 hover:bg-red-500 rounded" title="Eliminar permanentemente" aria-label="Eliminar permanentemente"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    {/* Botón Activar (Rojo) */}
                                                    <button onClick={() => handleToggleActive(city.id, city.isActive)} className="p-1.5 text-red-600 hover:text-white bg-red-50 hover:bg-red-600 rounded flex items-center gap-1 ml-2" title="Reactivar ciudad">
                                                        <ArrowRightLeft className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Activar</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            {applyModal}
        </div>
    );
}
