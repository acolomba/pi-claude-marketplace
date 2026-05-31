---
phase: 25-runtime-publish-verification
verified: 2026-05-29T23:55:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 25: Runtime Publish & Verification Report

**Phase Goal:** Runtime Publish & Verification -- deliver the v1.4 extension source
into a Pi runtime (SNM-37, the operational gate) and then reproduce-or-refute the
two outstanding milestone-UAT findings against that runtime: SNM-38 (G-MIL-03 indent
ladder) and SNM-39 (G-MIL-07 tab completion). Deliverables: a confirmed source-load
delivery path, gating tests inside `npm run check`, and RECORDED verdicts.

**Verified:** 2026-05-29T23:55:00Z
**Status:** passed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                     | Status     | Evidence                                                                                                                                                |
|----|-----------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | SNM-37 gate: v0.2.0 source loads via `scripts/pi.sh`; behavioral smoke proves v1.4 identity             | ✓ VERIFIED | `tests/shared/snm37-behavioral-smoke.test.ts` exists, is substantive (165 lines), and passes inside `npm run check` (1137 tests, 0 fail)                |
| 2  | No `/reload to pick up changes` on read-only list (SNM-33 assertion in smoke)                            | ✓ VERIFIED | `assert.doesNotMatch(body, /\/reload to pick up changes/)` on line 147 of the smoke test; fixture uses only list-surface statuses                       |
| 3  | Hash-version renders as `v#<7hex>` (SNM-35 assertion in smoke)                                           | ✓ VERIFIED | `assert.match(body, /v#[0-9a-f]{7}\b/)` on line 154; fixture includes `hash-2ea95f85703d` plugin                                                       |
| 4  | Reason brace contains `{lsp}`, never `lspServers` (SNM-36 assertion in smoke)                           | ✓ VERIFIED | Lines 158-159 assert `{lsp}` presence and `lspServers` absence; fixture includes `reasons: ["hooks", "lsp"]` row                                        |
| 5  | REQUIREMENTS.md SNM-37 and ROADMAP SC#1 amended to `scripts/pi.sh` + behavioral-smoke methodology       | ✓ VERIFIED | REQUIREMENTS.md:28 references `scripts/pi.sh` and behavioral smoke; ROADMAP:476 amended in lockstep; no residual `pi --version` / `npm-linked` wording  |
| 6  | G-MIL-03 (SNM-38): indent ladder refuted; pre-tui bytes are catalog-conformant 0/2/4; verdict recorded  | ✓ VERIFIED | `tests/shared/snm38-indent-ladder.test.ts` passes; `docs/output-catalog.md`:56 records the display-layer caveat with string `display`; UAT G-MIL-03 block filled with REFUTE verdict and `status_after_diagnosis: refute` |
| 7  | G-MIL-07 (SNM-39): tab-completion gap deferred with finding; verdicts recorded in UAT + STATE.md         | ✓ VERIFIED | Finding comment above TC-6 at `provider.test.ts:793` cites pi-tui `getSuggestions:188`/`extractAtPrefix:191,331`/`PATH_DELIMITERS:6`/slash-branch:205; TC-6 passes; UAT G-MIL-07 `root_cause`/`artifacts`/`missing` filled; STATE.md blocker RESOLVED; Deferred Items table has `upstream_finding` row |
| 8  | No `extensions/` product code changed across Phase 25 (verification-only phase)                          | ✓ VERIFIED | `git diff --name-only 40c76fa..HEAD -- extensions/` returns empty                                                                                       |
| 9  | `npm run check` exits 0: 1137 tests pass, 0 fail, typecheck + ESLint + Prettier clean                    | ✓ VERIFIED | Executed during verification; output: `# tests 1137  # pass 1137  # fail 0`                                                                            |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact                                              | Expected                                                              | Status     | Details                                                                                                                     |
|-------------------------------------------------------|-----------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------|
| `tests/shared/snm37-behavioral-smoke.test.ts`         | Behavioral byte-form smoke, runs inside `npm run check`               | ✓ VERIFIED | 165 lines; imports `claudeMarketplaceExtension`-sourced `notify`; three v1.4 byte-form assertions (SNM-33/35/36) at pre-tui boundary |
| `.planning/REQUIREMENTS.md`                           | SNM-37 amended to `scripts/pi.sh` + behavioral smoke                  | ✓ VERIFIED | Line 28 contains `scripts/pi.sh`, behavioral smoke assertions, D-25-06 deferral note; no `npm-linked` / `pi --version`     |
| `.planning/ROADMAP.md`                                | SC#1 amended to behavioral smoke; Phase-25 bullet updated              | ✓ VERIFIED | Line 476 (SC#1) and line 96 (Phase-25 bullet) both reference `behavioral` and `scripts/pi.sh`; `pi --version` removed      |
| `tests/shared/snm38-indent-ladder.test.ts`            | Explicit per-line leading-whitespace assertion; runs inside check      | ✓ VERIFIED | 218 lines; 4 tests: header→0, plugin-row→2, cause-trailer→4, full `[0,2,2,2,2,4,0,0,2]` snapshot lock; uses `trimStart`   |
| `docs/output-catalog.md`                             | Display-layer caveat for G-MIL-03 REFUTE; contains string `display`   | ✓ VERIFIED | Line 56 records the 0/2/4/6 byte-exact contract, the display-layer artifact explanation, and cites both lock tests         |
| `tests/edge/completions/provider.test.ts`             | Finding comment above TC-6; `update @` test passes                    | ✓ VERIFIED | Lines 793-827 contain the finding comment with pi-tui line refs; TC-6 at line 828 asserts `update @` → `["@mp-a","@mp-b"]` |
| `.planning/v1.4-MILESTONE-UAT.md`                     | G-MIL-07 `root_cause`/`artifacts`/`missing` filled; G-MIL-03 cross-ref | ✓ VERIFIED | G-MIL-03 block has `status_after_diagnosis: refute` + `root_cause` filled (lines 539-558); G-MIL-07 block has `root_cause` (lines 770-795) + `artifacts` + `missing` filled; Triage row updated |
| `.planning/STATE.md`                                  | SNM-37 blocker RESOLVED; decisions added; pi-tui finding in Deferred  | ✓ VERIFIED | Line 148: RESOLVED text; lines 138-140: phase-25 decisions; line 184: `upstream_finding` row in Deferred Items table       |

---

### Key Link Verification

| From                                          | To                   | Via                                     | Status     | Details                                                                                          |
|-----------------------------------------------|----------------------|-----------------------------------------|------------|--------------------------------------------------------------------------------------------------|
| `snm37-behavioral-smoke.test.ts`              | `ctx.ui.notify`      | `mock.fn()` notify-capture seam         | ✓ WIRED    | `makeCtx()` returns `{ ui: { notify: mock.fn() } }`; `notify(ctx, pi, LIST_MESSAGE)` called; body read from `mock.calls[0].arguments[0]` |
| `snm38-indent-ladder.test.ts`                 | `notify()`           | pre-tui byte capture at `ctx.ui.notify` | ✓ WIRED    | `captureIndents()` drives `notify()` and computes `body.split("\n").map(l => l.length - l.trimStart().length)` |
| `provider.test.ts` TC-6                       | `getArgumentCompletions` | `update @ → ["@mp-a", "@mp-b"]`    | ✓ WIRED    | Line 841: `const items = await getArgumentCompletions("update @", f.resolver)`; deepEqual asserts `["@mp-a","@mp-b"]` |

---

### Data-Flow Trace (Level 4)

Not applicable. All new artifacts are test files or documentation; no dynamic data-rendering components were introduced. The smoke and ladder tests consume the real `notify()` renderer sourced from `extensions/pi-claude-marketplace/shared/notify.ts` via a direct ESM import, not a stub -- the data flow is direct and not hollow.

---

### Behavioral Spot-Checks

| Behavior                                    | Command                                                                     | Result                              | Status  |
|---------------------------------------------|-----------------------------------------------------------------------------|-------------------------------------|---------|
| SNM-37 smoke passes inside `npm run check`  | `npm run check` (1137 tests including `tests/shared/snm37-behavioral-smoke.test.ts`) | `# pass 1137  # fail 0`        | ✓ PASS  |
| SNM-38 ladder test passes                   | `npm run check` (includes `tests/shared/snm38-indent-ladder.test.ts`)       | `# pass 1137  # fail 0`             | ✓ PASS  |
| TC-6 `update @` completion test passes      | Included in `npm run check` (`tests/edge/completions/provider.test.ts`)     | `# pass 1137  # fail 0`             | ✓ PASS  |
| No `extensions/` code changed               | `git diff --name-only 40c76fa..HEAD -- extensions/`                         | (empty output)                      | ✓ PASS  |

---

### Probe Execution

No `probe-*.sh` files declared or present for this phase. The phase plan specifies
behavioral verification via `npm run check` and a live interactive `scripts/pi.sh`
keystroke (Task 2 of plan 25-03), which was completed via the human checkpoint during
execution (operator reported FILE PATHS). Step 7c is not applicable here.

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                       | Status      | Evidence                                                                                                             |
|-------------|-------------|-------------------------------------------------------------------|-------------|----------------------------------------------------------------------------------------------------------------------|
| SNM-37      | 25-01       | v0.2.0 source loaded via `scripts/pi.sh`; behavioral smoke proves v1.4 identity | ✓ SATISFIED | `snm37-behavioral-smoke.test.ts` exists and passes; REQUIREMENTS.md + ROADMAP amended in lockstep |
| SNM-38      | 25-02       | G-MIL-03 reproduced-or-refuted; verdict recorded                  | ✓ SATISFIED | REFUTE verdict recorded in `docs/output-catalog.md` (display-layer caveat) + UAT G-MIL-03 block + `snm38-indent-ladder.test.ts` |
| SNM-39      | 25-03       | G-MIL-07 reproduced-or-refuted; verdict recorded                  | ✓ SATISFIED | DEFER-WITH-FINDING verdict in UAT G-MIL-07 (root_cause/artifacts/missing filled, pi-tui line refs cited); STATE.md RESOLVED + Deferred Items; finding comment in provider.test.ts |

No orphaned requirements. All three phase requirements are claimed in plan frontmatter
(`requirements: [SNM-37]`, `[SNM-38]`, `[SNM-39]`) and verified above.

---

### Anti-Patterns Found

Files modified in this phase: `tests/shared/snm37-behavioral-smoke.test.ts`,
`tests/shared/snm38-indent-ladder.test.ts`, `tests/edge/completions/provider.test.ts`,
`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/v1.4-MILESTONE-UAT.md`,
`.planning/STATE.md`, `docs/output-catalog.md`.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| (none) | -- | -- | -- |

No `TBD`, `FIXME`, `XXX` debt markers, no stub patterns, no hardcoded empty returns,
no placeholder values found in any phase-modified file. The two test files use
substantive `assert` calls against real `notify()` output. The planning docs record
completed verdicts. No `npm publish` or `npm link` appears in any test.

---

### Human Verification Required

The one non-automatable item (the live `scripts/pi.sh` interactive `/claude:plugin
update @<TAB>` keystroke for SNM-39 Task 2) was completed via a human checkpoint
during execution. The operator ran the session, observed FILE PATHS (confirming the
pi-tui `@`-precedence interception), and reported the result. That observation is
recorded as the binding live-trigger artifact in:

- `.planning/v1.4-MILESTONE-UAT.md` G-MIL-07 `artifacts:` field (LIVE trigger
  observation: "FILE PATHS appeared")
- `.planning/phases/25-runtime-publish-verification/25-03-SUMMARY.md` (Live-Trigger
  Observation section)
- `.planning/STATE.md` Decision entry for SNM-39

This item is DONE and does not require re-verification. No new human verification
items identified.

---

### Gaps Summary

No gaps. All nine must-haves are verified. All three requirements (SNM-37, SNM-38,
SNM-39) are satisfied. `npm run check` is green at 1137 tests. No product code
changed in `extensions/`. The one human-checkpoint item (SNM-39 live keystroke) was
completed during execution and its observation is recorded in three places.

The reproduce-or-refute phase contract is satisfied:

- **SNM-37**: gate delivered via `scripts/pi.sh` source-load + behavioral smoke.
- **SNM-38 (G-MIL-03)**: REFUTE verdict with binding pre-tui byte evidence
  `[0,2,2,2,2,4,0,0,2]`; recorded in catalog, UAT, and a ladder-locking test.
- **SNM-39 (G-MIL-07)**: DEFER-WITH-FINDING verdict; root cause is
  `@earendil-works/pi-tui` host-side `@`-precedence (not our code); recorded with
  exact pi-tui line refs in UAT, STATE.md, and a finding comment pinning our
  correct provider payload.

---

_Verified: 2026-05-29T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
