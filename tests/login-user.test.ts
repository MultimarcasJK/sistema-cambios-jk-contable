import { describe, expect, it } from 'vitest';
import { loginEmail } from '@/lib/login-user';

describe('inicio de sesión con usuario', () => {
  it('completa el usuario con el dominio de la casa', () => {
    expect(loginEmail('maria')).toBe('maria@cambiosjk.com');
    expect(loginEmail('  Maria ')).toBe('maria@cambiosjk.com');
  });
  it('un correo completo se deja igual', () => {
    expect(loginEmail('Kelvin.17krak@gmail.com')).toBe('kelvin.17krak@gmail.com');
  });
});
