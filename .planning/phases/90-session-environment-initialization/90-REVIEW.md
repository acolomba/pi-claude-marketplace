---
phase: 90-session-environment-initialization
reviewed: 2026-08-04T02:10:21Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/domain/resolver-loose.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/shared/index-smoke.test.ts
  - tests/shared/plugin-path.test.ts
  - tests/shared/probe-classifiers.test.ts
  - tests/shared/session-env.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 90: Code Review Report

**Reviewed:** 2026-08-04T02:10:21Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Adversarial re-review of the phase-90 scope, weighted toward the 90-02 gap-closure
diff (commits 46892fd2, 26551d8e, 8e9b9850, 5654e485). Two changes landed:

- D-90-06: `bin` was removed from `UNSUPPORTED_COMPONENT_KINDS` (and its convention
  probe) so a bin-shipping plugin resolves `installable` and its `<pluginRoot>/bin`
  is honored at runtime via the PENV-01 PATH ledger.
- D-90-05: a new closed-set reason token `unsupported component` was appended to
  `REASONS` (now 38), registered in `UNSUPPORTED_REASONS`, and made the per-kind
  fallback of `kindToReason`.

The closed-set plumbing is internally consistent: the `REASONS` tuple length (38)
matches the lock, the `_ReasonsCoverageProof` partition stays total (the token is
homed in `UNSUPPORTED_REASONS`), the catalog fenced blocks byte-match their
`catalog-uat.test.ts` fixtures for the two touched examples, and the PENV-01
PATH-ledger core (`applyPathLedger`) plus the `applySessionEnv` primitive are pure,
well-tested, and NFR-2-boundary-wrapped at their `index.ts` call sites.

The one substantive defect is a cross-surface reason divergence (SURF-01 violation)
that D-90-05 introduced but did not test for: the kind-axis classifier and the
install-side note classifier were retargeted to `unsupported component`, but the
shared note-axis classifier `narrowResolverNotes` was left emitting `unsupported
source` for the same `contains <kind>` note. The two disagree on the structural
`unavailable` arm.

## Warnings

### WR-01: `unsupported component` breaks cross-surface (SURF-01) parity on the `unavailable` arm

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:130-155` (`classifyResolverNote`) vs `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:2284-2287` (`narrowResolverReasons`)

**Issue:**
D-90-05 retargeted the per-kind axis (`kindToReason` -> `unsupported component`) and,
because `install.ts::narrowResolverReasons` routes a `contains <kind>` note through
`narrowUnsupportedKinds`, the install failure surface now emits `unsupported
component` for a note like `contains monitors`. But the shared note-axis classifier
`narrowResolverNotes` / `classifyResolverNote` was NOT updated — a `contains
<non-carve-out-kind>` note still falls through its catch-all to `unsupported source`.

These two classifiers diverge for a plugin that is BOTH structurally broken AND
declares a non-carve-out unsupported kind (e.g. a malformed `.mcp.json` plus a
top-level `monitors` field). `addUnsupportedKindNotes` unconditionally pushes
`contains monitors` into `partial.notes`, and structural precedence (D-64-07) routes
the plugin to the `unavailable` arm, whose notes are `[<structural note>, "contains
monitors"]`. Then:

- `list`/`info` (`orchestrators/plugin/list.ts:654`, `sharedNarrowResolverNotes(resolved.notes)`)
  render `{... unsupported source}`.
- The install failure surface (`install.ts:2142` -> `narrowResolverReasons(err.shape.reasons, [])`)
  renders `{... unsupported component}` for the SAME plugin.

This is exactly the same-plugin-same-reason invariant (SURF-01) that
`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` exists to guard, and
the catalog design note (`docs/output-catalog.md:1489`) explicitly states the
structural arm sources reasons via `narrowResolverNotes` limited to `{unsupported
source}` / `{malformed mcp}`. The divergence is untested: the note-parity
`PARITY_CASES` block only pins `contains lspServers` and a generic
`some other unsupported source detail`; there is no `contains monitors`/`contains
themes` case, so the drift slips through green.

Reachability is narrow (requires a both-defects plugin), which is why this is a
WARNING rather than a BLOCKER, but it violates a documented, test-enforced contract.

**Fix:** Decide the single truthful axis for a `contains <kind>` note and make both
classifiers agree. Two options:

1. If a `contains <kind>` note should read `unsupported component` everywhere, add a
   `contains <kind>` arm to `classifyResolverNote` that delegates to the same
   per-kind mapping (mirroring the install path), before the catch-all:
   ```ts
   if (note.startsWith("contains ")) {
     return kindToReason(note.slice("contains ".length));
   }
   ```
   (`ResolverNoteReason` already admits `unsupported component` via `UnsupportedReason`.)
2. If the structural `unavailable` arm should keep the source-axis token, stop the
   install-side note handler from routing `contains <kind>` through
   `narrowUnsupportedKinds` when the throw came from the `unavailable` arm.

Then add the missing `contains monitors` / multi-kind cases to
`cross-surface-reason-parity.test.ts::PARITY_CASES` so the note-axis vs install-axis
agreement is pinned, not just the kind-axis vs install-axis agreement.

## Info

### IN-01: `applyPathLedger` silently strips empty PATH segments

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:90-96`

**Issue:** `split()` filters `entry.length > 0`, so any empty PATH segment (a leading
`:`, trailing `:`, or `::` — POSIX implicit-current-directory) is dropped from the
reconstructed PATH. `recomputePluginPath` is documented as only appending fresh bin
dirs and removing prior-owned entries, but it also normalizes-away empty segments on
every recompute. In practice this is benign (an empty PATH segment is itself a
CWE-426 hazard, so removing it is arguably a hardening), but the mutation is broader
than the stated "never touch a non-owned entry" contract in the same comment block.

**Fix:** Either preserve empty segments through the round-trip (only strip when
building the `owned` / `seen` sets, not when rebuilding `base`), or document that
empty implicit-cwd PATH segments are intentionally dropped as a hardening side effect.

### IN-02: PATH-ledger round-trip is not robust to a `path.delimiter` inside a bin dir

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:85-111`

**Issue:** The ledger is stored as a single delimiter-joined string in
`PI_CLAUDE_MARKETPLACE_PATH`. If a plugin's resolved root ever contains the platform
`path.delimiter` (`:` is a legal POSIX filename character), the join/split round-trip
mis-parses the ledger, so the stale entry cannot be matched-and-removed on the next
recompute and would leak. `asAbsolutePluginRoot` (the WR-01 guard in
`collectBinDirs`) rejects empty/relative/traversal roots but does not reject an
embedded delimiter. This mirrors an inherent PATH limitation and is very unlikely in
practice, hence INFO only.

**Fix:** If defensiveness is wanted, drop any bin dir containing `path.delimiter` in
`collectBinDirs` (same drop-and-skip pattern as the existing WR-01 guard), so a
delimiter-bearing root can never enter the ledger.

---

_Reviewed: 2026-08-04T02:10:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
