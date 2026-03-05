"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Phone, Clock, Instagram, Facebook, ArrowRight } from "lucide-react";
// 👇 IMPORTAMOS LAS FUENTES OFICIALES
import { Great_Vibes, Playfair_Display, Lato } from 'next/font/google';

// Configuración de fuentes
const cursiveFont = Great_Vibes({ subsets: ['latin'], weight: '400' });
const serifFont = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'] });
const sansFont = Lato({ subsets: ['latin'], weight: ['300', '400', '700'] });

export default function Footer() {
  const pathname = usePathname() || "";
  const [logoError, setLogoError] = useState(false);

  if (pathname.startsWith("/admin") || pathname.startsWith("/iniciar-sesion")) {
    return null;
  }

  return (
    <footer className="bg-slate-900 pt-16 pb-8 border-t-4 border-blue-600 text-slate-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 mb-12">
          
          {/* Columna 1: Marca */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-3 group cursor-pointer">
              
              {!logoError ? (
                <Image 
                  src="/logo.png" 
                  alt="LT Recepciones Logo" 
                  width={60} 
                  height={60} 
                  className="w-12 h-12 object-contain bg-white rounded-xl p-1 shadow-md group-hover:scale-105 transition-transform duration-300"
                  onError={() => setLogoError(true)} 
                />
              ) : (
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center transform group-hover:rotate-6 transition-transform shadow-md">
                  <span className="text-white font-bold text-xl tracking-tighter">LT</span>
                </div>
              )}

              {/* TÍTULO CURSIVO ALINEADO */}
              <span className={`text-3xl md:text-4xl text-white ${cursiveFont.className} mt-3`}>
                Recepciones
              </span>
            </Link>

            {/* DESCRIPCIÓN EN LATO */}
            <p className={`text-slate-400 text-sm leading-relaxed max-w-sm mt-4 pr-4 ${sansFont.className}`}>
              Especialistas en alquiler de equipamiento premium. Transformamos tus espacios con mobiliario y vajilla de la más alta calidad para que tu evento sea inolvidable.
            </p>
            
            <div className="flex items-center space-x-4 pt-2">
              <a href="https://www.instagram.com/ltrecepciones?igsh=Z2xoNWVrOXQ0amg2" target="_blank" rel="noopener noreferrer" 
                className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all duration-300 transform hover:scale-110 cursor-pointer shadow-sm">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.facebook.com/share/14VSpY6d3hm/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" 
                className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all duration-300 transform hover:scale-110 cursor-pointer shadow-sm">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Columna 2: Enlaces Rápidos */}
          <div className="col-span-1">
            <h3 className={`text-white font-bold text-base md:text-lg mb-4 md:mb-6 ${serifFont.className}`}>
              Enlaces
            </h3>
            <ul className={`space-y-3 ${sansFont.className}`}>
              <li>
                <Link 
                  href="/#inicio" 
                  className="text-slate-400 hover:text-blue-400 transition-all duration-300 transform hover:scale-105 origin-left flex items-center text-sm group w-fit"
                >
                  <ArrowRight className="w-3 h-3 mr-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /> 
                  Inicio
                </Link>
              </li>
              <li>
                <Link 
                  href="/catalogos" 
                  className="text-slate-400 hover:text-blue-400 transition-all duration-300 transform hover:scale-105 origin-left flex items-center text-sm group w-fit"
                >
                  <ArrowRight className="w-3 h-3 mr-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /> 
                  Catálogo
                </Link>
              </li>
              <li>
                <Link 
                  href="#nuestro-trabajo" 
                  className="text-slate-400 hover:text-blue-400 transition-all duration-300 transform hover:scale-105 origin-left flex items-center text-sm group w-fit"
                >
                  <ArrowRight className="w-3 h-3 mr-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /> 
                  Por qué elegirnos
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Contacto */}
          <div className="col-span-1">
            <h3 className={`text-white font-bold text-base md:text-lg mb-4 md:mb-6 ${serifFont.className}`}>Contacto</h3>
            <ul className={`space-y-4 ${sansFont.className}`}>
              <li className="flex items-start text-sm text-slate-400 group">
                <MapPin className="w-4 h-4 mr-2 md:mr-3 mt-0.5 text-blue-500 shrink-0 group-hover:text-blue-400 transition-colors" />
                <span>Asunción, Paraguay<br/>Atención previa cita</span>
              </li>
              <li className="flex items-center text-sm text-slate-400 group">
                <Phone className="w-4 h-4 mr-2 md:mr-3 text-blue-500 shrink-0 group-hover:text-blue-400 transition-colors" />
                <a href="https://wa.me/595985867749" target="_blank" rel="noopener noreferrer" className="break-all hover:text-blue-400 hover:underline transition-colors hover:scale-105 origin-left inline-block transform duration-300">
                  +595 985 867 749
                </a>
              </li>
              <li className="flex items-start text-sm text-slate-400 group">
                <Clock className="w-4 h-4 mr-2 md:mr-3 mt-0.5 text-blue-500 shrink-0 group-hover:text-blue-400 transition-colors" />
                <span>Lunes a Domingo<br/>Atención para eventos</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Línea Divisoria y Copyright */}
        <div className={`border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 text-center md:text-left ${sansFont.className}`}>
          <p>&copy; {new Date().getFullYear()} LT Recepciones. Todos los derechos reservados.</p>
          <p className="flex items-center">
            Diseñado y desarrollado por <span className="font-bold text-slate-300 ml-1">Mateo Paredes</span>
          </p>
        </div>

      </div>
    </footer>
  );
}