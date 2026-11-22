"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, UserRound, UserX, UserCheck, X, Copy } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { ROLE_LABEL, type Role } from "../../lib/session";
import { useToast } from "./ToastProvider";
import { useSessionUser } from "./AdminAuthGate";

interface PanelUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Entra a todo: ingresos, estadísticas, catálogo, rutas y usuarios.",
  VENDEDOR: "Presupuestos, alquileres, pedidos por WhatsApp, anular y facturar. No ve ingresos ni toca el catálogo.",
};

/** Contraseña inicial fácil de dictar (sin 0/O, 1/l/I), para pasársela a la persona. */
function suggestPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

const lastSeen = (iso: string | null) =>
  iso
    ? `Último ingreso: ${new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
    : "Todavía no ingresó";

const INPUT = "w-full min-h-12 px-4 border border-slate-200 rounded-xl text-base text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#004080]/25";

/** Accesos al panel. Solo el dueño la ve (el servidor también lo exige). */
export default function UsersTab() {
  const toast = useToast();
  const me = useSessionUser();
  const [users, setUsers] = useState<PanelUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<{ name: string; email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await apiFetch("/users");
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // Carga desde el servidor al abrir: los setState ocurren al llegar la respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const patch = async (u: PanelUser, body: Partial<Pick<PanelUser, "role" | "isActive" | "name">>, ok: string) => {
    setBusyId(u.id);
    try {
      const res = await apiFetch(`/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { toast.error(await readApiError(res, "No se pudo guardar.")); return; }
      const updated: PanelUser = await res.json();
      setUsers((list) => list?.map((x) => (x.id === u.id ? updated : x)) ?? null);
      toast.success(ok);
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (u: PanelUser) => {
    const password = suggestPassword();
    if (!window.confirm(`¿Ponerle una contraseña nueva a ${u.name}? Se le cierra la sesión en todos sus dispositivos y tiene que entrar con la nueva.`)) return;
    setBusyId(u.id);
    try {
      const res = await apiFetch(`/users/${u.id}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) { toast.error(await readApiError(res, "No se pudo cambiar la contraseña.")); return; }
      setReveal({ name: u.name, email: u.email, password });
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Quién puede entrar al panel</h2>
          <p className="text-sm text-slate-500 mt-1">
            Creá un acceso para cada persona (no compartan la misma cuenta): así se sabe quién hizo cada presupuesto y podés cortar un acceso al instante sin afectar a los demás.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="min-h-12 px-5 rounded-xl bg-[#004080] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#00294f] cursor-pointer">
          <Plus className="w-5 h-5" /> Nuevo usuario
        </button>
      </div>

      {failed ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center">
          <p className="text-slate-600 mb-3">No se pudieron cargar los usuarios.</p>
          <button type="button" onClick={load} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl bg-[#004080] text-white text-sm font-bold cursor-pointer"><RefreshCw className="w-4 h-4" /> Reintentar</button>
        </div>
      ) : users === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {users.map((u) => {
            const isMe = u.id === me.id;
            const busy = busyId === u.id;
            return (
              <li key={u.id} className={`bg-white rounded-3xl border shadow-sm p-5 flex flex-col gap-4 ${u.isActive ? "border-slate-100" : "border-slate-200 opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <span className={`w-11 h-11 shrink-0 rounded-2xl inline-flex items-center justify-center ${u.role === "ADMIN" ? "bg-[#004080] text-white" : "bg-[#e8f0f8] text-[#004080]"}`}>
                    {u.role === "ADMIN" ? <ShieldCheck className="w-5 h-5" /> : <UserRound className="w-5 h-5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{u.name}{isMe && <span className="ml-2 text-xs font-bold text-[#004080]">(vos)</span>}</p>
                    <p className="text-sm text-slate-500 truncate">{u.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{lastSeen(u.lastLoginAt)}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border ${u.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                    {u.isActive ? "Activo" : "Desactivado"}
                  </span>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</span>
                  <select
                    value={u.role}
                    disabled={busy || isMe || !u.isActive}
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      if (window.confirm(`¿Cambiar a ${u.name} a ${ROLE_LABEL[role]}? Se le cierra la sesión y entra de nuevo con los permisos nuevos.`)) patch(u, { role }, "Rol cambiado.");
                    }}
                    className="min-h-12 px-3 border border-slate-200 rounded-xl text-base bg-white text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 cursor-pointer"
                  >
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <span className="text-xs text-slate-500">{isMe ? "No podés cambiar tu propio rol (te quedarías afuera)." : ROLE_HELP[u.role]}</span>
                </label>

                {!isMe && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy || !u.isActive} onClick={() => resetPassword(u)} className="min-h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                      <KeyRound className="w-4 h-4" /> Contraseña nueva
                    </button>
                    {u.isActive ? (
                      <button type="button" disabled={busy} onClick={() => { if (window.confirm(`¿Desactivar a ${u.name}? No va a poder entrar y se le cierra la sesión al instante. Sus presupuestos quedan guardados.`)) patch(u, { isActive: false }, "Acceso desactivado."); }} className="min-h-11 px-3 rounded-xl border border-red-200 text-sm font-bold text-[#b42318] hover:bg-red-50 inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                        <UserX className="w-4 h-4" /> Desactivar
                      </button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => patch(u, { isActive: true }, "Acceso reactivado.")} className="min-h-11 px-3 rounded-xl border border-emerald-200 text-sm font-bold text-emerald-700 hover:bg-emerald-50 inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                        <UserCheck className="w-4 h-4" /> Reactivar
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={(u, password) => { setCreating(false); setUsers((list) => (list ? [...list, u] : [u])); setReveal({ name: u.name, email: u.email, password }); }}
        />
      )}
      {reveal && <RevealModal {...reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: PanelUser, password: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(suggestPassword);
  const [role, setRole] = useState<Role>("VENDEDOR");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }) });
      if (!res.ok) { toast.error(await readApiError(res, "No se pudo crear el usuario.")); return; }
      onCreated(await res.json(), password);
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[95vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Nuevo usuario</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-11 h-11 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-slate-700">Nombre</span>
            <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="Ej. Ana Benítez" autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-slate-700">Correo (con el que va a entrar)</span>
            <input required type="email" inputMode="email" autoCapitalize="none" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} placeholder="ana@gmail.com" autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-slate-700">Contraseña inicial</span>
            <span className="flex gap-2">
              <input required minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} className={`${INPUT} font-mono`} autoComplete="new-password" />
              <button type="button" onClick={() => setPassword(suggestPassword())} aria-label="Proponer otra contraseña" title="Proponer otra" className="min-w-12 rounded-xl border border-slate-200 text-slate-600 inline-flex items-center justify-center cursor-pointer"><RefreshCw className="w-5 h-5" /></button>
            </span>
            <span className="text-xs text-slate-500">Pasásela a la persona; después la puede cambiar en &quot;Mi cuenta&quot;.</span>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-slate-700 mb-1.5">Rol</legend>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <label key={r} className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${role === r ? "border-[#004080] bg-[#e8f0f8]" : "border-slate-200"}`}>
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[#004080]" />
                <span><span className="font-bold text-slate-900">{ROLE_LABEL[r]}</span><span className="block text-xs text-slate-600 mt-0.5">{ROLE_HELP[r]}</span></span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="min-h-12 px-5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 cursor-pointer">Cancelar</button>
          <button type="submit" disabled={saving} className="min-h-12 px-6 rounded-xl bg-[#004080] text-white font-bold hover:bg-[#00294f] disabled:opacity-60 cursor-pointer">{saving ? "Creando…" : "Crear usuario"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** Muestra una sola vez los datos de ingreso para pasárselos a la persona. */
function RevealModal({ name, email, password, onClose }: { name: string; email: string; password: string; onClose: () => void }) {
  const toast = useToast();
  const text = `Acceso al panel de LT Recepciones\nCorreo: ${email}\nContraseña: ${password}\n\nEntrá y cambiala en "Mi cuenta".`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado. Pegalo en WhatsApp para pasárselo.");
    } catch {
      toast.error("No se pudo copiar: anotalo a mano.");
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Datos de ingreso" className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-slate-900">Datos de ingreso de {name}</h3>
        <dl className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-2 text-sm">
          <div><dt className="text-slate-500">Correo</dt><dd className="font-bold text-slate-900 break-all">{email}</dd></div>
          <div><dt className="text-slate-500">Contraseña</dt><dd className="font-mono text-lg font-bold text-slate-900 tracking-wider">{password}</dd></div>
        </dl>
        <p className="text-xs text-slate-500">Esta es la única vez que se muestra la contraseña. Pasásela a la persona por un medio privado.</p>
        <div className="flex gap-3">
          <button type="button" onClick={copy} className="flex-1 min-h-12 rounded-xl bg-[#e8f0f8] text-[#004080] font-bold inline-flex items-center justify-center gap-2 cursor-pointer"><Copy className="w-4 h-4" /> Copiar</button>
          <button type="button" onClick={onClose} className="flex-1 min-h-12 rounded-xl bg-[#004080] text-white font-bold cursor-pointer">Listo</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
