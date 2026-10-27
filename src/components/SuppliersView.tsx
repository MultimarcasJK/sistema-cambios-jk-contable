'use client';

import React, { useState, useMemo } from 'react';
import { Account, Supplier, SupplierPurchase, SupplierPayment, CurrencyConfig } from '@/types';
import { newestFirst } from '@/lib/order';
import { StorageService } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { RatesService } from '@/lib/rates-service';
import { CurrencyService } from '@/lib/currencies';
import { ManageCurrenciesModal } from './ManageCurrenciesModal';
import { SupplierHistoryModal } from './SupplierHistoryModal';
import { ShareSupplierVoucherModal, SupplierVoucherData } from './ShareSupplierVoucherModal';
import { parseFormattedNumber, formatCurrency, formatRegionalAmount, formatRateDisplay, formatInputNumber } from '@/lib/formatters';
import {
  Truck,
  Plus,
  Coins,
  Wallet,
  ArrowDownLeft,
  CheckCircle,
  Search,
  DollarSign,
  AlertCircle,
  Settings,
  Receipt,
  Trash2,
  CopyX,
  Edit2,
  UserPlus,
  Building2,
  FileText,
  Share2,
  ArrowUp,
} from 'lucide-react';
import { localDateStr } from '@/lib/dates';
import { SearchableSelect } from '@/components/SearchableSelect';

interface SuppliersProps {
  accounts: Account[];
  suppliers: Supplier[];
  onDataChange: () => void;
}

export function SuppliersView({ accounts, suppliers, onDataChange }: SuppliersProps) {
  const { isAdmin } = useAuth();
  const todayStr = localDateStr();
  const [systemCurrencies, setSystemCurrencies] = useState<CurrencyConfig[]>(
    CurrencyService.getCurrencies()
  );
  const [isManagingCurrencies, setIsManagingCurrencies] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USDT');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [supplierVoucherData, setSupplierVoucherData] = useState<SupplierVoucherData | null>(null);

  // Gestión de Proveedores (Agregar / Editar / Borrar)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    type: 'USDT',
    contact_info: '',
    initial_debt: '0',
  });

  // Modal para abonar pago a proveedor
  const [paymentModalSupplier, setPaymentModalSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  // Helper para abrir comprobante gráfico del proveedor
  const handleOpenSupplierVoucher = (sup: Supplier) => {
    const supName = (sup.name || '').trim().toUpperCase();
    const supPurchases = StorageService.getSupplierPurchases().filter(
      (p) =>
        p.supplier_id === sup.id ||
        (p.supplier_name && p.supplier_name.trim().toUpperCase() === supName)
    );
    const supPayments = StorageService.getSupplierPayments().filter(
      (p) =>
        p.supplier_id === sup.id ||
        (p.supplier_name && p.supplier_name.trim().toUpperCase() === supName)
    );
    const totalPurchasedUsd = supPurchases.reduce((sum, p) => sum + (p.cost_usd || 0), 0);
    const totalPaidUsd =
      supPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0) +
      supPurchases.reduce((sum, p) => sum + (p.credited_amount || 0), 0);
    const lastPayment = supPayments[0];

    setSupplierVoucherData({
      supplierName: sup.name,
      type: sup.type,
      contactInfo: sup.contact_info,
      currentDebtUsd: sup.current_debt_usd || 0,
      totalPurchasedUsd,
      totalPaidUsd,
      purchasesCount: supPurchases.length,
      paymentsCount: supPayments.length,
      lastPaymentDate: lastPayment?.date,
      lastPaymentAmount: lastPayment?.amount_usd,
      lastPaymentReference: lastPayment?.reference,
      notes: sup.notes,
    });
  };

  // Formulario Unificado de Compra Multimoneda
  const [purchaseForm, setPurchaseForm] = useState({
    date: todayStr,
    supplier_id: '',
    quantity: '',
    buy_price: '1.004', // Tasa de compra
    account_id: '', // Cuenta donde entra el dinero comprado
    credited_amount: '0', // Abono de inmediato al proveedor
    notes: '',
  });

  const refreshCurrencies = () => {
    setSystemCurrencies(CurrencyService.getCurrencies());
  };

  // Moneda activa actual
  const currentCurrencyConfig = useMemo(() => {
    return (
      systemCurrencies.find((c) => c.code === selectedCurrency) || {
        code: selectedCurrency,
        name: selectedCurrency,
        symbol: '$',
      }
    );
  }, [systemCurrencies, selectedCurrency]);

  // Cálculo en vivo según la moneda:
  const calculatedCost = useMemo(() => {
    const qty = parseFormattedNumber(purchaseForm.quantity);
    const rate = parseFloat(purchaseForm.buy_price) || 1;
    const credited = parseFormattedNumber(purchaseForm.credited_amount);

    if (qty <= 0 || rate <= 0) return { costUsd: 0, pendingDebt: 0 };

    let costUsd = 0;
    if (selectedCurrency === 'USD') {
      costUsd = qty;
    } else if (selectedCurrency === 'USDT') {
      costUsd = Number((qty / rate).toFixed(4));
    } else if (selectedCurrency === 'EUR') {
      costUsd = Number((qty * rate).toFixed(2));
    } else {
      costUsd = Number((qty / rate).toFixed(2));
    }

    const pendingDebt = Number((costUsd - credited).toFixed(2));
    return { costUsd, pendingDebt };
  }, [selectedCurrency, purchaseForm.quantity, purchaseForm.buy_price, purchaseForm.credited_amount]);

  // Cuentas sugeridas para la moneda seleccionada
  const matchingAccounts = useMemo(() => {
    return accounts.filter((a) => a.currency === selectedCurrency);
  }, [accounts, selectedCurrency]);

  const handleCurrencyChange = (newCurr: string) => {
    setSelectedCurrency(newCurr);
    let defaultRate = '1';
    if (newCurr === 'USDT') defaultRate = '1.004';
    else if (newCurr === 'VES') defaultRate = '788';
    else if (newCurr === 'COP') defaultRate = '4150';
    else if (newCurr === 'PEN') defaultRate = '3.80';
    else if (newCurr === 'EUR') defaultRate = '1.08';
    else if (newCurr === 'CLP') defaultRate = '950';
    else if (newCurr === 'BRL') defaultRate = '5.40';
    else if (newCurr === 'MXN') defaultRate = '19.5';
    else if (newCurr === 'ARS') defaultRate = '1200';
    // Si App JK tiene la tasa de costo (compra) de hoy, se usa esa en vez del valor fijo
    defaultRate = RatesService.liveCostRate(newCurr, StorageService.getAppMode()) ?? defaultRate;

    setPurchaseForm((prev) => ({
      ...prev,
      buy_price: defaultRate,
      account_id: '',
    }));
  };

  // Submit Compra Multimoneda
  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.supplier_id || !purchaseForm.quantity || !purchaseForm.buy_price) {
      alert(`Por favor seleccione el proveedor, cantidad y precio de costo de ${selectedCurrency}`);
      return;
    }

    const supplier = suppliers.find((s) => s.id === purchaseForm.supplier_id);
    const qty = parseFormattedNumber(purchaseForm.quantity);
    const rate = parseFloat(purchaseForm.buy_price) || 1;
    const credited = parseFormattedNumber(purchaseForm.credited_amount);

    StorageService.addSupplierPurchase({
      date: purchaseForm.date,
      supplier_id: purchaseForm.supplier_id,
      supplier_name: supplier ? supplier.name : `PROVEEDOR ${selectedCurrency}`,
      currency: selectedCurrency,
      quantity: qty,
      buy_price: rate,
      cost_usd: calculatedCost.costUsd,
      account_id: purchaseForm.account_id || undefined,
      credited_amount: credited,
      notes: purchaseForm.notes,
    });

    setPurchaseForm({
      date: purchaseForm.date,
      supplier_id: '',
      quantity: '',
      buy_price: purchaseForm.buy_price,
      account_id: '',
      credited_amount: '0',
      notes: '',
    });

    onDataChange();
  };

  // Pagos a Proveedores
  const handleSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalSupplier) return;
    const amount = parseFormattedNumber(paymentAmount);
    if (amount <= 0) {
      alert('Por favor ingrese un monto válido');
      return;
    }

    StorageService.addSupplierPayment({
      date: todayStr,
      supplier_id: paymentModalSupplier.id,
      supplier_name: paymentModalSupplier.name,
      amount_usd: amount,
      account_id: paymentAccountId || undefined,
      reference: paymentReference,
    });

    setPaymentModalSupplier(null);
    setPaymentAmount('');
    setPaymentAccountId('');
    setPaymentReference('');
    onDataChange();
  };

  // Acciones de Proveedores (Crear / Editar / Eliminar)
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierFormData({
      name: '',
      type: 'USDT',
      contact_info: '',
      initial_debt: '0',
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupplierFormData({
      name: sup.name,
      type: sup.type,
      contact_info: sup.contact_info || '',
      initial_debt: sup.current_debt_usd.toString(),
    });
    setIsSupplierModalOpen(true);
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (confirm(`¿Estás seguro de que deseas eliminar al proveedor "${sup.name}"?`)) {
      await StorageService.deleteSupplier(sup.id);
      onDataChange();
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (confirm('¿Deseas eliminar esta compra de inventario? Se revertirá la deuda al proveedor y el saldo ingresado a la cuenta.')) {
      await StorageService.deleteSupplierPurchase(id);
      onDataChange();
    }
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim()) {
      alert('Por favor ingrese el nombre del proveedor');
      return;
    }

    const debtVal = parseFloat(supplierFormData.initial_debt) || 0;

    if (editingSupplier) {
      StorageService.updateSupplier(editingSupplier.id, {
        name: supplierFormData.name.trim(),
        type: supplierFormData.type,
        contact_info: supplierFormData.contact_info.trim(),
        current_debt_usd: debtVal,
      });
    } else {
      StorageService.addSupplier({
        name: supplierFormData.name.trim(),
        type: supplierFormData.type,
        contact_info: supplierFormData.contact_info.trim(),
        current_debt_usd: debtVal,
      });
    }

    setIsSupplierModalOpen(false);
    onDataChange();
  };

  const totalDebtToSuppliers = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.current_debt_usd || 0), 0);
  }, [suppliers]);

  const purchasesHistory = newestFirst(StorageService.getSupplierPurchases());
  // Compras que parecen la misma anotada dos veces (mismo día, proveedor y casi el mismo monto)
  const posiblesCopias = new Set(
    purchasesHistory
      .filter((p) =>
        purchasesHistory.some(
          (o) =>
            o.id !== p.id &&
            o.date === p.date &&
            (o.supplier_id === p.supplier_id || o.supplier_name === p.supplier_name) &&
            Math.abs((o.quantity || 0) - (p.quantity || 0)) < 1,
        ),
      )
      .map((p) => p.id),
  );

  const handleQuitarCopia = async (p: SupplierPurchase) => {
    const motivo = window.prompt(
      `Quitar la compra de ${formatRegionalAmount(p.quantity)} ${p.currency} del ${p.date} como COPIA REPETIDA.\n\n` +
        'Se borra el registro SIN mover el saldo de la cuenta ni la deuda del proveedor ' +
        '(úsalo solo con la copia que sobra, la que hace que la cuenta no cuadre). Escribe el motivo:',
      'Copia repetida por sincronización',
    );
    if (motivo === null) return;
    try {
      await StorageService.removeDuplicateRecord('compra_proveedor', p.id, motivo);
      onDataChange();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };
  const paymentsHistory = newestFirst(StorageService.getSupplierPayments());

  const commonCurrencies = ['USDT', 'VES', 'COP', 'PEN', 'EUR', 'USD'];

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Resumen Superior Cuentas por Pagar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-semibold text-indigo-300 tracking-wider">
            Total Cuentas por Pagar (Proveedores)
          </span>
          <div className="text-3xl font-black font-mono mt-1 text-amber-400">
            ${totalDebtToSuppliers.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
          <p className="text-xs text-slate-300">
            Deuda total por compras de divisas, cripto y fondos a proveedores
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              const el = document.getElementById('seccion-proveedores');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            title="Ir directamente al Directorio de Proveedores"
          >
            <span>PROVEEDORES ✅</span>
          </button>

          <button
            onClick={handleOpenAddSupplier}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Nuevo Proveedor</span>
          </button>

          <button
            onClick={() => setIsManagingCurrencies(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span>Gestionar Catálogo de Monedas</span>
          </button>
        </div>
      </div>

      {/* Formulario Compra Multimoneda */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Selector de Moneda a Comprar: siempre en 1 sola línea horizontal fija */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
                  Registrar Compra de Inventario
                </h2>
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono">
                  {currentCurrencyConfig.code}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 hidden sm:block">
                Selecciona la divisa o cripto que compras a mayoristas
              </p>
            </div>
          </div>

          {/* Botones de Monedas Rápidas y Dropdown en 1 sola fila sin salto */}
          <div className="flex items-center flex-nowrap shrink-0 gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {commonCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleCurrencyChange(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  selectedCurrency === c
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c}
              </button>
            ))}

            <SearchableSelect
              value={commonCurrencies.includes(selectedCurrency) ? '' : selectedCurrency}
              onChange={(e) => {
                if (e.target.value) handleCurrencyChange(e.target.value);
              }}
              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none max-w-[135px] cursor-pointer shrink-0"
            >
              <option value="">Más monedas...</option>
              {systemCurrencies
                .filter((c) => !commonCurrencies.includes(c.code))
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
            </SearchableSelect>
          </div>
        </div>

        <form
          onSubmit={handlePurchaseSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={purchaseForm.date}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Proveedor *</label>
              <SearchableSelect
                value={purchaseForm.supplier_id}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white"
                required
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Deuda: ${s.current_debt_usd.toFixed(2)} USD)
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cantidad de {currentCurrencyConfig.code} ({currentCurrencyConfig.symbol}) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ej. 10,000"
                value={purchaseForm.quantity}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: formatInputNumber(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tasa / Costo ({selectedCurrency === 'EUR' ? 'EUR por USD' : selectedCurrency === 'USDT' ? 'Precio USDT' : `${currentCurrencyConfig.code}/USD`}) *
              </label>
              <input
                type="number"
                step="any"
                placeholder="ej. 4150"
                value={purchaseForm.buy_price}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, buy_price: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cuenta Receptora (Entra {currentCurrencyConfig.code})
              </label>
              <SearchableSelect
                value={purchaseForm.account_id}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white"
              >
                <option value="">Seleccionar cuenta donde ingresa...</option>
                {matchingAccounts.length > 0 && (
                  <optgroup label={`Cuentas en ${selectedCurrency}`}>
                    {matchingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency}) - Saldo: {a.current_balance.toLocaleString()}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Otras Cuentas">
                  {accounts
                    .filter((a) => a.currency !== selectedCurrency)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency}) - Saldo: {a.current_balance.toLocaleString()}
                      </option>
                    ))}
                </optgroup>
              </SearchableSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Abono Inmediato al Proveedor ($ USD)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={purchaseForm.credited_amount}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, credited_amount: formatInputNumber(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notas / Referencia</label>
              <input
                type="text"
                placeholder="Observaciones de la compra..."
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          {/* Caja de Cálculos de Costo en USD */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 block">Costo Proveedor ($ USD)</span>
              <span className="text-xl font-bold font-mono text-slate-900">
                ${calculatedCost.costUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block">Deuda Neta que se Agrega</span>
              <span className="text-xl font-black font-mono text-rose-600">
                +${calculatedCost.pendingDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 ml-auto cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Registrar Compra {currentCurrencyConfig.code}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Historial de Compras de Inventario */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Historial de Compras a Proveedores</h3>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
            {purchasesHistory.length} compras registradas
          </span>
        </div>

        {purchasesHistory.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">
            Aún no se registran compras de inventario.
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Moneda</th>
                  <th className="p-3 text-right">Cantidad Comprada</th>
                  <th className="p-3 text-right">Tasa Costo</th>
                  <th className="p-3 text-right">Costo ($ USD)</th>
                  <th className="p-3">Cuenta Destino</th>
                  <th className="p-3 text-right">Abono Inmediato</th>
                  <th className="p-3 text-center whitespace-nowrap sticky right-0 bg-slate-100 z-10 border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {purchasesHistory.map((p) => {
                  const acc = accounts.find((a) => a.id === p.account_id);
                  return (
                    <tr key={p.id} className="group hover:bg-slate-50 transition">
                      <td className="p-3 font-sans text-slate-600">{p.date}</td>
                      <td className="p-3 font-sans font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            const supName = (p.supplier_name || '').trim().toUpperCase();
                            const found = suppliers.find(
                              (s) =>
                                s.id === p.supplier_id ||
                                (s.name && s.name.trim().toUpperCase() === supName)
                            );
                            if (found) {
                              setSelectedSupplierForHistory(found);
                            } else {
                              setSelectedSupplierForHistory({
                                id: p.supplier_id,
                                name: p.supplier_name,
                                type: p.currency,
                                current_debt_usd: 0,
                              });
                            }
                          }}
                          className="hover:text-blue-600 hover:underline text-left cursor-pointer transition"
                          title="Ver historial de este proveedor"
                        >
                          {p.supplier_name}
                        </button>
                      </td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                          {p.currency}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        <span className="text-[10px] font-bold text-indigo-700 mr-1.5 px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
                          {p.currency}
                        </span>
                        {formatRegionalAmount(p.quantity)}
                      </td>
                      <td className="p-3 text-right text-slate-600 font-mono">{formatRateDisplay(p.buy_price)}</td>
                      <td className="p-3 text-right font-bold text-indigo-600 whitespace-nowrap">
                        ${formatCurrency(p.cost_usd)}
                      </td>
                      <td className="p-3 font-sans text-slate-600">
                        {acc ? acc.name : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {p.credited_amount && p.credited_amount > 0
                          ? `+$${formatCurrency(p.credited_amount)}`
                          : '$0.00'}
                      </td>
                      <td className="p-3 text-center font-sans sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <button
                          type="button"
                          onClick={() => handleDeletePurchase(p.id)}
                          title="Eliminar compra"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition cursor-pointer inline-flex items-center justify-center shadow-2xs"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                        {isAdmin && posiblesCopias.has(p.id) && (
                          <button
                            type="button"
                            onClick={() => handleQuitarCopia(p)}
                            title="Quitar copia repetida (no mueve saldos ni deudas)"
                            className="ml-1.5 p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition cursor-pointer inline-flex items-center justify-center shadow-2xs"
                          >
                            <CopyX className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Directorio de Proveedores y Cuentas por Pagar */}
      <div id="seccion-proveedores" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Cuentas por Pagar a Proveedores</span>
            </h3>
            <p className="text-xs text-slate-500">
              Directorio de mayoristas, proveedores de divisas/cripto y saldos pendientes
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleOpenAddSupplier}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center space-x-1 cursor-pointer"
              title="Volver a la cabecera arriba"
            >
              <ArrowUp className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Subir ↑</span>
            </button>
          </div>
        </div>

        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500 font-medium">No se encontraron proveedores.</p>
            <button
              onClick={handleOpenAddSupplier}
              className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              + Registrar el primer proveedor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition bg-slate-50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4
                        onClick={() => setSelectedSupplierForHistory(sup)}
                        className="font-bold text-slate-900 text-sm leading-tight hover:text-blue-500 cursor-pointer transition"
                        title="Clic para ver historial completo"
                      >
                        {sup.name}
                      </h4>
                      {sup.type && sup.type !== '-' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 mt-1 inline-block">
                          {sup.type}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditSupplier(sup)}
                        title="Editar proveedor"
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-200/50 rounded-lg transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(sup)}
                        title="Eliminar proveedor"
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {sup.contact_info && (
                    <div className="mt-2.5 p-2 rounded-lg contact-payment-box flex items-start space-x-2 text-xs">
                      <Wallet className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <span className="font-semibold break-words leading-relaxed">
                        {sup.contact_info}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Saldo que Debemos:</span>
                      <span
                        className={`font-mono font-black text-base ${
                          sup.current_debt_usd > 0
                            ? 'text-rose-600'
                            : sup.current_debt_usd < 0
                            ? 'text-emerald-500'
                            : 'text-slate-400'
                        }`}
                      >
                        {sup.current_debt_usd > 0
                          ? `-$${sup.current_debt_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`
                          : sup.current_debt_usd < 0
                          ? `+$${Math.abs(sup.current_debt_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`
                          : '$0.00 USD'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierForHistory(sup)}
                      className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition cursor-pointer"
                      title="Ver extracto y compras del proveedor"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span>Ver Historial</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenSupplierVoucher(sup)}
                      title="Compartir Comprobante por WhatsApp"
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentModalSupplier(sup)}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1 cursor-pointer"
                      title="Registrar abono de pago"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Abonar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredSuppliers.length > 0 && (
          <div className="flex justify-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <ArrowUp className="w-4 h-4 text-blue-600" />
              <span>Volver a la cabecera arriba ↑</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal para Crear / Editar Proveedor */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingSupplier ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Ingresa los datos del mayorista de divisas o criptoactivos
            </p>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre del Proveedor / Mayorista *
                </label>
                <input
                  type="text"
                  placeholder="ej. PEDRO PÉREZ (COP) o BINANCE P2P"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Moneda / Tipo Principal
                  </label>
                  <SearchableSelect
                    value={supplierFormData.type}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, type: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {systemCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                    <option value="CRIPTO">CRIPTO GENERAL</option>
                    <option value="FIAT">FIAT GENERAL</option>
                  </SearchableSelect>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Deuda Inicial ($ USD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={supplierFormData.initial_debt}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, initial_debt: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Contacto / Datos de Pago / Notas
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. WhatsApp +57 300 000 0000, Cuenta Bancolombia #12345678"
                  value={supplierFormData.contact_info}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_info: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm cursor-pointer"
                >
                  {editingSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para pagar a proveedor */}
      {paymentModalSupplier && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Registrar Pago / Abono a Proveedor</h3>
            <p className="text-xs text-slate-500 mb-4">
              Proveedor: <span className="font-bold text-slate-800">{paymentModalSupplier.name}</span> • Deuda actual: ${paymentModalSupplier.current_debt_usd.toFixed(2)} USD
            </p>

            <form
              onSubmit={handleSupplierPayment}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Monto a Pagar (USD) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(formatInputNumber(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cuenta de Desembolso (Opcional)
                </label>
                <SearchableSelect
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency}) - Saldo: {a.current_balance}
                    </option>
                  ))}
                </SearchableSelect>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Referencia</label>
                <input
                  type="text"
                  placeholder="Hash / Comprobante"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalSupplier(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Monedas */}
      {isManagingCurrencies && (
        <ManageCurrenciesModal
          onClose={() => setIsManagingCurrencies(false)}
          onCurrenciesChange={refreshCurrencies}
        />
      )}

      {/* Modal de Historial Completo del Proveedor */}
      {selectedSupplierForHistory && (
        <SupplierHistoryModal
          isOpen={!!selectedSupplierForHistory}
          onClose={() => setSelectedSupplierForHistory(null)}
          supplier={selectedSupplierForHistory}
          accounts={accounts}
          onOpenPayment={(sup) => {
            setPaymentModalSupplier(sup);
          }}
          onOpenVoucher={(vData) => {
            setSupplierVoucherData(vData);
          }}
          onEditSupplier={(sup) => {
            handleOpenEditSupplier(sup);
          }}
          onDeleteSupplier={(sup) => {
            handleDeleteSupplier(sup);
            setSelectedSupplierForHistory(null);
          }}
          onDataChange={onDataChange}
        />
      )}

      {/* Modal de Comprobante / Voucher Gráfico del Proveedor */}
      {supplierVoucherData && (
        <ShareSupplierVoucherModal
          data={supplierVoucherData}
          onClose={() => setSupplierVoucherData(null)}
        />
      )}
    </div>
  );
}
