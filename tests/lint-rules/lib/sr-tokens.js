// tests/lint-rules/lib/sr-tokens.js
//
// Severity classification of the 15 closed-set status tokens per
// `docs/messaging-style-guide.md` §10 (Severity Routing). The
// classification is pinned here so the MSG-SR-1..3 rule files share a
// single source of truth and the registry test can assert no rule
// reclassifies a token. The set covers all 15 tokens enumerated in
// `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts`
// (D-13-20 reconciled the count to 15 by adding `reinstalled`).
//
// Pinning rationale (RESEARCH.md Pattern 2 §"token classification"):
//   - SUCCESS-class: outcome-success cascade-success tokens. MUST route
//     via `notifySuccess` (severity=success). The MSG-SR-1 rule fires
//     when these tokens appear inside a `notifyWarning` / `notifyError`
//     callsite's first string argument.
//   - INFO-class: outcome-neutral tokens (no-op, no-result). The
//     style-guide §10 normative wrapper for these is `notifySuccess`
//     (severity=default) -- there is no separate `notifyInfo` wrapper
//     in `shared/notify.ts` (D-CMC-11..D-CMC-13 four-wrapper minimalism).
//     The MSG-SR-2 rule fires when these tokens appear inside a
//     `notifyWarning` / `notifyError` callsite.
//   - WARNING-class: outcome-failure tokens. MUST route via
//     `notifyWarning` (for soft failure / cascade-warning) or
//     `notifyError` (for hard failure). The MSG-SR-3 rule fires when
//     these tokens appear inside a `notifySuccess` callsite.
//
// The classification is the rule-author pin; the binding contract is
// §10 of the style guide. If §10 ever diverges, §10 wins -- update this
// file accordingly.

export const SUCCESS_CLASS_TOKENS = Object.freeze([
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "added",
  "removed",
  "available",
  "upgradable",
]);

export const INFO_CLASS_TOKENS = Object.freeze(["skipped", "no marketplaces", "no plugins"]);

export const WARNING_CLASS_TOKENS = Object.freeze([
  "failed",
  "rollback failed",
  "manual recovery",
  "unavailable",
]);

/**
 * Returns true if `text` contains a `(token)` substring (literal
 * parenthesised render) for any token in `tokens`. The status-token
 * render shape per §3 is `(<token>)` so detection by parenthesised form
 * avoids false positives against bare-word occurrences in prose strings
 * (e.g. `"installed via"` should not trip MSG-SR-1).
 *
 * @param {string} text
 * @param {readonly string[]} tokens
 * @returns {string | null} matched token (without parentheses) or null
 */
export function findStatusTokenIn(text, tokens) {
  for (const tok of tokens) {
    if (text.includes(`(${tok})`)) {
      return tok;
    }
  }

  return null;
}

/**
 * Walks an ESTree expression to extract any literal string fragments
 * (string Literal nodes and TemplateLiteral quasis). Returns the
 * concatenated text. Used to detect status-token substrings in
 * `notify*(ctx, <message>)` callsites regardless of whether the
 * message is a bare literal, a BinaryExpression `+` concatenation, or
 * a TemplateLiteral with interpolations.
 *
 * @param {any} node
 * @returns {string}
 */
export function collectLiteralText(node) {
  if (node === null || node === undefined) {
    return "";
  }

  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  if (node.type === "TemplateLiteral") {
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw ?? "").join("");
  }

  if (node.type === "BinaryExpression" && node.operator === "+") {
    return collectLiteralText(node.left) + collectLiteralText(node.right);
  }

  return "";
}
