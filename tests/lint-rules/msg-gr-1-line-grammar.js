// tests/lint-rules/msg-gr-1-line-grammar.js
//
// MSG-GR-1 (docs/messaging-style-guide.md § 1 -- Foundational Rule:
// Line Grammar): every compact line follows the universal shape
// `<icon> <name>[@marketplace] [scope(s)] [<marker>] [version] (status)
// {reason(s)}` in a fixed token order. Absent slots are omitted entirely;
// no placeholder text is rendered.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `RowSpec` discriminated union in
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts`
//     enumerates every legal row shape (PluginInlineRow,
//     PluginInlineUninstalledRow, PluginCascadeRow, PluginListRow,
//     MarketplaceRow, EmptyToken, ManualRecoveryLine, RollbackChild,
//     EntityErrorRow). No caller can emit a compact line by hand-composing
//     string fragments -- the only emission point is `renderRow(spec,
//     probe)` (compact-line.ts:267) which switches on `row.kind` and
//     dispatches to a per-shape renderer.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     rendered catalog output further locks the token order.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09): it exists in the
// plugin so the registry parity test in Plan 14-05 sees a name under
// `RULE_NAMES` for MSG-GR-1, and so reviewers can locate the
// enforcement citation via `meta.docs.description`. The visitor is a
// no-op `Program: () => {}` per RESEARCH.md Pitfall 8 -- the rule does
// no AST work because the type system + renderer + catalog-uat trio
// already does it.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-gr-1-line-grammar",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-GR-1: every compact line follows the universal token order `<icon> <name>[@marketplace] [scope] [<marker>] [version] (status) {reasons}`. Structurally enforced by the `RowSpec` discriminated union + `renderRow` switch in `presentation/compact-line.ts` and by byte-equality assertions in `tests/architecture/catalog-uat.test.ts`; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-GR-1 line grammar is structurally enforced; see presentation/compact-line.ts (RowSpec union + renderRow) and tests/architecture/catalog-uat.test.ts.",
    },
    schema: [],
  },
  defaultOptions: [],
  create() {
    return {
      // No-op visitor (RESEARCH.md Pitfall 8): documents intent and
      // silences any "rule has no selectors" lint nag.
      Program: () => {},
    };
  },
});
