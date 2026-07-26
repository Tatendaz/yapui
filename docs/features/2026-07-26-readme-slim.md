# Feature: slim the README to "what is it / how do I install it"

**Branch:** docs/readme-slim
**Date:** 2026-07-26

## Summary
Cuts `README.md` from 206 lines to 86 and moves everything that isn't identity or
install into a new `docs/guide/` folder, linked from a table at the bottom. A reader
should be able to tell what YapUI is and get it installed inside twenty seconds; the
depth is still there, one click away. Also corrects the install-verification claim this
branch had over-corrected, and separates cost from privacy in the landing-page FAQ.

## Motivation
The README was doing five jobs: pitch, install guide, architecture doc, tuning
reference, and troubleshooting manual. Everything in it was accurate and most of it was
well written, which is exactly why it kept growing — no individual section was worth
cutting. But the cost lands on the one reader who matters most: someone who has just
heard of YapUI and wants to know whether to try it. That reader had to scroll past a
five-row env-var table and a repo-layout tree to reach the answer.

Splitting by audience rather than by topic fixes it. The README serves the evaluating
reader; `docs/guide/` serves the reader who already said yes.

## What changed

### README.md (206 → 86 lines)
- **Lead** states the category in the first clause — "a Claude Code skill that previews
  your HTML in a real browser and puts a two-way feedback loop on top of it" — followed
  by the modes and the zero-dependency fact.
- **Why** compressed from a six-bullet list to the two sentences that carry it: `file://`
  blocks the mic, and there's no way back to the AI except the terminal.
- **Install** is the first real section. Three shell routes in one block, the plugin
  route after it, one verification line, and the agent-install paste block. Requirements
  reduced to the three that gate the happy path (Node 20+, Chromium, `claude`).
- **Use it** kept to the one command and the one paragraph describing the loop.
- **Docs** table links the five guides.
- **Removed:** the `## Requirements` list, `## Why it's fast`, `## How it works` + file
  table, `### Tuning` + env table, `## Troubleshooting` table, `## What leaves your
  machine`, and `## Tests` — all relocated, none deleted outright.

### docs/guide/ (new)

| File | Holds |
| --- | --- |
| `install.md` | Full requirements table, all four routes with their scope rules, verification, agent install, update, uninstall |
| `how-it-works.md` | File-role table, why it's fast, watcher fallback, the loop end to end |
| `configuration.md` | Launch env vars, agent tuning table, the agent's permission envelope |
| `troubleshooting.md` | The symptom table, plus what makes a bug report actionable |
| `privacy.md` | Stored-locally vs. sent-to-the-API, the `html2canvas` request, how to opt out |

### Corrections
- **Install verification.** This branch had replaced "picks up new skills live — no
  restart needed" with "loads on the next session — not live." Both are wrong. Per the
  Claude Code docs, skill directories are watched and adding a skill under
  `~/.claude/skills/` or `.claude/skills/` takes effect in the current session; only a
  brand-new top-level skills folder, or the marketplace route, needs a restart or
  `/reload-plugins`. YapUI's `@skills-dir` plugin registration *does* wait for the next
  session, but YapUI ships no hooks, agents or MCP servers, so nothing user-visible
  depends on it. `install.md` carries the full version; the README carries the one line
  that covers both cases.
- **Project-scope install gotchas** documented for the first time: `.claude/skills/`
  loads only after the workspace trust dialog, and a project-scope `@skills-dir` plugin
  does not walk up to the repo root the way a plain skill does.
- **"Is YapUI free?"** on the landing page answered a privacy question, not a cost one.
  It now says YapUI is free and that fixes draw on your own Claude Code plan or API
  credits. The privacy content moved to a new sixth FAQ entry, "Does YapUI send my code
  anywhere?", so each answer stays liftable for AI-answer grounding.

## Notes
- Both `ld+json` blocks parse, and all six visible Q&As match their `acceptedAnswer`
  verbatim — verified by script, not by eye.
- Every relative link and anchor in `README.md` and `docs/guide/*.md` resolves.
- Full suite passing — `npm test`, 70 checks (29 was the pre-merge count; merging `main`
  brought PR #7's expanded suite). No relay code touched.
- CodeRabbit's `.github/CODEOWNERS` finding (a single code owner means @Tatendaz cannot
  satisfy the required code-owner review on their own PRs) is real but belongs to the
  already-merged #7, so it is left for its own change.
