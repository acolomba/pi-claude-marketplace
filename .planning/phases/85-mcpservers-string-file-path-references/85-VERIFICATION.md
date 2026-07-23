---
phase: 85-mcpservers-string-file-path-references
verified: 2026-07-23T00:30:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 85: `mcpServers` string file-path references Verification Report

**Phase Goal:** A Claude plugin that declares `mcpServers` as a `./`-relative string path — from a `marketplace.json` entry or a `plugin.json` — resolves and installs the MCP servers declared in the referenced wrapped `.mcp.json`, at full parity with the inline-object form. Resolution happens in `domain/resolver.ts` (`applyStrictMcp`, before `applyMcpValue`), reusing `assertPathInside` for containment, so a broken reference degrades a single plugin to `(unavailable)` instead of failing the whole marketplace read.

**Verified:** 2026-07-23
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MCPR-01: marketplace-entry string `mcpServers` loads (no whole-manifest throw) and installs at inline parity | ✓ VERIFIED | `plugin.ts` widens `PLUGIN_ENTRY_SCHEMA.mcpServers` to `Type.Union([Type.String(), MCP_SERVERS_SCHEMA])` (`McpServersField`, plugin.ts:44-73). `resolver-strict.test.ts:581` asserts `assert.deepEqual(referenced.mcpServers, inline.mcpServers)` — byte-for-byte parity. `manifest.test.ts:211` asserts `MARKETPLACE_VALIDATOR.Check(...)` passes for a string-entry manifest and `loadMarketplaceManifest` does not throw. Test run: pass. |
| 2 | MCPR-02: plugin.json string `mcpServers` accepted by `PLUGIN_MANIFEST_VALIDATOR`/`readManifest`, installs at parity | ✓ VERIFIED | `plugin.ts` widens `PLUGIN_MANIFEST_SCHEMA.mcpServers` identically. `resolver.ts:583` (`readManifest`) calls the real `PLUGIN_MANIFEST_VALIDATOR.Check(parsed)` — not bypassed. `manifest.test.ts:312` asserts `PLUGIN_MANIFEST_VALIDATOR.Check({ mcpServers: "./x.mcp.json" })===true`. `resolver-strict.test.ts:607` drives the full `readManifest` → `resolveStrict` path and asserts parity. Test run: pass. |
| 3 | MCPR-03: missing/malformed-JSON/wrapper-less reference → `(unavailable)` + note; siblings still resolve; `{malformed mcp}` surfaces on ALL surfaces (list/info AND install) | ✓ VERIFIED | `readReferencedMcp` (resolver.ts:970-1008) covers all three sub-causes, each emitting a `malformed mcp reference:`-prefixed note; `applyStrictMcp` (resolver.ts:1221-1229) pushes the note and returns `true` (dirty→unavailable), never a whole-manifest throw. `manifest.test.ts:240` (sibling isolation) confirms a broken-ref plugin + valid sibling both load without throwing. **CR-01 cross-surface gap (found by 85-REVIEW.md) is fixed**: commit `2ef1569e` added the mirror arm to `install.ts::narrowResolverReasons` (install.ts:2219-2222, ordered before the `Unexpected token`/`includes("source")` arms) and a locking case in `cross-surface-reason-parity.test.ts:46-53`. Inline `malformed mcpServers` still narrows to `{unsupported source}` on both classifiers (collision guard, `probe-classifiers.test.ts`). Test run: pass (139/139 across the 5 affected test files). |
| 4 | MCPR-04: `../` traversal AND symlink (D-14) → `(unavailable)`; resolver never reads outside `pluginRoot` | ✓ VERIFIED | `validateReferencePath` (resolver.ts:936-960) runs `path.isAbsolute` reject + `assertPathInside` BEFORE any `statKindOf`/`readFileTextOf` call — containment holds by construction. `resolver-strict.test.ts:664` (`../` escape, in-memory, unregistered target proves no read), `:684` (real-fs `mkdtemp`+`symlink()` fixture, D-14 refusal), `:714` (absolute-path reject, added by follow-up commit `1e8b54bb` closing REVIEW IN-01). Test run: pass. |
| 5 | Criterion 5 (regression): undeclared unwrapped standalone `<pluginRoot>/.mcp.json` still resolves installable | ✓ VERIFIED | `readStandaloneMcp` (resolver.ts:905-924) is byte-unchanged (still `"mcpServers" in parsed ? parsed.mcpServers : parsed`), called only from the `declaredMcp === undefined` branch, never touched by the new string branch. `resolver-strict.test.ts:757` explicitly asserts an unwrapped bare-map `.mcp.json` resolves `installable`. Test run: pass. |
| 6 | Closed reason set grew by exactly one: `REASONS.length === 35` | ✓ VERIFIED | `notify.ts` REASONS tuple counted programmatically: 35 entries (verified via `awk`+`grep -c`). `"malformed mcp"` filed in `FAILURE_REASONS` (notify-reasons.ts:115), NOT in `UNSUPPORTED_REASONS` (confirmed by reading both tuples). `notify-closed-set-locks.test.ts:33` asserts `REASONS.length===35`. WR-01 arm-ordering bug found by review (an `lspServers` substring in a broken-reference path misclassifying as `{lsp}`) fixed by commit `ddacb8a2`, locked by regression tests in both `probe-classifiers.test.ts` and (implicitly, no lspServers substring path in that classifier) `install.ts::narrowResolverReasons`. Test run: pass. |
| 7 | `npm run check` green except the 2 documented pre-existing pi-subagents integration failures | ✓ VERIFIED | Ran `npm run check` (typecheck → lint → format:check → full unit suite → integration) live in this verification session. Chain reached `test:integration` (proving typecheck/lint/format/unit-suite all exited 0), and `test:integration` reported exactly `T-d8i-01` (`provenance-invisibility.test.ts`) and `SC-2 / AGSK-06` (`skill-path-resolution.test.ts`) as failing — 16 pass / 2 fail, matching `deferred-items.md` verbatim (same two tests, same names). No other regression. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/components/plugin.ts` | Widened `mcpServers` field union in both schemas | ✓ VERIFIED | `McpServersField` const, used in both `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA`; `git diff` on `domain/components/mcp.ts` (the server-map validator) is empty — confirmed untouched. |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `validateReferencePath` + `readReferencedMcp` + string branch in `applyStrictMcp`; WR-03 I/O-error fix | ✓ VERIFIED | All three present and wired (resolver.ts:936-1008, 1221-1229). WR-03 fix (`5b119d88`) moved the file read outside the `try` so I/O errors (EACCES/EPERM) propagate instead of being mislabeled as invalid JSON. `applyLooseMcp` intentionally left unhandled (D-03/WR-02, documented in a resolver.ts comment, `0be1b237`). |
| `extensions/pi-claude-marketplace/shared/notify.ts` | `"malformed mcp"` appended to REASONS | ✓ VERIFIED | Present, 35-entry tuple. |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | `"malformed mcp"` in FAILURE_REASONS | ✓ VERIFIED | Present, correctly NOT in UNSUPPORTED_REASONS. |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | `classifyResolverNote`/`narrowResolverNotes` arm, ordered before the `lspServers` substring check | ✓ VERIFIED | Ordered correctly (WR-01 fix `ddacb8a2`; `malformed mcp reference` arm precedes `note.includes("lspServers")`). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | Mirror arm in `narrowResolverReasons` | ✓ VERIFIED | CR-01 fix `2ef1569e`; arm present at install.ts:2219, correctly ordered before `Unexpected token`/`includes("source")`. |
| `docs/output-catalog.md` | `{malformed mcp}` documented | ✓ VERIFIED | 2 occurrences: reason-vocabulary/`(unavailable)`-row mention (L140) and the info-surface unavailable recipe (L1489). |
| `tests/domain/resolver-strict.test.ts`, `tests/domain/manifest.test.ts`, `tests/architecture/notify-closed-set-locks.test.ts`, `tests/shared/probe-classifiers.test.ts`, `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | Full MCPR-01..04 + closed-set + cross-surface test matrix | ✓ VERIFIED | Live run: 139/139 pass across these 5 files. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `PLUGIN_ENTRY_SCHEMA`/`PLUGIN_MANIFEST_SCHEMA` widened field | `MARKETPLACE_VALIDATOR`/`PLUGIN_MANIFEST_VALIDATOR` | schema `Check()` | ✓ WIRED | `readManifest` (resolver.ts:583) calls the real compiled validator; `manifest.test.ts` drives `MARKETPLACE_VALIDATOR.Check` directly — both confirmed to accept a string `mcpServers`, no whole-manifest throw. |
| `applyStrictMcp` string branch | `readReferencedMcp` → `applyMcpValue` | direct call | ✓ WIRED | resolver.ts:1221-1228; the unwrapped map flows into the SAME `applyMcpValue`/`MCP_SERVERS_VALIDATOR` path as the inline-object form, giving parity by construction (not by a separate re-implementation). |
| `validateReferencePath` | `assertPathInside` | `await assertPathInside(pluginRoot, candidate, ...)` before any `statKindOf`/`readFileTextOf` call | ✓ WIRED | Order confirmed by reading resolver.ts:936-991 top to bottom — no read precedes the containment check. |
| resolver `notes[]` (`malformed mcp reference:` prefix) | `{malformed mcp}` token | `shared/probe-classifiers.ts::classifyResolverNote` (list/info/fetch surfaces) AND `orchestrators/plugin/install.ts::narrowResolverReasons` (install surface) | ✓ WIRED (both surfaces) | Both classifiers independently confirmed to have the matching arm, correctly ordered ahead of looser/competing arms (`lspServers` substring on the probe side; `Unexpected token`/`includes("source")` on the install side). Locked by `cross-surface-reason-parity.test.ts`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MCPR-01 | 85-01 | marketplace-entry string ref, inline parity, no whole-manifest throw | ✓ SATISFIED | Truths 1; artifact/key-link tables above. |
| MCPR-02 | 85-01 | plugin.json string ref, inline parity via readManifest | ✓ SATISFIED | Truths 2. |
| MCPR-03 | 85-01, 85-02 | missing/malformed/wrapper-less → unavailable, sibling isolation, `{malformed mcp}` token cross-surface | ✓ SATISFIED | Truths 3; CR-01 cross-surface gap found by 85-REVIEW.md and closed by follow-up commit before this verification. |
| MCPR-04 | 85-01 | `../` traversal + symlink → unavailable, no out-of-root read | ✓ SATISFIED | Truths 4. |

REQUIREMENTS.md traceability table (all four rows marked "Complete") matches the phase's own declared scope exactly — no orphaned or unmapped requirement IDs for Phase 85.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the phase's modified source files. `git diff` scoped to the phase's true base commit (`2aa29a15`, confirmed as the pre-phase-85 HEAD per both SUMMARYs) touches exactly the 19 files declared across the two plans — no scope creep, no unrelated file changes.

### Code Review Follow-Through

`85-REVIEW.md` (dated 2026-07-22, `status: issues_found`) flagged 1 critical + 3 warnings + 1 info finding. All are resolved in the current HEAD, each traceable to a distinct follow-up commit:

| Finding | Resolution | Commit |
|---------|-----------|--------|
| CR-01 (critical): `{malformed mcp}` never emitted on install surface (SURF-01 parity break) | Mirror arm added to `install.ts::narrowResolverReasons`; locked with a cross-surface parity test case | `2ef1569e` |
| WR-01: `lspServers` substring arm pre-empted the `malformed mcp reference` prefix arm | Arm order swapped in `probe-classifiers.ts::classifyResolverNote`; regression test added | `ddacb8a2` |
| WR-02: `applyLooseMcp` doesn't handle string refs (asymmetric with strict mode) | Deliberately left unhandled (loose mode has no wired production caller, D-03); intent documented inline | `0be1b237` |
| WR-03: `readReferencedMcp` mislabeled I/O errors (EACCES/EPERM) as invalid JSON | Read moved outside the `try`; only `JSON.parse`/wrapper-shape stays inside | `5b119d88` |
| IN-01: untested absolute-path reject + inner-malformed-map edges | Two tests added | `1e8b54bb` |

### Human Verification Required

None. This is a backend-only resolver/schema/reason-catalog change with no UI or runtime-visual surface; every truth is exercised by an automated test (including a real-filesystem `mkdtemp`+`symlink()` fixture for the D-14 case), and the full `npm run check` was executed live during this verification (not just re-quoted from SUMMARY.md).

### Gaps Summary

None. All 4 requirement IDs (MCPR-01..04) are satisfied with codebase evidence independently re-verified (not merely SUMMARY claims): schema widening confirmed by direct file read, resolver wiring confirmed by direct file read, both closed-set reason classifiers confirmed correctly ordered and cross-surface-consistent, and the full test suite (139 targeted tests + a live full `npm run check` run) passed with exactly the two pre-documented pre-existing integration failures and nothing else.

---

_Verified: 2026-07-23_
_Verifier: Claude (gsd-verifier)_
