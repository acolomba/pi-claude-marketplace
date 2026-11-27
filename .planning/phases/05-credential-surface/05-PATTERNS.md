# Phase 5: Credential Surface - Pattern Map

**Mapped:** 2026-11-27
**Files analyzed:** 16 (the focus files of the orchestrator's brief; the mechanical threading edits of 05-01/05-02 follow RESEARCH.md §1b and need no analog)
**Analogs found:** 15 / 16

Locked after research: OQ1 accepted (`features/plugin/github-refresh.feature` row gains the D-1-02 stored-credential hint for github.com without the base override). OQ2 taken (remove `"credential"` from `GitSubcommand` and `GitRequest.input` from `platform/git-process.ts`). OQ5: the wire `schemaVersion` stays 1.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/lib/https-git-host/server.ts` (record request headers) | test harness (server) | request-response logging | the same file, `LoggedRequest`/`copyRequest`/`receive` (:101-143, :601-606) | exact (extend in place) |
| `features/step_definitions/git-host.steps.ts`: new `no request the git host received carries {string}` | step definition | assertion over the request log | `the git host receives these requests:` (:483-490) + `no result of the command contains {string}` (`features/step_definitions/command.steps.ts:314-317`) | exact |
| `features/step_definitions/git-host.steps.ts`: profile-Pi token variables (`GITHUB_TOKEN`, `GH_TOKEN`) | step definition | config -> Pi env | `profilePiVariable` + `...and the environment variable {string} set to {string}` (:438-472) | exact |
| `features/step_definitions/git-host.steps.ts`: delete sign-in steps, take credential-store steps from `marketplace/device-flow.steps.ts` | step definition | removal / move | `the user has stored a credential for the git host ...` (:272-290) | exact |
| `features/lib/github-device-flow/server.ts` (delete; move `listenOnLoopback`) | harness | removal | Phase 3 module deletion `367e56c` (see Shared: Removal) | role-match |
| `features/lib/github-device-flow/routing.ts` (drop `signIn`) | harness | request routing | itself | exact |
| `features/marketplace/credentials.feature`, `features/plugin/git-credentials.feature` (rewrite of `device-flow.feature`) | behavioral test | scenario | `features/marketplace/device-flow.feature` rows #5-#8, `features/marketplace/git-source.feature:149-413` | exact |
| `features/marketplace/github-transport.feature:157-179`, `features/plugin/github-refresh.feature` row | behavioral test | scenario | themselves | exact |
| `test/architecture/no-token-variable-read.test.ts` (new; name is the planner's) | architecture test | static source scan | `test/architecture/source-scan.ts` (`filesMatching`, `stripComments`, `REPO_ROOT`) as used by `no-credential-leak.test.ts:310-335` | exact |
| `test/architecture/gate-targets.ts` `CREDENTIAL_LEAK_TARGETS` | gate config | positional list | `367e56c` diff of the same list | exact |
| `test/architecture/no-credential-leak.test.ts` (destructuring, `DECLARED_MODULE_ORDER`, Device Flow scans, hookDebugLog `SCANNED`) | architecture test | static scan | `367e56c` diff of the same file | exact |
| `rule-packs/architecture.json` (`fetch-chokepoint` exclude + message, `no-network-modules` message) | lint config | ban rule | `bc4fdb7` diff (isomorphic-git exemption dropped, message reworded) | exact |
| `eslint.config.js` `GIT_PROCESS_IMPORTERS` (:38-47) and `NETWORK_SEAMS` (-2) | lint config | zone list | `bc4fdb7`/`367e56c` style; the list itself | exact |
| `extensions/pi-claude-marketplace/platform/git.ts` (`GitAuthBundle` declared here as `{ host }`, retry removed) | platform | request-response (git) | `GitCredentials` interface already declared in `git.ts:1125`; current union `git-credential.ts:104-129` | role-match |
| `extensions/pi-claude-marketplace/platform/git-process.ts` (drop `credential` + `input`) | platform | process spawn | `GitSubcommand` union :140-151, operand table :385-396, input pass-through :1190 | exact (shrink in place) |
| `test/platform/git-process.test.ts` re-sample (~30 `credential fill` uses) | unit test | process spawn | its own `ls-remote`/`version` cases | role-match |
| `platform/git-credential.ts`, `platform/git-one-shot-credential.ts`, `domain/github-auth.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts` + paired tests/fakes/contracts (delete) | module removal | removal | `367e56c` (deleted `platform/git-auth-callbacks.ts` + `test/platform/git-auth-callbacks.test.ts` + contract/fake members + gate slots) | exact |

## Pattern Assignments

### `features/lib/https-git-host/server.ts` (harness, request logging)

**Analog:** the same file. The log entry, its public copy, and the `receive` push are the three places to extend.

Public shape (lines 101-110):
```ts
/** One request the host received: its path with the query, as sent. */
export interface GitHostRequest {
  readonly method: string;
  readonly path: string;
  readonly status: number | "pending" | "dropped";
}
```
Private log entry and copy (lines 136-143):
```ts
interface LoggedRequest {
  readonly method: string;
  readonly path: string;
  status: number | "pending" | "dropped";
}

function copyRequest(request: LoggedRequest): GitHostRequest {
  return { method: request.method, path: request.path, status: request.status };
}
```
Recording site (lines ~601-606, `receive`):
```ts
const logged: LoggedRequest = {
  method: req.method ?? "",
  path: req.url ?? "",
  status: "pending",
};
this.log.push(logged);
```
Do: add `readonly headers: Readonly<Record<string, string>>` (from `req.headers`, joining array values) to both interfaces and to `copyRequest`. Keep `the git host receives these requests:` comparing only method/path/status so its 3-column tables do not change. Update `test/architecture/https-git-host-server.test.ts` (the paired harness test) for the new field.

---

### `features/step_definitions/git-host.steps.ts` — new step `no request the git host received carries {string}`

**Analog:** lines 483-490 (reads the same window) and `command.steps.ts:314-317` (the negative "contains" form):
```ts
Then("the git host receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requestsOfLastCommand().requests.map((request) => [
    request.method, request.path, String(request.status),
  ]);
  assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
});
```
```ts
// AUTH-09: a secret, such as a token, appears in no field of any result of
// the command, the fields no table states included.
Then("no result of the command contains {string}", function (this: ScenarioWorld, secret: string) {
  const rendered = JSON.stringify(this.resultsOf("command"));
  assert.strictEqual(rendered.includes(secret), false, `a command result contains ${secret}`);
});
```
Do: `JSON.stringify(this.requestsOfLastCommand().requests)` (path + every header) and assert `includes(token) === false`; also assert the window holds at least one request so the step cannot green over nothing (D-07-03 discipline). Leading comment cites SG-AUTH-01.

---

### `features/step_definitions/git-host.steps.ts` — token variables for a profile Pi

**Analog:** lines 438-472:
```ts
const SSH_VARIABLES: ReadonlySet<string> = new Set(["GIT_SSH_COMMAND", "GIT_SSH"]);
...
function profilePiVariable(name: string, value: string): ProfilePiVariables {
  if (SSH_VARIABLES.has(name)) { ... return { [name]: value }; }
  if (name !== "CLAUDE_CODE_PLUGIN_PREFER_HTTPS" && name !== "CLAUDE_CODE_REMOTE") {
    assert.fail(`a profile pi takes no variable ${name}`);
  }
  return { [name]: value };
}

Given(
  "pi runs with github's requests routed to the git host and the environment variable {string} set to {string}",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, name: string, value: string): Promise<void> {
    const variables = profilePiVariable(name, value);
    await writeRedirectConfig(this.tokens.home, { gitHost: this.gitHost.address });
    await startPiWithGitHubRouted(this, variables);
  },
);
```
Do: since both `GITHUB_TOKEN` and `GH_TOKEN` must be set at once, add a table form (`...and these environment variables:` with `name | value` rows) that folds `profilePiVariable` over rows; extend the allow-list with a `TOKEN_VARIABLES` set (`GITHUB_TOKEN`, `GH_TOKEN`, optionally `GITLAB_TOKEN`). Pass through `startPiWithGitHubRouted(world, variables)` (:393-416), which already spreads `variables` into `usePiWithProfile`. Note: the routing step used is `...routed to the git host` (:428-436); `...routed to the stand-ins` (:418-424) is deleted with the sign-in stand-in. `check:features` fails on an unused step, so each new step lands with its first scenario.

Credential-store steps: move the three steps of `features/step_definitions/marketplace/device-flow.steps.ts` beside `the user has stored a credential for the git host ...` (:272-290), which uses `useCredentialStore(world)` (:91-97); delete that module.

---

### `test/architecture/no-token-variable-read.test.ts` (architecture test, static scan) — new

**Analog:** `test/architecture/source-scan.ts` exports `REPO_ROOT`, `stripComments`, `assertNoForbiddenSurface`, `filesMatching(dirRel, pattern)` (non-global regex only). Used in `no-credential-leak.test.ts:30` and `:320-335`:
```ts
import { filesMatching, REPO_ROOT, stripComments } from "./source-scan.ts";
...
const named = await filesMatching(EXTENSION_ROOT_REL, DEVICE_PROMPT_REFERENCE);
const outside = named.filter((rel) => !DEVICE_PROMPT_REFERENCE_FILES.includes(rel));
...
assert.deepStrictEqual(outside, [], `AUTH-09 violation: only ... may name ...: ${outside.join(", ")}`);
```
Header docstring shape: copy the `The invariant (...) / The cost of losing it / How it is checked` block of `test/architecture/no-factory-time-probe.test.ts:1-27`.

Do: `filesMatching("extensions/pi-claude-marketplace", /\b(?:GITHUB_TOKEN|GH_TOKEN|GITLAB_TOKEN)\b/)` with the word boundary so `"OVERRIDE_GITHUB_TOKEN"` (`domain/claude-credential-denylist.ts:201`) does not match (or allow-list that one file with a reason). Assert `[]`. Add a second probe that proves the scan visited files (count of `filesMatching(..., /process\.env/)` > 0) so a moved tree cannot green it. This is an unpaired test under `test/architecture/` (run by `test:unpaired`), so no source pair or direct coverage entry is needed.

---

### `platform/git.ts` — `GitAuthBundle` shrunk to `{ host }`

**Analog:** current union `platform/git-credential.ts:104-129` (keep its doc style, drop both arms) and `GitCredentials` (`git.ts:1125`), which already lives in `git.ts`. Current import to replace (`git.ts:19`): `import type { GitAuthBundle } from "./git-credential.ts";` and `git.ts:15` `withOneShotCredential` import. Target (RESEARCH §2):
```ts
/** The auth bundle a git network operation carries (GAUTH-03, D-1-03). */
export interface GitAuthBundle {
  /** The host whose stored credential a request to it uses (GAUTH-03, D-1-03). */
  readonly host: string;
}
```
`runWithAuthBundle` keeps only the `rejected` -> `StoredCredentialRejectedError(auth.host, { cause })` mapping when `bundleOrigin(wireUrl, auth.host) !== undefined`; delete `retryAfterSignIn` and the `Extract<GitAuthBundle, { kind: "device-flow" }>` (:386). Retarget the type-only importers (`orchestrators/marketplace/shared.ts:75`, `marketplace/add.ts`, `marketplace/update.ts`, `test/platform/git-ops-fake.ts`) to `./git.ts`; reverse of commit `ff497bb` ("move the auth bundle types to the credential module").

---

### `platform/git-process.ts` — drop `credential` and `input`

Edit sites: `GitSubcommand` (:140-151) remove `| "credential"`; operand table (:394) remove `credential: { operands: NO_OPERANDS_RULE, ssh: false },`; `GitRequest.input` (:175-176); the comment at :1039 (`credential fill` AUTH-09 note); pass-through `...(request.input !== undefined && { input: request.input })` (:1190); header line :6 mentions stdin input. If `NO_OPERANDS_RULE` remains used by `version`, keep it. Check `process-run.ts` input support: keep it if `bridges/hooks` or `package-manager.ts` still use it (only the git request field goes). Re-sample `test/platform/git-process.test.ts` generic `credential fill` requests to `version`/`ls-remote`.

---

## Shared Patterns

### Removal of a module with its paired test and gate slots
**Source:** commit `367e56c` (deleted `platform/git-auth-callbacks.ts` + `test/platform/git-auth-callbacks.test.ts`, fake/contract members, and gate entries in one commit) and `bc4fdb7` (rule-pack exemption dropped once nothing used it).
**Apply to:** every deletion in 05-03/05-04.

`gate-targets.ts` — never shift positions; reuse or drop with the destructuring in the same commit (367e56c):
```diff
-  // AUTH-09: buildAuthCallbacks ... Appended last so no existing
-  // positional binding in no-credential-leak.test.ts is re-aimed.
-  "extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts",
+  // AUTH-09, D-SG-14: ... It took the slot of the in-process auth-callback
+  // module (SG-TRN-01), so no existing positional binding ... is re-aimed.
+  "extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts",
```
`no-credential-leak.test.ts` — the destructuring (:78-92) and `DECLARED_MODULE_ORDER` (:98-112, asserted at :353-357) change together:
```diff
-  GIT_AUTH_CALLBACKS_FILE,
+  GIT_ONE_SHOT_CREDENTIAL_FILE,
...
-  "platform/git-auth-callbacks.ts",
+  "platform/git-one-shot-credential.ts",
```
and the hookDebugLog scan's `SCANNED` list was edited with its explanatory comment (`const SCANNED = [GIT_PLATFORM_FILE, GIT_CREDENTIAL_FILE, GIT_ONE_SHOT_CREDENTIAL_FILE];`). Phase 5 narrows it to `[GIT_PLATFORM_FILE]` and keeps the D-07-03 `scannedCallSites > 0` check (git.ts still logs the ssh probe). Since entries are removed here (not slot-swapped), delete the entries and their destructured names together; the test pins the full order, so removal cannot silently re-aim a binding.

`rule-packs/architecture.json` (bc4fdb7) — drop the `exclude` entry and reword the message with the new decision ID:
```diff
-      "exclude": ["extensions/pi-claude-marketplace/platform/git.ts"],
-      "message": "D-13: only platform/git.ts imports isomorphic-git. ..."
+      "message": "D-SG-01, SG-TRN-01: every git operation runs system git, so no extension file imports isomorphic-git. ..."
```
For `fetch-chokepoint` (:165-174): keep only `platform/hosted-manifest-fetch.ts` in `exclude`, message cites D-SG-27 and D-PL5-07. Do this in the plan that deletes `github-auth.ts`, not earlier.

`eslint.config.js` :38-47 — remove the `git-credential.ts` line and the comment clause "and platform/git-credential.ts behind CredentialOps and its production binding" in the plan that deletes the module; update `test/architecture/no-shell-out.test.ts` with it. `NETWORK_SEAMS`: drop `domain/auth-registry.ts`, `domain/github-auth.ts` (and `orchestrators/auth-host.ts` if deleted).

Ordering constraint (fallow production dead-code): delete a module in the same plan where its last importer stops importing it.

### Hermetic-harness discipline
**Source:** `startPiWithGitHubRouted` (`git-host.steps.ts:393-416`) + `features/lib/github-device-flow/connect-proxy.ts`.
**Apply to:** all new scenarios. Token variables reach only a profile Pi; never the shared run Pi. Keep `connect-proxy.ts`, `extension.ts`, `routing.ts`; `listenOnLoopback` moves out of `server.ts` before it is deleted (imported at `connect-proxy.ts:29,151`).

### Comments and IDs
Cite SG-AUTH-01/02/03, D-SG-27/28/29 in step and test comments; no phase/plan references (CONVENTIONS.md).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| SG-AUTH-03 "token survives a failure the extension saw" scenario (404 on a second github.com marketplace) | behavioral test | scenario | No existing scenario asserts the store is unchanged after a non-401 failure; compose from `the user's git credential store holds these credentials:` (moved step) and the 404 arm used in `github-refresh.feature:71`. |

## Metadata

**Analog search scope:** `features/lib/https-git-host/`, `features/step_definitions/`, `test/architecture/`, `extensions/pi-claude-marketplace/platform/`, `rule-packs/`, `eslint.config.js`, git history (`367e56c`, `bc4fdb7`, `ff497bb`).
**Files scanned:** ~14
**Pattern extraction date:** 2026-11-27
