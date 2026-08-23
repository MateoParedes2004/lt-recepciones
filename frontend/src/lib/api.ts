const DEFAULT_API_URL = "http://localhost:3000";

/** URL base del backend, sin barra final. */
export function getApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

/** Resuelve la URL completa de una imagen guardada por el backend (Cloudinary o ruta relativa). */
export function getImageUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${getApiUrl()}${path}`;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

/**
 * Wrapper de fetch para el panel admin: arma la URL completa contra el backend
 * y adjunta el token de sesión como header Authorization cuando existe.
 * Si el backend responde 401 (token ausente/expirado), limpia la sesión y
 * redirige a /iniciar-sesion.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("admin_token");
    window.location.href = "/iniciar-sesion";
  }

  return res;
}
