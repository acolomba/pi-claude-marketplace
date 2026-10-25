---
phase: 30-autoapply-setting
verified: 2026-10-25T12:10:00Z
status: human_needed
score: 9/11 must-haves verified
covered_files:
  - .planning/phases/30-autoapply-setting/30-01-PLAN.md
  - .planning/phases/30-autoapply-setting/30-01-SUMMARY.md
  - CHANGELOG.md
  - README.es.md
  - README.md
  - docs/dependency-resolution.md
  - docs/json-output.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/persistence/config-io.ts
  - extensions/pi-claude-marketplace/persistence/config-merge.ts
  - features/plugin/autoapply.feature
  - test/index.test.ts
  - test/integration/mcp-migration.test.ts
  - test/integration/workflow-kind-inversion.test.ts
  - test/orchestrators/auth-host.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/persistence/config-io.test.ts
  - test/persistence/config-merge.test.ts
covered_digest: "v3:sha256:8d98330c7ab7e3f8a713641b4284b9884de310b6f0615d44127f1385e776f805"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Decide on plan truth 8: AAP-D1 recorded in AGENTS.md's network policy"
    expected: "Either accept the deviation (PROJECT.md Constraints and the AAP-D1 decision row carry the NFR-5 amendment; AGENTS.md left alone deliberately) by adding the override below, or edit AGENTS.md"
    why_human: "PLAN must_haves truth 8 and CONTEXT D-01/D-11 name AGENTS.md; the code base shows AGENTS.md unchanged. The orchestrator reports this as deliberate, which is a user decision, not something the verifier can grant"
resolved_after_verification:
  - "SC-4: orchestrator's `npm run check` on 521d9f10 exited 0 (output to a log file, exit status read directly)"
  - "Review WR-01 (round 2) is tracked as BACKLOG APPLYTHROW-01"
---

# Phase 30: Autoapply Setting Verification Report

**Phase Goal:** A user who opts in through the plugin configuration gets the desired state on load, with no `apply` or `/reload` to type; everyone else keeps phase 29's read-only load.
**Verified:** 2026-10-25T12:10:00Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| # | Truth (source) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC-1 / AAP-01: with `autoapply` unset or false, a load after a config change prints `pending`'s block with the apply trailer and changes no state | VERIFIED | `load.ts:90` only calls the apply step when `loadAutoapply` is true; otherwise the phase 29 read-only pass runs unchanged. Every pre-existing `load.test.ts` case is built with `applyNeverRuns` (line 54), so the unset case proves apply is never called. Scenarios "A config that turns autoapply off keeps a new session read-only" and both precedence-off scenarios assert `will install` + needs apply, no installed plugins, no skills (passed). |
| 2 | SC-2 / AAP-02: with `autoapply: true`, a session start installs declared path- and git-source plugins, reports apply's rows, and offers their skills in the same session; a config or catalog change plus `/reload` is applied the same way | VERIFIED | `index.ts:91` binds `createLoadReconcile({ loadState }, applyReconcile)`; `prepareResources` runs the load before `aggregateDiscoveredResources` (index.ts:160-170). `test/index.test.ts` "AAP-02 / D-06: an autoapply reload ... the same discover returns its skill" drives a `reload` discover event and asserts the installed row and the skill path from that one call. Scenarios: path-source tracer, git-source clone (git host requests asserted), user-config autoapply, catalog move after `marketplace update` (`updated` 1.0.0 to 1.1.0, skill 1.1.0 offered), all passed. |
| 3 | SC-3 / AAP-03 / NFR-2: a load-time apply failure never throws out of the load; it reports failed rows and what is still pending stays listed | VERIFIED | Per-entry failures stay rows inside apply (scenario "A failed install during an autoapply session..." asserts `(failed) {source missing}` and then `pending --scope project` lists `will install`). A held lock is a row in the shared read pass (`read-pass.test.ts` "WR-01: a scope lock another process holds..."), a refused move is its own row (`apply.test.ts` LOAD-01 / D-05-16 cases). A throw escaping apply is caught in `load.ts:101-108`, reported as `reconcile-aborted`, then the read-only pass runs (`load.test.ts` "AAP-03 ... then the load prints the pending block"; `index.test.ts` "AAP-03 ... still discovers resources"). Known limit: review WR-01 (rows committed before a mid-pass throw are not reported); see Gaps Summary. |
| 4 | SC-4: `npm run check` stays green | UNCERTAIN | Not run by the verifier (instruction: the orchestrator runs it concurrently). Partial evidence: `tsc --noEmit` exit 0; `eslint --no-cache --max-warnings 0` over the six changed source files exit 0; owner suites 302/302 pass; `features/plugin/autoapply.feature` 10/10. Human item 1. |
| 5 | PLAN: the schema accepts an optional boolean `autoapply`; a non-boolean makes that file `invalid` (D-02, D-03) | VERIFIED | `config-io.ts:78` `autoapply: Type.Optional(Type.Boolean())`; config-io tests pass; scenario with `"autoapply": "yes"` reports `schema validation failed: /autoapply: must be boolean`. |
| 6 | PLAN: effective value from the most specific layer (project local, project base, user local, user base, else false); any invalid file keeps the load read-only (D-03, D-04) | VERIFIED | `config-merge.ts:206-237` (`resolveAutoapply` fails closed on any `invalid`, then first set value wins; `loadAutoapply` orders the four paths most specific first). `config-merge.test.ts` `loadAutoapply` table (each layer, both invalid positions) passes; scenarios cover local-false-over-base-true, project-false-over-user-true, project-local-true-over-user-false, and invalid-beside-true. |
| 7 | PLAN: with the value true, the load runs apply for both scopes before resource discovery (D-05, D-06) | VERIFIED | `load.ts` passes no `scope`, and `apply.ts:1178` defaults to `["project", "user"]`. Ordering is enforced by `await prepareResources` before `aggregateDiscoveredResources` in `index.ts`. |
| 8 | PLAN: an autoapply load with nothing to change prints nothing; one that changed something prints apply's report (D-07) | VERIFIED | `apply.ts:1228` guards only the `reconcile-pending-empty` notify on `run.origin.kind !== "load"`; `apply.test.ts` "AAP-02 / D-07: an autoapply load with nothing to change prints nothing" passes; scenarios show one `reconcile-applied-cascade` for the applying load and silence from the second bind's load. |
| 9 | PLAN: a failure is a row or the reconcile-aborted row, the load still returns resources, and `pending` still lists the change (D-09, D-13) | VERIFIED | Same evidence as truth 3. |
| 10 | PLAN: `load.ts` names no git surface; it reaches the network only through the injected apply step (BLOCK F) | VERIFIED | `load.ts` imports `config-merge`, `locations`, `debug-log`, `errors`, `notification-dispatch`, `pending`, `read-pass` only; ESLint (BLOCK F included) exit 0 on it. |
| 11 | PLAN: AAP-D1 recorded in 30-CONTEXT.md and AGENTS.md's network policy | UNCERTAIN | 30-CONTEXT.md D-01 and `.planning/PROJECT.md` (network policy clause and AAP-D1 decision row) carry it; AGENTS.md is unchanged (`git diff 45b1b8de..HEAD -- AGENTS.md` is empty). Reported as deliberate; needs a user decision (human item 2). |

**Score:** 9/11 truths verified (0 present, behavior-unverified; 2 uncertain, routed to human)

Additional, beyond the plan: `auth-host.ts:186` gives a non-command run the stored-credential bundle, so an autoapply load never starts the Device Flow (D-13). Unit test "AAP-02 / D-13" passes; review round 2 traced every non-command `openNotificationRun` caller and found no other path that reaches `buildAuthForHost`.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `persistence/config-merge.ts` | `resolveAutoapply` (pure) and `loadAutoapply` | VERIFIED | Both present; `resolveAutoapply` module-private (fallow unused-export), tested through `loadAutoapply` with real files in a hermetic home |
| `orchestrators/reconcile/load.ts` | `createLoadReconcile(reader, applyReconcile)` branching on `loadAutoapply` | VERIFIED | Substantive, wired from `index.ts` |
| `features/plugin/autoapply.feature` | AAP-01..03 scenarios | VERIFIED | 10 scenarios, 129 steps, all pass |
| README.md / README.es.md | Autoapply section: key, default, precedence, invalid case, risk warning, upstream comparison | VERIFIED | Both have the section with matching content |
| CHANGELOG.md, docs/{plugin-enablement,output-catalog,json-output,dependency-resolution}.md | Autoapply exception noted | VERIFIED | One CHANGELOG bullet; each doc gains the exception |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `index.ts` | `reconcile/load.ts` | `createLoadReconcile({ loadState }, applyReconcile)`; called with `completionCache` | WIRED | index.ts:91 and :129 |
| `reconcile/load.ts` | `persistence/config-merge.ts` | `loadAutoapply(locationsFor("project", cwd), locationsFor("user", cwd))` before choosing a pass | WIRED | load.ts:90 |
| `reconcile/load.ts` | `reconcile/apply.ts` | injected apply step with ctx, run (origin `load`), cwd, hooksRouting, completionCache, migrateMcpEntries | WIRED | load.ts:92-99; `load.test.ts` "AAP-02 / D-22" proves the MCP move is passed through |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Owner unit suites | `node --test test/persistence/config-io.test.ts test/persistence/config-merge.test.ts test/orchestrators/reconcile/load.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/auth-host.test.ts test/index.test.ts` | 302 pass, 0 fail | PASS |
| Behavioral scenarios | `npx cucumber-js features/plugin/autoapply.feature` | 10 scenarios, 129 steps passed | PASS |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | exit 0 | PASS |
| Lint, changed sources | `npx eslint --no-cache --max-warnings 0 <6 source files>` | exit 0 | PASS |

The failing-direction checks in the SUMMARY (branch forced off, OR-combined precedence, schema field removed) were not re-run: they need source edits, which this verification may not make. The scenario assertions are full row tables, and the precedence scenarios assert opposite outcomes, so the claimed failures are consistent with the scenario text.

### Probe Execution

Not applicable: the phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AAP-01 | 30-01 | Boolean `autoapply`, default off; off means APL-03 | SATISFIED | Truths 1, 5 |
| AAP-02 | 30-01 | On: a load runs apply, clones on cache miss, installed plugins available in that session; any config may turn it on | SATISFIED | Truths 2, 6, 7, 8 |
| AAP-03 | 30-01 | A load-time apply never throws out of the load; failures are rows, unmade changes stay pending | SATISFIED | Truths 3, 9 (WR-01 limit noted) |

No orphaned requirements: REQUIREMENTS.md maps only AAP-01..03 to Phase 30. Their checkboxes and traceability rows still read Pending; the phase-completion step updates them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (phase diff) | - | TBD / FIXME / XXX / TODO / HACK | none found | - |

### Human Verification Required

1. **`npm run check` result (SC-4).** Read the orchestrator's concurrent run on head 521d9f10. Expected: exit 0. The verifier did not run it, by instruction.
2. **AGENTS.md network policy (plan truth 11).** The plan and CONTEXT D-01/D-11 say AGENTS.md carries the AAP-D1 amendment; it does not. PROJECT.md does. To accept the deviation, add to this file's frontmatter:

   ```yaml
   overrides:
     - must_have: "AAP-D1 (no trust gate, the risk, the Claude Code comparison) is recorded in 30-CONTEXT.md and AGENTS.md's network policy"
       reason: "AGENTS.md left unedited deliberately; the NFR-5 amendment and AAP-D1 are recorded in .planning/PROJECT.md Constraints and the decision table"
       accepted_by: "<name>"
       accepted_at: "<ISO timestamp>"
   ```

3. **Carrier for review WR-01 (round 2).** Accepted as open, but nothing in BACKLOG.md tracks it. Decide whether to add an entry.

### Gaps Summary

No blocking gap. The goal holds in the code: the setting exists, it is resolved by precedence and fails closed, an on value makes `resources_discover` run apply before discovery for both scopes, and an off value leaves the phase 29 load untouched.

Open warning (accepted, not blocking): review WR-01, round 2. When the apply step throws mid-pass (GHB-03, an invalid `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`), the rows for changes already committed are dropped, so no `/reload` trailer appears for them. Under autoapply, a project-scope MCP move that committed before the throw also loses its one-time AMIG-03 notice for good, because the read-only rerun finds no marked entries. `/claude:plugin apply` drops the same rows today. SC-3 still holds: the load does not throw, the abort is reported, and unmade changes stay pending. The lost MCP notice is a regression relative to the read-only load, but only in this narrow environment-error case.

---

_Verified: 2026-10-25T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
