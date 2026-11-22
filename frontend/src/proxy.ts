import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "./lib/site";

// "Portero" de la app del panel (panel.ltrecepciones.com.py). Solo corre en ese
// subdominio (ver `config.matcher` abajo): en el dominio principal ni se ejecuta,
// así la tienda pública queda exactamente igual.
//
// En la app:
//  - "/" abre el panel; "/iniciar-sesion" pasa a "/ingresar" (login sin la tienda).
//  - El manifiesto es el de la app (nombre, ícono y accesos directos propios).
//  - Cualquier página de la tienda manda al sitio público: la app es solo el panel.
//  - Nada se indexa en buscadores.

// Lo que sí se sirve en la app: el panel, su login, sus íconos y archivos de la app.
const APP_PATHS = /^\/(admin(\/|$)|ingresar(\/|$)|panel[-.]|offline\.html$|_next\/|favicon\.ico$|icon\.png$|apple-icon\.png$|logo(-512)?\.png$)/;

const NO_INDEX = { "X-Robots-Tag": "noindex, nofollow" };

export function proxy(request: NextRequest) {
  const { pathname, search, protocol } = request.nextUrl;
  // La dirección que pidió el navegador (panel.…): `request.url` no siempre la
  // trae (detrás de algunos servidores llega con el nombre interno), el
  // encabezado Host sí.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const here = (path: string) => new URL(path, `${protocol}//${host}`);

  if (pathname === "/") return NextResponse.redirect(here("/admin"));
  if (pathname === "/iniciar-sesion") return NextResponse.redirect(here(`/ingresar${search}`));
  if (pathname === "/manifest.webmanifest") {
    return NextResponse.rewrite(new URL("/panel.webmanifest", request.url), { headers: NO_INDEX });
  }
  if (pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (APP_PATHS.test(pathname)) return NextResponse.next({ headers: NO_INDEX });

  // Una página de la tienda dentro de la app: al sitio público (si estuviera mal
  // configurado y apuntara a este mismo subdominio, al panel, para no hacer un bucle).
  // El destino se arma sobre el sitio fijo (no con `new URL(ruta, sitio)`): una ruta que
  // empiece con "//otro.com" se interpretaría como OTRO dominio.
  const store = new URL(SITE_URL);
  store.pathname = pathname;
  store.search = search;
  if (store.host === host) return NextResponse.redirect(here("/admin"));
  // Ojo al probar en la computadora: Next trata 127.0.0.1 y localhost como el
  // mismo dominio (NextURL los normaliza a "localhost") y acorta esta dirección
  // a "/catalogos/…": con la tienda en localhost/127.0.0.1 queda en bucle. Para
  // probar, poner la tienda en otro nombre (ej. http://tienda.localhost:3001).
  // En producción tienda y app son dominios distintos y no pasa.
  return NextResponse.redirect(store);
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image).*)",
      // Solo en la app: el dominio principal no pasa por acá.
      has: [{ type: "header", key: "host", value: "panel\\..*" }],
    },
  ],
};
