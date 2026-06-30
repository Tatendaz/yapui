// YapUI relay — serves a target HTML over http://localhost (so mic +
// screen capture work) and injects the feedback widget. Notes / voice /
// recordings / screenshots / picked elements POST here and are written under
// WORKDIR, which Claude reads.
//
//   HTML_FILE  (required)  path to the .html to serve
//   WORKDIR    (optional)  where to write feedback artifacts (default: <html dir>/.yapui)
//   PORT       (optional)  default 8765
const http = require('http');
const fs = require('fs');
const path = require('path');

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

function inject(html) {
  const tag = '<script src="/__feedback.js" defer></script>';
  return html.indexOf('</body>') !== -1 ? html.replace('</body>', tag + '\n</body>') : html + tag;
}
function appendMd(s) { fs.appendFileSync(FB_MD, s); }
function elementMd(el) {
  if (!el || !el.selector) return '';
  var r = el.rect ? ('  ·  [' + el.rect.x + ',' + el.rect.y + ' ' + el.rect.w + '×' + el.rect.h + ']') : '';
  return '\n**element:** `' + el.selector + '`' + (el.text ? ' — "' + el.text + '"' : '') + r + '\n';
}
function b64(h) { try { return h ? Buffer.from(h, 'base64').toString('utf8') : ''; } catch (e) { return ''; } }
function cursorMd(c) { if (!c || !c.desc) return ''; return '\n**pointing at (at send):** `' + String(c.desc).slice(0, 200) + '`\n'; }
function fmtMs(ms) { var s = Math.floor((+ms || 0) / 1000); return Math.floor(s / 60) + ':' + ((s % 60) < 10 ? '0' : '') + (s % 60); }
function pointingMd(arr) { if (!Array.isArray(arr) || !arr.length) return ''; var o = '\n**pointing timeline during message:**\n'; arr.slice(0, 60).forEach(function (p) { o += '- ' + fmtMs(p.ms) + '  ' + String(p.desc || '').slice(0, 120) + '\n'; }); return o; }
function voiceMd(arr) { if (!Array.isArray(arr) || !arr.length) return ''; var o = '\n**what you said (timeline — same clock as the pointing trail):**\n'; arr.slice(0, 80).forEach(function (p) { o += '- ' + fmtMs(p.ms) + '  "' + String(p.t || '').slice(0, 80) + '"\n'; }); return o; }

const server = http.createServer(function (req, res) {
  try {
    const url = (req.url || '/').split('?')[0];

    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      const html = fs.readFileSync(HTML_FILE, 'utf8'); // re-read each load -> HTML edits show on refresh
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(inject(html));
    }
    if (req.method === 'GET' && url === '/__feedback.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(WIDGET_FILE, 'utf8'));
    }
    if (req.method === 'GET' && url === '/version') {  // widget mtime + boot id → the page self-reloads when either changes
      var wv = 0; try { wv = fs.statSync(WIDGET_FILE).mtimeMs; } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ v: Math.round(wv) + ':' + BOOT }));
    }
    if (req.method === 'GET' && url === '/replies') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.existsSync(REPLIES) ? fs.readFileSync(REPLIES, 'utf8') : '');
    }
    if (req.method === 'GET' && url === '/feedback.jsonl') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(fs.existsSync(FB_JSONL) ? fs.readFileSync(FB_JSONL, 'utf8') : '');
    }

    // ---- task queue (the widget's to-do board; Claude flips statuses via flip-status.js) ----
    if (req.method === 'GET' && url === '/tasks') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.existsSync(TASKS) ? fs.readFileSync(TASKS, 'utf8') : '');
    }
    if (req.method === 'POST' && url === '/task') {
      let body = ''; req.on('data', function (c) { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', function () { let t; try { t = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        if (!t.id) { res.writeHead(400); return res.end('{"ok":false}'); }
        var rec = { type: 'task', id: String(t.id).slice(0, 64), text: (t.text || '').toString().slice(0, 2000), screen: (t.screen || 'page').toString().slice(0, 200), status: 'queued', ts: t.ts || new Date().toISOString() };
        fs.appendFileSync(TASKS, JSON.stringify(rec) + '\n');
        process.stdout.write('[task+] ' + rec.id + ' :: ' + rec.text.replace(/\n/g, ' ') + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
      return;
    }
    if (req.method === 'POST' && url === '/task/dismiss') {
      let body = ''; req.on('data', function (c) { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', function () { let t; try { t = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        if (!t.id) { res.writeHead(400); return res.end('{"ok":false}'); }
        fs.appendFileSync(TASKS, JSON.stringify({ type: 'status', id: String(t.id).slice(0, 64), status: 'dismissed', note: '', ts: new Date().toISOString() }) + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
      return;
    }
    if (req.method === 'POST' && url === '/tasks/clear') {
      try { fs.writeFileSync(TASKS, ''); } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}');
    }
    // ---- live cursor presence (last-known position; also rides along with each feedback) ----
    if (req.method === 'GET' && url === '/cursor') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(fs.existsSync(CURSOR) ? fs.readFileSync(CURSOR, 'utf8') : '{}');
    }
    if (req.method === 'POST' && url === '/cursor') {
      let body = ''; req.on('data', function (c) { body += c; if (body.length > 2e4) req.destroy(); });
      req.on('end', function () { let c; try { c = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        var rec = { desc: (c.desc || '').toString().slice(0, 300), label: (c.label || c.phone || '').toString().slice(0, 60), scene: (c.scene || '').toString().slice(0, 40), el: (c.el || '').toString().slice(0, 200), x: +c.x || 0, y: +c.y || 0, ts: c.ts || new Date().toISOString() };
        try { fs.writeFileSync(CURSOR, JSON.stringify(rec)); } catch (e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
      return;
    }

    if (req.method === 'POST' && url === '/feedback') {
      let body = '';
      req.on('data', function (c) { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', function () {
        let fb;
        try { fb = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('{"ok":false}'); }
        fb.ts = fb.ts || new Date().toISOString();
        fb.screen = (fb.screen || 'page').toString().slice(0, 200);
        fb.text = (fb.text || '').toString().slice(0, 5000);
        if (!fb.text.trim() && !fb.element) { res.writeHead(400); return res.end('{"ok":false}'); }
        fs.appendFileSync(FB_JSONL, JSON.stringify(fb) + '\n');
        appendMd('\n---\n**' + new Date(fb.ts).toLocaleString() + '**  ·  ' + fb.screen + (fb.voice ? '  ·  🎙 (talk)' : '') + '\n\n'
          + (fb.text.trim() ? '> ' + fb.text.replace(/\n/g, '\n> ') + '\n' : '') + elementMd(fb.element) + cursorMd(fb.cursor) + pointingMd(fb.pointing) + voiceMd(fb.voiceMarks));
        process.stdout.write('[feedback] ' + fb.screen + ' :: ' + fb.text.replace(/\n/g, ' ') + (fb.element ? ' {el:' + fb.element.selector + '}' : '') + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      });
      return;
    }

    if (req.method === 'POST' && url === '/upload') {
      const chunks = []; let size = 0;
      req.on('data', function (c) { chunks.push(c); size += c.length; if (size > 200e6) req.destroy(); });
      req.on('end', function () {
        try {
          if (!fs.existsSync(REC_DIR)) fs.mkdirSync(REC_DIR, { recursive: true });
          const buf = Buffer.concat(chunks); const name = 'clip-' + new Date().toISOString().replace(/[:.]/g, '-') + '.webm';
          fs.writeFileSync(path.join(REC_DIR, name), buf);
          const note = b64(req.headers['x-note']); const screen = req.headers['x-screen'] ? decodeURIComponent(req.headers['x-screen']) : 'page'; const secs = req.headers['x-secs'] || '?';
          const cur = b64(req.headers['x-cursor']); let pts = []; try { pts = JSON.parse(b64(req.headers['x-pointing']) || '[]'); } catch (e) {}
          appendMd('\n---\n**' + new Date().toLocaleString() + '**  ·  ' + screen + '  ·  (recording · ' + secs + 's · ' + Math.round(buf.length / 1024) + ' KB)\n\n'
            + (note ? '> ' + note.replace(/\n/g, '\n> ') + '\n\n' : '') + 'recording: `recordings/' + name + '`\n' + cursorMd({ desc: cur }) + pointingMd(pts));
          fs.appendFileSync(FB_JSONL, JSON.stringify({ ts: new Date().toISOString(), screen: screen, recording: 'recordings/' + name, note: note, secs: secs, task: (req.headers['x-task'] || ''), cursor: cur, pointing: pts }) + '\n');
          process.stdout.write('[recording] ' + name + '\n');
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, file: 'recordings/' + name }));
        } catch (e) { res.writeHead(500); res.end(JSON.stringify({ ok: false, error: e.message })); }
      });
      return;
    }

    if (req.method === 'POST' && url === '/shot') {
      const chunks = []; let size = 0;
      req.on('data', function (c) { chunks.push(c); size += c.length; if (size > 50e6) req.destroy(); });
      req.on('end', function () {
        try {
          if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
          const buf = Buffer.concat(chunks); const name = 'shot-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
          fs.writeFileSync(path.join(SHOT_DIR, name), buf);
          const note = b64(req.headers['x-note']); const screen = req.headers['x-screen'] ? decodeURIComponent(req.headers['x-screen']) : 'page';
          let element = null; try { if (req.headers['x-element']) element = JSON.parse(b64(req.headers['x-element'])); } catch (e) {}
          const cur = b64(req.headers['x-cursor']); let pts = []; try { pts = JSON.parse(b64(req.headers['x-pointing']) || '[]'); } catch (e) {}
          appendMd('\n---\n**' + new Date().toLocaleString() + '**  ·  ' + screen + '  ·  (screenshot)\n\n'
            + (note ? '> ' + note.replace(/\n/g, '\n> ') + '\n' : '') + elementMd(element) + cursorMd({ desc: cur }) + pointingMd(pts) + '\nscreenshot: `screenshots/' + name + '`\n');
          fs.appendFileSync(FB_JSONL, JSON.stringify({ ts: new Date().toISOString(), screen: screen, screenshot: 'screenshots/' + name, element: element, note: note, task: (req.headers['x-task'] || ''), cursor: cur, pointing: pts }) + '\n');
          process.stdout.write('[screenshot] ' + name + '\n');
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, file: 'screenshots/' + name }));
        } catch (e) { res.writeHead(500); res.end(JSON.stringify({ ok: false, error: e.message })); }
      });
      return;
    }

    res.writeHead(404); res.end('not found');
  } catch (e) { res.writeHead(500); res.end('error: ' + (e && e.message)); }
});

server.on('error', function (e) { console.error('SERVER ERROR: ' + e.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', function () {
  [WORKDIR, REC_DIR, SHOT_DIR].forEach(function (d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
  if (!fs.existsSync(FB_MD)) fs.writeFileSync(FB_MD, '# HTML preview — feedback log\n\nServing: ' + HTML_FILE + '\nNewest entries at the bottom.\n');
  console.log('YapUI relay  →  http://localhost:' + PORT + '/');
  console.log('serving  →  ' + HTML_FILE);
  console.log('workdir  →  ' + WORKDIR);
});
