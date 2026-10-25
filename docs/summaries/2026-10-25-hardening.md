# Session: supply-chain hardening 2026-10-25

**Branch:** security/hardening-2026-10-25
**Date:** 2026-10-25

## Prompts
1. "PHASE 2 from coordinator (owner approved): after you finish the sweep for all your repos and write your _done file, do NOT stop. Read HARDENING.md and do it for each of your repos: Dependabot config with 7-day cooldown, package-manager cooldown, CI lockdown (npm ci, SHA pins, least permissions, zizmor job, gitleaks job on private repos). One more PR per repo, same review and merge rules."
2. "UPDATE from coordinator: HARDENING.md changed. (a) New section 5: add the auto-merge job from templates/merge-when-clean.yml to every repo you harden. (b) Do NOT add dependabot[bot] to CodeRabbit ignore lists; remove it if you already did."

3. "UPDATE from coordinator: templates/merge-when-clean.yml is now v2 … replace it with v2, unchanged."
4. "UPDATE from coordinator: Delete .github/workflows/dependabot-auto-merge.yml in every hardening PR (it merges Dependabot PRs with no review; merge-when-clean v2 covers Dependabot now)."

## Steps taken
- Confirmed every config key before use: Dependabot `cooldown.default-days` (GitHub docs: supported for github-actions), `schedule.interval: monthly`; CodeRabbit `reviews.auto_review.ignore_usernames` (schema.v2.json); zizmor-action v0.7.1 inputs `version`, `inputs`, `min-severity`, `advanced-security`.
- Picked zizmor-action v0.7.1 (2026-10-15) and zizmor 1.31.1 (2026-10-15), both older than 7 days.
- After the coordinator update: removed `.coderabbit.yaml` (it only held the Dependabot ignore) and copied `merge-when-clean.yml` unchanged.
- Ran `zizmor` (0 findings), `actionlint` (no errors), `npm test`.

- Replaced merge-when-clean with template v6 (sha256 af7e7bd9…) and deleted `dependabot-auto-merge.yml`.

## Decisions
- No gitleaks job: the repo is public, and GitHub secret scanning covers public repos.
- `advanced-security: false` so the job fails on findings instead of uploading SARIF (that would need `security-events: write`).
