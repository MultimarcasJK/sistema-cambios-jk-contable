'use client';

import React, { useState } from 'react';
import { Share2, Download, Copy, Check, MessageCircle, X } from 'lucide-react';
import { PayrollPayment, Employee } from '@/types';

interface SharePayrollVoucherModalProps {
  payment: PayrollPayment;
  employee?: Employee;
  onClose: () => void;
}

export function SharePayrollVoucherModal({
  payment,
  employee,
  onClose,
}: SharePayrollVoucherModalProps) {
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const formattedDate = new Date(payment.date + 'T12:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const generateCanvas = (): Promise<HTMLCanvasElement> => {
    return new Promise((resolveCanvas) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1250;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolveCanvas(canvas);
        return;
      }

      // Fondo oscuro elegante
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1250);
      bgGrad.addColorStop(0, '#0a1120');
      bgGrad.addColorStop(1, '#131e36');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1000, 1250);

      // Marco
      ctx.strokeStyle = '#27354f';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, 940, 1190);

      // Barra superior con gradiente corporativo
      const topBarGrad = ctx.createLinearGradient(0, 30, 1000, 30);
      topBarGrad.addColorStop(0, '#10B981');
      topBarGrad.addColorStop(0.5, '#059669');
      topBarGrad.addColorStop(1, '#047857');
      ctx.fillStyle = topBarGrad;
      ctx.fillRect(30, 30, 940, 16);

      // Encabezado
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('GRUPO CAMBIOS JK', 70, 100);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('SISTEMA CONTABLE OFICIAL', 70, 128);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Fecha: ${formattedDate}`, 930, 100);
      ctx.fillText(`Ref: ${payment.reference || 'NOM-' + payment.id.slice(-6)}`, 930, 128);
      ctx.textAlign = 'left';

      // Línea divisoria
      ctx.strokeStyle = '#2d3f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(70, 160);
      ctx.lineTo(930, 160);
      ctx.stroke();

      // Título de Comprobante
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('RECIBO DE PAGO DE NÓMINA', 70, 215);

      // Caja de Información del Empleado
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(70, 245, 860, 140, 16);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText('COLABORADOR / EMPLEADO', 100, 280);
      ctx.fillText('CARGO / ROL', 520, 280);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(payment.employee_name, 100, 312);
      ctx.fillText(employee?.position || 'Personal Operativo', 520, 312);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '16px sans-serif';
      ctx.fillText(
        employee?.identification ? `Doc / Cédula: ${employee.identification}` : 'Documento no registrado',
        100,
        348
      );
      ctx.fillText(`Período: ${payment.period}`, 520, 348);

      // Detalle de Liquidación
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('DETALLE DE LA LIQUIDACIÓN', 70, 430);

      const items = [
        { label: 'Sueldo / Monto Base:', val: `${payment.currency} ${payment.base_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` },
        { label: 'Bonificaciones / Horas Extras (+):', val: `${payment.currency} ${payment.bonuses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` },
        { label: 'Deducciones / Anticipos (-):', val: `${payment.currency} ${payment.deductions.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` },
      ];

      let rowY = 475;
      items.forEach((it, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#18243b' : '#141e33';
        ctx.fillRect(70, rowY - 24, 860, 44);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '16px sans-serif';
        ctx.fillText(it.label, 95, rowY + 4);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(it.val, 905, rowY + 4);
        ctx.textAlign = 'left';

        rowY += 46;
      });

      // Caja Total Neto Pagado
      const totalY = rowY + 30;
      const totalGrad = ctx.createLinearGradient(70, totalY, 930, totalY);
      totalGrad.addColorStop(0, '#064e3b');
      totalGrad.addColorStop(1, '#065f46');
      ctx.fillStyle = totalGrad;
      ctx.beginPath();
      ctx.roundRect(70, totalY, 860, 130, 20);
      ctx.fill();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('TOTAL NETO PAGADO', 105, totalY + 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px monospace';
      ctx.fillText(`${payment.currency} ${payment.amount_currency.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, 105, totalY + 98);

      if (payment.amount_usd && payment.currency !== 'USD') {
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`≈ $${payment.amount_usd.toLocaleString('es-ES', { minimumFractionDigits: 2 })} USD`, 895, totalY + 80);
        ctx.textAlign = 'left';
      }

      // Notas y Datos de Pago
      let notesY = totalY + 165;
      if (employee?.payment_details || payment.notes) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(70, notesY, 860, 110, 14);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('DATOS DE DESTINO / OBSERVACIONES:', 95, notesY + 32);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '15px sans-serif';
        const txt = payment.notes || employee?.payment_details || 'Pago registrado de forma conforme.';
        ctx.fillText(txt.slice(0, 90), 95, notesY + 65);
        if (txt.length > 90) {
          ctx.fillText(txt.slice(90, 180), 95, notesY + 90);
        }
        notesY += 135;
      }

      // Pie de Firma
      const footerY = 1140;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(150, footerY);
      ctx.lineTo(400, footerY);
      ctx.moveTo(600, footerY);
      ctx.lineTo(850, footerY);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Firma Emisor (Administración)', 275, footerY + 25);
      ctx.fillText('Firma Conforme (Colaborador)', 725, footerY + 25);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText('Comprobante emitido electrónicamente por el Sistema Contable de Cambios JK.', 500, footerY + 65);

      resolveCanvas(canvas);
    });
  };

  const handleDownloadImage = async () => {
    setIsGenerating(true);
    try {
      const canvas = await generateCanvas();
      const link = document.createElement('a');
      link.download = `Recibo_Nomina_${payment.employee_name.replace(/\s+/g, '_')}_${payment.period.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyImage = async () => {
    setIsGenerating(true);
    try {
      const canvas = await generateCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2500);
        } catch {
          handleDownloadImage();
        }
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getWhatsAppText = () => {
    return (
      `*🧾 COMPROBANTE DE PAGO DE NÓMINA*\n` +
      `*GRUPO CAMBIOS JK*\n\n` +
      `👤 *Colaborador:* ${payment.employee_name}\n` +
      `💼 *Cargo:* ${employee?.position || 'Personal'}\n` +
      `📅 *Período:* ${payment.period}\n` +
      `🗓️ *Fecha:* ${formattedDate}\n` +
      `--------------------------------\n` +
      `💵 *Sueldo Base:* ${payment.currency} ${payment.base_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}\n` +
      (payment.bonuses > 0 ? `➕ *Bonificaciones:* ${payment.currency} ${payment.bonuses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}\n` : '') +
      (payment.deductions > 0 ? `➖ *Deducciones:* ${payment.currency} ${payment.deductions.toLocaleString('es-ES', { minimumFractionDigits: 2 })}\n` : '') +
      `--------------------------------\n` +
      `✅ *TOTAL NETO PAGADO:* *${payment.currency} ${payment.amount_currency.toLocaleString('es-ES', { minimumFractionDigits: 2 })}*\n` +
      (payment.amount_usd && payment.currency !== 'USD' ? `*(≈ $${payment.amount_usd.toFixed(2)} USD)*\n` : '') +
      (payment.reference ? `🔖 *Referencia:* ${payment.reference}\n` : '') +
      (payment.notes ? `📝 *Notas:* ${payment.notes}\n` : '') +
      `\n_Comprobante oficial generado por el Sistema Contable de Cambios JK._`
    );
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getWhatsAppText());
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {}
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(getWhatsAppText());
    const phone = employee?.phone ? employee.phone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Comprobante de Nómina</h3>
              <p className="text-xs text-slate-400">{payment.employee_name} • {payment.period}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vista Previa del Recibo */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="font-bold text-white font-sans text-sm">GRUPO CAMBIOS JK</span>
              <span className="text-slate-400 text-[11px]">{formattedDate}</span>
            </div>

            <div className="space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Colaborador:</span>
                <span className="font-bold text-white">{payment.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cargo:</span>
                <span>{employee?.position || 'Personal'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Período:</span>
                <span className="text-emerald-400 font-bold">{payment.period}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Sueldo Base:</span>
                <span>{payment.currency} {payment.base_amount.toLocaleString()}</span>
              </div>
              {payment.bonuses > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Bonificaciones (+):</span>
                  <span>+{payment.currency} {payment.bonuses.toLocaleString()}</span>
                </div>
              )}
              {payment.deductions > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Deducciones / Anticipos (-):</span>
                  <span>-{payment.currency} {payment.deductions.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="pt-2.5 border-t border-slate-700 flex justify-between items-center text-sm">
              <span className="font-bold text-white font-sans">NETO PAGADO:</span>
              <div className="text-right">
                <span className="font-black text-emerald-400 text-base font-mono">
                  {payment.currency} {payment.amount_currency.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </span>
                {payment.amount_usd && payment.currency !== 'USD' && (
                  <div className="text-[10px] text-slate-400">≈ ${payment.amount_usd.toFixed(2)} USD</div>
                )}
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleSendWhatsApp}
              className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl transition shadow-sm text-xs cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-2.5 px-3 rounded-xl border border-slate-700 transition text-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{isGenerating ? 'Generando...' : 'Descargar Imagen'}</span>
            </button>

            <button
              onClick={handleCopyImage}
              disabled={isGenerating}
              className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-2.5 px-3 rounded-xl border border-slate-700 transition text-xs cursor-pointer"
            >
              {copiedImage ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copiedImage ? '¡Copiado!' : 'Copiar Imagen'}</span>
            </button>

            <button
              onClick={handleCopyText}
              className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-2.5 px-3 rounded-xl border border-slate-700 transition text-xs cursor-pointer"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copiedText ? '¡Texto Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
