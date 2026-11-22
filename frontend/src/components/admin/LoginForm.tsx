"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  EnvelopeSimpleIcon,
  LockIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { getApiUrl, LOGIN_NOTICE_KEY } from "../../lib/api";
import { getToken, saveSession } from "../../lib/session";

/**
 * Formulario de ingreso al panel. `site`: la página /iniciar-sesion del sitio
 * (con "Volver a la tienda"). `app`: la de la app instalada (panel.…/ingresar),
 * sin enlaces a la tienda.
 */
export default function LoginForm({ variant }: { variant: "site" | "app" }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // "Recordarme": la sesión dura 30 días (lo normal en el celular propio). Destildarlo en un equipo prestado.
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    // Ya hay sesión en este dispositivo (ej. al abrir la app instalada): directo al panel.
    if (getToken()) {
      router.replace("/admin");
      return;
    }
    // Por qué se cerró la sesión anterior (cuenta desactivada, contraseña cambiada…), una sola vez.
    try {
      const notice = sessionStorage.getItem(LOGIN_NOTICE_KEY);
      if (notice) {
        sessionStorage.removeItem(LOGIN_NOTICE_KEY);
        // sessionStorage solo existe en el navegador: se lee acá (tras montar).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(notice);
      }
    } catch {
      /* sin almacenamiento: no hay aviso */
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Los accesos nuevos los crea el dueño desde el panel (Usuarios): acá solo se ingresa.
      const res = await fetch(`${getApiUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(". ") : data.message;
        throw new Error(res.status === 429 ? "Demasiados intentos. Esperá un minuto y probá de nuevo." : msg || "Ocurrió un error");
      }

      if (data.token) {
        saveSession(data.token, data.user);
        router.push("/admin");
      }

    } catch (err) {
      // "Failed to fetch" = sin internet o el servidor no responde (puede estar despertando).
      setError(err instanceof TypeError ? "No se pudo conectar con el servidor. Revisá tu internet y probá de nuevo en unos segundos." : err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center relative overflow-hidden selection:bg-[#e8f0f8] py-12">

      {/* Detalles decorativos azules suaves, con la misma pareja de tonos que el degradé de marca */}
      <div className="absolute top-[-15%] left-[-10%] w-125 h-125 bg-[#004080] rounded-full mix-blend-multiply filter blur-3xl opacity-10 z-0" />
      <div className="absolute bottom-[-15%] right-[-10%] w-125 h-125 bg-[#3b9dff] rounded-full mix-blend-multiply filter blur-3xl opacity-10 z-0" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">

        {/* Botón Volver (solo en el sitio: la app del panel no lleva a la tienda) */}
        {variant === "site" && (
          <Link href="/" className="inline-flex items-center text-[#004080] hover:text-[#00294f] font-medium mb-8 transition-colors group cursor-pointer">
            <ArrowLeftIcon weight="light" className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Volver a la tienda
          </Link>
        )}

        {/* Tarjeta de Formulario */}
        <div className="bg-white shadow-xl rounded-3xl border border-slate-100 overflow-hidden">
          {/* Franja de marca: mismo degradé navy que los CTA principales del sitio */}
          <div className="h-1.5 bg-linear-to-r from-[#0d4a8a] to-[#00294f]" />

          <div className="py-10 px-8 sm:px-12">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-10">
              {/* Logo sin fondo, tal cual es el PNG (ya tiene transparencia real) */}
              <div className="relative w-20 h-20 mx-auto mb-5">
                <Image
                  src="/logo.png"
                  alt="LT Recepciones"
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Panel de Control
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Ingresa para administrar tu negocio
              </p>
              {/* Línea decorativa */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="h-px w-12 bg-linear-to-r from-transparent to-[#004080]/40" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#004080]/60" />
                <div className="h-px w-12 bg-linear-to-l from-transparent to-[#004080]/40" />
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>

              {/* Campo Correo */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <EnvelopeSimpleIcon weight="light" className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#004080]/20 focus:border-[#004080] placeholder:text-slate-400 transition-all outline-none"
                    placeholder="admin@ltrecepciones.com"
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LockIcon weight="light" className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3 border border-slate-200 rounded-xl text-slate-800 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#004080]/20 focus:border-[#004080] placeholder:text-slate-400 transition-all outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#004080] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeSlashIcon weight="light" className="h-5 w-5" /> : <EyeIcon weight="light" className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Recordarme */}
              <label className="flex items-center gap-2.5 min-h-11 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-5 h-5 accent-[#004080] cursor-pointer"
                />
                Recordarme en este dispositivo
                <span className="text-xs text-slate-400">(30 días)</span>
              </label>

              {/* Mensaje de Error o Éxito */}
              {error && (
                <div className={`p-3 rounded-lg text-sm text-center font-medium animate-in fade-in slide-in-from-top-2 ${error.includes('exitosa') ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                  {error}
                </div>
              )}

              {/* Botón de Envío */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="lt-beam [--lt-beam-color:#3b9dff] w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-linear-to-br from-[#0d4a8a] to-[#00294f] hover:brightness-110 shadow-lg shadow-[#004080]/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#004080]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <CircleNotchIcon weight="bold" className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                      Procesando...
                    </>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </button>
              </div>
            </form>

            {/* Los accesos los da el dueño desde el panel (Usuarios) */}
            <p className="mt-8 text-center text-sm text-slate-500">
              ¿No tenés acceso? Pedíselo al dueño del negocio.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
