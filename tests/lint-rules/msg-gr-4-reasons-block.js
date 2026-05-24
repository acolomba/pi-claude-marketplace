// tests/lint-rules/msg-gr-4-reasons-block.js
//
// MSG-GR-4 (docs/messaging-style-guide.md § 1): reasons live inside a
// single `{}` block, comma-separated, 1-3 words lowercase, hyphenated
// where natural. Each reason MUST be drawn from the closed enum in
// section 4 (modulo the manifest-field carve-out for `{hooks}` /
// `{lspServers}`). Absent `{}` means no reason applies -- the empty
// form `{}` MUST NOT be emitted.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The closed enum is the `Reason` literal-union derived from
//     `REASONS as const` in
//     `extensions/pi-claude-marketplace/shared/grammar/reasons.ts`. The
//     TypeScript type system rejects any string outside the set at every
//     callsite that constructs a `RowSpec.reasons` array.
//   - `composeReasons` inside `presentation/compact-line.ts` owns the
//     `{...}` formatting and the empty-omission rule -- the renderer
//     simply does not emit braces when the reasons array is empty.
//   - The grammar-frontmatter drift test at
//     `tests/architecture/grammar-frontmatter.test.ts` locks set equality
//     against the messaging-style-guide.md frontmatter so the runtime
//     enum stays byte-equal to the binding contract.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-gr-4-reasons-block",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-GR-4: reasons live inside a single `{}` block, comma-separated, drawn from the closed enum; empty `{}` is never emitted. Structurally enforced by the `Reason` literal-union in `shared/grammar/reasons.ts` + `composeReasons` in `presentation/compact-line.ts` + grammar-frontmatter drift test; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-GR-4 reasons-block grammar is structurally enforced; see shared/grammar/reasons.ts (Reason literal-union), presentation/compact-line.ts (composeReasons), and tests/architecture/grammar-frontmatter.test.ts.",
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
