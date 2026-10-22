'use client';

import React, { useState, useMemo } from 'react';
import {
  TransactionDetal,
  TransactionMayor,
  Expense,
  DailyClosure,
  Account,
  Debtor,
  Currency,
} from '@/types';
import { StorageService } from '@/lib/storage';
import { newestFirst } from '@/lib/order';
import {
  CalendarCheck2,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Landmark,
  Users,
  Camera,
  Search,
  Clock,
  Trash2,
  ArrowRight,
  ShieldCheck,
  History,
  Eye,
  Filter,
} from 'lucide-react';
import { localDateStr } from '@/lib/dates';

interface ClosuresProps {
  detalTxs: TransactionDetal[];
  mayorTxs: TransactionMayor[];
  expenses: Expense[];
  closures: DailyClosure[];
  accounts: Account[];
  debtors: Debtor[];
  onDataChange: () => void;
  appMode?: import('@/types').AppMode;
}

export function ClosuresView({
  detalTxs,
  mayorTxs,
  expenses,
  closures: closuresRaw,
  accounts,
  debtors,
  onDataChange,
  appMode,
}: ClosuresProps) {
  // El cierre más reciente arriba
  const closures = useMemo(() => newestFirst(closuresRaw), [closuresRaw]);
  const isDark = appMode === 'mayor';
  const todayStr = localDateStr();
  const [activeSubTab, setActiveSubTab] = useState<'profits' | 'accounts' | 'debtors'>('profits');

  // Estados para pestaña de Ganancias
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [closureNotes, setClosureNotes] = useState('');

  // Estados para pestaña de Corte de Cuentas
  const [selectedAccountsClosureId, setSelectedAccountsClosureId] = useState<string>('REALTIME');
  const [accountsSearch, setAccountsSearch] = useState('');
  const [accountsCurrencyFilter, setAccountsCurrencyFilter] = useState<string>('ALL');

  // Estados para pestaña de Corte de Deudores
  const [selectedDebtorsClosureId, setSelectedDebtorsClosureId] = useState<string>('REALTIME');
  const [debtorsSearch, setDebtorsSearch] = useState('');

  // Cálculos automáticos para la fecha seleccionada en Ganancias
  const daySummary = useMemo(() => {
    const profitDetal = detalTxs
      .filter((t) => t.date === selectedDate)
      .reduce((sum, t) => sum + (t.profit_usd || 0), 0);

    const profitMayor = mayorTxs
      .filter((t) => t.date === selectedDate)
      .reduce((sum, t) => sum + (t.profit_usd || 0), 0);

    const extraIncome = expenses
      .filter((e) => e.date === selectedDate && e.type === 'ingreso')
      .reduce((sum, e) => sum + (e.amount_usd || 0), 0);

    const totalExpenses = expenses
      .filter((e) => e.date === selectedDate && e.type !== 'ingreso')
      .reduce((sum, e) => sum + (e.amount_usd || 0), 0);

    const netProfit = profitDetal + profitMayor + extraIncome - totalExpenses;

    const detalCount = detalTxs.filter((t) => t.date === selectedDate).length;
    const mayorCount = mayorTxs.filter((t) => t.date === selectedDate).length;
    const extraCount = expenses.filter((e) => e.date === selectedDate && e.type === 'ingreso').length;
    const expensesCount = expenses.filter((e) => e.date === selectedDate && e.type !== 'ingreso').length;

    return {
      profitDetal: Number(profitDetal.toFixed(2)),
      profitMayor: Number(profitMayor.toFixed(2)),
      extraIncome: Number(extraIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      detalCount,
      mayorCount,
      extraCount,
      expensesCount,
    };
  }, [detalTxs, mayorTxs, expenses, selectedDate]);

  const existingClosure = closures.find((c) => c.date === selectedDate);

  // Guardar Cierre Oficial del Día (captura Ganancias + Snapshot Cuentas + Snapshot Deudores)
  const handleSaveClosure = () => {
    StorageService.addClosure(
      {
        date: selectedDate,
        profit_detal: daySummary.profitDetal,
        profit_mayor: daySummary.profitMayor,
        extra_income: daySummary.extraIncome,
        total_expenses: daySummary.totalExpenses,
        total_net_profit: daySummary.netProfit,
        notes: closureNotes || undefined,
      },
      accounts,
      debtors,
      appMode
    );
    setClosureNotes('');
    alert(`¡Cierre oficial y corte de saldos/deudores para el ${selectedDate} guardado con éxito!`);
    onDataChange();
  };

  // Eliminar un cierre
  const handleDeleteClosure = async (id: string, date: string) => {
    const reason = window.prompt(
      `Vas a REABRIR el día ${date} borrando su cierre.\n\n` +
        'Mientras esté abierto se podrán registrar, editar o anular operaciones con esa fecha. ' +
        'Escribe el motivo (quedará en la bitácora):'
    );
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert('Para reabrir un día hace falta un motivo.');
      return;
    }
    try {
      await StorageService.deleteClosure(id, appMode, reason);
    } catch {
      return;
    }
    onDataChange();
  };

  // Cierres que tienen snapshot de cuentas
  const closuresWithAccounts = useMemo(() => {
    return closures.filter((c) => c.accounts_snapshot && c.accounts_snapshot.length > 0);
  }, [closures]);

  // Cierres que tienen snapshot de deudores
  const closuresWithDebtors = useMemo(() => {
    return closures.filter((c) => c.debtors_snapshot && c.debtors_snapshot.length > 0);
  }, [closures]);

  // Datos de cuentas a mostrar (en tiempo real o de un corte congelado)
  const displayedAccountsData = useMemo(() => {
    if (selectedAccountsClosureId === 'REALTIME') {
      return {
        isRealtime: true,
        date: 'Tiempo Real (Hoy)',
        time: 'Actualizándose en vivo',
        accounts: accounts.map((a) => ({
          account_id: a.id,
          name: a.name,
          bank_name: a.bank_name,
          currency: a.currency,
          responsible: a.responsible,
          balance: Number(a.current_balance || 0),
        })),
      };
    }

    const found = closures.find((c) => c.id === selectedAccountsClosureId);
    if (!found || !found.accounts_snapshot) {
      return {
        isRealtime: false,
        date: found ? found.date : '',
        time: found ? new Date(found.closed_at).toLocaleTimeString('es-ES') : '',
        accounts: [],
      };
    }

    return {
      isRealtime: false,
      date: found.date,
      time: new Date(found.closed_at).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      accounts: found.accounts_snapshot,
    };
  }, [selectedAccountsClosureId, closures, accounts]);

  // Filtros aplicados a cuentas
  const filteredAccounts = useMemo(() => {
    return displayedAccountsData.accounts.filter((a) => {
      const matchSearch =
        accountsSearch === '' ||
        a.name.toLowerCase().includes(accountsSearch.toLowerCase()) ||
        a.bank_name.toLowerCase().includes(accountsSearch.toLowerCase()) ||
        a.responsible.toLowerCase().includes(accountsSearch.toLowerCase());

      const matchCurr =
        accountsCurrencyFilter === 'ALL' || a.currency === accountsCurrencyFilter;

      return matchSearch && matchCurr;
    });
  }, [displayedAccountsData, accountsSearch, accountsCurrencyFilter]);

  // Totales por moneda de cuentas en el corte seleccionado
  const accountsTotalsByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    displayedAccountsData.accounts.forEach((a) => {
      totals[a.currency] = (totals[a.currency] || 0) + (a.balance || 0);
    });
    return totals;
  }, [displayedAccountsData]);

  // Monedas disponibles en las cuentas
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    displayedAccountsData.accounts.forEach((a) => set.add(a.currency));
    return Array.from(set);
  }, [displayedAccountsData]);

  // Datos de deudores a mostrar (en tiempo real o de un corte congelado)
  const displayedDebtorsData = useMemo(() => {
    if (selectedDebtorsClosureId === 'REALTIME') {
      const activeDebtors = debtors.filter((d) => (d.current_debt || 0) !== 0);
      const total = activeDebtors.reduce((sum, d) => sum + (d.current_debt || 0), 0);
      return {
        isRealtime: true,
        date: 'Tiempo Real (Hoy)',
        time: 'Actualizándose en vivo',
        totalDebtorsUSD: Number(total.toFixed(2)),
        debtorsList: activeDebtors.map((d) => ({
          debtor_id: d.id,
          client_name: d.client_name,
          current_debt: Number(d.current_debt || 0),
          phone: d.phone,
        })),
      };
    }

    const found = closures.find((c) => c.id === selectedDebtorsClosureId);
    if (!found || !found.debtors_snapshot) {
      return {
        isRealtime: false,
        date: found ? found.date : '',
        time: found ? new Date(found.closed_at).toLocaleTimeString('es-ES') : '',
        totalDebtorsUSD: 0,
        debtorsList: [],
      };
    }

    return {
      isRealtime: false,
      date: found.date,
      time: new Date(found.closed_at).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      totalDebtorsUSD: found.total_debtors_usd || 0,
      debtorsList: found.debtors_snapshot,
    };
  }, [selectedDebtorsClosureId, closures, debtors]);

  // Filtro de deudores por búsqueda
  const filteredDebtors = useMemo(() => {
    return displayedDebtorsData.debtorsList.filter((d) => {
      return (
        debtorsSearch === '' ||
        d.client_name.toLowerCase().includes(debtorsSearch.toLowerCase()) ||
        (d.phone && d.phone.toLowerCase().includes(debtorsSearch.toLowerCase()))
      );
    });
  }, [displayedDebtorsData, debtorsSearch]);

  // Mapa de deudas actuales en tiempo real para comparar con cortes históricos
  const currentDebtorsMap = useMemo(() => {
    const map = new Map<string, number>();
    debtors.forEach((d) => {
      map.set(d.client_name.trim().toUpperCase(), d.current_debt || 0);
    });
    return map;
  }, [debtors]);

  return (
    <div className="space-y-5">
      {/* Selector de Sub-pestañas Compactas */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border shadow-sm ${
        isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => setActiveSubTab('profits')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'profits'
                ? 'bg-emerald-600 text-white shadow-sm'
                : isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>1. Ganancias del Día</span>
          </button>

          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'accounts'
                ? 'bg-blue-600 text-white shadow-sm'
                : isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>2. Corte de Cuentas (Arqueo)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('debtors')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'debtors'
                ? 'bg-purple-600 text-white shadow-sm'
                : isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>3. Corte de Deudores (Foto Deudas)</span>
          </button>
        </div>

        <div className={`text-[11px] font-medium hidden md:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Cierres inmutables históricos • Saldos y deudores operativos en tiempo real
        </div>
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: GANANCIAS DEL DÍA (CIERRE OPERATIVO)            */}
      {/* ========================================================= */}
      {activeSubTab === 'profits' && (
        <div className="space-y-6">
          {/* Tarjeta de Cálculo y Guardado */}
          <div className={`p-5 rounded-2xl border shadow-sm ${
            isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${
              isDark ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div>
                <h2 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <CalendarCheck2 className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span>Cierre Diario y Cuadre de Ganancias</span>
                </h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Fórmula oficial: CRIPTO/DOLAR + MONEDAS REGIONALES + Ingresos Extra - Gastos = Ganancia Neta
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Fecha del Cierre:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Desglose de Ganancias del Día */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-5">
              {/* Ganancia Detal */}
              <div className={`p-3.5 rounded-xl border transition ${
                isDark
                  ? 'bg-slate-800/90 border-slate-700/80'
                  : 'bg-emerald-50/60 border-emerald-100'
              }`}>
                <span className={`text-[11px] font-semibold uppercase ${
                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                }`}>
                  1. CRIPTO/DOLAR
                </span>
                <div className={`text-xl font-black font-mono mt-1 ${
                  isDark ? 'text-white' : 'text-emerald-900'
                }`}>
                  +${daySummary.profitDetal.toFixed(2)}
                </div>
                <span className={`text-[10px] ${
                  isDark ? 'text-slate-400' : 'text-emerald-600'
                }`}>
                  {daySummary.detalCount} operaciones
                </span>
              </div>

              {/* Ganancia Mayor */}
              <div className={`p-3.5 rounded-xl border transition ${
                isDark
                  ? 'bg-slate-800/90 border-slate-700/80'
                  : 'bg-indigo-50/60 border-indigo-100'
              }`}>
                <span className={`text-[11px] font-semibold uppercase ${
                  isDark ? 'text-indigo-400' : 'text-indigo-700'
                }`}>
                  2. MONEDAS REGIONALES
                </span>
                <div className={`text-xl font-black font-mono mt-1 ${
                  isDark ? 'text-white' : 'text-indigo-900'
                }`}>
                  +${daySummary.profitMayor.toFixed(2)}
                </div>
                <span className={`text-[10px] ${
                  isDark ? 'text-slate-400' : 'text-indigo-600'
                }`}>
                  {daySummary.mayorCount} operaciones
                </span>
              </div>

              {/* Ingresos Extra */}
              <div className={`p-3.5 rounded-xl border transition ${
                isDark
                  ? 'bg-slate-800/90 border-slate-700/80'
                  : 'bg-blue-50/60 border-blue-100'
              }`}>
                <span className={`text-[11px] font-semibold uppercase ${
                  isDark ? 'text-blue-400' : 'text-blue-700'
                }`}>
                  3. Ingresos Extra
                </span>
                <div className={`text-xl font-black font-mono mt-1 ${
                  isDark ? 'text-white' : 'text-blue-900'
                }`}>
                  +${daySummary.extraIncome.toFixed(2)}
                </div>
                <span className={`text-[10px] ${
                  isDark ? 'text-slate-400' : 'text-blue-600'
                }`}>
                  {daySummary.extraCount} adicionales
                </span>
              </div>

              {/* Gastos del Día */}
              <div className={`p-3.5 rounded-xl border transition ${
                isDark
                  ? 'bg-slate-800/90 border-slate-700/80'
                  : 'bg-rose-50/60 border-rose-100'
              }`}>
                <span className={`text-[11px] font-semibold uppercase ${
                  isDark ? 'text-rose-400' : 'text-rose-700'
                }`}>
                  4. Gastos
                </span>
                <div className={`text-xl font-black font-mono mt-1 ${
                  isDark ? 'text-rose-300' : 'text-rose-900'
                }`}>
                  -${daySummary.totalExpenses.toFixed(2)}
                </div>
                <span className={`text-[10px] ${
                  isDark ? 'text-slate-400' : 'text-rose-600'
                }`}>
                  {daySummary.expensesCount} egresos
                </span>
              </div>

              {/* Ganancia Neta Total */}
              <div className={`p-3.5 rounded-xl shadow-sm border ${
                isDark
                  ? 'bg-slate-900/90 border-slate-700 text-white'
                  : 'bg-slate-900 text-white border-transparent'
              }`}>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  = Ganancia Neta
                </span>
                <div
                  className={`text-xl font-black font-mono mt-1 ${
                    daySummary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {daySummary.netProfit >= 0 ? '+' : ''}${daySummary.netProfit.toFixed(2)} USD
                </div>
                <span className="text-[10px] text-slate-400">Total cuadre</span>
              </div>
            </div>

            {/* Guardar Cierre Oficial */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark
                ? 'bg-slate-800/90 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Notas u observaciones del cierre (opcional)..."
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex items-center space-x-3">
                {existingClosure && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Cierre guardado previamente</span>
                  </span>
                )}

                <button
                  onClick={handleSaveClosure}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Guardar Cierre Oficial (Foto Cuentas + Deudores)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Historial de Cierres Registrados */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <History className="w-4 h-4 text-slate-600" />
                <span>Histórico de Cierres Diarios Oficiales</span>
              </h3>
              <span className="text-xs text-slate-500 font-semibold">
                {closures.length} cierres registrados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Hora de Cierre</th>
                    <th className="py-2.5 px-3 text-right">CRIPTO/DOLAR</th>
                    <th className="py-2.5 px-3 text-right">MONEDAS REGIONALES</th>
                    <th className="py-2.5 px-3 text-right">Ingresos Extra</th>
                    <th className="py-2.5 px-3 text-right">Gastos</th>
                    <th className="py-2.5 px-3 text-right">Total Ganado ($)</th>
                    <th className="py-2.5 px-3 text-center">Instantáneas</th>
                    <th className="py-2.5 px-3">Notas</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {closures.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                        Aún no se han guardado cierres definitivos.
                      </td>
                    </tr>
                  ) : (
                    closures.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-semibold font-sans text-slate-800">{c.date}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">
                          {new Date(c.closed_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                          +${c.profit_detal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-600">
                          +${c.profit_mayor.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                          +${(c.extra_income || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                          -${c.total_expenses.toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black ${
                            c.total_net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {c.total_net_profit >= 0 ? '+' : ''}${c.total_net_profit.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1.5">
                            {c.accounts_snapshot && c.accounts_snapshot.length > 0 ? (
                              <button
                                onClick={() => {
                                  setSelectedAccountsClosureId(c.id);
                                  setActiveSubTab('accounts');
                                }}
                                title="Ver saldo de cuentas en este corte"
                                className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold transition flex items-center space-x-0.5"
                              >
                                <Landmark className="w-2.5 h-2.5" />
                                <span>{c.accounts_snapshot.length} ctas</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}

                            {c.debtors_snapshot && c.debtors_snapshot.length > 0 ? (
                              <button
                                onClick={() => {
                                  setSelectedDebtorsClosureId(c.id);
                                  setActiveSubTab('debtors');
                                }}
                                title="Ver foto de deudores en este corte"
                                className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-[10px] font-bold transition flex items-center space-x-0.5"
                              >
                                <Users className="w-2.5 h-2.5" />
                                <span>${(c.total_debtors_usd || 0).toFixed(0)}</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500 max-w-xs truncate">
                          {c.notes || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          <button
                            onClick={() => handleDeleteClosure(c.id, c.date)}
                            title="Eliminar este cierre"
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: CORTE DIARIO DE CUENTAS (ARQUEO DE CAJAS/BANCOS)  */}
      {/* ========================================================= */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-5">
          {/* Barra Superior: Selector de Corte Histórico vs Tiempo Real */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Landmark className="w-5 h-5 text-blue-600" />
                  <span>Corte Diario de Cuentas (Arqueo de Cajas y Bancos)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Consulta el saldo exacto que tenía cada cuenta en cualquier cierre pasado (congelado) o en vivo hoy.
                </p>
              </div>

              {/* Selector de Corte */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600">Ver Corte:</span>
                <select
                  value={selectedAccountsClosureId}
                  onChange={(e) => setSelectedAccountsClosureId(e.target.value)}
                  className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="REALTIME">🔴 Tiempo Real (Saldo Actual Hoy)</option>
                  {closuresWithAccounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      📁 Corte: {c.date} (
                      {new Date(c.closed_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      )
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner de Estado del Corte */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                displayedAccountsData.isRealtime
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-blue-50/70 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                {displayedAccountsData.isRealtime ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                )}
                <div>
                  <div className="text-xs font-bold">
                    {displayedAccountsData.isRealtime
                      ? 'Saldos en Tiempo Real (Operativo Actual)'
                      : `Corte Congelado: ${displayedAccountsData.date} a las ${displayedAccountsData.time}`}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {displayedAccountsData.isRealtime
                      ? 'Los saldos mostrados reflejan todas las transacciones hasta este instante.'
                      : 'Esta instantánea histórica está protegida y no cambia aunque hoy registres nuevos movimientos.'}
                  </div>
                </div>
              </div>

              {displayedAccountsData.isRealtime && (
                <button
                  onClick={handleSaveClosure}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Tomar Corte / Foto Oficial Ahora</span>
                </button>
              )}
            </div>

            {/* Resumen de Totales por Moneda en este Corte */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
              {Object.entries(accountsTotalsByCurrency).map(([curr, total]) => (
                <div key={curr} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{curr}</span>
                  <div
                    className={`text-sm font-black font-mono ${
                      total < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {total > 0 ? '+' : ''}{total.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Filtros de Cuentas: Búsqueda y Píldoras de Moneda */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar cuenta, banco o responsable..."
                  value={accountsSearch}
                  onChange={(e) => setAccountsSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setAccountsCurrencyFilter('ALL')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                    accountsCurrencyFilter === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas ({displayedAccountsData.accounts.length})
                </button>
                {availableCurrencies.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccountsCurrencyFilter(c)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                      accountsCurrencyFilter === c
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla de Cuentas en el Corte */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Cuenta / Nombre</th>
                    <th className="py-2.5 px-3">Banco / Plataforma</th>
                    <th className="py-2.5 px-3">Moneda</th>
                    <th className="py-2.5 px-3">Responsable</th>
                    <th className="py-2.5 px-4 text-right">Saldo en el Corte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        No se encontraron cuentas para este filtro o corte.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc, idx) => (
                      <tr key={acc.account_id || idx} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-semibold font-sans text-slate-900">
                          {acc.name}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">{acc.bank_name}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {acc.currency}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500">{acc.responsible}</td>
                        <td
                          className={`py-2.5 px-4 text-right font-black whitespace-nowrap ${
                            acc.balance < 0
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold mr-1.5 px-1.5 py-0.5 rounded border font-sans ${
                              acc.balance < 0
                                ? 'text-rose-700 bg-rose-50 border-rose-200'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            }`}
                          >
                            {acc.currency}
                          </span>
                          {acc.balance > 0 ? '+' : ''}{acc.balance.toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 3: CORTE DIARIO DE DEUDORES (FOTO HISTÓRICA DE DEUDAS) */}
      {/* ========================================================= */}
      {activeSubTab === 'debtors' && (
        <div className="space-y-5">
          {/* Barra Superior: Selector de Corte Histórico de Deudores */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <span>Corte Diario de Deudores (Foto Histórica de Deudas)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Verifica con exactitud cuánto te debía cada cliente en un corte pasado (ej. sábado) vs su saldo actual.
                </p>
              </div>

              {/* Selector de Corte */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600">Ver Corte:</span>
                <select
                  value={selectedDebtorsClosureId}
                  onChange={(e) => setSelectedDebtorsClosureId(e.target.value)}
                  className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="REALTIME">🔴 Tiempo Real (Deudas Actuales Hoy)</option>
                  {closuresWithDebtors.map((c) => (
                    <option key={c.id} value={c.id}>
                      📁 Corte: {c.date} (${(c.total_debtors_usd || 0).toFixed(2)} USD)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner de Estado del Corte */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                displayedDebtorsData.isRealtime
                  ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                {displayedDebtorsData.isRealtime ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                )}
                <div>
                  <div className="text-xs font-bold">
                    {displayedDebtorsData.isRealtime
                      ? 'Deudas en Tiempo Real (Hoy)'
                      : `Foto Histórica Congelada al ${displayedDebtorsData.date} (${displayedDebtorsData.time})`}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {displayedDebtorsData.isRealtime
                      ? 'Se actualiza en tiempo real con cada venta a crédito o abono registrado.'
                      : 'Esta lista no cambia. Refleja exactamente cuánto debía cada cliente en esa fecha/corte.'}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Total Deuda en este Corte
                  </span>
                  <div className="text-lg font-black font-mono text-purple-900">
                    ${displayedDebtorsData.totalDebtorsUSD.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    USD
                  </div>
                </div>
              </div>
            </div>

            {/* Buscador de Deudores */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar cliente deudor por nombre o teléfono..."
                  value={debtorsSearch}
                  onChange={(e) => setDebtorsSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                />
              </div>

              <span className="text-xs text-slate-500 font-semibold">
                {filteredDebtors.length} clientes con deuda en este corte
              </span>
            </div>
          </div>

          {/* Tabla de Deudores en el Corte */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Cliente Deudor</th>
                    <th className="py-2.5 px-3">Contacto / Teléfono</th>
                    <th className="py-2.5 px-4 text-right">
                      {displayedDebtorsData.isRealtime ? 'Deuda Actual ($ USD)' : 'Deuda en este Corte ($ USD)'}
                    </th>
                    {!displayedDebtorsData.isRealtime && (
                      <>
                        <th className="py-2.5 px-4 text-right">Deuda Actual Hoy</th>
                        <th className="py-2.5 px-4 text-center">Variación / Abonos</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredDebtors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={displayedDebtorsData.isRealtime ? 3 : 5}
                        className="py-8 text-center text-slate-400 font-sans"
                      >
                        No hay deudores registrados en este corte o con ese criterio de búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredDebtors.map((deb, idx) => {
                      const todayDebt = currentDebtorsMap.get(deb.client_name.trim().toUpperCase()) ?? 0;
                      const diff = todayDebt - deb.current_debt;

                      return (
                        <tr key={deb.debtor_id || idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-4 font-semibold font-sans text-slate-900">
                            {deb.client_name}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-500">
                            {deb.phone || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-purple-900">
                            ${deb.current_debt.toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            USD
                          </td>
                          {!displayedDebtorsData.isRealtime && (
                            <>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                                ${todayDebt.toLocaleString('es-ES', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                USD
                              </td>
                              <td className="py-2.5 px-4 text-center font-sans">
                                {diff === 0 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                    Sin cambios
                                  </span>
                                ) : diff < 0 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                                    Abonó ${(Math.abs(diff)).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">
                                    Aumentó +${diff.toFixed(2)}
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

