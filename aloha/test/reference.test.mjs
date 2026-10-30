import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { build } from './test-support.mjs';
import { verifyPackage } from '../identity.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('build is reproducible, matches independent evidence pin, and rejects membership or byte changes', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'aloha-test-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const first = build(join(temp, 'one'));
  const second = build(join(temp, 'two'));
  assert.equal(first.artifactId, second.artifactId);
  assert.equal(readFileSync(join(first.directory, 'artifact.json'), 'utf8'), readFileSync(join(second.directory, 'artifact.json'), 'utf8'));
  const pins = JSON.parse(readFileSync(join(root, 'evidence', 'artifact-index.json'), 'utf8'));
  assert.equal(pins.artifacts[0].artifactId, first.artifactId);
  verifyPackage(first.directory, pins.artifacts[0].artifactId);

  const extra = join(temp, 'extra'); cpSync(first.directory, extra, { recursive: true }); writeFileSync(join(extra, 'unexpected.txt'), 'no');
  assert.throws(() => verifyPackage(extra), /membership/);
  const missing = join(temp, 'missing'); cpSync(first.directory, missing, { recursive: true }); rmSync(join(missing, 'style.css'));
  assert.throws(() => verifyPackage(missing), /membership/);
  const linked = join(temp, 'linked'); cpSync(first.directory, linked, { recursive: true });
  rmSync(join(linked, 'style.css')); symlinkSync(join(first.directory, 'style.css'), join(linked, 'style.css'));
  assert.throws(() => verifyPackage(linked), /regular file/);
  const tampered = join(temp, 'tampered'); cpSync(first.directory, tampered, { recursive: true });
  writeFileSync(join(tampered, 'style.css'), `${readFileSync(join(tampered, 'style.css'), 'utf8')}\n/* changed */\n`);
  assert.throws(() => verifyPackage(tampered), /sidecar or covered bytes/);
});

test('packaged server serves loopback GET and HEAD routes with stable identity and refuses other methods', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'aloha-http-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const built = build(join(temp, 'build'));
  const child = spawn(process.execPath, [join(built.directory, 'server.mjs')], { cwd: built.directory, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  let output = '';
  child.stdout.setEncoding('utf8'); child.stdout.on('data', (chunk) => { output += chunk; });
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not start: ${output}`)), 5000);
    const onData = () => {
      const line = output.split('\n').find(Boolean);
      if (line) { clearTimeout(timeout); child.stdout.off('data', onData); resolve(JSON.parse(line)); }
    };
    child.stdout.on('data', onData);
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`server exited ${code}: ${output}`)));
  });
  assert.equal(new URL(address.url).hostname, '127.0.0.1');
  const versionResponse = await fetch(`${address.url}/version`);
  const identity = await versionResponse.json();
  assert.equal(identity.applicationId, 'observatory-aloha-reference');
  assert.equal(identity.version, '1.0.0');
  assert.equal(identity.artifactId, built.artifactId);
  assert.match(identity.bootId, /^[a-f0-9-]{36}$/);
  const html = await (await fetch(`${address.url}/`)).text();
  assert.match(html, /Aloha, sunshine!/);
  assert.ok(html.includes(built.artifactId));
  assert.equal((await fetch(`${address.url}/style.css`)).status, 200);
  for (const path of ['/', '/style.css', '/version']) {
    const response = await fetch(`${address.url}${path}`, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
  }
  assert.equal((await fetch(`${address.url}/version`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${address.url}/missing`)).status, 404);
  assert.equal(identity.context, null);
});

test('launch context is explicit and stage-limited', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'aloha-context-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const built = build(join(temp, 'build'));
  const child = spawn(process.execPath, [join(built.directory, 'server.mjs')], {
    env: { ...process.env, ALOHA_STAGE: 'QA', ALOHA_DESTINATION_ID: 'qa-demo', ALOHA_INSTANCE_ID: 'instance-1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  const output = await new Promise((resolve, reject) => {
    let data = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', (chunk) => { data += chunk; if (data.includes('\n')) resolve(data); });
    child.once('error', reject); child.once('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
  const running = JSON.parse(output.split('\n')[0]);
  const identity = await (await fetch(`${running.url}/version`)).json();
  assert.deepEqual(identity.context, { stage: 'QA', destinationId: 'qa-demo', instanceId: 'instance-1' });
  assert.equal(identity.artifactId, built.artifactId);
});
