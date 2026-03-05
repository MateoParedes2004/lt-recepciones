import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, AlertCircle, Package } from "lucide-react";
import AddToCartButton from "../../../components/AddToCartButton";
import ProductActions from "../../../components/ProductActions";
import BackButton from "../../../components/BackButton"; 
// 👇 Importamos los nuevos animadores
import { ProductImageAnimator, ProductInfoAnimator } from "../../../components/ProductDetailAnimator";

const getImageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '')}${path}`;
};

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

// MAGIA SEO DINÁMICA
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const resolvedParams = await params;
  
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${resolvedParams.id}`);
    if (!res.ok) throw new Error("Producto no encontrado");
    const product = await res.json();

    return {
      title: `${product.name} | Alquiler en LT Recepciones`,
      description: product.description.substring(0, 160),
      openGraph: {
        title: product.name,
        description: product.description,
        images: [{ url: getImageUrl(product.imageUrl) }],
      },
    };
  } catch (error) {
    return { title: "Producto | LT Recepciones" };
  }
}

// LA PÁGINA VISUAL DEL PRODUCTO
export default async function ProductDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  
  let product = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${resolvedParams.id}`, { cache: 'no-store' });
    if (res.ok) {
      product = await res.json();
    }
  } catch (error) {
    console.error("Error al cargar producto:", error);
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <h1 className="text-2xl font-serif font-bold text-slate-900 mb-4">Producto no encontrado</h1>
        <BackButton />
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": getImageUrl(product.imageUrl),
    "description": product.description,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "PYG",
      "price": product.pricePerDay,
      "availability": product.totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "LT Recepciones"
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <BackButton />

        <div className="bg-white rounded-4xl shadow-xl border border-slate-100 overflow-hidden mt-6">
          <div className="flex flex-col md:flex-row">
            
            {/* Columna Izquierda: Imagen (Con Animación) */}
            <div className="w-full md:w-1/2 bg-slate-100 relative min-h-75 md:min-h-125 flex items-center justify-center p-8 overflow-hidden">
              <ProductImageAnimator>
                {product.imageUrl ? (
                  <img 
                    src={getImageUrl(product.imageUrl)} 
                    alt={`Fotografía de ${product.name}`} 
                    className="max-w-full max-h-125 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500 mix-blend-multiply"
                  />
                ) : (
                  <Package className="w-32 h-32 text-slate-300" />
                )}
                <div className="absolute top-0 left-0 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-slate-200">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    {product.category?.name || "Equipamiento"}
                  </span>
                </div>
              </ProductImageAnimator>
            </div>

            {/* Columna Derecha: Detalles (Con Animación) */}
            <div className="w-full md:w-1/2 p-8 md:p-12">
              <ProductInfoAnimator>
                
                {/* 👇 APLICAMOS FONT-SERIF AL TÍTULO */}
                <h1 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                  {product.name}
                </h1>
                
                <div className="text-3xl font-bold text-blue-600 mb-6">
                  {formatPYG(product.pricePerDay)} <span className="text-base font-normal text-slate-500">/ día</span>
                </div>

                <div className="prose prose-slate mb-8 text-slate-600 leading-relaxed">
                  <p>{product.description}</p>
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
      </div>
    </main>
  );
}