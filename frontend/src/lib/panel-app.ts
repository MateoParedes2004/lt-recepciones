import type { Metadata } from "next";

// La app instalable del panel vive en su propio subdominio (panel.…): dos apps
// en la misma dirección se pisan entre sí (la tienda ocupa toda la raíz), y los
// navegadores recomiendan separarlas. En el dominio principal /admin sigue
// funcionando igual desde la computadora.

/** ¿Estamos en la app del panel (panel.ltrecepciones.com.py, o panel.localhost al probar)? */
export const isPanelHostname = (hostname: string) => hostname.startsWith("panel.");

/** Dónde está el login: en la app, su versión sin enlaces a la tienda. */
export function loginPath(): string {
  return typeof window !== "undefined" && isPanelHostname(window.location.hostname) ? "/ingresar" : "/iniciar-sesion";
}

/** Dirección de la app para mostrarla desde el dominio principal (vacía si no está configurada). */
export const PANEL_URL = (process.env.NEXT_PUBLIC_PANEL_URL || "").replace(/\/$/, "");

/**
 * Cómo se llama y qué ícono usa cuando se agrega al inicio del iPhone (Safari no
 * usa el manifiesto para eso). Lo comparten el panel y su login.
 */
export const PANEL_APP_METADATA: Metadata = {
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "LT Panel", statusBarStyle: "default" },
  icons: { apple: "/panel-apple-180.png" },
};
