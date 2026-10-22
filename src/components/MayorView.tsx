'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Account, TransactionMayor, Client, AppMode, CurrencyConfig } from '@/types';
import { StorageService } from '@/lib/storage';
import { recordTime } from '@/lib/order';
import { CurrencyService } from '@/lib/currencies';
import { RatesService } from '@/lib/rates-service';
import { AbonoModal } from '@/components/AbonoModal';
import { ManageCurrenciesModal } from '@/components/ManageCurrenciesModal';
import { parseFormattedNumber, formatCurrency, formatRegionalAmount, formatRateDisplay, formatInputNumber } from '@/lib/formatters';
import { TrendingUp, Search, CheckCircle, Trash2, ArrowDownLeft, Sparkles, Globe, Coins, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { localDateStr } from '@/lib/dates';

interface MayorProps {
  accounts: Account[];
  clients: Client[];
  mayorTxs: TransactionMayor[];
  onDataChange: () => void;
  appMode?: AppMode;
  onSyncRates?: () => Promise<void>;
  isSyncingRates?: boolean;
  lastRatesSync?: string | null;
}

export function MayorView({
  accounts,
  clients,
  mayorTxs,
  onDataChange,
  appMode = 'mayor',
  onSyncRates,
  isSyncingRates,
  lastRatesSync,
}: MayorProps) {
  const { isAdmin } = useAuth();
  const todayStr = localDateStr();
  const [systemCurrencies, setSystemCurrencies] = useState<CurrencyConfig[]>(
    CurrencyService.getCurrencies()
  );
  const [isManagingCurrencies, setIsManagingCurrencies] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('VES');
  const [ratesVersion, setRatesVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRatesVersion((v) => v + 1);
    window.addEventListener('cambiosjk_rates_updated', handleUpdate);
    return () => window.removeEventListener('cambiosjk_rates_updated', handleUpdate);
  }, []);

  const officialRate = useMemo(() => RatesService.getRateInfo(selectedCurrency, appMode), [selectedCurrency, appMode, ratesVersion]);

  useEffect(() => {
    if (officialRate) {
      setFormData((prev) => {
        if (!prev.sell_price) {
          return {
            ...prev,
            buy_price: prev.buy_price || officialRate.costRate.toString(),
            sell_price: prev.sell_price || officialRate.sellRate.toString(),
          };
        }
        return prev;
      });
    }
  }, [officialRate]);

  const refreshCurrencies = () => {
    setSystemCurrencies(CurrencyService.getCurrencies());
  };

  const [formData, setFormData] = useState({
    date: todayStr,
    client_name: '',
    client_id: '',
    amount_ves: '',
    buy_price: '',
    sell_price: '',
    received_account_id: 'POR_COBRAR',
    amount_received: '',
    paid_account_id: '',
    commission: '0',
    client_fee: '',
    is_vip: false,
    reference: '',
    notes: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [feeMode, setFeeMode] = useState<'fixed' | 'percent'>('fixed');
  const [feePercent, setFeePercent] = useState<string>('');

  const handleClientSelect = (name: string) => {
    const matched = clients.find((c) => c.name.toUpperCase() === name.toUpperCase());
    if (matched) {
      setFormData((prev) => ({
        ...prev,
        client_name: matched.name,
        client_id: matched.id,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        client_name: name,
        client_id: '',
      }));
    }
  };

  const totalCurrencyAvailable = useMemo(() => {
    return accounts
      .filter((a) => a.currency === selectedCurrency)
      .reduce((sum, a) => sum + a.current_balance, 0);
  }, [accounts, selectedCurrency]);

  const calculations = useMemo(() => {
    const ves = parseFormattedNumber(formData.amount_ves);
    const buy = parseFormattedNumber(formData.buy_price);
    const sell = parseFormattedNumber(formData.sell_price);

    if (ves <= 0 || sell <= 0) {
      return { totalToPay: 0, effectiveFee: 0, clientFee: 0, profitUsd: 0 };
    }

    let totalToPay = 0;
    let costUsd = 0;

    const isUsdtOrDollar =
      selectedCurrency === 'USDT' ||
      selectedCurrency === 'USD' ||
      RatesService.isCajaDolar({ codigo: selectedCurrency, pais: selectedCurrency });

    if (isUsdtOrDollar) {
      // Para USDT / Cripto / Caja Dólar: la tasa es el valor de cambio sobre $1 USD (ej: 0.995)
      // Total a cobrar ($ USD) = Cantidad USDT / Tasa Venta
      // Costo de compra ($ USD) = Cantidad USDT / Tasa Compra
      totalToPay = ves / sell;
      costUsd = buy > 0 ? ves / buy : totalToPay;
    } else if (selectedCurrency === 'EUR') {
      // Para Euro (divisa base mayor al dólar): 1 EUR = X USD (ej. 100 EUR * 1.14 = 114 USD)
      totalToPay = ves * sell;
      costUsd = buy > 0 ? ves * buy : totalToPay;
    } else {
      // Para monedas locales (VES, COP, CLP, ARS, PEN, BRL, etc.):
      // La tasa indica cuántas unidades locales equivalen a 1 USD, por tanto se DIVIDE
      totalToPay = ves / sell;
      costUsd = buy > 0 ? ves / buy : totalToPay;
    }

    const pct = parseFloat(feePercent) || 0;
    const effectiveFee = feeMode === 'percent'
      ? (totalToPay > 0 ? (totalToPay * pct) / 100 : 0)
      : (parseFormattedNumber(formData.commission) || 0);

    // Comisión al cliente (ej. $1 en tasa VIP): se suma a lo que debe pagar y a la ganancia
    const clientFee = parseFormattedNumber(formData.client_fee) || 0;

    const profitRaw = totalToPay - costUsd - effectiveFee + clientFee;
    const profitUsd = Number(profitRaw.toFixed(4));

    return {
      totalToPay: Number((totalToPay + clientFee).toFixed(2)),
      effectiveFee: Number(effectiveFee.toFixed(4)),
      clientFee,
      profitUsd: Math.abs(profitUsd) > 0 ? profitUsd : 0,
    };
  }, [formData.amount_ves, formData.buy_price, formData.sell_price, formData.commission, formData.client_fee, feeMode, feePercent, selectedCurrency]);

  const handleSetFullPayment = () => {
    if (formData.received_account_id === 'POR_COBRAR') {
      const firstAcc = accounts.find((a) => a.currency === 'USD') || accounts[0];
      setFormData((prev) => ({
        ...prev,
        received_account_id: firstAcc ? firstAcc.id : '',
        amount_received: formatCurrency(calculations.totalToPay),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        amount_received: formatCurrency(calculations.totalToPay),
      }));
    }
  };

  const handleApplyOfficialRate = () => {
    if (officialRate) {
      setFormData((prev) => ({
        ...prev,
        buy_price: officialRate.costRate.toString(),
        sell_price: officialRate.sellRate.toString(),
      }));
    }
  };

  const handleDeleteTx = async (id: string) => {
    if (confirm('¿Deseas eliminar esta transacción de venta? Si generó deuda o movió saldos, se revertirá automáticamente.')) {
      await StorageService.deleteTransactionMayor(id, appMode);
      onDataChange();
    }
  };

  const handleToggleVip = () => {
    setFormData((prev) => {
      const turningOn = !prev.is_vip;
      const fee = parseFormattedNumber(prev.client_fee) || 0;
      return {
        ...prev,
        is_vip: turningOn,
        client_fee: turningOn ? (fee > 0 ? prev.client_fee : '1') : (fee === 1 ? '' : prev.client_fee),
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ves = parseFormattedNumber(formData.amount_ves);
    const buy = parseFormattedNumber(formData.buy_price);
    const sell = parseFormattedNumber(formData.sell_price);

    if (!formData.client_name || ves <= 0 || sell <= 0) {
      alert('Complete los campos obligatorios: Cliente, Cantidad válida y Tasa de Venta');
      return;
    }

    const comm = calculations.effectiveFee;
    const total = calculations.totalToPay;

    const isPorCobrar = formData.received_account_id === 'POR_COBRAR' || !formData.received_account_id;
    const received = isPorCobrar ? 0 : parseFormattedNumber(formData.amount_received);

    const paymentStatus: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' =
      received >= total && total > 0 ? 'PAGADO' : received > 0 ? 'PARCIAL' : 'PENDIENTE';

    const clientExists = clients.some(
      (c) => c.name.toUpperCase() === formData.client_name.trim().toUpperCase()
    );
    if (!clientExists) {
      StorageService.addClient({
        name: formData.client_name.trim().toUpperCase(),
      }, appMode);
    }

    StorageService.addTransactionMayor({
      date: formData.date,
      client_name: formData.client_name.trim().toUpperCase(),
      client_id: formData.client_id || undefined,
      currency: selectedCurrency || 'VES',
      amount_ves: ves,
      buy_price: buy,
      sell_price: sell,
      total_to_pay: total,
      received_account_id: isPorCobrar ? 'POR_COBRAR' : formData.received_account_id,
      amount_received: received,
      payment_status: paymentStatus,
      paid_account_id: formData.paid_account_id || undefined,
      commission: comm,
      fee_percent: feeMode === 'percent' ? (parseFloat(feePercent) || undefined) : undefined,
      client_fee: calculations.clientFee > 0 ? calculations.clientFee : undefined,
      is_vip: formData.is_vip || undefined,
      profit_usd: calculations.profitUsd,
      reference: formData.reference,
      notes: formData.notes,
    }, appMode);

    setFormData((prev) => ({
      date: prev.date,
      client_name: '',
      client_id: '',
      amount_ves: '',
      buy_price: prev.buy_price,
      sell_price: prev.sell_price,
      received_account_id: 'POR_COBRAR',
      amount_received: '',
      paid_account_id: prev.paid_account_id,
      commission: '0',
      client_fee: '',
      is_vip: false,
      reference: '',
      notes: '',
    }));
    setFeePercent('');

    onDataChange();
  };

  const allPayments = useMemo(() => {
    const all = StorageService.getDebtPayments(appMode);
    return all.filter((p) => {
      const notes = (p.notes || '').toUpperCase();
      if (notes.includes('[CRIPTO]')) return false;
      return true;
    });
  }, [mayorTxs, appMode, ratesVersion]);

  type MayorRowItem =
    | { type: 'tx'; data: TransactionMayor; date: string; timestamp: number }
    | { type: 'abono'; data: import('@/types').DebtPayment; date: string; timestamp: number };

  const combinedMayorItems = useMemo(() => {
    const list: MayorRowItem[] = [
      ...mayorTxs.map((tx) => ({
        type: 'tx' as const,
        data: tx,
        date: tx.date,
        timestamp: recordTime(tx),
      })),
      ...allPayments.map((pay) => ({
        type: 'abono' as const,
        data: pay,
        date: pay.date,
        timestamp: recordTime(pay),
      })),
    ];

    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.timestamp - a.timestamp;
    });

    return list.filter((item) => {
      const search = searchTerm.toLowerCase();
      const name = item.data.client_name.toLowerCase();
      const matchSearch =
        name.includes(search) ||
        ('reference' in item.data && item.data.reference?.toLowerCase().includes(search)) ||
        ('notes' in item.data && item.data.notes?.toLowerCase().includes(search));
      const matchDate = filterDate ? item.date === filterDate : true;
      return matchSearch && matchDate;
    });
  }, [mayorTxs, allPayments, searchTerm, filterDate]);

  const filteredTxs = useMemo(() => {
    return mayorTxs.filter((tx) => {
      const matchSearch =
        tx.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.reference && tx.reference.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchDate = filterDate ? tx.date === filterDate : true;
      return matchSearch && matchDate;
    });
  }, [mayorTxs, searchTerm, filterDate]);

  const totalVolumeVes = useMemo(() => {
    return filteredTxs.reduce((sum, tx) => sum + tx.amount_ves, 0);
  }, [filteredTxs]);

  const totalProfitFiltered = useMemo(() => {
    return filteredTxs.reduce((sum, tx) => sum + tx.profit_usd, 0);
  }, [filteredTxs]);

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Registrar Venta (Multimoneda)</h2>
              <p className="text-xs text-slate-500">
                Disponibilidad en cuentas ({selectedCurrency}): <strong className="font-mono text-slate-800">{totalCurrencyAvailable.toLocaleString()} {selectedCurrency}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAbonoModalOpen(true)}
            className="flex items-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>↙ Registrar Abono / Saldo a Favor</span>
          </button>
        </div>

        {/* Banner Tasa Oficial Cambios JK con Selector de Moneda (Catálogo Completo) */}
        {(() => {
          const isDark = appMode === 'mayor';
          return (
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl text-xs shadow-sm ${
              isDark
                ? 'bg-slate-800/90 border border-slate-700 text-white'
                : 'bg-emerald-50/80 border border-emerald-300 text-slate-900'
            }`}>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex items-center space-x-1.5 font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                  <Globe className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span>Moneda:</span>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => {
                      const newCurr = e.target.value;
                      setSelectedCurrency(newCurr);
                      const rateInfo = RatesService.getRateInfo(newCurr, appMode);
                      if (rateInfo) {
                        setFormData((prev) => ({
                          ...prev,
                          buy_price: rateInfo.costRate.toString(),
                          sell_price: rateInfo.sellRate.toString(),
                        }));
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs outline-hidden cursor-pointer font-bold ${
                      isDark
                        ? 'bg-slate-900 border border-slate-700 text-emerald-400'
                        : 'bg-white border border-emerald-300 text-emerald-800 shadow-2xs'
                    }`}
                  >
                    {systemCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsManagingCurrencies(true)}
                    className={`flex items-center space-x-1 font-medium px-2 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                      isDark
                        ? 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600'
                        : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 shadow-2xs'
                    }`}
                    title="Administrar catálogo de monedas"
                  >
                    <Coins className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span>Monedas</span>
                  </button>
                </div>

                {officialRate && (
                  <div className={`flex flex-wrap items-center gap-2 ${isDark ? 'text-slate-200' : 'text-black'}`}>
                    <div>
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                        App JK ({isDark ? 'MAYOR' : 'DETAL'}):
                      </span>{' '}
                      Venta: <strong className={`font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{officialRate.sellRate}</strong> | 
                      Costo: <strong className={`font-mono font-bold ${isDark ? 'text-slate-200' : 'text-black'}`}>{officialRate.costRate}</strong>{' '}
                      {officialRate.provider && (
                        <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>({officialRate.provider})</span>
                      )}
                    </div>
                    {lastRatesSync && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isDark ? 'bg-slate-900 text-emerald-400 border border-slate-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        ● En vivo {new Date(lastRatesSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
                {onSyncRates && (
                  <button
                    type="button"
                    onClick={onSyncRates}
                    disabled={isSyncingRates}
                    className={`flex items-center space-x-1 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] transition cursor-pointer shadow-2xs ${
                      isDark
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white border border-slate-600'
                        : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200'
                    }`}
                    title="Sincronizar tasas frescas desde Google Sheets / App"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRates ? 'animate-spin text-emerald-400' : isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                    <span>{isSyncingRates ? 'Sincronizando...' : 'Actualizar Ahora'}</span>
                  </button>
                )}
                {officialRate && (
                  <button
                    type="button"
                    onClick={handleApplyOfficialRate}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer text-xs shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Aplicar Tasa ({officialRate.sellRate})</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}

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
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">Fecha</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">Cliente *</label>
              <input
                type="text"
                list="clients-list-mayor"
                placeholder="Escribe o selecciona cliente..."
                value={formData.client_name}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 uppercase"
                required
              />
              <datalist id="clients-list-mayor">
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.identification ? `${c.name} (${c.identification})` : c.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">
                Cantidad MONEDA ({selectedCurrency}) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={formData.amount_ves}
                onChange={(e) => setFormData({ ...formData, amount_ves: formatInputNumber(e.target.value) })}
                className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">Tasa de Venta *</label>
              <input
                type="number"
                step="any"
                placeholder="ej. 920.00"
                value={formData.sell_price}
                onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">Tasa de Compra (Costo)</label>
              <input
                type="number"
                step="any"
                placeholder="ej. 940.00"
                value={formData.buy_price}
                onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">
                Pagado Por (Cuenta Salida {selectedCurrency})
              </label>
              <select
                value={formData.paid_account_id}
                onChange={(e) => setFormData({ ...formData, paid_account_id: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
              >
                <option value="">Seleccionar cuenta salida...</option>
                {accounts.filter((a) => a.currency === selectedCurrency).length > 0 && (
                  <optgroup label={`Cuentas en ${selectedCurrency} (Recomendadas)`}>
                    {accounts
                      .filter((a) => a.currency === selectedCurrency)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          ★ {acc.name || acc.bank_name} (Saldo: {acc.current_balance.toLocaleString()} {acc.currency})
                        </option>
                      ))}
                  </optgroup>
                )}
                {accounts.filter((a) => a.currency !== selectedCurrency).length > 0 && (
                  <optgroup label="Otras Cuentas">
                    {accounts
                      .filter((a) => a.currency !== selectedCurrency)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name || acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">
                Recibido Por (Cuenta de Cobro)
              </label>
              <select
                value={formData.received_account_id}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    received_account_id: val,
                    amount_received: val === 'POR_COBRAR' ? '0' : prev.amount_received,
                  }));
                }}
                className={`w-full text-xs font-bold border rounded-xl px-3 py-2 bg-white ${
                  formData.received_account_id === 'POR_COBRAR'
                    ? 'text-rose-700 border-rose-300 bg-rose-50/50'
                    : 'border-slate-300'
                }`}
              >
                <option value="POR_COBRAR">🔴 POR COBRAR (Pendiente / Crédito)</option>
                <optgroup label="Cuentas Bancarias">
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.bank_name} ({acc.currency})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between h-6 mb-1 gap-2 whitespace-nowrap">
                <label className="block min-w-0 truncate text-xs font-semibold text-slate-600">
                  Cantidad Abonada ($ USD)
                </label>
                {formData.received_account_id !== 'POR_COBRAR' && calculations.totalToPay > 0 && (
                  <button
                    type="button"
                    onClick={handleSetFullPayment}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    100% Cobrado
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00 (Dejar en 0 si está por cobrar)"
                disabled={formData.received_account_id === 'POR_COBRAR'}
                value={formData.received_account_id === 'POR_COBRAR' ? '0' : formData.amount_received}
                onChange={(e) => setFormData({ ...formData, amount_received: formatInputNumber(e.target.value) })}
                className={`w-full text-xs font-mono font-bold border rounded-xl px-3 py-2 ${
                  formData.received_account_id === 'POR_COBRAR'
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'border-slate-300'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between h-6 mb-1 gap-2 whitespace-nowrap">
                <label className="block min-w-0 truncate text-xs font-semibold text-slate-600">
                  Comisión / Intermediario {feeMode === 'fixed' ? '($)' : '(%)'}
                </label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFeeMode('fixed')}
                    className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                      feeMode === 'fixed'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Monto fijo en USD ($)"
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeMode('percent')}
                    className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                      feeMode === 'percent'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Porcentaje (%)"
                  >
                    %
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder={feeMode === 'fixed' ? '0.00' : 'ej. 1.0'}
                  value={feeMode === 'fixed' ? formData.commission : feePercent}
                  onChange={(e) => {
                    if (feeMode === 'fixed') {
                      setFormData({ ...formData, commission: e.target.value });
                    } else {
                      setFeePercent(e.target.value);
                    }
                  }}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-mono pr-8"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                  {feeMode === 'fixed' ? '$' : '%'}
                </span>
              </div>
              {calculations.effectiveFee > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-1.5 space-y-0.5 text-[11px]">
                  <p className="text-blue-700 font-semibold">
                    Comisión: {feeMode === 'percent' ? `${feePercent}% (-$${calculations.effectiveFee.toFixed(2)} USD)` : `-$${calculations.effectiveFee.toFixed(2)} USD`} (descontado de ganancia)
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between h-6 mb-1 gap-2 whitespace-nowrap">
                <label className="block min-w-0 truncate text-xs font-semibold text-slate-600">
                  Comisión al Cliente ($)
                </label>
                <button
                  type="button"
                  onClick={handleToggleVip}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${
                    formData.is_vip
                      ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                  title="Venta con tasa VIP: cobra $1 de comisión al cliente (puedes cambiar el monto)"
                >
                  {formData.is_vip ? '★ VIP' : '☆ VIP'}
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formData.client_fee}
                  onChange={(e) => setFormData({ ...formData, client_fee: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-mono pr-8"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">$</span>
              </div>
              {calculations.clientFee > 0 && (
                <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
                  +${calculations.clientFee.toFixed(2)} USD sumado a lo que debe pagar y a la ganancia
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">Referencia</label>
              <input
                type="text"
                placeholder="ej. Transferencia # o código"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="flex items-center h-6 text-xs font-semibold text-slate-600 mb-1 whitespace-nowrap">Notas / Observaciones</label>
              <input
                type="text"
                placeholder="Condiciones, acuerdo..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-6">
              <div>
                <span className="text-xs text-slate-500 block">DEBE PAGAR (Valor Divisas)</span>
                <span className="text-xl font-bold font-mono text-slate-900">
                  ${calculations.totalToPay.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Estado de Cobro</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                    formData.received_account_id === 'POR_COBRAR' || (!formData.amount_received && formData.amount_received !== '0') || parseFloat(formData.amount_received) === 0
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : parseFloat(formData.amount_received) >= calculations.totalToPay
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}
                >
                  {formData.received_account_id === 'POR_COBRAR' || (!formData.amount_received && formData.amount_received !== '0') || parseFloat(formData.amount_received) === 0
                    ? '🔴 Por Cobrar (Genera Deuda)'
                    : parseFloat(formData.amount_received) >= calculations.totalToPay
                    ? '🟢 Cobrado al 100%'
                    : `🟡 Cobro Parcial ($${formData.amount_received})`}
                </span>
              </div>
              {isAdmin && (
                <div>
                  <span className="text-xs text-slate-500 block">Ganancia Neta</span>
                  <span
                    className={`text-lg font-black font-mono ${
                      calculations.profitUsd >= 0 ? 'text-indigo-600' : 'text-rose-600'
                    }`}
                  >
                    {calculations.profitUsd >= 0 ? '+' : '-'}${formatCurrency(Math.abs(calculations.profitUsd))} USD
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 ml-auto cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>GUARDAR VENTA</span>
            </button>
          </div>
        </form>
      </div>

      {/* Historial */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Historial de Ventas</h3>
            <p className="text-xs text-slate-500">
              {filteredTxs.length} transacciones • Volumen: Bs.{' '}
              {totalVolumeVes.toLocaleString('es-VE')}
              {isAdmin && ` • Ganancia Total: $${totalProfitFiltered.toFixed(2)}`}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente..."
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
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-600 min-w-[1250px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Cliente</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Cantidad MONEDA</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Comisión</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Tasa Venta</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Tasa Compra</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Debe Pagar ($)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Abonado / Cobrado</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Estado</th>
                {isAdmin && <th className="py-2.5 px-3 text-right whitespace-nowrap">Ganancia ($)</th>}
                <th className="py-2.5 px-3 whitespace-nowrap">Cuenta Salida</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Recibido Por</th>
                {isAdmin && (
                  <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-slate-100 z-10 border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    Acción
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {combinedMayorItems.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 13 : 11} className="py-8 text-center text-slate-400 font-sans">
                    No se han registrado operaciones ni abonos aún.
                  </td>
                </tr>
              ) : (
                combinedMayorItems.map((item) => {
                  if (item.type === 'tx') {
                    const tx = item.data;
                    const paidAcc = accounts.find((a) => a.id === tx.paid_account_id);
                    const recvAcc = accounts.find((a) => a.id === tx.received_account_id);
                    const isPaid = tx.payment_status === 'PAGADO';
                    const isPartial = tx.payment_status === 'PARCIAL';
                    const isPorCobrar = tx.received_account_id === 'POR_COBRAR' || tx.payment_status === 'PENDIENTE' || (!isPaid && !isPartial);
                    const amountAbonado = isPaid ? tx.total_to_pay : (tx.amount_received || 0);
                    const txCurrency = tx.currency || (tx.sell_price > 0 && tx.sell_price <= 1.5 ? 'EUR' : 'VES');

                    return (
                      <tr key={tx.id} className="group hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-slate-500 font-sans">{tx.date}</td>
                        <td className="py-2.5 px-3 font-semibold font-sans text-slate-800">
                          {tx.client_name}
                          {tx.is_vip && (
                            <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              ★ VIP
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          <span className="text-[10px] font-bold text-indigo-700 mr-1.5 px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
                            {txCurrency}
                          </span>
                          {formatRegionalAmount(tx.amount_ves)}
                          {tx.commission > 0 && paidAcc?.currency === 'USD' && (
                            <span className="block text-[10px] text-rose-500 font-sans font-normal">
                              (Debitado: -{formatRegionalAmount(tx.amount_ves + tx.commission)})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 font-sans whitespace-nowrap">
                          {(tx.client_fee || 0) > 0 && (
                            <span className="block text-[10px] font-bold text-emerald-700" title="Comisión cobrada al cliente">
                              +${formatCurrency(tx.client_fee || 0)} cliente
                            </span>
                          )}
                          {tx.commission > 0 ? (
                            <span>
                              {tx.fee_percent ? (
                                <span className="font-bold text-purple-700 mr-1">{tx.fee_percent}%</span>
                              ) : null}
                              <span className="font-mono text-slate-700 font-bold">
                                (${formatCurrency(tx.commission)})
                              </span>
                            </span>
                          ) : (tx.client_fee || 0) > 0 ? null : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 font-mono">{formatRateDisplay(tx.sell_price)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500 font-mono">{tx.buy_price ? formatRateDisplay(tx.buy_price) : '-'}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          ${formatCurrency(tx.total_to_pay)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                          ${formatCurrency(amountAbonado)}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {isPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Pagado
                            </span>
                          ) : isPartial ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                              Parcial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                              Por Cobrar
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td
                            className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                              tx.profit_usd >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {tx.profit_usd >= 0
                              ? `+$${formatCurrency(tx.profit_usd)}`
                              : `-$${formatCurrency(Math.abs(tx.profit_usd))}`}
                            {tx.commission > 0 && (
                              <span className="block text-[10px] text-slate-400 font-sans font-normal">
                                (Comisión: -${formatCurrency(tx.commission)})
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 font-sans text-slate-500 whitespace-nowrap">
                          {paidAcc ? paidAcc.name || paidAcc.bank_name : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500 whitespace-nowrap">
                          {isPorCobrar ? (
                            <span className="text-rose-600 font-semibold text-[11px]">Por Cobrar</span>
                          ) : recvAcc ? (
                            recvAcc.name || recvAcc.bank_name
                          ) : (
                            '-'
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-center font-sans sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                            <button
                              onClick={() => handleDeleteTx(tx.id)}
                              title="Eliminar operación"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  }

                  // Fila de Abono / Saldo a Favor
                  const pay = item.data;
                  const recvAcc = accounts.find((a) => a.id === pay.account_id);
                  const isForeign = pay.currency && pay.currency !== 'USD' && pay.currency !== 'USDT';

                  return (
                    <tr key={`abono-${pay.id}`} className="group hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{pay.date}</td>
                      <td className="py-2.5 px-3 font-semibold font-sans text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span>{pay.client_name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Abono
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-600 mr-1.5 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded">
                          {pay.currency || 'USD'}
                        </span>
                        {formatCurrency(pay.amount_currency || pay.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-sans">-</td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">-</td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">-</td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">-</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        +${formatCurrency(pay.amount)}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center space-x-1">
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>Abono Recibido</span>
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                          $0.00
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-slate-400 font-sans">-</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 truncate max-w-[140px]">
                        {recvAcc ? recvAcc.name || recvAcc.bank_name : pay.account_id || 'Caja / Banco'}
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-center font-sans sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          <button
                            onClick={async () => {
                              if (confirm(`¿Eliminar este registro de abono de ${pay.client_name}?`)) {
                                await StorageService.deleteDebtPayment(pay.id, appMode);
                                onDataChange();
                              }
                            }}
                            title="Eliminar abono"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition cursor-pointer inline-flex items-center justify-center shadow-2xs"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Abono Independiente */}
      <AbonoModal
        isOpen={isAbonoModalOpen}
        onClose={() => setIsAbonoModalOpen(false)}
        onSuccess={onDataChange}
        accounts={accounts}
        clients={clients}
        debtors={StorageService.getDebtors(appMode)}
        appMode={appMode}
        sourceModule="regionales"
      />

      {/* Modal de Gestión de Monedas */}
      {isManagingCurrencies && (
        <ManageCurrenciesModal
          onClose={() => setIsManagingCurrencies(false)}
          onCurrenciesChange={refreshCurrencies}
        />
      )}
    </div>
  );
}
