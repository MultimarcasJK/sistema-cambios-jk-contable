'use client';

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Account, AppMode } from '@/types';
import { StorageService } from '@/lib/storage';
import { SearchableSelect } from '@/components/SearchableSelect';

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

export interface AccountField {
  key: string;
  label: string;
  current?: string;
  // Si viene, el campo se muestra bloqueado con este motivo
  lockedReason?: string;
}

export interface EditRecordConfig {
  title: string;
  nameLabel: string;
  currentName: string;
  nameOptions: string[];
  accounts: Account[];
  accountFields: AccountField[];
}

export type EditRecordResult = { name?: string } & Record<string, string | undefined>;

const accName = (a?: Account) => (a ? a.name || a.bank_name : '');

function EditRecordModal({ cfg, onDone }: { cfg: EditRecordConfig; onDone: (r: EditRecordResult | null) => void }) {
  const currentUpper = cfg.currentName.trim().toUpperCase();
  const [name, setName] = useState(currentUpper);
  const [accs, setAccs] = useState<Record<string, string>>(() =>
    Object.fromEntries(cfg.accountFields.map((f) => [f.key, f.current || '']))
  );
  const typed = name.trim().toUpperCase();
  const nameOk = typed === currentUpper || cfg.nameOptions.includes(typed);

  const changes = useMemo(() => {
    const r: EditRecordResult = {};
    if (typed && typed !== currentUpper && nameOk) r.name = typed;
    cfg.accountFields.forEach((f) => {
      if (!f.lockedReason && accs[f.key] && accs[f.key] !== (f.current || '')) r[f.key] = accs[f.key];
    });
    return r;
  }, [typed, currentUpper, nameOk, accs, cfg.accountFields]);
  const canSave = nameOk && Object.keys(changes).length > 0;

  const input =
    'w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500';

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
          if (canSave) onDone(changes);
        }}
      >
        <div>
          <h3 className="text-base font-bold text-slate-800">{cfg.title}</h3>
          <p className="text-[11px] text-slate-500">Montos, tasas y ganancia no cambian.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{cfg.nameLabel}</label>
          <input
            autoFocus
            type="text"
            list="edit-record-names"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            onFocus={(e) => e.target.select()}
            placeholder="Escribe o selecciona..."
            className={`${input} uppercase`}
          />
          <datalist id="edit-record-names">
            {cfg.nameOptions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {typed && !nameOk && (
            <p className="text-[11px] font-semibold text-rose-600 mt-1">
              Elige un nombre de la lista. Si no existe, regístralo primero en Clientes.
            </p>
          )}
        </div>

        {cfg.accountFields.map((f) => {
          const cur = cfg.accounts.find((a) => a.id === f.current);
          if (f.lockedReason) {
            return (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                <div className={`${input} bg-slate-50 text-slate-500`}>{accName(cur) || f.current || '-'}</div>
                <p className="text-[11px] text-slate-400 mt-1">{f.lockedReason}</p>
              </div>
            );
          }
          // Solo cuentas activas de la misma moneda, así el saldo se mueve sin conversiones
          const options = cfg.accounts.filter(
            (a) => a.id === f.current || (a.is_active !== false && (!cur || a.currency === cur.currency))
          );
          return (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {f.label}
                {cur && <span className="font-normal text-slate-400"> ({cur.currency})</span>}
              </label>
              <SearchableSelect
                value={accs[f.key]}
                onChange={(e) => setAccs((s) => ({ ...s, [f.key]: e.target.value }))}
                className={input}
              >
                {!cur && <option value="">-</option>}
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accName(a)} · {a.currency}
                  </option>
                ))}
              </SearchableSelect>
            </div>
          );
        })}

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
            disabled={!canSave}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

// Abre la ventana de edición. Devuelve solo lo que cambió, o null si se cancela.
export function openEditRecord(cfg: EditRecordConfig): Promise<EditRecordResult | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (r: EditRecordResult | null) => {
      root.unmount();
      host.remove();
      resolve(r);
    };
    root.render(<EditRecordModal cfg={cfg} onDone={done} />);
  });
}

// Ejecuta el guardado mostrando el error si algo falla (día cerrado, moneda distinta...)
export function runEdit(fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // assertDayOpen ya mostró su propio aviso
    if (!msg.startsWith('El día')) alert(msg);
    return false;
  }
}
