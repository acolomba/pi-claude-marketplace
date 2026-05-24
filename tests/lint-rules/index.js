// tests/lint-rules/index.js
//
// Local ESLint plugin shell for the Phase 14 drift-guard rule suite.
//
// Plan 14-03 (this commit) lands the shell with EMPTY `RULE_NAMES` and an
// EMPTY `rules` map. Plans 14-04 (meta-assertion rules) and 14-05 (full-
// implementation rules + registry test) populate both. This file is NOT
// registered in `eslint.config.js` yet -- Plan 14-06 wires the per-rule
// `files:` patterns once the rules exist. Registering an empty plugin now
// would be a no-op for lint and would silently break the registry parity
// test in Plan 14-05 (which asserts every name in `RULE_NAMES` appears in
// some `eslint.config.js` rules block).
//
// D-14-07: local-plugin pattern matching how `typescript-eslint` and
// `eslint-plugin-import-x` ship rules.
// D-14-12: the `RULE_NAMES` export is the source the registry parity test
// (Plan 14-05) consumes -- independent of `eslint.config.js` parsing.

export const RULE_NAMES = Object.freeze([]);

export default {
  meta: {
    name: "eslint-plugin-msg-local",
    version: "1.0.0",
  },
  rules: {},
};
