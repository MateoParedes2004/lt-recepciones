'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import { Playfair_Display } from 'next/font/google';

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
}

interface CitySelectorProps {
    onCitySelect?: (cityId: number, cityName: string, cityPrice: number) => void;
}

export default function CitySelector({ onCitySelect }: CitySelectorProps) {
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    // Estados para el Custom Dropdown y el Buscador
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [searchTerm, setSearchTerm] = useState(''); 
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCities = async () => {
            try {
                const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '');
                // 👇 Añadimos cache: 'no-store' para tener siempre la lista actualizada
                const response = await fetch(`${baseUrl}/cities`, { cache: 'no-store' }); 
                
                if (!response.ok) {
                    throw new Error('Error al cargar las ciudades');
                }
                
                const data = await response.json();
                setCities(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCities();
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
            onCitySelect(city.id, city.name, city.price);
        }
    };

    // 🔍 Filtramos las ciudades según lo que el usuario escriba
    const filteredCities = cities.filter(city => 
        city.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <div className="text-sm text-slate-500 animate-pulse py-2">Cargando zonas de entrega...</div>;
    if (error) return <div className="text-sm text-red-500 py-2">{error}</div>;

    return (
        <div className="flex flex-col gap-2 relative w-full" ref={dropdownRef}>
            <label className="font-semibold text-slate-700 text-sm">
                Zona de entrega
            </label>
            
            {/* BOTÓN DISPARADOR (Trigger) */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-3 border-2 rounded-xl bg-white flex justify-between items-center transition-all duration-300 outline-none
                    ${isOpen ? 'border-[#004080] shadow-[0_0_8px_rgba(0,64,128,0.3)]' : 'border-slate-200 hover:border-blue-300'}
                `}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2 truncate">
                    <MapPin className={`w-5 h-5 shrink-0 ${selectedCity ? 'text-[#004080]' : 'text-slate-400'}`} />
                    <span className={`truncate font-medium ${selectedCity ? `text-slate-900 ${playfair.className}` : 'text-slate-500'}`}>
                        {selectedCity ? selectedCity.name : 'Selecciona tu ciudad...'}
                    </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {/* MENÚ DESPLEGABLE PERSONALIZADO */}
            <div 
                className={`absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl flex flex-col transform transition-all duration-300 ease-out origin-top z-50 overflow-hidden ${
                    isOpen 
                        ? 'opacity-100 translate-y-0 visible pointer-events-auto' 
                        : 'opacity-0 -translate-y-4 invisible pointer-events-none'
                }`}
                role="listbox"
            >
                {/* 🔍 BARRA DE BÚSQUEDA */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar ciudad..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            // Evitamos que al hacer clic en el input se cierre el dropdown
                            onClick={(e) => e.stopPropagation()} 
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-[#004080] focus:ring-1 focus:ring-[#004080] transition-all"
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
                                        ? 'opacity-60 bg-slate-50 cursor-not-allowed' 
                                        : selectedCity?.id === city.id 
                                            ? 'bg-blue-50 text-[#004080] font-bold' 
                                            : 'text-slate-700 hover:text-[#004080] hover:bg-slate-50 font-medium'
                                    } ${playfair.className}`} 
                            >
                                {/* 👇 Tachamos el texto si está inactiva */}
                                <span className={!city.isActive ? 'line-through text-slate-400' : ''}>
                                    {city.name}
                                </span>

                                {/* 👇 Mostramos la etiqueta correspondiente según el estado de la ciudad */}
                                {!city.isActive ? (
                                    <span className="text-[10px] font-sans uppercase tracking-wider text-red-500 font-bold bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                        Proximamente
                                    </span>
                                ) : city.price > 0 ? (
                                    <span className="text-xs font-sans font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                        + Gs. {city.price}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-sans uppercase tracking-wider text-[#004080] font-bold bg-[#004080]/10 px-2 py-1 rounded-md border border-[#004080]/20">
                                        A coordinar
                                    </span>
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center text-sm text-slate-500 font-medium">
                            No encontramos "{searchTerm}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}