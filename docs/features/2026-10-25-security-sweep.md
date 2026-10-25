# Feature: pin the dependency-review workflow's actions

**Branch:** security/sweep-2026-10-25
**Date:** 2026-10-25

## Summary
`dependency-review.yml` now pins `actions/checkout` and
`actions/dependency-review-action` to full commit SHAs and sets
`persist-credentials: false` on checkout.

## Motivation
The 2026-10-25 security sweep ran `zizmor` over the workflows. It flagged
two floating tags (`@v5`, `@v4`) and a checkout that leaves the job token in
`.git/config`. A moved tag would run new code in CI with no review. The
other workflows were already pinned.

## What changed
- `actions/checkout@v5` → `@fbc6f39… # v5.1.0` (what `v5` points at today, published 2026-07-16).
- `actions/dependency-review-action@v4` → `@2031cfc… # v4.9.0` (what `v4` points at today, published 2026-03-03).
- `persist-credentials: false` on checkout.

## Notes
No behavior change. `zizmor` and `actionlint` are clean on the file after the change.
