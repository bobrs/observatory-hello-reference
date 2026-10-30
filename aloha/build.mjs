import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, payloadFiles, verifyPackage } from './identity.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.argv[2] ?? join(root, 'artifacts'));
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
if (release.applicationId !== 'observatory-aloha-reference' || release.version !== '1.0.0') throw new Error('Unexpected baked Aloha identity.');
mkdirSync(output, { recursive: true });
const staging = mkdtempSync(join(output, '.aloha-package-'));
try {
  for (const name of payloadFiles) cpSync(join(root, name), join(staging, name));
  writeFileSync(join(staging, 'artifact.json'), '{}\n', { flag: 'wx' });
  const { manifest, artifactId } = describe(staging);
  writeFileSync(join(staging, 'artifact.json'), `${JSON.stringify({ ...manifest, artifactId })}\n`);
  verifyPackage(staging, artifactId);
  const id = artifactId.slice(7);
  const destination = join(output, id);
  if (existsSync(destination)) verifyPackage(destination, artifactId);
  else renameSync(staging, destination);
  const index = { schemaVersion: 1, applicationId: release.applicationId, artifacts: [{ version: release.version, artifactId, directory: id }] };
  writeFileSync(join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(JSON.stringify({ version: release.version, artifactId, directory: destination }));
} finally {
  rmSync(staging, { recursive: true, force: true });
}
