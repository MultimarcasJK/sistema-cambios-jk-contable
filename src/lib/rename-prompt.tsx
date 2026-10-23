'use client';

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppMode } from '@/types';
import { StorageService } from '@/lib/storage';

// Nombres que se pueden elegir al corregir: clientes y deudores (y remitentes en remesas)
export function knownClientNames(mode: AppMode | undefined, withRemitentes = false): string[] {
  const set = new Set<string>();
  const add = (n?: string) => {
    const v = (n || '').trim().toUpperCase();
    if (v) set.add(v);
  };
  StorageService.getClients(mode).forEach((c) => add(c.name));
  StorageService.getDebtors(mode).forEach((d) => add(d.client_name));
  if (withRemitentes) StorageService.getRemitentes(mode).forEach((r) => add(r.name));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

function PickerModal({
  current,
  label,
  options,
  onDone,
}: {
  current: string;
  label: string;
  options: string[];
  onDone: (name: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const currentUpper = current.trim().toUpperCase();
  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    return options.filter((n) => n !== currentUpper && (!s || n.includes(s)));
  }, [q, options, currentUpper]);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-4"
      onClick={() => onDone(null)}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-bold text-slate-800">Cambiar {label}</h3>
          <p className="text-xs text-slate-500">
            Actual: <span className="font-semibold text-slate-700">{current}</span>
          </p>
        </div>
        <input
          autoFocus
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value.toUpperCase());
            setPicked(null);
          }}
          placeholder={`Buscar ${label}...`}
          className="w-full text-sm font-semibold border border-slate-300 rounded-xl px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="p-3 text-xs text-slate-400">
              No hay ningún {label} con ese nombre. Regístralo primero en Clientes.
            </p>
          ) : (
            filtered.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPicked(n)}
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer ${
                  picked === n ? 'bg-sky-600 text-white font-bold' : 'hover:bg-sky-50 text-slate-700'
                }`}
              >
                {n}
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onDone(null)}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!picked}
            onClick={() => onDone(picked)}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// Abre una lista para elegir el nombre correcto. Solo deja elegir nombres que ya existen,
// así no se crean clientes duplicados por un error al escribir. null si se cancela.
export function askNewClientName(
  current: string,
  options: string[],
  label = 'cliente'
): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (name: string | null) => {
      root.unmount();
      host.remove();
      resolve(name);
    };
    root.render(<PickerModal current={current} label={label} options={options} onDone={done} />);
  });
}
