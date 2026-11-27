---
phase: 05-credential-surface
plan: 01
subsystem: testing
tags: [system-git, credentials, cucumber, harness, pins]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: the ssh stand-in, the routed profile Pi with its CONNECT proxy, and the github transport scenarios that cover the ssh-key half of SG-AUTH-01
provides:
  - "Feature: Marketplace credentials (9 scenarios) and Feature: Plugin credentials (2 scenarios), pins of SG-AUTH-01/02/03 that pass with Device Flow present and must stay green after it is removed"
  - "the git host's header log (GitHostRequestHeaders, HttpsGitHost.requestHeadersSince, ScenarioWorld.requestHeadersOfLastCommand)"
  - "step: no request the git host received carries {string} (path and every header, a Basic credential decoded)"
  - "step: pi runs with github's requests routed to the git host and these environment variables: (GITHUB_TOKEN, GH_TOKEN allowed through TOKEN_VARIABLES)"
  - "the three credential-store steps in git-host.steps.ts; marketplace/device-flow.steps.ts deleted"
  - "listenOnLoopback in features/lib/github-device-flow/connect-proxy.ts"
  - "test/architecture/no-token-variable-read.test.ts"
  - "device-flow.feature reduced to the 7 scenarios that need the sign-in stand-in"
affects: [05-06, 05-12, credential surface, device flow removal]

actuals:
  tokens: 15381
  tasks: 3
  commits: 3
plan_head_before: 9debd0d921dc2bfd7ac8f25459931ea903dc07ec
plan_head_after: ad7042da26caf25a12316b5ac6bd035c366b27a6

tech-stack:
  added: []
  patterns:
    - "a request-header window beside the request window: requestHeadersSince(window) leaves GitHostRequest and requestsSince unchanged, so every existing request table keeps its three columns"
    - "a table form of the routed profile Pi step that folds each row through the same allow-list as the one-variable step"
    - "prove 'the extension deletes no credential' with a failure that never sends it (404 on another repository), because git's own store helper erases a credential a host refused with 401"

key-files:
  created:
    - features/marketplace/credentials.feature
    - features/plugin/credentials.feature
    - test/architecture/no-token-variable-read.test.ts
  modified:
    - features/lib/https-git-host/server.ts
    - test/architecture/https-git-host-server.test.ts
    - features/support/world.ts
    - features/lib/pi-rpc.ts
    - test/architecture/hermetic-git-environment.test.ts
    - features/step_definitions/git-host.steps.ts
    - features/lib/github-device-flow/server.ts
    - features/lib/github-device-flow/connect-proxy.ts
    - features/marketplace/device-flow.feature
  deleted:
    - features/step_definitions/marketplace/device-flow.steps.ts

key-decisions:
  - "The autoapply pin uses `When the user reloads pi`: the reload step talks to `this.pi`, which is the routed profile Pi once it has started, so no restart step is needed"
  - "The config steps of the autoapply pin run after the profile Pi starts, so its startup load does not apply them before the When"
  - "The no-request-carries step also decodes a Basic Authorization value, so a token sent as a git password cannot pass it"
  - "GITHUB_TOKEN and GH_TOKEN join OPTIONAL_GIT_VARIABLES in pi-rpc.ts; without that a profile variable never reaches the Pi child"

patterns-established:
  - "Token pins use plain-word values (env-github-token-value, env-gh-token-value), never a string shaped like a real token"

requirements-completed: [SG-AUTH-01, SG-AUTH-02, SG-AUTH-03]

coverage:
  - id: D1
    description: "With only GITHUB_TOKEN and GH_TOKEN set, a private url marketplace add fails as authentication required, and neither token appears in a result, a request path or header, or an ssh launch"
    requirement: SG-AUTH-01
    verification:
      - kind: e2e
        ref: "features/marketplace/credentials.feature#With only GITHUB_TOKEN and GH_TOKEN set, adding a private url marketplace fails as authentication required and no request carries either token"
        status: pass
    human_judgment: false
  - id: D2
    description: "No extension source names GITHUB_TOKEN, GH_TOKEN, or GITLAB_TOKEN, and the scan proves it read process.env readers"
    requirement: SG-AUTH-01
    verification:
      - kind: unit
        ref: "test/architecture/no-token-variable-read.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A stored x-access-token credential serves a private GitHub marketplace add and update and a private GitHub plugin install with one cascade result and no prompt, and stays in the store"
    requirement: SG-AUTH-03
    verification:
      - kind: e2e
        ref: "features/marketplace/credentials.feature#Adding a private GitHub marketplace with a stored credential clones it and asks for nothing"
        status: pass
      - kind: e2e
        ref: "features/marketplace/credentials.feature#Updating a private GitHub marketplace uses the stored credential and asks for nothing"
        status: pass
      - kind: e2e
        ref: "features/plugin/credentials.feature#Installing a plugin from a private GitHub source with a stored credential clones it and asks for nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "A failed add that never sends the stored GitHub credential (404 on a second repository) leaves the entry in the store"
    requirement: SG-AUTH-03
    verification:
      - kind: e2e
        ref: "features/marketplace/credentials.feature#A failed add that never sends the stored GitHub credential leaves it in the credential store"
        status: pass
    human_judgment: false
  - id: D5
    description: "A reload with autoapply on, for a private GitHub marketplace and no stored credential, fails the add without waiting for input, routes no sign-in request, and leaves no marketplace record"
    requirement: SG-AUTH-02
    verification:
      - kind: e2e
        ref: "features/marketplace/credentials.feature#A reload with autoapply on adds nothing for a private GitHub marketplace with no stored credential and asks for nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "The five scenarios that only proved the sign-in's absence run on the routed git host Pi, outside device-flow.feature"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin (1542 passed)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The git host records each request's headers; a profile Pi gets GITHUB_TOKEN and GH_TOKEN only from its scenario, never from the shell"
    verification:
      - kind: unit
        ref: "test/architecture/https-git-host-server.test.ts#SG-AUTH-01: returns the path and every header of a request since the window"
        status: pass
      - kind: unit
        ref: "test/architecture/hermetic-git-environment.test.ts#SG-AUTH-01: adds a scenario Pi's GITHUB_TOKEN and GH_TOKEN, not the shell's"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 01: Credential pins Summary

**Eleven cucumber pins and one architecture scan prove today's credential surface before Device Flow goes: token variables reach no request, a stored `x-access-token` credential serves add, update, and install with no prompt and survives a failure that never sent it, and an autoapply reload asks for nothing.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-11-27T14:40:37Z
- **Completed:** 2026-11-27T15:11:17Z
- **Tasks:** 3
- **Files modified:** 13 (3 created, 9 modified, 1 deleted)

PLAN_BASE: `9debd0d921dc2bfd7ac8f25459931ea903dc07ec` (the worktree base).

## Accomplishments

- The https git host now logs every request's headers. `requestHeadersSince` and the world's `requestHeadersOfLastCommand` read them, and `GitHostRequest`, `requestsSince`, and the snapshot did not change, so every existing request table still passes.
- New step `no request the git host received carries {string}`. It fails on an empty window (D-07-03), and it checks the path, every header value, and the decoded form of a Basic credential.
- A routed profile Pi can start with `GITHUB_TOKEN` and `GH_TOKEN` from a `name | value` table (`TOKEN_VARIABLES`). The hermetic environment test now plants shell values for both. It proves that every builder drops them and that `rpcChildEnvironment` passes on only the scenario's values.
- `test/architecture/no-token-variable-read.test.ts`: no extension source names any of the three token variables as a whole word, and the same scan finds `process.env` readers, so the check cannot pass on an empty tree.
- The three credential-store steps moved into `git-host.steps.ts` with the same text, and they share one writer (`storeCredential`). `marketplace/device-flow.steps.ts` is deleted.
- `listenOnLoopback` moved into `connect-proxy.ts`. Five scenarios moved out of `device-flow.feature`, which now holds 7 scenarios. A new autoapply-reload pin was added.

### Scenario list

`features/marketplace/credentials.feature` (`Feature: Marketplace credentials`):

1. With only GITHUB_TOKEN and GH_TOKEN set, adding a private url marketplace fails as authentication required and no request carries either token (new, SG-AUTH-01)
2. Adding a private GitHub marketplace with a stored credential clones it and asks for nothing (new, SG-AUTH-01/03)
3. Updating a private GitHub marketplace uses the stored credential and asks for nothing (new, SG-AUTH-03)
4. A failed add that never sends the stored GitHub credential leaves it in the credential store (new, SG-AUTH-03, D-SG-28)
5. A terminal session sends the background update's GitHub requests to the git host (moved)
6. The background update of a private GitHub marketplace with no stored credential shows no notice and asks for nothing (moved, retitled, SG-AUTH-02, D-PL8-12)
7. The background update of a private GitHub marketplace fetches with the stored GitHub credential (moved, SG-AUTH-03)
8. Applying a config that declares a private GitHub marketplace in pi's print mode adds nothing and leaves no staged clone, and print mode shows nothing, a documented Pi gap (MODE-04, JDOC-02) (moved, title kept)
9. A reload with autoapply on adds nothing for a private GitHub marketplace with no stored credential and asks for nothing (new, AAP-02, SG-AUTH-02)

`features/plugin/credentials.feature` (`Feature: Plugin credentials`):

1. Installing a plugin from a private GitHub source with a stored credential clones it and asks for nothing (new, SG-AUTH-03)
2. Installing a pinned GitHub plugin whose clone is already cached makes no request (moved, retitled; its fetch now clones with a stored credential)

### Reload-or-restart choice (Task 3)

The autoapply pin uses `When the user reloads pi`. The reload step sends `/claude:plugin reload` to `this.pi`, which is the routed profile Pi once it has started, so it drives that Pi directly and no restart step is needed. The two config `Given`s come after the profile Pi starts. If they came first, the Pi's startup load would run autoapply before the `When`.

### Suite counts

- `features/marketplace` + `features/plugin`, adapter profile: 1542 scenarios, 1542 passed (18523 steps).
- `features/marketplace` + `features/plugin`, builtin profile: 42 scenarios, 42 passed (544 steps).
- Task verify, adapter: `credentials.feature` x2 + `device-flow.feature`: 19 scenarios, 19 passed.
- Unit: `https-git-host-server`, `no-token-variable-read`, `hermetic-git-environment`: 49 passed; `github-device-flow-connect-proxy`, `github-device-flow-redirect`: 18 passed.
- `npm run --silent check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `git diff --stat 9debd0d..HEAD -- extensions`: empty (no production change).

## Task Commits

1. **Task 1: token pin end to end (tracer)** - `294eeba` (test). Tracer gate: verify re-run end to end before expansion, passed.
2. **Task 2: stored GitHub credential pins, credential-store steps moved** - `8dc1318` (test)
3. **Task 3: no-sign-in pins moved, listenOnLoopback moved, autoapply pin** - `ad7042d` (test)

No task was TDD, so no RED commit. Each pin passes on this tree by design, because it guards behavior that already holds.

## Files Created/Modified

- `features/lib/https-git-host/server.ts`: `GitHostRequestHeaders`, a `headers` field on the private log entry, `headersOf`, and `requestHeadersSince`
- `test/architecture/https-git-host-server.test.ts`: `send` takes extra headers. Two SG-AUTH-01 cases: every header of a windowed request, and no request from before the window
- `features/support/world.ts`: `requestHeadersOfLastCommand`. `ProfilePiVariables` gains `GITHUB_TOKEN` and `GH_TOKEN`
- `features/lib/pi-rpc.ts`: optional `GITHUB_TOKEN`/`GH_TOKEN` members, documented as set only for a scenario's own Pi, and their entries in `OPTIONAL_GIT_VARIABLES`
- `test/architecture/hermetic-git-environment.test.ts`: shell token values planted in `INHERITED_VARIABLES`, and one new `rpcChildEnvironment` case
- `features/step_definitions/git-host.steps.ts`: `TOKEN_VARIABLES`, the table-form routed Pi step, the carries step, `storeCredential`, the github.com credential step, and both credential-store `Then` steps
- `features/step_definitions/marketplace/device-flow.steps.ts`: deleted (its steps moved, text unchanged)
- `features/lib/github-device-flow/{server,connect-proxy}.ts`: `listenOnLoopback` moved into `connect-proxy.ts`, and `server.ts` imports it from there
- `features/marketplace/device-flow.feature`: five scenarios removed (12 -> 7)
- `features/marketplace/credentials.feature`, `features/plugin/credentials.feature`: new
- `test/architecture/no-token-variable-read.test.ts`: new

## Decisions Made

See `key-decisions` in the frontmatter. The url failure row of scenario 1 has no cause fields at all. A probe column for `cause chain` showed only name, scope, status, and reasons, so those four columns are the whole row, and no cause chain could be stated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Token variables had to join `OPTIONAL_GIT_VARIABLES`**
- **Found during:** Task 1
- **Issue:** `rpcChildEnvironment` copies only the listed optional members of `RpcGitEnvironment`. A `GITHUB_TOKEN` in a profile's variables would never have reached the Pi child, so the pin would have passed without the variables.
- **Fix:** Added both names to `OPTIONAL_GIT_VARIABLES` in `features/lib/pi-rpc.ts` (a planned file).
- **Committed in:** `294eeba`

**2. [Rule 2 - Missing critical] Hermetic proof for the new child variables**
- **Found during:** Task 1
- **Issue:** T-05-01 requires that no shell token value reaches a child. Nothing proved it for the new keys.
- **Fix:** `test/architecture/hermetic-git-environment.test.ts`, which is not in the plan's file list, now plants shell `GITHUB_TOKEN`/`GH_TOKEN` values for every builder case. A new case proves that `rpcChildEnvironment` passes on only the scenario's values.
- **Verification:** Ran in Task 1's verify command (49 passed).
- **Committed in:** `294eeba`

**3. [Rule 2 - Missing critical] The carries step decodes Basic credentials**
- **Found during:** Task 1
- **Issue:** Git sends a user and a password as a base64 `Authorization: Basic` value. A token sent as a git password would therefore pass a plain substring check.
- **Fix:** `headerTexts` also checks the decoded text of a Basic value. A negative control (`carries "tools.git"`) failed as expected and was reverted.
- **Committed in:** `294eeba`

**4. [Scope addition] An ssh launch row in the GitHub add pin**
- **Found during:** Task 2
- **Issue:** The plan's step list for "Adding a private GitHub marketplace with a stored credential..." does not name the ssh launches.
- **Fix:** Added `the user's ssh receives these launches:` with the probe launch only. This proves that the clone stayed on https and no ssh clone ran.
- **Committed in:** `8dc1318`

---

**Total deviations:** 4 (1 blocking, 2 missing critical, 1 assertion added). **Impact:** each one makes a pin stronger. No product file changed.

## Issues Encountered

- The worktree had no optional-peer cache (`node_modules/.cache/optional-peers`), so cucumber's `BeforeAll` failed. I copied the cache from the main checkout (`cp -a`), which has the same `peerDependencies` (checked with `diff`). This needed no network and no install, and it changes no tracked file.
- The harness refuses inline commands that name paths containing `git` or that chain several git steps. I ran the tests, pre-commit, and commits from scripts in `/tmp/claude-0/-home-user-pi-claude-marketplace/f641c099-e3f5-563d-9ac5-9922f1b9e06a/scratchpad/exec-05-01/`. The commit hook (`npm run check:commit`) passed on all three task commits.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The token variables reach only a scenario's own profile Pi (T-05-01), that Pi starts only through `startPiWithGitHubRouted` (T-05-02), the carries step fails on an empty window (T-05-03), and no package was added (T-05-SC).

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and the plan leaves no stub, skipped test, or unrun verify. STATE.md, ROADMAP.md, and `.planning/WINDOWS.md` were not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-02 can start. Every SG-AUTH pin is green on this tree and does not depend on Device Flow.
- `device-flow.feature` holds only the 7 scenarios that need the sign-in stand-in. The sign-in steps (`github's sign-in answers its polls with these outcomes:`, `github's sign-in receives these requests:`, `github's sign-in receives no request`, `pi runs with github's requests routed to the stand-ins`, `the user's git keeps credentials in its credential store`) are still in use, and they go with those scenarios in 05-06.
- The cucumber skill's `world-and-stand-ins.md` still describes the Device Flow stand-in, and it still says the credential-store steps lived in their own module. Plan 05-12 owns that wording.

## Self-Check: PASSED

- FOUND: features/marketplace/credentials.feature, features/plugin/credentials.feature, test/architecture/no-token-variable-read.test.ts
- ABSENT (as intended): features/step_definitions/marketplace/device-flow.steps.ts
- FOUND commits on this branch: 294eeba, 8dc1318, ad7042d
- Acceptance criteria of all three tasks re-checked: PASS

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*
