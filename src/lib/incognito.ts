// Depósitos que llegan a una cuenta antes de saber de qué cliente son: se anotan como abono del
// cliente INCÓGNITO (la cuenta cuadra ese día) y luego se pasan al cliente real.
export const INCOGNITO_NAME = 'INCÓGNITO';

export function isIncognito(name?: string | null): boolean {
  return (
    (name || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toUpperCase() === 'INCOGNITO'
  );
}
