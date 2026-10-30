import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyPackage } from './identity.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const { artifactId } = verifyPackage(directory);
const release = JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8'));
const template = readFileSync(join(directory, 'page.html'), 'utf8');
const css = readFileSync(join(directory, 'style.css'));
const bootId = randomUUID();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function launchContext() {
  const stage = process.env.ALOHA_STAGE || '';
  const destinationId = process.env.ALOHA_DESTINATION_ID || '';
  const instanceId = process.env.ALOHA_INSTANCE_ID || '';
  if (!stage && !destinationId && !instanceId) return null;
  const stages = ['Development', 'Test', 'QA', 'Demo'];
  if (!stages.includes(stage) || !destinationId || !instanceId || destinationId.length > 80 || instanceId.length > 80) {
    throw new Error('Invalid Aloha launch context. Use Development, Test, QA, or Demo with destination and instance IDs.');
  }
  return { stage, destinationId, instanceId };
}

const context = launchContext();
const identity = { schemaVersion: 1, applicationId: release.applicationId, version: release.version, artifactId, context, bootId };
const page = template
  .replace('@@ARTIFACT_ID@@', escapeHtml(artifactId))
  .replace('@@CONTEXT@@', escapeHtml(context ? `${context.stage} · ${context.destinationId} · ${context.instanceId}` : 'Standalone'))
  .replace('@@BOOT_ID@@', escapeHtml(bootId));

const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const methodAllowed = request.method === 'GET' || request.method === 'HEAD';
  if (!methodAllowed) {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end(request.method === 'HEAD' ? undefined : 'Method not allowed\n');
  }
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  let body;
  let type;
  if (path === '/') { body = page; type = 'text/html; charset=utf-8'; }
  else if (path === '/style.css') { body = css; type = 'text/css; charset=utf-8'; }
  else if (path === '/version') { body = `${JSON.stringify(identity)}\n`; type = 'application/json; charset=utf-8'; }
  else {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end(request.method === 'HEAD' ? undefined : 'Not found\n');
  }
  response.writeHead(200, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  response.end(request.method === 'HEAD' ? undefined : body);
});

const port = Number(process.env.ALOHA_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('ALOHA_PORT must be an integer from 0 to 65535.');
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(JSON.stringify({ url: `http://127.0.0.1:${address.port}`, identity }));
});
