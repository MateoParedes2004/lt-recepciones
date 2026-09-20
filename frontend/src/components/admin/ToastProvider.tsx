"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const STYLES: Record<ToastKind, { box: string; icon: React.ReactNode }> = {
  success: { box: "bg-emerald-50 border-emerald-200 text-emerald-900", icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> },
  error: { box: "bg-red-50 border-red-200 text-red-900", icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" /> },
  info: { box: "bg-blue-50 border-blue-200 text-blue-900", icon: <Info className="w-5 h-5 text-blue-600 shrink-0" /> },
};

// Reemplaza las alertas nativas del navegador (alert) en el panel admin:
// no bloquean la pantalla, se cierran solas y respetan el diseño del sitio.
export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    // Los errores duran más: hay que dar tiempo a leerlos.
    setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-3 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 border rounded-2xl px-4 py-3 shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 ${STYLES[t.kind].box}`}
          >
            {STYLES[t.kind].icon}
            <p className="flex-1 leading-snug">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Cerrar notificación" className="p-0.5 rounded-md opacity-60 hover:opacity-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
