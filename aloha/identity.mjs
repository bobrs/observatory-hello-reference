import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const payloadFiles = ['identity.mjs', 'page.html', 'release.json', 'server.mjs', 'style.css'];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readRegular(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Expected a single-link regular file: ${path}`);
  return readFileSync(path);
}

export function describe(directory) {
  const names = readdirSync(directory).sort();
  if (JSON.stringify(names) !== JSON.stringify([...payloadFiles, 'artifact.json'].sort())) {
    throw new Error('Package membership differs from the fixed payload list.');
  }
  const files = payloadFiles.map((path) => {
    const bytes = readRegular(join(directory, path));
    return { path, size: bytes.length, sha256: sha256(bytes) };
  });
  const manifest = { schemaVersion: 1, files };
  const artifactId = `sha256:${sha256(Buffer.from(`${JSON.stringify(manifest)}\n`, 'utf8'))}`;
  return { manifest, artifactId };
}

export function verifyPackage(directory, expectedArtifactId) {
  const actual = describe(directory);
  const sidecar = JSON.parse(readRegular(join(directory, 'artifact.json')).toString('utf8'));
  if (JSON.stringify(sidecar) !== JSON.stringify({ ...actual.manifest, artifactId: actual.artifactId })) {
    throw new Error('Package sidecar or covered bytes do not match.');
  }
  if (expectedArtifactId !== undefined && actual.artifactId !== expectedArtifactId) {
    throw new Error('Package digest differs from the external expected identity.');
  }
  return actual;
}
