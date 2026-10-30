import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function build(output) {
  const result = spawnSync(process.execPath, [join(root, 'build.mjs'), output], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Aloha build failed.');
  const built = JSON.parse(result.stdout.trim());
  return { ...built, directory: built.directory };
}
