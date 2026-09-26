export const revalidate = 60;

import CatalogBrowser from "../../components/catalog/CatalogBrowser";
import ScrollToHash from "../../components/ScrollToHash";
import { Metadata } from "next"; // 👇 IMPORTAMOS METADATA
import { getApiUrl } from "../../lib/api";

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

async function getCategories() {
  try {
    const res = await fetch(`${getApiUrl()}/categories`, { next: { revalidate: 60 } });
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
      <ScrollToHash />
      <CatalogBrowser categories={categories} />
    </main>
  );
}
