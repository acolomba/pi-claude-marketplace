---
phase: 116-load-time-workflow-convergence
plan: 04
subsystem: docs
tags: [requirements, roadmap, phase-gate, negative-control, marketplace-manifest, npm-check]

requires:
  - phase: 116-load-time-workflow-convergence
    provides: "the widened scan and its token (plan 01), the boundary and one-time gates (plan 02), the published catalog bytes and the corpus lock (plan 03) -- the whole tree this plan's single `npm run check` covers"
provides:
  - the population claim replaced at all three sites with what was actually measured, plus the bound that holds either way
  - the phase's one and only full-gate run, all nine links green, with the numbers recorded
  - the reconcile backfill pair's coverage confirmed at 100% on all three axes, run alone
  - a roll-call locating each of the four owed negative-control transcripts, verified verbatim rather than described
  - the four out-of-scope inheritances and the five high-severity threats written down with their gates
affects: [117, 114 re-verification, /gsd-verify-work, /gsd-secure-phase]

actuals:
  tokens: 2128        # chars/4 over the realized diff, 11dc2d47..HEAD
  tasks: 2
  commits: 1          # MEASURED: git rev-list --count 11dc2d47..HEAD at SUMMARY write
plan_head_before: 11dc2d4763e9dc19488523dcb29402ba5203a533

tech-stack:
  added: []
  patterns:
    - "Replace an inherited claim with the bound that holds regardless, and record the measurement's own limits beside it"
    - "Read the whole gate log, not the exit code: `format:check` sits mid-chain and a failure there hides every link after it"
    - "A control roll-call verifies transcripts mechanically (grep for `AssertionError` / `fail 1`), because a described control is indistinguishable from one never run"

key-files:
  created:
    - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-04-SUMMARY.md
  modified:
    - .planning/workstreams/workflows/REQUIREMENTS.md
    - .planning/workstreams/workflows/ROADMAP.md
    - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "The measurement half-closed the question and the prose says so: `code-modernization` IS a path source, `claude-security` is absent from the cache under that name. Neither the confirmed half nor the unmeasured half was rounded to the other"
  - "`116-CONTEXT.md`'s two statements of the retired claim were left verbatim and each given a following note, because that file is the record of the discussion; `REQUIREMENTS.md` and `ROADMAP.md` carry the corrected sentence outright with no quoted retired wording"
  - "`npm run test:integration` was run standalone as its own named verify even though it is the chain's last link, so the plan's third verify has its own transcript"
  - "The `ENBL-08` inert-case finding from 116-02 was filed to `.planning/WINDOWS.md` rather than only narrated here, so it survives this SUMMARY scrolling out of context"

patterns-established:
  - "The phase gate is read, not sampled: nine chain links enumerated from the log's script banners, both suite summaries quoted, and the whole log grepped for `✖` (zero) before the exit code was believed"

requirements-completed: [WCONV-01, WCONV-02, WCONV-03]

coverage:
  - id: D1
    description: "Every site stating which side of the retired filter the two named plugins land on now states a measured answer with its evidence, or the bound that holds regardless"
    requirement: WCONV-01
    verification:
      - kind: unit
        ref: "`grep -v '^>' REQUIREMENTS.md ROADMAP.md | grep -c 'land on that side'` = 0"
        status: pass
      - kind: unit
        ref: "`grep -c 'clone-cache resolver' REQUIREMENTS.md` != 0"
        status: pass
      - kind: manual
        ref: "the marketplace manifest read, its clone revision and the census recorded below"
        status: pass
    human_judgment: true
    rationale: "The unmeasured half -- `claude-security`'s source kind -- is a fact about a live upstream repository at a revision this machine's cache does not hold. It is recorded as unmeasured rather than inferred."
  - id: D2
    description: "The full project gate is green: typecheck, lint, fallow, formatting, the three pairing meta-gates, the unit suite and the integration suite"
    requirement: WCONV-01
    verification:
      - kind: integration
        ref: "`npm run check` -- exit 0, nine links, 5650/5650 unit and 35/35 integration, zero `✖` in 7370 log lines"
        status: pass
    human_judgment: false
  - id: D3
    description: "The owner module's per-pair coverage is 100% on function, line and branch when run alone"
    requirement: WCONV-02
    verification:
      - kind: unit
        ref: "`node scripts/test-coverage-direct.mjs .../reconcile/backfill.ts` -- branches 61/61, functions 13/13, lines 477/477"
        status: pass
    human_judgment: false
  - id: D4
    description: "All four owed negative controls are present as verbatim failing transcripts, and the byte-change control turned the catalog test red while the membership locks stayed green"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "roll-call below: each transcript located by file and line, each verified to contain a real `AssertionError` / `ℹ fail N` block"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-09-09
status: complete
---

# Phase 116 Plan 04: Load-time workflow convergence Summary

**The phase stopped carrying a claim about somebody else's repository, and went through the gate that actually gates it -- nine links, 5685 tests, zero failures.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-09-09T16:07:00Z
- **Completed:** 2026-09-09T16:21:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (3 planning docs + the broken-windows ledger); 1 created (this SUMMARY)

## Accomplishments

- Re-measured the population claim against a real manifest and got a **better answer than 116-01 did** -- one of the two named plugins is present in the cache and IS a path source. The other is absent under that name. Both halves are stated as what they are.
- Corrected the claim at all three sites, in the code's own vocabulary, without quoting the retired wording in the two documents that state current truth.
- Ran the phase gate once, to completion, and read all 7370 lines of it.
- Confirmed the reconcile backfill pair at 100% on all three coverage axes, run alone.
- Verified all four owed negative controls exist as transcripts, mechanically -- not by trusting a table of contents.
- Filed the phase's one open window to `.planning/WINDOWS.md` instead of leaving it in a SUMMARY nobody re-reads.

## Task Commits

1. **Task 1: Re-measure the population claim and correct it wherever it is stated** -- `b8965744` (docs)
2. **Task 2: Take the phase through the full gate and write down what it leaves open** -- this SUMMARY (no source change; the gate is the deliverable)

**Plan metadata:** this SUMMARY (docs)

---

## 1. The population claim -- measured, and half of it closed

### What was read

| Property | Value |
|---|---|
| Manifest | `~/.pi/agent/pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/marketplace.json` |
| Marketplace | `claude-plugins-official`, `owner: {"name":"Anthropic","email":"support@anthropic.com"}` |
| Clone revision | `1a2f18b05cf5652fd25403e8d229fc884fb84103` |
| Upstream commit date | 2026-05-12 |
| Second marketplace | `open-code-review` -- 1 entry, `"./plugins/open-code-review"`, a path source |
| Measured on | **2026-09-09** |

### The two named plugins

`REQUIREMENTS.md:8` names the pair under Evidence: `claude-security` and `code-modernization`.

| Named plugin | Manifest entry at the cached revision | Source kind | Converges through this scan? |
|---|---|---|---|
| `code-modernization` | `"./plugins/code-modernization"` | **`path`** | **yes** |
| `claude-security` | **absent under that name** | unmeasured | unknown |

`claude-security` has no entry at this revision. The nearest names are `security-guidance` (a path source, `./plugins/security-guidance`) and `42crunch-api-security-testing` (a third-party `git-subdir` pinned at `v1.0.1`). Neither is the plugin the evidence base names, and picking one would be the same inheritance this task exists to stop.

### The census over all 172 entries

| Source kind | Count | Converges at load time? |
|---|---|---|
| `url` | 83 | no |
| `path` (`./…`) | **49** | **yes** |
| `git-subdir` | 38 | no |
| `github` | 2 | no |
| **total** | **172** | 49 of 172 (28.5%) |

This reproduces 116-01's census exactly, from the same cache, independently.

### The two facts that keep the question open

- **`claude-security` is not in the cache.** Its source kind is unmeasured, full stop.
- **No entry in either cached marketplace declares a `workflows/` component directory, and none of the 35 materialized plugin directories carries one.** `code-modernization`'s own tree holds `agents/` and `commands/` only. So the population WCONV-01 names has **no member reachable from this machine**, and this measurement classifies a plugin that is not (yet) in the population.

The cache is pinned at a 2026-05-12 upstream commit, four months behind today. That makes this a statement about one machine's cache, not a falsification of the upstream claim.

### What the three sites now say

The bound is stated in the code's vocabulary at every site: **`resolveRecordedPluginOffline` passes no clone-cache resolver, so a git source resolves `unavailable` offline and only path-source records converge through this scan.**

| Site | Disposition |
|---|---|
| `REQUIREMENTS.md:55` (WCONV-01) | corrected sentence outright: the bound, the census, both measured halves, and the statement that every success criterion holds either way. No retired wording quoted. |
| `ROADMAP.md:71-79` (the workflow-hardening phase-group description) | the `land on that side` clause replaced with the bound plus the measured half. No retired wording quoted. |
| `116-CONTEXT.md:156` (the paragraph that flagged the claim) | measurement, manifest, clone revision, census and date appended beneath it |
| `116-CONTEXT.md:263` (`<specifics>`, the operator's own idea) | left **verbatim** and followed by a superseding note. This file is the record of the discussion, so it may carry the history the other two must not. |

**Gate results:**

```
$ test "$(grep -v '^>' .../REQUIREMENTS.md .../ROADMAP.md | grep -c 'land on that side')" = "0"
PASS
$ test "$(grep -c 'clone-cache resolver' .../REQUIREMENTS.md)" != "0"
PASS
$ grep -rn "land on that side\|both Anthropic-authored" REQUIREMENTS.md ROADMAP.md STATE.md extensions/ tests/ docs/
(no live site asserts the retired claim)
```

**No checkbox was flipped and no phase was marked complete.** `WCONV-01..03` were already `[x]` on arrival (116-01 and 116-02 flipped them); the `Phase 116` line at `ROADMAP.md:129` is still `[ ]`.

---

## 2. The phase gate -- `npm run check`, exit 0

The chain, read off the log's own script banners in the order they ran. **Nine links, not seven** -- there are three pairing meta-gates, not two:

| # | Link | Command | Result |
|---|---|---|---|
| 1 | `typecheck` | `tsc --noEmit` | exit 0, no output |
| 2 | `lint` | `eslint extensions tests scripts eslint.config.js` | exit 0, no output |
| 3 | `fallow` | `dead-code && health && dupes`, each `--fail-on-issues` | exit 0 (details below) |
| 4 | `format:check` | `prettier --check "**/*.{js,json,ts}" "scripts/**/*.mjs"` | **`All matched files use Prettier code style!`** |
| 5 | `test:corresponding` | `node scripts/check-corresponding-tests.mjs` | `Corresponding-test gate passed.` |
| 6 | `test:corresponding:negative` | `node scripts/check-corresponding-tests.negative.mjs` | `Corresponding-test negative controls passed.` |
| 7 | `test:coverage:direct:negative` | `node scripts/test-coverage-direct.negative.mjs` | `Direct-coverage negative controls passed.` |
| 8 | `test` | unit suite | **5650 / 5650** |
| 9 | `test:integration` | integration suite | **35 / 35** |

```
NPM_RUN_CHECK_EXIT=0
7370 lines of log
```

Unit suite summary, verbatim:

```
ℹ tests 5650
ℹ suites 313
ℹ pass 5650
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 34287.499952
```

Integration suite summary, verbatim (the chain's link 9):

```
ℹ tests 35
ℹ suites 0
ℹ pass 35
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11157.458056
```

**The log was read, not sampled.** `grep -c "✖"` over all 7370 lines returns **0**; `grep -c "✔"` returns **5998**. Zero skipped, zero todo, zero cancelled in both suites. `format:check` -- the mid-chain link whose failure would mask everything after it -- printed `All matched files use Prettier code style!` and links 5 through 9 ran after it.

### Fallow, read properly

Fallow prints an `✗` glyph on two of its three sub-gates and still exits 0, which is easy to misread:

```
fallow dead-code : ✓ No issues found (0.54s)          -- 519 entry points detected
fallow health    : ✗ 0 above threshold · 11954 analyzed · maintainability 92.3 (good)
                   ● Health score: 78 B  (hotspots -10.0 · unit size -10.0 · coupling -2.5)
fallow dupes     : ✗ 1,045 lines (1.4%) duplicated across 40 files
                   note: hid 2 reviewed clone groups from duplicates.ignoredClones
```

**`0 above threshold` is the health verdict** -- no function breaches `maxCyclomatic 20` / `maxCognitive 15` / `maxUnitSize 60` / `maxCrap 0`, and there are still zero `thresholdOverrides` in `.fallowrc.json`. The dupes line reports the standing pre-existing clone corpus (the `bridges/commands` ↔ `bridges/skills` mirror, the `*.messaging.ts` families) with the two approved `ignoredClones` hidden. Both exited 0 -- proved by link 4 running at all, since the chain is `&&`-joined, and by the chain's own exit 0.

### `npm run test:integration`, standalone

Run separately as the plan's third named verify, so it has its own transcript rather than only an in-chain one:

```
EXIT=0
ℹ tests 35
ℹ pass 35
ℹ fail 0
ℹ skipped 0
ℹ todo 0
```

`grep -c "✖"` over that log: **0**.

### The phase's own cases, green in the gate run

```
1040:✔ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()
1043:✔ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation
1046:✔ COMPAT-01: REASONS holds exactly its inherited members, in order
1178:✔ OUT-08: REASONS is the closed 46-entry reason set
5926:  ✔ D-68-03 / WCONV-02: stamps a gate-open scope whose scanned record did not grow
5931:  ✔ ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands
5932:  ✔ ENBL-08 / D-116-03: reads the same poisoned manifest when the record is enabled, and holds the gate open
5948:  ✔ RECON-04: does not re-materialize behind a disable the same load already applied
5952:  ✔ WCONV-01: promotes a cleanly-installed record whose supported set grew
5953:  ✔ NFR-5: skips a git-source record whose supported set grew, and reaches no remote
5925:  ✔ RECON-05: leaves state.json unchanged in bytes, inode and mtime when the recorded stamp already matches
7362:✔ WCONV-01 / WCONV-02: one load converges a record whose kind was invisible, and the next load rewrites nothing
```

**The gate rewrote nothing.** `git status --short` after the run shows only the operator's seven pre-existing files.

---

## 3. Per-pair coverage, run alone

```
$ node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts (branches 61/61, functions 13/13, lines 477/477)
EXIT=0
```

**100% on function, line and branch**, run alone, so nothing is credited to this module that another suite reaches. This matters here specifically: the widened scan turned previously unreachable arms into reachable ones, and 116-01 additionally removed the `installed` arm's now-always-true conditional spread in `reconcile/notify.ts` precisely because it had become an uncoverable branch.

---

## 4. Negative-control roll-call -- four owed, four present, all verbatim

Each was verified by reading the SUMMARY **and** by grepping it for a real failure block (`AssertionError`, `✖ failing tests:`, `ℹ fail N`, `error TS`). A description would contain none of those.

| # | Control | Lives in | Lines | Verbatim? | What it showed |
|---|---|---|---|---|---|
| **1** | Restore `if (record.compatibility.installable) return false;` -- the WCONV-01 promotion case must go RED | `116-01-SUMMARY.md` | 200-250 | **yes** -- `ℹ fail 1`, full `AssertionError [ERR_ASSERTION]` with the `+ [] / - [{…plugin-backfilled…}]` diff and a `backfill.test.ts:1611` stack frame | outcomes went to `[]`; nothing on this tree previously pinned that a cleanly-installed record is skipped, so this run is the only proof the new case discriminates |
| **2** | Remove `components now supported` from `REASONS` only -- the locks must go RED | `116-01-SUMMARY.md` | 259-320 | **yes** -- two transcripts: `tsc` emitting `error TS2344` + `error TS1360`, and `node --test` reporting `ℹ fail 3` with the `COMPAT-01` and `45 !== 46` assertion bodies | three independent locks red plus two typecheck errors; five derivations proved live |
| **3** | Change the token's **rendered bytes** without touching the closed set -- catalog RED, membership GREEN | `116-03-SUMMARY.md` | 245-300 | **yes** -- `[BYTE MISMATCH] section=reconcile-applied-cascade state=backfill-installed` with both `--- expected ---` / `--- actual ---` blocks, `ℹ fail 1`, **followed in the same run by** `ℹ tests 18 … ℹ fail 0` on the membership locks | **it went RED.** See below |
| **4** | Remove the `isRecordedButDisabled` filter -- the measured zero must move off zero | `116-02-SUMMARY.md` | 143-205 | **yes** -- `ℹ fail 1`, `AssertionError` showing `+ [{kind:'plugin-install-failed', … reason:'unparseable'}]` against `- []`, at `backfill.test.ts:790` | the poisoned manifest WAS read, it threw, a failure row appeared -- so the zero is measured, not missing |

### Control 3 is confirmed RED, and confirmed the strong way

The plan's obligation is specific: *"Confirm the third one actually turned the catalog test red -- if it stayed green, the pairing checks membership only and the phase is not done."*

It went red, and 116-03 ran it in the form that makes the confirmation strongest: it swapped `components now supported` for **`up-to-date`, another legal, unmodified member of `REASONS`**, rather than mangling a character. So the closed set was untouched and the two gates were observed **disagreeing in one transcript** -- 18/18 membership assertions green against a byte gate reporting `[BYTE MISMATCH]`. That is exactly the failure the criterion names (a token can be a legal member and never reach a rendered row), and it discriminates.

**A supplementary fifth control exists.** 116-01 (lines 322-355) ran its own byte-change control against the `backfill-partially-installed` state -- changing `lsp` to `Lsp` -- and pasted the `[BYTE MISMATCH]` transcript. It is the same class as Control 3 on a different state. Both are recorded; neither substitutes for the other.

**Nothing was written off.** All four owed controls are transcripts. None is a description.

---

## 5. The ungated amendment sites -- three named, four found, values recorded

`116-VALIDATION.md` names three sites that absorb a closed-set amendment with no gate firing. All four are recorded with the value found at each. Sites 1-3b were corrected by 116-01 in commit `a42a7e04`; 116-03 re-inspected them and found them already current.

| # | Site | Value found | Value written | Where recorded |
|---|---|---|---|---|
| 1 | `tests/architecture/notify-closed-set-locks.test.ts:29` -- the test's own TITLE | `45` (by 116-01) → `46` on 116-03's re-inspection | **46** | 116-01 §"three silently-green amendment sites"; 116-03 table row 1 |
| 2 | `extensions/…/shared/notify.ts:83` -- "its __-entry membership AND order" | `45` → `46` | **46** | same |
| 3a | `extensions/…/shared/notify-reasons.ts:7` -- "the __-entry membership AND order" | `45` → `46` | **46** | same |
| 3b | `extensions/…/shared/notify-reasons.ts:14` -- "the flat __-entry set" | `45` → `46` | **46** | same |
| **+1** | `extensions/…/shared/notify-reasons.ts` header -- the **running ledger** sentence narrating each count transition | no `WCONV-03` entry | one sentence appended: `WCONV-03 appends components now supported … (45 to 46)` | 116-01, "a fourth silently-green site in the same file" |
| **+2** | **`docs/output-catalog.md:63`** -- "The __-member `…::REASONS` tuple defines the closed set." | **45** | **46** | 116-03 table row 4, **CORRECTED** |

**The enumeration was short again, twice.** Three sites were named; six carried a count. `docs/output-catalog.md:63` is the sharper case: Phase 114 had "gated" it with `grep -c '45-member' docs/output-catalog.md` as a plan verify -- a check that is correct exactly once and then silently becomes a check that the site is *stale*. It was found only by a repository-wide search for the retired value.

Post-correction sweep, recorded by 116-03:

```
$ grep -rn "45-member\|45-entry" docs/ extensions/ tests/
(no output)
```

Twenty further hits live in `.planning/` and were **left exactly as written** -- they are correct statements about past states, and rewriting them would falsify the record.

---

## 6. What this phase leaves open -- the four out-of-scope inheritances

Written down here so the next reader finds them rather than rediscovering them as defects.

### 6.1 The per-script admission-gate warnings are dropped on this path (RESEARCH P4)

A re-materialization through the backfill path produces Phase 115's per-script `workflows` admission-gate warnings and **renders neither half of them**. `reinstall.ts:42-49` states it directly: the backfill caller "consumes the outcome without rendering EITHER half" -- `PluginBackfilledOutcome` carries no warnings field, and `reconcile/apply.ts::surfacePostCommitWarnings` handles only the `plugin-installed` and `plugin-disabled` arms. So a reconcile-driven re-materialize of a plugin whose scripts would be refused at runtime reports nothing, while a reconcile-driven INSTALL of the same plugin reports it.

The widening lands this gap on **exactly the population the phase targets**.

**Reason it is out of scope:** pre-existing, and tracked as BACKLOG `UPCASC-01` ("update's cascade warning channel is a carrier with no consumer", `.planning/BACKLOG.md:1829`), which is the item that decides the cascade rendering once for all callers. Fixing it here would decide that question for one caller in isolation. **Partly compensated** by WCONV-03: the row is no longer silent, so the user sees *that* something converged. The per-script detail still goes nowhere. Registered as threat **T-116-14** (Repudiation, medium, `accept`).

### 6.2 Scan cost is now proportional to every recorded plugin, in both scopes (RESEARCH P5)

The scan previously re-resolved only `installable: false` records. It now re-resolves **every** recorded plugin in both scopes on the first load after each `EXTENSION_VERSION` change. Each re-resolve is a cached manifest read plus a `resolveStrict` disk walk of the plugin root.

**Reason it is out of scope:** bounded and real, not unbounded. It is offline disk work, once per release, and the extension-version stamp is what bounds it -- the same bound WCONV-02 already reuses. Nothing in the phase needs to fix it; the phase should simply not be surprised by it.

### 6.3 One permanently failing record holds the version gate open for its whole scope (RESEARCH P7)

`maybeBackfillPlugin` returns `true` on a `failed` reinstall partition, which makes `applyBackfillForScope` skip the stamp, so the whole scope re-scans on **every** load until it succeeds. With the widened population, one permanently broken path-source record (deleted source directory, `EACCES`) now pins the gate open for every record in that scope indefinitely -- where before only the narrow `installable: false` population could do that.

**Reason it is out of scope:** the mechanism is pre-existing and unchanged; only its likelihood moved. The cost is a repeated offline scan per load -- no data loss, no unbounded growth. A fix would change the retry contract the whole scan rests on, which is a larger decision than this phase's requirements ask for. Registered as threat **T-116-13** (Denial of service, low, `accept`).

### 6.4 Growth is not specific to one component kind (RESEARCH P6)

`supportedSetGrew` compares whatever the resolver now reports against whatever was recorded. **Any** path-source record whose on-disk source has since gained a component directory -- `skills/`, `commands/`, `agents/` or `workflows/` -- re-materializes on the next version bump. The supported set derives purely from disk plus manifest and does not depend on soft-dep load state, so there is no session-to-session flapping; but the population is wider than "workflow plugins".

**Reason it is out of scope:** this is not a defect to fix, it is a fact the token had to be worded for. It is **why the token reads `components now supported` and names no component kind** (D-116-02): a token reading "workflows arrived" would be a false statement about most of the rows it fires on. The out-of-scope part is any attempt to narrow the population back down.

---

## 7. High-severity threats and where each is now gated

For the security audit that follows, so it reads evidence rather than intent.

| Threat | Category / Severity | Disposition | Gated by |
|---|---|---|---|
| **T-116-01** -- `isRecordedButDisabled` filter | Elevation of privilege / high | mitigate | `ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands` **plus its enabled twin** (`backfill.test.ts`, both green in the gate run at log lines 5931-5932), proved discriminating by **Control 4**. Second layer: reinstall's own refusal of a disabled record. **See the open window in §8** |
| **T-116-02** -- `applyBackfillForScope`'s state-file-absent guard | Tampering / high | mitigate | `hasForceInstalledPlugin`'s predicate is **byte-unchanged** (D-116-04, verified by 116-01); the standing `WR-01` case at `backfill.test.ts:529` is the control and stays green |
| **T-116-03** -- `resolveRecordedPluginOffline` → `reinstallPlugin` | Information disclosure / high | mitigate | `NFR-5: skips a git-source record whose supported set grew, and reaches no remote` (log line 5953) -- the suite's **first ever** git-source case, seeded on BOTH shapes (`owner/repo` and `https://…`), asserting zero outcomes, no failure and `clonedUrls()` deep-equal `[]`. Controlled: swapping the sources for path sources reddens it with two promotion rows |
| **T-116-08** -- `alreadyTouched` dedupe | Tampering / high | mitigate | `RECON-04: does not re-materialize behind a disable the same load already applied` (log line 5948). Controlled: dropping the pre-seeded `plugin-disabled` outcome reddens it; removing the dedupe from production reddens exactly 2 of 34 |
| **T-116-SC** -- npm/pip/cargo installs | Tampering / high | accept | **Verified mechanically:** `git diff --stat 3e10c506^..HEAD -- package.json package-lock.json` is **empty**. The phase added, upgraded and removed no package, so there was no install for a legitimacy gate to precede. The full phase diff touches 14 files, all under `extensions/`, `tests/` and `docs/` |

Medium-severity threats the phase carries: **T-116-12** (the negative-control record itself -- discharged by §4's roll-call) and **T-116-14** (dropped warnings -- accepted, §6.1). Low: **T-116-10** (the population sentence -- discharged by §1) and **T-116-13** (§6.3).

---

## 8. Known open window -- carried, not closed

**`ENBL-08: skips a disabled record whose supported set grew` does not gate the filter its title names.**

116-02 measured it: with `isRecordedButDisabled` deleted from production, the whole 34-case suite reddens **twice**, and this pre-existing case is not one of them. Reinstall's own refusal of a disabled record produces a `skipped` partition, so no row appears either way. The case is not wrong -- it pins the second layer -- but its title claims more than it gates, and it is satisfied by a mechanism other than the one it names.

This is the milestone's "green because it checks nothing" class, and it is precisely why 116-02 was asked for a measured zero instead of another missing-row case. The new `ENBL-08 / D-116-03` pair **does** gate the filter (Control 4 proves it), so the filter is covered -- but the older case is still an inert guard sitting beside a live one.

**Filed to `.planning/WINDOWS.md`** as kind `unmet-truth`, phase 116, prefixed `[workflows-replay]`, so it survives this SUMMARY scrolling out of context and reaches the ship gate. Not fixed here: retitling or rewiring it was outside every plan's action in this phase.

---

## Decisions Made

- **The measurement is reported half-closed, because that is what it is.** `code-modernization` measured as a path source -- the side the retired claim asserted -- and reporting only "unmeasured" would have thrown that away. `claude-security` is absent from the cache, and reporting it as path-source by association with `security-guidance` would have been the exact inheritance this task exists to stop. Both halves stand as measured.
- **`116-CONTEXT.md` keeps both statements of the retired claim verbatim**, each followed by a note. The two documents that state current truth carry the corrected sentence with no quoted retired wording, because a quoted retired claim reads as a live one to the next person who greps.
- **`npm run test:integration` was run standalone** despite being the chain's last link, so the plan's third named verify has its own transcript and its own exit code. This is the one deliberate duplication; `npm run check` itself was run exactly once, as the phase gate.
- **The `ENBL-08` finding went into the ledger, not just into prose.** A SUMMARY section is invisible at ship time; a `WINDOWS.md` entry is not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 -- Enumeration shorter than the set it names] The check chain has nine links, not seven**

- **Found during:** Task 2
- **Issue:** The plan states the chain as "typecheck, lint, fallow, the formatting check, **both pairing meta-gates**, the unit suite and the integration suite" -- seven links with two meta-gates. `package.json` actually chains **three** meta-gates: `test:corresponding`, `test:corresponding:negative` and `test:coverage:direct:negative`. Nine links total.
- **Fix:** the chain was enumerated from the log's own script banners rather than from the plan's sentence, and all nine are reported in §2 with their individual output.
- **Files modified:** none (a reporting correction)
- **Verification:** `grep -n "^> pi-claude-marketplace@" npm-check.log` returns exactly nine script banners after the `check` banner itself.
- **Committed in:** this SUMMARY

This is the milestone's recurring defect one more time, in the plan's own description of the gate it owns. It changed no outcome -- all nine were green -- but a seven-item report would have silently omitted two passing meta-gates.

**2. [Rule 1 -- Inherited claim narrower than what is measurable] 116-01 reported the two-plugin question as wholly unmeasurable; one half is measurable**

- **Found during:** Task 1
- **Issue:** 116-01's D6 records "the specific two-plugin claim could not be confirmed from this machine", and `REQUIREMENTS.md:55` inherited that as "Whether the Anthropic-authored workflow plugins are path-source is NOT measured". `code-modernization` **is** present in the cached manifest, as `"./plugins/code-modernization"` -- a path source. 116-01's stronger finding (no plugin carries a `workflows/` directory) is true and is why it read the question as closed, but it does not make the source-kind question unanswerable for the plugin that IS present.
- **Fix:** measured both names independently; recorded `code-modernization` as a measured path source and `claude-security` as absent-and-therefore-unmeasured, at all three sites.
- **Files modified:** `REQUIREMENTS.md`, `ROADMAP.md`, `116-CONTEXT.md`
- **Verification:** the manifest read is reproduced in §1 with the clone revision; the census reproduces 116-01's numbers exactly, which is what makes the differing conclusion a genuine additional measurement rather than a contradiction.
- **Committed in:** `b8965744`

**3. [Rule 2 -- Finding recorded where nobody will read it] The `ENBL-08` inert-case finding was only in a SUMMARY**

- **Found during:** Task 2
- **Issue:** 116-02 recorded that the pre-existing `ENBL-08` case stays green when the filter it names is deleted, and flagged it "carried into 116-04's re-read, not fixed here". A finding that lives only in a phase SUMMARY is not visible at ship time.
- **Fix:** appended to `.planning/WINDOWS.md` via `gsd-tools windows append --kind unmet-truth --phase 116`, prefixed `[workflows-replay]` per `CLAUDE.md`.
- **Files modified:** `.planning/WINDOWS.md`
- **Verification:** the append returned a written entry with `recorded_at: 2026-09-09T16:21:30.222Z` and `status: open`.
- **Committed in:** this SUMMARY's commit

---

**Total deviations:** 3 auto-fixed (2 × Rule 1, 1 × Rule 2). **Impact on plan:** none on scope and none on any prohibition. No requirement checkbox was flipped, no roadmap phase was marked complete, `npm run check` was run exactly once, and no guess was substituted for the unmeasured half of the population claim.

## Issues Encountered

- **Trufflehog's git-mode pre-commit hook aborts structurally in this linked worktree** (`.git` is a file, so `failed to read index file: … not a directory`). Handled per `CLAUDE.md`: a filesystem scan over exactly the paths being committed ran first (`chunks: 9, bytes: 95173, verified_secrets: 0, unverified_secrets: 0`), and only then `SKIP=trufflehog`. No other hook was skipped, `--no-verify` was never used, nothing was amended or rebased, no `git add -A` was run.
- **No hook rewrote a file.** `pre-commit run --files` reported every applicable hook `Passed` with no modification; `mdformat`, `markdownlint-cli2`, `prettier` and the unicode-dash/smartquote fixers all **exclude `^\.planning/`**, so planning markdown here is subject only to end-of-file, whitespace and BiDi checks.
- **The gate rewrote nothing.** `git status --short` after `npm run check` shows only the operator's seven pre-existing files (`.claude/settings.json`, `.codex/config.toml`, and five untracked paths). None was touched.

## Verification Run

| Gate | Result |
|---|---|
| `npm run check` (9 links) | **exit 0**, 7370 log lines, zero `✖`, 5998 `✔` |
| ├─ `typecheck` | exit 0, no output |
| ├─ `lint` | exit 0, no output |
| ├─ `fallow dead-code` | `✓ No issues found`, 519 entry points |
| ├─ `fallow health` | `0 above threshold · 11954 analyzed · maintainability 92.3 (good)` |
| ├─ `fallow dupes` | 1,045 lines (1.4%) across 40 files, 2 approved clones hidden, exit 0 |
| ├─ `format:check` | `All matched files use Prettier code style!` |
| ├─ `test:corresponding` | `Corresponding-test gate passed.` |
| ├─ `test:corresponding:negative` | `Corresponding-test negative controls passed.` |
| ├─ `test:coverage:direct:negative` | `Direct-coverage negative controls passed.` |
| ├─ `test` | **5650 / 5650**, 313 suites, fail 0, skipped 0, todo 0 |
| └─ `test:integration` | **35 / 35**, fail 0, skipped 0, todo 0 |
| `npm run test:integration` (standalone) | exit 0, **35 / 35**, fail 0 |
| `node scripts/test-coverage-direct.mjs …/reconcile/backfill.ts` | **branches 61/61, functions 13/13, lines 477/477** -- 100%, run alone |
| `grep -v '^>' REQ ROADMAP \| grep -c 'land on that side'` = 0 | passes |
| `grep -c 'clone-cache resolver' REQUIREMENTS.md` != 0 | passes |
| `pre-commit run --files <the three docs>` | every applicable hook Passed; no file modified; trufflehog fails structurally |
| `trufflehog filesystem <the three docs> --results=verified,unknown --fail` | `verified_secrets: 0, unverified_secrets: 0`, exit 0 |
| `git diff --stat 3e10c506^..HEAD -- package.json package-lock.json` | **empty** (T-116-SC discharged) |

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- **The phase is through its gate.** All four plans are executed; `npm run check` is green over the whole phase tree; the owner module's per-pair coverage is complete when run alone.
- **`/gsd-verify-work`** has, in one place: the four control transcripts with their locations (§4), the six ungated amendment sites with the value found at each (§5), the four out-of-scope inheritances with the reason each is out of scope (§6), and the population measurement with its manifest, clone revision and date (§1).
- **`/gsd-secure-phase`** has §7: five high-severity threats with the case or filter that gates each, and `T-116-SC` discharged mechanically rather than asserted.
- **Phase 114's verification is now stale**, as `116-CONTEXT.md` anticipated: `docs/output-catalog.md` and `tests/architecture/catalog-uat.test.ts` are in its `covered_files` and both moved (two new states, corpus lock 195 → 197, two re-byted states). 114's re-verification is correctly sequenced after 116 and 117.
- **Carried, not closed:** the `ENBL-08` inert case (§8, filed to `WINDOWS.md`); the `backfill-partially-installed-no-reasons` catalog state id now under-describes its row (116-01 flagged it, 116-03 declined the rename as churn); the `partially-installed` arm still has no published state pinning its composed order against an absent host engine (116-03, out of scope under D-116-06's fixed state count); and `STATE.md`'s comment-defect bullet naming `backfill.test.ts:320` is stale and should be struck (116-02 measured that the token it names no longer exists anywhere in that file).
