# Feature: Agent-readable landing page — `<main>`, Markdown twin, llms.txt links

**Branch:** feat/agent-readiness
**Date:** 2026-08-22

## Summary
Makes `docs/index.html` (the GitHub Pages landing page at https://tatendaz.github.io/yapui/)
readable for AI agents the same way the root site is: the page content sits inside `<main>`,
a Markdown twin lives at `docs/index.md`, and the page advertises it with
`<link rel="alternate" type="text/markdown" href="/yapui/index.md">` plus
`<link rel="describedby" href="/llms.txt">`. Nothing visible changes apart from llms.txt and a "More work" link to the root site
in the footer. Missing paths under `/yapui/` now get a custom 404 page (`docs/404.html`)
with the same pointers, instead of GitHub's default 404.

## Motivation
An Is Agentic audit of tatendaz.github.io (2026-08-22) showed the scanner counts text and the
H1 only inside `<main>`. This page had no `<main>`, so its 4,000+ characters of static text and
its H1 did not count. The root site's `llms.txt` (Tatendaz/Tatendaz.github.io PR #8) lists
this page; the page now points back at it and ships the Markdown twin that the
[llmstxt.org](https://llmstxt.org/) spec recommends (`index.md` next to `index.html`,
`rel="alternate"` to the twin, `rel="describedby"` to the covering `llms.txt`).

## What changed
- `docs/index.html`: `<main>` wraps the hero and every content section (the footer stays
  outside). The hero was a `<header>`; it is now `<div class="hero">` (CSS selector renamed,
  same rules) because boilerplate-stripping extractors drop `<header>` elements and would
  lose the H1 with it. The two `<link>` tags sit after the canonical; the footer gains llms.txt and a "More work" link to the root site.
  CSS: selector-only change (the one `header` rule is now `.hero`, same declarations); no layout
  change (the stylesheet has no child selectors or `main` rules).
- `docs/index.md`: Markdown twin of the page content, generated from the HTML and then
  hand-checked (none needed). It ends with links back to the HTML version, the
  source, the root site and `llms.txt`.
- `docs/404.html`: custom 404 page. GitHub Pages serves it, with a real HTTP 404 status, for
  every missing path under `/yapui/`, where GitHub's default 404 page used to show. It keeps the
  landing page's chrome (inline styles, footer), carries `<meta name="robots" content="noindex">`,
  has no canonical or alternate links, and uses only absolute URLs because it is served at any
  depth (`/yapui/a/b/c`). Inside `<main>`: an "HTTP 404" label, the H1, one line saying there
  is no page at this address, links to the docs, the Markdown twin, the source, `llms.txt`,
  the site map and the root site, then the same pointers as a short Markdown block in
  `<pre class="md">`. The Is Agentic "Agent-friendly 404s" check gives full credit only for a
  real 404 whose body carries short Markdown guidance; a bare 404 scores partial.
- `test/docs-site.test.js (node:test)`: one `<main>`, one `<h1>` inside it, 500+ characters of text; the head links
  are present; the twin starts with the same H1, contains every H2 of the page, and is plain
  Markdown. For the 404 page: the title says 404, `noindex` is set, no canonical/alternate
  link, the Markdown block starts with `# 404`, lists the site map, `llms.txt` and the docs,
  stays under 700 characters and holds no HTML tag, and every `href` is absolute. Run with `npm test`.
- `package.json`: `npm test` now also runs `node --test test/docs-site.test.js`.

## Notes
- When the landing page changes, update `docs/index.md` too; the test fails if an H2 goes
  missing from the twin or the H1 drifts.
- Real `Accept: text/markdown` negotiation is not possible on GitHub Pages (no custom
  headers); the twin plus the two links are the static equivalent.
- No per-project `llms.txt`: the root `/llms.txt` covers every path on the host and already
  describes this project.
- `docs/404.html` carries its own copy of the landing page's inline styles and footer; when
  the palette or footer links change in `docs/index.html`, mirror them there.
