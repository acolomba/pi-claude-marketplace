---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
verified: 2026-09-30T16:15:03Z
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
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-SECURITY.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-UAT.md
  - .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-VALIDATION.md
  - .planning/workstreams/git-hosts/quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/260928-tt9-PLAN.md
  - .planning/workstreams/git-hosts/quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/260928-tt9-SUMMARY.md
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
  - extensions/pi-claude-marketplace/persistence/state-io.ts
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
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/persistence/state-io.test.ts
  - tests/platform/git.test.ts
covered_digest: "v2:sha256:e698dfe7881cc4731edfc579ea2b0cf4828b83e4532817a7293ffef0a92b2a49"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "passed"
  previous_score: "9/9"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "The github.com host fold (c1286475) moves the cache identity of a source typed on a non-canonical github host spelling (capitalized host, www. prefix, explicit :443) from the old url-kind identity (e.g. https://GitHub.com/o/r) to the github canonical https://github.com/o/r. Warm plugin clones keyed on the old spelling re-clone once on a cache miss."
    category: other
    reason: "Deliberate D-76-02 outcome (one canonical identity per repo, Device Flow applicable); no source that was already github kind, and no url source on any other host, changes identity. Recorded for visibility, not a Phase 2 gap: SC4's cold-miss clause concerns the .git wire derivation, which does not touch canonicalCloneUrl."
    evidence_status: "reasoned from source.ts/clone-key.ts and the GITHUB_HOST_FOLD_CASES + state-io fold tests; no test pins the pre-fold spelling's old hash"
---

# Phase 2: Endpoints that answer only at the verbatim URL Verification Report

**Phase Goal:** A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed and returns 404 for the conventional `.git`-suffixed form, and a repository that is genuinely missing or genuinely forbidden still fails as itself.

**Verified:** 2026-09-30T16:15:03Z
**Status:** passed
**Re-verification:** Yes — the prior `02-VERIFICATION.md` (verified 2026-09-29, `passed`, 9/9) went stale
because commits landed after it that touch covered files: `505dc912`, `23cc2218`, `ae8ce217`, `62ec0fa6`
and `c1286475` (main was then merged back; the branch tree equals main `a0d3aef1`).

## Why this is a re-verification

Diffed `ab72dba0..HEAD` scoped to `extensions/`, `tests/` and `scripts/`. Of this phase's covered
production files the following changed:

- `domain/source.ts` — `parseUrlSourceForm` now folds the github.com host (`gitHubUrlPath`: lowercased
  authority, explicit default `:443` dropped, leading `www.` labels stripped) into a `github` source,
  the way Claude Code recognizes it (D-76-02). A non-default port or userinfo keeps a `url` source.
  The scheme match stays case-sensitive (`https://` only). The T-2-10 `raw`-must-name-`url`'s-identity
  arm from the prior round is untouched.
- `persistence/state-io.ts` — `revalidateStoredUrlSource`: a stored `url` record whose raw now parses as
  `github` (https only) loads as a `github` source instead of throwing; any other non-`url` parse is
  still a corrupt record.
- `orchestrators/plugin/clone-cache.ts` — `auth` is now a required `GitAuthBundle` on both
  materializers; the two clone call sites share `cloneIntoStaging`. Same `gitOps.clone` arguments.
- `platform/git.ts` — `auth` option types unified to `BuildAuthCallbacksOpts`; `listRemotes` gained a
  `permission-denied` arm. `clone`/`fetch`/`resolveRemoteRef` bodies are unchanged.
- `orchestrators/marketplace/{add,shared}.ts`, `orchestrators/plugin/update-preflight.ts`,
  `orchestrators/auth-host.ts` — auth-bundle plumbing (`buildStoredCredentialAuth` for the ctx-less
  cascade arm), `UnreadableSourceCloneError` classification, docstring rewrites. The clone call in
  `add.ts` is still `url: networkCloneUrl(source)`, once.

Byte-identical since `ab72dba0` (empty diff): `domain/clone-key.ts`, `orchestrators/plugin/{fetch,info,install-clone-probe,reinstall-clone-probe}.ts`.

## How this was verified

Not from SUMMARY.md or the prior report. In this session:

- Read the full diffs of every changed covered production file listed above.
- Read `domain/clone-key.ts` at HEAD: `canonicalCloneUrl` (`github` -> `https://github.com/<owner>/<repo>`,
  else `source.url`) and `networkCloneUrl` (github -> `ensureGitSuffix`, url -> `stripSlashAndFragment(raw).base`,
  git-subdir -> `stripSlashAndFragment(url).base`) are unchanged.
- Enumerated every production call site: `networkCloneUrl` feeds `gitOps.clone` (`add.ts:771`) and the
  `networkUrl` field of every plugin clone/mirror seam (`clone-cache.ts:564`, `fetch.ts`, `info.ts`,
  `install-clone-probe.ts`, `reinstall-clone-probe.ts`, `update-preflight.ts`); `canonicalCloneUrl` stays
  the key/identity input everywhere else.
- Ran a scratch script (scratchpad, not committed) over ten typed inputs through
  `parsePluginSource` -> JSON round trip -> re-parse (`githubSource` for github, `parsePluginSource` for
  the rest): every one is a fixed point, and canonical/wire values are as expected (below).
- Ran directly: `node --test tests/domain/source.test.ts tests/domain/clone-key.test.ts
  tests/orchestrators/marketplace/add.test.ts tests/orchestrators/plugin/clone-cache.test.ts
  tests/platform/git.test.ts tests/persistence/state-io.test.ts tests/orchestrators/plugin/fetch.test.ts
  tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  tests/orchestrators/plugin/update-preflight.test.ts tests/edge/handlers/marketplace/add.test.ts`
  -> 645/645 pass, 0 fail. Did not run `npm run check` or the whole suite: CI ran `npm run check` green
  on `c1286475` (PR #221), and the branch tree equals main `a0d3aef1`.
- Grepped: 0 hits for `keeps a path slash` in `tests/`; no `TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER` in the
  six covered production files that changed (`source.ts`, `clone-key.ts`, `git.ts`, `state-io.ts`,
  `clone-cache.ts`, `add.ts`).

### Host fold versus cache identity and D-2-05 (the two points this round targeted)

| Typed input | Kind | `canonicalCloneUrl` | `networkCloneUrl` | Reload fixed point |
|-------------|------|---------------------|-------------------|--------------------|
| `https://github.com/o/r` and `o/r` | github | `https://github.com/o/r` | `https://github.com/o/r.git` | yes |
| `https://GitHub.com/o/r/`, `https://www.github.com/o/r.git#main`, `https://github.com:443/o/r` | github | `https://github.com/o/r` | `https://github.com/o/r.git` | yes |
| `https://gitlab.com/o/r` | url | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` | yes |
| `https://gitlab.com/o/r.git/#x` | url | `https://gitlab.com/o/r` | `https://gitlab.com/o/r.git` | yes |
| `https://github.com:8443/o/r.git`, `https://user@github.com/o/r` | url | as typed, `.git`-stripped | as typed (`.git` kept if typed) | yes |

- SC4 `.git` rule: `.git` is appended only in the `github` arm. The fold widens which spellings reach
  that arm, but all of them are github.com hosts, which is exactly where Claude Code appends `.git`.
  A port other than 443 or userinfo never folds, so its wire URL stays verbatim.
- Cache identity: `canonicalCloneUrl` is unchanged, so no source that was already `github` kind and no
  `url` source on another host changes its `plugin-clones/` hash. The one movement is confined to
  non-canonical github.com spellings, which before c1286475 parsed as `url` kind with identity
  `https://GitHub.com/o/r` and now parse as `github` with `https://github.com/o/r`. That is the D-76-02
  "one canonical identity per repo" rule, not a `.git` regression; recorded as an advisory item.
- D-2-05: identity is a fixed point on first parse and on reload for url and for folded github sources
  (table above; `URL_FIXED_POINT_CASES` and `GITHUB_HOST_FOLD_CASES` in `tests/domain/source.test.ts`; the
  stored `url`-kind-on-`GitHub.com` load case in `tests/persistence/state-io.test.ts`). The fold is
  applied in the one parser funnel that state-io, the object-source gate and `samePlannedSource` all use.
- T-2-10 still holds under the fold: a non-github identity with a github-host `raw` (any spelling) now
  parses `github` for `raw`, fails `gatedRaw.kind !== "url"`, and is rejected.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `marketplace add` of a `url` source sends the URL the user typed, with trailing slashes and `#<ref>` stripped and the `.git` decision left exactly as typed, against a git port that admits ONLY the verbatim form (MURL-08, D-2-01). | ✓ VERIFIED | `add.ts:771` sends `networkCloneUrl(source)`; `url` arm reads `source.raw`; fixture cases in `add.test.ts` and `clone-key.test.ts` pass (645/645). Live evidence in `02-UAT.md` stands: the transport bodies of `clone`/`fetch`/`resolveRemoteRef` are unchanged. |
| 2 | A `github` source still sends `https://github.com/<owner>/<repo>.git`, byte-identical to today (SC4). | ✓ VERIFIED | Scratch run: every github-kind input, folded spelling included, gives `https://github.com/o/r.git`. |
| 3 | A `url` source whose typed input ended in `.git` still sends `.git`, deriving from `source.raw` not the parse-time-stripped `source.url` (SC4, D-2-03). | ✓ VERIFIED | Scratch run: `https://gitlab.com/o/r.git/#x` -> wire `https://gitlab.com/o/r.git`, canonical `https://gitlab.com/o/r`; `clone-key.test.ts` pins it. |
| 4 | `canonicalCloneUrl` returns the same string for every source kind as before, with the D-2-05 trailing-slash-before-`#<ref>` exception as a fixed point (SC4, D-2-05). | ✓ VERIFIED | `clone-key.ts` byte-identical since `ab72dba0`. The host fold changes which kind a non-canonical github spelling parses to, not what `canonicalCloneUrl` returns for a given kind (advisory above). |
| 5 | `marketplace add` makes exactly ONE clone attempt per operation on both the success and failure path, URL asserted by value (MURL-09, SC3, D-2-04). | ✓ VERIFIED | `MURL-09: a 404 ...`, `MURL-09: a 401 ...`, `MURL-09 / D-2-02: ... suffix-only port ...` in `add.test.ts` assert `cloneCalls.length === 1` plus the exact URL; all pass. `addGitClonedInGuard` has a single `gitOps.clone` and no retry. |
| 6 | A 401/403/404/5xx from the clone keeps its original error identity and message through the add seam (SC2). | ✓ VERIFIED | `appendLeakToError` only appends a cleanup leak to the same error; `UnreadableSourceCloneError` is raised only by the leftover probe, not the clone. Same-identity assertions pass. |
| 7 | `networkCloneUrl` is a pure function of `source` — no process/fs/network state (MURL-08 concurrency edge). | ✓ VERIFIED | Read at HEAD: unchanged 3-arm switch over string operations. |
| 8 | Exactly-one-attempt is per OPERATION, not per process (MURL-09 concurrency edge). | ✓ VERIFIED | `cloneCalls` is per-fixture-instance; the clone-cache change only extracted `cloneIntoStaging`, one `gitOps.clone` per staging attempt as before. |
| 9 | CR-02's https-only scheme gate rejects through BOTH the `url` and `raw` object fields, and D-2-05's slash normalization does NOT widen what a `github` url accepts (D-76-01, D-2-05 scope boundary). | ✓ VERIFIED | `gitHubUrlPath` requires the `https://` prefix, so `http://` never folds and stays rejected; the host fold widens spellings of github.com only and `parseGitHubUrl` still demands exactly owner/repo (tree URLs on a folded host still reject with a canonical hint, a `GITHUB_HOST_FOLD_CASES` row). `github.com.evil`, `notgithub.com`, `github.com:8443`, `user@github.com` and a path-less `https://github.com` stay `url` (rows pass). |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified).

### Roadmap Success Criteria Cross-Check

| SC | Text | Status |
|----|------|--------|
| SC1 | verbatim-path `clone` AND `resolveRemoteRef` both resolve | ✓ — `url` arm sends `raw`-derived verbatim URL to both; `platform/git.ts` transport bodies unchanged. |
| SC2 | 401/403/404/5xx keeps original error identity | ✓ — truth 6. |
| SC3 | exactly ONE network attempt per operation, both paths, no status-gated retry | ✓ — truths 5 and 8. |
| SC4 | `.git` only where Claude Code appends it; `canonicalCloneUrl` unchanged | ✓ — table above; identity movement limited to the advisory spellings. |
| SC5 | `npm run check` green, 100% on every new arm, `test:corresponding` | ✓ — not re-run; CI ran `npm run check` green on `c1286475` (PR #221) and the tree equals main `a0d3aef1`. New arms (`gitHubUrlPath`, `revalidateStoredUrlSource`) have direct tests in the 645 that pass. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/source.ts` | Separate D-2-05 compositions; scheme gate intact on `url`/`raw`; T-2-10 arm; host fold | ✓ VERIFIED | Read the diff; fold is in the one funnel. |
| `extensions/pi-claude-marketplace/domain/clone-key.ts` | `networkCloneUrl` 3-arm switch; `canonicalCloneUrl` identity | ✓ VERIFIED | Empty diff since `ab72dba0`. |
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | Stored `url` record on a github host loads as `github`, other non-url parses still corrupt | ✓ VERIFIED | `revalidateStoredUrlSource`; state-io test passes. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | Seam wired to `networkCloneUrl`, one clone | ✓ VERIFIED | `add.ts:771`. |
| `extensions/pi-claude-marketplace/platform/git.ts` | `clone`/`fetch`/`resolveRemoteRef` send `opts.url` verbatim | ✓ VERIFIED | Diff touches only option types and `listRemotes`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `networkUrl` required; disk key hashes `cloneUrl`; `auth` required | ✓ VERIFIED | `cloneIntoStaging` passes `networkUrl` through; tests pass. |
| `scripts/check-unused-type-members.contracts.json` | pins remapped after the auth-type change | ✓ VERIFIED | CI-gated (`lint:type-members` in `npm run check`), green on `c1286475`. |
| `02-UAT.md` | closes the carried-forward human item | ✓ VERIFIED | `status: complete`, 1/1. |
| `02-SECURITY.md` | T-2-10 disposed | ✓ VERIFIED | `threats_open: 0`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `networkCloneUrl` github arm | `ensureGitSuffix` | call | ✓ WIRED | unchanged |
| `add.ts` / `clone-cache.ts` seams | `networkCloneUrl(source)` | `url` / `networkUrl` field | ✓ WIRED | `add.ts:771`, `clone-cache.ts:564` and the four probes |
| `parsePluginSource` | `gitHubUrlPath` -> `parseGitHubUrl` | host fold | ✓ WIRED | reached from `parseUrlSourceForm`, which every funnel (string, object gate, state-io) calls |
| `state-io.ts::normalizeStoredSource` | `revalidateStoredUrlSource` | `kind: "url"` record | ✓ WIRED | tested |
| `platform/git.ts` `clone`/`fetch`/`resolveRemoteRef` | module-private redirect-following `http` | `git.*({ http })` | ✓ WIRED | unchanged |

### Data-Flow Trace (Level 4)

Typed input -> `parsePluginSource` -> stored source -> `networkCloneUrl` -> `gitOps.clone({ url })`
-> `HttpClient`: ✓ FLOWING (scratch run of the parse/wire values; `add.test.ts` fake port asserts the
URL by value; live transport in `02-UAT.md`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 2 suites plus the files the later commits touched | `node --test` over the 11 files listed above | 645/645 pass | ✓ PASS |
| Parse -> persist -> reload fixed point and canonical/wire values | scratch script over 10 typed inputs | all fixed points; values as tabled | ✓ PASS |
| Live smart-HTTP round trip | `02-UAT.md` test 1 (carried forward) | 1/1 pass | ✓ PASS |
| `npm run check` | not run here | CI green on `c1286475` (PR #221) | ✓ PASS (CI) |

### Probe Execution

None declared by this phase's plans. Step skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MURL-08 | 01, 02, 03 | verbatim-URL smart-HTTP endpoint resolves clone + resolveRemoteRef | ✓ SATISFIED | Truths 1-4, 7, 9 |
| MURL-09 | 01, 02, 03 | sent URL == typed URL modulo decoration; exactly one attempt, no status-gated retry | ✓ SATISFIED | Truths 5, 6, 8 |

No orphaned requirements: REQUIREMENTS.md maps only MURL-08/MURL-09 to Phase 2 (both `Complete`).

### Prohibitions

| # | Statement | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No test case may keep a name/title/comment promising the pre-phase `.git`-for-every-host rule while asserting the verbatim rule, or the reverse. | ✓ HOLDS | `grep -rn "keeps a path slash" tests/` -> 0. |
| 2 | A source that stops working under the accepted D-2-02 regression must fail with the URL actually sent named in the failure. | ✓ HOLDS | D-2-02 fixture case passes. |
| 3 | A pass-through wire-URL test must not merely re-assert the caller's own value; `networkUrl` must DIFFER from `cloneUrl` in at least one assertion. | ✓ HOLDS | `clone-cache.test.ts` passes; the wire/canonical difference is exercised for url and github kinds. |
| 4 | No remote allowlist admits BOTH the verbatim and the `.git`-suffixed form of the same URL for a `url`-kind source. | ✓ HOLDS | `marketplace-add-seed-mirrors.test.ts` unchanged. |
| 5 | No docstring in `extensions/` states the inverse of D-2-02. | ✓ HOLDS | `ensureGitSuffix` docstring states the correct direction. |

### Anti-Patterns Found

No debt markers in the changed covered production files. No stale-rule test titles. No blockers.

### Coincidental Reliance

None flagged. The fold's behavior is asserted by exact-value parse rows and by the state-io reload case, not by an incidental ordering or a fixture-only precondition.

### Human Verification Required

None. The live endpoint canary remains closed in `02-UAT.md`. The transport code it exercised is unchanged.

### Gaps Summary

None. All 9 must-have truths hold against the current code, all 5 ROADMAP success criteria hold, and the
host fold changes neither the `.git` wire rule (github arm only) nor `canonicalCloneUrl`, and keeps
identity a fixed point on first parse and reload. One advisory item (cache identity of non-canonical
github.com spellings) is recorded above.

---

_Verified: 2026-09-30T16:15:03Z_
_Verifier: Claude (gsd-verifier)_
