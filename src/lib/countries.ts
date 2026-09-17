import { Account, Currency } from '@/types';

export interface CountryInfo {
  id: string;
  name: string;
  flag: string;
  iso2: string;
  defaultCurrency: Currency;
  currencies: Currency[];
  description: string;
}

export const COUNTRIES_LIST: CountryInfo[] = [
  {
    id: 'ECUADOR',
    name: 'Ecuador',
    flag: '🇪🇨',
    iso2: 'ec',
    defaultCurrency: 'USD',
    currencies: ['USD'],
    description: 'Pichincha, Guayaquil, Produbanco, JEP, Efectivo',
  },
  {
    id: 'VENEZUELA',
    name: 'Venezuela',
    flag: '🇻🇪',
    iso2: 've',
    defaultCurrency: 'VES',
    currencies: ['VES'],
    description: 'Banesco, Banco de Venezuela, Mercantil, Pago Móvil',
  },
  {
    id: 'COLOMBIA',
    name: 'Colombia',
    flag: '🇨🇴',
    iso2: 'co',
    defaultCurrency: 'COP',
    currencies: ['COP'],
    description: 'Bancolombia, Nequi, Daviplata, Davivienda',
  },
  {
    id: 'PERU',
    name: 'Perú',
    flag: '🇵🇪',
    iso2: 'pe',
    defaultCurrency: 'PEN',
    currencies: ['PEN'],
    description: 'BCP, Interbank, BBVA Perú, Yape, Plin',
  },
  {
    id: 'CHILE',
    name: 'Chile',
    flag: '🇨🇱',
    iso2: 'cl',
    defaultCurrency: 'CLP',
    currencies: ['CLP'],
    description: 'BancoEstado, CuentaRUT, Santander, BCI',
  },
  {
    id: 'ARGENTINA',
    name: 'Argentina',
    flag: '🇦🇷',
    iso2: 'ar',
    defaultCurrency: 'ARS',
    currencies: ['ARS'],
    description: 'MercadoPago, Brubank, Galicia, Macro',
  },
  {
    id: 'BRASIL',
    name: 'Brasil',
    flag: '🇧🇷',
    iso2: 'br',
    defaultCurrency: 'BRL',
    currencies: ['BRL'],
    description: 'Pix, Nubank, Itaú, Bradesco',
  },
  {
    id: 'MEXICO',
    name: 'México',
    flag: '🇲🇽',
    iso2: 'mx',
    defaultCurrency: 'MXN',
    currencies: ['MXN'],
    description: 'BBVA México, STP, OXXO, Banorte',
  },
  {
    id: 'EUROPA',
    name: 'Europa / España',
    flag: '🇪🇺',
    iso2: 'eu',
    defaultCurrency: 'EUR',
    currencies: ['EUR'],
    description: 'Bizum, SEPA, BBVA España, Santander, Revolut',
  },
  {
    id: 'USA',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    iso2: 'us',
    defaultCurrency: 'USD',
    currencies: ['USD'],
    description: 'Zelle, Bank of America, Wells Fargo, Chase',
  },
  {
    id: 'CRIPTO',
    name: 'Cripto / Wallets',
    flag: '🌐',
    iso2: '',
    defaultCurrency: 'USDT',
    currencies: ['USDT'],
    description: 'Binance, Tron, Trust Wallet, MetaMask',
  },
  {
    id: 'PANAMA',
    name: 'Panamá',
    flag: '🇵🇦',
    iso2: 'pa',
    defaultCurrency: 'USD',
    currencies: ['USD'],
    description: 'Banesco Panamá, BAC Credomatic, Banco General',
  },
  {
    id: 'DOMINICANA',
    name: 'Rep. Dominicana',
    flag: '🇩🇴',
    iso2: 'do',
    defaultCurrency: 'DOP',
    currencies: ['DOP'],
    description: 'Banreservas, Banco Popular, BHD',
  },
  {
    id: 'BOLIVIA',
    name: 'Bolivia',
    flag: '🇧🇴',
    iso2: 'bo',
    defaultCurrency: 'BOB',
    currencies: ['BOB'],
    description: 'Banco Unión, BNB, Mercantil Santa Cruz',
  },
  {
    id: 'PARAGUAY',
    name: 'Paraguay',
    flag: '🇵🇾',
    iso2: 'py',
    defaultCurrency: 'PYG',
    currencies: ['PYG'],
    description: 'Banco Basa, Continental, Tigo Money',
  },
  {
    id: 'URUGUAY',
    name: 'Uruguay',
    flag: '🇺🇾',
    iso2: 'uy',
    defaultCurrency: 'UYU',
    currencies: ['UYU'],
    description: 'BROU, Prex Uruguay, Itaú',
  },
  {
    id: 'COSTA_RICA',
    name: 'Costa Rica',
    flag: '🇨🇷',
    iso2: 'cr',
    defaultCurrency: 'CRC',
    currencies: ['CRC'],
    description: 'BAC San José, Banco Nacional, BCR',
  },
  {
    id: 'GUATEMALA',
    name: 'Guatemala',
    flag: '🇬🇹',
    iso2: 'gt',
    defaultCurrency: 'GTQ',
    currencies: ['GTQ'],
    description: 'Banrural, Banco Industrial, G&T',
  },
  {
    id: 'HONDURAS',
    name: 'Honduras',
    flag: '🇭🇳',
    iso2: 'hn',
    defaultCurrency: 'HNL',
    currencies: ['HNL'],
    description: 'Banco Atlántida, Ficohsa, Banpaís',
  },
  {
    id: 'NICARAGUA',
    name: 'Nicaragua',
    flag: '🇳🇮',
    iso2: 'ni',
    defaultCurrency: 'NIO',
    currencies: ['NIO'],
    description: 'Banpro, BAC Nicaragua, Lafise',
  },
  {
    id: 'CANADA',
    name: 'Canadá',
    flag: '🇨🇦',
    iso2: 'ca',
    defaultCurrency: 'CAD',
    currencies: ['CAD'],
    description: 'Interac e-Transfer, RBC, TD Canada',
  },
  {
    id: 'UK',
    name: 'Reino Unido',
    flag: '🇬🇧',
    iso2: 'gb',
    defaultCurrency: 'GBP',
    currencies: ['GBP'],
    description: 'Faster Payments, Wise, Barclays, Revolut',
  },
];

/**
 * Determina el país al que pertenece una cuenta según sus metadatos y palabras clave.
 */
export function getAccountCountry(account: Account): string {
  // 1. Si la cuenta ya tiene country explícito guardado
  if ((account as any).country) {
    return (account as any).country;
  }

  const nameUpper = (account.name + ' ' + (account.bank_name || '')).toUpperCase();

  // 2. Cripto / Wallets
  if (
    account.currency === 'USDT' ||
    account.type === 'wallet' ||
    nameUpper.includes('BINANCE') ||
    nameUpper.includes('TRON') ||
    nameUpper.includes('WALLET')
  ) {
    return 'CRIPTO';
  }

  // 3. Venezuela
  if (
    account.currency === 'VES' ||
    nameUpper.includes('BANESCO') ||
    nameUpper.includes('VENEZUELA') ||
    nameUpper.includes('PAGO MOVIL') ||
    nameUpper.includes('MERCANTIL')
  ) {
    return 'VENEZUELA';
  }

  // 4. Colombia
  if (
    account.currency === 'COP' ||
    nameUpper.includes('BANCOLOMBIA') ||
    nameUpper.includes('NEQUI') ||
    nameUpper.includes('DAVIPLATA')
  ) {
    return 'COLOMBIA';
  }

  // 5. Perú
  if (account.currency === 'PEN' || nameUpper.includes('YAPE') || nameUpper.includes('BCP')) {
    return 'PERU';
  }

  // 6. Chile
  if (account.currency === 'CLP' || nameUpper.includes('BANCOESTADO') || nameUpper.includes('CUENTARUT')) {
    return 'CHILE';
  }

  // 7. Argentina
  if (account.currency === 'ARS' || nameUpper.includes('MERCADOPAGO') || nameUpper.includes('BRUBANK')) {
    return 'ARGENTINA';
  }

  // 8. Brasil
  if (account.currency === 'BRL' || nameUpper.includes('PIX') || nameUpper.includes('NUBANK')) {
    return 'BRASIL';
  }

  // 9. México
  if (account.currency === 'MXN' || nameUpper.includes('STP') || nameUpper.includes('OXXO')) {
    return 'MEXICO';
  }

  // 10. Europa
  if (account.currency === 'EUR' || nameUpper.includes('BIZUM') || nameUpper.includes('SEPA')) {
    return 'EUROPA';
  }

  // 11. Estados Unidos (Zelle / bancos USA)
  if (
    account.type === 'zelle' ||
    nameUpper.includes('ZELLE') ||
    nameUpper.includes('BOFA') ||
    nameUpper.includes('WELLS') ||
    nameUpper.includes('CHASE')
  ) {
    return 'USA';
  }

  // 12. Panamá
  if (nameUpper.includes('PANAMA') || nameUpper.includes('PANAMÁ')) {
    return 'PANAMA';
  }

  // Por moneda directa
  if (account.currency === 'BOB') return 'BOLIVIA';
  if (account.currency === 'PYG') return 'PARAGUAY';
  if (account.currency === 'UYU') return 'URUGUAY';
  if (account.currency === 'CRC') return 'COSTA_RICA';
  if (account.currency === 'GTQ') return 'GUATEMALA';
  if (account.currency === 'HNL') return 'HONDURAS';
  if (account.currency === 'NIO') return 'NICARAGUA';
  if (account.currency === 'CAD') return 'CANADA';
  if (account.currency === 'GBP') return 'UK';
  if (account.currency === 'DOP') return 'DOMINICANA';

  // Si es USD o efectivo y no coincidió con USA/Panamá, corresponde a Ecuador
  if (account.currency === 'USD' || account.type === 'efectivo') {
    return 'ECUADOR';
  }

  return 'ECUADOR';
}
