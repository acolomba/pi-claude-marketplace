---
phase: 01-private-repos-on-any-git-host
plan: 02
subsystem: auth
tags: [git, credential-helper, isomorphic-git, security, typescript]

requires:
  - phase: 01-01
    provides: buildAuthForHost returns a bundle for every https host, which is what widened the surface this plan bounds
provides:
  - buildAuthCallbacks.onAuth cancels when the URL's host differs from the bundle's bound host, before credentialOps.fill is called
  - onAuth's url parameter is load-bearing and named url
  - installRemoteTransport serves a caller-chosen origin, so a platform test can drive a second host
  - requestsCarryingAuthorization, the by-value negative assertion for a credential header on a recorded request
affects: [01-03 plugin and edge surface realignment]

actuals:
  tokens: 4069
  tasks: 2
  commits: 2
  plan_head_before: 33771044cf2a09f06538c7e207470c0158c13f7e

tech-stack:
  added: []
  patterns:
    - "A refusal guard sits inside the pre-existing catch rather than pre-validating its input, so one catch produces one cancel shape."
    - "A security negative is asserted by value: a helper names the requests that carried the header, and the test asserts that list is empty."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - tests/platform/git-auth-callbacks.test.ts
    - tests/platform/git.test.ts

key-decisions:
  - "Mismatch debug line: `onAuth: url host ${requestedHost} does not match the bound host ${opts.host}` — two parsed hosts, no raw URL, no credential field (AUTH-09)."
  - "installRemoteTransport gained an optional `remoteUrl` rather than a parallel fake; the recorded-request shape is unchanged, so expectedPublicRequests still composes for the second host."
  - "The unparseable-URL cancel reuses the CP-10 catch and its existing `onAuth threw for ${host}: Invalid URL` message rather than getting a message of its own."

patterns-established:
  - "Compare-before-lookup: a host guard runs ahead of the credential query, so a foreign URL causes no helper subprocess at all."

requirements-completed: [GAUTH-06]

coverage:
  - id: D1
    description: "onAuth refuses a URL whose host differs from the bundle's bound host, and refuses before the credential helper is queried"
    requirement: GAUTH-06
    verification:
      - kind: unit
        ref: "tests/platform/git-auth-callbacks.test.ts#cancels for a url on another host without querying the helper"
        status: pass
      - kind: unit
        ref: "tests/platform/git-auth-callbacks.test.ts#cancels a host mismatch before any interactive auth can start"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#cancels a challenge from a url on another host without querying the helper"
        status: pass
    human_judgment: false
  - id: D2
    description: "The port participates in the compare on both sides, and the default https port normalizes away on both"
    requirement: GAUTH-06
    verification:
      - kind: unit
        ref: "tests/platform/git-auth-callbacks.test.ts#treats a port-bearing bound host as different from the portless url host"
        status: pass
      - kind: unit
        ref: "tests/platform/git-auth-callbacks.test.ts#treats a port-bearing url host as different from the portless bound host"
        status: pass
      - kind: unit
        ref: "tests/platform/git-auth-callbacks.test.ts#matches a url carrying the default https port against a portless bound host"
        status: pass
    human_judgment: false
  - id: D3
    description: "An unparseable URL produces a cancel, not a raw throw reaching isomorphic-git (CP-10)"
    requirement: GAUTH-06
    verification:
      - kind: unit
        ref: "tests/platform/git-auth-callbacks.test.ts#cancels and logs when the url cannot be parsed"
        status: pass
    human_judgment: false
  - id: D4
    description: "At the transport, a cancel surfaces as UserCanceledError and the recorded request carries no Authorization header"
    verification:
      - kind: unit
        ref: "tests/platform/git.test.ts#cancels a challenge the bundle cannot answer and sends no credential"
        status: pass
      - kind: unit
        ref: "tests/platform/git.test.ts#cancels a challenge from a url on another host without querying the helper"
        status: pass
    human_judgment: false
  - id: D5
    description: "The guard holds against a real caller-side mismatch in the operator's own environment — a bundle built for one host and a clone driven at another, against real remotes"
    verification: []
    human_judgment: true
    rationale: "Every case here drives injected fakes and a mocked isomorphic-git http transport. No case reaches a real `git credential` subprocess or a real remote. Proving no credential leaves the machine on a real mismatch needs a human with a credential and a network capture."

duration: 22min
completed: 2026-09-26
status: complete
---

# Phase 01 Plan 02: the host binding becomes real — wave 2 Summary

**`onAuth` now compares `new URL(url).host` against the bundle's bound host and cancels on a difference before the credential helper is ever queried, replacing the two-host cap that wave 1 removed with the check the cap was standing in for.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-26T03:32:00Z
- **Completed:** 2026-09-26T03:54:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `onAuth`'s parameter is `url`, not `_url`, and the compare reads it (D-1-03). `grep -c "_url: string"` over the module prints `1` — only `onAuthFailure` keeps the unused parameter, and the docstring now says in one line why that asymmetry is deliberate.
- The compare is the first statement inside the existing `try`, ahead of `opts.credentialOps.fill`. A foreign URL therefore produces **no helper query at all**: `credentialOps.calls` deep-equals `{ fill: [], approve: [], reject: [] }` at both the factory and the transport.
- `new URL(url)` throwing lands in the pre-existing CP-10 catch. No second try/catch, no pre-validation, one cancel shape. Asserted directly rather than inferred.
- The port is part of the compare on both sides, and `:443` against a portless bound host still matches — three cases pin the symmetry instead of assuming `URL.host` normalizes the same way on each side.
- `tests/platform/git.test.ts` had `grep -c cancel` = 0 before this plan. It now carries the two cancel-path cases the phase's failure story rests on: isomorphic-git turns a cancel into `UserCanceledError` (the identity wave 1's `classifyGitTransportFailure` guard matches), and a host-mismatched bundle produces a request list with no `Authorization` header on any entry.

## Task Commits

1. **Task 1 (tdd): onAuth cancels for a URL that is not the bundle's host** — `c55a7466` (feat)
2. **Task 2: prove at the transport that a cancel refuses and sends nothing** — `7780742f` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` — `onAuth(_url)` → `onAuth(url)`; the host compare and a third `hookDebugLog` call site; the `Behavior` list gains the compare as step one; the `Discipline` section gains the scoping rationale and the `onAuthFailure` asymmetry note; a `@see GAUTH-06` line
- `tests/platform/git-auth-callbacks.test.ts` — `OTHER_HOST` / `OTHER_REMOTE_URL` constants and six new cases (mismatch with a held credential, mismatch with a throwing `onAuthRequired`, two port-mismatch pairings, the `:443` match, the unparseable URL). No existing case changed.
- `tests/platform/git.test.ts` — `OTHER_HOST` / `OTHER_REMOTE_URL`; `installRemoteTransport` takes an optional `remoteUrl`; `isUserCanceledError` and `requestsCarryingAuthorization` helpers; two cancel-path cases

## Decisions Made

**The mismatch debug message.**

```
onAuth: url host ${requestedHost} does not match the bound host ${opts.host}
```

Rendered with the `"auth"` channel, so the captured line is `[auth] onAuth: url host other.example.invalid does not match the bound host git.example.invalid`. It follows the shape of the two existing non-success lines in the module (`onAuth: Device Flow failed for …`, `onAuth threw for …`). It interpolates the two **parsed** `.host` values and never the raw `url`, because a userinfo-bearing URL would otherwise put a secret in a log line (AUTH-09). `tests/architecture/no-credential-leak.test.ts` exits 0 against it.

**`installRemoteTransport` did need extending** — the plan asked this be recorded. It was keyed to `REMOTE_URL` in three places (the info/refs URL, the upload-pack URL, and the unplanned-request throw). It now takes `options.remoteUrl`, defaulting to `REMOTE_URL`, so a single fake serves either host. The recorded-request shape is untouched, and the mismatch case composes its expectation as `{ ...expectedPublicRequests()[0], url: <other host's info/refs> }` — the existing helper still carries the headers and body.

**The unparseable-URL case reuses the CP-10 message.** `new URL("not a url")` throws a `TypeError` whose message is `Invalid URL`, so the captured line is `[auth] onAuth threw for git.example.invalid: Invalid URL`. Giving the parse failure its own message would have meant lifting it out of the shared catch, which is exactly what the plan forbade.

**The transport negative is asserted by value, not by omission.** `requestsCarryingAuthorization(requests)` returns the urls of recorded requests carrying an `Authorization` key, and the cases assert that list deep-equals `[]`. A bare "the expected request list happens not to mention Authorization" would keep passing if the expectation drifted; this one names the thing being denied.

## Deviations from Plan

**None.** Both tasks executed as written. No auto-fix was needed and no architectural question arose.

Wave 1's carry-forward #1 (run `npm run lint` as a gate, early) was honored: lint, format and typecheck were run after Task 1 before its commit, and again after Task 2. Both runs exited 0 with no edit required — the conditional-spread class of lint failure wave 1 hit does not recur here, because this plan changes no nullability.

## Things the plan did not predict

**1. `tests/platform/git.test.ts` already imports from `orchestrators/`.** Task 2's acceptance criterion says the file "contains no import from `extensions/pi-claude-marketplace/orchestrators/`". It has one, at line 24, and it predates this plan:

```ts
import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
```

It is `import type`, which `tests/architecture/import-boundaries.test.ts` permits (that gate polices value imports), and the file is a **test**, not a platform module. The criterion's stated intent in the task body is narrower and was met: no orchestrator module — `auth-host.ts` in particular — was imported for this work, and both new cases build their bundle as a plain `{ credentialOps, host, onAuthRequired }` literal. `node --test tests/architecture/import-boundaries.test.ts` exits 0. Recorded because the criterion as literally worded does not hold and never did.

**2. Case A's `UserCanceledError` assertion is load-bearing in a second way.** If `onAuth` were not invoked at all, isomorphic-git's `discover` would leave `tryAgain` false and surface an `HttpError` for the 401 instead. So `code === "UserCanceledError"` does not merely name the identity — it proves the callback ran and refused. That makes the mismatch case a real negative rather than a case that would pass with the guard removed and auth never wired.

## Gate results (real exit codes)

Every exit code below was captured into a variable on its own line, never from `$?` after a compound command.

| Gate | Command | Exit |
|---|---|---|
| Task 1 RED | `node --test tests/platform/git-auth-callbacks.test.ts` | 1 — 5 new cases failing at the **assertion** level (a stored credential returned where `{ cancel: true }` was expected), not at compile level |
| Task 1 GREEN | `node --test tests/platform/git-auth-callbacks.test.ts tests/architecture/no-credential-leak.test.ts` | 0 |
| Task 1 direct coverage | `npm run test:coverage:direct -- …/platform/git-auth-callbacks.ts` | 0 — branches 14/14, functions 3/3, lines 215/215 |
| Task 2 focused | `node --test tests/platform/git.test.ts` | 0 (31 pass, 0 fail) |
| Task 2 focused, four files | `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/architecture/import-boundaries.test.ts tests/architecture/no-credential-leak.test.ts` | 0 (65 pass, 0 fail) |
| Typecheck | `npx tsc --noEmit` | 0 (run twice — after each task) |
| Lint | `npm run lint` | 0 (run twice — after each task) |
| Format | `npm run format:check` | 0 (run twice — after each task) |
| Type members | `npm run lint:type-members` | 0 (4 pre-existing recorded exceptions, unchanged) |
| Corresponding tests | `npm run test:corresponding` | 0 |
| fallow | `npm run fallow` | **0** — `FALLOW_EXIT=0` read from its own line. It prints `✗ 1,327 lines (1.4%) duplicated across 52 files`, the same pre-existing report line wave 1 recorded; the glyph is not the verdict. |
| Unit suite + coverage | `npm run test:coverage:unit` | 1 — **by design**, 7261 tests / 7241 pass / 20 fail. No `does not meet threshold` line. `platform/git-auth-callbacks.ts` shows `100.00 \| 100.00 \| 100.00` with an empty uncovered-lines cell. |

## Failing-test count against wave 1's 20

**20, unchanged, in the same seven files with the same per-file distribution.** Nothing was added to plan 03's list.

| File | Wave 1 | Now |
|---|---|---|
| `tests/edge/handlers/marketplace/add.test.ts` | 6 | 6 |
| `tests/edge/handlers/marketplace/update.test.ts` | 6 | 6 |
| `tests/orchestrators/plugin/fetch.test.ts` | 4 | 4 |
| `tests/orchestrators/plugin/install-clone-probe.test.ts` | 1 | 1 |
| `tests/orchestrators/plugin/install-flow.test.ts` | 1 | 1 |
| `tests/orchestrators/plugin/reinstall-clone-probe.test.ts` | 1 | 1 |
| `tests/orchestrators/plugin/reinstall-flow.test.ts` | 1 | 1 |

The total test count rose from 7253 to 7261 — the eight cases this plan added, all passing.

Wave 1's note that "every `onAuth(url)` call added to the test tree uses a URL whose host equals the bundle's bound host" held: no previously-green case went red under the new compare.

## Known Stubs

None. No placeholder value, empty-literal data source, or TODO/FIXME marker was introduced.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 03** (plugin + edge realignment) is unblocked and starts from the same measured 20-failure list wave 1 recorded — this plan neither shortened nor lengthened it.
- The mitigation the ROADMAP required inside this phase (GAUTH-06) is landed. The `undefined`-for-no-provider cap wave 1 removed is now replaced by a direct compare, proven at the factory and at the transport.
- The tree stays intentionally RED at the whole-suite level until plan 03. Every other gate is green.
- One human-judgment item (D5) carries forward: proving the guard against a real remote and a real `git credential` helper. It joins wave 1's D4, which is the same shape.

## Self-Check: PASSED

All three modified files exist on disk. Both commit hashes (`c55a7466`, `7780742f`) resolve in `git log`.

---
*Phase: 01-private-repos-on-any-git-host*
*Completed: 2026-09-26*
