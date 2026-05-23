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

import { renderRow } from "./compact-line.ts";

import type {
  PluginCascadeRow,
  PluginInlineRow,
  RollbackChild,
  SoftDepProbe,
} from "./compact-line.ts";

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
