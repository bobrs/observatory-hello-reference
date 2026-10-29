import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationId, describe, payloadFiles, readRegular, verifyPackage, versions } from '../app/identity.mjs';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export function buildPackages(output = join(projectRoot, 'artifacts')) {
  const outputStat = lstatSync(output, { throwIfNoEntry: false });
  if (outputStat && (!outputStat.isDirectory() || outputStat.isSymbolicLink())) throw new Error('Package output must be a regular directory, not a link.');
  mkdirSync(output, { recursive: true });
  if (lstatSync(join(output, 'index.json'), { throwIfNoEntry: false })) readRegular(join(output, 'index.json'));
  const artifacts = [];
  for (const version of versions) {
    const release = JSON.parse(readFileSync(join(projectRoot, 'releases', `${version}.json`), 'utf8'));
    if (release.version !== version || release.applicationId !== applicationId || !/^#[0-9a-f]{6}$/.test(release.accent)) throw new Error('Release descriptor mismatch.');
    const staging = mkdtempSync(join(output, '.building-'));
    try {
      for (const name of payloadFiles) {
        const text = name === 'release.json' ? JSON.stringify(release, null, 2) + '\n'
          : readFileSync(join(projectRoot, 'app', name), 'utf8').replace(/\r\n/g, '\n').replaceAll('@@ACCENT@@', release.accent);
        writeFileSync(join(staging, name), text, { flag: 'wx', mode: 0o600 });
      }
      writeFileSync(join(staging, 'artifact.json'), '{}\n', { flag: 'wx', mode: 0o600 });
      const { manifest, artifactId } = describe(staging);
      writeFileSync(join(staging, 'artifact.json'), JSON.stringify({ ...manifest, artifactId }) + '\n');
      verifyPackage(staging, artifactId);
      const directory = artifactId.slice(7);
      const destination = join(output, directory);
      if (lstatSync(destination, { throwIfNoEntry: false })) verifyPackage(destination, artifactId); // Never silently repair/overwrite a content-addressed artifact.
      else renameSync(staging, destination);
      artifacts.push({ version, artifactId, directory });
    } finally { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); }
  }
  const git = (...args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
  const index = {
    schemaVersion: 1, applicationId,
    sourceRevision: git('rev-parse', 'HEAD'), sourceDirty: git('status', '--porcelain=v1') !== '',
    artifacts,
  };
  writeFileSync(join(output, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return index;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = buildPackages();
  console.log(JSON.stringify(index, null, 2));
}
