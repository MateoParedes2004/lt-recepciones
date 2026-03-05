export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from "next/link";
import { ArrowRight, Sparkles, Armchair, PackageOpen } from "lucide-react";
import AddToCartButton from "../../components/AddToCartButton";
import { Metadata } from "next"; // 👇 IMPORTAMOS METADATA

// 👇 INYECTAMOS EL SEO ESPECÍFICO PARA EL CATÁLOGO
export const metadata: Metadata = {
  title: "Catálogo Completo de Mobiliario y Vajilla",
  description: "Explora nuestro inventario completo. Cotiza al instante sillas Tiffany, mesas imperiales, cristalería y accesorios para hacer de tu celebración un momento inolvidable.",
  openGraph: {
    title: "Catálogo de Alquiler | LT Recepciones",
    description: "Arma tu cotización con los mejores productos para eventos en Paraguay. Calidad premium garantizada.",
    url: "https://www.ltrecepciones.com/catalogos",
  }
};

const formatPYG = (amount: number) => {
  if (!amount) return 'Gs. 0';
  return `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const getImageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path; 
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, '')}${path}`; 
};

async function getCategories() {
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/categories`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`El Backend rechazó la petición con código: ${res.status}`);
      throw new Error('Error al cargar categorías');
    }
    return await res.json();
  } catch (error) {
    console.error("Error conectando con la base de datos:", error);
    return [];
  }
}

export default async function Catalogos() {
  const categories = await getCategories();

  return (
    <main className="min-h-screen bg-slate-50 pt-8 pb-24">
      
      {/* CABECERA DEL CATÁLOGO */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 md:mb-14">
        <div className="bg-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-600 via-slate-900 to-slate-900"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 mb-4 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-blue-400 mr-2" />
                <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">Inventario Completo</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-serif font-bold mb-3 tracking-tight">Nuestros Catálogos</h1>
              <p className="text-blue-100 text-sm sm:text-base md:text-lg max-w-2xl font-light">
                Explora nuestra selección premium de mobiliario y vajilla para hacer de tu evento un momento inolvidable.
              </p>
            </div>
            <div className="shrink-0 hidden md:block">
              <Armchair className="w-28 h-28 text-blue-400 opacity-50 drop-shadow-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* LISTA DE CATEGORÍAS Y PRODUCTOS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {categories.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="inline-flex p-4 bg-blue-50 rounded-full mb-4 text-blue-600">
              <Armchair className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif font-bold text-slate-900">Inventario en preparación</h3>
            <p className="text-slate-500 mt-2 text-sm">Pronto subiremos nuestros mejores productos aquí.</p>
          </div>
        ) : (
          categories.map((category: any) => (
            <section key={category.id} className="mb-12 md:mb-16 scroll-mt-28" id={`categoria-${category.name.toLowerCase().replace(/ /g, '-')}`}>
              
              <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 md:mb-6 pb-3 border-b border-slate-200 gap-2">
                <div>
                  <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 tracking-wide">{category.name}</h2>
                  {category.description && (
                    <p className="text-slate-500 text-xs md:text-sm mt-1 max-w-2xl">{category.description}</p>
                  )}
                </div>
              </div>

              {/* CONTENEDOR MÁGICO Y COMPACTO */}
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                {category.products && category.products.length > 0 ? (
                  category.products.map((product: any) => (
                    
                    // TARJETA DE PRODUCTO 
                    <div key={product.id} className="snap-center shrink-0 w-[60vw] sm:w-55 md:w-auto bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group relative">
                      
                      <Link href={`/catalogos/${product.id}`} className="block flex-col grow cursor-pointer">
                        {/* Imagen */}
                        <div className="h-36 md:h-40 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                          {product.imageUrl ? (
                            <img 
                              src={getImageUrl(product.imageUrl)} 
                              alt={product.name} 
                              loading="lazy" 
                              className="object-contain p-3 w-full h-full group-hover:scale-105 transition-transform duration-700 drop-shadow-sm mix-blend-multiply" 
                            />
                          ) : (
                            <div className="text-slate-400 font-medium flex flex-col items-center">
                              <span className="text-[9px] uppercase tracking-wider mb-1 opacity-50">LT Recepciones</span>
                              <span className="text-xs">Sin imagen</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Detalles */}
                        <div className="p-3 md:p-4 flex flex-col grow">
                          <h3 className="font-serif font-bold text-slate-900 text-base md:text-lg mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                          <p className="text-[11px] md:text-xs text-slate-500 line-clamp-2 mb-3 grow leading-relaxed">{product.description}</p>
                        </div>
                      </Link>
                      
                      {/* ZONA DE COMPRA */}
                      <div className="px-3 md:px-4 pb-3 md:pb-4 flex items-center justify-between border-t border-slate-50 pt-3 mt-auto gap-2">
                        <div className="flex flex-col pointer-events-none">
                          <span className="text-[8px] md:text-[9px] uppercase font-bold text-slate-400 tracking-wider">Precio / Unidad</span>
                          <span className="font-serif font-bold text-blue-900 text-sm md:text-base">{formatPYG(product.pricePerDay)}</span>
                        </div>
                        
                        <div className="shrink-0 transform scale-90 md:scale-100 origin-right relative z-10">
                          <AddToCartButton product={product} />
                        </div>
                      </div>

                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 md:py-10 bg-white rounded-2xl border border-dashed border-slate-200 flex items-center justify-center">
                    <p className="text-slate-400 text-xs text-center">
                      Aún no hay productos disponibles en esta categoría.
                    </p>
                  </div>
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}