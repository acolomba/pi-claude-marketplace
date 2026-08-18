// Deliberate import-x boundary violation. The canary test in
// `tests/architecture/import-boundaries.test.ts` runs the programmatic
// ESLint API against THIS file and asserts:
//   (a) at least one message has ruleId === "import-x/no-restricted-paths"
//   (b) ZERO messages have ruleId === "import-x/no-unresolved" (so we know
//       the rule fired for the boundary, not for a missing file)
//
// This file is excluded from CI's normal eslint run via the
// `ignores: ["tests/fixtures/bad-imports/**"]` block in eslint.config.js.
// The canary test passes `ignore: false` to override.
//
// The import target `extensions/pi-claude-marketplace/bridges/agents/index.ts`
// exists -- the fixture is NOT failing because of a missing file; it's
// failing because edge/ may not import from bridges/ per D-11. The canary
// zone's `from` is the whole `bridges/` tree, so any real file under it
// serves; this used to point at an aggregate `bridges/index.ts` barrel that
// was removed because its `export *` lines blinded fallow's unused-export
// detection across all five per-kind barrels.

import "../../../extensions/pi-claude-marketplace/bridges/agents/index.ts";

export {};
