'use client';

import React, { useMemo, useState } from 'react';
import { Share2, Download, Copy, Check, X, ClipboardCheck, CloudOff, CloudUpload } from 'lucide-react';
import {
  Account,
  AppMode,
  DailyReport,
  Expense,
  Remesa,
  TransactionDetal,
  TransactionMayor,
} from '@/types';
import { StorageService } from '@/lib/storage';
import { getActor } from '@/lib/actor';
import { buildDailyReport, lineaCuadra, textoDiferencia } from '@/lib/daily-report';
import { formatInputNumber, parseFormattedNumber } from '@/lib/formatters';
import { localDateStr } from '@/lib/dates';

interface DailyReportModalProps {
  date: string;
  appMode: AppMode;
  detalTxs: TransactionDetal[];
  mayorTxs: TransactionMayor[];
  expenses: Expense[];
  remesas: Remesa[];
  accounts: Account[];
  onClose: () => void;
}

const fmt = (n: number) =>
  (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n: number) => `${n < 0 ? '-' : ''}$${fmt(Math.abs(n))}`;

const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

const fechaLarga = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
};

// Imagen del reporte (mismo estilo que el estado de cuenta). El alto depende de cuántas cuentas haya.
export function generarImagen(report: DailyReport): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const W = 1000;
    const MAX_H = 8000;
    const work = document.createElement('canvas');
    work.width = W;
    work.height = MAX_H;
    const ctx = work.getContext('2d');
    if (!ctx) {
      resolve(work);
      return;
    }

    const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const TEAL = '#2dd4bf';
    const LABEL = '#93c5fd';
    const CARD = '#132748';
    const CARD_BORDER = '#24406a';
    const VERDE = '#34d399';
    const ROJO = '#f87171';
    const AMBAR = '#fbbf24';
    const modoColor = report.mode === 'mayor' ? '#6366f1' : '#059669';

    const caja = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const tarjeta = (y: number, h: number, borde = CARD_BORDER, grosor = 2) => {
      caja(53, y, 894, h, 16);
      ctx.fillStyle = CARD;
      ctx.fill();
      ctx.strokeStyle = borde;
      ctx.lineWidth = grosor;
      ctx.stroke();
    };
    const linea = (x1: number, y1: number, x2: number, y2: number, color: string, grosor = 2) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = grosor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    const ajustar = (txt: string, max: number) => {
      if (ctx.measureText(txt).width <= max) return txt;
      let t = txt;
      while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
      return t + '…';
    };
    const texto = (
      txt: string,
      x: number,
      y: number,
      opts: { size?: number; bold?: boolean; color?: string; align?: CanvasTextAlign; max?: number } = {}
    ) => {
      ctx.font = `${opts.bold ? 'bold ' : ''}${opts.size || 24}px ${FONT}`;
      ctx.fillStyle = opts.color || '#ffffff';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(opts.max ? ajustar(txt, opts.max) : txt, x, y);
    };
    // Encabezado de cada tarjeta
    const titulo = (y: number, txt: string) => {
      texto(txt, 84, y + 46, { size: 26, bold: true, color: TEAL });
      linea(84, y + 66, 916, y + 66, CARD_BORDER, 2);
      return y + 66;
    };
    // Fila etiqueta / valor dentro de una tarjeta
    const fila = (y: number, etiqueta: string, valor: string, color = '#ffffff') => {
      texto(etiqueta, 84, y + 34, { size: 23, color: LABEL, max: 480 });
      texto(valor, 916, y + 34, { size: 24, bold: true, color, align: 'right', max: 400 });
      return y + 50;
    };

    ctx.fillStyle = '#0c1d3b';
    ctx.fillRect(0, 0, W, MAX_H);

    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo-jk-camion.png`;

    const dibujar = (conLogo: boolean) => {
      // Logo + nombre
      ctx.font = `bold 52px ${FONT}`;
      const nombreW = ctx.measureText('CAMBIOS JK').width;
      const logoH = 100;
      const logoW = conLogo ? Math.round((logoH * logo.naturalWidth) / (logo.naturalHeight || 1)) : 0;
      const gap = conLogo ? 20 : 0;
      const startX = W / 2 - (logoW + gap + nombreW) / 2;
      if (conLogo) ctx.drawImage(logo, startX, 90 - logoH / 2, logoW, logoH);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CAMBIOS JK', startX + logoW + gap, 90);

      // Título con líneas a los lados
      texto('REPORTE DEL DÍA', W / 2, 192, { size: 36, bold: true, color: TEAL, align: 'center' });
      ctx.font = `bold 36px ${FONT}`;
      const tW = ctx.measureText('REPORTE DEL DÍA').width;
      linea(53, 180, W / 2 - tW / 2 - 28, 180, TEAL, 3);
      linea(W / 2 + tW / 2 + 28, 180, 947, 180, TEAL, 3);

      // Etiqueta DETAL / MAYOR
      const modo = report.mode === 'mayor' ? 'MAYOR' : 'DETAL';
      ctx.font = `bold 26px ${FONT}`;
      const pW = ctx.measureText(modo).width + 60;
      caja(W / 2 - pW / 2, 222, pW, 46, 23);
      ctx.fillStyle = modoColor;
      ctx.fill();
      texto(modo, W / 2, 254, { size: 26, bold: true, align: 'center' });

      // Operadora, fecha y hora
      let y = 296;
      tarjeta(y, 110);
      texto('OPERADORA', 84, y + 40, { size: 19, color: LABEL });
      texto(report.operadora.toUpperCase(), 84, y + 80, { size: 28, bold: true, max: 420 });
      texto('FECHA', 560, y + 40, { size: 19, color: LABEL });
      texto(fechaLarga(report.date), 560, y + 80, { size: 28, bold: true });
      texto('HORA', 790, y + 40, { size: 19, color: LABEL });
      texto(horaDe(report.created_at), 790, y + 80, { size: 28, bold: true });
      y += 110 + 28;

      // Resultado del cuadre de caja
      const sinCuadre = report.cuadra === null;
      const estadoColor = sinCuadre ? '#475569' : report.cuadra ? '#059669' : '#dc2626';
      const descuadres = report.cuadre.filter((l) => !lineaCuadra(l));
      caja(53, y, 894, 96, 16);
      ctx.fillStyle = estadoColor;
      ctx.fill();
      texto(
        sinCuadre ? 'SIN CUADRE DE CAJA' : report.cuadra ? 'CAJA CUADRADA' : 'CAJA DESCUADRADA',
        W / 2,
        y + 44,
        { size: 34, bold: true, align: 'center' }
      );
      texto(
        sinCuadre
          ? 'La operadora no contó las cuentas'
          : report.cuadra
            ? `Las ${report.cuadre.length} cuentas contadas coinciden con el sistema`
            : `${descuadres.length} de ${report.cuadre.length} cuentas no coinciden (ver abajo)`,
        W / 2,
        y + 80,
        { size: 21, align: 'center', max: 840 }
      );
      y += 96 + 28;

      // Ventas
      const ventasRows = 1 + report.ventas.regionales.length + (report.ventas.remesas_pagadas > 0 ? 1 : 0);
      tarjeta(y, 66 + ventasRows * 50 + 16);
      let yy = titulo(y, 'VENTAS');
      const c = report.ventas.cripto;
      yy = fila(yy, `CRIPTO/DOLAR · ${c.count} ops`, `${fmt(c.usdt)} USDT · ${usd(c.facturado_usd)}`);
      report.ventas.regionales.forEach((r) => {
        yy = fila(yy, `${r.currency} · ${r.count} ops`, `${fmt(r.monto)} ${r.currency}`);
      });
      if (report.ventas.remesas_pagadas > 0) {
        yy = fila(yy, 'Remesas pagadas', String(report.ventas.remesas_pagadas));
      }
      y = yy + 16 + 28;

      // Ganancia
      const g = report.ganancia;
      tarjeta(y, 66 + 5 * 50 + 90);
      yy = titulo(y, 'GANANCIA');
      yy = fila(yy, 'CRIPTO/DOLAR', `+${usd(g.cripto)}`, VERDE);
      yy = fila(yy, 'MONEDAS REGIONALES', `+${usd(g.regionales)}`, VERDE);
      yy = fila(yy, 'Remesas', `+${usd(g.remesas)}`, VERDE);
      yy = fila(yy, `Ingresos extra (${report.ingresos_count})`, `+${usd(g.ingresos_extra)}`, VERDE);
      yy = fila(yy, `Gastos (${report.gastos_count})`, `-${usd(g.gastos)}`, ROJO);
      linea(84, yy + 10, 916, yy + 10, CARD_BORDER, 2);
      texto('GANANCIA NETA', 84, yy + 60, { size: 28, bold: true });
      texto(`${g.neta >= 0 ? '+' : ''}${usd(g.neta)} USD`, 916, yy + 60, {
        size: 36,
        bold: true,
        color: g.neta >= 0 ? VERDE : ROJO,
        align: 'right',
      });
      y = yy + 90 + 28;

      // Cartera
      tarjeta(y, 66 + 2 * 50 + 16);
      yy = titulo(y, 'CLIENTES');
      yy = fila(yy, `Abonos recibidos (${report.abonos.count})`, usd(report.abonos.total_usd), VERDE);
      yy = fila(yy, `Deudas nuevas (${report.deudas_nuevas.count})`, usd(report.deudas_nuevas.total_usd), AMBAR);
      y = yy + 16 + 28;

      // Saldo final de cada cuenta (y su cuadre si se contó)
      const cuadrePorCuenta = new Map(report.cuadre.map((l) => [l.account_id, l]));
      const filasCuenta = report.saldos.reduce((h, s) => h + (cuadrePorCuenta.has(s.account_id) ? 80 : 50), 0);
      const monedas = Object.entries(report.totales_moneda);
      tarjeta(y, 66 + filasCuenta + 20 + monedas.length * 44 + 16);
      yy = titulo(y, 'SALDO FINAL POR CUENTA');
      report.saldos.forEach((s) => {
        texto(s.name, 84, yy + 34, { size: 23, color: '#ffffff', max: 470 });
        texto(`${fmt(s.balance)} ${s.currency}`, 916, yy + 34, {
          size: 24,
          bold: true,
          color: s.balance < 0 ? ROJO : '#ffffff',
          align: 'right',
          max: 380,
        });
        const l = cuadrePorCuenta.get(s.account_id);
        if (l) {
          const ok = lineaCuadra(l);
          texto(`Contado: ${fmt(l.real)} ${l.currency}`, 84, yy + 64, { size: 20, color: LABEL });
          texto(ok ? '✓ Cuadra' : textoDiferencia(l), 916, yy + 64, {
            size: 21,
            bold: true,
            color: ok ? VERDE : l.diferencia < 0 ? ROJO : AMBAR,
            align: 'right',
          });
          yy += 80;
        } else {
          yy += 50;
        }
      });
      linea(84, yy + 10, 916, yy + 10, CARD_BORDER, 2);
      yy += 20;
      monedas.forEach(([cur, total]) => {
        texto(`TOTAL ${cur}`, 84, yy + 32, { size: 22, bold: true, color: TEAL });
        texto(`${fmt(total)} ${cur}`, 916, yy + 32, { size: 24, bold: true, align: 'right' });
        yy += 44;
      });
      y = yy + 16 + 28;

      if (report.notes) {
        ctx.font = `21px ${FONT}`;
        tarjeta(y, 70);
        texto(`Nota: ${report.notes}`, 84, y + 44, { size: 21, color: LABEL, max: 832 });
        y += 70 + 28;
      }

      texto('Reporte interno de CAMBIOS JK generado por el sistema contable.', W / 2, y + 20, {
        size: 18,
        color: '#94a3b8',
        align: 'center',
      });
      const H = y + 50;

      // Recortar al alto real
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      out.getContext('2d')?.drawImage(work, 0, 0, W, H, 0, 0, W, H);
      resolve(out);
    };

    logo.onload = () => dibujar(true);
    logo.onerror = () => dibujar(false);
  });
}

export function DailyReportModal({
  date,
  appMode,
  detalTxs,
  mayorTxs,
  expenses,
  remesas,
  accounts,
  onClose,
}: DailyReportModalProps) {
  const actor = getActor();
  const operadora = actor?.nombre || actor?.email || 'Operadora';
  // Mismo id mientras el modal esté abierto: compartir de nuevo actualiza el mismo reporte
  const [reportId] = useState(() => `rep-${appMode}-${date}-${Date.now()}`);
  const [reales, setReales] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<'nube' | 'local' | null>(null);

  const activeAccounts = useMemo(() => accounts.filter((a) => a && a.is_active !== false), [accounts]);
  const debtPayments = useMemo(() => StorageService.getDebtPayments(appMode), [appMode]);

  const buildReport = (createdAt?: string): DailyReport => {
    const parsed: Record<string, number | undefined> = {};
    Object.entries(reales).forEach(([id, v]) => {
      if (v.trim() !== '') parsed[id] = parseFormattedNumber(v);
    });
    return buildDailyReport({
      id: reportId,
      date,
      mode: appMode,
      operadora,
      createdAt,
      detalTxs,
      mayorTxs,
      expenses,
      remesas,
      debtPayments,
      accounts: activeAccounts,
      reales: parsed,
      notes: notes.trim(),
    });
  };

  // Vista previa (se recalcula al escribir el cuadre)
  const preview = buildReport();
  const cuadrePorCuenta = new Map(preview.cuadre.map((l) => [l.account_id, l]));

  // Arma el reporte con la hora actual, lo guarda y devuelve la imagen
  const prepararImagen = async (): Promise<{ blob: Blob | null; report: DailyReport }> => {
    const report = buildReport(new Date().toISOString());
    const enNube = await StorageService.saveDailyReport(report, appMode);
    setSaved(enNube ? 'nube' : 'local');
    const canvas = await generarImagen(report);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));
    return { blob, report };
  };

  const nombreArchivo = (r: DailyReport) =>
    `Reporte_${r.mode.toUpperCase()}_${r.date}_${horaDe(r.created_at).replace(/\D/g, '')}.png`;

  const descargar = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiarImagen = async (blob: Blob): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.ClipboardItem || !navigator.clipboard?.write) return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      return true;
    } catch {
      return false;
    }
  };

  // Compartir solo la imagen (sin texto), igual que el estado de cuenta
  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const { blob, report } = await prepararImagen();
      if (!blob) return;
      const file = new File([blob], nombreArchivo(report), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        if (!(await copiarImagen(blob))) descargar(blob, nombreArchivo(report));
        window.open('https://wa.me/', '_blank');
      }
    } catch (err) {
      console.log('Error al compartir:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    setIsGenerating(true);
    try {
      const { blob, report } = await prepararImagen();
      if (blob && !(await copiarImagen(blob))) descargar(blob, nombreArchivo(report));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const { blob, report } = await prepararImagen();
      if (blob) descargar(blob, nombreArchivo(report));
    } finally {
      setIsGenerating(false);
    }
  };

  const estado =
    preview.cuadra === null
      ? { txt: 'Sin cuadre: escribe lo que hay en cada cuenta', cls: 'bg-slate-800 border-slate-700 text-slate-300' }
      : preview.cuadra
        ? { txt: 'Caja cuadrada', cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' }
        : {
            txt: `Caja descuadrada en ${preview.cuadre.filter((l) => !lineaCuadra(l)).length} cuenta(s)`,
            cls: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
          };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-2xl w-full p-5 shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center pb-3 border-b border-slate-800">
          <span
            className={`text-[11px] uppercase tracking-widest font-bold px-2.5 py-0.5 rounded-full ${
              appMode === 'mayor' ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}
          >
            {appMode === 'mayor' ? 'MAYOR' : 'DETAL'}
          </span>
          <h3 className="text-lg font-bold text-white mt-1.5">Reporte del día {fechaLarga(date)}</h3>
          <p className="text-xs text-slate-400">Operadora: {operadora}</p>
          {date !== localDateStr() && (
            <p className="text-[11px] text-amber-400 mt-1">
              Ojo: las ventas son del {fechaLarga(date)}, pero los saldos de las cuentas son los de este momento.
            </p>
          )}
        </div>

        {/* Cuadre de caja */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-4 h-4 text-sky-400" />
            <h4 className="text-sm font-bold">Cuadre de caja</h4>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Escribe cuánto hay realmente en cada cuenta. Las que dejes vacías no entran en el cuadre.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="py-2 px-2.5 text-left">Cuenta</th>
                  <th className="py-2 px-2.5 text-right">Sistema</th>
                  <th className="py-2 px-2.5 text-right">Real</th>
                  <th className="py-2 px-2.5 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {activeAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No hay cuentas activas.
                    </td>
                  </tr>
                ) : (
                  activeAccounts.map((a) => {
                    const l = cuadrePorCuenta.get(a.id);
                    return (
                      <tr key={a.id}>
                        <td className="py-1.5 px-2.5">
                          <div className="font-semibold text-slate-100 truncate max-w-[180px]">{a.name || a.bank_name}</div>
                          <div className="text-[10px] text-slate-500">{a.currency}</div>
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-300 whitespace-nowrap">
                          {fmt(Number(a.current_balance || 0))}
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            value={reales[a.id] || ''}
                            onChange={(e) => setReales({ ...reales, [a.id]: formatInputNumber(e.target.value) })}
                            className="w-28 text-right font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td
                          className={`py-1.5 px-2.5 text-right font-bold whitespace-nowrap ${
                            !l ? 'text-slate-600' : lineaCuadra(l) ? 'text-emerald-400' : l.diferencia < 0 ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        >
                          {l ? textoDiferencia(l) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className={`mt-2 px-3 py-2 rounded-xl border text-xs font-bold text-center ${estado.cls}`}>{estado.txt}</div>
        </div>

        {/* Resumen */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Ventas</div>
            <div className="text-base font-black font-mono">
              {preview.ventas.cripto.count + preview.ventas.regionales.reduce((s, r) => s + r.count, 0)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Ganancia neta</div>
            <div className={`text-base font-black font-mono ${preview.ganancia.neta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {usd(preview.ganancia.neta)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Abonos</div>
            <div className="text-base font-black font-mono text-emerald-400">{usd(preview.abonos.total_usd)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Deudas nuevas</div>
            <div className="text-base font-black font-mono text-amber-400">{usd(preview.deudas_nuevas.total_usd)}</div>
          </div>
        </div>

        <input
          type="text"
          placeholder="Nota para el reporte (opcional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-3 w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none placeholder:text-slate-500"
        />

        <div className="mt-4 space-y-2.5">
          <button
            onClick={handleShare}
            disabled={isGenerating}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{isGenerating ? 'Generando...' : 'Compartir imagen por WhatsApp'}</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              disabled={isGenerating}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
              <span>{copied ? '¡Copiada!' : 'Copiar imagen'}</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Guardar PNG</span>
            </button>
          </div>
          {saved && (
            <p
              className={`text-[11px] flex items-center justify-center gap-1.5 ${
                saved === 'nube' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {saved === 'nube' ? <CloudUpload className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
              {saved === 'nube'
                ? 'Reporte guardado en el historial.'
                : 'Reporte guardado solo en este equipo (no se pudo subir a Supabase).'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
