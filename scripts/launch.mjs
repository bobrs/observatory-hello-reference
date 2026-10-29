import { fork } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { verifyPackage } from '../app/identity.mjs';

// Fixed standalone runner, not a destination manager or general adapter.
export async function launchPackage(directory, expectedArtifactId, context = null, port = '0') {
  if (typeof expectedArtifactId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(expectedArtifactId)) throw new Error('An external expected SHA-256 identity is required before execution.');
  const verified = verifyPackage(directory, expectedArtifactId); // Trusted source verifier before any package code executes.
  const env = { SystemRoot: process.env.SystemRoot, HELLO_PORT: String(port) };
  if (context) Object.assign(env, {
    HELLO_STAGE: context.stage, HELLO_DESTINATION_ID: context.destinationId,
    HELLO_INSTANCE_ID: context.instanceId, HELLO_DISPOSABLE_DEMO: String(context.disposableDemo === true),
  });
  const child = fork(join(directory, 'server.mjs'), [], { execArgv: [], env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exited = once(child, 'exit');
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
    try { await exited; } finally { clearTimeout(timer); }
  };
  try {
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('Standalone app startup timed out.')); }, 5000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(`Standalone app refused startup: ${stderr}`)); });
      child.on('message', (message) => {
        if (message?.type !== 'ready') return;
        clearTimeout(timer);
        if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(message.address)
          || message.identity?.artifactId !== expectedArtifactId || message.identity?.version !== verified.release.version) {
          reject(new Error('Started app does not match the externally checked package.')); return;
        }
        resolve(message);
      });
    });
    return { child, ready, stop };
  } catch (error) { await stop(); throw error; }
}
