---
phase: 75-rename-force-unsupported-vocabulary-to-partial-partially-ava
plan: 02
subsystem: notification-output
tags: [vocabulary-rename, byte-gate, output-catalog, completion-cache, resolver, typescript]

# Dependency graph
requires:
  - phase: 75-01
    provides: the --partial flag + internal degrade plumbing rename (requirePartialInstallable, .partial option, partialDegrade/partialUpgradable, PARTIAL_*_STATUSES) on which this plan's output-vocabulary rename builds
provides:
  - "user-visible partial render tokens: (partially-available) / (partially-installed) / (partially-upgradable) / (will partially install)"
  - "resolver verdict discriminant state: partially-available; classifier + completion-cache partial status literals"
  - "PLUGIN_INDEX_CACHE_SCHEMA schemaVersion 4 (self-healing v3 drop-and-rebuild)"
  - "PARTIAL_INSTALL_HINT_TRAILER / PARTIAL_UPDATE_HINT_TRAILER (Re-run with --partial ...); partialHint field; ICON_PARTIALLY_INSTALLED / ICON_PARTIALLY_AVAILABLE (glyph chars unchanged)"
  - "tests/architecture/partial-vocabulary-guard.test.ts (grep absence/presence surgical-completeness guard)"
affects: [output-vocabulary, byte-gate-catalog-uat, completion-cache-schema]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Symbol-safe exact-literal rename: the double-quoted \"unsupported\" / \"force-installed\" tokens never collide with out-of-scope homonyms (\"unsupported source\" has an interior space, .unsupported is unquoted, render strings (unsupported) have parens), so per-file exact-string replacement is section-4c-safe even on the dense collision lines"
    - "Verdict-vs-component discriminator: the plugin-verdict render token is followed by ' {' (required reasons brace) while the component hook-event ' (unsupported)' suffix ends the line -- a precise byte-level separator used across renderer, docs, fixtures, and regex assertions"
    - "Atomic byte-supersession: renderer + docs/output-catalog.md + catalog-uat fixtures land in one commit so the byte-equality gate never goes red"

key-files:
  created:
    - tests/architecture/partial-vocabulary-guard.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - CHANGELOG.md

decisions:
  - "Task 1 and Task 2 landed as ONE atomic supersession commit: the info surface derives its render token via `(${plugin.status})`, so a literal-only rename is NOT byte-invisible -- a separate byte-invisible Task 1 was infeasible without a RED byte window; the single-commit supersession (RESEARCH Option A, the primary recommendation) satisfies both no-RED-window and never-split-verdict-from-force-state"
  - "The completion-cache schemaVersion bumped all THREE 3s together (schema Type.Literal + both `as const` write sites) with no transform; a stale v3 cache self-heals via the existing drop-and-rebuild-on-mismatch path (new regression test added)"
  - "Verdict render token flipped via the ' {' / '\\(...\\) \\{' discriminator (verdict rows always carry a required reasons brace); the component-level ` (unsupported)` hook-event suffix is preserved byte-for-byte"

requirements-completed: [RVOC-02, RVOC-03, RVOC-04]

# Metrics
duration: 45min
completed: 2026-07-02
---

# Phase 75 Plan 02: Rename force/unsupported output vocabulary to partial Summary

**Renamed the user-visible output vocabulary and persisted completion-cache literals from force/unsupported to partial/partially-available -- render tokens, resolver verdict, glyph const names, hint-trailer bodies, and cache schemaVersion 4 -- as one atomic byte-supersession, with the byte-equality catalog UAT green throughout and a new grep-based guard machine-enforcing the surgical-completeness of the rename.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-02
- **Tasks:** 3 (Task 1 + Task 2 merged into one commit; Task 3 separate)
- **Files:** 52 distinct (50 in the supersession commit + the new guard test + CHANGELOG)

## Accomplishments

- Every user-visible surface now renders the locked partial tokens: `(partially-available)` (verdict), `(partially-installed)`, `(partially-upgradable)`, and the reconcile-preview `(will partially install)` adverb form (no hyphen). The degrade-decline hint reads `Re-run with --partial to install/update the supported components.`
- The resolver verdict discriminant is `state: "partially-available"` (`ResolvedPluginPartiallyAvailable` / `partiallyAvailable()` factory); the classifier + completion-cache status literals are `partially-installed` / `partially-installed-upgradable` / `partially-upgradable` / `partially-available`.
- `PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion` is `4` (schema `Type.Literal` + both `as const` write sites; `grep -c '3 as const'` returns 0). A stale on-disk v3 cache drop-and-rebuilds on next read via the existing mismatch path (atomic NFR-1, idempotent NFR-3); a new `completion-cache.test.ts` case proves the v3->v4 self-heal.
- Glyph const NAMES changed (`ICON_PARTIALLY_INSTALLED` / `ICON_PARTIALLY_AVAILABLE`); the glyph CHARACTERS `◉` / `⊖` are byte-identical. Hint-trailer constants renamed (`PARTIAL_INSTALL_HINT_TRAILER` / `PARTIAL_UPDATE_HINT_TRAILER`); `forceHint` -> `partialHint`; `PluginWillInstallMessage.force` -> `.partial`.
- The atomic-supersession triad moved in lockstep: `shared/notify.ts` renderer + `*.messaging.ts` producers + `docs/output-catalog.md` fenced blocks + `docs/messaging-style-guide.md` + the `catalog-uat` FIXTURE expected bytes -- the byte-equality gate stayed green with the new tokens.
- `tests/architecture/partial-vocabulary-guard.test.ts` (30 assertions) walks the extension tree and enforces: in-scope old tokens ABSENT, out-of-scope homonyms PRESENT (component reason tokens, `compatibility.unsupported[]`/`supported[]`, `narrowUnsupportedKinds`/`unsupportedKinds`, the ` (unsupported)` hook-event suffix, and every overwrite `force: true`).
- `npm run check` GREEN: typecheck + ESLint + Prettier + 2563 unit + 16 integration. Closed-set length locks unchanged at 23/18/32/7 (length-preserving rename).

## Task Commits

Task 1 (literals/types/keys/cache) and Task 2 (render strings + trailer bodies + docs + fixtures) were landed as ONE atomic supersession commit -- see Deviations for why the byte-safe seam was infeasible.

1. **Task 1 + Task 2 (atomic byte-supersession)** -- `a7bcb311` (refactor) -- 50 files: renderer, status literals, resolver verdict, classifier, completion-cache schema 4, glyph const names, hint-trailer bodies, docs (output-catalog + messaging-style-guide), catalog-uat + all render-byte test assertions.
2. **Task 3 (surgical-completeness guard + CHANGELOG)** -- `421f2a4d` (test) -- the new guard, the CHANGELOG entry, and the info.ts comment fix the guard surfaced.

## Files Created/Modified

**Created:** `tests/architecture/partial-vocabulary-guard.test.ts`.

**Modified (production, 24):** `shared/notify.ts`, `shared/completion-cache.ts`, `shared/notify-context.ts`, `domain/resolver.ts`, `domain/index.ts`, `domain/components/hooks.ts`, `orchestrators/plugin/{info,plugin-state-classifier,install,list,update}.ts`, `orchestrators/plugin/{install,list,update}.messaging.ts`, `orchestrators/marketplace/{update,update.messaging}.ts`, `orchestrators/reconcile/{notify,apply,apply-outcomes,pending,reconcile.messaging}.ts`, `orchestrators/{types,plugin/reinstall}.ts` (comment vocab only), `edge/handlers/tools.ts`, `edge/completions/data.ts`.

**Modified (docs, 3):** `docs/output-catalog.md`, `docs/messaging-style-guide.md`, `CHANGELOG.md`.

**Modified (tests, ~25):** catalog-uat + closed-set + grammar-invariant + stamp-coverage + will-reload-agreement architecture tests; resolver-strict/loose/types; notify-v2; completion-cache (schemaVersion 4 + new v3->v4 self-heal case); edge tools/completions/update; orchestrator install/list/update/info/plugin-state-classifier/cross-surface-reason-parity; marketplace/update; reconcile backfill/notify/pending.

## Decisions Made

- **Single atomic supersession commit (Task 1 + Task 2):** the info surface (`renderPluginInfo`, `shared/notify.ts`) derives its render token via `` `(${plugin.status})` ``, so renaming the status literal `"unsupported"` -> `"partially-available"` automatically changed the info-row token to `(partially-available)`. A byte-invisible Task 1 (rename literals, keep render strings old) is therefore impossible for the info surface -- committing it alone would leave a RED byte window (info renders new tokens; hardcoded strings + docs + fixtures still old). Merging into one commit (RESEARCH Option A, the primary recommendation, and Plan 01's precedent) satisfies the load-bearing invariants: no RED byte window, verdict-rename never split from force-state-rename, and the renderer+docs+fixtures land together.
- **Symbol-safe exact-literal rename:** the double-quoted `"unsupported"` / `"force-installed"` tokens provably never match out-of-scope homonyms, so per-file exact-string replacement is section-4c-safe even on the dense collision lines (`resolver.ts:1244`, `apply.ts:1155`) -- the middle `r.state === "unsupported"` flips while `unsupportedKinds` and `r.unsupported` stay untouched.
- **Verdict-vs-component discriminator:** the plugin-verdict render token is always followed by ` {` (a required reasons brace); the component hook-event ` (unsupported)` suffix ends its line. This byte-level separator drove the surgical flips in the renderer, docs, fixtures, and both literal and regex-escaped test assertions, preserving the component render byte-for-byte.

## Deviations from Plan

### Structural

**1. [Rule 4-adjacent / architectural realization] Task 1 and Task 2 merged into one commit**
- **Found during:** Task 1 verification (`npm test` after the literal rename).
- **Issue:** The plan's byte-safe seam assumed Task 1 (literal rename) is byte-invisible because render strings are hardcoded. But `renderPluginInfo` derives the info-row token via `` `(${plugin.status})` `` -- a coupling the RESEARCH census did not surface. So the literal rename immediately changed the info surface's rendered token, breaking byte-invisibility and making a standalone Task 1 commit a RED byte window.
- **Resolution:** Landed Task 1 + Task 2 as one atomic supersession commit (RESEARCH Option A). This preserves every load-bearing invariant (no RED window, no verdict/force-state split, renderer+docs+fixtures atomic). Not routed as a checkpoint because it strengthens -- not weakens -- the byte-gate discipline, and mirrors Plan 01's single-atomic-commit decision.
- **Commit:** a7bcb311

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Renamed the missing consumer `orchestrators/plugin/info.ts`**
- **Found during:** Task 1 (surfaced by `tsc`).
- **Issue:** `info.ts` imports `ResolvedPluginUnsupported` and carries `state === "unsupported"` / `status: "force-installed"` projections but was NOT in the plan's file list; renaming the resolver/union broke its compile.
- **Fix:** Applied the same symbol-safe transforms (status literals, type refs). No render strings in `info.ts` (it delegates to `notify`).
- **Commit:** a7bcb311

**3. [Rule 3 - Blocking] Quoted the unquoted render-map keys in the messaging files**
- **Found during:** Task 1 (surfaced by `tsc`).
- **Issue:** `list.messaging.ts` / `install.messaging.ts` render maps used an unquoted `unsupported:` key; after the union rename the key had to become the hyphenated `"partially-available":` (a quoted key).
- **Fix:** Manually requoted the two keys.
- **Commit:** a7bcb311

**4. [Rule 3 - Blocking] `info.ts` residual comment refs (grep sandbox quirk)**
- **Found during:** Task 3 (surfaced by the new guard).
- **Issue:** `grep` cannot read `orchestrators/plugin/info.ts` in this sandbox, so the `grep -rl | perl` comment-coherence sweeps silently skipped it, leaving three `` `(force-installed)` `` comment refs. The Node-based guard (which reads every file) caught it.
- **Fix:** Flipped the paren-form + backtick status refs in `info.ts` via direct `perl` (perl reads the file fine). Two verdict-prose `` `(unsupported)` `` backtick refs remain (NOT the double-quote form the guard checks, and inseparable by token form from the mandatory component hook-suffix refs) -- see Known Stubs.
- **Commit:** 421f2a4d

**5. [Rule 3 - coherence] Comment-vocabulary updates in two out-of-scope files**
- **Found during:** Task 2 comment-coherence sweep.
- **Issue:** `orchestrators/types.ts` and `orchestrators/plugin/reinstall.ts` carried `(force-installed)` / `--force` comment refs.
- **Fix:** Flipped the comment vocabulary only; the overwrite `{ force: true }` code in `reinstall.ts` is byte-identical (verified by diff and by the guard's presence assertion).
- **Commit:** a7bcb311

## Known Stubs

- `orchestrators/plugin/info.ts` retains two verdict-prose `` `(unsupported)` `` backtick comment references (describing the info-surface render). These are NOT the guard-gated double-quote render form and are token-form-indistinguishable from the mandatory component-level `` `(unsupported)` `` hook-suffix comment refs in the same file (which MUST stay). Left as low-value comment debt to avoid risking the component-ref preservation (T-75-03). No behavior or byte impact; the guard is green.

## Issues Encountered

- **grep cannot read `info.ts` in this sandbox:** every `grep`/`grep -F` against `orchestrators/plugin/info.ts` returned empty even for present tokens, silently excluding it from `grep -rl`-based sweeps and making the manual acceptance greps unreliable for that one file. The Node-based guard (`readFileSync`) reads it correctly and is the authoritative completion check -- it caught the one residual the sweeps missed. `perl` and the `Read` tool both read the file fine.

## User Setup Required

None -- pure code/config/docs rename. A stale on-disk completion cache self-heals on next read (schemaVersion 4 mismatch -> drop + rebuild); no manual step.

## Next Phase Readiness

- The output-vocabulary rename is complete and machine-enforced. The remaining PR-time ritual (per CLAUDE.md) is the version bump: `package.json` + `sonar-project.properties` + `EXTENSION_VERSION` + `package-lock.json` in lockstep, plus promoting the CHANGELOG `[Unreleased]` heading.
- No blockers.

## Self-Check: PASSED

- FOUND: `.planning/phases/75-rename-force-unsupported-vocabulary-to-partial-partially-ava/75-02-SUMMARY.md`
- FOUND: `tests/architecture/partial-vocabulary-guard.test.ts`
- FOUND commits: `a7bcb311` (supersession), `421f2a4d` (guard + CHANGELOG)
- FOUND: all key modified files (`completion-cache.ts`, `resolver.ts`, `docs/output-catalog.md`)
- `npm run check` GREEN (2563 unit + 16 integration); closed-set locks 23/18/32/7; guard 30/30.
