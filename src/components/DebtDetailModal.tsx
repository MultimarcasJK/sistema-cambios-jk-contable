'use client';

import React, { useMemo } from 'react';
import { X, CalendarClock } from 'lucide-react';
import { AppMode, Debtor, TransactionDetal, TransactionMayor } from '@/types';
import { StorageService } from '@/lib/storage';
import { deudasDeCliente, diasEntre, OrigenDeuda } from '@/lib/deudas-fechas';
import { formatCurrency } from '@/lib/formatters';
import { localDateStr } from '@/lib/dates';

interface Props {
  debtor: Debtor;
  detalTxs?: TransactionDetal[];
  mayorTxs?: TransactionMayor[];
  appMode?: AppMode;
  onClose: () => void;
}

const ORIGEN: Record<OrigenDeuda, string> = {
  venta: 'Venta',
  remesa: 'Remesa',
  manual: 'A mano',
  anterior: 'Sin fecha',
};

// Detalle de la deuda de un cliente por fecha: qué operación la formó y cuánto falta de cada una
export function DebtDetailModal({ debtor, detalTxs, mayorTxs, appMode, onClose }: Props) {
  const hoy = localDateStr();
  const detalle = useMemo(
    () =>
      deudasDeCliente(debtor, debtor.client_name, {
        detalTxs,
        mayorTxs,
        remesas: StorageService.getRemesas(appMode),
        payments: StorageService.getDebtPayments(appMode),
      }),
    [debtor, detalTxs, mayorTxs, appMode]
  );
  const pendientes = detalle.items.filter((i) => i.pendiente > 0).reverse();
  const pagadas = detalle.items.filter((i) => i.pendiente <= 0).reverse();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Deudas por fecha de ${debtor.client_name}`}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-600" />
              Deudas por fecha
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{debtor.client_name}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5">
              <div className="text-[11px] font-semibold text-rose-700 uppercase">Debe</div>
              <div className="font-mono font-black text-rose-700">${formatCurrency(detalle.totalPendiente)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
              <div className="text-[11px] font-semibold text-slate-600 uppercase">Abonado</div>
              <div className="font-mono font-black text-slate-800">${formatCurrency(detalle.abonado)}</div>
            </div>
          </div>
          {detalle.aFavor > 0 && (
            <p className="text-xs text-emerald-700 font-semibold">Tiene ${formatCurrency(detalle.aFavor)} a favor.</p>
          )}

          {pendientes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No tiene deudas pendientes.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendientes.map((i, idx) => {
                const dias = i.date ? diasEntre(i.date, hoy) : null;
                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800">{i.date || 'Sin fecha'}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {ORIGEN[i.origen]} · {i.descripcion}
                        {dias !== null && ` · hace ${dias} día${dias === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-rose-700">${formatCurrency(i.pendiente)}</div>
                      {i.pendiente < i.monto && (
                        <div className="text-[11px] text-slate-500 font-mono">de ${formatCurrency(i.monto)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pagadas.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                Ya pagadas ({pagadas.length})
              </summary>
              <div className="divide-y divide-slate-100 mt-1">
                {pagadas.map((i, idx) => (
                  <div key={idx} className="py-2 flex justify-between text-xs text-slate-500">
                    <span>
                      {i.date || 'Sin fecha'} · {ORIGEN[i.origen]}
                    </span>
                    <span className="font-mono">${formatCurrency(i.monto)} ✓</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          <p className="text-[11px] text-slate-400">Los abonos se descuentan primero de la deuda más vieja.</p>
        </div>
      </div>
    </div>
  );
}
