'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Navigation, TabKey } from '@/components/Navigation';
import { DashboardView } from '@/components/DashboardView';
import { DetalView } from '@/components/DetalView';
import { MayorView } from '@/components/MayorView';
import { SuppliersView } from '@/components/SuppliersView';
import { TransfersView } from '@/components/TransfersView';
import { ExpensesView } from '@/components/ExpensesView';
import { AccountsView } from '@/components/AccountsView';
import { ClosuresView } from '@/components/ClosuresView';
import { ClientsView } from '@/components/ClientsView';
import { DebtorsView } from '@/components/DebtorsView';
import { StorageService } from '@/lib/storage';
import { CLIENTES_EXCEL_DETAL } from '@/lib/clientes-excel-detal';
import { INITIAL_ACCOUNTS_MAYOR } from '@/lib/initial-data';
import { SupabaseSyncService } from '@/lib/supabase-sync';
import { RatesService } from '@/lib/rates-service';
import {
  Account,
  TransactionDetal,
  TransactionMayor,
  BalanceTransfer,
  Expense,
  DailyClosure,
  Debtor,
  Client,
  Supplier,
  AppMode,
} from '@/types';
import { useAuth } from '@/lib/auth-context';
import { LoginView } from '@/components/LoginView';

export default function Home() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [appMode, setAppMode] = useState<AppMode>('detal');
  const [isSyncingRates, setIsSyncingRates] = useState(false);
  const [lastRatesSync, setLastRatesSync] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [detalTxs, setDetalTxs] = useState<TransactionDetal[]>([]);
  const [mayorTxs, setMayorTxs] = useState<TransactionMayor[]>([]);
  const [transfers, setTransfers] = useState<BalanceTransfer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshData = useCallback((modeOverride?: AppMode) => {
    const currentMode = modeOverride || StorageService.getAppMode();
    setAccounts(StorageService.getAccounts(currentMode));
    setClients(StorageService.getClients(currentMode));
    setSuppliers(StorageService.getSuppliers(currentMode));
    setDetalTxs(StorageService.getTransactionsDetal(currentMode));
    setMayorTxs(StorageService.getTransactionsMayor(currentMode));
    setTransfers(StorageService.getTransfers(currentMode));
    setExpenses(StorageService.getExpenses(currentMode));
    setClosures(StorageService.getClosures(currentMode));
    setDebtors(StorageService.getDebtors(currentMode));
  }, []);

  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    StorageService.setAppMode(mode);
    RatesService.setAppMode(mode);
    refreshData(mode);
    StorageService.syncFromSupabase(mode)
      .then(() => refreshData(mode))
      .catch(() => {});
  };

  const handleSyncRates = async () => {
    setIsSyncingRates(true);
    await RatesService.syncRatesFromSheets();
    setLastRatesSync(RatesService.getLastSyncTime());
    setIsSyncingRates(false);
  };

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsLoaded(true);
    }, 1500);

    try {
      const initialMode = RatesService.getAppMode();
      StorageService.setAppMode(initialMode);
      setAppMode(initialMode);
      refreshData(initialMode);
      setLastRatesSync(RatesService.getLastSyncTime());

      // ── Seed automático clientes Excel → MODO MAYOR ──
      const FLAG_VIEJA = 'cambiosjk_excel_detal_imported_v1';
      const FLAG = 'cambiosjk_excel_mayor_imported_v1';

      // Limpiar importación errónea que se hizo en detal (si existe)
      if (typeof window !== 'undefined' && localStorage.getItem(FLAG_VIEJA)) {
        const clientesDetal = StorageService.getClients('detal');
        const sinImportados = clientesDetal.filter((c) => !c.id.startsWith('exc-'));
        StorageService.saveClients(sinImportados, 'detal');
        localStorage.removeItem(FLAG_VIEJA);
        console.log('[JK] Limpiados clientes importados erróneamente en detal');
      }
      // ──────────────────────────────────────────────────

      StorageService.syncFromSupabase(initialMode)
        .then(async () => {
          refreshData(initialMode);

          // Seed DESPUÉS del sync → no se sobreescribe
          if (typeof window !== 'undefined' && !localStorage.getItem(FLAG)) {
            const existentes = StorageService.getClients('mayor');
            const nombresExistentes = new Set(
              existentes.map((c) => (c.name || '').trim().toUpperCase())
            );
            const ahora = new Date().toISOString();
            const nuevos: import('@/types').Client[] = [];
            CLIENTES_EXCEL_DETAL.forEach((nombre, idx) => {
              const norm = (nombre || '').trim().toUpperCase();
              if (norm && !nombresExistentes.has(norm)) {
                nombresExistentes.add(norm);
                nuevos.push({
                  id: 'exc-' + idx,
                  name: nombre.trim(),
                  identification: '',
                  phone: '',
                  address: '',
                  preferred_account: '',
                  notes: '',
                  current_debt: 0,
                  created_at: ahora,
                });
              }
            });
            if (nuevos.length > 0) {
              const todos = [...existentes, ...nuevos];
              StorageService.saveClients(todos, 'mayor');
              // Subir a Supabase uno por uno (con ID determinista)
              for (const c of nuevos) {
                await SupabaseSyncService.upsertClient(c, 'mayor').catch(() => {});
              }
              refreshData('mayor');
            }
            localStorage.setItem(FLAG, '1');
            console.log(`[JK] Clientes Excel importados en MAYOR: ${nuevos.length} nuevos`);
          }
        })
        .catch(() => {});

      // ── Seed automático cuentas Excel → MODO MAYOR ──
      const FLAG_ACCOUNTS_MAYOR = 'cambiosjk_excel_mayor_accounts_imported_v1';
      if (typeof window !== 'undefined' && !localStorage.getItem(FLAG_ACCOUNTS_MAYOR)) {
        const cuentasMayorExistentes = StorageService.getAccounts('mayor');
        const nombresExistentes = new Set(
          cuentasMayorExistentes.map((a) => a.name.trim().toUpperCase())
        );
        const cuentasNuevas = [...cuentasMayorExistentes];
        let agregadas = 0;

        INITIAL_ACCOUNTS_MAYOR.forEach((acc) => {
          if (!nombresExistentes.has(acc.name.trim().toUpperCase())) {
            cuentasNuevas.push(acc);
            nombresExistentes.add(acc.name.trim().toUpperCase());
            agregadas++;
          }
        });

        if (agregadas > 0 || cuentasNuevas.length > 0) {
          StorageService.saveAccounts(cuentasNuevas, 'mayor');
          cuentasNuevas.forEach((acc) => {
            SupabaseSyncService.upsertAccount(acc, 'mayor').catch(() => {});
          });
        }
        localStorage.setItem(FLAG_ACCOUNTS_MAYOR, '1');
        console.log(`[JK] Cuentas Excel importadas en MODO MAYOR: ${agregadas} cuentas`);
        if (initialMode === 'mayor') {
          refreshData('mayor');
        }
      }
      // ──────────────────────────────────────────────────

      StorageService.syncFromSupabase(initialMode)
        .then(() => refreshData(initialMode))
        .catch(() => {});

      const otherMode = initialMode === 'detal' ? 'mayor' : 'detal';
      StorageService.syncFromSupabase(otherMode).catch(() => {});

      RatesService.syncRatesFromSheets()
        .then(() => {
          setLastRatesSync(RatesService.getLastSyncTime());
        })
        .catch((err) => {
          console.warn('Error sincronizando tasas en segundo plano:', err);
        });

      // Auto-sincronizar en tiempo real cuando el usuario regresa a la pestaña o cambia de ventana
      const handleWindowFocus = () => {
        const currentMode = StorageService.getAppMode();
        StorageService.syncFromSupabase(currentMode)
          .then(() => refreshData(currentMode))
          .catch(() => {});
        RatesService.syncRatesFromSheets()
          .then(() => setLastRatesSync(RatesService.getLastSyncTime()))
          .catch(() => {});
      };
      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleWindowFocus();
        }
      });

      // Auto-sincronizar Supabase en segundo plano cada 10 segundos para multi-dispositivo en vivo
      const supabaseInterval = setInterval(() => {
        const currentMode = StorageService.getAppMode();
        StorageService.syncFromSupabase(currentMode)
          .then(() => refreshData(currentMode))
          .catch(() => {});
      }, 10000);

      // Auto-sincronizar tasas de Google Sheets cada 60 segundos con anti-caché
      const ratesInterval = setInterval(() => {
        RatesService.syncRatesFromSheets()
          .then(() => setLastRatesSync(RatesService.getLastSyncTime()))
          .catch(() => {});
      }, 60000);

      return () => {
        clearTimeout(safetyTimer);
        window.removeEventListener('focus', handleWindowFocus);
        clearInterval(supabaseInterval);
        clearInterval(ratesInterval);
      };
    } catch (err) {
      console.error('Error al inicializar datos:', err);
    } finally {
      setIsLoaded(true);
      clearTimeout(safetyTimer);
    }

    return () => clearTimeout(safetyTimer);
  }, [refreshData]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#061528] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-300">Verificando sesión segura...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-medium text-sm space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-base font-semibold">Cargando Sistema Contable CAMBIOS JK...</span>
        </div>
        <p className="text-xs text-slate-400">Sincronizando cuentas, balances y tasas...</p>
        <button
          onClick={() => setIsLoaded(true)}
          className="mt-4 px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
        >
          Saltar carga
        </button>
      </div>
    );
  }

  const isDark = appMode === 'mayor';

  return (
    <div className={`min-h-screen flex flex-col selection:bg-emerald-500 selection:text-white transition-colors duration-300 ${isDark ? 'bg-[#0f172a]' : 'bg-slate-50'}`} data-theme={appMode}>
      <Header
        appMode={appMode}
        onModeChange={handleModeChange}
        onSyncRates={handleSyncRates}
        isSyncingRates={isSyncingRates}
        lastRatesSync={lastRatesSync}
        onResetSuccess={() => refreshData()}
      />


      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-16 md:pb-6">
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          appMode={appMode}
        />

        <main className="flex-1 p-4 md:p-6 w-full max-w-full overflow-hidden" data-theme={appMode}>
          {activeTab === 'dashboard' && (
            <DashboardView
              accounts={accounts}
              suppliers={suppliers}
              debtors={debtors}
              detalTxs={detalTxs}
              mayorTxs={mayorTxs}
              expenses={expenses}
              closures={closures}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'detal' && (
            <DetalView
              accounts={accounts}
              clients={clients}
              detalTxs={detalTxs}
              onDataChange={refreshData}
              appMode={appMode}
              onSyncRates={handleSyncRates}
              isSyncingRates={isSyncingRates}
              lastRatesSync={lastRatesSync}
            />
          )}

          {activeTab === 'mayor' && (
            <MayorView
              accounts={accounts}
              clients={clients}
              mayorTxs={mayorTxs}
              onDataChange={refreshData}
              appMode={appMode}
              onSyncRates={handleSyncRates}
              isSyncingRates={isSyncingRates}
              lastRatesSync={lastRatesSync}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              accounts={accounts}
              suppliers={suppliers}
              onDataChange={refreshData}
            />
          )}

          {activeTab === 'transfers' && (
            <TransfersView
              accounts={accounts}
              transfers={transfers}
              onDataChange={refreshData}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              accounts={accounts}
              expenses={expenses}
              onDataChange={refreshData}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsView accounts={accounts} onDataChange={refreshData} appMode={appMode} />
          )}

          {activeTab === 'closures' && (
            <ClosuresView
              detalTxs={detalTxs}
              mayorTxs={mayorTxs}
              expenses={expenses}
              closures={closures}
              accounts={accounts}
              debtors={debtors}
              onDataChange={refreshData}
              appMode={appMode}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsView
              clients={clients}
              accounts={accounts}
              debtors={debtors}
              detalTxs={detalTxs}
              mayorTxs={mayorTxs}
              onDataChange={refreshData}
              appMode={appMode}
            />
          )}

          {activeTab === 'debtors' && (
            <DebtorsView
              debtors={debtors}
              accounts={accounts}
              clients={clients}
              detalTxs={detalTxs}
              mayorTxs={mayorTxs}
              onDataChange={refreshData}
              appMode={appMode}
            />
          )}
        </main>
      </div>
    </div>
  );
}
