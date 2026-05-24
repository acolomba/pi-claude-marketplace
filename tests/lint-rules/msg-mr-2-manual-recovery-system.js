// tests/lint-rules/msg-mr-2-manual-recovery-system.js
//
// MSG-MR-2 (docs/messaging-style-guide.md §7 -- Manual Recovery):
// system-level manual-recovery lines (e.g. for the agent index, the
// state.json file, or any non-plugin / non-marketplace system
// resource) live in the NAME slot and MUST NOT include an
// `@<marketplace>` token or a `[<scope>]` bracket. The
// `ManualRecoveryLine` interface in `presentation/compact-line.ts`
// declares no marketplace or scope fields, so the TYPE system already
// enforces the schema; this rule is a defensive AST-construction
// backstop that catches hand-composed object literals with `kind:
// "manual-recovery"` whose `resource` field contains `@` or `[`.
//
// AST visitor: visits ObjectExpression nodes; if a property `kind` is
// the string literal `"manual-recovery"` AND a `resource` property
// is a Literal / TemplateLiteral containing `@` or `[`, report.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

function literalText(node) {
  if (node === null || node === undefined) {
    return null;
  }

  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  if (node.type === "TemplateLiteral") {
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw ?? "").join("");
  }

  return null;
}

function propertyKeyName(prop) {
  if (prop.type !== "Property") {
    return null;
  }

  if (prop.key.type === "Identifier") {
    return prop.key.name;
  }

  if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
    return prop.key.value;
  }

  return null;
}

export default createRule({
  name: "msg-mr-2-manual-recovery-system",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-MR-2: system-level manual-recovery line MUST NOT include `@<marketplace>` or `[<scope>]` in the resource slot. The `ManualRecoveryLine` interface declares no marketplace or scope fields per `presentation/compact-line.ts`.",
    },
    messages: {
      manualRecoverySystemHasMarketplace:
        "MSG-MR-2: system-level manual-recovery line MUST NOT include `@<marketplace>` or `[<scope>]` in the resource slot (per docs/messaging-style-guide.md §7).",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      ObjectExpression(node) {
        let isManualRecovery = false;
        let resourceNode = null;
        for (const prop of node.properties) {
          const name = propertyKeyName(prop);
          if (name === null) {
            continue;
          }

          if (name === "kind") {
            const text = literalText(prop.value);
            if (text === "manual-recovery") {
              isManualRecovery = true;
            }
          } else if (name === "resource") {
            resourceNode = prop.value;
          }
        }

        if (!isManualRecovery || resourceNode === null) {
          return;
        }

        const text = literalText(resourceNode);
        if (text === null) {
          return;
        }

        if (text.includes("@") || text.includes("[")) {
          context.report({ node, messageId: "manualRecoverySystemHasMarketplace" });
        }
      },
    };
  },
});
