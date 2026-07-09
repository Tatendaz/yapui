# Contributing to YapUI

Thanks for wanting to make YapUI better. Issues and PRs are welcome — especially new
feedback modes and browser-state polish.

## Dev setup (30 seconds)

```bash
git clone https://github.com/Tatendaz/yapui
cd yapui
npm test
```

That's the whole setup. There are **zero npm dependencies** and no build step. The test
suite runs the entire loop (feedback → agent → status flips → reply → HTML edit → SSE)
against `test/fake-claude.js`, a deterministic stand-in that speaks the real stream-json
protocol — so tests need no API key, no network, and no `claude` install.

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
   "it saved 30 lines" isn't one. The relay must stay `git clone && node`-runnable.
2. **New behavior needs a test.** Extend `test/e2e.test.js`; if the fake claude can't
   express your scenario, extend `test/fake-claude.js` too. Everything stays offline.
3. **Mind the security guards.** `serveSibling`, the Origin/Host checks, path
   canonicalization, and the symlink realpath guard exist on purpose. If your change
   touches serving or uploads, say so in the PR and add a hardening test.
4. **Small PRs merge fast.** One concern per PR beats a grab-bag.

## Review process

Every PR gets an automatic [CodeRabbit](https://coderabbit.ai) review plus a human pass.
CI runs `npm test` on Node 20 and 22. All review threads must be resolved before merge
(branch protection enforces this). Don't be alarmed by the bot's thoroughness — address
or answer its comments and you're in.

## Reporting bugs & security issues

- Bugs: use the issue template — the mode (instant vs watcher) and relay output matter.
- Security: **don't open a public issue.** Use
  [private vulnerability reporting](https://github.com/Tatendaz/yapui/security/advisories/new)
  — see SECURITY.md.

## License

By contributing you agree your contributions are licensed under the MIT license.
