"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SunIcon, MoonIcon } from "@phosphor-icons/react";

const STORAGE_KEY = "lt_theme";

// La clase "dark" en <html> es la fuente de verdad (la pone el script inline
// de layout.tsx al cargar, o este mismo botón al tocarlo). useSyncExternalStore
// es la forma correcta de sincronizar React con algo externo como esto, sin
// el antipatrón de "setState dentro de un useEffect".
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

// En el servidor no hay DOM: asumimos claro (si el script inline ya puso
// "dark" antes de hidratar, el botón se corrige solo apenas React sincroniza
// con el valor real, sin parpadeo visible).
function getServerSnapshot() {
  return false;
}

// Botón para elegir modo claro/oscuro a mano, sin depender de la
// configuración del celular (algunos navegadores, como Samsung Internet,
// fuerzan su propio oscuro e ignoran nuestro CSS). Si el visitante nunca lo
// tocó, el script inline de layout.tsx ya decidió el modo según el sistema;
// este botón permite cambiarlo y esa elección queda guardada para la
// próxima visita.
export default function ThemeToggle({ className = "", iconClassName = "w-5 h-5" }: { className?: string; iconClassName?: string }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Sin localStorage (modo privado, etc.): el cambio funciona igual,
      // solo que no se recuerda en la próxima visita.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className={className}
    >
      {isDark ? <SunIcon weight="light" className={iconClassName} /> : <MoonIcon weight="light" className={iconClassName} />}
    </button>
  );
}
