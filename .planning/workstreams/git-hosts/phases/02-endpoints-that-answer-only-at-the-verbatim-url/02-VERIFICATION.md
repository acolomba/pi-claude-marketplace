---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
verified: 2026-09-29T00:00:00Z
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
covered_digest: "v2:sha256:7fb6d578c73415ec779d60e4314be692222736eaeba6b7360741b1a82f119601"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 9/9
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory: []
---

# Phase 2: Endpoints that answer only at the verbatim URL Verification Report

**Phase Goal:** A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed and returns 404 for the conventional `.git`-suffixed form, and a repository that is genuinely missing or genuinely forbidden still fails as itself.

**Verified:** 2026-09-29T00:00:00Z
**Status:** passed
**Re-verification:** Yes — the prior `02-VERIFICATION.md` (verified 2026-09-28T21:15:00Z, `passed`, 9/9)
went stale: quick task 260928-tt9 landed two commits after that report was written —
`1cc96c97` (`domain/source.ts::urlObjectSource`, T-2-10: a url object source's `raw` is now admitted
only when its gated parse names the same repository as `url`) and `add75890`
(`platform/git.ts::listRemotes`, WR-11/T-3-05: refuses a leftover origin recording zero or two-plus
`remote.origin.url` values). Both files are in this phase's `covered_files` list, so the prior verdict
on them could not be carried forward without re-reading the changed code.

## Why this is a re-verification

Diffed `ab72dba0..HEAD` (the commit the prior `02-VERIFICATION.md` was itself verified at) scoped to
`extensions/` and `tests/`. Of the files this phase's `covered_files` list names, two production files
changed:

- `extensions/pi-claude-marketplace/domain/source.ts` — `urlObjectSource` gained a new rejection arm
  (T-2-10, security audit finding W-1): after the existing scheme gates on both the `url` and `raw`
  object fields, a `raw` that parses to a DIFFERENT repository than `url` now parses `unknown` through
  the existing `unknownObjectSource` rejection path, instead of being carried over verbatim. A `raw`
  that differs from `url` only by D-2-05 decoration (trailing slash, `#<ref>`, `.git`) is still
  admitted — the new check compares `gatedRaw.url` (the parse-time identity) against `identity.url`,
  not the raw strings.
- `extensions/pi-claude-marketplace/platform/git.ts` — `listRemotes` (Phase 3's MA-12/MA-13 leftover
  recognition, WR-11) was rewritten to read every `remote.origin.url` value via `git.getConfigAll`
  instead of the library's per-remote `git.listRemotes` enumeration, and now reports `origin` only
  when there is exactly one value. This is the SAME function Phase 3's `recognizeLeftover` calls; it
  is local-filesystem-only (`fs.promises.readFile` of `.git/config`, no network) and does not touch
  `clone`/`fetch`/`resolveRemoteRef` — the three functions Phase 2's MURL-08/MURL-09 truths depend on.

None of `domain/clone-key.ts`, `orchestrators/marketplace/add.ts` (the clone-call-site wiring),
`orchestrators/marketplace/shared.ts`, `orchestrators/auth-host.ts`,
`orchestrators/plugin/{clone-cache,fetch,info,install-clone-probe,reinstall-clone-probe,
update-preflight}.ts` changed since `ab72dba0`.

## How this was verified

Not from SUMMARY.md, the quick-task SUMMARY, or the prior VERIFICATION.md's narration alone.
Independently, in this session:

- Ran `git diff ab72dba0..HEAD -- extensions/ tests/` and confirmed the file-level change set: 2
  production files (`domain/source.ts`, `platform/git.ts`) and 3 test files (`tests/domain/source.test.ts`,
  `tests/platform/git.test.ts`, `tests/orchestrators/marketplace/add.test.ts`). Confirmed via a second,
  targeted diff that every other file this phase's `covered_files` list names (`domain/clone-key.ts`,
  `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/shared.ts`, `orchestrators/auth-host.ts`,
  and all six `orchestrators/plugin/*.ts` probe/cache/fetch/info files) has an EMPTY diff since `ab72dba0`
  — byte-identical to what the prior verification already read.
- Read `domain/source.ts` in full (745 lines) and traced `urlObjectSource` line by line: the new arm
  (lines 224-233) sits strictly AFTER the existing scheme gates on both `url` (line 204) and `raw`
  (line 219) — it cannot loosen either gate, only add a further rejection. It compares
  `gatedRaw.url !== identity.url` (the parse-time D-2-05 identity of each field), not the raw input
  strings, so a `raw` that differs from `url` only by trailing slash / `#<ref>` / `.git` still passes
  (confirmed against the new admission test case below). Confirmed the CR-02 https-only scheme gate
  (D-76-01) is unaffected: for any rejected scheme, `gatedUrlField` already returns `kind: "unknown"`
  and the function returns at the EARLIER `identity.kind === "unknown"` (line 205) or
  `gatedRaw.kind === "unknown"` (line 220) check, before the new T-2-10 arm is ever reached.
- Read `tests/domain/source.test.ts`'s diff: 5 new rows in `URL_OBJECT_GATE_CASES` — 4 rejection cases
  (foreign host via both `source`- and `kind`-tagged object forms, a github-hosted raw behind a
  non-github identity, and a same-host-different-path raw) plus 1 admission case (`raw` differing from
  `url` only by trailing slash + `.git`, still admitted). Ran this file directly this session: 149/149
  pass (up from 145 at the prior verification's read — the 4 new rejection cases plus 1 new admission
  case, all additive, none retitled or removed). The quick task's own SUMMARY records the RED evidence
  (145 pass / 4 fail against the unfixed parser, the exact 4 new rejection titles failing) — independently
  corroborated by reading the diff and re-running the suite GREEN.
- Read `platform/git.ts`'s `listRemotes` diff: it now calls `git.getConfigAll({ fs, dir, path:
  "remote.origin.url" })` (a local `fs.promises.readFile`-backed config read, same file
  `git.getConfigAll`/`git.listRemotes` both parse) instead of `git.listRemotes`, and reports
  `{ kind: "origin", url }` only when exactly one value is returned. Confirmed this function has NO
  caller in the MURL-08/MURL-09 clone/resolveRemoteRef path: its sole caller is
  `orchestrators/marketplace/add.ts::recognizeLeftover` (Phase 3, MA-12/MA-13), itself unchanged since
  the prior verification (confirmed via the empty targeted diff above) — `recognizeLeftover` runs
  strictly before the existing clone-and-rename path and adds no `gitOps.clone`/`resolveRemoteRef` call.
- Read `clone()`, `fetch()`, and `resolveRemoteRef()` in `platform/git.ts` directly (unchanged since the
  prior verification's full read): all three still pass `opts.url` verbatim into
  `git.clone`/`git.fetch`/`git.listServerRefs`, threaded through the same module-private,
  redirect-following `HttpClient` the prior verification traced in full (`sendHop`/`redirectLocation`,
  triggered only on 3xx+`Location`, never on 4xx/5xx or a URL-shape heuristic). No diff touches this
  code path.
- Ran every phase-2-relevant suite directly in this session (not reused from any prior run):
  `tests/domain/source.test.ts tests/domain/clone-key.test.ts tests/orchestrators/marketplace/add.test.ts
  tests/orchestrators/plugin/clone-cache.test.ts tests/platform/git.test.ts` → 369/369 pass, 0 failures.
- Confirmed `npm run check` ran to completion at the current HEAD's code with `CHECK_EXIT=0`, from the
  saved log at `/tmp/claude-1000/.../scratchpad/check.log` (this verifier did not re-run the suite, per
  the parallel-sibling-verifier instruction): 7396/7396 unit tests, 100.00/100.00/100.00
  lines/functions/branches over `extensions/**`, 36/36 integration, `lint:type-members` 4 recorded
  exceptions (unchanged from the prior verification) / 7 of 7 negative controls passed, `fallow` all 4
  sub-gates exit 0 (log's `fallow dupes` red glyph confirmed non-blocking via the recorded
  `CHECK_EXIT=0`, not the glyph).
- Confirmed the code tree is unchanged since the log's `npm run check` run: `git diff --stat
  add75890..HEAD -- extensions tests scripts package.json` is EMPTY (the one commit after `add75890`,
  `2ffb5fcb`, is docs-only). `add75890` is the last code commit in the log, so `CHECK_EXIT=0` covers the
  current HEAD's actual code.
- Confirmed `scripts/check-unused-type-members.contracts.json` still holds 108 entries and no pin
  naming `domain/source.ts` or `domain/clone-key.ts` (unchanged from the prior verification).
- Confirmed zero stale test titles (`grep -rn "keeps a path slash" tests/` → 0 hits) and zero debt
  markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) in either of the two changed production
  files (`domain/source.ts`, `platform/git.ts`).
- Confirmed no docstring under `extensions/` states the inverse of D-2-02
  (`grep -rn "does not resolve against a host that serves ONLY" extensions/` still returns only the
  correct D-2-02-matching direction).
- Read `02-UAT.md`: unchanged, still `status: complete`, 1/1 pass, the live smart-HTTP round trip closed
  2026-09-28 — no diff to this file since the prior verification.
- Read the new `02-SECURITY.md` (did not exist at the prior verification): `status: verified`,
  `threats_open: 0`, 11 threats registered and closed, including T-2-10 (this quick task's own fix,
  registered from audit finding W-1 and disposed "mitigate...closed") and a documented, explicitly
  non-phase-2 backlog note (`gitSubdirObjectSource` has no scheme gate — pre-existing, `git-subdir`
  kind, out of this phase's `url`-kind scope). Nothing in it names an open Phase 2 gap.
- Confirmed REQUIREMENTS.md still marks MURL-08 and MURL-09 `Complete` and ROADMAP.md's Phase 2 entry
  is still `[x]` with its 5 success criteria matching the prior verification's read (unchanged since
  `ab72dba0`).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `marketplace add` of a `url` source sends the URL the user typed, with trailing slashes and `#<ref>` stripped and the `.git` decision left exactly as typed, against a git port that admits ONLY the verbatim form (MURL-08, D-2-01). | ✓ VERIFIED | `networkCloneUrl`'s `url` arm unchanged (`clone-key.ts`, no diff since `ab72dba0`); 369/369 relevant tests pass, run directly this session; carried forward: the live-server evidence in `02-UAT.md` (unchanged, still complete). |
| 2 | A `github` source still sends `https://github.com/<owner>/<repo>.git`, byte-identical to today (SC4). | ✓ VERIFIED | `networkCloneUrl`'s `github` arm unchanged; no diff in `clone-key.ts` since `ab72dba0`. Carried forward unchanged. |
| 3 | A `url` source whose typed input ended in `.git` still sends `.git`, deriving from `source.raw` not the parse-time-stripped `source.url` (SC4, D-2-03). | ✓ VERIFIED | `tests/domain/clone-key.test.ts`'s `networkCloneUrl` block (unchanged since `ab72dba0`), run directly this session, still asserts the raw-ends-`.git`-while-url-does-not case by exact string. The new T-2-10 gate in `urlObjectSource` does not touch this code path (it constrains which OBJECT-form sources are admitted, not what `networkCloneUrl` reads off an admitted one), and the fixed-point admission case added by 260928-tt9 confirms a `.git`-suffixed `raw` differing from `url` only by decoration is still admitted. |
| 4 | `canonicalCloneUrl` returns the same string for every source kind as before this plan, with the sanctioned D-2-05 trailing-slash-before-`#<ref>` exception as a fixed point (SC4, D-2-05). | ✓ VERIFIED | `canonicalCloneUrl` (`clone-key.ts`) unchanged since `ab72dba0`; not touched by either commit this re-verification round covers. |
| 5 | `marketplace add` makes exactly ONE clone attempt per operation on both the success and failure path, URL asserted by value (MURL-09, SC3, D-2-04). | ✓ VERIFIED | Same 3 MURL-09 fake-port cases pass (404, 401, D-2-02 suffix-only refusal), each asserting `state.cloneCalls.length === 1` plus the exact URL string, re-run directly this session as part of 369/369. `recognizeLeftover`'s use of the rewritten `listRemotes` sits strictly before the clone-and-rename path and adds no `gitOps.clone`/`resolveRemoteRef` call — confirmed by reading `orchestrators/marketplace/add.ts` (unchanged since `ab72dba0`). |
| 6 | A 401/403/404/5xx from the clone keeps its original error identity and message through the add seam (SC2). | ✓ VERIFIED | Same cases assert `err === cloneThrows` by reference plus `.message`/`.code`/`.data.statusCode`; `handleAddFailure` unchanged since `ab72dba0`. |
| 7 | `networkCloneUrl` is a pure function of `source` — no process/fs/network state (MURL-08 concurrency edge). | ✓ VERIFIED | Read directly: unchanged 3-arm switch over pure string ops; no diff since `ab72dba0`. |
| 8 | Exactly-one-attempt is per OPERATION, not per process (MURL-09 concurrency edge). | ✓ VERIFIED | `state.cloneCalls`/`resolveRemoteRefCalls` remain per-fixture-instance arrays; unchanged fake, unchanged tests, all pass. |
| 9 | CR-02's https-only scheme gate rejects through BOTH the `url` and `raw` object fields, and D-2-05's slash normalization does NOT widen what a `github` url accepts (D-76-01, D-2-05 scope boundary). | ✓ VERIFIED | Re-read `urlObjectSource` in full at HEAD (not carried forward — this function DID change): the scheme gate on both fields (lines 199-221) is structurally unchanged and still returns on either field's rejection BEFORE the new T-2-10 identity check can run; `stripUrlDecorations`/`stripGitHubUrlDecorations` remain the two undisturbed compositions. The new T-2-10 arm is a further, narrower rejection (raw must ALSO name the same repository as url) — it cannot widen acceptance, only narrow it, and 5 new test rows (4 reject, 1 admit-by-decoration) in `tests/domain/source.test.ts` prove both directions non-vacuously (RED against the unfixed parser per the quick-task SUMMARY, GREEN now). |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified).

### Roadmap Success Criteria Cross-Check

| SC | Text | Status |
|----|------|--------|
| SC1 | verbatim-path `clone` AND `resolveRemoteRef` both resolve | ✓ — unchanged code path (`clone`/`fetch`/`resolveRemoteRef` in `platform/git.ts` untouched by this round's diff); carried-forward live-server evidence (`02-UAT.md`, unchanged). |
| SC2 | 401/403/404/5xx keeps original error identity | ✓ — truth 6 above; unchanged code, all tests pass. |
| SC3 | exactly ONE network attempt per operation, both paths, no status-gated retry | ✓ — truth 5 above; the `listRemotes` rewrite is local-FS-only and sits before, not inside, the clone call; no new attempt is introduced. |
| SC4 | `.git` only where Claude Code appends it; `canonicalCloneUrl` unchanged | ✓ with the D-2-05 sanctioned exception, unchanged since `ab72dba0`. |
| SC5 | `npm run check` green, 100% on every new arm, `test:corresponding` | ✓ — saved log confirms `CHECK_EXIT=0` at the last code commit (`add75890`), and the working tree's code is byte-identical to that commit (`git diff --stat add75890..HEAD -- extensions tests scripts package.json` empty): 7396/7396 unit tests, 100% coverage on `extensions/**`, 36/36 integration. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/source.ts` | `stripUrlDecorations`/`stripGitHubUrlDecorations` remain separate compositions per D-2-05; `urlObjectSource`'s scheme gate on both `url`/`raw` fields is intact | ✓ VERIFIED | Read in full at HEAD. The T-2-10 identity check is additive and sits after the existing gates; no composition was merged or widened. |
| `extensions/pi-claude-marketplace/domain/clone-key.ts` | `networkCloneUrl(source)`, 3-arm switch, no `default` | ✓ VERIFIED | Byte-identical since `ab72dba0` (empty diff). |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | seam wired to `networkCloneUrl`; `recognizeLeftover` does not add a clone attempt | ✓ VERIFIED | Byte-identical since `ab72dba0` (empty diff) — the `listRemotes` rewrite lives entirely inside `platform/git.ts`; `add.ts`'s own code is untouched this round. |
| `extensions/pi-claude-marketplace/platform/git.ts` | `clone`/`fetch`/`resolveRemoteRef` still send `opts.url` verbatim as the first request | ✓ VERIFIED | Read in full; the only diff this round is inside `listRemotes` (Phase 3's local-FS-only leftover probe); the three MURL-08/09 functions are untouched. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `networkUrl: string` required (×2), disk key still hashes `cloneUrl` | ✓ VERIFIED | No diff since `ab72dba0`. |
| `scripts/check-unused-type-members.contracts.json` | 108 entries, 4 recorded exceptions, no pin on the two changed domain files | ✓ VERIFIED | Unchanged since `ab72dba0` per the quick-task SUMMARY's own scope-fence check, independently spot-confirmed. |
| `.planning/.../02-UAT.md` | closes the one carried-forward human-verification item | ✓ VERIFIED | Unchanged since `ab72dba0`: `status: complete`, 1/1 pass. |
| `.planning/.../02-SECURITY.md` (new this round) | Registers and disposes T-2-10 | ✓ VERIFIED | `threats_open: 0`, T-2-10 disposed "mitigate...closed", citing the exact fix commit `1cc96c97` and the 5 new test rows. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `networkCloneUrl`'s github arm | `ensureGitSuffix` | function call | ✓ WIRED | Unchanged since `ab72dba0`. |
| `stripUrlDecorations` / `stripGitHubUrlDecorations` | shared leaf primitives only, no shared composition | function structure | ✓ WIRED (deliberately decoupled) | Unchanged; the T-2-10 gate calls `gatedUrlField` (which itself calls these) on the `raw` field the same way it already did on `url` — no new shared composition introduced. |
| `add.ts` / `clone-cache.ts` seams | `networkCloneUrl(source)` | clone/resolveRemoteRef call `url`/`networkUrl` field | ✓ WIRED | Unchanged; re-confirmed passing via this session's direct test runs. |
| `platform/git.ts`'s `clone`/`fetch`/`resolveRemoteRef` | the module-private `http` client | `git.clone({ http, ... })` etc. | ✓ WIRED | Read directly; unchanged this round. |
| `orchestrators/marketplace/add.ts::recognizeLeftover` | `gitOps.listRemotes` (rewritten this round, still local FS only) | new `GitOps` 8th member | ✓ WIRED, and confirmed NOT a network call | Read `platform/git.ts::listRemotes` directly at HEAD: `fs.promises.readFile` + `git.getConfigAll({ fs, dir, path })`, no `http`/`git.clone`/`git.fetch`/`git.listServerRefs` reference anywhere in the function. |

### Data-Flow Trace (Level 4)

`networkCloneUrl(source)` → `gitOps.clone({ url: ... })` / `gitOps.resolveRemoteRef({ url: ... })`:
unchanged code path this round; traced end-to-end through the real edge handler in
`tests/edge/handlers/marketplace/add.test.ts` (not re-run this session — file unchanged since
`ab72dba0` and covered by the saved `npm run check` log's 7396/7396) and through the real transport in
`02-UAT.md`'s live run (unchanged, carried forward). Status: ✓ FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-2-relevant suites (source, clone-key, marketplace/add, clone-cache, platform/git) | `node --experimental-strip-types --test tests/domain/source.test.ts tests/domain/clone-key.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/plugin/clone-cache.test.ts tests/platform/git.test.ts` | 369/369 pass | ✓ PASS |
| `npm run check` (saved log, this verifier did not re-run — parallel-sibling-verifier instruction) | log at `/tmp/claude-1000/.../scratchpad/check.log`, `CHECK_EXIT=0` | typecheck, lint, lint:workflows(+neg), fallow (4 sub-gates), format:check, test:corresponding(+neg), test:coverage:direct:negative, test:coverage:unit (7396/7396, 100.00/100.00/100.00 over `extensions/**`), test:integration (36/36), lint:type-members (4 exceptions) + negative (7/7) | ✓ PASS |
| Code-tree-unchanged-since-log check | `git diff --stat add75890..HEAD -- extensions tests scripts package.json` | empty | ✓ PASS |
| Live smart-HTTP round trip (real server, real transport, carried forward) | `02-UAT.md` test 1 — pi RPC mode against a local instrumented HTTPS server | 1/1 pass — verbatim-only wire traffic confirmed for add AND update, controls fail as themselves | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MURL-08 | 01, 02, 03 | verbatim-URL smart-HTTP endpoint resolves clone + resolveRemoteRef | ✓ SATISFIED | Truths 1-4, 7, 9; carried-forward live evidence (`02-UAT.md`); REQUIREMENTS.md marks Complete (re-confirmed this session). |
| MURL-09 | 01, 02, 03 | sent URL == typed URL modulo decoration; exactly one attempt, no status-gated retry | ✓ SATISFIED | Truths 5, 6, 8; REQUIREMENTS.md marks Complete (re-confirmed this session). |

No orphaned requirements: `grep -n "Phase 2" REQUIREMENTS.md` maps only MURL-08/MURL-09 to this
phase, and both appear in all three plans' `requirements:` frontmatter.

### Prohibitions

| # | Statement | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No test case may keep a name/title/comment promising the pre-phase `.git`-for-every-host rule while asserting the verbatim rule, or the reverse (all 3 plans). | ✓ HOLDS | `grep -rn "keeps a path slash" tests/` → 0 hits this session. |
| 2 | A source that stops working under the accepted D-2-02 regression must fail with the URL that was actually sent named in the failure. | ✓ HOLDS | Unchanged; the D-2-02 fixture case still passes with `rawSource` named in the failure. |
| 3 (02-02) | A pass-through wire-URL test must not merely re-assert the caller's own value; `networkUrl` must DIFFER from `cloneUrl` in at least one assertion. | ✓ HOLDS | `clone-cache.ts` unchanged since `ab72dba0`. |
| 4 (02-03) | No remote allowlist anywhere admits BOTH the verbatim and the `.git`-suffixed form of the same URL for a `url`-kind source. | ✓ HOLDS | `tests/integration/marketplace-add-seed-mirrors.test.ts` unchanged since `ab72dba0`; still admits a single form. |
| 5 (02-03) | No docstring in `extensions/` still states the inverse of D-2-02. | ✓ HOLDS | `grep -rn "does not resolve against a host that serves ONLY" extensions/` returns only the correct (D-2-02-matching) direction this session. |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in either of the two production files
that changed this round (`domain/source.ts`, `platform/git.ts`) — checked directly with `grep`. No
regression: neither file was previously flagged and both remain clean.

No stale-rule test titles (see Prohibitions #1 above). No inverse-D-2-02 docstring (Prohibitions #5).

**02-SECURITY.md non-blocking note carried into this report:** the security audit trail records one
pre-existing, out-of-phase-scope backlog item — `gitSubdirObjectSource` (the `git-subdir` kind, not
`url`) has no `https://`-only scheme gate, so it would accept an `http://` URL (no credential is
offered because `onAuth` requires `https:`, so the practical exposure is limited to an unauthenticated
plaintext clone attempt). This is explicitly disposed as pre-existing and out of this phase's scope
(Phase 2 covers the `url` kind) in `02-SECURITY.md`'s own audit note — not a Phase 2 regression, not
a new-scope finding introduced by this re-verification round, and not tied to any file this phase's
`covered_files` list names. Recorded here for visibility; does not affect this phase's status.

### Coincidental Reliance

None flagged. The T-2-10 gate's evidence (truth 9) is derived from directly reading the control flow
of `urlObjectSource` at HEAD and from 5 new, non-vacuous test rows (4 reject, 1 admit) whose RED/GREEN
transition the quick-task SUMMARY records and this session independently re-ran GREEN — not a
fixture-only precondition or an incidental ordering the production code does not itself establish. All
other truths carry forward the prior verification's own coincidental-reliance analysis (none flagged
there either), re-confirmed against unchanged code.

### Human Verification Required

None. The one item carried forward from two verifications ago (the live smart-HTTP endpoint canary,
MURL-08) remains closed — see `02-UAT.md` (status: complete, 1/1 pass, unchanged this round).

### Gaps Summary

None. All 9 must-have truths verified, all 5 ROADMAP success criteria hold, all 5 plan prohibitions
hold, no debt markers in either file this round's diff touched, no orphaned requirements, `npm run
check` green at `CHECK_EXIT=0` against a code tree confirmed byte-identical to the log's run (7396/7396
unit tests, 100% coverage on `extensions/**`, 36/36 integration), and the security audit's T-2-10
finding (the reason this re-verification was requested) is confirmed fixed, tested non-vacuously, and
disposed closed in `02-SECURITY.md`. Status stays `passed`.

---

_Verified: 2026-09-29T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
