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
  const [value, setValue] = useState('');
  const currentUpper = current.trim().toUpperCase();
  const choices = useMemo(() => options.filter((n) => n !== currentUpper), [options, currentUpper]);
  const typed = value.trim().toUpperCase();
  const match = choices.find((n) => n === typed) || null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-4"
      onClick={() => onDone(null)}
    >
      <form
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 font-sans"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (match) onDone(match);
        }}
      >
        <div>
          <h3 className="text-base font-bold text-slate-800">Cambiar {label}</h3>
          <p className="text-xs text-slate-500">
            Actual: <span className="font-semibold text-slate-700">{current}</span>
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Nuevo {label} *</label>
          <input
            autoFocus
            type="text"
            list="rename-client-options"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder={`Escribe o selecciona ${label}...`}
            className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <datalist id="rename-client-options">
            {choices.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {typed && !match && (
            <p className="text-[11px] font-semibold text-rose-600 mt-1">
              Elige un {label} de la lista. Si no existe, regístralo primero en Clientes.
            </p>
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
            type="submit"
            disabled={!match}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

// Abre una ventana para elegir el nombre correcto. Solo deja elegir nombres que ya existen,
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
