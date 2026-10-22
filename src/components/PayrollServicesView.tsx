'use client';

import React, { useState, useMemo } from 'react';
import {
  Employee,
  PayrollPayment,
  ServiceExpense,
  ServiceCategory,
  Account,
  Currency,
  AppMode,
} from '@/types';
import { newestFirst } from '@/lib/order';
import { StorageService } from '@/lib/storage';
import { RatesService } from '@/lib/rates-service';
import { CurrencyService } from '@/lib/currencies';
import { formatInputNumber, parseFormattedNumber } from '@/lib/formatters';
import {
  Briefcase,
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Phone,
  CreditCard,
  Calendar,
  DollarSign,
  Building2,
  Receipt,
  Plus,
  FileText,
  AlertCircle,
  MessageCircle,
  Calculator,
  ArrowRightLeft,
  Sparkles,
  Clock,
  Share2,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { SharePayrollVoucherModal } from './SharePayrollVoucherModal';
import { localDateStr } from '@/lib/dates';

interface PayrollServicesViewProps {
  accounts: Account[];
  employees: Employee[];
  payrollPayments: PayrollPayment[];
  serviceExpenses: ServiceExpense[];
  onDataChange: () => void;
  appMode: AppMode;
}

export function PayrollServicesView({
  accounts,
  employees,
  payrollPayments,
  serviceExpenses,
  onDataChange,
  appMode,
}: PayrollServicesViewProps) {
  const isDark = appMode === 'mayor';
  const todayStr = localDateStr();

  // Sub-pestañas internas del módulo
  const [subTab, setSubTab] = useState<'employees' | 'payments' | 'services'>('employees');

  // Filtros de Empleados
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal Crear / Editar Empleado
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    identification: '',
    phone: '',
    position: '',
    base_salary: '',
    salary_currency: 'USD' as Currency,
    payment_frequency: 'quincenal' as 'quincenal' | 'mensual' | 'semanal',
    payment_details: '',
    is_active: true,
  });

  // Estado del Formulario Inteligente de Liquidación (Fase 3 Parte 2.1)
  const [liquidationForm, setLiquidationForm] = useState({
    employee_id: '',
    period: '',
    date: todayStr,
    base_amount: '',
    bonuses: '',
    deductions: '',
    agreed_currency: 'USD' as Currency,
    payment_currency: 'USD' as Currency,
    exchange_rate: '1',
    account_id: '',
    reference: '',
    notes: '',
  });

  const availableCurrencies = useMemo(() => {
    return CurrencyService.getCurrencies();
  }, []);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === liquidationForm.employee_id) || null;
  }, [employees, liquidationForm.employee_id]);

  const handleSelectEmployee = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) {
      setLiquidationForm((prev) => ({
        ...prev,
        employee_id: '',
        base_amount: '',
        bonuses: '',
        deductions: '',
        agreed_currency: 'USD',
        payment_currency: 'USD',
        exchange_rate: '1',
      }));
      return;
    }

    const currentMonthName = new Date().toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
    const currentYear = new Date().getFullYear();
    const day = new Date().getDate();
    let suggestedPeriod = `Mes de ${capitalizedMonth} ${currentYear}`;
    if (emp.payment_frequency === 'quincenal') {
      suggestedPeriod =
        day <= 15
          ? `1ra Quincena ${capitalizedMonth} ${currentYear}`
          : `2da Quincena ${capitalizedMonth} ${currentYear}`;
    } else if (emp.payment_frequency === 'semanal') {
      suggestedPeriod = `Semana del ${day} de ${capitalizedMonth} ${currentYear}`;
    }

    let defaultRate = '1';
    if (emp.salary_currency === 'USD' && liquidationForm.payment_currency === 'VES') defaultRate = '788';
    else if (emp.salary_currency === 'USD' && liquidationForm.payment_currency === 'COP') defaultRate = '4150';
    if (emp.salary_currency === 'USD') defaultRate = RatesService.liveCostRate(liquidationForm.payment_currency, appMode) ?? defaultRate;

    setLiquidationForm((prev) => ({
      ...prev,
      employee_id: emp.id,
      base_amount: String(emp.base_salary || ''),
      bonuses: '',
      deductions: '',
      period: suggestedPeriod,
      agreed_currency: emp.salary_currency,
      payment_currency: emp.salary_currency,
      exchange_rate: defaultRate,
    }));
  };

  const handlePaymentCurrencyChange = (newCurr: Currency) => {
    let defaultRate = '1';
    if (liquidationForm.agreed_currency === 'USD') {
      if (newCurr === 'VES') defaultRate = '788';
      else if (newCurr === 'COP') defaultRate = '4150';
      else if (newCurr === 'PEN') defaultRate = '3.80';
      else if (newCurr === 'EUR') defaultRate = '0.92';
    } else if (newCurr === 'USD') {
      if (liquidationForm.agreed_currency === 'VES') defaultRate = '788';
      else if (liquidationForm.agreed_currency === 'COP') defaultRate = '4150';
    }
    // Si App JK tiene la tasa de costo (compra) de hoy, se usa esa en vez del valor fijo
    if (liquidationForm.agreed_currency === 'USD') defaultRate = RatesService.liveCostRate(newCurr, appMode) ?? defaultRate;
    else if (newCurr === 'USD') defaultRate = RatesService.liveCostRate(liquidationForm.agreed_currency, appMode) ?? defaultRate;

    setLiquidationForm((prev) => ({
      ...prev,
      payment_currency: newCurr,
      exchange_rate: defaultRate,
    }));
  };

  // Cálculos Automáticos de Liquidación en Tiempo Real
  const calculationSummary = useMemo(() => {
    const base = parseFormattedNumber(liquidationForm.base_amount);
    const bonuses = parseFormattedNumber(liquidationForm.bonuses);
    const deductions = parseFormattedNumber(liquidationForm.deductions);
    const netAgreed = Math.max(0, Number((base + bonuses - deductions).toFixed(2)));

    const rate = parseFloat(liquidationForm.exchange_rate) || 1;
    const agreedCurr = liquidationForm.agreed_currency;
    const payCurr = liquidationForm.payment_currency;

    let toPayCurrency = netAgreed;
    let amountUsd = netAgreed;

    if (agreedCurr === payCurr) {
      toPayCurrency = netAgreed;
      if (payCurr === 'USD' || payCurr === 'USDT') {
        amountUsd = netAgreed;
      } else if (payCurr === 'EUR') {
        amountUsd = Number((netAgreed * (rate || 1.08)).toFixed(2));
      } else {
        amountUsd = rate > 0 ? Number((netAgreed / rate).toFixed(2)) : netAgreed;
      }
    } else if ((agreedCurr === 'USD' || agreedCurr === 'USDT') && payCurr !== 'USD' && payCurr !== 'USDT') {
      toPayCurrency = Number((netAgreed * rate).toFixed(2));
      amountUsd = netAgreed;
    } else if (agreedCurr !== 'USD' && agreedCurr !== 'USDT' && (payCurr === 'USD' || payCurr === 'USDT')) {
      toPayCurrency = rate > 0 ? Number((netAgreed / rate).toFixed(2)) : 0;
      amountUsd = toPayCurrency;
    } else {
      toPayCurrency = Number((netAgreed * rate).toFixed(2));
      amountUsd = rate > 0 ? Number((netAgreed / rate).toFixed(2)) : netAgreed;
    }

    return {
      base,
      bonuses,
      deductions,
      netAgreed,
      toPayCurrency,
      amountUsd: Number(amountUsd.toFixed(2)),
    };
  }, [liquidationForm]);

  // Cuentas bancarias agrupadas por divisa de pago para el desembolso (Parte 2.2)
  const matchingAccounts = useMemo(() => {
    return accounts.filter((a) => a.currency === liquidationForm.payment_currency && a.is_active);
  }, [accounts, liquidationForm.payment_currency]);

  const otherAccounts = useMemo(() => {
    return accounts.filter((a) => a.currency !== liquidationForm.payment_currency && a.is_active);
  }, [accounts, liquidationForm.payment_currency]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === liquidationForm.account_id) || null;
  }, [accounts, liquidationForm.account_id]);

  // Ejecución de Liquidación y Desembolso Contable (Parte 2.2)
  const [isSubmittingLiquidation, setIsSubmittingLiquidation] = useState(false);

  const handleSubmitLiquidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      alert('Por favor selecciona el empleado a liquidar.');
      return;
    }
    if (!liquidationForm.period.trim()) {
      alert('Por favor indica el período liquidado (ej. 1ra Quincena Octubre 2026).');
      return;
    }
    if (calculationSummary.toPayCurrency <= 0) {
      alert('El monto a transferir debe ser mayor a 0.00.');
      return;
    }
    if (!liquidationForm.account_id) {
      alert('Por favor selecciona la cuenta o caja bancaria de donde se debitarán los fondos.');
      return;
    }

    const rateNum = parseFloat(liquidationForm.exchange_rate) || 1;

    try {
      setIsSubmittingLiquidation(true);
      const newPayment = StorageService.addPayrollPayment(
        {
          date: liquidationForm.date,
          employee_id: selectedEmployee.id,
          employee_name: selectedEmployee.name,
          period: liquidationForm.period.trim(),
          base_amount: calculationSummary.base,
          bonuses: calculationSummary.bonuses,
          deductions: calculationSummary.deductions,
          net_amount: calculationSummary.netAgreed,
          currency: liquidationForm.payment_currency,
          amount_currency: calculationSummary.toPayCurrency,
          exchange_rate: rateNum,
          amount_usd: calculationSummary.amountUsd,
          account_id: liquidationForm.account_id,
          reference: liquidationForm.reference.trim() || undefined,
          notes: liquidationForm.notes.trim() || undefined,
        },
        appMode
      );

      alert(
        `¡Liquidación de sueldo registrada con éxito!\n\n` +
        `• Empleado: ${selectedEmployee.name}\n` +
        `• Período: ${newPayment.period}\n` +
        `• Desembolso: ${newPayment.currency} ${newPayment.amount_currency.toLocaleString('es-ES', { minimumFractionDigits: 2 })}\n` +
        `• Equivalente Contable: $${newPayment.amount_usd.toFixed(2)} USD\n\n` +
        `El saldo de la cuenta fue debitado y el egreso quedó registrado en el Cierre Diario.`
      );

      // Limpiar formulario y reiniciar selección
      setLiquidationForm({
        employee_id: '',
        period: '',
        date: todayStr,
        base_amount: '',
        bonuses: '',
        deductions: '',
        agreed_currency: 'USD',
        payment_currency: 'USD',
        exchange_rate: '1',
        account_id: '',
        reference: '',
        notes: '',
      });

      onDataChange();

      // Abrir automáticamente el comprobante gráfico para compartir por WhatsApp o descargar PNG
      setVoucherPayment(newPayment);
    } catch (err: any) {
      alert('Error al registrar la liquidación: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsSubmittingLiquidation(false);
    }
  };

  // Estados para el Historial de Pagos y Comprobante (Parte 2.3)
  const [voucherPayment, setVoucherPayment] = useState<PayrollPayment | null>(null);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentEmployeeFilter, setPaymentEmployeeFilter] = useState('ALL');
  const [paymentMonthFilter, setPaymentMonthFilter] = useState('');

  const filteredPayments = useMemo(() => {
    return newestFirst(payrollPayments).filter((p) => {
      const matchSearch =
        paymentSearch === '' ||
        p.employee_name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
        p.period.toLowerCase().includes(paymentSearch.toLowerCase()) ||
        (p.reference && p.reference.toLowerCase().includes(paymentSearch.toLowerCase()));

      const matchEmp = paymentEmployeeFilter === 'ALL' || p.employee_id === paymentEmployeeFilter;
      const matchMonth = paymentMonthFilter === '' || p.date.startsWith(paymentMonthFilter);

      return matchSearch && matchEmp && matchMonth;
    });
  }, [payrollPayments, paymentSearch, paymentEmployeeFilter, paymentMonthFilter]);

  const totalPaymentsAmountUsd = useMemo(() => {
    return payrollPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0);
  }, [payrollPayments]);

  const handleDeletePayment = async (pay: PayrollPayment) => {
    if (
      confirm(
        `¿Estás seguro de anular la liquidación de "${pay.employee_name}" (${pay.period}) por ${pay.currency} ${pay.amount_currency}?\n\n` +
        `• Se reintegrará el dinero a la cuenta bancaria de origen.\n` +
        `• Se eliminará el egreso contable del Cierre Diario.`
      )
    ) {
      await StorageService.deletePayrollPayment(pay.id, appMode);
      alert('¡Liquidación anulada con éxito! Los fondos fueron reintegrados al banco emisor.');
      onDataChange();
    }
  };

  // =========================================================
  // GASTOS DE SERVICIOS Y COSTOS FIJOS (FASE 5)
  // =========================================================
  const SERVICE_CATEGORIES: {
    key: ServiceCategory;
    label: string;
    badgeClass: string;
  }[] = [
    { key: 'SERVICIOS_PUBLICOS', label: 'Servicios Públicos (Luz/Agua/Gas)', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
    { key: 'ALQUILER_LOCAL', label: 'Alquiler de Local / Oficina', badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
    { key: 'INTERNET_TELEFONIA', label: 'Internet / Telefonía / Recargas', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
    { key: 'MANTENIMIENTO', label: 'Mantenimiento y Reparaciones', badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300' },
    { key: 'PAPELERIA_SUMINISTROS', label: 'Papelería y Suministros', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
    { key: 'TRANSPORTE_VIATICOS', label: 'Transporte y Viáticos', badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
    { key: 'COMISIONES_OPERADORES', label: 'Comisiones a Operadores', badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' },
    { key: 'OTROS', label: 'Otros Gastos Operativos', badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
  ];

  const [serviceForm, setServiceForm] = useState({
    date: todayStr,
    category: 'SERVICIOS_PUBLICOS' as ServiceCategory,
    description: '',
    invoice_number: '',
    amount: '',
    currency: 'USD' as Currency,
    exchange_rate: '1',
    account_id: '',
    notes: '',
  });

  const [isSubmittingService, setIsSubmittingService] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('ALL');
  const [serviceMonthFilter, setServiceMonthFilter] = useState('');

  const calculatedServiceUsd = useMemo(() => {
    const amt = parseFormattedNumber(serviceForm.amount);
    const rate = parseFloat(serviceForm.exchange_rate) || 1;
    if (amt <= 0) return 0;
    if (serviceForm.currency === 'USD' || serviceForm.currency === 'USDT') return amt;
    if (serviceForm.currency === 'EUR') return Number((amt * rate).toFixed(2));
    return rate > 0 ? Number((amt / rate).toFixed(2)) : amt;
  }, [serviceForm.amount, serviceForm.currency, serviceForm.exchange_rate]);

  const handleServiceCurrencyChange = (newCurr: Currency) => {
    let defaultRate = '1';
    if (newCurr === 'VES') defaultRate = '788';
    else if (newCurr === 'COP') defaultRate = '4150';
    else if (newCurr === 'PEN') defaultRate = '3.80';
    else if (newCurr === 'EUR') defaultRate = '1.08';
    else if (newCurr === 'CLP') defaultRate = '950';
    else if (newCurr === 'BRL') defaultRate = '5.40';
    defaultRate = RatesService.liveCostRate(newCurr, appMode) ?? defaultRate;

    setServiceForm((prev) => ({
      ...prev,
      currency: newCurr,
      exchange_rate: defaultRate,
      account_id: '',
    }));
  };

  const matchingServiceAccounts = useMemo(() => {
    return accounts.filter((a) => a.currency === serviceForm.currency && a.is_active);
  }, [accounts, serviceForm.currency]);

  const otherServiceAccounts = useMemo(() => {
    return accounts.filter((a) => a.currency !== serviceForm.currency && a.is_active);
  }, [accounts, serviceForm.currency]);

  const selectedServiceAccount = useMemo(() => {
    return accounts.find((a) => a.id === serviceForm.account_id) || null;
  }, [accounts, serviceForm.account_id]);

  const handleSubmitService = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFormattedNumber(serviceForm.amount);
    if (!serviceForm.description.trim()) {
      alert('Por favor ingrese la descripción o proveedor del servicio.');
      return;
    }
    if (amt <= 0) {
      alert('Por favor ingrese un monto válido mayor a 0.');
      return;
    }
    if (!serviceForm.account_id) {
      alert('Por favor seleccione la cuenta bancaria de donde se pagó el servicio.');
      return;
    }

    const rate = parseFloat(serviceForm.exchange_rate) || 1;

    try {
      setIsSubmittingService(true);
      const newServ = StorageService.addServiceExpense(
        {
          date: serviceForm.date,
          category: serviceForm.category,
          description: serviceForm.description.trim(),
          invoice_number: serviceForm.invoice_number.trim() || undefined,
          amount: amt,
          currency: serviceForm.currency,
          exchange_rate: rate,
          amount_usd: calculatedServiceUsd,
          account_id: serviceForm.account_id,
          notes: serviceForm.notes.trim() || undefined,
        },
        appMode
      );

      alert(
        `¡Gasto de servicio registrado con éxito!\n\n` +
        `• Servicio: ${newServ.description}\n` +
        `• Categoría: ${newServ.category}\n` +
        `• Desembolso: ${newServ.currency} ${newServ.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}\n` +
        `• Costo Contable: $${newServ.amount_usd.toFixed(2)} USD\n\n` +
        `El saldo de la cuenta fue debitado y el egreso quedó asentado en el Cierre Diario.`
      );

      setServiceForm({
        date: todayStr,
        category: 'SERVICIOS_PUBLICOS',
        description: '',
        invoice_number: '',
        amount: '',
        currency: 'USD',
        exchange_rate: '1',
        account_id: '',
        notes: '',
      });

      onDataChange();
    } catch (err: any) {
      alert('Error al registrar el gasto de servicio: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsSubmittingService(false);
    }
  };

  const handleDeleteService = async (srv: ServiceExpense) => {
    if (
      confirm(
        `¿Estás seguro de anular el gasto de "${srv.description}" (${srv.currency} ${srv.amount.toLocaleString()})?\n\n` +
        `• Se reintegrará el dinero automáticamente a la cuenta bancaria de origen.\n` +
        `• Se eliminará el egreso contable en el Cierre Diario.`
      )
    ) {
      await StorageService.deleteServiceExpense(srv.id, appMode);
      alert('¡Gasto de servicio anulado con éxito! Fondos reintegrados a la cuenta bancaria.');
      onDataChange();
    }
  };

  const filteredServices = useMemo(() => {
    return newestFirst(serviceExpenses).filter((s) => {
      const matchSearch =
        serviceSearch === '' ||
        s.description.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        (s.invoice_number && s.invoice_number.toLowerCase().includes(serviceSearch.toLowerCase())) ||
        (s.notes && s.notes.toLowerCase().includes(serviceSearch.toLowerCase()));

      const matchCat = serviceCategoryFilter === 'ALL' || s.category === serviceCategoryFilter;
      const matchMonth = serviceMonthFilter === '' || s.date.startsWith(serviceMonthFilter);

      return matchSearch && matchCat && matchMonth;
    });
  }, [serviceExpenses, serviceSearch, serviceCategoryFilter, serviceMonthFilter]);

  const totalServicesAmountUsd = useMemo(() => {
    return serviceExpenses.reduce((sum, s) => sum + (s.amount_usd || 0), 0);
  }, [serviceExpenses]);

  // Abrir modal de nuevo empleado
  const handleOpenNewEmployee = () => {
    setEditingEmployee(null);
    setEmployeeForm({
      name: '',
      identification: '',
      phone: '',
      position: '',
      base_salary: '',
      salary_currency: 'USD',
      payment_frequency: 'quincenal',
      payment_details: '',
      is_active: true,
    });
    setIsEmployeeModalOpen(true);
  };

  // Abrir modal para editar empleado
  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeForm({
      name: emp.name,
      identification: emp.identification || '',
      phone: emp.phone || '',
      position: emp.position,
      base_salary: String(emp.base_salary || ''),
      salary_currency: emp.salary_currency,
      payment_frequency: emp.payment_frequency,
      payment_details: emp.payment_details || '',
      is_active: emp.is_active,
    });
    setIsEmployeeModalOpen(true);
  };

  // Guardar empleado (crear o actualizar)
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.name.trim()) {
      alert('Por favor ingrese el nombre del empleado.');
      return;
    }
    const salary = parseFormattedNumber(employeeForm.base_salary);
    if (salary < 0) {
      alert('El sueldo base no puede ser negativo.');
      return;
    }

    if (editingEmployee) {
      StorageService.updateEmployee(
        editingEmployee.id,
        {
          name: employeeForm.name.trim(),
          identification: employeeForm.identification.trim() || undefined,
          phone: employeeForm.phone.trim() || undefined,
          position: employeeForm.position.trim() || 'Empleado',
          base_salary: salary,
          salary_currency: employeeForm.salary_currency,
          payment_frequency: employeeForm.payment_frequency,
          payment_details: employeeForm.payment_details.trim() || undefined,
          is_active: employeeForm.is_active,
        },
        appMode
      );
    } else {
      StorageService.addEmployee(
        {
          name: employeeForm.name.trim(),
          identification: employeeForm.identification.trim() || undefined,
          phone: employeeForm.phone.trim() || undefined,
          position: employeeForm.position.trim() || 'Empleado',
          base_salary: salary,
          salary_currency: employeeForm.salary_currency,
          payment_frequency: employeeForm.payment_frequency,
          payment_details: employeeForm.payment_details.trim() || undefined,
          is_active: employeeForm.is_active,
        },
        appMode
      );
    }

    setIsEmployeeModalOpen(false);
    onDataChange();
  };

  // Alternar estado activo/inactivo
  const handleToggleActive = (emp: Employee) => {
    StorageService.updateEmployee(
      emp.id,
      { is_active: !emp.is_active },
      appMode
    );
    onDataChange();
  };

  // Eliminar empleado
  const handleDeleteEmployee = async (emp: Employee) => {
    if (confirm(`¿Estás seguro de eliminar a "${emp.name}" de la nómina?`)) {
      await StorageService.deleteEmployee(emp.id, appMode);
      onDataChange();
    }
  };

  // Empleados filtrados
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        searchTerm === '' ||
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.identification && emp.identification.toLowerCase().includes(searchTerm.toLowerCase())) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && emp.is_active) ||
        (statusFilter === 'INACTIVE' && !emp.is_active);

      return matchSearch && matchStatus;
    });
  }, [employees, searchTerm, statusFilter]);

  // Métricas del Personal
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.is_active).length;
    const inactive = total - active;

    // Sumar nómina mensual estimada activa agrupada por moneda
    const activeByCurr: Record<string, number> = {};
    employees
      .filter((e) => e.is_active)
      .forEach((e) => {
        // Multiplicador a mensual: quincenal x2, semanal x4.33, mensual x1
        let mult = 1;
        if (e.payment_frequency === 'quincenal') mult = 2;
        else if (e.payment_frequency === 'semanal') mult = 4.33;
        const monthlyEst = (e.base_salary || 0) * mult;
        activeByCurr[e.salary_currency] = (activeByCurr[e.salary_currency] || 0) + monthlyEst;
      });

    return { total, active, inactive, activeByCurr };
  }, [employees]);

  return (
    <div className="space-y-6">
      {/* Encabezado del Módulo con Sub-pestañas */}
      <div
        className={`p-4 rounded-2xl border shadow-sm transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Nómina y Gastos de Servicios
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Control integral de empleados, sueldos, liquidaciones y gastos operativos fijos
              </p>
            </div>
          </div>

          {/* Selector de sub-pestañas */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setSubTab('employees')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                subTab === 'employees'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. Directorio de Personal ({employees.length})</span>
            </button>

            <button
              onClick={() => setSubTab('payments')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                subTab === 'payments'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>2. Liquidación y Sueldos ({payrollPayments.length})</span>
            </button>

            <button
              onClick={() => setSubTab('services')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                subTab === 'services'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>3. Gastos de Servicios ({serviceExpenses.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUB-PESTAÑA 1: DIRECTORIO DE PERSONAL (FASE 3 PARTE 1)   */}
      {/* ========================================================= */}
      {subTab === 'employees' && (
        <div className="space-y-6">
          {/* Tarjetas KPI de Resumen de Personal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-2xl border transition ${
                isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total Registrados
                </span>
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div className={`text-2xl font-black mt-2 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {stats.total}
              </div>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Colaboradores en plantilla
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border transition ${
                isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  Activos
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className={`text-2xl font-black mt-2 font-mono text-emerald-500`}>
                {stats.active}
              </div>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Devengando sueldo actualmente
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border transition ${
                isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Inactivos
                </span>
                <XCircle className="w-4 h-4 text-slate-400" />
              </div>
              <div className={`text-2xl font-black mt-2 font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {stats.inactive}
              </div>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Pausados o liquidados
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border transition ${
                isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  Nómina Base Estimada / Mes
                </span>
                <DollarSign className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 space-y-1">
                {Object.keys(stats.activeByCurr).length === 0 ? (
                  <div className={`text-sm font-bold font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    0.00
                  </div>
                ) : (
                  Object.entries(stats.activeByCurr).map(([curr, amt]) => (
                    <div key={curr} className="flex items-baseline justify-between text-xs font-mono font-bold">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{curr}:</span>
                      <span className={isDark ? 'text-white' : 'text-slate-900'}>
                        {amt.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Barra de Filtros y Botón de Nuevo Empleado */}
          <div
            className={`p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, cédula o cargo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full text-xs rounded-xl pl-9 pr-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-700 text-white'
                      : isDark
                      ? 'text-slate-400 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'ACTIVE'
                      ? 'bg-emerald-600 text-white'
                      : isDark
                      ? 'text-slate-400 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Activos
                </button>
                <button
                  onClick={() => setStatusFilter('INACTIVE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'INACTIVE'
                      ? 'bg-slate-600 text-white'
                      : isDark
                      ? 'text-slate-400 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Inactivos
                </button>
              </div>
            </div>

            <button
              onClick={handleOpenNewEmployee}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nuevo Empleado</span>
            </button>
          </div>

          {/* Listado de Empleados */}
          <div
            className={`rounded-2xl border shadow-sm overflow-hidden ${
              isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200'
            }`}
          >
            {filteredEmployees.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-40" />
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  No hay empleados registrados
                </h3>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Comienza agregando los miembros de tu equipo con el botón &quot;+ Nuevo Empleado&quot;.
                </p>
                <button
                  onClick={handleOpenNewEmployee}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Agregar primer empleado</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b text-[11px] uppercase font-bold tracking-wider ${
                      isDark ? 'bg-slate-800/80 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <tr>
                      <th className="py-3 px-4">Empleado / Cargo</th>
                      <th className="py-3 px-4">Cédula / ID</th>
                      <th className="py-3 px-4">Contacto</th>
                      <th className="py-3 px-4">Sueldo Base</th>
                      <th className="py-3 px-4">Frecuencia</th>
                      <th className="py-3 px-4">Datos de Pago</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                    {filteredEmployees.map((emp) => (
                      <tr
                        key={emp.id}
                        className={`transition hover:${isDark ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}
                      >
                        {/* Nombre y Cargo */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {emp.name}
                          </div>
                          <div className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {emp.position}
                          </div>
                        </td>

                        {/* Cédula */}
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {emp.identification || <span className="text-slate-400 italic">No registrada</span>}
                        </td>

                        {/* Teléfono y WhatsApp */}
                        <td className="py-3 px-4">
                          {emp.phone ? (
                            <a
                              href={`https://wa.me/${emp.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Escribir por WhatsApp"
                              className="inline-flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{emp.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sin teléfono</span>
                          )}
                        </td>

                        {/* Sueldo Base */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {emp.salary_currency} {(emp.base_salary || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Frecuencia */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                              emp.payment_frequency === 'quincenal'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                : emp.payment_frequency === 'mensual'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            {emp.payment_frequency}
                          </span>
                        </td>

                        {/* Datos de Pago */}
                        <td className="py-3 px-4 max-w-xs">
                          {emp.payment_details ? (
                            <span className="text-[11px] truncate block text-slate-600 dark:text-slate-400" title={emp.payment_details}>
                              {emp.payment_details}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Efectivo / No especificado</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(emp)}
                            title="Haz clic para cambiar estado"
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                              emp.is_active
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {emp.is_active ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Activo</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-slate-400" />
                                <span>Inactivo</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {emp.is_active && (
                              <button
                                onClick={() => {
                                  handleSelectEmployee(emp.id);
                                  setSubTab('payments');
                                }}
                                title="Liquidar sueldo de este empleado"
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition flex items-center space-x-1 cursor-pointer shadow-sm"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Liquidar</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEditEmployee(emp)}
                              title="Editar Empleado"
                              className={`p-1.5 rounded-lg transition ${
                                isDark
                                  ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              title="Eliminar Empleado"
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-PESTAÑA 2: FORMULARIO DE LIQUIDACIÓN (FASE 3 PARTE 2.1) */}
      {/* ========================================================= */}
      {subTab === 'payments' && (
        <div className="space-y-6">
          {/* Cabecera de la Liquidación */}
          <div
            className={`p-5 rounded-2xl border shadow-sm ${
              isDark ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Liquidación y Cálculo Inteligente de Sueldos</h2>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Cálculo matemático exacto: Sueldo Base + Bonificaciones - Deducciones y conversión bimoneda
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Fase 3: Parte 2.2 Activa (Débito en Vivo)</span>
                </span>
              </div>
            </div>

            {/* Formulario Principal de Liquidación con Desembolso Contable */}
            <form onSubmit={handleSubmitLiquidation} className="pt-5 space-y-6">
              {/* Sección 1: Selección de Colaborador */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Seleccionar Empleado a Liquidar *
                  </label>
                  <select
                    value={liquidationForm.employee_id}
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className={`w-full text-xs rounded-xl px-3 py-2.5 border font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- Seleccionar Colaborador --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position}) - {emp.salary_currency} {emp.base_salary}{' '}
                        [{emp.payment_frequency}] {!emp.is_active ? '(Inactivo)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Al seleccionar el empleado se autocompleta su sueldo, moneda y datos de pago.
                  </p>
                </div>

                {/* Tarjeta de Ficha Rápida del Empleado Seleccionado */}
                <div className="md:col-span-2">
                  {selectedEmployee ? (
                    <div
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-blue-50/60 border-blue-100'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {selectedEmployee.name}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                            {selectedEmployee.position}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {selectedEmployee.identification || 'Sin Cédula'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                          <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-semibold">Datos de Pago:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">
                            {selectedEmployee.payment_details || 'Efectivo / No registrado'}
                          </span>
                        </div>
                      </div>

                      {selectedEmployee.phone && (
                        <a
                          href={`https://wa.me/${selectedEmployee.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition self-start sm:self-auto cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`p-3.5 rounded-xl border border-dashed text-center text-xs ${
                        isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'
                      }`}
                    >
                      Elige un colaborador en la lista para desplegar su ficha de cobro y datos bancarios.
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 2: Período y Fecha de Liquidación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Período Liquidado *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 1ra Quincena Octubre 2026"
                    value={liquidationForm.period}
                    onChange={(e) => setLiquidationForm({ ...liquidationForm, period: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  {/* Botones de sugerencia rápida */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['1ra Quincena', '2da Quincena', 'Mes Completo', 'Semana'].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          const month = new Date().toLocaleString('es-ES', { month: 'long' });
                          const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
                          const year = new Date().getFullYear();
                          setLiquidationForm((prev) => ({
                            ...prev,
                            period: `${sug} ${capMonth} ${year}`,
                          }));
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                          isDark
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Fecha de Liquidación / Pago
                  </label>
                  <input
                    type="date"
                    value={liquidationForm.date}
                    onChange={(e) => setLiquidationForm({ ...liquidationForm, date: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Moneda Pactada del Sueldo
                  </label>
                  <div
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono font-bold flex items-center justify-between ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span>{liquidationForm.agreed_currency} (Pactado en Contrato)</span>
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Sección 3: Cálculos de Importes (Base, Bonos y Deducciones) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {/* Sueldo Base */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    1. Sueldo Base a Liquidar ({liquidationForm.agreed_currency})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={liquidationForm.base_amount}
                    onChange={(e) =>
                      setLiquidationForm({
                        ...liquidationForm,
                        base_amount: formatInputNumber(e.target.value),
                      })
                    }
                    className={`w-full text-sm rounded-xl px-3 py-2 border font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Monto base por el período
                  </span>
                </div>

                {/* Bonificaciones (+) */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    isDark ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50/60 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      2. Bonos / Extras (+)
                    </label>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.2 rounded">
                      Suma
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={liquidationForm.bonuses}
                    onChange={(e) =>
                      setLiquidationForm({
                        ...liquidationForm,
                        bonuses: formatInputNumber(e.target.value),
                      })
                    }
                    className={`w-full text-sm rounded-xl px-3 py-2 border font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-900 border-emerald-800 text-emerald-300' : 'bg-white border-emerald-300 text-emerald-800'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>
                    Comisiones, puntualidad, transporte
                  </span>
                </div>

                {/* Deducciones (-) */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    isDark ? 'bg-rose-950/20 border-rose-900/40' : 'bg-rose-50/60 border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-rose-700 dark:text-rose-400">
                      3. Deducciones / Adelantos (-)
                    </label>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.2 rounded">
                      Resta
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={liquidationForm.deductions}
                    onChange={(e) =>
                      setLiquidationForm({
                        ...liquidationForm,
                        deductions: formatInputNumber(e.target.value),
                      })
                    }
                    className={`w-full text-sm rounded-xl px-3 py-2 border font-mono font-bold focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                      isDark ? 'bg-slate-900 border-rose-800 text-rose-300' : 'bg-white border-rose-300 text-rose-800'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${isDark ? 'text-rose-400/80' : 'text-rose-600'}`}>
                    Anticipos de sueldo, faltas, préstamos
                  </span>
                </div>
              </div>

              {/* Sección 4: Moneda de Desembolso y Tasa de Cambio */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Conversión de Divisa de Pago (Bimoneda)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Moneda Real en que se Paga
                    </label>
                    <select
                      value={liquidationForm.payment_currency}
                      onChange={(e) => handlePaymentCurrencyChange(e.target.value as Currency)}
                      className={`w-full text-xs rounded-xl px-3 py-2 border font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {availableCurrencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Tasa de Cambio ({liquidationForm.agreed_currency} → {liquidationForm.payment_currency})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={liquidationForm.exchange_rate}
                      onChange={(e) =>
                        setLiquidationForm({ ...liquidationForm, exchange_rate: e.target.value })
                      }
                      className={`w-full text-xs rounded-xl px-3 py-2 border font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tasa aplicada para calcular la transferencia en {liquidationForm.payment_currency} y cuadrar el egreso en USD.
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección 5: Tarjeta Resumen Matemático del Neto a Pagar */}
              <div
                className={`p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Fórmula de Liquidación Aplicada
                  </span>
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    Base: <span className="font-bold">{calculationSummary.base.toFixed(2)}</span> + Bonos:{' '}
                    <span className="font-bold text-emerald-600">+{calculationSummary.bonuses.toFixed(2)}</span> - Deducciones:{' '}
                    <span className="font-bold text-rose-600">-{calculationSummary.deductions.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    = Neto Pactado:{' '}
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {calculationSummary.netAgreed.toLocaleString('es-ES', { minimumFractionDigits: 2 })}{' '}
                      {liquidationForm.agreed_currency}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  {/* Monto a Transferir en Moneda de Pago */}
                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase block text-slate-500 dark:text-slate-400">
                      Total a Transferir ({liquidationForm.payment_currency})
                    </span>
                    <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                      {calculationSummary.toPayCurrency.toLocaleString('es-ES', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-base font-semibold">{liquidationForm.payment_currency}</span>
                    </span>
                  </div>

                  {/* Equivalente en USD Contable */}
                  <div className="text-right border-l pl-4 border-slate-300 dark:border-slate-700">
                    <span className="text-[11px] font-bold uppercase block text-slate-500 dark:text-slate-400">
                      Costo Contable ($ USD)
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      ${calculationSummary.amountUsd.toLocaleString('es-ES', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección 6: Selección de Cuenta Pagadora, Referencia y Desembolso (Parte 2.2) */}
              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Cuenta Bancaria / Caja de Desembolso y Comprobante
                    </h3>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Selecciona la cuenta de la empresa de donde saldrán los fondos y se debitará el saldo en vivo
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Selector de Cuenta */}
                  <div className="lg:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      Cuenta / Banco Emisor * (Moneda de Pago: {liquidationForm.payment_currency})
                    </label>
                    <select
                      required
                      value={liquidationForm.account_id}
                      onChange={(e) => setLiquidationForm({ ...liquidationForm, account_id: e.target.value })}
                      className={`w-full text-xs rounded-xl px-3 py-2.5 border font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Seleccionar Cuenta / Banco Pagador --</option>
                      {matchingAccounts.length > 0 && (
                        <optgroup label={`Cuentas en ${liquidationForm.payment_currency} (Recomendadas)`}>
                          {matchingAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.bank_name}) - Saldo: {acc.currency} {acc.current_balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherAccounts.length > 0 && (
                        <optgroup label="Otras Cuentas en el Sistema">
                          {otherAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.bank_name}) - Saldo: {acc.currency} {acc.current_balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Número de Referencia */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      N° Referencia Bancaria / Pago Móvil
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 12893478"
                      value={liquidationForm.reference}
                      onChange={(e) => setLiquidationForm({ ...liquidationForm, reference: e.target.value })}
                      className={`w-full text-xs rounded-xl px-3 py-2.5 border font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                {/* Tarjeta de Saldo y Proyección Bancaria */}
                {selectedAccount && (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                      isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedAccount.name} ({selectedAccount.bank_name})
                      </span>
                      <span className="text-slate-400">• Resp: {selectedAccount.responsible}</span>
                    </div>

                    <div className="flex items-center space-x-4 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Saldo Actual:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {selectedAccount.currency} {selectedAccount.current_balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="border-l pl-4 border-slate-300 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 block">Saldo Tras Desembolso:</span>
                        <span
                          className={`font-black ${
                            selectedAccount.current_balance - calculationSummary.toPayCurrency >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {selectedAccount.currency}{' '}
                          {(selectedAccount.current_balance - calculationSummary.toPayCurrency).toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notas / Observaciones */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Notas u Observaciones del Recibo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Pago puntual quincenal + bono especial aprobado..."
                    value={liquidationForm.notes}
                    onChange={(e) => setLiquidationForm({ ...liquidationForm, notes: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Botón de Envío y Desembolso */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Al confirmar, el saldo del banco seleccionado se descontará inmediatamente y el egreso quedará asentado en el Cierre Diario.
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingLiquidation || !selectedEmployee || calculationSummary.toPayCurrency <= 0 || !liquidationForm.account_id}
                    className={`px-6 py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer ${
                      isSubmittingLiquidation || !selectedEmployee || calculationSummary.toPayCurrency <= 0 || !liquidationForm.account_id
                        ? 'bg-slate-400 text-white opacity-60 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSubmittingLiquidation
                        ? 'Procesando Desembolso...'
                        : `Liquidar y Desembolsar Sueldo (${liquidationForm.payment_currency} ${calculationSummary.toPayCurrency.toLocaleString('es-ES', { minimumFractionDigits: 2 })})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Banner Informativo de Avance de la Fase 3 */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-950/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    <strong>Fase 3 Activa y Cuadrada:</strong> Cálculos en vivo, débito bancario automático y registro contable en Cierre Diario.
                  </span>
                </div>
                <div className="text-[11px] font-mono font-semibold text-emerald-500 shrink-0">
                  Historial y Recibos Oficiales Listos
                </div>
              </div>
            </form>
          </div>

          {/* Historial de Liquidaciones y Recibos de Nómina (Parte 2.3) */}
          <div
            className={`p-5 rounded-2xl border shadow-sm space-y-4 ${
              isDark ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Cabecera del Historial */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <History className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-sm font-bold">Historial de Sueldos y Liquidaciones Registradas</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Registro oficial de comprobantes emitidos, desembolsos y recibos compartidos
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {payrollPayments.length} liquidaciones
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  Total: ${totalPaymentsAmountUsd.toLocaleString('es-ES', { minimumFractionDigits: 2 })} USD
                </span>
              </div>
            </div>

            {/* Filtros Rápidos del Historial */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                {/* Buscador */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por colaborador, período o referencia..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className={`w-full text-xs rounded-xl pl-9 pr-3 py-2 border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {/* Filtro por Empleado */}
                <select
                  value={paymentEmployeeFilter}
                  onChange={(e) => setPaymentEmployeeFilter(e.target.value)}
                  className={`text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="ALL">Todos los colaboradores</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>

                {/* Filtro por Fecha / Mes */}
                <input
                  type="date"
                  value={paymentMonthFilter}
                  onChange={(e) => setPaymentMonthFilter(e.target.value)}
                  className={`text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />

                {(paymentSearch || paymentEmployeeFilter !== 'ALL' || paymentMonthFilter) && (
                  <button
                    onClick={() => {
                      setPaymentSearch('');
                      setPaymentEmployeeFilter('ALL');
                      setPaymentMonthFilter('');
                    }}
                    className="text-xs text-blue-500 hover:underline font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Tabla del Historial */}
            {filteredPayments.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 italic">
                {payrollPayments.length === 0
                  ? 'Aún no se han registrado liquidaciones de sueldo. Realiza la primera con el formulario superior.'
                  : 'No se encontraron liquidaciones con los filtros aplicados.'}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b text-[11px] uppercase font-bold tracking-wider ${
                      isDark ? 'bg-slate-800/80 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">Período</th>
                      <th className="py-2.5 px-3 text-right">Desglose</th>
                      <th className="py-2.5 px-3 text-right">Monto Pagado</th>
                      <th className="py-2.5 px-3 text-right">Costo USD</th>
                      <th className="py-2.5 px-3">Cuenta / Ref</th>
                      <th className="py-2.5 px-3 text-center">Recibo</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                    {filteredPayments.map((p) => {
                      const accountUsed = accounts.find((a) => a.id === p.account_id);
                      return (
                        <tr
                          key={p.id}
                          className={`transition hover:${isDark ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}
                        >
                          {/* Fecha */}
                          <td className="py-2.5 px-3 font-mono font-medium whitespace-nowrap">
                            {p.date}
                          </td>

                          {/* Empleado */}
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {p.employee_name}
                          </td>

                          {/* Período */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              {p.period}
                            </span>
                          </td>

                          {/* Desglose */}
                          <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                            <div>Base: {p.base_amount.toFixed(2)}</div>
                            {p.bonuses > 0 && <div className="text-emerald-500 font-bold">+{p.bonuses.toFixed(2)}</div>}
                            {p.deductions > 0 && <div className="text-rose-500 font-bold">-{p.deductions.toFixed(2)}</div>}
                          </td>

                          {/* Monto Pagado */}
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                            {p.currency} {p.amount_currency.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Costo USD */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${p.amount_usd.toFixed(2)}
                          </td>

                          {/* Cuenta y Referencia */}
                          <td className="py-2.5 px-3 text-[11px]">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {accountUsed ? `${accountUsed.name} (${accountUsed.bank_name})` : 'Caja/Banco'}
                            </div>
                            {p.reference && (
                              <div className="text-slate-400 font-mono text-[10px]">
                                Ref: {p.reference}
                              </div>
                            )}
                          </td>

                          {/* Botón Comprobante */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setVoucherPayment(p)}
                              title="Ver y compartir comprobante de pago oficial"
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold transition inline-flex items-center space-x-1 cursor-pointer border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs"
                            >
                              <Share2 className="w-3 h-3 text-emerald-500" />
                              <span>Recibo</span>
                            </button>
                          </td>

                          {/* Anular */}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeletePayment(p)}
                              title="Anular liquidación y reintegrar dinero a la cuenta"
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-PESTAÑA 3: GASTOS DE SERVICIOS Y FIJOS (FASE 5)      */}
      {/* ========================================================= */}
      {subTab === 'services' && (
        <div className="space-y-6">
          {/* Tarjeta de Encabezado y Formulario de Nuevo Servicio */}
          <div
            className={`p-5 rounded-2xl border shadow-sm ${
              isDark ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Gastos de Servicios y Costos Fijos Operativos</h2>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Alquileres, luz, internet, telefonía, suministros y mantenimiento con débito bancario automático
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Fase 5 Operativa</span>
                </span>
              </div>
            </div>

            {/* Tarjetas KPI de Resumen de Servicios */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-5">
              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-purple-50/60 border-purple-100'
                }`}
              >
                <span className="text-[11px] font-bold uppercase text-purple-600 dark:text-purple-400 block">
                  Total Gastos en Servicios
                </span>
                <div className="text-xl font-black font-mono mt-1 text-slate-900 dark:text-white">
                  ${totalServicesAmountUsd.toLocaleString('es-ES', { minimumFractionDigits: 2 })} USD
                </div>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Cómputo en Cierre Diario
                </span>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-blue-50/60 border-blue-100'
                }`}
              >
                <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400 block">
                  Facturas / Recibos Registrados
                </span>
                <div className="text-xl font-black font-mono mt-1 text-slate-900 dark:text-white">
                  {serviceExpenses.length} servicios
                </div>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Operaciones históricas
                </span>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-emerald-50/60 border-emerald-100'
                }`}
              >
                <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                  Estado Contable
                </span>
                <div className="text-sm font-bold mt-1 text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cuadre Inmediato</span>
                </div>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Débito bancario en vivo
                </span>
              </div>
            </div>

            {/* Formulario de Registro de Nuevo Servicio */}
            <form onSubmit={handleSubmitService} className="pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Fecha del Pago *
                  </label>
                  <input
                    type="date"
                    required
                    value={serviceForm.date}
                    onChange={(e) => setServiceForm({ ...serviceForm, date: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Categoría del Gasto *
                  </label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value as ServiceCategory })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción / Proveedor */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Descripción / Proveedor del Servicio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Electricidad CORPOELEC, Fibra Óptica Inter, Alquiler Local..."
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* N° Factura / Referencia */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    N° Factura / Recibo / Ref
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. FAC-001294 o Ref Transferencia"
                    value={serviceForm.invoice_number}
                    onChange={(e) => setServiceForm({ ...serviceForm, invoice_number: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Monto del Servicio */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Monto a Pagar *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="0.00"
                    value={serviceForm.amount}
                    onChange={(e) => setServiceForm({ ...serviceForm, amount: formatInputNumber(e.target.value) })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Moneda */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Moneda del Pago
                  </label>
                  <select
                    value={serviceForm.currency}
                    onChange={(e) => handleServiceCurrencyChange(e.target.value as Currency)}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-bold font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {availableCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tasa hacia USD */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Tasa de Cambio ({serviceForm.currency} → USD)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={serviceForm.exchange_rate}
                    onChange={(e) => setServiceForm({ ...serviceForm, exchange_rate: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Cuenta Pagadora y Caja de Cálculos */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="lg:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Cuenta Bancaria / Caja Emisora * (Moneda: {serviceForm.currency})
                    </label>
                    <select
                      required
                      value={serviceForm.account_id}
                      onChange={(e) => setServiceForm({ ...serviceForm, account_id: e.target.value })}
                      className={`w-full text-xs rounded-xl px-3 py-2 border font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Seleccionar Cuenta / Banco Pagador --</option>
                      {matchingServiceAccounts.length > 0 && (
                        <optgroup label={`Cuentas en ${serviceForm.currency} (Recomendadas)`}>
                          {matchingServiceAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.bank_name}) - Saldo: {acc.currency} {acc.current_balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherServiceAccounts.length > 0 && (
                        <optgroup label="Otras Cuentas en el Sistema">
                          {otherServiceAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.bank_name}) - Saldo: {acc.currency} {acc.current_balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Resumen del Costo en USD */}
                  <div className="flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Costo Contable ($ USD)</span>
                    <span className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
                      ${calculatedServiceUsd.toLocaleString('es-ES', { minimumFractionDigits: 2 })} USD
                    </span>
                    <span className="text-[10px] text-slate-400">Impacto en el Cierre Diario</span>
                  </div>
                </div>

                {/* Proyección Bancaria */}
                {selectedServiceAccount && (
                  <div
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono ${
                      isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-purple-500" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedServiceAccount.name} ({selectedServiceAccount.bank_name})
                      </span>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Saldo Actual:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {selectedServiceAccount.currency} {selectedServiceAccount.current_balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="border-l pl-4 border-slate-300 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 block">Saldo Tras Pago:</span>
                        <span
                          className={`font-black ${
                            selectedServiceAccount.current_balance - parseFormattedNumber(serviceForm.amount) >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {selectedServiceAccount.currency}{' '}
                          {(selectedServiceAccount.current_balance - parseFormattedNumber(serviceForm.amount)).toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observaciones */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Notas u Observaciones del Gasto (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Pago correspondiente al mes de Octubre, pagado vía transferencia..."
                    value={serviceForm.notes}
                    onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Botón de Guardado */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    El monto pagado se descontará del saldo del banco y se sumará a los Gastos del Cierre Diario.
                  </span>

                  <button
                    type="submit"
                    disabled={isSubmittingService || parseFormattedNumber(serviceForm.amount) <= 0 || !serviceForm.account_id}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer ${
                      isSubmittingService || parseFormattedNumber(serviceForm.amount) <= 0 || !serviceForm.account_id
                        ? 'bg-slate-400 text-white opacity-60 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSubmittingService ? 'Procesando Pago...' : 'Registrar y Pagar Servicio'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Historial de Gastos de Servicios Registrados */}
          <div
            className={`p-5 rounded-2xl border shadow-sm space-y-4 ${
              isDark ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Cabecera del Historial */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <History className="w-5 h-5 text-purple-500" />
                <div>
                  <h3 className="text-sm font-bold">Historial de Gastos de Servicios y Fijos</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Registro cronológico de servicios operativos cancelados
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {serviceExpenses.length} registros
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                  Total: ${totalServicesAmountUsd.toLocaleString('es-ES', { minimumFractionDigits: 2 })} USD
                </span>
              </div>
            </div>

            {/* Barra de Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por descripción, factura o notas..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className={`w-full text-xs rounded-xl pl-9 pr-3 py-2 border focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <select
                  value={serviceCategoryFilter}
                  onChange={(e) => setServiceCategoryFilter(e.target.value)}
                  className={`text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="ALL">Todas las categorías</option>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={serviceMonthFilter}
                  onChange={(e) => setServiceMonthFilter(e.target.value)}
                  className={`text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />

                {(serviceSearch || serviceCategoryFilter !== 'ALL' || serviceMonthFilter) && (
                  <button
                    onClick={() => {
                      setServiceSearch('');
                      setServiceCategoryFilter('ALL');
                      setServiceMonthFilter('');
                    }}
                    className="text-xs text-purple-500 hover:underline font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Tabla de Servicios */}
            {filteredServices.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 italic">
                {serviceExpenses.length === 0
                  ? 'Aún no se han registrado gastos de servicios. Registra el primero con el formulario superior.'
                  : 'No se encontraron gastos de servicios con los filtros aplicados.'}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b text-[11px] uppercase font-bold tracking-wider ${
                      isDark ? 'bg-slate-800/80 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3">Descripción / Factura</th>
                      <th className="py-2.5 px-3 text-right">Monto Pagado</th>
                      <th className="py-2.5 px-3 text-right">Costo USD</th>
                      <th className="py-2.5 px-3">Cuenta Emisora</th>
                      <th className="py-2.5 px-3">Notas</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                    {filteredServices.map((s) => {
                      const accountUsed = accounts.find((a) => a.id === s.account_id);
                      const catConfig = SERVICE_CATEGORIES.find((c) => c.key === s.category);
                      return (
                        <tr
                          key={s.id}
                          className={`transition hover:${isDark ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}
                        >
                          <td className="py-2.5 px-3 font-mono font-medium whitespace-nowrap">{s.date}</td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                catConfig?.badgeClass || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {catConfig?.label.split('(')[0] || s.category}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            <div>{s.description}</div>
                            {s.invoice_number && (
                              <div className="text-[10px] font-mono text-slate-400">
                                Fac/Ref: {s.invoice_number}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                            {s.currency} {s.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                            ${s.amount_usd.toFixed(2)}
                          </td>

                          <td className="py-2.5 px-3 text-[11px]">
                            {accountUsed ? `${accountUsed.name} (${accountUsed.bank_name})` : 'Caja/Banco'}
                          </td>

                          <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-xs truncate" title={s.notes}>
                            {s.notes || '-'}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteService(s)}
                              title="Anular gasto de servicio y reintegrar dinero a la cuenta"
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CREAR / EDITAR EMPLEADO                            */}
      {/* ========================================================= */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Cabecera del Modal */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/70'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm">
                  {editingEmployee ? 'Editar Datos del Empleado' : 'Registrar Nuevo Empleado'}
                </h3>
              </div>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className={`p-1 rounded-lg text-slate-400 hover:text-slate-600 transition ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveEmployee} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Nombre */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Cargo */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Cargo / Puesto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Operador de Mesa"
                    value={employeeForm.position}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Cédula / DNI */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Cédula / DNI (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. V-12.345.678"
                    value={employeeForm.identification}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, identification: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="+58 412 1234567"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Frecuencia de Pago */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={employeeForm.payment_frequency}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        payment_frequency: e.target.value as 'quincenal' | 'mensual' | 'semanal',
                      })
                    }
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="quincenal">Quincenal (Cada 15 días)</option>
                    <option value="mensual">Mensual (Fin de mes)</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>

                {/* Sueldo Base */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Sueldo Base Acordado
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={employeeForm.base_salary}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        base_salary: formatInputNumber(e.target.value),
                      })
                    }
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Moneda del Sueldo */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Moneda del Sueldo
                  </label>
                  <select
                    value={employeeForm.salary_currency}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        salary_currency: e.target.value as Currency,
                      })
                    }
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold font-mono ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {availableCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Datos de Pago (Cuenta, Pago Móvil, etc.) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Datos de Pago / Cuenta Bancaria / Pago Móvil
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Banesco 0134... o Pago Móvil 0412... C.I. 12345678"
                    value={employeeForm.payment_details}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, payment_details: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Estado Activo */}
                <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="emp_active"
                    checked={employeeForm.is_active}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="emp_active" className="text-xs font-semibold cursor-pointer">
                    Empleado activo en nómina
                  </label>
                </div>
              </div>

              {/* Botones de Acción */}
              <div
                className={`pt-4 border-t flex items-center justify-end space-x-2.5 ${
                  isDark ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingEmployee ? 'Guardar Cambios' : 'Registrar Empleado'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Comprobante Gráfico Oficial de Nómina (PNG / WhatsApp) */}
      {voucherPayment && (
        <SharePayrollVoucherModal
          payment={voucherPayment}
          employee={employees.find((e) => e.id === voucherPayment.employee_id)}
          onClose={() => setVoucherPayment(null)}
        />
      )}
    </div>
  );
}
