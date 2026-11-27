import { LiveRate, AppMode, Currency, RateTier } from '@/types';

const GOOGLE_SHEETS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwirpun5iWeuc7fc0mvv-nXQl-2ZyJMkOOJbNGLoh9U5qb5Hy9SRKnldeifWHp8a10MC1UK_0DU8co/pub?output=csv';

const STORAGE_KEYS = {
  RATES: 'cambiosjk_live_rates_v5',
  LAST_SYNC: 'cambiosjk_rates_last_sync_v5',
  APP_MODE: 'cambiosjk_app_mode_v1',
};

export interface RateInfoResult {
  buyPrice: number;
  sellPrice: number;
  costRate: number;
  sellRate: number;
  proveedor: string;
  provider: string;
  margenPercent: number;
  marginPercentage: number;
  hasVip: boolean;
  vipRate: number;
  vipMargin: number | null;
  vipFee: number;
  hasMayorRst: boolean;
  mayorRstRate: number;
  mayorRstMargin: number | null;
  hasMayorVolumen: boolean;
  mayorVolumenRate: number;
  mayorVolumenMargin: number | null;
  montoMinimo: number | null;
}

export const DEFAULT_RATES: LiveRate[] = [
  { pais: 'USDT', codigo: 'USDT', moneda: 'TetherUS', tasaEnvio: 1, margenEnvio: 5, tasaRecibo: 1, margenRecibo: 5, margenEnvioMayor: 4.5, margenReciboMayor: 3.5, margenEnvioVIP: null, comisionVIP: null, margenMayorRST: 3, margenMayorVolumen: null, montoMinimo: 50, proveedor: 'Ronal/Gocho' },
  { pais: 'Europa', codigo: 'EUR', moneda: 'Euro', tasaEnvio: 1, margenEnvio: 20, tasaRecibo: 1, margenRecibo: 15, margenEnvioMayor: 17, margenReciboMayor: 1, margenEnvioVIP: null, comisionVIP: null, margenMayorRST: null, margenMayorVolumen: null, montoMinimo: 100, proveedor: 'Camacaro' },
  { pais: 'Venezuela', codigo: 'VES', moneda: 'Bolívar Digital', tasaEnvio: 1067, margenEnvio: 10, tasaRecibo: 1090, margenRecibo: 6, margenEnvioMayor: 5.5, margenReciboMayor: 5, margenEnvioVIP: 8, comisionVIP: 1, margenMayorRST: 4.5, margenMayorVolumen: 4, montoMinimo: 20, proveedor: 'Jesus Rico' },
  { pais: 'Colombia', codigo: 'COP', moneda: 'Peso colombiano', tasaEnvio: 3440, margenEnvio: 6, tasaRecibo: 3465, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 20, proveedor: 'Dario/Unicambios' },
  { pais: 'Chile', codigo: 'CLP', moneda: 'Peso chileno', tasaEnvio: 980, margenEnvio: 6, tasaRecibo: 1101, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 20, proveedor: 'Jesus Rico enviar / Mauro C recibir' },
  { pais: 'Perú', codigo: 'PEN', moneda: 'Sol', tasaEnvio: 3.46, margenEnvio: 6, tasaRecibo: 3.57, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 20, proveedor: 'Enviar Solano/ Nataly L Recibir' },
  { pais: 'Argentina', codigo: 'ARS', moneda: 'Peso argentino', tasaEnvio: 1643, margenEnvio: 6, tasaRecibo: 1853, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 25, proveedor: 'Mauro C' },
  { pais: 'Brasil', codigo: 'BRL', moneda: 'Real brasileño', tasaEnvio: 5.63, margenEnvio: 6, tasaRecibo: 6.46, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 25, proveedor: 'Enviar Ricardo miguelacho/Mauro C Recibir' },
  { pais: 'México', codigo: 'MXN', moneda: 'Peso mexicano', tasaEnvio: 18.5, margenEnvio: 6, tasaRecibo: 20.8, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 30, proveedor: 'Enviar Unicambios/Miguelacho recibir / Mauro C Recibir' },
  { pais: 'Uruguay', codigo: 'UYU', moneda: 'Peso uruguayo', tasaEnvio: 39.98, margenEnvio: 6, tasaRecibo: 45.39, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 25, proveedor: 'Mauro C' },
  { pais: 'Paraguay', codigo: 'PYG', moneda: 'Guaraní', tasaEnvio: 6105, margenEnvio: 6, tasaRecibo: 6884, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 25, proveedor: 'Mauro C' },
  { pais: 'Costa Rica', codigo: 'CRC', moneda: 'Colón costarricense', tasaEnvio: 409, margenEnvio: 6, tasaRecibo: 521, margenRecibo: 6, margenEnvioMayor: 4, margenReciboMayor: 4, montoMinimo: 25, proveedor: 'Mauro C' },
  { pais: 'Bolivia', codigo: 'BOB', moneda: 'Boliviano', tasaEnvio: 10.67, margenEnvio: 6, tasaRecibo: 0, margenRecibo: 0, margenEnvioMayor: 4, margenReciboMayor: null, montoMinimo: 25, proveedor: 'Mauro C' },
  { pais: 'República Dominicana', codigo: 'DOP', moneda: 'Peso dominicano', tasaEnvio: 55.86, margenEnvio: 6, tasaRecibo: 0, margenRecibo: 0, margenEnvioMayor: 4, margenReciboMayor: null, montoMinimo: 25, proveedor: 'Mauro C' },
  { pais: 'Cuba', codigo: 'CUP', moneda: 'Peso cubano', tasaEnvio: 959, margenEnvio: 6, tasaRecibo: 0, margenRecibo: 0, margenEnvioMayor: 4, margenReciboMayor: null, montoMinimo: 50, proveedor: 'Mauro C' },
];

function normalizeHeader(h: string): string {
  return h
    .replace(/"/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function parseNumber(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return fallback;
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

function parseNullableNumber(val: string | undefined): number | null {
  if (val === undefined || val === null) return null;
  const cleaned = val.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function splitCsvRow(line: string): string[] {
  let inQuotes = false;
  let cur = '';
  const row: string[] = [];
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  row.push(cur.trim());
  return row;
}

/**
 * Parsea el CSV publicado del Google Sheet de tasas (incluyendo columnas VIP, Mayor X RST,
 * Mayor 1000 y Monto Mínimo) manteniendo 100% compatibilidad con grupojk-conversor.
 */
export function parseRatesCsv(csvText: string): LiveRate[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map(normalizeHeader);

  const idxPais = headers.findIndex((h) => h === 'PAIS' || h.includes('PAIS'));
  const idxEnvio = headers.findIndex((h) => h.includes('TASA ENVIO') || h === 'TASA PROVEEDOR');
  const idxMargenE = headers.findIndex(
    (h) => h === 'MARGEN ENVIO' || (h.includes('MARGEN ENV') && !h.includes('MAYOR') && !h.includes('VIP'))
  );
  const idxRecibo = headers.findIndex((h) => h.includes('TASA RECIBO'));
  const idxMargenR = headers.findIndex(
    (h) => h === 'MARGEN RECIBO' || (h.includes('MARGEN REC') && !h.includes('MAYOR'))
  );
  const idxMargenMayorE = headers.findIndex(
    (h) =>
      h.includes('MARGEN ENVIO MAYOR') ||
      (h.includes('MARGEN ENV') && h.includes('MAYOR')) ||
      h.includes('TASA 1 X CUENTA') ||
      h.includes('TASA 1 CUENTA')
  );
  const idxMargenMayorR = headers.findIndex(
    (h) => h.includes('MARGEN RECIBO MAYOR') || (h.includes('MARGEN REC') && h.includes('MAYOR'))
  );
  const idxMargenEnvioVIP = headers.findIndex(
    (h) => h.includes('MARGEN ENVIO VIP') || h === 'MARGEN VIP' || h === 'VIP'
  );
  const idxComisionVIP = headers.findIndex(
    (h) => h.includes('COMISION VIP') || h.includes('FEE VIP')
  );
  const idxMargenMayorRST = headers.findIndex(
    (h) =>
      h.includes('MARGEN MAYOR X RST') ||
      h.includes('MARGEN MAYOR RST') ||
      h.includes('MAYOR X RST') ||
      h.includes('MAYOR RST')
  );
  const idxMargenMayorVolumen = headers.findIndex(
    (h) =>
      h.includes('MARGEN MAYOR 1000') ||
      h.includes('MARGEN MAYOR VOLUMEN') ||
      h.includes('MAYOR 1000')
  );
  const idxCodigo = headers.findIndex((h) => h.includes('CODIGO') || h.includes('BANCO'));
  const idxMoneda = headers.findIndex((h) => h.includes('NOMBRE') || h.includes('MONEDA'));
  const idxProv = headers.findIndex((h) => h.includes('PROVEEDOR'));
  const idxEUR = headers.findIndex((h) => h.includes('FACTOR EUR') || h.includes('VALOR EUR'));
  const idxUSDT = headers.findIndex((h) => h.includes('FACTOR USDT') || h.includes('VALOR USDT'));
  const idxCiudades = headers.findIndex((h) => h.includes('CIUDADES'));
  const idxIso = headers.findIndex((h) => h.includes('ISO'));
  const idxMinimo = headers.findIndex(
    (h) => h.includes('MINIMO') || h.includes('MONTO MIN') || h === 'MIN'
  );

  const parsedRates: LiveRate[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvRow(lines[i]);
    const pIdx = idxPais >= 0 ? idxPais : 0;
    if (!row[pIdx]) continue;

    const paisName = row[pIdx];
    const codigo = (idxCodigo >= 0 && row[idxCodigo] ? row[idxCodigo] : paisName).toUpperCase() as Currency;

    const tasaEnvio = idxEnvio >= 0 ? parseNumber(row[idxEnvio], 0) : 0;
    const margenEnvio = idxMargenE >= 0 ? parseNumber(row[idxMargenE], 3) : 3;
    const tasaRecibo = idxRecibo >= 0 ? parseNumber(row[idxRecibo], 0) : 0;
    const margenRecibo = idxMargenR >= 0 ? parseNumber(row[idxMargenR], 3) : 3;
    const margenEnvioMayor = idxMargenMayorE >= 0 ? parseNullableNumber(row[idxMargenMayorE]) : null;
    const margenReciboMayor = idxMargenMayorR >= 0 ? parseNullableNumber(row[idxMargenMayorR]) : null;
    const margenEnvioVIP = idxMargenEnvioVIP >= 0 ? parseNullableNumber(row[idxMargenEnvioVIP]) : null;
    const comisionVIP = idxComisionVIP >= 0 ? parseNullableNumber(row[idxComisionVIP]) : null;
    const margenMayorRST = idxMargenMayorRST >= 0 ? parseNullableNumber(row[idxMargenMayorRST]) : null;
    const margenMayorVolumen = idxMargenMayorVolumen >= 0 ? parseNullableNumber(row[idxMargenMayorVolumen]) : null;
    const montoMinimo = idxMinimo >= 0 ? parseNullableNumber(row[idxMinimo]) : null;

    const proveedor = idxProv >= 0 && row[idxProv] ? row[idxProv] : 'General';
    const moneda = idxMoneda >= 0 && row[idxMoneda] ? row[idxMoneda] : paisName;
    const factorEUR = idxEUR >= 0 ? parseNumber(row[idxEUR], 0) : 0;
    const factorUSDT = idxUSDT >= 0 ? parseNumber(row[idxUSDT], 0) : 0;
    const ciudades = idxCiudades >= 0 && row[idxCiudades] ? row[idxCiudades] : undefined;
    const iso = idxIso >= 0 && row[idxIso] ? row[idxIso].toUpperCase() : undefined;

    parsedRates.push({
      pais: paisName,
      codigo,
      moneda,
      tasaEnvio,
      margenEnvio,
      tasaRecibo,
      margenRecibo,
      margenEnvioMayor,
      margenReciboMayor,
      margenEnvioVIP,
      comisionVIP,
      margenMayorRST,
      margenMayorVolumen,
      montoMinimo,
      proveedor,
      ciudades,
      iso,
      factorEUR,
      factorUSDT,
    });
  }

  return parsedRates;
}

export const RatesService = {
  getAppMode(): AppMode {
    if (typeof window === 'undefined') return 'detal';
    const saved = localStorage.getItem(STORAGE_KEYS.APP_MODE);
    return saved === 'mayor' ? 'mayor' : 'detal';
  },

  setAppMode(mode: AppMode): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.APP_MODE, mode);
  },

  getCachedRates(): LiveRate[] {
    if (typeof window === 'undefined') return DEFAULT_RATES;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RATES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_RATES;
  },

  isCajaDolar(p: { codigo?: string; pais?: string } | null | undefined): boolean {
    if (!p) return false;
    const cod = (p.codigo || '').toUpperCase();
    const nom = (p.pais || '').toUpperCase();
    return (
      ['USD', 'USDT', 'EC', 'US', 'PA'].includes(cod) ||
      nom.includes('USDT') ||
      nom.includes('ZELLE') ||
      nom.includes('EFECTIVO VEN') ||
      nom.includes('EFECTIVO VENEZUELA')
    );
  },

  tieneTasaVIP(p: LiveRate | null | undefined): boolean {
    if (!p) return false;
    return p.margenEnvioVIP !== undefined && p.margenEnvioVIP !== null && !isNaN(Number(p.margenEnvioVIP));
  },

  obtenerComisionVIP(p: LiveRate | null | undefined): number {
    if (!p) return 1;
    if (p.comisionVIP !== undefined && p.comisionVIP !== null && !isNaN(Number(p.comisionVIP))) {
      return Math.max(Number(p.comisionVIP), 0);
    }
    return 1;
  },

  tieneTasaMayorRST(p: LiveRate | null | undefined): boolean {
    if (!p) return false;
    return p.margenMayorRST !== undefined && p.margenMayorRST !== null && !isNaN(Number(p.margenMayorRST));
  },

  tieneTasaMayorVolumen(p: LiveRate | null | undefined): boolean {
    if (!p) return false;
    return p.margenMayorVolumen !== undefined && p.margenMayorVolumen !== null && !isNaN(Number(p.margenMayorVolumen));
  },

  margenEnvio(p: LiveRate, modo: AppMode = 'detal', tier: RateTier = 'normal'): number {
    if (tier === 'vip' && this.tieneTasaVIP(p)) {
      return Number(p.margenEnvioVIP);
    }
    if (tier === 'mayor_rst' && this.tieneTasaMayorRST(p)) {
      return Number(p.margenMayorRST);
    }
    if (tier === 'mayor_volumen' && this.tieneTasaMayorVolumen(p)) {
      return Number(p.margenMayorVolumen);
    }
    if (
      (modo === 'mayor' || tier === 'mayor_rst' || tier === 'mayor_volumen') &&
      p.margenEnvioMayor !== undefined &&
      p.margenEnvioMayor !== null &&
      !isNaN(Number(p.margenEnvioMayor))
    ) {
      return Number(p.margenEnvioMayor);
    }
    return Number(p.margenEnvio) || 0;
  },

  margenRecibo(p: LiveRate, modo: AppMode = 'detal'): number {
    if (
      modo === 'mayor' &&
      p.margenReciboMayor !== undefined &&
      p.margenReciboMayor !== null &&
      !isNaN(Number(p.margenReciboMayor))
    ) {
      return Number(p.margenReciboMayor);
    }
    return Number(p.margenRecibo) || 0;
  },

  calcularTasaEnvio(p: LiveRate, modo: AppMode = 'detal', tier: RateTier = 'normal'): number {
    const m = this.margenEnvio(p, modo, tier);
    if (this.isCajaDolar(p)) {
      // CAJA DÓLAR (USDT, Zelle, Efectivo): base 1 fija para que 4% dé 0.96 exactos
      return 1 * (1 - m / 100);
    }
    const t = p.tasaEnvio || 0;
    if (t === 0) return 0;
    return t * (1 - m / 100);
  },

  calcularTasaRecibo(p: LiveRate, modo: AppMode = 'detal'): number {
    const m = this.margenRecibo(p, modo);
    if (this.isCajaDolar(p)) {
      return 1 * (1 + m / 100);
    }
    const t = p.tasaRecibo || 0;
    if (t === 0) return 0;
    return t * (1 + m / 100);
  },

  async syncRatesFromSheets(): Promise<LiveRate[]> {
    try {
      let sheetUrl = GOOGLE_SHEETS_CSV_URL;
      if (typeof window !== 'undefined') {
        try {
          const cfgRes = await fetch(
            'https://raw.githubusercontent.com/grupojk-cambios/grupojk-conversor/main/src/constants.js?nocache=' + Date.now(),
            { cache: 'no-store' }
          );
          if (cfgRes.ok) {
            const fileContent = await cfgRes.text();
            const matchSheet = fileContent.match(/GOOGLE_SHEET_CSV_URL\s*=\s*['"`]([^'"`]+)['"`]/i);
            if (matchSheet && matchSheet[1]) {
              sheetUrl = matchSheet[1];
            }
          }
        } catch {
          // Fallback a URL estática
        }
      }

      const sep = sheetUrl.includes('?') ? '&' : '?';
      const nocacheUrl = `${sheetUrl}${sep}nocache=${Date.now()}`;
      const res = await fetch(nocacheUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const csvText = await res.text();
      const parsedRates = parseRatesCsv(csvText);

      if (parsedRates.length > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(parsedRates));
          const nowIso = new Date().toISOString();
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC, nowIso);
          window.dispatchEvent(new CustomEvent('cambiosjk_rates_updated', { detail: parsedRates }));
        }
        return parsedRates;
      }
    } catch (err) {
      console.error('Error sincronizando tasas:', err);
    }
    return this.getCachedRates();
  },

  getLastSync(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  },

  getLastSyncTime(): string | null {
    return this.getLastSync();
  },

  /**
   * Tasa de costo (compra) en vivo de App JK para una moneda local (VES, COP, PEN...), como texto.
   * null si no hay tasa cargada para esa moneda; USD, USDT y EUR se manejan aparte.
   */
  liveCostRate(currency: string, mode: AppMode = 'detal'): string | null {
    const c = (currency || '').toUpperCase();
    if (!c || c === 'USD' || c === 'USDT' || c === 'EUR') return null;
    const info = this.getRateInfo(c, mode);
    if (info.provider === 'General' && info.costRate === 1) return null;
    return info.costRate > 0 ? String(info.costRate) : null;
  },

  findRateEntry(currency: string, rates?: LiveRate[]): LiveRate | undefined {
    const list = rates || this.getCachedRates();
    const cleanCurr = (currency || '').toUpperCase();
    if (!cleanCurr) return undefined;

    return list.find(
      (r) =>
        r.codigo.toUpperCase() === cleanCurr ||
        r.pais.toUpperCase().includes(cleanCurr) ||
        (cleanCurr === 'USDT' && r.pais.toUpperCase().includes('USDT')) ||
        (cleanCurr === 'VES' && (r.pais.toUpperCase().includes('VENEZUELA') || r.codigo === 'VES')) ||
        (cleanCurr === 'COP' && (r.pais.toUpperCase().includes('COLOMBIA') || r.codigo === 'COP')) ||
        (cleanCurr === 'EUR' && (r.pais.toUpperCase().includes('EURO') || r.codigo === 'EUR')) ||
        (cleanCurr === 'PEN' && (r.pais.toUpperCase().includes('PERU') || r.pais.toUpperCase().includes('PERÚ') || r.codigo === 'PEN')) ||
        (cleanCurr === 'CLP' && (r.pais.toUpperCase().includes('CHILE') || r.codigo === 'CLP')) ||
        (cleanCurr === 'BRL' && (r.pais.toUpperCase().includes('BRASIL') || r.codigo === 'BRL')) ||
        (cleanCurr === 'ARS' && (r.pais.toUpperCase().includes('ARGENTINA') || r.codigo === 'ARS'))
    );
  },

  getRateInfo(
    currency: string,
    mode: AppMode = 'detal',
    tier: RateTier = 'normal',
    ratesOverride?: LiveRate[]
  ): RateInfoResult {
    const found = this.findRateEntry(currency, ratesOverride);

    if (!found) {
      return {
        buyPrice: 1,
        sellPrice: 1,
        costRate: 1,
        sellRate: 1,
        proveedor: 'General',
        provider: 'General',
        margenPercent: 0,
        marginPercentage: 0,
        hasVip: false,
        vipRate: 0,
        vipMargin: null,
        vipFee: 1,
        hasMayorRst: false,
        mayorRstRate: 0,
        mayorRstMargin: null,
        hasMayorVolumen: false,
        mayorVolumenRate: 0,
        mayorVolumenMargin: null,
        montoMinimo: null,
      };
    }

    const costRate = found.tasaEnvio > 0 ? found.tasaEnvio : 1;
    const margen = this.margenEnvio(found, mode, tier);
    const sellRate = Number(this.calcularTasaEnvio(found, mode, tier).toFixed(4));

    const hasVip = this.tieneTasaVIP(found);
    const vipRate = hasVip ? Number(this.calcularTasaEnvio(found, 'detal', 'vip').toFixed(4)) : 0;
    const vipMargin = hasVip ? Number(found.margenEnvioVIP) : null;
    const vipFee = this.obtenerComisionVIP(found);

    const hasMayorRst = this.tieneTasaMayorRST(found);
    const mayorRstRate = hasMayorRst ? Number(this.calcularTasaEnvio(found, 'mayor', 'mayor_rst').toFixed(4)) : 0;
    const mayorRstMargin = hasMayorRst ? Number(found.margenMayorRST) : null;

    const hasMayorVolumen = this.tieneTasaMayorVolumen(found);
    const mayorVolumenRate = hasMayorVolumen
      ? Number(this.calcularTasaEnvio(found, 'mayor', 'mayor_volumen').toFixed(4))
      : 0;
    const mayorVolumenMargin = hasMayorVolumen ? Number(found.margenMayorVolumen) : null;

    return {
      buyPrice: costRate,
      sellPrice: sellRate,
      costRate,
      sellRate,
      proveedor: found.proveedor || 'General',
      provider: found.proveedor || 'General',
      margenPercent: margen,
      marginPercentage: margen,
      hasVip,
      vipRate,
      vipMargin,
      vipFee,
      hasMayorRst,
      mayorRstRate,
      mayorRstMargin,
      hasMayorVolumen,
      mayorVolumenRate,
      mayorVolumenMargin,
      montoMinimo: found.montoMinimo ?? null,
    };
  },
};
