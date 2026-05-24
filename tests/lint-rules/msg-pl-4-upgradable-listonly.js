// tests/lint-rules/msg-pl-4-upgradable-listonly.js
//
// MSG-PL-4 (docs/messaging-style-guide.md § 11 -- Plugin List Rendering):
// `(upgradable)` is a status-token enum member that IMPLIES `installed`.
// It is RENDERED ONLY by `list` -- it is not an operation outcome and
// MUST NOT appear on install / update / uninstall result rows.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `PluginListRow.status` at
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts:174`
//     is `Extract<StatusToken, "installed" | "upgradable" | "available" |
//     "unavailable">` -- `(upgradable)` IS in the set.
//   - `PluginInlineRow.status`, `PluginCascadeRow.status`, and the
//     marketplace / empty / manual-recovery / rollback-child /
//     entity-error variants DO NOT include `"upgradable"` in their
//     `Extract<StatusToken, ...>` constraints -- the TypeScript type
//     system rejects `(upgradable)` on those non-list surfaces at every
//     construction callsite. Per the comment at compact-line.ts:150-161,
//     this exclusion is INTENTIONAL and locked by
//     `@ts-expect-error` in `tests/presentation/compact-line.test.ts`.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-pl-4-upgradable-listonly",
  meta: {
    type: "problem",
    docs: {
      description:
        'MSG-PL-4: `(upgradable)` implies installed and is rendered ONLY by `list`; non-list surfaces must not emit it. Structurally enforced by `PluginListRow.status` being the only `RowSpec` variant whose `Extract<StatusToken, ...>` constraint includes `"upgradable"` in `presentation/compact-line.ts`, plus a `@ts-expect-error` lock in `tests/presentation/compact-line.test.ts`; this rule cites the enforcement and exists for registry parity (D-14-09).',
    },
    messages: {
      structurallyEnforced:
        'MSG-PL-4 `(upgradable)` list-only constraint is structurally enforced; see PluginListRow.status in presentation/compact-line.ts (only variant whose Extract<StatusToken, ...> includes "upgradable") and the @ts-expect-error lock in tests/presentation/compact-line.test.ts.',
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
