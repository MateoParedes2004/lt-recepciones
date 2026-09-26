"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChairIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import AddToCartButton from "../AddToCartButton";
import { getImageUrl } from "../../lib/api";
import type { Category, Product } from "../../types";

const formatPYG = (amount: number) => {
  if (!amount) return 'Gs. 0';
  return `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Pone en negrita la parte del texto que coincide con lo escrito.
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? normalize(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-extrabold text-slate-900">{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  );
}

const sectionId =(name: string) => `categoria-${name.toLowerCase().replace(/ /g, '-')}`;

// Altura del menú fijo (80px) + barra de rubros (~56px) + un pequeño respiro.
const SCROLL_OFFSET = 150;

export default function CatalogBrowser({ categories }: { categories: Category[] }) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState("todo");
  const railRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<string | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "query" es lo que se está escribiendo (alimenta el desplegable);
  // "applied" es lo que filtra la página (al presionar Enter o "Mostrar todo").
  const liveQ = normalize(query);
  const q = normalize(applied);

  const allProducts = useMemo(
    () => categories.flatMap((c) => (c.products ?? []).map((p) => ({ product: p, category: c.name }))),
    [categories]
  );

  const suggestions = useMemo(() => {
    const rank = (p: Product) => {
      const n = normalize(p.name);
      if (n.startsWith(liveQ)) return 0;
      if (n.split(/\s+/).some((w) => w.startsWith(liveQ))) return 1;
      if (n.includes(liveQ)) return 2;
      return normalize(p.description ?? "").includes(liveQ) ? 3 : -1;
    };
    const ranked = liveQ
      ? allProducts
          .map((item) => ({ item, r: rank(item.product) }))
          .filter((x) => x.r >= 0)
          .sort((a, b) => a.r - b.r)
      : [];
    const names = Array.from(new Set(ranked.filter((x) => x.r <= 2).map((x) => x.item.product.name))).slice(0, 4);
    const cats = liveQ ? categories.filter((c) => normalize(c.name).includes(liveQ)).map((c) => c.name).slice(0, 2) : [];
    return { cats, names, products: ranked.slice(0, 4).map((x) => x.item) };
  }, [allProducts, categories, liveQ]);

  const commit = (text: string) => {
    setQuery(text);
    setApplied(text);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cierra el desplegable al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = useMemo(() => {
    if (!q) return categories;
    return categories
      .map((category) => ({
        ...category,
        // Si la búsqueda coincide con el nombre del rubro, se muestra el rubro completo.
        products: normalize(category.name).includes(q)
          ? (category.products ?? [])
          : (category.products ?? []).filter((p) =>
              normalize(`${p.name} ${p.description ?? ""}`).includes(q)
            ),
      }))
      .filter((category) => category.products.length > 0);
  }, [categories, q]);

  const totalMatches = visible.reduce((sum, c) => sum + (c.products?.length ?? 0), 0);

  // Resalta el rubro que se está viendo mientras se desplaza la página.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = "todo";
      for (const category of visible) {
        const el = document.getElementById(sectionId(category.name));
        if (el && el.getBoundingClientRect().top <= SCROLL_OFFSET) current = sectionId(category.name);
      }
      setActiveId(current);
    };
    const onScroll = () => {
      // Tras tocar un chip se respeta ese rubro hasta que termina el desplazamiento
      // (al final de la página el último rubro nunca llega al borde superior).
      if (pinnedRef.current) {
        if (settleRef.current) clearTimeout(settleRef.current);
        settleRef.current = setTimeout(() => { pinnedRef.current = null; }, 200);
        return;
      }
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (settleRef.current) clearTimeout(settleRef.current);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [visible]);

  // Mantiene el chip activo a la vista dentro de la barra (solo mueve la barra, no la página).
  useEffect(() => {
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-chip="${activeId}"]`);
    if (!rail || !chip) return;
    const target = chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeId]);

  const goTo = (id: string) => {
    pinnedRef.current = id;
    setActiveId(id);
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => { pinnedRef.current = null; }, 200);
    if (id === "todo") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  const chipBase =
    "shrink-0 h-9 px-4 rounded-full text-[13px] font-bold whitespace-nowrap border transition-colors cursor-pointer";
  const chipOn =
    "text-white border-transparent bg-[linear-gradient(135deg,#0d4a8a,#00294f)] shadow-sm";
  const chipOff = "bg-white text-slate-700 border-slate-200 hover:border-[#004080] hover:text-[#004080]";

  return (
    <>
      {/* CABECERA COMPACTA: título + buscador */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-[27px] md:text-[40px] leading-tight font-serif font-extrabold text-slate-900 tracking-tight">
              Nuestros Catálogos
            </h1>
            <p className="text-[13.5px] md:text-base text-slate-600 mt-1">
              Elegí, cotizá y enviá tu pedido por WhatsApp.
            </p>
          </div>

          <div ref={searchRef} className="relative w-full md:w-110">
            <MagnifyingGlassIcon
              weight="light"
              className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                if (!e.target.value.trim()) setApplied("");
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) commit(query.trim());
              }}
              placeholder="Buscar sillas, copas, manteles…"
              aria-label="Buscar productos"
              autoComplete="off"
              enterKeyHint="search"
              className="w-full h-12 rounded-2xl bg-white border border-slate-200 pl-12 pr-11 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#004080] focus:ring-2 focus:ring-[#004080]/15 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setApplied("");
                  setOpen(false);
                }}
                aria-label="Borrar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <XIcon weight="light" className="w-4 h-4" />
              </button>
            )}

            {/* DESPLEGABLE DE RESULTADOS EN VIVO */}
            {open && liveQ && (
              <div
                aria-label="Resultados de búsqueda"
                className="absolute z-50 top-full mt-2 left-0 right-0 md:left-auto md:right-0 md:w-215 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 md:p-6 md:grid md:grid-cols-[13rem_1fr] md:gap-8"
              >
                {suggestions.products.length === 0 ? (
                  <p className="md:col-span-2 text-sm text-slate-500 py-2">
                    No encontramos productos para “{query.trim()}”. Probá con otra palabra.
                  </p>
                ) : (
                  <>
                    <div className="hidden md:flex flex-col">
                      <h3 className="font-serif font-bold text-slate-900 text-lg mb-3">Resultados de búsqueda</h3>
                      <ul className="space-y-1">
                        {suggestions.cats.map((name) => (
                          <li key={`c-${name}`}>
                            <button
                              type="button"
                              onClick={() => commit(name)}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left text-sm text-slate-700 hover:bg-[#e8f0f8] hover:text-[#004080] cursor-pointer"
                            >
                              <MagnifyingGlassIcon weight="light" className="w-4 h-4 text-[#004080] shrink-0" />
                              <span><Highlight text={name} q={liveQ} /> <span className="text-slate-400">· rubro</span></span>
                            </button>
                          </li>
                        ))}
                        {suggestions.names.map((name) => (
                          <li key={`n-${name}`}>
                            <button
                              type="button"
                              onClick={() => commit(name)}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left text-sm text-slate-700 hover:bg-[#e8f0f8] hover:text-[#004080] cursor-pointer"
                            >
                              <MagnifyingGlassIcon weight="light" className="w-4 h-4 text-[#004080] shrink-0" />
                              <span><Highlight text={name} q={liveQ} /></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => commit(query.trim())}
                        className="mt-auto pt-6 text-left text-sm font-bold text-[#004080] underline underline-offset-2 hover:text-[#00294f] cursor-pointer"
                      >
                        Mostrar todo “{query.trim()}” →
                      </button>
                    </div>

                    <div>
                      <h3 className="font-serif font-bold text-slate-900 text-base md:text-lg mb-3">Productos encontrados</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3">
                        {suggestions.products.map(({ product, category }) => (
                          <li key={product.id}>
                            <Link
                              href={`/catalogos/${product.id}`}
                              className="flex md:flex-col items-center md:items-stretch gap-3 md:gap-0 rounded-xl border border-slate-100 hover:border-[#004080] hover:shadow-lg transition-all overflow-hidden bg-white h-full"
                            >
                              <div className="relative w-16 h-16 md:w-full md:h-28 shrink-0 bg-slate-100 flex items-center justify-center">
                                {product.imageUrl ? (
                                  <Image
                                    src={getImageUrl(product.imageUrl)}
                                    alt={product.name}
                                    fill
                                    sizes="(max-width: 768px) 64px, 160px"
                                    className="object-contain p-1.5 mix-blend-multiply"
                                  />
                                ) : (
                                  <ChairIcon weight="light" className="w-7 h-7 text-slate-300" />
                                )}
                              </div>
                              <div className="md:p-3 min-w-0 flex-1">
                                <p className="text-[11px] uppercase tracking-wider text-slate-400 truncate">{category}</p>
                                <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                                  <Highlight text={product.name} q={liveQ} />
                                </p>
                                <p className="font-serif font-bold text-[#004080] text-base mt-1">{formatPYG(product.pricePerDay)}</p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => commit(query.trim())}
                        className="md:hidden mt-3 w-full h-10 rounded-xl text-sm font-bold text-white bg-linear-to-br from-[#0d4a8a] to-[#00294f] cursor-pointer"
                      >
                        Mostrar todo “{query.trim()}”
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BARRA DE RUBROS (queda fija bajo el menú) */}
      {categories.length > 0 && (
        <div className="sticky top-20 z-30 bg-white/92 backdrop-blur-md border-y border-slate-200 shadow-sm mb-8 md:mb-10">
          <div
            ref={railRef}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <button
              type="button"
              data-chip="todo"
              onClick={() => goTo("todo")}
              className={`${chipBase} ${activeId === "todo" ? chipOn : chipOff}`}
            >
              Todo
            </button>
            {visible.map((category) => {
              const id = sectionId(category.name);
              return (
                <button
                  key={category.id}
                  type="button"
                  data-chip={id}
                  onClick={() => goTo(id)}
                  className={`${chipBase} ${activeId === id ? chipOn : chipOff}`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LISTA DE CATEGORÍAS Y PRODUCTOS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {categories.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="inline-flex p-4 bg-blue-50 rounded-full mb-4 text-blue-600">
              <ChairIcon weight="light" className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif font-bold text-slate-900">Inventario en preparación</h3>
            <p className="text-slate-500 mt-2 text-sm">Pronto subiremos nuestros mejores productos aquí.</p>
          </div>
        ) : (
          <>
            {q && (
              <p className="text-sm text-slate-500 mb-6" role="status">
                {totalMatches === 0
                  ? <>No encontramos productos para “{applied.trim()}”. Probá con otra palabra.</>
                  : <>{totalMatches} {totalMatches === 1 ? "resultado" : "resultados"} para “{applied.trim()}”</>}
              </p>
            )}

            {visible.map((category: Category) => (
              <section key={category.id} className="mb-12 md:mb-16 scroll-mt-36" id={sectionId(category.name)}>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 md:mb-6 pb-3 border-b border-slate-200 gap-2">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 tracking-wide">{category.name}</h2>
                    {category.description && (
                      <p className="text-slate-500 text-xs md:text-sm mt-1 max-w-2xl">{category.description}</p>
                    )}
                  </div>
                </div>

                {/* CONTENEDOR MÁGICO Y COMPACTO */}
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                  {category.products && category.products.length > 0 ? (
                    category.products.map((product: Product) => (

                      // TARJETA DE PRODUCTO
                      <div key={product.id} className="snap-center shrink-0 w-[60vw] sm:w-55 md:w-auto bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group relative">

                        <Link href={`/catalogos/${product.id}`} className="block flex-col grow cursor-pointer">
                          {/* Imagen */}
                          <div className="h-36 md:h-40 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                            {product.imageUrl ? (
                              <Image
                                src={getImageUrl(product.imageUrl)}
                                alt={product.name}
                                fill
                                sizes="(max-width: 768px) 60vw, (max-width: 1024px) 33vw, 20vw"
                                className="object-contain p-3 group-hover:scale-105 transition-transform duration-700 drop-shadow-sm mix-blend-multiply"
                              />
                            ) : (
                              <div className="text-slate-400 font-medium flex flex-col items-center">
                                <span className="text-[9px] uppercase tracking-wider mb-1 opacity-50">LT Recepciones</span>
                                <span className="text-xs">Sin imagen</span>
                              </div>
                            )}
                          </div>

                          {/* Detalles */}
                          <div className="p-3 md:p-4 flex flex-col grow">
                            <h3 className="font-serif font-bold text-slate-900 text-base md:text-lg mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                            <p className="text-[11px] md:text-xs text-slate-500 line-clamp-2 mb-3 grow leading-relaxed">{product.description}</p>
                          </div>
                        </Link>

                        {/* ZONA DE COMPRA */}
                        <div className="px-3 md:px-4 pb-3 md:pb-4 flex items-center justify-between border-t border-slate-50 pt-3 mt-auto gap-2">
                          <div className="flex flex-col pointer-events-none">
                            <span className="text-[8px] md:text-[9px] uppercase font-bold text-slate-400 tracking-wider">Precio / Unidad</span>
                            <span className="font-serif font-bold text-blue-900 text-sm md:text-base">{formatPYG(product.pricePerDay)}</span>
                          </div>

                          <div className="shrink-0 transform scale-90 md:scale-100 origin-right relative z-10">
                            <AddToCartButton product={product} />
                          </div>
                        </div>

                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-8 md:py-10 bg-white rounded-2xl border border-dashed border-slate-200 flex items-center justify-center">
                      <p className="text-slate-400 text-xs text-center">
                        Aún no hay productos disponibles en esta categoría.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}
