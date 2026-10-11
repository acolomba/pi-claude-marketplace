---
phase: 01-presentation-model
plan: 01
subsystem: testing
tags: [notify, wire-corpus, registerHooks, node-test, baseline]

requires: []
provides:
  - "scripts/notify-corpus.hook.mjs: --import preload that rewrites X.ui.notify( in extension source in memory and records (message, severity, argc) per .test.ts entry point"
  - "scripts/notify-corpus.mjs: capture / diff / baseline / check CLI; exports normalizeMessage, serializeCorpus, parseCorpus, diffCorpus"
  - "scripts/notify-corpus.negative.mjs: D-04 non-vacuity controls"
  - ".planning/phases/01-presentation-model/notify-corpus/baseline.jsonl and meta.json: the wire-corpus baseline every later plan re-diffs against"
affects: [01-presentation-model, json-output milestone close-out]

actuals:
  tokens: 153400
  tasks: 3
  commits: 3
plan_head_before: d9eabb722fe0c14a0a18e1f4b92317d62e630ad8
plan_head_after: 89eb1fcf30696567ce3dda13c20ba5d3330ca53c

tech-stack:
  added: []
  patterns:
    - "In-memory source rewrite through a module.registerHooks load hook, enabled only by an env var, so no production seam exists"
    - "Per-test-file multiset diff with a total-count floor"

key-files:
  created:
    - scripts/notify-corpus.hook.mjs
    - scripts/notify-corpus.mjs
    - scripts/notify-corpus.negative.mjs
    - .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl
    - .planning/phases/01-presentation-model/notify-corpus/meta.json
  modified: []

key-decisions:
  - "The three corpus scripts carry file-level fallow-ignore markers (unused-file on all three, plus unused-export on notify-corpus.mjs) instead of a package.json entry, because D-03 keeps the tool out of package.json and npm run check"
  - "Root normalization matches a root only where it starts a path (not inside a longer name or right after a placeholder), so nested roots take their most specific placeholder"

patterns-established:
  - "Operator-run corpus tooling: capture with `node scripts/notify-corpus.mjs check`, never through npm run check"

requirements-completed: [PMOD-01, PMOD-03]

coverage:
  - id: D1
    description: "Capture preload and CLI record every ctx.ui.notify call through an in-memory rewrite and diff two corpora per test file as multisets"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs capture --out <tmp>/help.jsonl --files tests/edge/handlers/plugin/help.test.ts && node scripts/notify-corpus.mjs diff <tmp>/help.jsonl <tmp>/help.jsonl"
        status: pass
    human_judgment: false
  - id: D2
    description: "Negative controls prove a one-byte drift fails and names its file, a shrunken capture is refused, and a reordered or extended capture passes"
    requirement: PMOD-03
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.negative.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deterministic, ASCII, leak-free baseline committed; the one-command re-diff passes on the unchanged tree"
    requirement: PMOD-03
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-29
status: complete
---

# Phase 1 Plan 01: Notify Wire-Corpus Capture Tool Summary

**A `module.registerHooks` preload records all 2622 `ctx.ui.notify` calls the unit and integration suites make. A per-file multiset diff with a count floor compares each re-capture against a committed ASCII baseline, and two full captures of the unchanged tree are byte-identical.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-29T12:02:57Z
- **Completed:** 2026-09-29T12:53:22Z
- **Tasks:** 3
- **Files modified:** 5 (all created)

## Accomplishments

- `scripts/notify-corpus.hook.mjs` rewrites `X.ui.notify(` into `globalThis.__corpusNotify(X.ui, ` while extension modules load. The rewrite exists only in memory, and the hook does nothing unless `NOTIFY_CORPUS_OUT` is set. It records only when the entry point ends in `.test.ts`, so forked children such as `concurrent-install-child.ts` never record.
- `scripts/notify-corpus.mjs` has four verbs. `capture` takes `--files` or reads the package.json suite globs. `diff` fails on a missing entry or a shrunken total. `baseline` writes the baseline and `meta.json`. `check` runs one command that re-captures, warns on a Node major mismatch, and diffs.
- The committed baseline holds **2622 entries from 69 test files**, captured on **Node v26.10.0**: 1378 entries with one argument and 1244 with two. 81 entries contain a normalized placeholder.
- Determinism: a second full capture was byte-identical to the baseline (`cmp`), and `diff` came back clean in both directions (0 missing, 0 extra).
- Leak scans are clean. The home/`/tmp/`/token/private-key `rg` found nothing, the non-ASCII `grep -P` found nothing, and `trufflehog filesystem` found 0 verified and 0 unverified secrets. The only `/home/...` strings are the fixture literals `/home/user` and `/home/u` from the tests.

## Task Commits

1. **Task 1: Capture one test file end to end and diff it against itself** - `69636141` (feat)
2. **Task 2: Whole-suite capture, check verb, count floor, and negative controls** - `093bb0cc` (feat)
3. **Task 3: Capture, prove deterministic, scan, and commit the baseline** - `89eb1fcf` (test)

## Files Created/Modified

- `scripts/notify-corpus.hook.mjs` - the `--import` preload: `registerHooks` load hook and the `__corpusNotify` recorder
- `scripts/notify-corpus.mjs` - capture / diff / baseline / check CLI and the pure diff core
- `scripts/notify-corpus.negative.mjs` - D-04 controls: one-byte drift, count-floor refusal, benign reorder plus extra, one-file end-to-end capture
- `.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl` - 2622-line ASCII-escaped wire corpus
- `.planning/phases/01-presentation-model/notify-corpus/meta.json` - `nodeVersion`, `capturedAt`, `entries`, `files`, `argcOne`, `argcTwo`

## Decisions Made

- The scripts are kept out of `package.json` (D-03). To keep `fallow dead-code` green, they carry file-level `fallow-ignore-file` markers instead, following the `tests/live-uat/*.mjs` precedent for operator-run drivers.
- `normalizeMessage` matches a root only where a path starts. It skips a match inside a longer name or right after a placeholder that an earlier, longer root produced. Roots are applied longest first: the checkout becomes `<CWD>`, home becomes `<HOME>`, and the temp root replaces the whole path token with `<TMPPATH>`.

## Milestone-close removal (D-01)

At milestone close, after the final corpus re-diff comes back empty, delete these files: `scripts/notify-corpus.hook.mjs`, `scripts/notify-corpus.mjs`, `scripts/notify-corpus.negative.mjs`, and the `.planning/phases/01-presentation-model/notify-corpus/` directory. Their fallow-ignore markers go with them. This plan added no npm script entry, so nothing needs removing from `package.json`. ROADMAP's close-out criterion 6 tracks this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow reported the operator-run scripts as unused**

- **Found during:** Task 1 (pre-commit `npm-fallow` hook), and again in Task 2.
- **Issue:** `fallow dead-code` reported `scripts/notify-corpus.mjs` and `scripts/notify-corpus.hook.mjs` as unused files. Every other script is reachable through a package.json npm script, and D-03 forbids adding one. Once the negative script imported the core, fallow reported the four exported helpers as unused exports.
- **Fix:** Each file got a `// fallow-ignore-file unused-file -- <reason>` marker, the same form as the operator-run UAT drivers in `tests/live-uat/`. `notify-corpus.mjs` also got `// fallow-ignore-file unused-export -- <reason>`.
- **Files modified:** all three scripts
- **Verification:** `npm run fallow` (through pre-commit) passes, and so does `npm run check`.
- **Committed in:** `69636141`, `093bb0cc`

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The suppressions are scoped to one file each and are deleted with the tool at milestone close. There is no scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `node scripts/notify-corpus.negative.mjs`: prints `Notify corpus negative controls passed.` and exits 0.
- `node scripts/notify-corpus.mjs check`: prints `Notify corpus check passed: 2622 baseline entries present, 0 extra.` and exits 0.
- `npm run check`: exits 0, run unpiped and logged (`CHECK_EXIT=0`). The unit suite ran 7255/7255 and the integration suite 36/36.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `rg -n "__corpusNotify" extensions` and `rg -n "notify-corpus" package.json`: both print nothing.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

The baseline exists before any renderer change, so plans 01-02 onward can run `node scripts/notify-corpus.mjs check` at their end. Capture and re-diff on the same Node major. The baseline was taken on v26, and `check` warns on a mismatch because messages embed Node's error text.

## Self-Check: PASSED

- All five created files exist on disk.
- Commits `69636141`, `093bb0cc`, and `89eb1fcf` exist on `features/json`.

---
*Phase: 01-presentation-model*
*Completed: 2026-09-29*
