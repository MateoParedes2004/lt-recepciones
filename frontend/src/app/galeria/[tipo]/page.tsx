import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr";
import EventGalleryGrid from "../../../components/gallery/EventGalleryGrid";
import Breadcrumbs from "../../../components/catalog/Breadcrumbs";
import JsonLd from "../../../components/JsonLd";
import { getGallery } from "../../../lib/catalog";
import { GALLERY_EVENT_TYPES, eventTypeFromSlug, galleryTypePath, filterByEventType } from "../../../lib/gallery";
import { SITE_URL, absoluteUrl, baseOpenGraph, whatsappLink } from "../../../lib/site";

export const revalidate = 60;

// No se arman las 4 páginas durante el build (el backend puede estar
// dormido y quedarían sin fotos): cada una se genera en su primera visita,
// como el resto del catálogo (ver catalogos/[slug]/page.tsx).
export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ tipo: string }>;

// Copy propio por tipo: por qué alguien buscaría justo esto, no genérico.
const INTRO: Record<string, string> = {
  Bodas: "Mesas, sillas, vajilla y mantelería para la ceremonia y la recepción. Mirá montajes reales de bodas que armamos en Asunción y Gran Asunción antes de armar tu propia cotización.",
  "Cumpleaños de 15": "Pistas, mesas de invitados, sillas y ambientación para la fiesta de 15 años. Estas son fotos reales de quinces que equipamos, para que te inspires con el estilo que más te guste.",
  "Cumpleaños": "Desde cumpleaños infantiles hasta festejos de adultos: así quedaron armados algunos de los eventos que equipamos con nuestro mobiliario.",
  "Otros": "Otros eventos que equipamos con nuestro mobiliario: bautismos, primeras comuniones, aniversarios y más.",
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tipo } = await params;
  const eventType = eventTypeFromSlug(tipo);
  if (!eventType) return { title: "Página no encontrada" };

  const title = `Fotos de Alquiler para ${eventType} en Asunción`;
  const description = INTRO[eventType].slice(0, 160);
  const path = galleryTypePath(eventType);
  const images = filterByEventType(await getGallery(), eventType);
  const cover = images[0];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...baseOpenGraph,
      title: `${title} | LT Recepciones`,
      description,
      url: path,
      ...(cover ? { images: [{ url: cover.imageUrl, alt: cover.title || title }] } : {}),
    },
  };
}

export default async function GaleriaTipoPage({ params }: { params: Params }) {
  const { tipo } = await params;
  const eventType = eventTypeFromSlug(tipo);
  if (!eventType) notFound();

  const allImages = await getGallery();
  const images = filterByEventType(allImages, eventType);
  const otherTypes = GALLERY_EVENT_TYPES.filter((t) => t !== eventType && allImages.some((img) => img.eventType === t));
  const url = absoluteUrl(galleryTypePath(eventType));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#pagina`,
    url,
    name: `Fotos de alquiler para ${eventType} en Asunción`,
    description: INTRO[eventType],
    inLanguage: "es-PY",
    isPartOf: { "@id": `${SITE_URL}/#sitio` },
    about: { "@id": `${SITE_URL}/#negocio` },
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-8 pb-24">
      <JsonLd data={jsonLd} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { name: "Inicio", href: "/" },
            { name: "Galería", href: "/galeria" },
            { name: eventType, href: galleryTypePath(eventType) },
          ]}
        />

        <header className="mb-8 md:mb-10 max-w-3xl">
          <h1 className="text-[27px] md:text-[40px] leading-tight font-serif font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Fotos de alquiler para {eventType.toLowerCase()}
            <span className="block text-lg md:text-2xl font-bold text-[#004080] dark:text-[#3b9dff] mt-1">en Asunción</span>
          </h1>
          <p className="text-[14px] md:text-base text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
            {INTRO[eventType]}
          </p>
        </header>

        {images.length > 0 ? (
          <EventGalleryGrid images={images} eventType={eventType} />
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-slate-100">Todavía no subimos fotos de este tipo</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Consultanos por WhatsApp y te mostramos ejemplos de eventos similares.</p>
          </div>
        )}

        {/* AYUDA POR WHATSAPP */}
        <div className="mt-12 md:mt-16 rounded-3xl bg-linear-to-br from-[#0d4a8a] to-[#00294f] text-white p-6 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold">¿Organizás {eventType === "Bodas" ? "una boda" : `un evento de ${eventType.toLowerCase()}`}?</h2>
            <p className="text-blue-100 mt-2 text-sm md:text-base max-w-xl">
              Contanos la fecha y la cantidad de invitados y te ayudamos a armar todo lo que necesitás.
            </p>
          </div>
          <a
            href={whatsappLink(`¡Hola LT Recepciones! ✨ Estoy organizando un evento (${eventType}) y quiero una cotización.`)}
            target="_blank"
            rel="noopener noreferrer"
            data-wa="galeria"
            className="lt-beam [--lt-beam-color:#3b9dff] shrink-0 inline-flex items-center justify-center gap-2.5 h-13 px-6 rounded-xl text-[15px] font-extrabold text-[#004080] bg-white hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <WhatsappLogoIcon weight="light" className="w-6 h-6" /> Escribinos por WhatsApp
          </a>
        </div>

        {/* OTROS TIPOS DE EVENTO + VOLVER A LA GALERÍA COMPLETA */}
        <nav aria-label="Otros tipos de evento" className="mt-12 md:mt-16">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">Más inspiración</h2>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/galeria"
                className="inline-flex h-9 items-center px-4 rounded-full text-[13px] font-bold whitespace-nowrap border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#004080] dark:hover:border-[#3b9dff] hover:text-[#004080] dark:hover:text-[#3b9dff] transition-colors"
              >
                Ver toda la galería
              </Link>
            </li>
            {otherTypes.map((t) => (
              <li key={t}>
                <Link
                  href={galleryTypePath(t)}
                  className="inline-flex h-9 items-center px-4 rounded-full text-[13px] font-bold whitespace-nowrap border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#004080] dark:hover:border-[#3b9dff] hover:text-[#004080] dark:hover:text-[#3b9dff] transition-colors"
                >
                  Fotos de {t}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
