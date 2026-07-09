// YapUI relay — serves a target HTML over http://localhost (so mic +
// screen capture work) and injects the feedback widget. Notes / voice /
// recordings / screenshots / picked elements POST here and are written under
// WORKDIR. A resident pre-warmed Claude agent (relay/agent.js) picks each note
// up the instant it lands and fixes the page; the browser is fed over SSE
// (/events) so status flips, activity and replies appear with zero polling.
//
//   HTML_FILE  (required)  path to the .html to serve
//   WORKDIR    (optional)  where to write feedback artifacts (default: <html dir>/.yapui)
//   PORT       (optional)  default 8765
//   YAP_AGENT / YAP_AGENT_MODEL / YAP_CLAUDE_BIN — see relay/agent.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const agentMod = require('./agent');

const HTML_FILE = process.env.HTML_FILE;
if (!HTML_FILE || !fs.existsSync(HTML_FILE)) { console.error('yapui: set HTML_FILE to an existing .html file'); process.exit(1); }
const WORKDIR = process.env.WORKDIR || path.join(path.dirname(path.resolve(HTML_FILE)), '.yapui');
const WIDGET_FILE = path.join(__dirname, 'widget.js');
const PORT = parseInt(process.env.PORT, 10) || 8765;

const FB_JSONL = path.join(WORKDIR, 'feedback.jsonl');
const FB_MD = path.join(WORKDIR, 'feedback.md');
const REPLIES = path.join(WORKDIR, 'claude-replies.jsonl');
const REC_DIR = path.join(WORKDIR, 'recordings');
const SHOT_DIR = path.join(WORKDIR, 'screenshots');
const TASKS = path.join(WORKDIR, 'tasks.jsonl');   // the live task queue (append-only event log)
const CURSOR = path.join(WORKDIR, 'cursor.json');  // last-known cursor position (overwritten)
const BOOT = Date.now();                            // changes on restart → clients self-reload

[WORKDIR, REC_DIR, SHOT_DIR].forEach(function (d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
[FB_JSONL, TASKS, REPLIES].forEach(function (f) { if (!fs.existsSync(f)) fs.writeFileSync(f, ''); });
if (!fs.existsSync(FB_MD)) fs.writeFileSync(FB_MD, '# YapUI — feedback log\n\nServing: ' + HTML_FILE + '\nNewest entries at the bottom.\n');

function countLines(f) { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length; } catch (e) { return 0; } }
let fbLines = countLines(FB_JSONL);

/* ---- SSE: the push channel that replaces browser polling ---- */
const sseClients = new Set();
function sseSend(res, ev, data) { try { res.write('event: ' + ev + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch (e) {} }
function broadcast(ev, data) { sseClients.forEach(function (c) { sseSend(c, ev, data); }); }
setInterval(function () { sseClients.forEach(function (c) { try { c.write(': ping\n\n'); } catch (e) {} }); }, 25000).unref();

function widgetVersion() { let wv = 0; try { wv = fs.statSync(WIDGET_FILE).mtimeMs; } catch (e) {} return Math.round(wv) + ':' + BOOT; }
function tasksText() { try { return fs.readFileSync(TASKS, 'utf8'); } catch (e) { return ''; } }

let tasksPushT = null;
function pushTasks() { // debounced so a burst of flips lands as one paint
  if (tasksPushT) return;
  tasksPushT = setTimeout(function () { tasksPushT = null; broadcast('tasks', { text: tasksText() }); }, 25);
}

/* ---- task queue plumbing (single choke point → every write is pushed) ---- */
const knownTasks = new Set();
tasksText().split('\n').filter(Boolean).forEach(function (l) { try { const o = JSON.parse(l); if (o.type === 'task') knownTasks.add(o.id); } catch (e) {} });
function appendTask(rec) { fs.appendFileSync(TASKS, JSON.stringify(rec) + '\n'); pushTasks(); }
function ensureTask(id, text, screen) {
  id = String(id || '').slice(0, 64); // canonicalize exactly like appendTask writes it, so dedup matches the file (see canonId)
  if (!id || knownTasks.has(id)) return;
  appendTask({ type: 'task', id: id, text: (text || '(no note)').toString().slice(0, 2000), screen: (screen || 'page').toString().slice(0, 200), status: 'queued', ts: new Date().toISOString() });
  knownTasks.add(id); // only after the append actually landed — a failed write must not poison the dedup set
}

let repliesSeen = countLines(REPLIES);
function pushReply(text) {
  fs.appendFileSync(REPLIES, JSON.stringify({ ts: new Date().toISOString(), text: text }) + '\n');
  repliesSeen++;
  broadcast('reply', { text: text, n: repliesSeen });
}
// external writers (fallback watcher mode uses flip-status.js + appendFile) still get pushed live
function watchFile(f, onChange) { try { fs.watch(f, onChange); } catch (e) {} fs.watchFile(f, { interval: 500 }, onChange); }
watchFile(TASKS, pushTasks);
watchFile(REPLIES, function () {
  const lines = (function () { try { return fs.readFileSync(REPLIES, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; } })();
  for (; repliesSeen < lines.length; repliesSeen++) {
    try { broadcast('reply', { text: JSON.parse(lines[repliesSeen]).text, n: repliesSeen + 1 }); } catch (e) {}
  }
});
watchFile(WIDGET_FILE, function () { broadcast('version', { v: widgetVersion() }); });

/* ---- the resident fix agent (pre-warmed at relay start) ---- */
const agent = agentMod.create({
  htmlFile: HTML_FILE,
  workdir: WORKDIR,
  log: function (line) { process.stdout.write('[agent] ' + line + '\n'); },
  onTask: appendTask,
  onReply: pushReply,
  onState: function (state, label) { broadcast('agent', { state: state, label: label }); }
});

function newId() { return 'srv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function canonId(id) { return String(id || '').slice(0, 64); } // ONE id format everywhere — task recs, status recs, agent flips
// the agent has no shell — pre-extract a recording's contact sheet here (fixed args, workdir-contained paths)
function extractFrames(item) {
  if (!item.recording) return Promise.resolve();
  return new Promise(function (resolve) {
    const framesRel = item.recording + '.frames.png';
    let child;
    try { child = spawn('ffmpeg', ['-y', '-i', path.join(WORKDIR, item.recording), '-vf', 'fps=4,scale=400:-1,tile=8x8', '-frames:v', '1', path.join(WORKDIR, framesRel)], { stdio: 'ignore' }); }
    catch (e) { return resolve(); } // no ffmpeg → agent goes by the note text
    const t = setTimeout(function () { try { child.kill('SIGKILL'); } catch (e) {} }, 20000);
    child.on('error', function () { clearTimeout(t); resolve(); });
    child.on('close', function (code) {
      clearTimeout(t);
      if (code === 0 && fs.existsSync(path.join(WORKDIR, framesRel))) item.frames = framesRel;
      resolve();
    });
  });
}
let handoffChain = Promise.resolve(); // notes reach the agent strictly in arrival (line) order, even when one waits on ffmpeg
function handoff(item) { // → resident agent; falls through silently in watcher mode
  item.taskId = canonId(item.taskId);
  ensureTask(item.taskId, item.text || item.note || (item.element ? 'element ' + (item.element.id || item.element.tag) : (item.recording ? 'clip' : item.screenshot ? 'screenshot' : '(no note)')), item.screen);
  handoffChain = handoffChain.then(function () { return extractFrames(item); }).then(function () { agent.onFeedback(item); })
    .catch(function (e) { console.error('[relay] handoff failed: ' + (e && e.message)); }); // a failed note must not wedge the chain — the catch re-seeds it so later notes still flow
}

function inject(html) {
  const tag = '<script src="/__feedback.js" defer></script>';
  return html.indexOf('</body>') !== -1 ? html.replace('</body>', tag + '\n</body>') : html + tag;
}
// a random web page must not be able to POST into the relay (it edits files);
// browsers send Origin on cross-origin POSTs — allow only our own origin (or none: curl, same-origin forms)
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { const u = new URL(o); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && String(u.port || (u.protocol === 'http:' ? 80 : 443)) === String(PORT); }
  catch (e) { return false; }
}
// and DNS rebinding (evil.example resolving to 127.0.0.1) must not reach ANY route, GETs included —
// the browser's same-origin wall doesn't help when the attacker's hostname resolves here, so pin the Host header
function hostOk(req) {
  const h = String(req.headers.host || '');
  return h === 'localhost:' + PORT || h === '127.0.0.1:' + PORT || h === '[::1]:' + PORT;
}
function guarded(res, fn) { // req 'end' callbacks run outside the request try/catch — a throw here must 500, not crash the relay
  return function () { try { fn.apply(null, arguments); } catch (e) { try { res.writeHead(500); res.end('{"ok":false}'); } catch (e2) {} } };
}
const HTML_DIR = path.dirname(path.resolve(HTML_FILE));
let HTML_DIR_REAL = HTML_DIR; try { HTML_DIR_REAL = fs.realpathSync(HTML_DIR); } catch (e) {}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };
function serveSibling(url, res) { // css/js/images referenced by the HTML live next to it — serve them, never anything outside
  let rel; try { rel = decodeURIComponent(url).replace(/^\/+/, ''); } catch (e) { return false; }
  if (!rel || rel.indexOf('\0') !== -1 || rel.split('/').some(function (seg) { return seg === '..' || seg[0] === '.'; })) return false;
  const abs = path.resolve(HTML_DIR, rel);
  if (!(abs + path.sep).startsWith(HTML_DIR + path.sep)) return false;
  // resolve symlinks before serving — a link inside HTML_DIR must not smuggle out a file from beyond it
  let real; try { real = fs.realpathSync(abs); } catch (e) { return false; }
  if (!(real + path.sep).startsWith(HTML_DIR_REAL + path.sep)) return false;
  let st; try { st = fs.statSync(real); } catch (e) { return false; }
  if (!st.isFile()) return false;
  // read before writeHead — a delete/replace race after the stat must 404, not die after the 200 is flushed
  let body; try { body = fs.readFileSync(real); } catch (e) { return false; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
  return true;
}
function appendMd(s) { fs.appendFileSync(FB_MD, s); }
function elementMd(el) {
  if (!el || !el.selector) return '';
  var r = el.rect ? ('  ·  [' + el.rect.x + ',' + el.rect.y + ' ' + el.rect.w + '×' + el.rect.h + ']') : '';
  return '\n**element:** `' + el.selector + '`' + (el.text ? ' — "' + el.text + '"' : '') + r + '\n';
}
function cursorMd(c) { if (!c || !c.desc) return ''; return '\n**pointing at (at send):** `' + String(c.desc).slice(0, 200) + '`\n'; }
function fmtMs(ms) { var s = Math.floor((+ms || 0) / 1000); return Math.floor(s / 60) + ':' + ((s % 60) < 10 ? '0' : '') + (s % 60); }
function cleanArr(arr) { return Array.isArray(arr) ? arr.filter(function (p) { return p && typeof p === 'object'; }) : []; }
function pointingMd(arr) { arr = cleanArr(arr); if (!arr.length) return ''; var o = '\n**pointing timeline during message:**\n'; arr.slice(0, 60).forEach(function (p) { o += '- ' + fmtMs(p.ms) + '  ' + String(p.desc || '').slice(0, 120) + '\n'; }); return o; }
function voiceMd(arr) { arr = cleanArr(arr); if (!arr.length) return ''; var o = '\n**what you said (timeline — same clock as the pointing trail):**\n'; arr.slice(0, 80).forEach(function (p) { o += '- ' + fmtMs(p.ms) + '  "' + String(p.t || '').slice(0, 80) + '"\n'; }); return o; }

const server = http.createServer(function (req, res) {
  try {
    const url = (req.url || '/').split('?')[0];
    if (!hostOk(req)) { res.writeHead(403); return res.end('{"ok":false,"error":"bad host"}'); }
    if (req.method === 'POST' && !originOk(req)) { res.writeHead(403); return res.end('{"ok":false,"error":"cross-origin"}'); }

    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      const html = fs.readFileSync(HTML_FILE, 'utf8'); // re-read each load -> HTML edits show on refresh
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(inject(html));
    }
    if (req.method === 'GET' && url === '/__feedback.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(WIDGET_FILE, 'utf8'));
    }

    // ---- SSE stream: tasks / replies / agent state / widget version, pushed the instant they change ----
    if (req.method === 'GET' && url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
      res.write('retry: 1500\n\n');
      sseClients.add(res);
      req.on('close', function () { sseClients.delete(res); });
      // seed the fresh client with the full current state — no follow-up fetches needed
      sseSend(res, 'hello', { agent: agent.status(), tasks: tasksText(), replies: repliesSeen, v: widgetVersion() });
      return;
    }
    if (req.method === 'GET' && url === '/agent') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(agent.status()));
    }

    if (req.method === 'GET' && url === '/version') {  // widget mtime + boot id → the page self-reloads when either changes
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ v: widgetVersion() }));
    }
    if (req.method === 'GET' && url === '/replies') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.existsSync(REPLIES) ? fs.readFileSync(REPLIES, 'utf8') : '');
    }
    if (req.method === 'GET' && url === '/feedback.jsonl') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(fs.existsSync(FB_JSONL) ? fs.readFileSync(FB_JSONL, 'utf8') : '');
    }

    // ---- task queue (the widget's to-do board; agent + flip-status.js flip statuses) ----
    if (req.method === 'GET' && url === '/tasks') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(tasksText());
    }
    if (req.method === 'POST' && url === '/task') {
      let body = ''; req.on('data', function (c) { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', guarded(res, function () { let t; try { t = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        if (!t.id) { res.writeHead(400); return res.end('{"ok":false}'); }
        ensureTask(t.id, t.text, t.screen);
        process.stdout.write('[task+] ' + t.id + ' :: ' + String(t.text || '').replace(/\n/g, ' ') + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }));
      return;
    }
    if (req.method === 'POST' && url === '/task/dismiss') {
      let body = ''; req.on('data', function (c) { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', guarded(res, function () { let t; try { t = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        if (!t.id) { res.writeHead(400); return res.end('{"ok":false}'); }
        appendTask({ type: 'status', id: String(t.id).slice(0, 64), status: 'dismissed', note: '', ts: new Date().toISOString() });
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }));
      return;
    }
    if (req.method === 'POST' && url === '/tasks/clear') {
      try { fs.writeFileSync(TASKS, ''); knownTasks.clear(); pushTasks(); } // memory clears only if the truncate landed
      catch (e) { res.writeHead(500); return res.end('{"ok":false}'); }
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}');
    }
    // ---- live cursor presence (last-known position; also rides along with each feedback) ----
    if (req.method === 'GET' && url === '/cursor') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(fs.existsSync(CURSOR) ? fs.readFileSync(CURSOR, 'utf8') : '{}');
    }
    if (req.method === 'POST' && url === '/cursor') {
      let body = ''; req.on('data', function (c) { body += c; if (body.length > 2e4) req.destroy(); });
      req.on('end', guarded(res, function () { let c; try { c = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        var rec = { desc: (c.desc || '').toString().slice(0, 300), label: (c.label || c.phone || '').toString().slice(0, 60), scene: (c.scene || '').toString().slice(0, 40), el: (c.el || '').toString().slice(0, 200), x: +c.x || 0, y: +c.y || 0, ts: c.ts || new Date().toISOString() };
        try { fs.writeFileSync(CURSOR, JSON.stringify(rec)); } catch (e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }));
      return;
    }

    if (req.method === 'POST' && url === '/feedback') {
      let body = '';
      req.on('data', function (c) { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', guarded(res, function () {
        let fb;
        try { fb = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        fb.ts = fb.ts || new Date().toISOString();
        fb.screen = (fb.screen || 'page').toString().slice(0, 200);
        fb.text = (fb.text || '').toString().slice(0, 5000);
        // media refs (uploaded first via /upload or /shot) ride along in the JSON body — workdir-relative only
        const mediaRe = /^(recordings|screenshots)\/[\w][\w.-]*$/;
        fb.recording = (typeof fb.recording === 'string' && mediaRe.test(fb.recording)) ? fb.recording : null;
        fb.screenshot = (typeof fb.screenshot === 'string' && mediaRe.test(fb.screenshot)) ? fb.screenshot : null;
        if (!fb.text.trim() && !fb.element && !fb.recording && !fb.screenshot) { res.writeHead(400); return res.end('{"ok":false}'); }
        fs.appendFileSync(FB_JSONL, JSON.stringify(fb) + '\n'); fbLines++;
        appendMd('\n---\n**' + new Date(fb.ts).toLocaleString() + '**  ·  ' + fb.screen + (fb.voice ? '  ·  🎙 (talk)' : '')
          + (fb.recording ? '  ·  (recording · ' + (fb.secs || '?') + 's)' : '') + (fb.screenshot ? '  ·  (screenshot)' : '') + '\n\n'
          + (fb.text.trim() ? '> ' + fb.text.replace(/\n/g, '\n> ') + '\n' : '') + elementMd(fb.element) + cursorMd(fb.cursor) + pointingMd(fb.pointing) + voiceMd(fb.voiceMarks)
          + (fb.recording ? '\nrecording: `' + fb.recording + '`\n' : '') + (fb.screenshot ? '\nscreenshot: `' + fb.screenshot + '`\n' : ''));
        process.stdout.write('[feedback] ' + fb.screen + ' :: ' + fb.text.replace(/\n/g, ' ') + (fb.element ? ' {el:' + fb.element.selector + '}' : '') + (fb.recording ? ' {rec}' : '') + (fb.screenshot ? ' {shot}' : '') + '\n');
        handoff({ taskId: fb.taskId || newId(), line: fbLines, text: fb.text.trim(), screen: fb.screen, voice: !!fb.voice, element: fb.element || null, cursor: fb.cursor || null, pointing: fb.pointing || null, voiceMarks: fb.voiceMarks || null, recording: fb.recording, screenshot: fb.screenshot, secs: fb.secs });
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      }));
      return;
    }

    // binary saves only — the note/element/cursor metadata follows as a normal JSON /feedback
    // carrying the returned file ref (headers have hard size limits; bodies don't).
    // Streamed straight to disk: a 200MB recording must not be buffered (twice) in memory.
    if (req.method === 'POST' && (url === '/upload' || url === '/shot')) {
      const isClip = url === '/upload';
      const limit = isClip ? 200e6 : 50e6;
      const dir = isClip ? REC_DIR : SHOT_DIR;
      try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) { res.writeHead(500); return res.end('{"ok":false}'); }
      const name = (isClip ? 'clip-' : 'shot-') + new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 6) + (isClip ? '.webm' : '.png');
      const abs = path.join(dir, name);
      const out = fs.createWriteStream(abs);
      let size = 0, failed = false;
      function fail(code) { if (failed) return; failed = true; try { out.destroy(); } catch (e) {} fs.unlink(abs, function () {}); try { res.writeHead(code); res.end('{"ok":false}'); } catch (e) {} }
      req.on('data', function (c) { size += c.length; if (size > limit) { req.destroy(); fail(413); } });
      req.pipe(out);
      out.on('error', function () { fail(500); });
      req.on('error', function () { fail(500); });
      out.on('finish', function () {
        if (failed) return;
        const file = (isClip ? 'recordings/' : 'screenshots/') + name;
        process.stdout.write('[' + (isClip ? 'recording' : 'screenshot') + '] ' + name + ' (' + Math.round(size / 1024) + ' KB)\n');
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, file: file }));
      });
      return;
    }

    if (req.method === 'GET' && serveSibling(url, res)) return;

    res.writeHead(404); res.end('not found');
  } catch (e) { res.writeHead(500); res.end('error: ' + (e && e.message)); }
});

function shutdown() { try { agent.kill(); } catch (e) {} process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

server.on('error', function (e) { console.error('SERVER ERROR: ' + e.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', function () {
  console.log('YapUI relay  →  http://localhost:' + PORT + '/');
  console.log('serving  →  ' + HTML_FILE);
  console.log('workdir  →  ' + WORKDIR);
  console.log('agent    →  ' + (agent.enabled ? 'warming (instant-fix mode)' : 'off (watcher mode)'));
});
