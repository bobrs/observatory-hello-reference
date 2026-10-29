import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, linkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPackages } from '../scripts/package.mjs';
import { exportTransport, verifyTransport } from '../scripts/transport.mjs';
import { describe } from '../app/identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const expected = JSON.parse(readFileSync(new URL('../evidence/step-a/artifact-index.json', import.meta.url)));
function fixture(t) {
  const base = join(root, 'test-results');
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'transport-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const index = buildPackages(join(directory, 'built'));
  return { directory, index, source: (item) => join(directory, 'built', item.directory) };
}

test('accepted identities survive export and an independent copied workspace verification', (t) => {
  const { directory, index, source } = fixture(t);
  assert.deepEqual(index.artifacts, expected.artifacts);
  for (const entry of expected.artifacts) {
    const exported = join(directory, `export-${entry.version}`);
    const received = join(directory, `received-${entry.version}`);
    assert.deepEqual(exportTransport(source(entry), exported, entry.artifactId), { version: entry.version, artifactId: entry.artifactId });
    cpSync(exported, received, { recursive: true });
    assert.deepEqual(verifyTransport(received, entry.artifactId), { version: entry.version, artifactId: entry.artifactId });
    assert.throws(() => verifyTransport(received, expected.artifacts.find((other) => other.version !== entry.version).artifactId), /external expected identity/);
  }
});

test('transport rejects changed, missing, extra, linked and self-consistently altered files', (t) => {
  const { directory, source } = fixture(t);
  const entry = expected.artifacts[0];
  const copy = (name) => { const path = join(directory, name); cpSync(source(entry), path, { recursive: true }); return path; };
  const changed = copy('changed');
  writeFileSync(join(changed, 'style.css'), 'changed');
  assert.throws(() => verifyTransport(changed, entry.artifactId), /do not match/);
  const revised = describe(changed);
  writeFileSync(join(changed, 'artifact.json'), JSON.stringify({ ...revised.manifest, artifactId: revised.artifactId }) + '\n');
  assert.throws(() => verifyTransport(changed, entry.artifactId), /external expected identity/);
  const missing = copy('missing'); unlinkSync(join(missing, 'page.html'));
  assert.throws(() => verifyTransport(missing, entry.artifactId), /membership/);
  const extra = copy('extra'); writeFileSync(join(extra, 'extra'), 'extra');
  assert.throws(() => verifyTransport(extra, entry.artifactId), /membership/);
  const symlinked = copy('symlinked'); unlinkSync(join(symlinked, 'page.html')); symlinkSync(join(source(entry), 'page.html'), join(symlinked, 'page.html'));
  assert.throws(() => verifyTransport(symlinked, entry.artifactId), /regular files/);
  const hardlinked = copy('hardlinked'); unlinkSync(join(hardlinked, 'page.html')); linkSync(join(source(entry), 'page.html'), join(hardlinked, 'page.html'));
  assert.throws(() => verifyTransport(hardlinked, entry.artifactId), /regular files/);
  unlinkSync(join(hardlinked, 'page.html'));
  assert.throws(() => exportTransport(changed, join(directory, 'rejected'), entry.artifactId), /external expected identity/);
  assert.throws(() => verifyTransport(source(entry)), /independently pinned/);
  assert.throws(() => exportTransport(source(entry), join(directory, 'bad'), entry.version), /independently pinned/);
  assert.throws(() => exportTransport(source(entry), source(entry), entry.artifactId), /EEXIST/);
});

test('command line verifies a copied package with an explicit digest', (t) => {
  const { directory, source } = fixture(t);
  const entry = expected.artifacts[2];
  const exported = join(directory, 'cli-export');
  const received = join(directory, 'cli-received');
  const cli = join(root, 'scripts', 'transport.mjs');
  const invoke = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(JSON.parse(invoke('export', source(entry), exported, entry.artifactId)).artifactId, entry.artifactId);
  cpSync(exported, received, { recursive: true });
  assert.equal(JSON.parse(invoke('verify', received, entry.artifactId)).version, entry.version);
  assert.throws(() => invoke('verify', received, entry.version));
});
