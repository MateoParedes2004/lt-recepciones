"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import AdminShell, { SECTION_LABELS, canSee, type Section } from "../../components/admin/AdminShell";
import { useSessionUser } from "../../components/admin/AdminAuthGate";
import UsersTab from "../../components/admin/UsersTab";
import AccountTab from "../../components/admin/AccountTab";
import { InstallAppBanner } from "../../components/admin/InstallApp";
import { clearSession, type SessionUser } from "../../lib/session";
import { loginPath } from "../../lib/panel-app";
import AdminHeader, { type SearchPick } from "../../components/admin/AdminHeader";
import HomeTab from "../../components/admin/HomeTab";
import ProductsTab from "../../components/admin/ProductsTab";
import CategoriesTab from "../../components/admin/CategoriesTab";
import RentalsTab from "../../components/admin/RentalsTab";
import RoutesTab from "../../components/admin/RoutesTab";
import GalleryTab from "../../components/admin/GalleryTab";
import CitiesTab from "../../components/admin/CitiesTab";
import InvoicesTab from "../../components/admin/InvoicesTab";
import { apiFetch } from "../../lib/api";
import { buildAlerts, paraguayTodayIdx, type PanelAlert } from "../../lib/admin-metrics";
import type { Product, Category, Rental, GalleryImage, City, CheckoutIntent, ShippingSettings } from "../../types";

// StatisticsTab carga recharts (pesado): se difiere para que ese bundle solo
// se descargue si el admin realmente abre la pestaña de Estadísticas.
const StatisticsTab = dynamic(() => import("../../components/admin/StatisticsTab"), {
  loading: () => (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
    </div>
  ),
});

const SUBTITLES: Record<Exclude<Section, "home">, string> = {
  rentals: "Reservas, presupuestos, devoluciones y pedidos por WhatsApp",
  calendar: "Los alquileres día por día",
  routes: "El mejor orden para entregar y retirar",
  invoices: "Facturas electrónicas y presupuestos",
  products: "Inventario, precios y fotos del catálogo",
  categories: "Los rubros del catálogo y su orden",
  gallery: "Fotos de eventos que se muestran en el sitio",
  cities: "Ciudades, costos de envío y fórmula por km",
  statistics: "Cómo rinde el negocio y de dónde salen los clientes",
  users: "Quién puede entrar al panel y qué puede hacer",
  account: "Tus datos y tu contraseña",
};

// La sección abierta viaja en la dirección (?seccion=rutas): recargar la
// página o volver con el botón "atrás" del navegador no lleva siempre a Inicio.
const SLUGS: Record<Section, string> = {
  home: "inicio", rentals: "alquileres", calendar: "calendario", routes: "rutas", invoices: "facturacion",
  products: "productos", categories: "categorias", gallery: "galeria", cities: "zonas", statistics: "estadisticas",
  users: "usuarios", account: "mi-cuenta",
};
/** La sección de la dirección, si este usuario la puede ver (si no, Inicio). */
const sectionFromUrl = (user: SessionUser): Section => {
  if (typeof window === "undefined") return "home";
  const slug = new URLSearchParams(window.location.search).get("seccion");
  const s = (Object.keys(SLUGS) as Section[]).find((k) => SLUGS[k] === slug) ?? "home";
  return canSee(user, s) ? s : "home";
};

/** Secciones con buscador propio (en el celular no se repite el general arriba). */
const SECTIONS_WITH_SEARCH: ReadonlySet<Section> = new Set(["rentals", "calendar", "products", "invoices", "cities"]);

/** Pedido de abrir una pestaña con algo ya aplicado; `nonce` fuerza a volver a montarla. */
interface OpenRequest { nonce: number; search?: string; newForm?: boolean; date?: string }

export default function AdminDashboard() {
  const router = useRouter();
  // Quién usa el panel: decide qué secciones se ven (el servidor controla igual cada pedido).
  const user = useSessionUser();
  const owner = user.role === "ADMIN";
  const [isLoadingData, setIsLoadingData] = useState(true);
  // AdminAuthGate monta esta página recién en el navegador: acá ya se puede leer la dirección.
  const [section, setSection] = useState<Section>(() => sectionFromUrl(user));
  // "?nuevo=1" (acceso directo "Nuevo presupuesto" del ícono de la app): abre el formulario de entrada.
  const [openRequest, setOpenRequest] = useState<OpenRequest>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("nuevo") === "1" && section === "rentals"
      ? { nonce: 1, newForm: true }
      : { nonce: 0 },
  );
  // Se saca "nuevo=1" de la dirección: recargar no tiene que volver a abrir un formulario vacío.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("nuevo")) {
      window.history.replaceState(null, "", `?seccion=${SLUGS[section]}`);
    }
    // Solo al abrir el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // "Ahora" de los avisos: se renueva con cada recarga de datos.
  const [now, setNow] = useState(() => Date.now());

  // Base de Datos Global
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [pendingOrders, setPendingOrders] = useState<CheckoutIntent[]>([]);
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings | null>(null);
  // Recursos que no se pudieron cargar (red caída, servidor caído, etc.):
  // sin esto, una falla se veía igual que "todavía no hay datos cargados".
  const [failedResources, setFailedResources] = useState<string[]>([]);

  const loadAll = async () => {
    const failed: string[] = [];
    const sources: { label: string; path: string; apply: (data: unknown) => void }[] = [
      { label: "productos", path: "/products", apply: (d) => setProducts(d as Product[]) },
      { label: "categorías", path: "/categories", apply: (d) => setCategories(d as Category[]) },
      { label: "alquileres", path: "/rentals", apply: (d) => setRentals(d as Rental[]) },
      // La galería del panel es solo del dueño (el Vendedor no la ve ni la pide).
      ...(owner ? [{ label: "galería", path: "/gallery/admin", apply: (d: unknown) => setGallery(d as GalleryImage[]) }] : []),
      { label: "ciudades", path: "/cities", apply: (d) => setCities(d as City[]) },
      { label: "pedidos por WhatsApp", path: "/analytics/checkout-intents", apply: (d) => setPendingOrders(d as CheckoutIntent[]) },
      { label: "fórmula de envío", path: "/shipping/settings", apply: (d) => setShippingSettings(d as ShippingSettings) },
    ];
    // Cada recurso se carga por separado: si uno falla, los demás igual se
    // muestran (antes un solo error tiraba abajo la carga completa).
    await Promise.all(sources.map(async ({ label, path, apply }) => {
      try {
        const res = await apiFetch(path);
        if (res.ok) apply(await res.json());
        else failed.push(label);
      } catch {
        failed.push(label);
      }
    }));
    setFailedResources(failed);
    setNow(Date.now());
    setIsLoadingData(false);
  };

  // Recarga los datos (lo usan las pestañas tras guardar, y el botón "Reintentar").
  const fetchData = () => {
    setIsLoadingData(true);
    return loadAll();
  };

  // La sesión ya la valida AdminAuthGate (el layout del panel) antes de montar
  // esta página: acá solo hay que hacer la carga inicial. isLoadingData ya
  // arranca en true, por eso no hace falta marcarlo de nuevo acá.
  useEffect(() => {
    // Carga de datos del servidor (sistema externo) al montar: los setState de
    // loadAll ocurren después de esperar las respuestas, no en el render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // Una sola vez al abrir: loadAll depende del rol, que no cambia con la página
    // abierta (si el dueño lo cambia, la sesión se corta y el panel se recarga).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Atrás"/"adelante" del navegador entre secciones.
  useEffect(() => {
    const onPop = () => setSection(sectionFromUrl(user));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [user]);

  const navigate = (next: Section, request: Omit<OpenRequest, "nonce"> = {}) => {
    if (!canSee(user, next)) return;
    setOpenRequest((r) => ({ nonce: r.nonce + 1, ...request }));
    if (next !== section) {
      window.history.pushState(null, "", `?seccion=${SLUGS[next]}`);
      window.scrollTo({ top: 0 });
    }
    setSection(next);
  };

  const handleLogout = () => { clearSession(); router.push(loginPath()); };

  const today = paraguayTodayIdx(now);
  // Solo los avisos que llevan a una sección que este usuario puede abrir.
  const alerts = useMemo(
    () => buildAlerts(rentals, products, pendingOrders, today, now).filter((a) => canSee(user, a.target)),
    [rentals, products, pendingOrders, today, now, user],
  );
  const overdueRentalsCount = useMemo(() => rentals.filter((r) => r.phase === "ATRASADO").length, [rentals]);

  const openAlert = (a: PanelAlert) => navigate(a.target, { search: a.search });
  const onSearchPick = (p: SearchPick) => navigate(p.kind === "rental" ? "rentals" : "products", { search: p.term });

  const subtitle = section === "home"
    ? `${(() => {
        const s = new Date(now).toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Asuncion" });
        return s.charAt(0).toUpperCase() + s.slice(1);
      })()} · lo que pasa hoy en el negocio`
    : SUBTITLES[section];

  const rentalsProps = { rentals, products, cities, shippingSettings, pendingOrders, fetchData, isLoadingData };

  return (
    <AdminShell
      active={section}
      onNavigate={(s) => navigate(s)}
      onLogout={handleLogout}
      onNewQuote={() => navigate("rentals", { newForm: true })}
      badges={{ pendingOrders: pendingOrders.length, overdue: overdueRentalsCount }}
      user={user}
    >
      <AdminHeader
        title={SECTION_LABELS[section]}
        subtitle={subtitle}
        rentals={rentals}
        // El buscador ofrece productos solo a quien puede abrir Productos.
        products={owner ? products : []}
        alerts={alerts}
        onSearchPick={onSearchPick}
        onOpenAlert={openAlert}
        onNewRental={() => navigate("rentals", { newForm: true })}
        sectionHasSearch={SECTIONS_WITH_SEARCH.has(section)}
      />

      {/* AVISO DE CARGA FALLIDA (distingue "no se pudo cargar" de "no hay datos") */}
      {failedResources.length > 0 && !isLoadingData && (
        <div role="alert" className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <p className="flex-1 text-sm font-medium">
            No se pudieron cargar: {failedResources.join(", ")}. Lo que ves puede estar incompleto — no significa que no haya datos.
          </p>
          <button onClick={fetchData} className="inline-flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      )}

      {section === "home" && (
        <div className="mb-5"><InstallAppBanner onShowSteps={() => navigate("account")} /></div>
      )}
      {section === "home" && (
        <HomeTab
          rentals={rentals}
          products={products}
          pendingOrders={pendingOrders}
          alerts={alerts}
          isLoadingData={isLoadingData}
          now={now}
          onOpenAlert={openAlert}
          onOpenRoutes={(date) => navigate("routes", { date })}
          ownerView={owner}
        />
      )}
      {section === "rentals" && (
        <RentalsTab key={`rentals-${openRequest.nonce}`} {...rentalsProps} initialSearch={openRequest.search} startWithNewForm={openRequest.newForm} />
      )}
      {section === "calendar" && <RentalsTab key={`calendar-${openRequest.nonce}`} {...rentalsProps} initialView="calendario" />}
      {/* Las secciones del dueño solo se montan para el dueño (navigate y la dirección ya lo filtran). */}
      {section === "routes" && owner && <RoutesTab key={`routes-${openRequest.nonce}`} initialDate={openRequest.date} />}
      {section === "invoices" && <InvoicesTab products={products} />}
      {section === "products" && owner && (
        <ProductsTab key={`products-${openRequest.nonce}`} products={products} categories={categories} fetchData={fetchData} isLoadingData={isLoadingData} initialSearch={openRequest.search} />
      )}
      {section === "categories" && owner && <CategoriesTab categories={categories} fetchData={fetchData} />}
      {section === "gallery" && owner && <GalleryTab gallery={gallery} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {section === "cities" && owner && <CitiesTab cities={cities} shippingSettings={shippingSettings} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {section === "statistics" && owner && <StatisticsTab />}
      {section === "users" && owner && <UsersTab />}
      {section === "account" && <AccountTab onLogout={handleLogout} />}
    </AdminShell>
  );
}
