import { describe, it, expect } from 'vitest';
import { parseRatesCsv, RatesService } from '@/lib/rates-service';

const SAMPLE_SHEET_CSV = `Pais,Tasa Envio,Margen Envio,Tasa Recibo,Margen Recibo,Factor EUR,ISO Bandera,Código Banco,Nombre Moneda,Margen Envio Mayor,Margen Recibo Mayor,Ciudades,Proveedor,Monto Minimo,Margen Envío VIP,Comisión VIP,Margen Mayor X RST,Margen Mayor 1000
Colombia,3440,6,3465,6,,CO,COP,Peso colombiano,4,4,,Dario/Unicambios,20,,,,
Venezuela,1067,10,1090,6,,VE,VES,Bolívar Digital,5.5,5,,Jesus Rico,20,8,1,4.5,4
Europa,1,20,1,15,,EU,EUR,Euro,17,1,,Camacaro,100,,,,
USDT,1,5,1,5,,US,USDT,TetherUS,4.5,3.5,,Ronal/Gocho,50,,,3,
Efectivo Venezuela-Merida,1,10,1,6,,VE,USD,Dólar estadounidense,7,5,"Merida, Ejido",YO,50,,,,`;

describe('RatesService - parsing y cálculo de nuevas columnas de Google Sheets', () => {
  const rates = parseRatesCsv(SAMPLE_SHEET_CSV);

  it('parsea correctamente todas las 18 columnas incluyendo tildes y celdas vacías como null', () => {
    expect(rates).toHaveLength(5);

    const ve = rates.find((r) => r.codigo === 'VES');
    expect(ve).toBeDefined();
    expect(ve?.tasaEnvio).toBe(1067);
    expect(ve?.margenEnvio).toBe(10);
    expect(ve?.margenEnvioMayor).toBe(5.5);
    expect(ve?.margenEnvioVIP).toBe(8);
    expect(ve?.comisionVIP).toBe(1);
    expect(ve?.margenMayorRST).toBe(4.5);
    expect(ve?.margenMayorVolumen).toBe(4);
    expect(ve?.montoMinimo).toBe(20);

    const co = rates.find((r) => r.codigo === 'COP');
    expect(co).toBeDefined();
    expect(co?.margenEnvioVIP).toBeNull();
    expect(co?.comisionVIP).toBeNull();
    expect(co?.margenMayorRST).toBeNull();
    expect(co?.margenMayorVolumen).toBeNull();

    const usdt = rates.find((r) => r.codigo === 'USDT');
    expect(usdt).toBeDefined();
    expect(usdt?.margenEnvio).toBe(5);
    expect(usdt?.margenEnvioMayor).toBe(4.5);
    expect(usdt?.margenMayorRST).toBe(3);
    expect(usdt?.margenEnvioVIP).toBeNull();
    expect(usdt?.margenMayorVolumen).toBeNull();

    const ef = rates.find((r) => r.pais === 'Efectivo Venezuela-Merida');
    expect(ef?.ciudades).toBe('Merida, Ejido');
  });

  it('calcula exactamente las tasas de Venezuela para Detal, VIP, Mayor, Mayor X RST y Mayor $1,000+', () => {
    const detal = RatesService.getRateInfo('VES', 'detal', 'normal', rates);
    expect(detal.costRate).toBe(1067);
    expect(detal.sellRate).toBe(960.3);
    expect(detal.hasVip).toBe(true);
    expect(detal.vipRate).toBe(981.64);
    expect(detal.vipFee).toBe(1);
    expect(detal.hasMayorRst).toBe(true);
    expect(detal.mayorRstRate).toBe(1018.985);
    expect(detal.hasMayorVolumen).toBe(true);
    expect(detal.mayorVolumenRate).toBe(1024.32);

    const vip = RatesService.getRateInfo('VES', 'detal', 'vip', rates);
    expect(vip.sellRate).toBe(981.64);
    expect(vip.margenPercent).toBe(8);

    const mayor = RatesService.getRateInfo('VES', 'mayor', 'normal', rates);
    expect(mayor.sellRate).toBe(1008.315);
    expect(mayor.margenPercent).toBe(5.5);

    const mayorRst = RatesService.getRateInfo('VES', 'mayor', 'mayor_rst', rates);
    expect(mayorRst.sellRate).toBe(1018.985);
    expect(mayorRst.margenPercent).toBe(4.5);

    const mayor1000 = RatesService.getRateInfo('VES', 'mayor', 'mayor_volumen', rates);
    expect(mayor1000.sellRate).toBe(1024.32);
    expect(mayor1000.margenPercent).toBe(4);
  });

  it('calcula correctamente USDT (Caja Dólar) con Detal, Mayor y Mayor X RST', () => {
    const detal = RatesService.getRateInfo('USDT', 'detal', 'normal', rates);
    expect(detal.sellRate).toBe(0.95);
    expect(detal.hasVip).toBe(false);
    expect(detal.hasMayorRst).toBe(true);
    expect(detal.hasMayorVolumen).toBe(false);

    const mayor = RatesService.getRateInfo('USDT', 'mayor', 'normal', rates);
    expect(mayor.sellRate).toBe(0.955);

    const mayorRst = RatesService.getRateInfo('USDT', 'mayor', 'mayor_rst', rates);
    expect(mayorRst.sellRate).toBe(0.97);
    expect(mayorRst.margenPercent).toBe(3);
  });

  it('no habilita niveles opcionales en monedas que tienen esas columnas vacías (Colombia)', () => {
    const co = RatesService.getRateInfo('COP', 'mayor', 'normal', rates);
    expect(co.hasVip).toBe(false);
    expect(co.hasMayorRst).toBe(false);
    expect(co.hasMayorVolumen).toBe(false);
    expect(co.sellRate).toBe(3302.4);
  });
});
