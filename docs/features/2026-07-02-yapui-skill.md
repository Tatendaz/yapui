# Feature: Instant resident fix agent (ground-up speed rework)

**Branch:** feat/yapui-skill
**Date:** 2026-07-02

## Summary
Replaces the polling watcher pipeline with a resident, pre-warmed headless `claude` agent owned by the relay, plus an SSE push channel to the browser. Feedback pickup drops from tens of seconds to ~40 ms, and fix-applied + reply lands in a few seconds (model time only).

## Motivation
The original loop had dead air baked in: a shell watcher polled `feedback.jsonl` every second, its exit had to re-invoke the user's main Claude session (seconds to tens of seconds with a large context), and that session needed several tool round-trips before the card even flipped to "working". The browser added its own 0.9–2.5 s polling lag. Users sent a note and watched nothing happen.

## What changed
- **`relay/agent.js` (new)** — spawns `claude -p --input-format stream-json --output-format stream-json` at relay start, primes it by reading the served HTML (so the first note hits a hot agent), pipes each note straight into its stdin, maps tool_use events to a live activity ticker on the task card, posts its final message as the in-browser reply, honors a `NEEDS-YOU:` prefix (flips the card 🙋), queues notes that arrive mid-turn (one per turn, arrival order), advances the `.fb-processed` marker so watcher fallback stays consistent, recycles itself after `YAP_AGENT_RECYCLE` turns, restarts hung turns after `YAP_AGENT_TIMEOUT`, and retries a crashed turn once before flagging the card.
- **`relay/server.js`** — new SSE endpoint `/events` (seeds new clients with full state, then pushes task flips / replies / agent state / widget version), `/agent` status endpoint for mode detection, instant handoff of `/feedback`, `/upload`, `/shot` to the agent, server-side task-card creation (no race with the widget's `/task` POST), and fs.watch on `tasks.jsonl` / `claude-replies.jsonl` so external writers (fallback mode) are also pushed live.
- **`relay/widget.js`** — SSE-driven updates replace the 900 ms task poll and 2.5 s reply poll (polling remains only as a fallback if the stream drops); idle header shows "⚡ Claude is ready — instant fixes" vs "👀 Claude is watching" (fallback); cards show the agent's live activity line.
- **`SKILL.md`** — launch flow now checks `GET /agent`: instant mode needs no watcher (the main session stays free); the classic watcher flow is preserved as an explicit fallback section.
- **Tests (new)** — `npm test` runs the full loop deterministically against `test/fake-claude.js`, a stand-in that speaks the real stream-json protocol; no API calls.
- Agent sandbox: `--permission-mode acceptEdits`, tools limited to `Read,Edit,Write,MultiEdit,Grep,Glob` (no shell — the relay pre-extracts recording frame sheets), cwd pinned to the served HTML's directory, MCP servers disabled for fast boot.
- **Hardening round (same PR)** — one note per agent turn (per-note statuses + replies), stale child-process events ignored after recycling, queued cards drained if the agent dies, artifact paths clamped to the workdir; relay rejects cross-origin POSTs and serves sibling assets (css/js/images) with traversal/dotfile/workdir blocking; widget element-picker highlight fixed (duplicate hoisted handler), correct `:nth-of-type`, blob-URL cleanup, optimistic-card rollback on failed sends.

## Security
- `serveSibling` (relay/server.js) resolves the target with `fs.realpathSync` and re-checks the prefix against the realpathed HTML dir, so a symlink placed inside the served directory cannot be followed to a file outside it; plain `../` traversal is rejected earlier by a per-segment check. Both vectors have regression tests (`npm test` → "path traversal is blocked", "symlink escape out of the served dir is blocked"). The realpath guard was added mid-review (lexical-only in `9df72f4`, hardened in `1a07542`); a push-time security review of the earlier commit correctly flagged the pre-hardening symlink window — verified fixed on HEAD by attacking a live relay with encoded-traversal and live symlink-escape payloads (all returned 404).

## Notes
- Backward compatible: without the `claude` CLI on PATH (or with `YAP_AGENT=off`) everything behaves as before, and even then flips/replies now push over SSE instead of polls.
- Tuning env vars: `YAP_AGENT`, `YAP_AGENT_MODEL` (default `sonnet`), `YAP_CLAUDE_BIN`, `YAP_AGENT_RECYCLE` (30), `YAP_AGENT_TIMEOUT` (240 s).
- Measured live, identical note ("change the h1 …") on an identical page, same machine, same day:
  | | send → card shows *working* | send → fix applied + reply |
  | --- | --- | --- |
  | before (watcher → main session) | 50.4 s | 85.0 s |
  | after (resident agent, sonnet) | 0.02 s | 4.3 s |
  | after (haiku, for comparison) | 0.02 s | 6.5 s |

  The pipeline itself now contributes ~0.05 s; the remaining seconds are the model actually making the fix (sonnet beat haiku end-to-end, so it stays the default). Follow-up notes resolve pronouns ("that same heading") thanks to the agent's session context.
- The resident agent bills API/plan usage per note like any headless `claude -p` run; recycling keeps its context from growing unbounded.
