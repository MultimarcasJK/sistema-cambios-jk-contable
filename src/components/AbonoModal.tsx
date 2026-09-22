'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Account, Client, Currency, Debtor } from '@/types';
import { CurrencyService } from '@/lib/currencies';
import { StorageService } from '@/lib/storage';
import { ArrowDownLeft, X } from 'lucide-react';

interface AbonoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: Account[];
  clients?: Client[];
  debtors?: Debtor[];
  preselectedClientName?: string;
  preselectedDebtorId?: string;
  appMode?: import('@/types').AppMode;
}

export function AbonoModal({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  clients = [],
  debtors = [],
  preselectedClientName,
  preselectedDebtorId,
  appMode,
}: AbonoModalProps) {
  const [selectedClientName, setSelectedClientName] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('USD');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAmountCurrency, setPaymentAmountCurrency] = useState('');
  const [paymentRate, setPaymentRate] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const availableCurrencies = useMemo(() => CurrencyService.getCurrencies(), []);

  // Determinar el deudor o saldo actual del cliente seleccionado
  const currentDebtor = useMemo(() => {
    if (preselectedDebtorId) {
      return debtors.find((d) => d.id === preselectedDebtorId) || null;
    }
    const nameToMatch = (selectedClientName || preselectedClientName || '').trim().toUpperCase();
    if (!nameToMatch) return null;
    return debtors.find((d) => d.client_name.trim().toUpperCase() === nameToMatch) || null;
  }, [debtors, preselectedDebtorId, selectedClientName, preselectedClientName]);

  // Lista unificada de nombres de clientes para el selector
  const allClientNames = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => set.add(c.name.trim().toUpperCase()));
    debtors.forEach((d) => set.add(d.client_name.trim().toUpperCase()));
    return Array.from(set).sort();
  }, [clients, debtors]);

  useEffect(() => {
    if (isOpen) {
      setSelectedClientName(preselectedClientName || (currentDebtor ? currentDebtor.client_name : ''));
      setPaymentCurrency('USD');
      setPaymentAmount('');
      setPaymentAmountCurrency('');
      setPaymentRate('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentAccountId('');
      setPaymentNotes('');
    }
  }, [isOpen, preselectedClientName, currentDebtor]);

  if (!isOpen) return null;

  // Sincronizar monto USD cuando cambia moneda, monto en moneda o tasa
  const handleAmountCurrencyChange = (val: string, rateVal?: string, curr?: Currency) => {
    setPaymentAmountCurrency(val);
    const activeCurr = curr || paymentCurrency;
    const rate = parseFloat(rateVal !== undefined ? rateVal : paymentRate);
    const qty = parseFloat(val);

    if (!isNaN(qty) && !isNaN(rate) && rate > 0) {
      if (activeCurr === 'EUR') {
        setPaymentAmount((qty * rate).toFixed(2));
      } else {
        setPaymentAmount((qty / rate).toFixed(2));
      }
    }
  };

  const handleRateChange = (rateVal: string) => {
    setPaymentRate(rateVal);
    const rate = parseFloat(rateVal);
    const qty = parseFloat(paymentAmountCurrency);

    if (!isNaN(qty) && !isNaN(rate) && rate > 0) {
      if (paymentCurrency === 'EUR') {
        setPaymentAmount((qty * rate).toFixed(2));
      } else {
        setPaymentAmount((qty / rate).toFixed(2));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalClientName = (selectedClientName || preselectedClientName || '').trim().toUpperCase();
    if (!finalClientName) {
      alert('Por favor selecciona o escribe el nombre del cliente');
      return;
    }

    const amountUsd = parseFloat(paymentAmount);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      alert('Por favor ingresa un monto válido de abono');
      return;
    }

    const isForeign = paymentCurrency !== 'USD' && paymentCurrency !== 'USDT';
    const amountCurr = isForeign ? parseFloat(paymentAmountCurrency) || amountUsd : amountUsd;
    const rate = isForeign ? parseFloat(paymentRate) || 1 : 1;

    StorageService.addDebtPayment({
      debtor_id: currentDebtor ? currentDebtor.id : 'deb-' + Date.now(),
      client_name: finalClientName,
      date: paymentDate,
      amount: amountUsd,
      currency: paymentCurrency,
      amount_currency: amountCurr,
      exchange_rate: rate,
      account_id: paymentAccountId || undefined,
      notes: paymentNotes.trim() || undefined,
    }, appMode);

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2 text-purple-700">
            <ArrowDownLeft className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">Registrar Abono a Deuda</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="space-y-3.5"
        >
          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Cliente *</label>
            {preselectedClientName ? (
              <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-purple-950 block">{preselectedClientName}</span>
                  <span className="text-[10px] text-purple-700">
                    {currentDebtor && currentDebtor.current_debt > 0
                      ? `Deuda actual: $${currentDebtor.current_debt.toFixed(2)} USD`
                      : 'Sin deuda registrada previamente'}
                  </span>
                </div>
                {currentDebtor && currentDebtor.current_debt > 0 && (
                  <span className="text-xs font-black font-mono text-rose-600">
                    ${currentDebtor.current_debt.toFixed(2)}
                  </span>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  list="abono-clients-list"
                  placeholder="Escribe o selecciona cliente..."
                  value={selectedClientName}
                  onChange={(e) => setSelectedClientName(e.target.value.toUpperCase())}
                  className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
                <datalist id="abono-clients-list">
                  {allClientNames.map((name) => {
                    const deb = debtors.find((d) => d.client_name.toUpperCase() === name);
                    return (
                      <option key={name} value={name}>
                        {deb && deb.current_debt > 0
                          ? `${name} (Debe: $${deb.current_debt.toFixed(2)})`
                          : deb && deb.current_debt < 0
                          ? `${name} (A favor: +$${Math.abs(deb.current_debt).toFixed(2)})`
                          : name}
                      </option>
                    );
                  })}
                </datalist>
                {currentDebtor && (
                  <p className={`text-[11px] font-semibold mt-1 ${
                    currentDebtor.current_debt > 0
                      ? 'text-rose-600'
                      : currentDebtor.current_debt < 0
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}>
                    {currentDebtor.current_debt > 0
                      ? `Deuda actual: -$${currentDebtor.current_debt.toFixed(2)} USD`
                      : currentDebtor.current_debt < 0
                      ? `Saldo a favor actual: +$${Math.abs(currentDebtor.current_debt).toFixed(2)} USD`
                      : 'Cliente al día ($0.00)'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Moneda */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Moneda con la que paga el cliente *
            </label>
            <select
              value={paymentCurrency}
              onChange={(e) => {
                const newCurr = e.target.value as Currency;
                setPaymentCurrency(newCurr);
                handleAmountCurrencyChange(paymentAmountCurrency, paymentRate, newCurr);
              }}
              className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Montos y Tasa */}
          {paymentCurrency !== 'USD' && paymentCurrency !== 'USDT' ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Monto en {paymentCurrency} *
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={paymentAmountCurrency}
                    onChange={(e) => handleAmountCurrencyChange(e.target.value)}
                    className="w-full text-sm font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tasa de Cambio *
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="ej. 4150"
                    value={paymentRate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className="w-full text-sm font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Equivalente que Descuenta de la Deuda ($ USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full text-sm font-mono font-bold text-purple-700 bg-purple-50/80 border border-purple-200 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {paymentCurrency === 'EUR'
                    ? 'Fórmula: Monto EUR × Tasa = USD'
                    : `Fórmula: Monto ${paymentCurrency} ÷ Tasa = USD`}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Monto a Abonar ($ USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl pl-7 pr-3 py-2 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha del Abono</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
              required
            />
          </div>

          {/* Cuenta Bancaria donde entra el dinero */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cuenta donde ingresó el dinero (Suma a tu saldo)
              </label>
              <select
                value={paymentAccountId}
                onChange={(e) => setPaymentAccountId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
              >
                <option value="">Caja General / Sin cuenta específica...</option>
                {accounts.filter((a) => a.currency === paymentCurrency).length > 0 && (
                  <optgroup label={`Cuentas en ${paymentCurrency} (Recomendadas)`}>
                    {accounts
                      .filter((a) => a.currency === paymentCurrency)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          ★ {acc.name || acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()}
                        </option>
                      ))}
                  </optgroup>
                )}
                {accounts.filter((a) => a.currency !== paymentCurrency).length > 0 && (
                  <optgroup label="Otras Cuentas">
                    {accounts
                      .filter((a) => a.currency !== paymentCurrency)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name || acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {/* Referencia o Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Referencia / Comprobante / Notas</label>
            <input
              type="text"
              placeholder="ej. Transferencia #827189 o referencia bancaria"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 shadow-sm transition cursor-pointer flex items-center space-x-1.5"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Confirmar Abono</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
