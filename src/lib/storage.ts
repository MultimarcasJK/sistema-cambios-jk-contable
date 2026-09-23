import {
  Account,
  TransactionDetal,
  TransactionMayor,
  BalanceTransfer,
  Expense,
  DailyClosure,
  AccountSnapshot,
  DebtorSnapshot,
  Debtor,
  DebtPayment,
  Client,
  Supplier,
  SupplierPurchase,
  SupplierPayment,
  AppMode,
} from '@/types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_ACCOUNTS_DETAL,
  INITIAL_ACCOUNTS_MAYOR,
  INITIAL_DEBTORS,
  INITIAL_CLIENTS,
  INITIAL_CLIENTS_DETAL,
  INITIAL_CLIENTS_MAYOR,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIERS_DETAL,
  INITIAL_SUPPLIERS_MAYOR,
} from './initial-data';
import { SupabaseSyncService } from './supabase-sync';

let activeAppMode: AppMode = 'detal';

function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error('Error reading ' + key + ' from storage:', err);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Error saving ' + key + ' to storage:', err);
  }
}

export const StorageService = {
  getAppMode(): AppMode {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cambiosjk_app_mode') as AppMode;
      if (saved === 'detal' || saved === 'mayor') return saved;
    }
    return activeAppMode;
  },

  setAppMode(mode: AppMode): void {
    activeAppMode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('cambiosjk_app_mode', mode);
    }
  },

  // Dynamic Keys
  getAccountsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_accounts_v2';
  },
  getClientsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_clients_v2';
  },
  getSuppliersKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_suppliers_v2';
  },
  getTransfersKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_transfers_v2';
  },
  getExpensesKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_expenses_v2';
  },
  getClosuresKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_closures_v2';
  },
  getSupplierPurchasesKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_sup_purchases_v2';
  },
  getSupplierPaymentsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_sup_payments_v2';
  },
  getTransactionsDetalKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_txs_detal_v2';
  },
  getTransactionsMayorKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_txs_mayor_v2';
  },
  getDebtorsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_debtors_v2';
  },
  getDebtPaymentsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_debt_payments_v2';
  },

  // Migración automática de datos antiguos para separar César a Detal y María a Mayor
  migrateOldDataIfNeeded(): void {
    if (typeof window === 'undefined') return;
    const MIGRATED_FLAG = 'cambiosjk_data_split_v2_migrated';
    if (localStorage.getItem(MIGRATED_FLAG)) return;

    try {
      // 1. Migrar Transacciones Detal (César va a detal)
      const oldDetalRaw = localStorage.getItem('cambiosjk_detal_v1');
      if (oldDetalRaw) {
        const oldDetal = JSON.parse(oldDetalRaw) as TransactionDetal[];
        if (Array.isArray(oldDetal)) {
          const detalList: TransactionDetal[] = [];
          const mayorList: TransactionDetal[] = [];
          oldDetal.forEach((tx) => {
            const clientName = (tx.client_name || '').toUpperCase();
            if (clientName.includes('MARIA')) {
              mayorList.push(tx);
            } else {
              detalList.push(tx);
            }
          });
          saveToStorage(this.getTransactionsDetalKey('detal'), detalList);
          if (mayorList.length > 0) {
            saveToStorage(this.getTransactionsDetalKey('mayor'), mayorList);
          }
        }
      }

      // 2. Migrar Transacciones Mayor (María va a mayor)
      const oldMayorRaw = localStorage.getItem('cambiosjk_mayor_v1');
      if (oldMayorRaw) {
        const oldMayor = JSON.parse(oldMayorRaw) as TransactionMayor[];
        if (Array.isArray(oldMayor)) {
          const detalList: TransactionMayor[] = [];
          const mayorList: TransactionMayor[] = [];
          oldMayor.forEach((tx) => {
            const clientName = (tx.client_name || '').toUpperCase();
            if (clientName.includes('CESAR')) {
              detalList.push(tx);
            } else {
              mayorList.push(tx);
            }
          });
          if (detalList.length > 0) {
            saveToStorage(this.getTransactionsMayorKey('detal'), detalList);
          }
          saveToStorage(this.getTransactionsMayorKey('mayor'), mayorList);
        }
      }

      // 3. Migrar Deudores
      const oldDebtorsRaw = localStorage.getItem('cambiosjk_debtors_v1');
      if (oldDebtorsRaw) {
        const oldDebtors = JSON.parse(oldDebtorsRaw) as Debtor[];
        if (Array.isArray(oldDebtors)) {
          const detalDebtors = oldDebtors.filter((d) => !d.client_name.toUpperCase().includes('MARIA'));
          const mayorDebtors = oldDebtors.filter((d) => !d.client_name.toUpperCase().includes('CESAR'));
          saveToStorage(this.getDebtorsKey('detal'), detalDebtors);
          saveToStorage(this.getDebtorsKey('mayor'), mayorDebtors);
        }
      }

      // 4. Migrar Abonos
      const oldPaymentsRaw = localStorage.getItem('cambiosjk_debt_payments_v1');
      if (oldPaymentsRaw) {
        const oldPayments = JSON.parse(oldPaymentsRaw) as DebtPayment[];
        if (Array.isArray(oldPayments)) {
          const detalPayments = oldPayments.filter((p) => !p.client_name.toUpperCase().includes('MARIA'));
          const mayorPayments = oldPayments.filter((p) => !p.client_name.toUpperCase().includes('CESAR'));
          saveToStorage(this.getDebtPaymentsKey('detal'), detalPayments);
          saveToStorage(this.getDebtPaymentsKey('mayor'), mayorPayments);
        }
      }

      localStorage.setItem(MIGRATED_FLAG, 'true');
      console.log('[JK] Migración y separación de datos Detal / Mayor completada.');
    } catch (err) {
      console.error('[JK] Error durante migración de datos:', err);
    }
  },

  // Sincronización con Supabase en segundo plano
  async syncFromSupabase(mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    try {
      const [
        remoteAccs,
        remoteClients,
        remoteSuppliers,
        remoteTransfers,
        remoteExpenses,
        remoteClosures,
        remoteTxsDetal,
        remoteTxsMayor,
        remoteDebtors,
        remoteDebtPayments,
        remotePurchases,
        remoteSupplierPayments,
      ] = await Promise.all([
        SupabaseSyncService.fetchAccounts(m),
        SupabaseSyncService.fetchClients(m),
        SupabaseSyncService.fetchSuppliers(m),
        SupabaseSyncService.fetchTransfers(m),
        SupabaseSyncService.fetchExpenses(m),
        SupabaseSyncService.fetchClosures(m),
        SupabaseSyncService.fetchTransactionsDetal(m),
        SupabaseSyncService.fetchTransactionsMayor(m),
        SupabaseSyncService.fetchDebtors(m),
        SupabaseSyncService.fetchDebtPayments(m),
        SupabaseSyncService.fetchSupplierPurchases(m),
        SupabaseSyncService.fetchSupplierPayments(m),
      ]);

      if (remoteAccs !== null) {
        const local = this.getAccounts(m);
        const localMap = new Map<string, Account>();
        local.forEach((a) => {
          if (a && a.id) localMap.set(a.id, a);
          if (a && a.name) localMap.set(a.name.trim().toUpperCase(), a);
        });

        const mergedAccounts = remoteAccs.map((remote) => {
          const loc = localMap.get(remote.id) || localMap.get(remote.name.trim().toUpperCase());
          return {
            ...remote,
            account_subtype: remote.account_subtype || loc?.account_subtype || '',
            account_number: remote.account_number || loc?.account_number || '',
            notes: remote.notes || loc?.notes || '',
            scope: remote.scope || loc?.scope || m,
          };
        });

        saveToStorage(this.getAccountsKey(m), mergedAccounts);
      }
      if (remoteClients !== null) {
        const uniqueMap = new Map<string, Client>();
        remoteClients.forEach((c) => {
          if (!c || !c.name) return;
          const key = c.name.trim().toUpperCase();
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, c);
          } else {
            const existing = uniqueMap.get(key)!;
            // Preservar teléfono, cédula o deuda si la otra copia los tiene
            const updated: Client = {
              ...existing,
              phone: existing.phone || c.phone || '',
              identification: existing.identification || c.identification || '',
              current_debt: existing.current_debt || c.current_debt || 0,
            };
            uniqueMap.set(key, updated);
          }
        });
        const sorted = Array.from(uniqueMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        );
        saveToStorage(this.getClientsKey(m), sorted);
      }
      if (remoteSuppliers !== null) {
        saveToStorage(this.getSuppliersKey(m), remoteSuppliers);
      }
      if (remoteTransfers !== null) {
        saveToStorage(this.getTransfersKey(m), remoteTransfers);
      }
      if (remoteExpenses !== null) {
        saveToStorage(this.getExpensesKey(m), remoteExpenses);
      }
      if (remoteClosures !== null) {
        saveToStorage(this.getClosuresKey(m), remoteClosures);
      }
      if (remoteTxsDetal !== null) {
        const local = getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey(m), []);
        const remoteIds = new Set(remoteTxsDetal.map((t) => t.id));
        const localPending = local.filter((t) => !remoteIds.has(t.id));
        localPending.forEach((tx) => {
          SupabaseSyncService.upsertTransactionDetal(tx, m).catch(() => {});
        });
        const merged = [...remoteTxsDetal, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getTransactionsDetalKey(m), merged);
      }
      if (remoteTxsMayor !== null) {
        const local = getFromStorage<TransactionMayor[]>(this.getTransactionsMayorKey(m), []);
        const remoteIds = new Set(remoteTxsMayor.map((t) => t.id));
        const localPending = local.filter((t) => !remoteIds.has(t.id));
        localPending.forEach((tx) => {
          SupabaseSyncService.upsertTransactionMayor(tx, m).catch(() => {});
        });
        const merged = [...remoteTxsMayor, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getTransactionsMayorKey(m), merged);
      }
      if (remoteDebtors !== null) {
        saveToStorage(this.getDebtorsKey(m), remoteDebtors);
      }
      if (remoteDebtPayments !== null) {
        const local = getFromStorage<DebtPayment[]>(this.getDebtPaymentsKey(m), []);
        const remoteIds = new Set(remoteDebtPayments.map((p) => p.id));
        const localPending = local.filter((p) => !remoteIds.has(p.id));
        localPending.forEach((p) => {
          SupabaseSyncService.upsertDebtPayment(p, m).catch(() => {});
        });
        const merged = [...remoteDebtPayments, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getDebtPaymentsKey(m), merged);
      }
      if (remotePurchases !== null) {
        saveToStorage(this.getSupplierPurchasesKey(m), remotePurchases);
      }
      if (remoteSupplierPayments !== null) {
        saveToStorage(this.getSupplierPaymentsKey(m), remoteSupplierPayments);
      }
    } catch (err) {
      console.warn('[Sync ' + m + '] Sincronización secundaria pospuesta:', err);
    }
  },

  // Accounts
  getAccounts(mode?: AppMode): Account[] {
    const m = mode || this.getAppMode();
    const key = this.getAccountsKey(m);
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item !== null) {
        try {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) {
            return parsed.map((acc: any) => ({
              ...acc,
              current_balance: Number(acc.current_balance) || 0,
              is_active: acc.is_active !== undefined && acc.is_active !== null ? Boolean(acc.is_active) : true,
            }));
          }
        } catch {
          // ignore
        }
      }
    }
    const initial = m === 'mayor' ? INITIAL_ACCOUNTS_MAYOR : INITIAL_ACCOUNTS_DETAL;
    if (initial && initial.length > 0) {
      saveToStorage(key, initial);
      return initial;
    }
    saveToStorage(key, []);
    return [];
  },


  saveAccounts(accounts: Account[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    saveToStorage(this.getAccountsKey(m), accounts);
  },

  updateAccount(accountId: string, updates: Partial<Account>, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const accounts = this.getAccounts(m);
    let updatedAcc: Account | null = null;
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        updatedAcc = { ...acc, ...updates };
        return updatedAcc;
      }
      return acc;
    });
    this.saveAccounts(updated, m);
    if (updatedAcc) {
      SupabaseSyncService.upsertAccount(updatedAcc, m).catch(() => {});
    }
  },

  deleteAccount(accountId: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const accounts = this.getAccounts(m);
    const updated = accounts.filter((acc) => acc.id !== accountId);
    this.saveAccounts(updated, m);
    SupabaseSyncService.deleteAccount(accountId, m).catch(() => {});
  },

  updateAccountBalance(accountId: string, delta: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const accounts = this.getAccounts(m);
    let updatedAcc: Account | null = null;
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        updatedAcc = {
          ...acc,
          current_balance: Number((acc.current_balance + delta).toFixed(4)),
        };
        return updatedAcc;
      }
      return acc;
    });
    this.saveAccounts(updated, m);
    if (updatedAcc) {
      SupabaseSyncService.upsertAccount(updatedAcc, m).catch(() => {});
    }
  },

  // Clients
  getClients(mode?: AppMode): Client[] {
    const m = mode || this.getAppMode();
    const key = this.getClientsKey(m);
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item !== null) {
        try {
          return JSON.parse(item) || [];
        } catch {
          return [];
        }
      }
    }
    saveToStorage(key, []);
    return [];
  },

  saveClients(clients: Client[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    saveToStorage(this.getClientsKey(m), clients);
  },

  addClient(client: Omit<Client, 'id' | 'created_at'>, mode?: AppMode): Client {
    const m = mode || this.getAppMode();
    const all = this.getClients(m);
    const upperName = (client.name || '').trim().toUpperCase();
    const existing = all.find((c) => (c.name || '').trim().toUpperCase() === upperName);
    if (existing) {
      this.updateClient(existing.id, client, m);
      return { ...existing, ...client };
    }
    const newClient: Client = {
      ...client,
      id: 'cli-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newClient);
    this.saveClients(all, m);
    SupabaseSyncService.upsertClient(newClient, m).catch(() => {});
    return newClient;
  },

  updateClient(clientId: string, updates: Partial<Client>, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getClients(m);
    let updatedClient: Client | null = null;
    const updated = all.map((c) => {
      if (c.id === clientId) {
        updatedClient = { ...c, ...updates };
        return updatedClient;
      }
      return c;
    });
    this.saveClients(updated, m);
    if (updatedClient) {
      SupabaseSyncService.upsertClient(updatedClient, m).catch(() => {});
    }
  },

  deleteClient(clientId: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getClients(m);
    const updated = all.filter((c) => c.id !== clientId);
    this.saveClients(updated, m);
    SupabaseSyncService.deleteClient(clientId, m).catch(() => {});
  },

  // Suppliers & Purchases
  getSuppliers(mode?: AppMode): Supplier[] {
    const m = mode || this.getAppMode();
    const key = this.getSuppliersKey(m);
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item !== null) {
        try {
          return JSON.parse(item) || [];
        } catch {
          return [];
        }
      }
    }
    saveToStorage(key, []);
    return [];
  },



  saveSuppliers(suppliers: Supplier[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    saveToStorage(this.getSuppliersKey(m), suppliers);
  },

  updateSupplierDebt(supplierId: string, deltaUsd: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const suppliers = this.getSuppliers(m);
    let updatedSup: Supplier | null = null;
    const updated = suppliers.map((s) => {
      if (s.id === supplierId) {
        updatedSup = {
          ...s,
          current_debt_usd: Number((s.current_debt_usd + deltaUsd).toFixed(2)),
        };
        return updatedSup;
      }
      return s;
    });
    this.saveSuppliers(updated, m);
    if (updatedSup) {
      SupabaseSyncService.upsertSupplier(updatedSup, m).catch(() => {});
    }
  },

  addSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>, mode?: AppMode): Supplier {
    const m = mode || this.getAppMode();
    const all = this.getSuppliers(m);
    const newSupplier: Supplier = {
      ...supplier,
      id: 'sup-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newSupplier);
    this.saveSuppliers(all, m);
    SupabaseSyncService.upsertSupplier(newSupplier, m).catch(() => {});
    return newSupplier;
  },

  updateSupplier(supplierId: string, updates: Partial<Supplier>, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getSuppliers(m);
    let updatedSup: Supplier | null = null;
    const updated = all.map((s) => {
      if (s.id === supplierId) {
        updatedSup = { ...s, ...updates };
        return updatedSup;
      }
      return s;
    });
    this.saveSuppliers(updated, m);
    if (updatedSup) {
      SupabaseSyncService.upsertSupplier(updatedSup, m).catch(() => {});
    }
  },

  deleteSupplier(supplierId: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getSuppliers(m);
    const updated = all.filter((s) => s.id !== supplierId);
    this.saveSuppliers(updated, m);
    SupabaseSyncService.deleteSupplier(supplierId, m).catch(() => {});
  },

  getSupplierPurchases(mode?: AppMode): SupplierPurchase[] {
    const m = mode || this.getAppMode();
    return getFromStorage<SupplierPurchase[]>(this.getSupplierPurchasesKey(m), []);
  },

  addSupplierPurchase(purchase: Omit<SupplierPurchase, 'id' | 'created_at'>, mode?: AppMode): SupplierPurchase {
    const m = mode || this.getAppMode();
    const all = this.getSupplierPurchases(m);
    const newPurchase: SupplierPurchase = {
      ...purchase,
      id: 'pur-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newPurchase);
    saveToStorage(this.getSupplierPurchasesKey(m), all);

    const netDebtIncrease = newPurchase.cost_usd - newPurchase.credited_amount;
    this.updateSupplierDebt(newPurchase.supplier_id, netDebtIncrease, m);

    if (newPurchase.account_id && newPurchase.quantity > 0) {
      this.updateAccountBalance(newPurchase.account_id, newPurchase.quantity, m);
    }

    SupabaseSyncService.upsertSupplierPurchase(newPurchase, m).catch(() => {});
    return newPurchase;
  },

  getSupplierPayments(mode?: AppMode): SupplierPayment[] {
    const m = mode || this.getAppMode();
    return getFromStorage<SupplierPayment[]>(this.getSupplierPaymentsKey(m), []);
  },

  addSupplierPayment(payment: Omit<SupplierPayment, 'id' | 'created_at'>, mode?: AppMode): SupplierPayment {
    const m = mode || this.getAppMode();
    const all = this.getSupplierPayments(m);
    const newPayment: SupplierPayment = {
      ...payment,
      id: 'pay-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newPayment);
    saveToStorage(this.getSupplierPaymentsKey(m), all);

    this.updateSupplierDebt(newPayment.supplier_id, -newPayment.amount_usd, m);

    if (newPayment.account_id && newPayment.amount_usd > 0) {
      this.updateAccountBalance(newPayment.account_id, -newPayment.amount_usd, m);
    }

    SupabaseSyncService.upsertSupplierPayment(newPayment, m).catch(() => {});
    return newPayment;
  },

  deleteSupplierPurchase(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getSupplierPurchases(m);
    const purchase = all.find((p) => p.id === id);
    if (purchase) {
      const netDebtIncrease = purchase.cost_usd - (purchase.credited_amount || 0);
      this.updateSupplierDebt(purchase.supplier_id, -netDebtIncrease, m);
      if (purchase.account_id && purchase.quantity > 0) {
        this.updateAccountBalance(purchase.account_id, -purchase.quantity, m);
      }
    }
    saveToStorage(this.getSupplierPurchasesKey(m), all.filter((p) => p.id !== id));
    SupabaseSyncService.deleteSupplierPurchase(id, m).catch(() => {});
  },

  deleteSupplierPayment(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getSupplierPayments(m);
    const payment = all.find((p) => p.id === id);
    if (payment) {
      this.updateSupplierDebt(payment.supplier_id, payment.amount_usd, m);
      if (payment.account_id && payment.amount_usd > 0) {
        this.updateAccountBalance(payment.account_id, payment.amount_usd, m);
      }
    }
    saveToStorage(this.getSupplierPaymentsKey(m), all.filter((p) => p.id !== id));
    SupabaseSyncService.deleteSupplierPayment(id, m).catch(() => {});
  },

  // Detal Transactions (Ventas Cripto / Dólar) - 100% aisladas por modo
  getTransactionsDetal(mode?: AppMode): TransactionDetal[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    return getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey(m), []);
  },

  addTransactionDetal(tx: Omit<TransactionDetal, 'id' | 'created_at'>, mode?: AppMode): TransactionDetal {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsDetal(m);
    const newTx: TransactionDetal = {
      ...tx,
      id: 'detal-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newTx);
    saveToStorage(this.getTransactionsDetalKey(m), all);

    if (newTx.received_account_id && newTx.received_account_id !== 'POR_COBRAR' && newTx.amount_received > 0) {
      this.updateAccountBalance(newTx.received_account_id, newTx.amount_received, m);
    }
    if (newTx.paid_account_id && newTx.usdt_amount > 0) {
      const totalOut = newTx.usdt_amount + (newTx.bank_fee || 0);
      this.updateAccountBalance(newTx.paid_account_id, -totalOut, m);
    }

    const unpaid = Number(((newTx.total_to_pay || 0) - (newTx.amount_received || 0)).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(newTx.client_name, unpaid, m);
    }

    SupabaseSyncService.upsertTransactionDetal(newTx, m).catch(() => {});
    return newTx;
  },

  deleteTransactionDetal(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsDetal(m);
    const tx = all.find((t) => t.id === id);
    if (tx) {
      const unpaid = Number(((tx.total_to_pay || 0) - (tx.amount_received || 0)).toFixed(2));
      if (unpaid > 0) {
        this.increaseClientDebt(tx.client_name, -unpaid, m);
      }
      if (tx.received_account_id && tx.received_account_id !== 'POR_COBRAR' && tx.amount_received > 0) {
        this.updateAccountBalance(tx.received_account_id, -tx.amount_received, m);
      }
      if (tx.paid_account_id && tx.usdt_amount > 0) {
        const totalOut = tx.usdt_amount + (tx.bank_fee || 0);
        this.updateAccountBalance(tx.paid_account_id, totalOut, m);
      }
    }
    saveToStorage(this.getTransactionsDetalKey(m), all.filter((t) => t.id !== id));
    SupabaseSyncService.deleteTransactionDetal(id, m).catch(() => {});
  },

  // Mayor Transactions (Ventas Monedas Regionales) - 100% aisladas por modo
  getTransactionsMayor(mode?: AppMode): TransactionMayor[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    return getFromStorage<TransactionMayor[]>(this.getTransactionsMayorKey(m), []);
  },

  addTransactionMayor(tx: Omit<TransactionMayor, 'id' | 'created_at'>, mode?: AppMode): TransactionMayor {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsMayor(m);
    const newTx: TransactionMayor = {
      ...tx,
      id: 'mayor-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newTx);
    saveToStorage(this.getTransactionsMayorKey(m), all);

    if (newTx.paid_account_id && newTx.amount_ves > 0) {
      const accounts = this.getAccounts(m);
      const paidAcc = accounts.find((a) => a.id === newTx.paid_account_id);
      let totalOut = newTx.amount_ves;
      if (paidAcc && paidAcc.currency === 'USD') {
        totalOut += (newTx.commission || 0);
      }
      this.updateAccountBalance(newTx.paid_account_id, -totalOut, m);
    }
    const receivedAmt = newTx.amount_received !== undefined ? newTx.amount_received : 0;
    if (newTx.received_account_id && newTx.received_account_id !== 'POR_COBRAR' && receivedAmt > 0) {
      this.updateAccountBalance(newTx.received_account_id, receivedAmt, m);
    }

    const unpaid = Number(((newTx.total_to_pay || 0) - receivedAmt).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(newTx.client_name, unpaid, m);
    }

    SupabaseSyncService.upsertTransactionMayor(newTx, m).catch(() => {});
    return newTx;
  },

  deleteTransactionMayor(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsMayor(m);
    const tx = all.find((t) => t.id === id);
    if (tx) {
      const receivedAmt = tx.amount_received !== undefined ? tx.amount_received : 0;
      const unpaid = Number(((tx.total_to_pay || 0) - receivedAmt).toFixed(2));
      if (unpaid > 0) {
        this.increaseClientDebt(tx.client_name, -unpaid, m);
      }
      if (tx.paid_account_id && tx.amount_ves > 0) {
        const accounts = this.getAccounts(m);
        const paidAcc = accounts.find((a) => a.id === tx.paid_account_id);
        let totalOut = tx.amount_ves;
        if (paidAcc && paidAcc.currency === 'USD') {
          totalOut += (tx.commission || 0);
        }
        this.updateAccountBalance(tx.paid_account_id, totalOut, m);
      }
      if (tx.received_account_id && tx.received_account_id !== 'POR_COBRAR' && receivedAmt > 0) {
        this.updateAccountBalance(tx.received_account_id, -receivedAmt, m);
      }
    }
    saveToStorage(this.getTransactionsMayorKey(m), all.filter((tx) => tx.id !== id));
    SupabaseSyncService.deleteTransactionMayor(id, m).catch(() => {});
  },

  // Transfers
  getTransfers(mode?: AppMode): BalanceTransfer[] {
    const m = mode || this.getAppMode();
    return getFromStorage<BalanceTransfer[]>(this.getTransfersKey(m), []);
  },

  addTransfer(transfer: Omit<BalanceTransfer, 'id' | 'created_at'>, mode?: AppMode): BalanceTransfer {
    const m = mode || this.getAppMode();
    const all = this.getTransfers(m);
    const newTransfer: BalanceTransfer = {
      ...transfer,
      id: 'trf-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newTransfer);
    saveToStorage(this.getTransfersKey(m), all);

    const totalOut = newTransfer.amount_sent + (newTransfer.commission || 0);
    this.updateAccountBalance(newTransfer.from_account_id, -totalOut, m);
    this.updateAccountBalance(newTransfer.to_account_id, newTransfer.amount_received, m);

    SupabaseSyncService.upsertTransfer(newTransfer, m).catch(() => {});
    return newTransfer;
  },

  deleteTransfer(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getTransfers(m);
    const transfer = all.find((t) => t.id === id);
    if (transfer) {
      const totalOut = transfer.amount_sent + (transfer.commission || 0);
      this.updateAccountBalance(transfer.from_account_id, totalOut, m);
      this.updateAccountBalance(transfer.to_account_id, -transfer.amount_received, m);
    }
    saveToStorage(this.getTransfersKey(m), all.filter((t) => t.id !== id));
    SupabaseSyncService.deleteTransfer(id, m).catch(() => {});
  },

  // Expenses & Extra Income
  getExpenses(mode?: AppMode): Expense[] {
    const m = mode || this.getAppMode();
    return getFromStorage<Expense[]>(this.getExpensesKey(m), []);
  },

  addExpense(exp: Omit<Expense, 'id' | 'created_at'>, mode?: AppMode): Expense {
    const m = mode || this.getAppMode();
    const all = this.getExpenses(m);
    const newExp: Expense = {
      ...exp,
      id: 'exp-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newExp);
    saveToStorage(this.getExpensesKey(m), all);

    if (newExp.account_id) {
      if (newExp.type === 'ingreso') {
        this.updateAccountBalance(newExp.account_id, newExp.amount, m);
      } else {
        this.updateAccountBalance(newExp.account_id, -newExp.amount, m);
      }
    }

    SupabaseSyncService.upsertExpense(newExp, m).catch(() => {});
    return newExp;
  },

  deleteExpense(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getExpenses(m);
    const exp = all.find((e) => e.id === id);
    if (exp && exp.account_id) {
      if (exp.type === 'ingreso') {
        this.updateAccountBalance(exp.account_id, -exp.amount, m);
      } else {
        this.updateAccountBalance(exp.account_id, exp.amount, m);
      }
    }
    saveToStorage(this.getExpensesKey(m), all.filter((e) => e.id !== id));
    SupabaseSyncService.deleteExpense(id, m).catch(() => {});
  },

  // Daily Closures
  getClosures(mode?: AppMode): DailyClosure[] {
    const m = mode || this.getAppMode();
    return getFromStorage<DailyClosure[]>(this.getClosuresKey(m), []);
  },

  addClosure(
    closure: Omit<DailyClosure, 'id' | 'closed_at'>,
    accounts?: Account[],
    debtors?: Debtor[],
    mode?: AppMode
  ): DailyClosure {
    const m = mode || this.getAppMode();
    const all = this.getClosures(m);

    let accounts_snapshot = closure.accounts_snapshot;
    if (!accounts_snapshot) {
      const sourceAccounts = accounts || this.getAccounts(m);
      accounts_snapshot = sourceAccounts.map((a) => ({
        account_id: a.id,
        name: a.name,
        bank_name: a.bank_name,
        currency: a.currency,
        responsible: a.responsible,
        balance: Number((a.current_balance || 0).toFixed(2)),
      }));
    }

    let debtors_snapshot = closure.debtors_snapshot;
    if (!debtors_snapshot) {
      const sourceDebtors = debtors || this.getDebtors();
      debtors_snapshot = sourceDebtors
        .filter((d) => (d.current_debt || 0) !== 0)
        .map((d) => ({
          debtor_id: d.id,
          client_name: d.client_name,
          current_debt: Number((d.current_debt || 0).toFixed(2)),
          phone: d.phone,
        }));
    }

    const total_debtors_usd =
      closure.total_debtors_usd !== undefined
        ? closure.total_debtors_usd
        : debtors_snapshot.reduce((sum, d) => sum + (d.current_debt || 0), 0);

    const newClosure: DailyClosure = {
      ...closure,
      id: 'close-' + Date.now(),
      closed_at: new Date().toISOString(),
      accounts_snapshot,
      debtors_snapshot,
      total_debtors_usd: Number(total_debtors_usd.toFixed(2)),
    };
    const filtered = all.filter((c) => c.date !== closure.date);
    filtered.unshift(newClosure);
    saveToStorage(this.getClosuresKey(m), filtered);

    SupabaseSyncService.upsertClosure(newClosure, m).catch(() => {});
    return newClosure;
  },

  deleteClosure(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getClosures(m);
    saveToStorage(
      this.getClosuresKey(m),
      all.filter((c) => c.id !== id)
    );
    SupabaseSyncService.deleteClosure(id, m).catch(() => {});
  },

  // Debtors & Accounts Receivable - 100% aislados e independientes por modo
  syncDebtors(mode?: AppMode): Debtor[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    const rawDebtors = getFromStorage<Debtor[] | null>(this.getDebtorsKey(m), null);
    const debtors: Debtor[] = rawDebtors === null ? (m === 'detal' ? [...INITIAL_DEBTORS] : []) : [...rawDebtors].filter(Boolean);
    const detalTxs = (getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey(m), []) || []).filter(Boolean);
    const mayorTxs = (getFromStorage<TransactionMayor[]>(this.getTransactionsMayorKey(m), []) || []).filter(Boolean);
    const payments = (getFromStorage<DebtPayment[]>(this.getDebtPaymentsKey(m), []) || []).filter(Boolean);

    const clientStats = new Map<string, { totalBought: number; totalPaidInTx: number }>();

    detalTxs.forEach((t) => {
      if (!t) return;
      const name = (t.client_name || '').trim().toUpperCase();
      if (!name) return;
      const st = clientStats.get(name) || { totalBought: 0, totalPaidInTx: 0 };
      st.totalBought += t.total_to_pay || 0;
      if (t.payment_status === 'PAGADO') {
        st.totalPaidInTx += t.total_to_pay || 0;
      } else if (t.payment_status === 'PARCIAL' && t.amount_received) {
        st.totalPaidInTx += t.amount_received;
      }
      clientStats.set(name, st);
    });

    mayorTxs.forEach((t) => {
      if (!t) return;
      const name = (t.client_name || '').trim().toUpperCase();
      if (!name) return;
      const st = clientStats.get(name) || { totalBought: 0, totalPaidInTx: 0 };
      st.totalBought += t.total_to_pay || 0;
      if (t.payment_status === 'PAGADO') {
        st.totalPaidInTx += t.total_to_pay || 0;
      } else if (t.payment_status === 'PARCIAL' && t.amount_received) {
        st.totalPaidInTx += t.amount_received;
      }
      clientStats.set(name, st);
    });

    // Incluir también clientes que tienen abonos registrados
    payments.forEach((p) => {
      if (!p) return;
      const name = (p.client_name || '').trim().toUpperCase();
      if (!name) return;
      if (!clientStats.has(name)) {
        clientStats.set(name, { totalBought: 0, totalPaidInTx: 0 });
      }
    });

    let hasChanges = false;
    clientStats.forEach((st, name) => {
      const clientAbonos = payments
        .filter((p) => p && (p.client_name || '').trim().toUpperCase() === name)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const existingIndex = debtors.findIndex(
        (d) => d && (d.client_name || '').trim().toUpperCase() === name
      );

      // Saldo neto: > 0 = Deuda por cobrar (cliente debe); < 0 = Saldo a Favor (crédito del cliente)
      const calculatedNetDebt = Number((st.totalBought - st.totalPaidInTx - clientAbonos).toFixed(2));
      const hasActivity = st.totalBought > 0 || clientAbonos > 0;

      if (existingIndex === -1) {
        if (calculatedNetDebt !== 0) {
          debtors.unshift({
            id: 'deb-auto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            client_name: name,
            current_debt: calculatedNetDebt,
            notes: calculatedNetDebt > 0
              ? 'Sincronizado de operaciones por cobrar (' + m.toUpperCase() + ')'
              : 'Abono a favor registrado (' + m.toUpperCase() + ')',
            updated_at: new Date().toISOString(),
          });
          hasChanges = true;
        }
      } else if (hasActivity && debtors[existingIndex].current_debt !== calculatedNetDebt) {
        debtors[existingIndex].current_debt = calculatedNetDebt;
        debtors[existingIndex].updated_at = new Date().toISOString();
        hasChanges = true;
      }
    });

    const correctedDebtors: typeof debtors = [];

    if (hasChanges || !rawDebtors || rawDebtors.length === 0) {
      saveToStorage(this.getDebtorsKey(m), debtors);
      // Subir a Supabase los deudores corregidos para que no se sobreescriban
      debtors.forEach((d) => {
        if (d.updated_at && rawDebtors) {
          const old = rawDebtors.find((r) => r && r.id === d.id);
          if (!old || old.current_debt !== d.current_debt) {
            correctedDebtors.push(d);
          }
        } else if (!rawDebtors) {
          correctedDebtors.push(d);
        }
      });
      correctedDebtors.forEach((d) => {
        SupabaseSyncService.upsertDebtor(d, m).catch(() => {});
      });
    }

    return debtors.map((d) => ({
      ...d,
      notes: d.notes ? d.notes.replace(/\bdetal\b/gi, '').replace(/\s+/g, ' ').trim() : d.notes,
    }));
  },

  getDebtors(mode?: AppMode): Debtor[] {
    const m = mode || this.getAppMode();
    return this.syncDebtors(m);
  },

  saveDebtors(debtors: Debtor[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    saveToStorage(this.getDebtorsKey(m), debtors);
  },

  updateDebtorDebt(debtorId: string, delta: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const debtors = this.getDebtors(m);
    let updatedDebtor: Debtor | null = null;
    const updated = debtors.map((d) => {
      if (d.id === debtorId) {
        updatedDebtor = {
          ...d,
          current_debt: Number((d.current_debt + delta).toFixed(2)),
          updated_at: new Date().toISOString(),
        };
        return updatedDebtor;
      }
      return d;
    });
    this.saveDebtors(updated, m);
    if (updatedDebtor) {
      SupabaseSyncService.upsertDebtor(updatedDebtor, m).catch(() => {});
    }
  },

  increaseClientDebt(clientName: string, amount: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const upperName = clientName.trim().toUpperCase();
    const debtors = this.getDebtors(m);
    const existing = debtors.find((d) => d.client_name.trim().toUpperCase() === upperName);
    if (existing) {
      this.updateDebtorDebt(existing.id, amount, m);
    } else {
      this.addDebtor(
        {
          client_name: upperName,
          current_debt: Number(amount.toFixed(2)),
          notes: 'Generado automáticamente por venta a crédito (' + m.toUpperCase() + ')',
        },
        m
      );
    }
  },

  addDebtor(debtor: Omit<Debtor, 'id' | 'updated_at'>, mode?: AppMode): Debtor {
    const m = mode || this.getAppMode();
    const all = this.getDebtors(m);
    const newDebtor: Debtor = {
      ...debtor,
      id: 'deb-' + Date.now(),
      updated_at: new Date().toISOString(),
    };
    all.unshift(newDebtor);
    this.saveDebtors(all, m);
    SupabaseSyncService.upsertDebtor(newDebtor, m).catch(() => {});
    return newDebtor;
  },

  // Debt Payments (Abonos de Deudores) - 100% aislados por modo
  getDebtPayments(mode?: AppMode): DebtPayment[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    return getFromStorage<DebtPayment[]>(this.getDebtPaymentsKey(m), []);
  },

  addDebtPayment(payment: Omit<DebtPayment, 'id' | 'created_at'>, mode?: AppMode): DebtPayment {
    const m = mode || this.getAppMode();
    const all = this.getDebtPayments(m);
    const newPayment: DebtPayment = {
      ...payment,
      id: 'debtpay-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newPayment);
    saveToStorage(this.getDebtPaymentsKey(m), all);

    const upperName = newPayment.client_name.trim().toUpperCase();
    const debtors = this.getDebtors(m);
    const existing = debtors.find(
      (d) => d.id === newPayment.debtor_id || d.client_name.trim().toUpperCase() === upperName
    );
    if (existing) {
      this.updateDebtorDebt(existing.id, -newPayment.amount, m);
    } else {
      this.addDebtor(
        {
          client_name: upperName,
          current_debt: -newPayment.amount,
          notes: 'Creado por abono a deuda (' + m.toUpperCase() + ')',
        },
        m
      );
    }

    const amountToCredit =
      newPayment.amount_currency && newPayment.amount_currency > 0
        ? newPayment.amount_currency
        : newPayment.amount;

    if (newPayment.account_id && amountToCredit > 0) {
      this.updateAccountBalance(newPayment.account_id, amountToCredit, m);
    }

    SupabaseSyncService.upsertDebtPayment(newPayment, m).catch(() => {});
    return newPayment;
  },

  deleteDebtPayment(id: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getDebtPayments(m);
    const pay = all.find((p) => p.id === id);
    if (pay) {
      const upperName = pay.client_name.trim().toUpperCase();
      const debtors = this.getDebtors(m);
      const existing = debtors.find(
        (d) => d.id === pay.debtor_id || d.client_name.trim().toUpperCase() === upperName
      );
      if (existing) {
        this.updateDebtorDebt(existing.id, pay.amount, m);
      }

      const amountToRevert =
        pay.amount_currency && pay.amount_currency > 0
          ? pay.amount_currency
          : pay.amount;

      if (pay.account_id && amountToRevert > 0) {
        this.updateAccountBalance(pay.account_id, -amountToRevert, m);
      }
    }
    saveToStorage(this.getDebtPaymentsKey(m), all.filter((p) => p.id !== id));
    SupabaseSyncService.deleteDebtPayment(id, m).catch(() => {});
  },

  resetToDefaults(): void {
    if (typeof window === 'undefined') return;
    saveToStorage(this.getAccountsKey('detal'), INITIAL_ACCOUNTS_DETAL);
    saveToStorage(this.getAccountsKey('mayor'), INITIAL_ACCOUNTS_MAYOR);
    saveToStorage(this.getClientsKey('detal'), INITIAL_CLIENTS_DETAL);
    saveToStorage(this.getClientsKey('mayor'), INITIAL_CLIENTS_MAYOR);
    saveToStorage(this.getSuppliersKey('detal'), INITIAL_SUPPLIERS_DETAL);
    saveToStorage(this.getSuppliersKey('mayor'), INITIAL_SUPPLIERS_MAYOR);
    saveToStorage(this.getDebtorsKey('detal'), INITIAL_DEBTORS);
    saveToStorage(this.getDebtorsKey('mayor'), []);
    saveToStorage(this.getDebtPaymentsKey('detal'), []);
    saveToStorage(this.getDebtPaymentsKey('mayor'), []);
    saveToStorage(this.getTransactionsDetalKey('detal'), []);
    saveToStorage(this.getTransactionsDetalKey('mayor'), []);
    saveToStorage(this.getTransactionsMayorKey('detal'), []);
    saveToStorage(this.getTransactionsMayorKey('mayor'), []);
    saveToStorage(this.getTransfersKey('detal'), []);
    saveToStorage(this.getTransfersKey('mayor'), []);
    saveToStorage(this.getExpensesKey('detal'), []);
    saveToStorage(this.getExpensesKey('mayor'), []);
    saveToStorage(this.getClosuresKey('detal'), []);
    saveToStorage(this.getClosuresKey('mayor'), []);
    saveToStorage(this.getSupplierPurchasesKey('detal'), []);
    saveToStorage(this.getSupplierPurchasesKey('mayor'), []);
    saveToStorage(this.getSupplierPaymentsKey('detal'), []);
    saveToStorage(this.getSupplierPaymentsKey('mayor'), []);
  },

  masterResetToZero(): void {
    if (typeof window === 'undefined') return;
    saveToStorage(this.getAccountsKey('detal'), []);
    saveToStorage(this.getAccountsKey('mayor'), []);
    saveToStorage(this.getClientsKey('detal'), []);
    saveToStorage(this.getClientsKey('mayor'), []);
    saveToStorage(this.getSuppliersKey('detal'), []);
    saveToStorage(this.getSuppliersKey('mayor'), []);
    saveToStorage(this.getDebtorsKey('detal'), []);
    saveToStorage(this.getDebtorsKey('mayor'), []);
    saveToStorage(this.getDebtPaymentsKey('detal'), []);
    saveToStorage(this.getDebtPaymentsKey('mayor'), []);
    saveToStorage(this.getTransactionsDetalKey('detal'), []);
    saveToStorage(this.getTransactionsDetalKey('mayor'), []);
    saveToStorage(this.getTransactionsMayorKey('detal'), []);
    saveToStorage(this.getTransactionsMayorKey('mayor'), []);
    saveToStorage(this.getTransfersKey('detal'), []);
    saveToStorage(this.getTransfersKey('mayor'), []);
    saveToStorage(this.getExpensesKey('detal'), []);
    saveToStorage(this.getExpensesKey('mayor'), []);
    saveToStorage(this.getClosuresKey('detal'), []);
    saveToStorage(this.getClosuresKey('mayor'), []);
    saveToStorage(this.getSupplierPurchasesKey('detal'), []);
    saveToStorage(this.getSupplierPurchasesKey('mayor'), []);
    saveToStorage(this.getSupplierPaymentsKey('detal'), []);
    saveToStorage(this.getSupplierPaymentsKey('mayor'), []);
    localStorage.removeItem('cambiosjk_accounts_v1');
    localStorage.removeItem('cambiosjk_clients_v1');
    localStorage.removeItem('cambiosjk_suppliers_v1');
    localStorage.removeItem('cambiosjk_detal_v1');
    localStorage.removeItem('cambiosjk_mayor_v1');
    localStorage.removeItem('cambiosjk_debtors_v1');
    localStorage.removeItem('cambiosjk_debt_payments_v1');
    SupabaseSyncService.truncateAllTables().catch(() => {});
  },

  resetBalancesToZero(): void {
    if (typeof window === 'undefined') return;
    const detalAccs = this.getAccounts('detal').map((a) => ({ ...a, current_balance: 0 }));
    const mayorAccs = this.getAccounts('mayor').map((a) => ({ ...a, current_balance: 0 }));
    saveToStorage(this.getAccountsKey('detal'), detalAccs);
    saveToStorage(this.getAccountsKey('mayor'), mayorAccs);

    const detalSuppliers = this.getSuppliers('detal').map((s) => ({ ...s, current_debt_usd: 0 }));
    const mayorSuppliers = this.getSuppliers('mayor').map((s) => ({ ...s, current_debt_usd: 0 }));
    saveToStorage(this.getSuppliersKey('detal'), detalSuppliers);
    saveToStorage(this.getSuppliersKey('mayor'), mayorSuppliers);

    saveToStorage(this.getDebtorsKey('detal'), []);
    saveToStorage(this.getDebtorsKey('mayor'), []);
    saveToStorage(this.getDebtPaymentsKey('detal'), []);
    saveToStorage(this.getDebtPaymentsKey('mayor'), []);
    saveToStorage(this.getTransactionsDetalKey('detal'), []);
    saveToStorage(this.getTransactionsDetalKey('mayor'), []);
    saveToStorage(this.getTransactionsMayorKey('detal'), []);
    saveToStorage(this.getTransactionsMayorKey('mayor'), []);
    saveToStorage(this.getTransfersKey('detal'), []);
    saveToStorage(this.getTransfersKey('mayor'), []);
    saveToStorage(this.getExpensesKey('detal'), []);
    saveToStorage(this.getExpensesKey('mayor'), []);
    saveToStorage(this.getClosuresKey('detal'), []);
    saveToStorage(this.getClosuresKey('mayor'), []);
    saveToStorage(this.getSupplierPurchasesKey('detal'), []);
    saveToStorage(this.getSupplierPurchasesKey('mayor'), []);
    saveToStorage(this.getSupplierPaymentsKey('detal'), []);
    saveToStorage(this.getSupplierPaymentsKey('mayor'), []);
    SupabaseSyncService.truncateAllTables().catch(() => {});
  },
};

