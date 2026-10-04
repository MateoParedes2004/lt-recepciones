import HomeClient from "../components/home/HomeClient";
import JsonLd from "../components/JsonLd";
import { getActiveCities, getCategories, getGallery } from "../lib/catalog";
import { buildFaq } from "../lib/faq";
import { SITE_URL, absoluteUrl, categoryPath } from "../lib/site";

export const revalidate = 60;

// Categorías que no queremos mostrar en la vidriera del Home
const CATEGORIAS_OCULTAS = ["Climatización"];

export default async function Home() {
  // getCategories (no la versión "OrEmpty"): si el backend no responde, la
  // renovación falla y Next sigue mostrando el Home anterior con sus rubros,
  // en vez de guardar uno sin tarjetas. (Durante el build no corta: ver lib/catalog.)
  const [allCategories, galeriaImages, cities] = await Promise.all([getCategories(), getGallery(), getActiveCities()]);
  // Las tarjetas del Home solo usan id y nombre: sin los productos adentro,
  // la página no carga el catálogo entero en el navegador.
  const categories = allCategories
    .filter((cat) => !CATEGORIAS_OCULTAS.includes(cat.name))
    .map(({ id, name }) => ({ id, name }));
  // Zonas de entrega = ciudades con costo de envío cargado en el panel. Las
  // demás (precio 0, "se coordina") existen para el selector del carrito,
  // pero son todo el país: listarlas en el Home no diría dónde se entrega.
  const cityNames = cities
    .filter((c) => Number(c.price) > 0)
    .sort((a, b) => Number(a.price) - Number(b.price) || a.name.localeCompare(b.name, "es"))
    .slice(0, 40)
    .map((c) => c.name);
  const faq = buildFaq(cityNames);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#inicio`,
        url: SITE_URL,
        name: "Alquiler de sillas, mesas y vajilla para eventos en Asunción",
        inLanguage: "es-PY",
        isPartOf: { "@id": `${SITE_URL}/#sitio` },
        about: { "@id": `${SITE_URL}/#negocio` },
        // Rubros principales: ayudan a que Google entienda qué se alquila.
        hasPart: allCategories
          .filter((c) => (c.products ?? []).length > 0)
          .map((c) => ({ "@type": "CollectionPage", name: `Alquiler de ${c.name}`, url: absoluteUrl(categoryPath(c)) })),
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#preguntas`,
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <HomeClient categories={categories} galeriaImages={galeriaImages} cityNames={cityNames} faq={faq} />
    </>
  );
}
