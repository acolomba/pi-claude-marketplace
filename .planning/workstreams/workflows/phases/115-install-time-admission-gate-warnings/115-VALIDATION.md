---
phase: "115"
slug: "install-time-admission-gate-warnings"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-08"
---

# Phase 115 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node >= 20.19.0 builtin) — no external runner, no config file |
| **Config file** | none |
| **Quick run command** | `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts tests/architecture/workflows-doc-pins.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick run a few seconds; `npm run check` several minutes |

The suite stands at 5564 unit + 34 integration tests, green. Do not re-run it as a
spot-check step — run the quick command per task and the full gate once per wave.

`tests/architecture/` is exempt from the file-pairing gate
(`scripts/check-corresponding-tests.mjs`: `nonCorrespondingRoots = {architecture, e2e, integration}`).
A new top-level `tests/` directory reddens
`tests/architecture/unit-suite-glob-completeness.test.ts` — put new suites in existing directories.

---

## Sampling Rate

- **After every task commit:** the quick run command above
- **After every plan wave:** `npm test && npm run typecheck && npm run fallow`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** a few seconds for the per-task suite

---

## Requirements → Validation Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| WGATE-01 | each of the six warnable gates produces exactly one warning naming the file and the gate, and the envelope is still written | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ extend |
| WGATE-01 | the warning reaches a **standalone** install's rendered output | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extend |
| WGATE-01 | the warning reaches a **standalone** reinstall's rendered output (D-115-05) | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ extend |
| WGATE-01 | the warning reaches `info` in preview tense | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ extend |
| WGATE-01 | sibling scripts install with no warning of their own | unit | `node --test tests/bridges/workflows/discover.test.ts` | ✅ extend |
| WGATE-02 | one `parse()` per script — no second parse | architecture | `node --test tests/architecture/<no-second-parse>.test.ts` | ❌ Wave 0 |
| WGATE-03 | a gate warning changes no plugin-level status, glyph or disposition — **asserted on row BYTES**, not inferred from the channel being separate (D-115-06) | unit (byte) | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extend |
| WGATE-03 | a gate-warned script's verdict stays `named` / `stem-fallback` | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ extend |
| WGATE-04 | the four determinism causes and reasons unchanged; no gate line joins them | unit (regression) | `node --test tests/domain/workflow-script.test.ts` | ✅ extend |
| WGATE-04 | `unparseable` refused whole with no gate reading | unit (regression) | `node --test tests/domain/workflow-script.test.ts` | ✅ extend |
| WGATE-05 | every doc table row's column VALUE equals what the bridge does | architecture | `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ extend |
| WGATE-05 | the doc's gate-name set equals the source's closed union | architecture | `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ extend |
| WDOCS-01 | `WFLW-01` no longer appears as an open entry in `BACKLOG.md`, and its pruned footer cites `workflows-replay` (D-115-08) | reviewer-read | — | planning-artifact edit |

---

## Wave 0 Requirements

- [ ] **Decide the module boundary before writing tasks — it changes the file list.** If the gate
      reader lands in a NEW module, `npm run test:corresponding` requires a paired
      `tests/domain/<module>.test.ts`. If it lives inside `domain/workflow-script.ts`, the
      existing `tests/domain/workflow-script.test.ts` satisfies the pairing gate and no new file
      is needed.
- [ ] An architecture assertion for WGATE-02: `domain/workflow-script.ts` contains exactly one
      `parse(` call site. `tests/architecture/source-scan.ts`'s `assertNoForbiddenSurface` is the
      right primitive. Does not exist today.
- [ ] Everything else: **no gaps.** Every other target file exists and already has a paired suite.

---

## The Negative Control for the Gate-Name Totality Construct

The construct binds two artifacts a single edit cannot change together: the closed union in the
source, and the rows of the doc's classification table. **Run it in all four directions** — a
construct can be one-way green, and this milestone has already shipped one forcing construct
that was unconditionally `never` and one seven-entry literal bound to nothing.

1. **Union grows, doc does not.** Add a fabricated member to the gate union. Expect
   `npm run typecheck` red (the predicate map is no longer total) AND
   `workflows-doc-pins.test.ts` red (set mismatch). Restore.
2. **Doc row removed, union unchanged.** Delete one `warn` row's gate name from the doc table.
   Expect the doc-pin test red. Restore.
3. **A doc row's column VALUE falsified.** Change one row from `warn` to `neither` without
   touching code. Expect the doc-pin test red — **but only if the test compares column values
   and not merely gate names.** If it stays green, the construct checks half of what criterion 4
   asks and must be strengthened. This is the exact "green because it checked nothing" failure.
4. **The construct's own liveness.** With direction 1's fabricated member still in place, remove
   the predicate map's type annotation and re-run the typecheck. The attribution runs the other
   way round from the wording that reads naturally here: direction 1's redness is credited to the
   annotation only if the typecheck error that NAMED the predicate map now DISAPPEARS. A
   construct that stays red once its annotation is gone is red for an unrelated reason, which is
   the failure this direction exists to detect. Record what was observed in each configuration
   rather than asserting an expected outcome, then restore both edits.

**Paste all four transcripts into the SUMMARY, not a summary of them.**

---

## Pinning Criterion 3 as a Regression, Not an Assumption

"Unchanged" is only checkable against a recorded baseline. Assert the two facts that make the
refusal paths structurally unreachable from gate reading, as *behavior* rather than as comments:

1. A script that is BOTH unparseable AND would trip a gate (e.g. an unbalanced brace after a
   valid-looking `meta`) returns `refused` / `unparseable` and produces **exactly one** warning
   line, whose text is the existing `unparseableReason`.
2. A script that is BOTH determinism-matching AND would trip a gate returns the existing
   determinism refusal with its existing four-way reason, and **no gate line joins it**.

Asserting only one script per refusal path catches a rewrite but not a *reordering* of
`admitWorkflowScript`, whose decision order the module header documents as load-bearing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The doc's `replicate / warn / neither` prose reads honestly, and check 7's `neither` is explained as unreachability rather than undetectability (D-115-02) | WGATE-05 | Prose judgement; the gate can pin the column value but not the explanation | Reviewer reads the Notes cells against the research's measured gate table |
| `WFLW-01`'s pruned footer follows the file's existing convention | WDOCS-01 | Planning-artifact convention | Reviewer diffs against another pruned entry in the same file |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] All four totality-construct controls run, transcripts pasted into the SUMMARY
- [ ] Criterion 3 pinned by the two structural-unreachability behaviors, not by comment
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
