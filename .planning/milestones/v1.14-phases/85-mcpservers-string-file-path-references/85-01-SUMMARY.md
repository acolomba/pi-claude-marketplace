---
phase: 85-mcpservers-string-file-path-references
plan: 01
subsystem: api
tags: [typebox, resolver, mcp, path-safety, json-schema]

# Dependency graph
requires:
  - phase: prior resolver work
    provides: applyStrictMcp seam, applyMcpValue, readStandaloneMcp, validateComponentPath, assertPathInside
provides:
  - "Widened mcpServers field union (string | object) in PLUGIN_ENTRY_SCHEMA + PLUGIN_MANIFEST_SCHEMA"
  - "validateReferencePath helper (reject-absolute + assertPathInside containment, returns absolute path)"
  - "readReferencedMcp wrapped-only reader (requires top-level mcpServers key)"
  - "applyStrictMcp string branch resolving a ./-relative reference at inline parity"
  - "collision-proof note prefix `malformed mcp reference:`"
affects: [85-02, mcp-bridge, reason-catalog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Field-schema union widening (Type.Union([Type.String(), MCP_SERVERS_SCHEMA])) while leaving the value validator object-only"
    - "Separate wrapped-only reader (readReferencedMcp) beside the tolerant readStandaloneMcp to protect criterion-5 regression guard"
    - "Collision-proof note prefix (`malformed mcp reference:`) to avoid reclassifying the inline `malformed mcpServers` note"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/plugin.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - tests/domain/resolver-strict.test.ts
    - tests/domain/manifest.test.ts

key-decisions:
  - "D-01: reuse validateComponentPath reject-absolute + assertPathInside pattern for the reference path (semantic containment parity, no ./-prefix enforcement)"
  - "D-04: referenced file is WRAPPED-ONLY via a distinct readReferencedMcp; readStandaloneMcp unwrapped tolerance left unchanged"
  - "Note prefix `malformed mcp reference:` (not bare `malformed mcp`) to keep the inline malformed-mcpServers note classified as {unsupported source}"

patterns-established:
  - "Widen the FIELD schema union in entry/manifest schemas, never the server-map value validator"
  - "A string-reference resolution failure uses the dirty-accumulator route (push note + return true) -> per-plugin unavailable, no whole-manifest throw"

requirements-completed: [MCPR-01, MCPR-02, MCPR-03, MCPR-04]

coverage:
  - id: D1
    description: "marketplace-entry string mcpServers reference resolves + installs at byte-for-byte parity with the inline object form"
    requirement: "MCPR-01"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#MCPR-01 marketplace-entry string mcpServers reference resolves at inline parity"
        status: pass
    human_judgment: false
  - id: D2
    description: "string mcpServers is legal schema input — MARKETPLACE_VALIDATOR/PLUGIN_ENTRY/PLUGIN_MANIFEST accept it and loadMarketplaceManifest does not throw"
    requirement: "MCPR-01"
    verification:
      - kind: unit
        ref: "tests/domain/manifest.test.ts#MCPR-01 MARKETPLACE accepts an entry with a string mcpServers (no whole-manifest throw)"
        status: pass
      - kind: unit
        ref: "tests/domain/manifest.test.ts#MCPR-02 PLUGIN_MANIFEST accepts mcpServers as a string reference"
        status: pass
    human_judgment: false
  - id: D3
    description: "plugin.json string mcpServers reference resolves at parity via readManifest"
    requirement: "MCPR-02"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#MCPR-02 plugin.json string mcpServers reference resolves at parity (via readManifest)"
        status: pass
    human_judgment: false
  - id: D4
    description: "missing / malformed-JSON / wrapper-less reference degrades the one plugin to unavailable with a malformed mcp reference note; sibling loads without whole-manifest throw"
    requirement: "MCPR-03"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#MCPR-03 missing reference file / malformed-JSON / wrapper-less"
        status: pass
      - kind: unit
        ref: "tests/domain/manifest.test.ts#MCPR-03 marketplace with a broken string-ref plugin + valid sibling loads without throwing"
        status: pass
    human_judgment: false
  - id: D5
    description: "../ traversal and D-14 symlink references degrade to unavailable with a note; resolver never reads outside pluginRoot (assertPathInside before any read)"
    requirement: "MCPR-04"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#MCPR-04 ../ traversal reference / symlink reference (D-14)"
        status: pass
    human_judgment: false
  - id: D6
    description: "criterion-5 regression: undeclared unwrapped conventional .mcp.json still resolves installable; entry-over-manifest precedence holds"
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#criterion 5: undeclared unwrapped standalone .mcp.json still resolves installable"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-07-23
status: complete
---

# Phase 85 Plan 01: `mcpServers` string file-path references Summary

**Strict resolver now accepts a `./`-relative string `mcpServers` reference to a wrapped `.mcp.json` and installs it at byte-for-byte parity with the inline object form, degrading a broken reference to a single `(unavailable)` plugin without ever failing the whole marketplace load.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-23T02:20Z (approx)
- **Completed:** 2026-07-23T03:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Widened the `mcpServers` field to `Type.Union([Type.String(), MCP_SERVERS_SCHEMA])` in both `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` (shared `McpServersField` const) — the hard prerequisite so a string entry is legal input and no whole-manifest validation throw occurs. The `MCP_SERVERS_SCHEMA` / `MCP_SERVERS_VALIDATOR` server-map validator is untouched.
- Added two local resolver helpers: `validateReferencePath` (reject-absolute + `path.resolve` + `assertPathInside` containment, returning the absolute path) and the wrapped-only `readReferencedMcp` (requires a top-level `mcpServers` key), both emitting the collision-proof `malformed mcp reference:` note prefix.
- Added the `typeof declaredMcp === "string"` branch in `applyStrictMcp` before the `readStandaloneMcp` fallback: reads + unwraps the referenced map and feeds it to the unchanged `applyMcpValue` for inline parity; any failure uses the dirty-accumulator route (`push note; return true`) → per-plugin `unavailable`.
- Full test matrix: parity + schema-acceptance (Task 1), and error/containment/regression arms — missing / malformed-JSON / wrapper-less, `../` traversal (in-memory), D-14 symlink refusal (real-fs fixture), sibling isolation, criterion-5 unwrapped-standalone regression, and entry-over-manifest precedence (Task 2).

## Task Commits

1. **Task 1 (tracer): widen schemas + resolve a string reference end-to-end** - `1218ce95` (feat)
2. **Task 2: error / containment / regression test matrix** - `7c90f369` (test)
3. **Style fixup: prettier formatting on mcp-ref tests** - `bcfde3cf` (style, deviation Rule 3)

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` - `McpServersField` union const; both plugin schemas widened to accept a string OR a server map.
- `extensions/pi-claude-marketplace/domain/resolver.ts` - `validateReferencePath` + `readReferencedMcp` helpers; the string branch in `applyStrictMcp`.
- `tests/domain/resolver-strict.test.ts` - MCPR-01/02 parity, MCPR-03 error arms, MCPR-04 traversal + real-fs symlink, criterion-5 regression, precedence backstop.
- `tests/domain/manifest.test.ts` - schema-acceptance tests (MARKETPLACE/PLUGIN_ENTRY/PLUGIN_MANIFEST accept a string; load-does-not-throw; sibling isolation).

## Decisions Made
- Factored the union into a shared `McpServersField` const (one occurrence, referenced by both schemas) rather than inlining twice — cleaner and satisfies the acceptance grep.
- Kept `readReferencedMcp` a separate function (not a flag on `readStandaloneMcp`) so a future edit cannot regress the standalone unwrapped-tolerance guard (criterion 5).
- Note text uses the `malformed mcp reference:` prefix so `narrowResolverNotes` (Plan 02) can match it without colliding with the inline `malformed mcpServers` note.
- Resolver tests assert note CONTENT (`includes("malformed mcp reference")`) + `state`, NOT the narrowed `{malformed mcp}` reason token — that token is wired in Plan 02, so ordering stays safe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier formatting on new test code**
- **Found during:** Post-Task-2 `npm run check` (format:check gate)
- **Issue:** Hand-wrapped multi-line `resolveStrict(...)` calls in the new tests did not match Prettier's canonical formatting; `npm run format:check` failed. The pre-commit prettier hook's file scope did not flag them at commit time.
- **Fix:** Ran `npx prettier --write tests/domain/resolver-strict.test.ts`; verified clean with `--check`.
- **Files modified:** tests/domain/resolver-strict.test.ts
- **Verification:** `npx prettier --check` clean; full `npm run check` format:check step passes.
- **Committed in:** `bcfde3cf`

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Cosmetic-only; no behavior change, no scope creep.

## Issues Encountered
- **Pre-existing integration-test failures (out of scope).** `npm run test:integration` reports 2 failures — `T-d8i-01` (`tests/integration/provenance-invisibility.test.ts`) and `SC-2 / AGSK-06` (`tests/integration/skill-path-resolution.test.ts`). Both fail identically on the base commit `2aa29a15` (before any Phase 85 work), confirming they are pre-existing and environmental (pi-subagents companion-extension integration), unrelated to the resolver/schema changes. Logged to `deferred-items.md`. The unit suite (2999/2999), typecheck, lint, and format:check are all green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can now wire the `{malformed mcp}` closed-set reason token: the `malformed mcp reference:` note prefix is emitted by both helpers and is ready for the `narrowResolverNotes` branch (matched via `startsWith("malformed mcp reference")`), the `REASONS`/`FAILURE_REASONS` catalog additions, and the length-tripwire bump (34 → 35).
- No blockers introduced. The 2 pre-existing integration failures are unrelated and tracked in `deferred-items.md`.

## Self-Check: PASSED

All modified files present; all task commits (`1218ce95`, `7c90f369`, `bcfde3cf`) confirmed in git history.

---
*Phase: 85-mcpservers-string-file-path-references*
*Completed: 2026-07-23*
