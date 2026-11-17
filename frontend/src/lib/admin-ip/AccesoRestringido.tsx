// DESACTIVADO (2026-11-15): nada importa este archivo; el panel no restringe
// IPs. Pasos para reactivarlo: encabezado de backend/src/auth/admin-ip.ts.

import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftIcon, ShieldWarningIcon } from "@phosphor-icons/react/dist/ssr";
import { clientIp } from "./admin-ip";

// Lo que ve quien abre /admin o /iniciar-sesion desde un equipo que no está en
// ADMIN_ALLOWED_IPS (ver proxy.ts). Se arma en cada pedido: muestra la IP de
// quien lo mira (la suya, no la de otro), que es la que habría que autorizar.
export const metadata: Metadata = {
  title: "Acceso restringido",
  robots: { index: false, follow: false },
};

export default async function AccesoRestringido() {
  const ip = clientIp(await headers());

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center relative overflow-hidden py-12">
      <div className="absolute top-[-15%] left-[-10%] w-125 h-125 bg-[#004080] rounded-full mix-blend-multiply filter blur-3xl opacity-10 z-0" />
      <div className="absolute bottom-[-15%] right-[-10%] w-125 h-125 bg-[#3b9dff] rounded-full mix-blend-multiply filter blur-3xl opacity-10 z-0" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Link href="/" className="inline-flex items-center text-[#004080] hover:text-[#00294f] font-medium mb-8 transition-colors group">
          <ArrowLeftIcon weight="light" className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Volver a la tienda
        </Link>

        <div className="bg-white shadow-xl rounded-3xl border border-slate-100 overflow-hidden">
          <div className="h-1.5 bg-linear-to-r from-[#0d4a8a] to-[#00294f]" />
          <div className="py-10 px-8 sm:px-12 text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <Image src="/logo.png" alt="LT Recepciones" fill sizes="64px" className="object-contain" />
            </div>
            <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-[#e8f0f8] text-[#004080] flex items-center justify-center">
              <ShieldWarningIcon weight="light" className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Acceso restringido</h1>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              El panel de administración solo se puede usar desde equipos autorizados.
              Si este es tu equipo, pedí que lo agreguen a la lista de acceso.
            </p>
            <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">IP de este equipo</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-slate-800 select-all">{ip ?? "no se pudo detectar"}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
