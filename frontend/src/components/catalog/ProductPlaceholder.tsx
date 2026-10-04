import { TableIcon } from "@phosphor-icons/react/dist/ssr";

// Recuadro que reemplaza la foto cuando el producto todavía no tiene imagen.
// Antes decía "Sin imagen", que se veía como algo roto. Ahora muestra el ícono
// de mesa y la marca: el nombre del producto ya está escrito debajo de la
// tarjeta (y en el título de la ficha), así que no se repite acá.
export default function ProductPlaceholder({ size = "card" }: { size?: "card" | "detail" }) {
  const isDetail = size === "detail";
  return (
    <div className={`flex flex-col items-center justify-center text-center ${isDetail ? "gap-5" : "gap-2"}`}>
      <TableIcon weight="light" className={isDetail ? "w-28 h-28 text-[#004080]/25" : "w-12 h-12 text-[#004080]/25"} aria-hidden="true" />
      <span className={`font-serif tracking-wide text-slate-400 ${isDetail ? "text-lg" : "text-xs"}`}>LT Recepciones</span>
    </div>
  );
}
