import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPackages } from '../scripts/package.mjs';
import { launchPackage } from '../scripts/launch.mjs';
import { describe, sha256, verifyPackage } from '../app/identity.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hello-reference-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const index = buildPackages(join(root, 'packages'));
  return { root, index, directory: (entry) => join(root, 'packages', entry.directory) };
}

test('three reproducible packages: file membership, canonical identity and source provenance are explicit', (t) => {
  const one = fixture(t);
  const two = fixture(t);
  assert.deepEqual(one.index, two.index);
  assert.deepEqual(one.index.artifacts.map((item) => item.version), ['1.0.0', '1.1.0', '1.2.0']);
  const source = new URL('../', import.meta.url);
  assert.equal(readFileSync(new URL('VERSION', source), 'utf8').trim(), '1.2.0');
  assert.equal(JSON.parse(readFileSync(new URL('package.json', source))).version, '1.2.0');
  assert.equal(JSON.parse(readFileSync(new URL('.site-factory/site-spec.json', source))).version, '1.2.0');
  assert.equal(new Set(one.index.artifacts.map((item) => item.artifactId)).size, 3);
  for (const entry of one.index.artifacts) {
    const checked = verifyPackage(one.directory(entry), entry.artifactId);
    assert.equal(checked.artifactId, `sha256:${sha256(Buffer.from(JSON.stringify(checked.manifest) + '\n'))}`);
    assert.equal(checked.release.version, entry.version);
    assert.equal(readFileSync(join(one.directory(entry), 'artifact.json'), 'utf8'), readFileSync(join(two.directory(entry), 'artifact.json'), 'utf8'));
    assert.deepEqual(Object.keys(checked.bytes), ['identity.mjs', 'page.html', 'release.json', 'server.mjs', 'style.css']);
  }
});

test('covered-byte tampering, missing/extra files and linked files are refused', (t) => {
  const { root, index, directory } = fixture(t);
  const original = directory(index.artifacts[0]);
  const changed = join(root, 'changed');
  cpSync(original, changed, { recursive: true });
  writeFileSync(join(changed, 'style.css'), 'tampered');
  assert.throws(() => verifyPackage(changed, index.artifacts[0].artifactId), /do not match/);
  const extra = join(root, 'extra');
  cpSync(original, extra, { recursive: true });
  writeFileSync(join(extra, 'unexpected.mjs'), 'not allowed');
  assert.throws(() => verifyPackage(extra), /membership/);
  const missing = join(root, 'missing');
  cpSync(original, missing, { recursive: true });
  unlinkSync(join(missing, 'page.html'));
  assert.throws(() => verifyPackage(missing), /membership/);
  const linked = join(root, 'linked');
  cpSync(original, linked, { recursive: true });
  unlinkSync(join(linked, 'style.css'));
  symlinkSync(join(original, 'style.css'), join(linked, 'style.css'));
  assert.throws(() => verifyPackage(linked), /regular files/);
});

test('package output/index links cannot redirect writes to an unrelated disposable file', (t) => {
  const { root } = fixture(t);
  const sentinel = join(root, 'sentinel.txt');
  writeFileSync(sentinel, 'leave this disposable file alone');
  const output = join(root, 'linked-index');
  cpSync(join(root, 'packages'), output, { recursive: true });
  unlinkSync(join(output, 'index.json'));
  symlinkSync(sentinel, join(output, 'index.json'));
  assert.throws(() => buildPackages(output), /regular files/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'leave this disposable file alone');
  const alias = join(root, 'output-alias');
  symlinkSync(output, alias);
  assert.throws(() => buildPackages(alias), /regular directory/);
  unlinkSync(join(output, 'index.json'));
  const absent = join(root, 'must-not-be-created.json');
  symlinkSync(absent, join(output, 'index.json'));
  assert.throws(() => buildPackages(output), /regular files/);
  assert.equal(existsSync(absent), false);
});

test('self-consistent changed package still fails the original external digest before execution', async (t) => {
  const { root, index, directory } = fixture(t);
  await assert.rejects(() => launchPackage(directory(index.artifacts[0])), /external expected SHA-256/);
  const changed = join(root, 'changed');
  cpSync(directory(index.artifacts[0]), changed, { recursive: true });
  writeFileSync(join(changed, 'style.css'), readFileSync(join(changed, 'style.css'), 'utf8') + '\n/* different bytes, same version label */\n');
  const revised = describe(changed);
  writeFileSync(join(changed, 'artifact.json'), JSON.stringify({ ...revised.manifest, artifactId: revised.artifactId }) + '\n');
  assert.equal(verifyPackage(changed).release.version, '1.0.0');
  assert.notEqual(revised.artifactId, index.artifacts[0].artifactId);
  await assert.rejects(() => launchPackage(changed, index.artifacts[0].artifactId), /external expected identity/);
});

test('all three artifacts run alone: page/version agree, no-store, read-only HTTP and loopback', async (t) => {
  const { index, directory } = fixture(t);
  for (const entry of index.artifacts) {
    const app = await launchPackage(directory(entry), entry.artifactId);
    try {
      assert.match(app.ready.address, /^http:\/\/127\.0\.0\.1:\d+$/);
      const response = await fetch(`${app.ready.address}/version`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const identity = await response.json();
      assert.equal(identity.version, entry.version);
      assert.equal(identity.artifactId, entry.artifactId);
      assert.equal(identity.context, null);
      assert.match(identity.bootId, /^[a-f0-9-]{36}$/);
      const html = await (await fetch(app.ready.address)).text();
      assert.ok(html.includes(`<h1 id="version" class="version">${entry.version}</h1>`));
      assert.ok(html.includes(entry.artifactId));
      assert.equal((await fetch(`${app.ready.address}/style.css`)).status, 200);
      assert.equal((await fetch(app.ready.address, { method: 'POST' })).status, 405);
      assert.equal((await fetch(`${app.ready.address}/missing`)).status, 404);
      assert.equal(await (await fetch(app.ready.address, { method: 'HEAD' })).text(), '');
      if (entry.version === '1.0.0') {
        writeFileSync(join(directory(entry), 'page.html'), '<h1>changed on disk after startup</h1>');
        assert.equal(await (await fetch(app.ready.address)).text(), html);
        assert.throws(() => verifyPackage(directory(entry), entry.artifactId), /do not match/);
      }
    } finally { await app.stop(); }
  }
});

test('context and boot changes preserve baked identity; demo-Production is explicit and unsafe context is refused', async (t) => {
  const { index, directory } = fixture(t);
  const entry = index.artifacts[2];
  const contexts = [
    { stage: 'Development', destinationId: 'standalone-smoke', instanceId: 'instance-one', disposableDemo: false },
    { stage: 'Production', destinationId: 'disposable-context-check', instanceId: 'instance-two', disposableDemo: true },
  ];
  const boots = [];
  for (const context of contexts) {
    const app = await launchPackage(directory(entry), entry.artifactId, context);
    try {
      const identity = await (await fetch(`${app.ready.address}/version`)).json();
      assert.equal(identity.artifactId, entry.artifactId);
      assert.equal(identity.version, '1.2.0');
      assert.deepEqual(identity.context, context);
      boots.push(identity.bootId);
      if (context.stage === 'Production') assert.match(await (await fetch(app.ready.address)).text(), /DISPOSABLE DEMO · NOT REAL PRODUCTION/);
    } finally { await app.stop(); }
  }
  assert.notEqual(boots[0], boots[1]);
  await assert.rejects(() => launchPackage(directory(entry), entry.artifactId, { ...contexts[1], disposableDemo: false }), /requires explicit disposable demo/);
});

test('launch context is escaped and deployment-time version variables cannot override the artifact', async (t) => {
  const { index, directory } = fixture(t);
  const entry = index.artifacts[0];
  const child = fork(join(directory(entry), 'server.mjs'), [], { execArgv: [], env: {
    HELLO_PORT: '0', HELLO_VERSION: '9.9.9', VERSION: '9.9.9', HELLO_ARTIFACT_ID: 'fake',
    HELLO_STAGE: 'Test', HELLO_DESTINATION_ID: '<script>context</script>', HELLO_INSTANCE_ID: 'standalone-check',
  }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const exited = once(child, 'exit');
  try {
    const [message] = await once(child, 'message', { signal: AbortSignal.timeout(5000) });
    const identity = await (await fetch(`${message.address}/version`)).json();
    assert.equal(identity.version, '1.0.0');
    assert.equal(identity.artifactId, entry.artifactId);
    const html = await (await fetch(message.address)).text();
    assert.match(html, /&lt;script&gt;context/);
    assert.doesNotMatch(html, /<script>/);
  } finally { child.kill('SIGTERM'); await exited; }
});

test('retained earlier artifact restarts with identical bytes/identity after another release ran', async (t) => {
  const { index, directory } = fixture(t);
  const identities = [];
  for (const entry of [index.artifacts[1], index.artifacts[2], index.artifacts[1]]) {
    const app = await launchPackage(directory(entry), entry.artifactId);
    try { identities.push(await (await fetch(`${app.ready.address}/version`)).json()); }
    finally { await app.stop(); }
  }
  assert.equal(identities[0].artifactId, identities[2].artifactId);
  assert.notEqual(identities[0].artifactId, identities[1].artifactId);
  assert.notEqual(identities[0].bootId, identities[2].bootId);
});
