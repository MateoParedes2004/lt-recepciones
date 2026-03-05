"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link'; 
import Image from 'next/image'; 
import { Menu, X, Instagram, Facebook, ChevronDown, Package, Home, Info, Phone, Camera } from 'lucide-react';
// 👇 1. IMPORTAMOS LAS DOS FUENTES DIRECTAMENTE AQUÍ
import { Great_Vibes, Playfair_Display } from 'next/font/google';

// Configuración de Cursiva (Para el Logo)
const cursiveFont = Great_Vibes({
  subsets: ['latin'],
  weight: '400', 
});

// 👇 2. CONFIGURACIÓN DE SERIF (Para el Menú elegante)
const serifFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'], // Cargamos varios pesos para que se vea bien
});

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogos, setCatalogos] = useState<any[]>([]);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`);
        if (res.ok) {
          const data = await res.json();
          setCatalogos(data);
        }
      } catch (error) {
        console.error("Error al cargar categorías en el menú:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMenuOpen]);

  const getCategoryLink = (name: string) => {
    if (!name) return '#';
    return `/catalogos#categoria-${name.toLowerCase().replace(/ /g, '-')}`;
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            
            {/* LOGO */}
            <Link href="/" className="shrink-0 flex items-center cursor-pointer group">
              {!logoError ? (
                <Image 
                  src="/logo.png" 
                  alt="LT Recepciones Logo" 
                  width={250} 
                  height={80} 
                  className="h-14 md:h-16 w-auto mr-2 object-contain" 
                  priority 
                  onError={() => setLogoError(true)} 
                />
              ) : (
                <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center mr-3 group-hover:rotate-6 transition-transform shadow-md">
                  <span className="text-white font-bold text-xl">LT</span>
                </div>
              )}
              <span className={`text-3xl md:text-5xl text-black ${cursiveFont.className} mt-3`}>
                Recepciones
              </span>
            </Link>

            {/* MENÚ DE ESCRITORIO */}
            <div className="hidden md:flex items-center space-x-8">
              <nav className="flex space-x-8 items-center">
                
                {/* BOTÓN CATÁLOGOS */}
                <div 
                  className="relative"
                  onMouseEnter={() => setIsCatalogOpen(true)}
                  onMouseLeave={() => setIsCatalogOpen(false)}
                >
                  <button 
                    onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                    // 👇 APLICADO DIRECTAMENTE: serifFont.className
                    className={`flex items-center text-slate-900 hover:text-blue-700 font-medium tracking-wide transition-all duration-300 transform hover:scale-105 cursor-pointer py-2 ${serifFont.className}`}
                  >
                    Catálogos 
                    <ChevronDown className={`ml-1 w-4 h-4 transition-transform duration-300 ${isCatalogOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* MENÚ DESPLEGABLE (CATÁLOGOS PC) */}
                  <div 
                    className={`absolute top-full w-64 bg-white border border-slate-100 rounded-xl shadow-xl py-2 flex flex-col transform transition-all duration-300 ease-out origin-top ${
                      isCatalogOpen 
                        ? 'opacity-100 translate-y-0 visible pointer-events-auto' 
                        : 'opacity-0 -translate-y-4 invisible pointer-events-none'
                    }`}
                  >
                    <Link 
                      href="/catalogos" 
                      onClick={() => setIsCatalogOpen(false)} 
                      // 👇 APLICADO: serifFont.className
                      className={`px-5 py-3 text-base font-bold tracking-wide text-slate-900 hover:text-blue-700 hover:bg-slate-50 transition-colors duration-200 block border-b border-slate-50 ${serifFont.className}`}
                    >
                      Ver todo el catálogo
                    </Link>
                    <div className="max-h-64 overflow-y-auto">
                      {catalogos.map((cat) => (
                        <Link 
                          key={cat.id} 
                          href={getCategoryLink(cat.name)} 
                          onClick={() => setIsCatalogOpen(false)} 
                          // 👇 APLICADO: serifFont.className
                          className={`block px-5 py-2.5 text-base tracking-wide text-slate-900 hover:text-blue-700 hover:bg-slate-50 transition-colors duration-200 ${serifFont.className}`}
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Enlaces Principales (También les puse la fuente elegante) */}
                <Link href="/#nuestro-trabajo" className={`text-slate-900 hover:text-blue-700 font-medium tracking-wide transition-all duration-300 transform hover:scale-105 ${serifFont.className}`}>
                  Nosotros
                </Link>

                <Link href="/#galeria" className={`text-slate-900 hover:text-blue-700 font-medium tracking-wide transition-all duration-300 transform hover:scale-105 ${serifFont.className}`}>
                  Galería
                </Link>

                <Link href="/#contacto" className={`text-slate-900 hover:text-blue-700 font-medium tracking-wide transition-all duration-300 transform hover:scale-105 ${serifFont.className}`}>
                  Contáctenos
                </Link>

              </nav>

              <div className="h-6 w-px bg-slate-200"></div>

              {/* REDES SOCIALES */}
              <div className="flex items-center space-x-4">
                <a href="https://www.instagram.com/ltrecepciones?igsh=Z2xoNWVrOXQ0amg2" target="_blank" rel="noopener noreferrer" 
                   className="text-black hover:text-blue-700 transition-all duration-300 transform hover:scale-110" 
                   title="Síguenos en Instagram">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://www.facebook.com/share/14VSpY6d3hm/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" 
                   className="text-black hover:text-blue-700 transition-all duration-300 transform hover:scale-110" 
                   title="Síguenos en Facebook">
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* MÓVIL */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setIsMenuOpen(true)} 
                className="p-2.5 text-slate-900 hover:text-blue-900 hover:bg-blue-50 bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MENÚ MÓVIL SIDEBAR */}
      <div 
        className={`md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsMenuOpen(false)}
      ></div>

      <div className={`md:hidden fixed top-0 right-0 h-dvh w-[80vw] max-w-[320px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <span className="font-light text-xl tracking-tight text-slate-900 flex items-baseline">
            LT 
            <span className={`ml-1 text-2xl text-black ${cursiveFont.className}`}>Recepciones</span>
          </span>
          <button 
            onClick={() => setIsMenuOpen(false)} 
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-5 space-y-8">
          
          {/* OPCIONES DEL MENÚ MÓVIL CON FUENTE DE LUJO */}
          <nav className="space-y-2">
            <Link href="/" onClick={() => setIsMenuOpen(false)} 
              // 👇 APLICADO: serifFont.className
              className={`flex items-center px-4 py-3 text-lg tracking-wide font-medium text-slate-900 hover:text-blue-900 hover:bg-blue-50 rounded-xl transition-colors ${serifFont.className}`}
            >
              <Home className="w-5 h-5 mr-3 text-blue-500" /> Inicio
            </Link>
            <Link href="/#nuestro-trabajo" onClick={() => setIsMenuOpen(false)} 
              // 👇 APLICADO
              className={`flex items-center px-4 py-3 text-lg tracking-wide font-medium text-slate-900 hover:text-blue-900 hover:bg-blue-50 rounded-xl transition-colors ${serifFont.className}`}
            >
              <Info className="w-5 h-5 mr-3 text-blue-500" /> Nosotros
            </Link>
            <Link href="/#galeria" onClick={() => setIsMenuOpen(false)} 
              // 👇 APLICADO
              className={`flex items-center px-4 py-3 text-lg tracking-wide font-medium text-slate-900 hover:text-blue-900 hover:bg-blue-50 rounded-xl transition-colors ${serifFont.className}`}
            >
              <Camera className="w-5 h-5 mr-3 text-blue-500" /> Galería
            </Link>
            <Link href="/#contacto" onClick={() => setIsMenuOpen(false)} 
              // 👇 APLICADO
              className={`flex items-center px-4 py-3 text-lg tracking-wide font-medium text-slate-900 hover:text-blue-900 hover:bg-blue-50 rounded-xl transition-colors ${serifFont.className}`}
            >
              <Phone className="w-5 h-5 mr-3 text-blue-500" /> Contacto
            </Link>
          </nav>

          <div className="w-full h-px bg-slate-100"></div>

          {/* OPCIONES DE CATÁLOGOS MÓVIL */}
          <div>
            <Link href="/catalogos" onClick={() => setIsMenuOpen(false)} 
              // 👇 APLICADO
              className={`flex items-center px-4 py-2 text-lg font-bold tracking-wide text-slate-900 mb-2 hover:text-blue-700 transition-colors ${serifFont.className}`}
            >
              <Package className="w-5 h-5 mr-3" /> Catálogo Completo
            </Link>
            <div className="ml-9 pl-4 space-y-1 border-l-2 border-slate-100">
              {catalogos.map((cat) => (
                <Link 
                  key={cat.id} 
                  href={getCategoryLink(cat.name)} 
                  onClick={() => setIsMenuOpen(false)} 
                  // 👇 APLICADO
                  className={`block py-2 text-base tracking-wide text-slate-700 hover:text-blue-700 transition-colors ${serifFont.className}`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-center space-x-6">
          <a href="https://www.instagram.com/ltrecepciones?igsh=Z2xoNWVrOXQ0amg2" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-blue-600 transition-all cursor-pointer">
            <Instagram className="w-5 h-5" />
          </a>
          <a href="https://www.facebook.com/share/14VSpY6d3hm/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-blue-600 transition-all cursor-pointer">
            <Facebook className="w-5 h-5" />
          </a>
        </div>
      </div>
    </>
  );
}