# Feature: canonical path-containment check in the relay's sibling server

**Branch:** fix/relay-path-traversal
**Date:** 2026-07-30

## Summary
`serveSibling()` now proves containment with a shared `insideDir()` helper
built on `path.relative()` instead of two hand-rolled
`startsWith(prefix + sep)` comparisons. Behavior is unchanged for every
legitimate request; the guard shape is now the canonical one.

## Motivation
CodeQL (`js/path-injection`, alerts #1 and #2) flagged the `statSync` /
`readFileSync` sinks at relay/server.js:155,158. The existing guards
(dotfile/`..` segment filter, prefix check, realpath re-check) were sound,
but the prefix-concatenation shape is both unrecognizable to static
analysis and easy to regress. `path.relative` + `..`/absolute rejection is
the standard escape-proof form.

## What changed
- New `insideDir(rootReal, candidate)` helper; both containment checks
  (lexical and post-realpath) go through it.
- e2e hardening block: new cases for nested sibling assets (no
  over-rejection), mixed-encoding traversal, and null-byte paths.

## Notes
Resolves code scanning alerts #1 and #2 on the next scan of main. The
existing symlink-escape and dotfile tests keep covering the realpath
guard.
