export const revalidate = 60;

import CatalogBrowser from "../../../components/catalog/CatalogBrowser";
import ScrollToHash from "../../../components/ScrollToHash";
import JsonLd from "../../../components/JsonLd";
import { Metadata } from "next";
import { getCategories } from "../../../lib/catalog";
import { absoluteUrl, baseOpenGraph, categoryPath } from "../../../lib/site";

const TITLE = "Catálogo de Alquiler para Eventos: Sillas, Mesas, Vajilla y Más";
const DESCRIPTION =
  "Catálogo completo con precios: sillas Tiffany, mesas, mantelería, vajilla, cristalería, cubiertos y más para alquilar en Asunción. Armá tu cotización y enviala por WhatsApp.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/catalogos" },
  openGraph: {
    ...baseOpenGraph,
    title: `${TITLE} | LT Recepciones`,
    description: DESCRIPTION,
    url: "/catalogos",
  },
};

export default async function Catalogos() {
  const categories = await getCategories();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl("/catalogos")}#pagina`,
        url: absoluteUrl("/catalogos"),
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: "es-PY",
        isPartOf: { "@id": `${absoluteUrl("/")}/#sitio` },
        about: { "@id": `${absoluteUrl("/")}/#negocio` },
        hasPart: categories
          .filter((c) => (c.products ?? []).length > 0)
          .map((c) => ({ "@type": "CollectionPage", name: `Alquiler de ${c.name}`, url: absoluteUrl(categoryPath(c)) })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Catálogo", item: absoluteUrl("/catalogos") },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-slate-50 pt-8 pb-24">
      <JsonLd data={jsonLd} />
      <ScrollToHash />
      <CatalogBrowser categories={categories} />
    </main>
  );
}
