---
phase: "110"
slug: "domain-and-platform-modules"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-04"
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
| TBD | TBD | TBD | WNAM-01 | — | `meta.name` wins over the file stem; the comment, string and double-quoted-key decoys do not | unit | `node --test tests/domain/workflow-script.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WNAM-02 | — | absent or non-literal `name` → stem fallback; `fileStem` drops only `.js`/`.mjs`/`.cjs`, case-insensitively | unit | `node --test tests/domain/workflow-script.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WNAM-03 | — | `no-meta`, `meta-not-object-literal`, `meta-spread` each skip with their own distinct cause | unit | `node --test tests/domain/workflow-script.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WNAM-04 | — | acorn `SyntaxError` → `refused/unparseable`, settled before any `meta` read | unit | `node --test tests/domain/workflow-script.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WNAM-05 | — | two admitted verdicts on one generated name throw `WorkflowNameCollisionError` carrying both file names | unit | `node --test tests/domain/workflow-script.test.ts tests/shared/errors.test.ts` | ❌ W0 / ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WNAM-06 | V5 input validation | `<plugin>:<elided>` shape, RN-1 elision, 128-char cap, trim equality, **and the engine's `\s`/`/`/`\`/NUL and `\p{Cc}\p{Cf}` screens** — every generated name passes the real `isSafeSavedWorkflowName` | unit | `node --test tests/domain/name.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WPTH-02 | — | the storage root is home-derived and reads no `cwd` and no env override, so the legacy `<cwd>/.pi/workflows/saved/` can never be produced | unit | `node --test tests/platform/workflow-home.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | criterion 6 | V6 (namespacing, not a security boundary) | project-key parity across the 14 Spike 025 cases, mutation-sensitive to the 12-hex hash width | unit | `node --test tests/domain/workflow-project-key.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | criterion 4 | — | no `__test_*` or `set*ForTesting` export survives; the seam-free module is reached from its own test | unit + grep | `node --test tests/platform/workflow-home.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | criterion 3 | — | every new module has its 1:1 mirrored owner test | gate | `npm run test:corresponding` | ✅ | ⬜ pending |
| TBD | TBD | TBD | criterion 2 | — | `acorn` declared at `^8.16.0` and actually imported (a lone declaration is `unused-dependency`) | gate | `npm run fallow` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/platform/workflow-home.test.ts` — new; covers WPTH-02 and criterion 4
- [ ] `tests/domain/workflow-project-key.test.ts` — new; covers criterion 6
- [ ] `tests/domain/workflow-script.test.ts` — new; covers WNAM-01..05 and criterion 5
- [ ] `tests/domain/name.test.ts` — **extend**; covers WNAM-06
- [ ] `tests/shared/errors.test.ts` — **extend**; covers WNAM-05's typed-error contract
- [ ] Framework install: none — `node:test` is built in

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

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
