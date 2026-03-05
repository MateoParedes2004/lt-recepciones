"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, User } from "lucide-react";

export default function Login() {
  const router = useRouter();
  
  // TUS ESTADOS ORIGINALES
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // ESTADO NUEVO PARA EL DISEÑO (Ver contraseña)
  const [showPassword, setShowPassword] = useState(false);

  // TU LÓGICA DE CONEXIÓN EXACTA AL BACKEND
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const endpoint = isRegistering ? "/auth/register" : "/auth/login";
      const payload = isRegistering ? { name, email, password } : { email, password };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        localStorage.setItem("admin_token", data.token); // TU LLAVE REAL
        router.push("/admin");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center relative overflow-hidden selection:bg-blue-200 py-12">
      
      {/* Decoración de fondo Premium */}
      <div className="absolute top-0 left-0 w-full h-96 bg-blue-900 rounded-b-[4rem] md:rounded-b-[8rem] shadow-2xl z-0"></div>
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob z-0"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000 z-0"></div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        
        {/* Botón Volver */}
        <Link href="/" className="inline-flex items-center text-blue-100 hover:text-white font-medium mb-8 transition-colors group cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Volver a la tienda
        </Link>

        {/* Tarjeta de Formulario */}
        <div className="bg-white py-10 px-8 shadow-2xl rounded-3xl sm:px-12 border border-slate-100">
          
          <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform rotate-3">
              <span className="text-white font-bold text-3xl tracking-tighter">LT</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {isRegistering ? "Crear Nueva Cuenta" : "Panel de Control"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isRegistering ? "Registra tus credenciales de administrador" : "Ingresa para administrar tu negocio"}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* Campo Nombre (Solo si está registrando) */}
            {isRegistering && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre Completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
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
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                  placeholder="admin@ltrecepciones.com"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-12 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Mensaje de Error o Éxito */}
            {error && (
              <div className={`p-3 rounded-lg text-sm text-center font-medium animate-in fade-in slide-in-from-top-2 ${error.includes('exitosa') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {error}
              </div>
            )}

            {/* Botón de Envío */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-900/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
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
              className="text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium cursor-pointer"
            >
              {isRegistering ? "¿Ya tienes cuenta? Inicia sesión aquí" : "¿Necesitas acceso? Regístrate aquí"}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}