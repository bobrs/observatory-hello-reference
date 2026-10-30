import { existsSync, mkdirSync, readFileSync, readdirSync, lstatSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPackage } from './identity.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const [expectedArtifactId, destinationArgument] = process.argv.slice(2);
if (!/^sha256:[a-f0-9]{64}$/.test(expectedArtifactId ?? '') || !destinationArgument) {
  throw new Error('Usage: node aloha/export.mjs sha256:<64 lowercase hex> <new-destination>');
}
const pins = JSON.parse(readFileSync(join(root, 'evidence', 'artifact-index.json'), 'utf8'));
const pin = pins.artifacts.find((entry) => entry.artifactId === expectedArtifactId);
if (!pin) throw new Error('Expected digest is not present in the committed Aloha evidence index.');
const source = join(root, 'artifacts', pin.directory);
verifyPackage(source, expectedArtifactId);
const destination = resolve(destinationArgument);
if (existsSync(destination)) throw new Error('Export destination already exists.');
mkdirSync(destination, { recursive: false });
try {
  for (const name of [...readdirSync(source)].sort()) {
    const stat = lstatSync(join(source, name));
    if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Refusing non-regular package file: ${name}`);
    copyFileSync(join(source, name), join(destination, name), 1);
  }
  verifyPackage(destination, expectedArtifactId);
  console.log(JSON.stringify({ version: pin.version, artifactId: expectedArtifactId, destination }));
} catch (error) {
  // Keep failed export bytes visible for review; never claim it succeeded.
  throw error;
}
