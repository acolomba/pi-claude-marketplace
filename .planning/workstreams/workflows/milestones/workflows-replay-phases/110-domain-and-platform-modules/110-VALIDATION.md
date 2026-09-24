---
phase: "110"
slug: "domain-and-platform-modules"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-04"
validated: "2026-09-10"
---

# Phase 110 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) + `node:assert/strict` |
| **Config file** | none — configured entirely through `package.json` scripts |
| **Quick run command** | `node --test tests/domain/workflow-script.test.ts` |
| **Full suite command** | `npm test` |
| **Pair coverage command** | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/workflow-script.ts` |
| **Estimated runtime** | ~3 seconds for one owner test; ~90 seconds for `npm test` |

---

## Sampling Rate

- **After every task commit:** `node --test <the owner test>` plus
  `npm run test:coverage:direct -- <the source path>`
- **After every plan wave:** `npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm test`
- **Before `/gsd-verify-work`:** full `npm run check` green, plus
  `pre-commit run --all-files` leaving no file modified
- **Max feedback latency:** 10 seconds (single owner test + its direct-coverage pair)

---

## Per-Task Verification Map

Seeded from the requirement→test map below. The planner fills the Task ID / Plan
/ Wave columns when the PLAN.md files are written; every task must carry an
`<automated>` verify drawn from this set.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | WNAM-01 | — | `meta.name` wins over the file stem; the comment, string and double-quoted-key decoys do not | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ landed | ✅ green |
| — | — | — | WNAM-02 | — | absent or non-literal `name` → stem fallback; `fileStem` drops only `.js`/`.mjs`/`.cjs`, case-insensitively | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ landed | ✅ green |
| — | — | — | WNAM-03 | — | `no-meta`, `meta-not-object-literal`, `meta-spread` each skip with their own distinct cause | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ landed | ✅ green |
| — | — | — | WNAM-04 | — | acorn `SyntaxError` → `refused/unparseable`, settled before any `meta` read | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ landed | ✅ green |
| — | — | — | WNAM-05 | — | two admitted verdicts on one generated name throw `WorkflowNameCollisionError` carrying both file names | unit | `node --test tests/domain/workflow-script.test.ts tests/shared/errors.test.ts` | ✅ landed | ✅ green |
| — | — | — | WNAM-06 | V5 input validation | `<plugin>:<elided>` shape, RN-1 elision, 128-char cap, trim equality, **and the engine's `\s`/`/`/`\`/NUL and `\p{Cc}\p{Cf}` screens** — every generated name passes the real `isSafeSavedWorkflowName` | unit | `node --test tests/domain/name.test.ts` | ✅ extended | ✅ green |
| — | — | — | WPTH-02 | — | the storage root is home-derived and reads no `cwd` and no env override, so the legacy `<cwd>/.pi/workflows/saved/` can never be produced | unit | `node --test tests/platform/workflow-home.test.ts` | ✅ landed | ✅ green |
| — | — | — | criterion 6 | V6 (namespacing, not a security boundary) | project-key parity across the 14 Spike 025 cases, mutation-sensitive to the 12-hex hash width | unit | `node --test tests/domain/workflow-project-key.test.ts` | ✅ landed | ✅ green |
| — | — | — | criterion 4 | — | no `__test_*` or `set*ForTesting` export survives; the seam-free module is reached from its own test | unit + grep | `node --test tests/platform/workflow-home.test.ts` | ✅ landed | ✅ green |
| — | — | — | criterion 3 | — | every new module has its 1:1 mirrored owner test | gate | `npm run test:corresponding` | ✅ | ✅ green |
| — | — | — | criterion 2 | — | `acorn` declared at `^8.16.0` and actually imported (a lone declaration is `unused-dependency`) | gate | `npm run fallow` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/platform/workflow-home.test.ts` — new; covers WPTH-02 and criterion 4
- [x] `tests/domain/workflow-project-key.test.ts` — new; covers criterion 6
- [x] `tests/domain/workflow-script.test.ts` — new; covers WNAM-01..05 and criterion 5
- [x] `tests/domain/name.test.ts` — **extend**; covers WNAM-06
- [x] `tests/shared/errors.test.ts` — **extend**; covers WNAM-05's typed-error contract
- [x] Framework install: none — `node:test` is built in

**Every owner test must import every export of its module, including type-only
ones.** `fallow` runs with `production: false`, so `tests/` is in the graph and
the owner test *is* the consumer that keeps a Phase-111-only export off the
dead-code report. A test that misses a symbol leaves it reported.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live parity of `workflowProjectKey` against the real engine | criterion 6 | The oracle is `@quintinshaw/pi-dynamic-workflows`, which is not a dependency of this package and must not become one. The committed test pins measured literals instead. | Optional: `npm install --prefix <scratch> @quintinshaw/pi-dynamic-workflows@3.10.1` and re-run the Spike 025 `keyparity.mjs` comparison. Not part of `npm run check`. |

Everything else has automated verification.

---

## Validation Audit 2026-09-10

| Metric | Count |
|--------|-------|
| Requirements audited | 5 |
| Covered | 5 |
| Partial | 0 |
| Missing | 0 |
| Gaps found | 0 |
| Tests generated | 0 |

Run retroactively; this file was seeded by plan-phase and never reconciled. The
audit ran the owner suites live rather than trusting the map:
`workflow-script.test.ts` (118/118), `name.test.ts`, `workflow-project-key.test.ts`,
`workflow-home.test.ts`, and `errors.test.ts` (176/176).

Scope: WNAM-01, WNAM-02, WNAM-04, WNAM-05, WNAM-06. WNAM-03 and WPTH-02 are
SPLIT requirements whose owed halves belong to the bridge phase and are audited
there, not here.

**Task ID and Plan columns read `—` rather than retrofitted values** — the
planner never filled them, and inventing a mapping now would fabricate one.

### The "unreachable branch" claim is correctly scoped

The doc comment at `domain/workflow-script.ts:243-247` names
`bridges/commands/stage.ts::assertNoCommandCollisions` as the analog whose guard
is unreachable in practice. That is a different, pre-existing module — not
something this phase shipped or claims coverage for. This phase's own
`assertNoWorkflowNameCollisions` is deliberately reachable (the comment calls
that "the deliberate divergence"), and the audit confirmed it: exported,
imported by the owner test, and exercised through ten-plus cases including
multi-collision and single-collision paths, all green. **Nothing here hides
behind an unreachable dedup guard.**

The two coverage gaps this phase reports closing — `metaPropertyKey`'s
computed-key early return and `stemFallbackVerdict`'s refusal arm — were closed
with genuine public-behaviour cases, not with suppression. A repo-wide
`fallow-ignore` grep across the five phase files returns 0.

### The accepted override is reflected in the tests

WNAM-06's loosening (empty-head elision) is what the test file now pins:
`generatedWorkflowName("acme", "acme-")` returns `"acme:acme-"` rather than
throwing, while the empty-SOURCE case still throws and is pinned separately. The
coverage matches the shipped behavior rather than the original stricter claim.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

`nyquist_compliant: true` is set with the single Manual-Only row adjudicated as
genuinely un-automatable rather than declined:

**Live parity of `workflowProjectKey` against the real engine.** The oracle
package must not become a dependency of this repo, which is a stated project
constraint rather than a convenience. The committed test pins thirteen-plus
literal rows transcribed from that oracle, and the phase verification
additionally ran a live mutation check on the hash-width slice — proving those
pinned literals are load-bearing rather than decorative. That is the strongest
available form of "manual-only, with the automated proxy proven sensitive."

**Approval:** validated 2026-09-10
