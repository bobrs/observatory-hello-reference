import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { payloadFiles, readRegular, verifyPackage } from '../app/identity.mjs';

function expectedDigest(value) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error('Supply an independently pinned expected artifact ID (sha256: followed by 64 lowercase hex digits).');
  }
  return value;
}

export function verifyTransport(directory, expectedArtifactId) {
  const checked = verifyPackage(directory, expectedDigest(expectedArtifactId));
  return { version: checked.release.version, artifactId: checked.artifactId };
}

export function exportTransport(source, destination, expectedArtifactId) {
  const expected = expectedDigest(expectedArtifactId);
  const checked = verifyPackage(source, expected);
  const sidecar = readRegular(join(source, 'artifact.json'));
  // mkdir is exclusive: never modify or remove an existing destination.
  mkdirSync(destination);
  try {
    for (const name of payloadFiles) writeFileSync(join(destination, name), checked.bytes[name], { flag: 'wx', mode: 0o600 });
    writeFileSync(join(destination, 'artifact.json'), sidecar, { flag: 'wx', mode: 0o600 });
    return verifyTransport(destination, expected);
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'verify' && args.length === 2) console.log(JSON.stringify(verifyTransport(args[0], args[1])));
  else if (command === 'export' && args.length === 3) console.log(JSON.stringify(exportTransport(args[0], args[1], args[2])));
  else throw new Error('Usage: node scripts/transport.mjs verify <directory> <expected-artifact-id> | export <source-directory> <new-destination-directory> <expected-artifact-id>');
}
