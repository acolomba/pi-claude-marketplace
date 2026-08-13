/**
 * Spike 006: delayed-status-progress
 *
 * Validates a hand-rolled delay(~1s)->show->auto-clear helper built on
 * ctx.ui.setStatus, driven from inside a registerCommand handler's own
 * async await -- not from LLM-turn streaming, which is the only scope the
 * pi-coding-agent docs explicitly describe for setWorkingMessage/Indicator.
 *
 * Usage:
 *   pi -e .planning/spikes/006-delayed-status-progress/extension.ts
 *
 * Commands:
 *   /spike-progress fast    simulated 400ms clone. Status must NEVER appear
 *                           (finishes before the 1s delay fires).
 *   /spike-progress slow    simulated 3000ms clone with a label change at
 *                           the 1.5s mark. Status must appear at ~1s,
 *                           visibly update its text mid-await, then clear.
 *   /spike-progress error   simulated 2000ms clone that throws. Status must
 *                           still clear (finally-block cleanup).
 */
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "spike-progress";
const DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `task`, showing `label` in the footer status only if the task is
 * still running after `delayMs`. Always clears the status on the way out,
 * success or failure. `task` receives a `setLabel` callback so it can
 * update the visible text mid-flight once shown.
 */
async function withDelayedStatus<T>(
  ctx: ExtensionCommandContext,
  label: string,
  delayMs: number,
  task: (setLabel: (text: string) => void) => Promise<T>,
): Promise<T> {
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("accent", `● ${label}`));
  }, delayMs);

  const setLabel = (text: string): void => {
    if (shown) {
      ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("accent", `● ${text}`));
    }
  };

  try {
    return await task(setLabel);
  } finally {
    clearTimeout(timer);
    if (shown) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("spike-progress", {
    description: "Spike 006: fast|slow|error simulated clone through a delayed status helper",
    handler: async (args, ctx) => {
      const mode = args.trim().toLowerCase() || "slow";
      const startedAt = Date.now();

      try {
        await withDelayedStatus(ctx, "Cloning marketplace...", DELAY_MS, async (setLabel) => {
          if (mode === "fast") {
            await sleep(400);
            return;
          }
          if (mode === "error") {
            await sleep(2000);
            throw new Error("simulated clone failure");
          }
          // slow: prove live re-render mid-await by changing the label partway through
          await sleep(1500);
          setLabel("Resolving refs...");
          await sleep(1500);
        });
        ctx.ui.notify(`${mode}: done after ${Date.now() - startedAt}ms`, "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(
          `${mode}: failed after ${Date.now() - startedAt}ms (status should be clear) -- ${message}`,
          "error",
        );
      }
    },
  });
}
