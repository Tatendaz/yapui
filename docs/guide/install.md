# Installing YapUI

The short version lives in the [README](../../README.md#install). This page is the long
version: what you need, what each route actually does, how to tell it worked, and how to
back it out.

## Requirements

| | Needed for | Notes |
| --- | --- | --- |
| **Node 20+** | everything | The relay is plain Node with **zero npm dependencies** — no build step, no install. `engines.node` in `package.json`; CI runs 20 and 22. |
| **Claude Code** (`claude` on PATH) | instant mode | Without it YapUI still works, in [watcher mode](how-it-works.md#watcher-fallback) — same UI, driven from your main Claude session. |
| **A Chromium browser** (Chrome / Edge / Brave) | 🎬 Record | Screen recording uses `getDisplayMedia`, captured and stored locally. Typing, picking and screenshotting work in any browser. |
| **Chrome or Edge** specifically | 🎙 Talk | Live dictation uses the browser's Web Speech service, which Brave doesn't ship — and the audio is transcribed by that service, in the cloud ([what leaves your machine](privacy.md#talk-goes-through-your-browsers-speech-service)). |
| **`ffmpeg`** | Claude reading your screen recordings | The relay shells out to it to extract frames. Skip it and recordings still upload — the agent just goes by your note text. |
| **Internet** | 📸 Snap and 🎙 Talk | Snap fetches `html2canvas` from a CDN the first time you screenshot; Talk streams audio to the browser's speech service. (Instant-mode fixes are Claude API calls, so the `claude` CLI needs its usual access too.) |

## The four routes

### A — skills.sh (any agent)

```bash
npx skills add tatendaz/yapui        # this project
npx skills add tatendaz/yapui -g     # all your projects
```

The CLI asks which agent to install into — Claude Code, Cursor, Codex and dozens of
others. Without `-g` it installs to `.claude/skills/yapui` in the current project; with
`-g`, to `~/.claude/skills/yapui`. **Remember which you chose** — `update` and `remove`
need the same flag.

### B — personal skill (all your projects)

```bash
git clone https://github.com/Tatendaz/yapui ~/.claude/skills/yapui
```

### C — project skill (one repo, shareable with your team)

```bash
git clone https://github.com/Tatendaz/yapui .claude/skills/yapui
```

Check it in and every collaborator who clones the repo gets YapUI. Two Claude Code rules
apply to project scope that don't apply to personal scope:

- It loads only after you accept the **workspace trust dialog** for that folder.
- Because YapUI ships a `.claude-plugin/plugin.json`, its plugin registration loads only
  from the `.claude/skills/` of the directory you *start Claude Code in* — it does not
  walk up to the repo root the way a plain skill does. Launch from the repo root, or run
  `/reload-plugins` after changing directories.

### D — as a plugin (inside Claude Code)

```text
/plugin marketplace add Tatendaz/yapui
/plugin install yapui@yapui-marketplace
```

## Did it work?

Ask for `/yapui` in the slash-command list, or just tell Claude to *"preview some HTML"*.

If it isn't there yet:

- **Routes A–C** put a `SKILL.md` under a watched skills directory, and Claude Code picks
  those up **in the current session** — no restart. The one exception is a *brand-new*
  top-level `~/.claude/skills/` or `.claude/skills/` folder that didn't exist when the
  session started: that directory isn't being watched yet, so restart once.
- **Route D** is a marketplace install. Run `/reload-plugins`, or restart.

YapUI also registers as a plugin, and *that* half loads on the next session either way. It
shows up in `/plugin` as `yapui@skills-dir` for routes A–C and `yapui@yapui-marketplace`
for route D. Nothing depends on it — YapUI ships one skill and no hooks, agents or MCP
servers — so the skill working is the thing to check.

## Install from an agent

If you're a human, paste this into Claude Code (or any agent with shell access):

> Install the YapUI skill: clone `https://github.com/Tatendaz/yapui` into
> `~/.claude/skills/yapui`, confirm `SKILL.md` exists there, then tell me how to use it.

If you're an agent reading this, the steps are deterministic:

```bash
git clone https://github.com/Tatendaz/yapui "$HOME/.claude/skills/yapui"   # install
test -f "$HOME/.claude/skills/yapui/SKILL.md" && echo "yapui installed"    # verify
git -C "$HOME/.claude/skills/yapui" pull                                   # update
```

To use it, read `SKILL.md` and follow its **Launch** section. The short version: start
`relay/server.js` in the background with `PORT`, `HTML_FILE` (absolute path) and `WORKDIR`
env vars; wait for `http://localhost:<port>/` to respond; open it in a browser; then
`GET /agent` to check the mode. `ready`/`booting` means the resident agent owns the
feedback loop — do **not** arm a watcher. `off` means run the watcher fallback described
in `SKILL.md`.

YapUI follows the [Agent Skills](https://agentskills.io) layout, so any SKILL.md-compatible
tool can load it — but instant mode expects the `claude` CLI.

## Update

```bash
git -C ~/.claude/skills/yapui pull      # personal clone (route B)
git -C .claude/skills/yapui pull        # project clone (route C)
npx skills update -g                    # skills.sh (route A) — drop -g if you installed without it
```

For route D, `/plugin` handles updates.

## Uninstall

```bash
rm -rf ~/.claude/skills/yapui           # personal clone
rm -rf .claude/skills/yapui             # project clone
npx skills remove yapui -g              # skills.sh — drop -g if you installed without it
```

`skills update` and `skills remove` ask which scope to touch (and with `-y` they auto-pick
project scope when run inside a project), so match the `-g` of your original install.

Removing the skill leaves your artifacts behind. By default a `.yapui/` folder sits next
to every HTML file you previewed (a custom [`WORKDIR`](configuration.md) puts it
elsewhere), holding notes, screenshots and screen recordings — and a single recording can
reach 200 MB. Delete those separately:

```bash
find . -type d -name .yapui -prune -print   # look first
```
