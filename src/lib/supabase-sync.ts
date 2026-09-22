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
  Debtor,
  DebtPayment,
  AppMode,
} from '@/types';

export const SupabaseSyncService = {
  // Accounts (detal_cuentas / mayor_cuentas)
  async fetchAccounts(mode: AppMode): Promise<Account[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_cuentas`;
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        /* warn */
        return null;
      }
      return ((data || []) as any[]).map((row) => ({
        ...row,
        current_balance: Number(row.current_balance) || 0,
        initial_balance: Number(row.initial_balance) || 0,
        is_active: row.is_active !== undefined && row.is_active !== null ? Boolean(row.is_active) : true,
      })) as Account[];
    } catch {
      return null;
    }
  },

  async upsertAccount(account: Account, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_cuentas`;
    try {
      await supabase.from(table).upsert({
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
      /* warn */
    }
  },

  async deleteAccount(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_cuentas`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Clients (detal_clientes / mayor_clientes)
  async fetchClients(mode: AppMode): Promise<Client[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_clientes`;
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) return null;
      return (data as Client[]) || [];
    } catch {
      return null;
    }
  },

  async upsertClient(clientData: Client, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_clientes`;
    try {
      await supabase.from(table).upsert({
        id: clientData.id,
        name: clientData.name,
        phone: clientData.phone || '',
        current_debt: clientData.current_debt || 0,
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteClient(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_clientes`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Transactions Detal (detal_ventas_cripto_dolar / mayor_ventas_cripto_dolar)
  async fetchTransactionsDetal(mode: AppMode = 'detal'): Promise<TransactionDetal[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_ventas_cripto_dolar`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) {
        console.error(`[SupabaseSync] Error fetching ${table}:`, error);
        return null;
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        client_name: row.client_name,
        usdt_amount: Number(row.usdt_amount || 0),
        buy_price: Number(row.commission_rate ?? row.buy_price ?? 0),
        sell_price: Number(row.exchange_rate ?? row.sell_price ?? 0),
        received_account_id: row.received_account_id || '',
        amount_received: Number(row.amount_received || 0),
        paid_account_id: row.paid_account_id || '',
        bank_fee: Number(row.bank_fee ?? row.commission ?? 0),
        fee_percent: Number(row.percentage ?? 0) || undefined,
        total_to_pay: Number(row.total_to_pay || 0),
        profit_usd: Number(row.net_profit ?? row.profit_usd ?? 0),
        payment_status: row.payment_status || 'PAGADO',
        notes: row.notes || '',
      }));
    } catch {
      return null;
    }
  },

  async upsertTransactionDetal(tx: TransactionDetal, mode: AppMode = 'detal'): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_ventas_cripto_dolar`;
    try {
      const payload: Record<string, any> = {
        id: tx.id,
        date: tx.date,
        client_name: tx.client_name,
        phone: '',
        operation_type: 'CRIPTO_DOLAR',
        usdt_amount: tx.usdt_amount,
        exchange_rate: tx.sell_price,
        received_account_id: tx.received_account_id,
        amount_received: tx.amount_received,
        paid_account_id: tx.paid_account_id,
        total_to_pay: tx.total_to_pay,
        net_profit: tx.profit_usd,
        payment_status: tx.payment_status || 'PAGADO',
        notes: tx.notes || '',
      };

      if (mode === 'mayor') {
        payload.amount_ves = 0;
        payload.commission = tx.bank_fee || 0;
        payload.percentage = tx.fee_percent || 0;
      } else {
        payload.commission_rate = tx.buy_price;
        payload.bank_fee = tx.bank_fee;
      }

      const { error } = await supabase.from(table).upsert(payload);
      if (error) {
        console.error(`[SupabaseSync] Error upserting ${table}:`, error);
      }
    } catch (err) {
      console.error(`[SupabaseSync] Exception in upsertTransactionDetal:`, err);
    }
  },

  async deleteTransactionDetal(id: string, mode: AppMode = 'detal'): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_ventas_cripto_dolar`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Transactions Mayor (detal_ventas_regionales / mayor_ventas_regionales)
  async fetchTransactionsMayor(mode: AppMode = 'mayor'): Promise<TransactionMayor[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_ventas_regionales`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        client_name: row.client_name,
        currency: row.currency || 'VES',
        amount_ves: Number(row.amount_ves || 0),
        buy_price: Number(row.buy_price || 0),
        sell_price: Number(row.sell_price || 0),
        total_to_pay: Number(row.total_to_pay || 0),
        received_account_id: row.received_account_id || '',
        amount_received: Number(row.amount_received || 0),
        paid_account_id: row.paid_account_id || '',
        commission: Number(row.commission || 0),
        profit_usd: Number(row.net_profit ?? row.profit_usd ?? 0),
        payment_status: row.payment_status || 'PAGADO',
        notes: row.notes || '',
      }));
    } catch {
      return null;
    }
  },

  async upsertTransactionMayor(tx: TransactionMayor, mode: AppMode = 'mayor'): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_ventas_regionales`;
    try {
      await supabase.from(table).upsert({
        id: tx.id,
        date: tx.date,
        client_name: tx.client_name,
        currency: tx.currency || 'VES',
        amount_ves: tx.amount_ves,
        buy_price: tx.buy_price,
        sell_price: tx.sell_price,
        total_to_pay: tx.total_to_pay,
        received_account_id: tx.received_account_id,
        amount_received: tx.amount_received || 0,
        paid_account_id: tx.paid_account_id,
        commission: tx.commission || 0,
        net_profit: tx.profit_usd,
        payment_status: tx.payment_status || 'PAGADO',
        notes: tx.notes || '',
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteTransactionMayor(id: string, mode: AppMode = 'mayor'): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_ventas_regionales`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Debtors (detal_deudores / mayor_deudores)
  async fetchDebtors(mode: AppMode): Promise<Debtor[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_deudores`;
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) return null;
      return ((data || []) as any[]).map((row) => ({
        ...row,
        current_debt: Number(row.current_debt) || 0,
      })) as Debtor[];
    } catch {
      return null;
    }
  },

  async upsertDebtor(debtor: Debtor, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_deudores`;
    try {
      await supabase.from(table).upsert({
        id: debtor.id,
        client_name: debtor.client_name,
        phone: debtor.phone || '',
        current_debt: debtor.current_debt,
        notes: debtor.notes || '',
        updated_at: debtor.updated_at || new Date().toISOString(),
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteDebtor(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_deudores`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Debt Payments (detal_abonos_deudores / mayor_abonos_deudores)
  async fetchDebtPayments(mode: AppMode): Promise<DebtPayment[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_abonos_deudores`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return ((data || []) as any[]).map((row) => ({
        ...row,
        amount: Number(row.amount) || 0,
        amount_currency: Number(row.amount_currency ?? row.amount) || 0,
        exchange_rate: Number(row.exchange_rate) || 1,
      })) as DebtPayment[];
    } catch {
      return null;
    }
  },

  async upsertDebtPayment(payment: DebtPayment, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_abonos_deudores`;
    try {
      await supabase.from(table).upsert({
        id: payment.id,
        date: payment.date,
        debtor_id: payment.debtor_id || '',
        client_name: payment.client_name,
        amount: payment.amount,
        currency: payment.currency || 'USD',
        amount_currency: payment.amount_currency || payment.amount,
        exchange_rate: payment.exchange_rate || 1,
        account_id: payment.account_id || '',
        notes: payment.notes || '',
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteDebtPayment(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_abonos_deudores`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Transfers (detal_cambio_saldos / mayor_cambio_saldos)
  async fetchTransfers(mode: AppMode): Promise<BalanceTransfer[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_cambio_saldos`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as BalanceTransfer[]) || [];
    } catch {
      return null;
    }
  },

  async upsertTransfer(transfer: BalanceTransfer, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_cambio_saldos`;
    try {
      await supabase.from(table).upsert({
        id: transfer.id,
        date: transfer.date,
        from_account_id: transfer.from_account_id,
        to_account_id: transfer.to_account_id,
        amount_sent: transfer.amount_sent,
        amount_received: transfer.amount_received,
        exchange_rate: 1,
        commission: transfer.commission || 0,
        notes: transfer.concept || transfer.reference || '',
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteTransfer(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_cambio_saldos`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Expenses (detal_gastos_ingresos / mayor_gastos_ingresos)
  async fetchExpenses(mode: AppMode): Promise<Expense[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_gastos_ingresos`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as Expense[]) || [];
    } catch {
      return null;
    }
  },

  async upsertExpense(expense: Expense, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_gastos_ingresos`;
    try {
      await supabase.from(table).upsert({
        id: expense.id,
        date: expense.date,
        type: expense.type,
        category: expense.concept || 'GENERAL',
        description: expense.description,
        amount: expense.amount,
        account_id: expense.account_id || '',
        notes: '',
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteExpense(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_gastos_ingresos`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Closures (detal_cierres_diarios / mayor_cierres_diarios)
  async fetchClosures(mode: AppMode): Promise<DailyClosure[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_cierres_diarios`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as DailyClosure[]) || [];
    } catch {
      return null;
    }
  },

  async upsertClosure(closure: DailyClosure, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_cierres_diarios`;
    try {
      await supabase.from(table).upsert({
        id: closure.id,
        date: closure.date,
        closed_at: closure.closed_at,
        net_profit_day: closure.total_net_profit,
        total_debtors_usd: closure.total_debtors_usd || 0,
        accounts_snapshot: closure.accounts_snapshot,
        debtors_snapshot: closure.debtors_snapshot,
        notes: closure.notes || '',
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteClosure(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_cierres_diarios`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Suppliers (detal_proveedores / mayor_proveedores)
  async fetchSuppliers(mode: AppMode): Promise<Supplier[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_proveedores`;
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) return null;
      return ((data || []) as any[]).map((row) => ({
        ...row,
        current_debt_usd: Number(row.current_debt_usd) || 0,
      })) as Supplier[];
    } catch {
      return null;
    }
  },

  async upsertSupplier(supplier: Supplier, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_proveedores`;
    try {
      await supabase.from(table).upsert({
        id: supplier.id,
        name: supplier.name,
        contact_info: supplier.contact_info || supplier.type || '',
        current_debt_usd: supplier.current_debt_usd || 0,
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteSupplier(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_proveedores`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Supplier Purchases (detal_compras_proveedores / mayor_compras_proveedores)
  async fetchSupplierPurchases(mode: AppMode): Promise<SupplierPurchase[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_compras_proveedores`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as SupplierPurchase[]) || [];
    } catch {
      return null;
    }
  },

  async upsertSupplierPurchase(purchase: SupplierPurchase, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_compras_proveedores`;
    try {
      await supabase.from(table).upsert({
        id: purchase.id,
        date: purchase.date,
        supplier_id: purchase.supplier_id,
        supplier_name: purchase.supplier_name,
        currency: purchase.currency,
        quantity: purchase.quantity,
        cost_usd: purchase.cost_usd,
        credited_amount: purchase.credited_amount || 0,
        account_id: purchase.account_id || '',
        notes: purchase.notes || '',
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteSupplierPurchase(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_compras_proveedores`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Supplier Payments (detal_pagos_proveedores / mayor_pagos_proveedores)
  async fetchSupplierPayments(mode: AppMode): Promise<SupplierPayment[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_pagos_proveedores`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return (data as SupplierPayment[]) || [];
    } catch {
      return null;
    }
  },

  async upsertSupplierPayment(payment: SupplierPayment, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_pagos_proveedores`;
    try {
      await supabase.from(table).upsert({
        id: payment.id,
        date: payment.date,
        supplier_id: payment.supplier_id,
        supplier_name: payment.supplier_name,
        amount_usd: payment.amount_usd,
        account_id: payment.account_id || '',
        notes: payment.reference || payment.notes || '',
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteSupplierPayment(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_pagos_proveedores`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Initial Data Seeding
  async seedInitialIfEmpty(
    mode: AppMode,
    accounts: Account[],
    clients: Client[],
    suppliers: Supplier[]
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
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
      /* warn */
    }
  },

  async truncateAllTables(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const modes: AppMode[] = ['detal', 'mayor'];
    for (const m of modes) {
      const tables = [
        `${m}_pagos_proveedores`,
        `${m}_compras_proveedores`,
        `${m}_proveedores`,
        `${m}_cierres_diarios`,
        `${m}_gastos_ingresos`,
        `${m}_cambio_saldos`,
        `${m}_abonos_deudores`,
        `${m}_deudores`,
        `${m}_ventas_cripto_dolar`,
        `${m}_ventas_regionales`,
        `${m}_clientes`,
        `${m}_cuentas`,
      ];
      for (const t of tables) {
        try {
          await supabase.from(t).delete().neq('id', '___none___');
        } catch (err) {
          /* warn */
        }
      }
    }
  },
};
