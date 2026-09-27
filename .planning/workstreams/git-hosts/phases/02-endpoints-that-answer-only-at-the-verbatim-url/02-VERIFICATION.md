---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
verified: 2026-09-27T08:52:28Z
status: human_needed
score: 8/8 must-haves verified
covered_files:
  - .planning/workstreams/git-hosts/REQUIREMENTS.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-01-PLAN.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-01-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-02-PLAN.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-02-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-03-PLAN.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-03-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-CONTEXT.md
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - scripts/check-unused-type-members.contracts.json
covered_digest: "v2:sha256:5f5a94e09f630b8a66a8b0127fef5db966447bbe14162f7c15ad91dcd7bf7d69"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Point `marketplace add <url>` at a REAL smart-HTTP git server (e.g. a bare repo served via `git http-backend` behind nginx, or any host you control) that answers ONLY at the verbatim path and returns 404 for the `.git`-suffixed form. Confirm both the initial clone and a later `resolveRemoteRef` (e.g. `marketplace update`) resolve against it."
    expected: "The add succeeds and a later update/resolve also succeeds, proving isomorphic-git's smart-HTTP ref advertisement against a REAL server behaves the way the offline `createGitOpsFake` assumes."
    why_human: "02-VALIDATION.md's own 'Manual-Only Verifications' table names this item and it was never closed by any of the three plans — every phase test (`tests/edge/handlers/marketplace/add.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/plugin/clone-cache.test.ts`, etc.) proves the URL SENT is verbatim via an offline fake (`createGitOpsFake`'s `allowedRemoteUrls`); none of them exercises a real HTTP round trip against a server that actually 404s the `.git` form. This mirrors Phase 1's own open live-canary item (`01-VERIFICATION.md`), which the milestone has not yet closed either."
  - test: "Read `02-REVIEW-FIX.md` § 'One residual, stated plainly' (commit `9e08b48a`) and decide whether the reload-identity change it documents is acceptable, the same way D-2-02 was formally accepted in `02-CONTEXT.md`."
    expected: "A recorded decision (accept as-is, or file a follow-up) for: re-parsing a PERSISTED `url` source whose path carries a trailing slash immediately before a `#<ref>` fragment (e.g. stored `raw: '.../o/r/#main'`) now yields a different `canonicalCloneUrl` on reload than the pre-phase code did (`.../o/r/` instead of `.../o/r`), which costs one re-clone (a fresh `plugin-clones/<hash>` directory) for any already-installed plugin matching that narrow shape on its first reload after upgrading past this phase."
    why_human: "This directly touches the plan's own must-have that `canonicalCloneUrl` returns the same string 'as it did before this plan, so no plugin-clones/ directory rehashes' (02-01-PLAN.md must_haves). The fixer's own report frames it as 'worth a human glance rather than a silent pass' rather than folding it silently into D-2-02's already-accepted regression. Verified narrow in scope (one input shape, one-time reclone cost, pinned by a test at 9e08b48a) and not a functional break of MURL-08/MURL-09, but it was never presented to the operator as a decision the way D-2-01/D-2-02 were in 02-CONTEXT.md, so it is not mine to accept on the phase's behalf."
---

# Phase 2: Endpoints that answer only at the verbatim URL Verification Report

**Phase Goal:** A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed and returns 404 for the conventional `.git`-suffixed form, and a repository that is genuinely missing or genuinely forbidden still fails as itself.

**Verified:** 2026-09-27T08:52:28Z
**Status:** human_needed
**Re-verification:** No — initial verification

## How this was verified

Not from SUMMARY.md narration. Independently, in this session: read all three PLAN/SUMMARY pairs and
every review artifact; read the actual production code at HEAD (`2ecac99b`) for every symbol the
plans claim to have added or changed; ran the targeted test suites myself (`marketplace/add`: 219
tests, plugin clone-cache + probes: 274, plugin flow suites + seed-mirrors integration: 473,
architecture gates: 23 — 989 tests run directly, 0 failures); ran `npx tsc --noEmit` myself (clean);
ran the full `npm run check` chain myself end-to-end in this session (not reused from a prior run) and
read its raw log rather than trusting an echoed exit code, confirming `test:coverage:unit` (7309/7309
pass, 100.00/100.00/100.00 lines/functions/branches), `test:integration` (36/36 pass),
`lint:type-members` (4 recorded exceptions, contract count 108, independently reconfirmed via
`node -e`), and `lint:type-members:negative` (7/7 negative controls pass) all completed with no error
text and the chain ran to its final `&&` link. Probed `networkCloneUrl` and `stripSlashAndFragment`
directly with `node --experimental-strip-types` against the exact repro inputs an orphaned review
artifact (`02-REVIEW.iter2.md`) claimed still fail — they do not; see the Anti-Patterns section.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `marketplace add` of a `url` source sends the URL the user typed, with trailing slashes and `#<ref>` stripped and the `.git` decision left exactly as typed, against a git port that admits ONLY the verbatim form (MURL-08, D-2-01). | ✓ VERIFIED | `tests/edge/handlers/marketplace/add.test.ts`: `CLONE_URL = "https://gitlab.example.com/team/alpha"` (no `.git`), `URL_SOURCE` carries `#main`, `allowedRemoteUrls: [CLONE_URL]` — real edge handler + real parser + real orchestrator, run directly (219/219 pass in the add suites). `networkCloneUrl`'s `url` arm reads `source.raw` (`extensions/pi-claude-marketplace/domain/clone-key.ts:101`), confirmed by direct probe. |
| 2 | A `github` source still sends `https://github.com/<owner>/<repo>.git`, byte-identical to today (SC4). | ✓ VERIFIED | `networkCloneUrl`'s `github` arm is `ensureGitSuffix(canonicalCloneUrl(source))`; the 3 unchanged exact-string `canonicalCloneUrl` cases (`tests/domain/clone-key.test.ts:134,149,165,293`) still read the pre-phase literals; `MURL-01 regression: github source is byte-identical` test passes. |
| 3 | A `url` source whose typed input ended in `.git` still sends `.git` (derives from `source.raw`, not the parse-time-stripped `source.url`) (SC4, D-2-03). | ✓ VERIFIED | `tests/orchestrators/marketplace/add.test.ts` `MURL-08 / D-2-01: url source with a typed .git suffix clones the suffixed URL and stores the suffix-less identity` passes; `tests/domain/clone-key.test.ts`'s `networkCloneUrl` block asserts the `raw`-ends-in-`.git`-while-`url`-does-not case by exact string. |
| 4 | `canonicalCloneUrl` returns the same string for every source kind as it did before this plan (SC4, D-76-01). | ✓ VERIFIED (see human item #2) | 3 unchanged exact-string cases still pass; the reviewer's iteration-3 restructure was independently diffed against the pre-phase parser extracted from `130d68a9` over 23 inputs with `IDENTITY_DIFFS=0` on first parse (`02-REVIEW-FIX.md`), which this verification treats as strong evidence for the *first-parse* case. One narrow *reload* exception exists (a persisted source whose path carries a trailing slash immediately before a `#<ref>`); flagged as human item #2 rather than a silent pass, per the plan's own literal wording. |
| 5 | `marketplace add` makes exactly ONE clone attempt per operation on both the success and failure path, URL asserted by value, not shape (MURL-09, SC3, D-2-04). | ✓ VERIFIED | `tests/orchestrators/marketplace/add.test.ts` — 3 MURL-09 cases (404, 401, D-2-02 refusal) each assert `state.cloneCalls.length === 1` AND `state.cloneCalls[0]?.url` by exact string in the same test body; read directly, confirmed these are `assert.equal`, not `.includes`/regex. |
| 6 | A 401/403/404/5xx from the clone keeps its original error identity and message through the add seam (SC2). | ✓ VERIFIED | Same 3 cases assert `err === cloneThrows` by reference, plus `.message`, `.code`, `.data.statusCode` unchanged; `addGitClonedInGuard`'s catch only appends a cleanup-leak note and rethrows (`appendLeakToError`), read directly at `add.ts:692-702`. |
| 7 | `networkCloneUrl` is a pure function of `source` — no process/fs/network state (MURL-08 concurrency edge). | ✓ VERIFIED | Read the function body directly (`clone-key.ts:96-104`): a 3-arm switch over pure string ops, no `await`, no `process`, no `node:fs` import in the module. |
| 8 | Exactly-one-attempt is per OPERATION, not per process — N concurrent operations record N calls, one each (MURL-09 concurrency edge). | ✓ VERIFIED | The recorded-call arrays (`state.cloneCalls`, `state.resolveRemoteRefCalls`) are per-fixture-instance, not global/module-level state; each MURL-09 test constructs its own `createGitOps(...)` fixture, and `calls.clone.push(...)` in `tests/platform/git-ops-fake.ts` runs before `requireRemote`/injected-error, so count correctness does not depend on serialization. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified).

### Roadmap Success Criteria Cross-Check

| SC | Text | Status |
|----|------|--------|
| SC1 | verbatim-path `clone` AND `resolveRemoteRef` both resolve | ✓ — `resolvePluginPin` (resolveRemoteRef) and `addGitClonedInGuard`/`materializePluginClone`/`materializeOrRefreshPluginMirror` (clone) all route through `networkCloneUrl`; each has a passing test. |
| SC2 | 401/403/404/5xx keeps original error identity | ✓ — truth 6 above, plus equivalent `clone-cache.test.ts` MURL-09 cases for all three plugin seams. |
| SC3 | exactly ONE network attempt per operation, both paths | ✓ — truth 5 above, plus 9-call-site coverage in plan 02 (`grep -rc 'networkUrl: networkCloneUrl(' extensions/.../orchestrators/plugin/` = 9, confirmed). |
| SC4 | `.git` only where Claude Code appends it; `canonicalCloneUrl` unchanged | ✓ with one disclosed reload-identity exception (human item #2). |
| SC5 | `npm run check` green, 100% on every new arm, `test:corresponding` | ✓ — full `npm run check` run by this verifier end-to-end: `test:coverage:unit` 7309/7309 pass, 100.00/100.00/100.00 lines/functions/branches; `test:integration` 36/36; `lint:type-members` 4 recorded exceptions, 108 contract entries (independently reconfirmed); `lint:type-members:negative` 7/7; `npx tsc --noEmit` clean (run separately by this verifier, 0 errors). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/source.ts` | exports `stripSlashAndFragment`, keeps `stripUrlDecorations` private | ✓ VERIFIED | `export function stripSlashAndFragment` present; `stripUrlDecorations` is module-private, calls `splitUrlFragment`/`stripTrailingSlashes` in the opposite composition order (identity vs wire), per the iteration-3 restructure. |
| `extensions/pi-claude-marketplace/domain/clone-key.ts` | `networkCloneUrl(source)`, 3-arm switch, no `default` | ✓ VERIFIED | Present at line 96, `github`/`url`/`git-subdir` arms, TS exhaustiveness (no `default`) confirmed by reading the file. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | seam wired to `networkCloneUrl`, dead `cloneUrl` field removed | ✓ VERIFIED | `import { networkCloneUrl }` at line 53; `url: networkCloneUrl(source)` at line 698; `addGithubInGuard` now reads `const host = GITHUB_HOST;` (no hand-built `.git` literal). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `networkUrl: string` required (×2), disk key still hashes `cloneUrl` | ✓ VERIFIED | Both fields non-optional; `pluginCloneKey(args.cloneUrl, ...)`/`pluginMirrorKey(args.cloneUrl)` unchanged; `resolvePluginPin` derives `networkCloneUrl(source)` at line 561. |
| 9 plugin-orchestrator call sites | thread `networkUrl: networkCloneUrl(<source>)` | ✓ VERIFIED | `grep -rc 'networkUrl: networkCloneUrl(' extensions/.../orchestrators/plugin/` sums to 9 across `install-clone-probe.ts`, `reinstall-clone-probe.ts`, `fetch.ts`, `info.ts`, `update-preflight.ts`. |
| `extensions/pi-claude-marketplace/platform/git.ts` | docstring updated, no `domain/` import (D-11 boundary) | ✓ VERIFIED | `grep -c 'from "../domain/'` = 0; docstring names `networkCloneUrl` in prose only. |
| Test files (7 files across 3 plans) | rewritten wire expectations, no stale titles | ✓ VERIFIED | See Anti-Patterns section; spot-checked titles and by-value assertions directly. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `networkCloneUrl`'s github arm | `ensureGitSuffix` | function call | ✓ WIRED | `grep -vE '^\s*(\*|//)' clone-key.ts \| grep -c ensureGitSuffix` ≥ 1; keeps `fallow dead-code` from flagging `ensureGitSuffix` as orphaned (confirmed via the full `npm run check` fallow gate, `✓ No issues found`). |
| `addGitClonedInGuard` | `networkCloneUrl(source)` | clone call `url` field | ✓ WIRED | Read directly at `add.ts:698`. |
| `resolvePluginPin` | `networkCloneUrl(source)` | local derivation | ✓ WIRED | Read directly at `clone-cache.ts:561`; return type unchanged (`cloneUrl` only). |
| 9 plugin callers | `materializePluginClone`/`materializeOrRefreshPluginMirror` | `networkUrl` required field | ✓ WIRED | Compiler-enforced (required, no default); `npx tsc --noEmit` clean confirms no site was missed. |
| `urlObjectSource` | `parseUrlSourceForm` | https-only scheme gate | ✓ WIRED | Read directly at `source.ts:189` — object-form url sources now funnel through the same gate as the string form (CR-02 fix), closing a pre-existing hole on `url` as well as the phase's own `raw` extension. |

### Data-Flow Trace (Level 4)

`networkCloneUrl(source)` → `gitOps.clone({ url: ... })` / `gitOps.resolveRemoteRef({ url: ... })`: traced end-to-end through the real edge handler in `tests/edge/handlers/marketplace/add.test.ts` (no mock of `parsePluginSource` or `addMarketplace` — only the git port is faked), and the fake's `allowedRemoteUrls` allowlist is narrowed to exactly the value the derivation produces, so a wrong value cannot pass silently (`createGitOpsFake blocked unplanned remote <url>` would fire). Status: ✓ FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MURL-08/MURL-09 add-seam suite | `node --test tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/marketplace/add.test.ts tests/domain/source.test.ts tests/domain/clone-key.test.ts` | 219/219 pass | ✓ PASS |
| Plugin clone-cache + probe suites | `node --test tests/orchestrators/plugin/{clone-cache,install-clone-probe,reinstall-clone-probe,fetch,info,update-preflight}.test.ts` | 274/274 pass | ✓ PASS |
| Plugin flow + seed-mirrors integration suites | `node --test tests/orchestrators/plugin/{install-flow,update-flow,reinstall-flow}.test.ts tests/integration/marketplace-add-seed-mirrors.test.ts` | 473/473 pass | ✓ PASS |
| Architecture gates (credential leak, import boundaries, stale citations) | `node --test tests/architecture/{no-credential-leak,import-boundaries,no-stale-test-citations}.test.ts` | 23/23 pass | ✓ PASS |
| `npx tsc --noEmit` | (this verifier, standalone) | 0 errors | ✓ PASS |
| Full `npm run check` | (this verifier, end-to-end, not reused from a prior run) | `test:coverage:unit` 7309/7309, 100/100/100; `test:integration` 36/36; `lint:type-members` 4 exceptions/108 entries; `lint:type-members:negative` 7/7; no error text anywhere in the log; chain reached its final `&&` link | ✓ PASS |
| Direct probe of `stripSlashAndFragment`/`networkCloneUrl` against an orphaned review's repro inputs | `node --experimental-strip-types` against `.../mp/#v1.0` and git-subdir + slash/fragment inputs | trailing slash before `#<ref>` correctly stripped; git-subdir arm correctly strips slash+fragment | ✓ PASS (see Anti-Patterns) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MURL-08 | 01, 02, 03 | verbatim-URL smart-HTTP endpoint resolves clone + resolveRemoteRef | ✓ SATISFIED | Truths 1-4, 7; REQUIREMENTS.md marks Complete, justified. |
| MURL-09 | 01, 02, 03 | sent URL == typed URL modulo decoration; exactly one attempt | ✓ SATISFIED | Truths 5, 6, 8; REQUIREMENTS.md marks Complete, justified. |

No orphaned requirements: `grep -n "Phase 2" REQUIREMENTS.md` maps only MURL-08/MURL-09 to this phase, and both appear in all three plans' `requirements:` frontmatter.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the 11 production files this
phase touched (checked directly with `grep`).

No prohibited stale-rule test title found: `grep -nE '^test\(|^void test\('
tests/orchestrators/marketplace/add.test.ts | grep -c suffixed` = 0; the one title in
`clone-cache.test.ts` containing "sends the suffixed github url" (`MURL-01 / PURL-09`) is verified
correct — its fixture is `githubSource("owner/repo")`, a genuinely github-kind source, for which
suffixing is still the shipped rule.

**Notable, resolved during this verification — not a defect, but worth recording for the next
reader.** Two files in the phase directory, `02-REVIEW.iter2.md` and `02-REVIEW-FIX.iter2.md`, on
first read appear to describe TWO CRITICAL BUGS still present in `networkCloneUrl`/
`stripSlashAndFragment` (a trailing slash before `#<ref>` surviving to the wire, and the `git-subdir`
arm stripping no decorations at all) — findings that, if real, would BLOCK this phase (MURL-09 wire
form promise broken). This verifier probed the actual functions directly against the exact repro
inputs those findings give:

```
stripSlashAndFragment("https://gitlab.example.com/team/mp/#v1.0")
  => { base: "https://gitlab.example.com/team/mp", ref: "v1.0" }   // correct, not the claimed bug
networkCloneUrl({kind:"git-subdir", raw:"https://gitlab.example.com/team/mono/", ...})
  => "https://gitlab.example.com/team/mono"                          // correct, not the claimed bug
```

Neither bug reproduces. Cross-referencing commit history resolves why: `02-REVIEW-FIX.iter2.md`'s own
frontmatter reads `iteration: 1`, fixing exactly these two findings (`CR-01`/`CR-02` in that file's
numbering) via commits `d42f7625` and `cc7891a5` — both from EARLY in this phase's review-fix loop,
well before the iteration-2 review (`02-REVIEW.md`, which found a DIFFERENT pair of critical bugs —
the cache-identity regression and the https-scheme-gate bypass — introduced BY those iteration-1
fixes) and the iteration-3 restructure (`02-REVIEW-FIX.md`, commit `6cc37bd1`) that fixed those. The
`.iter2` suffix is this project's archival convention for a superseded review/fix pair, not a live,
unaddressed finding — but the filenames alone do not make that obvious, and a future reader (or a
verifier that trusts file contents without probing the code) could easily mis-score this phase as
FAILED on stale findings. Recorded here rather than left for the next person to re-discover the hard
way.

### Coincidental Reliance

None flagged. The MURL-09 call-count-plus-value assertions establish their own precondition (each
test constructs its own fixture); the `canonicalCloneUrl` byte-identity assertions compare against
literals fixed independently of any test-only setup; the D-2-02 URL-naming evidence
(`addSubjectName`/`notifyWithContext`) is the same production code path used by every other add
failure, not a fixture-only artifact.

### Human Verification Required

#### 1. Live smart-HTTP endpoint (real server, not the offline fake)

**Test:** Point `marketplace add <url>` at a real smart-HTTP git server that answers only at the
verbatim path and 404s the `.git`-suffixed form. Confirm both the initial clone and a later
`resolveRemoteRef` (via `marketplace update` or a pinned-plugin resolve) succeed.
**Expected:** Both operations resolve against the real server.
**Why human:** `02-VALIDATION.md`'s own Manual-Only Verifications table names this exact item and no
plan closed it — every automated test proves the SENT url is verbatim against an offline fake, never
against a real HTTP round trip. This is the same class of gap Phase 1 left open in its own
`01-VERIFICATION.md` live-canary item.

#### 2. Accept or reject the reload-identity residual

**Test:** Read `02-REVIEW-FIX.md` § "One residual, stated plainly" (pinned by test at `9e08b48a`) and
decide whether the described behavior change is acceptable as a phase outcome.
**Expected:** An explicit decision (accept, matching the D-2-01/D-2-02 pattern already in
`02-CONTEXT.md`, or file a follow-up to close it).
**Why human:** It is a genuine, disclosed exception to this phase's own must-have wording
("`canonicalCloneUrl` returns the same string ... as it did before this plan"), narrow in scope
(reload only, one input shape, one-time re-clone cost) and not a functional break of MURL-08/MURL-09,
but it was never put to the operator as a decision the way D-2-01/D-2-02 were — this verifier is not
positioned to accept a new production trade-off on the operator's behalf.

### Gaps Summary

None. No must-have truth failed, no artifact is missing or a stub, no key link is unwired, and no
debt marker or stale-rule test title was found. The two items above are genuine open questions
(one a validation gap the phase's own plan authors flagged and left for a human; one a disclosed
design trade-off the phase's own fixer flagged for a human) rather than defects in what was built.
Both are narrow and do not block Phase 3 from proceeding in parallel with their resolution — Phase 1
already established the precedent that an open live-canary item does not block subsequent phase
execution, only milestone close.

---

_Verified: 2026-09-27T08:52:28Z_
_Verifier: Claude (gsd-verifier)_
