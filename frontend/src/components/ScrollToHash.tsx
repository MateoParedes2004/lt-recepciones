"use client";

import { useEffect } from "react";

function scrollToCurrentHash() {
  const hash = window.location.hash;
  if (!hash) return;

  // El navegador puede llegar a codificar caracteres como tildes en el hash
  // (ej. "í" -> "%C3%AD"), así que hay que decodificarlo antes de buscar el id.
  const id = decodeURIComponent(hash.slice(1));
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Next.js no siempre desliza suavemente hasta el ancla (#id) al navegar con
 * <Link scroll={false}> — ni al llegar desde otra página, ni al cambiar de
 * sección quedándose en la misma. Este componente toma el control manual:
 * escucha el hash tanto al montar como en cada cambio, y hace el scroll
 * animado él mismo, sin depender del comportamiento interno del router.
 */
export default function ScrollToHash() {
  useEffect(() => {
    // Un pequeño delay asegura que el layout ya esté pintado antes de medir posiciones.
    const timer = setTimeout(scrollToCurrentHash, 50);

    window.addEventListener("hashchange", scrollToCurrentHash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToCurrentHash);
    };
  }, []);

  return null;
}
