// presentation/rollback-partial.ts -- MSG-RP-1 rollback-partial composer.
//
// Parent + 2-space-indented children. The parent row must already carry
// status "failed" + the relevant reasons (e.g. ["rollback partial"] for
// multi-phase failures or [`<phase>`] for single-phase failures) -- this
// composer never mutates the caller's row spec. Each RollbackChild renders
// at the bare compact level (no leading icon; see compact-line.ts
// renderRollbackChild for the per-variant shape).
//
// MSG-RP-1: the cause-chain trailer is composed by the CALLER AFTER the
// rollback block, not by this composer. Typical pattern:
//   `${renderRollbackPartial(parent, children, probe)}\n\n${causeChainTrailer(err)}`
//
// Empty-children case: return the parent line alone with no trailing
// newline. The catalog calls for an indented children block only when
// per-phase failures exist; the absence of children means there was a
// single-phase failure with no further detail to surface.
//
// Plan 14-06 / D-14-04: `composeRollbackPartialChildren` is the bare
// children-block helper used by orchestrators that own their own parent
// row context (e.g. the transaction-layer rollback chokepoint refactor
// that moved presentation up to the orchestrator: the orchestrator
// composes its own `(failed) {rollback partial}` parent line and stitches
// the bare children block produced here under it).

import { renderRow } from "./compact-line.ts";

import type {
  PluginCascadeRow,
  PluginInlineRow,
  RollbackChild,
  SoftDepProbe,
} from "./compact-line.ts";

/**
 * Structural shape consumed by {@link composeRollbackPartialChildren}.
 *
 * The transaction layer's `RollbackPartial` (phase-ledger.ts) is the
 * canonical producer; `presentation/` cannot import from `transaction/`
 * (BLOCK C / D-11 layering), so this composer accepts a structurally
 * compatible interface that requires only the `phase` field used in
 * rendering. The `msg` field present on `RollbackPartial` is
 * intentionally NOT consumed (free-text reasons surface via the ES-4
 * cause-chain trailer; the closed-set CMC-11 row vocabulary requires
 * the `[phase] (rollback failed) {rollback partial}` triple only).
 */
export interface RollbackPartialInput {
  readonly phase: string;
}

/**
 * Render the parent + indented children rollback block. The probe is
 * forwarded to `renderRow` for soft-dep marker injection on the parent
 * row (rollback-child variants never carry soft-dep predicates; the probe
 * has no effect on child rendering but the signature is uniform).
 */
export function renderRollbackPartial(
  parent: PluginInlineRow | PluginCascadeRow,
  children: readonly RollbackChild[],
  probe: SoftDepProbe,
): string {
  const parentLine = renderRow(parent, probe);
  if (children.length === 0) {
    return parentLine;
  }

  // Children render at the bare compact level (no leading icon -- see the
  // `kind: "rollback-child"` variant renderer in compact-line.ts). Each
  // RollbackChild already carries `kind: "rollback-child"` as its
  // discriminator; passing the value directly to renderRow is structurally
  // identical to re-constructing it via `{kind: "rollback-child", ...child}`.
  const indented = children.map((c) => `  ${renderRow(c, probe)}`).join("\n");
  return `${parentLine}\n${indented}`;
}

/**
 * Compose the bare 2-space-indented children block from a
 * `RollbackPartial[]` ledger array, suitable for stitching under a parent
 * line that the caller composes independently.
 *
 * Used by the transaction-layer rollback chokepoint refactor (Plan 14-06
 * / D-14-04 orchestrator-owns-rendering): the transaction layer cannot
 * import from presentation/ (BLOCK C), so it returns the raw
 * `RollbackPartial[]` and the orchestrator calls this helper to compose
 * the canonical `[<phase>] (rollback failed) {rollback partial}` per-row
 * shape under its own `(failed) {rollback partial}` parent line.
 *
 * The free-text `msg` field of each `RollbackPartial` is intentionally
 * NOT embedded here: the closed-set CMC-11 token vocabulary requires the
 * `[phaseLabel] (rollback failed) {rollback partial}` triple as the
 * complete user-visible row; free-text reasons surface via the
 * ES-4 Error.cause depth-5 trailer at the notify boundary instead.
 *
 * Byte-equivalence guarantee: the produced string is byte-equal to what
 * the pre-Plan-14-06 `transaction/rollback.ts` hand-composed inline at
 * its `childLines` step (see docs/output-catalog.md L330-333 catalog
 * form). Empty input returns the empty string (caller is responsible for
 * deciding whether to omit the block entirely vs. emit just the parent).
 */
export function composeRollbackPartialChildren(partials: readonly RollbackPartialInput[]): string {
  if (partials.length === 0) {
    return "";
  }

  return partials.map((p) => `  [${p.phase}] (rollback failed) {rollback partial}`).join("\n");
}
