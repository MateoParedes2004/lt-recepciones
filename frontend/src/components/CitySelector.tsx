'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import { Playfair_Display } from 'next/font/google';
import { getApiUrl } from '../lib/api';

const playfair = Playfair_Display({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
});

interface City {
    id: number;
    name: string;
    price: number;
    isActive: boolean;
    freeShipping?: boolean;
}

interface CitySelectorProps {
    // cityId es null cuando la ciudad se escribió a mano (la lista no cargó).
    onCitySelect?: (cityId: number | null, cityName: string, cityPrice: number, freeShipping: boolean) => void;
}

export default function CitySelector({ onCitySelect }: CitySelectorProps) {
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    // Estados para el Custom Dropdown y el Buscador
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [manualCity, setManualCity] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Si el servidor no contesta (caído o dormido) la espera no puede ser
        // infinita: el cliente se quedaría en "Cargando..." sin poder pedir su
        // cotización. Pasados 8 s se muestra el campo para escribir la ciudad.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        // Si el componente se desmonta (o React repite el efecto en desarrollo)
        // la petición se cancela a propósito y eso no es un error de carga.
        let unmounted = false;
        const fetchCities = async () => {
            try {
                // 👇 Añadimos cache: 'no-store' para tener siempre la lista actualizada
                const response = await fetch(`${getApiUrl()}/cities`, { cache: 'no-store', signal: controller.signal });

                if (!response.ok) {
                    throw new Error('Error al cargar las ciudades');
                }
                
                const data = await response.json();
                setCities(data);
            } catch (err) {
                if (unmounted) return;
                setError(err instanceof Error ? err.message : 'Error desconocido');
                console.error(err);
            } finally {
                clearTimeout(timeout);
                if (!unmounted) setIsLoading(false);
            }
        };

        fetchCities();
        return () => { unmounted = true; clearTimeout(timeout); controller.abort(); };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectCity = (city: City) => {
        // Doble validación por seguridad
        if (!city.isActive) return;

        setSelectedCity(city);
        setIsOpen(false);
        setSearchTerm(''); // Limpiamos el buscador al seleccionar
        
        if (onCitySelect) {
            onCitySelect(city.id, city.name, city.price, !!city.freeShipping);
        }
    };

    // 🔍 Filtramos las ciudades según lo que el usuario escriba
    const filteredCities = cities.filter(city => 
        city.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <div className="text-sm text-slate-500 dark:text-slate-400 animate-pulse py-2">Cargando zonas de entrega...</div>;
    // Sin la lista de ciudades el pedido igual tiene que poder enviarse: el
    // cliente escribe su ciudad o barrio y el envío queda "a coordinar".
    if (error) return (
        <div className="flex flex-col gap-2 w-full">
            <label htmlFor="ciudad-manual" className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Zona de entrega
            </label>
            <input
                id="ciudad-manual"
                type="text"
                maxLength={80}
                placeholder="Escribí tu ciudad o barrio"
                value={manualCity}
                onChange={(e) => {
                    setManualCity(e.target.value);
                    onCitySelect?.(null, e.target.value.trim() || 'No seleccionada', 0, false);
                }}
                className="w-full p-3 border-2 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-[#004080] dark:focus:border-[#3b9dff]"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
                No pudimos cargar la lista de ciudades. Escribí la tuya y coordinamos el costo del envío por WhatsApp.
            </p>
        </div>
    );

    return (
        <div className="flex flex-col gap-2 relative w-full" ref={dropdownRef}>
            <label className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Zona de entrega
            </label>
            
            {/* BOTÓN DISPARADOR (Trigger) */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-slate-900 flex justify-between items-center transition-all duration-300 outline-none
                    ${isOpen ? 'border-[#004080] dark:border-[#3b9dff] shadow-[0_0_8px_rgba(0,64,128,0.3)]' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-[#3b9dff]/50'}
                `}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2 truncate">
                    <MapPin className={`w-5 h-5 shrink-0 ${selectedCity ? 'text-[#004080] dark:text-[#3b9dff]' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className={`truncate font-medium ${selectedCity ? `text-slate-900 dark:text-slate-100 ${playfair.className}` : 'text-slate-500 dark:text-slate-400'}`}>
                        {selectedCity ? selectedCity.name : 'Selecciona tu ciudad...'}
                    </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {/* MENÚ DESPLEGABLE PERSONALIZADO */}
            <div 
                className={`absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl flex flex-col transform transition-all duration-300 ease-out origin-top z-50 overflow-hidden ${
                    isOpen 
                        ? 'opacity-100 translate-y-0 visible pointer-events-auto' 
                        : 'opacity-0 -translate-y-4 invisible pointer-events-none'
                }`}
                role="listbox"
            >
                {/* 🔍 BARRA DE BÚSQUEDA */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 sticky top-0 z-10">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar ciudad..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            // Evitamos que al hacer clic en el input se cierre el dropdown
                            onClick={(e) => e.stopPropagation()} 
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#004080] focus:ring-1 focus:ring-[#004080] transition-all"
                        />
                    </div>
                </div>

                <div className="max-h-56 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {filteredCities.length > 0 ? (
                        filteredCities.map((city) => (
                            <button
                                key={city.id}
                                type="button"
                                // 👇 Solo permitimos seleccionar si la ciudad está activa
                                onClick={() => city.isActive && handleSelectCity(city)}
                                disabled={!city.isActive}
                                role="option"
                                aria-selected={selectedCity?.id === city.id}
                                // 👇 Agregamos estilos para las ciudades inactivas (opacidad baja, no pointer)
                                className={`w-full text-left px-5 py-3 text-base tracking-wide flex justify-between items-center transition-colors duration-200 
                                    ${!city.isActive 
                                        ? 'opacity-60 bg-slate-50 dark:bg-slate-800 cursor-not-allowed' 
                                        : selectedCity?.id === city.id 
                                            ? 'bg-blue-50 dark:bg-[#3b9dff]/15 text-[#004080] dark:text-[#3b9dff] font-bold' 
                                            : 'text-slate-700 dark:text-slate-300 hover:text-[#004080] dark:hover:text-[#3b9dff] hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                                    } ${playfair.className}`}
                            >
                                {/* 👇 Tachamos el texto si está inactiva */}
                                <span className={!city.isActive ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                                    {city.name}
                                </span>

                                {/* 👇 Mostramos la etiqueta correspondiente según el estado de la ciudad */}
                                {!city.isActive ? (
                                    <span className="text-[10px] font-sans uppercase tracking-wider text-red-500 font-bold bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                        Proximamente
                                    </span>
                                ) : city.price > 0 ? (
                                    <span className="text-xs font-sans font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                        + Gs. {Math.round(Number(city.price)).toLocaleString("es-PY")}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-sans uppercase tracking-wider text-[#004080] dark:text-[#3b9dff] font-bold bg-[#004080]/10 dark:bg-[#3b9dff]/10 px-2 py-1 rounded-md border border-[#004080]/20 dark:border-[#3b9dff]/20">
                                        {city.freeShipping ? 'Envío gratis' : 'A coordinar'}
                                    </span>
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 font-medium">
                            No encontramos &quot;{searchTerm}&quot;
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}