---
phase: "111"
slug: "workflows-bridge"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-05"
---

# Phase 111 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 24 in CI) + `node:assert/strict` |
| **Config file** | none — glob-driven via `package.json` scripts |
| **Quick run command** | `node --test tests/bridges/workflows/<file>.test.ts` |
| **Full suite command** | `npm run check` |
| **Pair coverage command** | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/workflows/<file>.ts` |
| **Estimated runtime** | ~2s per owner test; ~4 min for the full `npm run check` chain |

`tests/bridges/workflows/` needs **no `package.json` change** — the `npm test`
glob already covers `tests/bridges/**`. Verified against
`tests/architecture/unit-suite-glob-completeness.test.ts`, which independently
walks `tests/` and compares; a new directory under an existing alternative
satisfies it automatically.

---

## Sampling Rate

- **After every task commit:** `npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm test`
- **Per new module:** `npm run test:coverage:direct -- <source path>` — 100% branches, functions, lines. `types.ts` returns `type-only` and is exempt.
- **After every wave:** `npm run check` green
- **Before `/gsd-verify-work`:** `npm run check` green plus `pre-commit run --all-files` leaving no file modified
- **Max feedback latency:** ~10 seconds (one owner test + its direct-coverage pair)

---

## Per-Task Verification Map

Seeded from the research's requirement→test map. The planner fills Task ID / Plan
/ Wave; every task must carry an `<automated>` verify drawn from this set.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 111-03-T2 | 111-03 | 3 | WBRG-01 | — | envelope bytes are the script verbatim; key order fixed; `description` omitted when absent | unit | `node --test tests/bridges/workflows/stage.test.ts` | ❌ W0 | ⬜ pending |
| 111-02-T2 | 111-02 | 2 | WBRG-02 | V5 | discovery is flat and non-recursive, refuses symlinks, filters dotfiles and suffixes, dedups first-wins | unit | `node --test tests/bridges/workflows/discover.test.ts` | ❌ W0 | ⬜ pending |
| 111-02-T2 | 111-02 | 2 | WBRG-03 | — | unreadable / non-UTF-8 / skipped / refused each produce a `warnings[]` row and leave the plugin install standing | unit | `node --test tests/bridges/workflows/discover.test.ts` | ❌ W0 | ⬜ pending |
| 111-02-T3 / 111-03-T2 | 111-02 / 111-03 | 2 / 3 | criterion 4 | — | a stem-fallback verdict earns a `warnings[]` row naming the missing literal `name`, **and the envelope is still staged** | unit | `node --test tests/bridges/workflows/discover.test.ts tests/bridges/workflows/stage.test.ts` | ❌ W0 | ⬜ pending |
| 111-03-T3 | 111-03 | 3 | WBRG-04 | — | the envelope lands at the engine's scanned path, and only the commit `rename` ever touches it | unit | `node --test tests/bridges/workflows/stage.test.ts` | ❌ W0 | ⬜ pending |
| 111-01-T1 | 111-01 | 1 | WPTH-01 | — | user scope → `<home>/saved/`; project scope → `<home>/projects/<key>/saved/` | unit | `node --test tests/persistence/locations.test.ts` | ✏️ extend | ⬜ pending |
| 111-01-T1 | 111-01 | 1 | WPTH-04 | V5 containment | `workflowArtifactPath` refuses an unsafe name and any path escaping the new writable root | unit | `node --test tests/persistence/locations.test.ts` | ✏️ extend | ⬜ pending |
| 111-01-T1 / 111-03-T3 | 111-01 / 111-03 | 1 / 3 | WPTH-05 | — | staging is independent of `extensionRoot` and `PI_CODING_AGENT_DIR`; the commit rename stays on one device | unit | `node --test tests/persistence/locations.test.ts tests/bridges/workflows/stage.test.ts` | ✏️/❌ | ⬜ pending |
| 111-03-T3 | 111-03 | 3 | WR-06 | V5 | a commit finding foreign content refuses **before its first rename**; `onPlaced` stays empty; the foreign bytes are intact afterward | unit | `node --test tests/bridges/workflows/stage.test.ts` | ❌ W0 | ⬜ pending |
| 111-02-T1 | 111-02 | 2 | WLIF-03 | — | unstage removes by recorded name only, is ENOENT-idempotent, and accumulates `failed[]` | unit | `node --test tests/bridges/workflows/unstage.test.ts` | ❌ W0 | ⬜ pending |
| 111-04-T1 | 111-04 | 4 | criterion 8 | — | the version constant matches `package.json` across all six sites | unit | `npm test` | ✏️ update literal | ⬜ pending |
| 111-04-T2 | 111-04 | 4 | criterion 9 | — | the envelope **is** materialized — the assertion that used to prove its absence now proves its presence | integration | `npm run test:integration` | ✏️ invert | ⬜ pending |
| 111-04-T3 | 111-04 | 4 | criterion 6 | — | every file under `bridges/workflows/` has a mirrored owner test | gate | `npm run test:corresponding` | ✅ | ⬜ pending |
| 111-02-T1 | 111-02 | 2 | zone config | — | `bridges-workflows` is a declared fallow zone; cross-bridge imports stay forbidden | gate | `npm run fallow` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/bridges/workflows/types.test.ts` — new
- [ ] `tests/bridges/workflows/discover.test.ts` — new
- [ ] `tests/bridges/workflows/stage.test.ts` — new
- [ ] `tests/bridges/workflows/unstage.test.ts` — new
- [ ] `tests/bridges/workflows/index.test.ts` — new (barrel)
- [ ] `.fallowrc.json` — `bridges-workflows` zone, its allow-rule, and its forbidden-calls entry. **Omitting it fails the gate loudly, not silently** (measured).
- [ ] `tests/persistence/locations.test.ts` — **extend**; the two exhaustive `Object.keys` bundle assertions fail the moment the port lands
- [ ] `tests/shared/errors-bridges.test.ts` — **extend**; `WorkflowTargetOccupiedError`
- [ ] `tests/shared/extension-version.test.ts` — **extend**; the expected literal (the sixth bump site, which the CLAUDE.md checklist does not name)
- [ ] Framework install: none — `node:test` is built in

**Every owner test must import every export of its module, including type-only
ones.** `fallow` runs `production: false`, so `tests/` is in the import graph and
the owner test is the consumer keeping a Phase-112-only export off the dead-code
report. Phase 110 measured this directly. No `fallow-ignore`.

**There is no separate Wave 0 in this phase, and no task carries a `MISSING`
verify sentinel.** Each item above is created by the same task that first needs
to verify against it, inside the wave that lands the module it mirrors:

| Wave 0 item | Created by |
|---|---|
| `tests/persistence/locations.test.ts` extension | 111-01 task 1 |
| `tests/shared/errors-bridges.test.ts` extension | 111-01 task 2 |
| `.fallowrc.json` zone triple | 111-02 task 1 |
| `tests/bridges/workflows/types.test.ts` | 111-02 task 1 |
| `tests/bridges/workflows/unstage.test.ts` | 111-02 task 1 |
| `tests/bridges/workflows/discover.test.ts` | 111-02 tasks 2 and 3 |
| `tests/bridges/workflows/index.test.ts` | 111-03 task 1 |
| `tests/bridges/workflows/stage.test.ts` | 111-03 tasks 2 and 3 |
| `tests/shared/extension-version.test.ts` literal | 111-04 task 1 |

The corresponding-test gate forces this pairing anyway: a production module that
lands without its mirrored owner test fails the whole-tree gate, so a task cannot
defer its test file to a later wave even if it wanted to.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The bumped version actually releases the backfill gate for a real stale record | criterion 8 | The effect lands at **release**, not in this phase: `backfill.ts:343` re-materializes through `reinstallPlugin`, which gains no workflows phase until Phase 112. Nothing in-tree can observe the end-to-end repair yet. | Deferred to the milestone's live UAT. The in-phase assertion is only that the constant matches `package.json` across all six sites. |
| SonarCloud CPD on the new bridge | — | Sonar's CPD uses a different algorithm from `fallow dupes`, which measures **zero** new duplicated lines for this port (993/38 files, identical with and without it). | `/babysit-pr` time. Remedy is a `sonar.cpd.exclusions` entry with the `port/README.md` rationale — **not** a shared-helper refactor. |

Everything else has automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
