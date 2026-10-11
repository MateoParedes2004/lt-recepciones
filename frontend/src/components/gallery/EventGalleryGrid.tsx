"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import "yet-another-react-lightbox/styles.css";
import type { GalleryImage } from "../../types";

const Lightbox = dynamic(() => import("yet-another-react-lightbox"), { ssr: false });

// Grilla + lightbox para una página de UN tipo de evento ya filtrado (ver
// GalleryBrowser para la versión con pestañas de /galeria). alt por defecto
// nombra el tipo de evento: es la señal de SEO de imágenes que de verdad
// importa (ver investigación), no un schema de galería.
export default function EventGalleryGrid({ images, eventType }: { images: GalleryImage[]; eventType: string }) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {images.map((img, index) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="group relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-square cursor-pointer"
          >
            <Image
              src={img.imageUrl}
              alt={img.title || `Alquiler de mobiliario para ${eventType.toLowerCase()} en Asunción`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </button>
        ))}
      </div>

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        on={{ view: ({ index: currentIndex }) => setLightboxIndex(currentIndex) }}
        slides={images.map((img) => ({ src: img.imageUrl, alt: img.title ?? undefined }))}
        styles={{ container: { backgroundColor: "rgba(0, 0, 0, 0.9)" } }}
      />
    </>
  );
}
