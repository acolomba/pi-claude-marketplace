// tests/lint-rules/msg-pl-3-version-arrow.js
//
// MSG-PL-3 (docs/messaging-style-guide.md § 11 -- Plugin List Rendering):
// version TRANSITIONS render with an arrow `v<from> → v<to>` (literal
// U+2192, space-padded). Applies to two surfaces: `(updated)` rows
// (post-update result: source-version → target-version) and
// `(upgradable)` rows in `list` rendering (installed-version →
// manifest-version).
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The arrow glyph and its spacing are composed by the version-slot
//     formatter inside the renderers in
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts`
//     (and the list-row renderer). The arrow literal is internal to
//     that single emission point.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's `(updated)` and `(upgradable)` rows locks both the
//     U+2192 glyph and the surrounding single-space padding.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-pl-3-version-arrow",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-PL-3: version transitions render as `v<from> → v<to>` (literal U+2192, space-padded) on `(updated)` rows and on `(upgradable)` rows in `list`. Structurally enforced by the version-slot formatter inside `presentation/compact-line.ts` and by `tests/architecture/catalog-uat.test.ts` byte-equality; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-PL-3 version-arrow rendering is structurally enforced; see the version-slot formatter in presentation/compact-line.ts and tests/architecture/catalog-uat.test.ts.",
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
