// tests/lint-rules/msg-sd-3-soft-dep-scope.js
//
// MSG-SD-3 (docs/messaging-style-guide.md § 6 -- Soft-Dependency
// Markers): emission SCOPE for the `{requires pi-subagents}` /
// `{requires pi-mcp}` soft-dep markers covers `list` rendering for
// `(available)` and `(installed)` rows, per-row inside an `import` or
// `update` cascade, and the existing single-plugin install / update /
// reinstall success result. The marker MUST NOT appear on
// `(uninstalled)` rows.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `PluginInlineUninstalledRow` at
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts:114-120`
//     intentionally lacks `declaresAgents` / `declaresMcp` fields. The
//     renderer cannot emit `{requires pi-subagents}` /
//     `{requires pi-mcp}` on `(uninstalled)` rows because the predicate
//     fields are not on the type.
//   - The eligible row variants (`PluginInlineRow`,
//     `PluginCascadeRow`, `PluginListRow`) DO declare the predicate
//     fields, enabling emission on the per-MSG-SD-3 surfaces.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's `(uninstalled)` rendering locks the absence.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-sd-3-soft-dep-scope",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SD-3: soft-dep emission scope covers list / cascade / single-shot success rows but NOT `(uninstalled)` rows. Structurally enforced by `PluginInlineUninstalledRow` lacking `declaresAgents` / `declaresMcp` fields at `presentation/compact-line.ts:114-120` and by `tests/architecture/catalog-uat.test.ts` byte-equality; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-SD-3 emission scope is structurally enforced; see PluginInlineUninstalledRow at presentation/compact-line.ts:114-120 (no soft-dep predicate fields) and tests/architecture/catalog-uat.test.ts.",
    },
    schema: [],
  },
  defaultOptions: [],
  create() {
    return {
      // No-op visitor (RESEARCH.md Pitfall 8).
      Program: () => {},
    };
  },
});
