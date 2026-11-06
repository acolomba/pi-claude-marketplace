/**
 * @fileoverview Steps about typing a bridged skill's aliases in Pi's terminal UI.
 */

import { When } from "@cucumber/cucumber";

import { lastScriptReply, sendTerminalTurn } from "../../lib/scripted-model/terminal-turn.ts";
import { readLogLengths } from "../../lib/turn-records.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Pi shows its completion menu, with its selection marker, once it has the
// suggestions for the typed prefix, and redraws the input when Tab applies one.
const MENU_MARKER = "→ ";
const COMPLETION_MS = 10_000;

// A turn of the scripted model makes no request; it settles in well under this.
const TUI_TURN_MS = 30_000;

// D-CF2-05: the whole TUI turn lives in this one step, so the session never
// outlives it in module state; its release stops the TUI's process group.
When(
  "the user completes the skill alias {string} in the terminal and sends it with {string}",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, prefix: string, args: string): Promise<void> {
    const harness = this.profileHarness();
    const reply = await lastScriptReply(harness);
    const tui = await this.startTuiSession("scripted");
    const lengths = await readLogLengths(harness);

    const beforePrefix = tui.markOutput();
    tui.typeText(prefix);
    await tui.waitForTextAfter(MENU_MARKER, beforePrefix, COMPLETION_MS);
    const beforeTab = tui.markOutput();
    tui.typeText("\t");
    await tui.waitForTextAfter(prefix, beforeTab, COMPLETION_MS);
    const logs = await sendTerminalTurn(tui, args, {
      harness,
      lengths,
      reply,
      timeoutMs: TUI_TURN_MS,
    });
    this.recordTurn({
      prompt: `${prefix}\t${args}`,
      disposition: "interactive",
      records: [],
      logs,
    });
  },
);
