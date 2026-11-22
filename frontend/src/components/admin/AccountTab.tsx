"use client";

import { useState } from "react";
import { KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { ROLE_LABEL, saveSession } from "../../lib/session";
import { useToast } from "./ToastProvider";
import { useSessionUser } from "./AdminAuthGate";
import { InstallAppCard } from "./InstallApp";

const INPUT = "w-full min-h-12 px-4 border border-slate-200 rounded-xl text-base text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#004080]/25";
const CARD = "bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6";

/** Datos propios, cambio de contraseña y salir. La ve cualquier usuario del panel. */
export default function AccountTab({ onLogout }: { onLogout: () => void }) {
  const toast = useToast();
  const me = useSessionUser();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== repeat) { toast.error("Las dos contraseñas nuevas no coinciden."); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) { toast.error(await readApiError(res, "No se pudo cambiar la contraseña.")); return; }
      const data: { token: string; message: string } = await res.json();
      // Sesión nueva para este dispositivo: los demás quedan cerrados.
      saveSession(data.token);
      setCurrent(""); setNext(""); setRepeat("");
      toast.success(data.message);
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Instalar la app (o el QR para abrirla en el celular, desde la computadora) */}
      <InstallAppCard />

      <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="yo-t">
        <div className="flex items-center gap-3">
          <span className={`w-12 h-12 rounded-2xl inline-flex items-center justify-center ${me.role === "ADMIN" ? "bg-[#004080] text-white" : "bg-[#e8f0f8] text-[#004080]"}`}>
            {me.role === "ADMIN" ? <ShieldCheck className="w-6 h-6" /> : <UserRound className="w-6 h-6" />}
          </span>
          <div className="min-w-0">
            <h2 id="yo-t" className="text-lg font-bold text-slate-900 truncate">{me.name}</h2>
            <p className="text-sm text-slate-500 truncate">{me.email} · {ROLE_LABEL[me.role]}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className="min-h-12 rounded-xl border border-red-200 text-[#b42318] font-bold inline-flex items-center justify-center gap-2 hover:bg-red-50 cursor-pointer">
          <LogOut className="w-5 h-5" /> Cerrar sesión en este dispositivo
        </button>
      </section>

      <form onSubmit={changePassword} className={`${CARD} flex flex-col gap-4`} aria-labelledby="pw-t">
        <div>
          <h2 id="pw-t" className="text-lg font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-[#004080]" /> Cambiar mi contraseña</h2>
          <p className="text-sm text-slate-500 mt-1">Se cierra la sesión en tus otros dispositivos; en este seguís adentro.</p>
        </div>
        <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-slate-700">Contraseña actual</span>
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={INPUT} autoComplete="current-password" />
        </label>
        <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-slate-700">Contraseña nueva (mínimo 8)</span>
          <input type="password" required minLength={8} maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} className={INPUT} autoComplete="new-password" />
        </label>
        <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-slate-700">Repetí la contraseña nueva</span>
          <input type="password" required minLength={8} maxLength={72} value={repeat} onChange={(e) => setRepeat(e.target.value)} className={INPUT} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-[#004080] text-white font-bold hover:bg-[#00294f] disabled:opacity-60 cursor-pointer">
          {saving ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>

    </div>
  );
}
