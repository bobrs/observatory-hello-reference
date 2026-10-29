import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const applicationId = 'observatory-hello-reference';
export const versions = ['1.0.0', '1.1.0', '1.2.0'];
export const payloadFiles = ['identity.mjs', 'page.html', 'release.json', 'server.mjs', 'style.css'];
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function readRegular(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 1024 * 1024) throw new Error('Package files must be bounded regular files, not links.');
  return readFileSync(path);
}

export function describe(directory) {
  const names = readdirSync(directory).sort();
  if (JSON.stringify(names) !== JSON.stringify([...payloadFiles, 'artifact.json'].sort())) throw new Error('Package membership differs from the fixed payload list.');
  const bytes = Object.fromEntries(payloadFiles.map((name) => [name, readRegular(join(directory, name))]));
  const files = payloadFiles.map((path) => ({ path, size: bytes[path].length, sha256: sha256(bytes[path]) }));
  const manifest = { schemaVersion: 1, files };
  // UTF-8, JSON.stringify in the property order above, no whitespace, then exactly LF.
  const canonical = JSON.stringify(manifest) + '\n';
  return { manifest, bytes, artifactId: `sha256:${sha256(Buffer.from(canonical, 'utf8'))}` };
}

export function verifyPackage(directory, expectedArtifactId) {
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error('Package directory cannot be a link.');
  const actual = describe(directory);
  const sidecar = JSON.parse(readRegular(join(directory, 'artifact.json')).toString('utf8'));
  if (JSON.stringify(sidecar) !== JSON.stringify({ ...actual.manifest, artifactId: actual.artifactId })) throw new Error('Package sidecar or covered bytes do not match.');
  if (expectedArtifactId !== undefined && actual.artifactId !== expectedArtifactId) throw new Error('Package digest differs from the external expected identity.');
  const release = JSON.parse(actual.bytes['release.json'].toString('utf8'));
  if (release.applicationId !== applicationId || !versions.includes(release.version)
    || typeof release.greeting !== 'string' || release.greeting.length > 120 || !/^#[0-9a-f]{6}$/.test(release.accent)) throw new Error('Unsupported release metadata.');
  return { ...actual, release };
}
