# Feature: supply-chain hardening for CI and Dependabot

**Branch:** security/hardening-2026-10-25
**Date:** 2026-10-25

## Summary
Adds a Dependabot config with a 7-day cooldown, a zizmor workflow that fails on
high-severity workflow findings, the shared merge-when-clean workflow, and removes the
old Dependabot auto-merge workflow.

## Motivation
Phase 2 of the 2026-10-25 security sweep. This month's npm and PyPI worms shipped
as brand-new versions of trusted packages and actions. A 7-day wait before taking a
new version, plus a CI check on the workflows themselves, closes most of that window.

## What changed
- `.github/dependabot.yml`: `github-actions` updates, monthly, `cooldown.default-days: 7`, one group for minor + patch, at most 3 open PRs.
- `.github/workflows/zizmor.yml`: runs zizmor 1.31.1 (via `zizmorcore/zizmor-action` v0.7.1, SHA-pinned) on workflow changes; `min-severity: high`.
- `.github/workflows/merge-when-clean.yml`: the sweep's shared template, unchanged. Every 30 minutes (and on status/review events) it merges Dependabot PRs and the owner's `security/*` or `automerge`-labelled PRs once checks are green, a real review ran on the head (CodeRabbit "Review completed" or owner-posted `review-failover` success) and 0 threads are open.
- `dependabot-auto-merge.yml`: deleted. It merged patch/minor Dependabot PRs as soon as tests passed, with no review. merge-when-clean (template v6) now merges Dependabot PRs (non-major, reviewed, 0 open threads) instead.

## Notes
- No npm entry in Dependabot and no `.npmrc` cooldown: the package has zero dependencies by design (CONTRIBUTING rule 1), so there is nothing to update or install.
- The zizmor job is not a required check. Add it to the `protect-main` ruleset if you want it to block merges.
