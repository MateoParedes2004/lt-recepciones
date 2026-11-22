"use client";

import { useEffect } from "react";
import { isPanelHostname } from "../../lib/panel-app";

/** El aviso "Instalar app" de Chrome/Android, que el navegador entrega una sola vez y temprano. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __ltInstallPrompt?: InstallPromptEvent | null;
  }
}

/** Avisa a "Instalar la app" que el navegador ya ofrece (o dejó de ofrecer) la instalación. */
export const INSTALL_CHANGED = "lt-install-changed";

/**
 * Registra el service worker de la app (public/panel-sw.js) SOLO en la app del
 * panel (panel.…). En el dominio principal no hace nada: ahí el panel se usa
 * desde la computadora y la tienda tiene su propio manifiesto.
 *
 * También guarda el aviso de instalación de Chrome apenas llega (antes de que se
 * abra "Mi cuenta"), para poder mostrar un botón "Instalar app" propio.
 */
export default function PanelPwa() {
  useEffect(() => {
    if (!isPanelHostname(window.location.hostname)) return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // sin la barrita automática: el panel muestra su propio botón
      window.__ltInstallPrompt = e as InstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_CHANGED));
    };
    const onInstalled = () => {
      window.__ltInstallPrompt = null;
      window.dispatchEvent(new Event(INSTALL_CHANGED));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/panel-sw.js", { scope: "/" }).catch(() => {
        // Sin service worker el panel funciona igual; solo no ofrece instalarse.
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
