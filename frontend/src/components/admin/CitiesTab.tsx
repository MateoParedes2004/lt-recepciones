'use client';

import { useState, useEffect } from 'react';
import { Search, Edit2, Save, X, MapPin, CheckCircle2, XCircle, Trash2, Plus, ArrowRightLeft } from 'lucide-react';

interface City {
    id: number;
    name: string;
    price: number;
    isActive: boolean;
}

export default function CitiesTab() {
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 👇 AHORA TENEMOS DOS BUSCADORES INDEPENDIENTES
    const [activeSearch, setActiveSearch] = useState('');
    const [inactiveSearch, setInactiveSearch] = useState('');
    
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrice, setEditPrice] = useState<number>(0);

    const [isAdding, setIsAdding] = useState(false);
    const [newCityName, setNewCityName] = useState('');
    const [newCityPrice, setNewCityPrice] = useState<number>(0);

    const fetchCities = async () => {
        try {
            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/cities`, { cache: 'no-store' });
            const data = await response.json();
            setCities(data);
        } catch (error) {
            console.error("Error al cargar ciudades:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCities();
    }, []);

    // 👇 FILTRAMOS Y SEPARAMOS EN TIEMPO REAL CON SU RESPECTIVO BUSCADOR
    const activeCities = cities
        .filter(c => c.isActive)
        .filter(c => c.name.toLowerCase().includes(activeSearch.toLowerCase()));

    const inactiveCities = cities
        .filter(c => !c.isActive)
        .filter(c => c.name.toLowerCase().includes(inactiveSearch.toLowerCase()));

    const handleAddCity = async () => {
        if (!newCityName.trim()) return alert("El nombre de la ciudad es obligatorio.");
        try {
            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/cities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCityName, price: Number(newCityPrice) }),
            });
            if (response.ok) {
                const addedCity = await response.json();
                setCities([...cities, addedCity].sort((a, b) => a.name.localeCompare(b.name)));
                setIsAdding(false); setNewCityName(''); setNewCityPrice(0);
            }
        } catch (error) { console.error("Error al crear ciudad:", error); }
    };

    const handleSavePrice = async (id: number) => {
        try {
            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/cities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price: Number(editPrice) }),
            });
            if (response.ok) {
                setCities(cities.map(c => c.id === id ? { ...c, price: Number(editPrice) } : c));
                setEditingId(null);
            }
        } catch (error) { console.error("Error al actualizar precio:", error); }
    };

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        try {
            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/cities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentStatus }),
            });
            if (response.ok) {
                // Al actualizar el estado, React automáticamente moverá la ciudad a la otra tabla
                setCities(cities.map(c => c.id === id ? { ...c, isActive: !currentStatus } : c));
            }
        } catch (error) { console.error("Error al cambiar estado:", error); }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la ciudad "${name}"?`)) return;
        try {
            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/cities/${id}`, { method: 'DELETE' });
            if (response.ok) setCities(cities.filter(c => c.id !== id));
        } catch (error) { console.error("Error al eliminar ciudad:", error); }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando zonas de entrega...</div>;

    const totalActive = cities.filter(c => c.isActive).length;
    const totalInactive = cities.filter(c => !c.isActive).length;

    return (
        <div className="flex flex-col h-[78vh] gap-6">
            {/* CABECERA PRINCIPAL */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#004080]/10 rounded-xl"><MapPin className="w-6 h-6 text-[#004080]" /></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Zonas de Entrega</h2>
                        <p className="text-sm text-slate-500">Gestiona las {cities.length} ciudades disponibles</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsAdding(!isAdding)} 
                    className={`px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 ${isAdding ? 'bg-slate-100 text-slate-600' : 'bg-[#004080] text-white hover:bg-[#002b5e]'}`}
                >
                    {isAdding ? <><X className="w-5 h-5" /> Cancelar</> : <><Plus className="w-5 h-5" /> Nueva Ciudad</>}
                </button>
            </div>

            {/* FORMULARIO DE NUEVA CIUDAD (Desplegable) */}
            {isAdding && (
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex flex-wrap items-center gap-4 shadow-sm shrink-0">
                    <div className="flex-1 min-w-50">
                        <label className="block text-xs font-bold text-[#004080] mb-1 uppercase tracking-wider">Nombre de la Ciudad</label>
                        <input type="text" placeholder="Ej. Luque" value={newCityName} onChange={(e) => setNewCityName(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:border-[#004080] focus:ring-1 focus:ring-[#004080] outline-none transition-all" />
                    </div>
                    <div className="w-48">
                        <label className="block text-xs font-bold text-[#004080] mb-1 uppercase tracking-wider">Costo de Envío</label>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 focus-within:border-[#004080] focus-within:ring-1 focus-within:ring-[#004080] transition-all">
                            <span className="text-sm font-medium text-slate-400">Gs.</span>
                            <input type="number" placeholder="0" value={newCityPrice} onChange={(e) => setNewCityPrice(Number(e.target.value))} className="w-full py-2 bg-transparent outline-none" />
                        </div>
                    </div>
                    <div className="mt-5">
                        <button onClick={handleAddCity} className="px-6 py-2 bg-[#004080] text-white font-bold rounded-lg hover:bg-[#002b5e] shadow-md">Guardar</button>
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
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-xs text-slate-400">Gs.</span>
                                                        <input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="w-24 px-2 py-0.5 text-sm border border-slate-300 rounded focus:border-[#004080] outline-none" />
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-[#004080] font-medium">{city.price > 0 ? `Gs. ${city.price.toLocaleString('es-PY')}` : 'A coordinar'}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {editingId === city.id ? (
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleSavePrice(city.id)} className="p-1.5 bg-[#004080] text-white rounded hover:bg-[#002b5e]"><Save className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"><X className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingId(city.id); setEditPrice(city.price); }} className="p-1.5 text-slate-400 hover:text-[#004080] bg-slate-100 hover:bg-blue-50 rounded" title="Editar precio"><Edit2 className="w-3.5 h-3.5" /></button>
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
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
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
                                                <div className="text-sm text-slate-500 font-medium">{city.price > 0 ? `Gs. ${city.price.toLocaleString('es-PY')}` : 'A coordinar'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleDelete(city.id, city.name)} className="p-1.5 text-red-400 hover:text-white bg-red-50 hover:bg-red-500 rounded" title="Eliminar permanentemente"><Trash2 className="w-3.5 h-3.5" /></button>
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
        </div>
    );
}