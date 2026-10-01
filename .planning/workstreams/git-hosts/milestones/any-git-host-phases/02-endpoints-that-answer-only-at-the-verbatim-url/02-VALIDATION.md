---
phase: "2"
slug: "endpoints-that-answer-only-at-the-verbatim-url"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-26"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (no external test framework) |
| **Config file** | none — behavior driven by `npm run test` / `test:coverage:unit` script flags in `package.json` |
| **Quick run command** | `node --test tests/domain/clone-key.test.ts tests/orchestrators/plugin/clone-cache.test.ts` |
| **Full suite command** | `npm run check; echo "CHECK_EXIT=$?"` |
| **Estimated runtime** | ~600 seconds (full `check`); ~5 seconds (quick run) |

---

## Sampling Rate

- **After every task commit:** Run `node --test <the one or two files that task touched>`
- **After every plan wave:** Run `npm run test:coverage:direct && npm run test:coverage:unit`
- **Before `/gsd-verify-work`:** `npm run check` must be green (milestone-wide GATE-01, enforced at every phase boundary)
- **Max feedback latency:** 30 seconds for the per-task run

---

## Per-Task Verification Map

Seeded at plan time from the requirement→test map below; the per-task rows are filled by the
planner as it writes each task's `<automated>` verify block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | MURL-08 | T-2-01, T-2-05 | Derivation reads only the already-`https`-admitted `source.raw` | integration (tracer) | `node --test tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/marketplace/add.test.ts tests/domain/source.test.ts tests/domain/clone-key.test.ts` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | MURL-08 | T-2-01 | N/A | unit | `node --test tests/domain/clone-key.test.ts tests/domain/source.test.ts` + `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/domain/clone-key.ts` | ✅ | ✅ green |
| 02-01-03 | 01 | 1 | MURL-09 | T-2-02, T-2-05 | 404/401 keeps `message`, `code`, `data.statusCode`; failure names the URL sent | unit | `node --test tests/orchestrators/marketplace/add.test.ts tests/edge/handlers/marketplace/add.test.ts` | ✅ (new cases) | ✅ green |
| 02-02-01 | 02 | 2 | MURL-08 | T-2-06 | Required field, so the compiler names all 39 construction sites | source + typecheck | `npx tsc --noEmit 2>&1 \| grep '^extensions/'` (must print nothing) + `npm run lint` | ✅ | ✅ green |
| 02-02-02 | 02 | 2 | MURL-09 | T-2-03 | Exactly one attempt per seam on success AND injected 404/401 | unit | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/reinstall-clone-probe.test.ts tests/orchestrators/plugin/install-clone-probe.test.ts tests/orchestrators/plugin/update-preflight.test.ts` | ✅ (new cases) | ✅ green |
| 02-02-03 | 02 | 2 | MURL-08 | T-2-04 | Suffix keys on `source.kind`, not the hostname | unit + coverage | `node --test tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/clone-cache.test.ts` + `test-coverage-direct` for all six modules | ✅ | ✅ green |
| 02-03-01 | 03 | 3 | MURL-08 | T-2-07 | N/A | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` | ✅ | ✅ green |
| 02-03-02 | 03 | 3 | MURL-08, MURL-09 | T-2-07 | No allowlist admits both URL forms | unit + integration | `npm run test:coverage:unit` and `npm run test:integration` | ✅ | ✅ green |
| 02-03-03 | 03 | 3 | MURL-08, MURL-09 | T-2-08, T-2-09 | Prose states the shipped rule; no allowance widened | phase gate | `npm run check; echo "CHECK_EXIT=$?"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Mid-phase red is expected and planned, not a regression.** After plan 02 task 1 the test tree does
not typecheck (30 literal-construction sites lack the new required field) and after plan 02 the plugin
flow, bootstrap, reconcile, register, integration and `marketplace update` suites are red because their
remote allowlists still admit only the suffixed form. Plan 02 task 2 closes the first; plan 03 closes the
second. No suite is to be made green by restoring a suffix.

---

## Wave 0 Requirements

- [x] A call-count assertion of exactly one on the **failure** path for each clone-cache seam.
      Every existing failure-path test asserts only the thrown error, never
      `git.state.calls.*.length`. This is the SC3 regression guard and must be written, not
      assumed to exist. → **Owned by task 02-01-03 (marketplace seam) and 02-02-02 (three plugin
      seams).** The fake needs no change: `calls.clone.push(...)` runs before `requireRemote` and
      before an injected error throws.
- [x] A fixture for a host that serves ONLY the verbatim (non-`.git`) path and 404s the `.git`
      form. `createGitOpsFake`'s `allowedRemoteUrls` already expresses this (allowlist the
      verbatim URL, omit the `.git` form) — no new fake capability, one new case per affected seam.
      → **Owned by task 02-01-01**, which flips `tests/edge/handlers/marketplace/add.test.ts`'s
      `CLONE_URL` to the verbatim form; that one constant feeds `allowedRemoteUrls`, so the port becomes
      a verbatim-only endpoint and the whole edge suite becomes the MURL-08 acceptance scenario.
      Reinforced by narrowing every other allowlist in tasks 02-02-02, 02-02-03, 02-03-01 and 02-03-02.
- [x] The suites that currently pin the pre-phase `.git`-for-every-host wire URL must be rewritten
      as first-class task work, not as fallout: `add.test.ts:2344` and `clone-cache.test.ts:824`
      encode the old rule in their test NAMES under MURL-01 / PURL-09 and must be retitled, not
      edited under an unchanged name. → **Owned by tasks 02-01-01 (add suite, 2 retitles) and
      02-02-02 (seam suite, 3 retitles).** Each plan carries a `must_haves.prohibitions` entry
      forbidding a case whose name promises one rule while its assertion asserts the other.
- [x] Framework install: none — `node:test` is already the project's sole framework.

**Added at plan time — a fourth Wave 0 gap the research pass did not surface.** RESEARCH.md sized the
blast radius with a `.git"` grep, which cannot see a wire URL built as a template literal ending in a
backtick. Five such sites exist and are now owned: `fetch.test.ts:1085,1173` (task 02-02-03),
`install-flow.test.ts:7207,7277` (task 02-03-01) and the six-site
`marketplace-add-seed-mirrors.test.ts` cluster (task 02-03-02). Any sweep must grep BOTH terminators,
and must use `grep -F` for a pattern containing `${` — an unescaped `$` is an end-of-line anchor, so the
non-`-F` form reports a clean tree having matched nothing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real smart-HTTP endpoint that answers only at the verbatim path | MURL-08 | Needs a live server configured to 404 the `.git` form; the offline fake proves the URL sent, not a real server's response | Point `marketplace add` at such an endpoint and confirm both the initial clone and a later `resolveRemoteRef` resolve |

Closed 2026-09-28 by `02-UAT.md` test 1 (pass). A local `git http-backend` server answered only at
`/verbatim-mp` and returned 404 for any `.git` path. `marketplace add` and a later
`marketplace update` each sent only the verbatim `info/refs` and `git-upload-pack` requests, and
both `.git` and unknown-path controls failed with one request as `{source missing}`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 9 tasks carry at least one
      runnable `<automated>` command with a `<fails_when>` naming an observable signal
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task has one
- [x] Wave 0 covers all MISSING references — the one `❌ W0` row (failure-path call count) is owned by
      tasks 02-01-03 and 02-02-02; the verbatim-only fixture by 02-01-01; the retitles by 02-01-01 and
      02-02-02; and the template-literal sweep by 02-02-03, 02-03-01 and 02-03-02
- [x] No watch-mode flags
- [x] Feedback latency < 30s for the per-task `node --test` runs (the full `npm run check` is the
      phase-boundary gate only, ~600s, and runs once in task 02-03-03)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-30

## Validation Audit 2026-09-30

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Audited by hand against `features/git-hosts` at `3166c504`, because `init.phase-op` does not find
archived phases. Both requirements have automated coverage that runs green on the current tree:

- MURL-08: `MURL-08` cases in `tests/orchestrators/marketplace/add.test.ts` (typed `.git` kept,
  verbatim clone, GitLab bundle) and `tests/orchestrators/plugin/clone-cache.test.ts` (four
  forwarding cases), plus the `networkCloneUrl` arms in `tests/domain/clone-key.test.ts`.
- MURL-09: the exactly-one-attempt cases for a 404, a 401 and a suffix-only port in `add.test.ts`,
  and one per plugin seam in `clone-cache.test.ts` (`resolvePluginPin`, `materializePluginClone`,
  `materializeOrRefreshPluginMirror`).

Run: the 13 unit files named in the per-task rows passed 1037 of 1037, and
`tests/integration/marketplace-add-seed-mirrors.test.ts` passed 6 of 6. The `npm run check`,
`direct coverage` and `integration tests` CI jobs passed on PR #231 at the same HEAD. The one
manual-only item was closed by `02-UAT.md`. Quick task 260930-j4y changed `clone-key.ts` and
`source.ts` after this phase, and the MURL cases above still pass unchanged.
