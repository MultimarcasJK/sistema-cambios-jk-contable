'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Account,
  TransactionDetal,
  TransactionMayor,
  BalanceTransfer,
  Expense,
  SupplierPurchase,
  SupplierPayment,
  DebtPayment,
} from '@/types';
import { StorageService } from '@/lib/storage';
import { COUNTRIES_LIST, getAccountCountry } from '@/lib/countries';
import { exportAccountStatementToExcel, StatementRowExport } from '@/lib/excel-export';
import {
  X,
  FileText,
  Download,
  Printer,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Calendar,
  Wallet,
  Check,
  Copy,
  ArrowUpDown,
} from 'lucide-react';

export interface AccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  allAccounts: Account[];
  onSelectAccount?: (account: Account) => void;
}

export interface StatementMovement {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  sortKey: string;
  type: 'INGRESO' | 'EGRESO';
  categoryKey:
    | 'DETAL_IN'
    | 'DETAL_OUT'
    | 'MAYOR_IN'
    | 'MAYOR_OUT'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
    | 'EXPENSE'
    | 'INCOME'
    | 'SUPPLIER_BUY'
    | 'SUPPLIER_PAY'
    | 'DEBT_PAY';
  categoryLabel: string;
  description: string;
  thirdParty: string;
  reference: string;
  inflow: number;
  outflow: number;
  netAmount: number;
  balanceAfter: number;
}

export function AccountStatementModal({
  isOpen,
  onClose,
  account,
  allAccounts,
  onSelectAccount,
}: AccountStatementModalProps) {
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'INGRESO' | 'EGRESO'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  // Filtros de fecha
  const [datePreset, setDatePreset] = useState<
    'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'
  >('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Cuenta actual activa
  const currentAccount = account;

  // Manejar copiado de referencia
  const handleCopyRef = (refText: string) => {
    if (!refText || refText === 'S/R' || refText === '-') return;
    navigator.clipboard.writeText(refText);
    setCopiedRef(refText);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // 1. Cargar y compilar TODOS los movimientos de la cuenta seleccionada desde todas las fuentes
  const { allMovements, initialBaseBalance } = useMemo(() => {
    if (!currentAccount) {
      return { allMovements: [] as StatementMovement[], initialBaseBalance: 0 };
    }

    const accId = currentAccount.id;
    const items: StatementMovement[] = [];

    // A. Ventas Detal
    const detalTxs: TransactionDetal[] = [
      ...StorageService.getTransactionsDetal('detal'),
      ...StorageService.getTransactionsDetal('mayor'),
    ];
    detalTxs.forEach((tx) => {
      // 1. Entrada de dinero (Cobro al cliente)
      if (tx.received_account_id === accId && tx.amount_received > 0) {
        items.push({
          id: `detal-in-${tx.id}`,
          date: tx.date || (tx.created_at ? tx.created_at.slice(0, 10) : ''),
          time: tx.time || (tx.created_at ? tx.created_at.slice(11, 16) : ''),
          sortKey: `${tx.date || ''} ${tx.time || '00:00'} ${tx.created_at || ''} 1`,
          type: 'INGRESO',
          categoryKey: 'DETAL_IN',
          categoryLabel: 'Cobro Detal',
          description: `Venta Detal: Entrega de ${tx.usdt_amount} USDT`,
          thirdParty: tx.client_name ? `Cliente: ${tx.client_name}` : 'Cliente Detal',
          reference: tx.reference || 'S/R',
          inflow: tx.amount_received,
          outflow: 0,
          netAmount: tx.amount_received,
          balanceAfter: 0,
        });
      }

      // 2. Salida de dinero / Despacho de fondos
      if (tx.paid_account_id === accId && tx.usdt_amount > 0) {
        const out = tx.usdt_amount + (tx.bank_fee || 0);
        items.push({
          id: `detal-out-${tx.id}`,
          date: tx.date || (tx.created_at ? tx.created_at.slice(0, 10) : ''),
          time: tx.time || (tx.created_at ? tx.created_at.slice(11, 16) : ''),
          sortKey: `${tx.date || ''} ${tx.time || '00:00'} ${tx.created_at || ''} 2`,
          type: 'EGRESO',
          categoryKey: 'DETAL_OUT',
          categoryLabel: 'Despacho Detal',
          description: `Despacho Detal a cliente (${tx.usdt_amount} USDT${
            tx.bank_fee ? ` + Fee ${tx.bank_fee}` : ''
          })`,
          thirdParty: tx.client_name ? `Cliente: ${tx.client_name}` : 'Cliente Detal',
          reference: tx.reference || 'S/R',
          inflow: 0,
          outflow: out,
          netAmount: -out,
          balanceAfter: 0,
        });
      }
    });

    // B. Ventas Mayor
    const mayorTxs: TransactionMayor[] = [
      ...StorageService.getTransactionsMayor('mayor'),
      ...StorageService.getTransactionsMayor('detal'),
    ];
    mayorTxs.forEach((tx) => {
      // 1. Entrada de dinero (Cobro al cliente)
      const receivedAmt = tx.amount_received !== undefined ? tx.amount_received : 0;
      if (tx.received_account_id === accId && receivedAmt > 0) {
        items.push({
          id: `mayor-in-${tx.id}`,
          date: tx.date || (tx.created_at ? tx.created_at.slice(0, 10) : ''),
          time: tx.created_at ? tx.created_at.slice(11, 16) : '',
          sortKey: `${tx.date || ''} ${tx.created_at ? tx.created_at.slice(11, 16) : '00:00'} ${
            tx.created_at || ''
          } 1`,
          type: 'INGRESO',
          categoryKey: 'MAYOR_IN',
          categoryLabel: 'Cobro Mayor',
          description: `Cobro Venta Mayor (${tx.currency || 'VES'})`,
          thirdParty: tx.client_name ? `Cliente: ${tx.client_name}` : 'Cliente Mayor',
          reference: tx.reference || 'S/R',
          inflow: receivedAmt,
          outflow: 0,
          netAmount: receivedAmt,
          balanceAfter: 0,
        });
      }

      // 2. Salida de dinero (Desembolso)
      if (tx.paid_account_id === accId && tx.amount_ves > 0) {
        let totalOut = tx.amount_ves;
        if (currentAccount.currency === 'USD') {
          totalOut += tx.commission || 0;
        }
        items.push({
          id: `mayor-out-${tx.id}`,
          date: tx.date || (tx.created_at ? tx.created_at.slice(0, 10) : ''),
          time: tx.created_at ? tx.created_at.slice(11, 16) : '',
          sortKey: `${tx.date || ''} ${tx.created_at ? tx.created_at.slice(11, 16) : '00:00'} ${
            tx.created_at || ''
          } 2`,
          type: 'EGRESO',
          categoryKey: 'MAYOR_OUT',
          categoryLabel: 'Desembolso Mayor',
          description: `Desembolso Venta Mayor (${tx.currency || 'VES'} ${tx.amount_ves}${
            tx.commission ? ` + Com. ${tx.commission}` : ''
          })`,
          thirdParty: tx.client_name ? `Cliente: ${tx.client_name}` : 'Cliente Mayor',
          reference: tx.reference || 'S/R',
          inflow: 0,
          outflow: totalOut,
          netAmount: -totalOut,
          balanceAfter: 0,
        });
      }
    });

    // C. Transferencias entre Cuentas (Cambios de Saldo)
    const transfers: BalanceTransfer[] = [
      ...StorageService.getTransfers('detal'),
      ...StorageService.getTransfers('mayor'),
    ];
    transfers.forEach((trf) => {
      // 1. Salida (Cuenta Origen)
      if (trf.from_account_id === accId) {
        const toAcc = allAccounts.find((a) => a.id === trf.to_account_id);
        const totalOut = trf.amount_sent + (trf.commission || 0);
        items.push({
          id: `trf-out-${trf.id}`,
          date: trf.date || (trf.created_at ? trf.created_at.slice(0, 10) : ''),
          time: trf.created_at ? trf.created_at.slice(11, 16) : '',
          sortKey: `${trf.date || ''} ${trf.created_at ? trf.created_at.slice(11, 16) : '00:00'} ${
            trf.created_at || ''
          } 2`,
          type: 'EGRESO',
          categoryKey: 'TRANSFER_OUT',
          categoryLabel: 'Transferencia Enviada',
          description: `Traspaso enviado hacia ${toAcc ? toAcc.name : 'Otra Cuenta'}${
            trf.concept ? `: ${trf.concept}` : ''
          }`,
          thirdParty: toAcc ? `${toAcc.bank_name} (${toAcc.name})` : 'Otra Cuenta',
          reference: trf.reference || 'S/R',
          inflow: 0,
          outflow: totalOut,
          netAmount: -totalOut,
          balanceAfter: 0,
        });
      }

      // 2. Entrada (Cuenta Destino)
      if (trf.to_account_id === accId) {
        const fromAcc = allAccounts.find((a) => a.id === trf.from_account_id);
        items.push({
          id: `trf-in-${trf.id}`,
          date: trf.date || (trf.created_at ? trf.created_at.slice(0, 10) : ''),
          time: trf.created_at ? trf.created_at.slice(11, 16) : '',
          sortKey: `${trf.date || ''} ${trf.created_at ? trf.created_at.slice(11, 16) : '00:00'} ${
            trf.created_at || ''
          } 1`,
          type: 'INGRESO',
          categoryKey: 'TRANSFER_IN',
          categoryLabel: 'Transferencia Recibida',
          description: `Traspaso recibido de ${fromAcc ? fromAcc.name : 'Otra Cuenta'}${
            trf.concept ? `: ${trf.concept}` : ''
          }`,
          thirdParty: fromAcc ? `${fromAcc.bank_name} (${fromAcc.name})` : 'Otra Cuenta',
          reference: trf.reference || 'S/R',
          inflow: trf.amount_received,
          outflow: 0,
          netAmount: trf.amount_received,
          balanceAfter: 0,
        });
      }
    });

    // D. Gastos e Ingresos Varios
    const expenses: Expense[] = [
      ...StorageService.getExpenses('detal'),
      ...StorageService.getExpenses('mayor'),
    ];
    expenses.forEach((exp) => {
      if (exp.account_id === accId) {
        const isIngreso = exp.type === 'ingreso';
        items.push({
          id: `exp-${exp.id}`,
          date: exp.date || (exp.created_at ? exp.created_at.slice(0, 10) : ''),
          time: exp.created_at ? exp.created_at.slice(11, 16) : '',
          sortKey: `${exp.date || ''} ${exp.created_at ? exp.created_at.slice(11, 16) : '00:00'} ${
            exp.created_at || ''
          } ${isIngreso ? '1' : '2'}`,
          type: isIngreso ? 'INGRESO' : 'EGRESO',
          categoryKey: isIngreso ? 'INCOME' : 'EXPENSE',
          categoryLabel: isIngreso ? 'Ingreso Varios' : 'Gasto Operativo',
          description: exp.description || exp.concept || (isIngreso ? 'Ingreso Extra' : 'Gasto'),
          thirdParty: exp.concept ? `Concepto: ${exp.concept}` : 'Operación Interna',
          reference: 'S/R',
          inflow: isIngreso ? exp.amount : 0,
          outflow: isIngreso ? 0 : exp.amount,
          netAmount: isIngreso ? exp.amount : -exp.amount,
          balanceAfter: 0,
        });
      }
    });

    // E. Compras a Proveedores (Entrada de Inventario de Divisas/USDT a la cuenta)
    const supplierPurchases: SupplierPurchase[] = [
      ...StorageService.getSupplierPurchases('detal'),
      ...StorageService.getSupplierPurchases('mayor'),
    ];
    supplierPurchases.forEach((pur) => {
      if (pur.account_id === accId && pur.quantity > 0) {
        items.push({
          id: `pur-${pur.id}`,
          date: pur.date || (pur.created_at ? pur.created_at.slice(0, 10) : ''),
          time: pur.created_at ? pur.created_at.slice(11, 16) : '',
          sortKey: `${pur.date || ''} ${pur.created_at ? pur.created_at.slice(11, 16) : '00:00'} ${
            pur.created_at || ''
          } 1`,
          type: 'INGRESO',
          categoryKey: 'SUPPLIER_BUY',
          categoryLabel: 'Compra Proveedor',
          description: `Inventario recibido de proveedor (${pur.currency} ${pur.quantity})`,
          thirdParty: `Proveedor: ${pur.supplier_name}`,
          reference: pur.notes || 'S/R',
          inflow: pur.quantity,
          outflow: 0,
          netAmount: pur.quantity,
          balanceAfter: 0,
        });
      }
    });

    // F. Pagos a Proveedores (Salida de dinero de nuestra cuenta para pagar deuda)
    const supplierPayments: SupplierPayment[] = [
      ...StorageService.getSupplierPayments('detal'),
      ...StorageService.getSupplierPayments('mayor'),
    ];
    supplierPayments.forEach((pay) => {
      if (pay.account_id === accId && pay.amount_usd > 0) {
        items.push({
          id: `pay-${pay.id}`,
          date: pay.date || (pay.created_at ? pay.created_at.slice(0, 10) : ''),
          time: pay.created_at ? pay.created_at.slice(11, 16) : '',
          sortKey: `${pay.date || ''} ${pay.created_at ? pay.created_at.slice(11, 16) : '00:00'} ${
            pay.created_at || ''
          } 2`,
          type: 'EGRESO',
          categoryKey: 'SUPPLIER_PAY',
          categoryLabel: 'Pago a Proveedor',
          description: `Pago a proveedor ${pay.supplier_name}`,
          thirdParty: `Proveedor: ${pay.supplier_name}`,
          reference: pay.reference || pay.notes || 'S/R',
          inflow: 0,
          outflow: pay.amount_usd,
          netAmount: -pay.amount_usd,
          balanceAfter: 0,
        });
      }
    });

    // G. Cobros de Deudas / Abonos de Clientes Deudores
    const debtPayments: DebtPayment[] = [
      ...StorageService.getDebtPayments('detal'),
      ...StorageService.getDebtPayments('mayor'),
    ];
    debtPayments.forEach((dp) => {
      if (dp.account_id === accId) {
        const amt =
          dp.amount_currency && dp.amount_currency > 0 ? dp.amount_currency : dp.amount;
        if (amt > 0) {
          items.push({
            id: `debtpay-${dp.id}`,
            date: dp.date || (dp.created_at ? dp.created_at.slice(0, 10) : ''),
            time: dp.created_at ? dp.created_at.slice(11, 16) : '',
            sortKey: `${dp.date || ''} ${dp.created_at ? dp.created_at.slice(11, 16) : '00:00'} ${
              dp.created_at || ''
            } 1`,
            type: 'INGRESO',
            categoryKey: 'DEBT_PAY',
            categoryLabel: 'Abono Deuda Cliente',
            description: `Cobro / Abono de deuda de cliente ${dp.client_name}${
              dp.notes ? ` (${dp.notes})` : ''
            }`,
            thirdParty: `Cliente: ${dp.client_name}`,
            reference: dp.notes || 'S/R',
            inflow: amt,
            outflow: 0,
            netAmount: amt,
            balanceAfter: 0,
          });
        }
      }
    });

    // 2. Ordenar cronológicamente ascendente (desde el más antiguo al más reciente)
    // para construir el saldo progresivo acumulativo exacto
    items.sort((a, b) => (a.sortKey > b.sortKey ? 1 : a.sortKey < b.sortKey ? -1 : 0));

    // Saldo base histórico antes de los movimientos registrados:
    // Parte estrictamente del saldo inicial configurado de la cuenta (initial_balance) o 0.00
    const baseBalance = Number((currentAccount.initial_balance ?? 0).toFixed(4));

    // Calcular el saldo resultante progresivo línea por línea
    let runningBalance = baseBalance;
    const computedItems = items.map((item) => {
      runningBalance = Number((runningBalance + item.netAmount).toFixed(4));
      return {
        ...item,
        balanceAfter: runningBalance,
      };
    });

    return {
      allMovements: computedItems,
      initialBaseBalance: baseBalance,
    };
  }, [currentAccount, allAccounts]);

  // Reconciliación automática: si el saldo guardado en la cuenta difiere del saldo real acumulado de sus movimientos,
  // actualizarlo automáticamente para mantener la integridad contable en todo el sistema.
  useEffect(() => {
    if (!currentAccount) return;
    const finalCalculated =
      allMovements.length > 0
        ? allMovements[allMovements.length - 1].balanceAfter
        : Number((currentAccount.initial_balance ?? 0).toFixed(4));

    if (Math.abs((currentAccount.current_balance ?? 0) - finalCalculated) > 0.0001) {
      const m = (currentAccount.scope as any) || StorageService.getAppMode();
      StorageService.updateAccount(currentAccount.id, { current_balance: finalCalculated }, m);
    }
  }, [currentAccount, allMovements]);

  // Manejador de botones rápidos de fechas
  const handleApplyDatePreset = (
    preset: 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH'
  ) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'LAST_7') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(lastDay.toISOString().slice(0, 10));
    }
  };

  // 2. Filtrar movimientos según las opciones seleccionadas
  const filteredMovements = useMemo(() => {
    return allMovements.filter((m) => {
      // Filtro por Tipo (Ingreso / Egreso)
      if (selectedType !== 'ALL' && m.type !== selectedType) {
        return false;
      }

      // Filtro por Categoría
      if (selectedCategory !== 'ALL' && m.categoryKey !== selectedCategory) {
        return false;
      }

      // Filtro por Fechas
      if (startDate && m.date && m.date < startDate) {
        return false;
      }
      if (endDate && m.date && m.date > endDate) {
        return false;
      }

      // Filtro por Buscador de texto (cliente, concepto, referencia)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matches =
          m.description.toLowerCase().includes(query) ||
          m.thirdParty.toLowerCase().includes(query) ||
          m.reference.toLowerCase().includes(query) ||
          m.categoryLabel.toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [allMovements, selectedType, selectedCategory, startDate, endDate, searchTerm]);

  // Ordenar para la visualización (por defecto descendente: más recientes arriba)
  const displayedMovements = useMemo(() => {
    const list = [...filteredMovements];
    if (sortOrder === 'DESC') {
      return list.reverse();
    }
    return list;
  }, [filteredMovements, sortOrder]);

  // Resumen financiero del período filtrado
  const statementSummary = useMemo(() => {
    const totalInflows = filteredMovements.reduce((sum, m) => sum + m.inflow, 0);
    const totalOutflows = filteredMovements.reduce((sum, m) => sum + m.outflow, 0);

    // Saldo inicial del período: el saldo justo antes del primer movimiento filtrado
    let initialPeriodBalance = initialBaseBalance;
    if (filteredMovements.length > 0) {
      const firstMovement = filteredMovements[0];
      initialPeriodBalance = Number((firstMovement.balanceAfter - firstMovement.netAmount).toFixed(4));
    }

    // Saldo final del período: el saldo después del último movimiento filtrado
    let finalPeriodBalance = initialPeriodBalance;
    if (filteredMovements.length > 0) {
      const lastMovement = filteredMovements[filteredMovements.length - 1];
      finalPeriodBalance = lastMovement.balanceAfter;
    }

    let periodLabel = 'Histórico Completo';
    if (startDate && endDate) {
      periodLabel = `${startDate} al ${endDate}`;
    } else if (startDate) {
      periodLabel = `Desde ${startDate}`;
    } else if (endDate) {
      periodLabel = `Hasta ${endDate}`;
    }

    return {
      initialPeriodBalance,
      totalInflows,
      totalOutflows,
      finalPeriodBalance,
      periodLabel,
      totalCount: filteredMovements.length,
    };
  }, [filteredMovements, initialBaseBalance, currentAccount, startDate, endDate]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (!currentAccount) return;

    const rows: StatementRowExport[] = filteredMovements.map((m) => ({
      Fecha: m.date,
      Hora: m.time || '',
      Tipo: m.type === 'INGRESO' ? 'ENTRADA (+)' : 'SALIDA (-)',
      Categoría: m.categoryLabel,
      Descripción: m.description,
      'Tercero / Cliente / Proveedor': m.thirdParty,
      'Referencia Bancaria': m.reference,
      'Entradas (+)': m.inflow > 0 ? m.inflow : '',
      'Salidas (-)': m.outflow > 0 ? m.outflow : '',
      'Saldo Resultante': m.balanceAfter,
    }));

    exportAccountStatementToExcel(
      currentAccount.name,
      currentAccount.bank_name,
      currentAccount.currency,
      currentAccount.responsible,
      rows,
      {
        initialBalance: statementSummary.initialPeriodBalance,
        totalInflows: statementSummary.totalInflows,
        totalOutflows: statementSummary.totalOutflows,
        finalBalance: statementSummary.finalPeriodBalance,
        periodLabel: statementSummary.periodLabel,
      }
    );
  };

  // Imprimir / Generar PDF
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !currentAccount) return null;

  const countryInfo = COUNTRIES_LIST.find((c) => c.id === getAccountCountry(currentAccount));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Contenedor del Modal */}
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:max-h-none print:shadow-none print:border-none print:w-full">
        
        {/* CABECERA: Título, Datos de la Cuenta y Botones de Acción */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 print:bg-white print:text-black print:border-b-2 print:border-slate-800">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center flex-shrink-0 print:hidden">
              <Landmark className="w-6 h-6" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md bg-blue-500 text-white print:bg-black">
                  ESTADO DE CUENTA BANCARIO
                </span>

                {countryInfo?.iso2 && (
                  <div className="flex items-center space-x-1 text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700 print:text-black print:bg-slate-100">
                    <img
                      src={`https://flagcdn.com/w40/${countryInfo.iso2}.png`}
                      alt={countryInfo.name}
                      className="w-4 h-3 object-cover rounded-xs"
                    />
                    <span>{countryInfo.name}</span>
                  </div>
                )}

                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 print:bg-emerald-100 print:text-emerald-900">
                  {currentAccount.currency}
                </span>

                <span className="text-xs text-slate-200 print:text-slate-600">
                  Tipo: <strong className="text-white print:text-black uppercase font-bold">{currentAccount.type}</strong>
                </span>
              </div>

              <div className="flex items-center space-x-3 mt-1.5">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white print:text-black">
                  {currentAccount.name}
                </h2>

                {/* Selector rápido de otra cuenta */}
                {allAccounts.length > 1 && onSelectAccount && (
                  <select
                    value={currentAccount.id}
                    onChange={(e) => {
                      const found = allAccounts.find((a) => a.id === e.target.value);
                      if (found) onSelectAccount(found);
                    }}
                    className="text-xs bg-slate-800 border border-slate-600 text-white font-semibold rounded-lg px-2.5 py-1 hover:border-slate-400 focus:outline-none cursor-pointer print:hidden"
                    title="Cambiar de cuenta bancaria"
                  >
                    {allAccounts.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                        className="bg-slate-800 text-white py-1"
                      >
                        Cambiar a: {a.name} ({a.currency} - {a.bank_name})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <p className="text-xs text-slate-300 print:text-slate-600 mt-0.5">
                Banco / Plataforma: <span className="text-white print:text-black font-semibold">{currentAccount.bank_name}</span> • 
                Responsable: <span className="text-blue-300 print:text-black font-bold">{currentAccount.responsible}</span>
              </p>
            </div>
          </div>

          {/* Botones de acción superior */}
          <div className="flex items-center space-x-2 self-end md:self-center print:hidden">
            <button
              onClick={handleExportExcel}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
              title="Descargar Extracto en Excel (.xlsx)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition border border-slate-700 cursor-pointer"
              title="Imprimir extracto bancario o guardar como PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CUERPO CON SCROLL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/60 print:overflow-visible print:p-2 print:space-y-4">
          
          {/* TARJETAS DE RESUMEN CONTABLE DEL EXTRACTO */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Saldo Inicial del Período */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                Saldo Inicial
              </span>
              <div className="text-base sm:text-xl font-black font-mono text-slate-700 mt-1">
                {currentAccount.currency}{' '}
                {statementSummary.initialPeriodBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Al inicio del período</span>
            </div>

            {/* Total Entradas (+) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-700 block uppercase tracking-wider">
                  Total Entradas (+)
                </span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600 print:hidden" />
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-emerald-600 mt-1">
                +{currentAccount.currency}{' '}
                {statementSummary.totalInflows.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">Depósitos y cobros</span>
            </div>

            {/* Total Salidas (-) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-700 block uppercase tracking-wider">
                  Total Salidas (-)
                </span>
                <ArrowUpRight className="w-4 h-4 text-rose-600 print:hidden" />
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-rose-600 mt-1">
                -{currentAccount.currency}{' '}
                {statementSummary.totalOutflows.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-[10px] text-rose-700 mt-0.5 block">Pagos y desembolsos</span>
            </div>

            {/* Saldo Final / Disponible */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-800 block uppercase tracking-wider">
                  Saldo Disponible
                </span>
                <Wallet className="w-4 h-4 text-blue-600 print:hidden" />
              </div>
              <div
                className={`text-base sm:text-xl font-black font-mono mt-1 ${
                  statementSummary.finalPeriodBalance < 0
                    ? 'text-rose-600'
                    : 'text-blue-700'
                }`}
              >
                {currentAccount.currency}{' '}
                {statementSummary.finalPeriodBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">
                {statementSummary.totalCount} {statementSummary.totalCount === 1 ? 'movimiento' : 'movimientos'}
              </span>
            </div>
          </div>

          {/* BARRA DE FILTROS Y BÚSQUEDA (Oculto al imprimir) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 print:hidden">
            {/* Presets de Fecha */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-1 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Período:
                </span>

                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    datePreset === 'ALL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Histórico Completo
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('TODAY')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    datePreset === 'TODAY'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Hoy
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('LAST_7')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    datePreset === 'LAST_7'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Últimos 7 días
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('THIS_MONTH')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    datePreset === 'THIS_MONTH'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Este Mes
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('LAST_MONTH')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    datePreset === 'LAST_MONTH'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Mes Anterior
                </button>
              </div>

              {/* Rango Manual de Fechas */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400 font-medium">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('CUSTOM');
                  }}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 font-mono"
                />
                <span className="text-slate-400 font-medium">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('CUSTOM');
                  }}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 font-mono"
                />
              </div>
            </div>

            {/* Filtros secundarios y barra de búsqueda */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Tipo de movimiento */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSelectedType('ALL')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      selectedType === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType('INGRESO')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                      selectedType === 'INGRESO'
                        ? 'bg-emerald-600 text-white shadow-xs font-bold'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <span>Entradas (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType('EGRESO')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                      selectedType === 'EGRESO'
                        ? 'bg-rose-600 text-white shadow-xs font-bold'
                        : 'text-rose-700 hover:text-rose-900'
                    }`}
                  >
                    <span>Salidas (-)</span>
                  </button>
                </div>

                {/* Categoría / Operación */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none"
                >
                  <option value="ALL">Todas las operaciones</option>
                  <option value="DETAL_IN">Cobros Detal</option>
                  <option value="DETAL_OUT">Despachos Detal</option>
                  <option value="MAYOR_IN">Cobros Mayor</option>
                  <option value="MAYOR_OUT">Desembolsos Mayor</option>
                  <option value="TRANSFER_IN">Traspasos Recibidos</option>
                  <option value="TRANSFER_OUT">Traspasos Enviados</option>
                  <option value="EXPENSE">Gastos Operativos</option>
                  <option value="INCOME">Ingresos Varios</option>
                  <option value="SUPPLIER_BUY">Compras a Proveedores</option>
                  <option value="SUPPLIER_PAY">Pagos a Proveedores</option>
                  <option value="DEBT_PAY">Abonos de Deudores</option>
                </select>

                {/* Orden de visualización */}
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
                  className="flex items-center space-x-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl font-medium transition cursor-pointer"
                  title="Cambiar orden cronológico"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span>{sortOrder === 'DESC' ? 'Recientes primero' : 'Antiguos primero'}</span>
                </button>
              </div>

              {/* Buscador de texto */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cliente, ref, detalle..."
                  className="w-full text-xs pl-9 pr-8 py-1.5 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* TABLA DEL EXTRACTO BANCARIO (Línea por Línea) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-slate-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold tracking-wider text-[11px] uppercase print:bg-slate-100 print:text-black">
                    <th className="py-3 px-3.5 !text-white font-bold">Fecha / Hora</th>
                    <th className="py-3 px-3 !text-white font-bold">Operación</th>
                    <th className="py-3 px-3 !text-white font-bold">Descripción / Tercero</th>
                    <th className="py-3 px-3 !text-white font-bold">Referencia</th>
                    <th className="py-3 px-3 text-right !text-emerald-300 font-bold print:!text-emerald-800">Entradas (+)</th>
                    <th className="py-3 px-3 text-right !text-rose-300 font-bold print:!text-rose-800">Salidas (-)</th>
                    <th className="py-3 px-4 text-right !text-blue-200 font-bold print:!text-black">Saldo Resultante</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {displayedMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-700">No se encontraron movimientos</p>
                        <p className="text-xs text-slate-400 mt-1">
                          No hay transacciones registradas para esta cuenta con los filtros seleccionados.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayedMovements.map((m) => {
                      const isIngreso = m.type === 'INGRESO';
                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-blue-50/40 transition-colors duration-100 print:hover:bg-transparent"
                        >
                          {/* Fecha y Hora */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-800">{m.date}</div>
                            {m.time && <div className="text-[10px] text-slate-400">{m.time}</div>}
                          </td>

                          {/* Operación / Categoría */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                isIngreso
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {m.categoryLabel}
                            </span>
                          </td>

                          {/* Descripción / Tercero */}
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-800 line-clamp-1">{m.description}</p>
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                              {m.thirdParty}
                            </p>
                          </td>

                          {/* Referencia Bancaria */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {m.reference && m.reference !== 'S/R' && m.reference !== '-' ? (
                              <button
                                type="button"
                                onClick={() => handleCopyRef(m.reference)}
                                className="group flex items-center space-x-1 font-mono text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition cursor-pointer print:border-none print:bg-transparent"
                                title="Haga clic para copiar la referencia"
                              >
                                <span>{m.reference}</span>
                                {copiedRef === m.reference ? (
                                  <Check className="w-3 h-3 text-emerald-600 print:hidden" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 print:hidden" />
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-300 font-mono text-[11px]">S/R</span>
                            )}
                          </td>

                          {/* Entradas (+) */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                            {m.inflow > 0 ? (
                              <span>
                                +{m.inflow.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">-</span>
                            )}
                          </td>

                          {/* Salidas (-) */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                            {m.outflow > 0 ? (
                              <span>
                                -{m.outflow.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">-</span>
                            )}
                          </td>

                          {/* Saldo Progresivo Resultante */}
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                            <span
                              className={`${
                                m.balanceAfter < 0
                                  ? 'text-rose-600'
                                  : m.balanceAfter > 0
                                  ? 'text-slate-900'
                                  : 'text-slate-500'
                              }`}
                            >
                              {currentAccount.currency}{' '}
                              {m.balanceAfter.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pie de tabla */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 print:bg-white">
              <div>
                Mostrando <strong>{displayedMovements.length}</strong> de <strong>{allMovements.length}</strong> movimientos en total
              </div>
              <div className="flex items-center space-x-4 font-mono">
                <span>
                  Entradas: <strong className="text-emerald-700 font-bold">+{statementSummary.totalInflows.toFixed(2)}</strong>
                </span>
                <span>
                  Salidas: <strong className="text-rose-700 font-bold">-{statementSummary.totalOutflows.toFixed(2)}</strong>
                </span>
                <span>
                  Saldo Actual: <strong className="text-blue-700 font-bold">{currentAccount.currency} {currentAccount.current_balance.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA DEL MODAL */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between print:hidden">
          <p className="text-xs text-slate-500 hidden sm:block">
            Extracto contable para auditoría interna y conciliación con banca en línea.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition ml-auto cursor-pointer shadow-sm hover:shadow"
          >
            Cerrar Estado de Cuenta
          </button>
        </div>

      </div>
    </div>
  );
}
