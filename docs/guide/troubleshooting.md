# Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `/yapui` isn't in the slash-command list | For a git-clone install, restart Claude Code once if you just created the `skills/` folder itself. For the plugin route, run `/reload-plugins`. See [Did it work?](install.md#did-it-work) |
| Widget shows **watcher mode** instead of ⚡ instant | No `claude` on PATH (or `YAP_AGENT=off`). Instant mode needs the [Claude Code CLI](https://claude.com/claude-code); watcher mode still works from your main session. |
| Mic or screen-record button does nothing | Voice + recording need a Chromium-based browser (Web Speech / `getDisplayMedia`), and the page must be on `http://localhost` — which YapUI does for you. Check the browser's permission prompt wasn't dismissed. |
| Port already in use | The skill tries 8765 → 8766 → 8780 → 8790; set `PORT` yourself if you run the relay by hand. |
| Recording sent but Claude "didn't see" it | Install `ffmpeg` — the relay uses it to extract frames for the agent. Without it, the agent goes by your note text alone. |
| 📸 Snap fails with "Screenshot needs internet" | `html2canvas` is fetched from a CDN the first time you snap. Offline, the other four modes still work. |
| Changes not appearing | Cards must all be ✅ before the auto-refresh; check the task queue panel. A manual refresh always shows the latest file. |
| The feedback panel is gone | You closed it at some point, and that's remembered across reloads. The **Feedback** button bottom-left — or the `f` key — brings it back. |

## Still stuck?

Open an issue through the [issue templates](https://github.com/Tatendaz/yapui/issues/new/choose).
Two things make a bug report actionable: **which mode** the widget says it's in (instant vs
watcher), and the **relay's stdout** — it logs the port, the served file, the workdir, the
agent state, and every upload.

Security issues go [privately](../../SECURITY.md), not through a public issue.
