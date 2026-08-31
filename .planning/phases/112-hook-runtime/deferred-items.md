# Phase 112 deferred items

- `npm run check` reaches `format:check` but reports pre-existing format differences in user-owned, untracked `.mcp.json` and `.planning/research/.cache/*.json` files. Plan 112-01 did not modify these files.
- The full unit suite reports file-level failures in `tests/bridges/agents/stage.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, and `tests/orchestrators/plugin/update.test.ts`. The agents-stage owner passes when rerun with the other two files. The marketplace-add and plugin-update owners still report file-level failures without a subtest diagnostic. Plan 112-01 does not own these files.
