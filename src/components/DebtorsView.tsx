'use client';

import React, { useState, useMemo } from 'react';
import { Debtor, DebtPayment, Account, Currency, Client, TransactionDetal, TransactionMayor } from '@/types';
import { StorageService } from '@/lib/storage';
import { CurrencyService } from '@/lib/currencies';
import { ShareVoucherModal, VoucherData } from './ShareVoucherModal';
import { ClientHistoryModal } from './ClientHistoryModal';
import { parseFormattedNumber, formatCurrency, formatRegionalAmount, formatInputNumber } from '@/lib/formatters';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  ArrowDownLeft,
  Phone,
  Share2,
  Calendar,
  Wallet,
  Receipt,
  Coins,
  FileText,
  Trash2,
} from 'lucide-react';

interface DebtorsProps {
  debtors: Debtor[];
  accounts?: Account[];
  clients?: Client[];
  detalTxs?: TransactionDetal[];
  mayorTxs?: TransactionMayor[];
  onDataChange: () => void;
  appMode?: import('@/types').AppMode;
}

export function DebtorsView({
  debtors,
  accounts = [],
  clients,
  detalTxs,
  mayorTxs,
  onDataChange,
  appMode,
}: DebtorsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [paymentModalDebtor, setPaymentModalDebtor] = useState<Debtor | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('USD');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAmountCurrency, setPaymentAmountCurrency] = useState('');
  const [paymentRate, setPaymentRate] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'debtors' | 'payments'>('debtors');

  const availableCurrencies = useMemo(() => CurrencyService.getCurrencies(), []);

  const allPayments = useMemo(() => {
    return StorageService.getDebtPayments(appMode);
  }, [debtors, appMode]);

  // Formulario nuevo deudor
  const [newDebtor, setNewDebtor] = useState({
    client_name: '',
    current_debt: '',
    phone: '',
    notes: '',
  });

  const totalDebt = useMemo(() => {
    return debtors.filter((d) => (d.current_debt || 0) > 0).reduce((sum, d) => sum + d.current_debt, 0);
  }, [debtors]);

  const totalCredit = useMemo(() => {
    return debtors.filter((d) => (d.current_debt || 0) < 0).reduce((sum, d) => sum + Math.abs(d.current_debt), 0);
  }, [debtors]);

  const filteredDebtors = useMemo(() => {
    return debtors.filter((d) =>
      d.client_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [debtors, searchTerm]);

  const handleAddDebtor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebtor.client_name) {
      alert('Por favor ingrese el nombre del cliente');
      return;
    }

    StorageService.addDebtor({
      client_name: newDebtor.client_name.trim().toUpperCase(),
      current_debt: parseFloat(newDebtor.current_debt) || 0,
      phone: newDebtor.phone.trim() || undefined,
      notes: newDebtor.notes.trim() || undefined,
    }, appMode);

    setIsAdding(false);
    setNewDebtor({ client_name: '', current_debt: '', phone: '', notes: '' });
    onDataChange();
  };

  const openPaymentModal = (debtor: Debtor) => {
    setPaymentModalDebtor(debtor);
    setPaymentCurrency('USD');
    setPaymentAmount('');
    setPaymentAmountCurrency('');
    setPaymentRate('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentAccountId('');
    setPaymentNotes('');
  };

  const handleDeletePayment = async (id: string) => {
    if (confirm('¿Deseas eliminar este registro de abono? Se revertirá el saldo de la cuenta receptora y se volverá a sumar la deuda al cliente.')) {
      await StorageService.deleteDebtPayment(id, appMode);
      onDataChange();
    }
  };

  const handleDeleteDebtor = async (debtor: Debtor) => {
    if (confirm(`¿Estás seguro de eliminar al deudor "${debtor.client_name}"?`)) {
      await StorageService.deleteDebtor(debtor.id, appMode);
      onDataChange();
    }
  };

  // Sincronizar monto USD cuando cambia moneda, monto en moneda o tasa
  const handleAmountCurrencyChange = (val: string, rateVal?: string, curr?: Currency) => {
    setPaymentAmountCurrency(val);
    const activeCurr = curr || paymentCurrency;
    const rate = parseFloat(rateVal !== undefined ? rateVal : paymentRate);
    const qty = parseFormattedNumber(val);

    if (qty > 0 && !isNaN(rate) && rate > 0) {
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
    const qty = parseFormattedNumber(paymentAmountCurrency);

    if (qty > 0 && !isNaN(rate) && rate > 0) {
      if (paymentCurrency === 'EUR') {
        setPaymentAmount((qty * rate).toFixed(2));
      } else {
        setPaymentAmount((qty / rate).toFixed(2));
      }
    }
  };

  const handleApplyPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebtor) return;
    const amountUsd = parseFormattedNumber(paymentAmount);
    if (amountUsd <= 0) {
      alert('Ingrese un monto válido de abono');
      return;
    }

    const isForeign = paymentCurrency !== 'USD' && paymentCurrency !== 'USDT';
    const amountCurr = isForeign ? (parseFormattedNumber(paymentAmountCurrency) || amountUsd) : amountUsd;
    const rate = isForeign ? (parseFloat(paymentRate) || 1) : 1;

    StorageService.addDebtPayment({
      debtor_id: paymentModalDebtor.id,
      client_name: paymentModalDebtor.client_name,
      date: paymentDate,
      amount: amountUsd,
      currency: paymentCurrency,
      amount_currency: amountCurr,
      exchange_rate: rate,
      account_id: paymentAccountId || undefined,
      notes: paymentNotes.trim() || undefined,
    }, appMode);

    setPaymentModalDebtor(null);
    setPaymentAmount('');
    setPaymentAmountCurrency('');
    setPaymentRate('');
    setPaymentNotes('');
    setPaymentAccountId('');
    onDataChange();
  };

  const handleOpenVoucher = (debtor: Debtor) => {
    // Buscar el último abono registrado para este deudor
    const debtorPayments = allPayments.filter((p) => p.debtor_id === debtor.id || p.client_name.toUpperCase() === debtor.client_name.toUpperCase());
    const lastPayment = debtorPayments.length > 0 ? debtorPayments[0] : undefined;

    setVoucherData({
      clientName: debtor.client_name,
      phone: debtor.phone,
      currentDebt: debtor.current_debt,
      lastPaymentDate: lastPayment?.date,
      lastPaymentAmount: lastPayment?.amount,
      notes: debtor.notes,
    });
  };

  return (
    <div className="space-y-6">
      {/* Resumen Superior */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="text-xs uppercase font-semibold text-blue-200 tracking-wider">
              Total Cuentas por Cobrar (Deudores)
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-1 text-rose-300">
              ${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
            </div>
            <p className="text-xs text-blue-200">
              {debtors.filter((d) => d.current_debt > 0).length} clientes deben al negocio
            </p>
          </div>

          <div className="border-l border-blue-500/40 pl-6">
            <span className="text-xs uppercase font-semibold text-emerald-200 tracking-wider">
              Total Saldos a Favor (Abonos)
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-1 text-emerald-300">
              +${totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
            </div>
            <p className="text-xs text-emerald-200">
              {debtors.filter((d) => d.current_debt < 0).length} clientes con saldo a su favor
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Cliente / Deuda</span>
        </button>
      </div>

      {/* Formulario Nuevo Deudor */}
      {isAdding && (
        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Registrar Cuenta por Cobrar</h3>
          <form onSubmit={handleAddDebtor} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cliente *</label>
              <input
                type="text"
                placeholder="Nombre completo"
                value={newDebtor.client_name}
                onChange={(e) => setNewDebtor({ ...newDebtor, client_name: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Monto Deuda ($)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={newDebtor.current_debt}
                onChange={(e) => setNewDebtor({ ...newDebtor, current_debt: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
              <input
                type="text"
                placeholder="ej. +593 99 999 9999"
                value={newDebtor.phone}
                onChange={(e) => setNewDebtor({ ...newDebtor, phone: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                Guardar Deudor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pestañas de Vista */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('debtors')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'debtors'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Cuentas por Cobrar ({debtors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'payments'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Historial de Abonos ({allPayments.length})</span>
        </button>
      </div>

      {activeTab === 'debtors' ? (
        /* Lista de Deudores */
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">Listado de Clientes y Deudas</h3>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3">
            {filteredDebtors.map((d) => (
              <div
                key={d.id}
                className="p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition flex flex-col justify-between bg-white shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <h4
                        onClick={() => setSelectedClientForHistory(d.client_name)}
                        className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug hover:text-blue-600 cursor-pointer flex items-center space-x-1 truncate"
                        title="Clic para ver extracto de este cliente"
                      >
                        <span className="truncate">{d.client_name}</span>
                        <FileText className="w-3 h-3 text-blue-500 opacity-80 shrink-0" />
                      </h4>
                      {d.phone && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1 truncate">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{d.phone}</span>
                        </p>
                      )}
                    </div>
                    <span
                      className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg shrink-0 ${
                        d.current_debt > 0
                          ? 'text-rose-700 bg-rose-50 border border-rose-200'
                          : d.current_debt === 0
                          ? 'text-slate-600 bg-slate-50 border border-slate-200'
                          : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                      }`}
                    >
                      {d.current_debt > 0
                        ? `-$${formatCurrency(d.current_debt)} (Debe)`
                        : d.current_debt === 0
                        ? '$0.00 (Al día)'
                        : `+$${formatCurrency(Math.abs(d.current_debt))} (A favor)`}
                    </span>
                  </div>

                  {d.notes && (
                    <div className="mt-2 p-1.5 rounded-lg contact-payment-box flex items-start space-x-1.5 text-[10px]" title={d.notes}>
                      <Wallet className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span className="font-semibold break-words leading-tight truncate">{d.notes}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1">
                  <button
                    onClick={() => setSelectedClientForHistory(d.client_name)}
                    className="px-2 py-1 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-semibold flex items-center space-x-1 transition cursor-pointer"
                    title="Ver extracto"
                  >
                    <FileText className="w-3 h-3 text-blue-600" />
                    <span>Historial</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenVoucher(d)}
                      className="px-1.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold flex items-center space-x-1 transition cursor-pointer"
                      title="Compartir por WhatsApp"
                    >
                      <Share2 className="w-3 h-3 text-slate-600" />
                      <span>Voucher</span>
                    </button>

                    <button
                      onClick={() => openPaymentModal(d)}
                      className="px-2 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold flex items-center space-x-1 transition cursor-pointer shadow-2xs"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Abonar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDebtor(d)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                      title="Eliminar este deudor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Historial de Abonos Registrados */
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historial de Abonos y Pagos Recibidos</h3>
              <p className="text-xs text-slate-500">Registro cronológico de pagos abonados a las deudas de clientes</p>
            </div>
            <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
              {allPayments.length} abonos
            </span>
          </div>

          {allPayments.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8">
              Aún no se han registrado abonos de clientes.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3 text-right">Monto Pagado</th>
                    <th className="p-3 text-right">Descuento Deuda (USD)</th>
                    <th className="p-3">Cuenta Destino</th>
                    <th className="p-3">Observación / Tasa</th>
                    <th className="p-3 text-center whitespace-nowrap sticky right-0 bg-slate-100 z-10 border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allPayments.map((pay) => {
                    const acc = accounts.find((a) => a.id === pay.account_id);
                    const isForeign = pay.currency && pay.currency !== 'USD' && pay.currency !== 'USDT';
                    return (
                      <tr key={pay.id} className="hover:bg-slate-50 group">
                        <td className="p-3 font-mono text-slate-600">{pay.date}</td>
                        <td
                          onClick={() => setSelectedClientForHistory(pay.client_name)}
                          className="p-3 font-bold text-slate-900 hover:text-blue-600 cursor-pointer flex items-center space-x-1.5"
                          title="Clic para ver historial completo del cliente"
                        >
                          <span>{pay.client_name}</span>
                          <FileText className="w-3 h-3 text-blue-500 opacity-70" />
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                          {isForeign && pay.amount_currency !== undefined ? (
                            <span className="inline-flex items-center justify-end">
                              <span className="text-[10px] font-bold text-emerald-700 mr-1.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                                {pay.currency}
                              </span>
                              +{formatRegionalAmount(pay.amount_currency, pay.currency)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-end">
                              <span className="text-[10px] font-bold text-emerald-700 mr-1.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                                USD
                              </span>
                              +${formatCurrency(pay.amount)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                          <span className="text-[10px] font-bold text-emerald-700 mr-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                            USD
                          </span>
                          -${formatCurrency(pay.amount)}
                        </td>
                        <td className="p-3 text-slate-600">
                          {acc ? (
                            <span className="inline-flex items-center space-x-1">
                              <span className="font-semibold">{acc.bank_name}</span>
                              <span className="text-slate-400 text-[11px]">({acc.currency})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Caja General / Sin cuenta</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500">
                          {isForeign && pay.exchange_rate ? (
                            <span className="text-[11px] font-mono text-indigo-600 block">
                              Tasa: {formatRegionalAmount(pay.exchange_rate, pay.currency)}
                            </span>
                          ) : null}
                          <span className="italic">{pay.notes || '-'}</span>
                        </td>
                        <td className="p-3 text-center font-sans sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(pay.id)}
                            title="Eliminar abono y revertir saldo"
                            className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg transition-all duration-150 shadow-sm border border-rose-200 hover:border-rose-600 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Abono de Pago */}
      {paymentModalDebtor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Registrar Abono a Deuda</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cliente: <span className="font-bold text-slate-800">{paymentModalDebtor.client_name}</span> •{' '}
              {paymentModalDebtor.current_debt < 0 ? (
                <span className="font-semibold text-emerald-600">
                  Saldo a favor: <span className="font-mono font-bold text-emerald-600">+${Math.abs(paymentModalDebtor.current_debt).toFixed(2)} USD</span> (Crédito disponible)
                </span>
              ) : paymentModalDebtor.current_debt > 0 ? (
                <span className="font-semibold text-rose-600">
                  Deuda pendiente: <span className="font-mono font-bold text-rose-600">${paymentModalDebtor.current_debt.toFixed(2)} USD</span>
                </span>
              ) : (
                <span className="font-semibold text-slate-500">Al día ($0.00 USD)</span>
              )}
            </p>

            <form
              onSubmit={handleApplyPayment}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="space-y-3.5"
            >
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
                  className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableCurrencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {paymentCurrency !== 'USD' && paymentCurrency !== 'USDT' ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Monto en {paymentCurrency} *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={paymentAmountCurrency}
                        onChange={(e) => handleAmountCurrencyChange(formatInputNumber(e.target.value))}
                        className="w-full text-sm font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                        className="w-full text-sm font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Equivalente que Descuenta de la Deuda ($ USD) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(formatInputNumber(e.target.value))}
                      className="w-full text-sm font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
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
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(formatInputNumber(e.target.value))}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    autoFocus
                  />
                </div>
              )}

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

              {accounts.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Cuenta donde ingresó el dinero (Opcional)
                  </label>
                  <select
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="">Seleccionar cuenta para sumar saldo...</option>
                    {/* Cuentas que coinciden con la divisa del pago */}
                    {accounts.filter((a) => a.currency === paymentCurrency).length > 0 && (
                      <optgroup label={`Cuentas en ${paymentCurrency} (Recomendadas)`}>
                        {accounts
                          .filter((a) => a.currency === paymentCurrency)
                          .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              ★ {acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {/* Resto de cuentas */}
                    {accounts.filter((a) => a.currency !== paymentCurrency).length > 0 && (
                      <optgroup label="Otras Cuentas">
                        {accounts
                          .filter((a) => a.currency !== paymentCurrency)
                          .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.bank_name} ({acc.currency}) - Saldo: {acc.current_balance.toLocaleString()}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nota o Comprobante</label>
                <input
                  type="text"
                  placeholder="ej. Transferencia #827189 o referencia"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalDebtor(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm cursor-pointer"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Comprobante / Voucher Gráfico */}
      {voucherData && (
        <ShareVoucherModal
          data={voucherData}
          onClose={() => setVoucherData(null)}
        />
      )}

      {/* Modal de Historial Completo del Cliente */}
      {selectedClientForHistory && (
        <ClientHistoryModal
          isOpen={!!selectedClientForHistory}
          onClose={() => setSelectedClientForHistory(null)}
          clientName={selectedClientForHistory}
          clients={clients}
          debtors={debtors}
          detalTxs={detalTxs}
          mayorTxs={mayorTxs}
          accounts={accounts}
          onOpenAbono={(deb) => {
            setSelectedClientForHistory(null);
            openPaymentModal(deb);
          }}
          onOpenVoucher={(vData) => {
            setVoucherData(vData);
          }}
        />
      )}
    </div>
  );
}
