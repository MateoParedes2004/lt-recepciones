import HomeClient from "../components/home/HomeClient";
import { getApiUrl } from "../lib/api";

// Categorías que no queremos mostrar en la vidriera del Home
const CATEGORIAS_OCULTAS = ["Climatización"];

async function getCategories() {
  try {
    const res = await fetch(`${getApiUrl()}/categories`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.filter((cat: any) => !CATEGORIAS_OCULTAS.includes(cat.name));
  } catch (error) {
    console.error("Error cargando categorías:", error);
    return [];
  }
}

async function getGallery() {
  try {
    const res = await fetch(`${getApiUrl()}/gallery`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("Error cargando galería:", error);
    return [];
  }
}

export default async function Home() {
  const [categories, galeriaImages] = await Promise.all([getCategories(), getGallery()]);

  return <HomeClient categories={categories} galeriaImages={galeriaImages} />;
}
