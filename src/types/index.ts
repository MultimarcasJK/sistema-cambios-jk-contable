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
  order_index?: number;
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
  client_fee?: number; // comisión cobrada al cliente (se suma al total y a la ganancia)
  is_vip?: boolean;
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
  commission_account?: number; // comisión que sale de la cuenta de salida, en su moneda
  fee_percent?: number;
  client_fee?: number; // comisión cobrada al cliente (se suma al total y a la ganancia)
  is_vip?: boolean;
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
  profit_remesas?: number; // ganancia de remesas pagadas ese día
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

export interface Employee {
  id: string;
  name: string;
  identification?: string;
  phone?: string;
  position: string;
  base_salary: number;
  salary_currency: Currency;
  payment_frequency: 'quincenal' | 'mensual' | 'semanal';
  payment_details?: string;
  is_active: boolean;
  created_at: string;
}

export interface PayrollPayment {
  id: string;
  date: string;
  employee_id: string;
  employee_name: string;
  period: string;
  base_amount: number;
  bonuses: number;
  deductions: number;
  net_amount: number;
  currency: Currency;
  amount_currency: number;
  exchange_rate: number;
  amount_usd: number;
  account_id?: string;
  expense_id?: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export type ServiceCategory =
  | 'SERVICIOS_PUBLICOS'
  | 'ALQUILER_LOCAL'
  | 'INTERNET_TELEFONIA'
  | 'MANTENIMIENTO'
  | 'PAPELERIA_SUMINISTROS'
  | 'TRANSPORTE_VIATICOS'
  | 'COMISIONES_OPERADORES'
  | 'OTROS';

export interface ServiceExpense {
  id: string;
  date: string;
  category: ServiceCategory;
  description: string;
  invoice_number?: string;
  amount: number;
  currency: Currency;
  exchange_rate: number;
  amount_usd: number;
  account_id?: string;
  expense_id?: string;
  notes?: string;
  created_at: string;
}



// ─── Contabilidad: ajustes de saldo y bitácora de auditoría ───

export interface BalanceAdjustment {
  id: string;
  date: string;
  account_id: string;
  account_name: string;
  currency: Currency;
  previous_balance: number;
  new_balance: number;
  delta: number; // new_balance - previous_balance (o la diferencia reconocida)
  reason: string;
  kind: 'manual' | 'reconciliacion';
  user_email?: string;
  created_at: string;
}

export type AuditAction =
  | 'crear'
  | 'eliminar'
  | 'editar'
  | 'ajuste_saldo'
  | 'cierre'
  | 'reapertura'
  | 'bloqueado';

export interface AuditEntry {
  id: string;
  ts: string;
  mode: AppMode;
  user_id?: string;
  user_email?: string;
  action: AuditAction;
  entity: string;
  entity_id: string;
  summary: string;
  reason?: string;
  data?: unknown;
}

// ─── Remesas ───

export interface Beneficiario {
  id: string;
  name: string;
  identification?: string;
  bank?: string;
  account_number?: string; // cuenta o teléfono de pago móvil
  phone?: string;
  country: string;
}

export interface Remitente {
  id: string;
  name: string;
  identification?: string;
  phone?: string;
  beneficiarios: Beneficiario[];
  created_at: string;
  updated_at?: string;
}

export type RemesaEstado = 'cobrada' | 'en_proceso' | 'pagada' | 'fallida' | 'anulada';

export type RemesaMetodoPago = 'cuenta_propia' | 'aliado';

export interface RemesaEvento {
  estado: RemesaEstado;
  ts: string;
  date: string;
  user_email?: string;
  nota?: string;
}

// Pago que un ADMIN revirtió: se guarda para que la contabilidad muestre el pago y su reverso
export interface RemesaPagoRevertido {
  fecha_pago: string;
  ts_pago?: string;
  fecha_reverso: string;
  ts: string;
  metodo_pago: RemesaMetodoPago;
  cuenta_pago_id?: string;
  aliado_id?: string;
  aliado_name?: string;
  monto_pago: number;
  costo_usd: number;
  ganancia_usd: number;
  referencia_pago?: string;
  nota: string;
  user_email?: string;
}

export interface Remesa {
  id: string;
  numero: number;
  date: string; // fecha de cobro
  created_at: string;
  remitente_id: string;
  remitente_name: string;
  remitente_identification?: string;
  remitente_phone?: string;
  beneficiario: Beneficiario;
  pais_pago: string;
  moneda_origen: Currency;
  monto_enviar: number; // lo que se convierte (moneda origen)
  comision: number; // tarifa al remitente (moneda origen)
  total_cobrado: number; // monto_enviar + comision
  monto_fiado?: number; // parte del total que el remitente quedó debiendo (moneda_origen)
  fiado_usd?: number; // la misma deuda en USD, la que va a Deudores
  tasa_cliente: number; // unidades moneda pago por 1 unidad moneda origen
  moneda_pago: Currency;
  monto_pago: number; // lo que recibe el beneficiario
  tasa_costo: number; // tasa de mercado / del aliado (moneda pago por 1 USD)
  tasa_origen_usd: number; // unidades de moneda origen por 1 USD (1 si es USD)
  costo_usd: number; // lo que cuesta entregar monto_pago, en USD
  ganancia_usd: number;
  cuenta_cobro_id: string;
  metodo_pago: RemesaMetodoPago;
  cuenta_pago_id?: string;
  aliado_id?: string;
  aliado_name?: string;
  referencia_cobro?: string;
  referencia_pago?: string;
  notes?: string;
  estado: RemesaEstado;
  fecha_pago?: string;
  fecha_anulacion?: string;
  pagos_revertidos?: RemesaPagoRevertido[];
  historial: RemesaEvento[];
}
