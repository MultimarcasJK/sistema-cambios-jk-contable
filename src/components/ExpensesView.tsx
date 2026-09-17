'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Account, Expense, Currency, CurrencyConfig } from '@/types';
import { StorageService } from '@/lib/storage';
import { CurrencyService } from '@/lib/currencies';
import { ManageCurrenciesModal } from '@/components/ManageCurrenciesModal';
import { parseFormattedNumber, formatCurrency, formatRegionalAmount, formatInputNumber } from '@/lib/formatters';
import { Receipt, CheckCircle, Search, ArrowUpRight, Coins, Trash2 } from 'lucide-react';

interface ExpensesProps {
  accounts: Account[];
  expenses: Expense[];
  onDataChange: () => void;
}

export function ExpensesView({ accounts, expenses, onDataChange }: ExpensesProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [systemCurrencies, setSystemCurrencies] = useState<CurrencyConfig[]>([]);
  const [isManagingCurrencies, setIsManagingCurrencies] = useState(false);

  useEffect(() => {
    setSystemCurrencies(CurrencyService.getCurrencies());
  }, []);

  const [formData, setFormData] = useState({
    date: todayStr,
    type: 'egreso' as 'egreso' | 'ingreso',
    description: '',
    amount: '',
    currency: 'USD' as Currency,
    concept: 'GASTOS',
    account_id: '',
    rate_to_usd: '1',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterCurrency, setFilterCurrency] = useState<string>('ALL');

  const handleCurrencyChange = (newCurr: Currency) => {
    let defaultRate = '1';
    if (newCurr === 'VES') defaultRate = '788';
    else if (newCurr === 'COP') defaultRate = '4150';
    else if (newCurr === 'PEN') defaultRate = '3.80';
    else if (newCurr === 'EUR') defaultRate = '1.08';
    else if (newCurr === 'CLP') defaultRate = '950';
    else if (newCurr === 'BRL') defaultRate = '5.40';
    else if (newCurr === 'MXN') defaultRate = '19.50';
    else if (newCurr === 'ARS') defaultRate = '1250';
    else if (newCurr === 'BOB') defaultRate = '6.96';
    else if (newCurr === 'UYU') defaultRate = '40.50';
    else if (newCurr === 'CRC') defaultRate = '515';
    else if (newCurr === 'GTQ') defaultRate = '7.70';
    else if (newCurr === 'HNL') defaultRate = '24.80';
    else if (newCurr === 'NIO') defaultRate = '36.80';
    else if (newCurr === 'CUP') defaultRate = '320';
    else if (newCurr === 'PYG') defaultRate = '7500';

    setFormData((prev) => ({
      ...prev,
      currency: newCurr,
      rate_to_usd: defaultRate,
    }));
  };

  const calculatedUsd = useMemo(() => {
    const amt = parseFormattedNumber(formData.amount);
    const rate = parseFloat(formData.rate_to_usd) || 1;
    if (amt <= 0) return 0;

    if (formData.currency === 'USD' || formData.currency === 'USDT') {
      return amt;
    }
    if (formData.currency === 'EUR') {
      return Number((amt * rate).toFixed(2));
    }
    return rate > 0 ? Number((amt / rate).toFixed(2)) : amt;
  }, [formData.amount, formData.rate_to_usd, formData.currency]);

  const handleDeleteExpense = (id: string) => {
    if (confirm('¿Deseas eliminar este registro de ingreso/egreso? Si afectó el saldo de una cuenta bancaria, se revertirá automáticamente.')) {
      StorageService.deleteExpense(id);
      onDataChange();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFormattedNumber(formData.amount);
    if (!formData.description || amt <= 0) {
      alert('Por favor ingrese la descripción y un monto válido.');
      return;
    }

    StorageService.addExpense({
      date: formData.date,
      type: formData.type,
      description: formData.description.trim().toUpperCase(),
      amount: amt,
      currency: formData.currency,
      concept: formData.concept,
      account_id: formData.account_id || undefined,
      amount_usd: calculatedUsd,
    });

    setFormData({
      date: formData.date,
      type: formData.type,
      description: '',
      amount: '',
      currency: 'USD',
      concept: formData.type === 'ingreso' ? 'INGRESO EXTRA' : 'GASTOS',
      account_id: '',
      rate_to_usd: '1',
    });

    onDataChange();
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch =
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.concept.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = filterDate ? e.date === filterDate : true;
      const matchCurrency = filterCurrency === 'ALL' ? true : e.currency === filterCurrency;
      return matchSearch && matchDate && matchCurrency;
    });
  }, [expenses, searchTerm, filterDate, filterCurrency]);

  const totalEgresosUsd = filteredExpenses
    .filter((e) => e.type !== 'ingreso')
    .reduce((acc, e) => acc + (e.amount_usd || 0), 0);

  const totalIngresosUsd = filteredExpenses
    .filter((e) => e.type === 'ingreso')
    .reduce((acc, e) => acc + (e.amount_usd || 0), 0);

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-3">
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                formData.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Módulo: Ingresos / Gastos</h2>
              <p className="text-xs text-slate-500">
                Registra salidas operativas o ingresos adicionales que afecten tus cuentas
              </p>
            </div>
          </div>

          {/* Toggle de Tipo y Botón de Monedas */}
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsManagingCurrencies(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Gestionar catálogo de monedas"
            >
              <Coins className="w-3.5 h-3.5 text-blue-600" />
              <span>Gestionar Monedas</span>
            </button>

            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, type: 'egreso', concept: 'GASTOS' })
                }
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  formData.type === 'egreso'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔴 Gasto / Egreso
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, type: 'ingreso', concept: 'INGRESO EXTRA' })
                }
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  formData.type === 'ingreso'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>🟢 Ingreso Extra</span>
              </button>
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Descripción *
              </label>
              <input
                type="text"
                placeholder={
                  formData.type === 'ingreso'
                    ? 'ej. COMISIÓN GANADA, APORTE CAPITAL, REEMBOLSO'
                    : 'ej. COMISIÓN IVAN, ALQUILER, SERVICIOS'
                }
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 uppercase"
                required
              />
            </div>

            {/* Selector de Moneda Dinámico con todas las opciones */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600">Moneda *</label>
                <span className="text-[10px] text-slate-400">({systemCurrencies.length} disponibles)</span>
              </div>
              <select
                value={formData.currency}
                onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
                className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {systemCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Monto *</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: formatInputNumber(e.target.value) })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold"
                required
              />
            </div>

            {/* Cuentas agrupadas inteligentemente */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {formData.type === 'ingreso' ? 'Cuenta Receptora (Suma saldo)' : 'Cuenta Pagadora (Resta saldo)'}
              </label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white cursor-pointer"
              >
                <option value="">Ninguna / Caja Externa</option>
                {accounts.filter((a) => a.currency === formData.currency).length > 0 && (
                  <optgroup label={`Cuentas en ${formData.currency} (Recomendadas)`}>
                    {accounts
                      .filter((a) => a.currency === formData.currency)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          ★ {acc.name || acc.bank_name} - Saldo: {acc.current_balance.toLocaleString()} {acc.currency}
                        </option>
                      ))}
                  </optgroup>
                )}
                {accounts.filter((a) => a.currency !== formData.currency).length > 0 && (
                  <optgroup label="Otras Cuentas">
                    {accounts
                      .filter((a) => a.currency !== formData.currency)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name || acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Tasa de cambio hacia USD */}
            {formData.currency !== 'USD' && formData.currency !== 'USDT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tasa de Cambio hacia USD *
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.rate_to_usd}
                  onChange={(e) => setFormData({ ...formData, rate_to_usd: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold bg-amber-50/50 border-amber-200"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formData.currency === 'EUR' ? 'Monto EUR × Tasa = USD' : `Monto ${formData.currency} ÷ Tasa = USD`}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto</label>
              <input
                type="text"
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 uppercase"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 block">Equivalente en Dólares ($ USD)</span>
              <span
                className={`text-xl font-black font-mono ${
                  formData.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formData.type === 'ingreso' ? '+' : '-'}${calculatedUsd.toFixed(2)} USD
              </span>
            </div>

            <button
              type="submit"
              className={`font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 text-white cursor-pointer ${
                formData.type === 'ingreso'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>{formData.type === 'ingreso' ? 'Guardar Ingreso Extra' : 'Guardar Gasto'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Historial */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Historial INGRESOS / GASTOS</h3>
            <p className="text-xs text-slate-500">
              Gastos: <span className="font-bold text-rose-600 font-mono">-${totalEgresosUsd.toFixed(2)}</span> •{' '}
              Ingresos: <span className="font-bold text-emerald-600 font-mono">+${totalIngresosUsd.toFixed(2)}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar movimiento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
              className="px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Monedas</option>
              {systemCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>

            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Limpiar Fecha
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase">
              <tr>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-3">Moneda</th>
                <th className="py-2.5 px-3 text-right">Monto Original</th>
                <th className="py-2.5 px-3 text-right">Equivalente USD</th>
                <th className="py-2.5 px-3">Cuenta Afectada</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-slate-100 z-10 border-l border-slate-200">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    No se han registrado movimientos.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const acc = accounts.find((a) => a.id === exp.account_id);
                  const isIngreso = exp.type === 'ingreso';
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50 transition group">
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{exp.date}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isIngreso ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isIngreso ? 'INGRESO' : 'EGRESO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold font-sans text-slate-800">
                        {exp.description}
                      </td>
                      <td className="py-2.5 px-3 font-bold font-sans text-slate-700">
                        <span className="text-[10px] font-bold text-indigo-700 px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
                          {exp.currency}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                          isIngreso ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold mr-1.5 px-1.5 py-0.5 rounded border ${
                            isIngreso
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200'
                          }`}
                        >
                          {exp.currency}
                        </span>
                        {isIngreso ? '+' : '-'}{formatRegionalAmount(exp.amount, exp.currency)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                          isIngreso ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        <span className={`text-[10px] font-bold mr-1 px-1.5 py-0.5 rounded border ${
                          isIngreso ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          USD
                        </span>
                        {isIngreso ? '+' : '-'}{formatCurrency(exp.amount_usd, 'USD')}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-500 truncate max-w-[140px]">
                        {acc ? `${acc.name || acc.bank_name} (${acc.currency})` : 'Caja Externa'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          title="Eliminar registro y revertir fondos"
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

      {/* Modal de Gestión de Monedas */}
      {isManagingCurrencies && (
        <ManageCurrenciesModal
          onClose={() => setIsManagingCurrencies(false)}
          onCurrenciesChange={() => {
            setSystemCurrencies(CurrencyService.getCurrencies());
          }}
        />
      )}
    </div>
  );
}
