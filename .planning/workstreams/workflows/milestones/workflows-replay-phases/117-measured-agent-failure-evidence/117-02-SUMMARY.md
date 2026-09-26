---
phase: 117-measured-agent-failure-evidence
plan: 02
subsystem: documentation
tags: [documentation, evidence-grade, refutation, census, negative-control, WEVID-02]
status: complete

requires:
  - 117-01's green canary run and the engine version it observed (3.10.1)
  - tests/live-uat/workflow-agent-failure-canary.mjs existing on disk, so the citation resolves
provides:
  - docs/workflows-compatibility.md's `agent()` section at runtime-measured grade, naming the version and the driver
  - a measured, provenance-carrying census of the upstream fan-out pattern
affects:
  - Phase 114's verification (covered_files includes this document -- now stale)

tech-stack:
  added: []
  patterns:
    - measure-or-drop for any published figure; provenance and counting rule beside every number
    - grade names the engine version inside the label, never a bare "measured"

key-files:
  created: []
  modified:
    - docs/workflows-compatibility.md

decisions:
  - "Task 2 took the MEASURED branch, not the halt: 117-01 recorded a green run at 3.10.1."
  - "The inherited 'six of seven, twelve times' census is dropped in every form; three separate counts replace it."
  - "The clone carries a `.gcs-sha` pin the research did not find, so provenance is stronger than date-only."
  - "No incidental correction was made: the rejected engine's row is byte-identical to before."

metrics:
  duration: ~25 min
  completed: 2026-09-09

actuals:
  tokens: 3100
  tasks: 3
  commits: 2
plan_head_before: 954bde78f0b0cf6140f687e9dffd3236041f3133
---

# Phase 117 Plan 02: Measured `agent()` failure evidence Summary

`docs/workflows-compatibility.md` no longer tells a plugin author that a failed `agent()` call always throws on the chosen engine. It now states the measured split -- recoverable resolves to `null`, only non-recoverable rejects -- at `runtime-measured at 3.10.1`, names the canary that established it, and inverts the practical-consequence paragraph that had the fan-out pattern aborting.

## Which branch Task 2 took

**The measured branch.** The precondition was met: `117-01-SUMMARY.md` records the canary ran green against a real scratch install and observed the version at run time from the engine's own manifest.

| Item | Value | Where it came from |
|---|---|---|
| Grade written | `**runtime-measured at 3.10.1**` | `117-01-SUMMARY.md` "Engine version" -- both `npm view` and the run-time manifest read agreed on `3.10.1` |
| Driver named | `tests/live-uat/workflow-agent-failure-canary.mjs` | landed in wave 1; the citation resolves on disk |
| Observables written | resolves to `null` when recoverable, rejects when not | A1 and A2 of the green run, opposite sides of the split in one run |
| Consequence written | drops the failed items and completes | A3: three rows, zero survivors, run completed |

No measured grade was written on anything the canary did not observe. The non-recoverable code list and the sibling-abort sentence are labelled `source-read at 3.10.1` with their line citations; only `MODEL_NOT_FOUND` was observed rejecting, and the text says the canary observed that one.

## The census record, verbatim

Written to `tmp/pi-uat/117-census.md` (ignored directory) and reproduced here in full.

> # Census of the Anthropic-authored workflow scripts
>
> Measured on this machine, 2026-09-09, for WEVID-02.
>
> ## Provenance
>
> | Property | Value |
> |---|---|
> | Clone path | `~/.claude/plugins/marketplaces/claude-plugins-official` |
> | Clone kind | Claude Code's own marketplace clone, NOT either marketplace this extension caches |
> | Version control | no `.git` directory; the clone carries a single pin file `.gcs-sha` = `517b2fcd1b60fa2181ac52dcf8492361ba341180` |
> | Clone mtime | 2026-09-08 22:22:42 -0400 |
> | Population | every file under any `workflows/` directory anywhere in the clone (`plugins/` AND `external_plugins/`) -- exactly 7 files, in 2 plugins |
> | `claude-security` | `"version": "0.11.0"`, `"author": {"name": "Anthropic", ...}` |
> | `code-modernization` | declares NO `version` field; `"author": {"name": "Anthropic", ...}` |
>
> The clone is machine-local and un-vendored. A reader on another machine cannot
> reproduce these figures without installing the same marketplace at the same pin.
>
> ## Counting rule
>
> **Occurrences, not lines:** `grep -o '<token>' <file> | wc -l`, i.e. every
> textual occurrence, counted once each, regardless of how many share a line.
>
> This is not a stylistic preference. `claude-security/scan.js` is minified onto a
> single line (46,363 bytes, zero newlines) and carries 14 `.filter(Boolean)`
> occurrences by itself, so any line-based rule undercounts it 14-to-1.
>
> Three tokens counted separately, because they are three different populations:
> `pipeline(`, `parallel(`, `.filter(Boolean)`.
>
> ## Per-script table
>
> | Script | `pipeline(` | `parallel(` | `.filter(Boolean)` | newlines | bytes |
> |---|---:|---:|---:|---:|---:|
> | `claude-security/workflows/scan.js` | 2 | 4 | 14 | 0 | 46,363 |
> | `code-modernization/workflows/extract-rules.js` | 0 | 3 | 3 | 371 | 16,725 |
> | `code-modernization/workflows/harden-scan.js` | 0 | 3 | 5 | 224 | 10,674 |
> | `code-modernization/workflows/portfolio-assess.js` | 1 | 0 | 1 | 109 | 5,868 |
> | `code-modernization/workflows/reimagine-scaffold.js` | 0 | 1 | 1 | 103 | 5,254 |
> | `code-modernization/workflows/uplift-deltas.js` | 0 | 2 | 2 | 231 | 14,206 |
> | `code-modernization/workflows/uplift-migrate.js` | 0 | 1 | 0 | 425 | 22,516 |
>
> ## Totals -- script count and occurrence count reported separately
>
> | Token | Scripts using it | Occurrences |
> |---|---:|---:|
> | `pipeline(` | 2 of 7 | 3 |
> | `parallel(` | 6 of 7 | 14 |
> | `.filter(Boolean)` | 6 of 7 | 26 |
>
> ## Every `pipeline(` hit was inspected
>
> All 3 are real calls, each spelled `await pipeline(`:
>
> ```text
> scan.js             const Ft=await pipeline(Lt,async e=>({component:e,model:...
> scan.js             ,y=await pipeline(c,async e=>{const t=await Yt(e,"panel",...
> portfolio-assess.js const rows = await pipeline(
> ```
>
> The word "pipeline" also appears in prose 3 more times (a `meta.description`
> in `scan.js`, "the full pipeline runs" twice in `scan.js`, and "an independent
> pipeline" in `portfolio-assess.js`). None of them matches the `pipeline(` token,
> so the token count already excludes prose. All 14 `parallel(` hits were
> inspected too; every one is `await parallel(`.
>
> ## The inherited composite figure does not survive
>
> Inherited claim: "six of the seven real Anthropic workflow scripts use
> `pipeline(...)` + `.filter(Boolean)`, twelve times in total."
>
> Both halves are wrong, and the arithmetic shows exactly how they were produced.
>
> - **"six of the seven"** is the `.filter(Boolean)` population (6 of 7, all but
>   `uplift-migrate.js`). The `pipeline(` population is **2** of 7. The claim
>   names one population and counts another. The dominant fan-out helper in these
>   scripts is `parallel()`, not `pipeline()`.
> - **"twelve"** reproduces only by counting LINES:
>   `grep -n '\.filter(Boolean)' <all seven> | wc -l` returns exactly **12**,
>   while `grep -o ... | wc -l` returns **26**. `scan.js` alone contributes 1 line
>   and 14 occurrences. There is no counting rule that both yields 12 and survives
>   this document's own standing rule at `docs/workflows-compatibility.md:101`.
>
> ## What is published, and what is not
>
> - The **consequence** is published unconditionally. It follows from the engine's
>   own code (`src/workflow.ts:990-995` recoverable arm, `src/errors.ts:200-204`
>   catch-all classification) and from the measured A3 fan-out run, not from any
>   census.
> - The **figures** are published only with the marketplace, the plugin version or
>   the clone's pin/date, and the occurrences-not-lines rule stated beside them.
> - The **composite claim** is published in no form.

### What re-measuring changed against the research

The three token counts reproduced the research exactly (3 / 14 / 26, over 2 / 6 / 6 scripts). Two things did not:

1. **The clone IS pinned.** The research concluded "the clone carries no `.git` directory ... so the measurement is pinned by date and plugin version, not by commit". It also carries `.gcs-sha` = `517b2fcd1b60fa2181ac52dcf8492361ba341180`, a 40-hex pin file the research did not find. That is recorded here as stronger provenance; the published document still gives the plugin version and the read date, because the pin file's exact meaning was not established and publishing a hash whose semantics are unverified would be the same defect this plan exists to correct.
2. **The population was re-derived, not assumed.** The research enumerated seven paths under `plugins/`. This measurement searched the whole clone including `external_plugins/` (16 further plugins) and found no other `workflows/` directory, so "seven" is the complete population and not a subset that happened to be looked at.

## What the document now says

Changed in `docs/workflows-compatibility.md`, 15 insertions and 9 deletions, one file:

- **Opening sentence.** "The three runtimes disagree..." was false after measurement; replaced with the recoverable / non-recoverable framing and the statement that the two hosts agree on the first class.
- **Table row 3.** Both observables, and `**runtime-measured at 3.10.1** by `tests/live-uat/workflow-agent-failure-canary.mjs``. The version is named inside the grade, because the row directly above already reads a bare `**runtime-measured**` at a different version.
- **Caveat paragraph deleted.** It deferred the measurement to work "that has not been done". This phase is that work. Replaced with the recoverable-to-`null` rule, the catch-all classification that makes `null` ordinary, the named non-recoverable codes, one sentence recording that the previous statement was a source read the measurement overturned, and the honest comparison against upstream's own conditional `null` contract, including that an uncaught non-recoverable rejection ends the run and its siblings.
- **Consequence paragraph inverted.** The copied fan-out pattern drops the failed items and finishes; the narrower non-recoverable class is what to defend against.
- **Census attached** with marketplace, plugin version-or-absence, read date, the occurrences-not-lines rule and its reason, three counts reported separately.
- **Legend bullet widened** so `runtime-measured at 3.10.1` no longer attributes every such claim to Spike 027.

The refutation is stated, not hedged: the document says outright that it previously claimed the opposite and that driving the engine overturned it.

## Negative control 3: the citation gate, planted and observed firing

The plant, one sentence added inside the rewritten section, naming a concrete `.mjs` path under `tests/` that does not resolve on disk (`git diff --stat`: `1 file changed, 2 insertions(+)`):

```text
PLANTED FOR A NEGATIVE CONTROL: the storage observable is driven by `tests/live-uat/workflow-storage-canary.mjs`.
```

The path was chosen because it is provably absent -- D-117-01 established the storage canary was never re-landed on this branch -- and because it is concrete rather than a glob, which the gate's character class deliberately excludes.

**The run, verbatim:**

```text
$ node --test tests/architecture/no-stale-test-citations.test.ts
✖ every `tests/...` path cited in policed content resolves on disk (239.53277ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 530.494577

✖ failing tests:

test at tests/architecture/no-stale-test-citations.test.ts:96:1
✖ every `tests/...` path cited in policed content resolves on disk (239.53277ms)
  AssertionError [ERR_ASSERTION]: Stale test-path citation. Each site below names a test file that does not exist, so the guarantee it claims points at nothing. Repoint it at the suite that enforces the claim TODAY; if no suite does, say so in the text instead of naming a file. Dated records (docs/adr, docs/plans, docs/research) are exempt and are not listed here.
  docs/workflows-compatibility.md:144 cites tests/live-uat/workflow-storage-canary.mjs
  + actual - expected

  + [
  +   'docs/workflows-compatibility.md:144 cites tests/live-uat/workflow-storage-canary.mjs'
  + ]
  - []

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/no-stale-test-citations.test.ts:107:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [ 'docs/workflows-compatibility.md:144 cites tests/live-uat/workflow-storage-canary.mjs' ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
EXIT=1
```

Exactly one offender, naming this document, its line, and the path -- the gate discriminates rather than reporting an absence, which is the thing research could not establish because the real canary did not exist then.

**Reversion confirmed.** `git checkout -- docs/workflows-compatibility.md`, then:

- `grep -c 'PLANTED FOR A NEGATIVE CONTROL\|workflow-storage-canary' docs/workflows-compatibility.md` → `0`
- `git status --porcelain -- docs/` → empty (the rewrite was already committed, so a clean tree is the correct post-revert reading)
- `node --test tests/architecture/no-stale-test-citations.test.ts tests/architecture/workflows-doc-pins.test.ts` → `pass 5, fail 0`

## Incidental corrections

**None.** The rejected engine's row (`@nicknisi/pi-workflows` | throws | `**runtime-measured**`) is byte-identical to its previous form; its missing version was out of scope and was not touched. The full diff is the legend bullet plus the `agent()` section, confirmed by hunk headers.

## Deviations from Plan

### 1. [Rule 3 - Blocking] `pre-commit run --files` cannot exit 0 in this worktree

- **Found during:** Task 2's verify battery.
- **Issue:** `.git` is a file in a linked worktree, so the trufflehog hook's git-mode scan aborts with `failed to read index file: open .../.git/index: not a directory`. Structural, not transient. Wave 1 hit the same thing.
- **Fix:** the route `CLAUDE.md` sanctions -- a filesystem scan over exactly the path being committed, then `SKIP=trufflehog git commit`. The scan reported `verified_secrets: 0, unverified_secrets: 0` over `docs/workflows-compatibility.md`. `SKIP=` was extended to nothing else; `--no-verify` was never used.
- **Every other hook passed**, including `mdformat` and `markdownlint-cli2`.

### 2. [Expected, recorded] `mdformat` rewrote the table mid-hook

- **Found during:** Task 2.
- **Issue:** the first hook pass reported `mdformat ... files were modified by this hook` -- it realigned the divergence table's columns to the new, much wider third row.
- **Fix:** re-ran until `mdformat` passed, then committed. Nothing was amended and no follow-up commit was needed. The grep gates and both architecture suites were re-run against the post-`mdformat` bytes, not the pre-`mdformat` ones.

### 3. Commits were made on `features/workflow`, not an `agent-*` branch

Worktree isolation is off for this dispatch by design and the run is directly against the operator's checkout. `features/workflow` is the sanctioned branch for this milestone; the never-`main` rule was honored. Recorded rather than silent, as in wave 1.

## Threat-model mitigations applied

| Threat ID | How it was mitigated, and how that was confirmed |
|---|---|
| T-117-07 | The precondition was evaluated before writing, against `117-01-SUMMARY.md`'s recorded green run and its two independent version reads. The measured branch was taken because the record supports it; had it not, the row would have stayed `source-read only`. |
| T-117-08 | The canary landed a wave earlier and the citation resolves. Beyond that, the gate itself was planted and observed red with a one-line offender list, then reverted and re-run green. |
| T-117-09 | Every published figure carries the marketplace, the plugin version (or the explicit statement that one plugin declares none), the read date, and the occurrences-not-lines rule with the reason it matters. The consequence is published without depending on any count, and the document says so. |
| T-117-10 | Both latent tripwires were routed around and then checked: this edit added and removed no table row beginning with a bare number in its first cell (the classification pin still scrapes exactly six and passes), and `grep -ci 'seven gates'` returns 0. **Corrected 2026-09-09 after the threat audit:** this row previously read "no table row in the file begins with a bare number in its first cell", which is false -- nine pre-existing rows do, in the very classification table the pin scrapes. The operative property was always the one now stated, and the audit independently confirmed it, but the wording overstated what had been checked. Recorded rather than quietly reworded, since a record that overstates its own verification is the defect this phase exists to correct. Both pinned suites were run after the edit AND again after the plant was reverted. |
| T-117-11 | No transcript and no secret material was published. The clone path published as provenance is a conventional location under a home directory; the trufflehog filesystem scan over the committed file reported zero verified and zero unverified secrets. |
| T-117-SC | Accepted as planned and still valid: this plan added, upgraded and removed no package. `git status --porcelain -- package.json package-lock.json` is clean. |

## Verification

| Check | Result |
|---|---|
| `test -s tmp/pi-uat/117-census.md` | exit 0, 93 lines |
| clone-present census probe (`files=7 occurrences=26`) | exit 0 |
| `grep -v '^>' ... -c 'separate work that has not been done'` | `0` (want 0) |
| `grep -v '^>' ... -c 'abort under Pi'` | `0` (want 0) |
| `grep -v '^>' ... -c 'non-recoverable'` | `4` (want >= 1) |
| `grep -v '^>' ... -c 'runtime-measured at '` | `4` (want >= 3) |
| `grep -v '^>' ... -c 'workflow-agent-failure-canary.mjs'` | `1` (want >= 1) |
| `grep -ci 'seven gates'` | `0` |
| `node --test tests/architecture/workflows-doc-pins.test.ts tests/architecture/no-stale-test-citations.test.ts` | pass 5, fail 0 -- run after the edit, after `mdformat`, and after the plant revert |
| citation gate planted | exit 1, one offender naming this file and the absent path; reverted; green |
| `git status --porcelain -- docs/` after revert | empty |
| `pre-commit run --files docs/workflows-compatibility.md` | every hook passed except trufflehog, which fails structurally here (Deviation 1) |
| trufflehog `filesystem` scan over the committed path | `verified_secrets: 0, unverified_secrets: 0` |
| `git show --stat dc26dc17` | one file, `docs/workflows-compatibility.md`, no deletions |

`npm run check` was deliberately NOT run: plan 117-03 owns that gate.

## Stale verification

**Phase 114's verification is now stale.** `114-VERIFICATION.md`'s frontmatter `covered_files` includes `docs/workflows-compatibility.md`, and this plan modified it. That was expected and is already sequenced -- 114's re-verification follows this phase. No action is taken here beyond recording it.

## Known Stubs

None.

## Threat Flags

None. This plan changed one markdown file. It added no network endpoint, no auth path, no schema, and no executable code.

## Self-Check: PASSED

- `docs/workflows-compatibility.md` -- FOUND
- `tmp/pi-uat/117-census.md` -- FOUND
- `.planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-02-SUMMARY.md` -- FOUND
- `tests/live-uat/workflow-agent-failure-canary.mjs` -- FOUND (the cited driver resolves)
- `dc26dc17` -- FOUND

## Carried to 117-03

`REQUIREMENTS.md`'s WEVID-02 line still carries the inherited composite figure ("six of the seven ... twelve times in total"). This plan marked the requirement complete but did NOT edit that sentence: 117-03 owns it by name and already carries a gate asserting `twelve times` is gone from both `REQUIREMENTS.md` and `ROADMAP.md`. The measured replacement figures are in the census record above.
