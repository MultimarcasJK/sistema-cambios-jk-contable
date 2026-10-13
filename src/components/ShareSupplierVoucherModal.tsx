'use client';

import React, { useState } from 'react';
import { Share2, Download, Copy, Check, MessageCircle, X } from 'lucide-react';

export interface SupplierVoucherData {
  supplierName: string;
  type?: string;
  contactInfo?: string;
  currentDebtUsd: number;
  totalPurchasedUsd?: number;
  totalPaidUsd?: number;
  purchasesCount?: number;
  paymentsCount?: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  lastPaymentReference?: string;
  notes?: string;
}

interface ShareSupplierVoucherModalProps {
  data: SupplierVoucherData;
  onClose: () => void;
}

export function ShareSupplierVoucherModal({ data, onClose }: ShareSupplierVoucherModalProps) {
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const todayStr = new Date().toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const hasDebt = data.currentDebtUsd > 0;
  const isSolvent = data.currentDebtUsd === 0;
  const hasCredit = data.currentDebtUsd < 0;

  // Generador de Canvas de Alta Definición para Proveedores (async — carga logo real)
  const generateCanvas = (): Promise<HTMLCanvasElement> => {
    return new Promise((resolveCanvas) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolveCanvas(canvas); return; }

      // Fondo degradado elegante
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1200);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1000, 1200);

      // Marco exterior
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, 940, 1140);

      // Barra superior — gradiente verde JK
      const topBarGrad = ctx.createLinearGradient(0, 30, 1000, 30);
      topBarGrad.addColorStop(0, '#10B981');
      topBarGrad.addColorStop(0.5, '#059669');
      topBarGrad.addColorStop(1, '#06B77F');
      ctx.fillStyle = topBarGrad;
      ctx.fillRect(30, 30, 940, 14);

      // Cargar logo JK
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo-jk-transparente.png`;

      const drawContent = () => {
        // Logo + Nombre Empresa
        ctx.drawImage(logo, 400, 60, 80, 80);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText('CAMBIOS JK', 540, 115);

        // Línea separadora
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(80, 175);
        ctx.lineTo(920, 175);
        ctx.stroke();

        // Título de Comprobante
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('ESTADO DE CUENTA DE PROVEEDOR / MAYORISTA', 500, 225);

        // Tarjeta del Proveedor
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(80, 260, 840, 150);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(80, 260, 840, 150);

        ctx.textAlign = 'left';
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('PROVEEDOR / MAYORISTA:', 110, 305);
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(data.supplierName.toUpperCase(), 110, 340);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`MONEDA/TIPO: ${data.type || 'DIVISAS / CRIPTO'}`, 110, 385);
        ctx.fillText(`FECHA DE EMISIÓN: ${todayStr}`, 530, 385);

        // Cuadro de Saldo Principal
        let statusColor = '#10b981';
        let statusText = 'CUENTA AL DÍA / SOLVENTE';
        let amountText = '$0.00 USD';

        if (hasDebt) {
          statusColor = '#ef4444';
          statusText = 'SALDO PENDIENTE POR LIQUIDAR';
          amountText = `$${data.currentDebtUsd.toFixed(2)} USD`;
        } else if (hasCredit) {
          statusColor = '#3b82f6';
          statusText = 'SALDO A FAVOR REGISTRADO';
          amountText = `$${Math.abs(data.currentDebtUsd).toFixed(2)} USD`;
        }

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(80, 440, 840, 270);
        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(80, 440, 840, 270);

        ctx.textAlign = 'center';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = statusColor;
        ctx.fillText(statusText, 500, 500);

        ctx.font = 'bold 74px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(amountText, 500, 600);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Saldo consolidado por pagar a la fecha', 500, 655);

        // Cuadro de Detalles y Conciliación
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(80, 745, 840, 250);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(80, 745, 840, 250);

        ctx.textAlign = 'left';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('INFORMACIÓN DE CONTROL & LIQUIDACIÓN', 110, 785);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(
          `• Total Compras Históricas: $${(data.totalPurchasedUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (${data.purchasesCount || 0} compras)`,
          110,
          820
        );

        ctx.fillText(
          `• Total Abonos / Pagos Realizados: $${(data.totalPaidUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (${data.paymentsCount || 0} pagos)`,
          110,
          855
        );

        if (data.lastPaymentAmount && data.lastPaymentAmount > 0) {
          ctx.fillText(
            `• Último Pago Asentado: $${data.lastPaymentAmount.toFixed(2)} USD (${data.lastPaymentDate || 'Reciente'}) ${data.lastPaymentReference ? 'Ref: ' + data.lastPaymentReference : ''}`,
            110,
            890
          );
        } else {
          ctx.fillText(`• Modalidad de Liquidación: Pago directo acordado`, 110, 890);
        }

        if (data.contactInfo) {
          ctx.fillText(`• Datos / Contacto: ${data.contactInfo.slice(0, 55)}`, 110, 925);
        } else {
          ctx.fillText(`• Control administrativo y conciliación bancaria`, 110, 925);
        }

        ctx.fillText(`• Código de Conciliación: PROV-${Date.now().toString().slice(-6)}`, 110, 960);

        // Pie de Comprobante
        ctx.textAlign = 'center';
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(
          'Comprobante interno administrativo de liquidación y cuentas por pagar emitido por CAMBIOS JK.',
          500,
          1055
        );
        ctx.fillText('Soporte de operaciones interbancarias y mesa de cambio.', 500, 1085);

        resolveCanvas(canvas);
      };

      logo.onload = drawContent;
      logo.onerror = () => {
        // Si falla el logo, dibujar solo texto
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 46px sans-serif';
        ctx.fillText('CAMBIOS JK', 500, 130);
        drawContent();
      };
    });
  };

  const getVoucherBlob = async (): Promise<Blob | null> => {
    const canvas = await generateCanvas();
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };


  // Descargar Imagen PNG
  const handleDownloadImage = async () => {
    setIsGenerating(true);
    try {
      const blob = await getVoucherBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Estado_Cuenta_Proveedor_${data.supplierName.replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copiar Imagen al Portapapeles (para pegar directo en WhatsApp Web con Ctrl+V)
  const handleCopyImage = async () => {
    setIsGenerating(true);
    try {
      const blob = await getVoucherBlob();
      if (!blob) return;

      if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        handleDownloadImage();
      }
    } catch (err) {
      console.error('Error al copiar imagen:', err);
      handleDownloadImage();
    } finally {
      setIsGenerating(false);
    }
  };

  // Generar texto para WhatsApp
  const getFormattedTextMessage = (): string => {
    const estado = hasDebt
      ? `🔴 *Saldo Pendiente por Liquidar:* $${data.currentDebtUsd.toFixed(2)} USD`
      : isSolvent
      ? `🟢 *Estado:* Al Día ($0.00 USD) - Cuenta Liquidada`
      : `🔵 *Saldo a Favor:* $${Math.abs(data.currentDebtUsd).toFixed(2)} USD`;

    return (
      `*CAMBIOS JK - Estado de Cuenta de Proveedor*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *Proveedor:* ${data.supplierName}\n` +
      `📅 *Fecha:* ${todayStr}\n` +
      `💼 *Tipo/Moneda:* ${data.type || 'Divisas / Cripto'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${estado}\n` +
      `📦 *Total Comprado:* $${(data.totalPurchasedUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\n` +
      `💳 *Total Pagado/Abonado:* $${(data.totalPaidUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\n` +
      (data.lastPaymentAmount
        ? `🕒 *Último Pago:* $${data.lastPaymentAmount.toFixed(2)} USD (${data.lastPaymentDate || 'Reciente'})\n`
        : '') +
      (data.contactInfo ? `📝 *Datos:* ${data.contactInfo}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Comprobante administrativo emitido por CAMBIOS JK`
    );
  };

  // Abrir WhatsApp Web / App
  const handleOpenWhatsAppText = () => {
    const text = encodeURIComponent(getFormattedTextMessage());
    const phoneMatch = data.contactInfo ? data.contactInfo.match(/(\+?\d[\d\s-]{7,\d})/g) : null;
    const cleanPhone = phoneMatch ? phoneMatch[0].replace(/[^0-9]/g, '') : '';
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getFormattedTextMessage());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-md w-full p-5 shadow-2xl relative my-auto">
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Encabezado */}
        <div className="text-center pb-3 border-b border-slate-800">
          <span className="text-xs uppercase tracking-widest text-sky-400 font-bold">Comprobante Digital</span>
          <h3 className="text-lg font-bold text-white mt-0.5">Estado de Cuenta de Proveedor</h3>
          <p className="text-xs text-slate-400">Listo para compartir o conciliar con el mayorista</p>
        </div>

        {/* Tarjeta Visual de Previsualización */}
        <div className="my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
            <span className="font-bold text-sm tracking-wide text-white">CAMBIOS JK</span>
            <span className="text-[11px] font-mono text-slate-400">{todayStr}</span>
          </div>

          <div className="text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Proveedor</span>
            <div className="text-base font-bold text-slate-100">{data.supplierName}</div>
            <div className="text-xs text-slate-400">
              Tipo: <span className="font-semibold text-slate-300">{data.type || 'Divisas / Cripto'}</span>
            </div>
            {data.contactInfo && (
              <div className="text-[11px] text-slate-400 truncate max-w-xs">{data.contactInfo}</div>
            )}
          </div>

          {/* Cuadro de Saldo Destacado */}
          <div
            className={`mt-3 p-3.5 rounded-xl border text-center ${
              hasDebt
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : isSolvent
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider font-extrabold block">
              {hasDebt ? 'Saldo Pendiente que Debemos' : isSolvent ? 'Al Día / Solvente' : 'Saldo a Favor'}
            </span>
            <div className="text-2xl font-black font-mono mt-1 text-white">
              {hasDebt
                ? `$${data.currentDebtUsd.toFixed(2)} USD`
                : isSolvent
                ? `$0.00 USD`
                : `$${Math.abs(data.currentDebtUsd).toFixed(2)} USD`}
            </div>
            <span className="text-[10px] opacity-75 mt-0.5 block">
              {hasDebt ? 'Cuenta por pagar registrada' : 'Sin saldos pendientes'}
            </span>
          </div>

          {/* Métricas de compras y pagos */}
          <div className="grid grid-cols-2 gap-2 mt-3 text-left bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Total Comprado</span>
              <span className="text-xs font-bold font-mono text-slate-200">
                ${(data.totalPurchasedUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Total Pagado</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                ${(data.totalPaidUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="space-y-2">
          {/* Botón Principal: Copiar Imagen (WhatsApp Web) */}
          <button
            onClick={handleCopyImage}
            disabled={isGenerating}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 transition cursor-pointer"
          >
            {copiedImage ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>¡Imagen Copiada! Pégala en WhatsApp (Ctrl + V)</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Imagen para WhatsApp Web</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-3 gap-2">
            {/* Descargar PNG */}
            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar</span>
            </button>

            {/* Enviar WhatsApp */}
            <button
              onClick={handleOpenWhatsAppText}
              className="py-2 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp</span>
            </button>

            {/* Copiar Texto */}
            <button
              onClick={handleCopyText}
              className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Texto</span>
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 text-center mt-3">
          Tip: Usa <b>«Copiar Imagen»</b> y abre el chat del proveedor en WhatsApp Web para pegar directamente.
        </p>
      </div>
    </div>
  );
}
