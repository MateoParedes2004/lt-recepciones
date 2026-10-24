// Datos del negocio y del sitio que usan el SEO (metadatos, datos
// estructurados, sitemap) y las páginas. Un solo lugar para que el nombre,
// el teléfono o la URL nunca queden distintos entre una página y otra.

/**
 * URL pública del sitio, sin barra final. Sale de NEXT_PUBLIC_SITE_URL (en
 * Vercel ya está configurada). Cuando se compre un dominio propio alcanza con
 * cambiar esa variable: canonical, Open Graph, sitemap y datos estructurados
 * se actualizan solos.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://lt-recepciones.vercel.app").replace(/\/$/, "");

export const BUSINESS = {
  name: "LT Recepciones",
  city: "Asunción",
  region: "Asunción y Gran Asunción",
  country: "PY",
  phone: "+595985867749",
  phoneDisplay: "+595 985 867 749",
  whatsapp: "595985867749",
  instagram: "https://www.instagram.com/ltrecepciones",
  facebook: "https://www.facebook.com/share/14VSpY6d3hm/",
  // Centro del mapa de la sección de contacto.
  geo: { latitude: -25.302442669518815, longitude: -57.60189306166173 },
  // Link para que un cliente deje su reseña en Google (se saca del Perfil de
  // Empresa: "Pedir reseñas"). Se carga en Vercel como NEXT_PUBLIC_GOOGLE_REVIEW_URL.
  googleReviewUrl: (process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || "").trim(),
} as const;

export const DEFAULT_OG_IMAGE = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "Mobiliario y vajilla de LT Recepciones montados para un evento en Asunción",
};

// Base de Open Graph que reutilizan todas las páginas. Ojo: en Next, si una
// página define su propio `openGraph`, REEMPLAZA el del layout entero (no se
// combinan). Por eso cada página arma el suyo sobre esta base: si no, al
// compartir el catálogo por WhatsApp se perdían la foto y el nombre del sitio.
export const baseOpenGraph = {
  siteName: BUSINESS.name,
  locale: "es_PY",
  type: "website" as const,
  images: [DEFAULT_OG_IMAGE],
};

/** URL absoluta a partir de una ruta del sitio ("/catalogos" → "https://…/catalogos"). */
export function absoluteUrl(path = "/"): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** "Vajilla y Cristalería" → "vajilla-y-cristaleria" (sin tildes ni símbolos). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Página propia de un rubro: /catalogos/sillas */
export function categoryPath(category: { name: string }): string {
  return `/catalogos/${slugify(category.name)}`;
}

/**
 * Ficha de un producto: /catalogos/12-silla-tiffany. El número va primero
 * porque es lo que identifica al producto; el nombre es para que la dirección
 * diga qué es (Google y quien recibe el link por WhatsApp lo leen). Si el
 * nombre cambia, la dirección vieja redirige sola a la nueva.
 */
export function productPath(product: { id: number; name: string }): string {
  const slug = slugify(product.name);
  return `/catalogos/${product.id}${slug ? `-${slug}` : ""}`;
}

export const formatPYG = (amount: number) =>
  `Gs. ${Math.round(Number(amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/**
 * Texto para <meta name="description">: Google muestra ~160 caracteres, así
 * que se corta ahí pero al final de una palabra (no "…entrega en Gran Asun").
 */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * Arma la descripción con frases completas, en orden de importancia: la
 * primera siempre entra (se corta si es demasiado larga) y de las siguientes
 * se suman solo las que caben, para no terminar en "…con entrega a" a medias.
 */
export function composeMetaDescription(sentences: string[], max = 160): string {
  const [first, ...rest] = sentences.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!first) return "";
  const end = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);
  let out = first.length > max ? metaDescription(first, max) : end(first);
  if (out.endsWith("…")) return out;
  for (const s of rest) {
    const next = `${out} ${end(s)}`;
    if (next.length <= max) out = next;
  }
  return out;
}

/** Link de WhatsApp con un mensaje ya escrito. */
export function whatsappLink(text: string): string {
  return `https://api.whatsapp.com/send?phone=${BUSINESS.whatsapp}&text=${encodeURIComponent(text)}`;
}

/**
 * Teléfono paraguayo escrito de cualquier forma ("0985 123 456", "985123456",
 * "+595 985 123 456") → número internacional sin símbolos ("595985123456"),
 * que es lo que pide WhatsApp. null si no se puede interpretar con seguridad.
 */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("595") && digits.length >= 11 && digits.length <= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) return `595${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 9) return `595${digits}`;
  return null;
}

/** Link de WhatsApp para escribirle a un cliente (no al negocio), con el mensaje ya escrito. */
export function whatsappLinkTo(phone: string, text: string): string {
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}
