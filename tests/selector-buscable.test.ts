import React from 'react';
import { describe, expect, it } from 'vitest';
import { filterOptions, parseOptions } from '@/lib/searchable-options';

const h = React.createElement;

describe('selector de cuentas buscable', () => {
  const children = [
    h('option', { key: 'x', value: 'POR_COBRAR' }, '🔴 POR COBRAR (Pendiente / Crédito)'),
    h(
      'optgroup',
      { key: 'g', label: 'Cuentas Bancarias' },
      [
        h('option', { key: 'a', value: 'a1' }, 'Banesco Kelvin', ' (', 'VES', ')'),
        h('option', { key: 'b', value: 'b1' }, 'Zelle Bolívar', ' (', 'USD', ')'),
      ]
    ),
    false,
    null,
  ];

  it('lee option y optgroup como un select normal', () => {
    const opts = parseOptions(children);
    expect(opts).toEqual([
      { value: 'POR_COBRAR', label: '🔴 POR COBRAR (Pendiente / Crédito)', group: undefined, disabled: false },
      { value: 'a1', label: 'Banesco Kelvin (VES)', group: 'Cuentas Bancarias', disabled: false },
      { value: 'b1', label: 'Zelle Bolívar (USD)', group: 'Cuentas Bancarias', disabled: false },
    ]);
  });

  it('filtra al escribir, sin importar mayúsculas ni acentos', () => {
    const opts = parseOptions(children);
    expect(filterOptions(opts, 'banesco').map((o) => o.value)).toEqual(['a1']);
    expect(filterOptions(opts, 'bolivar usd').map((o) => o.value)).toEqual(['b1']);
    expect(filterOptions(opts, 'por cobrar').map((o) => o.value)).toEqual(['POR_COBRAR']);
    expect(filterOptions(opts, '').length).toBe(3);
    expect(filterOptions(opts, 'nada')).toEqual([]);
  });
});
