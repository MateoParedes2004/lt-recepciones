import Image from "next/image";
import Link from "next/link";
import { CheckCircle, AlertCircle } from "lucide-react";
import ProductActions from "../ProductActions";
import { ProductImageAnimator, ProductInfoAnimator } from "../ProductDetailAnimator";
import ProductCard from "./ProductCard";
import ProductPlaceholder from "./ProductPlaceholder";
import Breadcrumbs from "./Breadcrumbs";
import JsonLd from "../JsonLd";
import TrackView from "../TrackView";
import { getImageUrl } from "../../lib/api";
import { SITE_URL, absoluteUrl, categoryPath, productPath } from "../../lib/site";
import type { Category, Product } from "../../types";

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/** Texto que se muestra (y se le da a Google) cuando el producto no tiene descripción cargada. */
export function fallbackDescription(product: Product): string {
  return `Alquiler de ${product.name} para casamientos, cumpleaños y eventos corporativos en Asunción y Gran Asunción. Consultá la disponibilidad para tu fecha y armá tu cotización por WhatsApp.`;
}

export default function ProductDetail({ product, category }: { product: Product; category: Category | null }) {
  const categoryName = category?.name ?? product.category?.name;
  const url = absoluteUrl(productPath(product));
  const price = Number(product.pricePerDay) || 0;
  const description = product.description?.trim() || fallbackDescription(product);

  // Hasta 4 productos del mismo rubro, para seguir mirando sin volver atrás.
  const related = (category?.products ?? []).filter((p) => p.id !== product.id).slice(0, 4);

  const crumbs = [
    { name: "Inicio", href: "/" },
    { name: "Catálogo", href: "/catalogos" },
    ...(category ? [{ name: category.name, href: categoryPath(category) }] : []),
    { name: product.name, href: productPath(product) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#producto`,
    name: product.name,
    description,
    url,
    sku: `LT-${product.id}`,
    ...(product.imageUrl ? { image: [getImageUrl(product.imageUrl)] } : {}),
    ...(categoryName ? { category: categoryName } : {}),
    brand: { "@type": "Brand", name: "LT Recepciones" },
    // Un precio 0 es un producto sin precio cargado, no uno gratis: sin oferta
    // Google no muestra un "Gs. 0" engañoso en los resultados.
    ...(price > 0
      ? {
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "PYG",
            price,
            availability: product.totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
            areaServed: "Asunción y Gran Asunción",
            seller: { "@id": `${SITE_URL}/#negocio` },
          },
        }
      : {}),
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <JsonLd data={jsonLd} />
      <TrackView type="product_view" id={product.id} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <Breadcrumbs items={crumbs} />

        <div className="bg-white rounded-4xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="flex flex-col md:flex-row">

            {/* Columna Izquierda: Imagen (Con Animación) */}
            <div className="w-full md:w-1/2 bg-slate-100 relative min-h-75 md:min-h-125 flex items-center justify-center p-8 overflow-hidden">
              <ProductImageAnimator>
                {product.imageUrl ? (
                  <Image
                    src={getImageUrl(product.imageUrl)}
                    alt={`Alquiler de ${product.name} para eventos`}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500 mix-blend-multiply"
                  />
                ) : (
                  <ProductPlaceholder size="detail" />
                )}
                {category ? (
                  <Link href={categoryPath(category)} className="absolute top-0 left-0 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-slate-200 hover:border-[#004080] transition-colors">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">{category.name}</span>
                  </Link>
                ) : (
                  <div className="absolute top-0 left-0 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-slate-200">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      {categoryName || "Equipamiento"}
                    </span>
                  </div>
                )}
              </ProductImageAnimator>
            </div>

            {/* Columna Derecha: Detalles (Con Animación) */}
            <div className="w-full md:w-1/2 p-8 md:p-12">
              <ProductInfoAnimator>

                <h1 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                  {product.name}
                </h1>

                <div className="text-3xl font-bold text-blue-600 mb-6">
                  {formatPYG(product.pricePerDay)} <span className="text-base font-normal text-slate-500">/ día</span>
                </div>

                <div className="prose prose-slate mb-8 text-slate-600 leading-relaxed">
                  <p>{description}</p>
                </div>

                <div className="space-y-4 mb-10 border-t border-slate-100 pt-8">
                  <div className="flex items-center">
                    {product.totalStock > 0 ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" />
                        <span className="font-medium text-slate-700">Stock disponible para alquilar</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                        <span className="font-medium text-slate-700">Sin stock momentáneamente</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-700 mb-2">Selecciona la cantidad:</p>
                    <ProductActions product={product} />
                  <p className="text-xs text-center text-slate-400 mt-5">
                    Pagos y confirmación de fechas se coordinan directamente vía WhatsApp.
                  </p>
                </div>

              </ProductInfoAnimator>
            </div>

          </div>
        </div>

        {/* TAMBIÉN TE PUEDE INTERESAR */}
        {related.length > 0 && category && (
          <section className="mt-14 md:mt-20" aria-labelledby="relacionados">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 md:mb-6 pb-3 border-b border-slate-200 gap-2">
              <h2 id="relacionados" className="text-2xl md:text-3xl font-serif font-bold text-slate-900 tracking-wide">
                También te puede interesar
              </h2>
              <Link href={categoryPath(category)} className="shrink-0 text-sm font-bold text-[#004080] hover:text-[#00294f] hover:underline underline-offset-2">
                Ver todo en {category.name} →
              </Link>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
