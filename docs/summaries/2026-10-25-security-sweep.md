# Session: security sweep 2026-10-25

**Branch:** security/sweep-2026-10-25
**Date:** 2026-10-25

## Prompts
1. "You are worker sec-w7 in the 2026-10-25 security sweep. Read BRIEF.md now and follow it exactly. Your repos: graph_express onemind dental-scan-viewer yapui."
2. "Pick old, safe versions, never latest: bump only the named package, to the lowest fixing version, published on or before 2026-10-18."

## Steps taken
- IOC grep, commit-author check, deploy keys, webhooks, secrets, branch protection: nothing unexpected.
- `gitleaks git .` and `gitleaks dir .`: no leaks. `osv-scanner`: no package sources (zero dependencies).
- `zizmor` + `actionlint` on `.github/workflows`: pinned the two floating actions in `dependency-review.yml`.
- Security read of `relay/server.js`, `relay/agent.js`, `relay/widget.js`.
- Ran `npm test`.

## Decisions
- Pinned to the SHA each floating tag points at today, both older than 7 days, so CI runs the same code as before.
- Node 20 in the test matrix is left as is: the workflow header says the matrix is tied to the branch ruleset and must move in three steps.
