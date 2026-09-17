export type Currency =
  | 'USD'
  | 'USDT'
  | 'VES'
  | 'COP'
  | 'PEN'
  | 'CLP'
  | 'BRL'
  | 'MXN'
  | 'EUR'
  | 'ARS'
  | 'BOB'
  | 'PYG'
  | 'UYU'
  | 'CRC'
  | 'GTQ'
  | 'HNL'
  | 'NIO'
  | 'CUP'
  | string;

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  isCrypto?: boolean;
}

export type AccountType = 'banco' | 'wallet' | 'efectivo' | 'zelle' | 'otro';

export type AccountUsageRole = 'mixta' | 'cobro' | 'desembolso';

export type UserRole = 'ADMIN' | 'OPERADOR' | 'admin' | 'cajero_detal' | 'operador_mayor';

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: 'ADMIN' | 'OPERADOR';
  modo_permitido?: 'detal' | 'mayor' | 'ambos';
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type AppMode = 'detal' | 'mayor';

export interface LiveRate {
  pais: string;
  codigo: Currency;
  moneda: string;
  tasaEnvio: number;
  margenEnvio: number;
  tasaRecibo: number;
  margenRecibo: number;
  margenEnvioMayor: number;
  margenReciboMayor: number;
  proveedor: string;
  ciudades?: string;
  iso?: string;
  factorEUR?: number;
  factorUSDT?: number;
}

export interface Account {
  id: string;
  name: string;
  bank_name: string;
  currency: Currency;
  type: AccountType;
  responsible: string;
  current_balance: number;
  initial_balance?: number;
  country?: string;
  account_number?: string;
  account_subtype?: string;
  notes?: string;
  usage_role?: AccountUsageRole;
  scope?: 'detal' | 'mayor' | 'ambos'; // Para clasificar cuentas por unidad de negocio
  is_active: boolean;
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  identification?: string; // RUC / Cédula / DNI
  phone?: string;
  address?: string;
  preferred_account?: string;
  notes?: string;
  current_debt?: number;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: 'USDT' | 'BOLIVARES' | 'MIXTO' | string;
  contact_info?: string;
  current_debt_usd: number;
  notes?: string;
  created_at?: string;
}

export interface SupplierPurchase {
  id: string;
  date: string;
  supplier_id: string;
  supplier_name: string;
  currency: Currency;
  quantity: number;
  buy_price: number;
  cost_usd: number;
  account_id?: string;
  credited_amount: number;
  notes?: string;
  created_at?: string;
}

export interface SupplierPayment {
  id: string;
  date: string;
  supplier_id: string;
  supplier_name: string;
  amount_usd: number;
  account_id?: string;
  reference?: string;
  notes?: string;
  created_at?: string;
}

export interface TransactionDetal {
  id: string;
  date: string;
  time?: string;
  client_name: string;
  client_id?: string;
  usdt_amount: number;
  sell_price: number;
  buy_price: number;
  total_to_pay: number;
  received_account_id?: string;
  amount_received: number;
  profit_usd: number;
  paid_account_id?: string;
  bank_fee: number;
  fee_percent?: number;
  payment_status?: 'PAGADO' | 'PENDIENTE' | 'PARCIAL';
  reference?: string;
  notes?: string;
  created_at?: string;
}

export interface TransactionMayor {
  id: string;
  date: string;
  client_name: string;
  client_id?: string;
  currency?: Currency | string;
  amount_ves: number;
  buy_price: number;
  sell_price: number;
  total_to_pay: number;
  received_account_id?: string;
  amount_received?: number;
  paid_account_id?: string;
  commission: number;
  fee_percent?: number;
  profit_usd: number;
  payment_status?: 'PAGADO' | 'PENDIENTE' | 'PARCIAL';
  reference?: string;
  notes?: string;
  created_at?: string;
}

export interface BalanceTransfer {
  id: string;
  date: string;
  from_account_id: string;
  to_account_id: string;
  amount_sent: number;
  percentage_fee: number;
  commission: number;
  amount_received: number;
  concept: string;
  reference?: string;
  created_at?: string;
}

export interface Expense {
  id: string;
  date: string;
  type: 'egreso' | 'ingreso';
  description: string;
  amount: number;
  currency: Currency;
  concept: string;
  account_id?: string;
  scope?: 'detal' | 'mayor' | 'general';
  amount_usd: number;
  created_at?: string;
}

export interface AccountSnapshot {
  account_id: string;
  name: string;
  bank_name: string;
  currency: Currency;
  responsible: string;
  balance: number;
}

export interface DebtorSnapshot {
  debtor_id: string;
  client_name: string;
  current_debt: number;
  phone?: string;
}

export interface DailyClosure {
  id: string;
  date: string;
  closed_at: string;
  profit_detal: number;
  profit_mayor: number;
  extra_income: number;
  total_expenses: number;
  total_net_profit: number;
  notes?: string;
  accounts_snapshot?: AccountSnapshot[];
  debtors_snapshot?: DebtorSnapshot[];
  total_debtors_usd?: number;
}

export interface Debtor {
  id: string;
  client_name: string;
  client_id?: string;
  current_debt: number;
  phone?: string;
  notes?: string;
  updated_at?: string;
}

export interface DebtPayment {
  id: string;
  debtor_id: string;
  client_name: string;
  date: string;
  amount: number; // Monto en USD que descuenta de la deuda
  currency?: Currency; // Moneda en que pagó el cliente (USD, COP, PEN, VES, etc.)
  amount_currency?: number; // Monto pagado en la moneda original
  exchange_rate?: number; // Tasa de cambio hacia USD
  account_id?: string;
  notes?: string;
  created_at?: string;
}

