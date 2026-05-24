// tests/lint-rules/msg-pl-5-hash-version.js
//
// MSG-PL-5 (docs/messaging-style-guide.md § 11 -- Plugin List Rendering):
// `hash-<12hex>` versions (PRD PI-7) render VERBATIM in the version
// slot, with or without the transition arrow. The 12 hex characters are
// NOT abbreviated in `list` rendering -- conservative first-cut keeps
// the full hash visible so users can copy-paste it for `--force` or
// similar arguments.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The version slot is rendered by the version-slot formatter inside
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts`.
//     The formatter prepends `"v"` to whatever string the `version`
//     field holds; there is no abbreviation path for hash-shaped
//     versions.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's hash-version examples locks the verbatim rendering.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-pl-5-hash-version",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-PL-5: `hash-<12hex>` versions render verbatim in the version slot (no abbreviation), with or without the transition arrow. Structurally enforced by the version-slot formatter in `presentation/compact-line.ts` (no abbreviation code path) and by `tests/architecture/catalog-uat.test.ts` byte-equality on the hash-version examples; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-PL-5 hash-version verbatim rendering is structurally enforced; see the version-slot formatter in presentation/compact-line.ts and tests/architecture/catalog-uat.test.ts.",
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
