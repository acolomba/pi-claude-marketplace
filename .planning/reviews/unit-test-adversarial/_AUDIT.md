# Consistency audit — unit-test-findings/ (full corpus)

**Auditor scope:** the whole review corpus as of **2026-09-04** — the **45
first-pass area files** (`unit-test-findings/*.md`), the **58 adversarial reports**
(`unit-test-findings/adversarial/*.md`), and `META-FINDINGS.md`. This file
replaces the earlier 41-file version, which predated `platform.md`,
`transaction.md`, `root-index.md` and the entire adversarial directory.

**Division of labour.** `META-FINDINGS.md` owns the *conclusions* — the production
bugs, the NFR-10 cluster, the leverage order, the operator decisions. This file
owns the *arithmetic and the reviewer calibration*: how many findings there
actually are, what happened to the first pass's findings when they were attacked,
whose unexamined claims survived, and where the corpus still contradicts itself.

**Method.** Every number below is measured, not quoted:

- Finding counts by regex over the `**[BLOCKER]` / `**[WARNING]` markers in every
  file (`grep -a` — several reports carry non-UTF8 bytes and are otherwise skipped
  as binary).
- Grading verdicts by extracting each report's `## Grading of first-pass findings`
  section and counting `- **CONFIRMED|UNDERSTATED|OVERSTATED|REFUTED|DUPLICATE`
  bullets, cross-checked against each report's own `## Verdict summary` table.
- Clean-list exposure from each report's `**Clean files attacked:**` header field.
- Every reconciled cross-report count in §4.3 re-measured against `tests/` and
  `extensions/` directly.

---

## 1. Corpus-wide tally

### 1.1 Measured totals

| | BLOCKER | WARNING | Findings |
|---|---:|---:|---:|
| **First pass** (45 area files) | 78 | 378 | **456** |
| **Adversarial pass** (58 reports, new findings only) | 231 | 708 | **939** |
| **Raw corpus** | **309** | **1,086** | **1,395** |
| less REFUTED first-pass findings | −19 | | |
| less DUPLICATE-OF first-pass findings | −16 | | |
| **Distinct findings after grading** | | | **1,360** |

Grading outcome of the first pass, corpus-wide (**576 verdicts issued** over
~456 distinct first-pass findings — the split areas issue more verdicts than they
have findings, because each slice re-grades the findings that straddle its
boundary):

| Verdict | Count (grading bullets) | Count (reports' own summary tables) |
|---|---:|---:|
| CONFIRMED | 403 | 387 |
| UNDERSTATED | 85 | 86 |
| OVERSTATED | 55 | 67 |
| REFUTED | 19 | 15 |
| DUPLICATE-OF | 14 | 16 |
| out-of-range / deferred | — | 3 |

**Roughly 70% of the first pass's recorded findings held** (403/576 CONFIRMED),
which matches META's ~69% estimate. The severity signal did not hold nearly as
well: 140 of 576 verdicts (24%) changed a finding's severity in one direction or
the other, and the direction is not uniform — see §3.

**Corrected BLOCKER band.** Applying the UNDERSTATED upgrades and OVERSTATED
downgrades as a range rather than a point (the grading bullets do not record which
severity a finding was moved *from*):

- **Lower bound 290 BLOCKER** — raw 309, minus the refuted/duplicated first-pass
  BLOCKERs and the OVERSTATED downgrades.
- **Upper bound 394 BLOCKER** — raw 309 plus all 85 UNDERSTATED promotions.
- **WARNING correspondingly 913–1,017.**

Use the band, not a point estimate, and read META's own warning with it: **do not
plan by finding count.** Several of the largest clusters collapse to one
production change.

### 1.2 Two counting corrections the refresh must carry

**(a) The reports under-count themselves, so any header-derived tally is low.**
Each adversarial report opens with a `## Verdict summary` table declaring its own
new-finding counts. Summed, those tables declare **227 new BLOCKER and 640 new
WARNING**; the actual `**[BLOCKER]` / `**[WARNING]` markers in the same 58 files
count **231 and 708**. **27 of the 58 reports disagree with their own header**,
almost always by under-declaring WARNINGs (`architecture-hooks-gates` declares 13
and carries 21; `domain-core` declares 16 and carries 20;
`architecture-state-drift-gates` declares 21 and carries 26). One report,
`bridges-skills.md`, **has no `New WARNING` row at all** while carrying 23 WARNING
markers.

META's "+221 BLOCKER and ~645 WARNING" is a header-derived figure and is therefore
**low by 10 BLOCKER and ~63 WARNING**. The authoritative counts are the marker
counts: **231 / 708**.

**(b) The previous first-pass total is superseded.** The 41-file version of this
audit verified 74 BLOCKER + 355 WARNING (429 findings, after removing 6 cross-file
duplicates). With `platform.md`, `transaction.md` and `root-index.md` present, the
measured first-pass corpus is **78 BLOCKER + 378 WARNING = 456 findings across 45
files**. The 6 first-pass duplicates identified then are all now formally owned —
see §4.1.

**(c) "Four areas overturned outright" is wrong, in both of META's lists.** META's
headline sentence says *four* areas that recorded "0 BLOCKER" or "the strongest
tier" were overturned, then names *six*; its master-tally bullet names a
*different* six. Measured, **eleven first-pass areas recorded 0 BLOCKER and now
carry BLOCKERs**:

| Area | first-pass B | adversarial new B |
|---|---:|---:|
| `domain-core` | 0 | 6 |
| `bridges-skills` | 0 | 5 |
| `orchestrators-root` | 0 | 5 |
| `orchestrators-plugin-messaging` | 0 | 4 |
| `root-index` | 0 | 4 |
| `edge-root` | 0 | 3 |
| `architecture-catalog-uat` | 0 | 2 |
| `bridges-hooks-payloads` | 0 | 2 |
| `edge-handlers-plugin` | 0 | 2 |
| `shared-concerns` | 0 | 2 |
| `orchestrators-import` | 0 | 1 |

The five META names in neither list are `architecture-catalog-uat`,
`edge-handlers-plugin`, `edge-root`, `orchestrators-import` and
`orchestrators-plugin-messaging`. The per-area counts META *does* give all match
this measurement exactly.

---

## 2. Per-area tally

`fB`/`fW` = first-pass BLOCKER/WARNING. `aB`/`aW` = adversarial **new**
BLOCKER/WARNING (grading verdicts are not double-counted here — every adversarial
marker in the corpus lives under a `New findings` heading, verified by section).
`C/U/O/R/D` = grading of the first pass's own findings. `CA` = clean-list entries
this area's reviewer(s) attacked. Corrected columns apply the transparent rule
`corrB = fB + aB + U`, `corrW = fW + aW − U − O − R − D`; footnoted areas override
it with the adversarial reviewer's own re-derivation.

| Area | fB | fW | aB | aW | C | U | O | R | D | CA | corrB | corrW |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| architecture-boundary-gates | 1 | 8 | 10 | 28 | 8 | 3 | 0 | 1 | 0 | 11 | **14** | **32** |
| architecture-catalog-uat ᶜ | 0 | 9 | 2 | 19 | 12 | 1 | 2 | 1 | 2 | 5 | **3** | **22** |
| architecture-hooks-gates | 1 | 17 | 4 | 21 | 11 | 2 | 4 | 1 | 1 | 7 | **7** | **30** |
| architecture-notify-gates | 2 | 9 | 6 | 12 | 7 | 1 | 1 | 1 | 1 | 15 | **9** | **17** |
| architecture-state-drift-gates | 1 | 17 | 7 | 26 | 16 | 3 | 0 | 1 | 0 | 11 | **11** | **39** |
| bridges-agents ᵃ | 2 | 7 | 2 | 15 | 6 | 1 | 2 | 0 | 0 | 14 | **3** | **19** |
| bridges-commands | 1 | 8 | 2 | 12 | 7 | 2 | 0 | 0 | 0 | 5 | **5** | **18** |
| bridges-hooks-adapters-state | 1 | 12 | 3 | 17 | 11 | 3 | 1 | 1 | 0 | 2 | **7** | **24** |
| bridges-hooks-async-rewake | 4 | 8 | 4 | 6 | 10 | 1 | 1 | 0 | 0 | 2 | **9** | **12** |
| bridges-hooks-dispatch | 4 | 8 | 4 | 9 | 8 | 1 | 2 | 0 | 1 | 2 | **9** | **13** |
| bridges-hooks-exec-protocol | 2 | 3 | 7 | 9 | 3 | 1 | 1 | 0 | 0 | 11 | **10** | **10** |
| bridges-hooks-if-field | 3 | 12 | 6 | 10 | 14 | 1 | 0 | 0 | 0 | 0 | **10** | **21** |
| bridges-hooks-payloads | 0 | 9 | 2 | 7 | 4 | 2 | 1 | 2 | 0 | 14 | **4** | **11** |
| bridges-mcp ᵉ | 5 | 5 | 3 | 15 | 7 | 2 | 0 | 1 | 0 | 12 | **9** | **17** |
| bridges-skills | 0 | 10 | 5 | 23 | 2 | 2 | 1 | 0 | 0 | 9 | **7** | **30** |
| domain-components ᶠ | 2 | 9 | 3 | 13 | 7 | 1 | 2 | 1 | 0 | 5 | **6** | **18** |
| domain-components-hooks ᶠ | 2 | 15 | 2 | 10 | 15 | 0 | 2 | 0 | 0 | 0 | **3** | **23** |
| domain-core | 0 | 6 | 6 | 20 | 5 | 1 | 0 | 0 | 0 | 19 | **7** | **25** |
| domain-resolver ᵍ | 2 | 4 | 11 | 26 | 7 | 2 | 2 | 1 | 0 | 0 | **15** | **25** |
| edge-completions ʰ | 1 | 8 | 4 | 11 | 3 | 0 | 4 | 1 | 2 | 3 | **5** | **12** |
| edge-handlers-marketplace ᵇ | 6 | 9 | 2 | 6 | 7 | 1 | 1 | 1 | 0 | 1 | **3** | **19** |
| edge-handlers-plugin ᵇ | 0 | 8 | 2 | 7 | 5 | 3 | 0 | 0 | 0 | 8 | **5** | **12** |
| edge-handlers-root ᵈ | 2 | 8 | 2 | 9 | 7 | 1 | 2 | 0 | 0 | 3 | **4** | **15** |
| edge-root | 0 | 7 | 3 | 7 | 5 | 1 | 0 | 1 | 0 | 8 | **4** | **12** |
| orchestrators-import | 0 | 12 | 1 | 15 | 8 | 2 | 1 | 1 | 0 | 7 | **3** | **23** |
| orchestrators-marketplace-add-update | 1 | 13 | 8 | 26 | 11 | 2 | 1 | 0 | 0 | 3 | **11** | **36** |
| orchestrators-marketplace-rest ⁱ | 6 | 9 | 4 | 11 | 11 | 1 | 1 | 0 | 0 | 6 | **11** | **18** |
| orchestrators-plugin-enable-fetch | 1 | 10 | 5 | 15 | 11 | 2 | 2 | 0 | 0 | 2 | **8** | **21** |
| orchestrators-plugin-info | 2 | 6 | 8 | 22 | 18 | 5 | 0 | 0 | 1 | 0 | **15** | **22** |
| orchestrators-plugin-install | 3 | 8 | 16 | 34 | 24 | 6 | 0 | 0 | 3 | 3 | **25** | **33** |
| orchestrators-plugin-list-uninstall | 3 | 11 | 12 | 26 | 9 | 2 | 3 | 1 | 0 | 3 | **17** | **31** |
| orchestrators-plugin-messaging | 0 | 6 | 4 | 10 | 5 | 0 | 1 | 0 | 0 | 10 | **4** | **15** |
| orchestrators-plugin-reinstall ʲ | 3 | 10 | 11 | 29 | 21 | 8 | 1 | 1 | 0 | 3 | **20** | **29** |
| orchestrators-plugin-support | 1 | 9 | 5 | 15 | 7 | 1 | 2 | 0 | 1 | 12 | **7** | **20** |
| orchestrators-plugin-update | 2 | 7 | 11 | 28 | 20 | 6 | 0 | 0 | 1 | 3 | **19** | **28** |
| orchestrators-reconcile-apply | 2 | 6 | 5 | 12 | 5 | 3 | 0 | 0 | 0 | 2 | **10** | **15** |
| orchestrators-reconcile-notify ᵏ | 2 | 7 | 2 | 12 | 7 | 0 | 0 | 1 | 1 | 4 | **2** | **17** |
| orchestrators-root | 0 | 9 | 5 | 12 | 8 | 1 | 0 | 0 | 0 | 6 | **6** | **20** |
| persistence | 3 | 5 | 7 | 16 | 7 | 1 | 0 | 0 | 0 | 12 | **11** | **20** |
| platform ˡ | 1 | 10 | 4 | 13 | 10 | 1 | 1 | 0 | 0 | 9 | **5** | **21** |
| root-index ˡ | 0 | 3 | 4 | 4 | 1 | 2 | 0 | 0 | 0 | 2 | **6** | **5** |
| shared-concerns | 0 | 2 | 2 | 5 | 1 | 0 | 1 | 0 | 0 | 3 | **2** | **6** |
| shared-core | 1 | 7 | 1 | 17 | 6 | 1 | 2 | 0 | 0 | 26 | **3** | **21** |
| shared-notify ᵐ | 4 | 6 | 11 | 40 | 21 | 5 | 9 | 0 | 0 | 0 | **20** | **32** |
| transaction ˡ | 1 | 6 | 3 | 8 | 5 | 0 | 1 | 1 | 0 | 3 | **4** | **12** |
| **TOTAL** | **78** | **378** | **231** | **708** | **403** | **85** | **55** | **19** | **14** | **286** | **~394** | **~913** |

**Footnotes — areas whose tally an adversarial report re-derived.** These override
the mechanical rule above.

- ᵃ **`bridges-agents`: both first-pass BLOCKERs struck.** Both rest on refuted
  mechanisms (`stage.test.ts:1383` kills the claimed mutation;
  `finalizeAgentsReplacement` has no force branch). Every first-pass WARNING held.
  Corrected first-pass contribution: **0 BLOCKER**, so the area is 2 BLOCKER (both
  new: the argument-threading class and the bridge/orchestrator contract mismatch).
- ᵇ **`edge-handlers-marketplace` 6 BLOCKER → 1 ticket.** The 6-BLOCKER vs
  1-grouped-WARNING split against `edge-handlers-plugin` is **granularity, not
  severity** (META Calibration): 6 of that area's findings graded OVERSTATED on
  exactly this point. The six marketplace-handler BLOCKERs collapse into the single
  17-module injection-seam ticket. But `adversarial/edge-handlers-plugin`
  simultaneously **upgrades** the grouped WARNING to BLOCKER on the ownership rule
  ("suites assert contracts owned three layers down"), so the two adversarial
  reports pull the same cluster in opposite directions and META adopts both — see
  the unresolved severity conflict in §4.4(1).
- ᶜ **`architecture-catalog-uat`:** slice A promotes one first-pass WARNING to
  BLOCKER (the production-path mismatch), so the area is 2 new + 1 promotion.
- ᵈ **`edge-handlers-root`: the `marketplace-seed.ts:95` double-cast BLOCKER moves
  to WARNING.** `saveState` runtime-validates against `STATE_VALIDATOR` and throws
  (`persistence/state-io.ts:486-491`), so a wrong shape cannot reach disk silently.
  Corrected first-pass: **1 BLOCKER + 9 WARNING**. Priority stays high on blast
  radius (8 of 12 plugin-handler suites and 5 of 7 marketplace-handler suites route
  every fixture through it).
- ᵉ **`bridges-mcp`:** the first-pass `sourcePath`-fallback BLOCKER is misdiagnosed
  — the branch is unreachable (all three call sites pass it). It is production dead
  code, not a missing assertion; corrected first-pass 4 BLOCKER.
- ᶠ **`domain-components-hooks`:** the `matcher.test.ts` Set-order BLOCKER drops to
  WARNING (`piTools` order is not a contract; the only consumer calls `.has()`),
  while two real BLOCKERs were missed — the clearest instance of severity error in
  *both* directions inside one area.
- ᵍ **`domain-resolver`:** the `/dev/null` finding is mis-severed (a `stat` of a
  fixed path, not a hermeticity break) and its prescribed remedy would delete the
  only cover of `defaultStatKind`'s neither-arm.
- ʰ **`edge-completions`:** the first pass prescribed the `super(message, {cause})`
  options-bag fix here; that fix is a **measured regression** wherever the class
  also declares `override readonly cause`. 4 of its 9 findings graded OVERSTATED —
  the highest overstatement rate outside `shared-notify`.
- ⁱ **`orchestrators-marketplace-rest`:** 4 of its findings rest on the struck
  loose-equality mechanism (§4.3) and do not survive as stated.
- ʲ **`orchestrators-plugin-reinstall`: two of three first-pass BLOCKERs name a
  symbol that does not exist** (`reinstallSummary`). The `GAP-12`/`GAP-14` fix
  instructions are additionally wrong as written (`GAP-12`'s `assert.match` would go
  red; `GAP-14`'s rationale is wrong twice). Corrected first-pass: **1 BLOCKER**.
- ᵏ **`orchestrators-reconcile-notify`: both first-pass BLOCKERs fall.**
  `reasonAsContent` is refuted outright (covered at `notify.test.ts:484`, inside the
  very block the finding claims to have searched); `backfill.ts:440`'s validator
  branch is unreachable through the public surface, so the prescribed case cannot
  exist. Corrected first-pass: **0 BLOCKER**; the area's 2 BLOCKERs are both new and
  are different defects. All four of its clean verdicts also fell.
- ˡ **Late areas, superseded on arrival:** `platform` 1/10 → **~5/21** (one original
  re-scoped); `root-index` 0/3 → **~6/5**; `transaction` 1/6 → **~4/12**. These
  match META's calibration note.
- ᵐ **`shared-notify`: 9 OVERSTATED in one area** — the largest single-area
  overstatement in the corpus, driven by fragment-assertion sites that a sibling
  already byte-pins. Its BLOCKER count still rises 4 → ~20 across three slices.

---

## 3. Calibration — whose clean list to trust

The adversarial pass attacked **286 clean-list entries** across the corpus. This
section is the answer to the only question the fixing pass needs from a clean
list: *if this reviewer said nothing about a file, is that evidence?*

### 3.1 The corpus rate

**Clean verdicts failed far more often than recorded findings did.** Recorded
findings held at ~70% (§1.1). Clean verdicts, counted per area from each
adversarial report's own ratio, held at roughly **one in three**. The four
distinct forms of the same failure, all named by the adversarial reviewers:

1. a `### Clean files` entry,
2. a **Summary sentence** ("Structurally the suite is sound"),
3. an **inline reassurance** ("otherwise this file is strong", "both production
   modules are otherwise clean"),
4. and — inside a 5k–9k-line file — **the cases the reviewer did not name**.

Form 4 is the most expensive: `install.test.ts`'s three slices attacked the
unflagged 95% of a file the first pass called "one of the strongest-engineered in
the sweep" and returned **16 BLOCKERs**.

### 3.2 Clean lists that held — trust an unexamined claim here

| Area | Ratio | What held, and why it counts |
|---|---|---|
| `bridges-hooks-async-rewake` | **1/2 overturned, WARNING-grade only** | `ring-buffer.test.ts` "survives a full mutation sweep" — 12 named mutations, 100% branch, one equivalent mutant recorded. The only casualty is a wrong truncation marker in `ring-buffer.ts`'s file header. **The strongest clean verdict in the corpus.** All 4 new BLOCKERs are in `registry.test.ts`, which was never clean-listed. |
| `edge-handlers-plugin` | **0/7 clean test files overturned** | All seven clean-listed suites survived mutation attack; `shared.test.ts` is "the strongest file in the tier", `bootstrap.test.ts` "the best plant in the tier". Its assertion-quality claim is verified across 121 cases: zero `assert.ok`, zero substrings, zero casts. **Trust its test-side clean list.** Its *blanket production* claim ("no findings in any of the 12 production modules") is a different object and yielded 2 BLOCKERs. |
| `architecture-state-drift-gates` | **2/11 overturned** | Nine production modules CONFIRMED clean under attack. Note the split verdict: its *production* clean list is the most reliable in the corpus, while four of the ten **gates** it reviewed cannot fire on the spelling the production code uses. Reviewer reliability and subject health are independent. |
| `orchestrators-marketplace-add-update` (add side) | **2/2 overturned, WARNING-only** | `add.messaging.test.ts`'s whole-object compare "is actually stronger than both siblings". Recorded as "a genuine confirmation that small `*.messaging` pairs are the healthiest corner of this area". All 5 new BLOCKERs landed in the already-flagged `add.test.ts`. |
| `root-index` (technique verdict) | files 2/2 overturned, **technique held** | Every file drew findings, but the *claim about the technique* survived: the `Proxy` refusal machinery and exact-name `strong-mock` kill nine mutation families, including dropped `await`, stage reordering, and `process.cwd()` substituted for `event.cwd`. **Keep the technique in the patterns table; discard the file-level clean verdict.** |
| `orchestrators-import` (test side) | **5/7 overturned, but the 2 survivors are the test modules** | `index.ts` "genuinely clean"; `index.test.ts` "a model barrel test"; `execute.test.ts` "the strongest test module I read in this area". The only BLOCKER is production (`execute.ts:592`). The one area whose **test side is genuinely clean of every dominant class.** |
| `bridges-commands` | **2/5 overturned, WARNING-only** | `unstage.ts` "the best-tested module in this area" (12 named mutations caught); `index.ts` and `types.ts` held. Both BLOCKERs are in `stage.test.ts`/`discover.test.ts`, which were declared "otherwise clean" — form 3, not a clean-list entry. |
| `architecture-catalog-uat` (corpus half) | **1 clean claim refuted, corpus verified total** | An independent parser re-implementation reproduced 182 = 182 with zero orphans, zero duplicates, and all 11 production mutations caught. The single casualty is a "no Plan/Phase/Wave reference" claim (two `Phase-73` fixture comments). **The fixture corpus is the most independently verified artifact in the sweep.** |
| `edge-root` | **6/8 overturned — but read the 2** | `types.test.ts` and `flag-catalog.test.ts` "survived named attacks, which is a different and much stronger kind of clean": `satisfies` positives plus `@ts-expect-error` negatives that break on any widening. |
| `shared-core` | **1 BLOCKER out of 26 attacked** | Five files survive outright (`session-env`, `vars`, `notify-reasons`, `types`, `debug-log`); six more kill every named mutation and take only WARNING gaps. The single BLOCKER is the one that mattered most — `assertPathInside`'s unproven precondition. |
| `orchestrators-plugin-enable-fetch` (positive verifications) | **3/3 held**, 2/2 clean files fell | Its three explicit "verified, no finding" production claims — lock re-entrancy, the cross-ledger import boundary, `fetch.ts`'s seam-option pattern — all re-confirmed. **An explicitly verified claim is worth far more than a clean-list entry**, even from the same reviewer in the same file. |

### 3.3 Clean lists that collapsed — re-derive everything

| Area | Ratio overturned | Severity that came out |
|---|---|---|
| `architecture-notify-gates` | **4/4 clean gates** | 6 BLOCKER. The gate singled out as a model "planting" gate is blind to 21 live violations inside the tree it scans. |
| `orchestrators-reconcile-notify` | **4/4** | 2 BLOCKER. Both first-pass BLOCKERs also fell (§2 ᵏ) — wrong in both directions at once. |
| `orchestrators-root` | **6/6** | 5 BLOCKER, incl. a doc comment claiming a compile-time guarantee disproved with a `tsc` run. |
| `domain-components` | **5/5** | 3 BLOCKER, incl. **a shipping production bug inside the clean list** (`mapPiToClaudeToolName` returning `Object.prototype` members). |
| `architecture-boundary-gates` | **6/8 gate files** | 10 BLOCKER. Shared root cause: an absence assertion with no proof the scan can produce a non-empty result. |
| `architecture-hooks-gates` | **5/7 production** | 4 BLOCKER. Three of the seven already carried findings *in other areas' files* — the clean verdict was never checked against the corpus. |
| `bridges-hooks-exec-protocol` | **3/4 test + 2/7 production** | 7 BLOCKER, the highest per-file rate in the corpus. |
| `bridges-skills` | **7/9 clean-listed files carry findings** | 5 BLOCKER. Assertion style is reference-grade; **what is missing is cases, not assertion strength.** |
| `platform` | **~9/9** | 4 BLOCKER, two of them in `git-credential.test.ts`, which the first pass listed clean. Contract machinery held; the layer beneath it did not. |
| `transaction` | **3/3** | 3 BLOCKER, incl. a production module with **zero callers** sitting on the clean list. |
| `persistence` | **6/12** (all 4 test modules + 2 of 8 production) | 7 BLOCKER, three on documented spec-ID contracts (D-11, ST-4, NFR-10). |
| `orchestrators-plugin-support` | **8/12** | 5 BLOCKER. "The strongest area I have seen" is true of five files and false of `clone-cache.test.ts`. |
| `edge-completions` | **3/3 declared clean → 3 BLOCKER** | Every BLOCKER in the area sits inside a file the first pass declared clean. |
| `bridges-hooks-adapters-state` | **2/2** | 1 BLOCKER apiece from both clean-listed files. |
| `bridges-hooks-dispatch` | **2/2** | 2 BLOCKER, one a live silent-degradation bug. Both clean entries were graded clean *on design*, never mutation-tested. |
| `orchestrators-marketplace-rest` | 3 clean entries → **2 BLOCKER** | "What it missed is concentrated in exactly the places it declared clean." |
| `orchestrators-plugin-list-uninstall` | **1/1, graded REFUTED** | The "both production modules are otherwise clean" verdict is refuted outright: `availableRowMessage` has one importer (the test), `FilterBucket` has none. |
| `bridges-hooks-payloads` | **2/3 both-sides-clean** | 2 BLOCKER, incl. a stale peer-dep belief frozen five layers deep. |
| `bridges-mcp` | 3 clean entries + `parse.ts` | 1 BLOCKER from the clean list (the type-level root cause); the 2 hermeticity BLOCKERs sit in an unexamined *axis* of a file cited by line. |
| `edge-handlers-marketplace` | **1/1** | 1 BLOCKER — no case proves the handler `await`s its delegate. |
| `edge-handlers-root` | **2/3** | WARNING-only from the clean list; both BLOCKERs in the non-clean `tools.test.ts`. |
| `bridges-agents` | **6/7 clean test modules** | WARNING-only — and *both* first-pass BLOCKERs were graded OVERSTATED. The clearest case of a reviewer whose clean list and severity tags were both wrong, in opposite directions. |
| `shared-concerns` | **3/3, type-level only** | 2 BLOCKER. Its *runtime* reading held (21 of 21 and 20 of 21 mutations caught); its **type-level** reading did not. Split the trust by axis, not by file. |
| `orchestrators-reconcile-apply` | **2/2** | 1 BLOCKER (a probable shipping bug, P-1) plus 4 more from files "cleared with one WARNING". |
| `domain-components-hooks` | inline claims **falsified** | 2 BLOCKER. No clean list; the attacked object was "no behavioral defect was found in the production logic itself". |

### 3.4 Areas that published no clean list — the unnamed case is the negative

Ten reports across five areas (`domain-resolver`, `orchestrators-plugin-info`,
`shared-notify`, `bridges-hooks-if-field`, `domain-components-hooks`) had **zero
clean-list entries to attack**, as did the prose-blanket areas
(`orchestrators-plugin-{install,update,reinstall}`,
`orchestrators-plugin-list-uninstall`'s test side). **Every one of them still
yielded BLOCKERs** — 6, 5, 5, 5 and 2 respectively for the first five.

The conclusion the reviewers converged on independently, in three separate
reports: **an empty clean list is no safer than a populated one — the unfalsified
negative is the reviewer's attention, not the list.** `shared-notify-b` put it
most directly: its clean list was empty and the file was still hiding four
BLOCKER-class defects. `orchestrators-plugin-info-c` reached it from the other
side: within a single 7,000-line file, a case-by-case first-pass read produces the
same unfalsified-negative problem as a clean-file list does across files.

**Do not read "this area published no clean list" as "this area was reviewed
thoroughly."**

### 3.5 What predicted collapse

Four signals, each recorded independently by more than one reviewer, that a fixing
pass can apply without re-reading anything:

1. **Graded clean on design, never mutation-tested.** `bridges-hooks-dispatch`
   names this exactly: the two production modules were "graded clean on *design*"
   and four mutations survive. Same shape in `persistence` and `platform`.
2. **Findings dominated by a single cosmetic class.** `bridges-skills` recorded
   6 of 10 findings against one JSDoc-register issue — house style — and its clean
   list then failed 7 of 9. **Where an area's findings are dominated by one
   cosmetic class, treat its clean list as unreviewed rather than merely
   unverified.**
3. **The clean verdict rests on a sentence in the source.** `list.ts:670-676`
   names a parity guard that does not exist, and a first-pass reviewer recorded the
   export verified-clean on the strength of that sentence. Two of two, then three of
   three, checked headers naming a gate were false.
4. **A superlative in the Summary.** "The strongest area reviewed so far"
   (`transaction`, `orchestrators-plugin-support`), "one of the strongest-engineered
   files in the sweep" (`install.test.ts`), "the healthiest area reviewed so far"
   (`edge-root`), "0 blockers, one of the strongest areas" (`bridges-skills`) —
   **every one of these areas produced BLOCKERs on re-attack.** The superlative
   marks where the reviewer stopped looking.

The inverse also holds and is worth as much: the claims that survived are the ones
stated as **specific, falsifiable, named verifications** — `enable-fetch`'s three
"verified, no finding" production claims (3/3 held), `edge-root`'s two
`@ts-expect-error`-backed type modules, `catalog-uat-b`'s independently
re-implemented parser. **Trust a named verification; re-derive a clean list.**

---

## 4. Cross-report consistency checks

### 4.1 The five first-pass duplicate chains are now all owned

The 41-file audit removed 6 findings as cross-file duplicates of 5 distinct
defects. All five now have a settled owner, and none is still filed twice at two
severities:

| Defect | First-pass filers | Settled disposition |
|---|---|---|
| `notify.ts`'s wide `ExtensionContext`/`ExtensionAPI` parameters | `shared-notify` (BLOCKER), `architecture-catalog-uat` (WARNING) | **WARNING**, split into META items 3a (test-only de-casting, unblocked) and 3b (production narrowing). `adversarial/architecture-catalog-uat-b` files it DUPLICATE-OF `shared-notify*`. |
| `routing-state.ts`'s `resetEpoch`/`resetRoutingState` | `bridges-hooks-adapters-state` + `bridges-hooks-dispatch` (BLOCKER), `architecture-hooks-gates` (WARNING) | Owner **`bridges-hooks-dispatch`**; `adversarial/architecture-hooks-gates` files DUPLICATE-OF it explicitly. Folded into META item 5's "test-only production exports". |
| `event-router.ts`'s inline `homedir()` reads | `architecture-hooks-gates` + `bridges-hooks-dispatch` (both WARNING) | Owner **`bridges-hooks-dispatch`**; DUPLICATE-OF filed, identical lines 179/446/573. |
| The inert HOOK-03 `additionalProperties` gate | `architecture-hooks-gates` (BLOCKER), `domain-components-hooks` (WARNING) | **Resolved and removed from Decisions** — converted into the post-split checklist, since it is one of ≥4 casualties of the same commit. Both reviewers' facts held. |
| `completion-cache.ts`'s `resetCompletionCache()` | `edge-completions` + `shared-core` (both BLOCKER) | Owner **`shared-core`**; `adversarial/edge-completions` files DUPLICATE-OF it. |

### 4.2 Adversarial DUPLICATE-OF chains (16)

The adversarial reports declare **16 DUPLICATE-OF verdicts** in their summary
tables (14 appear as grading bullets; two are recorded only in the summary row).
Every one names its owner, so no defect is left double-filed:

| Filing report | Points at | Defect |
|---|---|---|
| `architecture-catalog-uat-b` ×2 | `shared-notify*`; META Decisions item 2 | wide `notify()` ctx; the file-split decision |
| `architecture-hooks-gates` ×3 | `bridges-hooks-dispatch` ×2, `bridges-hooks-async-rewake` | reset exports; inline `homedir()`; inline `Date` read |
| `architecture-notify-gates` | META Decisions item 2 | `notify.ts` file size |
| `bridges-hooks-dispatch` | META item 3b | `registerHooksBridge` takes the full `ExtensionAPI` |
| `edge-completions` ×2 | `shared-core` | `resetCompletionCache()`; cache-file timestamp |
| `orchestrators-plugin-info-c` | `orchestrators-plugin-info-b` | intra-area slice overlap |
| `orchestrators-plugin-install-b` ×2 | in-area | stub call-count assertion; redundant git-surface check |
| `orchestrators-plugin-install-c` | in-area | hand-rolled `ctx.ui.notify` recorder |
| `orchestrators-plugin-support` | `platform` | `git-ops-fake` / `makeMockGitOps` re-implementation |
| `orchestrators-plugin-update-a` | in-area | warm sha-pinned-cache offline proof |
| `orchestrators-reconcile-notify` | in-area | `subject` variable naming |

### 4.3 META's reconciliations — re-measured, all six hold

The task treats six numbers as settled. Each was re-measured against the tree
during this audit; **all six are correct as META states them**, and three of them
overturn a claim some report still carries:

| Reconciled claim | META's figure | Measured now | Verdict |
|---|---|---|---|
| `git-ops-fake` `structuredClone` workaround | 22 sites / 12 files | `grep -a "const { auth" tests/` → **22 sites, 12 files**, and the per-file distribution matches META's table row for row | **Exact.** Settles 20/11 (install-c) vs ~15/8 (plugin-support). |
| `withHermeticHome` definitions | 13, of which 3 neutralize `PI_CODING_AGENT_DIR` | `grep -a "function withHermeticHome" tests/` → **13 files**. `marketplace/{list,info,autoupdate}.test.ts` each carry 4 references (save/delete/restore); `marketplace/update.test.ts` carries **exactly 1, and it is a comment** | **Exact.** Both prior claims were wrong: `list-uninstall-a`'s "4 marketplace copies neutralize" and `state-drift`'s "none do". |
| `as never` casts | 382 tokens on 187 lines in `notify.test.ts` | **382 tokens / 187 lines** measured | **Exact.** Note the corpus datum nobody recorded: repo-wide the count is **453** — so the tracker's proposed reconciliation ("382 = repo-wide, 187 = notify.test.ts") was wrong in both halves, and META's replacement is the correct one. |
| Injection-seam cluster | 17 modules (9 plugin + 6 marketplace handlers + `edge/handlers/tools.ts` + `orchestrators/edge-deps.ts`) | Both "the 16th" claims (`edge-handlers-root` naming `tools.ts`, `orchestrators-root` naming `edge-deps.ts`) are distinct modules | **Holds**, but see the unresolved severity conflict at §4.4(1). |
| `fetch.ts:464` dynamic import | Refuted as a violation, retained as proof the gate hole is live | `fetch.ts` imports `domain/resolver.ts` there and is correctly gated with an honest header; the regex hole (`from "…platform/git…"` only) is real on all 12 targets | **Holds.** Correctly reconciled in gate items 5. |
| catalog-uat vs. notify surfaces | Both true, different surfaces | The catalog gate byte-pins `notify()` *the function* for 182 states; production routes 18 of 19 plugin statuses through per-command `*_RENDER` maps instead | **Holds.** The two facts do not collide; the operator decision turns on the second. |
| loose `assert.equal` / `deepEqual` | Struck as spurious | `grep -arl 'from "node:assert"' tests/` → **0**; `node:assert/strict` → **261** | **Holds** — but two adversarial reports still carry the class, and META's pointers to them are wrong. See §4.4(3). |

Two further META claims verified in passing, both correct:
`catch (error: unknown)` → **0** occurrences in `extensions/`, `catch (err)` → **191**;
and `npm run check` runs `test:corresponding`, `test:corresponding:negative` and
`test:coverage:direct:negative` but **not** `test:coverage:direct` — the gate's
negative control is gated, the gate is not.

### 4.4 Contradictions and gaps META did not resolve

Five items. The first is a live severity conflict; the rest are pointer or
ownership gaps that will silently cost the fixing pass work.

**(1) The injection-seam ticket is WARNING-tier and BLOCKER-tier at the same
time.** META's Calibration ruling and item 4 both say the 17-module cluster is
**"one WARNING-tier design ticket"**, and both then adopt the `transaction`
escalation rule: *escalate an individual member to BLOCKER where the missing seam
causes an ownership violation* — immediately adding that **"the edge handlers
qualify (they assert contracts owned three layers down)"**. Fifteen of the
seventeen modules are edge handlers. So the ruling simultaneously rates the same
15 members WARNING (as one ticket) and BLOCKER (as individual members), and
nothing in META picks. **The severity of 15 of the 17 members is undetermined.**
This is exactly the disagreement (`edge-handlers-marketplace` 6 BLOCKERs vs
`edge-handlers-plugin` 1 grouped WARNING) that the ruling was written to settle.

**(2) Two BLOCKER clusters have no owning leverage item.**

- **The `bridges/mcp/stage.test.ts` hermeticity escape** (~17 cases reading the
  developer's real `~/.config/mcp/mcp.json` and `~/.pi/agent/mcp.json`) is recorded
  only under "Known gaps" as a live escape. Leverage item 2 — the one hermeticity
  remediation in the document — is scoped to `getAgentDir()` and
  `PI_CODING_AGENT_DIR`, and its promise that "one parameter-narrowing dissolves
  all of them" **does not reach a `homedir()`-derived `~/.config/mcp/` read.** The
  escape is real, BLOCKER-rated by its reporter, and unassigned.
- **The one-sided-scope-coverage class** (a helper that *clears*
  `PI_CODING_AGENT_DIR` is hermetic but makes the user scope unseedable, collapsing
  three of `root-index`'s four BLOCKERs) is introduced in item 2 with the
  cross-reference *"the inverse hazard recorded under item 8"* — **item 8 is
  "Restore exhaustiveness"**, and the hazard appears nowhere else in META. The
  cross-reference dangles and the class has no home.

**(3) Two adversarial reports still grade the struck loose-equality class
oppositely, and META's carrier pointers do not resolve to the claims.** META
strikes the class and names "`adversarial/architecture-notify-gates.md:9`" and
"`adversarial/architecture-boundary-gates.md:11`" as carriers to correct. Measured:

- `architecture-boundary-gates.md:613` grades *"Non-strict
  `assert.equal`/`assert.deepEqual`"* **CONFIRMED**, 29 sites, and argues WARNING is
  right — a live carrier of the struck class.
- `architecture-notify-gates.md:175` grades the same class **REFUTED**, with the
  correct mechanism (`node:assert/strict` makes `deepEqual` the same function
  object as `deepStrictEqual`) — the file that got it right.
- Line 9 and line 11 of those two files are `**Existing findings graded:**`
  metadata lines. **A fixing pass following META's pointers would find nothing and
  correct nothing**, while the CONFIRMED verdict at `:613` stands.

**(4) One of the 13 `withHermeticHome` definitions is outside the swept scope.**
`tests/integration/transaction-lifecycle-cascade.test.ts` is among the 13, and
META's own Provenance says `tests/integration/` was **not swept**. The in-unit-suite
figure is **12 definitions**; "13 is the number to plan from" is right only if the
ticket deliberately reaches into the integration suite, which nothing says.

**(5) `resetCompletionCache` is 18 call sites across 9 files, not 17 across 8.**
Measured: `uninstall` 4, `install` 3, `reinstall` 2, `marketplace/add` 2,
`completions/provider` 2, `completions/data` 2, `shared/completion-cache.test.ts`
1, `marketplace/update` 1, and **`tests/architecture/flag-catalog-drift.test.ts` 1**
— the architecture-test call site that both counts missed. META's substantive claim
is confirmed: `resetCompletionCache` has **zero production callers** (the only two
occurrences in `shared/completion-cache.ts` are its own declaration and a doc
comment).

Two smaller staleness items, recorded rather than escalated: `ARCHITECTURE.md`
carries `notify.ts` at 4,039 lines (measured **4,217** — META flags this) and
`resolver.ts` at 1,545 lines (measured **1,757** — META does not). Both figures are
in the same document, loaded on every session.

---

## 5. Measured coverage baseline

Regenerated today. `coverage/all-pairs-report.ndjson` holds **204 pair rows**:

| Verdict | Rows |
|---|---:|
| `complete` | 190 |
| `type-only` | 7 |
| `accepted-shortfall` | 7 |

The 7 type-only rows are `bridges/{agents,commands,mcp,skills}/types.ts`,
`edge/types.ts`, `orchestrators/types.ts`, `orchestrators/import/types.ts`.

**All 7 shortfalls are in `edge/`, each exactly one branch short:**

| Pair source | Coverage |
|---|---|
| `edge/args.ts` | branches 28/29, lines 86/89 |
| `edge/completions/data.ts` | branches 109/110 |
| `edge/completions/provider.ts` | branches 79/80 |
| `edge/handlers/marketplace/update.ts` | branches 11/12 |
| `edge/handlers/plugin/import.ts` | branches 11/12 |
| `edge/handlers/plugin/pending.ts` | branches 9/10 |
| `edge/handlers/shared.ts` | branches 14/15, lines 83/85 |

`npm run test:coverage:direct` **exits 1 today** (fail-fast at the first
shortfall). These seven are the D-116-01a compiler-forced-branch class; the ledger
in `.planning/WINDOWS.md` records seven entries, of which entries 21
(`edge/args.ts:34`) and 22 (`edge/handlers/shared.ts:53`) are **misclassified** —
both are `while (i < tokens.length)` index loops over densely built `string[]`s
that a `for…of` plus one state flag removes with no assertion and no behavior
change.

**The calibration point that matters more than the numbers.** 93% of pairs read
`complete` while the adversarial pass named **~231 BLOCKER-grade surviving
mutations**. Per-pair coverage completeness is orthogonal to assertion strength,
and the sweep produced four independent proofs: 100% branch coverage would not have
caught either BLOCKER in `orchestrators-plugin-install-a`; `domain/resolver.ts`'s
six surviving mutations all sit on always-executed code; `execute.ts:742`'s `||=`
reports both arms hit while the mutation survives; and `phase-ledger.ts` holds both
arms of all ten branches while its AS-4 prepend-to-index-0 ordering rule survives
inversion. **A green direct-coverage run is not evidence that combinations,
orderings, or `await` placement are tested** — `with-state-guard.ts:72`'s dropped
`await` creates no branch at all.

---

## 6. What a fixing pass should take from this file

1. **Take severities from §2's footnotes, not from the area files.** Eleven areas
   recorded 0 BLOCKER and now carry them; six areas' first-pass BLOCKERs were
   struck or downgraded outright. Sorting the backlog by the recorded tag will put
   refuted findings at the top.
2. **Settle §4.4(1) before ticketing the injection seams.** One ruling covers 17
   modules and currently reads both ways.
3. **Assign owners to §4.4(2)'s two orphaned clusters** — the `bridges/mcp` real-home
   reads and the one-sided-scope-coverage class — before item 2 is closed as done.
4. **Correct `architecture-boundary-gates.md:613` directly** (§4.4(3)); META's
   pointer will not lead there.
5. **Trust the eleven clean lists in §3.2 and re-derive the twenty-five in §3.3.**
   The corpus attacked 286 clean-list entries. Where an area is not listed in
   either, it published no clean list at all (§3.4) — which is not a safety signal.
   Apply §3.5's four collapse predictors before spending budget on any area's
   unexamined claims.
6. **Do not use per-pair coverage as a done signal** (§5), and do not use the
   reports' own verdict-summary headers as a tally (§1.2a).
