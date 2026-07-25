<!--
Thanks for contributing! Ticking the checklist before you push is the fastest
route to a green build. Only the first item is enforced by CI (`test (20)` and
`test (22)`); the rest are the conventions a reviewer will ask about anyway.
See CONTRIBUTING.md.
-->

## What & why

<!-- What does this PR do, and what problem does it solve? A sentence or two is fine.
     Link an issue with "Closes #N" if there is one. -->

## How it was tested

<!-- `npm test` output, and for UI/widget changes: which browser, which mode (instant / watcher). -->

## Checklist

- [ ] Branch is named `<type>/<slug>` — one of `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`.
      (GitHub's web "Edit this file" button creates `patch-1` branches; rename before opening.)
- [ ] `npm test` passes locally (the suite is offline — no API calls, no claude install needed)
- [ ] New behavior has a test in `test/e2e.test.js` (or a note here on why it can't)
- [ ] `docs/features/<YYYY-MM-DD>-<slug>.md` added — what changed and why
- [ ] `docs/summaries/<YYYY-MM-DD>-<slug>.md` added — prompts, steps taken, decisions
- [ ] README / SKILL.md updated if user-visible behavior changed
- [ ] Zero new npm dependencies (that's a feature — CI fails the build if any appear)
- [ ] No secrets, API keys, or `.env` files in the diff
- [ ] Checked `docs/index.html` still renders, if this PR touches it — merging republishes
      <https://tatendaz.github.io/yapui/> from `main:/docs`

## Notes for the reviewer

<!-- Anything surprising, any tradeoff you made, anything you want a second opinion on.
     Security guards touched (serveSibling, Origin/Host checks, symlink guard)? Say so here.
     Delete this section if there's nothing to flag. -->
