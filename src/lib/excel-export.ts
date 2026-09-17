import * as XLSX from 'xlsx';
import { StorageService } from './storage';

export function exportFullAccountingToExcel() {
  const wb = XLSX.utils.book_new();

  // 1. Cuentas
  const accounts = StorageService.getAccounts().map((a) => ({
    'Nombre Cuenta': a.name,
    'Banco': a.bank_name,
    'Moneda': a.currency,
    'Tipo': a.type,
    'Responsable': a.responsible,
    'Saldo Actual': a.current_balance,
    'Estado': a.is_active ? 'Activa' : 'Inactiva',
  }));
  const wsAccounts = XLSX.utils.json_to_sheet(accounts);
  XLSX.utils.book_append_sheet(wb, wsAccounts, 'SALDO EN CUENTAS');

  // 2. Venta Detal
  const detal = StorageService.getTransactionsDetal().map((d) => ({
    'Fecha': d.date,
    'Cliente': d.client_name,
    'Cantidad USDT': d.usdt_amount,
    'Precio Venta': d.sell_price,
    'Precio Compra': d.buy_price,
    'Debe Pagar': d.total_to_pay,
    'Monto Recibido': d.amount_received,
    'Ganancia ($)': d.profit_usd,
    'Comisión Banco': d.bank_fee,
    'Referencia': d.reference || '',
    'Notas': d.notes || '',
  }));
  const wsDetal = XLSX.utils.json_to_sheet(detal);
  XLSX.utils.book_append_sheet(wb, wsDetal, 'VENTA DETAL');

  // 3. Venta Mayor
  const mayor = StorageService.getTransactionsMayor().map((m) => ({
    'Fecha': m.date,
    'Cliente': m.client_name,
    'Cantidad Bolívares': m.amount_ves,
    'Precio Compra': m.buy_price,
    'Precio Venta': m.sell_price,
    'Total a Pagar': m.total_to_pay,
    'Comisión': m.commission,
    'Ganancia ($)': m.profit_usd,
    'Referencia': m.reference || '',
    'Notas': m.notes || '',
  }));
  const wsMayor = XLSX.utils.json_to_sheet(mayor);
  XLSX.utils.book_append_sheet(wb, wsMayor, 'VENTA MAYOR');

  // 4. Cambio de Saldo / Traspasos
  const transfers = StorageService.getTransfers().map((t) => ({
    'Fecha': t.date,
    'Cuenta Origen': t.from_account_id,
    'Cuenta Destino': t.to_account_id,
    'Monto Enviado': t.amount_sent,
    'Porcentaje (%)': t.percentage_fee,
    'Comisión': t.commission,
    'Monto Recibido': t.amount_received,
    'Concepto': t.concept,
    'Referencia': t.reference || '',
  }));
  const wsTransfers = XLSX.utils.json_to_sheet(transfers);
  XLSX.utils.book_append_sheet(wb, wsTransfers, 'CAMBIO SALDO');

  // 5. Gastos
  const expenses = StorageService.getExpenses().map((e) => ({
    'Fecha': e.date,
    'Descripción': e.description,
    'Monto': e.amount,
    'Moneda': e.currency,
    'Concepto': e.concept,
    'Equivalente USD': e.amount_usd,
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(expenses);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'GASTOS Y OTROS');

  // 6. Cierres
  const closures = StorageService.getClosures().map((c) => ({
    'Fecha': c.date,
    'Hora Cierre': c.closed_at,
    'Ganancia Detal ($)': c.profit_detal,
    'Ganancia Mayor ($)': c.profit_mayor,
    'Gastos del Día ($)': c.total_expenses,
    'Total Neto Ganado ($)': c.total_net_profit,
    'Total Deudores ($)': c.total_debtors_usd || 0,
    'Observaciones': c.notes || '',
  }));
  const wsClosures = XLSX.utils.json_to_sheet(closures);
  XLSX.utils.book_append_sheet(wb, wsClosures, 'CIERRE Y GANANCIA');

  // Descargar archivo Excel en el navegador
  const fileName = `CAMBIOS_JK_REPORTE_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export interface StatementRowExport {
  Fecha: string;
  Hora?: string;
  Tipo: string;
  Categoría: string;
  Descripción: string;
  'Tercero / Cliente / Proveedor': string;
  'Referencia Bancaria': string;
  'Entradas (+)': number | string;
  'Salidas (-)': number | string;
  'Saldo Resultante': number;
}

export function exportAccountStatementToExcel(
  accountName: string,
  bankName: string,
  currency: string,
  responsible: string,
  rows: StatementRowExport[],
  summary: {
    initialBalance: number;
    totalInflows: number;
    totalOutflows: number;
    finalBalance: number;
    periodLabel: string;
  }
) {
  const wb = XLSX.utils.book_new();

  // Hoja con los movimientos
  const wsMovements = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsMovements, 'ESTADO DE CUENTA');

  // Hoja de Resumen
  const summaryData = [
    { 'CONCEPTO': 'Cuenta', 'DETALLE': accountName },
    { 'CONCEPTO': 'Banco / Plataforma', 'DETALLE': bankName },
    { 'CONCEPTO': 'Moneda', 'DETALLE': currency },
    { 'CONCEPTO': 'Responsable', 'DETALLE': responsible },
    { 'CONCEPTO': 'Período', 'DETALLE': summary.periodLabel },
    { 'CONCEPTO': 'Saldo Inicial', 'DETALLE': summary.initialBalance },
    { 'CONCEPTO': 'Total Entradas (+)', 'DETALLE': summary.totalInflows },
    { 'CONCEPTO': 'Total Salidas (-)', 'DETALLE': summary.totalOutflows },
    { 'CONCEPTO': 'Saldo Final / Disponible', 'DETALLE': summary.finalBalance },
    { 'CONCEPTO': 'Fecha Emisión', 'DETALLE': new Date().toLocaleString() },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'RESUMEN');

  const cleanName = accountName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `ESTADO_CUENTA_${cleanName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

