import { getApiUrl } from "./api";

// Estadísticas propias del sitio (las que ve el dueño en el panel). Solo se
// guardan contadores por día — qué producto se miró, qué se buscó — nunca
// datos de la persona. Todo es "disparar y olvidar": si falla, el visitante
// no se entera y la página no se frena.

export type TrackEvent =
  | "pageview" // cada página pública abierta
  | "product_view" // ficha de un producto (key = id)
  | "add_to_cart" // agregó un producto a la cotización (key = id)
  | "search" // búsqueda en el catálogo con resultados (key = texto)
  | "search_empty" // búsqueda sin resultados (key = texto)
  | "availability_check" // consultó disponibilidad en el carrito (key = fecha del evento AAAA-MM-DD)
  | "whatsapp_click"; // tocó un botón de WhatsApp (key = cuál)

// Rutas del dueño: entrar a su propio panel no es tráfico del sitio.
const INTERNAL_ROUTES = ["/admin", "/iniciar-sesion"];

export function isInternalRoute(pathname: string): boolean {
  return INTERNAL_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/**
 * Robots, vistas previas de links y navegadores automatizados ejecutan la
 * página igual que una persona: sin este filtro inflaban las visitas.
 */
export function isLikelyBot(): boolean {
  if (typeof navigator === "undefined") return true;
  if (navigator.webdriver) return true;
  return /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|bingpreview|google-inspectiontool/i.test(
    navigator.userAgent,
  );
}

/** true solo la primera vez en esta pestaña/sesión (para no contar recargas). */
export function firstTimeThisSession(id: string): boolean {
  try {
    const key = `lt_evt_${id}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true; // sin sessionStorage (modo privado estricto): se cuenta igual
  }
}

export function track(type: TrackEvent, key?: string | number): void {
  if (typeof window === "undefined" || isLikelyBot() || isInternalRoute(window.location.pathname)) return;
  try {
    fetch(`${getApiUrl()}/analytics/evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(key === undefined || key === "" ? { type } : { type, key: String(key) }),
      // keepalive: el aviso sale aunque la persona cambie de página o abra WhatsApp enseguida.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // nada: las estadísticas nunca rompen la página
  }
}
