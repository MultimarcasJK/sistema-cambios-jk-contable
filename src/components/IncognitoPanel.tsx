'use client';

import React, { useMemo, useState } from 'react';
import { Account, AppMode } from '@/types';
import { StorageService } from '@/lib/storage';
import { isIncognito, INCOGNITO_NAME } from '@/lib/incognito';
import { isActorAdmin } from '@/lib/actor';
import { knownClientNames } from '@/components/EditRecordModal';
import { HelpCircle, UserCheck } from 'lucide-react';

interface Props {
  accounts: Account[];
  appMode?: AppMode;
  onDataChange: () => void;
}

// Lista de depósitos que entraron sin saber de quién son (abonos de INCÓGNITO) y botón para
// pasarlos al cliente real cuando aparece, aunque el día del depósito ya esté cerrado.
export function IncognitoPanel({ accounts, appMode, onDataChange }: Props) {
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const admin = isActorAdmin();

  const pendientes = StorageService.getDebtPayments(appMode)
    .filter((p) => p && isIncognito(p.client_name))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const nombres = useMemo(
    () => knownClientNames(appMode).filter((n) => !isIncognito(n)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appMode, pendientes.length]
  );

  if (pendientes.length === 0) return null;
  const total = pendientes.reduce((s, p) => s + (p.amount || 0), 0);
  const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const guardar = (id: string) => {
    try {
      StorageService.assignIncognitoPayment(id, clientName, appMode);
      setAssigningId(null);
      setClientName('');
      onDataChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo asignar el depósito.');
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">Depósitos sin identificar ({INCOGNITO_NAME})</h3>
            <p className="text-[11px] text-amber-700">
              Entraron a la cuenta pero aún no sabemos de qué cliente son. Cuando aparezca el cliente, pásale el depósito.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-amber-700 block">Por identificar</span>
          <span className="font-mono font-black text-amber-900">
            ${money(total)} USD · {pendientes.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-amber-800 text-left">
            <tr>
              <th className="py-1.5 pr-3">Fecha</th>
              <th className="py-1.5 pr-3">Cuenta</th>
              <th className="py-1.5 pr-3 text-right">Monto</th>
              <th className="py-1.5 pr-3">Nota / Ref</th>
              <th className="py-1.5 text-right">Cliente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {pendientes.map((p) => {
              const acc = accounts.find((a) => a.id === p.account_id);
              const original =
                p.currency && p.currency !== 'USD' && p.amount_currency
                  ? ` (${money(p.amount_currency)} ${p.currency})`
                  : '';
              const dias = Math.floor((Date.now() - new Date(p.date + 'T12:00:00').getTime()) / 86400000);
              return (
                <tr key={p.id} className="align-middle">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                    {p.date}
                    {dias >= 3 && <span className="ml-1.5 text-[10px] font-bold text-rose-600">hace {dias} días</span>}
                  </td>
                  <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{acc ? acc.name : p.account_id || '-'}</td>
                  <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    ${money(p.amount)}
                    <span className="font-normal text-slate-500">{original}</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-500 max-w-[180px] truncate">{p.notes || '-'}</td>
                  <td className="py-2 text-right">
                    {!admin ? (
                      <span className="text-[11px] text-amber-700">Lo asigna un ADMIN</span>
                    ) : assigningId === p.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          autoFocus
                          list="incognito-clientes"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardar(p.id);
                            if (e.key === 'Escape') setAssigningId(null);
                          }}
                          placeholder="Cliente real..."
                          className="w-40 text-xs font-bold uppercase border border-amber-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => guardar(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssigningId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningId(p.id);
                          setClientName('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Pasar a cliente
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="incognito-clientes">
          {nombres.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
