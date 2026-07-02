// End-to-end tests for the YapUI relay — no network, no real Claude:
// test/fake-claude.js stands in for the CLI so the whole loop
// (feedback → resident agent → status flips → reply → HTML edit → SSE)
// runs deterministically. Run with: npm test
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'relay', 'server.js');
const FLIP = path.join(ROOT, 'relay', 'flip-status.js');
const FAKE = path.join(__dirname, 'fake-claude.js');

let failures = 0;
const children = [];
const tmpdirs = [];

function ok(cond, label) {
  if (cond) { console.log('  ✓ ' + label); return; }
  failures++; console.error('  ✗ ' + label);
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function waitFor(fn, label, timeoutMs) {
  const until = Date.now() + (timeoutMs || 8000);
  while (Date.now() < until) {
    try { const v = await fn(); if (v) return v; } catch (e) {}
    await wait(80);
  }
  throw new Error('timeout: ' + label);
}
function freePort() {
  return new Promise(function (resolve, reject) {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
    s.on('error', reject);
  });
}
function get(port, p, headers) {
  return new Promise(function (resolve, reject) {
    const req = http.get({ host: '127.0.0.1', port: port, path: p, timeout: 4000, headers: headers || {} }, function (res) {
      let b = ''; res.on('data', function (c) { b += c; }); res.on('end', function () { resolve({ status: res.statusCode, body: b }); });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}
function post(port, p, body, headers) {
  return new Promise(function (resolve, reject) {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: port, path: p, method: 'POST', timeout: 4000, headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers || {}) }, function (res) {
      let b = ''; res.on('data', function (c) { b += c; }); res.on('end', function () { resolve({ status: res.statusCode, body: b }); });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject); req.end(data);
  });
}
function sseCapture(port) {
  const state = { data: '', req: null };
  state.req = http.get({ host: '127.0.0.1', port: port, path: '/events' }, function (res) {
    res.on('data', function (c) { state.data += c; });
  });
  state.req.on('error', function () {});
  return state;
}
function startRelay(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yapui-test-'));
  tmpdirs.push(dir);
  const html = path.join(dir, 'page.html');
  fs.writeFileSync(html, '<!doctype html>\n<html><head><title>t</title></head><body>\n<h1>Hello</h1>\n</body></html>');
  fs.writeFileSync(path.join(dir, 'style.css'), 'h1{color:red}');
  fs.writeFileSync(path.join(dir, '.secret'), 'dot-hidden');
  const wd = path.join(dir, '.yapui');
  const child = spawn(process.execPath, [SERVER], {
    env: Object.assign({}, process.env, { HTML_FILE: html, WORKDIR: wd, YAP_CLAUDE_BIN: FAKE }, env),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', function () {}); child.stderr.on('data', function () {});
  children.push(child);
  return { child: child, html: html, wd: wd };
}

async function testAgentMode() {
  console.log('agent mode (resident fake agent):');
  const port = await freePort();
  const r = startRelay({ PORT: String(port) });
  await waitFor(function () { return get(port, '/').then(function (x) { return x.status === 200 && x.body.indexOf('__feedback.js') !== -1; }); }, 'server up + widget injected');
  ok(true, 'serves HTML with the widget injected');

  const agent = await waitFor(function () { return get(port, '/agent').then(function (x) { const o = JSON.parse(x.body); return o.state === 'ready' ? o : null; }); }, 'agent ready');
  ok(agent.state === 'ready', 'resident agent boots and primes to ready');

  const sse = sseCapture(port);
  await wait(150);

  await post(port, '/feedback', { text: 'make it red', taskId: 'tA', screen: 'test' });
  const tasksAfter = await waitFor(function () { return get(port, '/tasks').then(function (x) { return x.body.indexOf('"status":"done"') !== -1 ? x.body : null; }); }, 'done flip');
  ok(tasksAfter.indexOf('"status":"working"') !== -1, 'card flipped to working');
  ok(tasksAfter.indexOf('⚡') !== -1, 'instant-pickup note was shown');
  ok(tasksAfter.indexOf('"status":"done"') !== -1, 'card flipped to done');

  const html = fs.readFileSync(r.html, 'utf8');
  ok(html.indexOf('fake-fix: make it red') !== -1, 'agent applied the fix to the HTML');

  const replies = await get(port, '/replies');
  ok(replies.body.indexOf('Applied: make it red') !== -1, 'reply was posted for the browser');

  const marker = fs.readFileSync(path.join(r.wd, '.fb-processed'), 'utf8').trim();
  ok(marker === '1', 'feedback marker advanced (watcher fallback stays in sync)');

  // reply pushes instantly; task flips are debounced ~25ms — wait for both
  await waitFor(function () { return Promise.resolve(sse.data.indexOf('event: reply') !== -1 && sse.data.indexOf('event: tasks') !== -1 ? true : null); }, 'sse reply + tasks events');
  ok(sse.data.indexOf('event: hello') !== -1, 'SSE hello seeds new clients');
  ok(sse.data.indexOf('event: tasks') !== -1, 'SSE pushes task flips');
  ok(sse.data.indexOf('event: reply') !== -1, 'SSE pushes the reply');

  await post(port, '/feedback', { text: 'NEEDSYOU which one', taskId: 'tB' });
  const needs = await waitFor(function () { return get(port, '/tasks').then(function (x) { return x.body.indexOf('"id":"tB","status":"needs-you"') !== -1 ? x.body : null; }); }, 'needs-you flip');
  ok(needs.indexOf('needs-you') !== -1, 'NEEDS-YOU reply flips the card to needs-you');

  sse.req.destroy();
}

async function testFallbackMode() {
  console.log('watcher fallback (YAP_AGENT=off):');
  const port = await freePort();
  const r = startRelay({ PORT: String(port), YAP_AGENT: 'off' });
  await waitFor(function () { return get(port, '/').then(function (x) { return x.status === 200; }); }, 'server up');

  const agent = JSON.parse((await get(port, '/agent')).body);
  ok(agent.state === 'off', '/agent reports off');

  await post(port, '/feedback', { text: 'fallback note', taskId: 'm1' });
  const fb = fs.readFileSync(path.join(r.wd, 'feedback.jsonl'), 'utf8');
  ok(fb.indexOf('fallback note') !== -1, 'feedback is written for the terminal watcher');
  const tasks1 = await waitFor(function () { return get(port, '/tasks').then(function (x) { return x.body.indexOf('"id":"m1"') !== -1 ? x.body : null; }); }, 'task card created');
  ok(tasks1.indexOf('"status":"queued"') !== -1, 'card stays queued (no agent lies)');

  execFileSync(process.execPath, [FLIP, r.wd, 'm1', 'done', 'fixed'], { stdio: 'ignore' });
  const tasks2 = await waitFor(function () { return get(port, '/tasks').then(function (x) { return x.body.indexOf('"status":"done"') !== -1 ? x.body : null; }); }, 'external flip visible');
  ok(tasks2.indexOf('"status":"done"') !== -1, 'flip-status.js still drives the queue');

  console.log('hardening:');
  const css = await get(port, '/style.css');
  ok(css.status === 200 && css.body === 'h1{color:red}', 'sibling assets (css/js/img) are served');
  ok((await get(port, '/..%2f..%2fetc%2fpasswd')).status === 404, 'path traversal is blocked');
  ok((await get(port, '/.secret')).status === 404, 'dotfiles are not served');
  ok((await get(port, '/.yapui/feedback.jsonl')).status === 404, 'workdir artifacts are not served');
  const evil = await post(port, '/feedback', { text: 'evil', taskId: 'x1' }, { Origin: 'https://evil.example' });
  ok(evil.status === 403, 'cross-origin POSTs are rejected');
  ok((await get(port, '/', { Host: 'evil.example' })).status === 403, 'DNS-rebinding Host headers are rejected');

  const up = await post(port, '/upload', Buffer.from('fake-webm-bytes').toString(), { 'Content-Type': 'application/octet-stream' });
  const upFile = JSON.parse(up.body).file;
  ok(up.status === 200 && /^recordings\/clip-.+\.webm$/.test(upFile), 'binary upload returns a workdir-relative file ref');
  const fbMedia = await post(port, '/feedback', { text: 'clip note', taskId: 'm2', recording: upFile, secs: 3 });
  ok(fbMedia.status === 200, 'media metadata rides in the JSON note (no headers)');
  ok(fs.readFileSync(path.join(r.wd, 'feedback.jsonl'), 'utf8').indexOf(upFile) !== -1, 'recording ref lands in feedback.jsonl');
  ok((await post(port, '/feedback', { recording: '../../etc/passwd' })).status === 400, 'traversal media refs are rejected');
  const longId = 'L'.repeat(90);
  await post(port, '/feedback', { text: 'long id note', taskId: longId });
  const tasks3 = await waitFor(function () { return get(port, '/tasks').then(function (x) { return x.body.indexOf('long id note') !== -1 ? x.body : null; }); }, 'long-id task visible');
  ok(tasks3.indexOf('"id":"' + longId.slice(0, 64) + '"') !== -1, 'task ids are canonicalized to 64 chars');
  const good = await post(port, '/feedback', { text: 'good origin', taskId: 'x2' }, { Origin: 'http://localhost:' + port });
  ok(good.status === 200, 'same-origin POSTs still pass');
}

(async function main() {
  try {
    await testAgentMode();
    await testFallbackMode();
  } catch (e) {
    failures++; console.error('  ✗ ' + (e && e.message));
  } finally {
    children.forEach(function (c) { try { c.kill('SIGTERM'); } catch (e) {} });
    await wait(150);
    tmpdirs.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });
  }
  if (failures) { console.error('\n' + failures + ' failure(s)'); process.exit(1); }
  console.log('\nALL TESTS PASSED');
  process.exit(0);
})();
