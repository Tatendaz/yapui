# Session: distribution surface (npx install, landing page, social card)

**Branch:** docs/distribution-surface
**Date:** 2026-07-10

## Prompts

1. "How to submit yapui github page to google for search SEO and to mcpmarket?
   Where else can I submit my yapui page to let people know the skill exists now?"
2. "do this — The action item: put the npx skills add tatendaz/yapui one-liner in
   the README's install section, because git clones don't count toward the
   leaderboard — only that command does."
3. "and this — Three repo gaps worth closing: the homepage field is empty, there's
   no social preview image ... the README lacks the npx one-liner ... On your word
   I can do the README npx line (PR through the gate), a Pages landing page ready
   for Search Console, the awesome-list PR branches for later, or the 1280×640
   preview image."

## Steps taken

- Researched submission venues (MCP Market has a Skills category at
  mcpmarket.com/submit; skills.sh has no form — install telemetry creates the
  listing; awesome lists gate on stars). Playbook saved outside the repo in the
  release kit.
- Verified `npx skills add tatendaz/yapui` end-to-end: `--list` dry run finds the
  root SKILL.md; project-level install lands in `.claude/skills/yapui`; `-g`
  global install verified against a throwaway `$HOME`.
- README: npx install promoted to Option A; update/uninstall variants added.
- Built `docs/index.html` (self-contained landing page with SEO/OG/JSON-LD and a
  Search Console verification placeholder), rendered `docs/social-preview.png`
  (1280×640) from an HTML card via headless Chrome, added `docs/.nojekyll`.
- Ran the pre-push gate (offline tests, coverage check, docs entries, CodeRabbit
  CLI review) and opened the PR.

## Decisions

- One PR, not three: all changes are docs/distribution surface with zero relay
  code touched; a single review pass keeps overhead proportional.
- Pages content ships from `main:/docs` (no gh-pages branch, no build step),
  consistent with the zero-dependency posture; `.nojekyll` keeps it a plain copy.
- Awesome-list PRs deliberately deferred: the big lists (ComposioHQ ~67k★,
  hesreallyhim ~50k★, travisvn ~14k★) require social proof (stars), and branches
  prepared now would rot against their fast-moving list files. Entry lines are
  drafted in the release kit instead.
- Pages enablement, homepage field, and the social-preview upload happen after
  merge — the first two need the files on `main`, the last is UI-only.
