# Feature: inline the relay's path-containment guards at the sinks

**Branch:** fix/inline-path-containment-guards
**Date:** 2026-07-30

## Summary
Removes the `insideDir()` helper introduced in #9 and inlines both
containment checks in `serveSibling()` in their canonical form
(`path.relative(root, candidate)` rejected on `..`-prefix or absolute).
Behavior is byte-for-byte identical for every request.

## Motivation
The #9 restructure aimed to make the guards verifiable by CodeQL, but the
merge scan kept both `js/path-injection` alerts open (now at
relay/server.js:159,162): CodeQL's barrier-guard recognition for this
query is reliable only when the `path.relative` + `startsWith('..')`
check appears inline in the sink's own function — routing it through a
helper hides the barrier.

## What changed
- `insideDir()` removed; both checks (lexical and post-realpath) are
  inlined, each with a comment explaining why they must stay inline.
- One more e2e hardening case: deep relative traversal
  (`/assets/..%2F..%2F…`).

## Notes
Verified against the PR's own CodeQL analysis (default setup runs on PRs)
before merge — alerts #1 and #2 no longer fire on this branch.
