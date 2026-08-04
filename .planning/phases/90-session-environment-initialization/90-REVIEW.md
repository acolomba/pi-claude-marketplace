---
phase: 90-session-environment-initialization
reviewed: 2026-08-04T04:55:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
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
  info: 1
  total: 2
status: issues_found
---

# Phase 90: Code Review Report

**Reviewed:** 2026-08-04T04:55:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Fresh adversarial re-review of the full phase-90 scope after the SURF-01
gap-closure (plan 90-03, commits 333f30e6 / 8085c6d7). The phase delivers:
session-env injection (SENV-01..03), the plugin bin PATH ledger (PENV-01), the
`bin` install-by-default reclassification (D-90-06), the `unsupported component`
reason token (D-90-05), and the arm-aware classifier fix (WR-01 / SURF-01).

**WR-01 (SURF-01 cross-surface reason divergence) is verified resolved.** The
prior open finding is closed by an arm-aware `narrowResolverReasons`:

- `install.ts::narrowResolverReasons` now takes a `partialable` discriminant
  (default `false`) and routes a non-carve-out `contains <kind>` note through
  the component axis (`narrowUnsupportedKinds` -> `unsupported component`)
  ONLY on the partially-available arm; on the structural `unavailable` arm it
  stays on the source axis (`unsupported source`), mirroring
  `narrowResolverNotes`'s catch-all (install.ts:2303-2311).
- The throw sites thread the discriminant truthfully: `requireInstallable`
  stamps `partialable: r.state === "partially-available"` and
  `unsupportedKinds: r.state === "partially-available" ? r.unsupported : []`
  (resolver.ts:1494-1500); `requirePartialInstallable` only ever throws for
  `unavailable`, so it stamps `partialable: false` (resolver.ts:1532).
- The read surfaces agree by construction: list's `partially-available` arm
  sources reasons solely from `narrowUnsupportedKinds(resolved.unsupported)`
  (list.ts:641) and never re-classifies `resolved.notes`, while its
  `unavailable` arm uses `sharedNarrowResolverNotes(resolved.notes)`
  (list.ts:654). I traced both arms against the install path and found no
  reason-set divergence (the only non-structural notes reaching the
  partially-available arm are `contains <kind>` -- matched by the typed kinds --
  and the unclassified `declares dependencies...` note, which pushes nothing).
- `shared/probe-classifiers.ts` is correctly left untouched, and the
  `cross-surface-reason-parity.test.ts` gap the prior review flagged is now
  closed: `PARITY_CASES` pins `contains monitors -> unsupported source`
  (line 47) and a dedicated both-defects structural test pins byte-identical
  `["malformed mcp", "unsupported source"]` across the note and install
  surfaces (lines 87-98).

The rest of the closed-set plumbing is internally consistent: `REASONS` length
is 38 and the lock test asserts 38 (notify-closed-set-locks.test.ts:37),
`unsupported component` is homed in `UNSUPPORTED_REASONS` so the
`_ReasonsCoverageProof` partition stays total, D-90-06 removes `bin` from
`UNSUPPORTED_COMPONENT_KINDS` (and it is absent from its convention map), and the
catalog documents the new token on the partially-available/partially-upgradable
rows (output-catalog.md:139, 398, 1489).

The SENV primitives (`applySessionEnv`) assign exactly three keys and are
non-interfering; both `session_start` and `resources_discover` call sites are
NFR-2-boundary-wrapped in `index.ts`. The one remaining substantive issue is a
PATH-normalization side effect in `applyPathLedger` that reaches non-owned PATH
content, contrary to that function's own stated contract.

## Warnings

### WR-01: `applyPathLedger` strips empty PATH segments from non-owned content on every load

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:90-96`

**Issue:**
The pure ledger core documents a tight contract in the same comment block --
"Remove exactly the prior-ledger entries from PATH (never touch a non-owned
entry)". But its `split` helper filters `entry.length > 0`, so every empty PATH
segment (a leading `:`, trailing `:`, or `::` -- the POSIX implicit-current-
directory form) is dropped when `base` is rebuilt, then never restored:

```ts
const split = (value: string): string[] =>
  value.split(path.delimiter).filter((entry) => entry.length > 0);
...
const base = split(currentPath).filter((entry) => !owned.has(entry));
...
return { path: [...base, ...appended].join(path.delimiter), ... };
```

Two properties make this broader than the PENV-01 feature intends:

1. It touches content the ledger does not own. An empty segment is neither a
   prior-ledger entry nor a fresh bin dir, yet it is silently removed from the
   live `process.env.PATH` that every bash child in the Pi session inherits.
2. It fires unconditionally, even in the zero-plugin case. `recomputePluginPath`
   runs on every `resources_discover` (index.ts:104). With no enabled plugins,
   `freshBinDirs` is empty and `priorLedger` is empty, so `applyPathLedger`
   still rewrites PATH to the empty-segment-stripped form. A user with this
   extension loaded but no plugins installed has their session PATH normalized
   as a side effect.

Reachability is narrow (empty PATH segments are uncommon and are themselves a
CWE-426 hazard, so dropping them is arguably a hardening), which is why this is a
WARNING rather than a BLOCKER. But it is a provable deviation from the
function's documented invariant with a real, if rare, user-visible effect
(losing an implicit-cwd PATH entry the operator deliberately configured), and it
is currently neither documented nor tested as intended behavior.

**Fix:** Either preserve empty segments through the round-trip -- strip them only
when building the `owned` / `seen` membership sets, not when rebuilding `base` --
or make the drop an explicit, documented, tested hardening:

```ts
// Preserve non-owned segments verbatim (including empty ones); only the
// membership sets need the length filter to avoid an empty-string key.
const toKeys = (value: string): string[] =>
  value.split(path.delimiter).filter((e) => e.length > 0);
const owned = new Set(toKeys(priorLedger));
const base = currentPath.split(path.delimiter).filter((e) => !owned.has(e));
```

If the drop is intentional, state it in the JSDoc contract ("empty implicit-cwd
PATH segments are intentionally normalized away as a CWE-426 hardening") and add
a `plugin-path.test.ts` case pinning it, so the contract and the code agree.

## Info

### IN-01: PATH-ledger round-trip is not robust to a `path.delimiter` inside a bin dir

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:85-111` (with
`orchestrators/plugin-path.ts::collectBinDirs`)

**Issue:** The ledger is stored as a single delimiter-joined string in
`PI_CLAUDE_MARKETPLACE_PATH`. If a plugin's resolved root ever contains the
platform `path.delimiter` (`:` is a legal POSIX filename character), the
join/split round-trip mis-parses the ledger, so the stale entry cannot be
matched-and-removed on the next recompute and would leak on the plugin's
removal. `collectBinDirs`'s `asAbsolutePluginRoot` guard rejects empty /
relative / null-byte / traversal roots but does NOT reject an embedded
delimiter, so such a root can still enter the ledger. This mirrors an inherent
PATH limitation and is very unlikely in practice, hence INFO only.

**Fix:** If defensiveness is wanted, drop any bin dir containing `path.delimiter`
in `collectBinDirs` (same drop-and-skip pattern as the existing absolute-root
guard), so a delimiter-bearing root can never enter the ledger.

---

_Reviewed: 2026-08-04T04:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
