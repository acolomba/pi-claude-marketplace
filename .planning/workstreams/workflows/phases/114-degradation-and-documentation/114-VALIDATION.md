---
phase: "114"
slug: "degradation-and-documentation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-07"
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
| 4 | doc states the nine checks and the two replicated, cites 3.10.1 + Spike 027 | manual | reviewer read | — |
| 4 | every `tests/...` path the doc cites resolves | architecture | `node --test tests/architecture/no-stale-test-citations.test.ts` | ✅ existing, auto-covers |
| 5 | this project's floor stays `>=0.80.5` | architecture | `node --test tests/architecture/peer-floor.test.ts` | ✅ existing (FLOOR-01) |
| 5 | the engine's floor is documented as distinct | manual | reviewer read | — |
| 6 | non-string `workflows` still resolves `unavailable` | unit | `node --test tests/domain/resolver.test.ts` | ✅ existing, stays green; only its prose changes |
| 7 | whole gate | full | `npm run check` | ✅ |
| WDOC-02 | catalog state ↔ fixture byte equality, both walks | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ extend |
| WDOC-02 | two-marker brace order byte-pinned | architecture | same (second catalog state) | ❌ Wave 0 |
| WDEP-04 | `REASONS` length, enumeration equality, coverage proof | architecture + typecheck | `notify-closed-set-locks`, `compat-01-no-expansion`, `npm run typecheck` | ✅ bump |

---

## Wave 0 Requirements

- [ ] `tests/architecture/<new>.test.ts` — the per-derivation-site marker-coverage gate (criterion 3)
- [ ] A `bridges/workflows` probe-purity clause (criterion 2, layer 2)
- [ ] `tests/orchestrators/plugin/install.test.ts` — the byte-comparison pair with a non-vacuity assertion (criterion 2)
- [ ] `tests/platform/pi-api.test.ts` — the discriminating `workflow`-without-`workflow_control` case
- [ ] Two paired catalog states plus their fixtures; the exact-count assertion moves with them
- [ ] `piWithBothLoaded()` → `piWithAllLoaded()` across all 302 call sites, with
      `{ name: "workflow_control" }` added to its body (CONTEXT D-114-04). Editor-scoped symbol
      rename, never `sed`. Run `catalog-uat.test.ts` immediately after the probe field
      lands and BEFORE any fixture edit, to confirm the added tool changes zero bytes.

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

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] Criterion 3's negative control run, and its failing output pasted into the SUMMARY
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
