---
phase: 12-fetch-and-prune
verified: 2026-10-23T18:00:00Z
status: passed
score: 5/5 must-haves verified (1 by override)
covered_files:
  - .planning/phases/12-fetch-and-prune/12-01-PLAN.md
  - .planning/phases/12-fetch-and-prune/12-01-SUMMARY.md
  - .planning/phases/12-fetch-and-prune/12-02-PLAN.md
  - .planning/phases/12-fetch-and-prune/12-02-SUMMARY.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - features/plugin/fetch.feature
  - features/plugin/prune.feature
  - features/step_definitions/plugin/fetch.steps.ts
covered_digest: "v3:sha256:196cebeb6809dd73d08e0d29455af81633a0b8bd62cd1eb4e9a4ce5f3476f681"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "`prune` removes orphaned dependencies and unused clones and reports a row for each one"
    reason: "D-12, Claude Code parity: `claude plugin prune` removes only auto-installed plugins that are no longer needed. Prune removes the clones of the dependencies it prunes (prune.feature:34-58); a general cache sweep would be a divergence with no recorded license. The PRN-01 wording is flagged for the user under For the orchestrator."
    accepted_by: "Claude (autonomous run, recommended default per the milestone rules)"
    accepted_at: "2026-10-23T12:00:00Z"
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 12: Fetch and Prune Verification Report

**Phase Goal:** `fetch` refreshes the cached sources of git-source plugins without installing new versions, and `prune` removes orphaned dependencies and unused clones.
**Verified:** 2026-10-23 (re-verified on the combined 15-phase milestone tree)
**Status:** passed (truth 3 by the D-12 parity override; `npm run check` green on this tree)
**Re-verification:** Yes. The earlier report went stale because covered files changed after other phases merged. All five truths were re-checked against the current tree. No regression found.

## Gate

`npm run check`: PASSED (orchestrator, on this exact combined tree: static checks, unpaired, integration, 702/702 cucumber scenarios, direct coverage). The verifier did not re-run it.

Run by the verifier on this tree:

- `npx cucumber-js --parallel 2 features/plugin/fetch.feature features/plugin/prune.feature`: 13 scenarios, 154 steps passed (random order, seed 330620).
- `npm run check:features`: exit 0.

## What changed since the previous report

- `features/plugin/fetch.feature` (commit `872c673e`): the bare-fetch request log is now one clone round per repository (`GET info/refs` + `POST git-upload-pack` for `ghp` and for `urlp`), where it had two rounds. Cause: Phase 4 commit `791a60dd` made a first unpinned clone skip the refresh that followed it. Evidence in code: `orchestrators/plugin/clone-cache.ts:326-330` refreshes only when `promotion !== "renamed"`, so a cold mirror clones once and a warm or raced mirror refreshes in place (MIRR-02). The old comment about "two rounds per cold mirror" is replaced by "a new copy of an unpinned plugin is cloned once, so each repository answers one round" (`fetch.feature:165-166`). The truth still holds: the bare form fetches `ghp` and `urlp`, and the `others` marketplace in the user scope makes no request.
- The warm-mirror refresh path is unchanged, so the single-plugin "downloads its new revision" scenario (`fetch.feature:33-58`) still sees a refresh round and a HEAD at revision 2.
- `prune.ts` and `fetch.ts` have no behavior change in this phase's scope since the previous report.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `fetch <plugin>@<marketplace>` refreshes a git-source plugin's cached source from the git host, as the request log shows, and installs no new version: `list` still shows the installed version (FET-01) | VERIFIED | "Fetching a git-source plugin downloads its new revision from the git host" `features/plugin/fetch.feature:33-58`: GET info/refs + POST git-upload-pack (`:54-57`), and the clone HEAD is revision 2 (`:58`, step `features/step_definitions/plugin/fetch.steps.ts:16-39`). "A fetch installs no new version, so the plugin list still shows the installed one" `fetch.feature:60-86`: `installed` at `{ghp revision 1}`, no request. Seed "Fetching a plugin succeeds again once the git host serves its repository again" `fetch.feature:7-31`. All pass on this tree. Caveat WR-09 below: true for the record and `list`, not for the live root of an unpinned plugin. |
| 2 | `fetch @<marketplace>` and a bare `fetch` refresh every git-source plugin in scope; a host refusal is reported and the others are still fetched; a path-source plugin makes no request and reports nothing to fetch (FET-02, FET-03) | VERIFIED | "Fetching a marketplace fetches each git-source plugin and reports the one the git host refuses" `fetch.feature:88-127`: error result, tally 1 failure / 2 successes, `ghp failed {source missing}` with the 404 cause chain, `urlp available`, urlp fetched after the ghp 404, only the urlp clone left. "A bare fetch fetches the git-source plugins of every marketplace in the scope" `fetch.feature:129-178` (now one clone round per repository, rows from `gits` and `more`, no row or request for the user-scope `others`). "Fetching a path-source plugin makes no request and reports it up to date" `:180-194`; "Fetching a pinned plugin whose clone is present makes no request and reports it up to date" `:196-210`. The bare form's continue-after-failure is not exercised, but both forms run the same loop (`orchestrators/plugin/fetch.ts`), IN-01 accepted. |
| 3 | `prune` removes orphaned dependencies and unused clones and reports a row for each one; `prune --dry-run` reports the same rows and removes nothing (PRN-01, PRN-02) | PASSED (override D-12) | Proven: "Pruning a scope uninstalls a dependency that no installed plugin needs" `features/plugin/prune.feature:15-32`; "Pruning a git-source dependency removes its clone" `prune.feature:34-58`; "Previewing a prune lists the dependency it would uninstall and removes nothing" `prune.feature:60-82`. Not proven as worded: "unused clones" in general, with a row for each (WR-07). The dry-run row has no `version` (`prune.ts` dry-run block builds only `status`, `name`, `reasons`, `severity`, `needsReload`), while the real row carries `1.2.0` (WR-08). The plugin set is the same, so WR-08 does not fail "the same rows". |
| 4 | `prune` with nothing to remove reports the empty result (PRN-03) | VERIFIED | Seed "Pruning a scope with nothing to remove reports the empty result" `prune.feature:7-13`; "Pruning keeps a dependency that an installed plugin still needs" `:84-101`; "Pruning keeps a plugin the user installed by name" `:103-121`. |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | VERIFIED | The 13 phase scenarios and `check:features` pass here; the orchestrator's `npm run check` is green on the same tree (702/702 scenarios). |

**Score:** 5/5 truths verified (truth 3 through the D-12 override)

### Override applied to truth 3 (D-12)

The product follows Claude Code, which prunes only auto-installed plugins. The orchestrating agent accepted that reading as D-12 (12-CONTEXT.md) and applied this override in the frontmatter. `.planning/REQUIREMENTS.md` (PRN-01) and `.planning/ROADMAP.md` (SC3) still carry the wording "orphaned dependencies and unused clones", so the override is still needed. Narrowing the wording is left to the user.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/fetch.feature` | FET-01..03 scenarios beside the Phase 1 seed | VERIFIED | 7 scenarios, all pass; bare-fetch log updated to one round per repository |
| `features/plugin/prune.feature` | PRN-01..03 scenarios beside the Phase 1 seed | VERIFIED | 6 scenarios, all pass |
| `features/step_definitions/plugin/fetch.steps.ts` | Fetch-verb step that reads the clone's HEAD | VERIFIED | Used at `fetch.feature:58`; step text names the verb (D-08) |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `fetch.feature` | `orchestrators/plugin/fetch.ts` | headless Pi runs `/claude:plugin fetch` | WIRED | Rows, tally, and request logs match current behavior, including the single clone round from `clone-cache.ts:326-330` |
| `prune.feature` | `orchestrators/plugin/prune.ts` | headless Pi runs `/claude:plugin prune` | WIRED | Dry-run `will uninstall` rows built in `prune.ts`; `prune-empty` path covered |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios pass | `npx cucumber-js --parallel 2 features/plugin/fetch.feature features/plugin/prune.feature` | 13 scenarios / 154 steps passed | PASS |
| Feature layout and names | `npm run check:features` | exit 0 | PASS |
| Revision step discriminates | negative probe from the first verification (scratch copy expecting revision 1 fails on the HEAD sha); the step file is unchanged | not re-run | CARRIED |

### Probe Execution

No probes are declared for this phase. Step 7c: not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FET-01 | 12-01 | fetch refreshes cached source without installing | SATISFIED | Truth 1 (WR-09 caveat) |
| FET-02 | 12-01 | `@mp` and bare fetch sweep the scope, continue after a failure | SATISFIED | Truth 2 |
| FET-03 | 12-01 | path source: no request, nothing to fetch | SATISFIED | Truth 2 |
| PRN-01 | 12-02 | prune removes orphaned dependencies and unused clones, reports each | SATISFIED by override D-12; BLOCKED as worded | Truth 3, WR-07 |
| PRN-02 | 12-02 | `--dry-run` reports the same rows, removes nothing | SATISFIED | Truth 3 (WR-08 noted) |
| PRN-03 | 12-02 | prune with nothing to remove reports empty | SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly FET-01..03 and PRN-01..03 to Phase 12.

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO in the three delivered feature and step files. Minor: `12-01-SUMMARY.md` still says no new step module was needed (D-10), but review-fix commit `6cc9a521` added `fetch.steps.ts`; `12-REVIEW-FIX.md` records it.

### Human Verification Required

None beyond the decisions listed under "For the orchestrator".

### Gaps Summary

None open. The one wording gap (truth 3, "unused clones") is closed by the D-12 parity override. The product matches Claude Code, and the wording question is listed below for the user.

## For the orchestrator

- RESOLVED (two-round request log): the bare-fetch scenario no longer pins two request rounds per cold unpinned mirror. Phase 4 (`791a60dd`) stopped refetching right after a first unpinned clone, and `872c673e` updated `fetch.feature` to one round per repository. The scenario passes. The earlier note that the scenario would change if the redundant round trip was removed is now closed.
- WR-07 (closed by the D-12 override; user decision on the wording): prune removes only the pruned dependencies' clones, matching `claude plugin prune`. A clone with no installed record survives a prune that finds no orphan (`prune-empty`), and no row reports a clone. Close it with the override YAML in the frontmatter plus a REQUIREMENTS/ROADMAP narrowing to "the clones of the dependencies it removes", or by a product change (always sweep, report clones) plus a scenario.
- WR-08 (does not block "the same rows", parity gap, still open): the dry-run `will uninstall` row has no `version`, while Claude Code's prune preview prints `name (version)`. The fix changes the shared `PluginWillUninstallMessage` type and published payload schema that reconcile and pending also use. Under the upstream-parity constraint this is an unrecorded divergence, so it needs a backlog item or a recorded decision.
- WR-09 (does not block SC1 as worded, product concern, still open): an unpinned git-source plugin's installed root is the shared URL-keyed mirror (`clone-cache.ts:333` returns `pluginRoot: mirrorRoot`). `fetch` refreshes it in place, so hooks (`CLAUDE_PLUGIN_ROOT`) and MCP `${CLAUDE_PLUGIN_ROOT}` run revision-2 code while the record and `list` still show revision 1, and a later `reinstall` stages from the newer mirror with the old version. This predates the phase. It needs a design decision: sha-keyed clones for unpinned installs, or reword FET-01 and document it.
- IN-02 (does not block): clone GC (`clone-gc.ts`) deletes every clone no installed record references on the next uninstall, update, or member-removing prune, including caches `fetch` warmed for plugins that are not installed. Record the intended lifetime of a fetch-warmed cache in the backlog or as a decision. It ties to WR-07.
- IN-01 (accepted): the bare `fetch` form's continue-after-failure has no scenario. It shares the loop with `@<mp>`, which is covered.
- SC1 "`list` still shows the installed version" is covered by its own scenario, `fetch.feature:60-86` (D-05: one `When` per scenario).
- Product bugs found and not fixed: none beyond WR-08 (parity gap) and WR-09 (design issue). No product code changed in this phase.
- Parity questions: (1) WR-08 preview version; (2) whether an unused-clone sweep in prune (WR-07) is a Pi-only divergence that would need a recorded decision; (3) `fetch` has no upstream counterpart (Pi-only under FTCH-01 / D-81-01 / D-81-02), and its success row status `available` follows D-81-02.
- Tech debt: the Phase 1 step `the installation record of the <scope> scope holds these plugins:` (`features/step_definitions/plugin/installation.steps.ts`) compares `table.raw()` against the raw `sha-...` version and does not project `{<repo> revision N}` tokens, so git-source versions cannot be stated through it. The phase worked around it with a `list` scenario (D-04). A foundation follow-up should add the projection.
- Tech debt: `the project scope holds these git clones:` prints an empty revision for an unpinned mirror, which is why the fetch-verb step `the fetched copy of the plugin {string} in the {word} scope holds revision {int} of its repository` exists. If a second verb needs it, move it to a topic module (D-08), or extend `features/lib/git-clones.ts` to report a mirror's HEAD.
- Skipped checks and assumptions: the plans were executed inline by the orchestrating agent after the planner subagent stopped; research lives in `12-CONTEXT.md`. This re-verification did not run `npm run check` (per instruction), the full cucumber suite, the e2e tests, or a fresh negative control for the revision step (carried from the first verification; the step file is unchanged).

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
