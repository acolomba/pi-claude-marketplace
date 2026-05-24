// tests/lint-rules/index.d.ts
//
// Type declarations for the sibling `index.js` local ESLint plugin
// module. The plugin is intentionally a `.js` file (ESLint plugin
// infrastructure consumed by ESLint, not the TypeScript compiler --
// per RESEARCH.md Pattern 2 + Pitfall 2). The architecture registry
// parity test (`tests/architecture/msg-rule-registry.test.ts`)
// imports `RULE_NAMES` from this module; this declaration provides
// the type `tsc --noEmit` needs to resolve that import under the
// project's strict type-check.

/**
 * The 34 MSG-* rule names registered by the local ESLint plugin.
 * Family-then-numeric order, meta-assertion first (16) then
 * full-impl (18) per D-14-09 LOCKED split. Plan 14-05 set the count
 * to 34 by adding the 18 full-impl rules to Plan 14-04's 16
 * meta-assertion rules.
 */
export const RULE_NAMES: readonly string[];

/**
 * ESLint plugin shape: `meta` block + per-rule registry. Each rule
 * is keyed by its slug (matches `RULE_NAMES`) and points at the
 * default export of the corresponding `msg-*.js` rule file (an
 * `ESLintUtils.RuleCreator` invocation). Typed loosely as `unknown`
 * here because the registry test only consumes `RULE_NAMES`; the
 * concrete rule shape lives behind `ESLintUtils`'s type machinery
 * and is not asserted at the architecture level.
 */
declare const plugin: {
  meta: { name: string; version: string };
  rules: Record<string, unknown>;
};

export default plugin;
