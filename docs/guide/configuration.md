# Configuration

Set these on the relay process. The skill picks sensible defaults, so you only need this
page if you're tuning the resident agent or running `relay/server.js` by hand.

## Launch variables

| Env | Default | What it does |
| --- | --- | --- |
| `PORT` | `8765` | Port for the relay. The skill tries 8765 → 8766 → 8780 → 8790 and takes the first free one. |
| `HTML_FILE` | — | **Required.** Absolute path to the HTML file to serve. |
| `WORKDIR` | `<html dir>/.yapui` | Where feedback artifacts (notes, screenshots, recordings) are written. |

```bash
PORT=8765 HTML_FILE="$PWD/page.html" WORKDIR="$PWD/.yapui" node relay/server.js
```

## Agent tuning

| Env | Default | What it does |
| --- | --- | --- |
| `YAP_AGENT` | on | `off` (or `0` / `false`) disables the resident agent — classic [watcher mode](how-it-works.md#watcher-fallback) |
| `YAP_AGENT_MODEL` | `sonnet` | Model for fixes. `sonnet` also benchmarked fastest end-to-end here; `opus` for gnarly pages |
| `YAP_CLAUDE_BIN` | `claude` | Path to the Claude Code CLI |
| `YAP_AGENT_RECYCLE` | `30` | Turns before the agent is recycled (keeps context lean) |
| `YAP_AGENT_TIMEOUT` | `240` | Seconds of mid-turn silence before a hung agent is restarted |

## What the agent is allowed to do

The resident agent is spawned with `--permission-mode acceptEdits`, restricted to
`Read,Edit,Write,MultiEdit,Grep,Glob` — **no shell**, because the relay pre-extracts
recording frames itself rather than letting the agent run `ffmpeg`. It works in the served
HTML's directory, so it can edit files there without prompting you, and nothing else.

It also runs with `--strict-mcp-config` and an empty MCP config, so none of your configured
MCP servers are reachable from it.

If `WORKDIR` sits outside the HTML's directory, the relay passes it explicitly with
`--add-dir` — that's the only way the agent's reach widens, and only to the artifacts
folder you chose.
