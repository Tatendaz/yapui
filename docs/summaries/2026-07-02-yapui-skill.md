# Session: Instant resident fix agent — speed rework

**Branch:** feat/yapui-skill
**Date:** 2026-07-02

## Prompts

1. "I have an HTML preview skill, and I also created a repository on GitHub, YAP UI, based on that skill. Can you try to fix the problem I have with that particular skill and copy over the fixes to the YAP UI repository? The main problem is that whenever I send a task to Claude, it takes a while for the UI to pick up that task and execute it. Maybe we might need multiple agents that get started for that particular skill. Basically, just make it fast. When I send a task, it should start, pick up the skills, and begin to do something, conveying that to whoever the user is. Or we might need to re-engineer the whole thing from the ground up."
2. "Just to reiterate, the main goal is having speed."
3. "When you are done, check what the speed was before you made your changes, and then check the speed after you made your changes to ensure that it has improved. If it hasn't, optimize again and keep repeating until you are satisfied that this is the fastest it can go."

## Steps taken

- Diagnosed the latency chain: 1 s file-poll watcher → background-task exit re-invoking the main Claude session (seconds to tens of seconds on a large context) → 2–3 tool round-trips before the card flipped to working → 0.9–2.5 s browser polling on top.
- Re-engineered around a **resident pre-warmed headless `claude` agent** owned by the relay (`relay/agent.js`, new): boots and primes on the HTML at relay start, receives each note over stdin (stream-json), streams a live tool-activity ticker onto the task card, posts its final message as the browser reply, supports `NEEDS-YOU:`, queues/coalesces mid-turn notes, recycles after N turns, restarts hung turns, retries crashed turns once.
- Replaced browser polling with an **SSE channel** (`/events`) that seeds new clients and pushes task flips, replies, agent state, and widget-version changes; polling remains as fallback. Added `/agent` mode endpoint. Server now creates task cards itself (kills the `/task` vs `/feedback` race) and fs-watches the artifact files so fallback-mode writers are pushed live too.
- Rewrote `SKILL.md`: launch → check `GET /agent` → instant mode needs no watcher; classic watcher flow preserved as fallback.
- Added deterministic tests (`npm test`): `test/fake-claude.js` speaks the real stream-json protocol so the whole loop runs without API calls; covers agent mode, needs-you, SSE events, marker advancement, and watcher fallback.
- Live-benchmarked before vs after with the identical feedback note on the identical page (see feature doc for numbers).
- Applied the same rework to the local `html-preview` skill (source of this repo) and ported it here with YapUI branding.

## Decisions

- **One resident agent, not a pool** — parallel agents editing one HTML file would conflict; a single hot agent with honest queueing ("⏳ agent is finishing the previous fix…") plus strict one-note-per-turn queueing gives the speed without write races, and its session context makes follow-up notes ("make that one blue too") resolve correctly.
- **Persistent stdin-fed process over per-note spawns** — spawning `claude -p` per note costs a cold boot each time; one long-lived stream-json process is hot for every note. Recycling caps context growth.
- **SSE over WebSockets** — one-directional push is all the widget needs; SSE is plain HTTP, auto-reconnects, zero dependencies.
- **Relay flips statuses from agent lifecycle events** — the agent needs no side-channel tools (no curl, no flip-status), which keeps its permission surface tiny: `acceptEdits` + `Read,Edit,Write,MultiEdit,Grep,Glob` — no shell; the relay pre-extracts recording frames itself.
- **`sonnet` as default model** — best speed/quality balance for live HTML edits; `sonnet` also benchmarked faster than `haiku` end-to-end (4.3s vs 6.5s).
- **Graceful fallback kept** — no `claude` on PATH or `YAP_AGENT=off` reverts to the original watcher flow, now also SSE-pushed.
