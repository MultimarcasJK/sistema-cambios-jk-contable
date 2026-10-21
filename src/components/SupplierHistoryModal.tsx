'use client';

import React, { useState, useMemo } from 'react';
import { Supplier, SupplierPurchase, SupplierPayment, Account } from '@/types';
import { StorageService } from '@/lib/storage';
import { recordTime } from '@/lib/order';
import { SupplierVoucherData } from './ShareSupplierVoucherModal';
import {
  Building2,
  Edit2,
  Trash2,
  Share2,
  ArrowDownLeft,
  X,
  FileText,
  Truck,
  Coins,
  Receipt,
  Wallet,
  Calendar,
} from 'lucide-react';

export interface SupplierHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  accounts?: Account[];
  onOpenPayment?: (supplier: Supplier) => void;
  onOpenVoucher?: (voucherData: SupplierVoucherData) => void;
  onEditSupplier?: (supplier: Supplier) => void;
  onDeleteSupplier?: (supplier: Supplier) => void;
  onDataChange?: () => void;
}

export function SupplierHistoryModal({
  isOpen,
  onClose,
  supplier,
  accounts = [],
  onOpenPayment,
  onOpenVoucher,
  onEditSupplier,
  onDeleteSupplier,
  onDataChange,
}: SupplierHistoryModalProps) {
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'COMPRAS' | 'PAGOS'>('ALL');

  const allPurchases = useMemo(() => {
    return StorageService.getSupplierPurchases();
  }, [isOpen, supplier]);

  const allPayments = useMemo(() => {
    return StorageService.getSupplierPayments();
  }, [isOpen, supplier]);

  // Filtrar compras para este proveedor (por ID o por nombre insensible a mayúsculas)
  const supplierPurchases = useMemo(() => {
    if (!supplier) return [];
    const supName = (supplier.name || '').trim().toUpperCase();
    return allPurchases.filter(
      (p) =>
        p.supplier_id === supplier.id ||
        (p.supplier_name && p.supplier_name.trim().toUpperCase() === supName)
    );
  }, [supplier, allPurchases]);

  // Filtrar pagos para este proveedor
  const supplierPayments = useMemo(() => {
    if (!supplier) return [];
    const supName = (supplier.name || '').trim().toUpperCase();
    return allPayments.filter(
      (p) =>
        p.supplier_id === supplier.id ||
        (p.supplier_name && p.supplier_name.trim().toUpperCase() === supName)
    );
  }, [supplier, allPayments]);

  // Cálculos financieros
  const financials = useMemo(() => {
    if (!supplier) {
      return { totalPurchasedUsd: 0, totalPaidUsd: 0, currentDebtUsd: 0, totalOps: 0 };
    }

    const totalPurchasedUsd = supplierPurchases.reduce((sum, p) => sum + (p.cost_usd || 0), 0);
    const totalPaymentsUsd = supplierPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0);
    const totalCreditedOnPurchase = supplierPurchases.reduce((sum, p) => sum + (p.credited_amount || 0), 0);
    const totalPaidUsd = totalPaymentsUsd + totalCreditedOnPurchase;

    const currentDebtUsd = supplier.current_debt_usd || 0;
    const totalOps = supplierPurchases.length + supplierPayments.length;

    return {
      totalPurchasedUsd,
      totalPaidUsd,
      currentDebtUsd,
      totalOps,
    };
  }, [supplier, supplierPurchases, supplierPayments]);

  // Movimientos unificados ordenados cronológicamente (más recientes primero)
  const unifiedMovements = useMemo(() => {
    if (!supplier) return [];

    const list: Array<{
      id: string;
      originalId: string;
      type: 'COMPRA' | 'PAGO';
      date: string;
      timestamp: number;
      badgeLabel: string;
      badgeColor: string;
      dotColor: string;
      rowBorder: string;
      detail: React.ReactNode;
      totalCostFormatted: string;
      paidAmountFormatted: string;
      statusBadge: React.ReactNode;
      accountName: string;
      notes: string;
    }> = [];

    // 1. Compras de Inventario
    supplierPurchases.forEach((p) => {
      const targetAcc = accounts.find((a) => a.id === p.account_id);
      const isFullPaid = (p.credited_amount || 0) >= p.cost_usd;
      const isPartial = (p.credited_amount || 0) > 0 && (p.credited_amount || 0) < p.cost_usd;
      const isPending = (p.credited_amount || 0) === 0;

      list.push({
        id: `pur-${p.id}`,
        originalId: p.id,
        type: 'COMPRA',
        date: p.date,
        timestamp: recordTime(p),
        badgeLabel: `Compra ${p.currency}`,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        dotColor: 'bg-blue-500',
        rowBorder: 'border-l-4 border-l-blue-500',
        detail: (
          <div>
            <div className="font-semibold text-slate-800 flex items-center">
              <span className="text-[10px] font-bold text-indigo-700 mr-1.5 px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
                {p.currency}
              </span>
              {p.quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">Tasa Costo: {p.buy_price}</div>
          </div>
        ),
        totalCostFormatted: `$${p.cost_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
        paidAmountFormatted: p.credited_amount && p.credited_amount > 0 ? `+$${(p.credited_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD` : '$0.00 USD',
        statusBadge: isFullPaid ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Liquidado
          </span>
        ) : isPartial ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Abono Parcial
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Por Pagar
          </span>
        ),
        accountName: targetAcc ? `${targetAcc.name} (${targetAcc.currency})` : 'Sin cuenta vinculada',
        notes: p.notes || '-',
      });
    });

    // 2. Pagos y Abonos a Proveedores
    supplierPayments.forEach((pay) => {
      const debitAcc = accounts.find((a) => a.id === pay.account_id);

      list.push({
        id: `pay-${pay.id}`,
        originalId: pay.id,
        type: 'PAGO',
        date: pay.date,
        timestamp: recordTime(pay),
        badgeLabel: 'Pago a Proveedor',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
        rowBorder: 'border-l-4 border-l-emerald-500',
        detail: (
          <div>
            <div className="font-semibold text-emerald-800 flex items-center">
              <span className="text-[10px] font-bold text-emerald-700 mr-1.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                USD
              </span>
              Abono / Liquidación
            </div>
            {pay.reference && (
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">Ref: {pay.reference}</div>
            )}
          </div>
        ),
        totalCostFormatted: '-',
        paidAmountFormatted: `+$${pay.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
        statusBadge: (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Abonado
          </span>
        ),
        accountName: debitAcc ? `${debitAcc.name} (${debitAcc.currency})` : 'Pago Directo / Externo',
        notes: [pay.reference, pay.notes].filter(Boolean).join(' • ') || '-',
      });
    });

    return list.sort((a, b) => {
      if (b.date !== a.date) {
        return b.date.localeCompare(a.date);
      }
      return b.timestamp - a.timestamp;
    });
  }, [supplier, supplierPurchases, supplierPayments, accounts]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === 'COMPRAS') {
      return unifiedMovements.filter((m) => m.type === 'COMPRA');
    }
    if (movementFilter === 'PAGOS') {
      return unifiedMovements.filter((m) => m.type === 'PAGO');
    }
    return unifiedMovements;
  }, [unifiedMovements, movementFilter]);

  if (!isOpen || !supplier) return null;

  const handleShareVoucher = () => {
    if (!onOpenVoucher) return;
    const lastPayment = supplierPayments[0];

    onOpenVoucher({
      supplierName: supplier.name,
      type: supplier.type,
      contactInfo: supplier.contact_info,
      currentDebtUsd: financials.currentDebtUsd,
      totalPurchasedUsd: financials.totalPurchasedUsd,
      totalPaidUsd: financials.totalPaidUsd,
      purchasesCount: supplierPurchases.length,
      paymentsCount: supplierPayments.length,
      lastPaymentDate: lastPayment ? lastPayment.date : undefined,
      lastPaymentAmount: lastPayment ? lastPayment.amount_usd : undefined,
      lastPaymentReference: lastPayment ? lastPayment.reference : undefined,
      notes: supplier.notes,
    });
  };

  const handleDeleteMovement = async (mov: { type: 'COMPRA' | 'PAGO'; originalId: string }) => {
    if (mov.type === 'COMPRA') {
      if (confirm('¿Deseas revertir y eliminar esta compra de inventario? Se ajustarán saldos y la deuda del proveedor.')) {
        await StorageService.deleteSupplierPurchase(mov.originalId);
        if (onDataChange) onDataChange();
      }
    } else {
      if (confirm('¿Deseas revertir y eliminar este pago al proveedor? Se restaurará la deuda y el saldo de la cuenta.')) {
        await StorageService.deleteSupplierPayment(mov.originalId);
        if (onDataChange) onDataChange();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto my-auto">
        {/* Header del Modal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">{supplier.name}</h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {supplier.type}
              </span>
            </div>
            {supplier.contact_info ? (
              <div className="mt-2.5 p-2 rounded-lg contact-payment-box flex items-start space-x-2 text-xs">
                <Wallet className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <span className="font-semibold break-words leading-relaxed">
                  {supplier.contact_info}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Sin datos de contacto o cuenta registrada</p>
            )}
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {onEditSupplier && (
              <button
                type="button"
                onClick={() => onEditSupplier(supplier)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Editar</span>
              </button>
            )}

            {onDeleteSupplier && (
              <button
                type="button"
                onClick={() => onDeleteSupplier(supplier)}
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

        {/* Tarjetas de Resumen Financiero del Proveedor */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Comprado</span>
            <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">
              ${financials.totalPurchasedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400">Costo acumulado</span>
          </div>

          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Abonado / Pagado</span>
            <span className="text-lg font-black font-mono text-emerald-700 mt-0.5 block">
              ${financials.totalPaidUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-600">Fondos liquidados</span>
          </div>

          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              financials.currentDebtUsd > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <span
                className={`text-[10px] uppercase font-bold block ${
                  financials.currentDebtUsd > 0 ? 'text-rose-700' : 'text-slate-500'
                }`}
              >
                Saldo que Debemos
              </span>
              <span
                className={`text-lg font-black font-mono mt-0.5 block ${
                  financials.currentDebtUsd > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {financials.currentDebtUsd > 0 ? '-' : ''}${financials.currentDebtUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span
                className={`text-[10px] ${
                  financials.currentDebtUsd > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {financials.currentDebtUsd > 0 ? 'Cuenta por pagar' : 'Al día ($0.00)'}
              </span>
            </div>

            {onOpenPayment && (
              <button
                type="button"
                onClick={() => {
                  onOpenPayment(supplier);
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
              {financials.totalOps}
            </span>
            <span className="text-[10px] text-blue-600">Compras y pagos</span>
          </div>
        </div>

        {/* Historial Cronológico Unificado */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <span>Extracto Cronológico del Proveedor</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Línea de tiempo de compras y pagos • Las operaciones más recientes aparecen primero
              </p>
            </div>

            {/* Filtros de Tipo */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMovementFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  movementFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos ({unifiedMovements.length})
              </button>

              <button
                type="button"
                onClick={() => setMovementFilter('COMPRAS')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer ${
                  movementFilter === 'COMPRAS'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    movementFilter === 'COMPRAS' ? 'bg-white' : 'bg-blue-500'
                  }`}
                ></span>
                <span>Compras ({supplierPurchases.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementFilter('PAGOS')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer ${
                  movementFilter === 'PAGOS'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    movementFilter === 'PAGOS' ? 'bg-white' : 'bg-emerald-500'
                  }`}
                ></span>
                <span>Pagos / Abonos ({supplierPayments.length})</span>
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
                    <th className="p-2.5">Operación</th>
                    <th className="p-2.5">Detalle / Tasa</th>
                    <th className="p-2.5 text-right">Costo Total ($)</th>
                    <th className="p-2.5 text-right">Abono / Pagado ($)</th>
                    <th className="p-2.5">Estado</th>
                    <th className="p-2.5">Cuenta Vinculada</th>
                    <th className="p-2.5">Notas / Ref</th>
                    <th className="p-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredMovements.map((mov) => (
                    <tr key={mov.id} className={`hover:bg-slate-50/80 transition ${mov.rowBorder}`}>
                      <td className="p-2.5 font-sans text-slate-600 whitespace-nowrap">{mov.date}</td>
                      <td className="p-2.5 font-sans whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${mov.badgeColor}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${mov.dotColor}`}></span>
                          <span>{mov.badgeLabel}</span>
                        </span>
                      </td>
                      <td className="p-2.5 font-sans text-slate-700">{mov.detail}</td>
                      <td className="p-2.5 text-right font-black text-slate-900 whitespace-nowrap">
                        {mov.totalCostFormatted}
                      </td>
                      <td
                        className={`p-2.5 text-right font-bold whitespace-nowrap ${
                          mov.paidAmountFormatted && mov.paidAmountFormatted.startsWith('+')
                            ? 'text-emerald-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {mov.paidAmountFormatted}
                      </td>
                      <td className="p-2.5 font-sans whitespace-nowrap">{mov.statusBadge}</td>
                      <td className="p-2.5 font-sans text-slate-600 text-[11px] whitespace-nowrap">
                        {mov.accountName}
                      </td>
                      <td className="p-2.5 font-sans text-slate-500 text-[11px] max-w-xs truncate">
                        {mov.notes}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteMovement(mov)}
                          title="Eliminar movimiento"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {onOpenPayment && (
              <button
                type="button"
                onClick={() => onOpenPayment(supplier)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Registrar Nuevo Abono al Proveedor</span>
              </button>
            )}

            {onOpenVoucher && (
              <button
                type="button"
                onClick={handleShareVoucher}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-blue-600" />
                <span>Generar Comprobante Gráfico</span>
              </button>
            )}
          </div>

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
