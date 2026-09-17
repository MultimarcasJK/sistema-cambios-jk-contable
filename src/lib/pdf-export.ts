import { StorageService } from './storage';

export function exportFullAccountingToPdf() {
  const accounts = StorageService.getAccounts();
  const detalTxs = StorageService.getTransactionsDetal();
  const mayorTxs = StorageService.getTransactionsMayor();
  const suppliers = StorageService.getSuppliers();
  const debtors = StorageService.getDebtors();
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalsByCurrency: Record<string, number> = {};
  accounts.forEach((acc) => {
    totalsByCurrency[acc.currency] = (totalsByCurrency[acc.currency] || 0) + acc.current_balance;
  });

  const totalDebtUsd = debtors.reduce((sum, d) => sum + (d.current_debt > 0 ? d.current_debt : 0), 0);
  const totalSuppliersDebtUsd = suppliers.reduce((sum, s) => sum + (s.current_debt_usd > 0 ? s.current_debt_usd : 0), 0);

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes para generar el PDF.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Contable - CAMBIOS JK</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 20px;
          background: #fff;
          font-size: 12px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #061934;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .brand {
          font-size: 20px;
          font-weight: 900;
          color: #061934;
          letter-spacing: -0.5px;
        }
        .brand span { color: #10b981; }
        .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
        .date { font-size: 11px; color: #334155; font-weight: 600; text-align: right; }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px;
          background: #f8fafc;
        }
        .card-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .card-val { font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 4px; font-family: monospace; }
        .card-val.green { color: #059669; }
        .card-val.red { color: #e11d48; }
        h3 {
          font-size: 13px;
          font-weight: 800;
          color: #061934;
          margin: 18px 0 8px 0;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          font-size: 10.5px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          text-align: left;
          padding: 6px 8px;
          font-weight: 700;
          border-bottom: 1.5px solid #cbd5e1;
        }
        td {
          padding: 5px 8px;
          border-bottom: 1px solid #f1f5f9;
        }
        .text-right { text-align: right; }
        .font-mono { font-family: monospace; font-weight: 700; }
        .green { color: #059669; }
        .red { color: #e11d48; }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #94a3b8;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">CAMBIOS <span>JK</span> — SISTEMA CONTABLE</div>
          <div class="subtitle">Libro de Balances, Cuentas y Operaciones</div>
        </div>
        <div class="date">
          <div>Fecha: ${today}</div>
          <div style="font-size: 10px; color: #059669; font-weight: 700;">● Reporte Oficial</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-label">Saldo USD</div>
          <div class="card-val green">$${(totalsByCurrency.USD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Saldo USDT</div>
          <div class="card-val green">₮${(totalsByCurrency.USDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Por Cobrar (Deudores)</div>
          <div class="card-val green">$${totalDebtUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Por Pagar (Proveedores)</div>
          <div class="card-val red">$${totalSuppliersDebtUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <h3>1. Estado de Cuentas y Billeteras (${accounts.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Cuenta / Banco</th>
            <th>Titular / Responsable</th>
            <th>Moneda</th>
            <th>Tipo</th>
            <th class="text-right">Saldo Actual</th>
          </tr>
        </thead>
        <tbody>
          ${
            accounts.length === 0
              ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Sin cuentas registradas</td></tr>'
              : accounts
                  .map(
                    (a) => `
            <tr>
              <td><strong>${a.name}</strong> <span style="color:#64748b;">(${a.bank_name})</span></td>
              <td>${a.responsible}</td>
              <td><strong>${a.currency}</strong></td>
              <td>${a.type}</td>
              <td class="text-right font-mono ${a.current_balance < 0 ? 'red' : 'green'}">
                ${a.current_balance < 0 ? '-' : '+'}${Math.abs(a.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          `
                  )
                  .join('')
          }
        </tbody>
      </table>

      <h3>2. Resumen de Operaciones Cripto/Dolar (${detalTxs.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th class="text-right">USDT</th>
            <th class="text-right">Tasa Venta</th>
            <th class="text-right">Total ($)</th>
            <th class="text-right">Ganancia ($)</th>
          </tr>
        </thead>
        <tbody>
          ${
            detalTxs.slice(0, 20).map((d) => `
            <tr>
              <td>${d.date}</td>
              <td>${d.client_name}</td>
              <td class="text-right font-mono">${d.usdt_amount.toLocaleString()}</td>
              <td class="text-right font-mono">${d.sell_price}</td>
              <td class="text-right font-mono">$${d.total_to_pay.toFixed(2)}</td>
              <td class="text-right font-mono ${d.profit_usd < 0 ? 'red' : 'green'}">
                ${d.profit_usd >= 0 ? '+' : '-'}$${Math.abs(d.profit_usd).toFixed(2)}
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Sin operaciones registradas</td></tr>'
          }
        </tbody>
      </table>

      <h3>3. Resumen de Operaciones Monedas Regionales (${mayorTxs.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th class="text-right">Monto Divisa</th>
            <th class="text-right">Tasa Venta</th>
            <th class="text-right">Total ($)</th>
            <th class="text-right">Ganancia ($)</th>
          </tr>
        </thead>
        <tbody>
          ${
            mayorTxs.slice(0, 20).map((m) => `
            <tr>
              <td>${m.date}</td>
              <td>${m.client_name}</td>
              <td class="text-right font-mono">${m.amount_ves.toLocaleString()}</td>
              <td class="text-right font-mono">${m.sell_price}</td>
              <td class="text-right font-mono">$${m.total_to_pay.toFixed(2)}</td>
              <td class="text-right font-mono ${m.profit_usd < 0 ? 'red' : 'green'}">
                ${m.profit_usd >= 0 ? '+' : '-'}$${Math.abs(m.profit_usd).toFixed(2)}
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Sin operaciones registradas</td></tr>'
          }
        </tbody>
      </table>

      <div class="footer">
        <div>Generado por Cambios JK Contable</div>
        <div>Documento Oficial Imprimible</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
