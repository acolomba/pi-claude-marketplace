/**
 * @fileoverview Steps about typing a bridged skill's aliases in Pi's terminal UI.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { When } from "@cucumber/cucumber";

import { PiTuiSession } from "../../lib/pi-tui.ts";
import { modelCallsOf, readModelScript } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { ScenarioWorld } from "../../support/world.ts";

const SCRIPTED_MODEL_EXTENSION = fileURLToPath(
  new URL("../../lib/scripted-model/extension.ts", import.meta.url),
);

// The profile Pi selects the scripted model over RPC; the TUI selects it on its command line.
const SCRIPTED_MODEL_ARGUMENTS = ["--provider", "faux", "--model", "faux-1"];

// D-CF2-12: with the scripted model selected, the TUI never prints the default
// readiness text. Pi lists its loaded resources, ending with `[Extensions]`,
// only after the extensions' `session_start` handlers ran and its autocomplete
// was set up, so the alias completion exists before the first keystroke.
const READY_TEXT = "[Extensions]";

// The profile Pi already compiled every extension into the shared jiti cache,
// so the TUI starts in seconds; a minute covers a slow worker.
const TUI_READY_MS = 60_000;

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
    const lastStep = (await readModelScript(harness)).at(-1);
    if (lastStep === undefined || !("reply" in lastStep)) {
      assert.fail("the scripted model's last step is not a reply");
    }

    const { home, projectDir, agentDir } = this.tokens;
    const tui = await PiTuiSession.start({
      sandbox: { home, agentDir, cwd: projectDir },
      git: {
        NODE_EXTRA_CA_CERTS: this.gitHost.certificatePath,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: path.join(home, ".gitconfig"),
        PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: `https://${this.gitHost.address}`,
      },
      variables: { TMPDIR: path.join(home, "tmp") },
      extensions: [SCRIPTED_MODEL_EXTENSION],
      arguments: SCRIPTED_MODEL_ARGUMENTS,
      readyText: READY_TEXT,
    });
    this.onRelease(() => tui.stop());
    await tui.waitUntilReady(TUI_READY_MS);
    const lengths = await readLogLengths(harness);

    const beforePrefix = tui.markOutput();
    tui.typeText(prefix);
    await tui.waitForTextAfter(MENU_MARKER, beforePrefix, COMPLETION_MS);
    const beforeTab = tui.markOutput();
    tui.typeText("\t");
    await tui.waitForTextAfter(prefix, beforeTab, COMPLETION_MS);
    const beforeSend = tui.markOutput();
    tui.sendLine(args);
    await tui.waitForTextAfter(lastStep.reply, beforeSend, TUI_TURN_MS);

    const logs = await readLogLinesSince(harness, lengths);
    assert.deepStrictEqual(
      modelCallsOf(logs)
        .filter((call) => call.overflow)
        .map((call) => `call ${call.index + 1}`),
      [],
      "the model was called past the end of its script",
    );
    this.recordTurn({
      prompt: `${prefix}\t${args}`,
      disposition: "interactive",
      records: [],
      logs,
    });
  },
);
