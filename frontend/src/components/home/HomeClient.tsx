"use client";

import { useState, useEffect, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import ScrollToHash from "../ScrollToHash";
import { motion } from "framer-motion";
import { ArrowRight, Star, Truck, ShieldCheck } from "lucide-react";
// Íconos de categoría: Phosphor en peso "light" (trazo fino, más elegante)
import { BowlFoodIcon, TableIcon, ForkKnifeIcon, WineIcon, ChairIcon, CampfireIcon, SnowflakeIcon, PackageIcon, MapPinIcon, PhoneIcon, ClockIcon, WhatsappLogoIcon, NavigationArrowIcon, PlusIcon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Category, GalleryImage } from "../../types";
import type { FaqItem } from "../../lib/faq";
import { categoryPath } from "../../lib/site";
// 👇 VISOR DE IMÁGENES: se difiere porque solo hace falta si el usuario abre una foto
import "yet-another-react-lightbox/styles.css";
const Lightbox = dynamic(() => import("yet-another-react-lightbox"), { ssr: false });

// Ícono de cada categoría (las tarjetas no llevan fotos, solo el ícono)
const CATEGORIA_ICONOS: Record<string, Icon> = {
  "Vajilla y Cristalería": BowlFoodIcon,
  "Mesas y Mantelería": TableIcon,
  "Cubiertos y complementos": ForkKnifeIcon,
  "Bebidas y Barra": WineIcon,
  "Sillas": ChairIcon,
  "Parrillas": CampfireIcon,
  "Climatización": SnowflakeIcon,
};

// Tarjeta de categoría con brillo e inclinación 3D que siguen al mouse
// (mismo tratamiento que se probó en el mockup de mejoras visuales). Solo
// esta tarjeta (el recuadro navy) se mueve con el mouse: el fade-up al
// hacer scroll lo sigue manejando el motion.div que la envuelve, así los
// dos no compiten por la misma propiedad "transform".
function CategoryCard({ category }: { category: Category }) {
  const CategoryIcon = CATEGORIA_ICONOS[category.name] || PackageIcon;
  const [tilt, setTilt] = useState<{ rx: number; ry: number; gx: number; gy: number } | null>(null);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: -(py - 0.5) * 10, ry: (px - 0.5) * 10, gx: px * 100, gy: py * 100 });
  };

  return (
    <Link href={categoryPath(category)} className="group block">
      <div
        onMouseMove={handleMove}
        onMouseLeave={() => setTilt(null)}
        style={{
          transform: tilt
            ? `perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.03) translateY(-3px)`
            : undefined,
          transition: "transform 0.15s ease",
        }}
        className="relative aspect-square rounded-3xl bg-linear-to-br from-[#0d4a8a] to-[#00294f] border border-blue-700/50 shadow-lg overflow-hidden group-hover:shadow-2xl group-hover:shadow-blue-900/30"
      >
        <div className="absolute top-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl -translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

        <div className="relative z-10 w-full h-full flex items-center justify-center">
          {/* La luz animada (lt-beam) rodea SOLO al ícono, no el borde de la tarjeta */}
          <div className="lt-beam w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 flex items-center justify-center">
            <CategoryIcon weight="light" className="w-9 h-9 md:w-11 md:h-11 text-blue-200" />
          </div>
        </div>

        <div className="absolute inset-0 bg-linear-to-t from-blue-950/80 via-blue-950/0 to-transparent pointer-events-none"></div>

        {/* Brillo que sigue al mouse (solo aparece mientras el cursor está encima) */}
        {tilt && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(220px circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.30), transparent 55%)` }}
          />
        )}
      </div>

      <div className="mt-3 md:mt-4 flex items-center justify-between px-1 gap-2">
        <h3 className="font-serif font-bold text-slate-900 text-xs sm:text-sm md:text-base leading-tight">{category.name}</h3>
        <ArrowRight className="w-4 h-4 text-[#004080] shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </div>
    </Link>
  );
}

interface HomeClientProps {
  categories: Category[];
  galeriaImages: GalleryImage[];
  cityNames: string[];
  faq: FaqItem[];
}

// Fotos del carrusel del Hero, con su descripción (Google Imágenes y lectores de pantalla).
const HERO_IMAGES = [
  { src: "/principal1.png", alt: "Mesa de evento con sillas Tiffany doradas, copas y servilletas rosas" },
  { src: "/principal2.png", alt: "Mesa con mantel blanco y azul, platos dorados y sillas Tiffany" },
  { src: "/principal5.png", alt: "Mesa con copas de cristal, platos, servilletas y centro de flores" },
  { src: "/principal6.png", alt: "Salón de eventos con mesas vestidas y sillas Tiffany doradas" },
  { src: "/principal3.png", alt: "Mesas redondas con mantel blanco y sillas Tiffany doradas" },
  { src: "/principal4.png", alt: "Mesas con mantel rosa y sillas blancas para un evento" },
];

export default function HomeClient({ categories, galeriaImages, cityNames, faq }: HomeClientProps) {
  const heroImages = HERO_IMAGES;

  const [currentImage, setCurrentImage] = useState(0);
  // Las 6 fotos del Hero se descargaban todas juntas al abrir la página y
  // competían con la primera (la que se ve), sobre todo en el celular. Ahora
  // arrancan solo la 1ª y la 2ª; el resto se agrega cuando la página ya cargó,
  // mucho antes de que el carrusel llegue a ellas: el fundido se ve igual.
  const [allImagesMounted, setAllImagesMounted] = useState(false);
  // 👇 ESTADOS PARA EL LIGHTBOX
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Cambiar foto del Hero
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  useEffect(() => {
    const timer = setTimeout(() => setAllImagesMounted(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <ScrollToHash />

      {/* 1. HERO SECTION MEJORADO */}
      <section className="relative overflow-hidden bg-slate-950 min-h-[85vh] md:min-h-screen flex items-center">

        <div className="absolute inset-0 bg-slate-950 z-0" />

        {heroImages.map(({ src, alt }, index) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentImage ? "opacity-100" : "opacity-0"
            }`}
          >
            {(index <= 1 || index === currentImage || allImagesMounted) && (
              <Image
                src={src}
                alt={alt}
                fill
                priority={index === 0}
                quality={90}
                className="object-cover object-center md:object-[center_30%] contrast-[1.1] brightness-[0.85] blur-[1px] md:blur-0"
                sizes="100vw"
              />
            )}
          </div>
        ))}

        {/* Capas de Maquillaje */}
        <div className="absolute inset-0 bg-blue-950/40 mix-blend-multiply z-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-900/60 to-transparent opacity-90 z-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.6)_100%)] z-10 pointer-events-none"></div>

        {/* CONTENIDO */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-20 py-24 flex flex-col items-center text-center w-full">

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white tracking-tight mb-6 max-w-5xl drop-shadow-xl leading-[1.1]"
          >
            {/* Línea chica con lo que hacemos y dónde: es lo primero que lee
                Google para entender de qué trata el sitio. */}
            <span className="block text-xs sm:text-sm md:text-base font-bold uppercase tracking-[0.18em] text-blue-100 mb-4 md:mb-6 drop-shadow-md">
              Alquiler de mobiliario, vajilla y mantelería para eventos en Asunción
            </span>
            Transformamos tus espacios en <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-300 to-blue-100 filter drop-shadow-lg block sm:inline mt-2 sm:mt-0">momentos inolvidables</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-base sm:text-lg md:text-xl text-blue-50 mb-10 max-w-2xl font-medium leading-relaxed drop-shadow-md px-2 md:px-0"
          >
            Desde la vajilla más fina hasta el mobiliario más elegante. Alquilamos todo lo que necesitas para que tu casamiento, cumpleaños o evento corporativo sea un éxito total.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link href="/catalogos" className="lt-beam flex items-center justify-center w-full sm:w-auto px-8 py-4 text-sm sm:text-base font-bold text-[#004080] bg-white rounded-xl hover:bg-slate-100 transition-colors shadow-xl shadow-white/10 group cursor-pointer">
              Ver Catálogos Completos <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#contacto" className="lt-beam flex items-center justify-center w-full sm:w-auto px-8 py-4 text-sm sm:text-base font-bold text-white bg-linear-to-br from-[#0d4a8a] to-[#00294f] rounded-xl hover:brightness-110 transition-all shadow-xl cursor-pointer">
              Contactar Asesor
            </Link>
          </motion.div>

          <div className="absolute bottom-6 md:bottom-10 flex space-x-3 z-20">
            {heroImages.map((_, index) => (
              <button key={index} onClick={() => setCurrentImage(index)} className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all duration-300 cursor-pointer ${index === currentImage ? "bg-white scale-125" : "bg-white/40 hover:bg-white/60"}`} aria-label={`Ir a imagen ${index + 1}`} />
            ))}
          </div>
        </div>
      </section>

      {/* 2. VIDRIERA DE CATEGORÍAS */}
      {categories.length > 0 && (
        <section className="py-16 md:py-24 bg-slate-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center max-w-2xl mx-auto mb-10 md:mb-16"
            >
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 mb-4 tracking-tight">Categorías disponibles</h2>
              <p className="text-slate-500 text-base sm:text-lg">Explora por rubro y encontrá exactamente lo que tu evento necesita.</p>
            </motion.div>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-6 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {categories.map((category, index) => (
                <motion.div
                  key={category.id}
                  className="snap-center shrink-0 w-32 sm:w-36 md:w-auto"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  viewport={{ once: true, margin: "-50px" }}
                >
                  <CategoryCard category={category} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GALERÍA DE EVENTOS */}
      {galeriaImages.length > 0 && (
        <section className="py-16 md:py-24 bg-slate-900 overflow-hidden" id="galeria">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">

            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
              className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-16 gap-4"
            >
              <div>
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4 tracking-tight">Inspiración para tu Evento</h2>
                <p className="text-slate-400 text-base sm:text-lg max-w-2xl">Un vistazo a los montajes reales donde nuestro mobiliario fue protagonista de momentos únicos.</p>
              </div>

              <div className="md:hidden flex items-center text-blue-400 text-sm font-medium animate-pulse mt-2 bg-blue-900/20 px-4 py-2 rounded-full border border-blue-500/20">
                <span>Desliza para ver más</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </motion.div>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 -mx-6 px-6 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {galeriaImages.map((img, index) => (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  onClick={() => {
                    setLightboxIndex(index);
                    setIsLightboxOpen(true);
                  }}
                  className={`snap-center shrink-0 w-[85vw] sm:w-[60vw] md:w-auto group relative rounded-3xl overflow-hidden bg-slate-800 h-87.5 cursor-pointer ${
                    index === 0 ? "md:col-span-2 md:row-span-2 md:h-156" : "md:h-75"
                  }`}
                >
                  <div className="absolute inset-0 bg-blue-900/20 group-hover:bg-transparent transition-colors duration-500 z-10 pointer-events-none"></div>
                  <Image
                    src={img.imageUrl}
                    alt={img.title || "Evento LT Recepciones"}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  {img.title && (
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-linear-to-t from-slate-900/90 to-transparent translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none">
                      <p className="text-white font-serif font-bold text-lg">{img.title}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* 👇 COMPONENTE LIGHTBOX CORREGIDO */}
            <Lightbox
              open={isLightboxOpen}
              close={() => setIsLightboxOpen(false)}
              index={lightboxIndex}
              // 🔥 ESTA ES LA LÍNEA QUE ARREGLA EL PROBLEMA:
              on={{ view: ({ index: currentIndex }) => setLightboxIndex(currentIndex) }}
              slides={galeriaImages.map(img => ({ src: img.imageUrl, alt: img.title ?? undefined }))}
              styles={{ container: { backgroundColor: "rgba(0, 0, 0, 0.9)" } }}
            />

          </div>
        </section>
      )}

      {/* 3. SECCIÓN DE BENEFICIOS */}
      <section className="py-16 md:py-24 bg-white overflow-hidden" id="nuestro-trabajo">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center max-w-3xl mx-auto mb-10 md:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mb-4 tracking-tight">El estándar de excelencia en tu evento</h2>
            <p className="text-slate-500 text-base sm:text-lg">Nos obsesionan los detalles. Nos aseguramos de que cada silla, mesa y copa llegue en estado impecable a tu celebración.</p>
          </motion.div>

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {[
              { icon: Star, title: "Calidad Premium", desc: "Renovamos constantemente nuestro stock. Te entregamos mobiliario moderno, limpio y sin rasguños." },
              { icon: Truck, title: "Logística Puntual", desc: "Sabemos que el tiempo es oro en los eventos. Entregamos y retiramos con exactitud de relojero." },
              { icon: ShieldCheck, title: "Stock Garantizado", desc: "Capacidad para eventos grandes y pequeños. Lo que reservas en nuestro sistema, está asegurado para tu fecha." }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
                viewport={{ once: true, margin: "-50px" }}
                className="snap-center shrink-0 w-[85%] md:w-auto bg-slate-50 rounded-4xl p-8 md:p-10 border border-slate-100 hover:-translate-y-2 transition-transform duration-300"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 bg-[#e8f0f8] text-[#004080] rounded-2xl flex items-center justify-center mb-6 shadow-sm"><item.icon className="w-6 h-6 md:w-7 md:h-7" /></div>
                <h3 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ZONAS DE ENTREGA (ciudades cargadas en el panel) */}
      {cityNames.length > 0 && (
        <section className="py-16 md:py-20 bg-slate-50" id="zonas" aria-labelledby="zonas-titulo">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center max-w-3xl mx-auto"
            >
              <h2 id="zonas-titulo" className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mb-4 tracking-tight">
                Entregamos en Asunción y Gran Asunción
              </h2>
              <p className="text-slate-500 text-base sm:text-lg">
                Llevamos y retiramos todo en el lugar de tu evento. El costo de envío lo ves en tu cotización al elegir la ciudad.
              </p>
              <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
                {cityNames.map((name) => (
                  <li key={name} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 shadow-sm">
                    <MapPinIcon weight="light" className="w-4 h-4 text-[#004080]" aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>
      )}

      {/* PREGUNTAS FRECUENTES (el mismo texto va a Google como FAQPage, ver lib/faq.ts) */}
      {faq.length > 0 && (
        <section className="py-16 md:py-24 bg-white" id="preguntas-frecuentes" aria-labelledby="faq-titulo">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 id="faq-titulo" className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mb-8 md:mb-10 tracking-tight text-center">
                Preguntas frecuentes
              </h2>
              <div className="flex flex-col gap-3">
                {faq.map((item) => (
                  <details key={item.question} className="group rounded-2xl border border-slate-200 bg-slate-50 open:bg-white open:shadow-md open:border-[#004080]/25 transition-colors">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
                      <h3 className="text-base md:text-lg font-serif font-bold text-slate-900">{item.question}</h3>
                      <span className="w-8 h-8 rounded-full bg-[#e8f0f8] text-[#004080] flex items-center justify-center shrink-0 transition-transform duration-300 group-open:rotate-45" aria-hidden="true">
                        <PlusIcon weight="light" className="w-4 h-4" />
                      </span>
                    </summary>
                    <p className="px-5 pb-5 md:px-6 md:pb-6 -mt-1 text-slate-600 text-[15px] leading-relaxed">{item.answer}</p>
                  </details>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* 4. SECCIÓN DE CONTACTO Y MAPA */}
      <section className="py-16 md:py-24 bg-white" id="contacto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative rounded-4xl overflow-hidden shadow-xl border border-slate-200 bg-slate-100 lg:min-h-150 lg:flex lg:items-center lg:p-12"
          >
            {/* MAPA: en celular va arriba; en escritorio ocupa todo el fondo */}
            <div className="relative h-64 lg:absolute lg:inset-0 lg:h-auto">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1803.5262122069216!2d-57.60189306166173!3d-25.302442669518815!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1ses-419!2spy!4v1771249262551!5m2!1ses-419!2spy"
                width="100%"
                height="100%"
                style={{ border: 0, position: "absolute", top: 0, left: 0, filter: "saturate(0.75) hue-rotate(8deg)" }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación de LT Recepciones en Asunción"
              ></iframe>
              <div className="absolute inset-0 bg-[#004080]/10 mix-blend-multiply pointer-events-none"></div>
              {/* Pin propio de la marca (el centro del mapa es la ubicación) */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
                <span className="absolute -inset-3 rounded-full bg-[#004080]/25 animate-ping motion-reduce:animate-none"></span>
                <span className="relative flex w-11 h-11 items-center justify-center rounded-full bg-linear-to-br from-[#0d4a8a] to-[#00294f] text-white border-[3px] border-white shadow-lg">
                  <MapPinIcon weight="light" className="w-6 h-6" />
                </span>
              </div>
            </div>

            {/* TARJETA DE CONTACTO */}
            <div className="relative z-10 bg-white rounded-3xl shadow-2xl -mt-9 mx-3.5 mb-3.5 p-6 sm:p-8 lg:m-0 lg:w-[min(440px,46%)] lg:p-9 flex flex-col">
              <h2 className="text-[28px] md:text-4xl font-serif font-extrabold text-slate-900 tracking-tight leading-tight">Estamos para ayudarte</h2>
              <p className="text-slate-600 text-[15px] leading-relaxed mt-3">
                ¿Tenés dudas sobre las cantidades o necesitás asesoramiento para tu evento? Escribinos o visitanos, nos encantará formar parte de tu celebración.
              </p>

              <div className="mt-6 flex flex-col">
                <div className="flex items-start gap-4 py-4 border-t border-slate-100 first:border-t-0">
                  <span className="w-11 h-11 rounded-xl bg-[#e8f0f8] text-[#004080] flex items-center justify-center shrink-0">
                    <MapPinIcon weight="light" className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Ubicación</span>
                    <span className="block text-base font-bold text-slate-900">Asunción, Paraguay</span>
                    <span className="block text-sm text-slate-500">Atención en nuestras oficinas previa cita.</span>
                  </div>
                </div>

                <div className="flex items-start gap-4 py-4 border-t border-slate-100">
                  <span className="w-11 h-11 rounded-xl bg-[#e8f0f8] text-[#004080] flex items-center justify-center shrink-0">
                    <PhoneIcon weight="light" className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">WhatsApp</span>
                    <a href="tel:+595985867749" className="block text-base font-bold text-slate-900 hover:text-[#004080] transition-colors">+595 985 867 749</a>
                  </div>
                </div>

                <div className="flex items-start gap-4 py-4 border-t border-slate-100">
                  <span className="w-11 h-11 rounded-xl bg-[#e8f0f8] text-[#004080] flex items-center justify-center shrink-0">
                    <ClockIcon weight="light" className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Horario</span>
                    <span className="block text-base font-bold text-slate-900">Lunes a Domingo</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row lg:flex-col gap-3">
                <a
                  href="https://api.whatsapp.com/send?phone=595985867749&text=Hola%20LT%20Recepciones!%20%E2%9C%A8%20Tengo%20una%20consulta."
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa="contacto"
                  className="lt-beam [--lt-beam-color:#3b9dff] shrink-0 sm:flex-1 lg:flex-none flex items-center justify-center gap-2.5 h-13 px-6 rounded-xl text-[15px] font-extrabold text-white bg-linear-to-br from-[#0d4a8a] to-[#00294f] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
                >
                  <WhatsappLogoIcon weight="light" className="w-6 h-6" /> Escribinos por WhatsApp
                </a>
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=-25.302442669518815,-57.60189306166173"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 h-13 px-6 rounded-xl text-[15px] font-extrabold text-[#004080] border-[1.5px] border-[#004080] hover:bg-[#e8f0f8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <NavigationArrowIcon weight="light" className="w-5 h-5" /> Cómo llegar
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </main>
  );
}
