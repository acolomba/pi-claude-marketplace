// tests/lint-rules/msg-mr-1-manual-recovery-anchor.js
//
// MSG-MR-1 (docs/messaging-style-guide.md §7 -- Manual Recovery):
// manual-recovery anchors are emitted as a separate top-level compact
// line, preceded by a blank line, INDEPENDENT of whatever operation
// triggered them. The canonical emission path is
// `presentation/manual-recovery.ts::renderManualRecovery`. The legacy
// sentence-form prefix `MANUAL RECOVERY REQUIRED:` (retained briefly
// during Phase 12's transition) is RETIRED; any string literal still
// carrying it indicates a callsite that has not migrated to the
// `ManualRecoveryLine` row spec.
//
// AST visitor: visits string Literal nodes and TemplateLiteral
// quasis; flags any value containing the legacy prefix substring
// `MANUAL RECOVERY REQUIRED:`. The canonical composer file is excluded
// via Plan 06's `ignores:` block; without that scope the rule would
// false-positive on its own composer.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const LEGACY_PREFIX = "MANUAL RECOVERY REQUIRED:";

export default createRule({
  name: "msg-mr-1-manual-recovery-anchor",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-MR-1: legacy `MANUAL RECOVERY REQUIRED:` sentence prefix is RETIRED. Emit a `ManualRecoveryLine` via `renderManualRecovery` (presentation/manual-recovery.ts) so the anchor renders as a separate top-level compact line per §7.",
    },
    messages: {
      legacyManualRecoveryPrefix:
        "MSG-MR-1: legacy `MANUAL RECOVERY REQUIRED:` prefix detected; emit a `ManualRecoveryLine` via `renderManualRecovery` instead (per docs/messaging-style-guide.md §7).",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") {
          return;
        }

        if (node.value.includes(LEGACY_PREFIX)) {
          context.report({ node, messageId: "legacyManualRecoveryPrefix" });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const text = quasi.value.cooked ?? quasi.value.raw ?? "";
          if (text.includes(LEGACY_PREFIX)) {
            context.report({ node: quasi, messageId: "legacyManualRecoveryPrefix" });
            return;
          }
        }
      },
    };
  },
});
