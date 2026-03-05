"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
    // Buscamos la llave que guarda tu inicio de sesión
    const token = localStorage.getItem("admin_token");

    if (!token) {
      // Si no hay llave, patada de vuelta al login
        router.push("/iniciar-sesion");
    } else {
        // Si hay llave, lo dejamos pasar y renderizamos la página
        setIsAuthorized(true);
        }
    }, [router, pathname]);

  // Pantalla de carga mientras verifica la seguridad
    if (!isAuthorized) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-500 font-medium animate-pulse">Verificando seguridad...</p>
        </div>
        );
    }

    // Si todo está bien, mostramos el Panel de Administrador tal cual lo tienes
    return <>{children}</>;
}