'use client';

import React, { useState, useMemo } from 'react';
import { Account, BalanceTransfer } from '@/types';
import { StorageService } from '@/lib/storage';
import { ArrowLeftRight, CheckCircle, Search, Trash2 } from 'lucide-react';
import { parseFormattedNumber, formatCurrency, formatRegionalAmount, formatInputNumber } from '@/lib/formatters';

interface TransfersProps {
  accounts: Account[];
  transfers: BalanceTransfer[];
  onDataChange: () => void;
}

export function TransfersView({ accounts, transfers, onDataChange }: TransfersProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [feeMode, setFeeMode] = useState<'percent' | 'fixed'>('percent');
  const [formData, setFormData] = useState({
    date: todayStr,
    from_account_id: '',
    to_account_id: '',
    amount_sent: '',
    percentage_fee: '',
    commission: '',
    amount_received: '',
    concept: 'CAMBIO DE SALDO',
    reference: '',
  });

  const [searchTerm, setSearchTerm] = useState('');

  const handleDeleteTransfer = (id: string) => {
    if (confirm('¿Deseas eliminar este registro de CAMBIO SALDOS? Se revertirán los saldos de la cuenta origen y cuenta destino automáticamente.')) {
      StorageService.deleteTransfer(id);
      onDataChange();
    }
  };

  const fromAccount = useMemo(
    () => accounts.find((a) => a.id === formData.from_account_id),
    [accounts, formData.from_account_id]
  );
  const toAccount = useMemo(
    () => accounts.find((a) => a.id === formData.to_account_id),
    [accounts, formData.to_account_id]
  );

  const groupedAccounts = useMemo(() => {
    const map = new Map<string, Account[]>();
    accounts.forEach((acc) => {
      const curr = acc.currency.toUpperCase();
      if (!map.has(curr)) map.set(curr, []);
      map.get(curr)!.push(acc);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [accounts]);

  const commissionVal = useMemo(() => {
    const sent = parseFormattedNumber(formData.amount_sent);
    if (sent <= 0) return 0;
    if (feeMode === 'percent') {
      const pct = parseFloat(formData.percentage_fee) || 0;
      return Number(((sent * pct) / 100).toFixed(4));
    }
    return parseFormattedNumber(formData.commission);
  }, [formData.amount_sent, formData.percentage_fee, formData.commission, feeMode]);

  const totalDebitedFromOrigin = useMemo(() => {
    const sent = parseFormattedNumber(formData.amount_sent);
    return Number((sent + commissionVal).toFixed(4));
  }, [formData.amount_sent, commissionVal]);

  const autoCalculatedReceived = useMemo(() => {
    const sent = parseFormattedNumber(formData.amount_sent);
    return sent > 0 ? sent : 0;
  }, [formData.amount_sent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.from_account_id || !formData.to_account_id || !formData.amount_sent) {
      alert('Por favor complete las cuentas de origen y destino, y el monto enviado.');
      return;
    }

    if (formData.from_account_id === formData.to_account_id) {
      alert('La cuenta de origen y destino no pueden ser la misma.');
      return;
    }

    const sent = parseFormattedNumber(formData.amount_sent);
    const pct = feeMode === 'percent' ? (parseFloat(formData.percentage_fee) || 0) : 0;
    const comm = commissionVal;
    const received = formData.amount_received
      ? parseFormattedNumber(formData.amount_received)
      : autoCalculatedReceived;

    StorageService.addTransfer({
      date: formData.date,
      from_account_id: formData.from_account_id,
      to_account_id: formData.to_account_id,
      amount_sent: sent,
      percentage_fee: pct,
      commission: comm,
      amount_received: received,
      concept: formData.concept,
      reference: formData.reference,
    });

    setFormData({
      date: formData.date,
      from_account_id: '',
      to_account_id: '',
      amount_sent: '',
      percentage_fee: '',
      commission: '',
      amount_received: '',
      concept: 'CAMBIO DE SALDO',
      reference: '',
    });

    onDataChange();
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const matchConcept = t.concept.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRef = t.reference ? t.reference.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      return matchConcept || matchRef;
    });
  }, [transfers, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Cambio Saldos (Traspasos y Puentes)</h2>
            <p className="text-xs text-slate-500">
              Rebalanceo entre cuentas propias, arbitrajes y puente de saldo con deducción y abono inmediato
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cuenta Origen (Banco Doy) {fromAccount ? `[${fromAccount.currency}]` : ''} *
              </label>
              <select
                value={formData.from_account_id}
                onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white"
                required
              >
                <option value="">Seleccionar cuenta origen...</option>
                {groupedAccounts.map(([curr, accs]) => (
                  <optgroup key={curr} label={`Cuentas en ${curr}`}>
                    {accs.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name || acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()} {acc.currency} ({acc.responsible})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cuenta Destino (Banco Recibe) {toAccount ? `[${toAccount.currency}]` : ''} *
              </label>
              <select
                value={formData.to_account_id}
                onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white"
                required
              >
                <option value="">Seleccionar cuenta destino...</option>
                {groupedAccounts.map(([curr, accs]) => (
                  <optgroup key={curr} label={`Cuentas en ${curr}`}>
                    {accs.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name || acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()} {acc.currency} ({acc.responsible})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cantidad a Enviar {fromAccount ? `(${fromAccount.currency})` : ''} *
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={formData.amount_sent}
                onChange={(e) => setFormData({ ...formData, amount_sent: formatInputNumber(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Comisión {feeMode === 'percent' ? '(%)' : `($${fromAccount ? ' ' + fromAccount.currency : ''})`}
                </label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFeeMode('percent')}
                    className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                      feeMode === 'percent'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Calcular por porcentaje (%)"
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeMode('fixed')}
                    className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                      feeMode === 'fixed'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Ingresar monto fijo ($)"
                  >
                    $
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type={feeMode === 'percent' ? 'number' : 'text'}
                  inputMode="decimal"
                  step="any"
                  placeholder={feeMode === 'percent' ? 'ej. 0.5' : '0.00'}
                  value={feeMode === 'percent' ? formData.percentage_fee : formData.commission}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (feeMode === 'percent') {
                      setFormData({ ...formData, percentage_fee: val });
                    } else {
                      setFormData({ ...formData, commission: formatInputNumber(val) });
                    }
                  }}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono pr-12"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  {feeMode === 'percent' ? '%' : fromAccount?.currency || '$'}
                </span>
              </div>
              {commissionVal > 0 && parseFormattedNumber(formData.amount_sent) > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mt-1.5 space-y-0.5 text-[11px]">
                  <p className="text-purple-700 font-semibold">
                    Comisión: +{commissionVal.toFixed(2)} {fromAccount?.currency || ''}
                  </p>
                  <p className="text-purple-950 font-black">
                    Débito total cuenta salida: -{totalDebitedFromOrigin.toFixed(2)} {fromAccount?.currency || ''}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cantidad Efectiva Recibida {toAccount ? `(${toAccount.currency})` : ''}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={autoCalculatedReceived ? String(autoCalculatedReceived) : '0.00'}
                value={formData.amount_received}
                onChange={(e) => setFormData({ ...formData, amount_received: formatInputNumber(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto</label>
              <input
                type="text"
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Referencia</label>
              <input
                type="text"
                placeholder="Nro. Transferencia / Hash"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Ejecutar CAMBIO SALDOS</span>
            </button>
          </div>
        </form>
      </div>

      {/* Historial */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Historial de CAMBIO SALDOS</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por concepto o referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase">
              <tr>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Cuenta Origen (Doy)</th>
                <th className="py-2.5 px-3">Cuenta Destino (Recibe)</th>
                <th className="py-2.5 px-3 text-right">Monto Enviado</th>
                <th className="py-2.5 px-3 text-right">Comisión</th>
                <th className="py-2.5 px-3 text-right">Monto Recibido</th>
                <th className="py-2.5 px-3">Concepto</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-slate-100 z-10 border-l border-slate-200">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    No se han registrado operaciones de CAMBIO SALDOS todavía.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => {
                  const fromAcc = accounts.find((a) => a.id === t.from_account_id);
                  const toAcc = accounts.find((a) => a.id === t.to_account_id);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition group">
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{t.date}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-rose-600">
                        {fromAcc ? fromAcc.name : t.from_account_id}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-emerald-600">
                        {toAcc ? toAcc.name : t.to_account_id}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                        {fromAcc?.currency && (
                          <span className="text-[10px] font-bold text-rose-700 mr-1.5 px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded">
                            {fromAcc.currency}
                          </span>
                        )}
                        -{formatRegionalAmount(t.amount_sent, fromAcc?.currency || 'USD')}
                        {t.commission > 0 && (
                          <span className="block text-[10px] text-rose-500 font-sans font-normal">
                            (Debitado: -{formatRegionalAmount(t.amount_sent + t.commission, fromAcc?.currency || 'USD')})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {t.percentage_fee > 0 ? (
                          <span>
                            {t.percentage_fee}%
                            {t.commission > 0 && (
                              <span className="text-[10px] text-slate-400 block font-sans">
                                ({formatRegionalAmount(t.commission, fromAcc?.currency || 'USD')})
                              </span>
                            )}
                          </span>
                        ) : t.commission > 0 ? (
                          <span>
                            {formatRegionalAmount(t.commission, fromAcc?.currency || 'USD')}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {toAcc?.currency && (
                          <span className="text-[10px] font-bold text-emerald-700 mr-1.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                            {toAcc.currency}
                          </span>
                        )}
                        +{formatRegionalAmount(t.amount_received, toAcc?.currency || 'USD')}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-500">{t.concept}</td>
                      <td className="py-2.5 px-3 text-center font-sans sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransfer(t.id)}
                          title="Eliminar registro y revertir saldos"
                          className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg transition-all duration-150 shadow-sm border border-rose-200 hover:border-rose-600 inline-flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
