"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";
import ToastProvider from "./ToastProvider";
import { apiFetch } from "../../lib/api";
import { getCachedUser, getToken, saveUser, type SessionUser } from "../../lib/session";
import { loginPath } from "../../lib/panel-app";

const SessionContext = createContext<{ user: SessionUser; setUser: (u: SessionUser) => void } | null>(null);

/** Quién está usando el panel (nombre y rol). Solo dentro de AdminAuthGate. */
export function useSessionUser(): SessionUser {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionUser debe usarse dentro de AdminAuthGate");
  return ctx.user;
}

/** Para actualizar el nombre/rol mostrado (ej. después de cambiar los datos propios). */
export function useSetSessionUser(): (u: SessionUser) => void {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSetSessionUser debe usarse dentro de AdminAuthGate");
  return ctx.setUser;
}

/**
 * Deja pasar al panel solo con una sesión válida, y averigua quién es (rol)
 * preguntándole al servidor: el rol que vale es el de la base, no el guardado
 * en el celular. Si no hay conexión pero ya se sabía quién era, abre igual con
 * lo guardado (el servidor sigue controlando cada pedido).
 */
export default function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [offline, setOffline] = useState(false);

  const setUser = useCallback((u: SessionUser) => {
    saveUser(u);
    setUserState(u);
  }, []);

  const check = useCallback(async () => {
    setOffline(false);
    try {
      const res = await apiFetch("/auth/me");
      if (res.ok) {
        const fresh: SessionUser = await res.json();
        const before = getCachedUser();
        setUser(fresh);
        // El rol guardado en el navegador no era el real (cambió, o se tocó a mano): el panel
        // se armó con otro rol (secciones y datos cargados), así que se abre de nuevo con el correcto.
        if (before && before.role !== fresh.role) window.location.reload();
      }
      else if (res.status !== 401) throw new Error(); // 401: apiFetch ya manda al login
    } catch {
      if (!getCachedUser()) setOffline(true);
    }
  }, [setUser]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(loginPath());
      return;
    }
    // Abrir al instante con lo que ya se sabía de esta sesión y confirmarlo con el servidor.
    const cached = getCachedUser();
    // localStorage solo existe en el navegador: se lee acá (tras montar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setUserState(cached);
    check();
  }, [router, check]);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        {offline ? (
          <>
            <WifiOff className="w-10 h-10 text-slate-400" />
            <p className="text-slate-700 font-bold">No hay conexión con el servidor.</p>
            <p className="text-sm text-slate-500 max-w-xs">Revisá tu internet. Si el servidor estaba dormido, puede tardar hasta un minuto en despertar.</p>
            <button type="button" onClick={check} className="min-h-11 px-5 rounded-xl bg-[#004080] text-white font-bold cursor-pointer">
              Reintentar
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-[#004080]" />
            <p className="text-slate-500 font-medium animate-pulse">Verificando seguridad...</p>
          </>
        )}
      </div>
    );
  }

  // Sesión válida: el panel (con sus notificaciones) y quién lo usa disponibles para todas las pestañas.
  return (
    <SessionContext.Provider value={{ user, setUser }}>
      <ToastProvider>{children}</ToastProvider>
    </SessionContext.Provider>
  );
}
