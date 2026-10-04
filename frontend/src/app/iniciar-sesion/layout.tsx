import { Metadata } from "next";

// La pantalla de acceso del dueño no debe aparecer en Google. (La página es
// de cliente y no puede exportar metadatos, por eso va en este layout.)
export const metadata: Metadata = {
  title: "Acceso al panel",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
