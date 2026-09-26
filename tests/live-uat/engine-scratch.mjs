// tests/live-uat/engine-scratch.mjs
//
// The preconditions the two engine-driving canaries share: resolving the
// host workflow engine out of a scratch install, refusing any sandbox that is
// not the disposable one, and the exit routing that turns an unmet
// precondition into a printed reason plus a non-zero exit. Each driver tags
// its own output, so the reporters are built per driver.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/** The engine package resolved out of the scratch prefix. */
const ENGINE_PACKAGE = "@quintinshaw/pi-dynamic-workflows";

/** The only root a canary will hand to the engine or write a scratch HOME under. */
const SANDBOX_ROOT = path.resolve(process.cwd(), "tmp", "pi-uat");

/** Thrown for every routed exit whose reason has already been printed. */
export class CanaryExit extends Error {}

/**
 * The tagged helpers one canary uses. `tag` is what every line it prints
 * opens with, so a transcript names the driver that produced it.
 */
export function createEngineScratch(tag, runHint) {
  function pass(msg) {
    console.log(`[${tag}] PASS: ${msg}`);
  }

  /**
   * The engine could not be resolved, or the sandbox is not a sandbox. Nothing
   * has been created and the engine has not been imported.
   */
  function liveEngineRequired(reason, detail) {
    console.error(`\n[${tag}] LIVE ENGINE REQUIRED: ${reason}`);
    if (detail !== undefined) {
      console.error(`  ${detail}`);
    }
    console.error(`\nSee tests/live-uat/README.md for the scratch-install route.`);
    throw new CanaryExit(reason);
  }

  /**
   * Resolve the engine's scratch prefix, then read BOTH the version and the entry
   * point out of the engine's OWN manifest. Never hard-code either: the grade
   * published downstream must name the version the run actually observed, and a
   * literal entry path silently bypasses the layout the package declares. A
   * missing entry is an unmet precondition, so it is routed as one rather than
   * left to surface as an `ERR_MODULE_NOT_FOUND` stack.
   */
  async function resolveEngine() {
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
    const entry = path.join(root, ENGINE_PACKAGE, manifest.main ?? "dist/index.js");
    if (!existsSync(entry)) {
      liveEngineRequired(
        `the engine entry point is missing at ${entry}.`,
        "The scratch install may be incomplete, or the engine changed its published layout.",
      );
    }
    return { entry, version: manifest.version };
  }

  /**
   * Refuse to run against anything but the disposable sandbox, BEFORE creating
   * anything and before the engine is imported. Two independent reasons: the
   * engine writes into whatever agent-state directory it is handed, and the
   * operator's real one is where their provider credentials live -- reaching them
   * would both spend money and silently un-measure a driver.
   *
   * The comparison is on RESOLVED paths, never on the raw string. A substring
   * test is a smell test rather than containment: `.../tmp/pi-uat/../../elsewhere`
   * carries the substring, survives `existsSync`, and names a directory outside
   * the sandbox -- which is then created and handed to third-party code. The
   * trailing separator matters for the same reason: a sibling `tmp/pi-uat-backup`
   * is not a child of `tmp/pi-uat`.
   */
  function assertSandboxContainment(refusal) {
    const agentDir = process.env.PI_CODING_AGENT_DIR;
    if (agentDir === undefined || agentDir.trim() === "") {
      liveEngineRequired("PI_CODING_AGENT_DIR is unset.", runHint);
    }
    const resolved = path.resolve(agentDir);
    if (resolved !== SANDBOX_ROOT && !resolved.startsWith(SANDBOX_ROOT + path.sep)) {
      liveEngineRequired(
        `PI_CODING_AGENT_DIR (${agentDir} -> ${resolved}) is not inside ${SANDBOX_ROOT}.`,
        refusal,
      );
    }
    if (!existsSync(resolved)) {
      liveEngineRequired(`PI_CODING_AGENT_DIR (${agentDir} -> ${resolved}) does not exist.`);
    }
    return resolved;
  }

  return { pass, liveEngineRequired, resolveEngine, assertSandboxContainment };
}
