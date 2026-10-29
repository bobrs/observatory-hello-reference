import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyPackage } from './identity.mjs';

const artifact = verifyPackage(fileURLToPath(new URL('./', import.meta.url)));
const bootId = randomUUID();
function context() {
  const stage = process.env.HELLO_STAGE;
  const destinationId = process.env.HELLO_DESTINATION_ID;
  const instanceId = process.env.HELLO_INSTANCE_ID;
  const disposableDemo = process.env.HELLO_DISPOSABLE_DEMO === 'true';
  if (!stage && !destinationId && !instanceId && !disposableDemo) return null;
  if (!['Development', 'Test', 'Production'].includes(stage) || !destinationId || !instanceId
    || destinationId.length > 80 || instanceId.length > 80 || (stage === 'Production' && !disposableDemo)) throw new Error('Invalid launch context; Production requires explicit disposable demo designation.');
  return { destinationId, instanceId, stage, disposableDemo };
}
const launchContext = context();
const identity = { schemaVersion: 1, applicationId: artifact.release.applicationId, version: artifact.release.version, artifactId: artifact.artifactId, context: launchContext, bootId };
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const values = {
  VERSION: artifact.release.version, GREETING: artifact.release.greeting,
  SHORT_ID: artifact.artifactId.slice(7, 19), ARTIFACT_ID: artifact.artifactId,
  CONTEXT: launchContext ? `${launchContext.destinationId} · ${launchContext.stage}${launchContext.disposableDemo ? ' — DISPOSABLE DEMO · NOT REAL PRODUCTION' : ''}` : 'Standalone local reference app',
  CONTEXT_DETAIL: launchContext ? `Launch context only. Instance ${launchContext.instanceId}; stage is not acceptance or authority.` : 'No destination or stage supplied. No deployment or health inference.',
  BOOT_ID: bootId,
};
// Cache the verified startup bytes; later filesystem edits cannot change the served snapshot silently.
const page = artifact.bytes['page.html'].toString('utf8').replace(/@@([A-Z_]+)@@/g, (_match, key) => {
  if (!(key in values)) throw new Error('Unknown page placeholder.');
  return escape(values[key]);
});
const portText = process.env.HELLO_PORT ?? '0';
if (!/^\d+$/.test(portText) || Number(portText) > 65535) throw new Error('HELLO_PORT must be 0..65535.');
const server = createServer((request, response) => {
  const headers = {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  };
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end(); return; }
  const path = request.url?.split('?')[0];
  const route = path === '/' ? ['text/html; charset=utf-8', page] : path === '/version'
    ? ['application/json; charset=utf-8', JSON.stringify(identity) + '\n']
    : path === '/style.css' ? ['text/css; charset=utf-8', artifact.bytes['style.css']] : null;
  if (!route) { response.writeHead(404, headers).end(); return; }
  response.writeHead(200, { ...headers, 'Content-Type': route[0] });
  response.end(request.method === 'HEAD' ? undefined : route[1]);
});
const close = () => server.close(() => process.exit(0));
process.on('SIGINT', close);
process.on('SIGTERM', close);
process.on('disconnect', close);
server.listen(Number(portText), '127.0.0.1', () => {
  const address = `http://127.0.0.1:${server.address().port}`;
  const ready = { type: 'ready', address, identity };
  console.log(`Hello Observatory ${identity.version} ready at ${address}`);
  if (process.send) process.send(ready);
});
