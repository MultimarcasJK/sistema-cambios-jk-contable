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

// Nota para el cliente: las notas automáticas del sistema no le dicen nada (y podían contradecir el saldo)
function notaParaCliente(notes?: string): string {
  const raw = (notes || '').trim();
  if (/^(sincronizado de operaciones|abono a favor registrado|generado automáticamente)/i.test(raw)) return '';
  return raw
    .replace(/\((detal|mayor)\)/gi, '')
    .replace(/\bdetal\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ShareVoucherModalProps {
  data: VoucherData;
  onClose: () => void;
}

export function ShareVoucherModal({ data, onClose }: ShareVoucherModalProps) {
  const cleanNotes = notaParaCliente(data.notes);
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
      const W = 1000;
      const H = 1334;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolveCanvas(canvas);
        return;
      }

      const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      const TEAL = '#2dd4bf';
      const LABEL = '#93c5fd';
      const CARD = '#132748';
      const CARD_BORDER = '#24406a';

      const caja = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };
      const tarjeta = (x: number, y: number, w: number, h: number, borde: string, grosor: number) => {
        caja(x, y, w, h, 16);
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
      // Íconos (trazos de lucide, cuadrícula 24x24) centrados en (cx, cy)
      const icono = (trazos: string[], cx: number, cy: number, size: number, color = TEAL) => {
        ctx.save();
        const k = size / 24;
        ctx.translate(cx - size / 2, cy - size / 2);
        ctx.scale(k, k);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        trazos.forEach((d) => ctx.stroke(new Path2D(d)));
        ctx.restore();
      };
      const CIRCULO = 'M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0';
      const I = {
        usuario: ['M18 20a6 6 0 0 0-12 0', 'M16 10a4 4 0 1 1-8 0a4 4 0 1 1 8 0', CIRCULO],
        telefono: [
          'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
        ],
        calendario: [
          'M8 2v4',
          'M16 2v4',
          'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
          'M3 10h18',
          'M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01',
        ],
        documento: [
          'M8 2h8a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z',
          'M8 9h8',
          'M8 13h8',
          'M8 17h8',
        ],
        barras: ['M5 20v-6', 'M12 20V9', 'M19 20V4'],
        dolar: [CIRCULO, 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 18V6'],
        whatsapp: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z', 'M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.8.8c-1-.4-1.8-1.2-2.2-2.2l.8-.8-1-2z'],
        reloj: [CIRCULO, 'M12 6v6l4 2'],
        alerta: [CIRCULO, 'M12 8v4', 'M12 16h.01'],
      };
      // Recorta un texto para que no se salga de su espacio
      const ajustar = (txt: string, max: number) => {
        if (ctx.measureText(txt).width <= max) return txt;
        let t = txt;
        while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
        return t + '…';
      };

      // Fondo azul noche
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0c1d3b');
      bgGrad.addColorStop(1, '#0a1730');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Cargar logo JK (con el camión)
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo-jk-camion.png`;

      const drawContent = (conLogo: boolean) => {
        // Logo + Nombre Empresa, centrados juntos
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 56px ${FONT}`;
        ctx.textBaseline = 'middle';
        const textW = ctx.measureText('CAMBIOS JK').width;
        const logoH = 112;
        const logoW = conLogo ? Math.round((logoH * logo.naturalWidth) / (logo.naturalHeight || 1)) : 0;
        const gap = conLogo ? 22 : 0;
        const startX = W / 2 - (logoW + gap + textW) / 2;
        if (conLogo) ctx.drawImage(logo, startX, 102 - logoH / 2, logoW, logoH);
        ctx.textAlign = 'left';
        ctx.fillText('CAMBIOS JK', startX + logoW + gap, 102);

        // Título con líneas a los lados
        ctx.textAlign = 'center';
        ctx.font = `bold 34px ${FONT}`;
        ctx.fillStyle = TEAL;
        const titulo = 'ESTADO DE CUENTA DE CLIENTE';
        const tW = ctx.measureText(titulo).width;
        ctx.fillText(titulo, W / 2, 205);
        linea(53, 205, W / 2 - tW / 2 - 28, 205, TEAL, 3);
        linea(W / 2 + tW / 2 + 28, 205, 947, 205, TEAL, 3);

        // Tarjeta del Cliente
        tarjeta(53, 257, 894, 209, CARD_BORDER, 2);
        icono(I.usuario, 110, 315, 58);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `20px ${FONT}`;
        ctx.fillStyle = LABEL;
        ctx.fillText('CLIENTE:', 159, 303);
        ctx.font = `bold 34px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ajustar(data.clientName.toUpperCase(), 740), 159, 342);
        linea(84, 366, 916, 366, CARD_BORDER, 2);

        icono(I.telefono, 108, 414, 40);
        ctx.font = `19px ${FONT}`;
        ctx.fillStyle = LABEL;
        ctx.fillText('TELÉFONO:', 160, 404);
        ctx.font = `24px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ajustar(data.phone || 'No registrado', 320), 160, 434);
        linea(506, 390, 506, 441, CARD_BORDER, 2);
        icono(I.calendario, 595, 414, 40);
        ctx.font = `19px ${FONT}`;
        ctx.fillStyle = LABEL;
        ctx.fillText('FECHA DE EMISIÓN:', 644, 404);
        ctx.font = `24px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(todayStr, 644, 434);

        // Cuadro de Saldo Principal
        let statusColor = '#059669';
        let statusText = 'AL DÍA / SOLVENTE';
        let amountText = '$0.00 USD';
        if (isDebtor) {
          statusColor = '#dc2626';
          statusText = 'PENDIENTE POR COBRAR';
          amountText = `$${data.currentDebt.toFixed(2)} USD`;
        } else if (hasCredit) {
          statusColor = '#2563eb';
          statusText = 'SALDO A FAVOR DEL CLIENTE';
          amountText = `$${Math.abs(data.currentDebt).toFixed(2)} USD`;
        }
        tarjeta(53, 498, 894, 284, TEAL, 3);

        // Etiqueta de estado (píldora con ícono)
        ctx.font = `bold 27px ${FONT}`;
        const sW = ctx.measureText(statusText).width;
        const pillW = sW + 44 + 16 + 64;
        const pillX = W / 2 - pillW / 2;
        caja(pillX, 530, pillW, 52, 26);
        ctx.fillStyle = statusColor;
        ctx.fill();
        icono(I.alerta, pillX + 32 + 20, 556, 38, '#ffffff');
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(statusText, pillX + 32 + 44 + 16, 557);

        ctx.textAlign = 'center';
        ctx.font = `bold 92px ${FONT}`;
        ctx.fillText(ajustar(amountText, 820), W / 2, 660);
        ctx.textBaseline = 'alphabetic';
        ctx.font = `24px ${FONT}`;
        ctx.fillStyle = LABEL;
        ctx.fillText('Saldo consolidado a la fecha', W / 2, 752);

        // Cuadro de Detalles
        tarjeta(53, 815, 894, 385, CARD_BORDER, 2);
        icono(I.documento, 102, 858, 40);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 27px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('INFORMACIÓN DE CONTROL & CONCILIACIÓN', 148, 859);
        linea(84, 898, 916, 898, CARD_BORDER, 2);

        const fila = (ic: string[], y: number, etiqueta: string, valor: string) => {
          icono(ic, 105, y + 14, 40);
          ctx.textBaseline = 'alphabetic';
          if (etiqueta) {
            ctx.font = `21px ${FONT}`;
            ctx.fillStyle = LABEL;
            ctx.fillText(etiqueta, 160, y + 6);
            ctx.font = `22px ${FONT}`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(ajustar(valor, 740), 160, y + 36);
          } else {
            ctx.font = `22px ${FONT}`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(ajustar(valor, 740), 160, y + 22);
          }
        };

        fila(
          I.barras,
          938,
          'Estado Actual:',
          isDebtor
            ? 'Cuenta con saldo deudor pendiente.'
            : isSolvent
              ? 'El cliente se encuentra al día sin deudas.'
              : 'Saldo a favor disponible para transacciones.',
        );
        if (data.lastPaymentAmount && data.lastPaymentAmount > 0) {
          fila(
            I.dolar,
            1015,
            'Último Abono Registrado:',
            `$${data.lastPaymentAmount.toFixed(2)} USD (${data.lastPaymentDate || 'Reciente'})`,
          );
        } else {
          fila(I.dolar, 1015, 'Moneda de Referencia:', 'Dólares Americanos (USD).');
        }
        if (cleanNotes) {
          fila(I.whatsapp, 1081, 'Observaciones:', cleanNotes);
        } else {
          fila(I.whatsapp, 1081, '', 'Soporte y Atención directa vía WhatsApp');
        }
        fila(
          I.reloj,
          1147,
          'Emitido:',
          new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }),
        );

        // Pie de Comprobante
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `17px ${FONT}`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Este documento es un comprobante de control administrativo emitido por CAMBIOS JK.', W / 2, 1258);
        ctx.fillText('Agradecemos su preferencia y puntualidad en sus transacciones.', W / 2, 1283);
        const pieW = ctx.measureText('Este documento es un comprobante de control administrativo emitido por CAMBIOS JK.').width;
        linea(53, 1252, W / 2 - pieW / 2 - 24, 1252, TEAL, 2);
        linea(W / 2 + pieW / 2 + 24, 1252, 947, 1252, TEAL, 2);

        resolveCanvas(canvas);
      };

      logo.onload = () => drawContent(true);
      // Si falla el logo, solo el nombre
      logo.onerror = () => drawContent(false);
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

