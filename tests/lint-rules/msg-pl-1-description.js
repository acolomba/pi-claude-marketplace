// tests/lint-rules/msg-pl-1-description.js
//
// MSG-PL-1 (docs/messaging-style-guide.md § 11 -- Plugin List Rendering):
// plugin descriptions are preserved VERBATIM from V1 as a second
// indented line beneath the compact line, truncated at column 66 with
// the literal U+2026 (`…`) suffix on truncation. The description line is
// `list`-only -- install / update / import / uninstall result rows and
// cascade rows MUST NOT carry descriptions.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     rendered `list` output locks the description column, the
//     indentation, the 66-column truncation, and the U+2026 suffix.
//   - The `description?` field is declared ONLY on `PluginListRow` at
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts`;
//     the other `RowSpec` variants do not carry `description`, so
//     non-list surfaces structurally cannot emit one.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-pl-1-description",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-PL-1: plugin descriptions render verbatim as a second indented line on `list` rendering only, truncated at column 66 with U+2026 suffix. Structurally enforced by `tests/architecture/catalog-uat.test.ts` byte-equality on the rendered output and by `description?` field being declared ONLY on `PluginListRow` in `presentation/compact-line.ts`; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-PL-1 description rendering is structurally enforced; see PluginListRow.description in presentation/compact-line.ts (other RowSpec variants lack the field) and tests/architecture/catalog-uat.test.ts.",
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
