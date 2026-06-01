---
phase: 32-device-flow-state-machine-auth
plan: "02"
subsystem: domain/github-auth
tags:
  [
    device-flow,
    github-auth,
    oauth,
    state-machine,
    slow-down,
    expired-token,
    access-denied,
    auth-attempted,
    notify-fn-callback,
    discriminated-union,
    mock-http,
    tdd,
  ]
dependency_graph:
  requires: [AUTH-09-gate-phase32]
  provides:
    [
      initiateDeviceFlow,
      DEFAULT_DEVICE_FLOW_HTTP,
      DeviceFlowHttp,
      DeviceFlowResult,
      InitiateDeviceFlowOpts,
      NotifyFn,
      PollResult,
      DeviceCodeResponse,
    ]
  affects:
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - tests/helpers/device-flow-mock.ts
    - tests/domain/github-auth.test.ts
    - tests/architecture/no-credential-leak.test.ts (gate activates)
tech_stack:
  added: []
  patterns:
    - "Discriminated DeviceFlowResult / PollResult unions (Pattern 1)"
    - "Cumulative slow_down currentIntervalSec mutation (Pattern 2)"
    - "node:timers/promises.setTimeout AbortSignal-aware sleep (Pattern 3)"
    - "Pre-bound notifyFn callback parameter (Pattern 4; D-32-04)"
    - "Form-urlencoded body + Accept: application/json fetch (Pattern 5)"
    - "Closure-scoped mock with optional-throws conditional-spread (mirrors Phase 31 credential-mock)"
key_files:
  created:
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - tests/helpers/device-flow-mock.ts
    - tests/domain/github-auth.test.ts
  modified: []
decisions:
  - "GITHUB_OAUTH_CLIENT_ID committed as literal 'GITHUB_OAUTH_APP_CLIENT_ID_PLACEHOLDER' per Plan 32-01 operator outcome"
  - "Phase 32 does NOT wrap credentialOps.approve in try/catch -- caller decides best-effort vs surface (A9 contract locked by Test 13)"
  - "AUTH-09 gate transitions from vacuous-pass to active-pass on file creation"
  - "pollTokenImpl accepts intervalSec for signature compliance and references via `void intervalSec` (lint-clean; the value is informational only)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-01"
  tasks_completed: 3
  files_modified: 0
  files_created: 3
---

# Phase 32 Plan 02: Device Flow State Machine Summary

GitHub Device Flow state machine ships in `domain/github-auth.ts` with an
injectable HTTP seam, a pre-bound `notifyFn` callback, cumulative `slow_down`
back-off, `expires_in` deadline enforcement, and a discriminated
`DeviceFlowResult` whose every branch carries `authAttempted: true`.

## Tasks Completed

| Task | Name                                               | Status   | Commit  |
| ---- | -------------------------------------------------- | -------- | ------- |
| 1    | tests/helpers/device-flow-mock.ts                  | Complete | c67b44f |
| 2    | tests/domain/github-auth.test.ts (13 unit tests)   | Complete | c67b44f |
| 3    | extensions/pi-claude-marketplace/domain/github-auth.ts (production state machine) | Complete | c67b44f |

All three tasks land in a single atomic commit per the documented
inter-task commit strategy (TypeScript RED window across Tasks 1+2+3 is
bridged by the atomic commit -- same pattern as Phase 31 Plan 02).

## Public Surface (for Phase 33 readers)

```ts
// extensions/pi-claude-marketplace/domain/github-auth.ts

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;   // typically 900s
  interval: number;     // typically 5s
}

export type PollResult =
  | { kind: "success"; accessToken: string; tokenType: string; scope: string }
  | { kind: "pending" }
  | { kind: "slow_down" }
  | { kind: "access_denied" }
  | { kind: "expired_token" }
  | { kind: "unexpected"; error: string; description?: string };

export interface DeviceFlowHttp {
  requestCode(clientId: string, scope: string): Promise<DeviceCodeResponse>;
  pollToken(clientId: string, deviceCode: string, intervalSec: number): Promise<PollResult>;
}

export const DEFAULT_DEVICE_FLOW_HTTP: DeviceFlowHttp;

export type NotifyFn = (
  message: string,
  severity?: "info" | "warning" | "error",
) => void;

export interface InitiateDeviceFlowOpts {
  host: string;
  credentialOps: CredentialOps;
  notifyFn: NotifyFn;
  http?: DeviceFlowHttp;
  signal?: AbortSignal;
}

export type DeviceFlowResult =
  | { ok: true; cred: GitCredentials; authAttempted: true }
  | { ok: false; reason: string; authAttempted: true };

export function initiateDeviceFlow(
  opts: InitiateDeviceFlowOpts,
): Promise<DeviceFlowResult>;
```

**Phase 33 consumer pattern (preview):**

```ts
import {
  initiateDeviceFlow,
  DEFAULT_DEVICE_FLOW_HTTP,
} from "../../domain/github-auth.ts";

// Inside buildAuthCallbacks:
const result = await initiateDeviceFlow({
  host: "github.com",
  credentialOps: credOps,                  // Phase 31 seam
  notifyFn: ctx.ui.notify.bind(ctx),       // or shared/notify.ts wrapper
  http: DEFAULT_DEVICE_FLOW_HTTP,
});
if (result.ok) {
  authAttempted = true;
  return result.cred;
}
notifyFn(result.reason, "error");
return { cancel: true };
```

Phase 33 will:

- Wrap `initiateDeviceFlow` in the isomorphic-git `onAuth` closure -- with
  `credentialOps.fill` consulted BEFORE Device Flow (AUTH-08).
- Use `result.authAttempted` in `onAuthFailure` to call `credentialOps.reject`
  on the previously-attempted credential and return `{ cancel: true }` on
  the second consecutive failure to prevent the CP-9 retry loop (AUTH-07).

## Requirements → Test Map

| Requirement | Test Title (grep-able)                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| AUTH-01     | `AUTH-01 happy path returns ok+cred+authAttempted` (Test 1)                                                     |
| AUTH-01     | `AUTH-01 approve on success persists via credentialOps` (Test 2)                                                |
| AUTH-03     | `AUTH-03 notify content includes user_code AND verification_uri` (Test 3)                                       |
| AUTH-04     | `AUTH-04 cumulative slow_down increments intervalSec by 5 each occurrence` (Test 4)                             |
| AUTH-04     | `AUTH-04 pending no-change keeps intervalSec stable across iterations` (Test 5)                                 |
| AUTH-05     | `AUTH-05 access_denied produces human reason and authAttempted` (Test 6)                                        |
| AUTH-05     | `AUTH-05 expired_token produces human reason mentioning expiration` (Test 7)                                    |
| AUTH-05     | `AUTH-05 timeout terminates loop without polling when expires_in is 0` (Test 8)                                 |
| AUTH-05     | `AUTH-05 init failure returns ok:false when requestCode throws` (Test 9)                                        |
| AUTH-07     | `AUTH-07 authAttempted true on success` (Test 10)                                                               |
| AUTH-07     | `AUTH-07 authAttempted on failure stays true for access_denied` (Test 11)                                       |
| AUTH-09     | `AUTH-09 notify content negative scan -- no token or device_code leaked` (Test 12)                              |
| Design (A9) | `approveThrows propagates -- Phase 32 does not wrap CredentialOps.approve (A9)` (Test 13)                       |
| AUTH-09     | Architecture gate `AUTH-09 (Phase 32): domain/github-auth.ts never interpolates a token in an Error or notifyFn message` (tests/architecture/no-credential-leak.test.ts) -- vacuous-pass → active-pass on file creation |

13 unit tests in `tests/domain/github-auth.test.ts`; all pass.

## AUTH-09 Gate Transition

The Plan 32-01 architecture gate transitioned from vacuous-pass to
active-pass on file creation. Before this commit:

```
✔ AUTH-09 (Phase 32): domain/github-auth.ts never interpolates a token...
  (message: "domain/github-auth.ts not yet authored; AUTH-09 Phase-32
  gate inactive until Plan 32-02")
```

After this commit: the gate reads the new file from disk, strips
comments, and asserts the forbidden regex matches zero. The regex:

```
/(new\s+Error\s*\(|notifyFn\s*\()(?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i
```

`grep -nE "(new Error|notifyFn)\s*\([^)]*(access_token|accessToken|cred\.|r\.accessToken)" extensions/pi-claude-marketplace/domain/github-auth.ts` returns 0 non-comment matches.

## Test Suite Results

- `node --test tests/domain/github-auth.test.ts`: 13/13 pass
- `node --test tests/architecture/no-credential-leak.test.ts`: 3/3 pass (all active)
- `npm run check` (typecheck + lint + format:check + test): 1291/1291 pass
  (1278 baseline post-Plan-32-01 + 13 new domain tests)
- No new npm packages (`git diff package.json package-lock.json` -- no changes)
- Trufflehog scan clean (`pre-commit run trufflehog --all-files` from main
  checkout returned `Passed`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint @typescript-eslint/no-unused-vars on pollTokenImpl param**

- **Found during:** Task 3 npm run lint
- **Issue:** The third parameter of `pollTokenImpl` is required to satisfy
  the `DeviceFlowHttp.pollToken` signature but is unused inside the body
  (the body uses the body-level `client_id`, `device_code`, and
  `grant_type`; the seam's `intervalSec` is informational only). The
  project's ESLint config (`@typescript-eslint/no-unused-vars: error` with
  no options) does not honor the `_` prefix as an ignore pattern.
- **Fix:** Renamed the parameter to `intervalSec` (no underscore) and
  added a `void intervalSec;` reference plus an inline comment documenting
  the intentional non-use. The reference satisfies the lint rule without
  changing the run-time behavior or seam contract.
- **Files modified:** `extensions/pi-claude-marketplace/domain/github-auth.ts`
- **Commit:** c67b44f

**2. [Rule 3 - Blocking] ESLint @typescript-eslint/consistent-type-definitions on test recorder**

- **Found during:** Task 2 npm run lint
- **Issue:** The test file initially used a `type NotifyCall = { ... }`
  alias; project lint config prefers `interface` for object types.
- **Fix:** `eslint --fix` converted to `interface NotifyCall { ... }`.
- **Files modified:** `tests/domain/github-auth.test.ts`
- **Commit:** c67b44f

**3. [Rule 3 - Blocking] Prettier formatting on three new files**

- **Found during:** Task 3 npm run format:check
- **Issue:** Three new files had Prettier-detected style issues (line
  wraps in long template literal and arguments, blank-line placement).
- **Fix:** `npx prettier --write` on all three files; net cosmetic
  changes only.
- **Files modified:** all three new files
- **Commit:** c67b44f

**4. [Rule 3 - Blocking] ESLint @stylistic/padding-line-between-statements**

- **Found during:** Task 3 npm run lint
- **Issue:** Missing blank line before a statement in the production module.
- **Fix:** `eslint --fix` inserted the blank line.
- **Files modified:** `extensions/pi-claude-marketplace/domain/github-auth.ts`
- **Commit:** c67b44f

### Plan Note: Test 4 wall-clock cost (~15 seconds)

The plan's `<acceptance_criteria>` claims "Per-test runtime < 100ms; full
file < 1 second" alongside the explicit Test 4 assertion that
`httpState.pollTokenCalls[2].intervalSec === 10`. These two goals are
incompatible without injecting a sleep seam (which the plan rejects):

- Test 4 setup: `pollQueue = [slow_down, slow_down, success]` with
  `interval: 0`.
- Production state machine sleeps BEFORE each poll. After the first
  slow_down, `currentIntervalSec` becomes 5; after the second, 10.
- The third iteration therefore sleeps 10 seconds, then polls and gets
  success. Plus the second iteration sleeps 5 seconds. Total: ~15s.

No production code or test contract was changed. The Test 4 wall-clock
cost is the price of asserting the cumulative back-off observably.
Mitigating this would require injecting a sleep seam (rejected by the
plan -- the production module owns the sleep contract).

This is a documentation deviation, not a code deviation: the plan's
self-asserted runtime budget did not account for `slow_down` mutating
the interval mid-loop. The functional behavior is correct and the test
passes.

## Self-Check: PASSED

- [x] `extensions/pi-claude-marketplace/domain/github-auth.ts` exists (8 named exports)
- [x] `tests/helpers/device-flow-mock.ts` exists (3 named exports)
- [x] `tests/domain/github-auth.test.ts` exists (13 `test(...)` blocks)
- [x] Commit `c67b44f` exists (`git log --oneline | grep c67b44f` matches)
- [x] All 13 unit tests pass (`node --test tests/domain/github-auth.test.ts`)
- [x] All 3 AUTH-09 architecture-gate tests pass active (`node --test tests/architecture/no-credential-leak.test.ts`)
- [x] `npm run check` exits 0 with 1291/1291 tests
- [x] No `package.json` / `package-lock.json` changes
- [x] No `import.*ctx` / `from "@earendil-works/pi-coding-agent"` in domain/github-auth.ts
- [x] No `ctx.ui.notify(` / `process.stdout` / `process.stderr` runtime calls in domain/github-auth.ts (only docstring references)
- [x] AUTH-09 grep returns 0 non-comment matches (token never interpolated into Error / notifyFn)
- [x] No files deleted in commit (`git diff --diff-filter=D --name-only HEAD~1 HEAD` empty)
- [x] No modifications to STATE.md or ROADMAP.md (worktree isolation honored)
- [x] Trufflehog scan clean (run from main checkout)
- [x] domain → platform type-only imports preserved (P32-6)
