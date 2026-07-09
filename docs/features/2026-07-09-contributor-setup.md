# Feature: contributor-ready repo (CI, templates, policies, protected main)

**Branch:** chore/contributor-setup
**Date:** 2026-07-09

## Summary
Turns the repo into a proper open-source project: CI on every PR, issue/PR templates,
contributing guide, code of conduct, security policy, and branch protection on `main`.

## Motivation
v0.2.0 is public and announced; strangers arriving from the announcement need a paved
road to report bugs, propose features, and land PRs — and `main` needs to be protected
now that it's a release branch others build on.

## What changed
- `.github/workflows/test.yml` — runs the offline `npm test` suite on Node 20 and 22 for
  every PR and push to main.
- `.github/ISSUE_TEMPLATE/` — bug report form (mode + environment + relay output),
  feature request form, and a config routing security reports to private advisories.
- `.github/pull_request_template.md` — what/why, testing, and a checklist reflecting the
  repo's rules (offline tests, zero new dependencies).
- `CONTRIBUTING.md` — 30-second setup, architecture map, ground rules (zero deps, tests
  required, security guards are load-bearing), review process.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 (adapted).
- `SECURITY.md` — threat model, scope notes, private vulnerability reporting link.
- README Contributing section now routes to all of the above.
- Repo settings (outside this diff): `protect-main` ruleset (PR-only, no force push, no
  deletion, review threads must be resolved), private vulnerability reporting enabled.

## Notes
Follow-up after this PR merges: add the `test (20)` / `test (22)` checks as required
status checks on the `protect-main` ruleset — doing it before the workflow exists on
`main` would block this very PR.
