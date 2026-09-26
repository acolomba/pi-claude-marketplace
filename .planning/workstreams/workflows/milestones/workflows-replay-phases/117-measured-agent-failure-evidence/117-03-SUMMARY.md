---
phase: 117-measured-agent-failure-evidence
plan: 03
subsystem: planning-records
tags: [records-correction, ledger, roadmap-criteria, project-gate, WDOCS-02, WEVID-01, WEVID-02]
status: complete

requires:
  - 117-01's canary on disk, so the repointed seams name a file that exists
  - 117-02's published census wording, so the requirement and the document agree on a number
  - this worktree's own installed node_modules, so the project gate can run at all
provides:
  - an archived verification record that no longer contradicts itself, with the over-claim still legible
  - .planning/WINDOWS.md entry id 45 -- the storage route's missing live coverage, carried where the ship gate reads it
  - four success criteria this phase can be honestly measured against
  - a green npm run check over the whole phase's tree, read link by link
affects:
  - Phase 114's verification (covered_files includes docs/workflows-compatibility.md -- already stale from 117-02)

tech-stack:
  added: []
  patterns:
    - correction-as-dated-note -- the retired claim stays quotable, never erased
    - blockquote-filtered gates, so quoting a retired claim as history is the legal shape of a correction
    - milestone in the ledger description prefix, never in the phase field

key-files:
  created:
    - .planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-03-SUMMARY.md
  modified:
    - .planning/workstreams/workflows/milestones/workflows-phases/105-workflow-degradation-and-documentation/105-VERIFICATION.md
    - .planning/workstreams/workflows/REQUIREMENTS.md
    - .planning/workstreams/workflows/ROADMAP.md
    - .planning/WINDOWS.md

decisions:
  - "The unexercised side of the archived contradiction wins, settled from inside the record by its own reason-for-human field."
  - "The evidence block was corrected, not just the outcome field -- it is the persuasive half and the one a reader believes."
  - "The parsed phase status value stays `passed`; the pairing was corrected at the entry and the status line instead."
  - "Criterion 3's HUMAN-UAT framing was corrected alongside its version: the failure path needs no credentials, so the phase's own verification drove the run."
  - "REQUIREMENTS.md's WDOCS-02 line carried the same either-way phrasing as criterion 5 and was disambiguated with it (recorded as a deviation)."

requirements-completed: [WDOCS-02, WEVID-01, WEVID-02]

coverage:
  - deliverable: "The archived record carries no site asserting the closure"
    verification:
      - kind: command
        ref: "grep -c '^    result: CLOSED$' 105-VERIFICATION.md == 0"
        status: pass
      - kind: command
        ref: "grep -v '^>' | grep -c 'live canary closed' == 0"
        status: pass
      - kind: command
        ref: "grep -v '^>' | grep -c 'Exit 0, every assertion PASS' == 0"
        status: pass
      - kind: command
        ref: "grep -c 'WDOCS-02' >= 4 (measured 7)"
        status: pass
    human_judgment: false
  - deliverable: "Each correction is a dated note that leaves the retired claim legible, rather than a rewrite that reads as though the record was always right"
    human_judgment: true
    rationale: "Prose and records judgement. No gate can distinguish an honest dated note from a clean rewrite that happens to avoid the gated strings; a reviewer must diff the correction against the entry's own why_human field."
  - deliverable: "The dangling ledger citation names what that position holds today, and the obligation is carried by an entry that exists"
    verification:
      - kind: command
        ref: "windows status --raw | phase==117 AND '[workflows-replay]' in description >= 1 (measured 1, was 0)"
        status: pass
    human_judgment: false
  - deliverable: "The two live seam pointers name a driver that exists on this branch"
    verification:
      - kind: command
        ref: "grep -v '^>' REQUIREMENTS.md ROADMAP.md | grep -c 'workflow-storage-canary' == 0; ROADMAP names workflow-agent-failure-canary >= 1"
        status: pass
    human_judgment: false
  - deliverable: "Criteria 1, 3, 4 and 5 corrected, each with a dated note naming the decision"
    verification:
      - kind: command
        ref: "grep -c '3\\.5\\.1' == 0; grep -c 'twelve times' == 0 across both documents"
        status: pass
      - kind: command
        ref: "ROADMAP.md:670,688,714,734 -- four dated correction notes"
        status: pass
    human_judgment: false
  - deliverable: "The full project gate is green with the new driver and the rewritten document in the tree"
    verification:
      - kind: command
        ref: "npm run check"
        status: pass
      - kind: command
        ref: "node --test tests/architecture/workflows-doc-pins.test.ts tests/architecture/no-stale-test-citations.test.ts"
        status: pass
    human_judgment: false
  - deliverable: "Neither dependency manifest names the host engine and the scratch prefix is gone"
    verification:
      - kind: command
        ref: "! grep -q 'pi-dynamic-workflows' package.json package-lock.json; git status --porcelain clean; test ! -e /tmp/wf-engine"
        status: pass
    human_judgment: false

metrics:
  duration: ~11 min
  completed: 2026-09-09

actuals:
  tokens: 12400
  tasks: 3
  commits: 2
  commits_counting_rule: "work commits only, matching 117-01 and 117-02. git rev-list e7841275..HEAD returns a larger number because it also counts this record's own commit and the two that corrected this very field; see the note under 'Commits'."
plan_head_before: e7841275e712f70511df5cd9b8d1bda3f6f115ae
---

# Phase 117 Plan 03: Measured `agent()` failure evidence Summary

An archived verification record that claimed, in four places and in its most persuasive prose, that a live canary ran and closed now says plainly that it never ran — with the over-claim quoted rather than erased — and the obligation its dangling citation was tracking is carried by a ledger entry that exists.

## The archived record: five sites, roll call

File: `.planning/workstreams/workflows/milestones/workflows-phases/105-workflow-degradation-and-documentation/105-VERIFICATION.md`

The record settles its own contradiction, which is what made the correction safe rather than a judgement call. Its `why_human` field (`:11`, untouched) says in its own words that what ran and closed on 2026-08-16 was the PREVIOUS phase's structurally identical canary route, and that "the W1-W3 code follows the same conventions but is itself unexercised against a live engine". The unexercised reading wins; the closure was the over-claim.

| # | Site | What it said | What it says now | Where the dated note sits |
|---|---|---|---|---|
| 1 | `:12-13` the entry's outcome and closure date | an outcome of `CLOSED` and a closure date of 2026-08-16 | `result: UNRUN` — the word this file's own truthful sites already use for this run, so the record is consistent in its own vocabulary. The `closed:` field is gone. | a new `correction:` block at `:13-29`, quoting the retired outcome and date |
| 2 | `:14-32` the frontmatter `evidence:` block | a clean exit-zero run against real engine 3.5.1, naming W1, W2 and W3 as passing | what was genuinely established on that date (the previous phase's route, its negative control, the disposable prefix), then plainly: W1, W2 and W3 were **not** among it | the block itself, at `:30-56`, opening with the dated tag and describing the retired narrative |
| 3 | `:44` the report's status line | `passed (live canary closed 2026-08-16 — see frontmatter evidence)` | `passed (six of six criteria; the W1/W2/W3 live canary was never run — WDOCS-02 correction, 2026-09-09)`; it no longer points a reader at the evidence block as proof | `:70-78`, a blockquote quoting the retired parenthetical verbatim |
| 4 | `:91` the artifact row | `✓ PRESENT, code-reviewed` \| `UNRUN against a real engine` | the UNRUN half kept; the presence half now names **both trees**: present on the branch this phase ran on, absent on the current one | `:126-133`, immediately under the table |
| 5 | `:139-141` the ledger citation | "tracked as an open `unrun-verify` entry in `.planning/WINDOWS.md` (id 5)" | id **45**, and the paragraph now says what carries the obligation | `:186-197`, naming what id 5 actually holds today |

**The frontmatter `status: passed` value is unchanged** (`:4`), deliberately. It is drawn from a small canonical set the tooling parses and is defensible at six of six criteria in its own right. What was wrong was the pairing, and the pairing is corrected at the entry and the status line rather than by breaking a parsed field. The frontmatter still parses: `yaml.load` returns `status: passed`, `result: UNRUN`, and entry keys `test, expected, why_human, result, correction, evidence`.

**Site 2 is the one the discuss pass missed** (D-117-07), and correcting it was the point. Fixing `result:` while leaving a confident narrative of a clean run and three passing assertions would have fixed the label and left the story — the half a later reader actually believes.

**Nothing was rewritten to look clean.** Every retired claim is either quoted verbatim inside a blockquote or described in the correction that replaces it. `git status --porcelain` over the archived `103-*` and `104-*` directories is empty: they are correct history and were not touched.

## The ledger entry

| Field | Value |
|---|---|
| id | **45** |
| kind | `unrun-verify` |
| phase | `117` (bare number — the milestone is NOT encoded here) |
| file / line | the archived `105-VERIFICATION.md`, line 91 |
| status | `open` |
| description | `[workflows-replay] The W1/W2/W3 storage assertions were never driven against a live engine and their driver (tests/live-uat/workflow-storage-canary.mjs) was never re-landed on this branch, so the storage half of the host-engine route has no live coverage here. Re-landing it is a recorded deferred idea (D-117-01), not scope of WEVID-01/WEVID-02/WDOCS-02.` |

Appended through `gsd-tools windows append`, never by hand-editing the ledger markdown — that file carries a rendered table AND a fenced JSON block where the JSON is the source of truth, and a table-only edit is silently lost.

**The paired gate was confirmed non-vacuous before and after.** Measured on the ledger as it stood: **13** entries already carried the `[workflows-replay]` prefix from earlier phases of this milestone, and **8** entries already sat at `phase: 117` from a **different** milestone with no prefix at all. Either half alone was already green. The pair read **0** before the append and **1** after. That is the whole reason the gate is a pair.

## The four corrected criteria

Each correction is written outright in the criterion — those documents state what is currently required, and a retired claim quoted inline reads as live to the next person who greps — and each is followed by a dated blockquote note naming the decision and summarizing the previous wording.

| # | Previous wording, summarized | Corrected to | Decision | Note at |
|---|---|---|---|---|
| 1 | named `tests/live-uat/workflow-storage-canary.mjs` as the driver, reading as though the file were being extended | `tests/live-uat/workflow-agent-failure-canary.mjs`, the driver wave 1 created | D-117-01 | `ROADMAP.md:670` |
| 3 | pinned engine **3.5.1**, and framed the run as "a HUMAN-UAT item rather than an automated gate" | engine **3.10.1**, the version observed at run time from the engine's own manifest; and the run driven by the phase's own task verification, because the induced failure needs no provider credentials | D-117-02, D-117-05 | `ROADMAP.md:688` |
| 4 | "used by six of the seven real Anthropic workflow scripts, twelve times in total" | the two populations separately with the counting rule: six of seven call `.filter(Boolean)` (26 occurrences), six call `parallel()` (14 calls), two call `pipeline()` (3 calls) — word for word what the document published | D-117-06 | `ROADMAP.md:714` |
| 5 | "no longer records the live canary as `UNRUN` … the current record wins" — which does not say which side is current, and the two readings ask for opposite work | the `UNRUN` side is the true one and the closure claim was the over-claim, naming all four asserting sites | D-117-03, D-117-07 | `ROADMAP.md:734` |

**Criterion 3 carried a fifth stale premise beyond its version, and it mattered more than the number.** It reasoned from the engine not being a declared dependency to the conclusion that an operator must run the canary by hand. That reasoning held when it was written; measurement overturned it. Pointing `PI_CODING_AGENT_DIR` at an empty sandbox makes the real subagent runner fail for want of an API key, so the failure path is reachable with no credentials and no network — and this phase's own `<automated>` verify blocks installed the scratch engine and drove the canary as ordinary task verification. The engine is still undeclared and the driver is still outside `npm run check`; what changed is that a run no longer waits on a human. A future reader must not be told to run this by hand when the phase's own gate already ran it and recorded the transcript.

### The seam pointers

- `REQUIREMENTS.md:61` — the Evidence seam comment now names `tests/live-uat/workflow-agent-failure-canary.mjs`. It is a comment rather than a claim, but it is the seam list, and a seam list naming a missing file is precisely how criterion 1 came to be written against a file that does not exist.
- `REQUIREMENTS.md`'s WEVID-02 line — the composite census clause, which 117-02 deliberately left for this plan, now matches the published document exactly. Its dated note sits at `:66`.

No requirement checkbox was flipped, no phase was marked complete, the `117-03-PLAN.md` roadmap row is still unticked, and no GSD state verb was run. `STATE.md` is untouched and still reads `completed_phases: 8`, `percent: 89`.

## The project gate, link by link

`npm run check` — **exit 0**. It is **nine** links, not the seven a plan named earlier in this milestone, and all nine banners are present in the log, so every link ran.

| # | Link | Result |
|---:|---|---|
| 1 | `typecheck` (`tsc --noEmit`) | clean, no diagnostics |
| 2 | `lint` (`eslint extensions tests scripts eslint.config.js`) | clean, no output |
| 3a | `fallow dead-code --fail-on-issues` | `✓ No issues found (0.66s)` — the new standalone driver is accepted on its whole-file marker |
| 3b | `fallow health --fail-on-issues` | `✗ 0 above threshold · 11968 analyzed · maintainability 92.3 (good)`. **The glyph is not the verdict; the count is.** Zero above threshold, health score 78 B, dead files 0.0% |
| 3c | `fallow dupes --fail-on-issues` | `✗ 1,045 lines (1.4%) duplicated across 40 files`, 35 clone groups — byte-identical to the figure measured before the third canary existed. No `ignoredClones` entry was needed or added |
| 4 | `format:check` (prettier) | `All matched files use Prettier code style!` — read explicitly, because this link sits mid-chain and a failure here hides every link after it |
| 5 | `test:corresponding` | `Corresponding-test gate passed.` |
| 6 | `test:corresponding:negative` | `Corresponding-test negative controls passed.` |
| 7 | `test:coverage:direct:negative` | `Direct-coverage negative controls passed.` |
| 8 | `test` (unit) | **tests 5654 / suites 313 / pass 5654 / fail 0 / skipped 0 / todo 0**, 33.9s |
| 9 | `test:integration` | **tests 35 / pass 35 / fail 0 / skipped 0**, 11.1s |

The pre-phase baseline was exit 0 at 5654 unit / 35 integration. **The numbers are identical.** Nothing this phase added moved a count in either direction — expected, since the phase added one standalone driver outside every glob and edited markdown.

Run separately, so the two suites that actually read this phase's document report on their own rather than inside a several-minute chain:

```text
$ node --test tests/architecture/workflows-doc-pins.test.ts tests/architecture/no-stale-test-citations.test.ts
ℹ tests 5   ℹ pass 5   ℹ fail 0   EXIT=0
```

### Containment and cleanup

| Check | Result |
|---|---|
| `! grep -q 'pi-dynamic-workflows' package.json package-lock.json` | PASS — neither manifest names the engine |
| `git status --porcelain -- package.json package-lock.json` | PASS — empty, neither is dirty |
| `test ! -e /tmp/wf-engine` | PASS — the scratch prefix is gone |

The prefix held a large transitive install, three of whose packages carry install scripts. Leaving it would have been the containment obligation half-done.

## The three owed negative controls: roll call

All three are present as **verbatim failing transcripts**, not descriptions. Each was RUN, its exit code and assertion text pasted, and its plant reverted with the revert confirmed.

| # | Control | Where the transcript lives | Evidence it is a transcript |
|---|---|---|---|
| 1 | The canary's own assertion — `--invert` turns the green run red | `117-01-SUMMARY.md:90-116`, "Negative control 1 — `--invert` (verbatim, RUN)" | the `AssertionError` diff naming A1, the source line `workflow-agent-failure-canary.mjs:228:12`, `EXIT=1` at `:113`. A0 still **passed** on that run — the failure was genuinely induced and only the verdict disagreed |
| 2 | A0, the measurement precondition, observed firing under a planted log absence | `117-01-SUMMARY.md:118-152`, "Negative control 2 — A0 planted and observed firing (verbatim, RUN)" | the plant is quoted as a one-line diff (`git diff --stat`: 1 insertion, 1 deletion), and the run prints `NOTHING WAS MEASURED` with `EXIT=1` at `:150`. It exited on the precondition and **never read a verdict** — the mis-diagnosis A0 exists to prevent |
| 3 | The citation gate, observed firing on a path that does not resolve | `117-02-SUMMARY.md:180-228`, "Negative control 3: the citation gate, planted and observed firing" | the full `node --test` failure block, one offender named with its file, line and path, `EXIT=1` at `:227` |

**None is missing and none was only described.** Two further refusal-path transcripts (`117-01-SUMMARY.md:160-178`, `EXIT=1` twice) are recorded beyond the three owed — one of them driven against the operator's real agent directory and observed refusing before importing the engine.

## What this phase leaves open

| # | Carried item | Why it is carried |
|---|---|---|
| 1 | The W1/W2/W3 storage assertions were deliberately not re-landed | They belong to a different milestone's requirement, and re-landing them is scope none of WEVID-01, WEVID-02 or WDOCS-02 asks for (D-117-01). It is a recorded deferred idea in `117-CONTEXT.md`. The storage half of that route therefore has **no live coverage on this branch** — now carried by ledger entry id 45 rather than only by a SUMMARY, because a finding that lives only in a plan SUMMARY is invisible at ship time |
| 2 | Every engine claim in the published document, including the one this phase measured, is pinned to one engine version and to line numbers nothing detects drifting | The standing risk already tracked as a future requirement. This phase adds one more claim to the set it covers rather than introducing a new risk class |
| 3 | The canary is outside the project gate by design and runs only when someone runs it | It needs an out-of-tree engine install and the engine is deliberately in no dependency manifest. Nothing detects that the engine's behaviour changed underneath it. What changed with criterion 3 is that a run does not need an operator — not that a run happens automatically |
| 4 | Every published census figure is machine-local | It came from one un-vendored clone on one machine (`~/.claude/plugins/marketplaces/claude-plugins-official`), and a reader elsewhere cannot reproduce it without installing the same marketplace. That is exactly why it is published with its provenance, its read date and its counting rule, and why the consequence is published without depending on any count |
| 5 | Phase 114's verification is now stale | Its `covered_files` includes `docs/workflows-compatibility.md`, which 117-02 rewrote. Expected and already sequenced; 114's re-verification follows this phase |

## Threats: where each is now gated

High-severity threats first, as the plan requires; the mediums follow for completeness.

| Threat ID | Severity | Gate, refusal or control that now covers it |
|---|---|---|
| T-117-12 | **high** | All four over-claiming sites plus the dangling citation are corrected, each as a dated note tagged `WDOCS-02` (7 tags, gate wants ≥ 4). Three anchored gates assert the specific over-claims are gone: `^    result: CLOSED$` = 0, `live canary closed` = 0 outside blockquotes, `Exit 0, every assertion PASS` = 0 outside blockquotes. The evidence block was corrected explicitly, because fixing the outcome field alone leaves the persuasive half standing |
| T-117-18 | **high** | Each of the three owed controls was located by file and line and confirmed to be a verbatim failing transcript carrying its own exit code and assertion text — see the roll call above. None was described-only, and the SUMMARY would have said so plainly if one had been |
| T-117-SC | **high** | This plan installed nothing. It asserts the opposite and the assertion was run: neither manifest names the engine, neither is dirty, and `/tmp/wf-engine` is absent. Any package addition would have invalidated this and required the legitimacy gate |
| T-117-13 | medium | The prohibition on rewriting history is honoured by shape, not just intent: the gates are blockquote-filtered on purpose, so the legal form of a correction is one that quotes what was claimed. Every retired claim is quoted or described in the note that replaces it |
| T-117-14 | medium | The numeric citation is corrected to what the ledger holds today (id 5 is a Phase-112 `deviation` about a stale ROADMAP row, already `fixed`, from a different milestone) and the obligation moved to id 45, prefixed `[workflows-replay]` so it stays attributable when the phase number repeats |
| T-117-15 | medium | Each corrected criterion carries a dated blockquote note naming the decision that corrects it and summarizing the previous wording, so the change is a record rather than a moved goalpost |
| T-117-16 | medium | No state verb was run. `git status --porcelain -- STATE.md` is empty and the file still reads `completed_phases: 8`, `percent: 89` — the values the house gates name, verifiable by inspection |
| T-117-17 | medium | `test ! -e /tmp/wf-engine` passes and both manifest checks pass |

The workstream's untracked `.verification-ledger.json` is operator-owned and was left alone — still untracked, still unmodified.

## Deviations from Plan

### 1. [Rule 2 — Missing critical] `REQUIREMENTS.md`'s WDOCS-02 line carried the same either-way phrasing as criterion 5

- **Found during:** Task 2, while correcting criterion 5.
- **Issue:** the plan names criterion 5's "the current record wins" as ambiguous and corrects it. The matching requirement, `REQUIREMENTS.md:71`, ended with the identical phrase — "the current record wins and the stale wording goes" — and the plan does not name it. Left alone, the requirement and the criterion measuring it would have been readable as asking for opposite work: one reading removes the closure claim, the other removes the `UNRUN` cells.
- **Fix:** disambiguated the requirement text to name the `UNRUN` side outright, with a dated note at `:85` quoting the previous ending and saying why it was corrected. This is the same rule the plan applies to the census figure — the requirement and the document must not disagree — extended to a phrasing rather than a number.
- **Files modified:** `.planning/workstreams/workflows/REQUIREMENTS.md`. The checkbox was **not** flipped; it is still `[ ]`.
- **Verification:** the checkbox diff shows `[ ]` → `[ ]`; no gate regressed.
- **Commit:** `413c40ab`

### 2. [Rule 3 — Blocking] `pre-commit run --files` cannot exit 0 in this worktree

- **Found during:** both commits, as in waves 1 and 2.
- **Issue:** `.git` is a file in a linked worktree, so trufflehog's git-mode hook aborts with `failed to read index file: open .../.git/index: not a directory`. Structural, not transient — `pre-commit run --files` therefore exits 1 whatever the files contain.
- **Fix:** the route `CLAUDE.md` sanctions. A filesystem scan over exactly the paths being committed, then `SKIP=trufflehog git commit`. Both scans reported `verified_secrets: 0, unverified_secrets: 0` (12 chunks / 139,552 bytes, then 7 chunks / 83,626 bytes). `SKIP=` was extended to nothing else; `--no-verify` was never used; nothing was amended.
- **Consequence:** Task 2's `pre-commit run --files ...` verify cannot return 0 here. Every other hook in both runs passed — trailing whitespace, end-of-file, private-key detection, BiDi control characters and the rest. `mdformat` and `markdownlint-cli2` reported "no files to check", because `.planning/` markdown is excluded from both, and no hook rewrote a file: `git status` after each commit shows only the operator's pre-existing untracked and modified files.

### 3. Commits were made on `features/workflow`, not an `agent-*` branch

Worktree isolation is off for this dispatch by design and the run is directly against the operator's checkout. `features/workflow` is the sanctioned branch for this milestone; the never-`main` rule was honoured and the protected-branch assertion ran before each commit. Recorded rather than silent, as in waves 1 and 2.

**Total deviations:** 3 (1 auto-added consistency fix, 2 environment constraints recorded). **Impact:** none on the plan's objective. Every acceptance criterion and every gate passed.

## Commits

| Hash | What |
|---|---|
| `74f1f3a2` | Task 1 — the archived record's five corrections, plus the ledger append |
| `413c40ab` | Task 2 — the two live seams and the four corrected criteria |
| `5c029384` | this record |
| `e8fee922`, and one more | corrections to the `commits:` field below |

**Counting rule, stated because the number is otherwise misleading.** `actuals.commits: 2` counts **work commits** — the two task commits — matching how 117-01 and 117-02 recorded theirs (each excluded its own record commit). `git rev-list --count e7841275..HEAD` returns a larger figure because it also counts this record's commit and the bookkeeping commits that corrected this very field. Both numbers are true of different questions; the field answers "how much work did the plan commit", and the rule is written here so a reader does not have to guess which. Recorded rather than quietly rounded, since a figure without its counting rule is the defect this phase spent a task correcting elsewhere.

## Known Stubs

None.

## Threat Flags

None. This plan changed four markdown records. It added no production code, no network endpoint, no auth path and no schema change at any trust boundary.

## Verification

| Check | Result |
|---|---|
| `grep -c '^    result: CLOSED$'` | `0` (want 0) |
| `grep -v '^>' \| grep -c 'live canary closed'` | `0` (want 0) |
| `grep -v '^>' \| grep -c 'Exit 0, every assertion PASS'` | `0` (want 0) |
| `grep -c 'WDOCS-02'` | `7` (want ≥ 4) |
| ledger pair: `phase == 117` AND `[workflows-replay]` in description | `1` (was `0` before the append; want ≥ 1) |
| `git status --porcelain` over archived `103-*` / `104-*` | empty |
| `105-VERIFICATION.md` frontmatter still parses | `yaml.load` OK; `status: passed`, `result: UNRUN` |
| `grep -v '^>' REQUIREMENTS.md \| grep -c 'workflow-storage-canary'` | `0` (want 0) |
| `grep -v '^>' ROADMAP.md \| grep -c 'workflow-storage-canary'` | `0` (want 0) |
| `grep -v '^>' ROADMAP.md \| grep -c 'workflow-agent-failure-canary'` | `1` (want ≥ 1) |
| `grep -v '^>' ROADMAP.md \| grep -c '3\.5\.1'` | `0` (want 0) |
| `grep -v '^>' ROADMAP.md REQUIREMENTS.md \| grep -c 'twelve times'` | `0` (want 0) |
| `npm run check` | **exit 0**, nine links, all read individually |
| `node --test workflows-doc-pins.test.ts no-stale-test-citations.test.ts` | exit 0, `pass 5 / fail 0` |
| manifests | neither names the engine; neither dirty |
| `/tmp/wf-engine` | absent |
| `pre-commit run --files ...` | every hook passed except trufflehog, structural here (Deviation 2) |
| trufflehog `filesystem` over each committed path set | `verified_secrets: 0, unverified_secrets: 0` |
| `STATE.md` | untouched; `completed_phases: 8`, `percent: 89` |
| `.verification-ledger.json` | untracked and untouched |

**All seven gates were dry-run RED before the work and green after.** Confirmed, not assumed: `result: CLOSED` = 1, `live canary closed` = 1, `Exit 0, every assertion PASS` = 1, `WDOCS-02` = 0, seam pointers = 1 each, `3.5.1` = 1, `twelve times` = 2, ledger pair = 0.

## Self-Check: PASSED

- `.planning/workstreams/workflows/milestones/workflows-phases/105-workflow-degradation-and-documentation/105-VERIFICATION.md` — FOUND
- `.planning/workstreams/workflows/REQUIREMENTS.md` — FOUND
- `.planning/workstreams/workflows/ROADMAP.md` — FOUND
- `.planning/WINDOWS.md` entry id 45 — FOUND (`open`, `unrun-verify`, prefixed `[workflows-replay]`)
- `tests/live-uat/workflow-agent-failure-canary.mjs` — FOUND (the repointed seams resolve)
- `74f1f3a2` — FOUND
- `413c40ab` — FOUND
- `/tmp/wf-engine` — ABSENT

## Next

Phase complete on execution. Verification owns marking it so: no requirement checkbox was flipped, no phase was marked complete, and the `117-03-PLAN.md` roadmap row is still unticked here. Ledger entry id 45 stays `open` and will block the ship gate until someone waives it or re-lands the storage coverage.
