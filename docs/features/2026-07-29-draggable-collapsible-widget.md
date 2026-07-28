# Feature: draggable feedback boxes + collapsible task queue

**Branch:** feat/draggable-collapsible-widget
**Date:** 2026-07-29

## Summary
Both floating widget surfaces — the task queue and the Feedback panel/button — can
now be dragged anywhere on the page (positions persist in localStorage), and the
task queue collapses to a compact status pill via a **▾** toggle in its header.
The queue's default position moves from top-right to bottom-right.

## Motivation
The widget floats over pages it doesn't control, so any fixed corner will
eventually cover something that matters. This happened in real use: the queue box
sat exactly on top of a served page's own sticky-header controls (a search box and
a theme toggle), and the resident agent couldn't help — the widget lives outside
the directory it's allowed to edit, so the user's "move this box" notes were
misapplied to the page instead. Position is a user preference; it now belongs to
the user, not the stylesheet.

## What changed
- `relay/widget.js`
  - Queue default position: `top:18px` → `bottom:18px` (bottom-right, mirroring
    the Feedback button bottom-left; page headers are the most common collision).
  - New drag layer: `makeDraggable(el, handle, key)` using pointer events with
    `setPointerCapture` (mouse + touch), a 5px intent threshold so clicks stay
    clicks, viewport clamping, and persistence under `kfb-pos:<box>` keys.
    Handles: the queue header, the panel's title bar, and the launch button
    itself (a drag on it suppresses the click that would open the panel).
  - Saved positions are restored on load, re-clamped on window resize.
  - New collapse toggle (`#kfb-qmin`) in the queue header; collapsed state
    (`kfb-min` class) hides the card list/footer and shrinks the box to a pill
    showing only the live status text and count. Persists under `kfb-qmin`.
    The auto-refresh countdown re-expands a collapsed queue so it can't fire
    invisibly, and cancelling it stays possible.
  - `isOurs()` (element picker guard) generalized to `[id^="kfb-"]` — boxes can
    now sit anywhere, so every widget surface must be unpickable, not just the
    ones that used to live in fixed corners.
  - The `#kfb-qcount` badge sits beside the status text instead of the far right
    (the collapse toggle takes the right edge).
- `test/e2e.test.js` — new `testWidgetContract()` section pinning the drag /
  collapse / bottom-right contract at the source level (the suite's established
  approach for browser-only widget code).
- `SKILL.md` — Browser-states section documents the new default position, drag,
  and collapse.

## Notes
- Zero dependencies, as ever — the drag layer is ~50 lines of pointer-event code.
- Positions/collapse persist via localStorage, which is per **origin** — every
  page served from the same relay port shares one remembered spot (a corner
  preference, not a per-page layout). Clearing site data resets to defaults.
- Expanding a collapsed queue re-clamps it, so a pill dragged flush to an edge
  can't grow off-screen.
- No relay/server changes; existing pages pick this up on their next widget
  self-reload.
