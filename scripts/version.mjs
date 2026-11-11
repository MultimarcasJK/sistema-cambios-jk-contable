// Versión del sistema: el commit que se publica. La usan next.config.mjs (queda dentro del código)
// y write-version.mjs (queda en out/version.json). Si las dos no coinciden, hay versión nueva.
import { execSync } from 'node:child_process';

export function buildVersion() {
  const sha = process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}
