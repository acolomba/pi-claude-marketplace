---
phase: 62
plan: 01
status: complete
subsystem: bridges/hooks/async-rewake
tags:
  - hooks
  - async-rewake
  - ring-buffer
  - pid-table
  - schema-admission
requires:
  - shared/atomic-json.ts (atomicWriteJson)
  - shared/path-safety.ts (assertPathInside)
  - shared/debug-log.ts (hookDebugLog)
  - shared/errors.ts (errorMessage)
  - persistence/locations.ts (ScopedLocations)
provides:
  - RingBuffer + STDERR_CAP_BYTES + STDOUT_CAP_BYTES (ring-buffer.ts)
  - PidTableEntry + readPidTable + writePidTable + unlinkPidTable + pidTablePath
    + ASYNC_REWAKE_PIDS_FILENAME + ASYNC_REWAKE_PID_TABLE_VERSION (pid-table.ts)
  - HOOK_HANDLER_SCHEMA admits asyncRewake / rewakeMessage / rewakeSummary
  - HookHandlerEntry interface widened with the three optional `unknown` fields
affects:
  - domain/components/hooks.ts (handler schema + handler entry interface)
requirements:
  - HOOK-06
  - EXEC-05
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts
    - tests/bridges/hooks/async-rewake/ring-buffer.test.ts
    - tests/bridges/hooks/async-rewake/pid-table.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - tests/domain/components/hooks.test.ts
decisions:
  - D-62-04 (ring-buffer caps + tail-drop policy + truncated latch)
  - D-62-05 (pid-table atomic + containment + version=1 envelope)
  - HOOK-03 (lenient schema admission deferred to runtime narrowing)
metrics:
  duration: ~30 min
  completed: 2026-06-15
  source-lines: 1056 (149 ring-buffer + 175 pid-table + 732 hooks.ts post-edit)
  tests-added: 28 (14 ring-buffer + 13 pid-table + 6 hooks.ts schema admission)
  unit-tests-after: 2184 (pass 2184 / fail 0)
  integration-tests-after: 10 (pass 10 / fail 0)
---

# Phase 62 Plan 01: asyncRewake Wave-1 leaves Summary

Three pure / persistence / schema-admission leaves for the asyncRewake
registry. RingBuffer caps and tail-drop policy, the version=1 pid-table
envelope, and the HOOK_HANDLER_SCHEMA admission for the asyncRewake
field family land together as the foundation Plan 02 will build the
spawn-and-exit-handler logic on top of.

## Commits

| Hash    | Type    | Description                                                       |
| ------- | ------- | ----------------------------------------------------------------- |
| 2b180b9 | test    | failing tests for async-rewake RingBuffer leaf                    |
| 4ec0bd4 | feat    | implement async-rewake RingBuffer pure-leaf                       |
| e03d3e8 | test    | failing tests for async-rewake pid-table leaf                     |
| 1851a65 | feat    | implement async-rewake pid-table persistence leaf                 |
| c877cd3 | test    | failing tests for asyncRewake field-family admission              |
| aa9a816 | feat    | admit asyncRewake / rewakeMessage / rewakeSummary                 |

Each task ran the TDD cycle in two commits (RED test, then GREEN
implementation). No REFACTOR cycle was needed -- the implementations
landed close enough to the plan sketches that no clean-up commit
followed.

## Artefacts delivered

### `bridges/hooks/async-rewake/ring-buffer.ts` (149 LoC)

- `STDERR_CAP_BYTES = 65_536` and `STDOUT_CAP_BYTES = 1_048_576` for
  Plan 02's per-child stream caps.
- `class RingBuffer` with fixed `capacity`, monotonic `writeIndex` /
  `filled` counters, and a never-reset `truncated` latch.
- `write(chunk)`: zero-capacity sink behavior, oversized-chunk tail
  retention, exact-fill no-overflow, two-segment wrap-around copy.
- `read()`: chronological-order utf-8 decode for both the unwrapped
  and wrapped cases; the UTF-8 wrap-boundary caveat is documented at
  the file header.
- Pure-and-total: zero project-internal imports, zero
  `node:child_process` import.

### `bridges/hooks/async-rewake/pid-table.ts` (175 LoC)

- `PidTableEntry` (readonly: pid, dispatchId, scope, marketplace,
  plugin, spawnedAt).
- Internal `PidTableFile` envelope `{ version: 1, entries: [...] }`.
- `pidTablePath(loc)`: pure path composition under
  `<dataRoot>/_shared/`.
- `readPidTable(loc)` / `writePidTable(loc, entries)` /
  `unlinkPidTable(loc)`: all three are never-throws. ENOENT, malformed
  JSON, version-mismatch, and shape-mismatch all collapse to fail-clean
  (`[]` / no-op) with a single `hookDebugLog` line at the OBS-01 seam.
- Atomic writes through `atomicWriteJson` (write-file-atomic tmp +
  fsync + rename); the internal `mkdir(path.dirname, { recursive: true
  })` covers cold-start with no pre-existing `_shared/` dir.
- Every read / write / unlink call site is preceded by
  `assertPathInside(loc.dataRoot, ...)` for NFR-10 containment.

### `domain/components/hooks.ts` (modified)

- `HookHandlerEntry` interface declares three new optional `unknown`
  fields: `asyncRewake`, `rewakeMessage`, `rewakeSummary`.
- `HOOK_HANDLER_SCHEMA.properties` adds three empty-object entries
  (`asyncRewake: {}`, `rewakeMessage: {}`, `rewakeSummary: {}`) per the
  HOOK-03 lenient stance -- any value passes the schema; runtime
  narrowing lives in Plan 02's registry.
- `required: ["type"]` unchanged. `HOOK_ENTRY_SCHEMA` (Type.Object)
  unchanged -- the field family lives at the HANDLER level per
  upstream's hooks-guide contract.
- The schema-level `if / then` block that encodes the "`command`
  required when `type === 'command'`" discriminator is unchanged.

## Verification

- `npm run check` GREEN: typecheck + ESLint + Prettier + 2184 unit
  tests + 10 integration tests, zero failures.
- Plan-cadence pattern run
  (`npm test -- --test-name-pattern='async-rewake|ring-buffer|pid-table|HOOK_HANDLER_SCHEMA|RingBuffer'`)
  picks up the 14 + 13 + 6 new test rows alongside all previously-
  matching rows, GREEN.
- Comment-policy compliance: `grep -nE 'Phase
  [0-9]+|Pitfall [0-9]+|Pattern [0-9]+|Plan [0-9]+-[0-9]+|Wave
  [0-9]+|Task [0-9]+'` returns no matches in any of the three source
  files.
- `assertPathInside` call-site count in `pid-table.ts`: 4 (3 call
  sites + 1 import line), satisfying the "at least 3" plan done
  criterion.
- `bridges/hooks/async-rewake/ring-buffer.ts` and
  `bridges/hooks/async-rewake/pid-table.ts` do NOT import
  `node:child_process`. The `no-shell-out.test.ts` whitelist amendment
  (TWO -> THREE) lands atomically with Plan 02's first
  `node:child_process` import.
- `STDERR_CAP_BYTES === 65536`, `STDOUT_CAP_BYTES === 1048576`,
  `ASYNC_REWAKE_PID_TABLE_VERSION === 1` -- all hardcoded literal
  exports.

## Threat-model verification (per plan threat register)

- **T-62-04 (DoS / noisy child stderr-stdout)**: mitigated.
  RingBuffer caps are hardcoded literal `number` exports; the tail-
  drop policy is exercised by the "two-write overflow drops oldest
  byte" and "many small writes that eventually overflow" tests; the
  `truncated` latch is verified to never reset across subsequent
  writes.
- **T-62-05 (PID-table tamper / partial-write)**: mitigated. Every
  disk write goes through `atomicWriteJson`; the shape probe rejects
  partial / malformed / wrong-version reads to `[]` (no throw); the
  `readPidTable returns [] on malformed JSON` and `on shape mismatch`
  tests pin both arms.
- **T-62-SC (package-install supply chain)**: no new packages
  installed; the plan reused `write-file-atomic` (already a project
  runtime dep) and `typebox` (already a peer dep).

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Initial RingBuffer exact-fill case incorrectly
flagged truncated**

The first GREEN draft set `truncated = true` whenever `chunk.length >=
this.capacity`. This tripped the "exact-fill no overflow" behavior
spec ("`new RingBuffer(8); b.write(Buffer.from("12345678"))` returns
`truncated: false`"). Fix: changed the predicate to strict `>`
(`chunk.length > this.capacity`) so exact-fill fits in full and only
strictly-larger chunks latch the flag. Caught by the new test row
during the GREEN gate.

- Found during: Task 1 GREEN
- File modified:
  `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts`
- Commit: 4ec0bd4

**2. [Rule 1 - Bug] `as const` on the cap constants did not compile**

Initial draft wrote `64 * 1024 as const` for `STDERR_CAP_BYTES`. TS
6.0.3 rejects `as const` on an arithmetic-expression result (TS1355);
narrowing the type to the literal then failed because the expression
widens to `number`. Fix: write the literal value directly
(`65_536` / `1_048_576`) and let TS infer the literal type from the
underscore-separated literal. Same export-time semantics, no
behavioral change.

- Found during: Task 1 GREEN
- File modified:
  `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts`
- Commit: 4ec0bd4

**3. [Rule 1 - Bug] `JSON.parse` return value tripped no-unsafe-any in
the pid-table cold-start test**

ESLint flagged three `Unsafe assignment` errors on
`JSON.parse(raw)` chained `.version` / `.entries` reads in the test
file. Fix: assert the parse output to `{ version: unknown; entries:
unknown }`, then let the test's `assert.equal` / `assert.deepEqual`
do the value checks. No type information added, just the cast that
turns off the rule's unknown-source warning.

- Found during: Task 2 GREEN
- File modified:
  `tests/bridges/hooks/async-rewake/pid-table.test.ts`
- Commit: 1851a65 (shipped together with the pid-table.ts GREEN
  implementation since the lint failure surfaced only when the
  implementation existed)

### No architectural changes

No Rule 4 trips. No authentication gates. No CLAUDE.md or skill rule
conflicts.

## Foundation for Plan 02

With Plan 01 landed, Plan 02 can:

- Construct `new RingBuffer(STDERR_CAP_BYTES)` and `new
  RingBuffer(STDOUT_CAP_BYTES)` per child by importing the constants
  directly from `bridges/hooks/async-rewake/ring-buffer.ts`.
- Persist registry state after every spawn / exit via
  `writePidTable(loc, entries)`; verify orphan candidates via
  `readPidTable(loc)`; clean up via `unlinkPidTable(loc)` after the
  Plan 03 reap pass.
- Read `entry.handlerDecl.asyncRewake === true` as the discriminator
  for routing to the async path; non-boolean values silently fall
  through to the sync path per the HOOK-03 lenient stance.
- Land the `EXACTLY_TWO_SANCTIONED_SHELL_OUT_SITES` ->
  `EXACTLY_THREE_…` whitelist amendment atomic with the first
  `node:child_process` import from
  `bridges/hooks/async-rewake/registry.ts` (D-58-01).

## Self-Check: PASSED

- `[ -f extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts ]`: FOUND
- `[ -f extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts ]`: FOUND
- `[ -f tests/bridges/hooks/async-rewake/ring-buffer.test.ts ]`: FOUND
- `[ -f tests/bridges/hooks/async-rewake/pid-table.test.ts ]`: FOUND
- `git log --oneline -7` shows all six commits (2b180b9, 4ec0bd4,
  e03d3e8, 1851a65, c877cd3, aa9a816) on the expected branch
  `features/v1.13-hook-bridge`.
- `npm run check` GREEN at the tip commit aa9a816.
