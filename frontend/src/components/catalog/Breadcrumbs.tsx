import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import JsonLd from "../JsonLd";
import { absoluteUrl } from "../../lib/site";

export interface Crumb {
  name: string;
  href: string;
}

// Ruta de navegación (Inicio › Catálogo › Sillas › Silla Tiffany). Se ve en
// la página y además se le pasa a Google, que la muestra en el resultado de
// búsqueda en lugar de la dirección cruda.
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };

  return (
    <nav aria-label="Ruta de navegación" className="mb-6">
      <JsonLd data={jsonLd} />
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1.5 min-w-0">
              {isLast ? (
                <span aria-current="page" className="font-medium text-slate-800 truncate max-w-[60vw] sm:max-w-none">{item.name}</span>
              ) : (
                <>
                  <Link href={item.href} className="hover:text-[#004080] hover:underline underline-offset-2 transition-colors">
                    {item.name}
                  </Link>
                  <CaretRightIcon weight="light" className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
