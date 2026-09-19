---
phase: 05-production-export-ownership
plan: "21"
subsystem: infra
tags: [fallow, dead-code, git, isomorphic-git, auth, credentials, typescript]

requires:
  - phase: 05-production-export-ownership
    provides: "The exact production finding census and its offender/benign controls (05-01), and the Wave 9 stable snapshot (05-18, 05-20)"
provides:
  - "platform/git-auth-callbacks.ts owns the complete git authentication-callback protocol"
  - "platform/git.ts publishes no auth-callback factory and no branch/remote enumeration wrappers"
  - "createCredentialOps takes its launcher and timeout as required collaborators and is production-consumed"
  - "orchestrators/auth-host.ts owns the one concrete DEFAULT_CREDENTIAL_OPS binding"
  - "Four census identities removed with zero additions: live production total 7 -> 3"
affects: [05-28, phase-06-unused-type-member-gate]

actuals:
  tokens: 17151
  tasks: 3
  commits: 2
plan_head_before: a1624b5af5b81b9013f1065bd761784ee5578278

tech-stack:
  added: []
  patterns:
    - "Coherent-concern module split: a whole protocol (types + state machine) moves to one platform module with a real production importer, rather than one module per helper"
    - "Required-collaborator factory: removing the `??` defaults from a factory keeps its only concrete binding visible at the composition owner and leaves no unreachable default branch behind"
    - "Published narrow launcher: `NODE_CREDENTIAL_SPAWN` lets a composition owner name the production process launcher without acquiring the `node:child_process` import that D-21 confines to one module"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - tests/platform/git-auth-callbacks.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/platform/git-credential.ts
    - extensions/pi-claude-marketplace/platform/README.md
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/platform/git.test.ts
    - tests/platform/git-credential.test.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/integration/auth-e2e.test.ts

key-decisions:
  - "GitCredentials stays declared in platform/git.ts. Two domain modules and five test files import it from there, none of which this plan owns; the new module type-imports it, which is the same type-only sibling edge platform/git.ts <-> platform/git-credential.ts already carried and which fallow reports as neither a cycle nor a duplicate export."
  - "platform/git.ts re-exports OnAuthRequiredFn because its three option bundles name it; orchestrators/marketplace/shared.ts keeps reading the seam from the module whose options it threads."
  - "createCredentialOps takes spawn and timeoutMs as REQUIRED fields. Keeping them optional would leave the `?? spawn` default branch reachable only from a binding that no longer lives in that module, so the direct pair would stop covering it."
  - "DEFAULT_CREDENTIAL_OPS moves to orchestrators/auth-host.ts, which already re-exported it and is already the host-keyed auth composition owner. The two marketplace verbs that read it from the platform module now read it from the composition owner, which is where the four plugin verbs already read it."
  - "Tasks 1 and 2 landed as one commit: the pre-commit chain runs npm typecheck, so a declaration move and its importer repoints cannot be split without an uncompilable intermediate commit."

patterns-established:
  - "A moved protocol carries its docstring discipline with it, minus any claim the gate registry no longer backs: the new module states the AUTH-09 obligation as a rule it must hold and does NOT claim a scan covers it, because none does yet."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "platform/git-auth-callbacks.ts owns buildAuthCallbacks, its input bundle and the onAuthRequired seam types; git.ts consumes the factory in clone, fetch and resolveRemoteRef"
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts (39/39 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts (branches 13/13, functions 3/3, lines 177/177)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The branch and remote enumeration wrappers and their option types are retired with no-caller evidence, behind TS2578-discriminating missing-export proofs"
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "npm run typecheck (exit 0 with four @ts-expect-error proofs live in tests/platform/git.test.ts)"
        status: pass
      - kind: other
        ref: "codegraph explore + grep over extensions, tests, scripts, eslint.config.js, .fallowrc.json, package.json, sonar-project.properties: no production importer"
        status: pass
    human_judgment: false
  - id: D3
    description: "createCredentialOps is production-consumed by orchestrators/auth-host.ts, which binds the Node launcher and an explicit 5000 ms timeout into DEFAULT_CREDENTIAL_OPS without launching a process"
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "node --test tests/platform/git-credential.test.ts tests/orchestrators/auth-host.test.ts (64/64 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/auth-host.ts (branches 18/18, functions 5/5, lines 169/169)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Four identities leave the production finding census with zero additions and the three 05-28 identities are unmoved"
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json: total_issues 7 -> 3, duplicate_exports 0, circular_dependencies 0, re_export_cycles 0"
        status: pass
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#The complete production finding census equals its committed identities (RED by design: 4 removals, 0 additions, parent-owned pin)"
        status: fail
    human_judgment: true
    rationale: "The two census equality gates are red by design until the parent applies its single Wave 10 pin edit; every task in this plan forbids editing tests/architecture/gate-targets.ts. The parent must confirm the reviewed delta on the stable wave snapshot."
  - id: D5
    description: "Per-gate verdict on whether the new module belongs to each architecture registry that names platform/git.ts or platform/git-credential.ts"
    verification: []
    human_judgment: true
    rationale: "The verdicts are findings for the parent, not an edit: gate-targets.ts is the parent-owned pin and this plan is forbidden from writing it. One verdict (CREDENTIAL_LEAK_TARGETS) asks the parent to widen a gate, which is a judgment about AUTH-09 coverage rather than a test result."

duration: 33min
completed: 2026-09-15
status: complete
---

# Phase 5 Plan 21: Git Authentication Callback and Credential Ownership Summary

**The complete git authentication-callback protocol now lives in `platform/git-auth-callbacks.ts`, the branch and remote enumeration wrappers are retired with caller evidence, and `DEFAULT_CREDENTIAL_OPS` is composed in `orchestrators/auth-host.ts` from `createCredentialOps`, a published Node launcher and an explicit 5000 ms timeout — four census identities leave with zero additions.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-15T03:02:06Z
- **Completed:** 2026-09-15T03:35:02Z
- **Tasks:** 3 (landed as 2 commits)
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` holds the whole concern: `AuthAttemptResult`, `OnAuthRequiredFn`, `BuildAuthCallbacksOpts` and the `buildAuthCallbacks` fill / device-flow / reject / cancel state machine. `platform/git.ts` imports the factory for `clone`, `fetch` and `resolveRemoteRef` and publishes none of it.
- `listBranches`, `listRemotes`, `ListBranchesOptions` and `ListRemotesOptions` are gone from `platform/git.ts` with no-caller evidence, and four missing-export proofs pin their absence.
- `createCredentialOps` now takes its process launcher and its timeout as required collaborators, `NODE_CREDENTIAL_SPAWN` publishes the real Node launcher, and `orchestrators/auth-host.ts` composes the single `DEFAULT_CREDENTIAL_OPS` binding from the two.
- Live production census **7 -> 3** with zero additions. The three survivors are exactly 05-28's.

## Task Commits

1. **Tasks 1 and 2: move the callback protocol, retire the listing wrappers, repoint every consumer** — `e5464690` (refactor)
2. **Task 3: compose the credential operations in the auth host** — `8ae97016` (refactor)

**Plan metadata:** see the `docs:` commit that carries this file.

Task 1 and task 2 landed as ONE commit rather than being reordered. Plan 05-18 met the same class of problem and solved it by reordering; that does not work here. Task 1 removes the `buildAuthCallbacks` declaration from `platform/git.ts` and task 2 repoints the importers, and no ordering of those two makes both intermediate states compile: the new module does not exist before task 1, and the old export is gone after it. The repository's pre-commit chain runs `npm typecheck`, so an uncompilable intermediate commit cannot be created at all. Merging is the only option that preserves both the gate and the plan's content.

Two edits inside commit 1 belong, on paper, to task 3's file list: `orchestrators/auth-host.ts`'s callback type import and its gate-discipline docstring. They moved with the declaration for the same reason — leaving them behind is a TS2305 at the task-1 commit.

## Files Created/Modified

**Created**

- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` — the auth-callback protocol: the two seam types, the input bundle and the `buildAuthCallbacks` factory.
- `tests/platform/git-auth-callbacks.test.ts` — the nine relocated callback cases and the `captureDebugLog` helper they need.

**Modified**

- `extensions/pi-claude-marketplace/platform/git.ts` — imports the factory, re-exports `OnAuthRequiredFn`, drops the protocol declarations and the two listing wrappers.
- `extensions/pi-claude-marketplace/platform/git-credential.ts` — required `spawn`/`timeoutMs`, new `NODE_CREDENTIAL_SPAWN`, no composed default.
- `extensions/pi-claude-marketplace/platform/README.md` — the `git.ts` export list and the new module's line.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` — owns `DEFAULT_CREDENTIAL_OPS`; callback types read from the new module.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,update}.ts` — read `DEFAULT_CREDENTIAL_OPS` from the composition owner.
- `tests/platform/git.test.ts` — callback cases and listing cases removed; four missing-export proofs added.
- `tests/platform/git-credential.test.ts` — explicit `timeoutMs`, launcher-identity and construction-purity cases, one missing-export proof.
- `tests/orchestrators/auth-host.test.ts` — the `DEFAULT_CREDENTIAL_OPS` composition case; callback imports repointed.
- `tests/orchestrators/marketplace/{add,update,shared}.test.ts`, `tests/orchestrators/plugin/fetch.test.ts`, `tests/integration/auth-e2e.test.ts` — import specifiers only; no test body changed.

## Census Identity Delta (for the parent's Wave 10 reconciliation)

Measured on the stable post-plan tree (no other writer was active):

```
node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json
```

`total_issues` **7 -> 3**. `duplicate_exports: 0`, `circular_dependencies: 0`, `re_export_cycles: 0`, `boundary_violations: 0`, `unused_types: 0`, `private_type_leaks: 0`.

### Removed — exactly four, all mine

| Census | Exact identity string |
| --- | --- |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/platform/git-credential.ts\|createCredentialOps` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/platform/git.ts\|buildAuthCallbacks` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/platform/git.ts\|listBranches` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/platform/git.ts\|listRemotes` |

`UNOWNED_EXPORT_CENSUS` loses **both** keys entirely:

- `"extensions/pi-claude-marketplace/platform/git-credential.ts": ["createCredentialOps"]` — its only member.
- `"extensions/pi-claude-marketplace/platform/git.ts": ["buildAuthCallbacks", "listBranches", "listRemotes"]` — all three members.

### Added — none

### Disposition evidence

- **`buildAuthCallbacks`** — DISPOSITION: relocated to a coherent-concern owner with a real production importer. `platform/git.ts` imports it as a value and calls it at three sites (`clone`, `fetch`, `resolveRemoteRef`). It is therefore no longer unowned; the implementation was live all along and only its export was.
- **`createCredentialOps`** — DISPOSITION: given a real composition consumer. `orchestrators/auth-host.ts` imports and calls it to build `DEFAULT_CREDENTIAL_OPS`. Privatizing it instead was rejected: `tests/platform/git-credential.test.ts` exercises the whole wire protocol through it with an injected process fake, and a private factory would leave `DEFAULT_CREDENTIAL_OPS` (a real `git credential` subprocess) as the only entry point.
- **`listBranches` / `listRemotes`** — DISPOSITION: retired, unreachable. Evidence: `codegraph explore` reports no caller outside `platform/git.ts` and `tests/platform/git.test.ts`; `grep -rn` over `extensions`, `tests`, `scripts`, `eslint.config.js`, `.fallowrc.json`, `package.json` and `sonar-project.properties` finds only the declaration, the removed tests and a `platform/README.md` line (updated in the same commit). Neither appears in the `GitOps` interface the orchestrators inject, so no injected seam reached them either. Their exclusive option types `ListBranchesOptions` and `ListRemotesOptions` went with them — the transitive-orphan case plan 05-19 met, closed in-plan rather than handed to the parent as an addition.

### New exports introduced, and why none is a finding

| New export | Production consumer on the same commit |
| --- | --- |
| `git-auth-callbacks.ts::buildAuthCallbacks` | `platform/git.ts` (value import, three call sites) |
| `git-auth-callbacks.ts::BuildAuthCallbacksOpts` | its own `buildAuthCallbacks` signature |
| `git-auth-callbacks.ts::OnAuthRequiredFn` | `git-auth-callbacks.ts`, `platform/git.ts` (three option bundles + re-export), `orchestrators/auth-host.ts` |
| `git-auth-callbacks.ts::AuthAttemptResult` | `git-auth-callbacks.ts`, `orchestrators/auth-host.ts` (and its own re-export, which six plugin orchestrators read) |
| `git-credential.ts::NODE_CREDENTIAL_SPAWN` | `orchestrators/auth-host.ts` |
| `git.ts::OnAuthRequiredFn` (re-export) | `orchestrators/marketplace/shared.ts` |
| `auth-host.ts::DEFAULT_CREDENTIAL_OPS` | `orchestrators/marketplace/{add,update}.ts`, `orchestrators/plugin/{info,reinstall-flow,update-preflight,install-outcome}.ts` |

The measured report confirms it: zero additions, and `duplicate_exports: 0` despite `git.ts` re-exporting a type the new module declares.

### The three 05-28 identities did NOT move

Measured before and after, unchanged in both readings:

```
unused_exports|extensions/pi-claude-marketplace/index.ts|default
unused_files|scripts/check-phase-06-hub-ledger.mjs
unused_class_members|extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts|RingBuffer|read|class_method
```

Nothing in this plan touched `index.ts`, the hub-ledger script, `.fallowrc.json` or `ring-buffer.ts`.

## Architecture Gate Coverage: per-gate verdicts for the new module

Requested finding, not an edit. `tests/architecture/gate-targets.ts` is untouched by this plan.

Every registry that names `platform/git.ts` or `platform/git-credential.ts`:

| Registry | Consuming gate | Names | Should `git-auth-callbacks.ts` be added? |
| --- | --- | --- | --- |
| `CREDENTIAL_LEAK_TARGETS` | `no-credential-leak.test.ts` | both | **YES — and this is the one real coverage loss.** |
| `ZONE_REPRESENTATIVE_TARGETS` | `import-boundaries.test.ts`, `eslint-effective-config.test.ts` | `platform/git.ts` | **No.** |
| `SHELL_OUT_EXEMPT_TARGETS` | `no-shell-out.test.ts` | `git-credential.ts` | **No.** |
| `NETWORK_FREE_TARGETS` | `no-orchestrator-network.test.ts` | `platform/git` as a forbidden IMPORT | **No — and coverage already extends automatically.** |
| `UNOWNED_EXPORT_CENSUS` / `PRODUCTION_FINDING_CENSUS` | `unowned-exports-census.test.ts` | both | **No — the new module has no finding.** |

**`CREDENTIAL_LEAK_TARGETS` — YES, with a caveat about how to do it.** The gate's test `AUTH-09: platform/git.ts hookDebugLog calls never interpolate a credential field` exists specifically because `buildAuthCallbacks` routes failure reasons through `hookDebugLog`, a call form no other scan in that file covers. All three `hookDebugLog` calls moved to `git-auth-callbacks.ts`; `platform/git.ts` now contains zero (`grep -c hookDebugLog` returns 0). That test still passes, over a file with nothing left to catch, and the module that actually holds the credential-adjacent logging is scanned by nothing. This is exactly the silent narrowing the parent asked about.

The caveat: `CREDENTIAL_LEAK_TARGETS` is destructured **by position** in `no-credential-leak.test.ts`, and that file asserts its own `DECLARED_MODULE_ORDER` against the registry. So the fix is not a one-line registry append — it needs, in the same edit: the new path in the registry, a matching binding and `DECLARED_MODULE_ORDER` entry in `no-credential-leak.test.ts`, and a `hookDebugLog` scan aimed at the new module (the existing `platform/git.ts` aim can be kept as a "stays clean" assertion or retired, deliberately either way). Also logged to `deferred-items.md`.

**`ZONE_REPRESENTATIVE_TARGETS` — No.** It is one representative per entry in `ZONE_FOLDER_TARGETS`, resolved positionally (8 folders, 8 representatives), and its own doc says members are "chosen for being long-lived owners of their layer rather than for anything they contain". A ninth entry would break the per-zone pairing without testing anything new; the platform zone's rules already resolve through `platform/git.ts`. The new module is inside `extensions/pi-claude-marketplace/platform/**`, which is how `.fallowrc.json` and the ESLint zone config select it, so both zone gates already govern it.

**`SHELL_OUT_EXEMPT_TARGETS` — No, and adding it would weaken the gate.** That list is a closed whitelist of modules ALLOWED to import `node:child_process`; the gate's value depends on the set being exhaustive and minimal. `git-auth-callbacks.ts` does not import it, so it is correctly covered as an ordinary walked file that must not.

**`NETWORK_FREE_TARGETS` — No, and the coverage extends for free.** That registry lists orchestrator-tier modules; the new module is platform-tier, where git surface legally lives. Its forbidden pattern is `/from\s+["'][^"']*platform\/git[^"']*["']/`, which already matches `platform/git-auth-callbacks.ts` — so a gated orchestrator importing the new module fails today with no registry change. Verified: `orchestrators/auth-host.ts` is NOT in `NETWORK_FREE_TARGETS` (it is in `CREDENTIAL_LEAK_TARGETS` only), which is why it may keep its type-only import of the new module.

## Assertion Ledger

Per the plan's per-task requirement: every original assertion is accounted for.

### Task 1 — the callback protocol move

**Relocated byte-identical (9 cases, `describe("buildAuthCallbacks")`).** Moved from `tests/platform/git.test.ts` to `tests/platform/git-auth-callbacks.test.ts` with their bodies unchanged — same arrange, act and assert statements, same fixture credentials, same expected debug-log strings. The only edit is the import specifier of `buildAuthCallbacks`, `OnAuthRequiredFn` and `AuthAttemptResult`. Preserved by this move:

| Original assertion | Where it lives now |
| --- | --- |
| stored credential returned, `fill` called once, no `approve`/`reject` | `git-auth-callbacks.test.ts` "returns a stored credential without requesting interactive auth" |
| interactive credential returned after a fill miss | "returns the interactive credential after a credential miss" |
| three exact device-flow failure reasons each produce `{ cancel: true }` plus one exact `[auth] onAuth: Device Flow failed for …` line | "cancels and logs the interactive-auth failure …" (3 parameterised cases) |
| a throwing `fill` produces `{ cancel: true }` plus one exact `[auth] onAuth threw for …` line | "cancels when credential lookup throws" |
| a throwing `onAuthRequired` produces the same pair | "cancels and logs when interactive auth throws" |
| `onAuthFailure` rejects the interactive credential and cancels | "rejects an interactive credential and cancels the operation" |
| `onAuthFailure` rejects a stale credential with no prior auth, and the store is emptied | "rejects a stale credential and cancels without prior auth" |
| a throwing `reject` still cancels and logs one exact `[auth] onAuthFailure: reject() threw for …` line | "cancels and logs when stale-credential rejection throws" |

**Retained in `git.test.ts` (transport behaviour, unchanged).** Every clone / fetch / resolveRemoteRef case stays, including the two that prove the callbacks are wired end-to-end through isomorphic-git: `clone` "retries an auth challenge with callbacks built from the supplied bundle" and `fetch` "forwards an explicit remote, ref, and auth bundle" both still assert the exact `Authorization: Basic dXNlcjpzZWNyZXQ=` header on the retry request and the exact `credentials.calls` ledger. `resolveRemoteRef` keeps "keeps auth callbacks idle for a successful public response" and "retries an authentication challenge with the exact credential header". The `GitOps` contract registration and the `GitCredentials` type-only check are untouched.

**Retired with their implementation (4 cases).** These asserted only the retired wrappers and have no public survivor, because the operation itself is gone:

| Retired assertion | Why no replacement |
| --- | --- |
| "lists local branches in deterministic order" (`["feature", "main"]`) | `listBranches` is retired; no production path enumerates branches. |
| "lists branches for an explicit remote" (`["main"]`) | same |
| "lists configured remotes as complete values" | `listRemotes` is retired; no production path enumerates remotes. |
| "lists remotes from an explicit git directory" (poisoned worktree + explicit `gitdir`) | same — the `gitdir` override existed only on the retired options type. |

**Added (4 compiler proofs, 0 runtime cases).** `typeof GitPlatform.buildAuthCallbacks`, `typeof GitPlatform.listBranches`, `typeof GitPlatform.listRemotes`, `GitPlatform.ListBranchesOptions` and `GitPlatform.ListRemotesOptions` (5 directives) each use the repaired idiom `void ({} satisfies { readonly retired?: … })` under `@ts-expect-error`. Restoring any one export makes its `satisfies` resolve and turns its directive into TS2578.

### Task 2 — consumer migration

**Zero assertions changed.** Five files changed by import specifier only: `tests/integration/auth-e2e.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/fetch.test.ts` and (a deviation, see below) `tests/orchestrators/marketplace/shared.test.ts`. Every `buildAuthCallbacks(...)` call, every credentials-result assertion, every retry/rejection sequence and every AUTH-09 redaction check is byte-identical. No hermetic callback test was replaced by a live auth service.

### Task 3 — credential composition

**Preserved unchanged in `git-credential.test.ts`:** the complete wire-format case (exact `protocol=https\nhost=…\n\n` input bytes, `command`/`args`, `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `stdio`, `inputEnded()`); both exit-discrimination cases (non-zero exit, null exit code); both missing-field cases; the launch-failure, timeout-SIGTERM and timeout-cleared cases; the approve and reject wire-request cases including the absent-field omission; both approve/reject swallow cases; and the whole 31-case `registerCredentialOpsContract` set covering fill/approve/reject semantics and all 21 control-character validation cases. The only edit to these bodies is `timeoutMs: DEFAULT_TIMEOUT_MS` becoming explicit where the removed default used to supply it — the value is unchanged at 5000 ms, and the three cases that already passed `timeoutMs: 50` are untouched.

**Added (3 cases).**

| New case | What it asserts, and why it is not trivial |
| --- | --- |
| `git-credential.test.ts` "runs the real Node launcher for the production credential subprocess" | `NODE_CREDENTIAL_SPAWN` is identically `node:child_process`'s `spawn`. This is the assertion that keeps the published launcher honest: a wrapper, a bound function or a different API would fail it. |
| `git-credential.test.ts` "binds the collaborators without launching a process" | Construction with a recording launcher yields exactly `["fill", "approve", "reject"]` and records zero launches — the plan's "construction must not spawn a process" obligation, proved against the factory. |
| `auth-host.test.ts` "composes the platform credential protocol without launching a process" | `DEFAULT_CREDENTIAL_OPS` has the same key set as an explicit `createCredentialOps({ spawn, timeoutMs: 5_000 })` composition, and composing records zero launches. This is the binding test the plan asked to preserve, in the shape `marketplace/shared.test.ts`'s `DEFAULT_GIT_OPS` binding test already uses. |

**One missing-export proof added:** `typeof GitCredentialPlatform.DEFAULT_CREDENTIAL_OPS`, same repaired idiom.

**Non-interactive guarantee preserved.** `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` are still set inside `gitCredentialIO`, which was not touched; the "fills a credential from the complete git wire response" case still asserts both on the recorded spawn options. The 5000 ms timeout survived the move as `CREDENTIAL_TIMEOUT_MS` in `auth-host.ts`.

## Verification Commands and Results

Every command below ran in the FOREGROUND. No backgrounded or piped-compound run is the source of any claim here.

| Command | Result |
| --- | --- |
| `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts` (task 1) | **39 tests, 39 pass, 0 fail** |
| `node --test tests/integration/auth-e2e.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/fetch.test.ts` (task 2) | **153 tests, 153 pass, 0 fail** (per file: 3 / 63 / 60 / 27) |
| `node --test tests/platform/git-credential.test.ts tests/orchestrators/auth-host.test.ts` (task 3) | **64 tests, 64 pass, 0 fail** |
| `npm run typecheck` | exit 0 |
| `npx eslint extensions tests scripts eslint.config.js` | exit 0 |
| `npx prettier --check "extensions/**/*.ts" "tests/**/*.ts"` | "All matched files use Prettier code style!" |
| `npm run fallow` | exit 0 (dead-code: no issues; health: 0 above threshold; dupes: not above the gate) |
| `npm run test:corresponding` | Corresponding-test gate passed |
| `npm test` (full unit) | **6266 tests, 6264 pass, 2 fail** — the two failures are exactly the parent-owned census equality gates |
| `npm run test:integration` | **32 tests, 32 pass, 0 fail**, exit 0 |
| `SKIP=trufflehog pre-commit run --files …` (before each of the two commits) | all hooks Passed, no file rewritten |

**Unit count reconciliation against the 6267 baseline.** 6267 - 4 + 3 = 6266. The four are the retired branch/remote listing cases; the three are the launcher-identity, construction-purity and composition cases. The nine relocated callback cases are a move, not a change in count.

**The two failures, named.** `tests/architecture/unowned-exports-census.test.ts` — "The complete production finding census equals its committed identities" and "D-07-19 / GGAT-04: the production-unowned-export census equals its committed pin". Both diff exactly the four identities this plan removed and nothing else. Red by design; the parent applies one pin edit.

### Direct coverage — every changed production module

| Module | Reading |
| --- | --- |
| `platform/git.ts` | branches 36/36, functions 9/9, lines 305/305 |
| `platform/git-auth-callbacks.ts` | branches 13/13, functions 3/3, lines 177/177 |
| `platform/git-credential.ts` | branches 43/43, functions 18/18, lines 329/329 |
| `orchestrators/auth-host.ts` | branches 18/18, functions 5/5, lines 169/169 |
| `orchestrators/marketplace/add.ts` | branches 130/130, functions 13/13, lines 909/909 |
| `orchestrators/marketplace/update.ts` | branches 124/124, functions 17/17, lines 885/885 |

Every pair reads hit == found; the existing pin is unchanged and no shortfall was introduced. Aggregate production unit coverage was deliberately **not** measured here — 05-VALIDATION assigns it to the parent once per stable wave.

## Decisions Made

See the `key-decisions` frontmatter. The two worth reading in full:

**Why `GitCredentials` did not move.** It is the isomorphic-git-facing credential shape, imported from `platform/git.ts` by `domain/github-auth.ts`, `domain/auth-registry.ts` and five test support files — none of which this plan owns. Moving it would have forced edits across two domain modules. It stays declared in `git.ts`; `git-auth-callbacks.ts` type-imports it. That creates a type-only sibling edge in the same shape `platform/git.ts` <-> `platform/git-credential.ts` already carried before this plan, and the measured report confirms fallow reports `circular_dependencies: 0` and `re_export_cycles: 0`.

**Why the factory's defaults were removed rather than kept.** `createCredentialOps` used `options.spawn ?? (spawn as CredentialSpawn)` and `options.timeoutMs ?? 5_000`. The only caller that ever took those defaults was the module-level `DEFAULT_CREDENTIAL_OPS` in the same file. Once that binding moved out, the default branches would be reachable only from another module — so `npm run test:coverage:direct -- platform/git-credential.ts` would have gone from 43/43 branches to a shortfall, which D-01 forbids repairing with a threshold change. Making both required removes the branches instead of leaving them uncovered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `orchestrators/marketplace/{add,update}.ts` import repointed — production files outside the plan's owner set**

- **Found during:** Task 3
- **Issue:** The task requires removing the composed default from `platform/git-credential.ts`. Two marketplace verbs imported `DEFAULT_CREDENTIAL_OPS` from that module directly, so the removal is a TS2305 in both. Neither file is in the plan's `files_modified`, and 05-CONTEXT forbids editing an owner a plan does not declare.
- **Fix:** Changed the import specifier only, in both files, to `../auth-host.ts`. No other line, and no behaviour, changed. This also removes an inconsistency: the four plugin verbs (`install-outcome`, `info`, `reinstall-flow`, `update-preflight`) already read the constant from `auth-host.ts`; these two were the outliers.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
- **Verification:** `npm run typecheck` exit 0; both files' owner suites pass (63/63 and 60/60); both direct pairs read 130/130 and 124/124 branches with no pin change; no import cycle (`orchestrators/marketplace/shared.ts` does not import either verb, and fallow reports `circular_dependencies: 0`).
- **Committed in:** `8ae97016`

**2. [Rule 3 - Blocking] `tests/orchestrators/marketplace/shared.test.ts` import repointed — test file outside the plan's owner set**

- **Found during:** Task 1
- **Issue:** `AuthAttemptResult` moved to the new module. That file imported it from `platform/git.ts`, so the move is a TS2305. Keeping a `git.ts` re-export for it was rejected: its only remaining reader would be a test, which would turn the re-export into a fresh production finding — a census ADDITION, the one thing the wave must not produce.
- **Fix:** Changed the type-import specifier only. No test body changed.
- **Files modified:** `tests/orchestrators/marketplace/shared.test.ts`
- **Verification:** `npm run typecheck` exit 0; the file's suite runs inside the passing full unit run.
- **Committed in:** `e5464690`

**3. [Rule 1 - Bug] `platform/README.md` advertised the retired wrappers**

- **Found during:** Task 1
- **Issue:** The README's `git.ts` line listed `pull`, `listBranches` and `listRemotes` as exposed. `pull` was already absent before this plan; `listBranches` and `listRemotes` were retired by it. Leaving the line would have been a false statement about the module.
- **Fix:** Replaced the list with the seven operations `git.ts` actually exposes and added a line for the new module. The file's pre-existing planning-artifact references (`Phase 1`, `Phase 7`, `Phase 31`) were left alone as out of scope.
- **Files modified:** `extensions/pi-claude-marketplace/platform/README.md`
- **Verification:** mdformat and markdownlint-cli2 pass in the pre-commit run.
- **Committed in:** `e5464690`

**4. [Rule 2 - Missing critical, logged not fixed] The new module is outside the AUTH-09 credential-leak gate**

- **Found during:** Task 1
- **Issue:** See the per-gate section above. The `hookDebugLog` scan aimed at `platform/git.ts` now reads a file with zero such calls, and the module that holds them is scanned by nothing.
- **Fix:** Not applied. `tests/architecture/gate-targets.ts` is the parent-owned pin and every task forbids editing it; `no-credential-leak.test.ts`'s positional destructuring means the fix spans two files. The module is clean today. Logged to `deferred-items.md` with the exact multi-file fix, and reported to the parent above.
- **Committed in:** n/a (finding, not a change)

**5. [Process] Tasks 1 and 2 merged into one commit**

- **Found during:** Task 1
- **Issue:** The plan's three tasks imply three commits. Task 1 removes a declaration and task 2 repoints its importers; no ordering of the two produces two compiling states, and the pre-commit chain runs `npm typecheck`, so the uncompilable intermediate cannot be committed at all.
- **Fix:** Merged, with the reason recorded here and in the Task Commits section. 05-18 solved its version of this by reordering; that option does not exist for a declaration move.
- **Committed in:** `e5464690`

---

**Total deviations:** 5 — 3 auto-fixed blocking/bug (2 import repoints outside the owner set, 1 stale doc), 1 missing-critical logged rather than fixed (parent-owned registry), 1 process (commit granularity).
**Impact on plan:** No scope creep and no weakening. Every task's files, action and verify command was executed as written; the two out-of-owner edits are import specifiers with zero behaviour change, forced by the plan's own removals.

## Known Stubs

None. No placeholder value, empty return, TODO or FIXME was introduced.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or trust-boundary schema was added. The plan's `<threat_model>` dispositions were honoured:

- **T-05-21-01 (tampering, `platform/git.ts`)** — mitigated: every validation, error, state and byte assertion named above is preserved or explicitly ledgered, and callers were traced with CodeGraph plus a repository-wide grep before either export was removed.
- **T-05-21-02 (repudiation, census evidence)** — mitigated: exact identity strings recorded above, measured from the shipping gate's own report on the stable tree; the pin is untouched.
- **T-05-21-03 (information disclosure, test filesystem/subprocess boundaries)** — mitigated: every credential fixture is an obvious fake (`stored`/`secret`, `x-access-token`/`token-1`, `stale`/`expired`), no test reaches a live credential store or network, and the two new construction tests use a recording launcher that throws rather than spawning.

## Issues Encountered

None. The tree was green on entry as stated, and every failure observed during execution was one I had just introduced and fixed immediately: one TS2305 from the `AuthAttemptResult` move (fixed by repointing `auth-host.ts`), one `@stylistic/padding-line-between-statements` error in a new test (fixed), and one stray indentation left by a scripted deletion in `git.test.ts` (fixed before any gate ran).

## Next Phase Readiness

**Blocking for the parent:** the Wave 10 census reconciliation must remove exactly the four identities listed above from `tests/architecture/gate-targets.ts` — which empties both `platform/` keys of `UNOWNED_EXPORT_CENSUS` — and must re-measure on the stable snapshot rather than trusting the reading above, exactly as 05-VALIDATION requires. After that edit the two census gates go green and the pin names exactly 05-28's three identities.

**Also for the parent:** the `CREDENTIAL_LEAK_TARGETS` decision. It is the only finding in this plan that asks for a judgment rather than a mechanical pin update.

**Ready for 05-28** (Wave 11, the final plan): the census is down to the three identities it owns, and none moved under this plan. Nothing here touched `.fallowrc.json`, `scripts/check-phase-06-hub-ledger.mjs`, `index.ts` or `ring-buffer.ts`.

Aggregate production unit coverage was deliberately not measured here; 05-VALIDATION assigns it to the parent on the stable wave snapshot.

## Self-Check: PASSED

Both created production/test files and the summary exist on disk
(`[ -f ]`), and all three commits resolve in `git log --oneline --all`:
`e5464690`, `8ae97016` and `ea64ee8b`. The measured commit count over
`a1624b5a..HEAD` at summary-write time was 2 production commits, which is
the `commits:` value recorded in the frontmatter; this metadata commit is
the third and is not counted there.

---

_Phase: 05-production-export-ownership_
_Completed: 2026-09-15_
