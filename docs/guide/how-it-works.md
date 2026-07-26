# How YapUI works

YapUI is a `SKILL.md` plus a tiny local relay — no build step, no framework, zero npm
dependencies.

| File | Role |
| --- | --- |
| `relay/server.js` | Serves your HTML over `http://localhost` (so mic + screen capture work), injects the widget, and pushes every update to the browser over SSE (`/events`). Re-reads the file on each load, so edits show up on refresh. |
| `relay/agent.js` | The resident fix agent: spawns headless `claude` (stream-json over stdin/stdout), pre-warms it on your HTML, queues notes one turn each, streams a live activity ticker, posts the reply, recycles itself after N turns, and respawns on crashes. |
| `relay/widget.js` | The in-page feedback panel, the "⚡ Claude is ready" indicator, and the live task queue (SSE-driven; falls back to polling only if the stream drops). |
| `relay/flip-status.js` | Lets your main Claude session drive the queue cards in watcher-fallback mode. |
| `SKILL.md` | Tells Claude how to launch the relay, check which mode is active (`GET /agent`), and run the watcher fallback when there's no resident agent. |

Feedback artifacts — notes, recordings, screenshots — are written to a `.yapui/` folder
next to your HTML by default (override with [`WORKDIR`](configuration.md)). Safe to
delete or gitignore.

## Why it's fast

The old loop was: browser → file → a shell watcher polling every second → your *main*
Claude session waking up → several tool round-trips before anything visibly happened. Tens
of seconds of dead air.

Now the relay itself keeps a **headless `claude` agent alive and primed on your HTML**
(`relay/agent.js`). A note is piped straight into the agent's stdin the instant it lands;
task flips, live activity and replies stream back to the page over **SSE** — no polling
anywhere on the hot path.

- **~40 ms** from *send* to the card showing ⛏️ working
- **A few seconds** from *send* to fix-applied + reply (model time only)
- The agent keeps session context, so *"now make **that** one blue too"* just works
- Notes sent while it's busy queue honestly and dispatch the moment it frees up

## Watcher fallback

No `claude` CLI on PATH, or `YAP_AGENT=off`? YapUI falls back to the classic watcher
mode — same UI, same widget, same queue cards, driven from your main Claude session
instead of a resident one. It's slower (that's the dead air described above), but nothing
breaks.

The widget tells you which mode you're in, and `GET /agent` reports it for scripts:
`ready` / `booting` mean the resident agent owns the loop, `off` means watcher mode.

## The feedback loop, end to end

1. You hit send in the browser. The widget `POST`s the note to `/feedback` — with the
   element you picked, the cursor trail, and the spoken-word timeline if you dictated.
   Screenshots and recordings go to `/shot` and `/upload` first and come back as file refs.
2. The relay writes the artifacts under `.yapui/`, extracts recording frames with `ffmpeg`,
   and hands the note to `relay/agent.js`.
3. The agent pipes it into the resident `claude` process's stdin as one turn, and flips the
   card to 🟠 working — **~40 ms** after you hit send.
4. Tool events stream back out as a live activity line ("✏️ editing index.html…").
5. The agent's final message becomes the reply shown in the page. The card goes ✅, and
   when every card is green the page auto-refreshes with your changes.
