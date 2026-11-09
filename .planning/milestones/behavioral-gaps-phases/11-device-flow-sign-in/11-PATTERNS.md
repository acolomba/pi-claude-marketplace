# Phase 11: Device Flow Sign-In - Pattern Map

**Mapped:** 2026-11-08
**Files analyzed:** 2 (plus conditional product rows)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/step_definitions/marketplace/device-flow.steps.ts` (NEW) | test (cucumber verb step module) | file-I/O (reads/writes sandbox `{home}/.git-credentials`) | `features/step_definitions/git-host.steps.ts` (credential-store Givens, lines 75-86, 204-229) + `features/step_definitions/marketplace/checkout.steps.ts` (whole-dir "holds no" Thens) | exact |
| `features/marketplace/device-flow.feature` (MODIFY: keep 2 seeds, add DFLOW-01..04) | test (feature) | request-response | itself (seeds) + `features/marketplace/git-source.feature` lines 125-157 + `features/plugin/git-source.feature` lines 7-59, 139-164 | exact |
| Product rows (`domain/github-auth.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts`, `platform/git-credential.ts`, `platform/git-auth-callbacks.ts`, auth call in `orchestrators/plugin/clone-cache.ts`, credential choice in `orchestrators/marketplace/background-pass.ts`) | service | request-response | n/a -- touched only if a scenario exposes a bug (D-BG-1103) | n/a |

All named analog paths are tracked source under `features/`.

## Pattern Assignments

### `features/step_definitions/marketplace/device-flow.steps.ts` (verb step module, file-I/O)

**Rules (steps.md 46-48, 52-56, 66-82; layout.md 46, 56):** start with `@fileoverview` saying what the steps own; export nothing; order `Given`, `When`, `Then`; `function (this: ScenarioWorld, ...)` when the world is touched, arrow otherwise; a `Given` asserts its setup succeeded; a `Then` writes nothing to the world; step text is a string literal Cucumber expression naming the verb (no `{home}` token in step text); compare whole values with `deepStrictEqual`; tables compared as strings against `table.raw()` with header row included. Module lives one level down, so imports use `../../`.

**Header + imports pattern** (checkout.steps.ts lines 1-18):
```ts
/**
 * @fileoverview Steps about the marketplace checkouts a scope holds.
 * ...
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Given, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";
```
Add `type DataTable` to the cucumber import for the table Then: `import { type DataTable, Given, Then } from "@cucumber/cucumber";` (git-host.steps.ts line 24).

**Credential-store Given to copy** (git-host.steps.ts lines 75-86, 204-219). The frozen step writes `https://user:pass@<git host address>`, suitable only for the override host; Phase 11's own Given must write `https://x-access-token:<token>@github.com` (D-BG-1105). `useCredentialStore` and `CREDENTIAL_STORE_CONFIG` are module-private in git-host.steps.ts (not exported; step modules export nothing), so the new module re-declares the same constant and helper locally:
```ts
const CREDENTIAL_STORE_CONFIG = "[credential]\n\thelper = store\n";

async function useCredentialStore(world: ScenarioWorld): Promise<string> {
  const config = path.join(world.tokens.home, ".gitconfig");
  await writeFile(config, CREDENTIAL_STORE_CONFIG, { flag: "wx" });
  world.onRelease(() => rm(config, { force: true }));
  return config;
}

// The credential lives only in the sandbox HOME, which Pi's git reads through
// its global config (DRV-03); no git process runs to store it.
Given(
  "the user has stored a credential for the git host with the user {string} and the password {string}",
  async function (this: ScenarioWorld, user: string, password: string): Promise<void> {
    const credentials = path.join(this.tokens.home, ".git-credentials");
    const credentialsText = `https://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${this.gitHost.address}\n`;
    const config = await useCredentialStore(this);
    await writeFile(credentials, credentialsText, { flag: "wx", mode: 0o600 });
    this.onRelease(() => rm(credentials, { force: true }));
    assert.deepStrictEqual(
      [await readFile(config, "utf8"), await readFile(credentials, "utf8")],
      [CREDENTIAL_STORE_CONFIG, credentialsText],
    );
  },
);
```
Note: a scenario that uses the new github-credential Given must NOT also use `the user's git keeps credentials in its credential store` (both write `.gitconfig` with `flag: "wx"`; the second throws EEXIST). Likewise a scenario cannot combine the frozen override-host credential Given with the new one.

**Then: whole-table read of the store** -- shape from git-host.steps.ts lines 263-270 (projection to string rows, header prepended, `table.raw()`):
```ts
Then("the git host receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requestsOfLastCommand().requests.map((request) => [
    request.method,
    request.path,
    String(request.status),
  ]);
  assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
});
```
For the store: read `{home}/.git-credentials`, split lines, parse each with `new URL(line)` into `[protocol (without ":"), host, decodeURIComponent(username), decodeURIComponent(password)]`, header `["protocol", "host", "user", "password"]` (D-BG-1102).

**Then: "holds none"** -- absent-tolerant whole-value pattern from checkout.steps.ts lines 21-28, 47-58:
```ts
async function entryNames(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return [];
  }
  ...
}
Then(
  "the {word} scope holds no marketplace checkout",
  async function (this: ScenarioWorld, scope: string) {
    ...
    assert.deepStrictEqual({ sources: ..., "sources-staging": ... }, { sources: [], "sources-staging": [] });
  },
);
```
Store-empty step: absent file -> `[]` lines; `assert.deepStrictEqual(lines, [])`. Comment above it: why the store lives in the sandbox HOME (git-host.steps.ts lines 221-222 style: short `//` comment, cites decision ID).

**Comment style:** short `//` line(s) above a registration giving the non-obvious why with a decision ID (`// D-BG-03: ...`, `// GHB-03: ...`); no phase/plan refs.

---

### `features/marketplace/device-flow.feature` (feature, request-response)

**Keep both seeds** (layout.md lines 190, 212-213): each step only the seeds use must stay in use -- `github's sign-in answers its polls with these outcomes:`, `the user's git keeps credentials in its credential store`, `pi runs with github's requests routed to the stand-ins`, `github's sign-in receives these requests:`, `github's sign-in receives no request`, `pi routes these github requests:`. D-BG-1106: extend seed 1 with the credential store Then rather than duplicating it.

**Scenario skeleton (DFLOW-01, from seed 1):**
```gherkin
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given the user's git keeps credentials in its credential store
    Given pi runs with github's requests routed to the stand-ins
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | verification uri                | user code |
      | device-flow-prompt | info     | false        | https://github.com/login/device | WDJB-MJHT |
      | cascade            | info     | false        |                                 |           |
```
Next-command no-sign-in (D-BG-1102): `Given the user has run "...marketplace add..."` then `When ... marketplace update tools --scope user`, expect git host 401 then 200, and `Then github's sign-in receives no request`. A Given that signs in must provide `authorized` in the poll script.

**DFLOW-02 failure tail** -- copy assertions from `features/marketplace/git-source.feature` lines 142-157 (row with `failed | authentication required` and its cause chain) and the "nothing left" Thens:
```gherkin
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout
    Then the user scope holds no git clones
```
(Steps: config.steps.ts line 266; checkout.steps.ts 47, 60; plugin/installation.steps.ts 521.) Write as one `Scenario Outline` over `access_denied` / `expired_token` with an `Examples:` table. The exact cause chain in the `device-flow` case must be read from the product (do not copy the override-host chain blindly).

**DFLOW-03 install** -- cache miss from `features/plugin/git-source.feature` lines 139-164 (dir marketplace offering a `github` plugin, `Given the marketplace "gits" is added to the ... scope`, git host requirement `for the plugin "ghp"` with `x-access-token`/`stand-in-access-token`); cache hit from lines 39-59 (two plugins pinned to one commit, `pinned | true`, first install as `Given the user has run`, `Then the git host receives no request`). Note the pinned analog uses `git-subdir`; for Device Flow the source kind must be `github` (only github.com reaches the sign-in).

**DFLOW-04 background** -- seed 2's terminal-session shape: `Given the tui session starts with the environment variable "PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS" set to "0"`, `When the user sends the message "hello" in the tui session`, `Then the tui session reports no notice`, arm the credential after the add (`Given the git host requires ...` after `the user has run ... marketplace add`).

**Table header conventions:** lowercase space-separated headers (`marketplace name`, `needs reload`, `verification uri`, `user code`, `routed to`); empty cell for absent values; all `Given` lines spelled `Given` (no `And`); no MCP implementation tag (D-BG-04: runs once under `adapter`).

## Shared Patterns

### Request windows
**Source:** steps.md line 70; git-host.steps.ts lines 277-281. Log Thens compare only the last `When`'s requests, so a sign-in performed in a `Given` is not visible; put the step being proven in the `When`.

### Release discipline
**Source:** git-host.steps.ts lines 210-213. Every file a Given writes registers `this.onRelease(() => rm(path, { force: true }))`; write with `flag: "wx"` (credentials with `mode: 0o600`).

## No Analog Found

None. Product-row files have no pattern assignment: they change only if a scenario exposes a bug (D-BG-1103); existing unit pairs under `test/domain/`, `test/orchestrators/`, `test/platform/` are the analogs then.

## Metadata

**Analog search scope:** `features/step_definitions/**`, `features/marketplace/`, `features/plugin/`, `.agents/skills/cucumber/rules/`
**Files scanned:** 9
**Pattern extraction date:** 2026-11-08
