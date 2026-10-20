'use client';

import React from 'react';
import {
  LayoutDashboard,
  Coins,
  TrendingUp,
  Truck,
  ArrowLeftRight,
  Receipt,
  Wallet,
  CalendarCheck2,
  Users,
  UserCheck,
  Briefcase,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';

export type TabKey =
  | 'dashboard'
  | 'detal'
  | 'mayor'
  | 'suppliers'
  | 'transfers'
  | 'expenses'
  | 'payroll'
  | 'accounts'
  | 'closures'
  | 'clients'
  | 'debtors';

interface NavProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  appMode?: 'detal' | 'mayor';
}

export function Navigation({ activeTab, onSelectTab, appMode = 'detal' }: NavProps) {
  const { isAdmin, profile } = useAuth();
  const isDark = appMode === 'mayor';
  const modoPermitido = profile?.modo_permitido || 'ambos';

  const allTabs = [
    { key: 'dashboard' as TabKey, label: 'Panel', icon: LayoutDashboard },
    { key: 'mayor' as TabKey, label: 'Ventas', icon: TrendingUp },
    { key: 'detal' as TabKey, label: 'Cripto/Dolar', icon: Coins },
    { key: 'suppliers' as TabKey, label: 'Proveedores', icon: Truck },
    { key: 'transfers' as TabKey, label: 'Cambio Saldos', icon: ArrowLeftRight },
    { key: 'expenses' as TabKey, label: 'Ingresos/Gastos', icon: Receipt },
    { key: 'payroll' as TabKey, label: 'Nómina y Servicios', icon: Briefcase },
    { key: 'accounts' as TabKey, label: 'Cuentas', icon: Wallet },
    { key: 'closures' as TabKey, label: 'Cierre', icon: CalendarCheck2, adminOnly: true },
    { key: 'clients' as TabKey, label: 'Clientes', icon: UserCheck },
    { key: 'debtors' as TabKey, label: 'Deudores', icon: Users },
  ];

  const tabs = allTabs.filter((t) => {
    if (t.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <>
      {/* Barra lateral para PC */}
      <aside className={`hidden md:flex flex-col w-60 border-r p-3 space-y-1 min-h-[calc(100vh-61px)] transition-colors duration-300 ${
        isDark
          ? 'bg-[#0d1b2e] border-slate-700/60'
          : 'bg-white border-slate-200'
      }`}>
        <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Menú Principal
        </div>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectTab(tab.key)}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 font-semibold'
                  : isDark
                    ? 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isDark ? 'text-slate-500' : 'text-slate-500'}`} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Barra de navegación inferior móvil */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 border-t z-40 px-1 py-1 shadow-lg overflow-x-auto transition-colors duration-300 ${
        isDark
          ? 'bg-[#0d1b2e] border-slate-700'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-around min-w-[500px]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onSelectTab(tab.key)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
                  isActive
                    ? isDark
                      ? 'text-emerald-400 bg-emerald-900/30 font-bold'
                      : 'text-emerald-600 bg-emerald-50 font-bold'
                    : isDark
                      ? 'text-slate-500'
                      : 'text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="truncate max-w-[70px]">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
