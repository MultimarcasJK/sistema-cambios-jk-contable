import { supabase, isSupabaseConfigured } from './supabase';
import {
  Account,
  Client,
  Supplier,
  SupplierPurchase,
  SupplierPayment,
  TransactionDetal,
  TransactionMayor,
  BalanceTransfer,
  Expense,
  DailyClosure,
  AppMode,
} from '@/types';

function getClient(mode: AppMode) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    return supabase.schema(mode);
  } catch (err) {
    console.warn('[Supabase ' + mode + '] Error obteniendo esquema:', err);
    return null;
  }
}

export const SupabaseSyncService = {
  // Accounts
  async fetchAccounts(mode: AppMode): Promise<Account[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('accounts').select('*');
      if (error) {
        console.warn('[Supabase ' + mode + '] Error fetching accounts:', error.message);
        return null;
      }
      return (data as Account[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertAccount(account: Account, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('accounts').upsert({
        id: account.id,
        name: account.name,
        currency: account.currency,
        current_balance: account.current_balance,
        initial_balance: account.initial_balance || 0,
        type: account.type || 'banco',
        bank_name: account.bank_name || '',
        responsible: account.responsible || '',
        country: account.country || (mode === 'mayor' ? 'VENEZUELA' : 'ECUADOR'),
      });
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting account:', err);
    }
  },

  async deleteAccount(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('accounts').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting account:', err);
    }
  },

  // Clients
  async fetchClients(mode: AppMode): Promise<Client[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('clients').select('*');
      if (error) return null;
      return (data as Client[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertClient(clientData: Client, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('clients').upsert({
        id: clientData.id,
        name: clientData.name,
        phone: clientData.phone || '',
        current_debt: clientData.current_debt || 0,
      });
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting client:', err);
    }
  },

  async deleteClient(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('clients').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting client:', err);
    }
  },

  // Transactions Detal
  async fetchTransactionsDetal(): Promise<TransactionDetal[] | null> {
    const client = getClient('detal');
    if (!client) return null;
    try {
      const { data, error } = await client.from('transactions').select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as TransactionDetal[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertTransactionDetal(tx: TransactionDetal): Promise<void> {
    const client = getClient('detal');
    if (!client) return;
    try {
      await client.from('transactions').upsert(tx);
    } catch (err) {
      console.warn('[Supabase detal] Error upserting tx:', err);
    }
  },

  async deleteTransactionDetal(id: string): Promise<void> {
    const client = getClient('detal');
    if (!client) return;
    try {
      await client.from('transactions').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase detal] Error deleting tx:', err);
    }
  },

  // Transactions Mayor
  async fetchTransactionsMayor(): Promise<TransactionMayor[] | null> {
    const client = getClient('mayor');
    if (!client) return null;
    try {
      const { data, error } = await client.from('transactions').select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as TransactionMayor[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertTransactionMayor(tx: TransactionMayor): Promise<void> {
    const client = getClient('mayor');
    if (!client) return;
    try {
      await client.from('transactions').upsert(tx);
    } catch (err) {
      console.warn('[Supabase mayor] Error upserting tx:', err);
    }
  },

  async deleteTransactionMayor(id: string): Promise<void> {
    const client = getClient('mayor');
    if (!client) return;
    try {
      await client.from('transactions').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase mayor] Error deleting tx:', err);
    }
  },

  // Transfers
  async fetchTransfers(mode: AppMode): Promise<BalanceTransfer[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('transfers').select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as BalanceTransfer[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertTransfer(transfer: BalanceTransfer, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('transfers').upsert(transfer);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting transfer:', err);
    }
  },

  async deleteTransfer(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('transfers').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting transfer:', err);
    }
  },

  // Expenses
  async fetchExpenses(mode: AppMode): Promise<Expense[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('expenses').select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as Expense[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertExpense(expense: Expense, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('expenses').upsert(expense);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting expense:', err);
    }
  },

  async deleteExpense(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('expenses').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting expense:', err);
    }
  },

  // Closures
  async fetchClosures(mode: AppMode): Promise<DailyClosure[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('closures').select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as DailyClosure[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertClosure(closure: DailyClosure, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('closures').upsert(closure);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting closure:', err);
    }
  },

  async deleteClosure(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('closures').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting closure:', err);
    }
  },

  // Suppliers
  async fetchSuppliers(mode: AppMode): Promise<Supplier[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('suppliers').select('*');
      if (error) return null;
      return (data as Supplier[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertSupplier(supplier: Supplier, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('suppliers').upsert({
        id: supplier.id,
        name: supplier.name,
        contact_info: supplier.contact_info || supplier.type || '',
        current_debt_usd: supplier.current_debt_usd || 0,
      });
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting supplier:', err);
    }
  },

  async deleteSupplier(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('suppliers').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting supplier:', err);
    }
  },

  // Supplier Purchases
  async fetchSupplierPurchases(mode: AppMode): Promise<SupplierPurchase[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('supplier_purchases').select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as SupplierPurchase[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertSupplierPurchase(purchase: SupplierPurchase, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('supplier_purchases').upsert(purchase);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting purchase:', err);
    }
  },

  async deleteSupplierPurchase(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('supplier_purchases').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting purchase:', err);
    }
  },

  // Supplier Payments
  async fetchSupplierPayments(mode: AppMode): Promise<SupplierPayment[] | null> {
    const client = getClient(mode);
    if (!client) return null;
    try {
      const { data, error } = await client.from('supplier_payments').select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as SupplierPayment[]) || [];
    } catch (err) {
      return null;
    }
  },

  async upsertSupplierPayment(payment: SupplierPayment, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('supplier_payments').upsert(payment);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error upserting payment:', err);
    }
  },

  async deleteSupplierPayment(id: string, mode: AppMode): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      await client.from('supplier_payments').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Error deleting payment:', err);
    }
  },

  // Initial Data Seeding
  async seedInitialIfEmpty(
    mode: AppMode,
    accounts: Account[],
    clients: Client[],
    suppliers: Supplier[]
  ): Promise<void> {
    const client = getClient(mode);
    if (!client) return;
    try {
      const existing = await this.fetchAccounts(mode);
      if (existing && existing.length === 0 && accounts.length > 0) {
        for (const acc of accounts) {
          await this.upsertAccount(acc, mode);
        }
        for (const cli of clients) {
          await this.upsertClient(cli, mode);
        }
        for (const sup of suppliers) {
          await this.upsertSupplier(sup, mode);
        }
      }
    } catch (err) {
      console.warn('[Supabase ' + mode + '] Seeding error:', err);
    }
  },

  async truncateAllTables(): Promise<void> {
    const schemas: AppMode[] = ['detal', 'mayor'];
    for (const s of schemas) {
      const client = getClient(s);
      if (!client) continue;
      try {
        await client.from('supplier_payments').delete().neq('id', '___none___');
        await client.from('supplier_purchases').delete().neq('id', '___none___');
        await client.from('suppliers').delete().neq('id', '___none___');
        await client.from('closures').delete().neq('id', '___none___');
        await client.from('expenses').delete().neq('id', '___none___');
        await client.from('transfers').delete().neq('id', '___none___');
        await client.from('transactions').delete().neq('id', '___none___');
        await client.from('clients').delete().neq('id', '___none___');
        await client.from('accounts').delete().neq('id', '___none___');
      } catch (err) {
        console.warn('[Supabase ' + s + '] Truncate error:', err);
      }
    }
  },
};

