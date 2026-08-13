---
spike: 006
name: delayed-status-progress
type: standard
validates: "Given a registerCommand handler awaiting a simulated multi-second clone, when wrapped in a delay(~1s)->show->auto-clear helper over ctx.ui.setStatus, then the footer text appears only after the delay, live-updates mid-await, and clears in a finally even on error"
verdict: VALIDATED
related: ["007a", "007b"]
tags: [pi-extension, ui, progress, tui]
---

# Spike 006: delayed-status-progress

## What This Validates

Given a `registerCommand` handler that awaits a simulated multi-second
"clone" operation, when the operation is wrapped in a hand-rolled
delay(~1s)->show->auto-clear helper built on `ctx.ui.setStatus`, then:

- the footer status text appears only after the delay elapses (no flicker
  on an operation that finishes before the delay),
- it visibly updates its text while the handler is still `await`-ing
  further work (proving the TUI repaints from inside a plain `setTimeout`
  callback, not just on keystroke or LLM-stream ticks), and
- it reliably clears in a `finally` block, including on the error path.

This is the mechanism question behind the whole idea: does Pi's extension
UI surface support a delayed-then-auto-clearing progress message at all,
given that `ctx.ui.setWorkingMessage`/`setWorkingIndicator`/`setWorkingVisible`
are documented as streaming-only, and `/claude:plugin install` runs inside a
`registerCommand` handler that never streams an LLM turn.

## Research

Read `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` and
`docs/tui.md` first (see spike CONVENTIONS.md and MANIFEST.md for the full
survey). No built-in delayed-show/auto-clear primitive exists anywhere in
`ctx.ui`. Three usable primitives compose with a hand-rolled `setTimeout`
wrapper: `setStatus` (footer, persists until cleared), `setWidget`
(ambient, above/below editor), and `ctx.ui.custom()` + `BorderedLoader`
(modal, cancellable). This spike targets `setStatus` specifically, because
it's the lightest-weight and most literally documented for "mode
indicators" / persistent footer text.

**Primary-source confirmation, not just a doc read:** grepped the actual
runtime (not just `.d.ts` files) for how `setStatus` reaches the screen.
`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js`:

```js
setExtensionStatus(key, text) {
    this.footerDataProvider.setExtensionStatus(key, text);
    this.ui.requestRender();
}
```

`setStatus` calls `this.ui.requestRender()` synchronously, every time.
`setWidget` does the same through `renderWidgets()` (`... this.ui.requestRender();`
at the tail). This means the repaint is explicitly triggered by the state
mutation itself, not gated behind a keystroke or an LLM-stream tick --
which is what makes calling `ctx.ui.setStatus` from inside a bare
`setTimeout` callback (mid-`await`, no user input involved) a reasonable
bet. Confirming it via source reading (the actual shipped `.js`, not the
`.d.ts` surface) follows the same "verify from primary sources, not doc
summaries" discipline as spike 004's competitor-research finding.

The `titlebar-spinner.ts` and `working-indicator.ts` bundled examples
(`node_modules/@earendil-works/pi-coding-agent/examples/extensions/`)
corroborate this indirectly: both drive visible, continuously-animating UI
from a bare `setInterval`, not from any streaming or input hook, which only
makes sense if Pi's TUI repaints independent of user input.

## How to Run

Automated smoke test (proves the extension loads and the handler doesn't
crash on either path; proves nothing about visual behavior):

```bash
cd .planning/spikes/006-delayed-status-progress
pi -e ./extension.ts --print --no-session --offline "/spike-progress fast"
pi -e ./extension.ts --print --no-session --offline "/spike-progress error"
```

Both exit 0 with no stderr today (confirmed in the Investigation Trail
below). `--print` mode has no footer, so it cannot show anything about the
actual delayed-status behavior -- that needs a real interactive session:

```bash
pi -e .planning/spikes/006-delayed-status-progress/extension.ts
```

Then, inside the session, run each of:

- `/spike-progress fast` -- 400ms simulated clone
- `/spike-progress slow` -- 3000ms simulated clone, label changes at 1.5s
- `/spike-progress error` -- 2000ms simulated clone, then throws

## What to Expect

- `fast`: no status text ever appears in the footer. A `fast: done after
~400ms` info notification appears when it finishes.
- `slow`: nothing for about 1 second, then `● Cloning marketplace...`
  appears in the footer. At about 1.5s from the start, the text changes
  live to `● Resolving refs...` with no flicker or disappearance in
  between. At 3s, the status disappears and a `slow: done after ~3000ms`
  notification appears.
- `error`: same appearance as `slow` at ~1s, but the status must disappear
  even though the operation throws, and the notification reads `error:
failed after ~2000ms (status should be clear) -- simulated clone
failure`. Confirm no status text is left behind in the footer.

## Investigation Trail

Built `extension.ts` with a generic `withDelayedStatus()` helper
parameterized on `label`, `delayMs`, and a `task` callback that receives a
`setLabel` function for the live-update case.

Before asking for human verification, ran the automated smoke test to rule
out the cheap failure modes (syntax errors, import errors, unhandled
rejections) so the interactive check only has to confirm visual behavior:

```text
$ pi -e ./extension.ts --print --no-session --offline "/spike-progress fast"
EXIT CODE: 0, stdout empty, stderr empty

$ pi -e ./extension.ts --print --no-session --offline "/spike-progress error"
EXIT CODE: 0, stdout empty, stderr empty
```

`--print` mode produces no observable output at all for either path --
`ctx.ui.notify` apparently has nowhere to render in that mode, and there is
no footer. That's expected and is exactly why this spike needs a human in
an interactive session; the automated run only proves the code path
doesn't crash on either the happy path or the throw path.

Read the shipped runtime source (not just `.d.ts`) for `setExtensionStatus`
and `setExtensionWidget` to confirm both call `requestRender()`
unconditionally -- see Research above. This is the strongest evidence
available before a human watches the terminal.

## Results

**VALIDATED.** Human verification in a live `pi` session confirmed the
delay(~1s)->show->auto-clear mechanism over `ctx.ui.setStatus` behaves as
predicted: `fast` shows nothing, `slow` appears only after the delay,
live-updates its text mid-await, and clears cleanly, and `error` clears
even on the throw path. This confirms the `requestRender()` source-reading
evidence from the Research section: `setStatus` does repaint correctly
from inside a bare `setTimeout` callback with no keystroke or LLM-stream
tick involved.

The user's own framing after trying all three of 006/007a/007b side by
side: `setStatus` (this spike) is right for ambient, ignorable state, not
for a single bounded operation someone is actively waiting on and might
want to cancel -- see 007b's Results for the winning modality and why.
