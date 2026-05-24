// tests/lint-rules/msg-gr-2-marketplace-token.js
//
// MSG-GR-2 (docs/messaging-style-guide.md § 1): the `@<marketplace>`
// token MUST be rendered only on standalone single-plugin mentions.
// On plugin rows inside a marketplace-headed cascade the
// `@<marketplace>` MUST be omitted -- those rows inherit the
// marketplace from the cascade header line.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `PluginCascadeRow` interface at
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts:128-148`
//     intentionally lacks a `marketplace` field. The renderer for cascade
//     rows therefore cannot emit `@<marketplace>` because the type does
//     not carry the value.
//   - Inline mentions go through `PluginInlineRow` (compact-line.ts:93-106)
//     which DOES carry `marketplace: string`. The carve-out is enforced
//     by the type discriminator on `RowSpec`.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). The no-op
// `Program: () => {}` visitor (RESEARCH.md Pitfall 8) lives here so the
// MSG-GR-2 ID has a registry entry; the actual enforcement is the type.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-gr-2-marketplace-token",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-GR-2: `@<marketplace>` is rendered only on standalone single-plugin mentions; cascade rows inherit the marketplace from the cascade header. Structurally enforced by `PluginCascadeRow` at `presentation/compact-line.ts:128-148` lacking the `marketplace` field; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-GR-2 marketplace-token carve-out is structurally enforced; see PluginCascadeRow at presentation/compact-line.ts:128-148 (no `marketplace` field).",
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
