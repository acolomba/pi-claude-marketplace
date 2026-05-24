// tests/lint-rules/msg-er-1-empty-token.js
//
// MSG-ER-1 (docs/messaging-style-guide.md § 13 -- Empty Results): empty
// list / cascade target sets MUST render as a bare compact token --
// `(no marketplaces)` for empty marketplace listings, `(no plugins)`
// for empty plugin listings or empty cascade target sets. The line
// carries ONLY the status token in parentheses -- no icon, no name
// slot, no scope brackets, no reasons block. The legacy sentence forms
// `No marketplaces configured.` and `No plugins installed.` are RETIRED.
// The bare-token form is routed via `notifySuccess` (severity
// `default`) -- an empty result is not a failure.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `EmptyToken.token` at
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts:200-204`
//     is typed as `Extract<StatusToken, "no marketplaces" | "no plugins">`.
//     The TypeScript type system rejects any other string at every
//     `EmptyToken` construction callsite.
//   - The `EmptyToken` interface declares ONLY `{ kind: "empty"; token:
//     ... }` -- no `icon`, no `name`, no `scope`, no `reasons` fields,
//     so the renderer cannot emit those columns.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     empty-list catalog rows locks the bare-token rendering.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-er-1-empty-token",
  meta: {
    type: "problem",
    docs: {
      description:
        'MSG-ER-1: empty list / cascade target sets render as a bare compact token (`(no marketplaces)` / `(no plugins)`) with no icon, name, scope, or reasons. Structurally enforced by `EmptyToken.token: Extract<StatusToken, "no marketplaces" | "no plugins">` at `presentation/compact-line.ts:200-204` (the interface declares no icon/name/scope/reasons fields) and by `tests/architecture/catalog-uat.test.ts` byte-equality; this rule cites the enforcement and exists for registry parity (D-14-09).',
    },
    messages: {
      structurallyEnforced:
        "MSG-ER-1 empty-token rendering is structurally enforced; see EmptyToken at presentation/compact-line.ts:200-204 (token: Extract<StatusToken, ...> + no other fields) and tests/architecture/catalog-uat.test.ts.",
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
