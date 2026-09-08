import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, assertNoForbiddenSurface } from "./source-scan.ts";

/**
 * tests/architecture/no-probe-in-workflows-bridge.test.ts -- the bridge that
 * writes workflow envelopes cannot ask whether the host engine is loaded.
 *
 * The invariant (WDEP-02 / WDEP-03):
 *   Whether `@quintinshaw/pi-dynamic-workflows` is loaded is host-controlled
 *   input -- it is read off the session's tool list. Every file named in
 *   `FORBIDDEN_TARGETS` MUST NOT name the probe composer, the probe snapshot
 *   type, the engine probe function, or the engine flag field, so the code that
 *   writes, replaces or removes an envelope has no way to branch on the answer.
 *   That is what makes "the envelopes are written whether or not the engine is
 *   loaded" true by construction rather than by accident, and it is what makes
 *   recovery need only a reload: install the engine, reload, and the envelopes
 *   written while it was absent run unchanged (NFR-2). A reload therefore
 *   converges on the same bytes however many times it runs.
 *
 *   The cost of losing it is asymmetric. A conditional write would report an
 *   install to a user whose engine is not yet present while placing no
 *   artifact -- a silent no-op with no diagnostic path, recoverable only by a
 *   reinstall. Degradation in this codebase reports; it does not withhold.
 *
 * The gate screens the CAPABILITY, not four spellings of it (WR-03):
 *   Naming the four probe helper symbols is not the only way to ask the
 *   question. `bridges/` may import `platform/`, so a bridge file could spell
 *   the probe inline -- `pi.getAllTools().some((t) => t.name ===
 *   "workflow_control")` -- and branch on the answer without matching any
 *   helper name. The pattern list therefore also refuses the raw tool-list read
 *   and the Pi API type that is the only way to reach it, which closes both the
 *   asking route and the being-handed-it route.
 *
 * The roster is DERIVED, not hardcoded (WR-03):
 *   The scanned set is every `.ts` file in the bridge directory, read at run
 *   time, so a bridge module added tomorrow is guarded on the day it lands
 *   rather than on the day someone remembers to list it. `DOCUMENTED_TARGETS`
 *   below stays as the roster of record -- it carries the per-file rationale --
 *   and the gate asserts the two agree, so adding or removing a module is red
 *   until its rationale is written or retired. That covers the deletion
 *   direction the derived list can no longer cover on its own.
 *
 * Exempt file (do NOT add):
 *   - orchestrators/plugin/install.ts
 *     It calls `softDepStatus(pi)` legitimately, to derive the install ROW's
 *     severity, on a path structurally disjoint from the ledger's workflows
 *     phase: the row is composed after the ledger has already committed, and
 *     `prepareStageWorkflows` takes a `StageWorkflowsInput` that carries no
 *     `pi` at all. Listing it here would make this gate red on day one, and a
 *     gate that is red on day one invites a suppression rather than a fix.
 *     The ledger half of the claim is proved behaviorally instead, by the
 *     byte-equality pair in `tests/orchestrators/plugin/install.test.ts`: two
 *     installs differing only in the session's tool list write byte-identical
 *     envelopes and identical inventories.
 *
 * stripComments rationale (mandatory):
 *   The guarded files should say in their own header comments that they must
 *   not read the probe -- that is where a reader looks for the rule. Those
 *   comments legally name every forbidden symbol.
 *   `assertNoForbiddenSurface` strips block and line comments before matching
 *   (`./source-scan.ts`), so a docstring recording the rule cannot fail the
 *   gate on its own prose.
 */
/** The bridge directory whose every `.ts` file this gate screens. */
const WORKFLOWS_BRIDGE_DIR = "extensions/pi-claude-marketplace/bridges/workflows";

/**
 * The roster of record: every guarded module and why it is guarded. The gate
 * scans the directory rather than this list, and then asserts the two agree.
 */
const DOCUMENTED_TARGETS: ReadonlyArray<string> = [
  // WBRG-02 / WBRG-03: discovery reaches its verdict from the candidate
  // script's own bytes. Which scripts are admitted, skipped or refused is a
  // property of the plugin, never of the session that installed it.
  "extensions/pi-claude-marketplace/bridges/workflows/discover.ts",
  // The barrel re-exports the three entrypoints and the types. A probe symbol
  // reaching a consumer through here would defeat the gate on the four files
  // below without any of them naming it.
  "extensions/pi-claude-marketplace/bridges/workflows/index.ts",
  // WLIF-01 / WBRG-04: prepare / commit / abort is the write path. It is the
  // one file where a conditional write could actually be spelled, so it is the
  // target this gate exists for.
  "extensions/pi-claude-marketplace/bridges/workflows/stage.ts",
  // WDEP-03: `StageWorkflowsInput` carries no `pi`, and no other type here
  // carries a probe snapshot. The bridge cannot be handed the answer any more
  // than it can go and ask for it.
  "extensions/pi-claude-marketplace/bridges/workflows/types.ts",
  // WLIF-03: removal is strictly by recorded name. An envelope must not
  // survive or vanish according to what the session happens to have loaded.
  "extensions/pi-claude-marketplace/bridges/workflows/unstage.ts",
];

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "soft-dependency snapshot composer", pattern: /\bsoftDepStatus\b/ },
  { name: "soft-dependency snapshot type", pattern: /\bSoftDepStatus\b/ },
  { name: "host workflow engine probe", pattern: /\bhasLoadedWorkflowEngine\b/ },
  { name: "host workflow engine flag field", pattern: /\bworkflowEngineLoaded\b/ },
  // WR-03: the probe spelled inline. `getAllTools()` IS the question -- every
  // helper above is a wrapper over it -- so refusing the four wrappers while
  // allowing the raw read would screen the names and not the capability.
  { name: "raw Pi tool-list read", pattern: /\bgetAllTools\b/ },
  // WR-03: the only handle from which `getAllTools` can be reached. Refusing
  // the type closes the being-handed-the-answer route the way `types.ts`
  // already closes it for `StageWorkflowsInput`, by construction rather than by
  // each new input type remembering to omit `pi`.
  { name: "Pi extension API handle", pattern: /\bExtensionAPI\b/ },
];

/** Every `.ts` module in the bridge directory, repo-relative and sorted. */
async function scannedTargets(): Promise<string[]> {
  const entries = await readdir(path.join(REPO_ROOT, WORKFLOWS_BRIDGE_DIR));
  return entries
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => path.posix.join(WORKFLOWS_BRIDGE_DIR, name));
}

test("WDEP-02 + WDEP-03: the workflows bridge has zero host-engine probe surface", async () => {
  // The read / stripComments / offender-accumulate mechanic lives in
  // tests/architecture/source-scan.ts so this gate and its two siblings share
  // one implementation (D-98-09). The target list, the pattern list, and this
  // failure message stay owned here.
  //
  // arrange -- read the roster off the directory so an added module is covered
  // without an edit here.
  const targets = await scannedTargets();

  // act + assert -- scan first, so a real violation reports as a violation
  // rather than as a roster mismatch. No `allowMissing` opts argument on
  // purpose: every derived target exists by construction, so a missing one
  // would mean the readdir and the read disagree.
  await assertNoForbiddenSurface(
    targets,
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `WDEP-02 / WDEP-03 violation: host-engine probe surface detected in the workflows bridge:\n  ${offenders.join("\n  ")}\n  (a bridge that can read the probe can make the envelope write conditional on it, which turns a recoverable state -- install the engine, reload, everything runs -- into a reported install with no artifact, recoverable only by a reinstall. The probe belongs to the notify marker; orchestrators/plugin/install.ts is the only file that legitimately reads it, for the install row's severity.)`,
  );

  // assert -- the roster of record still matches what was scanned. A module
  // ADDED to the bridge was already screened above; this turns it red until its
  // rationale is written. A module REMOVED or RENAMED is red here too, which is
  // the deletion-direction cover the derived list cannot give on its own.
  assert.deepEqual(
    targets,
    [...DOCUMENTED_TARGETS],
    `WDEP-02 / WDEP-03 roster drift: the workflows bridge directory no longer matches DOCUMENTED_TARGETS. Every module in it is screened either way -- update the list above, with the one-line rationale each entry carries, so the roster of record keeps naming what is guarded and why.`,
  );
});
