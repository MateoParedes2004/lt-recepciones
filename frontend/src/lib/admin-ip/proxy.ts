// DESACTIVADO (2026-11-15): nada importa este archivo; el panel no restringe
// IPs. Pasos para reactivarlo: encabezado de backend/src/auth/admin-ip.ts.

import { NextResponse, type NextRequest } from "next/server";
import { adminIpAllowed, clientIp } from "./admin-ip";

/**
 * El panel y su login solo se muestran a los equipos de ADMIN_ALLOWED_IPS.
 * Desde cualquier otra IP se ve el aviso de /acceso-restringido (con 403), en
 * la misma URL. La protección real de los datos está en el backend.
 */
export function proxy(request: NextRequest) {
  if (adminIpAllowed(clientIp(request.headers))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/acceso-restringido";
  url.search = "";
  return NextResponse.rewrite(url, { status: 403 });
}

export const config = {
  matcher: ["/admin/:path*", "/iniciar-sesion/:path*"],
};
