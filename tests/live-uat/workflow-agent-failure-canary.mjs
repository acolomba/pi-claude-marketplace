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
//   npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows@3.10.1
//   mkdir -p tmp/pi-uat/wf-agent
//   PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent \
//   PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
//     node tests/live-uat/workflow-agent-failure-canary.mjs
//   rm -rf /tmp/wf-engine tmp/pi-uat/wf-agent
//
// The version pin reproduces the grade `docs/workflows-compatibility.md`
// publishes for this driver. Dropping it re-measures against whatever is
// current, which is a legitimate thing to do but is a different measurement --
// the version the run observed is read from the engine's own manifest and
// printed in every PASS line, so a transcript names which one it was.
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
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { CanaryExit, createEngineScratch } from "./engine-scratch.mjs";

/**
 * The log line the engine emits when a recoverable agent failure exhausts its
 * attempts. Its presence is the proof that the failure was induced at all; its
 * absence means the sandbox reached a provider and nothing was measured.
 */
const INDUCED_FAILURE_MARKER = "AGENT_EXECUTION_ERROR";

/** Negative control B: flip the primary expectation and nothing else. */
const INVERT = process.argv.includes("--invert");

const { pass, resolveEngine, assertSandboxContainment } = createEngineScratch(
  "wf-agent-canary",
  "Run: PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent PI_WORKFLOW_ENGINE_ROOT=... node tests/live-uat/workflow-agent-failure-canary.mjs",
);

/**
 * The marker is absent, so no verdict may be read. What that absence supports
 * is exactly "no log line named the marker" -- not, on its own, "the sandbox
 * resolved a provider". Naming a cause the run never observed sends an operator
 * to check the wrong thing when a later engine renames its error vocabulary,
 * which is the drift `WPIN-01` exists to worry about.
 *
 * The logs discriminate, so branch on them. An EMPTY array is the shape a
 * SUCCESSFUL agent call produces, which does support the provider reading; a
 * NON-EMPTY array without the marker says the engine ran, logged, and used
 * different words. Either way this is a statement about the machine or the
 * engine's vocabulary, never an engine regression (D-117-05).
 */
function nothingWasMeasured(logs) {
  const ranAndLogged = logs.length > 0;
  console.error(
    `\n[wf-agent-canary] NOTHING WAS MEASURED: no log line named ${INDUCED_FAILURE_MARKER}.`,
  );
  console.error(
    ranAndLogged
      ? `  The run produced ${logs.length} log line(s), none naming the marker. Either the` +
          `\n  induced failure did not occur, or this engine version no longer uses that name.` +
          `\n  Check the engine's error vocabulary before concluding anything about this machine.`
      : `  The run produced no logs at all, which is the shape a SUCCESSFUL agent call` +
          `\n  produces. The sandbox most likely resolved a provider, so the induced failure` +
          `\n  never occurred and no verdict about the engine can be read from this run.`,
  );
  console.error(`  observed logs=${JSON.stringify(logs)}`);
  console.error(
    `\nRe-run with an EMPTY agent-state directory inside tmp/pi-uat that cannot reach` +
      `\nany provider. The absence of credentials is what induces the failure.`,
  );
  throw new CanaryExit("the induced agent failure did not occur");
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

/**
 * The upstream fan-out pattern, in the shape a plugin author copies: fan three
 * items out through the engine's own pipeline helper, each item calling
 * `agent()`, then filter the result for truthiness. Reports the row count and
 * the survivor count so the observable is two scalars.
 */
const FAN_OUT_SCRIPT = `export const meta = { name: "agent-fanout-canary", description: "fan three failing agent() calls out" };
const rows = await pipeline(["a", "b", "c"], (item) => agent("ping " + item));
return { rows: rows.length, survivors: rows.filter(Boolean).length };
`;

async function main() {
  const { entry, version } = await resolveEngine();
  const sandboxRoot = assertSandboxContainment(
    "Refusing to hand the engine an agent-state directory outside the disposable sandbox.",
  );

  console.log(`[wf-agent-canary] engine ${version}`);

  // A fresh EMPTY child directory beneath the supplied sandbox root, so the run
  // starts from empty agent state even if a previous canary populated the root.
  // It is pointed at before the engine is imported, because the peer reads the
  // variable as it initialises.
  const stateDir = path.join(sandboxRoot, `wf-agent-canary-${process.pid}`);
  await mkdir(stateDir, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = stateDir;

  try {
    const { runWorkflow } = await import(pathToFileURL(entry).href);
    const drive = (source) => runWorkflow(source, { persistLogs: false, cwd: stateDir });

    // A0 -- the measurement precondition, applied to EVERY drive whose verdict
    // depends on the induced absence, and always BEFORE that verdict is read.
    // This single binding is the driver's plantable seam: replacing it with an
    // empty array reproduces exactly what a SUCCESSFUL agent call produces, and
    // is how this control is proven to fire rather than merely written.
    const requireInducedFailure = (run) => {
      const observedLogs = run.logs;
      if (!observedLogs.some((line) => line.includes(INDUCED_FAILURE_MARKER))) {
        nothingWasMeasured(observedLogs);
      }
      return run;
    };

    // ---- A0 + A1: a recoverable failure, induced by the absence of credentials.
    const recoverable = requireInducedFailure(await drive(agentCallScript(`agent("ping")`)));
    pass(
      `A0: the agent call failed as induced, so this run measured something (engine ${version})`,
    );

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

    // ---- A2: the differential control, and what makes this driver non-vacuous.
    // Same driver, same engine, same sandbox, ONE option apart: a model
    // specification that resolves to nothing. Two assertions in one run that
    // disagree with each other by design prove the machinery discriminates
    // rather than reporting whatever it sees. This is the only place an error
    // code may be asserted -- naming it is what makes the control specific
    // rather than "something threw" -- while the verdict above stays on the
    // observable (D-117-01). It is always on, never behind a flag: a control
    // that lives only in a written record rots.
    const nonRecoverable = await drive(
      agentCallScript(`agent("ping", { model: "nosuchprovider/nosuchmodel" })`),
    );
    assert.deepEqual(
      structuredClone(nonRecoverable.result),
      { kind: "rejected", code: "MODEL_NOT_FOUND", recoverable: false },
      `A2: a non-recoverable agent() failure did not reject at engine ${version}.`,
    );
    pass(`A2: a non-recoverable agent() failure rejects MODEL_NOT_FOUND (engine ${version})`);

    // ---- A3: the pattern a plugin author actually copies. Three items fan out,
    // every call fails recoverably, and the run COMPLETES -- which is itself
    // part of the observation, because the published claim is that this pattern
    // aborts here and it does not (D-117-04).
    //
    // This is a SEPARATE drive, so it needs A0's precondition in its own right:
    // three calls that SUCCEED return `{ rows: 3, survivors: 3 }`, and without
    // the gate the harness would report "the fan-out pattern did not drop its
    // failed items" -- blaming the engine for a property of the machine, which
    // is the exact mis-attribution this control exists to prevent (D-117-05).
    const fanOut = requireInducedFailure(await drive(FAN_OUT_SCRIPT));
    assert.deepEqual(
      structuredClone(fanOut.result),
      { rows: 3, survivors: 0 },
      `A3: the fan-out pattern did not drop its failed items and complete at engine ${version}.`,
    );
    pass(
      `A3: three fanned-out failures return 3 rows, 0 survive the truthiness filter, ` +
        `and the run completes (engine ${version})`,
    );
  } finally {
    // `force: true` suppresses ENOENT and nothing else. A file handle or a
    // subagent process still holding the directory rejects with EBUSY/EPERM,
    // and an unhandled rejection here REPLACES the in-flight AssertionError or
    // CanaryExit -- so the operator reads a filesystem error instead of the
    // verdict, and a CanaryExit that had already printed its reason picks up a
    // second, unrelated stack because the epilogue's suppression no longer
    // matches. Report the cleanup failure and let the original error stand.
    await rm(stateDir, { recursive: true, force: true }).catch((err) => {
      console.error(
        `[wf-agent-canary] cleanup failed for ${stateDir}: ${String(err?.message ?? err)}`,
      );
    });
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
