---
phase: 117-measured-agent-failure-evidence
verified: 2026-09-09T20:45:00Z
status: passed
score: 5/5 must-haves verified
covered_files: [".planning/workstreams/workflows/milestones/workflows-phases/105-workflow-degradation-and-documentation/105-VERIFICATION.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-01-PLAN.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-01-SUMMARY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-02-PLAN.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-02-SUMMARY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-03-PLAN.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-03-SUMMARY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-CONTEXT.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-RESEARCH.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-REVIEW-FIX.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-REVIEW.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-SECURITY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-VALIDATION.md", "docs/workflows-compatibility.md", "tests/live-uat/README.md", "tests/live-uat/workflow-agent-failure-canary.mjs"]
covered_digest: "v1:sha256:ce8b87ac68b79160b55bc1829e836674872e4366d88f88e377bade18551547f9"
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 117: Measured `agent()` failure evidence Verification Report

**Phase Goal:** The claim that decides whether a copied workflow script degrades or dies rests
on a measurement against a real engine rather than a source read, and every document that
states it says so at the grade it actually holds.
**Verified:** 2026-09-09
**Status:** passed
**Re-verification:** No — initial verification

This is the final phase of the `workflows-replay` milestone.

## Goal Achievement

Verified against the **corrected** reading of the five roadmap success criteria (each carries a
dated correction note in `ROADMAP.md`, checked below for presence and content — not just for
existence — per the phase's own instruction that four of five carry corrections).

### Observable Truths (ROADMAP success criteria, corrected reading)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `tests/live-uat/workflow-agent-failure-canary.mjs` (corrected driver name, D-117-01) drives the host engine's `agent()` failure path and asserts rejection vs. resolution-to-`null` instead of restating the source read | ✓ VERIFIED | File exists at that exact path, 341 lines. `agentCallScript()` (`:205-214`) returns `{kind:"resolved", isNull}` or `{kind:"rejected", code, recoverable}` — the OBSERVABLE, never an internal flag. A1 (`:267-272`) asserts `{kind:"resolved", isNull:true}`; A2 (`:283-291`) asserts `{kind:"rejected", code:"MODEL_NOT_FOUND"}`. No fake agent runner: the real engine is dynamically imported from a scratch install (`resolveEngine`, `:132-161`) and driven through its own `runWorkflow`. `ROADMAP.md:670` carries the dated correction naming the old (never-landed) filename and the new one; `REQUIREMENTS.md:61`'s seam comment and `tests/live-uat/README.md`'s table both name the same corrected filename — `grep -c workflow-storage-canary` outside blockquotes is 0 in both `ROADMAP.md` and `REQUIREMENTS.md`. |
| 2 | A negative control proves the assertion can fail: inverting the expectation turns the run red | ✓ VERIFIED | `--invert` flag (`:67`, used at `:269`) flips only A1's expected `isNull`. `117-01-SUMMARY.md:90-116` carries the verbatim failing transcript: `AssertionError` naming A1, diff `+isNull: true / -isNull: false`, `EXIT=1`, with A0 still passing on the same run (proving the run fell over on the verdict, not the precondition). This is a RUN transcript, not a description. |
| 3 | The canary has been run against a real engine through the scratch-install route and its result is recorded, at the corrected version (3.10.1, not 3.5.1) and the corrected HUMAN-UAT framing (the failure path needs no credentials, so the phase's own task verification drove it) | ✓ VERIFIED | `117-01-SUMMARY.md` "Transcripts §1" is a verbatim green run: `engine 3.10.1`, four `PASS` lines, `EXIT=0`. Version cross-checked two ways (`npm view` at install time and the engine's own `package.json` read at run time) and both agree at 3.10.1 (`117-01-SUMMARY.md:53-60`). `ROADMAP.md:688-699` carries the dated correction (D-117-02, D-117-05) replacing the stale `3.5.1` pin and the stale "HUMAN-UAT rather than an automated gate" framing with the corrected framing that the failure needs no credentials and the phase's own `<automated>` verify blocks drove it — `grep -c '3\.5\.1'` across `ROADMAP.md` is 0. |
| 4 | `docs/workflows-compatibility.md` states the `agent()` divergence at its measured grade and names the concrete consequence for `pipeline(...)` + `.filter(Boolean)`; the census claim is corrected | ✓ VERIFIED | `docs/workflows-compatibility.md:140-158` (read directly): the chosen-engine row reads `runtime-measured at 3.10.1` naming the canary path; the section states the recoverable-to-`null` rule, the catch-all classification, and names the non-recoverable codes; states the two engines agree on the ordinary failure and diverge only on the non-recoverable class (uncaught rejection ends the run and its siblings); the consequence paragraph is inverted (drops failed items and completes; A3 measured at three rows / zero survivors). The retired "abort under Pi" and "separate work that has not been done" sentences are gone (`grep -v '^>' | grep -c` both 0). The **non-recoverable code list is published as six codes, each graded by how it was established** — "only `MODEL_NOT_FOUND` is reproducible from the canary"; the other five are graded `source-read` or an uncommitted-probe caveat, and the paragraph states outright "It is not a contract the engine publishes" and "one path at one version." This is the corrected, non-uniform grading the review's CR-01 finding forced (see Anti-Patterns / Review Findings below). Census: `docs/workflows-compatibility.md:157` publishes three separate counts (26/14/3 occurrences over 6/6/2 of 7 scripts) with marketplace, plugin version-or-absence, read date, and the occurrences-not-lines counting rule; the composite "twelve times" figure is published nowhere (`grep -c 'twelve times'` across `ROADMAP.md` + `REQUIREMENTS.md` is 0), and `ROADMAP.md:714-724` / `REQUIREMENTS.md:66-76` carry matching, word-for-word dated corrections. |
| 5 | `105-VERIFICATION.md` no longer records the live canary as `UNRUN` while its own frontmatter/status line record it closed; corrected reading: `UNRUN` is the true one, and the 2026-08-16 closure was Phase 104's canary | ✓ VERIFIED | Read the whole 203-line file. All five sites corrected: (1) `result: UNRUN` replaces `result: CLOSED`, with a `correction:` block quoting the retired outcome/date; (2) the frontmatter `evidence:` block — the site the discuss pass initially missed — no longer narrates a clean W1/W2/W3 run, and states plainly "What was NOT among it: W1, W2 and W3... never driven against a live engine at all"; (3) the report's status line reads `passed (six of six criteria; the W1/W2/W3 live canary was never run — WDOCS-02 correction, 2026-09-09)` with a blockquote note quoting the retired parenthetical; (4) the artifact table row names both trees ("PRESENT... on the branch this phase ran on, ABSENT on the current one"); (5) the ledger citation is repointed from the dangling id 5 (confirmed today to be an unrelated Phase-112 entry) to id 45, which exists and is `open`. `grep -c '^    result: CLOSED$'` = 0, `grep -v '^>' | grep -c 'live canary closed'` = 0, `grep -v '^>' | grep -c 'Exit 0, every assertion PASS'` = 0. **The retired wording is quoted in blockquotes, not erased** — confirmed by reading the quoted text verbatim in the file (not merely trusting the SUMMARY's claim that it did this). `ROADMAP.md:734-743` carries the dated correction disambiguating "the current record wins" to name the `UNRUN` side outright. |

**Score:** 5/5 roadmap success criteria verified.

### What the phase refuted, and how the doc now grades it (the two hardest checks)

**1. The refutation is published, not softened.** `docs/workflows-compatibility.md:150` reads: "This document previously said that every failure branch in the chosen engine's `agent()` throws. That was a source read, and driving the engine overturned it." The table row and every surrounding paragraph state the corrected split (recoverable → `null`, non-recoverable → rejects) without a hedge. Confirmed the OLD claim ("abort under Pi", "separate work that has not been done") is absent from live text.

**2. The non-recoverable code list is not published as closed.** Read `docs/workflows-compatibility.md:143-146` directly. It lists six codes (`MODEL_NOT_FOUND`, `AGENT_LIMIT_EXCEEDED`, `TOKEN_BUDGET_EXHAUSTED`, `SCRIPT_VALIDATION_ERROR`, `PROVIDER_USAGE_LIMIT`, `SCHEMA_NONCOMPLIANCE`), grades them individually ("Of the six, only `MODEL_NOT_FOUND` is reproducible from the canary... `AGENT_LIMIT_EXCEEDED`, `TOKEN_BUDGET_EXHAUSTED` and `SCRIPT_VALIDATION_ERROR` were also driven at 3.10.1, but by a probe that was not committed... The last two need a live provider to reach and were only read"), and states outright "That is the set read on one path at one version. It is not a contract the engine publishes, and a script must not defend against it as though it were closed." This is a uniformly-worse regression the code review (CR-01) caught and the fix pass (`117-REVIEW-FIX.md:76-85`) corrected — verified fixed by reading the current doc text directly, not by trusting the fix report's claim.

### A0 — the measurement precondition (applied to every drive, not just the first)

`workflow-agent-failure-canary.mjs:250-256` defines `requireInducedFailure`, called at both `:259` (the A0/A1 drive) and `:303` (the A3 fan-out drive). The review's WR-07 finding ("A3's verdict is read without its own measurement precondition") was fixed in commit `a6c61af4`, confirmed both by reading the current source (both call sites present) and by the fix report's transcript (`117-REVIEW-FIX.md` "WR-07 — A3's guard fires", driven against a stub engine). Before this fix, a credentialed machine reaching A3 without A0 would have reported "the fan-out pattern did not drop its failed items," blaming the engine for a machine fact — exactly the failure mode named in the review brief. Confirmed absent in the shipped code.

### Containment (WR-06)

Read `workflow-agent-failure-canary.mjs:180-199` directly: `assertSandboxContainment` resolves the supplied path with `path.resolve` and requires `resolved === SANDBOX_ROOT || resolved.startsWith(SANDBOX_ROOT + path.sep)` — a normalized-path comparison, not the substring test the review found (`agentDir.includes(path.join("tmp","pi-uat"))`, which a `..` segment walked through). `117-REVIEW-FIX.md` "WR-06 — traversal and sibling names are now refused" shows both the pre-fix predicate evaluating `true` on a traversal path, and the post-fix run refusing it at exit 1, plus refusing the `tmp/pi-uat-backup` sibling-name case. The two sibling canaries (`stop-canary.mjs:193`, `manifest-absence-canary.mjs:142`) still carry the weak substring pattern; this is correctly filed as Broken Windows ledger id 46 (confirmed present in `.planning/WINDOWS.md`'s JSON block, `kind: unmet-truth`, `[workflows-replay]` prefix) and is out of this phase's scope — not treated as a gap here, per the task instructions.

### The archived-record correction (moral centre) — verified line-by-line, not via the SUMMARY's roll call

Read the full `105-VERIFICATION.md` directly (not the 117-03-SUMMARY's table describing it). All five sites match the SUMMARY's claims:

- `:12-29` — `result: UNRUN` plus a `correction:` block quoting "an outcome of `CLOSED` and a closure date of 2026-08-16."
- `:30-56` (the frontmatter `evidence:` block) — corrected to state what was genuinely established (Phase 104's route, its negative control, the disposable prefix) and explicitly "What was NOT among it: W1, W2 and W3."
- `:44-52` — the status line no longer asserts a closure, with a blockquote note quoting the retired parenthetical verbatim.
- `:91-99` (artifact table) — corrects the presence claim while keeping the UNRUN claim, naming both trees.
- `:139-148` (Gaps Summary, ledger citation) — repointed to id 45, with a note explaining id 5 is a different milestone's entry.

**No site rewrites history to look clean.** Every retired claim is quoted in a blockquote or in the `correction:`/`evidence:` narrative, never silently deleted — verified by reading the actual quoted text, which is the specific thing this review was instructed to check for.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/live-uat/workflow-agent-failure-canary.mjs` | engine-only driver, four assertions, negative control | ✓ VERIFIED | 341 lines, whole-file `fallow-ignore-file` marker byte-identical to `stop-canary.mjs:6` (confirmed by reading both), no version literal (version read from manifest at `:132-161`), no `deepStrictEqual` (uses `structuredClone` + `assert.deepEqual` at `:267`, `:286`, `:304`) |
| `tests/live-uat/README.md` | three-row table, canary's own section, `--invert` documented | ✓ VERIFIED | Table has three rows; new row's "Needs live `pi`" is `no`; canary's own section documents prerequisites, run command, assertions, `human_needed` routes, the negative control, and states the storage assertions are deliberately absent |
| `docs/workflows-compatibility.md` | `agent()` section at measured grade | ✓ VERIFIED | Confirmed above in detail |
| `105-VERIFICATION.md` (archived) | internally consistent record | ✓ VERIFIED | Confirmed above, all 5 sites |
| `.planning/WINDOWS.md` id 45 | ledger entry carrying the storage-coverage obligation | ✓ VERIFIED | Present in JSON block, `open`, `unrun-verify`, `[workflows-replay]` prefix |
| `.planning/WINDOWS.md` id 46 | ledger entry carrying the sibling-canary guard weakness | ✓ VERIFIED | Present in JSON block, `open`, `unmet-truth`, `[workflows-replay]` prefix |
| `REQUIREMENTS.md` / `ROADMAP.md` | seams + criteria repointed | ✓ VERIFIED | Confirmed above per-criterion |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Empty agent-state dir | Real subagent runner throws | Engine's own missing-key error | ✓ WIRED | `117-01-SUMMARY.md` transcript, `AGENT_EXECUTION_ERROR` observed in logs, A0 passes |
| A0 precondition | A1/A2/A3 verdicts | `requireInducedFailure()` called before every verdict-bearing drive | ✓ WIRED | Confirmed at source `:259` and `:303`; proven to fire by planting (`117-01-SUMMARY.md` "Negative control 2") |
| Canary's green run + observed version | `docs/workflows-compatibility.md`'s grade | 117-02's precondition gate on 117-01's recorded green run | ✓ WIRED | 117-02-PLAN.md's `<precondition>` required a recorded green run before writing a measured grade; 117-02-SUMMARY.md confirms "The measured branch was taken because the record supports it" |
| Archived record's `why_human` field | The correction applied | 117-03 Task 1 read `why_human` to settle which side wins | ✓ WIRED | Confirmed: `why_human` field (`:11`) is unchanged and the correction (`:13-56`) explicitly derives from it |
| Citation gate (`no-stale-test-citations.test.ts`) | The doc's driver citation | Planted-and-reverted control | ✓ WIRED | `117-02-SUMMARY.md` "Negative control 3" — one offender named, file+line, then reverted, gate re-run green |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Pinned doc-citation gates still pass on current tree | `node --test tests/architecture/workflows-doc-pins.test.ts tests/architecture/no-stale-test-citations.test.ts` | `tests 5 / pass 5 / fail 0` | ✓ PASS |
| Neither manifest names the engine, scratch prefix gone | `grep -c pi-dynamic-workflows package.json package-lock.json` → 0/0; `test -e /tmp/wf-engine` → absent | confirmed | ✓ PASS |
| `git status --porcelain` shows no phase-117 residue | ran directly | only pre-existing operator-owned untracked files (`config.json`, `.verification-ledger.json`), unrelated to this phase | ✓ PASS |
| `npm run check` (full 9-link gate) | not re-run per task constraints; `117-03-SUMMARY.md` records exit 0, link-by-link, at baseline counts (5654 unit / 35 integration) | verified by reading the SUMMARY's per-link table and cross-checking `git log` shows no further commits after the recorded run | ✓ PASS (not re-run, per constraint) |

Per the task's explicit constraint, `npm run check` was **not** re-run here; its green result is accepted from `117-03-SUMMARY.md`'s link-by-link table, cross-checked against `git log` showing no commits landed after that run that would invalidate it (the tree at HEAD matches the state the gate ran against).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WEVID-01 | 117-01 | Live-UAT canary drives `agent()` failure, negative control proves it can fail | ✓ SATISFIED | Canary file, transcripts in 117-01-SUMMARY.md |
| WEVID-02 | 117-02 | Doc restates divergence at measured grade, census with provenance | ✓ SATISFIED | `docs/workflows-compatibility.md`, cross-checked against REQUIREMENTS.md's matching census clause |
| WDOCS-02 | 117-03 | Archived record no longer contradicts itself | ✓ SATISFIED | `105-VERIFICATION.md`, all 5 sites |

No orphaned requirement IDs found for this phase.

### Anti-Patterns Found

None blocking. No unreferenced `TBD`/`FIXME`/`XXX` in phase-117 files. No GSD process-artifact citations (`Phase NN`, `Plan NN`, `Wave N`) in the canary or the doc (checked by direct grep during read). The one genuine near-miss — the non-recoverable code list initially published as a closed set of four (CR-01) — was caught by code review and independently confirmed fixed above by reading the live doc text, not by trusting the review-fix report's claim.

### Human Verification Required

None. Every roadmap success criterion, every negative control, and every archived-record site was verifiable by direct inspection of the artifacts (source code, transcripts, and documents), and every negative control exists as a captured, verbatim RUN transcript rather than a description.

### Gaps Summary

No gaps. All five roadmap success criteria hold under their corrected reading, and every correction required by this phase's own instructions (driver name, engine version, HUMAN-UAT framing, census claim, ambiguous-wording resolution) is present, dated, and — critically — the retired wording is quoted rather than erased at every site checked. The two hardest risks named for this review — a softened refutation, and a code list republished as uniformly closed — were both checked directly against the live document text and both hold: the refutation is stated plainly, and the six-code list is graded individually with an explicit "not a contract... one path at one version" caveat. The two remaining out-of-scope items (sibling canaries' weak containment guard, storage-route live coverage) are correctly filed as open Broken Windows ledger entries (ids 45 and 46) rather than silently absorbed or hidden in a SUMMARY only.

---

*Verified: 2026-09-09*
*Verifier: Claude (gsd-verifier)*
