"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Great_Vibes } from "next/font/google";
import {
  House, ClipboardList, CalendarDays, Truck, Receipt, Package, Tags, Camera, MapPin, BarChart3, LogOut, Menu, X,
  Users, UserRound, Plus,
} from "lucide-react";
import { ROLE_LABEL, type SessionUser } from "../../lib/session";

export type Section =
  | "home" | "rentals" | "calendar" | "routes" | "invoices"
  | "products" | "categories" | "gallery" | "cities" | "statistics"
  | "users" | "account";

interface NavItem { id: Section; label: string; icon: React.ElementType }

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operación",
    items: [
      { id: "home", label: "Inicio", icon: House },
      { id: "rentals", label: "Alquileres", icon: ClipboardList },
      { id: "calendar", label: "Calendario", icon: CalendarDays },
      { id: "routes", label: "Rutas de reparto", icon: Truck },
      { id: "invoices", label: "Facturación", icon: Receipt },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { id: "products", label: "Productos", icon: Package },
      { id: "categories", label: "Categorías", icon: Tags },
      { id: "gallery", label: "Galería", icon: Camera },
      { id: "cities", label: "Zonas de entrega", icon: MapPin },
    ],
  },
  {
    title: "Análisis",
    items: [{ id: "statistics", label: "Estadísticas", icon: BarChart3 }],
  },
  {
    title: "Cuenta",
    items: [
      { id: "users", label: "Usuarios", icon: Users },
      { id: "account", label: "Mi cuenta", icon: UserRound },
    ],
  },
];

/**
 * Qué secciones ve cada rol. El Vendedor: presupuestos, alquileres, calendario
 * y facturación (lo mismo que le permite el servidor, ver backend/src/auth/roles.ts).
 * El servidor es quien controla de verdad: esto solo evita mostrar lo que daría error.
 */
const SELLER_SECTIONS: ReadonlySet<Section> = new Set(["home", "rentals", "calendar", "invoices", "account"]);
export const canSee = (user: SessionUser, s: Section) => user.role === "ADMIN" || SELLER_SECTIONS.has(s);

/**
 * Atajos de la barra de abajo en el celular: dos a cada lado del botón central
 * "+ Presupuesto" (lo más usado desde el teléfono). El resto está en "Más".
 */
const mobileTabs = (user: SessionUser): [NavItem, NavItem, NavItem] => [
  { id: "home", label: "Inicio", icon: House },
  { id: "rentals", label: "Alquileres", icon: ClipboardList },
  user.role === "ADMIN" ? { id: "routes", label: "Rutas", icon: Truck } : { id: "calendar", label: "Calendario", icon: CalendarDays },
];

export const SECTION_LABELS: Record<Section, string> = Object.fromEntries(
  GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label])),
) as Record<Section, string>;

interface Badges { pendingOrders: number; overdue: number }

function Badge({ value, tone, label }: { value: number; tone: "navy" | "red"; label: string }) {
  if (value <= 0) return null;
  return (
    <span
      aria-label={label}
      title={label}
      className={`min-w-5.5 h-5.5 px-1.5 inline-flex items-center justify-center rounded-full text-xs font-bold ${tone === "navy" ? "bg-[#004080] text-white" : "bg-[#b42318] text-white"}`}
    >
      {value}
    </span>
  );
}

function NavList({ active, onNavigate, badges, user }: { active: Section; onNavigate: (s: Section) => void; badges: Badges; user: SessionUser }) {
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSee(user, i.id)) })).filter((g) => g.items.length > 0);
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <span className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{group.title}</span>
          {group.items.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 min-h-11 px-3 rounded-xl text-sm text-left transition-colors cursor-pointer ${
                  isActive
                    ? "bg-linear-to-br from-[#0d4a8a] to-[#00294f] text-white font-bold shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {id === "rentals" && (
                  <span className="flex gap-1">
                    <Badge value={badges.pendingOrders} tone="navy" label={`${badges.pendingOrders} pedidos por WhatsApp sin confirmar`} />
                    <Badge value={badges.overdue} tone="red" label={`${badges.overdue} alquileres atrasados`} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Misma marca que el encabezado del sitio: el logo ya es "LT", y al lado va
// "Recepciones" en la letra manuscrita (Great Vibes). La fuente se carga acá
// mismo, como en Header y Footer (no se centraliza en Tailwind a propósito).
const cursiveFont = Great_Vibes({ subsets: ["latin"], weight: "400" });

/** Quién está usando el panel, al pie del menú. */
function WhoAmI({ user }: { user: SessionUser }) {
  return (
    <div className="px-3 pb-2">
      <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
      <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="relative w-11 h-11 shrink-0">
        <Image src="/logo.png" alt="LT" fill sizes="44px" className="object-contain" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className={`${cursiveFont.className} text-[30px] leading-none text-black pt-1.5`}>Recepciones</span>
        <span className="text-xs text-slate-500 mt-1 whitespace-nowrap">Panel de administración</span>
      </div>
    </div>
  );
}

/**
 * Armazón del panel: menú lateral en computadora; en el celular, barra de
 * arriba con el menú completo desplegable y atajos fijos abajo.
 */
export default function AdminShell({
  active, onNavigate, onLogout, onNewQuote, badges, user, children,
}: {
  active: Section;
  onNavigate: (s: Section) => void;
  onLogout: () => void;
  /** Botón central de la barra del celular: abre el formulario de presupuesto/alquiler. */
  onNewQuote: () => void;
  badges: Badges;
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Con el menú del celular abierto: Escape lo cierra y la página no se desplaza detrás.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const go = (s: Section) => { setDrawerOpen(false); onNavigate(s); };

  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      className="flex items-center gap-3 min-h-11 px-3 rounded-xl text-sm font-bold text-[#b42318] hover:bg-red-50 transition-colors cursor-pointer text-left"
    >
      <LogOut className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" /> Cerrar sesión
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 lg:flex">
      {/* Menú lateral (computadora) */}
      <nav aria-label="Menú del panel" className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto bg-white border-r border-slate-200 px-4 py-6 gap-6">
        <Brand />
        <NavList active={active} onNavigate={go} badges={badges} user={user} />
        <div className="mt-auto pt-4 border-t border-slate-200"><WhoAmI user={user} />{logoutButton}</div>
      </nav>

      {/* Barra de arriba (celular) */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-2.5">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir el menú"
          aria-expanded={drawerOpen}
          className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center cursor-pointer"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {/* Menú completo desplegable (celular) */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <button type="button" aria-label="Cerrar el menú" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-slate-900/40 cursor-default" />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] bg-white shadow-2xl flex flex-col gap-6 px-4 py-5 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <Brand />
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Cerrar el menú" className="w-11 h-11 rounded-xl text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer">
                <X className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <NavList active={active} onNavigate={go} badges={badges} user={user} />
            <div className="mt-auto pt-4 border-t border-slate-200"><WhoAmI user={user} />{logoutButton}</div>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10">{children}</div>

      {/* Atajos fijos abajo (celular): el botón central abre un presupuesto nuevo */}
      <nav aria-label="Atajos" className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 items-end bg-white border-t border-slate-200 px-1.5 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        {(() => {
          const [first, second, third] = mobileTabs(user);
          const tab = ({ id, label, icon: Icon }: NavItem) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={isActive ? "page" : undefined}
                className={`relative min-h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] cursor-pointer ${isActive ? "text-[#004080] font-black" : "text-slate-600 font-bold"}`}
              >
                <Icon className="w-5.5 h-5.5" strokeWidth={isActive ? 1.9 : 1.5} aria-hidden="true" />
                {label}
                {id === "rentals" && badges.pendingOrders + badges.overdue > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-1.1rem)] w-2.5 h-2.5 rounded-full bg-[#b42318] border-2 border-white" aria-hidden="true" />
                )}
              </button>
            );
          };
          return (
            <>
              {tab(first)}
              {tab(second)}
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); onNewQuote(); }}
                className="min-h-14 flex flex-col items-center justify-end gap-0.5 text-[11px] font-black text-[#004080] cursor-pointer"
              >
                <span className="-mt-6 w-13 h-13 rounded-2xl bg-linear-to-br from-[#0d4a8a] to-[#00294f] text-white shadow-lg shadow-[#004080]/30 inline-flex items-center justify-center">
                  <Plus className="w-6 h-6" strokeWidth={2.2} aria-hidden="true" />
                </span>
                Presupuesto
              </button>
              {tab(third)}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="min-h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-slate-600 cursor-pointer"
              >
                <Menu className="w-5.5 h-5.5" strokeWidth={1.5} aria-hidden="true" />
                Más
              </button>
            </>
          );
        })()}
      </nav>
    </div>
  );
}
