---
phase: "3"
slug: "marketplace-add-recovers-from-its-own-leftover-clone"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

Rebuilt at validation from the four executed PLAN files. The seeded map predated planning: it gave
plan 02 three tasks and plan 03 two, and had no rows for gap-closure plan 04. Test names are the
ones on the current tree, after quick task 260930-j4y renamed or added cases.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | MA-12 | T-3-01, T-3-02 | Removal only for an owned leftover whose origin names the source | integration (tracer) | `node --test tests/orchestrators/marketplace/add.test.ts tests/platform/git.test.ts tests/platform/git-ops-fake.test.ts` | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | MA-13 | T-3-03 | `listRemotes` never throws; every read failure has an arm | unit (real directories) | `node --test tests/platform/git.test.ts tests/platform/git-ops-fake.test.ts` + `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/platform/git.ts` | ✅ | ✅ green |
| 03-02-01 | 02 | 2 | MA-13 | T-3-05 | Foreign, near-miss, unmarked and unreadable leftovers refuse and stay on disk | unit | `node --test tests/orchestrators/marketplace/add.test.ts tests/domain/clone-key.test.ts` | ✅ | ✅ green |
| 03-02-02 | 02 | 2 | MA-14 | T-3-06 | No destination recorded for a partly removed tree | unit + coverage | `node --test tests/orchestrators/marketplace/add.test.ts` + `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | ✅ | ✅ green |
| 03-03-01 | 03 | 3 | GATE-01 (SC5) | T-3-07, T-3-08 | The cascade authenticates with a stored-credential bundle and never starts a Device Flow | unit | `node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/plugin/update-preflight.test.ts` | ✅ | ✅ green |
| 03-03-02 | 03 | 3 | SC6, SC7 | — | N/A | doc grep | the four `grep -c` checks in 03-03-PLAN.md task 2, against the archived `any-git-host-ROADMAP.md` and `.planning/PROJECT.md` | ✅ | ✅ green |
| 03-03-03 | 03 | 3 | GATE-01 | T-3-09 | Completion read from a recorded exit code, not a glyph | phase gate | `npm run check; echo "CHECK_EXIT=$?"` | ✅ | ✅ green |
| 03-04-01 | 04 | 4 | MA-13 | T-3-10, T-3-11 | A url-less origin section refuses; `.git/config` byte-unchanged | integration (tracer) | `node --test tests/orchestrators/marketplace/add.test.ts tests/platform/git.test.ts` | ✅ | ✅ green |
| 03-04-02 | 04 | 4 | MA-13 | T-3-10, T-3-11 | Same refusal in orchestrated mode; both truncation shapes at the platform tier | unit | `node --test tests/orchestrators/marketplace/add.test.ts tests/platform/git.test.ts` + `test-coverage-direct` for `platform/git.ts` | ✅ | ✅ green |
| 03-04-03 | 04 | 4 | GATE-01 | T-3-12 | Whole gate measured on the final committed tree | phase gate | `npm run check` with the exit code captured to a log | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Named cases behind each requirement, all passing at `3166c504`:

- **MA-12:** `MA-12 / Q-03: an owned leftover whose origin is … recovers` (four origin spellings),
  `Q-01: a successful add leaves the ownership marker in the clone`, `IN-06: a destination that
  disappears before recognition reads it proceeds to the rename`, `reports the origin remote url of
  a real repository`, and the shared contract case `reports the origin remote url`.
- **MA-13:** seven `MA-13: <origin shape> still refuses as stale clone` rows, `MA-13 / WR-03: a
  leftover without the ownership marker refuses as stale clone and stays on disk`, the
  `permission-denied` and `unreadable` rows, `MA-13 / ATTR-07`, `MA-13 / WR-11`, `MA-13 / RECON-03`,
  `MA-8: a matching leftover still yields (failed) {duplicate name}`, `Q-01 / NFR-10: a staging clone
  whose .git is a symlink refuses the marker write`, the thirteen `Q-03` rows in
  `tests/domain/clone-key.test.ts`, and the `listRemotes` arms in `tests/platform/git.test.ts`
  (not-a-repo, no-origin, unreadable, EACCES and EPERM, and seven origin-section shapes).
- **MA-14:** two `MA-14 / WR-02` standalone cases and two orchestrated `MA-14` cases. Each reads
  persisted state (`marketplaces: {}`) and checks that the leftover is still on disk. The fault is a
  stub on `fs.promises.rm`, so the cases hold under root.
- **SC5 (D-3-04):** `D-3-04: gives the autoupdate cascade a github.com stored-credential bundle when
  it has no notification context` and `D-3-04: cancels a github.com helper miss without starting a
  Device Flow`.
- **GATE-01:** `npm run check (Node 24)`, `direct coverage`, `integration tests` and `fallow-audit`
  passed on PR #231 at `3166c504`.

---

## Wave 0 Requirements

- [x] **`tests/platform/git.test.ts` lines 45-50 pin `listRemotes` as NOT EXISTING.** Two
      `@ts-expect-error` directives assert `GitPlatform.listRemotes` and
      `GitPlatform.ListRemotesOptions` are absent, and the comment at line 42 documents the trap in
      its own words: "Restoring either export makes the `satisfies` resolve and turns its directive
      into an unused one (TS2578)." These MUST be removed in the same edit that adds the real
      export, or the file stops typechecking the moment `listRemotes` exists. (The research cited
      lines 895-899; the orchestrator verified the real location is 45-50.)
- [x] **`tests/platform/git-ops-fake.ts` needs a `listRemotes` implementation.** Interface
      conformance is a compile error the moment `GitOps` gains its 8th member — this is not optional
      cleanup, it is a build break.
- [x] **`tests/platform/git-ops-contract.ts`** — `listRemotes` should join the shared
      production/fake parity contract (`GIT_OPS_CASE_NAMES`, line 25). Every other seam member is
      covered there, including `currentBranch` and `resolveRemoteRef`.
- [x] **No existing test covers a real origin MISMATCH.** `add.test.ts:448` covers the
      not-a-git-clone arm; the origin-names-a-different-url arm is new.
- [x] Framework install: none — `node:test` is already the project's sole framework.

All four closed: `listRemotes` is exported and its directives are gone (the file typechecks);
`createGitOpsFake` takes a `listRemotesResult` option; `GIT_OPS_CASE_NAMES` holds `reports the
origin remote url` (origin arm only, D-3-03); and `MA-13: origin names a different repository still
refuses as stale clone` is one of seven origin-shape rows.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-30

## Validation Audit 2026-09-30

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Audited by hand against `features/git-hosts` at `3166c504`, because `init.phase-op` does not find
archived phases. Quick task 260930-j4y changed this phase's surface after the phase closed: an
ownership marker (Q-01), a parser-based origin comparison (Q-03), `UnremovableLeftoverCloneError`,
and fault stubs in place of `chmod` for MA-14. The audit used the tests on that tree. Every
requirement has automated coverage, and no gap was found, so no auditor was dispatched.

Run: `add`, `git`, `git-ops-fake`, `auth-host`, `update-preflight`, `errors`, `clone-key`,
marketplace `update` and `shared`, and `git-auth-callbacks` test files passed 492 of 492. The four
03-03 task 2 greps printed the expected counts (1, 1, 0, 2). The branch budget is enforced by the
100% coverage gate inside `npm run check` and by `direct coverage`, both green on PR #231.
