---
phase: 02-git-process-seam-and-typed-failures
verified: 2026-11-23T20:45:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-01-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-01-SUMMARY.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-02-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-02-SUMMARY.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-03-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-03-SUMMARY.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-04-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-04-SUMMARY.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-05-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-05-SUMMARY.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-06-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-06-SUMMARY.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-07-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-07-SUMMARY.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-08-PLAN.md"
  - ".planning/phases/02-git-process-seam-and-typed-failures/02-08-SUMMARY.md"
  - "eslint.config.js"
  - "extensions/pi-claude-marketplace/platform/git-credential.ts"
  - "extensions/pi-claude-marketplace/platform/git-failure-kind.ts"
  - "extensions/pi-claude-marketplace/platform/git-neutral-directory.ts"
  - "extensions/pi-claude-marketplace/platform/git-process.ts"
  - "extensions/pi-claude-marketplace/platform/git.ts"
  - "extensions/pi-claude-marketplace/platform/package-manager.ts"
  - "extensions/pi-claude-marketplace/platform/process-run.ts"
  - "extensions/pi-claude-marketplace/shared/errors.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
  - "features/marketplace/without-git.feature"
  - "features/plugin/without-git.feature"
  - "rule-packs/architecture.json"
  - "test/architecture/gate-targets.ts"
  - "test/architecture/no-shell-out.test.ts"
  - "test/platform/git-process.test.ts"
covered_digest: "v4:sha256:288a58299e78302eaa33e30606cd0eb7e8bd55fd37498d8272da846a94842fc2"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run the 02-08 Task 2 manual check on a real Mac: git absent or only the xcrun shim on PATH, then a git-source `marketplace add`; also a Mac with Command Line Tools installed."
    expected: "The user sees `git is not installed on this Mac. To install it, run xcode-select --install, then try again.`; no Command Line Tools installer window opens; a real git behind the shim runs normally."
    why_human: "The shim check reads DEVELOPER_DIR, /var/db/xcode_select_link, and /Library/Developer/CommandLineTools. Claude Code's build does not show which files it reads, so this is an assumption that only a Mac confirms. Unit cases use a fake host (WINDOWS #120, T-02-40)."
  - test: "Run the same check on a real Windows host: no git, `git.cmd` only, a git inside Pi's working directory, and a git hung by a helper at timeout."
    expected: "A clear git-required message; a cwd or `.cmd`/`.bat` git is refused; no console window or credential dialog appears; taskkill /T /F leaves no git, helper, or ssh process after a timeout."
    why_human: "The Windows lookup, the `windowsHide` setting, and the taskkill tree kill are proven only with an injected platform and a fake host (WINDOWS #120 and #121, T-02-40, T-02-41)."
---

# Phase 2: Git Process Seam and Typed Failures Verification Report

**Phase Goal:** Every git process the extension starts, and the SSH probe, starts from one platform module that cannot prompt, hang, run code from a cloned repository, reach the network on a local lane, or act on the user's own project repository. A git failure reaches its caller as a typed error with a kind, and a user with no usable git gets a clear message.
**Verified:** 2026-11-23T20:45:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

## Scope read

The orchestrator named intentional limits, and I judged against ROADMAP Phase 2 only:

- The product still clones with isomorphic-git. In production, system git runs only `git credential` (through `NODE_CREDENTIAL_GIT`), the lookup, and the git-required gate on the four network verbs of `platform/git.ts`.
- The local lane and the new subcommands have no production caller yet.
- The SSH probe lands in Phase 4. The module is the chokepoint for it.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The `child-process-chokepoint` rule names the git process module. Every git launch goes through it with an argument array, no shell, closed stdin, and `--end-of-options` before marketplace data. Rule pack, `no-shell-out.test.ts`, `gate-targets.ts`, and the ESLint zones changed with it. | VERIFIED | `rule-packs/architecture.json` `child-process-chokepoint` excludes exactly five files, `platform/git-process.ts` first. No other production file calls `spawn`, `execFile`, or `fork`: grep finds only `process-run.ts` (an injected launcher), `prompt-shell.ts`, and the hooks bridge, which were sanctioned before. `git-credential.ts` no longer spawns and calls `NODE_GIT_PROCESS.run` (line 102). `git-process.ts` passes `SUBCOMMAND_RULES` operand rules (`--end-of-options` via `optionsThenMarker`; `checkout` refuses a leading `-` and ends with `--`; `rev-parse` needs `--verify`), `shell: false`, and `input` written then closed through `runProcess`. ESLint `GIT_PROCESS_ZONE` and `GIT_PROCESS_IMPORTERS` exist (`eslint.config.js:39-44, 309-312, 579, 593`), and `no-shell-out.test.ts` pins the zone against six importers. `gate-targets.ts:174,227` lists the module. 662 targeted tests passed. |
| 2 | A command against a remote that asks for a password, a passphrase, or an unknown host key fails without a prompt and within its timeout. A timeout leaves no git, helper, or ssh process behind. | VERIFIED | `FORCED_VARIABLES` sets `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS`, and `GCM_INTERACTIVE=never` over the user's values. `PIN_PAIRS` sets `credential.interactive=false`. The ssh wrapper appends `BatchMode=yes` and `StrictHostKeyChecking=yes` (or `-batch` for plink and putty) to the user's own command. `process-run.ts` runs `detached` and kills the group (`taskkill /T /F` on Windows). Real-git cases in `describe("createGitProcess without prompts or leftovers")` pass: https password rejects as `https-auth` with an askpass script that must not run (E10); unknown host key rejects as `ssh-host-key-unknown` (E16); a timed-out https command (E9) and a timed-out ssh (E8) leave no process. The sandbox has no ssh binary, so the ssh cases use stand-ins (not skipped; 0 skipped). |
| 3 | A checkout with a hook or an fsmonitor command runs neither. An `ext`, `fd`, `git`, `ftp`, or `ftps` URL is refused. `GIT_DIR` and its kin change nothing. A clone directory with no `.git` under `<cwd>/.pi/` fails rather than act on the user's project repository. A local-lane command fails rather than reach the network. | VERIFIED | Real-git tests pass: E5 runs neither a hook nor fsmonitor (line 2548), E5 and E6 copy and run no template hook (2581), the `ext::` command is refused under a user protocol list that names `ext` (2431), other banned operands are refused under allowing config (2468), `GIT_DIR` and `GIT_WORK_TREE` change nothing (2633). E1 and E2 (2660-2685) run system git from a clone directory inside the user's project repository, first without Pi's ceiling (it finds the project's HEAD), then through the module, which rejects `not-a-repository` with exit 128. They repeat the case through a symlink from outside. E2b shows the project's `url.insteadOf` is ignored. Local lane: E3 refuses a local-lane fetch under the user's `protocol.*.allow=always` (2195); a plain-path fetch works on the network lane (2213). The ceiling is `dirname(cwd)` (`gitEnvironment`), and `safe.bareRepository=explicit` rides every command. |
| 4 | Each git failure reaches its caller as a typed error whose kind is read from git's exit status and its C-locale stderr. No caller narrows on an error name or message substring. | VERIFIED | `GitCommandError` (`shared/errors.ts:1353`) carries a closed `GitFailure` union and a readonly `kind`, and extends `Error` with `{ cause }` passthrough. `platform/git-failure-kind.ts` holds an ordered, anchored row table over `LC_MESSAGES=C` stderr (remote lines are stripped before matching, except the proxy row). `settleRun` maps `aborted`, a start error, `timeout`, and a non-allowed exit to a kind. The `git-too-old` path logs the git version once. `shared/git-failure-classifiers.ts:192` narrows with `instanceof GitCommandError` and a total kind-to-reason table. `add.ts:325,1339` narrows by `instanceof` and `kind`. No production code compares `name === "GitCommandError"` (grep: none). The older isomorphic-git name matchers stay on purpose until Phase 3 (CONTEXT). |
| 5 | With no usable git, a git-source `marketplace add` or plugin install says git is required (xcode-select form on macOS). Path-source and hosted marketplaces still add and install. Cucumber scenarios pin each case. | VERIFIED (macOS wording is human_needed) | `platform/git.ts` calls `NODE_GIT_PROCESS.locate()` first in `clone`, `fetch`, `resolveRemoteRef`, and `listRemoteTags` (lines 574, 621, 697, 769). A missing git rejects with `git-missing`, which maps to the new `{git missing}` reason (D-SG-07; `notification-types.ts:311`, `notification-wire.ts:167`, `git-failure-classifiers.ts:244`). The cause line is `Git is required to install marketplaces.`, and `git is not installed on this Mac. To install it, run xcode-select --install, then try again.` for `macos-shim` (`errors.ts:1386`). `features/marketplace/without-git.feature` has 7 scenarios: url and github adds fail as `git missing` with no request and no config written, and dir, file, and hosted adds succeed. `features/plugin/without-git.feature` has 4 scenarios: github, url, and git-subdir plugins fail, and a local plugin installs. Per the orchestrator's gate, these pass in the cucumber run. |

**Score:** 5/5 truths verified. Items that need a real macOS or Windows host are listed below.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git-process.ts` | One hardened git launch module | VERIFIED | 1170 lines of real logic: lookup, builder, lanes, ssh wrapper, operand rules, deadline, backstop. Consumed by `git.ts` (gate) and `git-credential.ts` (runs). |
| `.../platform/process-run.ts` | Shared launcher with tree kill | VERIFIED | Imported by `git-process.ts` and `package-manager.ts`. |
| `.../platform/git-failure-kind.ts` | Kind ladder | VERIFIED | Called by `settleRun`. |
| `.../platform/git-neutral-directory.ts` | Private neutral cwd | VERIFIED | Bound in `NODE_GIT_HOST`. It sits under `<agentDir>/pi-claude-marketplace/` (NFR-10). |
| `.../shared/errors.ts` (`GitCommandError`, `GitFailure`) | Typed error with closed kinds | VERIFIED | Used by classifiers and `add.ts`. |
| `rule-packs/architecture.json`, `eslint.config.js`, `test/architecture/gate-targets.ts`, `no-shell-out.test.ts` | Gates change with the module | VERIFIED | See truth 1. |
| `features/marketplace/without-git.feature`, `features/plugin/without-git.feature` | SG-PRC-06 scenarios | VERIFIED | 11 scenarios. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `git-credential.ts` `NODE_CREDENTIAL_GIT` | `NODE_GIT_PROCESS.run` | `subcommand: "credential"`, network lane, input over stdin | WIRED |
| `git.ts` four network verbs | `NODE_GIT_PROCESS.locate()` | awaited before isomorphic-git | WIRED |
| `settleRun` | `classifyGitExit` | exit code plus stderr | WIRED |
| `GitCommandError` | `{git missing}` reason | `classifyGitCommandFailure` | WIRED |
| `{git missing}` | `marketplace add` / plugin install result | `add.ts` unwrap, cause line | WIRED (cucumber) |

### Data-Flow Trace (Level 4)

Not applicable. The module has no rendered state. The data that matters is the argv and environment that reach `spawn`, and the module tests assert them against `launches()` and against real git.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Module, kind ladder, neutral directory, launcher, credential, `git.ts` gate, shell-out gate, credential-leak scan | `node --test` on 8 files under the hermetic environment | 662 pass, 0 fail, 0 skipped | PASS |

### Probe Execution

No probe scripts are declared. SKIPPED.

### Requirements Coverage

All six IDs appear in at least one PLAN's `requirements` field. No ID mapped to Phase 2 in REQUIREMENTS.md is missing from the plans.

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| SG-PRC-01 | 02-01, 02-03, 02-06, 02-08 | SATISFIED | Truth 1. The SSH probe is the Phase 4 consumer. The module already handles the ssh launch environment. |
| SG-PRC-02 | 02-01, 02-03, 02-05, 02-07, 02-08 | SATISFIED | Truth 2. |
| SG-PRC-03 | 02-03, 02-05, 02-06 | SATISFIED | Truth 3. |
| SG-PRC-04 | 02-06 | SATISFIED | Truth 3, local lane under D-SG-02. No production caller until Phase 3. |
| SG-PRC-05 | 02-02, 02-03, 02-04 | SATISFIED | Truth 4. |
| SG-PRC-06 | 02-02, 02-03, 02-04, 02-05, 02-08 | SATISFIED, macOS text needs a Mac | Truth 5. |

REQUIREMENTS.md still shows the six IDs as `[ ]` and `Pending`. The orchestrator updates that after this report.

### Anti-Patterns Found

I scanned `git-process.ts`, `git-failure-kind.ts`, `git-neutral-directory.ts`, `process-run.ts`, and the `GitCommandError` block for `TBD`, `FIXME`, `XXX`, placeholders, and empty stubs.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No debt markers or stubs in the files this phase changed | - | - |

Notes, not defects:

- The local lane, `checkout`, `rev-parse`, `config`, `tag`, `update-ref`, and `ls-remote` rules have no production caller. This is the stated scope limit (Phase 3). `fallow` is green because `createGitProcess`, `NODE_GIT_HOST`, and `NODE_GIT_SPAWN` carry `fallow-ignore` markers with reasons (lines 948, 1134, 1154). These marker sites match the CONVENTIONS list.
- The isomorphic-git name matchers in `orchestrators/` stay until Phase 3, as CONTEXT says.

### Review and security follow-through

`02-REVIEW-FIX.md` items are in the code: `safe.bareRepository=explicit` in `PIN_PAIRS`, the neutral directory in `git-neutral-directory.ts`, D-SG-08 `exportedVariant`, anchored rows with `REMOTE_LINE` stripping, `userProtocolList` removing banned names, `realpathOrUndefined` guards, a truncated stdout rejecting through `STDOUT_CUT`, and one deadline through `timeLeft`. HEAD `622a491` adds only `02-SECURITY.md` over the build inputs of `34b3243`.

`02-SECURITY.md` has `threats_open: 1`. T-02-40 (high) and T-02-41 (medium) stay open until the manual platform check runs, tracked as WINDOWS #120 and #121. This is the same open item as the human verification below.

### Human Verification Required

#### 1. macOS check (02-08 Task 2)

**Test:** On a Mac, run a git-source `marketplace add` with git absent, then with only the `/usr/bin/git` xcrun shim, then with Command Line Tools installed.
**Expected:** The xcode-select message appears and no installer window opens. With a real git behind the shim, the command runs.
**Why human:** The shim check reads three developer-directory sources that Claude Code's binary does not reveal. Only a Mac confirms the assumption.

#### 2. Windows check (02-08 Task 2)

**Test:** On Windows, run it with no git, `git.cmd` only, a git inside Pi's working directory, and a hanging helper at timeout.
**Expected:** A clear message. The cwd match and the launcher are refused. No console or credential window. No process is left after the timeout.
**Why human:** Platform behavior is proven only with an injected platform and a fake host (the Windows neutral-directory branch without owner and mode checks, the `GIT_ALLOW_PROTOCOL` spelling intersection, and the unreadable real paths).

### Gaps Summary

No gaps. Each of the five ROADMAP success criteria has code evidence and a passing real-git or cucumber proof on Linux with git 2.43.0. The remaining items are the deferred macOS and Windows manual check, which the orchestrator told me to treat as `human_needed`. SECURITY T-02-40 is the same open item.

---

_Verified: 2026-11-23T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
