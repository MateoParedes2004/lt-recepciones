"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "yet-another-react-lightbox/styles.css";
import { GALLERY_EVENT_TYPES } from "../../lib/gallery";
import type { GalleryImage } from "../../types";

const Lightbox = dynamic(() => import("yet-another-react-lightbox"), { ssr: false });

// Mismas pestañas de "rubro" que el catálogo (chipBase/chipOn/chipOff), para
// que se sientan como el mismo sitio aunque filtren fotos en vez de productos.
const chipBase = "shrink-0 h-9 px-4 rounded-full text-[13px] font-bold whitespace-nowrap border transition-colors cursor-pointer";
const chipOn = "text-white border-transparent bg-[linear-gradient(135deg,#0d4a8a,#00294f)] shadow-sm";
const chipOff = "bg-white/10 text-slate-200 border-white/15 hover:border-[#3b9dff] hover:text-white";

/** "Todo" + cada tipo que de verdad tiene al menos una foto visible. */
function tabsFrom(images: GalleryImage[]): string[] {
  const present = GALLERY_EVENT_TYPES.filter((t) => images.some((img) => img.eventType === t));
  return ["Todo", ...present];
}

export default function GalleryBrowser({ images }: { images: GalleryImage[] }) {
  const tabs = useMemo(() => tabsFrom(images), [images]);
  const [active, setActive] = useState("Todo");
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const visible = active === "Todo" ? images : images.filter((img) => img.eventType === active);

  return (
    <main className="min-h-screen bg-slate-950 pt-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver al inicio
        </Link>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-[27px] md:text-[40px] leading-tight font-serif font-extrabold text-white tracking-tight">
            Galería de eventos
          </h1>
          <p className="text-[14px] md:text-base text-slate-400 mt-3 leading-relaxed">
            Montajes reales hechos con nuestro mobiliario en Asunción y Gran Asunción. Filtrá por tipo de evento para inspirarte con el tuyo.
          </p>
        </header>

        {tabs.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" role="group" aria-label="Filtrar por tipo de evento">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={active === tab}
                onClick={() => setActive(tab)}
                className={`${chipBase} ${active === tab ? chipOn : chipOff}`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="text-slate-400 py-16 text-center">Todavía no hay fotos para este tipo de evento.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {visible.map((img, index) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="group relative rounded-2xl overflow-hidden bg-slate-800 aspect-square cursor-pointer text-left"
              >
                <div className="absolute inset-0 bg-blue-900/20 group-hover:bg-transparent transition-colors duration-500 z-10 pointer-events-none" />
                <Image
                  src={img.imageUrl}
                  alt={img.title || (img.eventType ? `Alquiler de mobiliario para ${img.eventType.toLowerCase()} en Asunción` : "Evento LT Recepciones")}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                {img.title && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-linear-to-t from-slate-900/90 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none">
                    <p className="text-white font-serif font-bold text-sm truncate">{img.title}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <Lightbox
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
          index={lightboxIndex}
          on={{ view: ({ index: currentIndex }) => setLightboxIndex(currentIndex) }}
          slides={visible.map((img) => ({ src: img.imageUrl, alt: img.title ?? undefined }))}
          styles={{ container: { backgroundColor: "rgba(0, 0, 0, 0.9)" } }}
        />
      </div>
    </main>
  );
}
