// tests/lint-rules/msg-pl-6-version-non-success.js
//
// MSG-PL-6 (docs/messaging-style-guide.md § 11 -- Plugin List Rendering):
// version display for non-success states (audit-discretion-resolved):
//   - SHOW the previously-installed version on `(uninstalled)` rows
//     (`v1.2.3 (uninstalled)`)
//   - SHOW the target version on `(failed)` install rows
//   - SHOW the transition on `(failed)` update rows
//     (`v1.2.3 → v1.4.0 (failed)`)
//   - OMIT on `(removed)` marketplace lines (marketplaces have no
//     version in the same sense as plugins)
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The per-shape renderers in
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts`
//     decide whether to emit the version slot based on the row variant
//     and the `version?` field's presence. `MarketplaceRow` has NO
//     `version` field at all, so `(removed)` marketplace lines
//     structurally cannot emit a version.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's `(uninstalled)`, `(failed)` install / update, and
//     `(removed)` marketplace rows locks the per-state version display.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-pl-6-version-non-success",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-PL-6: version display on non-success states (`(uninstalled)` shows previous, `(failed)` shows target or transition, `(removed)` marketplaces omit). Structurally enforced by the per-shape renderers in `presentation/compact-line.ts` (and `MarketplaceRow` lacking a `version` field) plus `tests/architecture/catalog-uat.test.ts` byte-equality; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-PL-6 version-on-non-success display is structurally enforced; see per-shape renderers in presentation/compact-line.ts (MarketplaceRow has no `version` field) and tests/architecture/catalog-uat.test.ts.",
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
