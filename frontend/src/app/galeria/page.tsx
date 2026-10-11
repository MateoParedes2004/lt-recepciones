import { Metadata } from "next";
import GalleryBrowser from "../../components/gallery/GalleryBrowser";
import { getGallery } from "../../lib/catalog";
import { baseOpenGraph } from "../../lib/site";

export const revalidate = 60;

const TITLE = "Galería de Eventos Reales en Asunción";
const DESCRIPTION =
  "Fotos reales de bodas, cumpleaños de 15 y otros eventos montados con el mobiliario de LT Recepciones en Asunción y Gran Asunción. Filtrá por tipo de evento para inspirarte.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/galeria" },
  openGraph: {
    ...baseOpenGraph,
    title: `${TITLE} | LT Recepciones`,
    description: DESCRIPTION,
    url: "/galeria",
  },
};

export default async function GaleriaPage() {
  const images = await getGallery();
  return <GalleryBrowser images={images} />;
}
