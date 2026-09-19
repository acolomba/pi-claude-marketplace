# Phase 8: Final Verification and Reconciliation - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 7 (1 new, 6 modified/moved; all planning records, no source or test code)
**Analogs found:** 7 / 7

All analogs are git-tracked planning files (verified with `git ls-files`). Line numbers are at HEAD `e433c5bf`; BACKLOG.md line numbers shift as soon as the FLOW-05 closure is inserted (it sits above SWTEST-01 and NEGCTL-01), so edit bottom-up or re-grep headings before each edit.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/phases/08-final-verification-and-reconciliation/08-MEASUREMENT.md` (new) | measurement record | batch (gate run -> tables) | `.planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md` | exact |
| `.planning/BACKLOG.md` -- FLOW-05 heading + closure paragraph (line 392) | backlog closure note | additive transform | `BACKLOG.md:2891-2900` (NEGCTL-01 closure); heading form from `BACKLOG.md:1978` (AGCOL-01) | exact |
| `.planning/BACKLOG.md` -- SWTEST-01 heading only (line 2811) | backlog heading flip | additive transform | `BACKLOG.md:1978` (AGCOL-01), `BACKLOG.md:2936` (E2EIMP-01) | exact |
| `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md` -> `.planning/todos/completed/` | todo closure + move | file-I/O (git mv) | `.planning/todos/completed/2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md` (location); own body's `**Promoted 2026-09-14:**` lead (paragraph style) | role-match |
| `.planning/REQUIREMENTS.md` (lines 31-32, 54-55) | requirement bookkeeping | transform | `git show 5b927ce6 -- .planning/REQUIREMENTS.md` | exact |
| `.planning/ROADMAP.md` (lines 21, 146, 161) | roadmap bookkeeping | transform | `git show 5b927ce6 -- .planning/ROADMAP.md` | exact |
| `.planning/STATE.md` (frontmatter, Current Position, deferred row line 97) | state bookkeeping | transform | `git show 5b927ce6 -- .planning/STATE.md`; deferred-row wording from `STATE.md:93-95` | exact |

## Pattern Assignments

### `08-MEASUREMENT.md` (measurement record, batch)

**Analog:** `.planning/phases/07-reliable-coverage-metrics/07-MEASUREMENT.md` (259 lines)

**Section skeleton** (headings at lines 1, 5, 13, 54, 67, 83, 115, 133, 206):
```markdown
# Phase 7 -- Certified production coverage measurement
## 1. Stability preconditions
## 2. Run identity and fingerprints
## 4. Denominators
## 5. Independent verification
## 6. Syntax deficits
## 7. CRAP distribution (policy 30, unrounded arithmetic)
## 8. Discrepancy dispositions and activation conditions (Task 2)
## 9. Activation (Plan 07-08)
### 9.2 The final run
```
Phase 8 adaptation (RESEARCH Pattern 2): 1 Preconditions; 2 `check` chain member by member; 3 Additional gates (e2e, direct:all, pre-commit with before/after `git status`); 4 Aggregate unit coverage; 5 Deficits and CRAP distribution; 6 Red classification; 7 What did not change; 8 Item reconciliation table.

**Opening-paragraph pattern** (lines 1-3) -- state what was run and that no figure is copied from research:
```markdown
Plan 07-07 measures the stable post-Phase-6 production tree with the accepted producer and records the result here. Every figure below was measured on the two runs named in this document; no figure is copied from the exploratory research capture or from an earlier plan's working run.
```

**Preconditions table** (lines 5-11) -- cite the prior VERIFICATION frontmatter and the last commit per tree:
```markdown
| Precondition | Evidence |
| --- | --- |
| Phase 6 verification complete | `06-VERIFICATION.md`: `status: passed`, `score: 2/2 must-haves verified`, verified 2026-09-17T02:40:00Z |
| Phase 5/6 production and test writes finished | Last commit touching `extensions/`: `31ed3c72` (2026-09-17 10:38 -0400). ... |
```

**Command / exit / seconds / output row pattern** (lines 220-222, section 9.2):
```markdown
`npm run check` on HEAD `e4ca798a8fbe811f708da54b046bf01689904b57` (the final code tree; ...): exit 0 in 1287 s (21 min 27 s), started 2026-09-18T20:21:52Z. The capture inside the chain is run `20260918T202613550Z-e88ba46e`, started 20:26:13, completed 20:32:24, accepted 20:33:31; 312 workers, 543 raw records, 618 modules loaded, 9 unloaded production sources; ... `npm run test:coverage:direct:all` afterwards: exit 0 in 494 s, `All-pair run complete: 239 pairs`, `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly`.
```
Phase 8 uses the tabular form from RESEARCH.md "Live Gate Measurements" (`| # | Command | Exit | Seconds | Counts / output line |`) with one row per `check` member, exit captured as `rc=$?` directly, never through a pipe.

**Denominators table, both models kept apart** (lines 56-64):
```markdown
| Model | Files | Functions | Statements or lines | Branches |
| --- | --- | --- | --- | --- |
| Native (Node's LCOV over the 230 loaded production files) | 230 records | 1890/1890 | 63825/63825 lines | 9234/9234 blocks |
| Syntax (the accepted Istanbul map over all 239 production files) | 239 | 1865/1865 | 10392/10393 statements | 6633/6653 arms |

The native invariant of D-01 holds: 100.00 percent lines, functions and branches, with zero `DA:...,0`, `BRDA:...,0` or `FNDA:0,...` entries in `coverage/unit.lcov`.
```

**Independent-recount row pattern** (lines 71-74):
```markdown
| Check | Result |
| --- | --- |
| LCOV totals recounted line by line | records 230, LF 63825, LH 63825, FNF 1890, FNH 1890, BRF 9234, BRH 9234: equal to `acceptance.denominators.native` |
| Map totals recounted over `f`, `s`, `b` | 239 files, functions 1865/1865, statements 10392/10393, arms 6633/6653: equal to `acceptance.denominators.syntax` |
```
The recount script is in RESEARCH.md "Code Examples"; fingerprints use `sha256sum` first-16 hex as in section 9.2's table (`| LCOV \`coverage/unit.lcov\` | \`9b11e54120f56e0b\`; zero ... entries |`).

**CRAP histogram** (lines 119-125): `| Score | Functions |` with rows `below 5`, `5 to 9.99`, `10 to 19.99`, `20 to 29.99`, `30 or more`, followed by bullets for maximum, the partial function, and `failures` empty.

**"Nothing loosened" statement** (line 218) -- copy this sentence shape into section 7 of the new document:
```markdown
No production source under `extensions/` changed. No coverage configuration, census pin, threshold, suppression, direct pin or `.fallowrc.json` value changed; `maxCrap: 0` stays disabled and the policy stays 30.
```

**Classification-table pattern for the expected red** (lines 246-253, section 9.4 `| Run | Made by | Outcome |`) -- the same three-column shape becomes `| Command | Verbatim error | Classification (regression/environment), cause, debt or fix |` for the TruffleHog row.

---

### `.planning/BACKLOG.md` -- FLOW-05 closure (backlog closure note, additive)

**Analog:** `BACKLOG.md:2891-2900` (NEGCTL-01) for the paragraph; `BACKLOG.md:1978` (AGCOL-01) for the heading.

**Current text to preserve intact** (lines 392-417; heading changes, body stays, closure paragraph inserted between heading and "Filed 2026-08-16 ..."):
```markdown
## FLOW-05: revisit CRAP and real coverage in the fallow health gate

Filed 2026-08-16 alongside the FLOW-04 closure (quick task 260816-qov).
```

**Heading form** (line 1978, majority style):
```markdown
## ~~AGCOL-01: the agents collision gate is dead by the same argument that retired the skills one~~ — CLOSED
```

**Closure paragraph** (lines 2893-2900, copy shape verbatim, adapt IDs):
```markdown
Closed 2026-09-14 in test-backlog Phase 1. The failure was isolated to the
sandbox/process-pipe observation path on Node v26.8.2; file-backed separate
stdout/stderr capture preserves the exact CLI diagnostic. Launch errors,
signals, wrong status, and missing diagnostics have discriminating controls.
The full negative suite passes inside and outside the sandbox; independent
GSD review found no issues and verification passed 5/5. See
[verification](phases/01-reliable-negative-controls/01-VERIFICATION.md).
The original report below is preserved as history.
```
Shape: date + phase; what now holds (CRAP measured from the verified Istanbul map via `scripts/coverage-unit.mjs`, gated at 30 by `scripts/coverage-risk-policy.json` through `npm run coverage:risk`; `.fallowrc.json` `maxCrap: 0` unchanged by design); verification status and score with relative link `phases/07-reliable-coverage-metrics/07-VERIFICATION.md` (frontmatter `8/8`, body says 10/10 -- cite frontmatter, note body); fresh result (0 of 1865 at or above 30, max 20.00); the "original report below is preserved as history" sentence. Hard-wrap around 80 columns like the analog.

---

### `.planning/BACKLOG.md` -- SWTEST-01 heading (heading flip only)

**Analog:** `BACKLOG.md:1978` (AGCOL-01), `BACKLOG.md:2936` (E2EIMP-01).

**Current** (line 2811; body at 2813-2823 already opens `**Closed 2026-09-14 — test-backlog Phase 2.**`):
```markdown
## SWTEST-01: the Sonar way ruleset stops at `extensions/`; `tests/` is unmeasured by it
```
**Target form** (E2EIMP-01, line 2936, shows the strikethrough wrapping inline code correctly):
```markdown
## ~~E2EIMP-01: three `import` e2e tests assert a summary header the command no longer emits~~ -- CLOSED
```
Note the file mixes `--` and `—` before CLOSED (AGCOL-01 uses `—`, NEGCTL-01/E2EIMP-01 use `--`); either is in force. Do not touch the body.

---

### Todo move: `todos/pending/2026-09-02-detect-unused-code-and-type-members.md` -> `todos/completed/`

**Analog:** `.planning/todos/completed/2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md` (location; completed todos keep their original filename and frontmatter unchanged -- lines 1-10 there are the original `created:`/`title:`/`area:`/`files:` block).

**Move mechanism** (RESEARCH "Closing the todo"): `git mv` so the rename stays in history; stage both paths.

**Closure-paragraph placement** -- the todo's own body already uses the bold-lead disposition style under the H1 (lines 10-13):
```markdown
# No gate detects an unused type member

**Promoted 2026-09-14:** explicitly authorized for test-backlog Phase 6,
MEMBER-01/02. The older exclusions below are historical, not current scope.

**Disposition 2026-09-11: `deferred` to v1.19.** ...
```
Insert a new `**Closed 2026-09-18 — test-backlog Phase 6.** ...` paragraph directly under the H1, above the `**Promoted 2026-09-14:**` paragraph, citing `06-VERIFICATION.md` (`status: passed`, `2/2`) with a relative link (`../../phases/06-unused-type-member-gate/06-VERIFICATION.md` -- confirm the directory name with `ls .planning/phases/` before writing) and the fresh `npm run lint:type-members` line (`Unused type member gate passed with 5 recorded exception(s).`). Leave frontmatter (`resolves_phase: 6`, `audit_acknowledged`) untouched.

---

### `.planning/REQUIREMENTS.md` (bookkeeping)

**Analog:** `git show 5b927ce6 -- .planning/REQUIREMENTS.md` (Phase 7 close). Exact same two hunks, one phase later:
```diff
-- [ ] **METRIC-01**: Reliably convert current unit coverage to Fallow-compatible Istanbul JSON and verify measurement fidelity.
-- [ ] **METRIC-02**: Select and validate a CRAP metric policy using real measurements and negative controls.
+- [x] **METRIC-01**: ...
+- [x] **METRIC-02**: ...
...
-| METRIC-01 | 7 | Pending |
-| METRIC-02 | 7 | Pending |
+| METRIC-01 | 7 | Complete |
+| METRIC-02 | 7 | Complete |
```
Phase 8: lines 31-32 `- [ ] **FINAL-01**` / `**FINAL-02**` -> `[x]`; lines 54-55 `| FINAL-01 | 8 | Pending |` / `| FINAL-02 | 8 | Pending |` -> `Complete`. Nothing else in the file changes.

---

### `.planning/ROADMAP.md` (bookkeeping)

**Analog:** `git show 5b927ce6 -- .planning/ROADMAP.md`. Three hunks:
```diff
-- [ ] **Phase 7: Reliable Coverage Metrics** — FLOW-05
+- [x] **Phase 7: Reliable Coverage Metrics** — FLOW-05 (completed 2026-09-18)
...
-**Plans:** 07-01 through 07-08 approved after independent plan review; ...
+**Plans:** 8/8 plans complete

 - [x] 07-01-PLAN.md
...
-| 7. Reliable Coverage Metrics | 8/8 | In Progress|  |
+| 7. Reliable Coverage Metrics | 8/8 | Complete    | 2026-09-18 |
```
Phase 8 targets (current text at HEAD): line 21 `- [ ] **Phase 8: Final Verification and Reconciliation** — All authorized items` -> `- [x] ... — All authorized items (completed <date>)`; line 146 `**Plans:** To be planned after discussion and live investigation.` -> `**Plans:** N/N plans complete` followed by the `- [x] 08-0N-PLAN.md` list (the planner writes the checklist when plans are created; the close flips the checkboxes); line 161 `| 8. Final Verification and Reconciliation | 0/TBD | Not started | - |` -> `| N/N | Complete | <date> |`.

---

### `.planning/STATE.md` (bookkeeping)

**Analog:** `git show 5b927ce6 -- .planning/STATE.md` (frontmatter + Current Position), plus the deferred-items table rows at `STATE.md:93-95` for the status-cell wording.

**Frontmatter hunk to imitate** (from the analog diff):
```diff
-current_phase: 07
-current_phase_name: Reliable Coverage Metrics
-status: verifying
-stopped_at: Completed 07-08-PLAN.md
+current_phase: 08
+current_phase_name: Final Verification and Reconciliation
+status: planning
+stopped_at: Phase 07 complete, ready to plan Phase 08
...
-  completed_phases: 6
+  completed_phases: 7
...
-  percent: 75
+  percent: 88
```
Phase 8 close: `completed_phases: 8`, `percent: 100`, `status` per milestone-close convention, `stopped_at:` kept to ONE line (the `phase.complete` truncation snag), `last_updated`/`last_activity`/`last_activity_desc`/`state_head` refreshed.

**Current Position hunk** (analog):
```diff
-Phase: 07 (Reliable Coverage Metrics) — EXECUTING
-Plan: 8 of 8
-Status: Phase complete — ready for verification
-Last activity: 2026-09-17 — Phase 07 execution started
+Phase: 08 — Final Verification and Reconciliation
+Plan: Not started
+Status: Ready to plan
+Last activity: 2026-09-18 — Phase 07 complete, transitioned to Phase 08
```
The new paragraph below it should cite the fresh bundle figures (63825/63825, 1890/1890, 9234/9234); the older "1833/1833 ... 9049/9049" paragraph is history and stays.

**Deferred-items row wording** (line 97 is the row to flip; lines 93-95 show the in-force closed wordings):
```markdown
| deferred_items | 06/deferred-items.md: 1. Stale notification hub reference outside Plan 06-19 callers | acknowledged — RESOLVED, condition no longer holds | 2026-09-13 | refine-unit-tests |
| deferred_items | 06/deferred-items.md: 2. Node 26 direct-coverage negative-control subprocess capture | acknowledged — promoted to backlog `NEGCTL-01` | 2026-09-13 | refine-unit-tests |
| Tooling        | Detect unused code and unused type members — ... | Pending         | Phase 116 discussion | v1.19     |
```
Flip only the status cell of the `Tooling` row, e.g. `closed — test-backlog Phase 6 (06-VERIFICATION 2/2); gate \`lint:type-members\` in \`check\``; keep the row on one line (the table is prettier-aligned with padded cells; a longer cell is fine, prettier reflows the column on the pre-commit run). The `todos | 2026-09-02-... | (presence-only)` row at line 99 may stay.

---

## Shared Patterns

### Additive closure, history preserved
**Source:** `BACKLOG.md:2891-2900` (NEGCTL-01), `BACKLOG.md:1978-1990` (AGCOL-01), todo body lines 10-13
**Apply to:** FLOW-05, SWTEST-01, the todo
Insert the closure above the original filing; change only the heading; never delete or reword original lines; end with the "preserved as history" sentence (or "Original filing follows as historical evidence" as SWTEST-01 does).

### Evidence citation shape
**Source:** `07-MEASUREMENT.md:9` and `BACKLOG.md:2898-2899`
**Apply to:** every disposition in 08-MEASUREMENT.md section 8 and every closure note
```markdown
`06-VERIFICATION.md`: `status: passed`, `score: 2/2 must-haves verified`, verified 2026-09-17T02:40:00Z
... verification passed 5/5. See [verification](phases/01-reliable-negative-controls/01-VERIFICATION.md).
```
Cite the frontmatter score as canonical; for Phase 7 note the 8/8 (frontmatter) vs 10/10 (body) discrepancy in the same cell.

### Exit-status-first gate reporting
**Source:** `07-MEASUREMENT.md:220` (`exit 0 in 1287 s ...`), RESEARCH.md "Live Gate Measurements" tables
**Apply to:** every command row in 08-MEASUREMENT.md
Always `command`, `exit`, `seconds`, then the quoted output line; fallow's `✗` glyph on a green exit is quoted, not interpreted.

### Hand-edit + `git diff` + explicit-path staging
**Source:** commit `5b927ce6` (4 files, planning only; message `docs: close the reliable coverage metrics phase`, body two lines <= 80 chars, no phase number in the title)
**Apply to:** REQUIREMENTS.md, ROADMAP.md, STATE.md, BACKLOG.md, todo move, 08-MEASUREMENT.md
`git diff -- <file>` per file before staging; `git add <explicit paths>`; `pre-commit run --files <paths>` before the commit; `SKIP=trufflehog git commit -F <msg>`; afterwards `git status --short` must show only ` M .claude/settings.json`, ` M .codex/config.toml`, ` M .planning/state.json`, `?? .mcp.json`.

## No Analog Found

None. Every file has a tracked in-repo precedent.

## Metadata

**Analog search scope:** `.planning/phases/07-reliable-coverage-metrics/`, `.planning/BACKLOG.md` (item headings 99, 392, 487, 638, 1978, 2206, 2691, 2811, 2891, 2936), `.planning/todos/{pending,completed}/`, `.planning/{STATE,ROADMAP,REQUIREMENTS}.md`, `git show 5b927ce6`
**Files scanned:** 8 files + 1 commit
**Pattern extraction date:** 2026-09-18
