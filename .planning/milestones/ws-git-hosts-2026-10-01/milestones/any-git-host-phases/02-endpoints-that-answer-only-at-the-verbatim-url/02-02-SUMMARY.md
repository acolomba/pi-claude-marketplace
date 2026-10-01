---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
plan: 02
subsystem: plugin-clone-cache
tags: [git, clone-url, isomorphic-git, plugin-install, plugin-update, plugin-fetch, url-source]

requires:
  - phase: 02-endpoints-that-answer-only-at-the-verbatim-url
    provides: "networkCloneUrl(source) in domain/clone-key.ts, landed by plan 01"
provides:
  - "materializePluginClone / materializeOrRefreshPluginMirror take a required networkUrl field instead of deriving it internally"
  - "resolvePluginPin derives its wire url from networkCloneUrl(source) instead of an unconditional .git suffix"
  - "all nine plugin-orchestrator call sites (install/reinstall/fetch/info/update-preflight) thread networkUrl from the source they already hold"
affects: [02-03-residual-suite-audit-and-check]

actuals:
  tokens: 9619
  tasks: 3
  commits: 3
  plan_head_before: c79123d60e20f52fc22d7eedb329aeab3bd8e1dd
  plan_head_after: bfe43963b5951640e63e009046014c7b68bc684b

tech-stack:
  added: []
  patterns:
    - "Required (never optional/defaulted) field addition across a seam and all its callers, using the compiler's own missing-property errors as the completeness gate for 39 sites (9 production, 30 test)."
    - "Success-plus-failure MURL-09 regression pair per seam: one case asserting call count 1 AND the sent url by value, one case injecting an HTTP-error-shaped throw and asserting the original identity (message/code/data.statusCode) survives alongside the same count-1 assertion."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - tests/orchestrators/plugin/clone-cache.test.ts
    - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "networkUrl is REQUIRED (no `?`, no default to cloneUrl) on both materialize arg types, so the compiler names every one of the 39 construction sites (9 production, 30 test) rather than letting an un-updated site compile clean and silently send the wrong url."
  - "The two `gitlab.example.com/o/r` pass-through cases (materializePluginClone, materializeOrRefreshPluginMirror) pass a DIFFERING pair via named `cloneUrl`/`wireUrl` locals and assert the sent url against `wireUrl` by variable, not by re-typing the literal -- this is what makes `grep -c 'gitlab.example.com/o/r.git'` land on exactly 3 (2 locals + 1 allowlist entry) instead of 5."
  - "ALLOWED_CLONE_CACHE_REMOTES (clone-cache.test.ts) and the two template-built allowlists (fetch.test.ts) are narrowed to the url forms the suite actually sends after D-2-03, so a reintroduced suffix or a wrong host surfaces as `blocked unplanned remote` rather than an allowlist that silently tolerates both."
  - "info.test.ts needed zero edits: its `ALLOWED_INFO_REMOTES` already admits both suffixed and unsuffixed forms per host, and every one of its assertions is a call-count check, not a recorded-URL-value check, so D-2-03's wire-form change is invisible to that file's existing suite. Left untouched rather than narrowed, since narrowing it was not in this task's job list and the suite already passes green with real signal (the count assertions still fail if a clone is skipped)."
  - "The MURL-09 success case for `resolvePluginPin` was folded into the existing PROV-02 bare-call test (added an explicit `.length` assertion beside the existing `deepEqual`) rather than duplicated as a new case; the materializePluginClone and materializeOrRefreshPluginMirror success cases likewise reuse their existing 'exactly one clone' tests with an added url-value assertion. Only the three FAILURE-path cases (404/401/404) are wholly new, since nothing in the file previously counted calls on a failure path."
  - "DEVIATION from a literal plan acceptance criterion: `grep -c 'example.com/repo.git'` reads 3, not the plan-predicted 1, because the untouched `canonicalCloneUrl` identity fixture (PURL-03/07, never listed as needing an edit) spells the same literal on three separate lines (raw/url/assert). The plan's OTHER criterion -- `assert.equal(canonicalUrl, \"https://example.com/repo.git\");` must appear verbatim -- is structurally incompatible with reducing the file-wide count to 1 without editing that untouched fixture, and touching an untouched test the job list never flagged would violate CLAUDE.md's surgical-changes rule. Preserved the assert-literal criterion (which passed) and the fixture unedited; the count criterion is the one left unsatisfied."

requirements-completed: [MURL-08, MURL-09]

coverage:
  - id: D1
    description: "resolvePluginPin sends the verbatim wire url (github kept suffixed) and still returns the .git-stripped cache-key identity; both materialize functions stop deriving a wire url internally and take it as a required caller-supplied field, threaded through all nine callers."
    requirement: "MURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#MURL-08 / PURL-09: resolvePluginPin sends the url as typed and still returns the canonical cache-key identity"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#MURL-08 / PURL-04: materializePluginClone forwards the caller's wire url and keys the dir off the identity url"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#MURL-08 / PURL-04: materializeOrRefreshPluginMirror forwards the caller's wire url and keys the mirror off the identity url"
        status: pass
    human_judgment: false
  - id: D2
    description: "All nine caller sites (install-clone-probe x2, reinstall-clone-probe x1, fetch x2, info x2, update-preflight x2) thread networkUrl from the source they already hold; the field is required so the compiler names every omission."
    requirement: "MURL-08"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (production tree clean; command output captured in this session)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every one of the three seams is pinned at exactly one attempt per operation on the success path and on an injected 404/401, with the sent url asserted by value, and the original error identity (message/code/data.statusCode) survives with no retry."
    requirement: "MURL-09"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#MURL-09: resolvePluginPin makes exactly one resolveRemoteRef attempt and a 404 keeps its original identity"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#MURL-09: materializePluginClone makes exactly one clone attempt and a 401 keeps its original identity"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#MURL-09: materializeOrRefreshPluginMirror makes exactly one clone attempt and a 404 keeps its original identity"
        status: pass
    human_judgment: false
  - id: D4
    description: "No test title in the direct seam suite still promises the retired suffix-everywhere rule; six wire-url expectations for non-github fixtures (including the private-ref fragment-strip proof) were rewritten to the verbatim form."
    requirement: "MURL-08"
    verification:
      - kind: unit
        ref: "grep -nE '^void test\\(|^test\\(' tests/orchestrators/plugin/clone-cache.test.ts | grep -cE 'suffixed url but|adds exactly one suffix' == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "fetch.test.ts's owner suite asserts the verbatim wire url for every url-kind fixture (including two template-built allowlists an exact .git\" grep never caught) and the suffixed one for the sole github-kind fixture; info.test.ts required no change."
    requirement: "MURL-08"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/fetch.test.ts (27/27 pass), tests/orchestrators/plugin/info.test.ts (150/150 pass)"
        status: pass
    human_judgment: false
  - id: D6
    description: "All six modules this plan touched hold 100% direct function/line/branch coverage in isolation, with no new scripts/test-coverage-direct.pin.json row, and lint:type-members is clean with the four contract coordinates remapped in place (entry count unchanged at 108)."
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs <each of the six modules> (all exit 0); npm run lint:type-members (TYPE_MEMBERS_EXIT=0, 4 pre-existing exceptions, contract count 108)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The plugin flow suites' allowlists that still admit only the suffixed form are LEFT red by design; this plan does not touch them."
    human_judgment: true
    rationale: "The specific set of suites confirmed red (install-flow.test.ts, update-flow.test.ts, tests/integration/marketplace-add-seed-mirrors.test.ts) differs from the phase-level prediction in ROADMAP/STATE.md (which additionally named bootstrap, reconcile, register, and marketplace-update as red); this plan measured the actual state rather than assumed it, and a human/plan-03 reviewer should confirm the measured set against the phase-boundary npm run check before closing plan 03."

duration: 165min
completed: 2026-09-27
status: complete
---

# Phase 2 Plan 2: Plugin clone-cache seam threads the derived wire url through all nine callers Summary

**`materializePluginClone` and `materializeOrRefreshPluginMirror` stop deriving a wire url at all -- they take a required `networkUrl` field from the caller, `resolvePluginPin` derives it from `networkCloneUrl(source)`, and the direct seam suite now proves forwarding-not-appending with a differing identity/wire pair plus a first-ever exactly-one-attempt regression guard on all three seams.**

## Performance

- **Duration:** ~165 min (inline sequential execution; no per-task wall-clock timer was captured mid-session, so this is a session-span estimate, not an instrumented duration)
- **Completed:** 2026-09-27T03:56:10Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `resolvePluginPin` derives its wire url via `networkCloneUrl(source)` (not `ensureGitSuffix`) and still returns the `.git`-stripped `cloneUrl` identity, unchanged signature.
- `materializePluginClone` and `materializeOrRefreshPluginMirror` each gained a required `networkUrl: string` field (no `?`, no default), replacing their internal `ensureGitSuffix(args.cloneUrl)` derivation with a straight read of the caller-supplied field. The disk key still hashes `args.cloneUrl` unchanged.
- All nine caller sites across `install-clone-probe.ts` (2), `reinstall-clone-probe.ts` (1), `fetch.ts` (2), `info.ts` (2), and `update-preflight.ts` (2) now compute `networkUrl: networkCloneUrl(<source>)` alongside their existing `cloneUrl`.
- `clone-cache.ts` widened its existing `export { canonicalCloneUrl } from "../../domain/clone-key.ts";` re-export to include `networkCloneUrl`, so `fetch.ts`, `info.ts`, and `update-preflight.ts` keep importing both names from the same place.
- Four `scripts/check-unused-type-members.contracts.json` line:col pins shifted under the new import lines in `info.ts` (1351→1352) and `update-preflight.ts` (137→138, 138→139, 346→349 -- the last one shifted by 3, not 1, because two production edits inside `probeUnpinned`/`probePinned` land above it in the same file). Contract entry count unchanged at 108.
- `tests/orchestrators/plugin/clone-cache.test.ts` (the direct owner suite, read in full at 1575 lines before editing): all 29 literal-construction sites gained the required field; six wire-url expectations for non-github fixtures were rewritten from the suffixed to the verbatim form; the private-ref case now proves the fragment strip runs on `source.raw`; three test titles that promised the retired suffix-everywhere rule under `MURL-01`/`PURL-09` were retitled to `MURL-08`; `ALLOWED_CLONE_CACHE_REMOTES` was narrowed from 8 to 6 entries; and a first-ever MURL-09 exactly-one-attempt-plus-identity guard was added for all three seams (one success case per seam amended with an explicit count+url assertion, plus three brand-new failure-path cases injecting a 404/401/404 and proving `message`/`code`/`data.statusCode` survive unchanged).
- `tests/orchestrators/plugin/reinstall-clone-probe.test.ts`: the one recorded-call expectation the compiler named gained `networkUrl`.
- `tests/orchestrators/plugin/fetch.test.ts`: seven of eight `networkUrl` locals lost their `.git` suffix (the github-kind pair stayed suffixed); both template-built allowlists (an ENETUNREACH-retry case and a partially-available/git-subdir case -- neither caught by a plain `.git"` grep) dropped their appended suffix.
- `tests/orchestrators/plugin/info.test.ts` needed zero edits: its allowlist already admits both forms and every assertion there is a call-count check, not a URL-value check.
- All six touched production modules verified at 100% direct function/line/branch coverage in isolation; `scripts/test-coverage-direct.pin.json` stayed `{ "rows": [] }`.

## Task Commits

1. **Task 1: thread the derived wire URL through the seam and its nine callers** - `a909adaf` (feat)
2. **Task 2: the direct seam suite asserts forwarding, not appending** - `80251086` (test)
3. **Task 3: the fetch and info owner suites, and direct coverage for all six modules** - `bfe43963` (test)

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` - `resolvePluginPin` derives `networkUrl` from `networkCloneUrl(source)`; both materialize functions take a required `networkUrl` field instead of deriving one; re-export widened.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts` - both call sites (mirror + clone) pass `networkUrl: networkCloneUrl(source)`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts` - the one clone call site passes `networkUrl: networkCloneUrl(source)`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` - both call sites inside `materializeThroughSeam` pass `networkUrl`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - both call sites inside `makeFetchProbe`'s `probeUnpinned`/`probePinned` pass `networkUrl`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - both call sites inside `probeUnpinned`/`probePinned` pass `networkUrl`.
- `scripts/check-unused-type-members.contracts.json` - four coordinates remapped in place (info.ts 1351→1352; update-preflight.ts 137→138, 138→139, 346→349), entry count unchanged at 108.
- `tests/orchestrators/plugin/clone-cache.test.ts` - 29 construction sites, 6 wire-expectation rewrites, 3 retitled cases, narrowed remote allowlist, 6 new/amended MURL-09 count-and-identity cases.
- `tests/orchestrators/plugin/reinstall-clone-probe.test.ts` - 1 construction site.
- `tests/orchestrators/plugin/fetch.test.ts` - 7 of 8 wire constants, 2 template-built allowlists.

## Decisions Made

See `key-decisions` in the frontmatter above. In short: the `networkUrl` field is required everywhere with no default; the two pass-through-proof cases use named `cloneUrl`/`wireUrl` locals rather than repeated literals so `grep -c` lands on the plan's exact expected counts; `info.test.ts` was left untouched because it was already insensitive to the wire-form change and narrowing its allowlist was not in this task's job list; and one literal plan acceptance criterion (`example.com/repo.git` count == 1) was deliberately left unsatisfied because satisfying it would have required editing an untouched, unflagged test fixture, which conflicts with the plan's own sibling criterion demanding that fixture's assertion line stay verbatim.

## Deviations from Plan

### Auto-fixed Issues

None — Rules 1-3 were not needed. The one deviation below is a documented **acceptance-criterion conflict**, not an auto-fix.

**1. [Acceptance criterion conflict, not a Rule 1-3 fix] `example.com/repo.git` grep count reads 3, not the plan-predicted 1**
- **Found during:** Task 2, final acceptance-criteria verification pass
- **Issue:** The plan's own acceptance criteria contain two checks that cannot both hold simultaneously without editing a test the plan's Job 1/2/3 descriptions never flagged: (a) `grep -c 'example.com/repo.git' ... prints 1` and (b) `grep -c 'assert.equal(canonicalUrl, "https://example.com/repo.git");' ... prints 1`. The untouched `PURL-03/07: clone-cache re-exports preserve canonical and subdirectory helper identity` fixture spells the literal on three separate lines (`raw:`, `url:`, and the assert itself) — satisfying (a) requires collapsing those three into a shared variable, which breaks the exact-literal-assert-call text (b) demands.
- **Resolution:** Attempted the variable-extraction fix first (satisfying (a)), then reverted it after confirming it broke (b) and that this fixture was never named in any Job description as needing an edit — CLAUDE.md's surgical-changes rule (touch only what the request requires) took precedence over an ambiguous acceptance-criterion pair. Left the fixture byte-identical to its pre-plan-02 form; criterion (b) passes, criterion (a) does not.
- **Files modified:** None (net: `tests/orchestrators/plugin/clone-cache.test.ts`'s `PURL-03/07` test is unchanged from before this plan)
- **Verification:** `grep -c 'assert.equal(canonicalUrl, "https://example.com/repo.git");' tests/orchestrators/plugin/clone-cache.test.ts` → `1` (pass). `grep -c 'example.com/repo.git' tests/orchestrators/plugin/clone-cache.test.ts` → `3` (does not match the plan's literal expectation of `1`; the underlying invariant it exists to protect — that the identity form does not leak the wire-form decision — is intact, verified by the untouched test still passing).
- **Committed in:** `80251086` (Task 2)

---

**Total deviations:** 1 (an acceptance-criterion conflict resolved in favor of the more behavior-relevant, narrower-scope criterion and CLAUDE.md's surgical-changes rule). **Impact:** None on shipped behavior; one bookkeeping grep in the plan's own acceptance list reads 3 instead of 1, and the reason is recorded here for the verifier and for plan 03.

## Issues Encountered

None beyond the one documented deviation above.

## Mid-Plan Red — Honest Report (per plan directive, not hidden or worked around)

**After Task 1**, the test tree did not typecheck: all 29 literal-construction sites in `clone-cache.test.ts` and the 1 in `reinstall-clone-probe.test.ts` were missing the new required `networkUrl` field. This was the planned, expected state; Task 2 closed it.

**At the end of this plan**, the following suites were empirically confirmed RED (run individually with `node --test`), because their remote allowlists or recorded-value expectations still assume the pre-D-2-01 suffix-everywhere rule:

| Suite | Tests | Fail | Failure shape |
|---|---|---|---|
| `tests/orchestrators/plugin/install-flow.test.ts` | 157 | 12 | Mix: `createGitOpsFake blocked unplanned remote <url>` (allowlist rejects the now-verbatim url) and `deepStrictEqual`/version mismatches downstream of the blocked clone |
| `tests/orchestrators/plugin/update-flow.test.ts` | 171 | 16 | `deepStrictEqual`/`strictEqual` mismatches (recorded sha/version expectations built against the suffixed wire form); no `blocked unplanned remote` lines observed |
| `tests/integration/marketplace-add-seed-mirrors.test.ts` | 6 | 5 | `deepStrictEqual`/`strictEqual` mismatches (seeded-mirror URL/version expectations); no `blocked unplanned remote` lines observed |

**Suites that ROADMAP/STATE.md predicted would also be red but were empirically confirmed GREEN in this session** (their allowlists already admit both forms, or their assertions never check a URL value): `tests/orchestrators/plugin/bootstrap.test.ts` (7/7 pass), `tests/edge/register.test.ts` (163/163 pass), `tests/orchestrators/reconcile/reconcile.messaging.test.ts` (13/13 pass), `tests/orchestrators/marketplace/update.test.ts` (63/63 pass). This narrows plan 03's actual blast radius versus the phase-level prediction; plan 03 should re-verify against the full `npm run check` rather than assume the wider predicted set.

**Do NOT restore a `.git` suffix anywhere to make any of the above green** — that would revert this plan's fix. Plan 03 owns closing these suites and the phase-boundary `npm run check`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `networkCloneUrl`/`resolvePluginPin`/`materializePluginClone`/`materializeOrRefreshPluginMirror` are landed, all nine callers threaded, and the three seams are pinned at exactly one attempt per operation with the sent url asserted by value on both success and injected-failure paths.
- All six touched production modules hold 100% direct coverage; `lint:type-members`, `npm run lint`, `npm run format:check`, and `npx tsc --noEmit` all exit clean across the whole tree (production and tests).
- Plan 03 (wave 3) inherits: the residual suite audit named above (install-flow, update-flow, marketplace-add-seed-mirrors, confirmed; the phase-boundary `npm run check` will surface the authoritative full list), the docstrings that may still teach the retired suffix rule outside this plan's touched files, and MURL-09's REQUIREMENTS.md text (already re-aimed per D-2-04 in plan 01/02's shared context, not re-verified here).
- No blockers for plan 03 to proceed.

---
*Phase: 02-endpoints-that-answer-only-at-the-verbatim-url*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 10 modified/created files verified present on disk; all 3 task commits (`a909adaf`, `80251086`, `bfe43963`) verified present in git log. Final re-run: `npx tsc --noEmit` 0 errors, `npm run format:check` clean, `npm run lint:type-members` 4 pre-existing exceptions / entry count 108, and the six seam+owner test files together: 270/270 pass, 0 fail.
