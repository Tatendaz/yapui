# Session: contributor-ready repo setup

**Branch:** chore/contributor-setup
**Date:** 2026-07-09

## Prompts

1. "posted to x [link] — On more thing about yapui can you protect main branch and make
   the project contributor friendly like add instructions and set the repo up to accept
   issues and contributions like a proper open source project."

## Steps taken

- Created the `protect-main` ruleset (PR-only merges with 0 required approvals so solo
  maintainer flow still works, force-push and deletion blocked, review-thread resolution
  required) — applied immediately via the API.
- Enabled private vulnerability reporting via the API.
- Added CI (`test.yml`, Node 20/22, offline suite), issue templates (bug/feature/config),
  PR template, CONTRIBUTING.md, CODE_OF_CONDUCT.md (Contributor Covenant 2.1),
  SECURITY.md, and pointed the README's Contributing section at them.
- Ran the pre-push gate and opened a PR; required status checks get added to the ruleset
  after this PR lands on main.

## Decisions

- Ruleset (new API) over classic branch protection: supports requiring PRs with zero
  approvals, which classic protection can't express — necessary for a solo maintainer.
- Status checks deliberately NOT required yet: requiring `test (20)`/`test (22)` before
  the workflow exists on main would deadlock the setup PR itself.
- Issue templates as YAML forms (structured fields for mode/environment) rather than
  markdown — the instant-vs-watcher mode distinction is the first triage question.
- No new npm dependencies anywhere; CI has no install step, which keeps the zero-dep
  claim honest and the suite fast.
