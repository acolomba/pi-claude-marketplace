---
phase: "3"
slug: "marketplace-add-recovers-from-its-own-leftover-clone"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-27"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` + `node:assert/strict`, with `--experimental-test-coverage` |
| **Config file** | none — flags are inline in the `package.json` scripts |
| **Quick run command** | `node --test tests/orchestrators/marketplace/add.test.ts` |
| **Full suite command** | `npm run check; echo "CHECK_EXIT=$?"` |
| **Estimated runtime** | ~5s quick run; the full `check` runs long on this host (competing codegraph/fallow daemons) |

---

## Sampling Rate

- **After every task commit:** the touched test file's quick run
- **After every plan wave:** `npm run test:coverage:unit && npm run fallow` (the 100%-branch gate plus the dead-code gate)
- **Before `/gsd-verify-work`:** full `npm run check` green — GATE-01, the milestone-wide constraint
- **Max feedback latency:** 30 seconds for the per-task run

Capture every gate's exit code into a named variable and echo it. A bare `; echo "exit=$?"` after a
compound command reports the compound, `grep -c` exits 1 on zero matches, and `fallow health` /
`fallow dupes` both print a `✗` line alongside exit 0. Each of those has produced a false green in
this repo.

---

## Per-Task Verification Map

Seeded from the research's requirement→test map; per-task rows are filled by the planner as it
writes each task's `<automated>` block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | MA-12 | — | N/A | unit | `node --test tests/platform/git.test.ts` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | MA-13 | T-3-NN | A directory the extension did not create is never deleted | unit | `node --test tests/platform/git.test.ts` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | MA-12 | — | N/A | unit | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | MA-13 | T-3-NN | Foreign / unreadable / origin-mismatch all still refuse | unit | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ | ⬜ pending |
| 03-02-03 | 02 | 2 | MA-14 | — | No destination recorded for a partially-removed tree | unit | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 3 | SC5 | — | The cascade authenticates rather than cloning authless | unit | `node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/plugin/update-preflight.test.ts` | ✅ | ⬜ pending |
| 03-03-02 | 03 | 3 | GATE-01 | T-3-SC | — | gate | `npm run check; echo "CHECK_EXIT=$?"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **`tests/platform/git.test.ts` lines 45-50 pin `listRemotes` as NOT EXISTING.** Two
      `@ts-expect-error` directives assert `GitPlatform.listRemotes` and
      `GitPlatform.ListRemotesOptions` are absent, and the comment at line 42 documents the trap in
      its own words: "Restoring either export makes the `satisfies` resolve and turns its directive
      into an unused one (TS2578)." These MUST be removed in the same edit that adds the real
      export, or the file stops typechecking the moment `listRemotes` exists. (The research cited
      lines 895-899; the orchestrator verified the real location is 45-50.)
- [ ] **`tests/platform/git-ops-fake.ts` needs a `listRemotes` implementation.** Interface
      conformance is a compile error the moment `GitOps` gains its 8th member — this is not optional
      cleanup, it is a build break.
- [ ] **`tests/platform/git-ops-contract.ts`** — `listRemotes` should join the shared
      production/fake parity contract (`GIT_OPS_CASE_NAMES`, line 25). Every other seam member is
      covered there, including `currentBranch` and `resolveRemoteRef`.
- [ ] **No existing test covers a real origin MISMATCH.** `add.test.ts:448` covers the
      not-a-git-clone arm; the origin-names-a-different-url arm is new.
- [ ] Framework install: none — `node:test` is already the project's sole framework.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None new this phase | — | — | — |

Phase 3 introduces no new manual-only item. It does CARRY two: Phase 1's live private-repo clone
canary and Phase 2's live verbatim-only smart-HTTP canary, both deferred by operator decision and
recorded in `STATE.md` § Deferred Verification. Both block milestone close only. Phase 3's SC6 is to
close them or carry them forward explicitly — not to attempt them, since neither is closable on this
machine.

---

## Branch Budget (the 100% gate)

The research enumerated roughly 10-11 new or newly-reachable branches — a larger test burden than
the production diff suggests:

- `platform/git.ts::listRemotes` fs-probe: not-a-repo vs unreadable vs readable (≥2)
- origin present vs absent among the remotes (1)
- `add.ts` step 4's arms: `origin`+match proceeds; `origin`+mismatch, `no-origin`, `not-a-repo`,
  `unreadable` all refuse (5 distinguishable)
- MA-14 leftover-removal: leak vs no-leak (2)
- SC5 `buildAuthForHost`: the new provider-found-but-no-`ctx` graceful-decline branch (1)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
