// tests/live-uat/stop-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// Two `duplicates.ignoredClones` entries in `.fallowrc.json` are retained
// against this file and `manifest-absence-canary.mjs`. Fallow types `ignoredClones` as
// `string[]`, so the per-clone justification the conventions require cannot
// live in the JSON and lives here instead:
//   - `dup:cc950b18:2` -- the `main().then(exit 0, exit 1)` process epilogue
//     at the foot of both drivers.
//   - `dup:6d8c002d:2` -- the module preamble that resolves `execFileAsync`,
//     `HERE`, `REPO_ROOT` and `EXTENSION_ENTRY`.
// Both are retained for the same reason: each driver must stay independently
// runnable as `node tests/live-uat/<file>.mjs` with nothing imported from a
// sibling. Extracting a shared helper module would create exactly the import
// edge that the standalone-driver shape exists to avoid, and would make the
// two canaries fail together on one bad edit. The duplicated text is 23 lines
// of boilerplate -- a process-exit epilogue and four path constants -- with no
// assertion logic in it, so the copies cannot drift in a way that changes what
// either canary proves. Line numbers are deliberately omitted; run
// `fallow dupes --trace dup:<fingerprint>` with the entries temporarily
// cleared to locate them.
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
// What headless pi CANNOT sustain (routed to human_needed, README item 4):
//   3. STOP-07 -- the full 8-consecutive-block override cap loop. A one-shot
//      `pi -p` STARTS the first hook-driven re-entry turn, then tears down its
//      non-interactive lifecycle before that turn settles again, so it never
//      runs the settle->block->re-enter loop to the cap. Driving the loop to
//      the 8th block (bounded terminate + one-shot warning, the T-88-02 DoS
//      mitigation) needs a live interactive TTY session; this harness exits
//      NON-ZERO routing human_needed for it.
//
// The hook appends one marker line per invocation to an absolute marker file,
// so the marker count is the direct observable.
//
// Honesty contract: this harness NEVER fakes a live result. Unmet preconditions
// OR the un-sustainable cap loop exit NON-ZERO with a "live runtime required" /
// "cap -> human_needed" message so the verifier routes `human_needed` rather
// than a false pass. It is standalone (NOT part of `npm run check`).
//
// Containment (T-88-08): refuses to run unless PI_CODING_AGENT_DIR points at
// the tmp/pi-uat sandbox, so the UAT never touches a developer's real Pi dir.

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const execFileAsync = promisify(execFile);

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

// Thrown (not process.exit) by the routing helpers so main()'s `finally`
// always uninstalls the canary from the shared sandbox before the process
// exits non-zero. The top-level handler recognises this tag and exits 1
// without re-printing (the human-readable message is already on stderr).
class UatExit extends Error {}

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
  throw new UatExit(reason);
}

/**
 * Exit non-zero AFTER the scriptable observables are proven, routing the
 * 8-block cap loop to `human_needed`. A one-shot `pi -p` (or piped-stdin)
 * invocation processes the initial prompt and STARTS the first hook-driven
 * re-entry turn, then tears down its non-interactive lifecycle before that
 * turn settles again -- so it never sustains the settle->block->re-enter loop
 * to the 8-consecutive-block cap. Driving that loop needs a live interactive
 * TTY session, which this environment cannot allocate (no PTY tooling). This
 * is NOT a false pass: the re-entry START is proven end-to-end above; only the
 * loop-to-cap residue is deferred to the human checklist (README item 4).
 */
function capNeedsHumanDrive(blockCount) {
  console.error(
    `\n[stop-canary] SCRIPTABLE HALF PROVEN, CAP LOOP -> human_needed:` +
      `\n  agent_settled dispatched the Stop bucket and block re-entry started a new turn (proven above).` +
      `\n  The 8-consecutive-block override cap could NOT be driven autonomously: headless \`pi\`` +
      `\n  observed ${blockCount} block(s) then exited its non-interactive lifecycle after starting the` +
      `\n  re-entry turn. The full loop-to-cap requires a live interactive session pi -p/stdin cannot sustain.`,
  );
  console.error(
    `\nDrive the cap interactively per tests/live-uat/README.md (Human verification, item 4).`,
  );
  throw new UatExit("cap loop requires interactive drive");
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

/** Parse a `pi --version` string like "0.80.10" into [major, minor, patch]. */
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
  if (!agentDir.includes(path.join("tmp", "pi-uat"))) {
    liveRuntimeRequired(
      `PI_CODING_AGENT_DIR (${agentDir}) is not the tmp/pi-uat sandbox.`,
      "Refusing to install the always-block canary outside the disposable sandbox.",
    );
  }
  if (!existsSync(agentDir)) {
    liveRuntimeRequired(`PI_CODING_AGENT_DIR (${agentDir}) does not exist.`);
  }

  let versionOut;
  try {
    const { stdout } = await execFileAsync("pi", ["--version"], { timeout: 30_000 });
    versionOut = stdout;
  } catch (err) {
    liveRuntimeRequired(
      "`pi` CLI is not on PATH (or `pi --version` failed).",
      String(err?.message ?? err),
    );
  }
  const version = parseVersion(versionOut);
  if (version === undefined || !meetsFloor(version, [0, 80, 5])) {
    liveRuntimeRequired(
      `pi ${versionOut.trim()} is below the required >= 0.80.5 (agent_settled fire-point).`,
    );
  }
  pass(`live pi ${versionOut.trim()} >= 0.80.5, sandbox ${agentDir}`);
  return agentDir;
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
          Stop: [{ hooks: [{ type: "command", command: `bash "${path.join(hooksDir, "stop-hook.sh")}"` }] }],
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
  await command.handler(`uninstall ${PLUGIN_NAME}@${MARKETPLACE_NAME} --scope user`, ctx).catch(() => {});
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
  pass(`canary installed (${PLUGIN_NAME}@${MARKETPLACE_NAME}, hooks: ${pluginRecord.resources.hooks.join(",")})`);
  return { command, ctx };
}

async function uninstallCanary(command, ctx) {
  if (command === undefined) {
    return;
  }
  await command.handler(`uninstall ${PLUGIN_NAME}@${MARKETPLACE_NAME} --scope user`, ctx).catch(() => {});
  await command.handler(`marketplace remove ${MARKETPLACE_NAME} --scope user`, ctx).catch(() => {});
}

/** Spawn a real `pi -p` turn; the always-block hook drives re-entry until the cap. */
async function drivePiTurn() {
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
  // after the hook-driven re-entry turn instead of hitting EOF and exiting.
  // "ignore" gives the child /dev/null on stdin -> EOF -> pi tears down its
  // non-interactive lifecycle once the initial request (plus the started
  // re-entry turn) is drained.
  return await new Promise((resolve) => {
    const child = spawn("pi", args, {
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
      resolve({ stdout, stderr, timedOut, message: String(err?.message ?? err) });
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut });
    });
  });
}

async function main() {
  await assertPreconditions();

  const root = await mkdtemp(path.join(tmpdir(), "stop-canary-"));
  const markerFile = path.join(root, "block-markers.log");
  await writeFile(markerFile, "");

  let command;
  let ctx;
  try {
    await buildCanaryMarketplace(root, markerFile);
    ({ command, ctx } = await installCanary(root));

    const run = await drivePiTurn();

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

    // STOP-01: agent_settled must fire and dispatch the Stop bucket end-to-end.
    if (blockCount === 0 || settleCount === 0) {
      liveRuntimeRequired(
        "agent_settled did not dispatch the Stop bucket end-to-end on real pi.",
        run.timedOut
          ? "The drive timed out before any settle."
          : `blocks=${blockCount}, agent_settled=${settleCount}.\n\npi stderr:\n${run.stderr}`,
      );
    }
    pass(`STOP-01: agent_settled fired and dispatched the Stop bucket end-to-end (stopReason "stop").`);

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

    // STOP-07 regression guard: if headless pi ever DID sustain the loop, the
    // count must never exceed the cap (an unbounded livelock).
    if (blockCount > STOP_OVERRIDE_CAP) {
      liveRuntimeRequired(
        `STOP-07 regression: the always-block canary spun to ${blockCount} blocks, past the ${STOP_OVERRIDE_CAP} cap.`,
      );
    }

    if (blockCount === STOP_OVERRIDE_CAP && capWarningSeen) {
      // The loop ran to the cap end-to-end (an interactive/PTY-capable runner).
      pass(
        `STOP-07: 8-block override cap tripped exactly once with the cap-trip warning ` +
          `(bounded at ${STOP_OVERRIDE_CAP}, run terminated -- T-88-02 mitigation proven).`,
      );
      console.log(`\n[stop-canary] OK -- block re-entry + 8-block cap proven on live pi.`);
      return;
    }

    // Expected in a headless environment: the re-entry START is proven, but the
    // loop-to-cap is not autonomously driveable. Route the cap to human_needed.
    capNeedsHumanDrive(blockCount);
  } finally {
    await uninstallCanary(command, ctx);
    await rm(root, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    if (err instanceof UatExit) {
      // Human-readable routing message already printed; exit non-zero so the
      // verifier records human_needed rather than a silent pass.
      process.exit(1);
    }
    console.error(`\n[stop-canary] LIVE RUNTIME REQUIRED -- unexpected harness error:`);
    console.error(String(err?.stack ?? err));
    process.exit(1);
  },
);
