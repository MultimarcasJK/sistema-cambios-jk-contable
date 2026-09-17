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

  // Sincronización con Supabase en segundo plano
  async syncFromSupabase(mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    try {
      const [remoteAccs, remoteClients, remoteSuppliers, remoteTransfers, remoteExpenses, remoteClosures] =
        await Promise.all([
          SupabaseSyncService.fetchAccounts(m),
          SupabaseSyncService.fetchClients(m),
          SupabaseSyncService.fetchSuppliers(m),
          SupabaseSyncService.fetchTransfers(m),
          SupabaseSyncService.fetchExpenses(m),
          SupabaseSyncService.fetchClosures(m),
        ]);

      if (remoteAccs && remoteAccs.length > 0) {
        saveToStorage(this.getAccountsKey(m), remoteAccs);
      } else if (remoteAccs && remoteAccs.length === 0) {
        const localAccs = this.getAccounts(m);
        const localClients = this.getClients(m);
        const localSuppliers = this.getSuppliers(m);
        SupabaseSyncService.seedInitialIfEmpty(m, localAccs, localClients, localSuppliers).catch(() => {});
      }

      if (remoteClients && remoteClients.length > 0) {
        saveToStorage(this.getClientsKey(m), remoteClients);
      }
      if (remoteSuppliers && remoteSuppliers.length > 0) {
        saveToStorage(this.getSuppliersKey(m), remoteSuppliers);
      }
      if (remoteTransfers && remoteTransfers.length > 0) {
        saveToStorage(this.getTransfersKey(m), remoteTransfers);
      }
      if (remoteExpenses && remoteExpenses.length > 0) {
        saveToStorage(this.getExpensesKey(m), remoteExpenses);
      }
      if (remoteClosures && remoteClosures.length > 0) {
        saveToStorage(this.getClosuresKey(m), remoteClosures);
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
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
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

  // Detal Transactions
  getTransactionsDetal(): TransactionDetal[] {
    return getFromStorage<TransactionDetal[]>('cambiosjk_detal_v1', []);
  },

  addTransactionDetal(tx: Omit<TransactionDetal, 'id' | 'created_at'>): TransactionDetal {
    const all = this.getTransactionsDetal();
    const newTx: TransactionDetal = {
      ...tx,
      id: 'detal-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newTx);
    saveToStorage('cambiosjk_detal_v1', all);

    if (newTx.received_account_id && newTx.received_account_id !== 'POR_COBRAR' && newTx.amount_received > 0) {
      this.updateAccountBalance(newTx.received_account_id, newTx.amount_received, 'detal');
    }
    if (newTx.paid_account_id && newTx.usdt_amount > 0) {
      const totalOut = newTx.usdt_amount + (newTx.bank_fee || 0);
      this.updateAccountBalance(newTx.paid_account_id, -totalOut, 'detal');
    }

    const unpaid = Number(((newTx.total_to_pay || 0) - (newTx.amount_received || 0)).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(newTx.client_name, unpaid);
    }

    SupabaseSyncService.upsertTransactionDetal(newTx).catch(() => {});
    return newTx;
  },

  deleteTransactionDetal(id: string): void {
    const all = this.getTransactionsDetal();
    const tx = all.find((t) => t.id === id);
    if (tx) {
      const unpaid = Number(((tx.total_to_pay || 0) - (tx.amount_received || 0)).toFixed(2));
      if (unpaid > 0) {
        this.increaseClientDebt(tx.client_name, -unpaid);
      }
      if (tx.received_account_id && tx.received_account_id !== 'POR_COBRAR' && tx.amount_received > 0) {
        this.updateAccountBalance(tx.received_account_id, -tx.amount_received, 'detal');
      }
      if (tx.paid_account_id && tx.usdt_amount > 0) {
        const totalOut = tx.usdt_amount + (tx.bank_fee || 0);
        this.updateAccountBalance(tx.paid_account_id, totalOut, 'detal');
      }
    }
    saveToStorage('cambiosjk_detal_v1', all.filter((t) => t.id !== id));
    SupabaseSyncService.deleteTransactionDetal(id).catch(() => {});
  },

  // Mayor Transactions
  getTransactionsMayor(): TransactionMayor[] {
    return getFromStorage<TransactionMayor[]>('cambiosjk_mayor_v1', []);
  },

  addTransactionMayor(tx: Omit<TransactionMayor, 'id' | 'created_at'>): TransactionMayor {
    const all = this.getTransactionsMayor();
    const newTx: TransactionMayor = {
      ...tx,
      id: 'mayor-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newTx);
    saveToStorage('cambiosjk_mayor_v1', all);

    if (newTx.paid_account_id && newTx.amount_ves > 0) {
      const accounts = this.getAccounts('mayor');
      const paidAcc = accounts.find((a) => a.id === newTx.paid_account_id);
      let totalOut = newTx.amount_ves;
      if (paidAcc && paidAcc.currency === 'USD') {
        totalOut += (newTx.commission || 0);
      }
      this.updateAccountBalance(newTx.paid_account_id, -totalOut, 'mayor');
    }
    const receivedAmt = newTx.amount_received !== undefined ? newTx.amount_received : 0;
    if (newTx.received_account_id && newTx.received_account_id !== 'POR_COBRAR' && receivedAmt > 0) {
      this.updateAccountBalance(newTx.received_account_id, receivedAmt, 'mayor');
    }

    const unpaid = Number(((newTx.total_to_pay || 0) - receivedAmt).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(newTx.client_name, unpaid);
    }

    SupabaseSyncService.upsertTransactionMayor(newTx).catch(() => {});
    return newTx;
  },

  deleteTransactionMayor(id: string): void {
    const all = this.getTransactionsMayor();
    const tx = all.find((t) => t.id === id);
    if (tx) {
      const receivedAmt = tx.amount_received !== undefined ? tx.amount_received : 0;
      const unpaid = Number(((tx.total_to_pay || 0) - receivedAmt).toFixed(2));
      if (unpaid > 0) {
        this.increaseClientDebt(tx.client_name, -unpaid);
      }
      if (tx.paid_account_id && tx.amount_ves > 0) {
        const accounts = this.getAccounts('mayor');
        const paidAcc = accounts.find((a) => a.id === tx.paid_account_id);
        let totalOut = tx.amount_ves;
        if (paidAcc && paidAcc.currency === 'USD') {
          totalOut += (tx.commission || 0);
        }
        this.updateAccountBalance(tx.paid_account_id, totalOut, 'mayor');
      }
      if (tx.received_account_id && tx.received_account_id !== 'POR_COBRAR' && receivedAmt > 0) {
        this.updateAccountBalance(tx.received_account_id, -receivedAmt, 'mayor');
      }
    }
    saveToStorage('cambiosjk_mayor_v1', all.filter((tx) => tx.id !== id));
    SupabaseSyncService.deleteTransactionMayor(id).catch(() => {});
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

  // Debtors & Accounts Receivable
  syncDebtors(): Debtor[] {
    const rawDebtors = getFromStorage<Debtor[]>('cambiosjk_debtors_v1', []);
    const debtors: Debtor[] = (!rawDebtors || rawDebtors.length === 0) ? [...INITIAL_DEBTORS] : [...rawDebtors].filter(Boolean);
    const detalTxs = (getFromStorage<TransactionDetal[]>('cambiosjk_detal_v1', []) || []).filter(Boolean);
    const mayorTxs = (getFromStorage<TransactionMayor[]>('cambiosjk_mayor_v1', []) || []).filter(Boolean);
    const payments = (getFromStorage<DebtPayment[]>('cambiosjk_debt_payments_v1', []) || []).filter(Boolean);

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

    let hasChanges = false;
    clientStats.forEach((st, name) => {
      const clientAbonos = payments
        .filter((p) => p && (p.client_name || '').trim().toUpperCase() === name)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const existingIndex = debtors.findIndex(
        (d) => d && (d.client_name || '').trim().toUpperCase() === name
      );

      const calculatedDebt = Math.max(0, Number((st.totalBought - st.totalPaidInTx - clientAbonos).toFixed(2)));

      if (existingIndex === -1) {
        if (calculatedDebt > 0) {
          debtors.unshift({
            id: 'deb-auto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            client_name: name,
            current_debt: calculatedDebt,
            notes: 'Sincronizado de operaciones por cobrar',
            updated_at: new Date().toISOString(),
          });
          hasChanges = true;
        }
      } else if (debtors[existingIndex].current_debt === 0 && calculatedDebt > 0) {
        debtors[existingIndex].current_debt = calculatedDebt;
        debtors[existingIndex].updated_at = new Date().toISOString();
        hasChanges = true;
      }
    });

    if (hasChanges || !rawDebtors || rawDebtors.length === 0) {
      saveToStorage('cambiosjk_debtors_v1', debtors);
    }

    return debtors.map((d) => ({
      ...d,
      notes: d.notes ? d.notes.replace(/\bdetal\b/gi, '').replace(/\s+/g, ' ').trim() : d.notes,
    }));
  },

  getDebtors(): Debtor[] {
    return this.syncDebtors();
  },

  saveDebtors(debtors: Debtor[]): void {
    saveToStorage('cambiosjk_debtors_v1', debtors);
  },

  updateDebtorDebt(debtorId: string, delta: number): void {
    const debtors = this.getDebtors();
    const updated = debtors.map((d) => {
      if (d.id === debtorId) {
        return {
          ...d,
          current_debt: Number((d.current_debt + delta).toFixed(2)),
          updated_at: new Date().toISOString(),
        };
      }
      return d;
    });
    this.saveDebtors(updated);
  },

  increaseClientDebt(clientName: string, amount: number): void {
    const upperName = clientName.trim().toUpperCase();
    const debtors = this.getDebtors();
    const existing = debtors.find((d) => d.client_name.trim().toUpperCase() === upperName);
    if (existing) {
      this.updateDebtorDebt(existing.id, amount);
    } else {
      this.addDebtor({
        client_name: upperName,
        current_debt: Number(amount.toFixed(2)),
        notes: 'Generado automáticamente por venta a crédito',
      });
    }
  },

  addDebtor(debtor: Omit<Debtor, 'id' | 'updated_at'>): Debtor {
    const all = this.getDebtors();
    const newDebtor: Debtor = {
      ...debtor,
      id: 'deb-' + Date.now(),
      updated_at: new Date().toISOString(),
    };
    all.unshift(newDebtor);
    this.saveDebtors(all);
    return newDebtor;
  },

  // Debt Payments
  getDebtPayments(): DebtPayment[] {
    return getFromStorage<DebtPayment[]>('cambiosjk_debt_payments_v1', []);
  },

  addDebtPayment(payment: Omit<DebtPayment, 'id' | 'created_at'>): DebtPayment {
    const all = this.getDebtPayments();
    const newPayment: DebtPayment = {
      ...payment,
      id: 'debtpay-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    all.unshift(newPayment);
    saveToStorage('cambiosjk_debt_payments_v1', all);

    const upperName = newPayment.client_name.trim().toUpperCase();
    const debtors = this.getDebtors();
    const existing = debtors.find(
      (d) => d.id === newPayment.debtor_id || d.client_name.trim().toUpperCase() === upperName
    );
    if (existing) {
      this.updateDebtorDebt(existing.id, -newPayment.amount);
    } else {
      this.addDebtor({
        client_name: upperName,
        current_debt: -newPayment.amount,
        notes: 'Creado por abono a deuda',
      });
    }

    const amountToCredit =
      newPayment.amount_currency && newPayment.amount_currency > 0
        ? newPayment.amount_currency
        : newPayment.amount;

    if (newPayment.account_id && amountToCredit > 0) {
      this.updateAccountBalance(newPayment.account_id, amountToCredit);
    }

    return newPayment;
  },

  resetToDefaults(): void {
    if (typeof window === 'undefined') return;
    saveToStorage(this.getAccountsKey('detal'), INITIAL_ACCOUNTS_DETAL);
    saveToStorage(this.getAccountsKey('mayor'), INITIAL_ACCOUNTS_MAYOR);
    saveToStorage(this.getClientsKey('detal'), INITIAL_CLIENTS_DETAL);
    saveToStorage(this.getClientsKey('mayor'), INITIAL_CLIENTS_MAYOR);
    saveToStorage(this.getSuppliersKey('detal'), INITIAL_SUPPLIERS_DETAL);
    saveToStorage(this.getSuppliersKey('mayor'), INITIAL_SUPPLIERS_MAYOR);
    saveToStorage('cambiosjk_debtors_v1', INITIAL_DEBTORS);
    saveToStorage('cambiosjk_debt_payments_v1', []);
    saveToStorage('cambiosjk_detal_v1', []);
    saveToStorage('cambiosjk_mayor_v1', []);
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
    saveToStorage('cambiosjk_debtors_v1', []);
    saveToStorage('cambiosjk_debt_payments_v1', []);
    saveToStorage('cambiosjk_detal_v1', []);
    saveToStorage('cambiosjk_mayor_v1', []);
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

    saveToStorage('cambiosjk_debtors_v1', []);
    saveToStorage('cambiosjk_debt_payments_v1', []);
    saveToStorage('cambiosjk_detal_v1', []);
    saveToStorage('cambiosjk_mayor_v1', []);
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

