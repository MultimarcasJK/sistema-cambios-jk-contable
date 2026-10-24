'use client';

import React, { useState, useMemo } from 'react';
import { Client, TransactionDetal, TransactionMayor, Debtor, Account, DebtPayment, Currency } from '@/types';
import { StorageService } from '@/lib/storage';
import { recordTime } from '@/lib/order';
import { CurrencyService } from '@/lib/currencies';
import { ShareVoucherModal, VoucherData } from './ShareVoucherModal';
import { BeneficiariosCliente } from './BeneficiariosCliente';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  CheckCircle,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Share2,
  ArrowDownLeft,
  Receipt,
  Coins,
  Edit2,
  Trash2,
  Wallet,
} from 'lucide-react';
import { localDateStr, localDateOf } from '@/lib/dates';
import { getManualEntries, stripManualTag } from '@/lib/debtor-sync';

interface ClientsProps {
  clients: Client[];
  accounts?: Account[];
  debtors: Debtor[];
  detalTxs: TransactionDetal[];
  mayorTxs: TransactionMayor[];
  onDataChange: () => void;
  appMode?: import('@/types').AppMode;
}

export function ClientsView({
  clients,
  accounts = [],
  debtors,
  detalTxs,
  mayorTxs,
  onDataChange,
  appMode,
}: ClientsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'CRIPTO' | 'EMERGENTES' | 'ABONO'>('ALL');
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);

  // Estados para Edición de Cliente
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    identification: '',
    phone: '',
    address: '',
    preferred_account: '',
    notes: '',
  });

  const [abonoModalDebtor, setAbonoModalDebtor] = useState<Debtor | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('USD');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAmountCurrency, setPaymentAmountCurrency] = useState('');
  const [paymentRate, setPaymentRate] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDateStr());
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const availableCurrencies = useMemo(() => CurrencyService.getCurrencies(), []);

  const [formData, setFormData] = useState({
    name: '',
    identification: '',
    phone: '',
    address: '',
    preferred_account: '',
    notes: '',
  });

  const allDebtPayments = useMemo(() => {
    return StorageService.getDebtPayments(appMode);
  }, [debtors, appMode]);

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Por favor ingrese el nombre del cliente');
      return;
    }

    StorageService.addClient({
      name: formData.name.trim().toUpperCase(),
      identification: formData.identification.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      preferred_account: formData.preferred_account.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    }, appMode);

    setIsAdding(false);
    setFormData({
      name: '',
      identification: '',
      phone: '',
      address: '',
      preferred_account: '',
      notes: '',
    });
    onDataChange();
  };

  const handleOpenEditClient = (client: Client) => {
    setEditingClient(client);
    setEditFormData({
      name: client.name,
      identification: client.identification || '',
      phone: client.phone || '',
      address: client.address || '',
      preferred_account: client.preferred_account || '',
      notes: client.notes || '',
    });
  };

  const handleSaveEditClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    if (!editFormData.name.trim()) {
      alert('Por favor ingrese el nombre del cliente');
      return;
    }

    // Los beneficiarios guardados siguen al cliente si cambia de nombre
    StorageService.renameRemitente(editingClient.name, editFormData.name, appMode);
    StorageService.updateClient(editingClient.id, {
      name: editFormData.name.trim().toUpperCase(),
      identification: editFormData.identification.trim() || undefined,
      phone: editFormData.phone.trim() || undefined,
      address: editFormData.address.trim() || undefined,
      preferred_account: editFormData.preferred_account.trim() || undefined,
      notes: editFormData.notes.trim() || undefined,
    }, appMode);

    setEditingClient(null);
    onDataChange();
  };

  const handleDeleteClient = async (client: Client) => {
    if (confirm(`¿Estás seguro de que deseas eliminar al cliente "${client.name}"? Esta acción no se puede deshacer.`)) {
      await StorageService.deleteClient(client.id, appMode);
      if (selectedClientForHistory?.id === client.id) {
        setSelectedClientForHistory(null);
      }
      onDataChange();
    }
  };

  const openAbonoModal = (debtor: Debtor) => {
    setAbonoModalDebtor(debtor);
    setPaymentCurrency('USD');
    setPaymentAmount('');
    setPaymentAmountCurrency('');
    setPaymentRate('');
    setPaymentDate(localDateStr());
    setPaymentAccountId('');
    setPaymentNotes('');
  };

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

  const handleApplyPaymentFromClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!abonoModalDebtor) return;
    const amountUsd = parseFloat(paymentAmount);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      alert('Ingrese un monto válido de abono');
      return;
    }

    const isForeign = paymentCurrency !== 'USD' && paymentCurrency !== 'USDT';
    const amountCurr = isForeign ? (parseFloat(paymentAmountCurrency) || amountUsd) : amountUsd;
    const rate = isForeign ? (parseFloat(paymentRate) || 1) : 1;

    StorageService.addDebtPayment({
      debtor_id: abonoModalDebtor.id,
      client_name: abonoModalDebtor.client_name,
      date: paymentDate,
      amount: amountUsd,
      currency: paymentCurrency,
      amount_currency: amountCurr,
      exchange_rate: rate,
      account_id: paymentAccountId || undefined,
      notes: paymentNotes.trim() || undefined,
    }, appMode);

    setAbonoModalDebtor(null);
    setPaymentAmount('');
    setPaymentAmountCurrency('');
    setPaymentRate('');
    setPaymentNotes('');
    setPaymentAccountId('');
    onDataChange();
  };

  const handleOpenVoucherForClient = (client: Client) => {
    const debtorEntry = debtors.find(
      (d) => d.client_name.toUpperCase() === client.name.toUpperCase()
    );
    const clientPayments = allDebtPayments.filter(
      (p) => p.client_name.toUpperCase() === client.name.toUpperCase()
    );
    const lastPayment = clientPayments.length > 0 ? clientPayments[0] : undefined;

    setVoucherData({
      clientName: client.name,
      phone: client.phone,
      identification: client.identification,
      currentDebt: debtorEntry ? debtorEntry.current_debt : 0,
      lastPaymentDate: lastPayment?.date,
      lastPaymentAmount: lastPayment?.amount,
      notes: stripManualTag(debtorEntry?.notes) || client.notes,
    });
  };

  const filteredClients = useMemo(() => {
    return clients
      .filter((c) => {
        const matchName = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchId = c.identification ? c.identification.includes(searchTerm) : false;
        const matchPhone = c.phone ? c.phone.includes(searchTerm) : false;
        return matchName || matchId || matchPhone;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [clients, searchTerm]);

  // Historial y métricas de operaciones del cliente seleccionado
  const clientDetalHistory = useMemo(() => {
    if (!selectedClientForHistory) return [];
    return detalTxs.filter(
      (t) => t.client_name.toUpperCase() === selectedClientForHistory.name.toUpperCase()
    );
  }, [selectedClientForHistory, detalTxs]);

  const clientMayorHistory = useMemo(() => {
    if (!selectedClientForHistory) return [];
    return mayorTxs.filter(
      (t) => t.client_name.toUpperCase() === selectedClientForHistory.name.toUpperCase()
    );
  }, [selectedClientForHistory, mayorTxs]);

  // Historial de abonos del cliente seleccionado
  const clientPaymentsHistory = useMemo(() => {
    if (!selectedClientForHistory) return [];
    return allDebtPayments.filter(
      (p) => p.client_name.toUpperCase() === selectedClientForHistory.name.toUpperCase()
    );
  }, [selectedClientForHistory, allDebtPayments]);

  // Métricas financieras del cliente seleccionado
  const clientFinancials = useMemo(() => {
    if (!selectedClientForHistory) return { totalBoughtUsd: 0, totalProfitUsd: 0, currentDebt: 0, totalOps: 0, debtor: null };

    const detalBought = clientDetalHistory.reduce((sum, t) => sum + (t.total_to_pay || 0), 0);
    const mayorBought = clientMayorHistory.reduce((sum, t) => sum + (t.total_to_pay || 0), 0);
    const totalBoughtUsd = Number((detalBought + mayorBought).toFixed(2));

    const detalProfit = clientDetalHistory.reduce((sum, t) => sum + (t.profit_usd || 0), 0);
    const mayorProfit = clientMayorHistory.reduce((sum, t) => sum + (t.profit_usd || 0), 0);
    const totalProfitUsd = detalProfit + mayorProfit;

    // Buscar deuda en el módulo de deudores o calcularla dinámicamente
    const debtorEntry = debtors.find(
      (d) => d.client_name.toUpperCase() === selectedClientForHistory.name.toUpperCase()
    );
    const totalPaidInAbonos = clientPaymentsHistory.reduce((sum, p) => sum + (p.amount || 0), 0);

    let currentDebt = debtorEntry ? debtorEntry.current_debt : 0;
    // Si no está en deudores o su saldo está en 0 pero tiene compras y ningún abono registrado:
    if (currentDebt === 0 && totalBoughtUsd > 0 && totalPaidInAbonos === 0) {
      currentDebt = totalBoughtUsd;
    }

    const totalOps = clientDetalHistory.length + clientMayorHistory.length;

    return {
      totalBoughtUsd,
      totalProfitUsd,
      currentDebt,
      totalOps,
      debtor: debtorEntry || (currentDebt > 0 ? {
        id: 'deb-' + selectedClientForHistory.id,
        client_name: selectedClientForHistory.name,
        current_debt: currentDebt,
      } : null),
    };
  }, [selectedClientForHistory, clientDetalHistory, clientMayorHistory, clientPaymentsHistory, debtors]);

  // Lista unificada de movimientos del cliente (cronológico: lo más nuevo primero arriba)
  const unifiedMovements = useMemo(() => {
    if (!selectedClientForHistory) return [];

    const list: Array<{
      id: string;
      type: 'CRIPTO' | 'EMERGENTES' | 'ABONO' | 'MANUAL';
      date: string;
      timestamp: number;
      badgeLabel: string;
      badgeColor: string;
      dotColor: string;
      rowBorder: string;
      detail: React.ReactNode;
      debePagarFormatted: string;
      amountPaidFormatted: string;
      statusBadge: React.ReactNode;
      isAbono: boolean;
      profitFormatted: string;
      notesOrAccount: string;
    }> = [];

    // 1. Operaciones Cripto/Dólar
    clientDetalHistory.forEach((t) => {
      const ts = recordTime(t);
      const isPaid = t.payment_status === 'PAGADO';
      const isPartial = t.payment_status === 'PARCIAL';
      const isPorCobrar = t.received_account_id === 'POR_COBRAR' || t.payment_status === 'PENDIENTE' || (!isPaid && !isPartial);
      const amountPaid = isPaid ? t.total_to_pay : (t.amount_received || 0);

      list.push({
        id: `detal-${t.id}`,
        type: 'CRIPTO',
        date: t.date,
        timestamp: ts,
        badgeLabel: 'Cripto/Dólar',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
        rowBorder: 'hover:border-emerald-300',
        detail: (
          <span>
            <span className="text-[10px] font-bold text-indigo-700 mr-1.5 px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
              USDT
            </span>
            <strong className="text-slate-900 font-mono">{t.usdt_amount.toFixed(2)}</strong>
            <span className="text-slate-500 text-[11px] ml-1.5 font-mono">
              (Compra: {t.buy_price.toFixed(4)} • Venta: {t.sell_price.toFixed(4)})
            </span>
          </span>
        ),
        debePagarFormatted: `$${t.total_to_pay.toFixed(2)} USD`,
        amountPaidFormatted: `$${amountPaid.toFixed(2)} USD`,
        statusBadge: isPaid ? (
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
        ),
        isAbono: false,
        profitFormatted:
          t.profit_usd >= 0
            ? `+$${t.profit_usd.toFixed(2)} USD`
            : `-$${Math.abs(t.profit_usd).toFixed(2)} USD`,
        notesOrAccount: isPorCobrar ? '🔴 Por Cobrar' : ([t.reference, t.notes].filter(Boolean).join(' • ') || '-'),
      });
    });

    // 2. Operaciones Emergentes
    clientMayorHistory.forEach((t) => {
      const ts = recordTime(t);
      const isPaid = t.payment_status === 'PAGADO';
      const isPartial = t.payment_status === 'PARCIAL';
      const isPorCobrar = t.received_account_id === 'POR_COBRAR' || t.payment_status === 'PENDIENTE' || (!isPaid && !isPartial);
      const amountPaid = isPaid ? t.total_to_pay : (t.amount_received || 0);
      const txCurrency = t.currency || (t.sell_price > 0 && t.sell_price <= 1.5 ? 'EUR' : 'VES');

      list.push({
        id: `mayor-${t.id}`,
        type: 'EMERGENTES',
        date: t.date,
        timestamp: ts,
        badgeLabel: 'Monedas Regionales',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        dotColor: 'bg-blue-500',
        rowBorder: 'hover:border-blue-300',
        detail: (
          <span>
            <span className="text-[10px] font-bold text-indigo-700 mr-1.5 px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
              {txCurrency}
            </span>
            <strong className="text-slate-900 font-mono">Bs. {t.amount_ves.toLocaleString('es-VE')}</strong>
            <span className="text-slate-500 text-[11px] ml-1.5 font-mono">
              (Compra: {t.buy_price.toFixed(2)} • Venta: {t.sell_price.toFixed(2)})
            </span>
          </span>
        ),
        debePagarFormatted: `$${t.total_to_pay.toFixed(2)} USD`,
        amountPaidFormatted: `$${amountPaid.toFixed(2)} USD`,
        statusBadge: isPaid ? (
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
        ),
        isAbono: false,
        profitFormatted:
          t.profit_usd >= 0
            ? `+$${t.profit_usd.toFixed(2)} USD`
            : `-$${Math.abs(t.profit_usd).toFixed(2)} USD`,
        notesOrAccount: isPorCobrar ? '🔴 Por Cobrar' : ([t.reference, t.notes].filter(Boolean).join(' • ') || '-'),
      });
    });

    // 3. Abonos a Deuda
    clientPaymentsHistory.forEach((p) => {
      const ts = recordTime(p);
      const acc = accounts.find((a) => a.id === p.account_id);
      const isForeign = p.currency && p.currency !== 'USD' && p.currency !== 'USDT';

      list.push({
        id: `pay-${p.id}`,
        type: 'ABONO',
        date: p.date,
        timestamp: ts,
        badgeLabel: 'Abono Deuda',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        dotColor: 'bg-purple-500',
        rowBorder: 'hover:border-purple-300',
        detail: (
          <span>
            <span className="text-[10px] font-bold text-purple-700 mr-1.5 px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded">
              {p.currency || 'USD'}
            </span>
            <strong className="text-purple-700 font-mono">
              {isForeign && p.amount_currency !== undefined
                ? `${p.amount_currency.toLocaleString()} ${p.currency} (≈ $${p.amount.toFixed(2)} USD)`
                : `$${p.amount.toFixed(2)} USD`}
            </strong>
            {isForeign && p.exchange_rate ? (
              <span className="text-slate-500 text-[11px] ml-1.5 font-mono">
                (@ {p.exchange_rate})
              </span>
            ) : null}
          </span>
        ),
        debePagarFormatted: '-',
        amountPaidFormatted: `+$${p.amount.toFixed(2)} USD`,
        statusBadge: (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
            Abono Deuda
          </span>
        ),
        isAbono: true,
        profitFormatted: 'Abono a Saldo',
        notesOrAccount: [
          acc ? `${acc.name || acc.bank_name} (${acc.currency})` : 'Caja General',
          p.notes,
        ].filter(Boolean).join(' • ') || '-',
      });
    });

    // 4. Deuda anotada a mano en Deudores (p. ej. lo que debía en el sistema viejo)
    const manualDebtor = debtors.find((d) => d.client_name.trim().toUpperCase() === selectedClientForHistory.name.trim().toUpperCase());
    getManualEntries(manualDebtor?.notes).forEach((e, idx) => {
      const at = e.at || manualDebtor?.updated_at;
      list.push({
        id: `manual-${manualDebtor?.id}-${idx}`,
        type: 'MANUAL',
        date: at ? localDateOf(at) : '',
        timestamp: at ? Date.parse(at) || 0 : 0,
        badgeLabel: 'Deuda anotada a mano',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        dotColor: 'bg-rose-500',
        rowBorder: 'hover:border-rose-300',
        detail: (
          <strong className="text-rose-700 font-mono">
            {e.amount >= 0 ? `$${e.amount.toFixed(2)} USD` : `-$${Math.abs(e.amount).toFixed(2)} USD (a favor)`}
          </strong>
        ),
        debePagarFormatted: `$${e.amount.toFixed(2)} USD`,
        amountPaidFormatted: '-',
        statusBadge: (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
            Anotada a mano
          </span>
        ),
        isAbono: false,
        profitFormatted: '-',
        notesOrAccount: 'Agregada en Deudores',
      });
    });

    // Ordenar: las más nuevas primero arriba, las más antiguas abajo
    return list.sort((a, b) => {
      if (b.date !== a.date) {
        return b.date.localeCompare(a.date);
      }
      return b.timestamp - a.timestamp;
    });
  }, [selectedClientForHistory, clientDetalHistory, clientMayorHistory, clientPaymentsHistory, accounts, debtors]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === 'ALL') return unifiedMovements;
    return unifiedMovements.filter((m) => m.type === movementFilter);
  }, [unifiedMovements, movementFilter]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Directorio y Registro de Clientes</span>
          </h2>
          <p className="text-xs text-slate-500">
            Base de datos de clientes, datos de contacto, RUC / Cédula y cuentas habituales
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Cliente</span>
        </button>
      </div>

      {/* Formulario Nuevo Cliente */}
      {isAdding && (
        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Ficha de Registro de Cliente</h3>
          <form onSubmit={handleAddClient} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo *</label>
              <input
                type="text"
                list="clients-list-registration"
                placeholder="Escribe o selecciona cliente..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
              <datalist id="clients-list-registration">
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.identification ? `${c.name} (${c.identification})` : c.name}
                  </option>
                ))}
              </datalist>
              {clients.some((c) => c.name.trim().toUpperCase() === formData.name.trim().toUpperCase() && formData.name.trim() !== '') && (
                <p className="text-[11px] font-semibold text-amber-600 mt-1 flex items-center gap-1">
                  <span>ℹ️ Este cliente ya existe. Al guardar se actualizará su información en lugar de duplicarse.</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cédula / RUC / DNI</label>
              <input
                type="text"
                placeholder="ej. 1720349182"
                value={formData.identification}
                onChange={(e) => setFormData({ ...formData, identification: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono / WhatsApp</label>
              <input
                type="text"
                placeholder="ej. +593 99 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección / Ciudad</label>
              <input
                type="text"
                placeholder="ej. Quito, Ecuador"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta Habitual de Cobro/Pago</label>
              <input
                type="text"
                placeholder="ej. PICHINCHA RAFAEL"
                value={formData.preferred_account}
                onChange={(e) => setFormData({ ...formData, preferred_account: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notas / Observaciones</label>
              <input
                type="text"
                placeholder="Cliente frecuente, condiciones..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm"
              >
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Directorio de Clientes */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            Clientes Registrados ({filteredClients.length})
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, RUC o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3">
          {filteredClients.map((client) => {
            const debtorInfo = debtors.find((d) => d.client_name.toUpperCase() === client.name.toUpperCase());
            let clientDebt = debtorInfo ? debtorInfo.current_debt : 0;
            if (clientDebt === 0) {
              const clientDetal = detalTxs.filter((t) => t.client_name.toUpperCase() === client.name.toUpperCase());
              const clientMayor = mayorTxs.filter((t) => t.client_name.toUpperCase() === client.name.toUpperCase());
              const bought = clientDetal.reduce((sum, t) => sum + (t.total_to_pay || 0), 0) + clientMayor.reduce((sum, t) => sum + (t.total_to_pay || 0), 0);
              const abonos = allDebtPayments.filter((p) => p.client_name.toUpperCase() === client.name.toUpperCase()).reduce((sum, p) => sum + (p.amount || 0), 0);
              if (bought > 0 && abonos === 0) {
                clientDebt = bought;
              }
            }

            return (
              <div
                key={client.id}
                className="p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 transition bg-slate-50/50 flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug truncate" title={client.name}>
                        {client.name}
                      </h4>
                      {client.identification && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-full border border-blue-200 font-semibold mt-0.5 inline-block">
                          {client.identification}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-0.5 shrink-0">
                      <button
                        onClick={() => handleOpenEditClient(client)}
                        title="Editar cliente"
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded-md transition cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client)}
                        title="Eliminar cliente"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-0.5 mt-2 text-[11px] text-slate-600">
                    {client.phone && (
                      <div className="flex items-center space-x-1 truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center space-x-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </div>
                    )}
                    {(client.preferred_account || client.notes) && (
                      <div className="mt-2 p-2 rounded-lg contact-payment-box flex items-start space-x-2 text-xs">
                        <Wallet className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                        <span className="font-semibold break-words leading-relaxed text-[11px]">
                          {[client.preferred_account ? `Cuenta / Pago: ${client.preferred_account}` : null, client.notes].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {clientDebt > 0 && (
                    <div className="mt-2 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] flex items-center justify-between">
                      <span className="text-rose-700 font-semibold">Deuda:</span>
                      <span className="font-bold text-rose-700 font-mono">-${clientDebt.toFixed(2)} USD</span>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1">
                  <button
                    onClick={() => handleOpenVoucherForClient(client)}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold flex items-center space-x-1 transition cursor-pointer px-1.5 py-1 rounded-md hover:bg-slate-100"
                    title="Compartir por WhatsApp"
                  >
                    <Share2 className="w-3 h-3 text-blue-600" />
                    <span>Compartir</span>
                  </button>

                  <button
                    onClick={() => setSelectedClientForHistory(client)}
                    className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Ver Historial</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Historial Completo del Cliente */}
      {selectedClientForHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <span>Historial de Operaciones: {selectedClientForHistory.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  RUC/Cédula: <span className="font-mono font-medium text-slate-700">{selectedClientForHistory.identification || 'No registrado'}</span> • Tel: {selectedClientForHistory.phone || 'No registrado'} • {selectedClientForHistory.address || 'Sin dirección'}
                </p>
                {selectedClientForHistory.preferred_account && (
                  <p className="text-xs font-semibold text-blue-700 mt-1 flex items-center space-x-1">
                    <CreditCard className="w-3 h-3" />
                    <span>Cuenta Habitual: {selectedClientForHistory.preferred_account}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  onClick={() => handleOpenEditClient(selectedClientForHistory)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Editar</span>
                </button>

                <button
                  onClick={() => handleDeleteClient(selectedClientForHistory)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>

                <button
                  onClick={() => handleOpenVoucherForClient(selectedClientForHistory)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Enviar Comprobante</span>
                </button>

                <button
                  onClick={() => setSelectedClientForHistory(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tarjetas de Resumen Financiero del Cliente */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Comprado</span>
                <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">
                  ${clientFinancials.totalBoughtUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">Volumen histórico</span>
              </div>

              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Ganancia Generada</span>
                <span className="text-lg font-black font-mono text-emerald-700 mt-0.5 block">
                  +${clientFinancials.totalProfitUsd.toFixed(2)}
                </span>
                <span className="text-[10px] text-emerald-600">Margen neto aportado</span>
              </div>

              <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${clientFinancials.currentDebt > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${clientFinancials.currentDebt > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                    Deuda Pendiente
                  </span>
                  <span className={`text-lg font-black font-mono mt-0.5 block ${clientFinancials.currentDebt > 0 ? 'text-rose-700' : 'text-emerald-600'}`}>
                    {clientFinancials.currentDebt > 0 ? '-' : ''}${clientFinancials.currentDebt.toFixed(2)}
                  </span>
                  <span className={`text-[10px] ${clientFinancials.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600 font-semibold'}`}>
                    {clientFinancials.currentDebt > 0 ? 'Saldo por cobrar' : 'Al día ($0.00)'}
                  </span>
                </div>

                {clientFinancials.debtor && (
                  <button
                    onClick={() => {
                      if (clientFinancials.debtor) {
                        openAbonoModal(clientFinancials.debtor);
                      }
                    }}
                    className="mt-2 py-1 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center space-x-1 transition cursor-pointer"
                  >
                    <ArrowDownLeft className="w-3 h-3" />
                    <span>Abonar Pago</span>
                  </button>
                )}
              </div>

              <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Total Operaciones</span>
                <span className="text-lg font-black font-mono text-blue-900 mt-0.5 block">
                  {clientFinancials.totalOps}
                </span>
                <span className="text-[10px] text-blue-600">Transacciones hechas</span>
              </div>
            </div>

            {/* Historial Cronológico Unificado (Más recientes arriba) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                    <span>Línea de Tiempo y Movimientos del Cliente</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Extracto cronológico unificado • Las operaciones más recientes aparecen primero
                  </p>
                </div>

                {/* Selectores pequeños de filtro */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setMovementFilter('ALL')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      movementFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todos ({unifiedMovements.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementFilter('CRIPTO')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer ${
                      movementFilter === 'CRIPTO'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${movementFilter === 'CRIPTO' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                    <span>Cripto/Dólar ({clientDetalHistory.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementFilter('EMERGENTES')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer ${
                      movementFilter === 'EMERGENTES'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${movementFilter === 'EMERGENTES' ? 'bg-white' : 'bg-blue-500'}`}></span>
                    <span>Monedas Regionales ({clientMayorHistory.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementFilter('ABONO')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer ${
                      movementFilter === 'ABONO'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${movementFilter === 'ABONO' ? 'bg-white' : 'bg-purple-500'}`}></span>
                    <span>Abonos ({clientPaymentsHistory.length})</span>
                  </button>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 italic">No se registran movimientos en esta categoría.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Fecha</th>
                        <th className="p-2.5">Operación / Módulo</th>
                        <th className="p-2.5">Detalle / Tasas</th>
                        <th className="p-2.5 text-right">Debe Pagar</th>
                        <th className="p-2.5 text-right">Cobrado / Abonado</th>
                        <th className="p-2.5">Estado</th>
                        <th className="p-2.5 text-right">Ganancia ($)</th>
                        <th className="p-2.5">Ref / Cuenta / Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredMovements.map((mov) => (
                        <tr key={mov.id} className={`hover:bg-slate-50/80 transition ${mov.rowBorder}`}>
                          <td className="p-2.5 font-sans text-slate-600 whitespace-nowrap">
                            {mov.date}
                          </td>
                          <td className="p-2.5 font-sans whitespace-nowrap">
                            <span
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${mov.badgeColor}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${mov.dotColor}`}></span>
                              <span>{mov.badgeLabel}</span>
                            </span>
                          </td>
                          <td className="p-2.5 font-sans text-slate-700">
                            {mov.detail}
                          </td>
                          <td className="p-2.5 text-right font-black text-slate-900 whitespace-nowrap">
                            {mov.debePagarFormatted}
                          </td>
                          <td
                            className={`p-2.5 text-right font-bold whitespace-nowrap ${
                              mov.isAbono ? 'text-purple-600' : 'text-slate-700'
                            }`}
                          >
                            {mov.amountPaidFormatted}
                          </td>
                          <td className="p-2.5 font-sans whitespace-nowrap">
                            {mov.statusBadge}
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            {mov.isAbono ? (
                              <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-100">
                                Saldo Deuda
                              </span>
                            ) : (
                              <span
                                className={`font-bold font-mono ${
                                  mov.profitFormatted.startsWith('+')
                                    ? 'text-emerald-600'
                                    : mov.profitFormatted.startsWith('-')
                                    ? 'text-rose-600'
                                    : 'text-slate-500'
                                }`}
                              >
                                {mov.profitFormatted}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-sans text-slate-500 text-[11px] max-w-xs truncate">
                            {mov.notesOrAccount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedClientForHistory(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Abono desde la Ficha del Cliente */}
      {abonoModalDebtor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Registrar Abono a Deuda</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cliente: <span className="font-bold text-slate-800">{abonoModalDebtor.client_name}</span> •{' '}
              {abonoModalDebtor.current_debt < 0 ? (
                <span className="font-semibold text-emerald-600">
                  Saldo a favor: <span className="font-mono font-bold text-emerald-600">+${Math.abs(abonoModalDebtor.current_debt).toFixed(2)} USD</span> (Crédito disponible)
                </span>
              ) : abonoModalDebtor.current_debt > 0 ? (
                <span className="font-semibold text-rose-600">
                  Deuda pendiente: <span className="font-mono font-bold text-rose-600">${abonoModalDebtor.current_debt.toFixed(2)} USD</span>
                </span>
              ) : (
                <span className="font-semibold text-slate-500">Al día ($0.00 USD)</span>
              )}
            </p>

            <form
              onSubmit={handleApplyPaymentFromClient}
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
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={paymentAmountCurrency}
                        onChange={(e) => handleAmountCurrencyChange(e.target.value)}
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
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
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
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
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
                  onClick={() => setAbonoModalDebtor(null)}
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

      {/* Modal de Edición de Cliente */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-1">Editar Ficha de Cliente</h3>
            <p className="text-xs text-slate-500 mb-4">
              Modifica los datos personales, de contacto y cuenta habitual del cliente
            </p>

            <form onSubmit={handleSaveEditClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cédula / RUC / DNI</label>
                  <input
                    type="text"
                    value={editFormData.identification}
                    onChange={(e) => setEditFormData({ ...editFormData, identification: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección / Ciudad</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta Habitual</label>
                  <input
                    type="text"
                    value={editFormData.preferred_account}
                    onChange={(e) => setEditFormData({ ...editFormData, preferred_account: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notas / Observaciones</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Enter dentro de un beneficiario no debe guardar toda la ficha */}
              <div
                className="pt-3 border-t border-slate-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
              >
                <BeneficiariosCliente
                  clientName={editingClient.name}
                  identification={editingClient.identification}
                  phone={editingClient.phone}
                  appMode={appMode}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm cursor-pointer"
                >
                  Guardar Cambios
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
    </div>
  );
}
