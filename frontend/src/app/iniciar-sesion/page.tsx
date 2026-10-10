"use client";

import { useState } from "react";
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
  UserIcon,
} from "@phosphor-icons/react";
import { getApiUrl } from "../../lib/api";

export default function Login() {
  const router = useRouter();

  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const endpoint = isRegistering ? "/auth/register" : "/auth/login";
      const payload = isRegistering ? { name, email, password } : { email, password };

      // Nota: /auth/register ahora requiere estar logueado como admin (evita
      // que cualquiera se cree una cuenta admin). Si ya hay una sesión activa
      // en este navegador, mandamos el token; si no, el backend responde 401
      // y el usuario ve el mensaje de error de abajo, como cualquier otro caso.
      const existingToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch(`${getApiUrl()}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Ocurrió un error");
      }

      if (isRegistering) {
        setIsRegistering(false);
        setError("¡Cuenta creada exitosamente! Ahora inicia sesión.");
        return;
      }

      if (data.token) {
        localStorage.setItem("admin_token", data.token);
        router.push("/admin");
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
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

        {/* Botón Volver */}
        <Link href="/" className="inline-flex items-center text-[#004080] hover:text-[#00294f] font-medium mb-8 transition-colors group cursor-pointer">
          <ArrowLeftIcon weight="light" className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Volver a la tienda
        </Link>

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
                {isRegistering ? "Crear Nueva Cuenta" : "Panel de Control"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {isRegistering ? "Registra tus credenciales de administrador" : "Ingresa para administrar tu negocio"}
              </p>
              {/* Línea decorativa */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="h-px w-12 bg-linear-to-r from-transparent to-[#004080]/40" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#004080]/60" />
                <div className="h-px w-12 bg-linear-to-l from-transparent to-[#004080]/40" />
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>

              {/* Campo Nombre */}
              {isRegistering && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre Completo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <UserIcon weight="light" className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#004080]/20 focus:border-[#004080] placeholder:text-slate-400 transition-all outline-none"
                      placeholder="Ej. Mateo Paredes"
                    />
                  </div>
                </div>
              )}

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
                    isRegistering ? "Crear mi cuenta" : "Iniciar Sesión"
                  )}
                </button>
              </div>
            </form>

            {/* Toggle Login/Registro */}
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setError(""); }}
                className="text-sm text-slate-500 hover:text-[#004080] transition-colors font-medium cursor-pointer"
              >
                {isRegistering ? "¿Ya tienes cuenta? Inicia sesión aquí" : "¿Necesitas acceso? Regístrate aquí"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
