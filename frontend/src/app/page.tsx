"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image"; 
import { motion } from "framer-motion";
import { ArrowRight, Star, Truck, ShieldCheck, Armchair, GlassWater, Sparkles, MapPin, Phone, Clock, Camera } from "lucide-react";
// 👇 IMPORTAMOS EL VISOR DE IMÁGENES
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

export default function Home() {
  const heroImages = [
    "/principal1.png",
    "/principal2.png",
    "/principal5.png",
    "/principal6.png",
    "/principal3.png",
    "/principal4.png"
  ];

  const [currentImage, setCurrentImage] = useState(0);
  const [galeriaImages, setGaleriaImages] = useState<any[]>([]);
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

  // Cargar Galería
  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/gallery`);
        if (res.ok) {
          const data = await res.json();
          setGaleriaImages(data);
        }
      } catch (error) {
        console.error("Error cargando galería:", error);
      }
    };
    fetchGallery();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      
      {/* 1. HERO SECTION MEJORADO */}
      <section className="relative overflow-hidden bg-slate-950 min-h-[85vh] md:min-h-screen flex items-center">
        
        <div className="absolute inset-0 bg-slate-950 z-0" />

        {heroImages.map((src, index) => (
          <div 
            key={src} 
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentImage ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image 
              src={src} 
              alt={`LT Recepciones Evento ${index + 1}`} 
              fill
              priority={index === 0}
              quality={90} 
              className="object-cover object-center md:object-[center_30%] contrast-[1.1] brightness-[0.85] blur-[1px] md:blur-0"
              sizes="100vw"
            />
          </div>
        ))}

        {/* Capas de Maquillaje */}
        <div className="absolute inset-0 bg-blue-950/40 mix-blend-multiply z-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-900/60 to-transparent opacity-90 z-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.6)_100%)] z-10 pointer-events-none"></div>
        
        {/* CONTENIDO */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-20 py-24 flex flex-col items-center text-center w-full">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/30 border border-blue-300/30 mb-6 md:mb-8 backdrop-blur-md shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-blue-200 mr-2 shrink-0" />
            <span className="text-xs md:text-sm font-bold tracking-wider text-white uppercase drop-shadow-md">Equipamiento Premium para Eventos</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white tracking-tight mb-6 max-w-5xl drop-shadow-xl leading-[1.1]"
          >
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
            <Link href="/catalogos" className="flex items-center justify-center w-full sm:w-auto px-8 py-4 text-sm sm:text-base font-bold text-blue-900 bg-white rounded-xl hover:bg-slate-100 transition-colors shadow-xl shadow-white/10 group cursor-pointer">
              Ver Catálogos Completos <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#contacto" className="flex items-center justify-center w-full sm:w-auto px-8 py-4 text-sm sm:text-base font-bold text-white bg-blue-600/80 backdrop-blur-sm border border-blue-400/50 rounded-xl hover:bg-blue-600 transition-colors shadow-xl cursor-pointer">
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

      {/* 2. SECCIÓN DE BENEFICIOS */}
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
                <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-100 text-blue-900 rounded-2xl flex items-center justify-center mb-6 shadow-sm"><item.icon className="w-6 h-6 md:w-7 md:h-7" /></div>
                <h3 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

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
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 mb-4 backdrop-blur-sm">
                  <Camera className="w-4 h-4 text-blue-400 mr-2" />
                  <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">Nuestro Trabajo</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4 tracking-tight">Inspiración para tu Evento</h2>
                <p className="text-slate-400 text-base sm:text-lg max-w-2xl">Un vistazo a los montajes reales donde nuestro mobiliario fue protagonista de momentos únicos.</p>
              </div>
              
              <div className="md:hidden flex items-center text-blue-400 text-sm font-medium animate-pulse mt-2 bg-blue-900/20 px-4 py-2 rounded-full border border-blue-500/20">
                <span>Desliza para ver más</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </motion.div>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 -mx-6 px-6 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {galeriaImages.map((img: any, index: number) => (
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
              slides={galeriaImages.map(img => ({ src: img.imageUrl, alt: img.title }))}
              styles={{ container: { backgroundColor: "rgba(0, 0, 0, 0.9)" } }}
            />

          </div>
        </section>
      )}

      {/* 3. ADELANTO DE CATEGORÍAS */}
      <section className="py-16 md:py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6 }} 
            viewport={{ once: true, margin: "-100px" }}
            className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 md:mb-12 gap-4"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-3 md:mb-4 tracking-tight">Todo para tu celebración</h2>
              <p className="text-slate-500 text-base sm:text-lg max-w-2xl">Descubre un mundo de posibilidades para vestir tu evento con la mejor gala.</p>
            </div>
            <Link href="/catalogos" className="text-blue-900 font-bold hover:text-blue-700 flex items-center bg-blue-100/70 px-6 py-3 rounded-xl transition-colors shrink-0 text-sm md:text-base mt-2 md:mt-0 w-full md:w-auto justify-center">
              Ir a la tienda <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </motion.div>

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-2 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            
            <motion.div 
              className="snap-center shrink-0 w-[85%] md:w-auto"
              initial={{ opacity: 0, x: -50 }} 
              whileInView={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.6 }} 
              viewport={{ once: true }}
            >
              <Link href="/catalogos" className="block h-full group relative bg-white rounded-4xl p-8 md:p-10 border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10">
                  <Armchair className="w-10 h-10 md:w-12 md:h-12 text-blue-900 mb-5 md:mb-6" />
                  <h3 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2">Mobiliario</h3>
                  <p className="text-slate-500 text-sm md:text-base mb-6 max-w-sm">Sillas Tiffany, mesas imperiales, livings y todo el soporte estructural para acomodar a tus invitados con lujo.</p>
                  <span className="text-sm font-bold text-blue-600 flex items-center">Explorar categoría <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></span>
                </div>
              </Link>
            </motion.div>

            <motion.div 
              className="snap-center shrink-0 w-[85%] md:w-auto"
              initial={{ opacity: 0, x: 50 }} 
              whileInView={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.6 }} 
              viewport={{ once: true }}
            >
              <Link href="/catalogos" className="block h-full group relative bg-white rounded-4xl p-8 md:p-10 border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-slate-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10">
                  <GlassWater className="w-10 h-10 md:w-12 md:h-12 text-blue-900 mb-5 md:mb-6" />
                  <h3 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2">Vajilla y Cristalería</h3>
                  <p className="text-slate-500 text-sm md:text-base mb-6 max-w-sm">Platos de sitio, copas de cristal, cubiertos finos y accesorios de barra para un servicio de catering impecable.</p>
                  <span className="text-sm font-bold text-blue-600 flex items-center">Explorar categoría <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></span>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. SECCIÓN DE CONTACTO Y MAPA */}
      <section className="py-16 md:py-24 bg-white" id="contacto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            
            <motion.div 
              initial={{ opacity: 0, x: -50 }} 
              whileInView={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.6 }} 
              viewport={{ once: true, margin: "-100px" }}
              className="w-full lg:w-1/2 space-y-10"
            >
              <div>
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 mb-4 tracking-tight">Estamos para ayudarte</h2>
                <p className="text-slate-500 text-lg leading-relaxed max-w-xl">
                  ¿Tenes dudas sobre las cantidades o necesitas asesoramiento para tu evento? Escribínos o visítanos, nos encantará formar parte de tu celebración.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start group">
                  <div className="w-14 h-14 bg-blue-100 text-blue-900 rounded-2xl flex items-center justify-center shrink-0 shadow-sm mt-1 group-hover:scale-110 transition-transform">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="ml-5">
                    <h3 className="text-xl font-serif font-bold text-slate-900">Ubicación central</h3>
                    <p className="text-slate-600 mt-2 leading-relaxed">Asunción, Paraguay<br/>Atención en nuestras oficinas previa cita.</p>
                  </div>
                </div>

                <div className="flex items-start group">
                  <div className="w-14 h-14 bg-blue-100 text-blue-900 rounded-2xl flex items-center justify-center shrink-0 shadow-sm mt-1 group-hover:scale-110 transition-transform">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="ml-5">
                    <h3 className="text-xl font-serif font-bold text-slate-900">Atención vía WhatsApp</h3>
                    <p className="text-slate-600 mt-2">+595 985 867 749</p>
                    <a href="https://api.whatsapp.com/send?phone=595985867749&text=Hola%20LT%20Recepciones!%20%E2%9C%A8%20Tengo%20una%20consulta." target="_blank" rel="noopener noreferrer" className="inline-flex items-center mt-3 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
                      Enviar mensaje directamente <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start group">
                  <div className="w-14 h-14 bg-blue-100 text-blue-900 rounded-2xl flex items-center justify-center shrink-0 shadow-sm mt-1 group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="ml-5">
                    <h3 className="text-xl font-serif font-bold text-slate-900">Horarios de Operación</h3>
                    <p className="text-slate-600 mt-2 leading-relaxed">Lunes a Domingo</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              whileInView={{ opacity: 1, scale: 1 }} 
              transition={{ duration: 0.6 }} 
              viewport={{ once: true }}
              className="w-full lg:w-1/2"
            >
              <div className="w-full h-100 md:h-125 bg-slate-100 rounded-4xl overflow-hidden shadow-xl border border-slate-200 relative group">
                <div className="absolute inset-0 bg-blue-900/5 group-hover:bg-transparent transition-colors duration-500 pointer-events-none z-10"></div>
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1803.5262122069216!2d-57.60189306166173!3d-25.302442669518815!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1ses-419!2spy!4v1771249262551!5m2!1ses-419!2spy"
                  width="100%"
                  height="100%"
                  style={{ border: 0, position: "absolute", top: 0, left: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ubicación de LT Recepciones en Asunción"
                ></iframe>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION FINAL */}
      <section className="py-16 md:py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8 }} 
            viewport={{ once: true, margin: "-100px" }}
            className="bg-blue-900 rounded-4xl md:rounded-[3rem] p-8 sm:p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-blue-600 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 md:w-96 md:h-96 bg-blue-800 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 opacity-50"></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-serif font-bold mb-4 md:mb-6 tracking-tight">¿Tenes una fecha en mente?</h2>
              <p className="text-blue-100 text-sm sm:text-base md:text-xl mb-8 md:mb-10 max-w-2xl mx-auto font-light px-2">
                No dejes los detalles para el último momento. Cotiza hoy mismo tu equipamiento y asegura la disponibilidad para tu gran día.
              </p>
              <Link href="/catalogos" className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 text-base md:text-lg font-bold text-blue-900 bg-white rounded-xl md:rounded-2xl hover:bg-slate-50 transition-colors shadow-xl shadow-blue-900/50 hover:scale-105 duration-300 cursor-pointer">
                Armar mi cotización ahora
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

    </main>
  );
}