"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MoreVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { isPanelHostname, PANEL_URL } from "../../lib/panel-app";
import { INSTALL_CHANGED } from "./PanelPwa";

type Mode =
  | "installed" // ya se está usando como app
  | "prompt" // Chrome/Android ofrece instalar: botón de un toque
  | "ios" // iPhone/iPad: Compartir → Agregar a inicio
  | "manual" // otro navegador: desde su menú
  | "elsewhere"; // dominio principal (computadora): la app está en panel.…

const DISMISS_KEY = "lt_install_banner_dismissed";

function detectMode(): Mode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (!isPanelHostname(window.location.hostname)) return "elsewhere";
  if (window.__ltInstallPrompt) return "prompt";
  // iPadOS se presenta como Mac: se lo reconoce porque tiene pantalla táctil.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "manual";
}

/** Estado de instalación, actualizado cuando el navegador ofrece o termina de instalar. */
function useInstallMode(): Mode | null {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    const update = () => setMode(detectMode());
    // Datos del navegador: solo existen tras montar.
    update();
    window.addEventListener(INSTALL_CHANGED, update);
    return () => window.removeEventListener(INSTALL_CHANGED, update);
  }, []);
  return mode;
}

async function promptInstall() {
  const ev = window.__ltInstallPrompt;
  if (!ev) return;
  await ev.prompt();
  await ev.userChoice;
  window.__ltInstallPrompt = null; // Chrome no deja usar el mismo aviso dos veces
  window.dispatchEvent(new Event(INSTALL_CHANGED));
}

function Steps({ mode }: { mode: "ios" | "manual" }) {
  const step = "flex items-start gap-3 text-sm text-slate-700";
  const num = "w-6 h-6 shrink-0 rounded-full bg-[#e8f0f8] text-[#004080] text-xs font-black inline-flex items-center justify-center";
  return mode === "ios" ? (
    <ol className="flex flex-col gap-2.5">
      <li className={step}><span className={num}>1</span><span>Abrí esta página en <b>Safari</b> (no desde WhatsApp ni Instagram).</span></li>
      <li className={step}><span className={num}>2</span><span>Tocá <b>Compartir</b> <Share className="inline w-4 h-4 -mt-0.5 text-[#004080]" aria-label="(el cuadrado con la flecha)" /> abajo en la pantalla.</span></li>
      <li className={step}><span className={num}>3</span><span>Elegí <b>Agregar a inicio</b> <SquarePlus className="inline w-4 h-4 -mt-0.5 text-[#004080]" aria-hidden="true" /> y tocá <b>Agregar</b>.</span></li>
    </ol>
  ) : (
    <ol className="flex flex-col gap-2.5">
      <li className={step}><span className={num}>1</span><span>Abrí el menú del navegador <MoreVertical className="inline w-4 h-4 -mt-0.5 text-[#004080]" aria-label="(los tres puntos)" />.</span></li>
      <li className={step}><span className={num}>2</span><span>Tocá <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.</span></li>
    </ol>
  );
}

/** Tarjeta completa para "Mi cuenta": cómo instalar la app en este dispositivo (o en el celular). */
export function InstallAppCard() {
  const mode = useInstallMode();
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "elsewhere" || !PANEL_URL) return;
    // QR de la dirección de la app, para abrirla en el celular desde la computadora.
    import("qrcode").then((QR) => QR.toDataURL(PANEL_URL, { margin: 1, width: 360, color: { dark: "#00294f", light: "#ffffff" } })).then(setQr).catch(() => {});
  }, [mode]);

  if (mode === null || (mode === "elsewhere" && !PANEL_URL)) return null;

  return (
    <section aria-labelledby="app-t" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 flex flex-col gap-4 lg:col-span-2">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícono chico y fijo de la app */}
        <img src="/panel-icon-192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
        <div>
          <h2 id="app-t" className="text-lg font-bold text-slate-900">App en el celular</h2>
          <p className="text-sm text-slate-500 mt-0.5">El panel con su propio ícono, a pantalla completa, para hacer presupuestos desde el teléfono. Gratis, sin tiendas.</p>
        </div>
      </div>

      {mode === "installed" && (
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="w-5 h-5" /> Ya estás usando la app en este dispositivo.</p>
      )}
      {mode === "prompt" && (
        <button type="button" onClick={promptInstall} className="min-h-12 rounded-xl bg-[#004080] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#00294f] cursor-pointer">
          <Download className="w-5 h-5" /> Instalar la app en este celular
        </button>
      )}
      {(mode === "ios" || mode === "manual") && <Steps mode={mode} />}
      {mode === "elsewhere" && (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el momento (data URL) */}
          {qr && <img src={qr} alt={`Código QR para abrir ${PANEL_URL}`} className="w-40 h-40 rounded-xl border border-slate-100" />}
          <div className="text-sm text-slate-700 flex flex-col gap-2">
            <p className="flex items-center gap-2 font-bold"><Smartphone className="w-5 h-5 text-[#004080]" /> Escaneá el código con el celular</p>
            <p>o abrí <a href={PANEL_URL} className="font-bold text-[#004080] underline break-all">{PANEL_URL.replace(/^https?:\/\//, "")}</a> en el navegador del teléfono, ingresá y seguí los pasos de instalación que aparecen ahí.</p>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Aviso chico en Inicio, solo dentro de la app del panel en un dispositivo
 * donde todavía no se instaló. Se puede cerrar y no vuelve a aparecer.
 */
export function InstallAppBanner({ onShowSteps }: { onShowSteps: () => void }) {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      // Preferencia de este dispositivo: solo existe tras montar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed || mode === null || mode === "installed" || mode === "elsewhere") return null;
  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* sin almacenamiento: vuelve a aparecer */ }
  };
  return (
    <div className="flex items-center gap-3 bg-white border border-[#004080]/15 rounded-2xl px-4 py-3 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- ícono chico y fijo de la app */}
      <img src="/panel-icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
      <p className="flex-1 text-sm text-slate-700"><b>Instalá la app</b> en este celular para abrirla con un toque.</p>
      <button type="button" onClick={mode === "prompt" ? promptInstall : onShowSteps} className="min-h-11 px-4 rounded-xl bg-[#004080] text-white text-sm font-bold cursor-pointer">
        {mode === "prompt" ? "Instalar" : "Cómo"}
      </button>
      <button type="button" onClick={close} aria-label="No mostrar más" className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
    </div>
  );
}
