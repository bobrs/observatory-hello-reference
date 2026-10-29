import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildPackages } from './package.mjs';
import { launchPackage } from './launch.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('playwright');
const directory = mkdtempSync(join(tmpdir(), 'hello-reference-browser-'));
const output = resolve('test-results/demo');
mkdirSync(output, { recursive: true });
const index = buildPackages(directory);
let browser;
let app;
const observations = [];
try {
  browser = await chromium.launch();
  for (const entry of index.artifacts) {
    app = await launchPackage(join(directory, entry.directory), entry.artifactId);
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    let external = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
    await page.route('**/*', (route) => {
      if (route.request().url().startsWith(app.ready.address + '/')) return route.continue();
      external++; return route.abort();
    });
    await page.goto(app.ready.address);
    assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), entry.version);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(output, `release-${entry.version}-desktop.png`), fullPage: true });
    if (entry.version === '1.2.0') {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(output, 'release-1.2.0-mobile.png'), fullPage: true });
      await page.getByText('Artifact & runtime details', { exact: true }).click();
      assert.ok((await page.locator('body').innerText()).includes(entry.artifactId));
    }
    await page.getByRole('link', { name: 'Read version JSON' }).click();
    const identity = JSON.parse(await page.locator('body').innerText());
    assert.equal(identity.version, entry.version);
    assert.equal(identity.artifactId, entry.artifactId);
    assert.deepEqual(errors, []);
    assert.equal(external, 0);
    observations.push({ version: entry.version, artifactId: entry.artifactId, result: 'PASS: actual standalone HTTP identity, bold page, navigation, no browser/HTTP errors or external requests' });
    await page.close(); await app.stop(); app = undefined;
  }
  const entry = index.artifacts[2];
  app = await launchPackage(join(directory, entry.directory), entry.artifactId, {
    stage: 'Production', destinationId: 'standalone-context-smoke', instanceId: 'disposable-label-check', disposableDemo: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(app.ready.address);
  assert.match(await page.locator('body').innerText(), /DISPOSABLE DEMO · NOT REAL PRODUCTION/);
  await page.screenshot({ path: join(output, 'disposable-context-smoke.png'), fullPage: true });
  const report = {
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }).trim() !== '',
    capturedAt: new Date().toISOString(), node: process.version, platform: `${process.platform} ${process.arch}`,
    browser: `Chromium ${browser.version()}`, observations,
    contextCheck: 'PASS: one-off disposable Production label, same package digest; no destination manager or integration',
    limits: 'Local standalone Step A only; same-host observations, not Test acceptance, health, real Production or Step B.',
  };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(output, 'artifact-index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (app) await app.stop();
  if (browser) await browser.close();
  rmSync(directory, { recursive: true, force: true });
}
