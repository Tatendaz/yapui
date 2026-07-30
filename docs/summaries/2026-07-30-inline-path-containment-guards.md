# Session: inline containment guards (round 2 of the CodeQL fix)

**Branch:** fix/inline-path-containment-guards
**Date:** 2026-07-30

## Prompts
1. "Can you create prs fixing the stuff found in security tab for the 3 repos?"
2. "merged yapui" — after which the post-merge CodeQL scan showed alerts #1/#2 still open at the moved sink lines (159/162), prompting this follow-up.

## Steps taken
- Confirmed the merge scan completed successfully with both
  `js/path-injection` alerts still open — the `insideDir()` helper from #9
  was not recognized as a barrier guard.
- Inlined both `path.relative` checks in `serveSibling()`, deleted the
  helper, added inline comments warning future refactors not to re-extract
  them.
- Added a deep-relative-traversal e2e case; ran `npm test`.
- Verified the PR's CodeQL analysis before reporting the alerts fixed.

## Decisions
- Inline over helper: CodeQL's barrier-guard recognition for
  `js/path-injection` is intra-procedural in practice; readability cost is
  two extra lines per site, accepted for a verifiable guard.
- No dismissal-as-false-positive: the code was safe either way, but a
  verifiable guard is strictly better than an unverifiable one plus a
  dismissal.
