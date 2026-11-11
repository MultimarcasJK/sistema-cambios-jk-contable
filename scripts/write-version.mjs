// Se corre después de "next build": deja out/version.json con la versión publicada.
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildVersion } from './version.mjs';

mkdirSync('out', { recursive: true });
const version = buildVersion();
writeFileSync('out/version.json', JSON.stringify({ version }) + '\n');
console.log('version.json:', version);
