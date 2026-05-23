// presentation/manual-recovery.ts -- MSG-MR-1..2 manual-recovery composer.
//
// The compact-line rendering lives in compact-line.ts (kind:
// "manual-recovery"); this file owns the orphanDetails-block composition
// rule. The MSG-MR-1 blank-line discipline ABOVE the manual-recovery line
// is composed by the CALLER (orchestrator): typical pattern is
//   `${parent_op_body}\n\n${renderManualRecovery(line, probe)}`
//
// MSG-MR-2: ManualRecoveryLine has no `marketplace` or `scope` field, so
// `renderRow({kind: "manual-recovery", ...})` cannot emit `@<mp>` or
// `[<scope>]`. The "manual recovery as a separate top-level line" anchor
// is enforced at the union-type level.
//
// orphanDetails are free-form per style-guide §18.2 -- not a RowSpec row.
// Each detail is appended on its own line at 2-space indentation. Empty
// or absent orphanDetails returns just the head compact line.

import { renderRow } from "./compact-line.ts";

import type { ManualRecoveryLine, SoftDepProbe } from "./compact-line.ts";

/**
 * Render a manual-recovery anchor line and (optionally) its free-form
 * orphanDetails block. Returns a single string with no blank-line prefix
 * (the caller composes the MSG-MR-1 blank-line separator).
 */
export function renderManualRecovery(line: ManualRecoveryLine, probe: SoftDepProbe): string {
  const head = renderRow(line, probe);
  const details = line.orphanDetails ?? [];
  if (details.length === 0) {
    return head;
  }

  const indented = details.map((d) => `  ${d}`).join("\n");
  return `${head}\n${indented}`;
}
