# Session: Agent-readable landing page

**Branch:** feat/agent-readiness
**Date:** 2026-08-22

## Prompts
Carried over from the Tatendaz/Tatendaz.github.io session that produced its PR #8:
1. "Improve how ready https://tatendaz.github.io is for agents. Current Is Agentic score:
   66/100 (Is Agentic readiness model based on Ora audit evidence). Implement the following
   fixes in priority order (failures first, then warnings): …" — nine audit items (content
   without JavaScript, agent-friendly 404s, Markdown content negotiation, agent instruction
   file, brand discoverability, JSON-LD, trust pages, developer-resource discoverability,
   MCP) with evidence and recommended fixes.
2. "can you also check subpages as well like yapui, claude-usage, etc.,"
3. Asked whether to fix the five project pages in their own repos; answer: "Yes, fix all
   five (Recommended)".
4. "and make sure the subpages achieve pairity [sic] also and use subagents to not fill the context
   window here"

## Steps taken
- Probed https://tatendaz.github.io/yapui/ over HTTP: 200, title/description/canonical set,
  product JSON-LD complete, 4,000+ chars of static text, but no `<main>`, no Markdown twin,
  no `rel="alternate"`/`rel="describedby"`, no link to `llms.txt`.
- Read the page source through the GitHub API (no `<main>`/`<nav>`, H1 inside `<header>`,
  inline CSS with no child selectors) and this repo's docs gate, test runner and CI.
- Patched `docs/index.html` with a shared script (`<main>` wrapper, head links, footer
  links); generated `docs/index.md` with an HTML→Markdown converter and hand-checked it
  (none needed).
- Added `test/docs-site.test.js (node:test)` and ran `npm test`.
- Custom 404, done by a subagent so the main session's context stayed small: copied the
  landing page's head, inline styles and footer into `docs/404.html` with `noindex`, no
  canonical/alternate links and absolute URLs only; `<main>` holds the "HTTP 404" label, the
  H1, one explanatory line, six links and the same pointers as a `<pre class="md">` Markdown
  block. Extended `test/docs-site.test.js` with the 404 checks and ran `npm test`.

## Decisions
- `<main>` wraps the header as well as the sections: the H1 lives in the header and the
  scanner only credits an H1 inside `<main>`.
- The twin is generated from the page, not copied from `README.md`, so it mirrors the page
  exactly and the test can hold the two together (same H1, every H2 present).
- No per-project `llms.txt`; the root file covers the whole host and already lists this
  project with its description and links.
- The 404 page inlines its styles (the landing page has no external stylesheet) and links
  only with absolute URLs: GitHub Pages serves `404.html` at any depth under `/yapui/`, where
  a relative `index.md` would resolve against the missing path.
- The 404 test looks for HTML tags inside the Markdown block with the existing `tagNames`
  character walk rather than a tag regex, for the same CodeQL reason as the tag stripper.
