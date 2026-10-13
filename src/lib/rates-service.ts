import { LiveRate, AppMode, Currency } from '@/types';

const GOOGLE_SHEETS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwirpun5iWeuc7fc0mvv-nXQl-2ZyJMkOOJbNGLoh9U5qb5Hy9SRKnldeifWHp8a10MC1UK_0DU8co/pub?output=csv';

const STORAGE_KEYS = {
  RATES: 'cambiosjk_live_rates_v4',
  LAST_SYNC: 'cambiosjk_rates_last_sync_v4',
  APP_MODE: 'cambiosjk_app_mode_v1',
};

export const DEFAULT_RATES: LiveRate[] = [
  { pais: 'USDT', codigo: 'USDT', moneda: 'TetherUS', tasaEnvio: 1.01, margenEnvio: 7, tasaRecibo: 1, margenRecibo: 5, margenEnvioMayor: 1, margenReciboMayor: 1, proveedor: 'Ronal/Gocho' },
  { pais: 'Europa', codigo: 'EUR', moneda: 'Euro', tasaEnvio: 1.14, margenEnvio: 6, tasaRecibo: 1, margenRecibo: 1, margenEnvioMayor: 4, margenReciboMayor: 1, proveedor: 'Camacaro' },
  { pais: 'Venezuela', codigo: 'VES', moneda: 'Bolívar Digital', tasaEnvio: 947, margenEnvio: 8.69, tasaRecibo: 967, margenRecibo: 3, margenEnvioMayor: 1.8, margenReciboMayor: 2, proveedor: 'Jesus Rico' },
  { pais: 'Colombia', codigo: 'COP', moneda: 'Peso colombiano', tasaEnvio: 3060, margenEnvio: 3, tasaRecibo: 3100, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Dario/Unicambios' },
  { pais: 'Chile', codigo: 'CLP', moneda: 'Peso chileno', tasaEnvio: 900, margenEnvio: 5, tasaRecibo: 1020, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Jesus Rico enviar / Mauro C recibir' },
  { pais: 'Perú', codigo: 'PEN', moneda: 'Sol', tasaEnvio: 3.34, margenEnvio: 3, tasaRecibo: 3.5, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Enviar Solano/ Nataly L Recibir' },
  { pais: 'Argentina', codigo: 'ARS', moneda: 'Peso argentino', tasaEnvio: 1498, margenEnvio: 3, tasaRecibo: 1690, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Mauro C' },
  { pais: 'Brasil', codigo: 'BRL', moneda: 'Real brasileño', tasaEnvio: 5.1, margenEnvio: 3, tasaRecibo: 5.36, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Enviar Ricardo miguelacho/Mauro C Recibir' },
  { pais: 'México', codigo: 'MXN', moneda: 'Peso mexicano', tasaEnvio: 16.3, margenEnvio: 3, tasaRecibo: 18.8, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Enviar Unicambios/Miguelacho recibir / Mauro C Recibir' },
  { pais: 'Uruguay', codigo: 'UYU', moneda: 'Peso uruguayo', tasaEnvio: 38.66, margenEnvio: 3, tasaRecibo: 44.48, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Mauro C' },
  { pais: 'Paraguay', codigo: 'PYG', moneda: 'Guaraní', tasaEnvio: 5615, margenEnvio: 3, tasaRecibo: 6365, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Mauro C' },
  { pais: 'Costa Rica', codigo: 'CRC', moneda: 'Colón costarricense', tasaEnvio: 409, margenEnvio: 3, tasaRecibo: 521, margenRecibo: 3, margenEnvioMayor: 2, margenReciboMayor: 2, proveedor: 'Mauro C' },
  { pais: 'Bolivia', codigo: 'BOB', moneda: 'Boliviano', tasaEnvio: 10.53, margenEnvio: 3, tasaRecibo: 0, margenRecibo: 0, margenEnvioMayor: 2, margenReciboMayor: 0, proveedor: 'Mauro C' },
  { pais: 'República Dominicana', codigo: 'DOP', moneda: 'Peso dominicano', tasaEnvio: 56.64, margenEnvio: 3, tasaRecibo: 0, margenRecibo: 0, margenEnvioMayor: 2, margenReciboMayor: 0, proveedor: 'Mauro C' },
  { pais: 'Cuba', codigo: 'CUP', moneda: 'Peso cubano', tasaEnvio: 835, margenEnvio: 3, tasaRecibo: 0, margenRecibo: 0, margenEnvioMayor: 2, margenReciboMayor: 0, proveedor: 'Mauro C' },
];

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

  margenEnvio(p: LiveRate, modo: AppMode = 'detal'): number {
    if (
      modo === 'mayor' &&
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

  calcularTasaEnvio(p: LiveRate, modo: AppMode = 'detal'): number {
    const m = this.margenEnvio(p, modo);
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
      const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length < 2) throw new Error('CSV vacio');

      const parseNumber = (val: string | undefined, fallback = 0): number => {
        if (!val) return fallback;
        const cleaned = val.replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? fallback : num;
      };

      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toUpperCase());
      const idxPais = headers.findIndex((h) => h.includes('PAIS'));
      const idxEnvio = headers.findIndex((h) => h.includes('TASA ENVIO'));
      const idxMargenE = headers.findIndex((h) => h === 'MARGEN ENVIO' || h.includes('MARGEN ENV'));
      const idxRecibo = headers.findIndex((h) => h.includes('TASA RECIBO'));
      const idxMargenR = headers.findIndex((h) => h === 'MARGEN RECIBO' || h.includes('MARGEN REC'));
      const idxMargenMayorE = headers.findIndex((h) => h.includes('MARGEN ENV') && h.includes('MAYOR'));
      const idxMargenMayorR = headers.findIndex((h) => h.includes('MARGEN REC') && h.includes('MAYOR'));
      const idxCodigo = headers.findIndex((h) => h.includes('CODIGO') || h.includes('BANCO'));
      const idxMoneda = headers.findIndex((h) => h.includes('NOMBRE') || h.includes('MONEDA'));
      const idxProv = headers.findIndex((h) => h.includes('PROVEEDOR'));
      const idxEUR = headers.findIndex((h) => h.includes('FACTOR EUR') || h.includes('VALOR EUR'));
      const idxUSDT = headers.findIndex((h) => h.includes('FACTOR USDT') || h.includes('VALOR USDT'));

      const parsedRates: LiveRate[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
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

        const pIdx = idxPais >= 0 ? idxPais : 0;
        if (!row[pIdx]) continue;
        const paisName = row[pIdx];
        const codigo = (idxCodigo >= 0 && row[idxCodigo] ? row[idxCodigo] : paisName).toUpperCase() as Currency;

        const tasaEnvio = parseNumber(row[idxEnvio]);
        const margenEnvio = parseNumber(row[idxMargenE], 3);
        const tasaRecibo = parseNumber(row[idxRecibo]);
        const margenRecibo = parseNumber(row[idxMargenR], 3);
        const margenEnvioMayor = parseNumber(row[idxMargenMayorE], 2);
        const margenReciboMayor = parseNumber(row[idxMargenMayorR], 2);
        const proveedor = idxProv >= 0 && row[idxProv] ? row[idxProv] : 'General';
        const moneda = idxMoneda >= 0 && row[idxMoneda] ? row[idxMoneda] : paisName;
        const factorEUR = idxEUR >= 0 ? parseNumber(row[idxEUR]) : 0;
        const factorUSDT = idxUSDT >= 0 ? parseNumber(row[idxUSDT]) : 0;

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
          proveedor,
          factorEUR,
          factorUSDT,
        });
      }

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

  getRateInfo(
    currency: string,
    mode: AppMode = 'detal'
  ): {
    buyPrice: number;
    sellPrice: number;
    costRate: number;
    sellRate: number;
    proveedor: string;
    provider: string;
    margenPercent: number;
    marginPercentage: number;
  } {
    const rates = this.getCachedRates();
    const cleanCurr = currency.toUpperCase();

    const found = rates.find(
      (r) =>
        r.codigo.toUpperCase() === cleanCurr ||
        r.pais.toUpperCase().includes(cleanCurr) ||
        (cleanCurr === 'USDT' && r.pais.toUpperCase().includes('USDT')) ||
        (cleanCurr === 'VES' && (r.pais.toUpperCase().includes('VENEZUELA') || r.codigo === 'VES')) ||
        (cleanCurr === 'COP' && (r.pais.toUpperCase().includes('COLOMBIA') || r.codigo === 'COP')) ||
        (cleanCurr === 'EUR' && (r.pais.toUpperCase().includes('EURO') || r.codigo === 'EUR')) ||
        (cleanCurr === 'PEN' && (r.pais.toUpperCase().includes('PERU') || r.codigo === 'PEN')) ||
        (cleanCurr === 'CLP' && (r.pais.toUpperCase().includes('CHILE') || r.codigo === 'CLP')) ||
        (cleanCurr === 'BRL' && (r.pais.toUpperCase().includes('BRASIL') || r.codigo === 'BRL')) ||
        (cleanCurr === 'ARS' && (r.pais.toUpperCase().includes('ARGENTINA') || r.codigo === 'ARS'))
    );

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
      };
    }

    const costRate = found.tasaEnvio > 0 ? found.tasaEnvio : 1;
    const margen = this.margenEnvio(found, mode);

    let sellRate = this.calcularTasaEnvio(found, mode);
    sellRate = Number(sellRate.toFixed(4));

    return {
      buyPrice: costRate,
      sellPrice: sellRate,
      costRate: costRate,
      sellRate: sellRate,
      proveedor: found.proveedor || 'General',
      provider: found.proveedor || 'General',
      margenPercent: margen,
      marginPercentage: margen,
    };
  },
};
