// tests/live-uat/stop-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// This driver imports `../pi-runtime.ts` on purpose, because every Pi launch
// in the repository resolves the CLI through that one module. It imports
// nothing from a `tests/live-uat/` sibling, so it stays runnable on its own as
// `node tests/live-uat/<file>.mjs`, and one bad edit cannot fail two canaries.
//
// Live runtime UAT (D-88-03b item 4): a scripted "ralph-wiggum" canary that
// drives a REAL Pi session against an always-blocking Stop hook to prove, on
// real pi, the settle-time observables the mocked settle tests only approximate.
//
// What headless pi CAN prove autonomously (this harness asserts these):
//   1. STOP-01 -- `agent_settled` fires once per completion and dispatches the
//      Stop bucket end-to-end (asserted via the `--mode json` event stream +
//      the hook's marker file).
//   2. STOP-03 -- a `decision: block` Stop hook re-enters the idle agent loop
//      via `sendMessage(followUp + triggerTurn)`, observable as a SECOND
//      `turn_start` for a single user prompt (the documented extra-turn-boundary
//      divergence).
//
// What headless pi CANNOT observe (routed to human_needed, README item 4):
//   3. STOP-07 -- the one-shot cap-trip warning. Since Pi 0.87 a headless
//      `pi -p` drives the settle->block->re-enter loop itself: a run requested
//      from an `agent_settled` handler is deferred until the settle handlers
//      finish and is then awaited. The loop therefore reaches the
//      8-consecutive-block cap headless, and the block count is checked
//      against it (the T-88-02 DoS mitigation). The cap-trip warning goes
//      through `ctx.ui.notify`, which does nothing in print/json mode, so this
//      harness cannot see it. It exits NON-ZERO routing human_needed, and the
//      warning half of STOP-07 is confirmed interactively.
//
// The hook appends one marker line per invocation to an absolute marker file,
// so the marker count is the direct observable.
//
// Honesty contract: this harness NEVER fakes a live result. Exit codes:
//   - 0: every STOP-07 observable was seen, including the cap-trip warning.
//   - 1: an unmet precondition or an inconclusive drive (`LIVE RUNTIME
//     REQUIRED`), or the expected headless result (`cap-trip warning ->
//     human_needed`). The verifier routes `human_needed`, never a false pass.
//   - 2: a proven STOP-07 regression (`STOP-07 REGRESSION`), so a script that
//     keys on the exit code tells a broken bound from the expected result.
// It is standalone (NOT part of `npm run check`).
//
// Containment (T-88-08): refuses to run unless PI_CODING_AGENT_DIR points at
// the tmp/pi-uat sandbox, so the UAT never touches a developer's real Pi dir.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { resolvePiRuntime } from "../pi-runtime.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const EXTENSION_ENTRY = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");

// Mirror of STOP_OVERRIDE_CAP in bridges/hooks/settle.ts. Duplicated here (not
// imported) so the harness pins the observed bound as an independent contract:
// the settle module and this canary must agree on 8 or the canary fails loud.
const STOP_OVERRIDE_CAP = 8;
const CAP_WARNING = "Stop hook override cap reached.";

const MARKETPLACE_NAME = "stop-canary-mkt";
const PLUGIN_NAME = "ralph-loop";
const PI_DRIVE_TIMEOUT_MS = 120_000;

// The exit code of a `pi -p` run that ended on its own. A drive counts as
// terminated normally only when the child exits with this code and no signal.
const PI_NORMAL_EXIT_CODE = 0;

// T-88-08: the only agent-state root this canary will churn installs against.
// Anchored on the repository rather than on `process.cwd()`, so which directory
// the refusal below protects does not depend on where the driver was invoked.
const SANDBOX_ROOT = path.resolve(REPO_ROOT, "tmp", "pi-uat");

// Exit codes the top-level handler uses (see the honesty contract above).
const EXIT_HUMAN_NEEDED = 1;
const EXIT_STOP_REGRESSION = 2;

// Thrown (not process.exit) by the routing helpers so main()'s `finally`
// always uninstalls the canary from the shared sandbox before the process
// exits non-zero. The top-level handler recognises this class and exits with
// the code it carries, without re-printing (the human-readable message is
// already on stderr).
class UatExit extends Error {
  constructor(message, exitCode) {
    super(message);
    this.name = "UatExit";
    this.exitCode = exitCode;
  }
}

/** Print + throw to route `human_needed`, never a false pass. Cleanup runs via finally. */
function liveRuntimeRequired(reason, detail) {
  console.error(`\n[stop-canary] LIVE RUNTIME REQUIRED -- not proven, routing human_needed:`);
  console.error(`  ${reason}`);
  if (detail) {
    console.error(`\n${detail}`);
  }
  console.error(
    `\nSee tests/live-uat/README.md for the human-driven repro of the re-entry + cap observables.`,
  );
  throw new UatExit(reason, EXIT_HUMAN_NEEDED);
}

/**
 * Print + throw for a proven STOP-07 regression. It exits with a code distinct
 * from the expected headless result, so a script that keys on the exit code
 * cannot read a broken bound as the normal `human_needed` outcome.
 */
function stopRegression(reason, detail) {
  console.error(`\n[stop-canary] STOP-07 REGRESSION -- failed:`);
  console.error(`  ${reason}`);
  if (detail) {
    console.error(`\n${detail}`);
  }
  throw new UatExit(reason, EXIT_STOP_REGRESSION);
}

/**
 * Exit non-zero AFTER the scriptable observables are proven, routing the
 * cap-trip warning to `human_needed`. Since Pi 0.87 a one-shot `pi -p` drives
 * the settle->block->re-enter loop itself: a run requested from an
 * `agent_settled` handler is deferred until the settle handlers finish and is
 * then awaited, so the loop reaches the 8-consecutive-block cap headless. The
 * cap-trip warning goes through `ctx.ui.notify`, which does nothing in
 * print/json mode, so this harness cannot see it. The warning half of STOP-07
 * is confirmed interactively (README item 4). main() routes here only after a
 * run that terminated normally reached the cap exactly, with one
 * `agent_settled` per block, so this is NOT a false pass.
 */
function capWarningNeedsHuman(blockCount) {
  console.error(
    `\n[stop-canary] SCRIPTABLE HALF PROVEN, cap-trip warning -> human_needed:` +
      `\n  agent_settled dispatched the Stop bucket and block re-entry started a new turn (proven above).` +
      `\n  Headless \`pi\` observed ${blockCount} block(s) against the ${STOP_OVERRIDE_CAP}-block override cap.` +
      `\n  Since Pi 0.87 a headless run drives the settle->block->re-enter loop itself, because runs` +
      `\n  requested from agent_settled handlers are deferred and then awaited.` +
      `\n  The cap-trip warning goes through ctx.ui.notify, which does nothing in print/json mode, so` +
      `\n  this harness cannot see it.`,
  );
  console.error(
    `\nConfirm the cap-trip warning interactively per tests/live-uat/README.md (Human verification, item 4).`,
  );
  throw new UatExit("cap-trip warning requires a human", EXIT_HUMAN_NEEDED);
}

/** Describe how the drive ended, for the cap routing messages. */
function describeTermination(run) {
  if (run.spawnError !== undefined) {
    return `pi failed to start (${run.spawnError})`;
  }
  if (run.timedOut) {
    return `the drive was still running at the ${PI_DRIVE_TIMEOUT_MS / 1000} s timeout`;
  }
  if (run.signal !== null) {
    return `pi ended on signal ${run.signal}`;
  }
  return `pi exited with code ${run.code}`;
}

/**
 * STOP-07: route the drive's block count and termination against the cap.
 * Returns `{ kind, reason }`, or `undefined` for the one outcome that proves
 * the bound (T-88-02): a run that terminated normally at exactly the cap.
 * `kind` is `"regression"` for a proven STOP-07 failure and `"inconclusive"`
 * when the observation says nothing about the bound. The checks run in this
 * order and together cover every count/termination combination:
 * - Above the cap: the bound failed, whether or not the run terminated. An
 *   unbounded livelock usually ends in the harness timeout.
 * - At the cap without a normal termination: the cap was reached, and the run
 *   was still going or ended abnormally. The reason states what was observed,
 *   not a cause, because the count alone cannot tell the cap failing to end
 *   the run from re-entry continuing past it.
 * - Below the cap without a normal termination: the drive stopped counting
 *   early, so the count says nothing about the bound.
 * - Below the cap after a normal termination: the settle->block->re-enter
 *   drive or the cap constant regressed.
 */
function capBoundFailure(blockCount, run) {
  const termination = describeTermination(run);
  if (blockCount > STOP_OVERRIDE_CAP) {
    return {
      kind: "regression",
      reason: `the always-block canary spun to ${blockCount} blocks, past the ${STOP_OVERRIDE_CAP} cap (${termination}).`,
    };
  }
  if (!run.settled && blockCount === STOP_OVERRIDE_CAP) {
    return {
      kind: "regression",
      reason: `${termination} after ${STOP_OVERRIDE_CAP} blocks: the run reached the cap and did not terminate normally.`,
    };
  }
  if (!run.settled) {
    return {
      kind: "inconclusive",
      reason: `STOP-07: ${termination} after ${blockCount} block(s), before the run terminated normally.`,
    };
  }
  if (blockCount < STOP_OVERRIDE_CAP) {
    return {
      kind: "regression",
      reason: `headless pi stopped at ${blockCount} block(s), short of the ${STOP_OVERRIDE_CAP} cap.`,
    };
  }
  return undefined;
}

/** Parse the `--mode json` NDJSON event stream into a type->count map. */
function countEventTypes(stdout) {
  const counts = new Map();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed[0] !== "{") {
      continue;
    }
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const type = typeof obj?.type === "string" ? obj.type : undefined;
    if (type !== undefined) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return counts;
}

function pass(msg) {
  console.log(`[stop-canary] PASS: ${msg}`);
}

/** Parse a package version string like "1.0.0" into [major, minor, patch]. */
function parseVersion(raw) {
  const m = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (m === null) {
    return undefined;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function meetsFloor(v, floor) {
  for (let i = 0; i < 3; i += 1) {
    if (v[i] > floor[i]) {
      return true;
    }
    if (v[i] < floor[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Verify the live-pi + sandbox preconditions. Any miss routes human_needed --
 * the harness must never silently degrade to a pass.
 */
async function assertPreconditions() {
  const agentDir = process.env.PI_CODING_AGENT_DIR;
  if (agentDir === undefined || agentDir.trim() === "") {
    liveRuntimeRequired(
      "PI_CODING_AGENT_DIR is unset.",
      "Run: PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/stop-canary.mjs",
    );
  }
  // T-88-08: refuse to run against a non-sandbox agent dir so the always-block
  // canary and its install/uninstall churn never touch a real Pi state dir.
  //
  // The comparison is containment on RESOLVED paths, never a test on the raw
  // string. A value that merely CARRIES the `tmp/pi-uat` segment is not inside
  // the sandbox: `.../tmp/pi-uat/../../.pi/agent` carries it, survives
  // `existsSync`, and names a real Pi state dir. The trailing separator matters
  // for the same reason -- a sibling `tmp/pi-uat-backup` is not a child.
  const resolved = path.resolve(agentDir);
  if (resolved !== SANDBOX_ROOT && !resolved.startsWith(SANDBOX_ROOT + path.sep)) {
    liveRuntimeRequired(
      `PI_CODING_AGENT_DIR (${agentDir} -> ${resolved}) is not inside ${SANDBOX_ROOT}.`,
      "Refusing to install the always-block canary outside the disposable sandbox.",
    );
  }
  if (!existsSync(resolved)) {
    liveRuntimeRequired(`PI_CODING_AGENT_DIR (${agentDir} -> ${resolved}) does not exist.`);
  }

  let pi;
  try {
    pi = resolvePiRuntime(REPO_ROOT);
  } catch (err) {
    liveRuntimeRequired(
      "The repository's Pi package could not be resolved. Run `npm ci`.",
      String(err?.message ?? err),
    );
  }
  const version = parseVersion(pi.version);
  if (version === undefined || !meetsFloor(version, [1, 0, 0])) {
    liveRuntimeRequired(`pi ${pi.version} is below the required >= 1.0.0 package peer floor.`);
  }
  pass(`live pi ${pi.version} (${pi.cliPath}) >= 1.0.0, sandbox ${resolved}`);
  return pi;
}

/**
 * Build a path-source marketplace on disk carrying a single Stop-only
 * "ralph-loop" plugin whose Stop hook ALWAYS returns `decision: block` and
 * appends one line to `markerFile` per invocation (the re-entry observable).
 */
async function buildCanaryMarketplace(root, markerFile) {
  const pluginDir = path.join(root, "plugins", PLUGIN_NAME);
  const hooksDir = path.join(pluginDir, "hooks");
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
  await mkdir(hooksDir, { recursive: true });

  await writeFile(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify(
      {
        name: MARKETPLACE_NAME,
        description: "Disposable Stop-only always-block canary for the live settle UAT.",
        owner: { name: "stop-canary", email: "noreply@example.com" },
        plugins: [
          {
            name: PLUGIN_NAME,
            description: "Always-block Stop hook (ralph-wiggum canary).",
            author: { name: "stop-canary", email: "noreply@example.com" },
            source: `./plugins/${PLUGIN_NAME}`,
            category: "development",
          },
        ],
      },
      null,
      2,
    ),
  );

  await writeFile(
    path.join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: PLUGIN_NAME, version: "1.0.0" }, null, 2),
  );

  // Stop hook config: derived from tests/fixtures/ralph-wiggum-hooks.json
  // (D-87-03), a Stop-only always-block manifest.
  await writeFile(
    path.join(hooksDir, "hooks.json"),
    JSON.stringify(
      {
        description: "Stop-only always-block canary.",
        hooks: {
          Stop: [
            {
              hooks: [
                { type: "command", command: `bash "${path.join(hooksDir, "stop-hook.sh")}"` },
              ],
            },
          ],
        },
      },
      null,
      2,
    ),
  );

  // The marker path is baked absolute (not via CLAUDE_PLUGIN_ROOT) so it
  // survives whatever plugin-root the installer resolves/clones to. The hook
  // always emits a `block` decision so every settle re-enters -- until the
  // 8-block cap suppresses re-entry and terminates the run.
  const script = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `printf 'block\\n' >> ${JSON.stringify(markerFile)}`,
    `printf '%s' '{"decision":"block","reason":"keep going"}'`,
    "",
  ].join("\n");
  await writeFile(path.join(hooksDir, "stop-hook.sh"), script, { mode: 0o755 });

  return pluginDir;
}

/** Drive the real extension in-process to add the path-source marketplace and install the canary (user scope). */
async function installCanary(root) {
  const commands = new Map();
  const pi = {
    registerCommand: (name, command) => commands.set(name, command),
    registerTool: () => {},
    on: () => {},
    getAllTools: () => [],
    // ASTAT-01: the factory subscribes to pi-mcp-adapter's status channel.
    events: { on: () => () => {} },
  };
  const notifications = [];
  const ctx = {
    cwd: REPO_ROOT,
    ui: {
      notify: (message, severity) => notifications.push({ message, severity }),
      addAutocompleteProvider: () => {},
    },
  };

  await claudeMarketplaceExtension(pi);
  const command = commands.get("claude:plugin");
  if (command === undefined) {
    liveRuntimeRequired("claude:plugin command was not registered by the extension.");
  }

  // Pre-clean any residue from a prior aborted run (ignore failures).
  await command
    .handler(`uninstall ${PLUGIN_NAME}@${MARKETPLACE_NAME} --scope user`, ctx)
    .catch(() => {});
  await command.handler(`marketplace remove ${MARKETPLACE_NAME} --scope user`, ctx).catch(() => {});

  await command.handler(`marketplace add ${root} --scope user`, ctx);
  await command.handler(`install ${PLUGIN_NAME}@${MARKETPLACE_NAME} --scope user`, ctx);

  const state = await loadState(locationsFor("user", process.env.HOME ?? "").extensionRoot);
  const mp = state.marketplaces[MARKETPLACE_NAME];
  const pluginRecord = mp?.plugins?.[PLUGIN_NAME];
  if (pluginRecord === undefined || pluginRecord.resources.hooks.length === 0) {
    liveRuntimeRequired(
      "Canary install did not register a Stop hook resource.",
      `install notifications:\n${notifications.map((n) => `  [${n.severity ?? "info"}] ${n.message}`).join("\n")}`,
    );
  }
  pass(
    `canary installed (${PLUGIN_NAME}@${MARKETPLACE_NAME}, hooks: ${pluginRecord.resources.hooks.join(",")})`,
  );
  return { command, ctx };
}

async function uninstallCanary(command, ctx) {
  if (command === undefined) {
    return;
  }
  await command
    .handler(`uninstall ${PLUGIN_NAME}@${MARKETPLACE_NAME} --scope user`, ctx)
    .catch(() => {});
  await command.handler(`marketplace remove ${MARKETPLACE_NAME} --scope user`, ctx).catch(() => {});
}

/** Spawn a real `pi -p` turn; the always-block hook drives re-entry until the cap. */
async function drivePiTurn(pi) {
  // `--offline` is load-bearing: the sandbox carries a github-source
  // marketplace with autoupdate, and a load-time reconcile would otherwise
  // block on a network fetch (and the model call still reaches the provider --
  // only Pi's startup network ops are disabled, matching NFR-5).
  // `--mode json` streams observable lifecycle events (turn_start /
  // agent_settled) so re-entry is asserted structurally, not by text scrape;
  // `--no-tools` keeps the turn a single deterministic settle (no tool detours).
  const args = [
    "-p",
    "--no-session",
    "--no-extensions",
    "--extension",
    EXTENSION_ENTRY,
    "--offline",
    "--no-tools",
    "--mode",
    "json",
    "--append-system-prompt",
    "Answer in one short sentence. Do not ask questions.",
    "Say the single word: ready.",
  ];
  // Use spawn with stdin "ignore" (NOT execFile, which leaves stdin an OPEN
  // pipe): a non-interactive `pi -p` that sees an open stdin waits for input
  // instead of hitting EOF and exiting. "ignore" gives the child /dev/null on
  // stdin -> EOF -> pi exits once the run, including its hook-driven re-entry
  // turns, has settled.
  //
  // The drive resolves the child's own `{ code, signal }` from `close`, so
  // "terminated normally" is read off the exit status rather than inferred
  // from the harness timer not firing. A spawn `error` is printed and the
  // drive resolves without an exit status.
  //
  // This spawn-and-timeout block repeats in `manifest-absence-canary.mjs` on
  // purpose. Each driver is a standalone operator-run script that imports
  // nothing from a sibling (see the file header). A shared helper would add an
  // import to a drop-in script and a second unused-file suppression.
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [pi.cliPath, ...args], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000);
    }, PI_DRIVE_TIMEOUT_MS);
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      const spawnError = String(err?.message ?? err);
      console.error(`[stop-canary] pi spawn error: ${spawnError}`);
      resolve({ stdout, stderr, timedOut, code: null, signal: null, spawnError, settled: false });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const settled = !timedOut && signal === null && code === PI_NORMAL_EXIT_CODE;
      resolve({ stdout, stderr, timedOut, code, signal, settled });
    });
  });
}

async function main() {
  const pi = await assertPreconditions();

  const root = await mkdtemp(path.join(tmpdir(), "stop-canary-"));
  const markerFile = path.join(root, "block-markers.log");
  await writeFile(markerFile, "");

  let command;
  let ctx;
  try {
    await buildCanaryMarketplace(root, markerFile);
    ({ command, ctx } = await installCanary(root));

    const run = await drivePiTurn(pi);

    let markerContent = "";
    try {
      markerContent = await readFile(markerFile, "utf8");
    } catch {
      markerContent = "";
    }
    const blockCount = markerContent.split("\n").filter((l) => l.trim() === "block").length;
    const eventCounts = countEventTypes(run.stdout);
    const settleCount = eventCounts.get("agent_settled") ?? 0;
    const turnStartCount = eventCounts.get("turn_start") ?? 0;
    const capWarningSeen = `${run.stdout}\n${run.stderr}`.includes(CAP_WARNING);

    console.log(
      `[stop-canary] observed: Stop-hook blocks=${blockCount}, agent_settled=${settleCount}, ` +
        `turn_start=${turnStartCount}, cap=${STOP_OVERRIDE_CAP}, capWarning=${capWarningSeen}.`,
    );
    console.log(`[stop-canary] drive: ${describeTermination(run)}.`);

    // STOP-01: agent_settled must fire and dispatch the Stop bucket end-to-end.
    if (blockCount === 0 || settleCount === 0) {
      liveRuntimeRequired(
        "agent_settled did not dispatch the Stop bucket end-to-end on real pi.",
        run.timedOut
          ? "The drive timed out before any settle."
          : `blocks=${blockCount}, agent_settled=${settleCount}.\n\npi stderr:\n${run.stderr}`,
      );
    }
    pass(
      `STOP-01: agent_settled fired and dispatched the Stop bucket end-to-end (stopReason "stop").`,
    );

    // STOP-03: a `decision: block` Stop hook re-enters the idle agent loop.
    // The re-entry manifests as a SECOND turn for the single user prompt (the
    // documented "extra turn boundary" divergence) -- assert on turn_start,
    // which is structural, not a text scrape.
    if (turnStartCount < 2) {
      liveRuntimeRequired(
        "Block re-entry did not start a new turn on real pi (only one turn observed for one prompt).",
        `turn_start=${turnStartCount}. The always-block Stop hook should re-enter via sendMessage(followUp, triggerTurn).`,
      );
    }
    pass(
      `STOP-03: block re-entry proven -- the always-block Stop hook re-entered the agent loop ` +
        `(${turnStartCount} turns for one prompt; the expected extra-turn-boundary divergence).`,
    );

    // STOP-07: only a run that terminated normally at exactly the cap gets
    // past this check.
    const capFailure = capBoundFailure(blockCount, run);
    const stderrDetail = run.stderr.trim() === "" ? undefined : `pi stderr:\n${run.stderr}`;
    if (capFailure?.kind === "regression") {
      stopRegression(capFailure.reason, stderrDetail);
    }
    if (capFailure !== undefined) {
      liveRuntimeRequired(capFailure.reason, stderrDetail);
    }

    // Each settle of the capped run dispatches the Stop bucket exactly once,
    // so a clean run shows one `agent_settled` per block.
    if (settleCount !== blockCount) {
      stopRegression(
        `agent_settled fired ${settleCount} time(s) for ${blockCount} Stop-hook block(s); a run capped at ` +
          `${STOP_OVERRIDE_CAP} settles once per block.`,
      );
    }

    if (capWarningSeen) {
      // The loop ran to the cap and the cap-trip warning was visible (a runner
      // whose mode forwards ctx.ui.notify).
      pass(
        `STOP-07: 8-block override cap tripped exactly once with the cap-trip warning ` +
          `(bounded at ${STOP_OVERRIDE_CAP}, run terminated -- T-88-02 mitigation proven).`,
      );
      console.log(`\n[stop-canary] OK -- block re-entry + 8-block cap proven on live pi.`);
      return;
    }

    // Expected in a headless environment: re-entry and the cap bound are
    // proven, because the run terminated normally at exactly the cap. The
    // cap-trip warning is not visible. Route it to human_needed.
    capWarningNeedsHuman(blockCount);
  } finally {
    await uninstallCanary(command, ctx);
    await rm(root, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    if (err instanceof UatExit) {
      // Human-readable routing message already printed; exit with the code the
      // routing helper chose, so a regression stays distinct from human_needed.
      process.exit(err.exitCode);
    }
    console.error(`\n[stop-canary] LIVE RUNTIME REQUIRED -- unexpected harness error:`);
    console.error(String(err?.stack ?? err));
    process.exit(1);
  },
);
