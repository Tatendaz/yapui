# Contributing to YapUI

Thanks for wanting to make YapUI better. Issues and PRs are welcome — especially new
feedback modes and browser-state polish.

## Dev setup (30 seconds)

[Fork the repo](https://github.com/Tatendaz/yapui/fork) first — `main` takes changes only
through a pull request, so you'll be working from your own copy.

```bash
git clone https://github.com/<your-username>/yapui
cd yapui
git remote add upstream https://github.com/Tatendaz/yapui
npm test
```

That's the whole setup. There are **zero npm dependencies** and no build step. The test
suite runs the entire loop (feedback → agent → status flips → reply → HTML edit → SSE)
against `test/fake-claude.js`, a deterministic stand-in that speaks the real stream-json
protocol — so tests need no API key, no network, and no `claude` install.

You need **Node 20 or newer** (`engines.node` in `package.json`; CI runs 20 and 22).

To hack on the relay against a real page:

```bash
PORT=8765 HTML_FILE="$PWD/some/page.html" WORKDIR="$PWD/some/.yapui" node relay/server.js
```

Then open `http://localhost:8765/`. With the `claude` CLI on your PATH you get instant
mode; without it (or with `YAP_AGENT=off`) you get the watcher fallback.

## Where things live

| File | Role |
| --- | --- |
| `relay/server.js` | HTTP relay: serves your HTML, injects the widget, SSE push, upload handling, security guards |
| `relay/agent.js` | The resident agent: spawns headless `claude`, pre-warms it, queues notes, streams activity, recycles/respawns |
| `relay/widget.js` | Everything in the browser: feedback panel, talk/point/record/snap modes, task cards |
| `relay/flip-status.js` | Drives queue cards from your main Claude session in watcher mode |
| `SKILL.md` | The instructions Claude Code follows to launch all of the above |

## Ground rules

1. **Zero dependencies is a feature.** PRs that add npm packages need a very good reason;
   "it saved 30 lines" isn't one. The relay must stay `git clone && node`-runnable. CI
   fails the build if anything appears under `dependencies` or `devDependencies`.
2. **New behavior needs a test.** Extend `test/e2e.test.js`; if the fake claude can't
   express your scenario, extend `test/fake-claude.js` too. Everything stays offline.
3. **Mind the security guards.** `serveSibling`, the Origin/Host checks, path
   canonicalization, and the symlink realpath guard exist on purpose. If your change
   touches serving or uploads, say so in the PR and add a hardening test.
4. **Small PRs merge fast.** One concern per PR beats a grab-bag.
5. **No secrets in a PR.** No API keys, no `.env`, no tokens. The suite is offline by
   design and nothing here should ever need a credential. `.gitignore` covers the
   `.yapui/` artifacts the relay writes next to your page.

## Branches & PRs

Work on a topic branch named `<type>/<slug>`, where type is one of `feat`, `fix`, `docs`,
`chore`, `refactor`:

```bash
git checkout -b feat/pick-multiple-elements
```

> Editing a file through GitHub's web "Edit this file" button creates a branch called
> `patch-1`. Rename it before opening the PR — the docs convention below keys off the slug.

**Every PR carries its own docs pair**, dated and named after the branch slug:

```text
docs/features/2026-07-25-pick-multiple-elements.md    # what changed and why
docs/summaries/2026-07-25-pick-multiple-elements.md   # the prompts, steps and decisions
```

Copy the shape from any existing pair (`docs/features/2026-07-09-contributor-setup.md` is
a good one). `features/` is the change itself — summary, motivation, what changed, notes.
`summaries/` is the session behind it — the prompts, the steps taken, the decisions and
why. No workflow enforces this; it's convention, and reviewers will ask for it.

**Heads up: `docs/` is the live website.** Merging to `main` publishes
<https://tatendaz.github.io/yapui/> straight from `main:/docs`. A docs PR is a production
deploy — check `docs/index.html` renders before you ask for review.

## Review process

Merging to `main` requires a pull request, plus all four of:

- **`test (20)` and `test (22)` green.** These two checks are required by name. A red leg
  on either Node version blocks the merge; no contributor can override it.
- **One approving review from a code owner** (@Tatendaz — see `.github/CODEOWNERS`). You
  cannot approve your own PR; GitHub doesn't allow it. So every contribution really does
  get a second pair of eyes.
- **All review conversations resolved**, including [CodeRabbit](https://coderabbit.ai)'s.
  The bot reviews every PR automatically. It is not itself a required check — but its
  threads are threads, so they have to be resolved. Don't be alarmed by its thoroughness;
  address or answer its comments and you're in.
- **Approval on the latest commit.** Pushing new commits dismisses existing approvals and
  needs a fresh one, so get the diff settled before you ask for review.

(The repository admin holds a bypass on this ruleset for emergency fixes. Everything above
is exactly what a contributor's PR has to clear. The ruleset itself is applied when the
change that introduced this file lands — if you're reading this on that PR, the list is
the agreed policy rather than something GitHub is already blocking on.)

**First PR here? Your checks will look stuck, and that's normal.** GitHub holds workflow
runs from first-time contributors until a maintainer clicks "Approve and run", so
`test (20)` / `test (22)` sit *pending* with no output for a while. Nothing is broken and
you don't need to push again — it just needs a human to press the button.

## Reporting bugs & security issues

- Bugs: use the issue template — the mode (instant vs watcher) and relay output matter.
- Security: **don't open a public issue.** Use
  [private vulnerability reporting](https://github.com/Tatendaz/yapui/security/advisories/new)
  — see SECURITY.md.

## License

By contributing you agree your contributions are licensed under the MIT license.
