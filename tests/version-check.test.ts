import { describe, expect, it } from 'vitest';
import { hayVersionNueva, versionPublicada } from '../src/lib/version-check';

describe('aviso de versión nueva', () => {
  it('lee la versión de version.json', () => {
    expect(versionPublicada({ version: 'e82ac36' })).toBe('e82ac36');
    expect(versionPublicada({ version: '' })).toBeNull();
    expect(versionPublicada(null)).toBeNull();
    expect(versionPublicada('<html>')).toBeNull();
  });

  it('avisa solo cuando la publicada es distinta a la cargada', () => {
    expect(hayVersionNueva('1b67195', 'e82ac36')).toBe(true);
    expect(hayVersionNueva('e82ac36', 'e82ac36')).toBe(false);
    expect(hayVersionNueva('e82ac36', null)).toBe(false);
    expect(hayVersionNueva('dev', 'e82ac36')).toBe(false);
  });
});
