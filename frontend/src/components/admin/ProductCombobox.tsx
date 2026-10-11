"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface ComboboxOption {
  id: number;
  /** Lo que se busca al escribir (sin tildes ni mayúsculas, ver normalize). */
  searchText: string;
  /** Texto principal de la opción (nombre del producto). */
  label: string;
  /** Texto secundario (precio y disponibilidad). */
  meta: string;
  disabled: boolean;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Selector de producto con buscador: reemplaza un <select> nativo, que con
 * ~70 productos obliga a scrollear uno por uno y en Windows/Chrome pinta las
 * opciones en gris claro (el navegador decide ese estilo, no se puede tocar
 * con CSS). Acá el texto es nuestro, así que queda siempre negro y legible.
 */
export default function ProductCombobox({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Seleccionar producto...",
}: {
  value: string;
  options: ComboboxOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => String(o.id) === value) ?? null;
  const filtered = query ? options.filter((o) => normalize(o.searchText).includes(normalize(query))) : options;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const select = (option: ComboboxOption) => {
    if (option.disabled) return;
    onChange(String(option.id));
    setQuery("");
    setOpen(false);
  };

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); openList(); }
      return;
    }
    const enabledIndexes = filtered.reduce<number[]>((acc, o, i) => (o.disabled ? acc : [...acc, i]), []);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = enabledIndexes.find((i) => i > highlight) ?? enabledIndexes[0];
      if (next !== undefined) setHighlight(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = [...enabledIndexes].reverse().find((i) => i < highlight) ?? enabledIndexes[enabledIndexes.length - 1];
      if (prev !== undefined) setHighlight(prev);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) select(filtered[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? "")}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); setOpen(true); }}
          onKeyDown={onKeyDown}
          className="w-full px-3 py-2 pr-8 border rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      {open && (
        <div id={listboxId} role="listbox" className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Sin resultados.</p>}
          {filtered.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={String(o.id) === value}
              disabled={o.disabled}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(o)}
              className={`w-full text-left px-3 py-2 text-sm flex flex-col disabled:cursor-not-allowed disabled:text-slate-400 ${
                o.disabled ? "" : i === highlight ? "bg-[#e8f0f8]" : "hover:bg-slate-50"
              } ${String(o.id) === value ? "font-bold" : ""}`}
            >
              <span className={o.disabled ? "text-slate-400" : "text-slate-900"}>{o.label}</span>
              <span className="text-xs text-slate-500">{o.meta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
