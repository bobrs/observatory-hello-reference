import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPackages } from '../scripts/package.mjs';
import { exportRetained } from '../scripts/export-retained.mjs';
import { payloadFiles, sha256, versions } from '../app/identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidencePath = join(root, 'evidence/step-a/artifact-index.json');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));

function fixture(t) {
  const base = join(root, 'test-results');
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'retained-export-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const builtPath = join(directory, 'artifacts');
  const buildIndex = buildPackages(builtPath);
  const buildIndexPath = join(directory, 'build-index.json');
  writeFileSync(buildIndexPath, JSON.stringify(buildIndex));
  const pinsPath = join(directory, 'evidence-index.json');
  cpSync(evidencePath, pinsPath);
  return {
    directory,
    builtPath,
    buildIndexPath,
    pinsPath,
    inputs: { buildIndexPath, artifactsPath: builtPath, pinsPath },
  };
}

test('exports all fixed releases byte-for-byte with relative digest and reconstruction provenance', (t) => {
  const f = fixture(t);
  const output = join(f.directory, 'retained');
  const index = exportRetained(output, f.inputs);
  assert.equal(index.custody, 'reconstructed-from-reviewed-source');
  assert.equal(index.source.sourceRevision, JSON.parse(readFileSync(f.buildIndexPath)).sourceRevision);
  assert.deepEqual(index.artifacts.map(({ version }) => version), versions);
  assert.equal(index.files.length, versions.length * (payloadFiles.length + 1));
  for (let i = 0; i < versions.length; i++) {
    const source = join(f.builtPath, evidence.artifacts[i].directory);
    const exported = join(output, 'packages', versions[i]);
    for (const name of [...payloadFiles, 'artifact.json']) {
      const sourceBytes = readFileSync(join(source, name));
      const exportedBytes = readFileSync(join(exported, name));
      assert.deepEqual(exportedBytes, sourceBytes, `${versions[i]} ${name} must be byte-identical`);
      const path = `packages/${versions[i]}/${name}`;
      assert.deepEqual(index.files.find((file) => file.path === path), {
        path, size: sourceBytes.length, sha256: sha256(sourceBytes),
      });
    }
    assert.equal(index.artifacts[i].artifactId, evidence.artifacts[i].artifactId);
  }
});

test('tampered package bytes fail verification before output is created', (t) => {
  const f = fixture(t);
  const first = evidence.artifacts[0];
  writeFileSync(join(f.builtPath, first.directory, 'page.html'), 'tampered');
  const output = join(f.directory, 'should-not-exist');
  assert.throws(() => exportRetained(output, f.inputs), /do not match|external expected identity/);
  assert.throws(() => readFileSync(output), { code: 'ENOENT' });
});

test('wrong evidence digest fails before output is created', (t) => {
  const f = fixture(t);
  const wrongPins = JSON.parse(readFileSync(f.pinsPath, 'utf8'));
  wrongPins.artifacts[0] = { ...wrongPins.artifacts[0], artifactId: `sha256:${'0'.repeat(64)}`, directory: '0'.repeat(64) };
  writeFileSync(f.pinsPath, JSON.stringify(wrongPins));
  const output = join(f.directory, 'wrong-pin-output');
  assert.throws(() => exportRetained(output, f.inputs), /does not match the committed evidence pin/);
  assert.throws(() => readFileSync(output), { code: 'ENOENT' });
});

test('refuses an existing directory and an existing symlink destination', (t) => {
  const f = fixture(t);
  const existing = join(f.directory, 'existing');
  mkdirSync(existing);
  const link = join(f.directory, 'link');
  symlinkSync(existing, link);
  assert.throws(() => exportRetained(existing, f.inputs), /already exists/);
  assert.throws(() => exportRetained(link, f.inputs), /already exists/);
});
