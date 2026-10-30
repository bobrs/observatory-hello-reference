import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationId, payloadFiles, readRegular, verifyPackage, versions } from '../app/identity.mjs';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const evidenceIndexPath = join(projectRoot, 'evidence/step-a/artifact-index.json');
const sourceIndexPath = join(projectRoot, 'artifacts/index.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function readJson(path, label) {
  try { return JSON.parse(readRegular(path).toString('utf8')); }
  catch (error) { throw new Error(`Cannot read valid ${label}: ${error.message}`); }
}

function checkedIndex(index, label) {
  if (!index || index.schemaVersion !== 1 || index.applicationId !== applicationId
    || !Array.isArray(index.artifacts) || index.artifacts.length !== versions.length) {
    throw new Error(`${label} has an unsupported shape.`);
  }
  for (let i = 0; i < versions.length; i++) {
    const item = index.artifacts[i];
    if (!item || item.version !== versions[i] || item.artifactId !== `sha256:${item.directory}`
      || !/^[a-f0-9]{64}$/.test(item.directory)) throw new Error(`${label} does not contain the three fixed releases in order.`);
  }
  return index;
}

function verifyInputs({ buildIndexPath = sourceIndexPath, artifactsPath = join(projectRoot, 'artifacts'), pinsPath = evidenceIndexPath } = {}) {
  const artifactsStat = lstatSync(artifactsPath, { throwIfNoEntry: false });
  if (!artifactsStat || !artifactsStat.isDirectory() || artifactsStat.isSymbolicLink()) throw new Error('Build artifacts must be in an existing regular directory, not a link.');
  const pins = checkedIndex(readJson(pinsPath, 'committed evidence index'), 'Committed evidence index');
  const built = checkedIndex(readJson(buildIndexPath, 'build index'), 'Build index');
  if (!/^[a-f0-9]{40}$/.test(built.sourceRevision) || typeof built.sourceDirty !== 'boolean') {
    throw new Error('Build index lacks valid source provenance.');
  }
  const checked = [];
  for (let i = 0; i < versions.length; i++) {
    const pin = pins.artifacts[i];
    const entry = built.artifacts[i];
    if (entry.version !== pin.version || entry.artifactId !== pin.artifactId || entry.directory !== pin.directory) {
      throw new Error(`Built ${pin.version} identity does not match the committed evidence pin.`);
    }
    const source = join(artifactsPath, entry.directory);
    const verified = verifyPackage(source, pin.artifactId);
    if (verified.release.version !== pin.version) throw new Error(`Built package version does not match the ${pin.version} evidence pin.`);
    const sidecar = readRegular(join(source, 'artifact.json'));
    const canonicalSidecar = `${JSON.stringify({ ...verified.manifest, artifactId: verified.artifactId })}\n`;
    if (!sidecar.equals(Buffer.from(canonicalSidecar))) throw new Error(`Built ${pin.version} sidecar changed during verification.`);
    checked.push({ pin, verified, sidecar });
  }
  return { built, checked };
}

export function exportRetained(destination, inputs) {
  if (typeof destination !== 'string' || destination.length === 0) throw new Error('Supply a new output directory path.');
  const output = resolve(destination);
  // Do not follow or replace an existing destination, including a dangling symlink.
  if (lstatSync(output, { throwIfNoEntry: false })) throw new Error('Output directory already exists; choose a new path.');

  // Verify every package and every pin before creating any output path.
  const { built, checked } = verifyInputs(inputs);
  const parent = dirname(output);
  const parentStat = lstatSync(parent, { throwIfNoEntry: false });
  if (!parentStat || !parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('Output parent must be an existing regular directory, not a link.');

  mkdirSync(output); // exclusive; a destination created after preflight is refused
  try {
    const files = [];
    const artifacts = [];
    for (const { pin, verified, sidecar } of checked) {
      const relativeDirectory = `packages/${pin.version}`;
      mkdirSync(join(output, relativeDirectory), { recursive: true });
      const packageFiles = [...payloadFiles, 'artifact.json'];
      for (const name of packageFiles) {
        const bytes = name === 'artifact.json' ? sidecar : verified.bytes[name];
        const relativePath = `${relativeDirectory}/${name}`;
        writeFileSync(join(output, relativePath), bytes, { flag: 'wx', mode: 0o600 });
        files.push({ path: relativePath, size: bytes.length, sha256: sha256(bytes) });
      }
      artifacts.push({ version: pin.version, artifactId: pin.artifactId, path: relativeDirectory });
    }
    const index = {
      schemaVersion: 1,
      applicationId,
      custody: 'reconstructed-from-reviewed-source',
      source: {
        sourceRevision: built.sourceRevision,
        sourceDirty: built.sourceDirty,
        buildIndex: 'artifacts/index.json',
        evidencePins: 'evidence/step-a/artifact-index.json',
      },
      artifacts,
      files,
    };
    writeFileSync(join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    // Confirm the finished tree contains exactly the six declared files per release plus its index.
    const expectedPaths = new Set(['index.json', ...files.map((file) => file.path)]);
    const actualPaths = [];
    for (const entry of artifacts) {
      for (const name of readdirSync(join(output, entry.path))) actualPaths.push(`${entry.path}/${name}`);
    }
    if (actualPaths.length !== expectedPaths.size - 1 || actualPaths.some((path) => !expectedPaths.has(path))) {
      throw new Error('Export output membership differs from its digest index.');
    }
    return index;
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: npm run export:retained -- <new-output-directory>');
  console.log(JSON.stringify(exportRetained(process.argv[2]), null, 2));
}
