import React from 'react';

// Opción de un selector buscable, sacada de los <option>/<optgroup> de siempre.
export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

// Convierte el contenido de un <option> (texto, números, arreglos) en un solo texto.
export function nodeToText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (React.isValidElement(node)) return nodeToText((node.props as { children?: React.ReactNode }).children);
  return '';
}

// Lee los hijos de un <select> (option, optgroup, fragmentos, listas) y los aplana.
export function parseOptions(children: React.ReactNode, group?: string): SearchableOption[] {
  const out: SearchableOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: string | number;
      label?: string;
      disabled?: boolean;
      children?: React.ReactNode;
    };
    if (child.type === 'optgroup') {
      out.push(...parseOptions(props.children, props.label));
    } else if (child.type === 'option') {
      const label = nodeToText(props.children).replace(/\s+/g, ' ').trim();
      out.push({
        value: props.value !== undefined ? String(props.value) : label,
        label,
        group,
        disabled: !!props.disabled,
      });
    } else if (child.type === React.Fragment) {
      out.push(...parseOptions(props.children, group));
    }
  });
  return out;
}

// Quita acentos y mayúsculas para comparar ("Bolívar" = "bolivar").
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Filtra por palabras: cada palabra escrita debe aparecer en el nombre de la opción.
export function filterOptions(options: SearchableOption[], query: string): SearchableOption[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((o) => {
    const haystack = normalizeSearch(o.label);
    return words.every((w) => haystack.includes(w));
  });
}
