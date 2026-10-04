import Link from "next/link";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr";
import ProductCard from "./ProductCard";
import Breadcrumbs from "./Breadcrumbs";
import JsonLd from "../JsonLd";
import { SITE_URL, absoluteUrl, categoryPath, productPath, whatsappLink } from "../../lib/site";
import type { Category } from "../../types";

/** "Sillas, Mesas" → texto para la descripción cuando el rubro no tiene una cargada. */
export function categoryIntro(category: Category): string {
  const count = category.products?.length ?? 0;
  const lower = category.name.toLowerCase();
  return `Alquilá ${lower} para casamientos, cumpleaños y eventos corporativos en Asunción y Gran Asunción. ${
    count === 1 ? "Tenemos 1 opción disponible" : `Tenemos ${count} opciones disponibles`
  }, con precio por unidad: armá tu cotización y enviala por WhatsApp.`;
}

/** Descripción para Google: nombra los primeros productos para que el resultado diga qué hay. */
export function categoryMetaDescription(category: Category): string {
  const names = (category.products ?? []).slice(0, 3).map((p) => p.name);
  const list = names.length ? `${names.join(", ")}${(category.products?.length ?? 0) > 3 ? " y más" : ""}. ` : "";
  return `Alquiler de ${category.name.toLowerCase()} para eventos en Asunción: ${list}Precios por unidad, entrega en Gran Asunción y cotización al instante por WhatsApp.`.slice(0, 300);
}

export default function CategoryLanding({ category, allCategories }: { category: Category; allCategories: Category[] }) {
  const products = category.products ?? [];
  const url = absoluteUrl(categoryPath(category));
  const others = allCategories.filter((c) => c.id !== category.id && (c.products ?? []).length > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#pagina`,
    url,
    name: `Alquiler de ${category.name} para eventos en Asunción`,
    description: category.description?.trim() || categoryMetaDescription(category),
    inLanguage: "es-PY",
    isPartOf: { "@id": `${SITE_URL}/#sitio` },
    about: { "@id": `${SITE_URL}/#negocio` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(productPath(p)),
        name: p.name,
      })),
    },
  };

  return (
    <main className="min-h-screen bg-slate-50 pt-8 pb-24">
      <JsonLd data={jsonLd} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { name: "Inicio", href: "/" },
            { name: "Catálogo", href: "/catalogos" },
            { name: category.name, href: categoryPath(category) },
          ]}
        />

        {/* CABECERA DEL RUBRO */}
        <header className="mb-8 md:mb-10 max-w-3xl">
          <h1 className="text-[27px] md:text-[40px] leading-tight font-serif font-extrabold text-slate-900 tracking-tight">
            Alquiler de {category.name}
            <span className="block text-lg md:text-2xl font-bold text-[#004080] mt-1">para eventos en Asunción</span>
          </h1>
          <p className="text-[14px] md:text-base text-slate-600 mt-3 leading-relaxed">
            {category.description?.trim() || categoryIntro(category)}
          </p>
        </header>

        {/* PRODUCTOS */}
        {products.length > 0 ? (
          <section aria-label={`Productos de ${category.name}`}>
            <p className="text-sm text-slate-500 mb-4">
              {products.length} {products.length === 1 ? "producto" : "productos"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} layout="grid" />
              ))}
            </div>
          </section>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-serif font-bold text-slate-900">Estamos cargando este rubro</h2>
            <p className="text-slate-500 mt-2 text-sm">Consultanos por WhatsApp qué necesitás para tu evento.</p>
          </div>
        )}

        {/* AYUDA POR WHATSAPP */}
        <div className="mt-12 md:mt-16 rounded-3xl bg-linear-to-br from-[#0d4a8a] to-[#00294f] text-white p-6 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold">¿No encontrás lo que buscás?</h2>
            <p className="text-blue-100 mt-2 text-sm md:text-base max-w-xl">
              Contanos qué evento estás organizando y te ayudamos a elegir {category.name.toLowerCase()} y todo lo demás que necesites.
            </p>
          </div>
          <a
            href={whatsappLink(`¡Hola LT Recepciones! ✨ Tengo una consulta sobre ${category.name}.`)}
            target="_blank"
            rel="noopener noreferrer"
            data-wa="rubro"
            className="lt-beam [--lt-beam-color:#3b9dff] shrink-0 inline-flex items-center justify-center gap-2.5 h-13 px-6 rounded-xl text-[15px] font-extrabold text-[#004080] bg-white hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <WhatsappLogoIcon weight="light" className="w-6 h-6" /> Escribinos por WhatsApp
          </a>
        </div>

        {/* OTROS RUBROS */}
        {others.length > 0 && (
          <nav aria-label="Otros rubros" className="mt-12 md:mt-16">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-4">Otros rubros para tu evento</h2>
            <ul className="flex flex-wrap gap-2">
              {others.map((c) => (
                <li key={c.id}>
                  <Link
                    href={categoryPath(c)}
                    className="inline-flex h-9 items-center px-4 rounded-full text-[13px] font-bold whitespace-nowrap border bg-white text-slate-700 border-slate-200 hover:border-[#004080] hover:text-[#004080] transition-colors"
                  >
                    Alquiler de {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </main>
  );
}
