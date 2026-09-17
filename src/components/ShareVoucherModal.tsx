'use client';

import React, { useState } from 'react';
import { Share2, Download, Copy, Check, MessageCircle, X } from 'lucide-react';

export interface VoucherData {
  clientName: string;
  phone?: string;
  identification?: string;
  currentDebt: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  notes?: string;
}

interface ShareVoucherModalProps {
  data: VoucherData;
  onClose: () => void;
}

export function ShareVoucherModal({ data, onClose }: ShareVoucherModalProps) {
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const todayStr = new Date().toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const isDebtor = data.currentDebt > 0;
  const isSolvent = data.currentDebt === 0;
  const hasCredit = data.currentDebt < 0;

  // Generador de Canvas de Alta Definición (async — carga logo real)
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
      logo.src = '/logo-jk-transparente.png';

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
        ctx.fillText('ESTADO DE CUENTA DE CLIENTE', 500, 225);

        // Tarjeta del Cliente
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(80, 260, 840, 150);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(80, 260, 840, 150);

        ctx.textAlign = 'left';
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('CLIENTE:', 110, 305);
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(data.clientName.toUpperCase(), 110, 340);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`TELÉFONO: ${data.phone || 'No registrado'}`, 110, 385);
        ctx.fillText(`FECHA DE EMISIÓN: ${todayStr}`, 530, 385);

        // Cuadro de Saldo Principal
        let statusColor = '#10b981';
        let statusText = 'AL DÍA / SOLVENTE';
        let amountText = '$0.00 USD';

        if (isDebtor) {
          statusColor = '#ef4444';
          statusText = 'PENDIENTE POR COBRAR';
          amountText = `$${data.currentDebt.toFixed(2)} USD`;
        } else if (hasCredit) {
          statusColor = '#3b82f6';
          statusText = 'SALDO A FAVOR DEL CLIENTE';
          amountText = `$${Math.abs(data.currentDebt).toFixed(2)} USD`;
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
        ctx.fillText('Saldo consolidado a la fecha', 500, 655);

        // Cuadro de Detalles
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(80, 745, 840, 240);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(80, 745, 840, 240);

        ctx.textAlign = 'left';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('INFORMACIÓN DE CONTROL & CONCILIACIÓN', 110, 785);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`• Estado Actual: ${isDebtor ? 'Cuenta con saldo deudor pendiente.' : isSolvent ? 'El cliente se encuentra al día sin deudas.' : 'Saldo a favor disponible para transacciones.'}`, 110, 825);

        if (data.lastPaymentAmount && data.lastPaymentAmount > 0) {
          ctx.fillText(`• Último Abono Registrado: $${data.lastPaymentAmount.toFixed(2)} USD (${data.lastPaymentDate || 'Reciente'})`, 110, 860);
        } else {
          ctx.fillText(`• Moneda de Referencia: Dólares Americanos (USD)`, 110, 860);
        }

        const cleanNotes = (data.notes || '')
          .replace(/\bdetal\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanNotes) {
          ctx.fillText(`• Observaciones: ${cleanNotes.slice(0, 60)}`, 110, 895);
        } else {
          ctx.fillText(`• Soporte y Atención directa vía WhatsApp`, 110, 895);
        }

        ctx.fillText(`• Código de Verificación: JK-${Date.now().toString().slice(-6)}`, 110, 930);

        // Pie de Comprobante
        ctx.textAlign = 'center';
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Este documento es un comprobante de control administrativo emitido por CAMBIOS JK.', 500, 1055);
        ctx.fillText('Agradecemos su preferencia y puntualidad en sus transacciones.', 500, 1085);

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
      a.download = `Estado_Cuenta_${data.clientName.replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copiar Imagen al Portapapeles (Para pegar directo con Ctrl+V en WhatsApp Web)
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

  // Compartir Imagen Nativamente
  const handleNativeShare = async () => {
    setIsGenerating(true);
    try {
      const blob = await getVoucherBlob();
      if (!blob) return;
      const file = new File([blob], `Estado_Cuenta_${data.clientName}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Estado de Cuenta - ${data.clientName}`,
          text: getFormattedTextMessage(),
        });
      } else {
        handleDownloadImage();
        handleOpenWhatsAppText();
      }
    } catch (err) {
      console.log('Error al compartir:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generar texto para WhatsApp
  const cleanNotes = (data.notes || '')
    .replace(/\bdetal\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const getFormattedTextMessage = (): string => {
    const estado = isDebtor
      ? `🔴 *Saldo Pendiente por Pagar:* $${data.currentDebt.toFixed(2)} USD`
      : isSolvent
      ? `🟢 *Estado:* Al Día ($0.00 USD) - Solvente`
      : `🔵 *Saldo a su Favor:* $${Math.abs(data.currentDebt).toFixed(2)} USD`;

    return `*CAMBIOS JK - Estado de Cuenta*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Cliente:* ${data.clientName}\n` +
      `📅 *Fecha:* ${todayStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${estado}\n` +
      (cleanNotes ? `📝 *Nota:* ${cleanNotes}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `¡Muchas gracias por su confianza y preferencia!`;
  };

  // Abrir WhatsApp Web / App
  const handleOpenWhatsAppText = () => {
    const text = encodeURIComponent(getFormattedTextMessage());
    const cleanPhone = data.phone ? data.phone.replace(/[^0-9]/g, '') : '';
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
          <h3 className="text-lg font-bold text-white mt-0.5">Estado de Cuenta</h3>
          <p className="text-xs text-slate-400">Listo para enviar al cliente por WhatsApp</p>
        </div>

        {/* Tarjeta Visual de Previsualización */}
        <div className="my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
            <span className="font-bold text-sm tracking-wide text-white">CAMBIOS JK</span>
            <span className="text-[11px] font-mono text-slate-400">{todayStr}</span>
          </div>

          <div className="text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
            <div className="text-base font-bold text-slate-100">{data.clientName}</div>
            {data.phone && (
              <div className="text-xs text-slate-400 font-mono">Tel: {data.phone}</div>
            )}
          </div>

          {/* Cuadro de Saldo Destacado */}
          <div
            className={`mt-3 p-3.5 rounded-xl border text-center ${
              isDebtor
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : isSolvent
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider font-extrabold block">
              {isDebtor ? 'Pendiente por Pagar' : isSolvent ? 'Al Día / Solvente' : 'Saldo a Favor'}
            </span>
            <div className="text-2xl font-black font-mono mt-1 text-white">
              {isDebtor
                ? `$${data.currentDebt.toFixed(2)} USD`
                : isSolvent
                ? `$0.00 USD`
                : `$${Math.abs(data.currentDebt).toFixed(2)} USD`}
            </div>
          </div>

          {cleanNotes && (
            <p className="text-[11px] text-slate-400 mt-2.5 italic border-t border-slate-800 pt-2">
              Nota: {cleanNotes}
            </p>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="space-y-2.5">
          {/* Compartir Nativamente / WhatsApp */}
          <button
            onClick={handleNativeShare}
            disabled={isGenerating}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartir Imagen por WhatsApp</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Copiar Imagen al Portapapeles */}
            <button
              onClick={handleCopyImage}
              disabled={isGenerating}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
              <span>{copiedImage ? '¡Copiada!' : 'Copiar Imagen'}</span>
            </button>

            {/* Descargar Imagen PNG */}
            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Guardar PNG</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Abrir Chat WhatsApp */}
            <button
              onClick={handleOpenWhatsAppText}
              className="py-2 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center justify-center space-x-1 transition border border-slate-700/60 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Abrir WhatsApp</span>
            </button>

            {/* Copiar Texto */}
            <button
              onClick={handleCopyText}
              className="py-2 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center justify-center space-x-1 transition border border-slate-700/60 cursor-pointer"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedText ? 'Copiado' : 'Copiar Texto'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-500">
            En WhatsApp Web puedes presionar <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-300">Ctrl + V</kbd> para pegar la imagen directamente en el chat.
          </p>
        </div>
      </div>
    </div>
  );
}

