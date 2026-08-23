"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

interface AnchorLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string; // ej: "/#nuestro-trabajo" o "/catalogos#categoria-sillas"
  children: ReactNode;
  onNavigate?: () => void;
}

/**
 * Link para navegación con ancla (#id) que siempre desliza suavemente,
 * en vez de saltar de un pantallazo:
 * - Si ya estás en la página de destino, hace scroll manual directo (no navega).
 * - Si estás en otra página, navega con scroll={false} y deja que
 *   <ScrollToHash /> (montado en la página destino) haga el scroll suave
 *   una vez que el contenido ya está en pantalla.
 */
export default function AnchorLink({ href, children, onNavigate, ...rest }: AnchorLinkProps) {
  const pathname = usePathname();
  const [targetPath, hash] = href.split("#");
  const path = targetPath || "/";

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();
    if (hash && pathname === path) {
      e.preventDefault();
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", href);
    }
  };

  return (
    <Link href={href} scroll={false} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
