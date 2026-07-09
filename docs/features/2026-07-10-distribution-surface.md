# Feature: distribution surface — npx install path, Pages landing page, social preview

**Branch:** docs/distribution-surface
**Date:** 2026-07-10

## Summary
Makes YapUI discoverable and one-command installable: the README leads with the
`npx skills add tatendaz/yapui` install, and `docs/` gains a GitHub Pages landing
page plus a 1280×640 social preview card.

## Motivation
skills.sh (the agent-skills registry) has no submission flow — listings and
leaderboard rank come entirely from `npx skills add` install telemetry, and git
clones don't count. The README needs to lead with the command that counts.
Meanwhile the repo had no site to verify in Google Search Console and no social
preview image, so shared links rendered as bare text cards.

## What changed
- `README.md` — Install § For humans now leads with **Option A:
  `npx skills add tatendaz/yapui`** (verified working against this repo's root
  `SKILL.md`, both project-level and `-g` global); git-clone and plugin installs
  shift to Options B–D. Update/uninstall block gains the `npx skills update` /
  `npx skills remove yapui` variants.
- `docs/index.html` — self-contained landing page (no external assets): hero,
  install commands, the real demo gif, feature cards, SEO/OG/Twitter meta,
  JSON-LD SoftwareApplication schema, canonical `https://tatendaz.github.io/yapui/`,
  and a placeholder comment for the Search Console verification tag.
- `docs/social-preview.png` — 1280×640 OG card (rendered from HTML via headless
  Chrome); referenced as `og:image` and reusable as the GitHub social preview
  (Settings upload is UI-only).
- `docs/.nojekyll` — Pages serves `docs/` as-is, no Jekyll pass.

## Notes
- After merge (settings, outside this diff): enable GitHub Pages from
  `main:/docs`, set the repo homepage field to the Pages URL, and upload
  `docs/social-preview.png` in Settings → Social preview.
- The landing page makes no network requests beyond its own assets, matching the
  project's everything-stays-local posture.
