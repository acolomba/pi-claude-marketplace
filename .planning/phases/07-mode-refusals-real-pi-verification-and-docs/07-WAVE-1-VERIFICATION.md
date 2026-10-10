# Wave 1 combined-tree verification

- Verified commit: `1cbd639a` on `features/json`.
- Runtime: Node `v26.11.1`.
- `npm run check`: exit 0; all static checks, unpaired tests, integration tests,
  and direct coverage passed. Merged LCOV contains 266 source/test pairs.
- `node --test tests/e2e/pi-json-output.test.ts`: exit 0, eight passed,
  zero skipped on merged commit `13fbfc61`. The subsequent `1cbd639a` changes
  only two unit-test mode-read expectations, outside this runtime suite's inputs.
- Schema-drift gate: passed. Codebase-map drift remains advisory;
  the owner returned `directive: warn`, `spawn_mapper: false`.

The first full check caught five older authentication tests whose strict mocks
allowed mode reads only for notifications. The new lazy admission check adds
one mode read before device flow. Commit `1cbd639a` supplies that exact read
count in the five cases without changing output assertions or production code.
Both affected owner suites passed all 123 tests, the commit hook passed, and
the full combined-tree rerun passed.

All three executor worktrees were merged and removed through the GSD manifest.
Scope additions are documented in their summaries: obsolete browse dependency
and comments, RED evidence, nightly fixture provisioning, and a narrow
lockfile-size exception. The corpus baseline and catalog remain unchanged.

## Threat Flags

The exact-floor fixture's inherited dependency advisory is recorded in
`07-PEER-FLOOR-AUDIT.md` and `deferred-items.md`. No new security-relevant
surface was introduced by the test expectation correction.
