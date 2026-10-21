'use client';

import React, { useState, useMemo } from 'react';
import {
  Client,
  Debtor,
  TransactionDetal,
  TransactionMayor,
  Account,
} from '@/types';
import { StorageService } from '@/lib/storage';
import { recordTime } from '@/lib/order';
import { VoucherData } from './ShareVoucherModal';
import {
  CreditCard,
  Edit2,
  Trash2,
  Share2,
  ArrowDownLeft,
  X,
  FileText,
  Wallet,
} from 'lucide-react';

export interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clients?: Client[];
  debtors?: Debtor[];
  detalTxs?: TransactionDetal[];
  mayorTxs?: TransactionMayor[];
  accounts?: Account[];
  onOpenAbono?: (debtor: Debtor) => void;
  onOpenVoucher?: (voucherData: VoucherData) => void;
  onEditClient?: (client: Client) => void;
  onDeleteClient?: (client: Client) => void;
}

export function ClientHistoryModal({
  isOpen,
  onClose,
  clientName,
  clients,
  debtors,
  detalTxs,
  mayorTxs,
  accounts = [],
  onOpenAbono,
  onOpenVoucher,
  onEditClient,
  onDeleteClient,
}: ClientHistoryModalProps) {
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'CRIPTO' | 'EMERGENTES' | 'ABONO'>('ALL');

  const allClients = useMemo(() => clients || StorageService.getClients(), [clients]);
  const allDebtors = useMemo(() => debtors || StorageService.getDebtors(), [debtors]);
  const allDetalTxs = useMemo(() => detalTxs || StorageService.getTransactionsDetal(), [detalTxs]);
  const allMayorTxs = useMemo(() => mayorTxs || StorageService.getTransactionsMayor(), [mayorTxs]);
  const allPayments = useMemo(() => StorageService.getDebtPayments(), []);

  const currentClient = useMemo(() => {
    if (!clientName) return null;
    const clean = clientName.trim().toUpperCase();
    const found = allClients.find((c) => c.name.trim().toUpperCase() === clean);
    if (found) return found;

    // Si no está en directorio de clientes, construir objeto sintético
    const deb = allDebtors.find((d) => d.client_name.trim().toUpperCase() === clean);
    return {
      id: deb ? deb.id : 'client-' + clean,
      name: clean,
      phone: deb?.phone || undefined,
      notes: deb?.notes || undefined,
    } as Client;
  }, [clientName, allClients, allDebtors]);

  // Historial Cripto/Dólar
  const clientDetalHistory = useMemo(() => {
    if (!clientName) return [];
    const clean = clientName.trim().toUpperCase();
    return allDetalTxs.filter((t) => t.client_name.trim().toUpperCase() === clean);
  }, [clientName, allDetalTxs]);

  // Historial Emergentes
  const clientMayorHistory = useMemo(() => {
    if (!clientName) return [];
    const clean = clientName.trim().toUpperCase();
    return allMayorTxs.filter((t) => t.client_name.trim().toUpperCase() === clean);
  }, [clientName, allMayorTxs]);

  // Historial de Abonos
  const clientPaymentsHistory = useMemo(() => {
    if (!clientName) return [];
    const clean = clientName.trim().toUpperCase();
    return allPayments.filter((p) => p.client_name.trim().toUpperCase() === clean);
  }, [clientName, allPayments]);

  // Métricas financieras del cliente
  const clientFinancials = useMemo(() => {
    if (!clientName) {
      return { totalBoughtUsd: 0, totalProfitUsd: 0, currentDebt: 0, totalOps: 0, debtor: null };
    }

    const clean = clientName.trim().toUpperCase();
    const detalBought = clientDetalHistory.reduce((sum, t) => sum + (t.total_to_pay || 0), 0);
    const mayorBought = clientMayorHistory.reduce((sum, t) => sum + (t.total_to_pay || 0), 0);
    const totalBoughtUsd = Number((detalBought + mayorBought).toFixed(2));

    const detalProfit = clientDetalHistory.reduce((sum, t) => sum + (t.profit_usd || 0), 0);
    const mayorProfit = clientMayorHistory.reduce((sum, t) => sum + (t.profit_usd || 0), 0);
    const totalProfitUsd = detalProfit + mayorProfit;

    const debtorEntry = allDebtors.find((d) => d.client_name.trim().toUpperCase() === clean);
    const totalPaidInAbonos = clientPaymentsHistory.reduce((sum, p) => sum + (p.amount || 0), 0);

    let currentDebt = debtorEntry ? debtorEntry.current_debt : 0;
    if (currentDebt === 0 && totalBoughtUsd > 0 && totalPaidInAbonos === 0) {
      currentDebt = totalBoughtUsd;
    }

    const totalOps = clientDetalHistory.length + clientMayorHistory.length + clientPaymentsHistory.length;

    const finalDebtor: Debtor | null = debtorEntry || (currentDebt !== 0 ? {
      id: 'deb-' + clean,
      client_name: clean,
      current_debt: currentDebt,
      phone: currentClient?.phone,
    } : null);

    return {
      totalBoughtUsd,
      totalProfitUsd,
      currentDebt,
      totalOps,
      debtor: finalDebtor,
    };
  }, [clientName, clientDetalHistory, clientMayorHistory, clientPaymentsHistory, allDebtors, currentClient]);

  // Movimientos unificados ordenados cronológicamente (más recientes primero)
  const unifiedMovements = useMemo(() => {
    if (!clientName) return [];

    const list: Array<{
      id: string;
      type: 'CRIPTO' | 'EMERGENTES' | 'ABONO';
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
            <strong className="text-slate-900 font-mono">{t.amount_ves.toLocaleString('es-VE')}</strong>
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
        profitFormatted: '-',
        notesOrAccount: [
          acc ? `${acc.bank_name} (${acc.currency})` : 'Caja General',
          p.notes,
        ]
          .filter(Boolean)
          .join(' • ') || '-',
      });
    });

    // Ordenar: lo más nuevo primero arriba
    return list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.timestamp - a.timestamp;
    });
  }, [clientName, clientDetalHistory, clientMayorHistory, clientPaymentsHistory, accounts]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === 'ALL') return unifiedMovements;
    return unifiedMovements.filter((m) => m.type === movementFilter);
  }, [unifiedMovements, movementFilter]);

  if (!isOpen || !clientName) return null;

  const handleShareVoucher = () => {
    if (!onOpenVoucher) return;
    const lastPayment = clientPaymentsHistory[0];
    onOpenVoucher({
      clientName: currentClient ? currentClient.name : clientName,
      phone: currentClient?.phone,
      identification: currentClient?.identification,
      currentDebt: clientFinancials.currentDebt,
      lastPaymentDate: lastPayment ? lastPayment.date : undefined,
      lastPaymentAmount: lastPayment ? lastPayment.amount : undefined,
      notes: currentClient?.notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto my-auto">
        {/* Header del Modal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Historial de Operaciones: {currentClient ? currentClient.name : clientName}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              RUC/Cédula: <span className="font-mono font-medium text-slate-700">{currentClient?.identification || 'No registrado'}</span> • Tel: {currentClient?.phone || 'No registrado'} • {currentClient?.address || 'Sin dirección'}
            </p>
            {(currentClient?.preferred_account || currentClient?.notes) && (
              <div className="mt-2.5 p-2 rounded-lg contact-payment-box flex items-start space-x-2 text-xs">
                <Wallet className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <span className="font-semibold break-words leading-relaxed text-[11px]">
                  {[currentClient.preferred_account ? `Cuenta / Pago: ${currentClient.preferred_account}` : null, currentClient.notes].filter(Boolean).join(' • ')}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {onEditClient && currentClient && (
              <button
                type="button"
                onClick={() => onEditClient(currentClient)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Editar</span>
              </button>
            )}

            {onDeleteClient && currentClient && (
              <button
                type="button"
                onClick={() => onDeleteClient(currentClient)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            )}

            {onOpenVoucher && (
              <button
                type="button"
                onClick={handleShareVoucher}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Comprobante</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition cursor-pointer"
            >
              <X className="w-4 h-4" />
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

          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
            clientFinancials.currentDebt > 0
              ? 'bg-rose-50 border-rose-200'
              : clientFinancials.currentDebt < 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <span className={`text-[10px] uppercase font-bold block ${
                clientFinancials.currentDebt > 0
                  ? 'text-rose-700'
                  : clientFinancials.currentDebt < 0
                  ? 'text-emerald-700'
                  : 'text-slate-500'
              }`}>
                {clientFinancials.currentDebt < 0 ? 'Saldo a Favor' : 'Deuda Pendiente'}
              </span>
              <span className={`text-lg font-black font-mono mt-0.5 block ${
                clientFinancials.currentDebt > 0
                  ? 'text-rose-700'
                  : clientFinancials.currentDebt < 0
                  ? 'text-emerald-700'
                  : 'text-slate-700'
              }`}>
                {clientFinancials.currentDebt > 0
                  ? `-$${clientFinancials.currentDebt.toFixed(2)}`
                  : clientFinancials.currentDebt < 0
                  ? `+$${Math.abs(clientFinancials.currentDebt).toFixed(2)}`
                  : '$0.00'}
              </span>
              <span className={`text-[10px] ${
                clientFinancials.currentDebt > 0
                  ? 'text-rose-600 font-semibold'
                  : clientFinancials.currentDebt < 0
                  ? 'text-emerald-600 font-semibold'
                  : 'text-slate-400'
              }`}>
                {clientFinancials.currentDebt > 0
                  ? 'Saldo por cobrar'
                  : clientFinancials.currentDebt < 0
                  ? 'Crédito disponible a favor'
                  : 'Al día ($0.00)'}
              </span>
            </div>

            {clientFinancials.debtor && onOpenAbono && (
              <button
                type="button"
                onClick={() => {
                  if (clientFinancials.debtor && onOpenAbono) {
                    onOpenAbono(clientFinancials.debtor);
                  }
                }}
                className="mt-2 py-1 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center space-x-1 transition cursor-pointer"
              >
                <ArrowDownLeft className="w-3 h-3" />
                <span>{clientFinancials.currentDebt < 0 ? 'Abonar más' : 'Abonar Pago'}</span>
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

        {/* Historial Cronológico Unificado */}
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

            {/* Filtros de Tipo */}
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
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
