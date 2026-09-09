// tests/live-uat/workflow-agent-failure-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// WEVID-01 -- measure what the host workflow engine's `agent()` call actually
// does when the subagent fails, and record the OBSERVABLE a script author
// experiences rather than which internal branch ran (D-117-01). An assertion on
// the branch would only restate the source read this driver exists to replace.
//
// Unlike its two siblings in this directory, this driver exercises the HOST
// ENGINE, not this extension. It builds no marketplace fixture, runs no install
// ledger, spawns no subprocess, needs no `pi` on PATH, and imports nothing from
// `extensions/`. The engine is deliberately absent from `package.json` and
// `package-lock.json` (NFR-5, D-98-10), so it is resolved at run time out of a
// scratch prefix named by `PI_WORKFLOW_ENGINE_ROOT`:
//
//   mkdir -p /tmp/wf-engine
//   npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows
//   mkdir -p tmp/pi-uat/wf-agent
//   PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent \
//   PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
//     node tests/live-uat/workflow-agent-failure-canary.mjs
//   rm -rf /tmp/wf-engine
//
// It needs NO provider credentials, and that is the whole trick (D-117-05): the
// failure inducer is an ABSENCE. Pointed at an empty agent-state directory the
// real subagent runner finds no API key and throws, the engine classifies that
// throw recoverable, and `agent()` resolves to `null`.
//
// The hazard runs the other way, and it is why A0 below exists. A machine whose
// sandbox CAN reach a provider lets the call succeed, so this driver would exit
// 0 having measured nothing at all. A0 asserts the induced failure actually
// happened BEFORE any verdict is read, and exits non-zero saying so. It is a
// statement about the machine, not about the engine.
//
// Exit contract, matching both sibling drivers: an unmet precondition or an
// unobserved assertion exits NON-ZERO with a human-readable reason, so a
// verifier records `human_needed` rather than a silent pass. Never skip-and-pass.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

/** The engine package resolved out of the scratch prefix. */
const ENGINE_PACKAGE = "@quintinshaw/pi-dynamic-workflows";

/**
 * The log line the engine emits when a recoverable agent failure exhausts its
 * attempts. Its presence is the proof that the failure was induced at all; its
 * absence means the sandbox reached a provider and nothing was measured.
 */
const INDUCED_FAILURE_MARKER = "AGENT_EXECUTION_ERROR";

/** Negative control B: flip the primary expectation and nothing else. */
const INVERT = process.argv.includes("--invert");

/** Thrown for every routed exit whose reason has already been printed. */
class CanaryExit extends Error {}

function pass(msg) {
  console.log(`[wf-agent-canary] PASS: ${msg}`);
}

/**
 * The engine could not be resolved, or the sandbox is not a sandbox. Nothing
 * has been created and the engine has not been imported.
 */
function liveEngineRequired(reason, detail) {
  console.error(`\n[wf-agent-canary] LIVE ENGINE REQUIRED: ${reason}`);
  if (detail !== undefined) {
    console.error(`  ${detail}`);
  }
  console.error(`\nSee tests/live-uat/README.md for the scratch-install route.`);
  throw new CanaryExit(reason);
}

/**
 * The run completed but the failure it exists to observe never happened, so no
 * verdict may be read. This is a routing decision about the MACHINE -- its
 * sandbox resolved a provider -- and deliberately not reported as an engine
 * regression (D-117-05).
 */
function nothingWasMeasured(logs) {
  console.error(
    `\n[wf-agent-canary] NOTHING WAS MEASURED: the agent call did not fail.` +
      `\n  The sandbox resolved a provider, so the induced failure never occurred and no` +
      `\n  verdict about the engine can be read from this run. This is a statement about` +
      `\n  this machine, not an engine regression.` +
      `\n  Expected a log line naming ${INDUCED_FAILURE_MARKER}; observed logs=${JSON.stringify(logs)}`,
  );
  console.error(
    `\nRe-run with an EMPTY agent-state directory inside tmp/pi-uat that cannot reach` +
      `\nany provider. The absence of credentials is what induces the failure.`,
  );
  throw new CanaryExit("the induced agent failure did not occur");
}

/**
 * Resolve the engine's scratch prefix and read the version out of the engine's
 * OWN manifest. Never hard-code a version here: the grade published downstream
 * must name the version the run actually observed, and a literal can lie after
 * an operator bumps the scratch install.
 */
async function resolveEngineVersion() {
  const root = process.env.PI_WORKFLOW_ENGINE_ROOT;
  if (root === undefined || root.trim() === "") {
    liveEngineRequired(
      "PI_WORKFLOW_ENGINE_ROOT is unset.",
      "It must name the node_modules of a scratch install of the engine.",
    );
  }
  const manifestPath = path.join(root, ENGINE_PACKAGE, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (err) {
    liveEngineRequired(
      `the engine manifest is unreadable at ${manifestPath}.`,
      String(err?.message ?? err),
    );
  }
  if (typeof manifest.version !== "string") {
    liveEngineRequired(`the engine manifest at ${manifestPath} carries no version.`);
  }
  return { root, version: manifest.version };
}

/**
 * Refuse to run against anything but the disposable sandbox, BEFORE creating
 * anything and before the engine is imported. Two independent reasons: the
 * engine writes into whatever agent-state directory it is handed, and the
 * operator's real one is where their provider credentials live -- reaching them
 * would both spend money and silently un-measure this driver.
 */
function assertSandboxContainment() {
  const agentDir = process.env.PI_CODING_AGENT_DIR;
  if (agentDir === undefined || agentDir.trim() === "") {
    liveEngineRequired(
      "PI_CODING_AGENT_DIR is unset.",
      "Run: PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent PI_WORKFLOW_ENGINE_ROOT=... node tests/live-uat/workflow-agent-failure-canary.mjs",
    );
  }
  if (!agentDir.includes(path.join("tmp", "pi-uat"))) {
    liveEngineRequired(
      `PI_CODING_AGENT_DIR (${agentDir}) is not the tmp/pi-uat sandbox.`,
      "Refusing to hand the engine an agent-state directory outside the disposable sandbox.",
    );
  }
  if (!existsSync(agentDir)) {
    liveEngineRequired(`PI_CODING_AGENT_DIR (${agentDir}) does not exist.`);
  }
  return agentDir;
}

/**
 * One `agent()` call, wrapped so the workflow body reports the OBSERVABLE:
 * whether the promise resolved and whether the resolved value was `null`.
 */
function agentCallScript(call) {
  return `export const meta = { name: "agent-failure-canary", description: "drive one failing agent() call" };
try {
  const value = await ${call};
  return { kind: "resolved", isNull: value === null };
} catch (err) {
  return { kind: "rejected", code: err && err.code, recoverable: err && err.recoverable };
}
`;
}

async function main() {
  const { version } = await resolveEngineVersion();
  const sandboxRoot = assertSandboxContainment();

  console.log(`[wf-agent-canary] engine ${version}`);

  // A fresh EMPTY child directory beneath the supplied sandbox root, so the run
  // starts from empty agent state even if a previous canary populated the root.
  // It is pointed at before the engine is imported, because the peer reads the
  // variable as it initialises.
  const stateDir = path.join(sandboxRoot, `wf-agent-canary-${process.pid}`);
  await mkdir(stateDir, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = stateDir;

  try {
    const engineEntry = path.join(
      process.env.PI_WORKFLOW_ENGINE_ROOT,
      ENGINE_PACKAGE,
      "dist/index.js",
    );
    const { runWorkflow } = await import(pathToFileURL(engineEntry).href);
    const drive = (source) => runWorkflow(source, { persistLogs: false, cwd: stateDir });

    // ---- A0 + A1: a recoverable failure, induced by the absence of credentials.
    const recoverable = await drive(agentCallScript(`agent("ping")`));

    // A0 -- the measurement precondition, asserted BEFORE any verdict is read.
    // This single binding is the driver's plantable seam: replacing it with an
    // empty array reproduces exactly what a SUCCESSFUL agent call produces, and
    // is how this control is proven to fire rather than merely written.
    const observedLogs = recoverable.logs;
    if (!observedLogs.some((line) => line.includes(INDUCED_FAILURE_MARKER))) {
      nothingWasMeasured(observedLogs);
    }
    pass(`A0: the agent call failed as induced, so this run measured something (engine ${version})`);

    // A1 -- the measurement. Compare through `structuredClone`: the engine runs
    // script bodies in a separate realm and injects no host built-ins, so the
    // returned object's prototype is not the host `Object.prototype` and strict
    // deep equality fails on identical data, printing two sides that render the
    // same.
    assert.deepEqual(
      structuredClone(recoverable.result),
      { kind: "resolved", isNull: !INVERT },
      `A1: a recoverable agent() failure did not produce the expected observable at engine ${version}.`,
    );
    pass(`A1: a recoverable agent() failure resolves to null (engine ${version})`);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
}

try {
  await main();
  process.exit(0);
} catch (err) {
  if (!(err instanceof CanaryExit)) {
    console.error(`\n[wf-agent-canary] FAILED:`);
    console.error(String(err?.stack ?? err));
  }
  // Human-readable reason printed above; exit non-zero so a verifier records
  // human_needed rather than reading a quiet exit as a pass.
  process.exit(1);
}
