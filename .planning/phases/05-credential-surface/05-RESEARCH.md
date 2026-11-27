# Phase 5: Credential Surface - Research

**Researched:** 2026-11-27
**Domain:** Removing the GitHub/GitLab OAuth Device Flow and the extension's own credential plumbing from a Pi extension that runs system git; keeping non-Device-Flow auth-failure behavior intact.
**Confidence:** HIGH (every claim about the tree was read at HEAD `214187c`; the only MEDIUM/LOW items are flagged in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Device Flow (Q2)

- **D-SG-27: Device Flow is removed (upstream parity).** Claude Code has no Device Flow and no git token of its own (research FEATURES.md E-SG-12, E-SG-13). Delete:
  - `domain/github-auth.ts`, `domain/auth-registry.ts` (both providers, GitHub and GitLab), `platform/git-credential.ts`, `platform/git-one-shot-credential.ts`, and the builders in `orchestrators/auth-host.ts` (delete the module if nothing else remains in it);
  - the `credentialOps`, `deviceFlowHttp`, and `authMemo` threading through every orchestrator, edge handler, and the factory;
  - the Device Flow retry in `platform/git.ts` (D-SG-14's `https-auth` retry with the one-shot helper);
  - the Device Flow notification messages and reasons in the `shared/notification-*` family, with their wire and JSON schema entries and docs;
  - the `fetch-chokepoint` exemption for `domain/github-auth.ts` (the allow-list keeps only `platform/hosted-manifest-fetch.ts`), the `child-process-chokepoint` or `GIT_PROCESS_IMPORTERS` entries that only `git-credential.ts` needed, the matching `CREDENTIAL_LEAK_TARGETS` entries (a positional pair, edited together), and any `NETWORK_SEAMS` entry that only existed for Device Flow;
  - `features/marketplace/device-flow.feature`, the stand-in `features/lib/github-device-flow/`, the loopback `CONNECT` proxy kept only for Device Flow, and the test doubles and contracts (`test/domain/device-flow-*`, `test/platform/credential-ops-*`, `test/architecture/github-device-flow-*`, `test/integration/auth-e2e.test.ts`) with their owner tests.
- D-SG-27 supersedes D-SG-14 and retires D-79-04, D-79-05, D-BG-1101, D-BG-1102 and the GAUTH Device Flow requirements, each amended in place in PROJECT.md with a dated pointer to D-SG-27. GAUTH-03's rule (every host uses the stored credential) stays true through system git and its helpers.
- The non-interactive git environment stays exactly as Phase 2 set it (D-SG-05: `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS`, `GCM_INTERACTIVE=never`, `credential.interactive=false`). With Device Flow gone, no command, interactive or background, ever waits for user input for a credential.
- A private HTTPS clone with no credential the machine holds fails as an auth failure, with the `{auth}` reason class Phase 2 and 3 already produce (wording is Phase 6's).
- Restate for the outcome in PROJECT.md: AAP-D1 and the autoapply rules ("stored credentials only, no Device Flow") and D-PL8-12 become "git runs non-interactively with what the machine holds"; NFR-5's text and the `.planning/codebase/{STACK,ARCHITECTURE,CONVENTIONS}.md` lines that name Device Flow, `github-auth.ts`, `git-credential.ts`, `git-one-shot-credential.ts`, or `auth-host.ts` are updated.

#### Migration notice (Q5, part)

- **D-SG-28: no runtime notice (upstream parity).** Upstream prints no such notice, and Pi stores no record of who used Device Flow. README.md and README.es.md (together, per the `readme` skill) and CHANGELOG.md (per the `changelog` skill) say that Device Flow is gone, how to authenticate now (`gh auth login` then `gh auth setup-git`, Git Credential Manager, or an ssh key), and how to remove the old Device Flow token by hand (`git credential reject` with `protocol=https`, `host=github.com`, `username=x-access-token`, or the user's keychain UI). The extension never runs `git credential reject` or deletes a stored credential itself.

#### GitLab (Q5, part)

- **D-SG-29: GitLab token expiry is documented, not handled in code.** GitLab Device Flow tokens expire after about 2 hours, so a GitLab user loses access at the first expiry after the upgrade. README and CHANGELOG name this and the fix: `glab auth setup-git`, Git Credential Manager, or an ssh key. No GitLab-specific code or message.

### Claude's Discretion

- Plan split and order (for example: delete the threading first, then the modules, then the rule-pack and records), as long as `npm run check` stays green after every plan.
- Whether `orchestrators/auth-host.ts` keeps any non-Device-Flow job; delete it if none remains.
- Which existing scenarios that used Device Flow as a credential source switch to `credential.helper=store` in the sandbox `.gitconfig` (the harness already supports it, `features/step_definitions/git-host.steps.ts`), and which are deleted.

### Specific Ideas (from CONTEXT.md `<specifics>`)

Cucumber scenarios (AGENTS.md: each fails without the change):
- SG-AUTH-01: a private HTTPS marketplace and plugin install with a `credential.helper=store` entry succeeds with no prompt; with only `GITHUB_TOKEN` and `GH_TOKEN` set and no helper, the private clone fails as an auth failure, and the token value appears in no output, no recorded URL, and no git argument the stand-in sees.
- SG-AUTH-02: a private clone that fails auth shows no device code and runs no Device Flow request, on an interactive command, an autoapply load, and the background autoupdate pass.
- SG-AUTH-03: a helper entry shaped like a Device Flow token (`username=x-access-token`) keeps working for install and update over HTTPS, and stays in the helper after an auth failure the extension saw (the extension deletes nothing; git's own `credential reject` on a 401 is git's behavior, not the extension's).
- Tests never reach a real remote host and never run a real ssh.

### Deferred Ideas (OUT OF SCOPE)

- Auth-failure message wording and any how-to-authenticate hint on the failure row: Phase 6 (failure-message parity), following upstream.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md:51-53) | Research Support |
|----|-------------|------------------|
| SG-AUTH-01 | A user authenticates git only through what the machine already holds (ssh keys and agent, git credential helpers such as gh's or Git Credential Manager); the extension has no git token of its own and never reads `GITHUB_TOKEN` or similar into a URL or header. | Production reads no token variable today (grep: the only hit is the denylist string `"OVERRIDE_GITHUB_TOKEN"` at `domain/claude-credential-denylist.ts:201`). git-process passes the user's env and helpers through (`platform/git-process.ts:23-36`). The extension's own token surface is `CredentialOps.approve` in `domain/github-auth.ts:363` only. Scenarios: §4 "New scenarios". Harness gap: the git host does not record headers (§4 "Harness changes"). |
| SG-AUTH-02 | Device Flow removed; AAP, autoapply, and autoupdate rules (D-PL8-12) restated. | Full deletion surface §1; `run.origin.kind !== "command"` gate in `orchestrators/auth-host.ts:212-217` and `buildStoredCredentialAuth` in `update-preflight.ts:392-396` already make load and background stored-credential only. Records §5. Scenarios that fail without the change: interactive add (today POSTs `/login/device/code`) and print-mode add (today prints the `DeviceFlowUnavailableError` text). |
| SG-AUTH-03 | A user who stored a token through Device Flow keeps working over HTTPS with no action; the extension never deletes a stored credential; notice per Q5 (docs only). | Production never calls `credentialOps.reject` or `.fill` (grep: the only credential-protocol call is `.approve` at `domain/github-auth.ts:363`). git reads `protocol=https host=github.com username=x-access-token` (`domain/auth-registry.ts:61`) itself. GitLab stores `username: "oauth2"` (`domain/auth-registry.ts:99`). Scenario design must avoid a 401-after-credential failure for the "stays stored" check, because git's `store` helper erases a refused credential (PROJECT.md D-SG-14 outcome, line 2610). |
</phase_requirements>

## Project Constraints (from AGENTS.md)

The repo has no `CLAUDE.md`; `AGENTS.md` is the binding instruction file.

- Never commit to `main`; branch `features/<name>`; never rebase; merge to update; squash PRs. Commit format per `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- GSD records: prefix `gsd-tools windows append --description` with the milestone (`[system-git]`); every plan `SUMMARY.md` has a `## Threat Flags` section (even "None").
- Build verification: the pre-commit hook runs `npm run check:commit` for build inputs; it is not a gate. GSD gates (per-wave post-merge, phase gate, merge gate, PR handoff) run `npm run check` on the combined tree.
- Behavioral tests: a user-visible `/claude:plugin` change ships with a cucumber scenario under `features/` that fails without the change. Unit tests and coverage do not replace it.
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap. D-SG-27/28/29 are parity moves.
- NFR-1 atomic writes; NFR-2 no restart needed; NFR-3 idempotent/fail-clean; NFR-5 network policy (text to amend, §5); NFR-10 containment; IL-2 single output channel; IL-4 no telemetry.
- Quality bar: `npm run check` = typecheck + ESLint `--max-warnings 0` + `fallow` (rule-pack WARN check, dead-code x2, health, dupes) + Prettier + `test:corresponding` + `check:features` + unit (unpaired) + integration + cucumber (adapter then builtin) + 100% direct coverage per pair.
- Versioning: before the PR, offer to bump `package.json`/`sonar-project.properties`/`package-lock.json` and add a `CHANGELOG.md` entry.
- PR descriptions: `simple-english` (Plain) + `humanizer`.
- SonarCloud: zero new issues before merging.
- CodeGraph is indexed (`.codegraph/` exists): planners and executors should use `npx --no codegraph explore "<symbols>"` before grep.

## Summary

The Device Flow surface is wider than the ROADMAP count says, but its value edges are narrow. At HEAD, 41 extension files, 74 test files, and 5 feature files name the surface (619 and 2162 occurrences of the search set). The **value** dependencies all funnel through `orchestrators/auth-host.ts`. It is the only importer of `domain/auth-registry.ts`, `domain/github-auth.ts`, and the `createCredentialOps`/`NODE_CREDENTIAL_GIT` values of `platform/git-credential.ts`. It is also the only production caller of `notifyDeviceFlowPrompt`. `platform/git.ts` is the only importer of `platform/git-one-shot-credential.ts`. The edge layer and the factory (`index.ts`) thread nothing: no edge handler and no `index.ts` line names `credentialOps`, `deviceFlowHttp`, or `authMemo`. Each orchestrator defaults to `DEFAULT_CREDENTIAL_OPS` and allocates its own memo. So the "edge handler and factory" part of D-SG-27 is a no-op at HEAD, apart from comments in 13 edge **test** files.

The planner must keep one thing that is **not** Device Flow. The `GitAuthBundle` has a second arm, `stored-credential`, and that arm is the GAUTH-04 / D-1-01 / D-1-02 contract that every scenario under the GitHub base override already pins. It maps a refused helper credential to `StoredCredentialRejectedError` (`platform/git.ts:362-364`), and it lets `marketplace update` add the `NO_STORED_CREDENTIAL_CAUSE` hint line (`orchestrators/auth-host.ts:158-159`, used at `marketplace/update.ts:563-571` and `plugin/update-flow.ts:339-341`). Wording and hints belong to Phase 6, so Phase 5 should keep this arm, shrink the bundle to `{ readonly host: string }`, and delete only what serves Device Flow: the `device-flow` arm, `credentialOps`, `onAuthRequired`, the retry, the one-shot helper, and the whole `CredentialOps` protocol module. The protocol module has no non-Device-Flow caller: production never calls `fill` or `reject`, only `approve` after a sign-in.

The Device Flow change does have one user-visible side effect. github.com (and gitlab.com) without the base override currently get a `device-flow` bundle on command runs. After the change they get the same stored-credential behavior that every other host, and every overridden GitHub source, already gets. One Phase 4 scenario, `features/marketplace/github-refresh.feature:57-75`, will then probably gain the `no credential was obtained for github.com; ...` cause line (see Open Question 1). The rewritten AUTH-07 scenario will render `github.com rejected the stored credential` in its HTTPS attempt text.

**Primary recommendation:** Do the work in five plans. (1) Remove the `credentialOps`/`deviceFlowHttp`/`authMemo` threading from the orchestrators, in two plans split at the marketplace/plugin boundary, while Device Flow still works. (2) Remove the Device Flow engine, the prompt kind, and print-mode refusal, together with the feature rewrite and the new SG-AUTH scenarios. (3) Shrink `GitAuthBundle` to a host and delete the credential protocol, the retry, and the one-shot helper, with the lint and leak-gate edits. (4) Amend the records and docs. Keep the GitHub redirect and the CONNECT proxy harness, because Phase 4's 60+ transport scenarios use them. Delete only the sign-in stand-in.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential lookup for an HTTPS remote | System git + the user's credential helpers (outside the extension) | — | git asks its helpers itself on every run; the extension passes the user's env and config through (`platform/git-process.ts:23-36`). |
| Non-interactive git environment (D-SG-05) | `platform/git-process.ts` | — | Unchanged; the hardening pairs at `platform/git-process.ts:320-328`. |
| Mapping an `https-auth` failure to a closed reason / typed error | `platform/git.ts` (`runWithAuthBundle`) | `shared/git-failure-classifiers.ts` | Keeps the GAUTH-04 `rejected` -> `StoredCredentialRejectedError` mapping; the classifier already maps both to `authentication required` (`shared/git-failure-classifiers.ts:128-130`). |
| Binding a request to the host whose credential matters | `orchestrators/auth-host.ts` (`hostFromCloneUrl`) | `shared/github-base-url.ts` | Survives: the host for the GAUTH-04 error and the D-1-02 hint, including override and scp forms (`auth-host.ts:121-135`). |
| Failure rows and hint lines | `orchestrators/marketplace/update.ts`, `orchestrators/plugin/update-flow.ts` | `shared/notification-*` | Wording is Phase 6's; Phase 5 keeps it. |
| Device Flow prompt surface | `shared/notification-*` (raw surface `device-flow-prompt`) | `schema/claude-plugin.schema.json`, `docs/json-output.md` | Deleted. |
| OAuth HTTP (`fetch` to github.com / gitlab.com) | `domain/github-auth.ts` | `rule-packs/architecture.json` `fetch-chokepoint` | Deleted; `platform/hosted-manifest-fetch.ts` becomes the only `fetch` caller. |
| Behavioral proof | `features/` + harness (`features/lib/github-device-flow/`, `features/lib/https-git-host/`) | `test/architecture/` | The redirect + CONNECT proxy stay (Phase 4 transport features use them); the sign-in stand-in goes. |

## Standard Stack

No new library. The phase only removes code. Existing stack used:

| Tool | Version (verified) | Purpose |
|------|--------------------|---------|
| Node | v24.22.3 [VERIFIED: `node --version`] | runtime; engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` |
| system git | 2.43.0 [VERIFIED: `git --version`] | the one transport; the harness's `store` helper and `git http-backend` |
| `@cucumber/cucumber` | repo-pinned [VERIFIED: `node_modules/.bin/cucumber-js` present] | behavioral tests |
| `fallow` | repo-pinned [VERIFIED: `node_modules/.bin/fallow` present] | dead-code / rule-pack / dupes / health gate |
| `typebox` | `^1.1.38` (STACK.md) | wire schema (`shared/notification-wire.ts`) regenerated by `npm run schema:generate` (`package.json:101`) |

**Installation:** none.

## Package Legitimacy Audit

No package is installed, upgraded, or removed. `package.json` dependencies do not change. (`isomorphic-git` was already removed in Phase 3. The fetch removal deletes code only.)

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## 1. Deletion and edit surface (verified at HEAD)

Search set: `deviceFlow|DeviceFlow|device-flow|device_flow|authMemo|credentialOps|CredentialOps|deviceFlowHttp|auth-registry|github-auth|git-credential|git-one-shot-credential|auth-host|GitAuthBundle|GITHUB_PROVIDER|GITLAB_PROVIDER|findProviderForHost`. Totals: 41 extension files (619 hits), 74 test files, 5 feature files (2162 hits). [VERIFIED: grep this session]

### 1a. Production modules to DELETE (with their paired tests)

| Module (lines) | Only value importer | Paired / owned tests to delete |
|---|---|---|
| `domain/github-auth.ts` (427) | `orchestrators/auth-host.ts:47` (`initiateDeviceFlow`); type `DeviceFlowHttp` imported by 19 orchestrators | `test/domain/github-auth.test.ts`, `test/domain/device-flow-contract.ts`, `test/domain/device-flow-fake.ts`, `test/domain/device-flow-fake.test.ts` |
| `domain/auth-registry.ts` (110) | `orchestrators/auth-host.ts:46` (`findProviderForHost`), `domain/github-auth.ts:48` | `test/domain/auth-registry.test.ts` |
| `platform/git-credential.ts` (329) | `orchestrators/auth-host.ts:48` (`NODE_CREDENTIAL_GIT`, `createCredentialOps`); types `CredentialOps`, `GitAuthBundle`, `AuthAttemptResult` imported by `platform/git.ts:19`, `orchestrators/marketplace/shared.ts:75`, `marketplace/add.ts:165`, `marketplace/update.ts:204`, `domain/github-auth.ts:50` | `test/platform/git-credential.test.ts`, `test/platform/credential-ops-contract.ts`, `test/platform/credential-ops-fake.ts`, `test/platform/credential-ops-fake.test.ts` |
| `platform/git-one-shot-credential.ts` (122) | `platform/git.ts:15` (`withOneShotCredential`) | `test/platform/git-one-shot-credential.test.ts` |
| `orchestrators/auth-host.ts` (314) | **Survives in reduced form** (see §2). | `test/orchestrators/auth-host.test.ts` is rewritten (it has 303 hits, most of them Device Flow). |

### 1b. Production modules to EDIT

| File | What goes (line refs at HEAD) |
|---|---|
| `platform/git.ts` | import of `withOneShotCredential` (:15) and of `GitAuthBundle` from `git-credential.ts` (:19); the `device-flow` handling and `retryAfterSignIn` (:342-410); `GitCredentials` (:1120-1128, used only by the credential protocol and the one-shot helper); doc lines :28-30, :48-50, :70, :91-96, :117-120, :153-167, :276-277, :644, :700-701. Keep `runWithAuthBundle`'s `rejected` -> `StoredCredentialRejectedError` mapping and `bundleOrigin` (:315-325). |
| `platform/git-process.ts` | comment :109 (importers); optional: `"credential"` subcommand (:150, :394), `input` field (:175-176, :1190), comment :1039. Optional because `test/platform/git-process.test.ts` uses `credential fill` as its sample request (:58 and about 30 sites), so the removal rewrites that test. |
| `orchestrators/marketplace/shared.ts` | `GitAuthBundle` import from `platform/git-credential.ts` (:75) changes to `platform/git.ts`; re-export :137 stays; `lacksStoredCredential(err, auth)` (:297-304) loses the `auth.kind === "stored-credential"` test (every bundle is one). |
| `orchestrators/marketplace/add.ts` | :120-125, :149, :154, :165, :262-273, :935-951, :1038-1046, :1286-1287, :2104-2143 (`cloneAuthFor` keeps a host-only bundle; :1068 `attempt.transport === "https" && { auth }` stays). |
| `orchestrators/marketplace/update.ts` | :153-158, :181, :184, :200, :204, :209, :249-260, :300-321, :344-347, :366, :413-419, :447-448, :526-547 (`refreshAuthFor`), :556-571 keeps `attachStoredCredentialCause`. |
| `orchestrators/marketplace/clone-swap.ts` | docs only at :311-316 ("a Device Flow that Pi cannot show"); `GitAuthBundle` type stays. |
| `orchestrators/plugin/clone-cache.ts` | type-only `GitAuthBundle` use (:60, :129, :133, :154, :182, :269, :406, :453, :551, :684, :1113); no logic change once the type shrinks. |
| `orchestrators/plugin/{dependency-bindings,dependency-move,dependency-tag-probe,fetch,info,install-cascade,install-clone-probe,install-flow-cascade-context,install-flow-dependency-ledger,install-flow-ledger,install-outcome,marketplace-tag-probe,reinstall-flow,update-constraint-gate,update-flow,update-preflight,update-swap}.ts` | the `credentialOps?`/`deviceFlowHttp?`/`authMemo?` fields and their spreads; the `new Map<string, AuthAttemptResult>()` allocations (`fetch.ts:172`, `info.ts:289`, `reinstall-flow.ts:579`, `update-flow.ts:569`, `marketplace/update.ts:542`); `fetch.ts:198`'s `no-await-in-loop` reason ("the shared `authMemo` runs the device flow once per host") must be re-justified or the loop's sequence reason restated; `update-preflight.ts:392-396` (`cloneAuth`) collapses to one builder. Full line lists are in the per-file grep in this session's notes; CodeGraph `explore "buildCloneAuth DEFAULT_CREDENTIAL_OPS authMemo"` returns them. |
| `domain/github-transport.ts` | `DeviceFlowUnavailableError` import (:28) and the branch in `stopsTheClone` (:137-147); doc :66. |
| `shared/errors.ts` | `DeviceFlowUnavailableError` (:5-13). `StoredCredentialRejectedError` (:589-596) **stays**. |
| `shared/notification-types.ts` | `DeviceFlowPrompt` (:1885-1888), `DeviceFlowPromptSurface` (:1895-1897), union member (:1919). |
| `shared/notification-dispatch.ts` | import (:83), `case "device-flow-prompt"` (:129), `notifyDeviceFlowPrompt` (:381-399). |
| `shared/notification-grammar.ts` | `case "device-flow-prompt"` (:1474). |
| `shared/notification-json.ts` | `case "device-flow-prompt"` (:225). |
| `shared/notification-resolve.ts` | severity table entry `"device-flow-prompt": "info"` (:654) and case (:769). |
| `shared/notification-wire.ts` | `DEVICE_FLOW_PROMPT_PAYLOAD` (:716-724) and its member in the union (:980). |
| `shared/fs-utils.ts` | comment :19 ("GitOps, CredentialOps, and DeviceFlowHttp all travel as an optional member"). |
| `bridges/hooks/{async-rewake/registry.ts:20,dispatch-exec.ts:64,exec-timer.ts:29}` | comments naming `platform/git-credential.ts` among the spawn sites. |
| `schema/claude-plugin.schema.json` | regenerate (`npm run schema:generate`); the `device-flow-prompt` member at :2315 goes; the file is in `package.json` `files` (:46). |

### 1c. Gate configuration (edit in the same plan as the module the entry names)

| File | Entry | Verbatim at HEAD | Action |
|---|---|---|---|
| `rule-packs/architecture.json:165-174` | `fetch-chokepoint` | `"exclude": ["extensions/pi-claude-marketplace/domain/github-auth.ts", "extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts"]`; message `"IL-4 / NFR-5 / D-PL5-07: only domain/github-auth.ts, for the Device Flow endpoints, and platform/hosted-manifest-fetch.ts, for a hosted marketplace catalog, call fetch."` [VERIFIED: rule-packs/architecture.json:165-174] | drop the github-auth exclude and reword the message, in the plan that deletes `github-auth.ts` (not earlier: the exclude is what lets its `fetch` pass). |
| `rule-packs/architecture.json:162` | `no-network-modules` message | `"... Git traffic goes through platform/git.ts and the git subprocesses platform/git-process.ts starts, Device Flow through domain/github-auth.ts, and a hosted marketplace catalog ..."` [VERIFIED] | reword. |
| `rule-packs/architecture.json:110-122` | `child-process-chokepoint` | excludes `platform/git-process.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`, `platform/package-manager.ts`, `platform/prompt-shell.ts` [VERIFIED] | **no change**: `git-credential.ts` is not in it (it never imported `child_process`). |
| `eslint.config.js:44-47` | `GIT_PROCESS_IMPORTERS` | `["./extensions/pi-claude-marketplace/platform/git.ts", "./extensions/pi-claude-marketplace/platform/git-credential.ts"]` [VERIFIED: eslint.config.js:44-47] | drop `git-credential.ts`, and the comment at :38-43, in the plan that deletes it. |
| `eslint.config.js:64-70` | `NETWORK_SEAMS` | `"extensions/pi-claude-marketplace/domain/auth-registry.ts"`, `"extensions/pi-claude-marketplace/domain/github-auth.ts"`, `"extensions/pi-claude-marketplace/orchestrators/auth-host.ts"` with reasons D-79-04, D-32-01, D-79-05 [VERIFIED: eslint.config.js:64-70] | drop the two domain entries with their modules. Drop `auth-host.ts` only if it no longer imports a `platform/git*` specifier (it may take `GitAuthBundle` through `orchestrators/marketplace/shared.ts`, which re-exports it at :137). That leaves 16 seams (ARCHITECTURE.md says 19). |
| `test/architecture/gate-targets.ts:152-176` | `CREDENTIAL_LEAK_TARGETS` | 13 entries, positions 4,5,7,8,11 = `platform/git-credential.ts`, `domain/github-auth.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts`, `platform/git-one-shot-credential.ts` [VERIFIED: test/architecture/gate-targets.ts:152-176] | edit together with the destructuring at `test/architecture/no-credential-leak.test.ts:78-92` and `DECLARED_MODULE_ORDER` :98-112 (the test asserts the order at :353-357). |
| `test/architecture/no-credential-leak.test.ts` | Device Flow scans | tests at :382 (git-credential), :438 (github-auth), :502 (`describeDeviceCodeErrorBody`), :531 (github-auth `reason:`), :618 (PROV-05 + prompt binding, `PROVIDER_FILES` :122, `DEVICE_PROMPT_REFERENCE_FILES` :238, regexes :210-229), :658 (`CREDENTIAL_CAPTURING_ORCHESTRATORS` :135, rationale "constructs the Device Flow onAuthRequired closure"); :562 hookDebugLog scan `SCANNED = [GIT_PLATFORM_FILE, GIT_CREDENTIAL_FILE, GIT_ONE_SHOT_CREDENTIAL_FILE]` | delete the Device Flow scans. Keep the state-write scan (:348), the git-process scan (:408), the hosted-fetch scan (:478), and the hookDebugLog scan narrowed to `platform/git.ts`, which still has hookDebugLog calls (ssh probe). Keep the JSON/RPC leak cases (:1165+). |
| `test/architecture/no-shell-out.test.ts:62-82` | git-process import gate table | `{ importer: "platform/git-credential.ts", violations: [] }`, `{ importer: "orchestrators/auth-host.ts", violations: ["import-x/no-restricted-paths"] }` [VERIFIED] | the git-credential row becomes a violation row (or a different allowed/denied pair) when `GIT_PROCESS_IMPORTERS` shrinks; the doc at :108-114 names git-credential. |
| `test/architecture/no-test-only-production-surface.test.ts:186-202` | `CLASSIFIED_SEAMS` | `{ member: "credentialOps", target: MARKETPLACE_ADD_REL }`, `{ member: "deviceFlowHttp", target: MARKETPLACE_ADD_REL }`, `{ member: "credentialOps", target: MARKETPLACE_UPDATE_REL }`, `{ member: "deviceFlowHttp", target: MARKETPLACE_UPDATE_REL }` [VERIFIED] | delete the four rows in the plan that removes those members from `add.ts`/`update.ts` (the gate checks each classified member is still present). |
| `test/architecture/wire-schema.test.ts:103,111-119` | member list + count | `{ kind: "device-flow-prompt", schemaVersion: 1 }`; `assert.strictEqual(memberCount, 25)` [VERIFIED] | remove the row; 24 members. |
| `test/architecture/json-output-docs.test.ts:275,467` | docs kind lists | `"device-flow-prompt"` | remove with the docs section. |
| `test/architecture/catalog-uat/catalog-wire.test.ts:38,169-172,224-225,339-340,531` | raw-surface fixtures | `notifyDeviceFlowPrompt`, `"device-flow-prompt"` | remove. |
| `test/architecture/marketplace-tag-probe-remote.test.ts:18` | comment naming `auth-host.ts` | — | reword if auth-host's role changes. |
| `.fallowrc.json`, `sonar-project.properties`, `package.json` scripts, `cucumber.json`, `.github/`, `.pre-commit-config.yaml` | — | no hit for any surface name [VERIFIED: grep] | none. |

**Rule-pack WARN risk:** `npm run fallow` fails when a rule's `files` glob matches nothing. Every edited rule keeps `files: ["extensions/pi-claude-marketplace/**"]`, so the WARN check is not triggered. If an `exclude` entry names a deleted file, the effect is not measured (A3). Remove the entry in the same plan as the file.

### 1d. Notifications, docs, schema

- `docs/json-output.md:103` (outcome list sentence names `device-flow-prompt`), `:464-477` (the `#### device-flow-prompt` section with `<!-- fields: kind:device-flow-prompt -->`), and `:1006` ("Front-ends must render ... at least the `device-flow-prompt` fields"). The removal of a kind follows `:164`: "A new optional field, a new kind, or a new closed-set member keeps the same version. Removing or renaming a field, changing its type, or changing its meaning requires a version bump." Removing a whole kind is not listed. Recommendation: keep `schemaVersion: 1` and say in CHANGELOG that the kind is gone (A2).
- `docs/output-catalog.md:5273` (out-of-band intro names "interactive Device Flow prompts") and `:5277-5291` (`### Device Flow user-code prompt (AUTH-03)`, `<!-- catalog-state: device-flow-prompt -->`). The catalog-uat parser skips this section (`:5275`), so only the wire/arch tests above lock it.

### 1e. Tests to EDIT (not delete)

| Test file | What changes |
|---|---|
| `test/orchestrators/marketplace/{add,update}.test.ts` (8320 / 8228 lines; 83 / 109 hits) | drop `credentialOps`/`deviceFlowHttp`/`authMemo` args; delete Device Flow cases (sign-in, memo, prompt, print refusal). |
| `test/orchestrators/plugin/{fetch,info,install-flow-ledger,install-outcome,install-cascade,install-clone-probe,install-flow-cascade-context,install-flow-planning,reinstall-flow,update-flow,update-preflight,update-constraint-gate,dependency-bindings,dependency-move,dependency-tag-probe,marketplace-tag-probe,clone-cache}.test.ts` | same; `createDeviceFlowFake` is used in 12 of them, `createCredentialOpsFake` in 12, `authMemo` in 11. |
| `test/orchestrators/marketplace/shared.test.ts:492-540` | `storedCredentialAuth()` / `deviceFlowAuth()` builders; delete the device-flow case (:539). |
| `test/orchestrators/marketplace/clone-swap.test.ts:33,61-63,858` | `AUTH` constant shape; the case at :858 uses `new DeviceFlowUnavailableError()` as "an error that says nothing about the remote" -> use `InvalidGitHubBaseUrlError` (the other example `isUnreachable`'s doc names, `clone-swap.ts:311-316`). |
| `test/orchestrators/github-transport.test.ts:16,495` and `test/domain/github-transport.test.ts:9,349` | delete the `DeviceFlowUnavailableError` stop cases. |
| `test/platform/git.test.ts:1430-1860, 2179` | delete the D-SG-14 cases (:1431, :1464, :1489, :1514, :1545, :1565, :1590, :1647, :1676, :1712, :1776, :1840 loop); keep and re-shape GAUTH-04 :1617 and D-1-03 :1750 and RESV-03 :2179 with a host-only bundle. |
| `test/platform/git-ops-fake.ts:6,42,49,60` and `git-ops-fake.test.ts:6,17,150-200` | type-only `GitAuthBundle`; the fake test that records an `onAuthRequired` bundle is rewritten to a host-only bundle. |
| `test/shared/{errors,notification-dispatch,notification-grammar,notification-json,notification-resolve,notification-types,notification-wire}.test.ts` | delete `DeviceFlowUnavailableError` and `device-flow-prompt` cases. |
| `test/edge/register.test.ts:77,543,602,1089-1096`, `test/edge/command-run.test.ts:13,650-657` | delete the prompt dispatch cases. |
| `test/edge/{completions/data,completions/provider,handlers/marketplace/{add,info,list,remove,update},handlers/plugin/{bootstrap,enable-disable,import,list,pending,reinstall,uninstall}}.test.ts` | comment only: "`globalThis.fetch`, whose callers here are the device flow in `domain/github-auth.ts` and the hosted catalog download" (e.g. `test/edge/handlers/marketplace/add.test.ts:198-202`). Reword to the hosted catalog download alone. |
| `test/integration/marketplace-add-seed-mirrors.test.ts:40,87-88,173-415` and `marketplace-layer-remove.test.ts:36,137` | drop the `credentialOps` arg; the seed-mirrors header says it reads "the recorded git and credential calls". |
| `test/architecture/github-device-flow-connect-proxy.test.ts`, `github-device-flow-redirect.test.ts` | **keep** (the harness stays); edit for the sign-in route removal; rename with the lib directory if it is renamed. |

**Delete:** `test/integration/auth-e2e.test.ts`. Its single case is print-mode refusal "before Device Flow starts (MODE-04)" with a `fs.rm` fault (header :1-25). The premise disappears.

## 2. What survives of `auth-host.ts` and `git-credential.ts`

**`platform/git-credential.ts`: nothing survives.**
- `CredentialOps.fill`/`.reject` have no production caller, and `.approve` has one, the Device Flow sign-in (`domain/github-auth.ts:363`). [VERIFIED: grep `\.reject(|\.approve(|\.fill(` over extensions]
- `GitAuthBundle`'s `credentialOps` field exists only so the sign-in can store its token (`git-credential.ts:115`, "`credentialOps` is the helper surface the sign-in stores its token through"). `platform/git.ts` never reads it.
- `AuthAttemptResult` and `OnAuthRequiredFn` are Device Flow only.
- What git does without the module: on every HTTPS request, git runs the user's configured `credential.helper` chain (gh's `gh auth git-credential`, GCM, osxkeychain, libsecret, `store`). After a 401 with a helper credential, git runs `credential reject` itself, and after a success it runs `approve`. This is git's own behavior. The extension adds nothing and removes nothing. With D-SG-05 hardening, git never prompts: `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS`, `GCM_INTERACTIVE=never`, `credential.interactive=false` (`platform/git-process.ts:320-328`, STACK.md:80). gh's helper also honors `GH_TOKEN`/`GITHUB_TOKEN` in the env git inherits. That is gh's behavior and matches upstream: "`GITHUB_TOKEN` alone does nothing. A token takes effect only through a helper such as `gh`'s" (FEATURES.md E-SG-12). [CITED: .planning/research/FEATURES.md:204-216]

**`orchestrators/auth-host.ts`: these non-Device-Flow jobs survive.**
- `hostFromCloneUrl(cloneUrl, kind)` + `scpHost` (`:121-135`): the host a request's credential belongs to (override host for github sources, URL host with port, scp host). It is used by `marketplace/add.ts:2143`, `marketplace/update.ts:547`, `plugin/update-flow.ts:289`, `plugin/update-preflight.ts:394`.
- `NO_STORED_CREDENTIAL_CAUSE` (`:158-159`): the D-1-02 / GAUTH-04 hint, used by `marketplace/update.ts:568,570` and `plugin/update-flow.ts:340`. Verbatim: ``String.raw`no credential was obtained for ${host}; store one with: printf 'protocol=https\nhost=${host}\nusername=<user>\npassword=<token>\n\n' | git credential approve` `` [VERIFIED: auth-host.ts:158-159]. Its wording is Phase 6's to change, and `features/marketplace/git-source.feature:305,331,332,413` pin it.
- A builder that makes the host-only bundle for a source: today `buildCloneAuth`/`buildGitHubAuth`/`buildAuthForHost`/`buildStoredCredentialAuth`. These collapse to one or two pure functions with no `ctx`/`run`/`credentialOps`.
- Recommendation: keep the module (the name still fits "the host a request authenticates to"), drop `DEFAULT_CREDENTIAL_OPS`, `CREDENTIAL_TIMEOUT_MS`, the provider lookup, `initiateDeviceFlow`, `notifyDeviceFlowPrompt`, `DeviceFlowUnavailableError`, and the re-exports of `CredentialOps`/`DeviceFlowHttp`/`AuthAttemptResult` (`:75`).

**The surviving bundle:** Today it is `{ kind: "stored-credential"; credentialOps; host } | { kind: "device-flow"; credentialOps; host; onAuthRequired }` (`platform/git-credential.ts:118-129`). It becomes a single shape that holds only `host`. Declare it in `platform/git.ts` (the `platform` zone may import only `shared`), and keep re-exporting it from `orchestrators/marketplace/shared.ts:137`. `runWithAuthBundle` then reads:

```typescript
// platform/git.ts (after) -- sketch; names other than those quoted from HEAD are [ASSUMED]
export interface GitAuthBundle {
  /** The host whose stored credential a request to it uses (GAUTH-03, D-1-03). */
  readonly host: string;
}

async function runWithAuthBundle(request, wireUrl, auth, gitProcess): Promise<GitResult> {
  try {
    return await gitProcess.run(request);
  } catch (error: unknown) {
    if (
      auth !== undefined &&
      bundleOrigin(wireUrl, auth.host) !== undefined &&
      error instanceof GitCommandError &&
      error.failure.kind === "https-auth" &&
      error.failure.detail === "rejected"
    ) {
      throw new StoredCredentialRejectedError(auth.host, { cause: error });
    }
    throw error;
  }
}
```

Alternative considered: delete the bundle and derive the host in `git.ts` from `wireUrl`. Rejected for Phase 5. Some callers pass no bundle today, for example `marketplace-tag-probe.ts:132-139` when `auth` is undefined, and `clone-cache.ts:154-160`. For those requests a refused credential is a plain `GitCommandError` today. Deriving the host would turn it into `StoredCredentialRejectedError` and change messages. That is Phase 6 territory.

## 3. How an `https-auth` failure flows today and after

**Today** (`platform/git.ts:342-410`) [VERIFIED: read this session]:
1. `runRemote` runs the request once. On a `GitCommandError` whose `failure.kind === "https-auth"` and whose wire URL is an https URL of the bundle's host (`bundleOrigin`, :315-325), it maps by `detail`:
   - `rejected` + `stored-credential` -> `StoredCredentialRejectedError(host, { cause })` (:362-364)
   - `rejected` + `device-flow` -> rethrow as is (:366-368)
   - `no-credential` + `stored-credential` -> rethrow as is (:366-368)
   - `no-credential` + `device-flow` -> `retryAfterSignIn` (:370): `onAuthRequired()` (Device Flow; print mode throws `DeviceFlowUnavailableError` at `auth-host.ts:229-231`), then rerun with a one-shot helper. A failed sign-in sets `failure.cause = new Error(signedIn.reason)` (:394-398).
2. Classification: every `https-auth` and `ssh-auth` kind, and `StoredCredentialRejectedError`, gives the reason `authentication required` (`shared/git-failure-classifiers.ts:128-130` and the kind table after :140). That is the `{auth}` reason class rows render.
3. Who got `device-flow` bundles: `buildAuthForHost` returns one only when `findProviderForHost(host)` matches (`github.com` or `gitlab.com`, `auth-registry.ts:54,92`) **and** `run.origin.kind === "command"` (`auth-host.ts:215`). With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, GitHub sources get stored-credential bundles bound to the override host (`auth-host.ts:264-267`). The autoupdate cascade always gets stored-credential bundles (`update-preflight.ts:392-396`).

**After:** every bundle is the host-only bundle with the old stored-credential semantics.
- `no-credential` -> plain `GitCommandError` (`https-auth`) -> `authentication required`. The cause line is the D-1-02 hint on the update paths that place it.
- `rejected` -> `StoredCredentialRejectedError` -> `authentication required`, message `"<host> rejected the stored credential"` (`shared/errors.ts:589-596`).
- GitHub `owner/repo` sources then go on to the SSH attempt as their plan orders (`domain/github-transport.ts` `retryWith`). Only `git-missing` and `aborted` stop a clone (`stopsTheClone` after the edit).

**Scenarios whose output changes because github.com/gitlab.com lose the `device-flow` arm** (all without the base override, so all use `pi runs with github's requests routed to ...`):
- `features/marketplace/device-flow.feature` (rewritten, §4).
- `features/marketplace/github-transport.feature:157-179` (print mode; rewritten, §4).
- `features/marketplace/github-refresh.feature:57-75` ("A github marketplace refresh that fails over both transports reports both attempts"). `attachStoredCredentialCause` (`marketplace/update.ts:556-571`) calls `lacksStoredCredential(err, auth)`. Today that returns false for a `device-flow` bundle. Afterwards it returns true for any error that classifies as `authentication required` and is not `StoredCredentialRejectedError` (`marketplace/shared.ts:297-304`), and a `GitHubTransportsFailedError` classifies by its last attempt, here `ssh-auth` (`git-failure-classifiers.ts:117-121`). So the expected cause chain at :71 probably gains the `no credential was obtained for github.com; ...` line. See Open Question 1. [VERIFIED by code reading; the exact rendered row is ASSUMED until the scenario runs]
- Every scenario under the base override (nearly all others) keeps byte-identical output, because those sources already had stored-credential bundles (GHB-02).

## 4. Scenario and test inventory, and the scenarios the phase needs

### 4a. Existing scenarios that use or assert Device Flow

`features/marketplace/device-flow.feature` (394 lines; `Feature: Marketplace device flow`). Its Background is `Given the user's ssh is denied for "github.com"`:

| # | Line | Scenario | Disposition |
|---|---|---|---|
| 1 | :18 | Adding a private GitHub marketplace signs in through Device Flow and clones it | **Rewrite** (SG-AUTH-01/03): a pre-stored `x-access-token` credential for github.com (`credential.helper=store`); add succeeds; a single `cascade` result with no `device-flow-prompt` row; `pi routes these github requests:` shows only `CONNECT github.com:443`; store still holds the entry. |
| 2 | :59 | Updating a marketplace after a Device Flow sign-in uses the stored token without signing in again | **Rewrite** (SG-AUTH-03 update): the same pre-stored entry; update `skipped up-to-date`; no sign-in. |
| 3 | :87 | Outline: a sign-in that GitHub answers with access_denied / expired_token fails ... | **Delete**; replace with the interactive no-credential scenario (4b, fails without the change). |
| 4 | :133 | Installing a plugin from a private GitHub source with no cached clone signs in through Device Flow | **Rewrite** (SG-AUTH-01/03 install): a pre-stored entry; install succeeds, `clone note ssh-not-configured`, no prompt row. |
| 5 | :176 | Installing a pinned GitHub plugin whose clone is already cached makes no request and does not sign in | **Keep**, minus the `github's sign-in ...` steps. |
| 6 | :203 | A terminal session of a sign-in scenario sends the background update's GitHub requests to the git host | **Keep**, retitled (no "sign-in"); swap to `pi runs with github's requests routed to the git host`. |
| 7 | :223 | The background update of a private GitHub marketplace with no stored credential does not sign in | **Keep** (SG-AUTH-02 background; regression pin: today already no Device Flow, D-3-04). |
| 8 | :245 | The background update of a private GitHub marketplace fetches with the stored GitHub credential | **Keep** (SG-AUTH-03 background). |
| 9 | :268 | Adding a GitHub marketplace whose host rejects the stored credential fails as authentication required and removes the credential (AUTH-07) | **Rewrite**: retitle so the erase is git's own (`store` helper on 401). The HTTPS attempt text becomes `github.com rejected the stored credential` (§3); re-capture the cause-chain cell by running it. |
| 10 | :303 | After the GitHub host rejected the stored credential, the next add signs in through Device Flow again (AUTH-07) | **Delete**. |
| 11 | :346 | Adding a private GitHub marketplace in pi's print mode refuses with the remedy ... (MODE-04) | **Rewrite** (SG-AUTH-02 print, fails without the change): `pi's print mode exits with code 0 and prints nothing` (Pi gap, as #12); project scope unchanged; no sign-in request routed. |
| 12 | :370 | Applying a config that declares a private GitHub marketplace in pi's print mode adds nothing ... (MODE-04, JDOC-02) | **Keep**, minus the sign-in steps. |

Other files:
- `features/marketplace/github-transport.feature:157-179`, "Adding a private github marketplace in pi's print mode whose ssh clone fails shows the sign-in remedy, not both attempts (MODE-04)". It expects ``Extension error (command:claude:plugin): Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.`` [VERIFIED: :166-169]. **Rewrite**: both transports are now tried and print mode prints nothing. This rewrite also fails without the change.
- `features/marketplace/github-refresh.feature:57-75`: **row update** if Open Question 1 resolves as recommended.
- No other feature names `github's sign-in` (grep: only `device-flow.feature` and `github-transport.feature`).
- Pinned by the base override and untouched: `features/marketplace/git-source.feature:149-413` (stored-credential, rejected, 403 hint, project helper never asked), `features/plugin/git-source.feature:301`.

**Name and place.** The rewritten file is no longer about Device Flow. Per `.agents/skills/cucumber/rules/layout.md` ("`Feature: <Function> <capability>` is `features/<function>/<capability>.feature`"), rename it, for example `features/marketplace/credentials.feature` (`Feature: Marketplace credentials`). Put install scenarios in a plugin feature if the planner prefers one function per file, for example `features/plugin/git-credentials.feature`. [ASSUMED naming]

### 4b. New scenarios to add (map to the CONTEXT `<specifics>`)

"Fails without the change" means the scenario is red on HEAD.

| Req | Scenario (title sketch) | Fails without change? | Key assertions |
|---|---|---|---|
| SG-AUTH-02 | Adding a private GitHub marketplace with no stored credential fails as authentication required with no device code (interactive / json command) | **Yes**: HEAD sends `POST https://github.com/login/device/code` (routed or refused, logged) and shows a `device-flow-prompt` row | `the command reports these results:` holds one `cascade` row; `pi routes these github requests:` holds only `CONNECT github.com:443` rows; git host `401` GET(s); ssh launches; scope unchanged. |
| SG-AUTH-02 | Print-mode add (rewrite #11 / github-transport:157) | **Yes** | prints nothing; exit 0; scope unchanged. |
| SG-AUTH-02 | A load with `autoapply` on, for a config that declares a private GitHub marketplace with no credential, finishes without waiting and adds nothing | No (regression pin: the load is already stored-credential only, `auth-host.ts:212-217`) | trigger the load in the `When` (e.g. `/claude:plugin reload`, RELOADCMD-D1) so the harness window covers it; no sign-in route; marketplace stays pending. |
| SG-AUTH-02 | Background autoupdate (keep #7) | No (pin) | `the tui session reports no notice`; two `401` GETs; only CONNECT rows. |
| SG-AUTH-01 | A private GitHub marketplace add and a plugin install with a credential helper that answers (`credential.helper=store`, or a user-configured helper stand-in modeling gh/GCM) | No (pin) | succeeds; no prompt row; helper entry still present. |
| SG-AUTH-01 | With only `GITHUB_TOKEN` and `GH_TOKEN` set and no helper, adding a private GitHub marketplace fails as authentication required, and the token is in no result, no request the git host received, and no ssh argv | No (pin; the extension reads no token variable today) | `no result of the command contains "<token>"` (exists, `command.steps.ts:316`); a new `no request the git host received carries "<token>"` (scans path and every header); `the user's ssh receives these launches:` table holds no token; the git host table shows only unauthenticated `401` GETs. |
| SG-AUTH-01 | SSH key or agent | Covered by Phase 4: `features/marketplace/github-transport.feature:6` and `features/plugin/github-transport.feature:16` (ssh authenticates -> clones over ssh, no prompt). Reference them in VALIDATION; no new scenario needed. | — |
| SG-AUTH-03 | A Device-Flow-shaped entry (`https://x-access-token:<tok>@github.com` in the sandbox store) keeps working for install and update (rewrites #1/#2/#4/#8) | No (pin) | success rows; store unchanged. |
| SG-AUTH-03 | After an auth failure the extension saw, the stored Device Flow token is still in the helper | No (pin) | Use a failure that does **not** send the stored credential and get a 401. Otherwise git's `store` helper erases it (D-SG-14 outcome note, PROJECT.md:2610). Recommended: a second marketplace on github.com that the git host answers 404 (`repository-not-found`, classified `authentication required` as in `github-refresh.feature:71`) while the token stays valid for the first; then `the user's git credential store holds these credentials:` still lists the entry. Rewritten #9 documents git's own erase on 401. |

**Unit/architecture proofs that back SG-AUTH-01/03:**
- Optional, recommended: remove `"credential"` from `GitSubcommand` (`platform/git-process.ts:150,394`) and drop `GitRequest.input`. Then no extension code can run `git credential reject`/`approve`/`fill`, and the compiler enforces it. Cost: re-sample `test/platform/git-process.test.ts` (it uses `credential fill` as its generic request in about 30 places, e.g. :58, :694, :849, :1215-1579).
- An architecture test asserting that no extension source reads `GITHUB_TOKEN`, `GH_TOKEN`, or `GITLAB_TOKEN` from `process.env` (the only textual hit at HEAD is the MCP denylist string `"OVERRIDE_GITHUB_TOKEN"`, `domain/claude-credential-denylist.ts:201`). It can live beside `no-credential-leak.test.ts`. [ASSUMED: test location]

### 4c. Harness changes

- **Keep** `features/lib/github-device-flow/{connect-proxy.ts,extension.ts,routing.ts}`. The step `pi runs with github's requests routed to the git host` (and its env-variable form) uses them in `features/marketplace/{github-refresh,github-transport}.feature` and `features/plugin/{github-transport,github-transport-apply,github-transport-update}.feature` (60+ scenarios). The world refuses a profile Pi without the override unless it has the CONNECT proxy (`features/support/world.ts:885-893`, 03-SECURITY F-5). The proxy is not "kept only for Device Flow". It keeps every no-override system git on this machine.
- **Delete** `features/lib/github-device-flow/server.ts` (the sign-in stand-in, `DEVICE_FLOW_LOG`, `readPollScript`, `readDeviceFlowRequests`, `GitHubDeviceFlow`). First **move** `listenOnLoopback` (`server.ts:105`), which `connect-proxy.ts:29,151` imports.
- `routing.ts`: drop `signIn` from `RedirectConfig` and the `/login/` branch (`routing.ts:6-54`). Every https github.com request then routes to the git host and is logged, so a Device Flow request would still show in `pi routes these github requests:`. Update `test/architecture/github-device-flow-redirect.test.ts`.
- `features/step_definitions/git-host.steps.ts`: delete `github's sign-in answers its polls with these outcomes:` (:373-385), `pi runs with github's requests routed to the stand-ins` (:418-424), `github's sign-in receives these requests:` (:498-510), and `github's sign-in receives no request` (:512-514), plus their imports (:36-52). `check:features` fails on an unused step, so remove each step with its last use. Fix the header comment (:14-19) and the comment at :387-392.
- `features/step_definitions/marketplace/device-flow.steps.ts`: its three steps (`the user has stored a credential for github.com ...`, `the user's git credential store holds these credentials:`, `... holds no credentials`) are about the user's git credentials, not Device Flow. Move them beside `the user has stored a credential for the git host ...` in `git-host.steps.ts:270-284`, and delete the module.
- `features/support/github-device-flow.ts`: the `BeforeStep` window covers the redirect log too. Keep it, and rename it (for example `github-redirect.ts`) if the lib directory is renamed. `world.ts:346-347` names it.
- New capability: the git host must record request headers. `GitHostRequest` has only `method`, `path`, and `status` (`features/lib/https-git-host/server.ts:101-110`). Add a recorded header set, or at least `authorization`, and a step that asserts no request's path or header holds a given text.
- New capability: token variables for a profile Pi. `profilePiVariable` accepts only `GIT_SSH_COMMAND`, `GIT_SSH`, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, and `CLAUDE_CODE_REMOTE` (`git-host.steps.ts:441-458`). Allow `GITHUB_TOKEN`/`GH_TOKEN`, or add a table form, since both must be set. These values reach Pi's env only. The shared run Pi never gets them.
- Optional rename of `features/lib/github-device-flow/` -> `features/lib/github-redirect/`, because the layout rule says a library name is its vertical. It touches `git-host.steps.ts:28-52`, `world.ts:48`, the two architecture tests, and the CONVENTIONS.md suppression list (`extension.ts:258` carries `fallow-ignore-next-line unused-export` and moves with the file).
- Tests never reach a real host or a real ssh. The redirect refuses non-loopback hosts. The proxy tunnels only `github.com:443` to the git host's `127.0.0.1` port (`connect-proxy.ts:1-20`). The ssh stand-in comes first on PATH. This container has no `ssh` at all. [VERIFIED: `command -v ssh` printed nothing]

## 5. Records and docs to amend (locations at HEAD)

**`.planning/PROJECT.md`** (amend in place with a dated pointer to D-SG-27; add D-SG-27/28/29 rows near D-SG-26 at :2622):
- :43-49, :63-64, :76-78: milestone context naming the open Device Flow question; record the answer.
- :237, :1059, :1300: shipped-feature lists naming "GitHub Device Flow sign-in". These are history; add "(removed by D-SG-27)" or leave as history.
- :608: any-git-host target feature "`github.com` / `gitlab.com` keep Device Flow."
- :945: AUTH-D02 provider registry.
- :1714, :1733, :1764: validated lists (GAUTH-03..06, PROV-01..05, "On-demand Device Flow for private GitHub sources").
- :1895: "every host without Device Flow uses the stored credential".
- :1955: **NFR-5** text: "... with stored credentials only (D-PL8-01, D-PL8-12)" becomes "git runs non-interactively with what the machine holds". Mirror it in **`AGENTS.md:60`**, which carries the same NFR-5 text: "The background autoupdate pass ... with stored credentials only (D-PL8-01, D-PL8-12)".
- :2016: D-79-03 amended ("no-provider cause line only on the update path's synthetic child row"): every host is now "no-provider".
- :2038: D-UTR-05 (keep the fetch-backed Device Flow adapter private).
- :2075: D-1-01 ("every host gets an auth bundle; the registry gates only Device Flow").
- :2086: D-MF-01 / GHB-02 (override disables Device Flow).
- :2095: **AAP-D1** (restate: an autoapply load runs non-interactive git with what the machine holds).
- :2175: **D-PL5-07** (`hosted-manifest-fetch.ts` "is the only new `fetch` caller"): it becomes the only `fetch` caller.
- :2234: **D-PL8-12** "the pass uses stored credentials only, with no Device Flow".
- :2251: D-PL9-11 ("four files import `node:child_process`" names `platform/git-credential.ts`). This text is already stale versus the rule pack; reword.
- :2409-2411: D-BG-01/02/03 (Device Flow stand-in, redirect).
- :2452-2456: **D-BG-1101**, **D-BG-1102**, D-BG-1103, D-BG-1105.
- :2610: **D-SG-14** (interim) -> superseded by D-SG-27.
- **D-79-04 / D-79-05** have no rows in PROJECT.md. They are cited at :2452 and :2610, and defined in archived milestones (`.planning/milestones/v1.19-quick-tasks/260814-a7m-.../`, `.planning/milestones/behavioral-gaps-phases/11-device-flow-sign-in/11-CONTEXT.md`). Amend the citing rows. Do not edit archives.
- "GAUTH rows" exist only as the validated-list items above (:608, :1714, :1895); GAUTH-01..06 are defined in `.planning/milestones/ws-git-hosts-2026-10-01/...` archives.

**`.planning/codebase/*.md`:**
- `STACK.md:80`: "`git credential` included".
- `ARCHITECTURE.md:75` (Platform row "git-credential helper"), :121 (domain purpose: "`domain/github-auth.ts` is the domain's one global `fetch` caller"), :123, :144 (platform contents `git-credential.ts`, `git-one-shot-credential.ts`, git-process importers), :146 (`orchestrators/auth-host.ts` as platform user), :173 (load flow: "with stored credentials only and no Device Flow (`orchestrators/auth-host.ts`)"), :236 (NETWORK_SEAMS count 19 and names), :237 (rule-pack `fetch` exemptions), :270 (**Authentication** paragraph).
- `CONVENTIONS.md:19` (`createCredentialOps`, `createDeviceFlowHttp`, `createCredentialOpsFake`, `createDeviceFlowFake` examples), :68 (`fetch-chokepoint ... all but domain/github-auth.ts`), :70 (suppression list paths if the harness dir is renamed).
- Also stale after the phase: `INTEGRATIONS.md:12-18,37-38` (provider registry, client IDs), `STRUCTURE.md:62,72,84`, `TESTING.md:114,117,133,139,146` (fake registry rows for `CredentialOps` and `DeviceFlowHttp`), and `CONCERNS.md:41-42` (that concern disappears).

**User docs:**
- `README.md:246` (NOTE: "If Git is not already authenticated, a private repository will trigger Device Flow authentication.") and `README.md:202` ("A load never asks you to sign in. If a clone needs a credential that you have not stored, its row fails, and `/claude:plugin apply` can then ask you to sign in."). Same lines in `README.es.md:246` and `:202`. Edit both files together per the `readme` skill.
- `CHANGELOG.md` `## [Unreleased]`: one reader-facing bullet per the `changelog` skill. It says Device Flow is gone and how to authenticate now: `gh auth login` + `gh auth setup-git`, GCM, or an ssh key, and for GitLab `glab auth setup-git` (D-SG-29). It says how to remove the old token by hand: `printf 'protocol=https\nhost=github.com\nusername=x-access-token\n\n' | git credential reject`, or the keychain UI; for GitLab `host=gitlab.com`, `username=oauth2` (`auth-registry.ts:99`). It also says that a GitLab Device Flow token expires after about 2 hours and that the `device-flow-prompt` JSON kind is gone.
- `docs/json-output.md` (§1d) and `docs/output-catalog.md` (§1d).
- `docs/env-vars.md:317`: no Device Flow text found; no change needed.

## 6. Plan decomposition that keeps `npm run check` green

Facts that drive the ordering:
- `test:corresponding` pairs every production `.ts` with one `test/<same path>.test.ts` (`scripts/check-corresponding-tests.mjs:7-37`). Delete a module and its test together. `*-fake.test.ts` and contracts under `test/{domain,platform}` are unpaired (`package.json:117`). Delete them with the fake.
- fallow production dead-code fails on an unused export or an unreachable file. So `github-auth.ts`/`auth-registry.ts` must be deleted in the same plan in which `auth-host.ts` stops importing them, and `notifyDeviceFlowPrompt` in the same plan in which its one production caller goes.
- `DeviceFlowHttp` (type) lives in `github-auth.ts` and is imported by 19 orchestrators. Removing the threading first makes the engine deletion narrow.
- `check:features` fails on an unused step, so each step goes with its last scenario.
- `no-test-only-production-surface` requires each classified seam to exist. Remove the rows with the members.
- Excess-property checks bite on explicit literals (`credentialOps: opts.credentialOps` at `install-outcome.ts:681-683`). A callee's option and its callers' literals must change in the same plan.

**Recommended plans:**

| Plan | Wave | Scope | User-visible? | Files (est.) |
|---|---|---|---|---|
| 05-01 Marketplace verbs stop threading credentials | 1 | `marketplace/add.ts`, `marketplace/update.ts` lose `credentialOps`/`deviceFlowHttp`/`authMemo` options and `authArgs`; the auth-host builders get `{ctx, run}` and default internally (`DEFAULT_CREDENTIAL_OPS`, real HTTP; `update.ts:542` already makes a fresh memo per refresh); `install-outcome.ts:681-683` stops passing them to the add body; tests `add.test.ts`, `update.test.ts`, `test/integration/marketplace-add-seed-mirrors.test.ts`, `marketplace-layer-remove.test.ts`, `no-test-only-production-surface.test.ts` (4 rows); delete the orchestrator-level Device Flow cases in those tests (they can no longer inject HTTP). | No | ~9 |
| 05-02 Plugin verbs stop threading credentials | 2 (after 05-01; shares `install-outcome.ts`) | the 17 `orchestrators/plugin/*.ts` files of §1b + their tests; `fetch.ts:198` disable reason; `auth-host.ts` builder signatures lose the auth fields. **Memo note:** without `authMemo`, one command with several clones to the same registry host could prompt more than once until 05-03 lands. No scenario pins multi-clone sign-ins except the memo tests that this plan deletes. Acceptable as an interim inside the phase branch (A4). | No (interim) | ~35 (mechanical; split into two tasks: install family / update+fetch+info+reinstall family) |
| 05-03 Device Flow removed (behavior) | 3 | `auth-host.ts` stored-credential only; delete `domain/github-auth.ts`, `domain/auth-registry.ts` + tests/fakes/contract; `DeviceFlowUnavailableError` + `stopsTheClone` branch + tests; `device-flow-prompt` kind across 6 `shared/notification-*` files + 6 tests + `catalog-wire`/`json-output-docs`/`wire-schema` + `schema/claude-plugin.schema.json` + `docs/json-output.md` + `docs/output-catalog.md`; edge prompt tests; rule-pack `fetch-chokepoint` exclude/message + `no-network-modules` message; `NETWORK_SEAMS` -2; `CREDENTIAL_LEAK_TARGETS` -2 (github-auth, auth-registry) + leak tests :438/:502/:531/:618 + `PROVIDER_FILES`; harness (delete `server.ts` after moving `listenOnLoopback`, routing `signIn` removal, sign-in steps, move credential-store steps); rewrite `device-flow.feature` into the credentials feature(s) + `github-transport.feature:157` + `github-refresh.feature:71` row (OQ1) + the new SG-AUTH-01/02/03 scenarios and their harness capabilities (header recording, token variables). | **Yes** | ~45 (split into tasks: production+unit / gates+schema+docs / harness+features) |
| 05-04 Credential protocol and retry removed | 4 | `GitAuthBundle` -> `{ host }` in `platform/git.ts`; delete `platform/git-credential.ts`, `platform/git-one-shot-credential.ts` + tests + `credential-ops-*` fakes/contract; `git.ts` retry + D-SG-14 tests; `marketplace/shared.ts` import + `lacksStoredCredential`; `auth-host.ts` final shape (maybe leaves `NETWORK_SEAMS`); `GIT_PROCESS_IMPORTERS` -1 + `no-shell-out.test.ts`; `CREDENTIAL_LEAK_TARGETS` -3 (git-credential, one-shot, auth-host if it no longer handles a credential) + leak tests :382/:562/:658; test doubles (`git-ops-fake(.test)`, `shared.test`, `clone-swap.test`); bridges/hooks + `fs-utils.ts` comments; optional: drop the `credential` subcommand and `input` from git-process + re-sample `git-process.test.ts`. | No | ~25 (+1 large test if the git-process option is taken) |
| 05-05 Records and docs | 5 | PROJECT.md (D-SG-27/28/29 rows + amendments §5), AGENTS.md NFR-5 line, `.planning/codebase/*.md`, README.md + README.es.md, CHANGELOG.md, REQUIREMENTS.md checkboxes/traceability. Not a build input (README/CHANGELOG/.planning), so the hook skips `check:commit`; still run the phase gate. | Docs | ~12 |

Alternative ordering (behavior first, 05-03 before the threading plans) needs a placeholder `DeviceFlowHttp` type so the 19 importers still compile. That leaves dead surface between plans. Not recommended.

Parallelism: none of these plans can run in parallel, because each pair shares `auth-host.ts`, `install-outcome.ts`, or `git.ts`. Inside a plan, tasks can split by file family.

## Architecture Patterns

### Pattern 1: shrink a discriminated union to its surviving arm
**What:** Delete the `device-flow` arm and its fields; keep the type name so the ~60 type-only references (`clone-cache.ts`, `clone-swap.ts`, `update-flow.ts`, `git-ops-fake.ts`, ...) compile unchanged.
**When:** 05-04.

### Pattern 2: move a type to the zone that owns its consumer
`platform` may import only `shared` (`.fallowrc.json` boundaries; the reason `git-credential.ts:86-90` gives for declaring `AuthAttemptResult` in platform). Declare `GitAuthBundle` in `platform/git.ts` and keep the `orchestrators/marketplace/shared.ts:137` re-export, so non-seam orchestrators keep importing it without naming `platform/git` (BLOCK F).

### Pattern 3: positional gate registries change as a pair
`CREDENTIAL_LEAK_TARGETS` (`gate-targets.ts`) and its destructuring + `DECLARED_MODULE_ORDER` (`no-credential-leak.test.ts:78-112`) are edited in the same commit. The test pins the order (:353-357).

### Anti-Patterns to Avoid
- **Deleting the stored-credential arm with the Device Flow arm:** it changes GAUTH-04/D-1-02 output pinned by `git-source.feature`. Wording is Phase 6's.
- **Deleting the CONNECT proxy or the GitHub redirect:** Phase 4 transport features depend on them, and the world refuses a no-override Pi without the proxy.
- **Calling `git credential reject` "to clean up":** this violates D-SG-28 and Pitfall 14; a partial attribute set can match the user's own credential.
- **Removing a gate entry before its module:** the `fetch-chokepoint` exclude, `GIT_PROCESS_IMPORTERS`, and `NETWORK_SEAMS` entries are what let the still-present module pass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential lookup/storage | any extension-side `git credential` call or token store | the user's own git helpers via system git | upstream parity (E-SG-13); git already does fill/approve/reject per request |
| Token-in-env detection | reading `GITHUB_TOKEN`/`GH_TOKEN` | nothing (gh's helper reads them if the user set it up) | SG-AUTH-01 |
| Migration notice | a state flag "used Device Flow" | README/CHANGELOG only | D-SG-28; Pi stores no such record |
| Wire schema JSON | hand-editing `schema/claude-plugin.schema.json` | `npm run schema:generate` | `wire-schema.test.ts` compares committed vs generated |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Device Flow tokens in users' credential helpers: GitHub `protocol=https host=github.com username=x-access-token` (`auth-registry.ts:61`), GitLab `host=gitlab.com username=oauth2` (`auth-registry.ts:99`). `state.json` holds no credential field (gated by `no-credential-leak.test.ts:348`, `FORBIDDEN_STATE_FIELDS = /\b(password\|access_token\|githubToken\|gitToken)\b/i`). | **None in code** (never delete, D-SG-28). Docs tell users how to remove them by hand. |
| Live service config | The registered GitHub OAuth App (client ID `Ov23liNcyK08uGdU0mMl`, `auth-registry.ts:59`) and GitLab application (`auth-registry.ts:96`) stay registered on the hosts. Old extension releases keep using them. | None in this phase. The maintainer may decide later whether to retire them; revoking would break users on old releases. Flag for the user. |
| OS-registered state | None: the extension registers nothing with the OS. | None. |
| Secrets/env vars | No env var name changes. `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` keeps its meaning (the "disables Device Flow" side effect becomes moot). | Docs only. |
| Build artifacts | `schema/claude-plugin.schema.json` (published via `package.json` `files`) loses the `device-flow-prompt` member. Already-published npm versions keep Device Flow. | Regenerate the schema; note the removal in the CHANGELOG. |

## Common Pitfalls

### Pitfall 1: github.com joins the stored-credential hint path
**What goes wrong:** `github-refresh.feature:57-75` (and any no-override github update failure) gains the `no credential was obtained for github.com; ...` cause line.
**Why:** `lacksStoredCredential` keyed on `auth.kind === "stored-credential"` (`marketplace/shared.ts:297-304`), and every bundle becomes one.
**How to avoid:** decide Open Question 1 before 05-03; run the transport features in 05-03's verification.

### Pitfall 2: git's `store` helper erases a refused credential
**What goes wrong:** a scenario that asserts "the token stays stored" after a 401 fails, because git ran `credential reject`.
**How to avoid:** prove "the extension deletes nothing" with a failure that never sends the credential (404 on another repo), or with the compile-time removal of the `credential` subcommand.

### Pitfall 3: a gate entry outlives or predates its module
**Warning signs:** `policy-violation fetch-chokepoint` on `github-auth.ts`; an ESLint `import-x/no-restricted-paths` error on `git-credential.ts`; `no-credential-leak` "does not resolve" asserts (`:390`, `:416`, `:446`).
**How to avoid:** edit each entry in the plan that deletes its module (§1c).

### Pitfall 4: unused cucumber steps
`check:features` fails on an unused step. The sign-in steps go with the last sign-in scenario, and the moved credential-store steps must stay in use.

### Pitfall 5: the integration and coverage gates on huge test files
`install-flow-ledger.test.ts` (19,473 lines), `update-flow.test.ts` (16,539), `info.test.ts` (12,818). A removed case can leave a branch of the source uncovered, and direct coverage requires 100%. Example: the `authMemo ?? new Map()` defaults vanish with their tests, but so do the branches. Run `npm run test:coverage:direct -- <source>` for each touched source.

### Pitfall 6: the local git config in this cloud session
This session's git config rewrites URLs through `GIT_CONFIG_COUNT` (7 `GIT_CONFIG_*` variables are set here). Unset `GIT_CONFIG_COUNT` and every `GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` for unit tests that run real git. [VERIFIED: `env | grep -c ^GIT_CONFIG` = 7]

### Pitfall 7: `fd` missing in this container
The 5 Glob scenarios in `features/hook/tool-use.feature` (:296, :355, :443, :1696, :1834) always fail here. This is a known baseline, not a regression. [VERIFIED: `command -v fd` empty]

## Code Examples

### Host-only bundle builders (auth-host after 05-04)
```typescript
// orchestrators/auth-host.ts (after) -- sketch; function names are [ASSUMED], hostFromCloneUrl/NO_STORED_CREDENTIAL_CAUSE are verbatim at HEAD
import { GITHUB_HOST, gitHubOverrideHost, gitHubWireUrl } from "../shared/github-base-url.ts";

import type { GitAuthBundle } from "./marketplace/shared.ts";

export function cloneAuthFor(cloneUrl: string, kind: "url" | "git-subdir" | "github"): GitAuthBundle {
  if (kind === "github" || gitHubWireUrl(cloneUrl) !== cloneUrl) {
    return { host: gitHubOverrideHost() ?? GITHUB_HOST };
  }
  return { host: hostFromCloneUrl(cloneUrl, kind) };
}
```
`gitHubOverrideHost()` throws `InvalidGitHubBaseUrlError` for an invalid value today (`auth-host.ts:254-255`); keep that.

### Credential-store sandbox (existing harness arm)
```typescript
// features/step_definitions/git-host.steps.ts:84 (verbatim)
const CREDENTIAL_STORE_CONFIG = "[credential]\n\thelper = store\n";
// device-flow.steps.ts:24-28 (verbatim shape of a Device-Flow-style entry)
// ".git-credentials": `https://${login}@github.com\n`   where login = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| isomorphic-git + in-process `onAuth` + Device Flow | system git + user helpers; Device Flow after a failure + one-shot helper retry (D-SG-14, interim) | system-git Phase 3 (2026-11-23) | the interim this phase closes |
| D-SG-14 interim | no Device Flow; git uses only what the machine holds (D-SG-27) | this phase | parity with Claude Code (E-SG-12/13) |

**Deprecated/outdated after this phase:** `AUTH-01..09` Device Flow requirements, `PROV-01..05` provider registry, `DFLOW-01..04`, the `device-flow-prompt` JSON kind, `DeviceFlowUnavailableError` (print-mode refusal text).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `github-refresh.feature:71` gains the `NO_STORED_CREDENTIAL_CAUSE` line after the change (exact rendered position unknown until run) | §3, OQ1 | a red scenario in 05-03; low (re-capture the row) |
| A2 | Removing a whole JSON kind keeps `schemaVersion: 1` (docs/json-output.md:164 lists only field removal as a bump) | §1d | a consumer-facing version policy question; confirm with the user |
| A3 | fallow tolerates a rule `exclude` that names a deleted file (unmeasured) | §1c | moot if the entry goes with the file, as recommended |
| A4 | Losing `authMemo` between 05-02 and 05-03 breaks no scenario (Device Flow still runs; multi-clone sign-ins are pinned only by unit memo tests that 05-02 deletes) | §6 | a red device-flow scenario in 05-02. Mitigation: merge 05-02 and 05-03, or keep `authMemo` until 05-03 |
| A5 | Feature file names (`features/marketplace/credentials.feature`, `features/plugin/git-credentials.feature`), the harness rename `github-redirect`, the new step texts, and the env-read architecture test location | §4 | naming only |
| A6 | A user-configured helper stand-in (`features/lib/user-git-programs.ts` `credential-helper`, today only asserted "never run") can model gh/GCM for SG-AUTH-01 | §4b | fall back to `credential.helper=store` |
| A7 | git sends a URL's userinfo as an `Authorization` header, so header recording on the git host catches a token in a URL as well as in a header | §4b | git's standard behavior; low |

## Open Questions

1. **Should github.com (no override) show the D-1-02 hint after Device Flow is gone?**
   - What we know: after the change every bundle is stored-credential, and `lacksStoredCredential` matches any `authentication required` failure, including a both-transports failure whose last attempt is `ssh-auth`.
   - What's unclear: whether the maintainer wants the hint added to more rows in Phase 5, given that Phase 6 owns hint wording and upstream shows none.
   - Recommendation: accept it in 05-03. It is the existing GAUTH-04 rule applied uniformly, the reason class does not change, and Phase 6 revisits every hint. Update `github-refresh.feature:71`'s cause-chain cell. The alternative (skip the hint when the failure is a `GitHubTransportsFailedError`) changes rule semantics in Phase 5 and needs its own decision.
2. **Remove the `credential` git subcommand and `GitRequest.input` (compile-time "never runs git credential")?**
   - Recommendation: yes, in 05-04, as its own task. It is the strongest proof of "the extension deletes no stored credential", at the cost of re-sampling `git-process.test.ts`.
3. **Does `auth-host.ts` stay in `NETWORK_SEAMS`?**
   - Recommendation: no, if it imports `GitAuthBundle` from `orchestrators/marketplace/shared.ts`. Update ARCHITECTURE.md's seam count.
4. **The GitHub OAuth App and GitLab application registrations** (Runtime State Inventory): out of scope for code; ask the maintainer whether to keep them for old releases.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all checks | ✓ | v24.22.3 | — |
| git | git host stand-in, `store` helper, product | ✓ | 2.43.0 | — |
| cucumber-js, fallow, eslint, tsc | `npm run check` | ✓ | repo-pinned | — |
| `/opt/pi-claude-marketplace/bin` | cucumber command PATH prefix | ✓ (holds `node`) | — | — |
| ssh | none (tests use the ssh stand-in) | ✗ | — | stand-in (intended) |
| fd | 5 Glob scenarios in `features/hook/tool-use.feature` | ✗ | — | known baseline failure, not a regression |
| CodeGraph index | research/edits | ✓ (`.codegraph/`) | — | grep |

**Missing dependencies with no fallback:** none for this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` (unit/architecture/integration); `@cucumber/cucumber` (behavioral, `adapter` and `builtin` profiles) |
| Config file | `package.json` scripts; `cucumber.json`; `.fallowrc.json`; `rule-packs/architecture.json`; `eslint.config.js` |
| Quick run (one unit file) | `env -u GIT_CONFIG_COUNT $(env \| sed -n 's/^\(GIT_CONFIG_\(KEY\|VALUE\)_[0-9]*\)=.*/-u \1/p') node --import "$PWD/scripts/isolated-pi-home.mjs" --test <test-path>` |
| One pair's coverage | `npm run test:coverage:direct -- <source-or-test-path>` |
| One feature | `PATH="$PWD/node_modules/.bin:/opt/pi-claude-marketplace/bin:$PATH" node scripts/cucumber.mjs --profile adapter <feature-path>` (repeat with `--profile builtin`) |
| Static gate | `npm run check:static` (includes `check:features`, `test:corresponding`, fallow rule-pack WARN check) |
| Commit gate | `npm run check:commit` (hook; not a GSD gate) |
| Full suite (GSD gates) | `npm run check` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SG-AUTH-01 | helper credential -> private add + install succeed, no prompt | cucumber | `node scripts/cucumber.mjs --profile adapter features/marketplace/credentials.feature features/plugin/git-credentials.feature` | ❌ new (05-03) |
| SG-AUTH-01 | `GITHUB_TOKEN`/`GH_TOKEN` only -> `authentication required`; token in no result, no git-host request (path/headers), no ssh argv | cucumber | same | ❌ new + harness header capture |
| SG-AUTH-01 | ssh key/agent -> no prompt | cucumber (existing) | `... features/marketplace/github-transport.feature features/plugin/github-transport.feature` | ✅ |
| SG-AUTH-01 | no extension source reads token env vars | architecture | `node --import ... --test test/architecture/<env-token>.test.ts` | ❌ new (05-03 or 05-04) |
| SG-AUTH-02 | interactive add with no credential: no device code, no `/login/` request | cucumber (fails on HEAD) | credentials feature | ❌ new |
| SG-AUTH-02 | print mode: no Device Flow refusal, prints nothing, scope unchanged | cucumber (fails on HEAD) | `features/marketplace/github-transport.feature` + credentials feature | ✅ rewrite |
| SG-AUTH-02 | autoapply load and background autoupdate never wait | cucumber (pins) | credentials feature (background scenarios moved from device-flow.feature) | partly ✅ |
| SG-AUTH-02 | no Device Flow code remains: `fetch` only in hosted-manifest-fetch; no `device-flow-prompt` kind | fallow rule pack + wire-schema + json-output-docs | `npm run fallow`; `node --import ... --test test/architecture/wire-schema.test.ts test/architecture/json-output-docs.test.ts` | ✅ edit |
| SG-AUTH-03 | Device-Flow-shaped store entry works for add/install/update/background update | cucumber | credentials feature | ✅ rewrite |
| SG-AUTH-03 | entry still stored after an auth failure the extension saw (404 path) | cucumber | credentials feature | ❌ new |
| SG-AUTH-03 | the extension cannot run `git credential` | unit/type (if OQ2 taken) | `npm run typecheck`; `node --import ... --test test/platform/git-process.test.ts` | ✅ edit |
| GAUTH-04 kept | refused helper credential -> `StoredCredentialRejectedError`; no-credential -> plain `https-auth` | unit | `node --import ... --test test/platform/git.test.ts` | ✅ edit |
| GAUTH-04 / D-1-02 kept | hint and rejection rows under the override | cucumber (existing) | `... features/marketplace/git-source.feature features/plugin/git-source.feature` | ✅ |
| no leak | positional leak gate after shrink | architecture | `node --import ... --test test/architecture/no-credential-leak.test.ts` | ✅ edit |

### Sampling Rate
- **Per task commit:** the owner test of each touched source (quick run) plus `npm run test:coverage:direct -- <source>`. The hook's `npm run check:commit` runs on commit. For a harness or feature task, also run the touched feature(s) under the `adapter` profile.
- **Per plan (before SUMMARY):** `npm run check:static`, plus the affected cucumber directories under both profiles: `features/marketplace`, `features/plugin` (the transport features especially), and `features/mcp-server/verdict-fetch.feature` if git paths changed.
- **Per wave merge / phase gate:** `npm run check` on the combined tree. Accept only the known `fd` baseline failures (5 scenarios in `features/hook/tool-use.feature`).

### Wave 0 Gaps
- [ ] git host header recording + `no request the git host received carries {string}` step (`features/lib/https-git-host/server.ts`, `features/step_definitions/git-host.steps.ts`): needed by SG-AUTH-01. Land it with its first scenario (unused steps fail `check:features`).
- [ ] profile-Pi token variables (`GITHUB_TOKEN`, `GH_TOKEN`) in `profilePiVariable` or a table step.
- [ ] `listenOnLoopback` moved out of `features/lib/github-device-flow/server.ts`.
- [ ] architecture test for token-variable reads (optional, recommended).

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (delegated) | system git + the user's helpers; the extension authenticates nothing itself after this phase |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (unchanged) | SG-PRC-01 operand rules in `platform/git-process.ts`; `--end-of-options` |
| V6 Cryptography | no (removed: OAuth token handling) | — |
| V7 Error handling / logging | yes | `redactCredentials` (`shared/redact-credentials.ts`, used by `GitCommandError`/transport messages), AUTH-09 leak gates |
| V8 Data protection | yes | no token in `state.json` (`FORBIDDEN_STATE_FIELDS` gate) |

### Surface that disappears
- OAuth `fetch` to `https://github.com/login/device/code`, `https://github.com/login/oauth/access_token`, `https://gitlab.com/oauth/authorize_device`, `https://gitlab.com/oauth/token` (`auth-registry.ts:55-58,94-95`). `fetch-chokepoint` then admits only `platform/hosted-manifest-fetch.ts`.
- The extension minting a `repo`-scope (GitHub) or `read_repository` (GitLab) token and storing it with `git credential approve`.
- The one-shot helper file holding a token for one git run (`platform/git-one-shot-credential.ts`: a 0600 file removed after the run, per PROJECT.md:2610).
- The extension's only `git credential` subprocess (`NODE_CREDENTIAL_GIT`, `git-credential.ts:152-161`).
- The in-memory per-command token memo (`authMemo`).
- The device-code prompt surface over the JSON/RPC strategy.

### What must stay
- No token in a URL, header, argv, output, debug line, or `state.json`. Keep `redactCredentials`, the JSON/RPC leak cases, and the state-write scan in `no-credential-leak.test.ts`. Keep the `git-process.ts` scan (:408), which covers stdout/stderr and run input.
- No credential deletion by the extension (D-SG-28); optionally made structural (OQ2).
- D-SG-05 non-interactive env on every git command (`platform/git-process.ts:320-328`): no prompt in any mode, including autoapply loads and the background pass (NFR-2).
- D-1-03: a bundle maps only a failure of a request to its own host (`bundleOrigin`), so a refusal on one host is never reported as another's.
- Containment and the neutral directory (SG-PRC-03): a repository's own `credential.helper` is never consulted (`git-source.feature:183-197` pins it).

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token from env leaks into a URL/header/argv | Information disclosure | the extension never reads token env vars; architecture test; cucumber header/output scan |
| The extension wipes a user's own credential with a partial `reject` | Tampering / DoS | no `git credential` call at all (OQ2); docs-only removal guidance |
| A background or load-time prompt hangs Pi | DoS | D-SG-05 env; no Device Flow; scenario pins |
| A stale Device Flow token stays usable by every git on the machine | Information disclosure (residual) | documented manual removal (D-SG-28); the user's choice |
| A repository's own helper is consulted | Elevation | the neutral directory + ceiling (unchanged) |

## Sources

### Primary (HIGH confidence; read at HEAD this session)
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` (full), `platform/git-credential.ts` (full), `platform/git.ts:1-30, 260-430, 1110-1128`, `platform/git-process.ts:1-60, 140-180, 340-400, 1030-1050`, `shared/git-failure-classifiers.ts:1-160`, `shared/errors.ts:1-16, 575-600, 1440-1490`, `orchestrators/marketplace/{shared.ts:270-320, clone-swap.ts:270-370, update.ts:515-615}`, `orchestrators/plugin/update-flow.ts:280-345`, `domain/github-transport.ts:55-147`, `domain/auth-registry.ts:50-100`, `shared/notification-types.ts:1875-1925`, `shared/notification-wire.ts:700-730`
- `eslint.config.js:30-120`, `rule-packs/architecture.json:110-174`, `test/architecture/{gate-targets.ts:140-180, no-credential-leak.test.ts:1-720, no-shell-out.test.ts:40-125, no-test-only-production-surface.test.ts:175-215, wire-schema.test.ts:80-180}`
- `features/marketplace/device-flow.feature` (full), `features/marketplace/github-transport.feature:130-185`, `features/marketplace/github-refresh.feature:55-76`, `features/marketplace/git-source.feature:330-420`, `features/step_definitions/git-host.steps.ts` (1-30, 180-300, 355-566), `features/step_definitions/marketplace/device-flow.steps.ts` (full), `features/support/{world.ts:170-200, 340-352, 875-900, 1436-1455, github-device-flow.ts}`, `features/lib/github-device-flow/{connect-proxy.ts:1-80, extension.ts:1-60, routing.ts, server.ts:1-40}`, `features/lib/https-git-host/server.ts:95-120, 625-660`
- `docs/json-output.md:95-110, 160-165, 455-480, 1000-1010`, `docs/output-catalog.md:5268-5295`, `README.md:198-206, 236-275`
- `.planning/PROJECT.md` (rows cited in §5), `.planning/REQUIREMENTS.md:49-53`, `.planning/research/FEATURES.md:204-251`, `.planning/research/PITFALLS.md:330-345`, `.agents/skills/{local-verification,cucumber}/SKILL.md`, `.agents/skills/local-verification/rules/commands.md`, `.agents/skills/cucumber/rules/layout.md`

### Secondary (MEDIUM)
- git's credential-helper behavior (helpers asked per request; `reject` after a 401 with a helper credential): FEATURES.md E-SG-12 and PITFALLS.md Pitfall 14 [MEM, MEDIUM there], corroborated by the observed AUTH-07 scenario (`device-flow.feature:268-301`, store emptied with no extension `reject` call) and the D-SG-14 outcome note (PROJECT.md:2610).

### Tertiary (LOW)
- None used for decisions.

## Metadata

**Confidence breakdown:**
- Deletion/edit surface: HIGH. Grep plus reading every value edge at HEAD.
- Surviving behavior (stored-credential arm): HIGH. Code read; the one output change (A1) is flagged.
- Plan decomposition: MEDIUM-HIGH. The ordering follows the measured import graph; file counts are estimates.
- Harness design for the new scenarios: MEDIUM. The capabilities are missing and must be built (header capture, token variables).

**Research date:** 2026-11-27
**Valid until:** 2026-12-11 (fast-moving branch; re-grep at plan time if more than a few commits land)
