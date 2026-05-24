// tests/lint-rules/msg-gr-3-per-scope.js
//
// MSG-GR-3 (docs/messaging-style-guide.md § 1): scope rendering is
// PER-SCOPE on every surface (marketplaces AND plugins). When a plugin
// is installed in both scopes it appears on two separate lines (one per
// scope). Row order is name-primary (case-insensitive `localeCompare`
// with `sensitivity: "base"`), scope-secondary (project before user) as
// a tie-breaker -- NOT a lexicographic compare of the full
// `<name> [<scope>]` label.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The sort-key + renderer logic in
//     `extensions/pi-claude-marketplace/presentation/marketplace-list.ts`
//     (and the parallel plugin-list renderer) emit one row per scope,
//     name-primary then project-before-user secondary.
//   - The list renderers MUST NOT emit per-scope group-header lines
//     (e.g. `project scope` / `user scope`); both lists are FLAT. The
//     renderer code path simply does not produce those headers.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's per-scope multi-row examples locks the sort + flat
//     rendering.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor
// per RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-gr-3-per-scope",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-GR-3: per-scope rendering on every surface; one row per scope, name-primary then project-before-user as tie-breaker; lists are FLAT (no group-header lines). Structurally enforced by the sort-key + renderer logic in `presentation/marketplace-list.ts` (and the parallel plugin-list renderer) plus `tests/architecture/catalog-uat.test.ts` byte-equality; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-GR-3 per-scope rendering is structurally enforced; see presentation/marketplace-list.ts sort + renderer and tests/architecture/catalog-uat.test.ts.",
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
