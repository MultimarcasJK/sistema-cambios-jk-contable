'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Navigation, TabKey } from '@/components/Navigation';
import { DashboardView } from '@/components/DashboardView';
import { AnalyticsView } from '@/components/AnalyticsView';
import { DetalView } from '@/components/DetalView';
import { MayorView } from '@/components/MayorView';
import { SuppliersView } from '@/components/SuppliersView';
import { TransfersView } from '@/components/TransfersView';
import { ExpensesView } from '@/components/ExpensesView';
import { AccountsView } from '@/components/AccountsView';
import { ClosuresView } from '@/components/ClosuresView';
import { ClientsView } from '@/components/ClientsView';
import { DebtorsView } from '@/components/DebtorsView';
import { PayrollServicesView } from '@/components/PayrollServicesView';
import { ContabilidadView } from '@/components/ContabilidadView';
import { RemesasView } from '@/components/RemesasView';
import { FloatingScrollbar } from '@/components/FloatingScrollbar';
import { StorageService } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
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
  Employee,
  PayrollPayment,
  ServiceExpense,
  AppMode,
} from '@/types';
import { useAuth } from '@/lib/auth-context';
import { LoginView } from '@/components/LoginView';
import { UpdateBanner } from '@/components/UpdateBanner';
import { isDarkFor, themeAttrFor, useThemeChoice } from '@/lib/theme';

export default function Home() {
  useThemeChoice(); // vuelve a pintar al cambiar claro/oscuro
  const { user, profile, isLoading: isAuthLoading } = useAuth();
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollPayments, setPayrollPayments] = useState<PayrollPayment[]>([]);
  const [serviceExpenses, setServiceExpenses] = useState<ServiceExpense[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // Remesas del modo actual: se releen cada vez que cambian las cuentas (cobro, pago o anulación las mueven)
  const remesas = useMemo(() => (isLoaded ? StorageService.getRemesas(appMode) : []), [appMode, accounts, isLoaded]);
  // Cambia cada vez que se recargan las operaciones: el libro contable se recalcula con esto
  const dataVersion = useMemo(
    () => ({}),
    [accounts, detalTxs, mayorTxs, transfers, expenses, closures, debtors, suppliers, payrollPayments, serviceExpenses]
  );

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
    setEmployees(StorageService.getEmployees(currentMode));
    setPayrollPayments(StorageService.getPayrollPayments(currentMode));
    setServiceExpenses(StorageService.getServiceExpenses(currentMode));
  }, []);

  // Un intento de mover dinero en un día cerrado ya se avisó con una alerta; no es un fallo de la app
  useEffect(() => {
    const isDayLock = (e: unknown) => (e as Error | undefined)?.name === 'DiaCerradoError';
    const onRejection = (ev: PromiseRejectionEvent) => {
      if (isDayLock(ev.reason)) ev.preventDefault();
    };
    const onError = (ev: ErrorEvent) => {
      if (isDayLock(ev.error)) ev.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  const handleModeChange = useCallback((mode: AppMode) => {
    if (profile?.modo_permitido && profile.modo_permitido !== 'ambos') {
      if (mode !== profile.modo_permitido) {
        console.warn(`[JK] Acceso restringido al modo: ${profile.modo_permitido}`);
        return;
      }
    }
    setAppMode(mode);
    StorageService.setAppMode(mode);
    RatesService.setAppMode(mode);
    refreshData(mode);
    StorageService.syncFromSupabase(mode)
      .then(() => refreshData(mode))
      .catch(() => {});
  }, [profile?.modo_permitido, refreshData]);

  // Forzar modo permitido si el usuario no tiene acceso a 'ambos'
  useEffect(() => {
    if (profile?.modo_permitido && profile.modo_permitido !== 'ambos') {
      const allowed = profile.modo_permitido;
      if (appMode !== allowed) {
        handleModeChange(allowed);
      }
    }
  }, [profile?.modo_permitido, appMode, handleModeChange]);

  const handleSyncRates = async () => {
    setIsSyncingRates(true);
    await RatesService.syncRatesFromSheets();
    setLastRatesSync(RatesService.getLastSyncTime());
    setIsSyncingRates(false);
  };

  // Solo sincronizar con Supabase cuando hay sesión: sin login la base no entrega datos (RLS)
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const safetyTimer = setTimeout(() => {
      setIsLoaded(true);
    }, 1500);

    try {
      const initialMode = RatesService.getAppMode();
      StorageService.setAppMode(initialMode);
      setAppMode(initialMode);
      refreshData(initialMode);
      setLastRatesSync(RatesService.getLastSyncTime());

      // Limpiar importación errónea que se hizo en detal (si existe)
      const FLAG_VIEJA = 'cambiosjk_excel_detal_imported_v1';
      if (typeof window !== 'undefined' && localStorage.getItem(FLAG_VIEJA)) {
        const clientesDetal = StorageService.getClients('detal');
        const sinImportados = clientesDetal.filter((c) => !c.id.startsWith('exc-'));
        StorageService.saveClients(sinImportados, 'detal');
        localStorage.removeItem(FLAG_VIEJA);
        console.log('[JK] Limpiados clientes importados erróneamente en detal');
      }

      // Antes aquí se "sembraban" las cuentas del Excel en un navegador nuevo y se subían a
      // Supabase con saldo 0, pisando los saldos reales. Las cuentas ya existen en Supabase
      // y llegan con la sincronización de abajo.

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

      // Cuidar el presupuesto de disco de Supabase (plan Free): cada sincronización descarga
      // las tablas del modo, así que se evita repetirla sin necesidad.
      let ultimaSync = Date.now();
      const sincronizar = () => {
        ultimaSync = Date.now();
        const currentMode = StorageService.getAppMode();
        StorageService.syncFromSupabase(currentMode)
          .then(() => refreshData(currentMode))
          .catch(() => {});
      };

      // Al volver a la pestaña o a la ventana: sincronizar, pero como mucho una vez cada 30 s
      // (focus y visibilitychange llegan juntos y antes disparaban dos descargas completas).
      const handleWindowFocus = () => {
        if (Date.now() - ultimaSync >= 30000) sincronizar();
        RatesService.syncRatesFromSheets()
          .then(() => setLastRatesSync(RatesService.getLastSyncTime()))
          .catch(() => {});
      };
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          handleWindowFocus();
        }
      };
      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Respaldo cada 2 minutos (120,000 ms) y solo con la pestaña visible
      const supabaseInterval = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - ultimaSync < 110000) return;
        sincronizar();
      }, 120000);

      // Sincronización instantánea inteligente: Supabase avisa qué tabla cambió
      // y SOLO sincroniza esa tabla específica, evitando recargar todas las tablas juntas
      // Se juntan TODAS las tablas que avisan en el medio segundo (un pago a proveedor toca cuentas,
      // gastos, pagos y proveedores); antes solo se sincronizaba la última y las otras se perdían.
      let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
      const tablasPendientes = new Set<string>();
      const realtimeChannel = supabase
        ?.channel('jk-cambios')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const currentMode = StorageService.getAppMode();
          if (!payload.table?.startsWith(`${currentMode}_`)) return;
          if (payload.table === `${currentMode}_auditoria`) return;
          if (document.visibilityState !== 'visible') {
            ultimaSync = 0; // forzar sincronización al volver a la pestaña
            return;
          }
          tablasPendientes.add(payload.table);
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(() => {
            const tablas = Array.from(tablasPendientes);
            tablasPendientes.clear();
            StorageService.syncTableFromSupabase(tablas, currentMode)
              .then(() => refreshData(currentMode))
              .catch(() => {});
          }, 500);
        })
        .subscribe();

      // Auto-sincronizar tasas de Google Sheets cada 60 segundos con anti-caché
      const ratesInterval = setInterval(() => {
        RatesService.syncRatesFromSheets()
          .then(() => setLastRatesSync(RatesService.getLastSyncTime()))
          .catch(() => {});
      }, 60000);

      return () => {
        clearTimeout(safetyTimer);
        window.removeEventListener('focus', handleWindowFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(supabaseInterval);
        clearInterval(ratesInterval);
        if (realtimeTimer) clearTimeout(realtimeTimer);
        if (realtimeChannel) supabase?.removeChannel(realtimeChannel);
      };
    } catch (err) {
      console.error('Error al inicializar datos:', err);
    } finally {
      setIsLoaded(true);
      clearTimeout(safetyTimer);
    }

    return () => clearTimeout(safetyTimer);
  }, [refreshData, userId]);

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

  const isDark = isDarkFor(appMode);
  const themeAttr = themeAttrFor(appMode);

  return (
    <div className={`min-h-screen flex flex-col selection:bg-emerald-500 selection:text-white transition-colors duration-300 ${isDark ? 'bg-[#0f172a]' : 'bg-slate-50'}`} data-theme={themeAttr}>
      <FloatingScrollbar />
      <UpdateBanner />
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

        <main className="flex-1 p-4 md:p-6 w-full max-w-full overflow-hidden" data-theme={themeAttr}>
          {activeTab === 'dashboard' && (
            <DashboardView
              accounts={accounts}
              suppliers={suppliers}
              debtors={debtors}
              detalTxs={detalTxs}
              mayorTxs={mayorTxs}
              expenses={expenses}
              closures={closures}
              remesas={remesas}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'analisis' && profile?.rol === 'ADMIN' && (
            <AnalyticsView
              accounts={accounts}
              suppliers={suppliers}
              debtors={debtors}
              detalTxs={detalTxs}
              mayorTxs={mayorTxs}
              expenses={expenses}
              closures={closures}
              remesas={remesas}
              serviceExpenses={serviceExpenses}
              appMode={appMode}
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
              remesas={remesas}
              onDataChange={refreshData}
              appMode={appMode}
            />
          )}

          {activeTab === 'remesas' && (
            <RemesasView
              appMode={appMode}
              accounts={accounts}
              suppliers={suppliers}
              clients={clients}
              dataVersion={dataVersion}
              onDataChange={refreshData}
            />
          )}

          {activeTab === 'ledger' && (
            <ContabilidadView
              appMode={appMode}
              accounts={accounts}
              dataVersion={dataVersion}
              onDataChange={refreshData}
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

          {activeTab === 'payroll' && (
            <PayrollServicesView
              accounts={accounts}
              employees={employees}
              payrollPayments={payrollPayments}
              serviceExpenses={serviceExpenses}
              onDataChange={refreshData}
              appMode={appMode}
            />
          )}
        </main>
      </div>
    </div>
  );
}
