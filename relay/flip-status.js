// Flip a feedback-queue card's status (used by Claude to drive the queue UI).
//   node flip-status.js <workdir> <id> <queued|working|done|needs-you|dismissed> [note...]
const fs = require('fs'), path = require('path');
const [workdir, id, status, ...n] = process.argv.slice(2);
if (!workdir || !id || !status) { console.error('usage: node flip-status.js <workdir> <id> <status> [note]'); process.exit(1); }
const rec = { type: 'status', id, status, note: n.join(' '), ts: new Date().toISOString() };
fs.appendFileSync(path.join(workdir, 'tasks.jsonl'), JSON.stringify(rec) + '\n');
console.log('task', id, '→', status, n.length ? '(' + rec.note + ')' : '');
