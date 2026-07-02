// Flip a feedback-queue card's status (used by Claude to drive the queue UI).
//   node flip-status.js <workdir> <id> <queued|working|done|needs-you|dismissed> [note...]
const fs = require('fs'), path = require('path');
const STATUSES = ['queued', 'working', 'done', 'needs-you', 'dismissed'];
const [workdir, id, status, ...n] = process.argv.slice(2);
if (!workdir || !id || !status) { console.error('usage: node flip-status.js <workdir> <id> <status> [note]'); process.exit(1); }
if (STATUSES.indexOf(status) === -1) { console.error('flip-status: status must be one of ' + STATUSES.join('|')); process.exit(1); }
const rec = { type: 'status', id: String(id).slice(0, 64), status, note: n.join(' '), ts: new Date().toISOString() }; // same 64-char canonical id the relay writes
fs.appendFileSync(path.join(workdir, 'tasks.jsonl'), JSON.stringify(rec) + '\n');
console.log('task', id, '→', status, n.length ? '(' + rec.note + ')' : '');
