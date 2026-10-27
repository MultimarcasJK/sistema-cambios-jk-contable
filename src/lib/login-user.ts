// Inicio de sesión con nombre de usuario: Supabase solo acepta correos, así que
// "maria" se completa como "maria@cambiosjk.com". Un correo completo se deja igual.
export const LOGIN_DOMAIN = 'cambiosjk.com';

export function loginEmail(input: string): string {
  const v = (input || '').trim().toLowerCase();
  if (!v || v.includes('@')) return v;
  return `${v.replace(/\s+/g, '')}@${LOGIN_DOMAIN}`;
}
