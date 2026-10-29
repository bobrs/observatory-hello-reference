import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { applicationId, versions } from '../app/identity.mjs';
import { launchPackage } from './launch.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = process.argv[2] ?? '1.2.0';
if (process.argv.length > 3 || !versions.includes(version)) throw new Error('Select exactly one fixed release: 1.0.0, 1.1.0 or 1.2.0.');
const index = JSON.parse(readFileSync(join(root, 'artifacts', 'index.json'), 'utf8'));
const entry = index.artifacts.find((item) => item.version === version);
if (index.schemaVersion !== 1 || index.applicationId !== applicationId || !entry || !/^sha256:[a-f0-9]{64}$/.test(entry.artifactId)
  || entry.directory !== entry.artifactId.slice(7)) throw new Error('External artifact index is invalid. Rebuild from reviewed source.');
const stage = process.env.HELLO_STAGE;
const context = stage || process.env.HELLO_DESTINATION_ID || process.env.HELLO_INSTANCE_ID || process.env.HELLO_DISPOSABLE_DEMO ? {
  stage, destinationId: process.env.HELLO_DESTINATION_ID, instanceId: process.env.HELLO_INSTANCE_ID,
  disposableDemo: process.env.HELLO_DISPOSABLE_DEMO === 'true',
} : null;
const running = await launchPackage(join(root, 'artifacts', entry.directory), entry.artifactId, context, process.env.HELLO_PORT ?? '0');
console.log(`Hello Observatory ${version}: ${running.ready.address}`);
console.log(`Externally checked package: ${entry.artifactId}`);
console.log('Local review only; startup is not a health attestation. Ctrl-C stops this app.');
process.on('SIGINT', () => { void running.stop(); });
process.on('SIGTERM', () => { void running.stop(); });
await once(running.child, 'exit');
