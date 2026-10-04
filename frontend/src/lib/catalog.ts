import { cache } from "react";
import { getApiUrl } from "./api";
import { slugify } from "./site";
import type { Category, City, GalleryImage, Product } from "../types";

// Lecturas del catálogo para las páginas que se arman en el servidor (Home,
// catálogo, rubros, fichas, sitemap, menú). Todas usan la misma URL y las
// mismas opciones, así Next reutiliza una sola respuesta por página aunque
// la pidan el menú, los metadatos y el contenido a la vez.

const REVALIDATE_SECONDS = 60;
// El backend gratuito de Render "duerme" y tarda en despertar: sin un tope,
// una página nueva podía quedarse esperando casi un minuto antes de mostrarse.
const TIMEOUT_MS = 10_000;

/** El backend no respondió (caído, dormido, error 5xx): no es lo mismo que "no hay datos". */
export class BackendUnavailableError extends Error {
  constructor(path: string, status: number) {
    super(`El backend no respondió a ${path} (${status || "sin conexión"})`);
    this.name = "BackendUnavailableError";
  }
}

// Durante el build (Vercel) el backend de Render puede estar dormido: ahí no
// se corta el build, se arma la página vacía y se renueva a los 60 s.
const isBuildPhase = () => process.env.NEXT_PHASE === "phase-production-build";

async function getJson<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  try {
    const res = await fetch(`${getApiUrl()}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch (error) {
    console.error(`No se pudo leer ${path} del backend:`, error);
    return { ok: false, status: 0 };
  }
}

/**
 * Rubros con sus productos activos (orden del panel; productos de la A a la Z).
 *
 * Si el backend no responde, LANZA un error en vez de devolver una lista
 * vacía. Parece peor pero es lo correcto: una página que falla al renovarse
 * deja en pie la versión anterior guardada en caché (con todos sus productos),
 * mientras que "lista vacía" se guardaba como página válida y Google podía
 * ver el catálogo sin productos. Solo el menú (que va en TODAS las páginas,
 * también el panel) usa getCategoriesOrEmpty, para no tirar abajo el sitio entero.
 */
export const getCategories = cache(async (): Promise<Category[]> => {
  const res = await getJson<Category[]>("/categories");
  if (res.ok && Array.isArray(res.data)) return res.data;
  if (isBuildPhase()) return [];
  throw new BackendUnavailableError("/categories", res.ok ? 200 : res.status);
});

/** Igual que getCategories, pero sin cortar la página si el backend no responde. */
export async function getCategoriesOrEmpty(): Promise<Category[]> {
  try {
    return await getCategories();
  } catch {
    return [];
  }
}

export const getCategoryBySlug = cache(async (slug: string): Promise<Category | null> => {
  const categories = await getCategories();
  return categories.find((c) => slugify(c.name) === slug) ?? null;
});

/**
 * Un producto por id. "No existe" (404/400) devuelve null, para responder un
 * 404 real y que Google lo saque del índice. Si el backend no respondió, lanza
 * (ver getCategories): el producto puede existir y no hay que guardar en
 * caché una página de error como si fuera la ficha.
 */
export const getProduct = cache(async (id: number): Promise<Product | null> => {
  const res = await getJson<Product>(`/products/${id}`);
  if (res.ok) return res.data;
  if (res.status === 404 || res.status === 400) return null;
  throw new BackendUnavailableError(`/products/${id}`, res.status);
});

/** Ciudades de entrega activas (las inactivas no se muestran al público). No esencial: vacío si falla. */
export const getActiveCities = cache(async (): Promise<City[]> => {
  const res = await getJson<City[]>("/cities");
  return res.ok && Array.isArray(res.data) ? res.data.filter((c) => c.isActive) : [];
});

/** Fotos de la galería. No esencial: vacío si falla. */
export const getGallery = cache(async (): Promise<GalleryImage[]> => {
  const res = await getJson<GalleryImage[]>("/gallery");
  return res.ok && Array.isArray(res.data) ? res.data : [];
});
