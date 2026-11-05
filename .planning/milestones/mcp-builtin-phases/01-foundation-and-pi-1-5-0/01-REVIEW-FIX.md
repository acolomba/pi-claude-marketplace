---
phase: 01-foundation-and-pi-1-5-0
fixed_at: 2026-11-04T10:11:51Z
review_path: .planning/phases/01-foundation-and-pi-1-5-0/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-04T10:11:51Z
**Source review:** .planning/phases/01-foundation-and-pi-1-5-0/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (CR-01, CR-02, WR-01 to WR-05, and IN-05 by the
  orchestrator's choice)
- Fixed: 8
- Skipped: 0 in scope. IN-01 to IN-04 and IN-06 were out of scope; they are
  listed under "Out-of-scope findings".

All work ran in the main checkout on `features/mcp-builtin`
(`workflow.use_worktrees` opt-out by the orchestrator). No worktree was made.
Every gate below ran in that checkout, so its results can be reproduced from
the tree as committed.

## Fixed Issues

### CR-01: The deferred-pin restore leaves the new version's MCP servers on a record it rolls back to the old version

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `test/orchestrators/reconcile/apply.test.ts`
**Commit:** 2091dd3
**Applied fix:** The disabled pin refresh's field list is now the exported
tuple `DISABLED_PIN_FIELDS` (`as const satisfies readonly (keyof PluginStateRecord)[]`),
and `DisabledPin` is the `Pick` of that tuple. `apply.ts` builds `PIN_FIELDS`
from the tuple plus `updatedAt`, so the two lists cannot drift.
`compatibilityBasis` joined the tuple in the WR-02 commit. The restore saves
only the pin fields the old record held. It deletes every pin field, then
assigns the saved ones, so an optional field that was absent stays absent. A
key with no saved record restores nothing and never deletes required fields.
Two new `apply` tests fail without the fix: after a failed deferred enable,
the record equals its `before` value in every field. The first test seeds old
servers and `mcpBundle: true`. The second test seeds a legacy record without
`mcpServerConfigs`.

### CR-02: The frozen built-in `toolNamePrefix` is not a prefix of the server's tool names once the server name is long

**Files modified:** `extensions/pi-claude-marketplace/domain/mcp-implementation.ts`, `features/lib/mcp-implementation.ts`, `features/lib/mcp-stub-server.ts`, `test/domain/mcp-implementation.test.ts`
**Commit:** 0089265
**Applied fix:** `toolNamePrefix` is now `(plugin, server) => string | undefined`.
The doc comment says that the profile promises only a true prefix. The
built-in profile returns `mcp__<folded>__` only when it is at most 55
characters long (`KEPT_TOOL_NAME_LENGTH = 64 - 8 - 1`). Otherwise it returns
`undefined`. The adapter profile always returns a string. The harness
`listingDone` uses a new helper `isBuiltinStubTool`. With a prefix, it matches
by prefix. Without one, it matches the full names from `toolName` of the
stub's tools. `mcp-stub-server.ts` exports these names as `STUB_TOOL_NAMES`.
New test rows use literals that Pi 1.5.0's own `createMcpToolName` computed in
a scratch script. The rows are a 40-character plugin+server pair (the prefix
is kept, and the cut name starts with it), the review's 42-character pair
(`undefined`), and the adapter on the long pair (the prefix is kept).
**Status:** fixed: requires human verification (a contract change; see
"Choices to verify").

### WR-01: The legacy reader can return the servers of a version the record does not name

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`, `test/orchestrators/mcp/recorded-servers.test.ts`
**Commit:** 131b5a4
**Applied fix:** There is a new reason, `version-mismatch`. After the root
check, the reader derives the version install would record for the
re-resolution. It uses install's own `deriveInstallVersion`, now exported,
with no pin override and with the record's `resolvedSha` and
`resolvedVersion`. So a record with `resolvedVersion` derives at its release
tag. The reader refuses when `isSameVersion(record.version, derived,
record.resolvedSha)` is false. The test fixture's marketplace entries now
declare version 1.0.0, the version that `installRecord` names. There are two
new tests: a tag-pinned record whose version holds the tag commit
re-resolves, and a live path tree moved to 1.1.0 is refused as
`version-mismatch`.
**Status:** fixed: requires human verification (a logic change; see
"Choices to verify").

### WR-02: `compatibilityBasis` is decoupled from every writer of `compatibility`

**Files modified:** `extensions/pi-claude-marketplace/persistence/state-io.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`, `test/persistence/state-io.test.ts`, `test/orchestrators/plugin/update-preflight.test.ts`, `test/orchestrators/plugin/update-swap.test.ts`, `test/orchestrators/reconcile/mcp-migration.test.ts`
**Commit:** 10d360e
**Applied fix:** `compatibilityBasis` stays at the record's top level. Its
schema comment now states the rule: the basis describes the `compatibility`
beside it. A new export, `replaceCompatibility(record, compatibility)`, writes
the verdict and deletes the basis. The writers below use it:
`applyAllSuccessRecordFields`, `markUpdateInProgress`,
`refreshDisabledRecord`, and the AMIG-01 `applyDroppedServers` write in
`mcp-migration.ts`, which changed `compatibility` in place before.
`disabledPinProjection` includes `pin.compatibilityBasis ?? null`, and
`DISABLED_PIN_FIELDS` includes the field. So a disabled refresh writes a
basis-only change, and `apply`'s restore puts the basis back. Install writes
a new record object, so it never carries an old basis. Each writer has a test
that fails without the change. The intent-mark test still fails if only that
one writer is reverted.

### WR-03: `recordedMcpServers` swallows every error without a trace

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`, `test/orchestrators/mcp/recorded-servers.test.ts`
**Commit:** 7d477a8
**Applied fix:** The `catch` keeps the `unreadable` mapping. Before it
returns, it calls `hookDebugLog(\`recorded MCP servers unreadable: ${errorMessage(err)}\`, "mcp")`,
as `session-materialize.ts`'s `runStep` does. The two reader-failure tests
capture the debug channel with `test/platform/debug-log-capture.ts` and assert
the exact line.

### WR-04: The frozen built-in status reader cannot see connection state

**Files modified:** `extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts`, `test/platform/mcp-builtin-status.test.ts`
**Commit:** e301836
**Applied fix:** The parameter is now
`Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">`.
The module comment explains why the tool list is the only connection signal.
The seed still reads nothing and answers `no-snapshot`. The strict mock in the
test has the widened type, with no expectations. `index.ts` already passes the
whole `pi`.

### WR-05: The shared-Pi reset races the exiting stubs after a replaced Pi

**Files modified:** `features/lib/mcp-implementation.ts`
**Commit:** 973af0a
**Applied fix:** A new helper, `readStubPidFile`, returns `undefined` on
ENOENT and rethrows every other error. `stubPidsIn` skips the files that
vanished. It parses and asserts the rest as before.

### IN-05: A stale `ignoreExports` entry for `features/lib/mcp-implementation.ts`

**Files modified:** `.fallowrc.json` (the docs commit updates `01-FROZEN.md` section 3)
**Commit:** 13ce40a
**Applied fix:** I removed the whole `ignoreExports` block and ran
`npx fallow dead-code`. It reported only `ActiveMcpImplementation`,
`EffectiveMcpCompatibility`, `StoredMcpCompatibility`, and
`effectiveMcpCompatibility` (in `mcp-implementation.ts`), and all seven
`recorded-servers.ts` exports. Those entries stay. I removed the rest:
`McpImplementationId`, `McpImplementationProfile`, `RecordedMcpServer`,
`RecordedMcpServers`, and `profileFor`, plus the whole entries for
`platform/pi-api.ts` and `features/lib/mcp-implementation.ts`. Both
`fallow dead-code` runs pass.

## Choices to verify

- **CR-02 boundary.** The built-in prefix is promised up to 55 characters, as
  the orchestrator decided. A 56-character namespace is also a true prefix:
  Pi keeps 55 characters, which end in the namespace's first `_`, and then
  appends `_<hash>`, which puts back the second `_`. The rule is conservative
  by one character. It never promises a false prefix, and a caller falls back
  to full names.
- **WR-01 comparison.** The decision said to compare against "the record's
  `resolvedVersion` (when the record has one)". The reader compares the
  version that install would derive with the record's `version`, through
  `isSameVersion`. When the record has a `resolvedVersion`, the derivation
  uses the release-tag form that install used. A literal comparison with
  `resolvedVersion` alone would check only tag-pinned copies, which cannot
  drift. It would miss the unpinned path source that the finding is about.
  The comparison is by version, so a path plugin that changes its MCP
  declaration without a version bump still re-resolves the new servers.
  `deriveInstallVersion` is now exported from `install-outcome.ts` for this
  reader.

## Out-of-scope findings (not attempted)

### IN-01: The tag-rule heuristics in `check-features.mjs` accept non-IDs and miss some MCP scenarios

**File:** `scripts/check-features.mjs:47-52,552-556,598`
**Reason:** skipped by orchestrator decision. No current scenario slips
through, and P1-DC-36 records the gap.
**Original issue:** `licenseId` matches `UTF-8` and similar text, and
`isMcpPickle` ignores `mcp__…` names and `mcp.json` in doc strings and tables.

### IN-02: "which did not fail" weakens deterministic setup in an `@adapter-only` feature

**File:** `features/mcp-server/configuration.feature:20,97,171`
**Reason:** skipped by orchestrator decision.
**Original issue:** The setup step accepts output with info only, so the MCP
config notice could disappear without a failure.

### IN-03: "Merge order" does not hold for integer-like server names

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:361-362`
**Reason:** skipped by orchestrator decision. The issue already existed for
`mcpServers`.
**Original issue:** `Object.fromEntries` and `Object.entries` put array-index
keys first.

### IN-04: `readBuiltinTurnedOff` counts project settings that Pi ignores for an untrusted project

**File:** `features/lib/mcp-implementation.ts:205-212`
**Reason:** skipped by orchestrator decision. No scenario reaches it today.
**Original issue:** An untrusted project's `-builtin:mcp` setting would make
the harness expect `none`.

### IN-06: The info handler's trust read cannot fail its test

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts:76`
**Reason:** skipped by orchestrator decision. P1-DC-37 records it.
**Original issue:** A constant `projectTrusted: true` would pass the handler
test.

## Verification

All checks ran in the main checkout (`/home/user/pi-claude-marketplace`) after
the last fix commit, with `npm_config_script_shell` set to the scratch
`nondac-sh` and `NODE_OPTIONS=--max-old-space-size=6144`:

| Check                                                                | Exit | Result                    |
| -------------------------------------------------------------------- | ---- | ------------------------- |
| `npm run check:static`                                               | 0    | all 7 steps passed        |
| `npm run test:unpaired`                                              | 0    | passed                    |
| `npm run test:integration`                                           | 0    | passed                    |
| `npm run test:cucumber:profile -- --profile builtin features`        | 0    | 39 scenarios, 529 steps   |
| `npm run test:cucumber:profile -- --profile adapter features/mcp-server` | 0 | 65 scenarios, 879 steps |

Each changed source-test pair passed `npm run test:coverage:direct` at 100%
before its commit, and each commit's hook ran `npm run check:commit`.
`docs/output-catalog.md` and `test/architecture/catalog-uat` did not change,
and no user-visible output changed.

---

_Fixed: 2026-11-04T10:11:51Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
