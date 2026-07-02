#!/usr/bin/env node
// Stand-in for the `claude` CLI in tests — speaks just enough of the headless
// stream-json protocol for relay/agent.js: reads user messages from stdin,
// emits an Edit tool_use + a result per turn, and actually appends a marker to
// HTML_FILE (inherited from the relay's env) so tests can assert the "fix".
const fs = require('fs');

function out(o) { process.stdout.write(JSON.stringify(o) + '\n'); }
out({ type: 'system', subtype: 'init', session_id: 'fake-session', model: 'fake-model' });

let buf = '';
process.stdin.on('data', function (d) {
  buf += d;
  let ix;
  while ((ix = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, ix).trim(); buf = buf.slice(ix + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch (e) { continue; }
    const c = msg && msg.message && msg.message.content;
    const text = typeof c === 'string' ? c : (Array.isArray(c) ? c.map(function (b) { return b.text || ''; }).join(' ') : '');
    turn(text);
  }
});

function turn(text) {
  if (/^Warm-up:/.test(text)) return out({ type: 'result', subtype: 'success', result: 'READY' });
  if (/NEEDSYOU/.test(text)) return out({ type: 'result', subtype: 'success', result: 'NEEDS-YOU: Which color do you want?' });
  const note = (text.match(/"([^"]+)"/) || [null, text])[1].slice(0, 40);
  out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: process.env.HTML_FILE || '' } }] } });
  try { fs.appendFileSync(process.env.HTML_FILE, '\n<!-- fake-fix: ' + note + ' -->'); } catch (e) {}
  out({ type: 'result', subtype: 'success', result: 'Applied: ' + note });
}
