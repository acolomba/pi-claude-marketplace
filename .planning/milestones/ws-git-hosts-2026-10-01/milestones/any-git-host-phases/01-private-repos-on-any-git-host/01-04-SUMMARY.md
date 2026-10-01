---
phase: 01-private-repos-on-any-git-host
plan: 04
subsystem: auth
tags: [isomorphic-git, simple-get, redirects, credentials, GAUTH-06]
gap_closure: true
gap_ids: [G-01-4]

requires:
  - phase: 01-private-repos-on-any-git-host
    provides: "01-02 host-bound onAuth compare (D2 URL.host normalization) and 01-03 auth bundles on every host"
provides:
  - "Module-private HttpClient in platform/git.ts that follows redirects itself and drops authorization/cookie on any hop whose URL.origin differs from the original request"
  - "Wire-level test double (node:https + node:http request) that runs the real simple-get, isomorphic-git/http/node and isomorphic-git"
  - "Corrected GAUTH-06 docstrings, requirement amendment and Phase 1 success criterion 4"
affects: [git transport, auth-host, GAUTH-06, UAT test 4]

actuals:
  tokens: 7146
  tasks: 3
  commits: 2
plan_head_before: 5958ee30db645c8a9371cdd3848d0f0f0ca70743
plan_head_after: c9c21446ba1352971251c06f1cc8a1b640b35003

tech-stack:
  added: []
  patterns:
    - "Transport redirect policy lives in the extension's own HttpClient; simple-get runs with followRedirects: false"
    - "Wire doubles replace only node:https/node:http request so the real simple-get is under test"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - tests/platform/git.test.ts
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - .planning/workstreams/git-hosts/REQUIREMENTS.md
    - .planning/workstreams/git-hosts/ROADMAP.md

key-decisions:
  - "DD-1: platform/git.ts wraps isomorphic-git/http/node in a module-private client that sends each hop with followRedirects: false and follows 3xx itself, comparing URL.origin with the original request"
  - "DD-2: a cross-origin redirect is followed without the credential, not refused (parity with git over libcurl, CVE-2022-27776); a target that asks for credentials fails clean as UserCanceledError -> {authentication required}"
  - "DD-4: redirect cap, missing Location and POST 301/302 -> GET follow simple-get; a 307/308 keeps its body"
  - "nextHop drops the body by destructuring it out and re-adding it with the file's conditional-spread idiom, because sonarjs/no-unused-vars rejects the `_body` rest pattern"

patterns-established:
  - "Redirect credential rule: compare URL.origin of each hop with the original request; each hop starts from the previous one, so a dropped header stays dropped"

requirements-completed: [GAUTH-06]

coverage:
  - id: D1
    description: "No credential reaches another origin through a redirect: port change (clone, fetch, resolveRemoteRef), http: on the same hostname, and another hostname"
    requirement: GAUTH-06
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#clone GAUTH-06: does not forward the credential on a redirect to another port of the same host"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#fetch GAUTH-06: does not forward the credential on a redirect to another port of the same host"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#resolveRemoteRef GAUTH-06: does not forward the credential on a redirect to ${kind} (3 rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A redirect inside the origin keeps the credential and resolves HEAD: another path, a relative Location, an explicit :443"
    requirement: GAUTH-06
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#resolveRemoteRef GAUTH-06: forwards the credential on a redirect within its origin (${kind}) (3 rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Redirect semantics: POST 302 -> GET without body or content-*, POST 307 keeps its body, 3xx without Location reaches isomorphic-git as HttpError 302, eleventh redirect rejects with too many redirects after 11 requests"
    requirement: GAUTH-06
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#re-sends a POST answered with 302 as a GET without its body"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#re-sends a POST answered with 307 with its body"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#returns a redirect without a Location header to isomorphic-git as an HttpError"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#rejects an eleventh consecutive redirect with too many redirects"
        status: pass
    human_judgment: false
  - id: D4
    description: "Docstrings and requirement text name the redirect guard in platform/git.ts instead of crediting simple-get"
    requirement: GAUTH-06
    verification:
      - kind: other
        ref: "grep -c 'cross-host redirect;' git-auth-callbacks.ts auth-host.ts -> 0/0; grep -c 'follows redirects itself' -> 1/1; REQUIREMENTS 'Amended during Phase 1 gap closure' -> 1; ROADMAP 'already drops' -> 0, 'compares the hostname only' -> 1; grep -rn G-01-4 extensions tests -> no lines"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live re-run of UAT test 4: the bound host 302-redirects to the same hostname on another port; the second origin receives no Authorization header and the verb fails with {authentication required}"
    requirement: GAUTH-06
    verification: []
    human_judgment: true
    rationale: "Needs the instrumented live HTTPS git server from UAT (/gsd-verify-work 1 --ws git-hosts); the plan puts this re-run out of scope for automation"

duration: 49min
completed: 2026-09-28
status: complete
---

# Phase 1 Plan 04: Redirect Credential Leak Summary

**`platform/git.ts` now follows git HTTP redirects itself and drops `authorization`/`cookie` on any hop whose `URL.origin` differs from the original request, proven at the wire through the real `simple-get` for `clone`, `fetch` and `resolveRemoteRef`.**

## Performance

- **Duration:** 49 min
- **Started:** 2026-09-28T12:35:07Z
- **Completed:** 2026-09-28T13:24:07Z
- **Tasks:** 3 (Task 3 is measurement only; it changed no file)
- **Files modified:** 6 (4 source/test, 2 planning)

## Accomplishments

- Closed G-01-4. A credential bound to `git.example.invalid` no longer reaches `:8443`, `http:` on
  the same hostname, or another hostname after a redirect. Same-origin redirects still
  authenticate.
- DD-1 (mechanism): a module-private `HttpClient` bound to the existing `http` name. Each hop goes
  through `isomorphic-git/http/node` with `fetchOptions: { followRedirects: false }`, so
  `simple-get` returns every 3xx. The client resolves `Location` against the current hop, compares
  `URL.origin` with the original request, and follows. No new export: `^export` count stays 19.
- DD-2 (decision): a cross-origin redirect is followed without the credential. That matches git
  over libcurl (CVE-2022-27776). If the target asks for credentials, the operation ends as
  `UserCanceledError`, which renders as `{authentication required}`.
- DD-4: redirect cap, missing `Location` and POST 301/302 → GET match `simple-get`. A 307/308
  re-sends its body; `simple-get` re-sends an empty one.
- Corrected every place that credited `simple-get` with stopping the leak: the
  `buildAuthCallbacks` and `buildAuthForHost` docstrings, a GAUTH-06 amendment paragraph, and
  Phase 1 success criterion 4.

## Task Commits

1. **Task 1: Reproduce the redirect leak at the wire, then make platform/git.ts follow redirects
   itself** - `96c9eb13` (fix). Test and fix are in one commit, as the plan requires.
2. **Task 2: Pin the origin normalization and correct every statement of the retired simple-get
   claim** - `c9c21446` (docs)
3. **Task 3: Measure the whole gate on the final committed tree** - no commit (`npm run format`
   rewrote nothing, and no gate needed a fix)

## RED run (Task 1, unmodified `platform/git.ts`)

`node --test tests/platform/git.test.ts` with the new cases and the old transport: exit 1,
`ℹ tests 49`, `ℹ pass 44`, `ℹ fail 5`. The five failing tests:

1. `clone` › `GAUTH-06: does not forward the credential on a redirect to another port of the same host`
2. `fetch` › `GAUTH-06: does not forward the credential on a redirect to another port of the same host`
3. `resolveRemoteRef` › `GAUTH-06: does not forward the credential on a redirect to another port of the same host`
4. `resolveRemoteRef` › `GAUTH-06: does not forward the credential on a redirect to http on the same host`
5. `resolveRemoteRef` › `re-sends a POST answered with 307 with its body`

Each of the four credential cases failed on its wire-log assertion; the rejection itself
(`UserCanceledError`) already matched. The 307 case failed on its body assertion (`Buffer(0)`
actual vs the 47-byte ls-refs body). Wire-log diff from the `resolveRemoteRef` port row:

```text
    [
      { authorization: null, url: 'https://git.example.invalid/owner/repo.git/info/refs?service=git-upload-pack' },
  ...
      {
  +     authorization: 'Basic dXNlcjpzZWNyZXQ=',
  -     authorization: null,
        url: 'https://git.example.invalid:8443/owner/repo.git/info/refs?service=git-upload-pack'
      }
    ]
```

The target origin's retry carried the bound host's `Basic dXNlcjpzZWNyZXQ=`. That is the UAT
observation, reproduced through the real `simple-get`.

## GREEN and negative controls

- GREEN (after the fix): `GIT_TEST_EXIT=0`, 49/49, counts `5`, `1`, `4`.
- After Task 2: `GIT_TEST_EXIT=0`, 51/51, counts `5`, `3`, `4`.
- Each control was run against a scratch copy of `platform/git.ts` and restored before its
  commit. `cmp` confirmed the restore each time.

| Control | Mutation | Result |
|---|---|---|
| (a) | remove `fetchOptions: { followRedirects: false }` | `ℹ fail 5`: the same five as RED |
| (b) | compare `URL.host` instead of `URL.origin` | `ℹ fail 1`: `... redirect to http on the same host` |
| (c) | drop the credential headers on every redirect | `ℹ fail 1`: `... within its origin (another path)`, rejected with `UserCanceledError` |
| (d) | `new URL(location)` with no base | `ℹ fail 1`: `... within its origin (a relative location)`, `TypeError` `ERR_INVALID_URL` |

## Gate measurements (Task 3, tree `c9c21446`)

- `FORMAT_EXIT=0`. `git status --porcelain` afterwards showed only the orchestrator's untracked
  `milestone.lock`, so nothing needed committing before measurement.
- `TYPE_MEMBERS_EXIT=0` ("Unused type member gate passed with 4 recorded exception(s)"). The two
  `git-auth-callbacks.ts` exceptions are still at `41:39` and `42:34`.
- `DIRECT_GIT_EXIT=0`: `platform/git.ts` branches 67/67, functions 17/17, lines 503/503.
- `CONTRACTS=108 EXCEPTIONS=4 PIN_ROWS=0`
- `CHECK_EXIT=0`, from one run of the whole `npm run check` on HEAD `c9c21446`, not piped.
  - `all files | 100.00 | 100.00 | 100.00 |`
  - Unit: `ℹ tests 7381`, `ℹ pass 7381`, `ℹ fail 0`, 302 suites. The baseline is 7369. It was
    recorded at `235fdc17`, and `git diff --stat 235fdc17..79884d8a -- extensions tests scripts
    package.json` is empty. So the delta is +12: the 12 new cases in `tests/platform/git.test.ts`
    (39 → 51).
  - Integration: `ℹ tests 36`, `ℹ pass 36`, `ℹ fail 0`
- `fallow audit`: `AUDIT_EXIT=0`, `"verdict":"pass"`. Attribution: `dead_code_introduced 0`,
  `complexity_introduced 0`, `duplication_introduced 0` (`duplication_inherited 3`).
- Scope fence (`git diff --name-only 79884d8a..HEAD -- ':!.planning/'`):
  - `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`
  - `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts`
  - `extensions/pi-claude-marketplace/platform/git.ts`
  - `tests/platform/git.test.ts`

  `git status --porcelain -- extensions tests scripts package.json package-lock.json` printed nothing.
- No pre-existing line of `tests/platform/git.test.ts` changed. `git diff -U0 79884d8a` shows 0
  removed lines.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts`: adds the redirect-following client and its
  helpers (`redirectLocation`, `nextHop`, `sendHop`, `requestWithinOrigin`). The three
  isomorphic-git calls still pass `http`.
- `tests/platform/git.test.ts`: adds the wire double (`installWireTransport`), the
  cross-origin/same-origin/POST servers, the seeds, and 12 cases. The file only gains lines.
- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts`: the first `Discipline`
  bullet now names the redirect guard in `platform/git.ts`. Nothing at or above line 42 changed.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`: the last paragraph of the
  `buildAuthForHost` docstring now names the same guard.
- `.planning/workstreams/git-hosts/REQUIREMENTS.md`: adds the GAUTH-06 amendment paragraph.
- `.planning/workstreams/git-hosts/ROADMAP.md`: Phase 1 criterion 4 now states the hostname-only
  compare and the transport guard.

## Decisions Made

- DD-1 and DD-2 as planned (see Accomplishments).
- Hop order in `sendHop`: the redirect body is discarded before the cap check. This is the order
  `simple-get` uses (`res.resume()`, then `maxRedirects`), so the eleventh redirect's stream is
  also released.
- REQUIREMENTS.md placement: the plan says to put the amendment "after the second GAUTH-06
  paragraph". I read that as the second indented paragraph under the bullet, so the amendment
  sits after the "What it DOES protect" paragraph, at the end of GAUTH-06. The GAUTH-05 amendment
  is placed the same way.

## Operator note: the remaining parity gap (DD-3)

After a redirect on the initial request, git asks the credential helper for the redirect TARGET's
own credential. isomorphic-git calls `onAuth` only with the original URL. So this extension
cannot authenticate a cross-origin redirect target with a credential stored for that target.
Such a target receives no credential and fails clean with `{authentication required}`: nothing
is disclosed, nothing is written to state, and a retry is safe. This is a limit of the
isomorphic-git transport, not a leak. It is recorded here and in the plan's threat register
(T-01-20), and it is not closed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `sonarjs/no-unused-vars` rejects the `_body` rest-destructure**
- **Found during:** Task 1 (ESLint verify)
- **Issue:** The plan suggested dropping the body with `const { body: _body, ...rest }`, relying
  on the `^_` pattern. `sonarjs/no-unused-vars` does not honor that pattern and reported
  `git.ts:208:17`.
- **Fix:** `nextHop` destructures `body` out once. The POST→GET branch omits it. The keep branch
  re-adds it with `...(body !== undefined && { body })`, the conditional-spread idiom the file
  already uses. Both arms are covered: GET hops have no body, and the 307 POST does.
- **Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`
- **Verification:** ESLint exit 0; direct coverage 100% (67/67 branches); tests 49/49.
- **Committed in:** `96c9eb13`

---

**Total deviations:** 1 auto-fixed (1 blocking lint rule).
**Impact on plan:** The behavior is the same. Only the way the body is dropped changed. No scope
creep.

## Issues Encountered

- The first ROADMAP rewrap split "compares the hostname only" across two lines, so Task 2's grep
  returned 0. I rewrapped it before committing, and the grep now returns 1.
- Control (a) left `grep -c followRedirects` at 1, because the JSDoc names the option. The option
  line itself was removed, and the 5-fail result confirms the control took effect.

## TDD Note

Per the plan (Task 1 step 4), the RED state was not committed. The `npm-coverage-direct`
pre-commit hook and CI both reject a deliberately red commit, so the test and the fix land
together in `96c9eb13`. The RED evidence is recorded above.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-01-4 is closed in code and tests. D5 (the live re-run of UAT test 4 against the instrumented
  server, `/gsd-verify-work 1 --ws git-hosts`) still needs a human.
- STATE.md and state.json were not touched here. The orchestrator owns those writes.

---
*Phase: 01-private-repos-on-any-git-host*
*Completed: 2026-09-28*

## Self-Check: PASSED
