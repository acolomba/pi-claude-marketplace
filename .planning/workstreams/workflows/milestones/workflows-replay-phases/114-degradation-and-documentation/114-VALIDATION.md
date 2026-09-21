---
phase: "114"
slug: "degradation-and-documentation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-07"
validated: "2026-09-08"
---

# Phase 114 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node >= 20.19.0 builtin) — no external runner, no config file |
| **Config file** | none |
| **Quick run command** | `node --test tests/<dir>/<suite>.test.ts` (the single suite the task touched) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | single suite ~2-20 s; `npm run check` several minutes |

`npm run check` is longer than `.planning/codebase/STACK.md` records. Verbatim from
`package.json`:

```
npm run typecheck && npm run lint && npm run fallow && npm run format:check &&
npm run test:corresponding && npm run test:corresponding:negative &&
npm run test:coverage:direct:negative && npm test && npm run test:integration
```

The unit glob is
`tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`
plus `tests/index.test.ts`. **`tests/docs/` is not in the glob and must not be created** —
`tests/architecture/unit-suite-glob-completeness.test.ts` cross-checks the scripts' globs
against a recursive walk of `tests/`, so a new top-level test directory reddens it. Put new
suites in existing directories.

`tests/architecture/` is exempt from the file-pairing gate
(`scripts/check-corresponding-tests.mjs`: `nonCorrespondingRoots = {architecture, e2e, integration}`),
so the criterion-3 coverage gate needs no paired production module.

---

## Sampling Rate

- **After every task commit:** Run the single suite the task touched
- **After every plan wave:** Run `npm run typecheck && npm run lint && npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~20 seconds for the per-task suite

---

## Per-Task Verification Map

Seeded at planning time; the planner fills one row per task from its `<verify><automated>`
commands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 114-01-01 | 01 | 1 | WDEP-01 | — | probe compares `tool.name` against a closed literal; `catch` returns false without logging | unit | `node --test tests/platform/pi-api.test.ts` | ✅ extend | ⬜ pending |

---

## Success Criteria → Validation Map

| Criterion | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| 1 | `Dependency` union carries `"workflows"` | typecheck | `npm run typecheck` | ✅ extend `tests/shared/concerns/soft-dep.test.ts` |
| 1 | every marker-rendering surface renders `requires pi-dynamic-workflows` | architecture | the new coverage gate | ❌ Wave 0 |
| 1 | `workflow_control` present → loaded | unit | `node --test tests/platform/pi-api.test.ts` | ✅ extend |
| 1 | bare `workflow` only → NOT loaded (**the discriminating case**) | unit | same | ❌ Wave 0 |
| 1 | both tools present → loaded (decoy does not defeat the discriminator) | unit | same | ❌ Wave 0 |
| 1 | throwing `getAllTools()` → false | unit | same | ✅ extend |
| 2 | install with engine absent still writes envelopes and succeeds | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extend |
| 2 | envelope bytes identical across the two probe states, **with non-vacuity** | unit | same | ❌ Wave 0 |
| 2 | `bridges/workflows/**` and the ledger phase reference no probe symbol | architecture | new clause via `assertNoForbiddenSurface` | ❌ Wave 0 |
| 3 | one case per derivation site; **negative control run and recorded** | architecture | the new coverage gate | ❌ Wave 0 |
| 4 | doc states the nine checks and the two replicated, cites 3.10.1 + Spike 027 | manual (prose) + architecture (the figures) | reviewer read; `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ added |
| 4 | every `tests/...` path the doc cites resolves | architecture | `node --test tests/architecture/no-stale-test-citations.test.ts` | ✅ existing, auto-covers |
| 5 | this project's floor stays `>=0.80.5` | architecture | `node --test tests/architecture/peer-floor.test.ts` | ✅ existing (FLOOR-01) |
| 5 | the doc's copy of this project's floor tracks `package.json`, and the engine's floor is documented as distinct | architecture | `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ added |
| WDOC-01 | both READMEs name the engine in Features and Prerequisites and link the doc, at parallel line positions | architecture | same | ✅ added |
| 6 | non-string `workflows` still resolves `unavailable` | unit | `node --test tests/domain/resolver.test.ts` | ✅ existing, stays green; only its prose changes |
| 7 | whole gate | full | `npm run check` | ✅ |
| WDOC-02 | catalog state ↔ fixture byte equality, both walks | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ extend |
| WDOC-02 | two-marker brace order byte-pinned | architecture | same (second catalog state) | ❌ Wave 0 |
| WDEP-04 | `REASONS` length, enumeration equality, coverage proof | architecture + typecheck | `notify-closed-set-locks`, `compat-01-no-expansion`, `npm run typecheck` | ✅ bump |

---

## Wave 0 Requirements

All six landed. Each was checked against the tree, not against its SUMMARY, and each was
read to confirm the thing that landed asserts what the list said it would.

- [x] `tests/architecture/workflows-marker-coverage.test.ts` — the per-derivation-site
      marker-coverage gate (criterion 3). Seven `SITE_CASES`, each driving a PUBLIC surface
      and asserting on the rendered row; one `assert.deepEqual` over the whole projection,
      so one reverted arm reddens exactly one row. A second case binds the list to the tree
      by scanning `orchestrators/` for `DERIVATION_SHAPE` and asserting set equality both
      ways (WR-04).
- [x] A `bridges/workflows` probe-purity clause (criterion 2, layer 2) —
      `tests/architecture/no-probe-in-workflows-bridge.test.ts`. Screens the capability
      (`getAllTools`, `ExtensionAPI`) and not just four helper spellings, and derives its
      roster from `readdir` with a `DOCUMENTED_TARGETS` equality check covering the deletion
      direction.
- [x] `tests/orchestrators/plugin/install.test.ts` — the byte-comparison pair. Non-vacuity is
      asserted FIRST against a hand-written envelope literal, then the two runs' raw bytes are
      compared with no `JSON.parse`, then marker presence is asserted in BOTH directions. Two
      empty reads cannot satisfy it.
- [x] `tests/platform/pi-api.test.ts` — the discriminating case is present as two rows: bare
      `workflow` alone rejects, and `workflow` beside `workflow_control` still accepts.
- [x] Two paired catalog states plus their fixtures (`success-with-workflow-engine-absent`,
      `success-with-agents-and-workflows-soft-dep`); the exact-count assertion moved with them
      to 194 annotated examples (`d3aaceb2`).
- [x] `piWithBothLoaded()` → `piWithAllLoaded()`. Zero occurrences of the old name remain;
      332 of the new one, and every definition body carries `{ name: "workflow_control" }`.
      The zero-byte confirmation ran before any fixture edit and is transcribed in
      `114-01-SUMMARY.md`.

### Residual, recorded rather than closed

The `DERIVATION_SHAPE` scan is scoped to `extensions/pi-claude-marketplace/orchestrators`.
A `Dependency[]` derivation introduced under `edge/`, `bridges/` or `shared/` would render no
marker and leave the gate green. Re-checked on this tree: `grep -rn "Dependency\[\]"` outside
`orchestrators/` returns only type ANNOTATIONS in `shared/notify.ts`, no derivation, so the
scoped claim is true today and the gate's own header states the scope. Widening the scan is a
one-line change if a derivation ever moves.

---

## The Negative Control for Criterion 3's Gate

The gate's claim is "every `Dependency[]` derivation site stamps `workflows`". A gate that
reads seven sites but only exercises two is green over five it never touched. Every case
asserts on the RENDERED ROW, so all seven prove the same end-to-end claim (CONTEXT D-114-05).

1. Pick one hard-to-reach site — `install.ts`, `list.ts` or `import/execute.ts`, the three
   reachable only by driving a full `installPlugin` / `loadPluginListPayload` /
   `importClaudeSettings`. These are the cases a gate can most easily satisfy vacuously,
   so the control must target one of them, never an easy site (CONTEXT D-114-05).
2. Delete its `dependencies.push("workflows")` arm.
3. Run the gate. **Exactly one case must redden**, and the failure message must name that
   site.
4. Restore, re-run, confirm green.
5. Paste the failing output into the SUMMARY.

This catches two failure modes a green run does not: a case whose drive function never
actually stages a workflow (so the row carries no `workflows` either way and the assertion
is vacuous), and a case that asserts on a shared composer rather than on its own site's
derivation (so one deletion reddens several cases, or none).

If budget allows, repeat for all seven. If not, do the one and state in the SUMMARY which
six were not individually controlled. An unstated partial control is how this milestone
already shipped two guards that checked nothing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docs/workflows-compatibility.md` states which engine runs third-party JavaScript, how it is sandboxed, which script shapes install then refuse to run, and each claim's evidence grade | WDOC-01 | Prose content; no gate can assert a claim is honestly graded | Reviewer reads the doc against the RESEARCH.md engine-facts section and confirms every row's grade matches its cited source |
| The engine's peer floor is documented as distinct from this project's | WDEP-04 / criterion 5 | Prose | Reviewer confirms both floors appear and are labelled as belonging to different packages |
| README.md and README.es.md name workflows in Features and the engine in Prerequisites, and link the new doc | WDOC-01 | Prose, two languages | Reviewer diffs the two files for line-for-line parity |
| Installing the engine and reloading makes already-installed workflows run | WDEP-03 | Needs a real engine and a real Pi session | Covered structurally by the layer-2 probe-purity gate; the end-to-end confirmation is out of this phase's automated scope |

### Audit of the manual-only rows

**WDEP-03's live half stays manual, and the structural substitute is what carries it.**
`tests/live-uat/workflow-storage-canary.mjs` does not exist on this tree, by D-114-08 — the
`tests/live-uat/` directory holds only `manifest-absence-canary.mjs` and `stop-canary.mjs`.
What carries the claim is a pair, not a single gate:

- `tests/architecture/no-probe-in-workflows-bridge.test.ts` proves the bridge CANNOT branch on
  whether the engine is loaded — it may not ask (`getAllTools`, the four helper spellings) and
  may not be handed the answer (`ExtensionAPI`, and `StageWorkflowsInput` carries no `pi`).
- `tests/orchestrators/plugin/install.test.ts`'s byte-equality pair proves it DOES NOT, on a
  real install, with non-vacuity anchored first.

Together they establish "the envelopes written while the engine was absent are the same bytes
the engine would have got had it been present." They do not establish that the engine, once
installed, runs those bytes. That last hop rests on Spike 027 and is graded as such in
`docs/workflows-compatibility.md`. This is an accepted, disclosed manual-only carve-out, not a
silent hole.

**The three documentation rows had reviewer-read as their only feedback. Two thirds of that is
now automated.** `tests/architecture/workflows-doc-pins.test.ts` pins the three claims in those
rows that are checkable from inside this repository and that rot silently:

| Claim | Assertion | Would catch |
|---|---|---|
| criterion 5, first half | the floor the doc attributes to `pi-claude-marketplace` equals `package.json`'s `peerDependencies` range verbatim | a peer bump that reddens FLOOR-01 and leaves the doc quoting the old range |
| criterion 5, second half | the engine's stated floor differs from this project's | the two silently converging while the "satisfies one and not the other" paragraph survives |
| criterion 4 | the classification table holds exactly nine consecutively numbered rows, the `validateMeta` list exactly six bullets, the prose figures match both enumerations, and the retired `seven gates` figure is absent | a row or bullet edited without its prose count, and the archived requirement's stale figure creeping back |
| README pair | each README names the engine exactly twice and links the doc once, on the SAME line numbers | the one-language edit that WR-02 already caught once |

Negative controls, all six run against a deliberately broken tree before the gate was accepted:
bump `package.json` to `>=0.80.6` → floor case red; delete table row 5 → count case red; delete
one `validateMeta` bullet → count case red; delete README.es.md's prerequisite line → README
case red; insert one bullet into README.md alone → README case red on the line-parity clause;
replace `**nine distinct checks**` with `seven gates` → count case red. Each control reddened
exactly one case, with a message naming the file and the drift.

**What reviewer-read remains the honest ceiling for, and why no gate is proposed:**

- Whether each evidence grade (`source-read at 3.10.1`, `runtime-measured`, `documented
  upstream`) is honestly assigned. No assertion inside this repository can compare a grade to
  the strength of its source.
- Whether `nine` and `six` are the ENGINE's real figures. Only a re-read of
  `@quintinshaw/pi-dynamic-workflows` at a given version answers that. It is already open debt
  (Broken Windows #34, subject `WPIN-01`), and the new gate's header says explicitly that it
  does not claim this.
- Whether README.es.md's Spanish says what README.md's English says. The gate pins structure
  and position; translation equivalence is prose.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — all six landed and were read, not assumed
- [x] No watch-mode flags
- [x] Feedback latency < 20s (`workflows-doc-pins.test.ts` runs in ~0.3 s)
- [x] Criterion 3's negative control run, and its failing output pasted into the SUMMARY
      (all seven arms controlled, not the required one)
- [x] `nyquist_compliant: true` set in frontmatter

`nyquist_compliant: true` is set with two named residuals, neither of them silent:

1. WDEP-03's live end-to-end hop (engine installed, reload, workflows run) has no automated
   feedback on this tree and will not get one under D-114-08. The mechanism beneath it is
   gated; the hop itself rests on Spike 027.
2. The marker-coverage gate's tree-binding scan is scoped to `orchestrators/`. True today,
   re-verified above, and not proof against a derivation that relocates.

**Approval:** validated 2026-09-08
