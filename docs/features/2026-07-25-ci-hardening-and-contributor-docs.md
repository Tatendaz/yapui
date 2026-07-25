# Feature: CI hardening, an engines floor, route/lifecycle tests, and honest contributor docs

**Branch:** chore/ci-hardening-and-contributor-docs
**Date:** 2026-07-25

## Summary
Hardens `test.yml` (least-privilege token, SHA-pinned actions, concurrency, timeout,
`fail-fast: false`, a zero-dependency assertion), gives `package.json` an `engines` field,
adds `.github/CODEOWNERS`, extends the test suite from 29 to 70 assertions, and rewrites
the parts of `CONTRIBUTING.md` that described a review gate the repo did not have.

## Motivation
An audit of the repo's CI and `protect-main` ruleset turned up four things worth fixing.

The workflow inherited its permissions rather than declaring them, floated on `@v4` tags,
had no `concurrency`, no `timeout-minutes`, and `fail-fast: true` — so a Node 20 failure
cancelled the Node 22 leg and halved the signal on every red run.

The supported Node range existed only inside a CI matrix, which no consumer of the plugin
ever reads.

`CONTRIBUTING.md` promised "an automatic CodeRabbit review plus a human pass". The human
pass did not exist: the ruleset required **zero** approving reviews, and all five merged
PRs show an empty `reviewDecision`. Contributors were trusting a control that wasn't there.

And the required status checks are coupled to this workflow *by name*. `protect-main`
requires the literal strings `test (20)` and `test (22)`, which are produced by the job
name and the matrix values. Nothing in the repo said so, so the next person to add a Node
version would have quietly created an unrequired check — or, by removing one, blocked every
merge on a check that never reports again.

## What changed
- `.github/workflows/test.yml` — `permissions: contents: read`; PR-scoped `concurrency`
  (runs on `main` are deliberately not cancelled); `timeout-minutes: 10`;
  `fail-fast: false`; `actions/checkout` and `actions/setup-node` pinned to the exact
  commit SHAs their `v4` tags pointed at; a step asserting zero dependencies and that
  `engines.node` still admits the Node version this leg is running. A long header comment
  documents the ruleset coupling and the add-then-require-then-remove order a matrix change
  has to follow.
- `package.json` — `"engines": { "node": ">=20" }`, matching the CI matrix floor.
- `.github/CODEOWNERS` — new. `require_code_owner_review` matches nothing without it.
- `test/e2e.test.js` — three new sections: `flip-status.js guards` (argument validation and
  the 64-char id truncation that has to agree with the relay's `canonId`), `relay routes`
  (`/__feedback.js`, `/version`, `/task`, `/task/dismiss`, `/tasks/clear`, `/cursor`,
  `/shot`, `/feedback.jsonl` — eight routes with no coverage at all), and `agent lifecycle`
  (missing `claude` binary, the `0`/`false` spellings of `YAP_AGENT`, a second note queued
  behind a busy agent, and the recycle-and-respawn path). 29 → 70 assertions.
- `CONTRIBUTING.md` — fork-first setup, a `## Branches & PRs` section (branch naming, the
  docs-pair convention, the GitHub Pages deploy warning), and a `## Review process`
  rewritten to describe the gate exactly: both required checks by name, one code-owner
  approval, all threads resolved, approval on the latest commit, plus the first-time
  contributor workflow-approval wait.
- `.github/pull_request_template.md` — branch naming, the docs pair, and a no-secrets item
  added; the existing repo-specific items kept.
- Repo settings (outside this diff): `protect-main` updated to
  `required_approving_review_count: 1` with `require_code_owner_review`,
  `dismiss_stale_reviews_on_push` and `require_last_push_approval` all on.

## Notes
The Node matrix is unchanged on purpose. Node 20 reached end-of-life in April 2026 and
should be replaced by 24, but the required-check contexts have to move in lockstep with the
matrix or merges break, and that is a ruleset edit rather than a repo-file edit. The
recommended order is in the workflow header: add the new version, update the ruleset, then
remove the old one. `engines.node` moves to `">=22"` in that same third step.

The check names were verified to be unchanged by this PR: `jobs.test.name` and
`matrix.node` are byte-identical to `main`, and expanding the name expression over the
matrix reproduces `test (20)` / `test (22)` exactly as the ruleset requires them.
