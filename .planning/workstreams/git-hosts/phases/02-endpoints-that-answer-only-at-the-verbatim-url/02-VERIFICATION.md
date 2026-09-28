---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
verified: 2026-09-28T21:15:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-01-PLAN.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-01-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-02-PLAN.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-02-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-03-PLAN.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-03-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-CONTEXT.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-DISCUSSION-LOG.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-PATTERNS.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-RESEARCH.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW-DISPOSITION.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW-FIX.iter1-superseded.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW-FIX.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW.iter1-superseded.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-UAT.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-VALIDATION.md
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/domain/clone-key.test.ts
  - tests/domain/source.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/register.test.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/platform/git.test.ts
covered_digest: "v2:sha256:c3b42736e52a3231c316826390469ef089b7625244ff3b0f6d7cc927f1340a13"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/9
  gaps_closed:
    - "The single carried-forward human-verification item (live verbatim-only smart-HTTP endpoint, MURL-08) is now CLOSED by 02-UAT.md (committed 4dc8177b): a local instrumented HTTPS server driven through real pi RPC mode confirmed exactly one info/refs GET + one upload-pack POST per operation, both verbatim, on both add and a later update; controls (missing repo, explicit .git form) each made exactly one request and failed as themselves."
  gaps_remaining: []
  regressions: []
---

# Phase 2: Endpoints that answer only at the verbatim URL Verification Report

**Phase Goal:** A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed and returns 404 for the conventional `.git`-suffixed form, and a repository that is genuinely missing or genuinely forbidden still fails as itself.

**Verified:** 2026-09-28T21:15:00Z
**Status:** passed
**Re-verification:** Yes — the prior `02-VERIFICATION.md` (verified 2026-09-27T11:56:55Z at commit `4d530bfb`, `human_needed`, 9/9 must-haves) went stale: Phase 1's gap-closure plan 01-04 (`96c9eb13`/`c9c21446`, plus test coverage `a2db444e`) landed a redirect-following `HttpClient` and a new `listRemotes` primitive in `platform/git.ts` after that report was written, and Phase 3 landed leftover-clone recognition in `orchestrators/marketplace/add.ts` that reuses `domain/source.ts::stripGitSuffix` (newly exported) and `canonicalCloneUrl`. All of these touch files this phase's `covered_files` list depends on, so the prior verdict on those files could not be trusted without re-reading the code. This session also closes the one item the prior report left as `human_needed`: the live smart-HTTP canary, now evidenced by `02-UAT.md`.

## Why this is a re-verification

Diffed `4d530bfb..HEAD` scoped to `extensions/` and `tests/` (54 commits). Of the files this phase's
`covered_files` list names, four production files actually changed:

- `extensions/pi-claude-marketplace/platform/git.ts` — Phase 1 gap closure 01-04 added a
  module-private, origin-aware redirect-following `HttpClient` (`requestWithinOrigin`/`sendHop`) that
  `clone`/`fetch`/`resolveRemoteRef` now route through instead of `isomorphic-git/http/node` directly,
  plus a new `listRemotes` primitive (Phase 3, MA-12/MA-13, local filesystem read only — no network).
- `extensions/pi-claude-marketplace/domain/source.ts` — `stripGitSuffix` changed from a private
  function to an exported one (no logic change), for Phase 3's leftover-clone identity comparison.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — Phase 3 added
  `recognizeLeftover` (MA-12/MA-13/MA-14), which calls the new `gitOps.listRemotes` (a local FS read)
  before the existing rename step; it does not touch the `networkCloneUrl`/clone call site this phase
  owns.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` and
  `orchestrators/marketplace/shared.ts` and `orchestrators/plugin/update-preflight.ts` — Phase 3
  changes (`buildCloneAuth`'s optional `ctx`, the `GitOps` interface's eighth member) that leave
  `networkCloneUrl(gitSource)` call sites unchanged.

None of `domain/clone-key.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/fetch.ts`,
`orchestrators/plugin/info.ts`, `orchestrators/plugin/install-clone-probe.ts`, or
`orchestrators/plugin/reinstall-clone-probe.ts` changed since `4d530bfb`.

## How this was verified

Not from SUMMARY.md, prior VERIFICATION.md, or 02-UAT.md narration alone. Independently, in this
session:

- Read `extensions/pi-claude-marketplace/platform/git.ts` (503 lines) in full at HEAD and traced
  `clone()`, `fetch()`, and `resolveRemoteRef()` — all three still pass `opts.url` verbatim into
  `git.clone`/`git.fetch`/`git.listServerRefs` unchanged; the only new indirection is the module-private
  `http: HttpClient = { request: requestWithinOrigin }` object those calls thread through instead of
  `isomorphic-git/http/node` directly.
- Read `sendHop`/`nextHop`/`redirectLocation` in full: `redirectLocation` triggers only on
  `300 <= statusCode < 400` **with** a `Location` header; every other status (including every 4xx/5xx)
  returns the response unchanged with no further request. There is no branch anywhere in this file that
  re-sends a request based on a 404/401/403/5xx status or on any URL-shape heuristic — confirmed by
  reading the function bodies directly, not by trusting a docstring.
- Cross-referenced `02-CONTEXT.md`'s own definition of what D-2-01's "no retry" forbids: re-deriving
  and re-sending a **different URL** after the first one fails (e.g., appending `.git` after a bare-path
  404). The redirect follow is categorically different: it is triggered only by a server-issued 3xx +
  `Location`, never by an error status, and it follows to wherever the *server* directs — not a
  client-decided alternate URL shape. It is also not new behavior this phase's tests need to account
  for: `simple-get` (the library `isomorphic-git/http/node` wraps) already followed redirects by
  default before 01-04; 01-04 changed only which headers survive a cross-origin hop, not whether a hop
  happens.
- Confirmed this redirect logic lives **below** the abstraction boundary Phase 2's own tests mock: every
  MURL-09 call-count assertion (`state.cloneCalls.length === 1` / `resolveRemoteRefCalls.length === 1`)
  is asserted against `createGitOpsFake`, which fakes the entire `GitOps.clone`/`resolveRemoteRef`
  function — the fake never reaches `platform/git.ts`'s real implementation, so the redirect client is
  invisible to and cannot perturb those counts.
- Read `tests/platform/git.test.ts`'s redirect suite directly: `"rejects an eleventh consecutive
  redirect with too many redirects"` asserts the 11-request cap is reached only via a run of 3xx
  responses; no test exercises a 4xx/5xx triggering a second request. Ran this file directly — 56/56
  pass.
- Independently confirmed via `02-UAT.md` (evidence, not narration re-quoted): a live instrumented HTTPS
  server, driven through real pi RPC mode with the branch's extension (not the offline fake), recorded
  wire traffic for both `marketplace add` and a later `marketplace update` — exactly one
  `GET .../info/refs` + one `POST .../git-upload-pack` per operation, both against the verbatim URL, no
  `.git` form ever requested. The two negative controls (a genuinely missing repo, and the explicit
  `.git` form against a verbatim-only endpoint) each made exactly one request and failed as
  `{source missing}`. This is the real-transport confirmation of SC1 and SC3 that the offline fake by
  itself cannot provide, and it exercises the actual redirect-capable `HttpClient`, not a stand-in.
- Read `domain/clone-key.ts` (106 lines) and re-confirmed `networkCloneUrl`/`canonicalCloneUrl` are
  byte-identical to the prior verification's read (no diff since `4d530bfb`).
- Read `orchestrators/marketplace/add.ts`'s new `recognizeLeftover` function in full: it calls
  `gitOps.listRemotes({ dir: finalDir })` — a local `fs.promises.readFile` of `<dir>/.git/config`
  wrapped by `git.listRemotes`, no network — strictly before the existing clone-and-rename path, to
  decide whether an *already-present* leftover directory is safe to remove. It does not add a call to
  `gitOps.clone` or `gitOps.resolveRemoteRef`, so it cannot affect the SC3 attempt count for either.
- Ran every phase-2-relevant suite directly in this session (not reused from any prior run):
  `tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/marketplace/add.test.ts
  tests/domain/source.test.ts tests/domain/clone-key.test.ts` → 256/256 pass (up from 238/238 at the
  prior verification — the 18 new cases are Phase 3's MA-12/13/14 leftover-recognition suite, additive,
  none retitled or removed);
  `tests/orchestrators/plugin/{clone-cache,install-clone-probe,reinstall-clone-probe,fetch,info,
  update-preflight}.test.ts` → 275/275 pass; `tests/platform/git.test.ts` → 56/56 pass;
  `tests/orchestrators/plugin/{install-flow,update-flow,reinstall-flow}.test.ts
  tests/integration/marketplace-add-seed-mirrors.test.ts tests/architecture/{no-credential-leak,
  import-boundaries,no-stale-test-citations,no-orchestrator-network}.test.ts` → 500/500 pass. Total:
  1087/1087 directly run this session, 0 failures.
- Ran `npm run check` end-to-end in this session, to completion, launched once, not reused or piped:
  `CHECK_EXIT=0` — typecheck, lint, lint:workflows(+negative), fallow (all four sub-gates exit 0; the
  `fallow dupes` red summary glyph with a clean exit is the known non-blocking display quirk, confirmed
  by the captured exit code, not the glyph), format:check, test:corresponding(+negative),
  test:coverage:direct:negative, test:coverage:unit (7386/7386 pass, 100.00/100.00/100.00
  lines/functions/branches over `extensions/**`), test:integration (36/36 pass), lint:type-members
  (passed, 4 recorded exceptions — the same four the prior verification recorded, none newly added by
  this phase's files), lint:type-members:negative (7 of 7 negative controls passed).
- Confirmed `scripts/check-unused-type-members.contracts.json` still holds no pin naming
  `domain/source.ts` or `domain/clone-key.ts` (the file has line:col drift since the prior verification
  — 12 lines changed — from Phase 3's edits elsewhere in the file; still 108 entries).
- Confirmed zero stale test titles (`grep -rn "keeps a path slash" tests/` → 0 hits) and zero debt
  markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) in any of the four production files that
  changed since the prior verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `marketplace add` of a `url` source sends the URL the user typed, with trailing slashes and `#<ref>` stripped and the `.git` decision left exactly as typed, against a git port that admits ONLY the verbatim form (MURL-08, D-2-01). | ✓ VERIFIED | `networkCloneUrl`'s `url` arm unchanged (`clone-key.ts:101`); `256/256` add-seam tests pass, run directly this session; **now also confirmed against a real HTTPS server through the actual redirect-capable transport** (`02-UAT.md`: wire = verbatim GET info/refs + POST upload-pack, no `.git` form ever sent). |
| 2 | A `github` source still sends `https://github.com/<owner>/<repo>.git`, byte-identical to today (SC4). | ✓ VERIFIED | `networkCloneUrl`'s `github` arm unchanged; no diff in `clone-key.ts` since the prior verification. |
| 3 | A `url` source whose typed input ended in `.git` still sends `.git`, deriving from `source.raw` not the parse-time-stripped `source.url` (SC4, D-2-03). | ✓ VERIFIED | `tests/domain/clone-key.test.ts`'s `networkCloneUrl` block, run directly this session, still asserts the raw-ends-`.git`-while-url-does-not case by exact string. |
| 4 | `canonicalCloneUrl` returns the same string for every source kind as before this plan, with the sanctioned D-2-05 trailing-slash-before-`#<ref>` exception as a fixed point (SC4, D-2-05). | ✓ VERIFIED | `canonicalCloneUrl` unchanged since the prior verification's independent re-derivation (`IDENTITY_DIFFS=6`, all sanctioned shape; `FIXED_POINT_VIOLATIONS=0`); not touched by any commit since `4d530bfb`. |
| 5 | `marketplace add` makes exactly ONE clone attempt per operation on both the success and failure path, URL asserted by value (MURL-09, SC3, D-2-04). | ✓ VERIFIED | Same 3 MURL-09 fake-port cases pass (404, 401, D-2-02 suffix-only refusal), each asserting `state.cloneCalls.length === 1` plus the exact URL string; **independently re-derived that the new redirect-following `HttpClient` in `platform/git.ts` cannot add a second attempt at this level** — it triggers only on 3xx+Location (never on 4xx/5xx or a URL-shape heuristic) and operates entirely inside a single `clone()`/`resolveRemoteRef()` call, below the `GitOps` boundary these tests mock. A redirect hop is a server-directed continuation of the ONE attempt, not a client-initiated retry with a different URL — the distinction D-2-01 actually draws. Corroborated live: `02-UAT.md`'s two negative controls (missing repo, explicit `.git` form) each made exactly one request and failed as themselves. |
| 6 | A 401/403/404/5xx from the clone keeps its original error identity and message through the add seam (SC2). | ✓ VERIFIED | Same cases assert `err === cloneThrows` by reference plus `.message`/`.code`/`.data.statusCode`; `handleAddFailure` unchanged since prior verification. |
| 7 | `networkCloneUrl` is a pure function of `source` — no process/fs/network state (MURL-08 concurrency edge). | ✓ VERIFIED | Read directly: unchanged 3-arm switch over pure string ops; no diff since prior verification. |
| 8 | Exactly-one-attempt is per OPERATION, not per process (MURL-09 concurrency edge). | ✓ VERIFIED | `state.cloneCalls`/`resolveRemoteRefCalls` remain per-fixture-instance arrays; unchanged fake, unchanged tests, all pass. |
| 9 | CR-02's https-only scheme gate rejects through BOTH the `url` and `raw` object fields, and D-2-05's slash normalization does NOT widen what a `github` url accepts (D-76-01, D-2-05 scope boundary). | ✓ VERIFIED | `source.ts`'s scheme-gate and the two-composition split (`stripUrlDecorations`/`stripGitHubUrlDecorations`) are unchanged except for the `stripGitSuffix` export (no logic change, confirmed by diff); `tests/domain/source.test.ts` (37 new lines, additive — Phase 3 fixed-point cases for the leftover comparison, not a rewrite of the existing scheme-gate assertions) still passes in full. |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified).

### Roadmap Success Criteria Cross-Check

| SC | Text | Status |
|----|------|--------|
| SC1 | verbatim-path `clone` AND `resolveRemoteRef` both resolve | ✓ — proven offline (all seam tests) AND now proven live against a real smart-HTTP server through the real (redirect-capable) transport (`02-UAT.md`). |
| SC2 | 401/403/404/5xx keeps original error identity | ✓ — truth 6 above; unchanged code, all tests pass. |
| SC3 | exactly ONE network attempt per operation, both paths, no status-gated retry | ✓ — truth 5 above; the new redirect client does not introduce a second attempt or a status-gated retry — it is a server-directed continuation gated only by 3xx+`Location`, invisible to and non-interfering with the orchestrator-level call-count guard, and now corroborated live (one GET + one POST per operation, no `.git` form ever requested). |
| SC4 | `.git` only where Claude Code appends it; `canonicalCloneUrl` unchanged | ✓ with the D-2-05 sanctioned exception, unchanged since prior verification. |
| SC5 | `npm run check` green, 100% on every new arm, `test:corresponding` | ✓ — this session's own `npm run check` ran end-to-end, `CHECK_EXIT=0`: 7386/7386 unit tests, 100.00/100.00/100.00 lines/functions/branches on `extensions/**`, 36/36 integration, `lint:type-members` 4 recorded exceptions / 7 of 7 negative controls passed. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/source.ts` | `stripUrlDecorations`/`stripGitHubUrlDecorations` remain separate compositions per D-2-05 | ✓ VERIFIED | Only diff since prior verification: `stripGitSuffix` made `export` (no logic change) for Phase 3's leftover-identity comparison; the two-composition structure is untouched. |
| `extensions/pi-claude-marketplace/domain/clone-key.ts` | `networkCloneUrl(source)`, 3-arm switch, no `default` | ✓ VERIFIED | Byte-identical since prior verification (no diff since `4d530bfb`). |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | seam wired to `networkCloneUrl` | ✓ VERIFIED | `networkCloneUrl(source)` clone-call-site wiring unchanged; the new `recognizeLeftover` function (Phase 3) sits earlier in the flow and does not touch this wiring. |
| `extensions/pi-claude-marketplace/platform/git.ts` | `clone`/`fetch`/`resolveRemoteRef` still send `opts.url` verbatim as the first request | ✓ VERIFIED | Read in full; all three functions pass `opts.url` unchanged into isomorphic-git; the new module-private `HttpClient` only changes what happens on a server-issued 3xx after that first request. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `networkUrl: string` required (×2), disk key still hashes `cloneUrl` | ✓ VERIFIED | No diff since prior verification. |
| `scripts/check-unused-type-members.contracts.json` | 108 entries, 4 recorded exceptions, no pin on the two changed domain files | ✓ VERIFIED | `contracts.length === 108`; zero entries reference `domain/source.ts` or `domain/clone-key.ts`; the 12-line coordinate drift since the prior verification comes from Phase 3 edits elsewhere in the file and does not affect this phase's pins. |
| `.planning/.../02-UAT.md` | closes the one carried-forward human-verification item | ✓ VERIFIED | `status: complete`, 1/1 pass, evidence names exact wire traffic (verbatim GET+POST, no `.git` form, controls fail-as-themselves). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `networkCloneUrl`'s github arm | `ensureGitSuffix` | function call | ✓ WIRED | Unchanged since prior verification. |
| `stripUrlDecorations` / `stripGitHubUrlDecorations` | shared leaf primitives only, no shared composition | function structure | ✓ WIRED (deliberately decoupled) | Unchanged; `stripGitSuffix`'s export does not create a new call edge between the two compositions. |
| `add.ts` / `clone-cache.ts` seams | `networkCloneUrl(source)` | clone/resolveRemoteRef call `url`/`networkUrl` field | ✓ WIRED | Unchanged; re-confirmed passing via this session's direct test runs. |
| `platform/git.ts`'s `clone`/`fetch`/`resolveRemoteRef` | the module-private `http` client | `git.clone({ http, ... })` etc. | ✓ WIRED | Read directly; all three isomorphic-git calls thread the same `http` object; the redirect logic is internal to that object and does not create any new call from the orchestrator layer. |
| `orchestrators/marketplace/add.ts::recognizeLeftover` | `gitOps.listRemotes` (local FS only) | new `GitOps` 8th member | ✓ WIRED, and confirmed NOT a network call | Read `platform/git.ts::listRemotes` directly: `fs.promises.readFile` + `git.listRemotes({ fs, dir })`, no `http`/`git.clone`/`git.fetch`/`git.listServerRefs` reference anywhere in the function. |

### Data-Flow Trace (Level 4)

`networkCloneUrl(source)` → `gitOps.clone({ url: ... })` / `gitOps.resolveRemoteRef({ url: ... })`:
traced end-to-end through the real edge handler in `tests/edge/handlers/marketplace/add.test.ts` (run
directly this session, 256/256 pass) against the offline fake, AND through the real transport in
`02-UAT.md`'s live run (wire-logged GET/POST pair matching the derivation exactly). Status: ✓ FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MURL-08/MURL-09 add-seam suite | `node --experimental-strip-types --test tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/marketplace/add.test.ts tests/domain/source.test.ts tests/domain/clone-key.test.ts` | 256/256 pass | ✓ PASS |
| Plugin clone-cache + probe suites | `node --experimental-strip-types --test tests/orchestrators/plugin/{clone-cache,install-clone-probe,reinstall-clone-probe,fetch,info,update-preflight}.test.ts` | 275/275 pass | ✓ PASS |
| Platform redirect-client suite (the file this re-verification is specifically about) | `node --experimental-strip-types --test tests/platform/git.test.ts` | 56/56 pass | ✓ PASS |
| Plugin flow + seed-mirrors + architecture suites | `node --experimental-strip-types --test tests/orchestrators/plugin/{install-flow,update-flow,reinstall-flow}.test.ts tests/integration/marketplace-add-seed-mirrors.test.ts tests/architecture/{no-credential-leak,import-boundaries,no-stale-test-citations,no-orchestrator-network}.test.ts` | 504/504 pass | ✓ PASS |
| Live smart-HTTP round trip (real server, real transport) | `02-UAT.md` test 1 — pi RPC mode against a local instrumented HTTPS server | 1/1 pass — verbatim-only wire traffic confirmed for add AND update, controls fail as themselves | ✓ PASS |
| `npm run check` | this verifier, end-to-end, launched once this session, ran to completion | `CHECK_EXIT=0`: typecheck, lint, lint:workflows(+neg), fallow (4 sub-gates), format:check, test:corresponding(+neg), test:coverage:direct:negative, test:coverage:unit (7386/7386, 100.00/100.00/100.00 over `extensions/**`), test:integration (36/36), lint:type-members (4 exceptions) + negative (7/7) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MURL-08 | 01, 02, 03 | verbatim-URL smart-HTTP endpoint resolves clone + resolveRemoteRef | ✓ SATISFIED | Truths 1-4, 7, 9; now also proven live (`02-UAT.md`); REQUIREMENTS.md marks Complete. |
| MURL-09 | 01, 02, 03 | sent URL == typed URL modulo decoration; exactly one attempt, no status-gated retry | ✓ SATISFIED | Truths 5, 6, 8; redirect-client classification above; REQUIREMENTS.md marks Complete. |

No orphaned requirements: `grep -n "Phase 2" REQUIREMENTS.md` maps only MURL-08/MURL-09 to this
phase, and both appear in all three plans' `requirements:` frontmatter.

### Prohibitions

| # | Statement | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No test case may keep a name/title/comment promising the pre-phase `.git`-for-every-host rule while asserting the verbatim rule, or the reverse (all 3 plans). | ✓ HOLDS | `grep -rn "keeps a path slash" tests/` → 0 hits this session. |
| 2 | A source that stops working under the accepted D-2-02 regression must fail with the URL that was actually sent named in the failure. | ✓ HOLDS | Unchanged; the D-2-02 fixture case still passes with `rawSource` named in the failure. |
| 3 (02-02) | A pass-through wire-URL test must not merely re-assert the caller's own value; `networkUrl` must DIFFER from `cloneUrl` in at least one assertion. | ✓ HOLDS | `clone-cache.ts` unchanged since prior verification; `materializePluginClone forwards the caller's wire url and keys the dir off the identity url` still uses genuinely different `cloneUrl`/`wireUrl` values. |
| 4 (02-03) | No remote allowlist anywhere admits BOTH the verbatim and the `.git`-suffixed form of the same URL for a `url`-kind source. | ✓ HOLDS | `tests/integration/marketplace-add-seed-mirrors.test.ts` unchanged since prior verification (no diff since `4d530bfb`); still admits a single form. |
| 5 (02-03) | No docstring in `extensions/` still states the inverse of D-2-02. | ✓ HOLDS | `grep -rn "does not resolve against a host that serves ONLY" extensions/` returns the correct (D-2-02-matching) direction; no inverse phrasing found. |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file this phase's `covered_files`
names, including the four production files that changed since the prior verification
(`platform/git.ts`, `domain/source.ts`, `orchestrators/marketplace/add.ts`,
`orchestrators/marketplace/shared.ts`) — checked directly with `grep`.

**Documentation drift noted, not a code gap:** `.planning/workstreams/git-hosts/ROADMAP.md` still
shows Phase 2 as `[ ]` unchecked with status "In Progress" in its Progress table, and its
"Milestone-wide constraints" section still lists the live-smart-HTTP-canary blocker with "Resume:
`/gsd-verify-work 2`" — pre-dating `02-UAT.md`'s closure of that item (committed 4dc8177b, same day as
this re-verification). ROADMAP.md is not in this phase's `covered_files` and this verifier was
instructed not to edit anything but `02-VERIFICATION.md`; flagging so the next roadmap-touching commit
reconciles the checkbox, Progress table, and constraints section with the now-closed UAT.

No stale-rule test titles (see Prohibitions #1 above). No `typescript-comments` skill violations
(historical-narration phrasing) found in the four changed production files.

### Coincidental Reliance

None flagged. The redirect-classification evidence (truth 5 / SC3) is derived by directly reading the
`sendHop`/`redirectLocation` control flow and the live UAT wire log — not from a fixture-only
precondition or an incidental ordering the production code does not itself establish. All other truths
carry forward the prior verification's own coincidental-reliance analysis (none flagged there either),
re-confirmed against unchanged code.

### Human Verification Required

None. The one item carried forward from the prior verification (the live smart-HTTP endpoint canary,
MURL-08) is now closed — see `02-UAT.md` (status: complete, 1/1 pass, committed `4dc8177b`) and the
"How this was verified" section above.

### Gaps Summary

None. All 9 must-have truths verified, all 5 ROADMAP success criteria hold (including SC3's
no-status-gated-retry clause, explicitly re-examined against the new redirect-following HTTP client and
found not to introduce a second attempt), all 5 plan prohibitions hold, no debt markers, no orphaned
requirements, `npm run check` green at `CHECK_EXIT=0` (7386/7386 unit tests, 100% coverage on
`extensions/**`, 36/36 integration), and the previously-open human-verification item is now closed with
live evidence. Status changes from `human_needed` to `passed`.

---

_Verified: 2026-09-28T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
