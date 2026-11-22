// Sesión del panel en este dispositivo: el token y quién es (nombre y rol).
// Todo acceso a localStorage va en try/catch: en modo privado o con el
// almacenamiento bloqueado puede fallar, y el panel no debe romperse por eso.

export type Role = "ADMIN" | "VENDEDOR";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Dueño", VENDEDOR: "Vendedor" };

export function getToken(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveSession(token: string, user?: SessionUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // sin almacenamiento: la sesión dura lo que dure la pestaña
  }
}

export function saveUser(user: SessionUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ver saveSession */
  }
}

/** Quién era la última vez (sirve para abrir el panel al instante, antes de que conteste el servidor). */
export function getCachedUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as SessionUser;
    return u && typeof u.id === "number" && (u.role === "ADMIN" || u.role === "VENDEDOR") ? u : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* nada que limpiar */
  }
}
