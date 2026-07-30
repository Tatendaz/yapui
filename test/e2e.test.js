// End-to-end tests for the YapUI relay — no network, no real Claude:
// test/fake-claude.js stands in for the CLI so the whole loop
// (feedback → resident agent → status flips → reply → HTML edit → SSE)
// runs deterministically. Run with: npm test
const { spawn, spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'relay', 'server.js');
const FLIP = path.join(ROOT, 'relay', 'flip-status.js');
const WIDGET = path.join(ROOT, 'relay', 'widget.js');
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
      let b = ''; res.on('data', function (c) { b += c; }); res.on('end', function () { resolve({ status: res.statusCode, headers: res.headers, body: b }); });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}
// run a node script to completion and keep its exit code + stderr (execFileSync
// throws on a non-zero exit, which is exactly what the guard tests assert on)
function runNode(args) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function countOf(hay, needle) { return hay.split(needle).length - 1; }
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
  // keep the relay's stdout: it is the only place agent lifecycle events
  // (boot, recycle, exit) are observable from outside the process
  const rec = { child: child, html: html, wd: wd, out: '' };
  child.stdout.on('data', function (d) { rec.out += d; }); child.stderr.on('data', function () {});
  children.push(child);
  return rec;
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
  fs.mkdirSync(path.join(path.dirname(r.html), 'assets'));
  fs.writeFileSync(path.join(path.dirname(r.html), 'assets', 'app.js'), 'window.x=1');
  const sub = await get(port, '/assets/app.js');
  ok(sub.status === 200 && sub.body === 'window.x=1', 'nested sibling assets are served (containment does not over-reject)');
  ok((await get(port, '/..%2Fpage.html')).status === 404, 'mixed-encoding traversal is blocked');
  ok((await get(port, '/assets/..%2F..%2Fpage.html')).status === 404, 'deep relative traversal is blocked');
  ok((await get(port, '/%00style.css')).status === 404, 'null-byte paths are rejected');
  // a symlink INSIDE the served dir pointing outside it must not be followed (realpath guard, not just the lexical check)
  const outside = path.join(path.dirname(r.html), '..', 'sym-secret.txt');
  fs.writeFileSync(outside, 'top-secret');
  tmpdirs.push(outside); // sits above the mkdtemp dir, so it needs its own cleanup registration
  let linked = true;
  try { fs.symlinkSync(outside, path.join(path.dirname(r.html), 'leak.txt')); } catch (e) { linked = false; }
  if (linked) {
    const leak = await get(port, '/leak.txt');
    ok(leak.status === 404 && leak.body.indexOf('top-secret') === -1, 'symlink escape out of the served dir is blocked');
  } else {
    console.log('  - symlink escape check skipped (symlinks not supported here)'); // a vacuous 404 must not count as exercising the realpath guard
  }
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

// flip-status.js is the seam between a human Claude session and the queue UI.
// The fallback test above only ever drives its happy path; everything it
// refuses to do is what keeps a bad flip from corrupting the queue.
async function testFlipStatusGuards() {
  console.log('flip-status.js guards:');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yapui-flip-'));
  tmpdirs.push(dir);
  const tasks = path.join(dir, 'tasks.jsonl');
  function lastRec() { return JSON.parse(fs.readFileSync(tasks, 'utf8').trim().split('\n').pop()); }

  const noArgs = runNode([FLIP]);
  ok(noArgs.code === 1 && noArgs.stderr.indexOf('usage:') !== -1, 'missing arguments exit 1 with a usage line');

  const bad = runNode([FLIP, dir, 'g1', 'finished']);
  ok(bad.code === 1 && bad.stderr.indexOf('must be one of') !== -1, 'an unknown status is refused');
  ok(!fs.existsSync(tasks), 'a refused flip writes nothing at all (no half-record in the queue)');

  const needs = runNode([FLIP, dir, 'g1', 'needs-you', 'which', 'shade', 'of', 'red?']);
  ok(needs.code === 0 && lastRec().status === 'needs-you', 'needs-you is an accepted status');
  ok(lastRec().note === 'which shade of red?', 'a multi-word note is joined, not clipped to the first word');

  // server.js canonId() slices ids to 64 chars; a flip that wrote the full id
  // would silently target a card that does not exist and appear to do nothing
  const longId = 'F'.repeat(90);
  ok(runNode([FLIP, dir, longId, 'done']).code === 0, 'an over-long id is accepted');
  ok(lastRec().id === longId.slice(0, 64), 'flip-status truncates ids to the same 64 chars the relay writes');
}

// Routes the end-to-end flow never touches. Each of these is reachable from the
// widget, so a break here is invisible to the suite but obvious to a user.
async function testRelayRoutes() {
  console.log('relay routes:');
  const port = await freePort();
  const r = startRelay({ PORT: String(port), YAP_AGENT: 'off' });
  await waitFor(function () { return get(port, '/').then(function (x) { return x.status === 200; }); }, 'server up');

  // the page only gets a <script src="/__feedback.js"> tag — the injection test
  // passes even if this route is broken and every page loads a dead widget
  const served = await get(port, '/__feedback.js');
  ok(served.status === 200 && served.body === fs.readFileSync(WIDGET, 'utf8'), '/__feedback.js serves relay/widget.js verbatim');
  ok(/^application\/javascript/.test(served.headers['content-type'] || ''), 'the widget is served as JavaScript');
  // widget.js only ever runs in a browser, so nothing else here parses it —
  // a syntax error would ship silently and break the panel on every page
  ok(runNode(['--check', WIDGET]).code === 0, 'relay/widget.js is syntactically valid JavaScript');

  const ver = await get(port, '/version');
  ok(ver.status === 200 && /^\d+:\d+$/.test(JSON.parse(ver.body).v), '/version returns the widget-mtime:boot stamp the page self-reloads on');

  // --- task queue routes (the widget's optimistic card + the ✕ button) ---
  ok((await post(port, '/task', { text: 'no id' })).status === 400, 'POST /task without an id is refused');
  await post(port, '/task', { id: 'dup1', text: 'first', screen: 'routes' });
  await post(port, '/task', { id: 'dup1', text: 'second, same id' });
  const dup = (await get(port, '/tasks')).body;
  ok(countOf(dup, '"type":"task","id":"dup1"') === 1, 'POST /task de-dupes by id (one card, not one per send)');
  ok(dup.indexOf('"screen":"routes"') !== -1, 'the screen label rides along with the card');

  await post(port, '/task/dismiss', { id: 'dup1' });
  ok((await get(port, '/tasks')).body.indexOf('"id":"dup1","status":"dismissed"') !== -1, 'POST /task/dismiss appends a dismissed status for that card');

  ok((await post(port, '/tasks/clear', {})).status === 200, 'POST /tasks/clear is accepted');
  ok((await get(port, '/tasks')).body === '', 'the queue file is emptied by a clear');
  await post(port, '/task', { id: 'dup1', text: 'after the clear' });
  ok((await get(port, '/tasks')).body.indexOf('"id":"dup1"') !== -1, 'an id can be re-used after a clear (the dedup memory is cleared too)');

  // --- cursor presence: every field is clamped before it hits disk ---
  ok((await post(port, '/cursor', { desc: 'D'.repeat(400), label: 'L'.repeat(80), scene: 'S'.repeat(60), el: 'E'.repeat(300), x: '12.5', y: 'nope' })).status === 200, 'POST /cursor accepts a presence ping');
  const cur = JSON.parse((await get(port, '/cursor')).body);
  ok(cur.desc.length === 300 && cur.label.length === 60 && cur.scene.length === 40 && cur.el.length === 200, '/cursor clamps every string field to its own cap');
  ok(cur.x === 12.5 && cur.y === 0, '/cursor coerces coordinates to numbers (unparseable → 0)');

  // --- notes, screenshots, and the raw log ---
  await post(port, '/feedback', { text: 'route note', taskId: 'rt1' });
  ok((await get(port, '/feedback.jsonl')).body.indexOf('route note') !== -1, 'GET /feedback.jsonl exposes the raw note log');
  ok((await post(port, '/feedback', 'not json at all')).status === 400, 'a malformed /feedback body is refused');
  ok((await post(port, '/feedback', { taskId: 'rt2' })).status === 400, 'a note with no text, element or media is refused');

  const shot = await post(port, '/shot', Buffer.from('fake-png-bytes').toString(), { 'Content-Type': 'application/octet-stream' });
  const shotFile = JSON.parse(shot.body).file;
  ok(shot.status === 200 && /^screenshots\/shot-.+\.png$/.test(shotFile), '/shot returns a workdir-relative screenshots/ ref');
  ok(fs.existsSync(path.join(r.wd, shotFile)), 'the screenshot bytes land on disk');
  ok((await post(port, '/feedback', { text: 'shot note', taskId: 'rt3', screenshot: shotFile })).status === 200, 'a screenshot ref is accepted on a note');
  // the traversal test above 400s partly because its note is ALSO empty; pin the
  // media guard on its own — a real note survives, its bad ref does not
  await post(port, '/feedback', { text: 'note with a bad ref', taskId: 'rt4', screenshot: '../../etc/passwd' });
  const log = fs.readFileSync(path.join(r.wd, 'feedback.jsonl'), 'utf8');
  ok(log.indexOf('note with a bad ref') !== -1 && log.indexOf('etc/passwd') === -1, 'an out-of-workdir media ref is stripped from an otherwise valid note');

  const css = await get(port, '/style.css');
  ok(/^text\/css/.test(css.headers['content-type'] || ''), 'sibling assets get a real Content-Type from the MIME map');
  ok(css.headers['cache-control'] === 'no-store', 'served assets are no-store (an edited page must never come back from cache)');
}

// The widget only ever runs in a browser (see testRelayRoutes), so these pin
// the source-level contract of the drag/collapse layer — a refactor that drops
// a drag handle, a persistence key, or the bottom-right default fails here.
async function testWidgetContract() {
  console.log('widget drag/collapse contract:');
  const src = fs.readFileSync(WIDGET, 'utf8');
  ok(src.indexOf('#kfb-queue{position:fixed;right:18px;bottom:18px') !== -1, "queue defaults to bottom-right (never over a page's own header controls)");
  ok(src.indexOf("makeDraggable(queue, queue.querySelector('#kfb-qhd'), 'queue')") !== -1, 'queue drags by its header');
  ok(src.indexOf("makeDraggable(panel, panel.querySelector('.kfb-hd'), 'panel')") !== -1, 'feedback panel drags by its header');
  ok(src.indexOf("makeDraggable(launch, launch, 'launch')") !== -1, 'the Feedback button itself drags');
  ok(src.indexOf("'kfb-pos:' + key") !== -1, 'dragged positions persist under kfb-pos:<box> keys');
  ok(src.indexOf('if (launch.__kfbDragged) return') !== -1, 'a drag on the launch button suppresses the click that would open the panel');
  ok(src.indexOf('id="kfb-qmin"') !== -1 && src.indexOf("localStorage.getItem('kfb-qmin')") !== -1, 'queue collapse toggle exists and its state persists');
  ok(src.indexOf('setMin(false); qFoot.classList.add') !== -1, 'the refresh countdown re-expands a collapsed queue so it is never invisible');
  ok(src.indexOf('setPointerCapture') !== -1 && src.indexOf('pointercancel') !== -1, 'dragging uses pointer capture (mouse + touch) and survives cancels');
}

// The agent's lifecycle paths: what happens with no claude installed, and what
// happens when the resident child is recycled out from under a live queue.
async function testAgentLifecycle() {
  console.log('agent lifecycle:');

  // by far the most common real-world state: `claude` is not on PATH. spawn
  // fails ENOENT → the relay must fall back to watcher mode, not sit on a
  // "⚡ warming up" card forever
  const portA = await freePort();
  const a = startRelay({ PORT: String(portA), YAP_CLAUDE_BIN: path.join(os.tmpdir(), 'yapui-no-such-claude') });
  await waitFor(function () { return get(portA, '/agent').then(function (x) { return JSON.parse(x.body).state === 'off' ? true : null; }); }, 'agent gives up on a missing binary');
  ok(true, 'a missing claude binary degrades to watcher mode instead of hanging');
  await post(portA, '/feedback', { text: 'no agent here', taskId: 'na1' });
  const na = await waitFor(function () { return get(portA, '/tasks').then(function (x) { return x.body.indexOf('"id":"na1"') !== -1 ? x.body : null; }); }, 'card created without an agent');
  ok(na.indexOf('"status":"done"') === -1, 'no card is faked done when there is no agent');
  ok(fs.readFileSync(path.join(a.wd, 'feedback.jsonl'), 'utf8').indexOf('no agent here') !== -1, 'the note still reaches the terminal watcher');

  // YAP_AGENT understands three spellings of "off"; only 'off' was exercised
  const spellings = ['0', 'false'];
  for (let i = 0; i < spellings.length; i++) {
    const p = await freePort();
    startRelay({ PORT: String(p), YAP_AGENT: spellings[i] });
    const s = await waitFor(function () { return get(p, '/agent').then(function (x) { return JSON.parse(x.body); }); }, 'agent status for YAP_AGENT=' + spellings[i]);
    ok(s.state === 'off', 'YAP_AGENT=' + spellings[i] + ' also disables the agent');
  }

  // one note per turn: a second note must queue behind the first and still land
  const portB = await freePort();
  const b = startRelay({ PORT: String(portB) });
  await waitFor(function () { return get(portB, '/agent').then(function (x) { return JSON.parse(x.body).state === 'ready' ? true : null; }); }, 'agent ready');
  await post(portB, '/feedback', { text: 'first change', taskId: 'q1' });
  await post(portB, '/feedback', { text: 'second change', taskId: 'q2' });
  const both = await waitFor(function () { return get(portB, '/tasks').then(function (x) { return x.body.indexOf('"id":"q1","status":"done"') !== -1 && x.body.indexOf('"id":"q2","status":"done"') !== -1 ? x.body : null; }); }, 'both queued notes complete');
  ok(both.indexOf('"id":"q2","status":"done"') !== -1, 'a note sent while the agent is busy queues and still completes');
  const bHtml = fs.readFileSync(b.html, 'utf8');
  ok(bHtml.indexOf('fake-fix: first change') !== -1 && bHtml.indexOf('fake-fix: second change') !== -1, 'both fixes are applied — neither note is dropped');

  // the child is recycled after YAP_AGENT_RECYCLE turns. If the respawn path is
  // broken the FIRST note works and every later one hangs — silent in production
  const portC = await freePort();
  const c = startRelay({ PORT: String(portC), YAP_AGENT_RECYCLE: '1' });
  await waitFor(function () { return get(portC, '/agent').then(function (x) { return JSON.parse(x.body).state === 'ready' ? true : null; }); }, 'agent ready');
  await post(portC, '/feedback', { text: 'before recycle', taskId: 'rc1' });
  await waitFor(function () { return get(portC, '/tasks').then(function (x) { return x.body.indexOf('"id":"rc1","status":"done"') !== -1 ? true : null; }); }, 'first note done');
  ok(true, 'the note that trips the recycle limit still completes');
  // assert the recycle actually happened — without this the whole section
  // passes just as well on a build where the recycle limit is never applied
  await waitFor(function () { return Promise.resolve(c.out.indexOf('recycling agent after 1 turns') !== -1 ? true : null); }, 'relay logs the recycle');
  ok(true, 'the resident child is recycled once its turn limit is reached');
  await waitFor(function () { return get(portC, '/agent').then(function (x) { return JSON.parse(x.body).state === 'ready' ? true : null; }); }, 'agent re-primes after recycling');
  ok(true, 'the agent re-boots and re-primes after hitting the recycle limit');
  await post(portC, '/feedback', { text: 'after recycle', taskId: 'rc2' });
  const rc = await waitFor(function () { return get(portC, '/tasks').then(function (x) { return x.body.indexOf('"id":"rc2","status":"done"') !== -1 ? x.body : null; }); }, 'post-recycle note done');
  ok(rc.indexOf('"id":"rc2","status":"done"') !== -1, 'notes sent after a recycle reach the new agent child');
}

(async function main() {
  try {
    await testAgentMode();
    await testFallbackMode();
    await testFlipStatusGuards();
    await testRelayRoutes();
    await testWidgetContract();
    await testAgentLifecycle();
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
