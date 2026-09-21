// bridges/hooks/payloads/compact-trigger.ts
//
// Shared classification for PreCompact/PostCompact's `trigger` field
// (PAYL-01 / D-60-04). Pi reports `manual`, `threshold`, or `overflow`
// on both `SessionBeforeCompactEvent` and `SessionCompactEvent`; Claude's
// `trigger` field is `"manual" | "auto"` (claude-hook-config-syntax.md §
// 3), so the latter two Pi reasons both collapse to `auto`. Shared by
// both translators so the classification rule is encoded once, not
// duplicated per event.

export function compactTrigger(reason: "manual" | "threshold" | "overflow"): "auto" | "manual" {
  return reason === "manual" ? "manual" : "auto";
}
