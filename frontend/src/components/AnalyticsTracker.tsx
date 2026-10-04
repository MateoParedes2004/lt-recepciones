"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getApiUrl } from "../lib/api";
import { isInternalRoute, isLikelyBot, track } from "../lib/track";

// De dónde llegó la persona, según la página anterior (referrer), la etiqueta
// utm_source de un link de campaña o el navegador interno de las apps.
// Estos son los únicos valores que acepta el backend.
function detectSource(): string {
  try {
    const utm = new URLSearchParams(window.location.search).get("utm_source")?.toLowerCase() ?? "";
    const ua = navigator.userAgent;
    let host = "";
    if (document.referrer) {
      const ref = new URL(document.referrer);
      if (ref.origin !== window.location.origin) host = ref.hostname.toLowerCase();
    }
    const from = `${utm} ${host}`;

    if (/google/.test(from)) return "google";
    if (/bing|yahoo|duckduckgo|ecosia/.test(from)) return "otros_buscadores";
    if (/instagram/.test(from) || /Instagram/.test(ua)) return "instagram";
    if (/facebook|fb\b|fb\.|messenger/.test(from) || /FBAN|FBAV|FB_IAB/.test(ua)) return "facebook";
    if (/whatsapp|wa\.me|wl\.co/.test(from)) return "whatsapp";
    if (/tiktok/.test(from) || /TikTok|musical_ly|BytedanceWebview/.test(ua)) return "tiktok";
    if (/youtube|youtu\.be/.test(from)) return "youtube";
    if (host) return "otros_sitios";
    return "directo";
  } catch {
    return "directo";
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  // Visitante del día + página vista, en cada cambio de página.
  useEffect(() => {
    if (isInternalRoute(pathname) || isLikelyBot()) return;

    // Página vista: cada página pública que se abre (incluye navegar dentro del sitio).
    track("pageview");

    const registrarVisita = async () => {
      try {
        // "Hoy" según el calendario de Paraguay, sin importar en qué huso
        // horario tenga configurado el reloj del visitante (celular en otro
        // país, de viaje, mal configurado, etc.) — toLocaleDateString con
        // "es-PY" solo cambia el formato del texto, no el huso horario real
        // usado para calcular el día; forzar timeZone acá es lo que hace que
        // esta fecha coincida siempre con la que graba el backend.
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Asuncion' });

        // Buscamos en la memoria del celular/PC si ya visitó la página hoy
        const ultimaVisita = localStorage.getItem("lt_ultima_visita");

        // Si no hay registro, o si la fecha es distinta (es un nuevo día)
        if (ultimaVisita !== hoy) {

          // Enviamos la alerta silenciosa a tu Base de Datos, con el origen
          // de la visita (el tipo de dispositivo lo deduce el servidor).
          const res = await fetch(`${getApiUrl()}/analytics/visita`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: detectSource() }),
          });

          // Si el servidor guardó la visita con éxito, le ponemos la "marca" al visitante
          if (res.ok) {
            localStorage.setItem("lt_ultima_visita", hoy);
          }
        }
      } catch (error) {
        // El rastreador es silencioso, si falla no rompe la página del cliente
        console.error("No se pudo registrar la visita:", error);
      }
    };

    // Le damos un pequeño retraso de 2 segundos para no hacer lenta la carga inicial de la página
    const timer = setTimeout(() => {
      registrarVisita();
    }, 2000);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Toques en cualquier botón o link de WhatsApp del sitio (flotante,
  // contacto, rubros…). Un solo "escuchador" para todos: los links se marcan
  // con data-wa="nombre" para saber cuál fue.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href*="api.whatsapp.com"], a[href*="wa.me"]');
      if (!link) return;
      track("whatsapp_click", (link as HTMLElement).dataset.wa || "enlace");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Este componente es invisible, no muestra nada en pantalla
  return null;
}
