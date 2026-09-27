---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
verified: 2026-09-27T11:56:55Z
status: human_needed
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
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-VALIDATION.md
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
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
covered_digest: "v2:sha256:89d2eef6bcc72b1838b119d455151d4cdedc03649765f1dfd6dbaf7876feeef4"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/8
  gaps_closed:
    - "D-2-05 reload-identity residual: operator decided (2026-09-27) to make the url cache identity a fixed point rather than accept the pre-phase reload-identity self-contradiction; implemented at 7c7df1df and independently re-derived in this session against the pre-phase (130d68a9) parser."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Point `marketplace add <url>` at a REAL smart-HTTP git server (e.g. a bare repo served via `git http-backend` behind nginx, or any host you control) that answers ONLY at the verbatim path and returns 404 for the `.git`-suffixed form. Confirm both the initial clone and a later `resolveRemoteRef` (e.g. `marketplace update`) resolve against it."
    expected: "The add succeeds and a later update/resolve also succeeds, proving isomorphic-git's smart-HTTP ref advertisement against a REAL server behaves the way the offline `createGitOpsFake` assumes."
    why_human: "02-VALIDATION.md's own 'Manual-Only Verifications' table names this item and no plan closed it — every phase test proves the URL SENT is verbatim via an offline fake (`createGitOpsFake`'s `allowedRemoteUrls`), never against a real HTTP round trip. This is Item 1 carried forward unchanged from the prior verification; the operator has confirmed it is being deferred by decision, matching the precedent Phase 1 already set (`01-VERIFICATION.md`'s own open live-canary item). Not a gap — carried forward per operator instruction."
---

# Phase 2: Endpoints that answer only at the verbatim URL Verification Report

**Phase Goal:** A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed and returns 404 for the conventional `.git`-suffixed form, and a repository that is genuinely missing or genuinely forbidden still fails as itself.

**Verified:** 2026-09-27T11:56:55Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (the prior verification's second human item, the D-2-05 reload-identity decision, is now decided and implemented)

## Why this is a re-verification

The prior `02-VERIFICATION.md` (8/8 must-haves, `human_needed`, verified against `2ecac99b`) went
stale: two more commits landed on `extensions/pi-claude-marketplace/domain/source.ts` and its test
suites after it was written —

- `3546a28c` — restored the pre-`130d68a9` reload-identity self-contradiction as a first fix pass,
  then discovered it was internally contradictory (first parse computed `…/o/r/`, every reload
  computed `…/o/r` — two different values for one persisted record, orphaning `plugin-clones/<hash>`
  forever for that input shape).
- `7c7df1df` — the operator-decided fix: normalize so first parse and reload agree, making the `url`
  identity a fixed point (D-2-05), recorded in `02-CONTEXT.md` and `02-01-PLAN.md`'s amended
  `canonicalCloneUrl` must-have.

Both commits are production/test changes on files this verification's `covered_files` include, so
the prior report's `passed` verdict on those files could not be trusted without re-reading the code.
The two docs-only commits after that (`8173d25a`, `4d530bfb`) recorded the decision but changed no
code — HEAD's `extensions/`/`tests/` tree is byte-identical to `7c7df1df`.

## How this was verified

Not from SUMMARY.md or REVIEW-FIX.md narration alone. Independently, in this session:

- Read `extensions/pi-claude-marketplace/domain/source.ts` (729 lines) and `domain/clone-key.ts`
  (106 lines) in full at HEAD (`4d530bfb`) and confirmed the three-composition structure
  (`stripSlashAndFragment` / `stripUrlDecorations` / `stripGitHubUrlDecorations`) and the D-2-05
  docstrings match what `02-CONTEXT.md` and `02-REVIEW-FIX.md` claim.
- Extracted the pre-phase parser and clone-key module verbatim from `130d68a9` (the commit
  `02-CONTEXT.md` cites as the byte-identity baseline) and ran both side by side against the
  working tree over 26 string inputs with `node --experimental-strip-types`, independently of any
  number `02-REVIEW-FIX.md` reports:
  `IDENTITY_DIFFS=6` — all six are the sanctioned D-2-05 shape (a trailing slash immediately before
  `#<ref>`), every other input (github, git-subdir, rejected schemes, paths, shorthand) is
  byte-identical to pre-phase, and `https://github.com/o/r/#main` is still rejected verbatim
  (unchanged reason string).
- Ran the fixed-point check myself: parsed each of 4 slash-before-fragment inputs, serialized to the
  persisted `{kind, raw, url, ref}` shape, re-parsed, and compared `canonicalCloneUrl` on both —
  `FIXED_POINT_VIOLATIONS=0`.
- Ran two independent negative controls against **scratch copies** of `source.ts` (production file
  never touched — a Bash edit to it was attempted once and blocked by the sandbox before any write
  landed; `git status --porcelain` on the file confirmed clean throughout): reverting the identity
  composition's ordering breaks exactly the 2 slash-before-fragment identity cases and none of the
  wire cases; reverting the wire composition's ordering breaks exactly the 1 pinned `.git`-behind-a-
  slash wire case and none of the identity cases. This reproduces `02-REVIEW-FIX.md`'s Gate 7
  negative controls independently rather than trusting the report's own numbers.
- Probed CR-02's scheme gate directly with 10 attacker-shaped object inputs (`http://`, `ssh://`,
  `git@host:`, a relative path, a github `/tree/` browser URL — each once in `url` and once in
  `raw`) — all 10 reject, confirming both fields are gated independently.
- Ran the phase's own test suites directly (not reused from any prior run): `tests/edge/handlers/
  marketplace/add.test.ts tests/orchestrators/marketplace/add.test.ts tests/domain/source.test.ts
  tests/domain/clone-key.test.ts` → 238/238 pass; `tests/orchestrators/plugin/{clone-cache,
  install-clone-probe,reinstall-clone-probe,fetch,info,update-preflight}.test.ts` → 274/274 pass;
  `tests/orchestrators/plugin/{install-flow,update-flow,reinstall-flow}.test.ts tests/integration/
  marketplace-add-seed-mirrors.test.ts tests/architecture/{no-credential-leak,import-boundaries,
  no-stale-test-citations}.test.ts` → 496/496 pass. Total: 1008/1008 directly run, 0 failures.
- Ran `npm run check` end-to-end in this session, to completion, not reused from any prior run:
  `typecheck`, `lint`, `lint:workflows(+negative)`, `fallow` (no issues; the two non-blocking `fallow
  health`/`fallow dupes` advisories match the numbers `02-REVIEW-FIX.md` recorded), `format:check`,
  `test:corresponding(+negative)`, `test:coverage:direct:negative`, `test:coverage:unit` (7328/7328
  pass, 100.00/100.00/100.00 lines/functions/branches over `extensions/**`), `test:integration`
  (36/36 pass), `lint:type-members` (passed, 4 recorded exceptions), and `lint:type-members:negative`
  (7 of 7 negative controls passed) — captured into the log as `CHECK_EXIT=0`. The run took
  substantially longer than usual because several competing codegraph/fallow-mcp/tsserver daemons
  were consuming CPU on this host throughout the session; the result is unambiguous regardless.
  `02-REVIEW-FIX.md` additionally ran the identical `extensions/`/`tests/` tree (HEAD's code is
  byte-identical to `7c7df1df`, which is what that report's final gate ran against) to `CHECK_EXIT=0`
  twice, so this is now a third independent confirmation of the same result.
- Confirmed `scripts/check-unused-type-members.contracts.json` holds 108 `contracts` entries and
  zero pins name `domain/source.ts` or `domain/clone-key.ts`; spot-checked the four remapped
  `info.ts`/`update-preflight.ts` pins against the actual file lines — all four line up with the
  claimed content.
- Confirmed `scripts/test-coverage-direct.pin.json` still holds an empty `rows: []`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `marketplace add` of a `url` source sends the URL the user typed, with trailing slashes and `#<ref>` stripped and the `.git` decision left exactly as typed, against a git port that admits ONLY the verbatim form (MURL-08, D-2-01). | ✓ VERIFIED | `networkCloneUrl`'s `url` arm reads `stripSlashAndFragment(source.raw).base` (`clone-key.ts:101`); `tests/edge/handlers/marketplace/add.test.ts` + `tests/orchestrators/marketplace/add.test.ts` (238/238 pass, run directly this session) assert the sent URL by value against a fake whose `allowedRemoteUrls` admits only the verbatim form. |
| 2 | A `github` source still sends `https://github.com/<owner>/<repo>.git`, byte-identical to today (SC4). | ✓ VERIFIED | `networkCloneUrl`'s `github` arm is `ensureGitSuffix(canonicalCloneUrl(source))`, unchanged; independent probe against the `130d68a9` parser confirms 0 diffs on every github input including the `https://github.com/o/r/#main` rejection. |
| 3 | A `url` source whose typed input ended in `.git` still sends `.git`, deriving from `source.raw` not the parse-time-stripped `source.url` (SC4, D-2-03). | ✓ VERIFIED | `MURL-08 / D-2-01` test case passes; `tests/domain/clone-key.test.ts`'s `networkCloneUrl` block asserts the raw-ends-`.git`-while-url-does-not case by exact string, plus the new `.git`-behind-a-slash-before-fragment case this session's negative control confirmed is genuinely exercised. |
| 4 | `canonicalCloneUrl` returns the same string for every source kind as before this plan — AMENDED by D-2-05 with one sanctioned exception (a `url` source's trailing-slash-before-`#<ref>` shape), which is now a FIXED POINT: first parse and reload compute the SAME identity (SC4, D-2-05). | ✓ VERIFIED | Previously flagged as an open human decision (item 2 of the prior verification). Now closed: operator decided 2026-09-27 to normalize (`7c7df1df`); this session independently re-derived `IDENTITY_DIFFS=6` (all sanctioned-shape) against `130d68a9` and `FIXED_POINT_VIOLATIONS=0` across 4 slash-before-fragment inputs on a first-parse-then-reload round trip. `02-01-PLAN.md`'s must-have text is amended (not deleted) to name the exception and cite D-2-05. |
| 5 | `marketplace add` makes exactly ONE clone attempt per operation on both the success and failure path, URL asserted by value (MURL-09, SC3, D-2-04). | ✓ VERIFIED | 3 MURL-09 cases (404, 401, D-2-02 suffix-only refusal) each assert `state.cloneCalls.length === 1` AND the exact URL string in the same test body; equivalent coverage in `clone-cache.test.ts` across all three plugin seams (`resolvePluginPin`, `materializePluginClone`, `materializeOrRefreshPluginMirror`). |
| 6 | A 401/403/404/5xx from the clone keeps its original error identity and message through the add seam (SC2). | ✓ VERIFIED | Same cases assert `err === cloneThrows` by reference plus `.message`/`.code`/`.data.statusCode`; `handleAddFailure`'s catch only classifies and rethrows/wraps, read directly. |
| 7 | `networkCloneUrl` is a pure function of `source` — no process/fs/network state (MURL-08 concurrency edge). | ✓ VERIFIED | Read the function body directly: a 3-arm switch over pure string ops; `grep` confirms no `process.`, `node:fs`, or `await` in either `clone-key.ts` or `source.ts`. |
| 8 | Exactly-one-attempt is per OPERATION, not per process (MURL-09 concurrency edge). | ✓ VERIFIED | `state.cloneCalls`/`resolveRemoteRefCalls` are per-fixture-instance arrays; each test constructs its own `createGitOps(...)` fixture, and `calls.clone.push(...)` in `git-ops-fake.ts` runs unconditionally before any injected error throws. |
| 9 | CR-02's https-only scheme gate rejects through BOTH the `url` and `raw` object fields, and the D-2-05 slash normalization does NOT widen what a `github` url accepts (`https://github.com/o/r/#main` stays rejected) (D-76-01, D-2-05 scope boundary). | ✓ VERIFIED | Independent probe: 10 attacker-shaped object inputs (`http://`, `ssh://`, `git@host:`, relative path, github `/tree/` browser URL — each in `url` once and `raw` once) all reject via `unknownObjectSource`/`gatedUrlField`; `stripGitHubUrlDecorations` (github identity) is a separate composition from `stripUrlDecorations` (url identity) per D-2-05's own "three compositions, not one" design, confirmed by reading `source.ts:492-530` and by this session's own probe of `https://github.com/o/r/#main` still returning `kind: "unknown"` with the canonical-form diagnostic. |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified).

### Roadmap Success Criteria Cross-Check

| SC | Text | Status |
|----|------|--------|
| SC1 | verbatim-path `clone` AND `resolveRemoteRef` both resolve | ✓ — `resolvePluginPin` (resolveRemoteRef) and `addGitClonedInGuard`/`materializePluginClone`/`materializeOrRefreshPluginMirror` (clone) all route through `networkCloneUrl`; each has a passing test run directly this session. |
| SC2 | 401/403/404/5xx keeps original error identity | ✓ — truth 6 above, plus equivalent `clone-cache.test.ts` MURL-09 cases for all three plugin seams (274/274 pass, run directly). |
| SC3 | exactly ONE network attempt per operation, both paths | ✓ — truth 5 above; ROADMAP.md's own SC3 text (line 114-117) matches D-2-04's correction (count of one, not two) verbatim. |
| SC4 | `.git` only where Claude Code appends it; `canonicalCloneUrl` unchanged | ✓ with the D-2-05 sanctioned exception, now closed (truth 4) rather than an open human decision. |
| SC5 | `npm run check` green, 100% on every new arm, `test:corresponding` | ✓ — this session's own `npm run check` ran end-to-end to completion at HEAD (`4d530bfb`), `CHECK_EXIT=0`, including 100.00/100.00/100.00 lines/functions/branches on `extensions/**` (7328/7328 unit tests), `test:integration` 36/36, and `lint:type-members`(+negative) 4 exceptions / 7 of 7 negative controls; this session's own 1008 directly-run tests across every add/plugin/architecture suite this phase touches all pass; `02-REVIEW-FIX.md`'s Gate 8 independently ran the identical `extensions/`/`tests/` tree (byte-identical to HEAD) to `CHECK_EXIT=0` twice more. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/source.ts` | exports `stripSlashAndFragment`; `stripUrlDecorations` and `stripGitHubUrlDecorations` are separate private compositions per D-2-05 | ✓ VERIFIED | Read the file in full (729 lines): three named compositions over two shared leaf primitives (`stripTrailingSlashes`, `splitUrlFragment`) plus `stripGitSuffix`, no shared composition between the wire and identity forms. |
| `extensions/pi-claude-marketplace/domain/clone-key.ts` | `networkCloneUrl(source)`, 3-arm switch, no `default` | ✓ VERIFIED | Present at line 96, `github`/`url`/`git-subdir` arms, TS exhaustiveness confirmed by reading the file. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | seam wired to `networkCloneUrl` | ✓ VERIFIED | Unchanged since the prior verification's direct read (`import { networkCloneUrl }`; `url: networkCloneUrl(source)` at the clone call site); no diff in this file since `2ecac99b`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `networkUrl: string` required (×2), disk key still hashes `cloneUrl` | ✓ VERIFIED | Unchanged since the prior verification; not touched by the two new commits. |
| `scripts/check-unused-type-members.contracts.json` | 108 entries, 4 recorded exceptions, no pin on the two changed domain files | ✓ VERIFIED | Parsed directly: `contracts.length === 108`; zero entries reference `domain/source.ts` or `domain/clone-key.ts`; the four `info.ts`/`update-preflight.ts` pins line up with real file content at their recorded coordinates. |
| Test files (`tests/domain/source.test.ts`, `tests/domain/clone-key.test.ts`) | fixed-point table, retitled identity cases, no stale ordering claims | ✓ VERIFIED | `URL_FIXED_POINT_CASES` (8 rows) writes each expected `UrlSource` once and compares it against both the first-parse and the reload — genuinely behavioral: this session's own negative control on a scratch copy shows exactly the rows this table covers fail under a reverted ordering. Old "keeps a path slash" titles retitled to "strips a path slash" — `grep` confirms zero stale titles remain. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `networkCloneUrl`'s github arm | `ensureGitSuffix` | function call | ✓ WIRED | Read directly; unchanged since prior verification. |
| `stripUrlDecorations` / `stripGitHubUrlDecorations` | shared leaf primitives only, no shared composition | function structure | ✓ WIRED (deliberately decoupled) | `02-REVIEW-FIX.md`'s stated reason (CR-01 cost the phase once when a shared composition let a wire-side fix move the cache identity) confirmed structurally: the two functions call `splitUrlFragment`/`stripTrailingSlashes`/`stripGitSuffix` in different orders and neither calls the other. |
| `urlObjectSource` | `gatedUrlField` on both `url` and `raw` | https-only scheme gate | ✓ WIRED | Read directly at `source.ts:192-225`; independently probed with 10 attacker inputs in each field this session — all reject. |
| `add.ts` / `clone-cache.ts` seams | `networkCloneUrl(source)` | clone/resolveRemoteRef call `url`/`networkUrl` field | ✓ WIRED | Unchanged since prior verification (not touched by the two new commits); re-confirmed passing via this session's direct test runs. |

### Data-Flow Trace (Level 4)

`networkCloneUrl(source)` → `gitOps.clone({ url: ... })` / `gitOps.resolveRemoteRef({ url: ... })`:
traced end-to-end through the real edge handler in `tests/edge/handlers/marketplace/add.test.ts` (run
directly this session, 238/238 pass) — no mock of `parsePluginSource` or `addMarketplace`, only the
git port is faked, and the fake's `allowedRemoteUrls` allowlist is narrowed to exactly the value the
derivation produces. Status: ✓ FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MURL-08/MURL-09 add-seam suite | `node --experimental-strip-types --test tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/marketplace/add.test.ts tests/domain/source.test.ts tests/domain/clone-key.test.ts` | 238/238 pass | ✓ PASS |
| Plugin clone-cache + probe suites | `node --experimental-strip-types --test tests/orchestrators/plugin/{clone-cache,install-clone-probe,reinstall-clone-probe,fetch,info,update-preflight}.test.ts` | 274/274 pass | ✓ PASS |
| Plugin flow + seed-mirrors + architecture suites | `node --experimental-strip-types --test tests/orchestrators/plugin/{install-flow,update-flow,reinstall-flow}.test.ts tests/integration/marketplace-add-seed-mirrors.test.ts tests/architecture/{no-credential-leak,import-boundaries,no-stale-test-citations}.test.ts` | 496/496 pass | ✓ PASS |
| Independent identity-diff probe vs. pre-phase (`130d68a9`) parser | `node --experimental-strip-types` scratch script, 26 string inputs | `IDENTITY_DIFFS=6`, all sanctioned D-2-05 shape; github rejection unchanged | ✓ PASS |
| Independent fixed-point probe (first parse vs. persist-and-reload) | same script, 4 slash-before-fragment inputs | `FIXED_POINT_VIOLATIONS=0` | ✓ PASS |
| Negative control: revert identity composition ordering on a scratch copy of `source.ts` | `node --experimental-strip-types` against a patched scratch file (production file never touched) | Exactly the 2 slash-before-fragment identity cases differ; 0 wire-form cases affected | ✓ PASS — confirms the fixed-point test table is behavioral, not vacuous |
| Negative control: revert wire composition ordering on a scratch copy | same method | The 1 pinned `.git`-behind-slash wire case differs; 0 identity cases affected | ✓ PASS — confirms the wire test is behavioral |
| CR-02 scheme-gate probe, both object fields | direct probe, 10 attacker-shaped inputs | All 10 reject (`kind: "unknown"`) | ✓ PASS |
| `npm run check` | this verifier, end-to-end, launched once this session, ran to completion | Clean through every stage: typecheck, lint, lint:workflows(+neg), fallow, format:check, test:corresponding(+neg), test:coverage:direct:negative, test:coverage:unit (7328/7328 pass, 100.00/100.00/100.00 lines/functions/branches over `extensions/**`), test:integration (36/36 pass), lint:type-members (passed, 4 recorded exceptions), lint:type-members:negative (7 of 7 negative controls passed). `CHECK_EXIT=0`. | ✓ PASS — full run completed in this session, not reused from a prior run; corroborated by `02-REVIEW-FIX.md`'s two independent `CHECK_EXIT=0` runs of the identical code tree |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MURL-08 | 01, 02, 03 | verbatim-URL smart-HTTP endpoint resolves clone + resolveRemoteRef | ✓ SATISFIED | Truths 1-4, 7, 9; REQUIREMENTS.md marks Complete. |
| MURL-09 | 01, 02, 03 | sent URL == typed URL modulo decoration; exactly one attempt | ✓ SATISFIED | Truths 5, 6, 8; REQUIREMENTS.md marks Complete. |

No orphaned requirements: `grep -n "Phase 2" REQUIREMENTS.md` maps only MURL-08/MURL-09 to this
phase, and both appear in all three plans' `requirements:` frontmatter.

### Prohibitions

| # | Statement | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No test case may keep a name/title/comment promising the pre-phase `.git`-for-every-host rule while asserting the verbatim rule, or the reverse (all 3 plans). | ✓ HOLDS | `grep` for stale titles (`keeps a path slash`) returns zero hits; the only surviving `.git`-suffixed title (`clone-cache.test.ts`'s `MURL-01 / PURL-09 ... sends a .git-suffixed url`) is correct — its fixture is a genuine `github`-kind source. |
| 2 | A source that stops working under the accepted D-2-02 regression must fail with the URL that was actually sent named in the failure. | ✓ HOLDS | For the D-2-02 fixture case, `rawSource` (what the user typed) and the sent wire URL are the same string (D-2-01 sends verbatim), and `addSubjectName` (pre-existing, unchanged) returns `rawSource` as the failed row's name in standalone mode; the fake's own refusal message additionally names the URL when the error is unclassified and rethrown raw. |
| 3 (02-02) | A pass-through wire-URL test must not merely re-assert the caller's own value; `networkUrl` must DIFFER from `cloneUrl` in at least one assertion to prove which one reaches the network. | ✓ HOLDS | `materializePluginClone forwards the caller's wire url and keys the dir off the identity url` uses `cloneUrl = ".../o/r"` and `wireUrl = ".../o/r.git"` — genuinely different values, and the assertion checks each independently. |
| 4 (02-03) | No remote allowlist anywhere admits BOTH the verbatim and the `.git`-suffixed form of the same URL for a `url`-kind source. | ✓ HOLDS | `tests/integration/marketplace-add-seed-mirrors.test.ts:81` now admits `[REPO_URL]` only (single form) — read directly; the plan's own cited pre-fix state (`[REPO_URL, ${REPO_URL}.git]`) is gone. |
| 5 (02-03) | No docstring in `extensions/` still states the inverse of D-2-02 (that an un-suffixed-only host fails). | ✓ HOLDS | `ensureGitSuffix`'s docstring reads "a suffix-less URL does not resolve against a host that serves ONLY the `.git`-suffixed smart-HTTP path" — the current (D-2-02-correct) direction; `grep` for the inverse phrasing across `extensions/` returns zero hits. |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file this phase touched, including
the two files changed since the prior verification (`domain/source.ts`, `tests/domain/source.test.ts`,
`tests/domain/clone-key.test.ts`) — checked directly with `grep`.

No `typescript-comments` skill violations in the two changed production/test files: `grep` for
`the former|used to|no longer|pre-fix|Phase [0-9]|Plan [0-9]|Wave [0-9]|Pitfall [0-9]|Pattern [0-9]`
returns zero hits.

No stale-rule test titles (see Prohibitions #1 above).

**Carried forward from the prior verification's notable-but-resolved finding:** `02-REVIEW.iter1-
superseded.md` and its paired `.iter1-superseded.md` fix report describe two critical bugs that this
verifier (and the prior one) independently confirmed do NOT reproduce against the current code — they
were fixed early in the review loop, before the iteration-2 review found a different pair (CR-01/CR-02,
both now fixed and confirmed above). The `.iter1-superseded` naming (renamed from `.iter2` since the
prior verification, per commit `63951a58`) makes this less likely to mislead a future reader than the
prior verification's session found it.

### Coincidental Reliance

None flagged. This session's own independent probes (pre-phase-parser diff, fixed-point round trip,
both negative controls, CR-02 attacker-field probe) construct their own inputs and compare against
literals or an independently-extracted pre-phase baseline — none of them depend on a fixture-only
precondition, an undeclared ordering, or an incidental side effect the production code does not
itself establish. The MURL-09 call-count-plus-value assertions each construct their own fixture
instance per test.

### Human Verification Required

#### 1. Live smart-HTTP endpoint (real server, not the offline fake)

**Test:** Point `marketplace add <url>` at a real smart-HTTP git server that answers only at the
verbatim path and 404s the `.git`-suffixed form. Confirm both the initial clone and a later
`resolveRemoteRef` (via `marketplace update` or a pinned-plugin resolve) succeed.
**Expected:** Both operations resolve against the real server.
**Why human:** `02-VALIDATION.md`'s own Manual-Only Verifications table names this exact item and no
plan closed it — every automated test proves the SENT url is verbatim against an offline fake, never
against a real HTTP round trip. This is the same class of gap Phase 1 left open in its own
`01-VERIFICATION.md`. **Per the orchestrator's instruction, this item is being explicitly deferred by
operator decision** — carried forward unchanged, not re-litigated, and not treated as a gap. It does
not block Phase 3 from proceeding, matching the precedent Phase 1 already set.

### Gaps Summary

None. The one item that was genuinely open at the prior verification (the D-2-05 reload-identity
decision) is now closed: the operator was shown the trade (byte-identity to `130d68a9` vs. a fixed
point — mutually exclusive because `130d68a9` self-contradicted on one input shape) and chose the
fixed point, and this session independently re-derived that the implementation matches the decision's
stated scope exactly (`url` kind only, `github`/`git-subdir` untouched, wire form unaffected). No
must-have truth failed, no artifact is missing or a stub, no key link is unwired, no prohibition is
violated, and no debt marker was found. The remaining human-verification item (the live smart-HTTP
canary) is carried forward unchanged and is being deferred by explicit operator decision, not treated
as a gap — the same disposition Phase 1 established for its own open live-canary item.

---

_Verified: 2026-09-27T11:56:55Z_
_Verifier: Claude (gsd-verifier)_
