# Session: draggable + collapsible widget boxes

**Branch:** feat/draggable-collapsible-widget
**Date:** 2026-07-29

## Prompts

1. "can you check whats going on I asked claude to move the claude is ready
   -instant fixes boxes to a lower position but its not doing it. is the
   html-preview skill not working?"
2. "yes do it for yapui but mke the box collapsble and can be dragged to move it
   out of the way do the same for the feedback box as well as this may be in the
   way of some content in the future"

## Steps taken
- Diagnosed the original complaint: the "⚡ Claude is ready — instant fixes" box
  is the widget's task queue, fixed at top-right, and it was covering the served
  page's own header controls. The resident agent (sandboxed to the page's
  directory) couldn't edit the widget and had misapplied the request to a page
  section instead.
- Branched `feat/draggable-collapsible-widget` off `origin/main`.
- `relay/widget.js`: queue default moved to bottom-right; added a pointer-event
  drag layer (5px click-vs-drag threshold, viewport clamping, per-box
  `kfb-pos:*` persistence, restore on load, re-clamp on resize) wired to the
  queue header, the panel header, and the launch button; added the queue
  collapse-to-pill toggle with `kfb-qmin` persistence and auto-expand when the
  refresh countdown starts; generalized the element-picker guard to all
  `kfb-` surfaces.
- `test/e2e.test.js`: added `testWidgetContract()` — nine source-level
  assertions pinning the drag handles, persistence keys, click suppression,
  collapse toggle, countdown re-expand, and the bottom-right default.
- `SKILL.md`: updated the Browser-states bullet for the new position + drag +
  collapse.
- Ran the full suite on the branch: all tests pass, `node --check` clean.
- CodeRabbit CLI pre-push rounds (both clean of critical/major): re-clamp an
  expanded queue that was dragged while collapsed so it can't grow off-screen,
  flip the toggle's aria-label with its state, and correct the persistence
  wording — localStorage is per **origin**, so pages on one relay port share
  the remembered spot.
- Synced the finished `relay/widget.js` back to the local html-preview skill
  copy (which also picked up this repo's newer freeUrl/isContentEditable fixes).

## Decisions
- Bottom-right as the new queue default: page headers are the most common
  collision surface, and bottom-left is taken by the launch button.
- Drag implemented with pointer events + `setPointerCapture` rather than
  mouse/touch event pairs — one code path, works on both, survives cancels.
- Source-level contract tests rather than a DOM harness: the widget only runs
  in a browser and the suite is zero-dependency by ground rule; this follows
  the suite's existing precedent (`--check` + verbatim-serving assertions).
- Collapse is per-user persistent, but the auto-refresh countdown force-expands
  the queue — a hidden countdown must never reload the page invisibly.
