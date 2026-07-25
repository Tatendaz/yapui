<div align="center">

# 🗣️ YapUI

**Yap at your UI. Watch Claude rebuild it live.**

**YapUI is a [Claude Code](https://claude.com/claude-code) skill.** Preview any HTML in your browser and give feedback by **talking, pointing, recording, screenshotting, or typing** — a resident agent picks it up the instant you hit send, fixes it, and replies right in the page. In instant mode you never go back to the terminal.

[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg)](LICENSE)
[![Claude Code Skill](https://img.shields.io/badge/Claude%20Code-Skill-d97757.svg)](https://code.claude.com/docs/en/skills)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-2ea44f.svg)](#contributing)

![YapUI demo](docs/demo.gif)

*Say "make the hero bigger and the button red" — and watch it happen.*

</div>

---

## Why YapUI?

`open file.html` is a dead end: `file://` blocks the mic and screen capture, and there's no way to tell the AI what to change without typing it all back into the terminal.

YapUI replaces that with a **live, two-way feedback loop**:

- 🗣️ **Talk to your page** — dictate a change out loud while pointing at the thing you mean.
- 🎯 **Point & pick** — click an element to attach it to your note, so *"make **this** bigger"* just works.
- 🎬 **Record** a janky animation, 📸 **snap** a screenshot, or ⌨️ **type** a plain note.
- 👀 **Claude is watching** — an ambient indicator shows when Claude is idle, working, or done.
- 🔁 **It replies in the browser** and the page refreshes itself — no terminal round-trips.

It's not just a live server. It's the *conversation* on top of one.

## Install

**Before you start:**

- **Node.js** — the relay is plain Node with zero dependencies.
- **Claude Code** (`claude` on PATH) for instant mode — without it YapUI falls back to watcher mode.
- A **Chromium-based browser** (Chrome / Edge / Brave) for voice + screen recording (Web Speech + `getDisplayMedia`).
- **`ffmpeg`** — only if you want Claude to read screen recordings.
- Internet access for the screenshot library (`html2canvas`, loaded via CDN).

### For humans

**Option A — one command, via [skills.sh](https://www.skills.sh):**

```bash
npx skills add tatendaz/yapui        # this project — or add -g for all your projects
```

Works for Claude Code, Cursor, Codex, and dozens of other agents — the CLI asks which to install to.

**Option B — personal skill (all your projects):**

```bash
git clone https://github.com/Tatendaz/yapui ~/.claude/skills/yapui
```

**Option C — project skill (just one repo, shareable with your team):**

```bash
git clone https://github.com/Tatendaz/yapui .claude/skills/yapui
```

**Option D — as a plugin (inside Claude Code):**

```text
/plugin marketplace add Tatendaz/yapui
/plugin install yapui@yapui-marketplace
```

However you install it, Claude Code loads YapUI **on the next session** — not live. Restart Claude Code, or run `/reload-plugins` to pick it up right away. Then verify: `/yapui` should be there whichever route you took. In `/plugin` the name depends on the route — options A–C appear under *Skills-directory plugins* as `yapui@skills-dir`, option D under its marketplace as `yapui@yapui-marketplace`. Or just ask Claude to *"preview some HTML"*.

**Update / uninstall:**

```bash
git -C ~/.claude/skills/yapui pull      # update (personal install)
git -C .claude/skills/yapui pull        # update (project install)
npx skills update -g                    # update (skills.sh) — drop -g if you installed without it
rm -rf ~/.claude/skills/yapui           # uninstall (personal install)
rm -rf .claude/skills/yapui             # uninstall (project install)
npx skills remove yapui -g              # uninstall (skills.sh) — drop -g if you installed without it
```

`skills update` / `skills remove` default to *project* scope inside a project, so an install made with `-g` needs `-g` here too. Removing the skill also leaves your artifacts behind: a `.yapui/` folder sits next to every HTML file you previewed, and screen recordings there can reach 200 MB apiece. Delete those separately.

### For agents

If you're a human, paste this into Claude Code (or any agent with shell access):

> Install the YapUI skill: clone `https://github.com/Tatendaz/yapui` into `~/.claude/skills/yapui`, confirm `SKILL.md` exists there, then tell me how to use it.

If you're an agent reading this, these steps are deterministic:

```bash
git clone https://github.com/Tatendaz/yapui "$HOME/.claude/skills/yapui"   # install
test -f "$HOME/.claude/skills/yapui/SKILL.md" && echo "yapui installed"    # verify
git -C "$HOME/.claude/skills/yapui" pull                                    # update
```

To use it: read `SKILL.md` and follow its **Launch** section. The short version — start `relay/server.js` in the background with `PORT`, `HTML_FILE` (absolute path), and `WORKDIR` env vars; wait for `http://localhost:<port>/` to respond; open it in a browser; then `GET /agent` to check the mode: `ready`/`booting` means the resident agent owns the feedback loop (do **not** arm a watcher), `off` means run the watcher fallback described in `SKILL.md`. YapUI follows the [Agent Skills](https://agentskills.io) layout, so any SKILL.md-compatible tool can load it — but instant mode expects the `claude` CLI (it falls back to watcher mode without it).

## Usage

Just ask Claude to preview some HTML (or invoke the skill directly with `/yapui`):

```
preview index.html
```
```
open my mockup in the browser
```

Claude launches the local relay, opens the page — and the relay boots a **resident, pre-warmed Claude agent** that owns the feedback loop. Then, in the browser:

1. The feedback panel is **already open** on first load — nothing to click. (Close it and a **Feedback** button takes its place bottom-left; that button, or the `f` key, reopens the panel. A deliberate close is remembered across reloads.)
2. Choose **⌨️ type · 🎙 Talk · 🎬 Record · 📸 Snap · 🎯 Pick** and send.
3. Your note flips to 🟠 working in **~40 ms**, with a live line showing what the agent is doing ("✏️ editing index.html…"). Cards go 🔴 queued → 🟠 working → ✅ done; when every card is green, the page auto-refreshes with your changes.

Mic / screen-share prompts are normal — the browser needs them for 🎙 Talk and 🎬 Record. For what is and isn't sent anywhere, see [What leaves your machine](#what-leaves-your-machine).

## Why it's fast

The old loop was: browser → file → a shell watcher polling every second → your *main* Claude session waking up → several tool round-trips before anything visibly happened. Tens of seconds of dead air.

Now the relay itself keeps a **headless `claude` agent alive and primed on your HTML** (`relay/agent.js`). A note is piped straight into the agent's stdin the instant it lands; task flips, live activity, and replies stream back to the page over **SSE** — no polling anywhere on the hot path.

- **~40 ms** from *send* to the card showing ⛏️ working
- **A few seconds** from *send* to fix-applied + reply (model time only)
- The agent keeps session context, so "now make **that** one blue too" just works
- Notes sent while it's busy queue honestly and dispatch the moment it frees up
- No `claude` CLI on PATH (or `YAP_AGENT=off`)? It gracefully falls back to the classic watcher mode — same UI, driven from your main session

## How it works

YapUI is a `SKILL.md` plus a tiny local relay — no build step, no framework, zero npm dependencies:

| File | Role |
| --- | --- |
| `relay/server.js` | Serves your HTML over `http://localhost` (so mic + screen capture work), injects the widget, and pushes every update to the browser over SSE (`/events`). Re-reads the file on each load, so edits show up on refresh. |
| `relay/agent.js` | The resident fix agent: spawns headless `claude` (stream-json over stdin/stdout), pre-warms it on your HTML, queues notes one turn each, streams a live activity ticker, posts the reply, recycles itself after N turns, and respawns on crashes. |
| `relay/widget.js` | The in-page feedback panel, the "⚡ Claude is ready" indicator, and the live task queue (SSE-driven; falls back to polling only if the stream drops). |
| `relay/flip-status.js` | Lets your main Claude session drive the queue cards in watcher-fallback mode. |
| `SKILL.md` | Tells Claude how to launch the relay, check which mode is active (`GET /agent`), and run the watcher fallback when there's no resident agent. |

Feedback artifacts (notes, recordings, screenshots) are written to a `.yapui/` folder next to your HTML — safe to delete or gitignore.

### Tuning

Set these on the relay process:

| Env | Default | What it does |
| --- | --- | --- |
| `YAP_AGENT` | on | `off` disables the resident agent (classic watcher mode) |
| `YAP_AGENT_MODEL` | `sonnet` | Model for fixes — `sonnet` also benchmarked fastest end-to-end here; `opus` for gnarly pages |
| `YAP_CLAUDE_BIN` | `claude` | Path to the Claude Code CLI |
| `YAP_AGENT_RECYCLE` | `30` | Turns before the agent is recycled (keeps context lean) |
| `YAP_AGENT_TIMEOUT` | `240` | Seconds of mid-turn silence before a hung agent is restarted |

The agent runs `--permission-mode acceptEdits` restricted to `Read,Edit,Write,MultiEdit,Grep,Glob` (no shell — the relay pre-extracts recording frames itself), working only in the served HTML's directory — it can edit files there without prompting, and nothing else.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Widget shows **watcher mode** instead of ⚡ instant | No `claude` on PATH (or `YAP_AGENT=off`). Instant mode needs the [Claude Code CLI](https://claude.com/claude-code); watcher mode still works from your main session. |
| Mic or screen-record button does nothing | Voice + recording need a Chromium-based browser (Web Speech / `getDisplayMedia`), and the page must be on `http://localhost` — which YapUI does for you. Check the browser's permission prompt wasn't dismissed. |
| Port already in use | The skill tries 8765 → 8766 → 8780 → 8790; set `PORT` yourself if you run the relay by hand. |
| Recording sent but Claude "didn't see" it | Install `ffmpeg` — the relay uses it to extract frames for the agent. |
| Changes not appearing | Cards must all be ✅ before the auto-refresh; check the task queue panel. Manual refresh always shows the latest file. |

## What leaves your machine

Your HTML, notes, recordings and screenshots are **stored** locally, in `.yapui/` next to the page — the relay has no backend and uploads nothing. But instant mode *is* a Claude agent, so it sends what a Claude agent sends: `relay/agent.js` spawns the `claude` CLI and pipes each note — with the element you picked, the cursor trail and the spoken-word timeline — into its stdin, then points it at your screenshot and the extracted recording frames to read from disk. That prompt, and whatever it reads out of your HTML, goes to the Anthropic API under **your own** Claude Code account and its data-retention settings — the same trip your terminal session already makes. Watcher mode routes the note through your main Claude session instead, which is the same trip by a different road. The only non-model request YapUI itself makes is the `html2canvas` CDN script, fetched the first time you hit 📸 Snap — the `claude` CLI's own traffic (auth, updates) is its own, and unchanged by YapUI.

## Tests

```bash
npm test
```

Runs the whole loop against a fake `claude` binary that speaks the real stream-json protocol — feedback in, status flips, live ticker, HTML edit, reply out, SSE push, plus the watcher fallback — deterministically, with no API calls.

## Contributing

Issues and PRs welcome — especially new feedback modes and browser-state polish. Start with [CONTRIBUTING.md](CONTRIBUTING.md) (30-second dev setup, zero dependencies to install); bugs and ideas go through the [issue templates](https://github.com/Tatendaz/yapui/issues/new/choose), and security reports go [privately](SECURITY.md). CI runs the offline test suite on Node 20/22 for every PR.

## License

MIT © [Tatendaz](https://github.com/Tatendaz)
