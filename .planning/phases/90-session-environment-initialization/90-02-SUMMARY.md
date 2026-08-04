---
phase: 90-session-environment-initialization
plan: "02"
subsystem: resolver-classification-and-reason-vocabulary
tags: [gap-closure, resolver, reason-token, bin, penv-01, surf-01, env-parity]
requires:
  - "domain/resolver.ts UNSUPPORTED_COMPONENT_KINDS + decideResolution"
  - "shared/probe-classifiers.ts narrowUnsupportedKinds + kindToReason (the SURF-01 seam)"
  - "shared/notify.ts REASONS closed set + shared/notify-reasons.ts _ReasonsCoverageProof"
  - "orchestrators/plugin-path.ts PENV-01 PATH ledger (90-01) that honors <pluginRoot>/bin at runtime"
provides:
  - "bin resolves installable (installs by default at Claude Code 2.1.212 parity) -- D-90-06"
  - "unsupported component REASONS member for a dropped non-carve-out component kind -- D-90-05"
  - "SURF-01 byte-identical {unsupported component} across install/list/info via the single kindToReason seam"
affects:
  - "list / info / install-failure / update surfaces (per-kind reason rendering)"
  - "docs/output-catalog.md + docs/prd component-support prose"
tech-stack:
  added: []
  patterns:
    - "single shared per-kind classifier seam (narrowUnsupportedKinds/kindToReason) fixes all three surfaces byte-identically"
    - "closed-set REASONS pure-insertion (adjacent to unsupported source) keeps catalog byte-stability"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - docs/prd/pi-claude-marketplace-prd.md
    - tests/domain/resolver-strict.test.ts
    - tests/domain/resolver-loose.test.ts
    - tests/shared/probe-classifiers.test.ts
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/update.test.ts
decisions:
  - "D-90-06: bin reclassified out of UNSUPPORTED_COMPONENT_KINDS -> a bin-shipping plugin resolves installable and installs by default; its PATH is runtime-honored via the PENV-01 ledger, so bin is NOT added to SUPPORTED_COMPONENT_KINDS (no staged component-path semantics)."
  - "D-90-05: the non-carve-out unsupported component kinds render the new closed-set token unsupported component (was the generic unsupported source fallback); the source/note axis and the lsp / unsupported hooks carve-outs are untouched."
metrics:
  duration: ~45m
  completed: 2026-08-03
status: complete
actuals:
  tokens: 8023
  tasks: 3
  commits: 3
---

# Phase 90 Plan 02: Gap closure G-90-3 (bin classification + reason token) Summary

Closes the sole Phase 90 UAT gap (G-90-3): a plugin shipping a `bin/`
directory now resolves `installable` and installs by default (Claude Code
2.1.212 parity -- its `bin/` was already PATH-honored at runtime by the
PENV-01 ledger shipped in 90-01), and a dropped non-carve-out component kind
now renders the truthful `{unsupported component}` reason instead of
mislabeling the failure axis as `{unsupported source}`.

## What Was Built

### Task 1 -- Reclassify bin as install-by-default (D-90-06) -- commit `46892fd2`

- `domain/resolver.ts`: removed `"bin"` from `UNSUPPORTED_COMPONENT_KINDS`
  and deleted its `bin/`-dir convention probe from
  `UNSUPPORTED_COMPONENT_CONVENTIONS`. Updated the T-02-25 closed-list
  SECURITY comment to record that `bin` is intentionally runtime-honored via
  the PENV-01 PATH ledger (not a dropped kind, and not added to
  `SUPPORTED_COMPONENT_KINDS` -- it carries no staged component-path
  semantics). A bin-only plugin now flows through `decideResolution`'s empty
  `partial.unsupported` -> `installable` arm.
- `tests/domain/resolver-strict.test.ts` / `resolver-loose.test.ts`:
  RED-first -- added strict+loose bin-installable assertions (bin/ dir on
  disk, and an entry-declared `bin` field, resolve `installable` with no
  `contains bin` note), then pruned the `bin` row from both `PR-4` convention
  tables. Regression guard: `monitors`/`themes`/`outputStyles`/`settings`/
  `lspServers` rows still resolve `partially-available`.

### Task 2 -- Add the `unsupported component` reason token (D-90-05, SURF-01 lockstep) -- commit `26551d8e`

- `shared/notify.ts`: inserted `"unsupported component"` into `REASONS`
  immediately after `"unsupported source"` (pure insertion; no existing
  member reordered), anchored with a D-90-05 comment distinguishing it from
  the source/note axis and the carve-outs.
- `shared/notify-reasons.ts`: added the member to `UNSUPPORTED_REASONS` so
  `_ReasonsCoverageProof` stays total (typecheck-enforced).
- `shared/probe-classifiers.ts`: widened the local `UnsupportedReason` alias
  and retargeted `kindToReason`'s final fallback from `unsupported source` to
  `unsupported component`; rewrote the TD-3 + `narrowUnsupportedKinds` doc
  comments truthfully. `classifyResolverNote`'s `unsupported source` fallback
  (the NOTE/source axis) is untouched. `install.ts::narrowResolverReasons`
  needed no edit -- it routes `contains <kind>` notes through the shared
  `narrowUnsupportedKinds` seam and inherits the fix (its own `includes(
  "source")` arm and empty-input default correctly stay `unsupported source`).
- `tests/architecture/notify-closed-set-locks.test.ts`: bumped the length
  lock 37 -> 38 with a D-90-05 rationale.
- Flipped the per-kind expectations (probe-classifiers, cross-surface parity)
  to `unsupported component` while leaving every NOTE-path and empty-input
  expectation on `unsupported source`. Reconciled catalog byte-equality: the
  `partially-upgradable-inventory` fixture + fenced block, the
  status-token-reference partially-available vocabulary, and the info-surface
  reason list now carry `{unsupported component}`; the structural-unavailable
  and marketplace-source examples keep `{unsupported source}`.

### Task 3 -- Reconcile the PRD component-support prose -- commit `8e9b9850`

- `docs/prd/pi-claude-marketplace-prd.md`: removed `bin` from the three
  unsupported-component enumerations (Non-goals, Glossary, Out-of-Scope) and
  noted that `<pluginRoot>/bin` is PATH-honored at runtime (PENV-01) at
  Claude Code parity (D-90-06); named the dropped non-carve-out reason as
  `{unsupported component}` (D-90-05). Preserved the `unsupported source` /
  `unsupported hooks` homonyms and the `FORCE-`/`FSTAT-` IDs the vocabulary
  guard requires; left the deferred `BINP-01` binary-provisioning row intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Suite-wide reason-expectation flips from the token change**
- **Found during:** Task 2 (full `npm test` run after the local test edits).
- **Issue:** Five tests outside the plan's named set asserted
  `{unsupported source}` for a non-carve-out component kind and broke once
  `kindToReason` emitted `unsupported component`: the install `260525-cjr C5`
  `contains monitors` case, install `FSTAT-07` + `WR-03`
  (`experimental: {themes, monitors}` force-degrade rows), and update
  `FORCE-02` + `XSURF-03/SEV-04` (`makeCandidateUnsupported` degrade rows).
- **Fix:** Updated each expectation (and its explanatory comment) to
  `{unsupported component}` -- the intended, truthful consequence of the
  token retarget. All are non-carve-out component-kind rows sourced through
  `narrowUnsupportedKinds`; none is a source/note-axis case.
- **Files:** tests/orchestrators/plugin/install.test.ts,
  tests/orchestrators/plugin/update.test.ts.
- **Commit:** 26551d8e.

**2. [Rule 1 - Test correctness] PR-3 multi-kind test swapped off bin**
- **Found during:** Task 1 (resolver suite run).
- **Issue:** `PR-3 multiple unsupported components both surface as notes` used
  `themes` + `bin` as its two unsupported kinds; after D-90-06 `bin` no longer
  surfaces, so the test could not prove "multiple kinds surface".
- **Fix:** Swapped `bin` for `monitors` (another non-carve-out unsupported
  kind), preserving the test's multi-kind intent.
- **Files:** tests/domain/resolver-strict.test.ts.
- **Commit:** 46892fd2.

**3. [Rule 3 - Blocking] Dropped a dead partially-available guard in the new bin test**
- **Found during:** Task 1 (typecheck).
- **Issue:** `assert.equal(r.state, "installable")` narrows `r` to the
  installable variant, so a following `if (r.state === "partially-available")`
  block was unreachable (`TS2367` no-overlap; `unsupported` does not exist on
  `never`).
- **Fix:** Removed the redundant guard -- asserting `installable` already
  proves `bin` is absent from any unsupported list (the installable variant
  has none). The remaining `contains bin` note assertion is sufficient.
- **Files:** tests/domain/resolver-strict.test.ts.
- **Commit:** 46892fd2.

## Verification

- `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` -- pass (bin-installable + pruned convention tables).
- `node --test tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat.test.ts tests/architecture/partial-vocabulary-guard.test.ts` -- pass.
- SURF-01 pinned: `narrowUnsupportedKinds(["lspServers","monitors"])` = `["lsp","unsupported component"]`, byte-identical on list/info/install (cross-surface parity suite).
- `REASONS.length === 38`; `_ReasonsCoverageProof` compiles (`npm run typecheck` green).
- Full unit suite (`npm test`): 3232 pass, 0 fail, 1 pre-existing skip.
- `npm run check`: typecheck + ESLint + Prettier + unit all green. Integration:
  16/18 pass; the 2 failures (`provenance-invisibility.test.ts`,
  `skill-path-resolution.test.ts`) are the documented environmental
  pi-subagents cases that resolve the `@earendil-works/pi-coding-agent` peer
  from `npm root -g` and fail on a stale global version -- both are about
  pi-subagents skill provenance / `resolveSkillsWithFallback`, wholly
  unrelated to this plan's resolver-classification and reason-token edits.
- Live-Pi UAT (90-UAT.md Test 3) carried to `/gsd-verify-work`: install a
  path-source plugin whose root has a `bin/` dir -> installs by DEFAULT (no
  `--partial`, no `(partially-available)` row); a plugin declaring a
  non-carve-out unsupported kind renders `{unsupported component}`.

## Threat Mitigations Applied

- T-90-06 (EoP, bin default install -> PATH entry): accepted -- the
  `<resolvedSource>/bin` dir was already appended to `PATH` for enabled
  installed records (PENV-01, shipped in 90-01); removing the `--partial`
  gate adds no surface and binary shadowing is already blocked by the shipped
  append-not-prepend rule (T-90-01).
- T-90-07 (Spoofing/mislabel, `kindToReason` token): mitigated -- the
  per-kind fallback now names a dropped component kind truthfully as
  `unsupported component`; the source/note axis keeps `unsupported source`.
  Pinned by the flipped cross-surface parity + probe-classifier tests.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/resolver.ts (bin removed from UNSUPPORTED_COMPONENT_KINDS)
- FOUND: extensions/pi-claude-marketplace/shared/notify.ts (unsupported component member)
- FOUND: commit 46892fd2 (Task 1)
- FOUND: commit 26551d8e (Task 2)
- FOUND: commit 8e9b9850 (Task 3)
