'use client';

import React, { useMemo } from 'react';
import {
  Account,
  TransactionDetal,
  TransactionMayor,
  Expense,
  DailyClosure,
  Supplier,
  Debtor,
} from '@/types';
import { CurrencyService } from '@/lib/currencies';
import { TabKey } from './Navigation';
import { formatCurrency } from '@/lib/formatters';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Wallet,
  Coins,
  ArrowLeftRight,
  PlusCircle,
  Truck,
  Users,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface DashboardProps {
  accounts: Account[];
  suppliers: Supplier[];
  debtors: Debtor[];
  detalTxs: TransactionDetal[];
  mayorTxs: TransactionMayor[];
  expenses: Expense[];
  closures: DailyClosure[];
  onNavigate: (tab: TabKey) => void;
}

export function DashboardView({
  accounts,
  suppliers,
  debtors,
  detalTxs,
  mayorTxs,
  expenses,
  closures,
  onNavigate,
}: DashboardProps) {
  const { isAdmin } = useAuth();
  const todayStr = new Date().toISOString().slice(0, 10);

  const systemCurrencies = useMemo(() => CurrencyService.getCurrencies(), []);

  // Totales por moneda dinámicos para todo el catálogo
  const totalsByCurrency = useMemo(() => {
    const res: Record<string, number> = { USD: 0, USDT: 0, VES: 0, COP: 0 };
    accounts.forEach((acc) => {
      const curr = acc.currency.toUpperCase();
      res[curr] = (res[curr] || 0) + (acc.current_balance || 0);
    });
    return res;
  }, [accounts]);

  // Lista de todas las monedas con cuentas o balance activo
  const activeCurrenciesWithBalances = useMemo(() => {
    const map = new Map<string, { code: string; name: string; symbol: string; balance: number; count: number }>();
    
    accounts.forEach((acc) => {
      const currCode = acc.currency.toUpperCase();
      const cfg = systemCurrencies.find((c) => c.code === currCode);
      const existing = map.get(currCode) || {
        code: currCode,
        name: cfg?.name || currCode,
        symbol: cfg?.symbol || '$',
        balance: 0,
        count: 0,
      };
      existing.balance += (acc.current_balance || 0);
      existing.count += 1;
      map.set(currCode, existing);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.code === 'USD') return -1;
      if (b.code === 'USD') return 1;
      if (a.code === 'USDT') return -1;
      if (b.code === 'USDT') return 1;
      return b.balance - a.balance;
    });
  }, [accounts, systemCurrencies]);

  // Ganancias y gastos de hoy
  const todayMetrics = useMemo(() => {
    const profitDetalToday = detalTxs
      .filter((t) => t.date === todayStr)
      .reduce((sum, t) => sum + (t.profit_usd || 0), 0);

    const volumeDetalToday = detalTxs
      .filter((t) => t.date === todayStr)
      .reduce((sum, t) => sum + (t.usdt_amount || 0), 0);

    const profitMayorToday = mayorTxs
      .filter((t) => t.date === todayStr)
      .reduce((sum, t) => sum + (t.profit_usd || 0), 0);

    const volumeMayorVesToday = mayorTxs
      .filter((t) => t.date === todayStr)
      .reduce((sum, t) => sum + (t.amount_ves || 0), 0);

    const extraIncomeToday = expenses
      .filter((e) => e.date === todayStr && e.type === 'ingreso')
      .reduce((sum, e) => sum + (e.amount_usd || 0), 0);

    const expensesToday = expenses
      .filter((e) => e.date === todayStr && e.type !== 'ingreso')
      .reduce((sum, e) => sum + (e.amount_usd || 0), 0);

    const netProfitToday = Number((profitDetalToday + profitMayorToday + extraIncomeToday - expensesToday).toFixed(2));

    return {
      profitDetalToday,
      volumeDetalToday,
      profitMayorToday,
      volumeMayorVesToday,
      extraIncomeToday,
      expensesToday,
      netProfitToday,
    };
  }, [detalTxs, mayorTxs, expenses, todayStr]);

  const totalDebtors = debtors.reduce((sum, d) => sum + (d.current_debt || 0), 0);
  const totalSuppliersDebt = suppliers.reduce((sum, s) => sum + (s.current_debt_usd || 0), 0);

  return (
    <div className="space-y-6">
      {/* Botones de acción rápida directos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Botón Cripto/Dolar oculto */}

        <button
          onClick={() => onNavigate('mayor')}
          className="flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Venta Regionales</span>
        </button>

        <button
          onClick={() => onNavigate('suppliers')}
          className="flex items-center justify-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition"
        >
          <Truck className="w-4 h-4" />
          <span>+ Compra Divisas</span>
        </button>

        <button
          onClick={() => onNavigate('transfers')}
          className="flex items-center justify-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition"
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Cambio Saldos</span>
        </button>

        <button
          onClick={() => onNavigate('expenses')}
          className="flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition col-span-2 sm:col-span-1"
        >
          <Receipt className="w-4 h-4" />
          <span>Ingreso/Gasto</span>
        </button>
      </div>

      {/* Tarjetas Principales de Saldos y Ganancias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ganancia Neta Hoy (Solo Admin) vs Operaciones Hoy (Operador) */}
        {isAdmin ? (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Ganancia Neta Hoy
              </span>
              <div className={`text-2xl font-black mt-1 ${todayMetrics.netProfitToday >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${formatCurrency(todayMetrics.netProfitToday, 2)} USD
              </div>
              <span className="text-xs text-slate-400">
                Cripto: +${formatCurrency(todayMetrics.profitDetalToday, 2)} | Reg.: +${formatCurrency(todayMetrics.profitMayorToday, 2)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Operaciones Realizadas Hoy
              </span>
              <div className="text-2xl font-black mt-1 text-emerald-400">
                {detalTxs.filter((t) => t.date === todayStr).length + mayorTxs.filter((t) => t.date === todayStr).length} ventas
              </div>
              <span className="text-xs text-slate-400">
                Cripto: {detalTxs.filter((t) => t.date === todayStr).length} | Reg.: {mayorTxs.filter((t) => t.date === todayStr).length}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* Saldo USD */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Saldo USD (Efectivo/Bancos)
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              ${formatCurrency(totalsByCurrency.USD, 2)}
            </div>
            <span className="text-xs text-slate-400">Caja + Pichincha + Zelle</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Saldo USDT */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Saldo USDT en Wallets
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              ₮{formatCurrency(totalsByCurrency.USDT, 2)}
            </div>
            <span className="text-xs text-slate-400">Binance + Tron</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Saldo Bolívares */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Stock Bolívares (VES)
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              Bs. {totalsByCurrency.VES.toLocaleString('es-VE', { minimumFractionDigits: 0 })}
            </div>
            <span className="text-xs text-slate-400">Banesco + Venezuela</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Disponibilidad Multimoneda Dinámica: Saldos en todas las monedas del catálogo */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Disponibilidad en Todas las Monedas ({activeCurrenciesWithBalances.length} divisas activas)
            </h3>
          </div>
          <button
            onClick={() => onNavigate('accounts')}
            className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Ver Arqueo Completo →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
          {activeCurrenciesWithBalances.map((curr) => (
            <div
              key={curr.code}
              onClick={() => onNavigate('accounts')}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700">{curr.code}</span>
                <span className="text-[10px] text-slate-400">{curr.count} cta{curr.count !== 1 ? 's' : ''}</span>
              </div>
              <div className="text-sm font-black text-slate-900 font-mono mt-1 truncate" title={`${curr.symbol} ${curr.balance.toLocaleString()}`}>
                {curr.symbol} {curr.balance.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{curr.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tarjetas Secundarias: Deudas y Proveedores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Proveedores */}
        <div
          onClick={() => onNavigate('suppliers')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-400 cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Cuentas por Pagar (Proveedores)
            </span>
            <div className="text-xl font-black text-rose-600 font-mono mt-1">
              ${formatCurrency(totalSuppliersDebt, 2)} USD
            </div>
            <span className="text-xs text-blue-600 font-semibold hover:underline">
              Ver Ronal, Gocho, Jesús →
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Deudores */}
        <div
          onClick={() => onNavigate('debtors')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Cuentas por Cobrar (Deudores)
            </span>
            <div className="text-xl font-black text-emerald-600 font-mono mt-1">
              ${formatCurrency(totalDebtors, 2)} USD
            </div>
            <span className="text-xs text-blue-600 font-semibold hover:underline">
              Ver clientes con deuda →
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Cuentas con Mayor Saldo y Últimas Operaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cuentas Principales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              <span>Cuentas con Mayor Saldo</span>
            </h3>
            <button
              onClick={() => onNavigate('accounts')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver todas ({accounts.length})
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {accounts
              .filter((a) => a.is_active !== false && a.current_balance !== 0)
              .sort((a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance))
              .slice(0, 6)
              .map((acc) => (
                <div key={acc.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-800">{acc.name}</div>
                    <div className="text-xs text-slate-400">
                      {acc.bank_name} • Resp: {acc.responsible}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-bold font-mono ${
                        acc.current_balance < 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {acc.currency} {acc.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Últimas Ventas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Últimas Ventas</span>
            </h3>
            <button
              onClick={() => onNavigate('mayor')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver todas
            </button>
          </div>

          {mayorTxs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No hay ventas registradas todavía.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {mayorTxs.slice(0, 5).map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-800">{tx.client_name}</div>
                    <div className="text-xs text-slate-400">
                      {tx.date} • {formatCurrency(tx.amount_ves)} {tx.currency || 'VES'} @ {tx.sell_price}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold font-mono ${tx.profit_usd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.profit_usd >= 0 ? `+$${formatCurrency(tx.profit_usd)}` : `-$${formatCurrency(Math.abs(tx.profit_usd))}`}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      ${formatCurrency(tx.total_to_pay)} USD
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
