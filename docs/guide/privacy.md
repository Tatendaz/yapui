# What leaves your machine

Short version: there is no hosted YapUI backend — the browser only ever uploads to the
relay on your own machine. But applying a fix *is* a Claude agent, so instant mode sends
what a Claude agent sends — to the same API, under your own Claude Code account, subject
to your own retention settings. The destination is the one
your terminal sessions already use; the payload is richer, because a screenshot and a
cursor trail are not things you would normally type.

## Stored locally, sent nowhere by YapUI

Your HTML stays where it is; your typed notes, your screenshots and your screen
recordings are written to a `.yapui/` folder next to it by default
([`WORKDIR`](configuration.md) moves it). The relay binds to `127.0.0.1`, there is no
YapUI service, no telemetry, and no account.

Recordings there can reach 200 MB apiece, and they survive uninstalling the skill —
[delete them yourself](install.md#uninstall) when you're done.

## Sent to the Anthropic API, by the agent

In instant mode, `relay/agent.js` spawns the `claude` CLI and pipes each note into its
stdin. That prompt carries:

- the note text
- the element you picked, if you picked one
- the cursor trail, and the spoken-word timeline if you dictated
- filesystem paths to your screenshot and to the frame sheet extracted from your recording

…and then tells the agent to read those files and edit your HTML. So the screenshot, the
recording frames and whatever the agent reads out of your page all go to the Anthropic API,
under **your own** Claude Code account and its data-retention settings.

Watcher mode routes the note through your main Claude session instead. Same destination,
different road.

The agent runs with an empty, strict MCP config, so nothing reaches your configured MCP
servers. See [what the agent is allowed to do](configuration.md#what-the-agent-is-allowed-to-do).

## Talk goes through your browser's speech service

Live dictation uses the Web Speech API, which Chrome and Edge implement in the cloud: the
browser streams your microphone audio to its vendor's speech service (Google's for Chrome,
Microsoft's for Edge) and hands YapUI back the text — only the transcript ever reaches the
relay or the agent. That is a browser data flow, not a YapUI request, but it *is* audio
leaving your machine, and it's why 🎙 Talk needs internet. If that's not okay, type the
note — or 🎬 record instead: recordings are captured and stored entirely locally.

## The one other request YapUI itself makes

The first time you hit 📸 Snap, the widget loads `html2canvas` from jsDelivr — pinned to
`1.4.1`, with an SRI `integrity` hash and `crossorigin=anonymous`. That's the only non-model
request YapUI itself makes. The `claude` CLI's own traffic (auth, updates) is its own, and
unchanged by YapUI.

## If you want none of it

Set `YAP_AGENT=off`. You get a local live-preview server with a feedback widget that writes
notes to disk, and no agent is spawned. Your main Claude session still reads those notes
when you ask it to — that part is on you.
