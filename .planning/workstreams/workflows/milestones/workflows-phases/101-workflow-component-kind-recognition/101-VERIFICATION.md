---
phase: 101-workflow-component-kind-recognition
verified: 2026-08-14T20:30:00Z
status: passed
score: 4/4 roadmap success criteria verified (31/31 plan-level must-have truths independently spot-checked, 0 failures)
behavior_unverified: 0
overrides_applied: 0
re_verification: null
---

# Phase 101: Workflow component-kind recognition Verification Report

**Phase Goal:** A plugin carrying workflow scripts is recognized as carrying installable workflow
components -- whether it declares them in its manifest or ships them by convention -- and its
resolved sources are enumerable by the same per-kind shape every other component kind uses.
**Verified:** 2026-08-14T20:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A plugin with `<pluginRoot>/workflows/*.js` and no `workflows` manifest field resolves with those scripts counted as workflow components | VERIFIED | `domain/resolver.ts:338,355` -- `workflows` last in `SUPPORTED_COMPONENT_KINDS` and `SUPPORTED_COMPONENT_PATH_KINDS`; `collectStrictComponentKind` unchanged (both-axes reuse). `tests/domain/resolver-strict.test.ts:1103` "WFLW-01 implicit-by-convention populates componentPaths.workflows..." asserts `state: "installable"`, `componentPaths.workflows === ["workflows"]`, `supported.includes("workflows")`. Ran directly: pass. |
| 2 | A plugin declaring the `workflows` manifest field resolves the declared paths in both string and array form; a declared path that does not exist is treated exactly as existing per-kind path validation treats it | VERIFIED | `tests/domain/resolver-strict.test.ts:1143` (string form), `:1160` (array form, first-wins dedup, NFC/NFD encoding case), `:1217` (declared+convention union, declared-first), `:1233` ("accepted with NO note" -- shape-only validation, never stats), `:1247` (escaping path -> `unavailable`, asserted at parity with `skills`). All ran directly: pass. |
| 3 | A workflow-bearing plugin reports a workflow component count on `list` and `info` instead of resolving as though the directory were not there | VERIFIED (per locked split, see below) | **`info` half:** `orchestrators/plugin/info.ts` `nameFromEntry`/`discoverComponentNames` widened to `"workflows"` with `.js` suffix, `composeResolvedComponents` spreads `workflows` last; `shared/notify.ts` `COMPONENT_KINDS` grown to 6 slots, `workflows` last. `tests/orchestrators/plugin/info.test.ts:441` asserts the exact rendered line `    workflows: deploy, release`, positioned after `skills:`. `tests/architecture/catalog-uat.test.ts` `installed-single-scope-with-workflows` state byte-equality-gates the same line against `docs/output-catalog.md`, both walk directions pass. **`list` half:** `list` renders no per-kind component enumeration (verified by reading `orchestrators/plugin/list.ts` rendering path -- every reason token derives from `unsupported[]`, nothing reads `supported[]`); the criterion is satisfied at the STATE level: `compatibility.supported` records `"workflows"`, pinned by `tests/orchestrators/reconcile/backfill.test.ts` (BFILL-01 re-materialize case) and `tests/orchestrators/plugin/update.test.ts` (D-99-05a disabled-record refresh case). Both ran directly: pass. |
| 4 | Consumers can enumerate a resolved plugin's workflow sources through `componentPaths.workflows`, and the closed-set architecture gates pass with the new member counted | VERIFIED | `componentPaths.workflows` is a **required** (non-optional) member of `ComponentPathsSchema`, `PartialResolution.componentPaths`, and `emptyResolution()` (`domain/resolver.ts:71,401,429`) -- confirmed by direct read, no `?? []` anywhere. `npm run typecheck` exits 0 (ran directly). `tests/architecture/hooks-foundation.test.ts:199` pins `SUPPORTED_COMPONENT_KINDS` as the 5-tuple `[skills,commands,agents,hooks,workflows]`. `tests/architecture/compat-01-no-expansion.test.ts` and `tests/architecture/notify-closed-set-locks.test.ts` pass **unedited** (`git diff` confirms zero changes to either file across the whole phase). All ran directly: pass. |

### SC 3 split judgment (locked user decision)

Verified as specified: `list` renders no component enumeration on any of its rows -- every
token derives from `compatibility.unsupported`, confirmed by reading the `list` render path.
Nothing reads `supported`. The `list` half is therefore correctly satisfied at the state level
(`compatibility.supported` recording `"workflows"`) rather than by a rendered token, and no
reason/status token or glyph was minted -- which is the required outcome, not a gap. The `info`
half is satisfied at the render level by the `workflows:` line, gated by the byte-equality
catalog contract. No real gap found in this split; the locked decision holds.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `workflows` in both tuples + required `componentPaths.workflows` | VERIFIED | Confirmed by direct read: lines 71, 338, 355, 401, 429. |
| `extensions/pi-claude-marketplace/domain/components/plugin.ts` | `workflows` field in `SUPPORTED_COMPONENT_PATH_FIELDS` | VERIFIED | Line 28: `workflows: Type.Optional(Type.Unknown())`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | `.js` arm of `nameFromEntry`, widened `discoverComponentNames`, `workflows` in `composeResolvedComponents` | VERIFIED | Confirmed by direct read: lines 277-289 (suffix chosen by kind, stripped by `suffix.length` -- NOT a hard-coded count, closing the trap named in the verification brief), 321, 673-736. |
| `extensions/pi-claude-marketplace/shared/notify.ts` | `workflows` member on `PluginInfoComponentsResolved.components`, six-slot `COMPONENT_KINDS` | VERIFIED | Lines 1398, 3309-3316. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `domain/resolver.ts` | `orchestrators/plugin/info.ts` | `componentPaths.workflows` read by `composeResolvedComponents`, passed to `discoverComponentNames` | WIRED | `info.ts:704-707` calls `discoverComponentNames(pluginRoot, resolved.componentPaths.workflows, "workflows")`. |
| `orchestrators/plugin/info.ts` | `shared/notify.ts` | `components.workflows` rendered by `appendResolvedComponentLines` iterating `COMPONENT_KINDS` | WIRED | `notify.ts:3335` loop over `COMPONENT_KINDS` (includes `"workflows"`); `info.test.ts:441` proves the line actually renders end-to-end. |
| `orchestrators/reconcile/apply.ts` (backfill) | `state.json` `compatibility.supported` | `supportedSetGrew` re-materializes and records `"workflows"` | WIRED | `tests/orchestrators/reconcile/backfill.test.ts` BFILL-01 case, ran directly: pass. |
| `orchestrators/plugin/update.ts` (disabled-record refresh) | `state.json` `compatibility.supported` | D-99-05a refresh path | WIRED | `tests/orchestrators/plugin/update.test.ts` D-99-05a case + its idempotence sibling, ran directly: pass. |

### The `nameFromEntry` trap (specifically requested check)

Closed. `orchestrators/plugin/info.ts:283-289`:

```ts
const suffix = kind === "workflows" ? ".js" : ".md";
return entry.isFile() && entry.name.endsWith(suffix)
  ? entry.name.slice(0, -suffix.length)
  : undefined;
```

The strip is `-suffix.length`, not a hard-coded literal count -- a longer suffix admitted later
stays correct. `tests/orchestrators/plugin/info.test.ts:441` proves a `.js` entry actually
produces its stem end-to-end (not just that the union compiles): `deploy.js` -> `deploy`,
`release.js` -> `release`, both rendered on the `workflows:` line.

### Compile-forced closed set (specifically requested check)

`npm run typecheck` exits 0 (ran directly, this session). `componentPaths.workflows` is
`Type.Array(Type.String())` -- a required schema member, not optional, on `ComponentPathsSchema`.
No `?? []` construction found anywhere in the tree.

### Scope-creep scan (specifically requested check)

| Check | Result |
|-------|--------|
| `acorn` dependency / `meta.name` parsing | Absent -- `grep -rn "acorn"` and `grep -rn "meta\.name"` under `extensions/` return nothing. |
| `bridges/workflows/` or any new bridge directory | Absent -- `ls extensions/pi-claude-marketplace/bridges/` shows only the pre-existing five (`agents, commands, hooks, mcp, skills`). |
| Workflow artifact writes | None -- `git diff --stat` across the phase touches zero files under `bridges/`, `persistence/locations.ts`, or `shared/path-safety.ts`. |
| Containment root (NFR-10) changes | None -- `locations.ts` / `path-safety.ts` untouched (confirmed by empty `git diff --stat`). |
| Lifecycle-verb artifact handling (install/uninstall ledgers) | None -- no `orchestrators/plugin/install.ts` / `uninstall.ts` / phase-ledger files in the changed-file list. |
| Host-engine probe / soft-dependency marker / degradation reason | Absent -- `grep -rn "workflow_control\|workflowControl"` returns nothing. |

### No closed-set churn (specifically requested check)

`tests/architecture/compat-01-no-expansion.test.ts` and `tests/architecture/notify-closed-set-locks.test.ts`
pass, and `git diff b32c9737~1 aea610fb -- <both files>` is empty -- confirmed unedited across
every commit in the phase. No reason token, status token, glyph, persisted state field, or
schema version was added anywhere in the diff.

### Comment policy (specifically requested check)

Scanned every `+` line added across `extensions/`, `tests/`, `docs/` for `Phase NN`, `Plan NN`,
`Wave N`, `Task N`, `Pitfall N`, `Pattern N` tokens. One hit: `Phase 44` in
`docs/output-catalog.md`'s `info` section preamble -- confirmed **pre-existing** (present in both
the `-` and `+` sides of the diff; this phase only appended kind names to the same sentence, and
it is markdown prose, not a source comment or test title, so the rule does not even formally
apply to it).

The pre-existing bare `Pitfall 4 / D-68-03` token at `tests/orchestrators/reconcile/backfill.test.ts:329`
(`git blame` -> commit `c695bdab3`, dated 2026-07-01, ~6 weeks before this phase) is confirmed
pre-existing, not a phase regression, matching plan `101-04`'s own disclosure. Correctly left
alone -- fixing it would have enlarged the diff outside this phase's blast radius.

### Anti-Patterns Found

None. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all 14 files this phase modified
under `extensions/` and `tests/` (plus `docs/output-catalog.md`) returns zero matches.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| WFLW-01 | 101-01, 101-02 | Convention-only recognition | SATISFIED | `resolver-strict.test.ts` WFLW-01 case, ran directly: pass |
| WFLW-02 | 101-01, 101-02 | Declared manifest field (string/array), containment, dedup, loose mode | SATISFIED | 9 resolver-strict + 3 resolver-loose cases, ran directly: pass |
| WFLW-03 | 101-01, 101-03, 101-04 | No zero-signal outcome; `list`/`info` report the kind | SATISFIED | resolver zero-signal case, `info.test.ts` render case, catalog byte-equality gate, backfill re-materialize case -- all ran directly: pass |
| WFLW-04 | 101-01, 101-04 | `componentPaths.workflows` enumerable; closed-set gates pass | SATISFIED | `npm run typecheck` exit 0, `hooks-foundation.test.ts` closed-set pin, `compat-01-no-expansion.test.ts` + `notify-closed-set-locks.test.ts` unedited-and-passing |

`REQUIREMENTS.md` rows for WFLW-01..04 are marked `[x]` / `Complete`, consistent with the
phase's plan-04-scoped bookkeeping decision (all four plans carry the same four IDs; marking
was correctly deferred to the phase's last plan).

### Known deviations (judged, not re-litigated)

1. **`workflows: ""` (empty declared path) is admitted, not rejected.** Confirmed as
   pre-existing, kind-agnostic behavior (`path.resolve(pluginRoot, "")` returns `pluginRoot`,
   which passes containment) -- identical for `skills`/`commands`/`agents`. Pinned as a parity
   contract in `tests/domain/resolver-strict.test.ts:1342`, ran directly: pass. Correctly scoped
   as a forward dependency for the materialization phase rather than an out-of-scope production
   fix. Accepted.
2. **REQUIREMENTS.md marking deferred to plan 101-04.** Consistent with the phase-scoped
   traceability-row granularity; confirmed rows are now `[x]`/`Complete`. Accepted.
3. **STATE.md hand-repairs.** Confirmed `.planning/workstreams/workflows/STATE.md` reflects
   `current_plan: 4 of 4`, all four plans checked off in `ROADMAP.md`, and the decision log is
   coherent. Not treated as a defect.

### STATE.md coherence -- two residual bookkeeping issues (non-blocking)

Not part of the phase's code deliverable and not a goal-achievement gap, but flagged since the
brief asked for a coherence check:

- `milestone_name: "**Phase Numbering:**"` in `STATE.md` frontmatter is malformed -- it appears
  to have captured a markdown heading rather than the milestone's actual name (`workflows`).
- The phase table in `STATE.md` still reads `| 101 | ... | In progress (2/4 plans) |`, stale
  against `current_plan: 4 of 4 (phase 101)` two lines above it and against all four
  `101-0N-SUMMARY.md` files being on disk.

Both are GSD-tooling metadata artifacts, not code or test defects, and do not affect any of the
four success criteria. Recommend a follow-up STATE.md field correction at phase-complete time;
not a blocker for this phase's verification.

### Behavioral Spot-Checks

`npm run check` (`typecheck && lint && format:check && test && test:integration`) run directly
in this session: **exit code 0**. In addition, ran the full set of phase-relevant suites directly
and standalone rather than trusting the SUMMARY claims:

```
node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts \
  tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/architecture/hooks-foundation.test.ts \
  tests/orchestrators/plugin/info.test.ts tests/architecture/catalog-uat.test.ts \
  tests/orchestrators/reconcile/backfill.test.ts tests/orchestrators/plugin/update.test.ts
```

Result: `# tests 335 / # pass 335 / # fail 0`.

### Probe Execution

Not applicable -- this phase ships no `scripts/*/tests/probe-*.sh` and none is referenced by its
PLAN/SUMMARY files.

### Human Verification Required

None. All four success criteria, the compile-forced closed set, the `nameFromEntry` trap, and
the no-scope-creep / no-closed-set-churn / comment-policy checks were verified against the
codebase directly (typecheck, targeted test runs, `npm run check`, and source reads) rather than
by trusting SUMMARY.md narrative.

### Gaps Summary

None. All four ROADMAP success criteria are verified against the codebase with passing,
independently-executed tests. The compile-forced closed set is genuinely closed
(`npm run typecheck` exit 0, zero `?? []`). The `nameFromEntry` silent-failure trap named in the
verification brief is closed by a length-derived suffix strip, proven end-to-end by a rendered-line
assertion, not merely a compiling union. No scope crept into Phase 102/103/105 territory. No
closed-set architecture gate was edited. No debt markers. The one bare `Pitfall 4` comment-policy
item found is pre-existing and outside this phase's blast radius, matching the phase's own
disclosure. Two STATE.md bookkeeping fields are stale but are tooling metadata, not code defects.

---
*Verified: 2026-08-14T20:30:00Z*
*Verifier: Claude (gsd-verifier)*
