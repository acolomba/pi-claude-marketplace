# Phase 7: Gate Integrity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-10
**Phase:** 7-Gate Integrity
**Areas discussed:** Offender/control mechanism, Composed-target discoverability, Effective-config resolution (GGAT-03), Changed-pair base + zero-selection, Test-only production surface, Production-unowned exports

---

## Offender/control mechanism

**Q1 — Where does a planted offender live for file-scanning gates?**

| Option | Description | Selected |
|--------|-------------|----------|
| Hermetic temp-root copy | Copy real targets into `mkdtemp`, mutate one, run the real scan against an injected root. Offender derived from the real file. | ✓ |
| Committed in-repo fixtures | Extend `tests/fixtures/bad-imports`. Reviewable in git; offender drifts and must be carved out of four gates. | |
| In-memory synthetic sources | Pure matcher over a source string. Proves the regex, not the gate. | |

**Q2 — Accept a split mechanism for tool-invoking gates?**

| Option | Description | Selected |
|--------|-------------|----------|
| Split: temp-root + in-repo fixture | Fixture linted through the REAL resolved config, not a synthetic `overrideConfig`. | ✓ |
| One uniform mechanism everywhere | Accept the weaker proof where it does not fit. | |
| Make tool runs hermetic too | Copy/symlink `node_modules` into the temp root. | |

**Q3 — How is visitation proved, separately from firing?**

| Option | Description | Selected |
|--------|-------------|----------|
| Gate reports the paths it read | Deep-compare the opened set against the declared target list. | ✓ |
| Rely on the existing ENOENT rule | `WR-06` only catches a target that vanished. | |
| Per-target sentinel counter | A count cannot say WHICH target went unvisited. | |

**Q4 — Benign control shape?**

| Option | Description | Selected |
|--------|-------------|----------|
| Both real-copy and near-miss | Real copy proves the gate is not failing everything; near-miss proves comment-stripping and pattern precision. | ✓ |
| Unmutated real copy only | Never exercises pattern precision. | |
| Near-miss fixture only | Does not prove the gate stays green on the real tree. | |

**Notes:** The grounding for this area was `tests/fixtures/bad-imports/edge-imports-bridges.ts`, linted through a synthetic `overrideConfig` — the exact weak form `ABG-004` faults.

---

## Composed-target discoverability

**Q1 — How do composed targets become discoverable to a literal-match scan?**

| Option | Description | Selected |
|--------|-------------|----------|
| Central literal-path registry | One module of full literal repo-relative paths; gates compose nothing locally. | ✓ |
| Resolve-or-throw helper only | Enforcement in the mechanism; a gate that never calls it stays invisible. | |
| Ban composition outright | Hard to express — `path.join` is also legitimate for `mkdtemp` roots. | |

**Q2 — How is the registry enforced?**

| Option | Description | Selected |
|--------|-------------|----------|
| Meta-gate over `tests/architecture` | Self-hosting: gets the same offender and benign controls as everything else. | ✓ |
| Registry + visitation ledger, no scan | Catches an unused entry, not a gate that bypassed the registry. | |
| Convention plus review only | No enforcement — the failure class this phase exists to close. | |

**Q3 — Registry scope?**

| Option | Description | Selected |
|--------|-------------|----------|
| Architecture gates only | What criterion 4 names; every terminal finding lives here. | ✓ |
| Gates plus the `.mjs` gate scripts | Needs a shared `.mjs`/JSON source of truth. | |
| Every test that names a production path | Repo-wide; hundreds of imports that already fail at resolution time. | |

**Q4 — How to prove a joined pattern still matches real paths?**

| Option | Description | Selected |
|--------|-------------|----------|
| Positive control per ledger name | Synthesize the exact violating specifier; assert the pattern matches. | ✓ |
| Existence assertion per name | Catches a retired module, not a drifted pattern shape. | |
| Both existence and positive control | Strictly stronger; two assertions per entry. | |

**Notes:** Both specific stale-path instances (`hooks-lifecycle.test.ts`, `import-boundaries.test.ts`) were already repaired during Phase 6, so this area is about the mechanism, not another repair.

---

## Effective-config resolution (GGAT-03)

**Q1 — How to resolve the effective ESLint config?**

| Option | Description | Selected |
|--------|-------------|----------|
| `ESLint#calculateConfigForFile` | ESLint applies its own cascade; overrides show up as resolved severity/options. | ✓ |
| Load the config array and merge manually | Reimplements the logic whose mis-modelling caused both findings. | |
| Lint planted fixtures and read messages | Cannot prove a COMPLETE exempt set. | |

**Q2 — Offender config set?**

| Option | Description | Selected |
|--------|-------------|----------|
| All three: blanket override, duplicate zone, rule-off | Each is the real config plus one appended mutation; real config is the benign control. | ✓ |
| Blanket override and rule-off only | Drops duplicate-zone substitution, which the first-match read admits. | |
| One offender per gate | Leaves the untested mutations as the next silent failure. | |

**Q3 — Probe scope for `no-console`?**

| Option | Description | Selected |
|--------|-------------|----------|
| Every extension `.ts`, plus one probe per zone | Only a full sweep proves the exempt set is exactly three files. | ✓ |
| One representative file per folder | A fourth exemption on an unprobed file would pass. | |
| The three documented files plus a control | A blanket override still passes if the control is re-enabled. | |

**Q4 — Fate of the regex source-scrape?**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | It is the defect; a superseded gate invites misplaced trust. | ✓ |
| Keep as a second cross-check | Would need re-scoping to something it can actually prove. | |
| Keep only its documentation-drift half | Retain the literal path pins, drop the severity inference. | |

---

## Changed-pair base + zero-selection

**Q1 — Behavior when `merge-base HEAD origin/main` fails?**

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic printed fallback chain | `origin/main` → `main` → upstream tracking → `HEAD~1`, printing the selection. | ✓ |
| Hard-fail on the first miss | Breaks a fresh clone and any shallow CI checkout. | |
| Require an explicit `--base` | Ships a script no current caller can run without a flag. | |

**Q2 — Meaning of zero selected pairs?**

| Option | Description | Selected |
|--------|-------------|----------|
| Distinguish the two causes | Pass on no pairable changes (report skips); fail when the selector broke. | ✓ |
| Always fail on zero pairs | Turns every docs-only commit red; trains people to bypass. | |
| Always pass, report loudly | Leaves the false pass criterion 1 names as the defect. | |

**Q3 — Where do the proofs live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `test-coverage-direct.negative.mjs` | House machinery; already plants failures at this gate inside `npm run check`. | ✓ |
| New unit test under `tests/scripts/` | Would duplicate the negative harness's fixture machinery. | |
| Both | Overlapping fixture setup risks the dupes threshold of 3. | |

**Q4 — Phase 7 vs Phase 8 boundary for `RCOV-03`?**

| Option | Description | Selected |
|--------|-------------|----------|
| Behavior change plus proofs | A criterion cannot prove fail-closed against a fail-open script. | ✓ |
| Proofs only, document the gaps | Ships a knowingly fail-open gate for one more phase. | |
| Fold the wiring into Phase 7 too | Takes `RCOV-03` out of Phase 8. | |

---

## Test-only production surface

**Q — What does the gate do about `reinstall-replace.ts`'s `__operations`?**

| Option | Description | Selected |
|--------|-------------|----------|
| Gate fires; remove `__operations` here | Production-owned collaborator, Phase 5 style; gate ships green against a satisfying tree. | ✓ |
| Gate fires; documented exemption | An allow-list entry — the mechanism this milestone found goes stale and silent. | |
| Defer the gate entirely | Leaves the class ungated with a live offender in the tree. | |

**Notes:** Surfaced during grounding, not from the pre-selected areas. Several routed findings (`OPLU-A-F07`, `OPLU-B-F15`, `SHC-F046`) were already closed by Phase 5/6 work — `completion-cache.ts` now owns its memory privately behind `createCompletionCache()`. Those close as evidence with positive current proof; the gate is still added so the class cannot return.

---

## Production-unowned exports

**Q — How wide does the gate reach?**

| Option | Description | Selected |
|--------|-------------|----------|
| Repo-wide sweep, both instances fixed | `DCORE-030` and `surfacePostCommitWarnings` are one defect with two instances. | ✓ |
| Repo-wide gate, `ORA-F32` exempted | Honours the backlog routing; same stale-allow-list risk. | |
| `DCORE-030` only | Leaves the cross-cutting blind spot untouched. | |

**Notes:** Fallow's `production: false` stays as it is (`FLOW-06`'s deliberate fix, operator-owned separately), so the gate must be a test rather than a config change.

---

## Claude's Discretion

- Registry module name, constant names, and grouping.
- New gate files versus new clauses in existing gates.
- Whether `HHD-027` and `HHD-028` become one gate or two.
- `SHC-F047`'s redundant-gate audit disposition.
- Shape of the collaborator replacing `__operations`.
- Wave membership and plan granularity.

## Deferred Ideas

- Unused type-member detection (todo `2026-09-02-detect-unused-code-and-type-members.md`) — reviewed, not folded; excluded by `SCOPE-REQ-GGAT-01` and `D-22`.
- `FLOW-07` matrix removal — needs an edge-by-edge allow-list comparison; evidence-only this milestone.
- `ORA-F32` backlog identity retained even though its instance closes early.
- A `.mjs`/JSON target registry for the gate scripts.
