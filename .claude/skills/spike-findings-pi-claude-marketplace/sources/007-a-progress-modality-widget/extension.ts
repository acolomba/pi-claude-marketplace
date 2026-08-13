/**
 * Spike 007a: progress-modality-widget
 *
 * Comparison spike, variant a of 2 (see 007-b-progress-modality-bordered-loader).
 * Same delay(~1s)->show->auto-clear mechanism as spike 006, mounted via
 * ctx.ui.setWidget (ambient, non-blocking, above the editor) instead of
 * ctx.ui.setStatus, showing a multi-step checklist rather than one line.
 *
 * Usage:
 *   pi -e .planning/spikes/007-a-progress-modality-widget/extension.ts
 *
 * Commands:
 *   /spike-widget fast    simulated 400ms single-step clone. Widget must
 *                         NEVER appear.
 *   /spike-widget slow    three ~900ms steps. Widget must appear at ~1s
 *                         already showing step 1 active, then advance
 *                         through step 2 and step 3 live, then clear.
 *   /spike-widget error   throws partway through step 2. Widget must still
 *                         clear (finally-block cleanup).
 */
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "spike-progress-widget";
const DELAY_MS = 1000;

interface Step {
  label: string;
  state: "pending" | "active" | "done";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderSteps(ctx: ExtensionCommandContext, steps: Step[]): string[] {
  return steps.map((step) => {
    if (step.state === "done") {
      return `${ctx.ui.theme.fg("success", "✓")} ${ctx.ui.theme.fg("muted", step.label)}`;
    }
    if (step.state === "active") {
      return `${ctx.ui.theme.fg("accent", "●")} ${step.label}`;
    }
    return `${ctx.ui.theme.fg("dim", "○")} ${ctx.ui.theme.fg("dim", step.label)}`;
  });
}

/**
 * Runs `task`, showing a live step checklist widget only if the task is
 * still running after `delayMs`. Always clears the widget on the way out.
 * `task` receives an `advance` callback: marks `steps[index]` done and, if
 * present, `steps[index + 1]` active.
 */
async function withDelayedWidget<T>(
  ctx: ExtensionCommandContext,
  steps: Step[],
  delayMs: number,
  task: (advance: (index: number) => void) => Promise<T>,
): Promise<T> {
  let shown = false;
  const render = (): void => {
    if (shown) {
      ctx.ui.setWidget(WIDGET_KEY, renderSteps(ctx, steps));
    }
  };
  const timer = setTimeout(() => {
    shown = true;
    render();
  }, delayMs);

  const advance = (index: number): void => {
    const current = steps[index];
    if (current) {
      current.state = "done";
    }
    const next = steps[index + 1];
    if (next) {
      next.state = "active";
    }
    render();
  };

  try {
    return await task(advance);
  } finally {
    clearTimeout(timer);
    if (shown) {
      ctx.ui.setWidget(WIDGET_KEY, undefined);
    }
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("spike-widget", {
    description: "Spike 007a: fast|slow|error simulated clone through a delayed widget checklist",
    handler: async (args, ctx) => {
      const mode = args.trim().toLowerCase() || "slow";
      const startedAt = Date.now();

      try {
        if (mode === "fast") {
          const steps: Step[] = [{ label: "Cloning marketplace...", state: "active" }];
          await withDelayedWidget(ctx, steps, DELAY_MS, async () => {
            await sleep(400);
          });
        } else if (mode === "error") {
          const steps: Step[] = [
            { label: "Resolving marketplace source...", state: "active" },
            { label: "Cloning repository...", state: "pending" },
          ];
          await withDelayedWidget(ctx, steps, DELAY_MS, async (advance) => {
            await sleep(900);
            advance(0);
            await sleep(900);
            throw new Error("simulated clone failure");
          });
        } else {
          const steps: Step[] = [
            { label: "Resolving marketplace source...", state: "active" },
            { label: "Cloning repository...", state: "pending" },
            { label: "Reading manifest...", state: "pending" },
          ];
          await withDelayedWidget(ctx, steps, DELAY_MS, async (advance) => {
            await sleep(900);
            advance(0);
            await sleep(900);
            advance(1);
            await sleep(900);
            advance(2);
          });
        }
        ctx.ui.notify(`${mode}: done after ${Date.now() - startedAt}ms`, "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(
          `${mode}: failed after ${Date.now() - startedAt}ms (widget should be clear) -- ${message}`,
          "error",
        );
      }
    },
  });
}
