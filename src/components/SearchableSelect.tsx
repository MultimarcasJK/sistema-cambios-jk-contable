'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { filterOptions, parseOptions } from '@/lib/searchable-options';

// Reemplazo directo de <select>: recibe los mismos <option>/<optgroup>,
// pero se puede escribir para buscar (como el campo Cliente) o elegir de la lista.
interface SearchableSelectProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  id?: string;
  placeholder?: string;
}

export function SearchableSelect({
  value,
  onChange,
  children,
  className = '',
  required,
  disabled,
  title,
  id,
  placeholder,
}: SearchableSelectProps) {
  const options = useMemo(() => parseOptions(children), [children]);
  const selected = options.find((o) => o.value === String(value ?? ''));
  // La opción con valor vacío ("Elegir cuenta…") sirve de texto de ayuda.
  const emptyOption = options.find((o) => o.value === '');
  const selectedText = selected && selected.value !== '' ? selected.label : '';
  const hint = placeholder || emptyOption?.label || 'Escribe o selecciona cuenta...';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = typed ? filterOptions(options, query) : options;

  const place = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < 260 && r.top > spaceBelow;
    setRect({ top: up ? r.top : r.bottom, left: r.left, width: Math.max(r.width, 220), up });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  // Mantener visible la opción marcada al moverse con las flechas.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    const idx = visible.findIndex((o) => o.value === String(value ?? ''));
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setTyped(false);
    setQuery('');
  };

  const pick = (optValue: string) => {
    if (optValue !== String(value ?? '')) onChange({ target: { value: optValue } });
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      let next = active;
      for (let i = 0; i < visible.length; i++) {
        next = (next + step + visible.length) % visible.length;
        if (!visible[next].disabled) break;
      }
      setActive(next);
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      const opt = visible[active];
      if (opt && !opt.disabled) pick(opt.value);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const shown = open ? (typed ? query : selectedText) : selectedText;

  let lastGroup: string | undefined;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        data-combobox=""
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        title={title || selectedText || undefined}
        placeholder={hint}
        value={shown}
        required={required}
        disabled={disabled}
        onFocus={(e) => {
          openList();
          e.currentTarget.select();
        }}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value);
          setTyped(true);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={`${className} pr-7 truncate`}
      />
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-60"
        aria-hidden
      />
      {open &&
        rect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            // Evita que el input pierda el foco antes de registrar el clic.
            onMouseDown={(e) => e.preventDefault()}
            style={{
              position: 'fixed',
              left: rect.left,
              width: rect.width,
              ...(rect.up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.top + 4 }),
              zIndex: 9999,
            }}
            className="max-h-64 overflow-auto rounded-xl border border-[#334155] bg-[#1e293b] py-1 text-xs text-[#f8fafc] shadow-2xl"
          >
            {visible.length === 0 && (
              <div className="px-3 py-2 text-[#94a3b8]">Sin resultados para “{query}”</div>
            )}
            {visible.map((o, i) => {
              const header =
                o.group && o.group !== lastGroup ? (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                    {o.group}
                  </div>
                ) : null;
              lastGroup = o.group;
              const isSel = o.value === String(value ?? '');
              return (
                <React.Fragment key={`${o.value}-${i}`}>
                  {header}
                  <div
                    role="option"
                    aria-selected={isSel}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => !o.disabled && pick(o.value)}
                    className={`px-3 py-1.5 ${o.group ? 'pl-5' : ''} ${
                      o.disabled
                        ? 'text-[#64748b] cursor-not-allowed'
                        : 'cursor-pointer'
                    } ${i === active && !o.disabled ? 'bg-[#2563eb] text-white' : ''} ${
                      isSel ? 'font-bold' : ''
                    }`}
                  >
                    {o.label}
                  </div>
                </React.Fragment>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
