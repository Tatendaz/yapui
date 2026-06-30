<div align="center">

# 🗣️ YapUI

### Yap at your UI. Watch Claude rebuild it live.

Preview any HTML in your browser and give feedback by **talking, pointing, recording, screenshotting, or typing** — [Claude Code](https://claude.com/claude-code) picks it up in real time, fixes it, and replies right in the page. You never go back to the terminal.

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

### Option A — clone into your skills folder (simplest)

```bash
git clone https://github.com/Tatendaz/yapui ~/.claude/skills/yapui
```

That's it — Claude Code auto-discovers the skill on next launch.

### Option B — install as a plugin

```bash
/plugin marketplace add Tatendaz/yapui
/plugin install yapui@yapui-marketplace
```

## Usage

Just ask Claude to preview some HTML:

```
preview index.html
```
```
open my mockup in the browser
```

Claude launches the local relay, opens the page, and arms a watcher. Then, in the browser:

1. Hit the **Feedback** button (bottom-left, or press `f`).
2. Choose **⌨️ type · 🎙 Talk · 🎬 Record · 📸 Snap · 🎯 Pick** and send.
3. Each note becomes a card in the top-right queue: 🔴 queued → 🟠 working → ✅ done. When every card is green, the page auto-refreshes with your changes.

Mic / screen-share prompts are normal — **everything stays on your machine.**

## How it works

YapUI is a `SKILL.md` plus a tiny local relay — no build step, no framework:

| File | Role |
| --- | --- |
| `relay/server.js` | Serves your HTML over `http://localhost` (so mic + screen capture work) and injects the widget. Re-reads the file on each load, so edits show up on refresh. |
| `relay/widget.js` | The in-page feedback panel, the "👀 Claude is watching" indicator, and the task queue. |
| `relay/flip-status.js` | Lets Claude drive the queue cards (queued → working → done). |
| `SKILL.md` | Tells Claude how to launch the relay, watch for feedback, read notes (including the voice transcript + cursor-pointing timeline), apply fixes, and reply in the page. |

Feedback artifacts (notes, recordings, screenshots) are written to a `.yapui/` folder next to your HTML — safe to delete or gitignore.

## Requirements

- **Node.js** — the relay is plain Node with zero dependencies.
- A **Chromium-based browser** (Chrome / Edge / Brave) for voice + screen recording (Web Speech + `getDisplayMedia`).
- **`ffmpeg`** — only if you want Claude to read screen recordings.
- Internet access for the screenshot library (`html2canvas`, loaded via CDN).

## Repo layout

```
yapui/
├── SKILL.md              # the skill: how Claude runs the loop
├── relay/
│   ├── server.js         # local HTTP relay + widget injector
│   ├── widget.js         # in-browser feedback panel + status UI
│   └── flip-status.js    # queue-card status driver
└── .claude-plugin/       # makes it /plugin-installable
    ├── plugin.json
    └── marketplace.json
```

## Contributing

Issues and PRs welcome — especially new feedback modes and browser-state polish.

## License

MIT © [Tatendaz](https://github.com/Tatendaz)
