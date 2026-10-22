import { supabase, isSupabaseConfigured } from './supabase';
import { packClientFee, unpackClientFee } from './client-fee';

// Varias tablas no guardan la hora de creación; se recupera del id (prefijo-<milisegundos>)
// para que las listas sigan ordenadas de la más nueva a la más vieja después de sincronizar.
export function createdAtOf(row: { id?: string; created_at?: string } | null | undefined): string | undefined {
  if (row?.created_at) return row.created_at;
  const m = /-(\d{13})(?:\D|$)/.exec(String(row?.id || ''));
  return m ? new Date(Number(m[1])).toISOString() : undefined;
}
import {
  Remesa,
  Remitente,
  AuditEntry,
  BalanceAdjustment,
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
  Employee,
  PayrollPayment,
  ServiceExpense,
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
        account_subtype: row.account_subtype || '',
        account_number: row.account_number || '',
        notes: row.notes || '',
        order_index: row.order_index !== undefined && row.order_index !== null ? Number(row.order_index) : undefined,
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
      const payload: any = {
        id: account.id,
        name: account.name,
        currency: account.currency,
        current_balance: account.current_balance,
        initial_balance: account.initial_balance || 0,
        type: account.type || 'banco',
        bank_name: account.bank_name || '',
        responsible: account.responsible || '',
        account_subtype: account.account_subtype || '',
        account_number: account.account_number || '',
        notes: account.notes || '',
        country: account.country || (mode === 'mayor' ? 'VENEZUELA' : 'ECUADOR'),
      };
      if (account.order_index !== undefined && account.order_index !== null) {
        payload.order_index = account.order_index;
      }
      const { error } = await supabase.from(table).upsert(payload);
      if (error) {
        console.error(`[SupabaseSync] Error al guardar cuenta ${account.name} en ${table}:`, error);
      }
    } catch (err) {
      console.error(`[SupabaseSync] Excepción al guardar cuenta en ${table}:`, err);
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
        ...unpackClientFee(row.notes),
        created_at: createdAtOf(row),
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
        notes: packClientFee(tx.notes, tx.client_fee, tx.is_vip),
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
        ...unpackClientFee(row.notes),
        created_at: createdAtOf(row),
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
        notes: packClientFee(tx.notes, tx.client_fee, tx.is_vip),
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

  // Devuelve true solo si Supabase confirmó la escritura (o no hay Supabase configurado).
  // supabase-js no lanza excepciones: los fallos llegan en `error` y antes se ignoraban.
  async upsertDebtor(debtor: Debtor, mode: AppMode): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return true;
    const table = `${mode}_deudores`;
    try {
      const { error } = await supabase.from(table).upsert({
        id: debtor.id,
        client_name: debtor.client_name,
        phone: debtor.phone || '',
        current_debt: debtor.current_debt,
        notes: debtor.notes || '',
        updated_at: debtor.updated_at || new Date().toISOString(),
      });
      if (error) {
        console.warn(`[SupabaseSync] No se pudo guardar el deudor ${debtor.id}:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[SupabaseSync] No se pudo guardar el deudor ${debtor.id}:`, err);
      return false;
    }
  },

  async deleteDebtor(id: string, mode: AppMode, clientName?: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return true;
    const table = `${mode}_deudores`;
    try {
      if (id) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
          console.warn(`[SupabaseSync] No se pudo borrar el deudor ${id}:`, error.message);
          return false;
        }
      }
      if (clientName && clientName.trim()) {
        // Escapar comodines de ILIKE para que el nombre se compare literalmente
        const pattern = clientName.trim().replace(/[\\%_]/g, (c) => '\\' + c);
        const { error } = await supabase.from(table).delete().ilike('client_name', pattern);
        if (error) {
          console.warn(`[SupabaseSync] No se pudo borrar el deudor ${clientName}:`, error.message);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.warn(`[SupabaseSync] No se pudo borrar el deudor ${id}:`, err);
      return false;
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
        created_at: createdAtOf(row),
      })) as DebtPayment[];
    } catch {
      return null;
    }
  },

  // Devuelve true solo si Supabase confirmó la escritura (o no hay Supabase configurado).
  async upsertDebtPayment(payment: DebtPayment, mode: AppMode): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return true;
    const table = `${mode}_abonos_deudores`;
    try {
      const { error } = await supabase.from(table).upsert({
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
      if (error) {
        console.warn(`[SupabaseSync] No se pudo guardar el abono ${payment.id}:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[SupabaseSync] No se pudo guardar el abono ${payment.id}:`, err);
      return false;
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
      // La tabla guarda el concepto en "notes" y no tiene percentage_fee: se normaliza para que la pantalla no falle
      return ((data || []) as any[]).map((row) => ({
        ...row,
        amount_sent: Number(row.amount_sent) || 0,
        amount_received: Number(row.amount_received) || 0,
        commission: Number(row.commission) || 0,
        percentage_fee: Number(row.percentage_fee) || 0,
        concept: row.concept ?? row.notes ?? '',
        reference: row.reference ?? '',
        created_at: createdAtOf(row),
      })) as BalanceTransfer[];
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
      return ((data || []) as any[]).map((row) => ({ ...row, created_at: createdAtOf(row) })) as Expense[];
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
      return ((data || []) as any[]).map((row) => ({ ...row, created_at: createdAtOf(row) })) as SupplierPurchase[];
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
      return ((data || []) as any[]).map((row) => ({ ...row, created_at: createdAtOf(row) })) as SupplierPayment[];
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

  // Employees (detal_empleados / mayor_empleados)
  async fetchEmployees(mode: AppMode): Promise<Employee[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_empleados`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('name', { ascending: true });
      if (error) return null;
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        identification: row.identification || '',
        phone: row.phone || '',
        position: row.position || '',
        base_salary: Number(row.base_salary) || 0,
        salary_currency: row.salary_currency || 'USD',
        payment_frequency: row.payment_frequency || 'quincenal',
        payment_details: row.payment_details || '',
        is_active: row.is_active !== undefined && row.is_active !== null ? Boolean(row.is_active) : true,
        created_at: createdAtOf(row) || new Date().toISOString(),
      })) as Employee[];
    } catch {
      return null;
    }
  },

  async upsertEmployee(employee: Employee, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_empleados`;
    try {
      await supabase.from(table).upsert({
        id: employee.id,
        name: employee.name,
        identification: employee.identification || '',
        phone: employee.phone || '',
        position: employee.position,
        base_salary: employee.base_salary,
        salary_currency: employee.salary_currency,
        payment_frequency: employee.payment_frequency,
        payment_details: employee.payment_details || '',
        is_active: employee.is_active !== undefined ? employee.is_active : true,
        created_at: employee.created_at || new Date().toISOString(),
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteEmployee(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_empleados`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Payroll Payments (detal_pagos_nomina / mayor_pagos_nomina)
  async fetchPayrollPayments(mode: AppMode): Promise<PayrollPayment[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_pagos_nomina`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        date: row.date,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        period: row.period,
        base_amount: Number(row.base_amount) || 0,
        bonuses: Number(row.bonuses) || 0,
        deductions: Number(row.deductions) || 0,
        net_amount: Number(row.net_amount) || 0,
        currency: row.currency || 'USD',
        amount_currency: Number(row.amount_currency) || 0,
        exchange_rate: Number(row.exchange_rate) || 1,
        amount_usd: Number(row.amount_usd) || 0,
        account_id: row.account_id || '',
        expense_id: row.expense_id || '',
        reference: row.reference || '',
        notes: row.notes || '',
        created_at: createdAtOf(row) || new Date().toISOString(),
      })) as PayrollPayment[];
    } catch {
      return null;
    }
  },

  async upsertPayrollPayment(payment: PayrollPayment, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_pagos_nomina`;
    try {
      await supabase.from(table).upsert({
        id: payment.id,
        date: payment.date,
        employee_id: payment.employee_id,
        employee_name: payment.employee_name,
        period: payment.period,
        base_amount: payment.base_amount,
        bonuses: payment.bonuses,
        deductions: payment.deductions,
        net_amount: payment.net_amount,
        currency: payment.currency,
        amount_currency: payment.amount_currency,
        exchange_rate: payment.exchange_rate,
        amount_usd: payment.amount_usd,
        account_id: payment.account_id || '',
        expense_id: payment.expense_id || '',
        reference: payment.reference || '',
        notes: payment.notes || '',
        created_at: payment.created_at || new Date().toISOString(),
      });
    } catch (err) {
      /* warn */
    }
  },

  async deletePayrollPayment(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_pagos_nomina`;
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch (err) {
      /* warn */
    }
  },

  // Service Expenses (detal_gastos_servicios / mayor_gastos_servicios)
  async fetchServiceExpenses(mode: AppMode): Promise<ServiceExpense[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const table = `${mode}_gastos_servicios`;
    try {
      const { data, error } = await supabase.from(table).select('*').order('date', { ascending: false });
      if (error) return null;
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        date: row.date,
        category: row.category,
        description: row.description,
        invoice_number: row.invoice_number || '',
        amount: Number(row.amount) || 0,
        currency: row.currency || 'USD',
        exchange_rate: Number(row.exchange_rate) || 1,
        amount_usd: Number(row.amount_usd) || 0,
        account_id: row.account_id || '',
        expense_id: row.expense_id || '',
        notes: row.notes || '',
        created_at: createdAtOf(row) || new Date().toISOString(),
      })) as ServiceExpense[];
    } catch {
      return null;
    }
  },

  async upsertServiceExpense(service: ServiceExpense, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_gastos_servicios`;
    try {
      await supabase.from(table).upsert({
        id: service.id,
        date: service.date,
        category: service.category,
        description: service.description,
        invoice_number: service.invoice_number || '',
        amount: service.amount,
        currency: service.currency,
        exchange_rate: service.exchange_rate,
        amount_usd: service.amount_usd,
        account_id: service.account_id || '',
        expense_id: service.expense_id || '',
        notes: service.notes || '',
        created_at: service.created_at || new Date().toISOString(),
      });
    } catch (err) {
      /* warn */
    }
  },

  async deleteServiceExpense(id: string, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const table = `${mode}_gastos_servicios`;
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

  async resetBalancesToZeroInSupabase(targetMode: AppMode | 'both' = 'both'): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const modes: AppMode[] = targetMode === 'both' ? ['detal', 'mayor'] : [targetMode];
    for (const m of modes) {
      try {
        const { data: accs } = await supabase.from(`${m}_cuentas`).select('id');
        if (accs && accs.length > 0) {
          const ids = accs.map((r: any) => r.id);
          for (let i = 0; i < ids.length; i += 50) {
            await supabase.from(`${m}_cuentas`).update({ current_balance: 0, initial_balance: 0 }).in('id', ids.slice(i, i + 50));
          }
        }

        const { data: provs } = await supabase.from(`${m}_proveedores`).select('id');
        if (provs && provs.length > 0) {
          const ids = provs.map((r: any) => r.id);
          for (let i = 0; i < ids.length; i += 50) {
            await supabase.from(`${m}_proveedores`).update({ current_debt_usd: 0 }).in('id', ids.slice(i, i + 50));
          }
        }

        const deleteTables = [
          `${m}_ajustes_saldo`,
        `${m}_remesas`,
          `${m}_gastos_servicios`,
          `${m}_pagos_nomina`,
          `${m}_pagos_proveedores`,
          `${m}_compras_proveedores`,
          `${m}_cierres_diarios`,
          `${m}_gastos_ingresos`,
          `${m}_cambio_saldos`,
          `${m}_abonos_deudores`,
          `${m}_deudores`,
          `${m}_ventas_cripto_dolar`,
          `${m}_ventas_regionales`,
        ];
        for (const t of deleteTables) {
          try {
            await supabase.from(t).delete().neq('id', '___non_existent___');
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        console.error(`[SupabaseSync] Error resetting balances in Supabase for ${m}:`, err);
      }
    }
  },

  async truncateAllTables(targetMode: AppMode | 'both' = 'both'): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const modes: AppMode[] = targetMode === 'both' ? ['detal', 'mayor'] : [targetMode];
    for (const m of modes) {
      const tables = [
        `${m}_ajustes_saldo`,
        `${m}_remesas`,
        `${m}_remitentes`,
        `${m}_gastos_servicios`,
        `${m}_pagos_nomina`,
        `${m}_empleados`,
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
          await supabase.from(t).delete().neq('id', '___non_existent___');
        } catch {
          /* ignore */
        }
      }
    }
  },
  // Ajustes de saldo con motivo (detal_ajustes_saldo / mayor_ajustes_saldo)
  async fetchAdjustments(mode: AppMode): Promise<BalanceAdjustment[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from(`${mode}_ajustes_saldo`).select('*');
      if (error) return null;
      return ((data || []) as any[]).map((row) => ({
        ...row,
        previous_balance: Number(row.previous_balance) || 0,
        new_balance: Number(row.new_balance) || 0,
        delta: Number(row.delta) || 0,
      })) as BalanceAdjustment[];
    } catch {
      return null;
    }
  },

  async upsertAdjustment(adj: BalanceAdjustment, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from(`${mode}_ajustes_saldo`).upsert({
        id: adj.id,
        date: adj.date,
        account_id: adj.account_id,
        account_name: adj.account_name,
        currency: adj.currency,
        previous_balance: adj.previous_balance,
        new_balance: adj.new_balance,
        delta: adj.delta,
        reason: adj.reason,
        kind: adj.kind,
        user_email: adj.user_email || null,
        created_at: adj.created_at,
      });
    } catch {
      /* warn */
    }
  },

  // Bitácora de auditoría (detal_auditoria / mayor_auditoria): solo se inserta, nunca se edita
  async fetchAuditEntries(mode: AppMode, limit = 1000): Promise<AuditEntry[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from(`${mode}_auditoria`)
        .select('*')
        .order('ts', { ascending: false })
        .limit(limit);
      if (error) return null;
      return (data || []) as AuditEntry[];
    } catch {
      return null;
    }
  },

  async insertAuditEntry(entry: AuditEntry): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      // upsert con ignoreDuplicates: reintentar una fila ya subida no la modifica
      await supabase.from(`${entry.mode}_auditoria`).upsert(
        {
          id: entry.id,
          ts: entry.ts,
          mode: entry.mode,
          user_id: entry.user_id || null,
          user_email: entry.user_email || null,
          action: entry.action,
          entity: entry.entity,
          entity_id: entry.entity_id,
          summary: entry.summary,
          reason: entry.reason || null,
          data: entry.data ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    } catch {
      /* warn */
    }
  },
  // Remesas y remitentes: se guarda el registro completo en "data" (jsonb)
  async fetchRemesas(mode: AppMode): Promise<Remesa[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from(`${mode}_remesas`).select('data');
      if (error) return null;
      return ((data || []) as any[]).map((row) => row.data).filter(Boolean) as Remesa[];
    } catch {
      return null;
    }
  },

  async upsertRemesa(remesa: Remesa, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from(`${mode}_remesas`).upsert({
        id: remesa.id,
        numero: remesa.numero,
        date: remesa.date,
        estado: remesa.estado,
        pais_pago: remesa.pais_pago,
        data: remesa,
        updated_at: new Date().toISOString(),
      });
    } catch {
      /* warn */
    }
  },

  async fetchRemitentes(mode: AppMode): Promise<Remitente[] | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase.from(`${mode}_remitentes`).select('data');
      if (error) return null;
      return ((data || []) as any[]).map((row) => row.data).filter(Boolean) as Remitente[];
    } catch {
      return null;
    }
  },

  async upsertRemitente(rem: Remitente, mode: AppMode): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from(`${mode}_remitentes`).upsert({
        id: rem.id,
        name: rem.name,
        data: rem,
        updated_at: new Date().toISOString(),
      });
    } catch {
      /* warn */
    }
  },
};
