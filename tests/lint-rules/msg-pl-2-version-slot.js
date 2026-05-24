// tests/lint-rules/msg-pl-2-version-slot.js
//
// MSG-PL-2 (docs/messaging-style-guide.md § 11 -- Plugin List Rendering):
// the optional version slot renders as the literal `v<version>`
// (lowercase `v`, e.g. `v1.2.3`) between the scope brackets and the
// status token. The slot is OMITTED when the underlying record has no
// version (free-text plugins lacking a manifest-declared version,
// marketplace headers, system-level resource lines per MSG-MR-2).
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog locks the `v<version>` shape AND the omission when
//     version is absent.
//   - The `version?` field is `string | undefined` on `PluginInlineRow`,
//     `PluginInlineUninstalledRow`, `PluginCascadeRow`, `PluginListRow`
//     in `extensions/pi-claude-marketplace/presentation/compact-line.ts`;
//     `MarketplaceRow` does not declare `version` at all (marketplaces
//     have no version), and the renderer composes the slot only when the
//     field is present.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-pl-2-version-slot",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-PL-2: the version slot renders as literal `v<version>` between scope and status; omitted when absent. Structurally enforced by `version?: string` on plugin row variants in `presentation/compact-line.ts` (omitted by the renderer when undefined) and by `tests/architecture/catalog-uat.test.ts` byte-equality; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-PL-2 version slot rendering is structurally enforced; see plugin-row `version?: string` fields in presentation/compact-line.ts and tests/architecture/catalog-uat.test.ts.",
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
