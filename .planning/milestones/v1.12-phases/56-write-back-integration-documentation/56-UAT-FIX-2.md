---
phase: 56
fixed_at: 2026-06-12T02:00:00Z
review_path: v1.12 milestone runtime UAT (operator-confirmed UAT-05)
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 56: UAT Fix Report (iteration 2)

**Fixed at:** 2026-06-12T02:00:00Z
**Source review:** v1.12 milestone runtime UAT, finding UAT-05
**Iteration:** 1

**Summary:**

-   Findings in scope: 1
-   Fixed: 1
-   Skipped: 0

## Fixed Issues

### UAT-05: `--local` plugin install redundantly declares an already-declared marketplace in the local file, shadowing base settings

**Files modified:**

-   `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`
-   `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
-   `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
-   `tests/orchestrators/plugin/install.test.ts`
-   `tests/orchestrators/plugin/enable-disable.test.ts`

**Commit:** `2a1195e` — `fix(56): UAT-05 skip redundant marketplace declaration in write-back target`

**Applied fix:**

Root cause confirmed as diagnosed: the Phase 56 CR-02 adopted-marketplace
declaration (`synthesizeUndeclaredMarketplaceSource`) gated membership on the
TARGETED config file only (`current.marketplaces?.[marketplace]`). A `--local`
install against a base-declared marketplace therefore re-declared it in
`claude-plugins.local.json` as a bare `{source}` entry; the CFG-02 wholesale
entry-level override then shadowed the base entry and silently flipped merged
`autoupdate` from `true` to `false`. The same defect existed at BOTH
enable-disable call sites (the WR-03 config-promotion arm and the fresh-flip
arm), which received the same CR-02 treatment.

Changes:

1.  `synthesizeUndeclaredMarketplaceSource` now takes the scope's physical
    configs (`readonly ScopeConfig[]`) and returns `undefined` when ANY of
    them declares the marketplace — i.e. the membership gate runs against the
    merged view (base ∪ local), per the CFG-02 entry-level merge semantics.
2.  New shared helper `selectConfigWriteTarget(locations, local)` selects the
    targeted file AND its sibling (base when `--local`, local otherwise) in
    one seam (also resolves a sonarjs cognitive-complexity ceiling the inline
    ternaries would have tripped).
3.  New shared helper `synthesizeAdoptedMarketplaceSource` reads the sibling
    file FRESH inside the caller-held scope lock (WB-01 discipline) and runs
    the merged-view membership gate. The sibling load is membership-test-only
    input — never serialized back (Pitfall 1: no merged-view write-back).
4.  `install.ts` and `enable-disable.ts` (both call sites) route through the
    new helpers. The plugin entry still goes to the targeted file (base or
    local) exactly as before; the CR-02 nowhere-declared case still declares
    the marketplace into the SAME targeted file so reconcile stays convergent.

**Regression tests added (all required by UAT-05):**

1.  `UAT-05: --local install with marketplace declared in BASE writes ONLY the
    plugin entry to local; merged autoupdate from base survives`
    (`tests/orchestrators/plugin/install.test.ts`) — asserts local gains only
    the plugin entry, no marketplace re-declaration, and
    `mergeScopeConfigs(base, local)` keeps `autoupdate: true`.
2.  `UAT-05 / CR-02: --local install with marketplace declared NOWHERE
    declares it in the SAME local file; reconcile stays convergent`
    (`install.test.ts`) — asserts the declaration lands in local with the
    state record's verbatim `source.raw`, base stays absent, and
    `planReconcile(merged, state)` deep-equals the empty plan.
3.  `UAT-05: base-targeted install with marketplace already in base leaves
    the marketplace entry unchanged (entry-level no-op)` (`install.test.ts`)
    — asserts the pre-existing marketplace entry deep-equals its seeded form
    (`{source, autoupdate: true}`) after the install.
4.  `UAT-05: --local enable flip with marketplace declared in BASE writes
    ONLY the plugin entry to local; merged autoupdate from base survives`
    (`tests/orchestrators/plugin/enable-disable.test.ts`) — covers the WR-03
    promotion arm of the enable path.

**Verification:**

-   `npm run check` GREEN: 1810 unit tests (baseline 1806 + 4 new) +
    10 integration tests, typecheck + ESLint + Prettier all pass (exit 0).
-   CR-02 architecture/consistency suite
    (`tests/architecture/config-state-consistency.test.ts`) re-run and passes
    unchanged, including the cross-scope CMP-3 install reconcile-no-op test.
-   `pre-commit run --files <changed>` passes (TruffleHog skipped on the
    worktree commit per the documented sandbox limitation; separate
    `pre-commit run trufflehog --all-files` from the main repo passes
    post-merge).

## Skipped Issues

None.

---

_Fixed: 2026-06-12T02:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
