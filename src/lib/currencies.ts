import { CurrencyConfig } from '@/types';

export const INITIAL_CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
  { code: 'USDT', name: 'Tether USDT (Cripto)', symbol: '₮', isCrypto: true },
  { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs.' },
  { code: 'COP', name: 'Peso Colombiano', symbol: '$' },
  { code: 'PEN', name: 'Sol Peruano', symbol: 'S/' },
  { code: 'CLP', name: 'Peso Chileno', symbol: '$' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'ARS', name: 'Peso Argentino', symbol: '$' },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs.' },
  { code: 'PYG', name: 'Guaraní Paraguayo', symbol: '₲' },
  { code: 'UYU', name: 'Peso Uruguayo', symbol: '$' },
  { code: 'CRC', name: 'Colón Costarricense', symbol: '₡' },
  { code: 'GTQ', name: 'Quetzal Guatemalteco', symbol: 'Q' },
  { code: 'HNL', name: 'Lempira Hondureña', symbol: 'L' },
  { code: 'NIO', name: 'Córdoba Nicaragüense', symbol: 'C$' },
  { code: 'CUP', name: 'Peso Cubano', symbol: '$' },
];

const STORAGE_KEY = 'cambiosjk_currencies_v1';

export const CurrencyService = {
  getCurrencies(): CurrencyConfig[] {
    if (typeof window === 'undefined') return INITIAL_CURRENCIES;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CURRENCIES));
        return INITIAL_CURRENCIES;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_CURRENCIES;
    }
  },

  addCurrency(currency: CurrencyConfig): void {
    if (typeof window === 'undefined') return;
    const current = this.getCurrencies();
    const cleanCode = currency.code.trim().toUpperCase();
    if (current.some((c) => c.code === cleanCode)) return;

    const updated = [...current, { ...currency, code: cleanCode }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  deleteCurrency(code: string): void {
    if (typeof window === 'undefined') return;
    const current = this.getCurrencies();
    // No permitir borrar USD ni USDT por ser base
    if (code === 'USD' || code === 'USDT') return;
    const updated = current.filter((c) => c.code !== code.toUpperCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  resetDefaults(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CURRENCIES));
  },
};