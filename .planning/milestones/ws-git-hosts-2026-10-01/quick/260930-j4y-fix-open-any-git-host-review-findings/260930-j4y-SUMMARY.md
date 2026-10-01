---
phase: 260930-j4y
plan: 01
subsystem: platform/git, orchestrators/marketplace/add, domain/clone-key
tags: [security, git-transport, redirects, marketplace-add, review-findings]
status: complete
requires: []
provides:
  - "CrossOriginChallengeError: a 401/203 after a redirect left the original origin fails before isomorphic-git's auth loop (Q-02)"
  - "cross-origin hops keep only six protocol headers (WR-03)"
  - "an absent, empty or non-URL Location returns to isomorphic-git after one request (WR-04, IN-02); TooManyRedirectsError (IN-03)"
  - "marketplace add writes .git/pi-claude-marketplace.json and recognizes only a marked leftover whose origin names the source (Q-01)"
  - "originMatchesSource: parser-based origin comparison with a case-insensitive host (Q-03)"
  - "UnremovableLeftoverCloneError and the add-stale-clone-cleanup-leak advisory row (WR-02, MA-14)"
affects:
  - every clone, fetch and resolveRemoteRef through platform/git.ts's http client
  - marketplace update's cause line for a cross-origin challenge
  - marketplace add leftover recognition, including bootstrap
  - seeded plugin mirrors (they copy the marketplace .git, marker included)
tech-stack:
  added: []
  patterns:
    - "redirect chain state threaded through sendHop (origin, redirect count, leftOrigin)"
    - "header allowlist instead of denylist across origins"
    - "ownership marker written through assertPathInside + atomicWriteJson before the rename"
    - "fault fs.promises.rm with t.mock.method instead of chmod, so MA-14 cases hold under root"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/domain/clone-key.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - tests/platform/git.test.ts
    - tests/shared/errors.test.ts
    - tests/shared/git-failure-classifiers.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/domain/clone-key.test.ts
    - tests/domain/source.test.ts
    - tests/architecture/catalog-uat/fixtures/marketplace-add.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/edge/register.test.ts
    - docs/output-catalog.md
    - scripts/check-unused-type-members.contracts.json
    - CHANGELOG.md
    - .planning/BACKLOG.md
decisions:
  - "WR-03: GitCredentials.headers stays in the type; the cross-origin header allowlist is the runtime guarantee, because isomorphic-git merges auth.headers whatever the type says"
  - "Q-02: the challenge check applies to any final 401/203 once any hop of the chain left the original origin, including a hop back on the original origin after a detour"
  - "WR-04: a whitespace-only Location is treated like an empty one (location.trim() === \"\"), since the URL parser strips it to the base URL"
  - "Q-03: originMatchesSource compares WHATWG-normalized canonicalCloneUrl identities of both sides; canonicalCloneUrl and every cache key are unchanged"
metrics:
  duration: ~120min
  completed: 2026-09-30
actuals:
  tokens: 28000
  tasks: 3
  commits: 5
plan_head_before: 7ec5f7afb6f72cf819848c7233a8e00a64f1ee53
plan_head_after: 1f412768cb5284f521e6ac91448318c090775d5e
---

# Quick 260930-j4y: fix the open any-git-host review findings -- Summary

A 401 or 203 reached after a cross-origin redirect now fails typed with no credential lookup,
eviction or Device Flow; cross-origin hops keep only protocol headers; and `marketplace add` removes
only a leftover it marked, compares hosts case-insensitively, and reports a leftover it cannot remove.

**Start SHA / code-review diff base:** `7ec5f7af` (`7ec5f7afb6f72cf819848c7233a8e00a64f1ee53`).
The code commits carry no quick-task id (AGENTS.md); review them with
`git diff 7ec5f7af..1f412768`.

## Commits

| # | SHA | Title |
|---|-----|-------|
| 1 | `4f7e4f35` | fix(git): fail cross-origin challenges and tighten redirect handling |
| 2 | `727939fc` | fix(marketplace): remove only a leftover clone the extension marked |
| 3 | `0476e0f9` | fix(marketplace): report a leftover clone that cannot be removed |
| 4 | `0f31f87a` | docs: record the redirect and leftover clone fixes |
| 5 | `1f412768` | fix(test): count the new catalog state in the catalog parser test |

## RED evidence

**Task 1** (tests run against the HEAD `git.ts`, `git-failure-classifiers.ts` and `update.ts`,
with the new error classes present): 18 of 258 failed.

- update.test.ts: `Q-02: a challenge after a cross-origin redirect keeps its own cause without the stored-credential line`
- clone and fetch: `Q-02: fails a challenge from another port of the same host without a credential lookup` (x2)
- resolveRemoteRef: `Q-02: fails a challenge after a redirect to {another port of the same host, http on the same host, another host} without a credential lookup`
- `Q-02: fails a cross-origin challenge without starting a Device Flow`
- `Q-02: fails a 203 from another origin the same way as a 401`
- `Q-02: fails a challenge back on the original origin after a detour through another origin`
- `WR-03: keeps only protocol headers on a hop to another origin`
- the four `GAUTH-06: does not forward the credential on a git-upload-pack POST redirect to ...` rows
- `WR-04: returns a redirect with an empty Location ...` and `... with a Location that is not a URL ...`
- `IN-03: rejects an eleventh consecutive redirect with TooManyRedirectsError`
- `classifies a challenge after a cross-origin redirect as authentication required`

The `no Location header` row passed on RED (existing behavior, kept as a table row).

**Task 2** (unfixed `add.ts`, `clone-key.ts`, `source.ts`): 9 failures.

- clone-key.test.ts failed to load: `does not provide an export named 'originMatchesSource'`
- all four `MA-12 / Q-03: an owned leftover whose origin is ... recovers for ...` rows (the plain
  `.git` row fails on the missing marker bytes)
- `MA-13 / WR-03: a leftover without the ownership marker refuses as stale clone and stays on disk`
- `Q-01: a successful add leaves the ownership marker in the clone`
- `Q-01 / NFR-10: a staging clone whose .git is a symlink refuses the marker write`
- `IN-06: a destination that disappears before recognition reads it proceeds to the rename`

**Task 3**: first with the class absent (add.test.ts and errors.test.ts failed to load on the
missing `UnremovableLeftoverCloneError` export; the catalog contract failed `206 !== 205`), then
with the class present and HEAD `add.ts`: 4 of 92 failed.

- `MA-14 / WR-02: standalone mode names only the leftover cleanup failure when removing the leftover fails`
- `MA-14 / WR-02: standalone mode names only the leftover cleanup failure when removing the leftover and the staging clone fails`
- `MA-14: orchestrated mode carries the leftover cleanup failure in the cause`
- `MA-14: orchestrated mode joins both cleanup failures behind one Error.cause level`

## Per-finding dispositions

| Carrier | Finding | Outcome | Commit |
|---|---|---|---|
| GHRED-01 | WR-01 foreign 401 fills / evicts / starts Device Flow | fixed: `CrossOriginChallengeError` before the auth loop (Q-02); `{authentication required}`; update keeps its own cause | `4f7e4f35` |
| GHRED-01 | WR-02 POST-redirect credential rows | already fixed; rows now expect the Q-02 error, wire logs unchanged | `a2db444e` |
| GHRED-01 | WR-03 cross-origin denylist | fixed: six-name allowlist | `4f7e4f35` |
| GHRED-01 | WR-04 empty `Location` followed | fixed: returned unchanged after one request | `4f7e4f35` |
| GHRED-01 | IN-01 parity docstring | fixed: `http` JSDoc rewritten (origin rule, Q-02, parity scope, simple-get rules) | `4f7e4f35` |
| GHRED-01 | IN-02 malformed `Location` -> `TypeError` | fixed: `URL.canParse`; no error carries the `Location` | `4f7e4f35` |
| GHRED-01 | IN-03 untyped `too many redirects` | fixed: `TooManyRedirectsError`, asserted by class | `4f7e4f35` |
| GHRED-01 | IN-04 undiscriminated guard cases | fixed: cookie + `private-token` row, A->B->A row, 203 row, device-flow row | `4f7e4f35` |
| GHRED-01 | IN-05 `PostRedirectRow` inside `describe` | fixed: module scope with a doc line | `4f7e4f35` |
| GHADD-01 | WR-01 JSDoc step list | fixed | `727939fc` |
| GHADD-01 | WR-02 standalone path drops the leak | fixed: one redacted advisory line (NFR-9) | `0476e0f9` |
| GHADD-01 | WR-03 user-placed clone removed | fixed: ownership marker + origin (Q-01) | `727939fc` |
| GHADD-01 | WR-04 recognition follows a symlinked destination | wrong at HEAD: `sourceCloneDir` -> `assertPathInside` throws `SymlinkRefusedError` first; guarded by `tests/persistence/locations.test.ts`; comment added in add.ts | `727939fc` (comment) |
| GHADD-01 | WR-06 flow header | fixed | `727939fc` |
| GHADD-01 | WR-07 narrating comments | already fixed | `23cc2218`, `c1286475` |
| GHADD-01 | WR-08 five positional parameters | fixed: args object | `727939fc` |
| GHADD-01 | WR-09 two act/assert cycles per MA-14 case | fixed: four independent cases | `0476e0f9` |
| GHADD-01 | IN-01 permission tests vacuous as root | fixed: `fs.promises.rm` stub, no chmod in MA-14 (git.test.ts part already `c1286475`) | `0476e0f9` |
| GHADD-01 | IN-02 `stripGitSuffix(path)` | fixed: module-private, parameter `url` | `727939fc` |
| GHADD-01 | IN-03 MA-14 substring assertions | fixed: whole-value assertions | `0476e0f9` |
| GHADD-01 | IN-04 final-clone arm drops `leftoverLeak` | fixed: `joinLeaks(leftoverLeak, leak)` | `727939fc` |
| GHADD-01 | IN-05 case-differing host refuses | fixed: `originMatchesSource` (Q-03); owner/repo case still refuses (recorded limitation) | `727939fc` |
| GHADD-01 | IN-06 two reads of the destination | fixed: `not-a-repo` re-checks the destination and proceeds when gone | `727939fc` |
| GHADD-01 | IN-07 "X, not Y" comment in `listRemotes` | already fixed | `add75890` |
| GHADD-01 | IN-08 url-less case lacks the state assertion | fixed | `727939fc` |

## Gate results

- `npm run check`: **`CHECK_EXIT=0`** (read from the log file, second run). Unit tests 7443/7443
  pass, integration tests 36/36 pass, coverage `all files | 100.00 | 100.00 | 100.00`.
  The first run ended `CHECK_EXIT=1` on one unit failure (`catalog-parser.test.ts` pins 205 states);
  fixed in `1f412768`, then re-run green.
- `npm run lint:type-members`: passed with 4 recorded exceptions (unchanged set);
  `lint:type-members:negative` 7 of 7. The contracts pins moved twice: the four
  `orchestrators/marketplace/add.ts:577` entries became `:582` (Task 2) and then `:608` (Task 3),
  same columns (35, 52, 9). No contract entry was added.
- `npm run test:coverage:direct -- --base 7ec5f7af`: exit 0; every changed pair passed, including
  `edge/register.ts` and `orchestrators/plugin/bootstrap.ts`.
- `npx fallow audit --format json --quiet --explain --gate-marker agent`: verdict **`pass`** before
  every commit and at the end.

## WR-03 choice

`GitCredentials` keeps its `headers` member. Removing it from the type would not change what
isomorphic-git merges at runtime (`updateHeaders` does `Object.assign(headers, auth.headers)`, and
`onAuthFailure` receives `{ ...auth, headers }`), so the cross-origin allowlist in `nextHop` is the
runtime guarantee. The planted `cookie` + `private-token` row proves it.

## Accepted consequences

- T-260930-j4y-07: a hand-built tree that copies the marker file, or symlinks `.git` to an
  extension clone's `.git`, is recognized and removed. It needs deliberate construction by someone
  who can already delete `sources/`.
- Leftovers created by released versions carry no marker; they refuse as `{stale clone}` and need
  one manual delete (Q-01).
- The marker rides into seeded plugin mirrors (`seedSameRepoPluginMirrors` copies `.git`), where
  nothing reads it.
- A POST answered with 303 keeps its method, as simple-get does (documented in the `http` JSDoc,
  behavior unchanged).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three test files outside `files_modified` pinned the old behavior**
- **Found during:** Task 2 and Task 3 (and the first `npm run check`)
- **Issue:** `tests/orchestrators/plugin/bootstrap.test.ts` and `tests/edge/register.test.ts`
  snapshot the whole scope tree after a bootstrap add, which now includes
  `.git/pi-claude-marketplace.json`. `tests/architecture/catalog-uat/catalog-contract.test.ts` pins
  the state count (205) and the example byte total (26 619);
  `tests/architecture/catalog-uat/catalog-parser.test.ts` pins the state count too.
- **Fix:** added the two marker paths to both tree snapshots (Task 2 commit); raised the counts to
  206 and the byte total to 26 848 (229 bytes, the new example's length computed by hand) in the
  Task 3 commit and in the follow-up `1f412768`.
- **Consequence:** the Task 3 `<verify>` scope fence (`STRAY` check) lists these four paths; they are
  a direct effect of Q-01 and the new catalog state, not scope creep.

**2. [Rule 1 - Test expectation] `add.test.ts` D-03-INV tree snapshot**
- **Found during:** Task 2
- **Fix:** the snapshot now includes the marker directory and file.

**3. Minor wording and shape choices**
- The `http` JSDoc says a POST answered with 303/307/308 keeps its method "as simple-get does" and
  also keeps its body "where simple-get re-sends an empty one" (simple-get 4.0.1 drops the body on
  every redirect), which is more exact than the plan's wording.
- `redirectTarget` treats a whitespace-only `Location` like an empty one.
- Test support: `CrossOriginRedirectRow` (rows carry the hand-written origin),
  `import * as fs from "node:fs"` in add.test.ts (the plan said a default import; the namespace
  form matches git.test.ts and reaches the same `fs.promises` object), and a strong-mock
  `onAuthRequired` on the A->B->A row as well as on the device-flow row.
- The `stagingDir` accessor in the MA-14 arrange helper is an arrow property, to satisfy
  `@typescript-eslint/unbound-method`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All five commits exist on `features/git-hosts` (`git log 7ec5f7af..HEAD`); every message ends with
  the Co-Authored-By trailer and no subject names a milestone, phase or quick-task id.
- `grep` acceptance counts: `CrossOriginChallengeError` class 1, `TooManyRedirectsError` class 1,
  `UnremovableLeftoverCloneError extends StaleSourceCloneError` 1, `instanceof
  CrossOriginChallengeError` 1 in each of the classifier and update.ts, `export function
  originMatchesSource` 1, `originMatchesSource` in add.ts 3, `atomicWriteJson` in add.ts 2,
  `stripGitSuffix` only in domain/source.ts, `catalog-state: add-stale-clone-cleanup-leak` 1,
  BACKLOG closed headings 2.
- The tree has no uncommitted change under extensions, tests, scripts, docs, CHANGELOG.md or
  .planning/BACKLOG.md.
