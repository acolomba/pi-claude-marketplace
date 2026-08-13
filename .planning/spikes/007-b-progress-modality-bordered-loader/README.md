---
spike: 007b
name: progress-modality-bordered-loader
type: comparison
validates: "Given the same helper as spike 006/007a, when mounted via ctx.ui.custom() + BorderedLoader for a simulated clone, then observe the modal, cancellable feel head-to-head against 007a's ambient widget"
verdict: "✓ WINNER"
related: [006, "007a"]
tags: [pi-extension, ui, progress, tui, comparison]
---

# Spike 007b: progress-modality-bordered-loader

## What This Validates

Comparison spike, variant b of 2 (see
`../007-a-progress-modality-widget/`). Same delay(~1s)->show->auto-clear
mechanism, mounted via `ctx.ui.custom()` + `BorderedLoader` -- the pattern
`docs/tui.md` names explicitly for "async operations with cancel," and the
same primitive `@nklisch/pi-plugins` (our one real competitor) uses to
mount its whole interactive manager. Unlike 006/007a, this variant is
modal: it takes over keyboard focus and offers Escape-to-cancel, wiring an
`AbortSignal` through to the simulated clone.

## Research

Same primitive survey as spike 006. `BorderedLoader`
(`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/bordered-loader.js`)
wraps `CancellableLoader`/`Loader` from `@earendil-works/pi-tui` with a
border and a keybinding hint, and exposes `signal`/`onAbort` for wiring
cancellation. It has no delay-before-open and no label-update method, so
this spike wraps it in a small `Container`-shaped adapter that (a) defers
construction until the delay fires and (b) recreates the loader to change
its label, since `BorderedLoader` has no public setter. That recreation is
itself part of what this comparison is judging -- see What to Avoid.

Competitor precedent: `docs/competitive-analysis/pi-plugins.md` documents
`@nklisch/pi-plugins`' interactive manager mounting through
`context.ui.custom()`, the same primitive, for their full My
Plugins/Marketplaces UI -- corroborating evidence that this is the
established idiomatic path for anything richer than a status line, not
just a documentation claim.

## How to Run

Automated smoke test (crash-only, no visual signal):

```bash
cd .planning/spikes/007-b-progress-modality-bordered-loader
pi -e ./extension.ts --print --no-session --offline "/spike-loader fast"
pi -e ./extension.ts --print --no-session --offline "/spike-loader error"
```

Both exit 0 with no stderr today (after adding a `ctx.hasUI` guard -- see
Investigation Trail). Interactive verification:

```bash
pi -e .planning/spikes/007-b-progress-modality-bordered-loader/extension.ts
```

Then, inside the session:

- `/spike-loader fast` -- 400ms simulated clone
- `/spike-loader slow` -- 3000ms simulated clone, label changes at 1.5s
- `/spike-loader error` -- 2000ms simulated clone, then throws
- `/spike-loader cancel` -- 5000ms simulated clone; press Escape once the
  modal opens

## What to Expect

- `fast`: no modal ever opens; the command just returns.
- `slow`: nothing for about 1 second, then a bordered spinner box opens
  showing `Cloning marketplace...` and a "cancel" key hint. At ~1.5s the
  label changes to `Resolving refs...` (watch for any visible flicker from
  the recreate-the-loader workaround). At 3s the modal closes on its own
  and a `slow: done after ~3000ms` notification appears.
- `error`: modal opens the same as `slow`, then closes on the throw at
  ~2s; notification reads `error: failed after ~2000ms (modal should be
closed) -- simulated clone failure`. Confirm no modal or stray border is
  left on screen.
- `cancel`: modal opens at ~1s; pressing Escape should close it
  immediately and produce a `cancel: cancelled after ~<1000-5000>ms`
  notification well before the full 5s would have elapsed.

## Investigation Trail

Built `extension.ts` with `withDelayedLoader()`, returning an object
literal that proxies `render`/`invalidate`/`handleInput`/`dispose` to a
mutable `loader` variable created only once the delay timer fires --
following the same object-literal-wrapper shape `docs/tui.md`'s Pattern 1
(SelectList) example uses, rather than returning a `BorderedLoader`
instance directly the way `docs/tui.md`'s own Pattern 2 example does,
because Pattern 2 assumes the loader exists synchronously when the factory
runs, which contradicts the delayed-open requirement here.

First automated smoke-test attempt crashed in print mode:

```text
$ pi -e ./extension.ts --print --no-session --offline "/spike-loader fast"
Extension error (command:spike-loader): Cannot read properties of undefined (reading 'cancelled')
```

`ctx.ui.custom()` returns `undefined` when `ctx.hasUI` is false (print/json
modes have nothing to mount a custom component into), which the naive
`await withDelayedLoader(...)` destructuring didn't guard against. Added an
explicit `if (!ctx.hasUI)` early-return with a plain `notify()` fallback,
after which both fast and error paths exit 0 clean. This is a real finding
independent of the interactive-UI question: `setStatus`/`setWidget` (006,
007a) degrade to a silent no-op outside TUI mode by design, but
`ctx.ui.custom()` does not -- any real usage must check `ctx.hasUI` first.

## What to Avoid

`BorderedLoader` has no label-update method, so a mid-flight text change
means destroying and recreating the whole component. Whether that reads as
a visible flicker or a clean swap is exactly the kind of thing the
automated smoke test cannot answer and the human checkpoint must judge --
if it flickers, that's a real argument against this modality for any
progress message with more than one phase (which install/update/clone
naturally have).

## Results

**WINNER.** Human verification confirmed the delay/auto-clear/cancel
mechanism worked as designed across `fast`/`slow`/`error`/`cancel`. In the
three-way side-by-side, this variant won on the exact property it was
built for: it visually "sets itself apart" from the rest of the session,
which is the right signal for a single bounded operation the user is
actively waiting on and might want to cancel -- as opposed to 006's status
line and 007a's widget checklist, both deliberately ambient/ignorable by
design, which is the wrong register for a foreground blocking wait.

Two design facts support the same conclusion independent of the felt
comparison (see Research above): `docs/tui.md` names `BorderedLoader`
specifically for "operations that take time and should be cancellable,"
and `@nklisch/pi-plugins` -- the one real competitor -- mounts its entire
interactive manager through the same `ctx.ui.custom()` primitive.

The mid-flight label change (`Cloning marketplace...` ->
`Resolving refs...`) required destroying and recreating the whole
`BorderedLoader`, because it has no public label setter. That recreation
did not read as objectionable in the live session, but it is a real
implementation gap: a genuine multi-phase clone (resolve source -> fetch ->
checkout) would hit this on every phase transition. A real build should
either extend `BorderedLoader` with a label setter or accept the recreate
cost as-is; it is not disqualifying, just a known rough edge.

**This settles the modality question for MANIFEST.md Requirements:** use
`ctx.ui.custom()` + `BorderedLoader` (or a label-settable variant of it)
for foreground install/update/marketplace-add progress, gated behind a
~1s delay-before-open helper, with the operation itself starting
immediately regardless of the delay.
