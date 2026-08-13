# Progress Messages for Long-Running Operations

## Requirements

- Live progress feedback is a foreground, user-initiated-command concern
  (`install`, `update`, `marketplace add`, `marketplace update`), not a
  background-autoupdate concern -- this project's autoupdate is opt-in,
  timer-free, and runs only inside an explicit `marketplace update` call,
  so there is no background daemon to show progress for. A staged/
  decoupled-notification pattern for a future background autoupdate is a
  separate product decision (`docs/competitive-analysis/pi-plugins.md`
  recommendation #3), not a UI-capability question -- do not conflate the
  two when this eventually gets built.
- The delay-before-show interval must be ~1 second, not shorter and not
  longer. This tracks Nielsen Norman Group's response-time thresholds
  (~0.1s reads as instant, ~1.0s is where a delay becomes noticeable and
  earns feedback, ~10s is the attention-span limit) and matches
  industry-conventional practice for avoiding spinner flicker on fast
  paths.
- Use `ctx.ui.custom()` + `BorderedLoader` (or a label-settable variant of
  it), gated behind the ~1s delay helper, for foreground
  install/update/marketplace-add progress. Do not use `ctx.ui.setStatus`
  or `ctx.ui.setWidget` for this -- see What to Avoid.
- All user-visible output still funnels through `shared/notify.ts` per
  IL-2/the notify-discipline grep gate. The progress indicator itself
  (the loader) is a distinct, ephemeral UI surface, not a `notify()` call
  -- the completion/failure message that follows it still goes through
  `notify()` as normal.

## How to Build It

Pi's `@earendil-works/pi-coding-agent` extension UI (`ctx.ui`) has **no
built-in delayed-show/auto-clear primitive**. Build a small wrapper around
`ctx.ui.custom()` + `BorderedLoader` (from
`@earendil-works/pi-coding-agent`):

```ts
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";

const DELAY_MS = 1000;

interface DelayedLoaderResult<T> {
  value?: T;
  cancelled: boolean;
  error?: Error;
}

async function withDelayedLoader<T>(
  ctx: ExtensionCommandContext,
  label: string,
  delayMs: number,
  task: (signal: AbortSignal, setLabel: (text: string) => void) => Promise<T>,
): Promise<DelayedLoaderResult<T>> {
  if (!ctx.hasUI) {
    // ctx.ui.custom() has nothing to mount in json/print modes.
    // Fall back to plain notify() -- see What to Avoid.
    return { cancelled: false, error: new Error("no UI available") };
  }

  return ctx.ui.custom<DelayedLoaderResult<T>>((tui, theme, _kb, done) => {
    const controller = new AbortController();
    let settled = false;
    let loader: BorderedLoader | undefined;
    let currentLabel = label;

    const finish = (result: DelayedLoaderResult<T>): void => {
      if (settled) return;
      settled = true;
      done(result);
    };

    const timer = setTimeout(() => {
      loader = new BorderedLoader(tui, theme, currentLabel);
      loader.onAbort = () => controller.abort();
      tui.requestRender();
    }, delayMs);

    const setLabel = (text: string): void => {
      currentLabel = text;
      if (loader) {
        // BorderedLoader has no label setter -- recreate it. See What to Avoid.
        loader.onAbort = undefined;
        loader = new BorderedLoader(tui, theme, currentLabel);
        loader.onAbort = () => controller.abort();
        tui.requestRender();
      }
    };

    task(controller.signal, setLabel)
      .then((value) => finish({ value, cancelled: false }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          finish({ cancelled: true });
          return;
        }
        finish({ cancelled: false, error: error instanceof Error ? error : new Error(String(error)) });
      });

    return {
      render: (width: number) => (loader ? loader.render(width) : []),
      invalidate: () => loader?.invalidate(),
      handleInput: (data: string) => loader?.handleInput(data),
      dispose: () => {
        clearTimeout(timer);
        loader?.dispose();
      },
    };
  });
}
```

Key mechanics, each confirmed against the shipped runtime, not just its
`.d.ts`:

- The delay timer only *opens the modal*; the wrapped operation starts
  immediately regardless. A fast operation that finishes before the delay
  never shows anything.
- `ctx.ui.setStatus()`/`ctx.ui.setWidget()` (and by extension this
  `custom()`-based loader) repaint the TUI unconditionally on every call --
  `interactive-mode.js`'s `setExtensionStatus()`/`renderWidgets()` both
  call `this.ui.requestRender()` synchronously, with no dependency on a
  keystroke or an LLM-stream tick. Calling any of them from inside a bare
  `setTimeout` callback mid-`await` is safe and does repaint live.
- Return an **object literal** proxying `render`/`invalidate`/
  `handleInput`/`dispose` to a mutable `loader` variable, not a
  `BorderedLoader` instance directly -- the instance doesn't exist yet
  when the delay hasn't fired, and needs to be recreated on a label
  change (`BorderedLoader` has no setter).
- Wire `task`'s `AbortSignal` through every `await` point (a `sleep()`
  helper or the real network call) so Escape-to-cancel actually
  interrupts the operation, not just the display.

## What to Avoid

- **`ctx.ui.setStatus`/`ctx.ui.setWidget` for this job.** Both are
  documented and built for *ambient, ignorable* state -- a persistent mode
  indicator (`setStatus`) or a todo-list-style checklist you check in on
  (`setWidget`). Human verification (spikes 006/007a vs 007b) confirmed
  that register is *wrong* for a single bounded operation the user is
  actively waiting on and might want to cancel: it blends into the
  background when it should visually set itself apart. Save `setWidget`
  for a future non-blocking batch operation instead (e.g. a multi-plugin
  `import` cascade where the user isn't blocked on any one item).
- **Calling `ctx.ui.custom()` without a `ctx.hasUI` guard.** It returns
  `undefined` when `hasUI` is false (json/print modes), despite being
  typed `Promise<T>` with no `| undefined` -- a real gap between the
  documented type and actual runtime behavior. Any caller destructuring
  the result without checking `ctx.hasUI` first will throw. `setStatus`/
  `setWidget` degrade to a silent no-op outside TUI mode by design and
  need no such guard -- this asymmetry is specific to `custom()`.
- **Assuming `BorderedLoader` supports a label update.** It doesn't.
  Changing the visible text mid-operation means destroying and recreating
  the whole component (see How to Build It). This did not read as
  objectionable in live verification, but a genuine multi-phase clone
  (resolve source -> fetch -> checkout) hits this recreate cost on every
  phase transition. A real build should add a label setter to (or wrap)
  `BorderedLoader` rather than accept it silently on every call site.
- **Trusting a `.d.ts` file alone for a host-API behavior question.** The
  `requestRender()` and `hasUI`-returns-`undefined` findings above only
  surfaced from reading the shipped `.js` in
  `node_modules/@earendil-works/pi-coding-agent/dist/` and from an
  automated non-interactive smoke test, respectively -- neither is stated
  in the `.d.ts` comments.

## Constraints

- `@earendil-works/pi-coding-agent` ships no delayed-show/auto-clear
  primitive; this is always hand-rolled on top of `ctx.ui.custom()` +
  `BorderedLoader`.
- `BorderedLoader`'s constructor and `signal`/`onAbort` API is stable as
  of the pinned dev dependency version (`^0.83.0`) and the locally
  installed CLI (`0.84.1`) used for verification -- re-check on any future
  Pi API bump given NFR-11 floor-pinning.
- The modal takes exclusive keyboard focus while open; this is correct
  for a single foreground command but would be wrong to apply to
  multiple concurrent operations at once (there is exactly one modal
  slot).

## Origin

Synthesized from spikes: 006, 007a, 007b
Source files available in: `sources/006-delayed-status-progress/`,
`sources/007-a-progress-modality-widget/`,
`sources/007-b-progress-modality-bordered-loader/`
