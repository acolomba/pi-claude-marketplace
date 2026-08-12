---
phase: 95-manifest-independent-installed-inventory
fixed_at: 2026-08-08T19:40:00Z
review_path: .planning/phases/95-manifest-independent-installed-inventory/95-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 95: Code Review Fix Report

**Fixed at:** 2026-08-08T19:40:00Z
**Source review:** `.planning/phases/95-manifest-independent-installed-inventory/95-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 4
- Skipped: 1 (WR-02, out of phase scope by CONTEXT assignment)

Info findings (IN-01..IN-05) were out of `fix_scope: critical_warning` and were
not attempted.

## Fixed Issues

### CR-01: `partially-upgradable` rows silently drop their reasons on the LLM tool payload

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts`,
`tests/edge/handlers/tools.test.ts`
**Commit:** `89334294`
**Applied fix:** Added the `partially-upgradable` arm to the required-`reasons`
block in `pluginReasons`, so the fourth status `projectRowStatus` flattens onto
the coarse `installed` tool bucket now forwards its candidate's dropped kinds.
No undefined guard is needed -- `PluginPartiallyUpgradableMessage.reasons` is a
required field, matching the `partially-installed` conjunct it joins. The doc
comment's completeness claim is now true rather than corrected.

Regression test `INV-05 :: a partially-upgradable record forwards its
candidate's dropped kinds` mirrors the two existing INV-05 tool-payload tests:
installed `fup@1.0.0`, manifest candidate `1.0.1` declaring `lspServers`, then
asserts both the flat line (`[installed] fup  1.0.0  (lsp)`) and
`details.plugins[0].reasons` deep-equal `["lsp"]`. The fixture helper gained
two options, both exercised by that test: `lspServers` on a manifest entry and
`installablePluginDirs` (the resolver probes the source dir, so the candidate
cannot resolve `partially-available` without it).

### WR-01: the fold path judges absence against a manifest the block header does not name

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`,
`tests/orchestrators/plugin/list-manifest-absent.test.ts`
**Commit:** `d093b465`
**Applied fix:** Fixed surgically inside the fold path, but NOT by the
predicate tightening the review proposed -- see the rationale below.

`ScopedManifest` gained `ownsAbsenceClaim`, and `loadMarketplaceManifestSoftly`
gained an optional `claimAuthorityPath` defaulting to the record's own
`manifestPath`. The cross-scope fold passes the USER record's `manifestPath`,
so a folded row enumerated from a project record that names a DIFFERENT
manifest can no longer assert `{not in manifest}` under a user-scope header
whose manifest declares the plugin. The absence gate in
`enumerateMarketplacePlugins` is now
`ownsAbsenceClaim && loadError === undefined && manifestEntry === undefined`:
the same BOUND-03 shape (preserve the row, suppress the unverified claim)
extended by one axis, and still ONE value passed to the enumerator rather than
a manifest plus a separate consistency flag (the drift shape D-95-04 calls out).

Characterization test `INV-01: a folded row whose project-side manifest is not
the block's manifest makes no absence claim` seeds the divergent shape: one
shared `marketplaceRoot`, a project record naming `other.json` (which loads
cleanly and omits `alpha`), and a user manifest that DECLARES `alpha`. Only the
claim-authority check can suppress the brace there -- the manifest read
succeeds, so the BOUND-03 `loadError` gate does not fire.

**Why not the proposed predicate tightening:** adding
`projectMp.manifestPath === userMp.manifestPath` to `isCloneOfUserMarketplace`
stops the fold from firing on the divergent shape, which changes the output of
the shipped BOUND-03 characterization test (`a folded row whose project-side
manifest FAILED to load is preserved and carries no reason brace`) from one
folded block to two blocks. That test's fixture IS a divergent-`manifestPath`
clone, so the tightening would make the fold-path `loadError` gate -- the
requirement Phase 95 shipped -- unreachable in production and require
rewriting its assertion. Threading the user block's `scopedManifest` into the
fold enumeration instead (the review's second option) has the same effect from
the other direction: the folded rows would then be judged against a manifest
that, when it fails, already short-circuits the block to a `(failed)` header
(IN-05). Both options neutralize D-95-05 on the fold path, which is a
requirements decision rather than a review fix. The claim-authority axis
achieves the review's stated goal -- no absence claim about a manifest the
header does not name -- and leaves both BOUND-03 characterizations passing
unchanged.

Note that the upgrade-candidate axis is untouched: a folded row's
`(upgradable)` / `(partially-upgradable)` derivation still reads the project
record's manifest. That ambiguity predates this diff and renders no absence
claim, so it stays out of scope.

### WR-03: two new user-visible row forms ship with no catalog state and no byte-equality gate

**Files modified:** `docs/output-catalog.md`,
`tests/architecture/catalog-uat.test.ts`
**Commits:** `43d62143`, `46a0efa` (follow-up: the `installed` fixture needs an
explicit `severity: "info"` -- `PluginInstalledMessage` requires the field, and
the `npm typecheck` pre-commit hook is scoped to `extensions/`, so the omission
only surfaced in the full `npm run check`)
**Applied fix:** Added `manifest-absent-inventory` and
`manifest-absent-partially-installed-inventory` under the
`/claude:plugin list` section, each with its `<!-- catalog-state: ... -->`
annotation, fenced expected block, and the prose the sibling inventory states
carry (glyph rationale, severity, reload-hint). Registered matching
`CatalogFixture` entries with `expectedSeverity` omitted, which is what puts
the unasserted `info` severity the review flagged under the gate.

Both new states are now covered by the byte-equality walk AND by the inverse
walk (`every FIXTURES (section,state) has a matching catalog annotation`), so
the two forms cannot drift on either side.

`prettier` reformats `docs/output-catalog.md` thematic breaks in a way
`mdformat` immediately reverts; the prettier pre-commit hook is scoped to
`\.(js|json|ts)$`, so markdown was left to `mdformat` / `markdownlint-cli2`,
both of which pass.

### WR-04: speculative, never-exercised fixture options in the new test file

**Files modified:** `tests/orchestrators/plugin/list-manifest-absent.test.ts`
**Commit:** `76d8440a`
**Applied fix:** Deleted `manifestPathOverride` (declaration, doc comment, and
the reassignment that forced `manifestPath` to be a `let`) and `mcp`
(declaration and its `resources.mcpServers` application). Neither was passed by
any case in the file. `manifestPath` is now `const`. Removal over exercising,
per the CLAUDE.md simplicity rule -- the BOUND-03 cases that need a divergent
manifest path use the separate `seedFoldedProjectClone` helper, which already
takes `manifestPath` explicitly.

## Skipped Issues

### WR-02: `shared/notify.ts` now documents behavior the change removed

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2171-2179`
**Reason:** Out of phase scope by explicit assignment. `95-CONTEXT.md` forbids a
`notify.ts` comment sweep in this phase, and the stale-comment reconciliation is
assigned to Phase 98 (DOC-08). `shared/notify.ts` was not edited.
**Original issue:** The `renderPluginRow` `installed` arm still states that the
list inventory row OMITS `reasons` and renders byte-identically to a bare
`(installed)` row. `list.messaging.ts` now forwards `p.reasons` and `list.ts`
stamps `["not in manifest"]`, so both halves are false. The correct wording is
the one the review proposes: the list inventory row forwards DURABLE reasons
(the INV-01 absence brace) while TRANSIENT cascade reasons such as
`orphan rewake` remain an install-surface concern (D-95-02).

Carrier note for Phase 98: the two catalog states added under WR-03 are the
byte-level authority for what that comment should describe.

## Verification

Per-fix: file re-read plus `npx tsc --noEmit`, targeted `node --test` runs
(`tests/edge/handlers/tools.test.ts`,
`tests/orchestrators/plugin/list-manifest-absent.test.ts`,
`tests/orchestrators/plugin/list.test.ts`,
`tests/integration/fold-adoption.test.ts`,
`tests/architecture/catalog-uat.test.ts`), `npx eslint`, and
`pre-commit run --files <changed>`.

Full gate: `PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents
npm run check` exits 0 -- typecheck, lint, format:check, `npm test` and
`npm run test:integration` all green.

Every gate ran in the working tree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`
(branch `features/manifest-independent-plugin-info`), the same tree the commits
landed in, so the numbers are reproducible from it. No separate agent worktree
was created.

The `trufflehog` pre-commit hook fails structurally in a linked worktree
(git-mode scan cannot read `.git/index`), so each commit was preceded by the
documented filesystem scan over the changed paths
(`--results=verified,unknown --fail`, clean each time) and committed with
`SKIP=trufflehog`. No other hook was skipped.

---

_Fixed: 2026-08-08T19:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
