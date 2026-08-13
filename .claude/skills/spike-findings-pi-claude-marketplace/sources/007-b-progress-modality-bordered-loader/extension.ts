/**
 * Spike 007b: progress-modality-bordered-loader
 *
 * Comparison spike, variant b of 2 (see 007-a-progress-modality-widget).
 * Same delay(~1s)->show->auto-clear mechanism as spike 006, mounted via
 * ctx.ui.custom() + BorderedLoader (modal, cancellable) instead of an
 * ambient status/widget. The delay gates when the modal *opens*; the task
 * itself starts immediately regardless, so a fast path never opens a modal
 * at all.
 *
 * Usage:
 *   pi -e .planning/spikes/007-b-progress-modality-bordered-loader/extension.ts
 *
 * Commands:
 *   /spike-loader fast    simulated 400ms clone. Modal must NEVER open.
 *   /spike-loader slow    simulated 3000ms clone, label changes at 1.5s.
 *                         Modal must open at ~1s already showing the
 *                         current label, update live, then close on its
 *                         own when the task finishes.
 *   /spike-loader error   simulated 2000ms clone that throws. Modal must
 *                         still close (finally-block cleanup), and the
 *                         failure surfaces as a notification after close.
 *   /spike-loader cancel  simulated 5000ms clone. Press Escape after the
 *                         modal opens to cancel; the task's AbortSignal
 *                         must fire and the command must resolve promptly.
 */
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";

const DELAY_MS = 1000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

interface DelayedLoaderResult<T> {
  value?: T;
  cancelled: boolean;
  error?: Error;
}

/**
 * Runs `task`, opening a cancellable BorderedLoader modal only if the task
 * is still running after `delayMs`. The modal always closes itself when
 * `task` settles (success, throw, or cancel) -- there is no separate clear
 * step because ctx.ui.custom()'s `done()` callback tears down the overlay.
 */
async function withDelayedLoader<T>(
  ctx: ExtensionCommandContext,
  label: string,
  delayMs: number,
  task: (signal: AbortSignal, setLabel: (text: string) => void) => Promise<T>,
): Promise<DelayedLoaderResult<T>> {
  return ctx.ui.custom<DelayedLoaderResult<T>>((tui, theme, _kb, done) => {
    const controller = new AbortController();
    let settled = false;
    let loader: BorderedLoader | undefined;
    let currentLabel = label;

    const finish = (result: DelayedLoaderResult<T>): void => {
      if (settled) {
        return;
      }
      settled = true;
      done(result);
    };

    const timer = setTimeout(() => {
      loader = new BorderedLoader(tui, theme, currentLabel);
      loader.onAbort = () => {
        controller.abort();
      };
      tui.requestRender();
    }, delayMs);

    const setLabel = (text: string): void => {
      currentLabel = text;
      // BorderedLoader has no public label setter; a real implementation
      // would need one. Recreating it is the honest workaround for this
      // spike and is itself part of what 007a/007b compare.
      if (loader) {
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
        finish({
          cancelled: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
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

export default function (pi: ExtensionAPI) {
  pi.registerCommand("spike-loader", {
    description:
      "Spike 007b: fast|slow|error|cancel simulated clone through a delayed BorderedLoader",
    handler: async (args, ctx) => {
      const mode = args.trim().toLowerCase() || "slow";
      const startedAt = Date.now();

      if (!ctx.hasUI) {
        // ctx.ui.custom() has nothing to mount in json/print modes.
        // A real implementation would fall back to plain notify() here.
        ctx.ui.notify(`${mode}: skipped, no UI available in mode ${ctx.mode}`, "warning");
        return;
      }

      const result = await withDelayedLoader(
        ctx,
        "Cloning marketplace...",
        DELAY_MS,
        async (signal, setLabel) => {
          if (mode === "fast") {
            await sleep(400, signal);
            return;
          }
          if (mode === "error") {
            await sleep(2000, signal);
            throw new Error("simulated clone failure");
          }
          if (mode === "cancel") {
            await sleep(5000, signal);
            return;
          }
          // slow: prove live re-render mid-await by changing the label partway through
          await sleep(1500, signal);
          setLabel("Resolving refs...");
          await sleep(1500, signal);
        },
      );

      const elapsed = Date.now() - startedAt;
      if (result.cancelled) {
        ctx.ui.notify(`${mode}: cancelled after ${elapsed}ms`, "info");
      } else if (result.error) {
        ctx.ui.notify(
          `${mode}: failed after ${elapsed}ms (modal should be closed) -- ${result.error.message}`,
          "error",
        );
      } else {
        ctx.ui.notify(`${mode}: done after ${elapsed}ms`, "info");
      }
    },
  });
}
