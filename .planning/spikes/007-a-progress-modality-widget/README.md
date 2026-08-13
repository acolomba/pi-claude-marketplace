---
spike: 007a
name: progress-modality-widget
type: comparison
validates: "Given the same delay/auto-clear helper as spike 006, when mounted via ctx.ui.setWidget for a simulated multi-step clone, then observe the ambient, non-blocking feel of a multi-line checklist"
verdict: VALIDATED
related: [006, "007b"]
tags: [pi-extension, ui, progress, tui, comparison]
---

# Spike 007a: progress-modality-widget

## What This Validates

Comparison spike, variant a of 2 (see
`../007-b-progress-modality-bordered-loader/`). Same delay(~1s)->show->
auto-clear mechanism as spike 006, but mounted via `ctx.ui.setWidget`
instead of `ctx.ui.setStatus`, and rendering a multi-step checklist
(pending/active/done) instead of one line. The docs literally call
`setWidget` "good for todo lists, progress" -- this spike tests whether
that's actually the better fit than a status line once an operation has
more than one visible sub-step (e.g. resolve source -> clone -> read
manifest, which is roughly what `marketplace add` / `install` do).

## Research

Same primitive survey as spike 006 (see its README and
`.planning/spikes/MANIFEST.md`). `setExtensionWidget()` in the shipped
runtime (`interactive-mode.js`) calls `renderWidgets()`, whose last line is
`this.ui.requestRender()` -- same unconditional-repaint guarantee as
`setStatus`, so the mechanism risk from spike 006 carries over directly;
this spike is purely about the felt comparison, not a second feasibility
check.

## How to Run

Automated smoke test (crash-only, no visual signal):

```bash
cd .planning/spikes/007-a-progress-modality-widget
pi -e ./extension.ts --print --no-session --offline "/spike-widget fast"
pi -e ./extension.ts --print --no-session --offline "/spike-widget error"
```

Both exit 0 with no stderr today. Interactive verification:

```bash
pi -e .planning/spikes/007-a-progress-modality-widget/extension.ts
```

Then, inside the session:

- `/spike-widget fast` -- 400ms single-step clone
- `/spike-widget slow` -- three ~900ms steps
- `/spike-widget error` -- throws partway through step 2

## What to Expect

- `fast`: no widget ever appears above the editor.
- `slow`: nothing for about 1 second, then a 3-line checklist appears above
  the editor already showing step 1 (`● Resolving marketplace source...`)
  active and steps 2-3 dim/pending (`○`). Roughly every 900ms one line
  flips to done (`✓`, dimmed) and the next lights up active, live, with no
  flicker. After step 3 completes the whole widget disappears.
- `error`: same appearance as `slow` through step 1 completing, then the
  widget must disappear even though step 2 throws; an error notification
  follows.

## Investigation Trail

Built `extension.ts` reusing spike 006's `withDelayedStatus` shape as
`withDelayedWidget`, parameterized on an array of `Step` objects instead of
a single label, with an `advance(index)` callback instead of `setLabel`.

Automated smoke test:

```text
$ pi -e ./extension.ts --print --no-session --offline "/spike-widget fast"
EXIT CODE: 0

$ pi -e ./extension.ts --print --no-session --offline "/spike-widget error"
EXIT CODE: 0
```

Both ran clean on the first attempt -- `setWidget` behaves the same as
`setStatus` outside TUI mode (silent no-op), unlike `ctx.ui.custom()` in
007b, which needed a `hasUI` guard after crashing in print mode. Worth
carrying forward: `setStatus`/`setWidget` degrade gracefully outside TUI
mode by design; `ctx.ui.custom()` does not, and callers must check
`ctx.hasUI` themselves.

## Results

**VALIDATED as a working mechanism, LOSES the head-to-head.** The
delay/auto-clear/live-update behavior worked exactly like 006's -- the
checklist appeared on schedule, advanced through steps live, and cleared
cleanly. But in the human side-by-side comparison against 007b, the ambient
ignorable style that makes `setWidget` right for a persistent todo list
worked against it here: for a single bounded operation the user is
actively waiting on, blending into the background read as less
appropriate than 007b's deliberately attention-grabbing modal. See
`../007-b-progress-modality-bordered-loader/README.md` for the winning
variant and why.

This is not a dead end: the multi-step checklist rendering built here is
the right shape for a future feature where multiple things install/update
concurrently and the user is _not_ actively blocked waiting on any one of
them (e.g. a batch `import` cascade) -- ambient and non-blocking is a
feature there, not a weakness.
