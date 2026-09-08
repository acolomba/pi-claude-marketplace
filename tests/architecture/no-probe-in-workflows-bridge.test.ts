import test from "node:test";

import { assertNoForbiddenSurface } from "./source-scan.ts";

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
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
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
];

test("WDEP-02 + WDEP-03: the workflows bridge has zero host-engine probe surface", async () => {
  // The read / stripComments / offender-accumulate mechanic lives in
  // tests/architecture/source-scan.ts so this gate and its two siblings share
  // one implementation (D-98-09). The target list, the pattern list, and this
  // failure message stay owned here.
  //
  // No `allowMissing` opts argument on purpose: every target is written, and
  // WR-06's missing-target failure is the point. A renamed or deleted bridge
  // module must break this gate loudly rather than quietly reduce it to
  // scanning four files, or zero.
  await assertNoForbiddenSurface(
    FORBIDDEN_TARGETS,
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `WDEP-02 / WDEP-03 violation: host-engine probe surface detected in the workflows bridge:\n  ${offenders.join("\n  ")}\n  (a bridge that can read the probe can make the envelope write conditional on it, which turns a recoverable state -- install the engine, reload, everything runs -- into a reported install with no artifact, recoverable only by a reinstall. The probe belongs to the notify marker; orchestrators/plugin/install.ts is the only file that legitimately reads it, for the install row's severity.)`,
  );
});
