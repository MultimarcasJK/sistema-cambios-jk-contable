/**
 * Utilidades de formato numérico - Opción B (Estándar Internacional)
 * Separador de miles: Coma (,)
 * Separador de decimales: Punto (.)
 */

// Limpia un string formateado y retorna el número puro
export function parseFormattedNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = val.toString().replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Formatea un número en formato 'en-US' (ej. 15,000.00)
export function formatCurrency(
  val: number | string | undefined | null,
  decimalsOrCurrency: number | string = 2
): string {
  const num = typeof val === 'string' ? parseFormattedNumber(val) : (val || 0);
  const decimals = typeof decimalsOrCurrency === 'number' ? decimalsOrCurrency : 2;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Formatea números de moneda regional (si no tiene decimales muestra entero ej. 15,000)
export function formatRegionalAmount(
  val: number | string | undefined | null,
  currency?: string
): string {
  const num = typeof val === 'string' ? parseFormattedNumber(val) : (val || 0);
  const isCents = currency === 'USD' || currency === 'EUR' || currency === 'USDT';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: isCents ? 2 : num % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 4,
  });
}

// Formatea tasas con punto decimal y hasta 4 decimales
export function formatRateDisplay(rate: number | string | undefined | null): string {
  if (!rate) return '0.00';
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

// Tasa tal cual se anotó: sin redondear ni rellenar con ceros (0.995 → 0.995, 788 → 788)
export function formatRateExact(rate: number | string | undefined | null): string {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (!num || isNaN(num)) return '0';
  return num.toLocaleString('en-US', { maximumFractionDigits: 10 });
}

// Formatea el valor mientras el usuario lo escribe en un input
export function formatInputNumber(value: string): string {
  if (!value) return '';
  // Remover todo excepto dígitos y un punto
  let clean = value.replace(/[^0-9.]/g, '');
  
  // Evitar múltiples puntos
  const parts = clean.split('.');
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('');
  }

  const [integerPart, decimalPart] = clean.split('.');

  // Formatear la parte entera con comas de miles
  const formattedInteger = integerPart
    ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : '';

  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
}
