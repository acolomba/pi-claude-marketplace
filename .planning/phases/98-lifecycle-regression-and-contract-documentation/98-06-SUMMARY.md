---
phase: 98-lifecycle-regression-and-contract-documentation
plan: 06
subsystem: documentation
tags: [output-catalog, prd, notify, mermaid, closed-set, comment-policy]

# Dependency graph
requires:
  - phase: 98-lifecycle-regression-and-contract-documentation
    provides: "the four carriers (98-01, 98-03), the COMPAT-01 contract gate (98-04), and the LIFE coverage (98-02, 98-05) whose shipped behavior this sweep describes"
provides:
  - "an output catalog whose variant enumerations, token reference table and glyph roster are re-derived from the runtime constants"
  - "a design document whose list decision flowchart is redrawn to the shipped path"
  - "six source-comment sites restated against the behavior they document, with no executable line changed"
  - "a corrected source-scan rationale in REQUIREMENTS.md and ROADMAP.md"
affects: [milestone verification, any future closed-set or glyph amendment, ship]

actuals:
  tokens: 19141
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A documentation count claim names the runtime constant it mirrors and the gate that pins it, so the next drift is a red test rather than a reader's discovery"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - docs/prd/pi-claude-marketplace-prd.md
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "The reason-bearing and dep-bearing variant sets were re-derived from the message interfaces in notify.ts, which the plan names as the authority: a variant can carry a brace exactly when its interface declares a `reasons` field. That yields 9 reason-bearing (not the documented 6) and 4 dep-bearing (not the documented 3) of the 19 plugin statuses. Both stale counts predate the arms that gained the fields -- `installed` gained an optional `reasons` under SURF-05 and INV-01, and `partially-installed` gained an optional `dependencies` under WR-03."
  - "The two catalog counts are now stated with their source AND their gate (`PLUGIN_STATUSES`, `REASONS`, the COMPAT-01 enumeration pin), so a future member change fails a test before a reader has to notice the prose is wrong. A bare corrected number would have drifted again on the next amendment."
  - "The PRD's non-member `(present)` token was replaced by `(remote)` rather than simply deleted. `(present)` collapsed into `(installed)`, which the row already lists, so deleting it alone would have left the list surface's genuinely missing closed-set member undocumented; `(remote)` is that member."
  - "The flowchart was redrawn around the ManifestLookup discriminant rather than the old ok/warning split, and gained a one-sentence note stating that the `unverified` arm is reachable only on the cross-scope fold. Without that note a reader would read `unverified` and `BOUND-01` as two renderings of the same input, which is the exact confusion the redraw exists to remove."
  - "PL-6 was rewritten to state the BOUND-01 output AND to say where the never-silently-disappear guarantee actually lives (INV-01, on the manifest-loads path). Stating only the failed-header form would have read as a contract shrink; naming the surviving guarantee shows the promise moved rather than vanished."
  - "The tools.ts version comment was re-anchored to D-15-04 rather than left anchor-free: that decision genuinely governs the optional-version-versus-required-from/to split the switch implements. The other two comments describe list-surface projection that no surviving requirement governs, so they were rewritten as anchor-free prose per the plan's instruction."

patterns-established:
  - "A prose sweep over byte-contract documentation runs the byte-equality gate after EVERY edit pass, not only at the end -- the gate is what proves an edit stayed outside the fences."
  - "A count claim carries three things: the number, the runtime constant it mirrors, and the decision that last moved it. The third is what lets the next reader tell a stale number from a wrong one."

requirements-completed: [DOC-08]

coverage:
  - id: D1
    description: "The output catalog's reasons-brace and soft-dependency-marker bullets enumerate the correct variant sets, state the empty-list behavior, and state the contractual multi-reason emit order plus the reason tuple's byte-stability requirement"
    requirement: DOC-08
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts (58 cases, byte equality across every annotated fenced block)"
        status: pass
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts (retired-vocabulary scan over the catalog and the PRD)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The status-token reference table holds one row per PLUGIN_STATUSES member, including the two partially-installed-family tokens, with repeated glyphs kept on separate rows"
    requirement: DOC-08
    verification:
      - kind: other
        ref: "counted 19 plugin-token rows against PLUGIN_STATUSES.length === 19 (node --input-type=module import of the tuple)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The manifest-absent inventory prose states the record-backed reason the row keeps its clean token, and no longer claims the surface checks on-disk materialization"
    requirement: DOC-08
    verification:
      - kind: other
        ref: "grep -c 'the record is materialized on disk' docs/output-catalog.md => 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The design document states the shipped manifest-failure output (bare failed header, no child rows), lists all seven exported glyphs with correct meanings, and carries no non-member status token"
    requirement: DOC-08
    verification:
      - kind: other
        ref: "grep -c of 'could not load manifest' / 'fallback to installed-from-state' / '(present)' in the PRD => 0, 0, 0; all seven glyph characters present in the PL-4 row"
        status: pass
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts (52 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The list decision flowchart is redrawn to the current path -- manifest load, lookup, lookup discriminant, resulting row form -- with the retired state-derived fallback branch dropped"
    requirement: DOC-08
    verification: []
    human_judgment: true
    rationale: "A redrawn diagram's fidelity to the code is a reading judgment. Its node labels were derived from list.ts (loadMarketplaceManifestSoftly, manifestLookupFor, the three ManifestLookup arms) this session, but no gate asserts that a mermaid diagram matches a control flow, so a human should read the two side by side."
  - id: D6
    description: "Six source-comment sites state the current behavior with live anchors, and no executable line changed"
    requirement: DOC-08
    verification:
      - kind: other
        ref: "grep -c of '37-entry', 'so it renders byte-identically to a bare', 'RLD-04', 'all four `resources' in their respective files => 0, 0, 0, 0"
        status: pass
      - kind: other
        ref: "git diff -U0 extensions/ filtered to non-comment lines: the only hit is the reconcile README markdown line"
        status: pass
      - kind: integration
        ref: "PI_SUBAGENTS_ROOT=... npm run check => CHECK_EXIT=0 (3366 unit tests, 0 fail; 18 integration tests, 0 fail)"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-08-10
status: complete
---

# Phase 98 Plan 06: DOC-08 accuracy sweep Summary

**The output catalog and the design document now state the variant sets, token table, glyph roster and list decision path the code actually ships, with the flowchart redrawn around the ManifestLookup discriminant and six source-comment sites re-anchored -- no executable line touched, full check green.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-10T00:24:12-04:00
- **Completed:** 2026-08-10T00:51:00-04:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Re-derived the catalog's two variant enumerations from the message interfaces: 9 reason-bearing and 4 dep-bearing variants of the 19 plugin statuses, each stated with the runtime constant it mirrors and the gate that pins it.
- Added the two missing rows to the status-token reference table so it holds one row per `PLUGIN_STATUSES` member, with a lead-in stating that tokens sharing a glyph keep separate rows.
- Replaced the manifest-absent inventory row's on-disk materialization claim with the record-backed reason the row keeps its clean token.
- Rewrote the design document's manifest-failure row to the BOUND-01 output and redrew the list decision flowchart to the shipped path, dropping the retired state-derived fallback branch.
- Restated six source-comment sites -- the reason-set header count, two list-inventory reasons claims, the render-path arm counts, two wrong disabled-glyph mentions, three retired anchors, and the reconcile bucket's disabled predicate.
- Corrected the falsified NUL-byte premise in `REQUIREMENTS.md` and `ROADMAP.md`, restating the source-scan rule on the silent-skip hazard that actually justifies it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Output-catalog accuracy sweep** - `79cba2a0` (docs)
2. **Task 2: Design-document sweep and flowchart redraw** - `f486c608` (docs)
3. **Task 3: Source-comment sweep and phase gate** - `86611625` (docs)
4. **Task 3 (carried finding): planning-doc source-scan premise** - `c9022390` (docs)

## Files Created/Modified

- `docs/output-catalog.md` - corrected reasons-brace and soft-dependency-marker enumerations, added the emit-order and tuple-stability contract, added the bullseye glyph to the roster, added two status-token rows and a table lead-in, rewrote the manifest-absent inventory prose
- `docs/prd/pi-claude-marketplace-prd.md` - rewrote the PL-6 manifest-failure row to the BOUND-01 output, redrew the section 5.3.1 flowchart, corrected the PL-4 glyph roster, glyph meanings and token set
- `extensions/pi-claude-marketplace/shared/notify.ts` - corrected the list-inventory reasons claim at both sites, re-derived the render-path arm counts, fixed the disabled glyph in two arms, corrected the will-enable marker prose
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - corrected the reason-set member count in both header sentences and named D-90-05 as its cause
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` - replaced three retired anchors with a live one and anchor-free prose
- `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md` - restated the disabled predicate as the single-axis read ENBL-05 made it
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` - restated the source-scan rule on the silent-skip hazard

## Decisions Made

See `key-decisions` in the frontmatter. In brief: the interfaces are the authority for which variants can carry a brace; every corrected count names its constant and its gate; the non-member PRD token was replaced by the closed-set member the list surface actually emits rather than merely deleted; and PL-6 names where the never-silently-disappear guarantee now lives so the rewrite reads as a relocation, not a shrink.

## Verifications Recorded (claims checked, no edit needed)

The plan asks that a claim verified as already correct be recorded rather than silently left. Three were:

1. **Fold-divergence wording (named defect 10) is already consistent.** `docs/output-catalog.md` (the `state-only-installed-single-scope` prose and the hooks-fidelity note that refers back to it) and `orchestrators/plugin/info.ts` (`buildStateOnlyInstalledRow`, `composeStateOnlyComponents`) describe the same divergence in the same terms. Both name the Pi-generated installed forms and both name MCP servers as the sole exception. The three forms were checked against `domain/name.ts` (`generatedSkillName`, `generatedCommandName`, `generatedAgentName`) and are correct on both sides. No edit; nothing to reconcile.
2. **The version-token truncation contract is stated and correct.** The catalog's `<version-token>` bullet states that a persisted twelve-hex hash version renders as a seven-hex display form; `HASH_VERSION_RE` and the renderer's slice in `notify.ts` agree exactly.
3. **The disabled-partial parity is already documented.** The `disabled-inventory` state's prose already states that availability is an orthogonal axis and that a partially-installed record the user disabled renders the same bare row (ENBL-06 / INV-04). Nothing was falsified there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the bullseye glyph to the catalog's own roster**

- **Found during:** Task 1
- **Issue:** The Conventions glyph list and the `<icon>` bullet of the plugin-row grammar both enumerated six glyphs, omitting `◉`. The `<icon>` bullet is in the same bullet list as the reasons-brace bullet the plan required correcting, and it cross-references the glyph list above it, so correcting one and not the other would have left the two internally inconsistent -- and the task's PRD counterpart explicitly requires the analogous seven-glyph roster.
- **Fix:** Added a `◉` bullet to the Glyphs subsection and to the `<icon>` enumeration, with the note that the seven characters are the seven `ICON_*` exports the COMPAT-01 gate pins.
- **Files modified:** docs/output-catalog.md
- **Verification:** catalog-uat and partial-vocabulary-guard both green; the seven characters match the code points printed from the source.
- **Committed in:** `79cba2a0`

**2. [Rule 1 - Bug] Corrected three further falsified comments in notify.ts**

- **Found during:** Task 3, while editing the render path the plan names
- **Issue:** Three sites adjacent to the named ones carried the same classes of falsified claim. The `renderPluginRow` doc block stated 3 dep-bearing arms, "the other 7 arms", and a 5/5 reasons split -- the same stale enumerations the catalog carried. The `will disable` and `disabled` arms both documented `ICON_DISABLED` as `◌`, which D-80-01 reassigned to `(remote)`; that is the same glyph-meaning defect the plan names in the PRD. The `will enable` arm restated the two-axis disabled marker that ENBL-05 collapsed, which is the same defect the plan names in the reconcile README.
- **Fix:** Re-derived the arm counts over the 19 statuses, corrected both glyph mentions to `◍`, and restated the will-enable marker as the single-axis boolean read.
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts
- **Verification:** `npm run check` green; the diff under `extensions/` contains no non-comment line outside the reconcile README.
- **Committed in:** `86611625`

**3. [Rule 1 - Bug] Corrected the falsified NUL-byte premise in the planning docs**

- **Found during:** Task 3 (carried finding from 98-04)
- **Issue:** `REQUIREMENTS.md` COMPAT-01 and `ROADMAP.md` success criterion 3 both asserted that `orchestrators/plugin/info.ts` contains a literal NUL byte. The separator is written as an escape with an inline comment saying why, so the file is ordinary text. The rule those sentences justify is still correct, but its stated reason was not.
- **Fix:** Restated both sentences on the silent-skip hazard (a line tool that classifies a file as binary reports nothing and exits cleanly), recorded that the original premise is resolved, and pointed at the contract gate's header where the resolution is already narrated. The direct-read rule is kept in both.
- **Files modified:** .planning/REQUIREMENTS.md, .planning/ROADMAP.md
- **Verification:** pre-commit green on both files; no NUL byte present in either (checked by code point after the edit -- the first write attempt emitted a real NUL, which was replaced with its escape text before staging).
- **Committed in:** `c9022390`

---

**Total deviations:** 3 auto-fixed (2 falsified-claim corrections inside touched surfaces, 1 carried finding)
**Impact on plan:** Each correction is the same defect class the plan names, found at an adjacent site inside a surface already being edited. No new catalog state, token, glyph or test was introduced, and no executable line changed.

## Deferred Items

Recorded rather than silently skipped, per the plan's boundary and the operator's instruction.

1. **The autoupdate cascade skip row has no catalog state (operator finding 2).** The mapper's `skipped` arm forwards name, scope and reasons but no version, so the cascade row is `⊘ hello (skipped) {not in manifest}` while the plugin-update row is `⊘ hello v1.0.0 (skipped) {not in manifest}`. Both forms are byte-pinned by 98-05, and the asymmetry is narrated in `tests/orchestrators/marketplace/update.test.ts` above the two cases. Nothing in the catalog states it wrongly -- the catalog simply has no state under `## /claude:plugin marketplace update` for this row. Documenting it means ADDING a catalog state plus a `catalog-uat` FIXTURES entry, which this plan's artifact list explicitly excludes ("New files / catalog states / tokens / tests: none"). Carry to a phase that may amend the catalog. No code change is warranted; the asymmetry looks deliberate.
2. **The catalog's description-bearing variant count is stale.** The `disabled-inventory` section states "the seven list-surface variants (`installed`, `upgradable`, `available`, `remote`, `partially-available`, `unavailable`, `disabled`) all support the description field". `PluginPartiallyInstalledMessage` and `PluginPartiallyUpgradableMessage` both declare `description?` too, so the true count is nine. This sits in a section the plan does not name and that this sweep did not otherwise touch, so correcting it would widen the diff past the stated boundary. Same defect class as the two counts fixed in Task 1; cheap to fold into the next catalog edit.
3. **`RLD-04` / `D-08` survive at six further source sites.** The plan's acceptance criterion scopes the anchor removal to `tools.ts`, which is now clean. The pair still appears in `orchestrators/plugin/list.ts` (four sites), `orchestrators/plugin/list.messaging.ts` and -- before this plan -- `shared/notify.ts` (removed there as a side effect of rewriting the `PluginInstalledMessage` doc block). `ROADMAP.md` already records that neither anchor is defined in any surviving artifact and says not to carry them forward, so the remaining sites are a known follow-up rather than a new finding. Note that `D-08` is separately live with an unrelated meaning in `install.ts`, `uninstall.ts`, `convert.ts` and `source.ts`, so a mechanical sweep would be wrong -- each site needs reading.

## Issues Encountered

- **A real NUL byte was written into `REQUIREMENTS.md`.** Writing the sentence that describes the escape produced an actual U+0000 rather than the six characters of its escape text -- reproducing, in the very sentence documenting it, the hazard the sentence describes. Caught by a code-point check before staging and replaced programmatically. Nothing reached a commit.
- **`pre-commit`'s TruffleHog hook fails structurally in the worktree** (`.git` is a file, so the git-mode scan cannot find an index). Confirmed clean by the filesystem-mode scan over each changed path before every commit, per the documented worktree protocol; `SKIP=trufflehog` was used and not extended to any other hook.
- **`mdformat` rewrote both docs** on its first pass over each (table-column realignment). Files were restaged and the hooks re-run until clean; no `--no-verify` and no `--amend`.

## Phase Gate

`PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run check` -> **CHECK_EXIT=0**.

Typecheck, lint, format-check, 3366 unit tests (0 fail, 1 pre-existing platform-conditional skip: the non-Linux `reapOrphans` arm on a Linux host) and 18 integration tests (0 fail) all green. Log: `98-06-check.log`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DOC-08 is closed: all ten named defects corrected in place, the three additional falsified statements folded in, the flowchart redrawn per D-98-07, and three further falsified comments found and fixed at adjacent sites.
- No documentation defect was resolved by deletion. Every named defect carries a true statement in the same position.
- Phase 98 is the milestone's last phase; the gate is green and the tree is clean. Verification can run against the shipped state.
- Three deferred items are recorded above, all documentation-only and none blocking.

## Self-Check: PASSED

All six modified source/doc paths exist on disk; all four task commits resolve in `git log`.

---
*Phase: 98-lifecycle-regression-and-contract-documentation*
*Completed: 2026-08-10*
