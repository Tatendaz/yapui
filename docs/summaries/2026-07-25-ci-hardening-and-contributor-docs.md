# Session: CI hardening and contributor docs

**Branch:** chore/ci-hardening-and-contributor-docs
**Date:** 2026-07-25

## Prompts

1. "Implement the CI/CD hardening for yapui — harden test.yml but the job name must keep
   emitting exactly `test (20)` and `test (22)`, add engines, look for real test gaps and
   report honestly either way, fix CONTRIBUTING's 'plus a human pass' line, add CODEOWNERS.
   Don't touch any GitHub setting; I'll apply the ruleset change."

## Steps taken

- Installed the hardened `test.yml`: `permissions: contents: read`, PR-scoped
  `concurrency`, `timeout-minutes: 10`, `fail-fast: false`, SHA-pinned actions, and a
  package-invariants step (zero dependencies + `engines.node` consistent with the leg).
- Verified both action pins against the GitHub API before committing them. Each SHA is the
  exact commit its floating `v4` tag resolves to today (`checkout` v4.4.0
  `11d5960a…`, `setup-node` v4.4.0 `49933ea5…`), so pinning freezes current behaviour
  rather than changing it. A wrong pin here would have failed every PR on a protected
  branch.
- Added `"engines": { "node": ">=20" }` and made CI assert it against the matrix, so the
  two can no longer drift apart silently.
- Audited coverage module by module before writing anything: `flip-status.js` had only its
  happy path, `server.js` had eight routes with no test at all, `agent.js` had no coverage
  of its two most likely real-world failure modes, and `widget.js` was never parsed by
  anything. Added 41 assertions across three new sections (29 → 70).
- Mutation-tested the new assertions: broke each behaviour under test one at a time in a
  throwaway copy and confirmed a specific test failed. Twelve mutations, twelve kills —
  after a first round caught that the recycle test was vacuous and had to be rewritten to
  observe the relay's actual recycle log.
- Rewrote `CONTRIBUTING.md`'s review section against the ruleset as it will be, added
  fork/branch instructions, the docs-pair convention, and the Pages deploy warning.
- Added `.github/CODEOWNERS` and reconciled the PR template.

## Decisions

- **Matrix left at `[20, 22]` despite Node 20 being EOL.** The required status checks are
  matched by name, so the matrix and the ruleset have to move together. Changing the matrix
  in this PR would either create an unrequired check or block every merge on a context that
  never reports again. The safe order — add 24, update the ruleset, then drop 20 — is
  written into the workflow header instead of half-applied here.
- **The header comment sits above `name:`, not beside it.** A trailing `# comment` on that
  line parses fine today, but the whole point of the comment is that the string must never
  drift; putting anything after it on the same line is the wrong place to be clever.
- **`push: [main]` kept, and kept out of the concurrency cancellation.** The original
  argument was that a non-strict ruleset lets a stale branch merge untested. With
  `strict_required_status_checks_policy: true` that argument goes away — but adding an
  admin to `bypass_actors` creates a direct-push path to `main`, and for those commits the
  push run is the only CI signal that will ever exist. Same conclusion, different reason.
- **No DOM shim for `widget.js`.** Testing 547 lines of browser IIFE would mean a fake DOM,
  which means either a dependency or a large hand-rolled shim — both worse than the gap.
  The suite instead asserts the file is served verbatim over `/__feedback.js` and parses as
  valid JavaScript, which is the regression that would actually ship unnoticed. Its
  behaviour is honestly still untested.
- **CI asserts `engines.node`, not just its presence.** A `>=22` bump with `20` still in the
  matrix now fails the Node 20 leg loudly, instead of leaving two contradictory statements
  of the supported range in the repo.
- No new npm dependencies, and nothing outside the repo files was touched — the ruleset
  edit is applied separately by the maintainer.
