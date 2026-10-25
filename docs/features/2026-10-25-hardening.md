# Feature: supply-chain hardening for CI and Dependabot

**Branch:** security/hardening-2026-10-25
**Date:** 2026-10-25

## Summary
Adds a Dependabot config with a 7-day cooldown, a zizmor workflow that fails on
high-severity workflow findings, a CodeRabbit rule that skips Dependabot PRs, and
scopes the auto-merge workflow's write token to its one job.

## Motivation
Phase 2 of the 2026-10-25 security sweep. This month's npm and PyPI worms shipped
as brand-new versions of trusted packages and actions. A 7-day wait before taking a
new version, plus a CI check on the workflows themselves, closes most of that window.

## What changed
- `.github/dependabot.yml`: `github-actions` updates, monthly, `cooldown.default-days: 7`, one group for minor + patch, at most 3 open PRs.
- `.github/workflows/zizmor.yml`: runs zizmor 1.31.1 (via `zizmorcore/zizmor-action` v0.7.1, SHA-pinned) on workflow changes; `min-severity: high`.
- `.coderabbit.yaml`: `reviews.auto_review.ignore_usernames: [dependabot[bot]]`.
- `dependabot-auto-merge.yml`: top-level `permissions: contents: read`; the write scopes moved onto the auto-merge job. Unused loop variable renamed to `_` (shellcheck SC2034).

## Notes
- No npm entry in Dependabot and no `.npmrc` cooldown: the package has zero dependencies by design (CONTRIBUTING rule 1), so there is nothing to update or install.
- The zizmor job is not a required check. Add it to the `protect-main` ruleset if you want it to block merges.
