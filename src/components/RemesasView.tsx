'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Send,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Account, AppMode, Beneficiario, Client, Remesa, RemesaEstado, RemesaMetodoPago, Supplier } from '@/types';
import { StorageService } from '@/lib/storage';
import { knownClientNames, openEditRecord, runEdit } from '@/components/EditRecordModal';
import { newestFirst } from '@/lib/order';
import { RatesService } from '@/lib/rates-service';
import { COUNTRIES_LIST } from '@/lib/countries';
import { useAuth } from '@/lib/auth-context';
import { formatRegionalAmount, parseFormattedNumber } from '@/lib/formatters';
import { localDateStr } from '@/lib/dates';

interface RemesasProps {
  appMode: AppMode;
  accounts: Account[];
  suppliers: Supplier[];
  clients: Client[];
  dataVersion: unknown;
  onDataChange: () => void;
}

const ESTADO_LABEL: Record<RemesaEstado, string> = {
  cobrada: 'Cobrada',
  en_proceso: 'En proceso',
  pagada: 'Pagada',
  fallida: 'Fallida',
  anulada: 'Anulada',
};

const ESTADO_CLASS: Record<RemesaEstado, string> = {
  cobrada: 'bg-blue-50 text-blue-700 border-blue-200',
  en_proceso: 'bg-amber-50 text-amber-700 border-amber-200',
  pagada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  fallida: 'bg-rose-50 text-rose-700 border-rose-200',
  anulada: 'bg-slate-100 text-slate-500 border-slate-200',
};

const PENDIENTES: RemesaEstado[] = ['cobrada', 'en_proceso', 'fallida'];

const PAISES = COUNTRIES_LIST.filter((c) => c.id !== 'CRIPTO');

function amt(n: number, cur?: string) {
  return formatRegionalAmount(n, cur || 'USD');
}

function r4(n: number) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

const emptyForm = {
  remitente_name: '',
  remitente_identification: '',
  remitente_phone: '',
  pais_pago: 'VENEZUELA',
  moneda_pago: 'VES',
  beneficiario_id: '',
  ben_name: '',
  ben_identification: '',
  ben_bank: '',
  ben_account: '',
  ben_phone: '',
  cuenta_cobro_id: '',
  monto_enviar: '',
  comision: '',
  fiado: '',
  tasa_cliente: '',
  tasa_costo: '',
  tasa_origen_usd: '1',
  metodo_pago: 'cuenta_propia' as RemesaMetodoPago,
  cuenta_pago_id: '',
  aliado_id: '',
  referencia_cobro: '',
  notes: '',
};

export function RemesasView({ appMode, accounts, suppliers, clients, dataVersion, onDataChange }: RemesasProps) {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [filtro, setFiltro] = useState<'pendientes' | 'pagadas' | 'anuladas' | 'todas'>('pendientes');
  const [filtroPais, setFiltroPais] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [accion, setAccion] = useState({
    metodo: 'cuenta_propia' as RemesaMetodoPago,
    cuenta: '',
    aliado: '',
    referencia: '',
  });
  // Un cambio de estado sin movimiento de saldo no cambia dataVersion; esto fuerza releer
  const [tick, setTick] = useState(0);
  const [editandoBen, setEditandoBen] = useState(false);

  const remesas = useMemo(
    () => StorageService.getRemesas(appMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appMode, dataVersion, tick],
  );
  const remitentes = useMemo(
    () => StorageService.getRemitentes(appMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appMode, dataVersion, tick],
  );

  const activeAccounts = accounts.filter((a) => a.is_active !== false);
  const cuentaCobro = accounts.find((a) => a.id === form.cuenta_cobro_id);
  const monedaOrigen = cuentaCobro?.currency || 'USD';
  const pais = PAISES.find((p) => p.id === form.pais_pago);
  const remitenteSel = remitentes.find((r) => r.name.trim().toUpperCase() === form.remitente_name.trim().toUpperCase());
  const clienteSel = clients.find(
    (c) => (c.name || '').trim().toUpperCase() === form.remitente_name.trim().toUpperCase(),
  );
  // Clientes del módulo Clientes + remitentes que ya enviaron, sin repetir
  const nombresRemitente = useMemo(() => {
    const set = new Map<string, string>();
    [...clients.map((c) => c.name), ...remitentes.map((r) => r.name)].forEach((n) => {
      const k = (n || '').trim().toUpperCase();
      if (k && !set.has(k)) set.set(k, (n || '').trim());
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [clients, remitentes]);
  const beneficiariosPais = (remitenteSel?.beneficiarios || []).filter((b) => b.country === form.pais_pago);

  // Cálculos de la remesa
  const montoEnviar = parseFormattedNumber(form.monto_enviar);
  const comision = parseFormattedNumber(form.comision);
  const tasaCliente = parseFormattedNumber(form.tasa_cliente);
  const tasaCosto = parseFormattedNumber(form.tasa_costo);
  const tasaOrigenUsd = parseFormattedNumber(form.tasa_origen_usd) || 1;
  const totalCobrado = r4(montoEnviar + comision);
  const montoPago = r4(montoEnviar * tasaCliente);
  const costoUsd = tasaCosto > 0 ? r4(montoPago / tasaCosto) : 0;
  const gananciaUsd = r4(totalCobrado / tasaOrigenUsd - costoUsd);
  const fiado = Math.min(Math.max(parseFormattedNumber(form.fiado) || 0, 0), totalCobrado);
  const fiadoUsd = r4(fiado / tasaOrigenUsd);

  // Tasas sugeridas desde la hoja de tasas al cambiar país o cuenta de cobro
  useEffect(() => {
    const info = RatesService.getRateInfo(form.moneda_pago, appMode);
    const origen = monedaOrigen.toUpperCase();
    const origenUsd = origen === 'USD' || origen === 'USDT' ? 1 : RatesService.getRateInfo(origen, appMode).costRate;
    setForm((f) => ({
      ...f,
      tasa_cliente:
        info.sellRate && info.sellRate !== 1 ? String(r4(info.sellRate / (origenUsd || 1))) : f.tasa_cliente,
      tasa_costo: info.costRate && info.costRate !== 1 ? String(info.costRate) : f.tasa_costo,
      tasa_origen_usd: String(origenUsd || 1),
    }));
  }, [form.moneda_pago, monedaOrigen, appMode]);

  // Forma de pago recordada por país
  useEffect(() => {
    const pref = StorageService.getRemesaPrefs(appMode)[form.pais_pago];
    setForm((f) => ({
      ...f,
      metodo_pago: pref?.metodo || 'cuenta_propia',
      cuenta_pago_id: pref?.cuenta_pago_id || '',
      aliado_id: pref?.aliado_id || '',
    }));
  }, [form.pais_pago, appMode]);

  const handlePais = (id: string) => {
    const p = PAISES.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      pais_pago: id,
      moneda_pago: p?.defaultCurrency || f.moneda_pago,
      beneficiario_id: '',
    }));
  };

  const handleRemitente = (name: string) => {
    const k = name.trim().toUpperCase();
    const r = remitentes.find((x) => x.name.trim().toUpperCase() === k);
    const c = clients.find((x) => (x.name || '').trim().toUpperCase() === k);
    const known = !!(r || c);
    setForm((f) => ({
      ...f,
      remitente_name: name,
      remitente_identification: known ? r?.identification || c?.identification || '' : f.remitente_identification,
      remitente_phone: known ? r?.phone || c?.phone || '' : f.remitente_phone,
      beneficiario_id: '',
    }));
  };

  const handleBeneficiario = (id: string) => {
    setEditandoBen(false);
    const b = beneficiariosPais.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      beneficiario_id: id,
      ben_name: b?.name || '',
      ben_identification: b?.identification || '',
      ben_bank: b?.bank || '',
      ben_account: b?.account_number || '',
      ben_phone: b?.phone || '',
    }));
  };

  const guardarBeneficiario = () => {
    if (!remitenteSel || !form.beneficiario_id) return;
    try {
      StorageService.updateBeneficiario(
        remitenteSel.id,
        {
          id: form.beneficiario_id,
          name: form.ben_name,
          identification: form.ben_identification.trim(),
          bank: form.ben_bank.trim(),
          account_number: form.ben_account.trim(),
          phone: form.ben_phone.trim(),
          country: form.pais_pago,
        },
        appMode,
      );
      setEditandoBen(false);
      setTick((t) => t + 1);
      window.alert('Beneficiario actualizado.');
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const borrarBeneficiario = () => {
    const b = beneficiariosPais.find((x) => x.id === form.beneficiario_id);
    if (!remitenteSel || !b) return;
    if (
      !window.confirm(
        `¿Borrar a ${b.name} de los beneficiarios de ${remitenteSel.name}? Las remesas anteriores no cambian.`,
      )
    )
      return;
    StorageService.deleteBeneficiario(remitenteSel.id, b.id, appMode);
    setEditandoBen(false);
    handleBeneficiario('');
    setTick((t) => t + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.remitente_name.trim() || !form.ben_name.trim()) {
      window.alert('Faltan el remitente o el beneficiario.');
      return;
    }
    if (!form.cuenta_cobro_id) {
      window.alert('Elige la cuenta donde entró el dinero del remitente.');
      return;
    }
    if (!(montoEnviar > 0) || !(tasaCliente > 0)) {
      window.alert('Escribe el monto a enviar y la tasa.');
      return;
    }
    if (parseFormattedNumber(form.fiado) > totalCobrado) {
      window.alert('Lo fiado no puede ser mayor que el total a cobrar.');
      return;
    }
    const aliado = suppliers.find((s) => s.id === form.aliado_id);
    try {
      const ben: Beneficiario = {
        id: form.beneficiario_id,
        name: form.ben_name,
        identification: form.ben_identification.trim(),
        bank: form.ben_bank.trim(),
        account_number: form.ben_account.trim(),
        phone: form.ben_phone.trim(),
        country: form.pais_pago,
      };
      // El remitente también queda (o se completa) en el módulo Clientes, sin duplicar
      const docRem = form.remitente_identification.trim();
      const telRem = form.remitente_phone.trim();
      if (!clienteSel) {
        StorageService.addClient(
          { name: form.remitente_name.trim().toUpperCase(), identification: docRem, phone: telRem },
          appMode,
        );
      } else if ((!clienteSel.identification && docRem) || (!clienteSel.phone && telRem)) {
        StorageService.updateClient(
          clienteSel.id,
          { identification: clienteSel.identification || docRem, phone: clienteSel.phone || telRem },
          appMode,
        );
      }
      const { remitente, beneficiario } = StorageService.saveRemitente(
        {
          id: remitenteSel?.id,
          name: form.remitente_name,
          identification: form.remitente_identification,
          phone: form.remitente_phone,
        },
        ben,
        appMode,
      );
      const r = StorageService.createRemesa(
        {
          remitente_id: remitente.id,
          remitente_name: remitente.name,
          remitente_identification: remitente.identification,
          remitente_phone: remitente.phone,
          beneficiario: beneficiario!,
          pais_pago: form.pais_pago,
          moneda_origen: monedaOrigen,
          monto_enviar: montoEnviar,
          comision,
          total_cobrado: totalCobrado,
          monto_fiado: fiado || undefined,
          fiado_usd: fiadoUsd || undefined,
          tasa_cliente: tasaCliente,
          moneda_pago: form.moneda_pago,
          monto_pago: montoPago,
          tasa_costo: tasaCosto,
          tasa_origen_usd: tasaOrigenUsd,
          costo_usd: costoUsd,
          ganancia_usd: gananciaUsd,
          cuenta_cobro_id: form.cuenta_cobro_id,
          metodo_pago: form.metodo_pago,
          cuenta_pago_id: form.metodo_pago === 'cuenta_propia' ? form.cuenta_pago_id || undefined : undefined,
          aliado_id: form.metodo_pago === 'aliado' ? form.aliado_id || undefined : undefined,
          aliado_name: form.metodo_pago === 'aliado' ? aliado?.name : undefined,
          referencia_cobro: form.referencia_cobro.trim(),
          notes: form.notes.trim(),
        },
        appMode,
      );
      setForm((f) => ({
        ...emptyForm,
        pais_pago: f.pais_pago,
        moneda_pago: f.moneda_pago,
        cuenta_cobro_id: f.cuenta_cobro_id,
        tasa_cliente: f.tasa_cliente,
        tasa_costo: f.tasa_costo,
        tasa_origen_usd: f.tasa_origen_usd,
        metodo_pago: f.metodo_pago,
        cuenta_pago_id: f.cuenta_pago_id,
        aliado_id: f.aliado_id,
      }));
      setTick((t) => t + 1);
      onDataChange();
      window.alert(`Remesa #${r.numero} registrada como COBRADA.`);
    } catch (err) {
      if ((err as Error).name !== 'DiaCerradoError') window.alert((err as Error).message);
    }
  };

  const abrir = (r: Remesa) => {
    if (abierta === r.id) {
      setAbierta(null);
      return;
    }
    setAbierta(r.id);
    setAccion({
      metodo: r.metodo_pago,
      cuenta: r.cuenta_pago_id || '',
      aliado: r.aliado_id || '',
      referencia: r.referencia_pago || '',
    });
  };

  const cambiar = (r: Remesa, nuevo: RemesaEstado) => {
    let nota: string | undefined;
    if (nuevo === 'fallida' || nuevo === 'anulada') {
      const txt = window.prompt(
        nuevo === 'anulada'
          ? `Anular la remesa #${r.numero}. Se devolverán ${amt(r.total_cobrado, r.moneda_origen)} ${r.moneda_origen} desde la cuenta de cobro. Escribe el motivo:`
          : `¿Por qué falló el pago de la remesa #${r.numero}?`,
      );
      if (txt === null) return;
      if (!txt.trim()) {
        window.alert('Hace falta un motivo.');
        return;
      }
      nota = txt.trim();
    }
    const aliado = suppliers.find((s) => s.id === accion.aliado);
    try {
      StorageService.changeRemesaEstado(
        r.id,
        nuevo,
        {
          nota,
          referencia_pago: accion.referencia.trim() || undefined,
          metodo_pago: nuevo === 'en_proceso' || nuevo === 'pagada' ? accion.metodo : undefined,
          cuenta_pago_id: accion.cuenta || undefined,
          aliado_id: accion.aliado || undefined,
          aliado_name: aliado?.name,
        },
        appMode,
      );
      setAbierta(null);
      setTick((t) => t + 1);
      onDataChange();
    } catch (err) {
      if ((err as Error).name !== 'DiaCerradoError') window.alert((err as Error).message);
    }
  };

  const revertirPago = (r: Remesa) => {
    const destino =
      r.metodo_pago === 'cuenta_propia'
        ? `Se devolverán ${amt(r.monto_pago, r.moneda_pago)} ${r.moneda_pago} a la cuenta de pago`
        : `Se le bajarán ${amt(r.costo_usd, 'USD')} USD de deuda al aliado ${r.aliado_name || ''}`.trim();
    const txt = window.prompt(
      `Revertir el pago de la remesa #${r.numero}. ${destino} y la remesa vuelve a Cobrada. Escribe el motivo:`,
    );
    if (txt === null) return;
    if (!txt.trim()) {
      window.alert('Hace falta un motivo.');
      return;
    }
    try {
      StorageService.revertirPagoRemesa(r.id, txt.trim(), appMode);
      setAbierta(null);
      setTick((t) => t + 1);
      onDataChange();
    } catch (err) {
      if ((err as Error).name !== 'DiaCerradoError') window.alert((err as Error).message);
    }
  };

  const copiarDatos = async (r: Remesa) => {
    const b = r.beneficiario;
    const texto = [
      `Remesa #${r.numero}`,
      `Beneficiario: ${b.name}`,
      b.identification ? `Documento: ${b.identification}` : '',
      b.bank ? `Banco: ${b.bank}` : '',
      b.account_number ? `Cuenta / Teléfono: ${b.account_number}` : '',
      b.phone ? `Teléfono: ${b.phone}` : '',
      `Monto: ${amt(r.monto_pago, r.moneda_pago)} ${r.moneda_pago}`,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      window.alert('Datos de pago copiados. Puedes pegarlos en WhatsApp.');
    } catch {
      window.prompt('Copia los datos de pago:', texto);
    }
  };

  // Pendientes por pagar, agrupados por país y moneda
  const pendientesPorPais = useMemo(() => {
    const map = new Map<string, { pais: string; moneda: string; total: number; count: number }>();
    remesas
      .filter((r) => PENDIENTES.includes(r.estado))
      .forEach((r) => {
        const k = r.pais_pago + '|' + r.moneda_pago;
        const cur = map.get(k) || {
          pais: r.pais_pago,
          moneda: r.moneda_pago,
          total: 0,
          count: 0,
        };
        cur.total += r.monto_pago;
        cur.count += 1;
        map.set(k, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [remesas]);

  const hoy = localDateStr();
  const gananciaHoy = remesas
    .filter((r) => r.estado === 'pagada' && r.fecha_pago === hoy)
    .reduce((s, r) => s + (r.ganancia_usd || 0), 0);

  const lista = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return newestFirst(remesas)
      .filter((r) =>
        filtro === 'pendientes'
          ? PENDIENTES.includes(r.estado)
          : filtro === 'pagadas'
            ? r.estado === 'pagada'
            : filtro === 'anuladas'
              ? r.estado === 'anulada'
              : true,
      )
      .filter((r) => !filtroPais || r.pais_pago === filtroPais)
      .filter(
        (r) =>
          !q ||
          r.remitente_name.toUpperCase().includes(q) ||
          (r.beneficiario?.name || '').toUpperCase().includes(q) ||
          String(r.numero) === q.replace('#', ''),
      );
  }, [remesas, filtro, filtroPais, busqueda]);

  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name || '—';
  const paisName = (id: string) => {
    const p = PAISES.find((x) => x.id === id);
    return p ? `${p.flag} ${p.name}` : id;
  };

  const input = 'w-full text-sm border border-slate-300 rounded-xl px-3 py-2';
  const label = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Pendientes por pagar</div>
          {pendientesPorPais.length === 0 ? (
            <div className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> No hay remesas pendientes
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pendientesPorPais.map((p) => (
                <button
                  key={p.pais + p.moneda}
                  onClick={() => {
                    setFiltro('pendientes');
                    setFiltroPais(p.pais);
                  }}
                  className="text-left px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100"
                >
                  <div className="text-xs font-semibold text-slate-700">{paisName(p.pais)}</div>
                  <div className="text-sm font-bold text-amber-700">
                    {amt(p.total, p.moneda)} {p.moneda}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {p.count} remesa{p.count === 1 ? '' : 's'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Ganancia de remesas pagadas hoy</div>
          <div className={`text-2xl font-bold ${gananciaHoy >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {amt(gananciaHoy, 'USD')} USD
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Nueva remesa</h2>
            <p className="text-xs text-slate-500">
              Se registra como COBRADA: el dinero del remitente entra a tu cuenta y queda pendiente el pago al
              beneficiario.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">1. Quién envía</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>Remitente *</label>
                <input
                  list="remitentes-list"
                  value={form.remitente_name}
                  onChange={(e) => handleRemitente(e.target.value)}
                  className={input}
                  placeholder="Escribe o elige un cliente"
                  required
                />
                <datalist id="remitentes-list">
                  {nombresRemitente.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={label}>Documento</label>
                <input
                  value={form.remitente_identification}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      remitente_identification: e.target.value,
                    })
                  }
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Teléfono</label>
                <input
                  value={form.remitente_phone}
                  onChange={(e) => setForm({ ...form, remitente_phone: e.target.value })}
                  className={input}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">2. Quién recibe</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>País de pago *</label>
                <select value={form.pais_pago} onChange={(e) => handlePais(e.target.value)} className={input}>
                  {PAISES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.flag} {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Moneda que recibe</label>
                <select
                  value={form.moneda_pago}
                  onChange={(e) => setForm({ ...form, moneda_pago: e.target.value })}
                  className={input}
                >
                  {(pais?.currencies || [form.moneda_pago]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Beneficiario guardado</label>
                <div className="flex gap-2">
                  <select
                    value={form.beneficiario_id}
                    onChange={(e) => handleBeneficiario(e.target.value)}
                    className={input}
                    disabled={beneficiariosPais.length === 0}
                  >
                    <option value="">
                      {beneficiariosPais.length ? 'Nuevo beneficiario…' : 'Sin beneficiarios guardados'}
                    </option>
                    {beneficiariosPais.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.bank ? `· ${b.bank}` : ''}
                      </option>
                    ))}
                  </select>
                  {form.beneficiario_id && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditandoBen(true)}
                        title="Editar beneficiario"
                        className="px-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={borrarBeneficiario}
                        title="Borrar beneficiario"
                        className="px-2.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editandoBen && (
                <div className="sm:col-span-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="flex-1">Corrige los datos del beneficiario abajo y dale a Guardar cambios.</span>
                  <button
                    type="button"
                    onClick={guardarBeneficiario}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-semibold"
                  >
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBeneficiario(form.beneficiario_id)}
                    className="px-3 py-1.5 rounded-xl border border-amber-300 font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <div>
                <label className={label}>Nombre del beneficiario *</label>
                <input
                  value={form.ben_name}
                  onChange={(e) => setForm({ ...form, ben_name: e.target.value })}
                  className={input}
                  required
                />
              </div>
              <div>
                <label className={label}>Documento</label>
                <input
                  value={form.ben_identification}
                  onChange={(e) => setForm({ ...form, ben_identification: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Banco</label>
                <input
                  value={form.ben_bank}
                  onChange={(e) => setForm({ ...form, ben_bank: e.target.value })}
                  className={input}
                  placeholder={pais?.description?.split(',')[0] || ''}
                />
              </div>
              <div>
                <label className={label}>Cuenta o pago móvil</label>
                <input
                  value={form.ben_account}
                  onChange={(e) => setForm({ ...form, ben_account: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Teléfono</label>
                <input
                  value={form.ben_phone}
                  onChange={(e) => setForm({ ...form, ben_phone: e.target.value })}
                  className={input}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">3. Montos</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>Cuenta donde entró el dinero *</label>
                <select
                  value={form.cuenta_cobro_id}
                  onChange={(e) => setForm({ ...form, cuenta_cobro_id: e.target.value })}
                  className={input}
                  required
                >
                  <option value="">Elegir cuenta…</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Monto a enviar ({monedaOrigen}) *</label>
                <input
                  inputMode="decimal"
                  value={form.monto_enviar}
                  onChange={(e) => setForm({ ...form, monto_enviar: e.target.value })}
                  className={input}
                  required
                />
              </div>
              <div>
                <label className={label}>Comisión cobrada ({monedaOrigen})</label>
                <input
                  inputMode="decimal"
                  value={form.comision}
                  onChange={(e) => setForm({ ...form, comision: e.target.value })}
                  className={input}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>Fiado: queda debiendo ({monedaOrigen})</label>
                <input
                  inputMode="decimal"
                  value={form.fiado}
                  onChange={(e) => setForm({ ...form, fiado: e.target.value })}
                  className={input}
                  placeholder="0 = pagó todo"
                />
              </div>
              <div>
                <label className={label}>
                  Tasa al cliente ({form.moneda_pago} por 1 {monedaOrigen}) *
                </label>
                <input
                  inputMode="decimal"
                  value={form.tasa_cliente}
                  onChange={(e) => setForm({ ...form, tasa_cliente: e.target.value })}
                  className={input}
                  required
                />
              </div>
              <div>
                <label className={label}>Tasa de costo ({form.moneda_pago} por 1 USD)</label>
                <input
                  inputMode="decimal"
                  value={form.tasa_costo}
                  onChange={(e) => setForm({ ...form, tasa_costo: e.target.value })}
                  className={input}
                />
              </div>
              {monedaOrigen !== 'USD' && monedaOrigen !== 'USDT' && (
                <div>
                  <label className={label}>{monedaOrigen} por 1 USD</label>
                  <input
                    inputMode="decimal"
                    value={form.tasa_origen_usd}
                    onChange={(e) => setForm({ ...form, tasa_origen_usd: e.target.value })}
                    className={input}
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">4. Cómo se paga en {pais?.name || 'destino'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={form.metodo_pago === 'cuenta_propia'}
                    onChange={() => setForm({ ...form, metodo_pago: 'cuenta_propia' })}
                  />
                  Con mis cuentas
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={form.metodo_pago === 'aliado'}
                    onChange={() => setForm({ ...form, metodo_pago: 'aliado' })}
                  />
                  Con un aliado
                </label>
              </div>
              {form.metodo_pago === 'cuenta_propia' ? (
                <div>
                  <label className={label}>Cuenta desde donde se paga</label>
                  <select
                    value={form.cuenta_pago_id}
                    onChange={(e) => setForm({ ...form, cuenta_pago_id: e.target.value })}
                    className={input}
                  >
                    <option value="">Se elige al pagar…</option>
                    {activeAccounts
                      .filter((a) => a.currency === form.moneda_pago)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={label}>Aliado / proveedor que paga</label>
                  <select
                    value={form.aliado_id}
                    onChange={(e) => setForm({ ...form, aliado_id: e.target.value })}
                    className={input}
                  >
                    <option value="">Se elige al pagar…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={label}>Referencia del cobro</label>
                <input
                  value={form.referencia_cobro}
                  onChange={(e) => setForm({ ...form, referencia_cobro: e.target.value })}
                  className={input}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-slate-500">Total cobrado</div>
              <div className="text-base font-bold text-slate-900">
                {amt(totalCobrado, monedaOrigen)} {monedaOrigen}
              </div>
              {fiado > 0 && (
                <div className="text-amber-700 font-semibold">
                  Entra ahora {amt(totalCobrado - fiado, monedaOrigen)} · fiado {amt(fiado, monedaOrigen)} a Deudores
                </div>
              )}
            </div>
            <div>
              <div className="text-slate-500">Recibe el beneficiario</div>
              <div className="text-base font-bold text-blue-700">
                {amt(montoPago, form.moneda_pago)} {form.moneda_pago}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Costo de entregarlo</div>
              <div className="text-base font-bold text-slate-700">{amt(costoUsd, 'USD')} USD</div>
            </div>
            <div>
              <div className="text-slate-500">Ganancia estimada</div>
              <div className={`text-base font-bold ${gananciaUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {amt(gananciaUsd, 'USD')} USD
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Registrar remesa cobrada
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['pendientes', 'pagadas', 'anuladas', 'todas'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                filtro === f
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {f === 'pendientes'
                ? 'Pendientes'
                : f === 'pagadas'
                  ? 'Pagadas'
                  : f === 'anuladas'
                    ? 'Anuladas'
                    : 'Todas'}
            </button>
          ))}
          <select
            value={filtroPais}
            onChange={(e) => setFiltroPais(e.target.value)}
            className="text-xs border border-slate-300 rounded-xl px-2 py-1.5"
          >
            <option value="">Todos los países</option>
            {PAISES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.flag} {p.name}
              </option>
            ))}
          </select>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar remitente, beneficiario o #"
            className="text-xs border border-slate-300 rounded-xl px-3 py-1.5 flex-1 min-w-[180px]"
          />
        </div>

        {lista.length === 0 && <p className="text-xs text-slate-500">No hay remesas en esta lista.</p>}

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-600 min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Remitente → Beneficiario</th>
                <th className="py-2.5 px-3">País</th>
                <th className="py-2.5 px-3 text-right">Recibe</th>
                <th className="py-2.5 px-3 text-right">Cobrado</th>
                <th className="py-2.5 px-3">Paga con</th>
                {isAdmin && <th className="py-2.5 px-3 text-right">Ganancia ($)</th>}
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
          {lista.map((r) => {
            const open = abierta === r.id;
            const canAct = PENDIENTES.includes(r.estado);
            return (
              <React.Fragment key={r.id}>
                <tr
                  onClick={() => abrir(r)}
                  className={`cursor-pointer transition ${open ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                >
                  <td className="py-2.5 px-3 font-bold text-slate-900">#{r.numero}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{r.date}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {r.remitente_name} → {r.beneficiario?.name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{paisName(r.pais_pago)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                    {amt(r.monto_pago, r.moneda_pago)} {r.moneda_pago}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {amt(r.total_cobrado, r.moneda_origen)} {r.moneda_origen}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {r.metodo_pago === 'aliado'
                      ? `Aliado: ${r.aliado_name || 'por elegir'}`
                      : accName(r.cuenta_pago_id)}
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                      {amt(r.ganancia_usd, 'USD')}
                    </td>
                  )}
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-lg border font-semibold ${ESTADO_CLASS[r.estado]}`}>
                      {ESTADO_LABEL[r.estado]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {open ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </td>
                </tr>

                {open && (
                  <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="bg-slate-50/60 p-0">
                  <div className="px-3 py-3 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="text-slate-500">Remitente</div>
                        <div className="font-semibold">{r.remitente_name}</div>
                        <div className="text-slate-500">
                          {[r.remitente_identification, r.remitente_phone].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Beneficiario</div>
                        <div className="font-semibold">{r.beneficiario?.name}</div>
                        <div className="text-slate-500">
                          {[
                            r.beneficiario?.identification,
                            r.beneficiario?.bank,
                            r.beneficiario?.account_number,
                            r.beneficiario?.phone,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Cobro</div>
                        <div className="font-semibold">
                          {amt(r.total_cobrado, r.moneda_origen)} {r.moneda_origen} en {accName(r.cuenta_cobro_id)}
                          {r.monto_fiado ? ` (fiado ${amt(r.monto_fiado, r.moneda_origen)} a Deudores)` : ''}
                        </div>
                        <div className="text-slate-500">
                          Tasa {r.tasa_cliente} · comisión {amt(r.comision, r.moneda_origen)} · ganancia{' '}
                          {amt(r.ganancia_usd, 'USD')} USD
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500 mb-1">Historial</div>
                      <ul className="space-y-0.5 text-slate-600">
                        {[...(r.historial || [])].reverse().map((h, i) => (
                          <li key={i}>
                            <span className="font-mono text-slate-400">{new Date(h.ts).toLocaleString('es-ES')}</span>{' '}
                            <span className="font-semibold">{ESTADO_LABEL[h.estado]}</span>
                            {h.nota ? ` — ${h.nota}` : ''}
                            {h.user_email ? <span className="text-slate-400"> · {h.user_email}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {canAct && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className={label}>Forma de pago</label>
                          <select
                            value={accion.metodo}
                            onChange={(e) =>
                              setAccion({
                                ...accion,
                                metodo: e.target.value as RemesaMetodoPago,
                              })
                            }
                            className={input}
                          >
                            <option value="cuenta_propia">Con mis cuentas</option>
                            <option value="aliado">Con un aliado</option>
                          </select>
                        </div>
                        {accion.metodo === 'cuenta_propia' ? (
                          <div>
                            <label className={label}>Cuenta que paga ({r.moneda_pago})</label>
                            <select
                              value={accion.cuenta}
                              onChange={(e) => setAccion({ ...accion, cuenta: e.target.value })}
                              className={input}
                            >
                              <option value="">Elegir cuenta…</option>
                              {activeAccounts
                                .filter((a) => a.currency === r.moneda_pago)
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name} · saldo {amt(a.current_balance, a.currency)}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className={label}>Aliado (se le debe {amt(r.costo_usd, 'USD')} USD)</label>
                            <select
                              value={accion.aliado}
                              onChange={(e) => setAccion({ ...accion, aliado: e.target.value })}
                              className={input}
                            >
                              <option value="">Elegir aliado…</option>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className={label}>Referencia del pago</label>
                          <input
                            value={accion.referencia}
                            onChange={(e) =>
                              setAccion({
                                ...accion,
                                referencia: e.target.value,
                              })
                            }
                            className={input}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copiarDatos(r)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-700 flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar datos de pago
                      </button>
                      {(r.estado === 'cobrada' || r.estado === 'fallida') && (
                        <button
                          onClick={() => cambiar(r, 'en_proceso')}
                          className="px-3 py-1.5 rounded-xl border border-amber-300 text-amber-700 font-semibold flex items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />{' '}
                          {r.estado === 'fallida' ? 'Reintentar' : 'Pasar a en proceso'}
                        </button>
                      )}
                      {(r.estado === 'cobrada' || r.estado === 'en_proceso') && (
                        <button
                          onClick={() => cambiar(r, 'pagada')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Marcar pagada
                        </button>
                      )}
                      {r.estado === 'en_proceso' && (
                        <button
                          onClick={() => cambiar(r, 'fallida')}
                          className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 font-semibold flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Falló el pago
                        </button>
                      )}
                      {r.estado === 'pagada' && isAdmin && (
                        <button
                          onClick={() => revertirPago(r)}
                          className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Revertir pago
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            const pagoPropio = r.estado === 'pagada' && r.metodo_pago === 'cuenta_propia';
                            const ch = await openEditRecord({
                              title: `Editar remesa #${r.numero}`,
                              nameLabel: 'Remitente',
                              currentName: r.remitente_name,
                              nameOptions: knownClientNames(appMode, true),
                              accounts,
                              accountFields: [
                                { key: 'cuenta_cobro_id', label: 'Cuenta de cobro', current: r.cuenta_cobro_id },
                                ...(pagoPropio ? [{ key: 'cuenta_pago_id', label: 'Cuenta de pago', current: r.cuenta_pago_id }] : []),
                              ],
                            });
                            if (!ch) return;
                            if (
                              runEdit(() =>
                                StorageService.editRemesa(
                                  r.id,
                                  { remitente_name: ch.name, cuenta_cobro_id: ch.cuenta_cobro_id, cuenta_pago_id: ch.cuenta_pago_id },
                                  appMode
                                )
                              )
                            )
                              onDataChange();
                          }}
                          className="px-3 py-1.5 rounded-xl border border-sky-300 text-sky-700 font-semibold flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar remesa
                        </button>
                      )}
                      {canAct && isAdmin && (
                        <button
                          onClick={() => cambiar(r, 'anulada')}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 font-semibold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Anular y devolver
                        </button>
                      )}
                    </div>
                  </div>
                  </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
