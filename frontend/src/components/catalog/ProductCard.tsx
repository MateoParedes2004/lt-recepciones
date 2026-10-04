import Link from "next/link";
import Image from "next/image";
import AddToCartButton from "../AddToCartButton";
import { getImageUrl } from "../../lib/api";
import { productPath } from "../../lib/site";
import type { Product } from "../../types";

const formatPYG = (amount: number) => {
  if (!amount) return 'Gs. 0';
  return `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

// Tarjeta de producto del catálogo. Es la misma en /catalogos, en la página de
// cada rubro y en "También te puede interesar" de la ficha de producto.
// "carousel": ancho fijo para la fila deslizable del celular (como en /catalogos).
// "grid": ocupa la celda de una grilla.
export default function ProductCard({ product, layout = "carousel" }: { product: Product; layout?: "carousel" | "grid" }) {
  const sizing = layout === "carousel" ? "snap-center shrink-0 w-[60vw] sm:w-55 md:w-auto" : "w-full";

  return (
    <div className={`${sizing} bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group relative`}>

      <Link href={productPath(product)} className="block flex-col grow cursor-pointer">
        {/* Imagen */}
        <div className="h-36 md:h-40 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {product.imageUrl ? (
            <Image
              src={getImageUrl(product.imageUrl)}
              alt={`Alquiler de ${product.name}`}
              fill
              sizes={layout === "carousel" ? "(max-width: 768px) 60vw, (max-width: 1024px) 33vw, 20vw" : "(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"}
              className="object-contain p-3 group-hover:scale-105 transition-transform duration-700 drop-shadow-sm mix-blend-multiply"
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
      {layout === "carousel" ? (
        <div className="px-3 md:px-4 pb-3 md:pb-4 flex items-center justify-between border-t border-slate-50 pt-3 mt-auto gap-2">
          <div className="flex flex-col pointer-events-none">
            <span className="text-[8px] md:text-[9px] uppercase font-bold text-slate-400 tracking-wider">Precio / Unidad</span>
            <span className="font-serif font-bold text-blue-900 text-sm md:text-base">{formatPYG(product.pricePerDay)}</span>
          </div>

          <div className="shrink-0 transform scale-90 md:scale-100 origin-right relative z-10">
            <AddToCartButton product={product} />
          </div>
        </div>
      ) : (
        // En la grilla del celular (2 columnas angostas) el precio va arriba y
        // el botón ocupa todo el ancho, para que nada se corte en varias líneas.
        <div className="px-3 md:px-4 pb-3 md:pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-slate-50 pt-3 mt-auto gap-2">
          <div className="flex flex-col pointer-events-none">
            <span className="text-[8px] md:text-[9px] uppercase font-bold text-slate-400 tracking-wider whitespace-nowrap">Precio / Unidad</span>
            <span className="font-serif font-bold text-blue-900 text-sm md:text-base whitespace-nowrap">{formatPYG(product.pricePerDay)}</span>
          </div>

          <div className="w-full sm:w-auto sm:shrink-0 relative z-10">
            <AddToCartButton product={product} popupFullWidth />
          </div>
        </div>
      )}

    </div>
  );
}
