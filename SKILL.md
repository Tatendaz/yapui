---
name: yapui
description: >-
  View, preview, open, render, or serve any HTML file/page/mockup/prototype in the browser with a live two-way feedback loop. Use this whenever the user wants to look at HTML in a browser, see a rendered page, preview a mockup or prototype, or iterate on an HTML UI — instead of a bare `open file.html` (file:// blocks the mic + screen capture and gives no feedback channel). It serves the HTML from a local relay, injects a feedback widget (typed notes, voice dictation, screen recording, screenshots, and click-to-pick element selection), shows an ambient "👀 Claude is watching" indicator plus working/done status, and runs a background watcher so Claude auto-processes feedback the instant it is sent, applies the fix, and replies in the browser. Trigger for ANY request to view / preview / serve / open / render HTML.
---

# YapUI — HTML Live Preview + Feedback

Turns "open this HTML" into a live loop: the user views the page in their browser and gives feedback by **typing, talking, recording the screen, screenshotting, or clicking to pick an element** — and you (Claude) pick it up in real time, fix it, and reply in the browser. They never have to come back to the terminal.

The backend relay and the injected widget live next to this file under `relay/` (`relay/server.js`, `relay/widget.js`). This skill folder is referred to below as `<SKILL_DIR>` (e.g. `~/.claude/skills/yapui`).

## When to use
Any request to **see / preview / open / serve / render** an HTML file in the browser — a mockup, prototype, report, component, or page. Prefer this over `open file.html`.

## Launch (do these)

Target HTML = **$HTML** (absolute path).

1. **Free port** — try 8765, then 8766, 8780, 8790 (`lsof -iTCP:$p -sTCP:LISTEN -t` empty = free).
2. **Workdir** for feedback artifacts — default `"$(dirname "$HTML")/.yapui"` (safe to gitignore/delete).
3. **Start the relay (background, `run_in_background: true`):**
   ```sh
   PORT=<port> HTML_FILE="$HTML" WORKDIR="<workdir>" node "<SKILL_DIR>/relay/server.js"
   ```
4. **Wait, then open:**
   ```sh
   curl -s --retry 30 --retry-delay 1 --retry-connrefused -o /dev/null "http://localhost:<port>/"
   open -a "Google Chrome" "http://localhost:<port>/"   # macOS; Linux: xdg-open; Windows: start
   ```
5. **Tell the user** it's live and how to give feedback in the browser: the **Feedback** button (bottom-left, or press `f`) → **type · 🎙 Talk · 🎬 Record · 📸 Snap · 🎯 Pick**. Mic / screen-share prompts are normal; everything stays on their machine.
6. **Arm the watcher (background, `run_in_background: true`)** — marker-based so it never skips a note:
   ```sh
   FB="<workdir>/feedback.jsonl"; MARK="<workdir>/.fb-processed"
   [ -f "$MARK" ] || { wc -l < "$FB" 2>/dev/null | tr -d ' ' > "$MARK" 2>/dev/null || echo 0 > "$MARK"; }
   c=0; while [ $c -lt 5400 ]; do
     now=$(wc -l < "$FB" 2>/dev/null | tr -d ' '); now=${now:-0}
     seen=$(cat "$MARK" 2>/dev/null | tr -d ' '); seen=${seen:-0}
     [ "${now:-0}" -gt "${seen:-0}" ] && { echo "NEW_FEEDBACK seen=$seen now=$now"; exit 0; }
     c=$((c+1)); sleep 1
   done; echo WATCH_IDLE_TIMEOUT
   ```

## When the watcher fires (you get a task-notification)

1. **Read `<workdir>/feedback.md`** — newest at the bottom. Besides the note + page/context, an entry may carry **`pointing at` / `pointing timeline`** lines (where the user's cursor was *during* the message) — use them to resolve "make **this** bigger" / "move **that**" to the actual element, especially in **🎙 (talk)** notes where they point while speaking. A talk note also gets a **`what you said (timeline)`** on the *same clock* as the pointing trail — line up the spoken word with the cursor position to know exactly what "this" was. It may also reference a picked element, a recording, or a screenshot.
2. **Look at any attached media:**
   - Screenshot (`<workdir>/screenshots/*.png`) → Read it.
   - Recording (`<workdir>/recordings/*.webm`) → see the motion via frames:
     `ffmpeg -y -i <clip> -vf "fps=4,scale=400:-1,tile=8x8" -frames:v 1 /tmp/sheet.png` → Read it; for a fast transition zoom in: `-ss <t> -t <dur> -vf "fps=18,scale=560:-1,tile=6x5"`.
   - Picked element → `element.selector` / `data-*` / text point you straight at the DOM node in the HTML source.
3. **Flip the card to working, then apply the fix.** Each note is a queue card whose id is its `taskId`:
   `node "<SKILL_DIR>/relay/flip-status.js" "<workdir>" <taskId> working`
   Then edit the HTML. The relay re-reads the file each load, so the user just **refreshes** to see HTML changes — no restart. (Restart the relay only if you edit `relay/server.js` or `relay/widget.js`.)
4. **Verify when it matters** by rendering with headless Chrome / Playwright (`chromium.launch({channel:'chrome'})`, `playwright-core` avoids a browser download) against `http://localhost:<port>/` and Reading the screenshot.
5. **Reply in the browser** — append one line to `<workdir>/claude-replies.jsonl`:
   ```sh
   node -e 'const fs=require("fs");fs.appendFileSync(process.argv[1],JSON.stringify({ts:new Date().toISOString(),text:process.argv[2]})+"\n")' \
     "<workdir>/claude-replies.jsonl" "Fixed X — refresh to see."
   node "<SKILL_DIR>/relay/flip-status.js" "<workdir>" <taskId> done   # or: needs-you (a question you can't action)
   ```
   The widget shows the reply and flips the card. When **every** card is `done` the page auto-refreshes; a `needs-you` card blocks that so a question is never refreshed away. The user can ✕ any card to remove it.
6. **Advance the marker to the watcher's reported `now`, then re-arm:**
   `echo <now> > "<workdir>/.fb-processed"` (the `now` from `NEW_FEEDBACK seen=X now=Y`) — **not** a fresh `wc -l`. A note that arrived while you were working sits *above* `now`, so the re-armed watcher fires for it; re-counting the file here would mark it seen and silently drop it. Then start the watcher loop again.

Keep a short terminal note too, but the in-browser reply is the primary channel.

## Browser states the user sees
- **Task queue (top-right)** — each note becomes a card: 🔴 queued → 🟠 ⛏️ working → ✅ done (🙋 needs-you). All cards green → the page auto-refreshes; ✕ removes a card. A 🖥 line under the header shows what their cursor is over.
- **👀 Claude is watching** (bottom-right, blinks) — idle/armed.
- **⟳ Claude is working on it…** (top-center) + the Feedback button glows — the instant they send.
- **Claude: … — refresh to see** (top-center) — when you reply, then back to 👀.

## Notes
- HTML edits → the user refreshes (or the queue auto-refreshes when all cards go green). **Widget edits self-reload the open page** automatically (it polls `/version`); `relay/server.js` edits need a relay restart, after which the page also self-reloads — so you rarely need to ask for a manual refresh. The feedback panel opens **expanded by default**, remembers a deliberate collapse, and keeps an unsent draft across reloads.
- Artifacts live under `<workdir>`: `feedback.md` (read this), `feedback.jsonl`, `recordings/`, `screenshots/`, `claude-replies.jsonl`, `.fb-processed`.
- Requirements: Node, a Chromium-based browser for voice/recording (Web Speech + getDisplayMedia), `ffmpeg` to read recordings, internet for the screenshot lib (html2canvas via CDN).

## Stop
Kill the relay and the watcher (`lsof -ti:<port> | xargs kill`; stop the watcher background task).
