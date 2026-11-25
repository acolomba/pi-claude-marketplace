---
phase: 04-ssh-sources-and-transport-selection
plan: 06
subsystem: plugin transport selection
tags: [system-git, ssh, transport, plugin, install, cucumber]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-04: the ssh runner, probeGitHubSsh, GitHubSshOps, planMarketplaceClone's types, cloneOverGitHubTransports, transportForce; 04-05: TransportPlan.after, the retry and both-failed paths, the profile Pi variables; 04-03: gitHubAddressOf; 04-02: GitHubTransportsFailedError's plugin text"
provides:
  - "domain/github-plugin-transport.ts: PluginSshChecks, PluginClonePlanInput, planPluginClone (upstream Qmt and zHi off Windows, KHi for the git-subdir shorthand)"
  - "orchestrators/github-transport.ts: PluginSshOps, PluginTransportContext, CloneTransport, createPluginTransportContext"
  - "orchestrators/marketplace/shared.ts: GitHubPluginSshOps, the widened DEFAULT_GITHUB_SSH_OPS, defaultPluginTransportContext"
  - "platform/git.ts: userSshOverride, sshUrlRewritten, sshShowsDirectGitHub; platform/git-process.ts: the github-config launch, exported SSH_CONFIG_READ and configValues"
  - "clone-cache: transport?: CloneTransport on materializePluginClone, materializeOrRefreshPluginMirror, materializePluginCommitCopy, materializeUnpinnedSource"
  - "transportContext?: PluginTransportContext on InstallPluginOptions, CascadeInstallOptions, InstallLedgerOptions, InstallMissingDependencyOptions; probeInstallClone's transportContext and subject"
  - "harness: GIT_SSH_COMMAND and GIT_SSH profile variables, the user's git config Given, the -G proxy Given; features/plugin/github-transport.feature (12 scenarios)"
affects: [04-08, 04-10, 04-11, 04-12, 04-14, 04-17]

actuals:
  tokens: 40100 # chars/4 over the realized diff (160,510 chars, 36 files)
  tasks: 3
  commits: 3
plan_head_before: 248402d166528b288ee2c87c382fa2cd6a6fa23e
plan_head_after: 7ecb8e563e2459340400e76f67cd4d2454bda493

tech-stack:
  added: []
  patterns:
    - "A lazy clone plan: CloneTransport.plan is a function the clone step calls, and the context's force is read on first use, so a warm cache runs no probe and reads no GitHub base (NFR-5)"
    - "One transport context per command root, carried beside authMemo; each check of the context answers once"
    - "A command root that is not a NETWORK_SEAMS member gets its context from defaultPluginTransportContext()"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/github-plugin-transport.ts
    - test/domain/github-plugin-transport.test.ts
    - features/plugin/github-transport.feature
  modified:
    - extensions/pi-claude-marketplace/platform/git-process.ts
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/domain/github-transport.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - scripts/isolated-pi-home.mjs
    - features/lib/pi-rpc.ts
    - features/support/world.ts
    - features/step_definitions/ssh-host.steps.ts
    - features/step_definitions/git-host.steps.ts

key-decisions:
  - "The clone plan and the context's force are lazy: CloneTransport.plan is a function, and PluginTransportContext.force is read on first use, so a warm install runs no ssh probe and reads no GitHub base (NFR-5; the eager form broke the GHB-03 and NFR-5 warm-cache tests)"
  - "The plugin port is GitHubPluginSshOps = GitHubSshOps & PluginSshOps, so the marketplace add keeps the narrow probe port and its tests (04-08's add.test.ts) need no new members"
  - "sshPresent and showsDirectGitHub come from one ssh -G launch: the launch answers missing before it starts anything, so the order of launches matches upstream's lookup-then-G"
  - "The ssh -G output is read from SshRun.output (stdout, a newline, stderr), as the probe's is; ssh -G writes its config to stdout and nothing else on success"
  - "A failed core.sshCommand read counts as no setting, with a debug line, as upstream's OF() goes on with {}"
  - "The install row keeps a GitHubTransportsFailedError's cause even when its reason is authentication required, as 04-05 did for the add row, so the user sees both attempts and Claude Code's advice"
  - "The test run drops the shell's GIT_CONFIG_* rows and its refusing ssh answers ssh -G with a direct hop, so a test that reaches the default port reads the run's own home and models a user with no GitHub key"
  - "createInstallPlugin and createInstallMissingDependency take a defaulted context factory (dependency injection), so a test states which context a call gets"

patterns-established:
  - "A scenario that sets the user's ssh command uses 'pi runs with github's requests routed to the git host and the environment variable \"GIT_SSH_COMMAND\" set to \"ssh\"' (only ssh or empty is admitted)"
  - "A scenario that sets the user's git config uses 'the user's git config sets {string} to {string}' (core.sshCommand=ssh, or the github ssh insteadOf rewrite)"

requirements-completed: [SG-SSH-04, SG-SSH-06, SG-SSH-01, SG-SSH-03]

coverage:
  - id: D1
    description: "A github owner/repo plugin install stays on ssh only when the user's ssh authenticates, when GIT_SSH_COMMAND or GIT_SSH is present (empty included), when core.sshCommand is set, when the user's git config rewrites the ssh URL, when the probe never answers, and when ssh -G shows a proxy"
    requirement: SG-SSH-04
    verification:
      - kind: e2e
        ref: "features/plugin/github-transport.feature#Installing a github plugin when the user's ssh authenticates to github.com clones it over ssh only"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport.feature#The user's <variable> keeps a github plugin install on ssh without the probe"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport.feature#The user's core.sshCommand keeps a github plugin install on ssh without the probe"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport.feature#A probe that never answers keeps a github plugin install on ssh"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport.feature#An ssh config that sends github.com through a proxy keeps a github plugin install on ssh"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport.feature#A user insteadOf that rewrites the github ssh address keeps the install on the user's rewrite"
        status: pass
      - kind: unit
        ref: "test/domain/github-plugin-transport.test.ts"
        status: pass
      - kind: unit
        ref: "test/platform/git.test.ts#userSshOverride"
        status: pass
    human_judgment: false
  - id: D2
    description: "With no ssh setting, a not-configured probe, and a direct ssh -G hop, the install goes https first and retries over ssh once; both failures give one error with both messages and Claude Code's advice, shown as the row's cause"
    requirement: SG-SSH-04
    verification:
      - kind: e2e
        ref: "features/plugin/github-transport.feature#Installing a github plugin with no ssh setting and a denied ssh key clones it over https first"
        status: pass
      - kind: e2e
        ref: "features/plugin/github-transport.feature#A github plugin install that fails over https and over ssh reports both attempts"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SG-18: a pinned clone over an https-first transport clears the failed attempt and clones over ssh with no auth"
        status: pass
      - kind: unit
        ref: "test/orchestrators/github-transport.test.ts#D-SG-18, upstream zHi: gives a plugin clone that fails over both Claude Code's retry text"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE_CODE_PLUGIN_PREFER_HTTPS and the base override give one https attempt and no probe; url sources and the git-subdir shorthand clone once"
    requirement: SG-SSH-03
    verification:
      - kind: e2e
        ref: "features/plugin/github-transport.feature#With CLAUDE_CODE_PLUGIN_PREFER_HTTPS set, a github plugin installs over https with no probe"
        status: pass
      - kind: unit
        ref: "test/domain/github-plugin-transport.test.ts#D-SG-20: clones a git-subdir owner/repo shorthand once over ssh and runs no check"
        status: pass
    human_judgment: false
  - id: D4
    description: "One install command probes once across its cascade, and the missing-dependency install takes the same context"
    requirement: SG-SSH-04
    verification:
      - kind: e2e
        ref: "features/plugin/github-transport.feature#Installing a github plugin with a github dependency probes once"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-cascade-context.test.ts#D-SG-18: gives every member of one cascade the caller's one transport context"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow.test.ts#D-SG-18: a missing-dependency install clones under a new transport context"
        status: pass
    human_judgment: false
  - id: D5
    description: "An ssh clone fills the plugin-clones/<key>/ directory its https clone uses"
    requirement: SG-SSH-06
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#SG-SSH-06: an ssh clone fills the directory an https clone of the same source fills"
        status: pass
    human_judgment: false
  - id: D6
    description: "The skip checks read a real OpenSSH -G config and a real user's git config as Claude Code reads them"
    verification: []
    human_judgment: true
    rationale: "The sandbox has no real ssh, and no test may run one; the -G answers come from the stand-in and from upstream's Xxn rule, so a run on a machine with a real ssh and ssh config is the only proof (as 04-04 D6 and 04-05 D7)"

duration: 76min
completed: 2026-11-25
status: complete
---

# Phase 4 Plan 06: GitHub plugin install transport selection Summary

**`/claude:plugin install` of a github `owner/repo` plugin now picks its clone transport as Claude Code's shell install does: a user ssh choice (`GIT_SSH_COMMAND` or `GIT_SSH` present, empty included, or `core.sshCommand`), a git-config rewrite of the ssh URL, a probe that does not answer `not-configured`, or an `ssh -G` that is not a direct hop keeps the clone on ssh only; only when every check passes does it go https first and retry over ssh once. One install command probes once across its cascade, and a clone that fails over both reports one error with both messages.**

## Performance

- **Duration:** 76 min
- **Started:** 2026-11-25T18:31:27Z
- **Completed:** 2026-11-25T19:47:07Z
- **Tasks:** 3 of 3
- **Files modified:** 36 (3 created, 33 modified)

## Accomplishments

- `planPluginClone` (new pure module `domain/github-plugin-transport.ts`) follows upstream `Qmt` and `zHi` off Windows. A url source clones once as written; its note is its scheme's transport when the address folds to GitHub (`gitHubAddressOf`), and none otherwise. A git-subdir `owner/repo` shorthand clones once over `git@github.com:<owner>/<repo>.git`, or over HTTPS when forced (D-SG-20, upstream `KHi`). A forced or URL-spelled github source clones once over HTTPS. An `owner/repo` source walks the checks lazily, in order: user override, URL rewrite, probe (`unknown` keeps SSH, Pitfall 8), ssh present, `ssh -G` direct. With no checks (no context) it stays on SSH unless forced.
- The HTTPS-first plan carries `ssh-not-configured` and gives SSH once after an HTTPS failure, but not after `git-missing`, `aborted`, or a print-mode Device Flow refusal (04-05's stop rule, now exported as `stopsTheClone`).
- `createPluginTransportContext({ env, ssh })` answers each check once per context, the URL check once per URL, and writes upstream's two debug lines (`GitHub SSH URL is rewritten by git config, or git could not say (code=<n>): staying on SSH`, `ssh -G does not show git@github.com going straight to github.com (code=<n>): staying on SSH`). `force` is read on first use.
- `platform/git.ts`: `userSshOverride` (presence semantics, Windows spellings, the `SSH_CONFIG_READ` read of `core.sshCommand`), `sshUrlRewritten` (local-lane `ls-remote --get-url`, no request pair, 5000 ms), `sshShowsDirectGitHub` (upstream `Xxn` as a character-level check). `platform/git-process.ts` gains the `github-config` launch (`ssh -G git@github.com`, 5000 ms, same lookup, neutral directory, environment, closed stdin, and group kill).
- clone-cache runs only the clone step over the plan (`runCloneStep`, plugin surface): HTTPS attempts carry the auth bundle, SSH attempts none; `beforeRetry` removes the staging directory; `fetchCommit`, `checkout`, and the `HEAD` check never retry. The key still comes from `canonicalCloneUrl`, so an SSH clone fills the HTTPS clone's directory (SG-SSH-06).
- The install root (`createInstallPlugin`) and the missing-dependency install root create one context per call when the caller gives none; `buildInstallLedgerOptions` carries it cascade-wide beside `authMemo`; `install-outcome.ts` passes it with the subject `<plugin>@<marketplace>` to `probeInstallClone`.
- The install row keeps a `GitHubTransportsFailedError`'s cause, so the user sees both attempts and upstream's advice text.
- Harness: `GIT_SSH_COMMAND` and `GIT_SSH` profile variables (only `ssh` or empty), a Given for the user's global git config, and a Given for a denied host whose `-G` names a proxy. `features/plugin/github-transport.feature` has 12 scenarios.

## Task Commits

1. **Task 1: Installing a github plugin when the user's ssh authenticates to github.com clones it over ssh only, end to end** (tracer) - `740b9c0` (feat)
2. **Task 2: With no ssh setting and a direct github.com hop, a github plugin install goes https first, retries over ssh, and reports both failures** - `7377b1e` (feat)
3. **Task 3: An install and its dependencies probe once, and the whole suites pass** - `7ecb8e5` (feat)

**Plan metadata:** this SUMMARY commit (docs)

The tracer gate after Task 1 re-ran its scenario on the committed tree: 1 of 1 passed ("Tracer verified end-to-end -- expanding").

## TDD Gate Compliance

Each task ran RED locally, then GREEN, and RED and GREEN went into one `feat` commit per task. The commit hook runs typecheck and the architecture tests, so a commit with only failing tests cannot pass, and the committing skill forbids a plan id in a commit scope, so no `test(04-06):` commit exists. RED records are in the ignored `.gsd/tdd-evidence/04-06/` directory, which goes with the worktree; the entries below are the durable record. Each RED run set the named sources back to a ref with a script, ran the cases, and restored them; `git status` was clean of those sources afterwards.

- **Task 1 RED (probe):** `install-clone-probe.ts` set back to `248402d`, then `node --import scripts/isolated-pi-home.mjs --test --test-reporter=tap --test-name-pattern 'D-SG-18: a clone under a transport context' test/orchestrators/plugin/install-clone-probe.test.ts`: exit 1, 1 test, 1 failed. Target: `D-SG-18: a clone under a transport context plans with its checks and notes under the subject`. Expected the mirror step's transport to carry the context's notes; actual `undefined` (no transport reached the step). Classifier: `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target ran and failed on the planned transport assertion.
- **Task 1 RED (scenario):** "Installing a github plugin when the user's ssh authenticates to github.com clones it over ssh only" with `install-clone-probe.ts` and `clone-cache.ts` set back to `248402d`: failed at `the user's ssh receives these launches:` (only the header: no probe and no ssh clone, because the install cloned over HTTPS).
- **Task 1 RED (domain):** `domain/github-plugin-transport.ts` is new, so its cases have no older module to fail against; they are pinned by the probe and scenario REDs above.
- **Task 2 RED (domain):** `domain/github-plugin-transport.ts` set back to Task 1's `740b9c0`, then `--test-name-pattern 'ssh -G shows no direct hop' test/domain/github-plugin-transport.test.ts`: exit 1, 1 failed. Target: `D-SG-18: stays on ssh only when ssh -G shows no direct hop to github.com`. Expected the SSH attempt first; actual the HTTPS attempt (Task 1's plan went HTTPS first after a not-configured probe). Classifier: `RED_EVIDENCE_OK`. Semantic assessment: the target failed on the planned first-attempt assertion.
- **Task 2 RED (scenarios):** the feature against Task 1's product sources (`740b9c0`): 11 scenarios, 3 failed: the denied-key HTTPS-first and both-failed scenarios at `the user's ssh receives these launches:` (no `-G` launch), and the proxy scenario at `the result has these fields:` (the install succeeded over HTTPS). Against the plan base (`248402d`): 9 of 11 failed. The insteadOf and PREFER_HTTPS scenarios pass on the base, because the base clones once over HTTPS with no probe; their discriminating rows are the absent probe and launches on a tree that probes.
- **Task 2 RED (platform):** the `github-config` launch and `sshShowsDirectGitHub` rows are new API; recorded through the domain and scenario REDs, not offered to the classifier.
- **Task 3 RED (GUARD MUTATION):** with `install-clone-probe.ts` mutated to build `defaultPluginTransportContext()` for every clone, "Installing a github plugin with a github dependency probes once" failed at `the user's ssh receives these launches:`: the probe and the `-G` launch each ran twice. The source was restored from a copy.
- **GREEN:** Task 1 verify, every listed unit file plus the tracer scenario; Task 2 verify, 751 of 751 unit tests and the feature 11 of 11; Task 3, the suites below.

## Verification

- Task 1 acceptance: `export async function planPluginClone` once; `--get-url` once in `platform/git.ts`; `transport` 12 times in `install-clone-probe.ts`; direct coverage of the Task 1 sources (plus `domain/source.ts`, `domain/github-transport.ts`, `platform/git-process.ts`, `install-flow-ledger.ts`, `shared/errors.ts`) exits 0; typecheck and fallow pass in `check:static`.
- Task 2 acceptance: `"github-config"` in `git-process.ts`; `surface: "plugin"` in `clone-cache.ts`; `GIT_SSH_COMMAND` in `features/lib/pi-rpc.ts`; direct coverage of `git-process.ts`, `git.ts`, and both transport modules exits 0; `npm run check:features` exits 0.
- Task 3 acceptance: the once-per-command scenario passes and fails under the per-clone mutation; no feature file other than `features/plugin/github-transport.feature` changed in this plan.
- Whole suites on the final tree (`CI=1`):
  - `npm run test:modules`: 19743 of 19743 passed (the `dispatch-exec.test.ts:39` baseline passed).
  - `npm run test:integration`: 236 of 236 passed.
  - `test:cucumber:profile --profile adapter features/marketplace features/plugin`: 1481 of 1481 scenarios (17614 steps); 1469 before plus this plan's 12. Every shared-Pi request table is unchanged.
  - `test:cucumber:profile --profile builtin features/plugin`: 41 of 41 (528 steps).
- Each commit's hook ran `npm run check:commit` (check:static, the unpaired tests, and direct coverage; the first two commits staged test tooling, so they covered every pair) and passed.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/github-plugin-transport.ts` (new): the plugin plan.
- `extensions/pi-claude-marketplace/orchestrators/github-transport.ts`: `PluginSshOps`, `PluginTransportContext`, `CloneTransport`, `createPluginTransportContext`, the two debug lines.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`: `GitHubPluginSshOps`, the widened default port, `defaultPluginTransportContext`.
- `extensions/pi-claude-marketplace/platform/{git,git-process}.ts`: the three checks, the `-G` launch, the exported config read.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{clone-cache,install-clone-probe,install-outcome,install-flow-cascade-context,install-flow,install-flow-ledger,install-flow-dependency-ledger,install.messaging}.ts`: the transport option and its threading.
- `extensions/pi-claude-marketplace/domain/{github-transport,source}.ts`, `shared/errors.ts`: exports and a doc comment (deviation 4).
- `scripts/isolated-pi-home.mjs`: the dropped `GIT_CONFIG_*` rows and the `-G` answer.
- Harness: `features/lib/pi-rpc.ts`, `features/support/world.ts`, `features/step_definitions/{ssh-host,git-host}.steps.ts`, `features/plugin/github-transport.feature`.
- Tests: the pairs of every source above, `test/architecture/{hermetic-git-environment,isolated-pi-home}.test.ts`, and `test/orchestrators/plugin/install-flow-ledger.test.ts`.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The eager plan and force broke NFR-5 on a warm cache**
- **Found during:** Task 1 (the whole unit suite)
- **Issue:** building the plan before the clone-cache call ran the checks (the probe is a network launch) on a warm cache, and reading `force` at context creation read the GitHub base on every install; the GHB-03 and NFR-5 warm-cache tests failed.
- **Fix:** `CloneTransport.plan` is a function the clone step calls, and `PluginTransportContext.force` is a getter read on first use.
- **Committed in:** `740b9c0`

**2. [Rule 3 - Blocking] Tests that reach the default port depended on the shell's git config**
- **Found during:** Task 1 (the whole unit suite)
- **Issue:** the sandbox's `GIT_CONFIG_*` rows rewrite `git@github.com:` to https, so `sshUrlRewritten` answered "rewritten" here and "not rewritten" in CI, and 8 install and reinstall tests failed only here. In Task 2 the run's refusing ssh would have failed `ssh -G`, making every default-port github install SSH only.
- **Fix:** `scripts/isolated-pi-home.mjs` drops the shell's `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>`, `GIT_CONFIG_VALUE_<n>`, and `GIT_CONFIG_PARAMETERS`, and its refusing ssh answers `ssh -G` with a stock OpenSSH config (direct hop). Two rows in `test/architecture/isolated-pi-home.test.ts`. The one remaining CI-view failure, a Device Flow cancellation case that now saw the SSH retry, passes `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` through its context, which keeps its one HTTPS attempt (`install-flow-ledger.test.ts`).
- **Committed in:** `740b9c0`, `7377b1e`

**3. [Rule 2 - Missing functionality] The install row hid the both-failed cause**
- **Found during:** Task 2 (the both-failed scenario)
- **Issue:** the last attempt's `ssh-auth` classifies as `authentication required`, and that row is bare (D-79-03), so the user saw neither message nor the advice.
- **Fix:** `keepsRuntimeCause` keeps a `GitHubTransportsFailedError`'s cause, as 04-05 did for the add row; unit row in `install.messaging.test.ts`.
- **Committed in:** `7377b1e`

### Scope adjustments

**4. Files outside `files_modified`** (all small; 04-08 runs in parallel)
- `domain/github-transport.ts` (04-08's file this wave): `gitHubSshCloneUrl`, `stopsTheClone`, and `addressTransport` gained `export`, one word each, mid-file, away from the url arm 04-08 edits. 04-04 asked for the first export.
- `domain/source.ts`: `isGitSubdirShorthand` wraps the existing shorthand pattern.
- `install-flow-ledger.ts`, `install-flow-dependency-ledger.ts`: the `transportContext` field (the types the roots pass).
- `install.messaging.ts` (deviation 3), `shared/errors.ts` (the doc comment 04-05 asked to align), `scripts/isolated-pi-home.mjs` (deviation 2), and their tests.

**5. Port shape.** `GitHubSshOps` stays `{ probe }`, and the plugin port is `GitHubPluginSshOps = GitHubSshOps & PluginSshOps`, so `add.test.ts`'s fakes (04-08's file) need no new members. `sshPresent()` is not a port member: the context derives it from the `ssh -G` answer's `missing` kind, which the runner reports before starting anything, so the launches match upstream's lookup-then-`-G` order. The domain checks still have both steps.

**6. Scenario shape.** The "denied and host-key" Outline is one scenario (denied): an Outline needs three variants, and the host-key arm reads `not-configured` exactly as denied does (04-04's probe rows and marketplace Outline pin it). The user-setting Outline covers `GIT_SSH_COMMAND=ssh`, `GIT_SSH_COMMAND=` and `GIT_SSH=ssh`; `core.sshCommand`, the `-G` proxy line, and the probe that never answers are scenarios of their own, because their launches or outcomes differ. The proxy row fails over SSH (the denied arm), as the plan allowed.

**7. Injected context factories.** `createInstallPlugin` and `createInstallMissingDependency` take a defaulted `newTransportContext` (dependency injection, CONVENTIONS), so unit tests state the context a call gets without running the user's ssh.

**8. No bare-name retry.** Pi's install has no bare-name retry (the edge handler calls the install once), so nothing was wired for it; a closure member already recorded is not cloned again.

**9. The missing-dependency install gets a context.** Task 3 names it: it takes `transportContext?` and makes one per call when absent, as the install root does; `apply` passes its own in 04-17.

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing functionality) and 6 scope adjustments. **Impact:** no scope creep; the extra files are listed in deviation 4.

## Issues Encountered

- The worktree harness refuses command text that names `git` paths, chains several commands with them, or sets git variables, so RED set-asides, mutations, coverage, lint, and commits ran from scripts in the scratch directory (`aside.mjs`, `red-cuke.sh`, `red-unit.sh`, `mutate-per-clone.sh`, `cov.sh`, `lint.sh`, `commit.sh`). Commits ran with hooks through `setpriv`; no `--no-verify` was used.
- The first `check:static` run failed ESLint on four lines (an import order, a padding line, a dynamic delete, an unsafe return) and later on two `github.com` literals (`local/no-github-literal`); each was fixed before its commit.
- The worktree had no optional-peer cache; `node scripts/install-test-peers.mjs` installed it.
- The plan ledger file was not written into the shared git directory; `plan_head_before` is the expected base `248402d`.

## Lines for later plans

As built:

```ts
// domain/github-plugin-transport.ts
export interface PluginSshChecks {
  readonly userOverride: () => Promise<boolean>;
  readonly urlRewritten: (sshUrl: string) => Promise<boolean>;
  readonly probe: () => Promise<"configured" | "not-configured" | "unknown">;
  readonly sshPresent: () => Promise<boolean>;
  readonly showsDirectGitHub: () => Promise<boolean>;
}
export interface PluginClonePlanInput {
  readonly source: GitBackedSource;
  readonly force?: TransportForce | undefined;
  readonly checks?: PluginSshChecks | undefined; // 04-12 makes it required
}
export async function planPluginClone(input: PluginClonePlanInput): Promise<TransportPlan>;

// orchestrators/github-transport.ts
export interface PluginSshOps {
  readonly probe: () => Promise<"configured" | "not-configured" | "unknown">;
  readonly userOverride: () => Promise<boolean>;
  readonly urlRewritten: (sshUrl: string) => Promise<{ readonly rewritten: boolean; readonly exitCode: number | null }>;
  readonly showsDirectGitHub: () => Promise<
    | { readonly kind: "missing" }
    | { readonly kind: "ran"; readonly direct: boolean; readonly exitCode: number | null }
  >;
}
export interface PluginTransportContext {
  readonly force: TransportForce | undefined; // a getter: read on first use
  readonly checks: PluginSshChecks;           // each answers once per context
  readonly notes: GitHubCloneNotes;
}
export interface CloneTransport {
  readonly plan: () => Promise<TransportPlan>; // called by the clone step only
  readonly notes: GitHubCloneNotes;
  readonly subject: string;                    // `<plugin>@<marketplace>` on install
}
export function createPluginTransportContext(args: { env: NodeJS.ProcessEnv; ssh: PluginSshOps }): PluginTransportContext;

// orchestrators/marketplace/shared.ts
export type GitHubPluginSshOps = GitHubSshOps & PluginSshOps;
export const DEFAULT_GITHUB_SSH_OPS: GitHubPluginSshOps;
export function defaultPluginTransportContext(env?: NodeJS.ProcessEnv): PluginTransportContext;

// orchestrators/plugin/clone-cache.ts: `transport?: CloneTransport` on
//   materializePluginClone, materializeOrRefreshPluginMirror (cold clone only),
//   materializePluginCommitCopy, materializeUnpinnedSource (both steps).
//   With it, runCloneStep wraps the clone step (surface "plugin"); without it, one
//   clone of networkUrl. The warm mirror's refreshMirrorBySwap still sends networkUrl.
// orchestrators/plugin/install-clone-probe.ts: InstallCloneProbeOptions gains
//   transportContext?: PluginTransportContext and subject: string (required).
// platform/git.ts: userSshOverride({ env, platform? }, gitProcess?),
//   sshUrlRewritten(sshUrl, gitProcess?), sshShowsDirectGitHub(gitProcess?).
// platform/git-process.ts: SshLaunch = "github-probe" | "github-config";
//   SSH_CONFIG_READ and configValues are exported.
// install-flow.ts: createInstallPlugin(..., env?, newTransportContext?) and
//   createInstallMissingDependency(..., env?, newTransportContext?).
```

- 04-08: `addressTransport`, `gitHubSshCloneUrl`, and `stopsTheClone` in `domain/github-transport.ts` are now exported for the plugin plan. The plugin plan's url-source note rule (scheme of a GitHub-folded address) is `asWritten` in `domain/github-plugin-transport.ts`; align the marketplace url arm with it or share one helper after the merge.
- 04-10: the Windows arm goes before the `userOverride` walk in `planPluginClone`, and the context's `-G`-through-git check joins `sshHopChecks`.
- 04-11: `createUpdateDependencyResolver` gives its dependency installs no context yet, so an update's dependency move of a github plugin reaches `probeInstallClone`'s no-context arm (SSH only unless forced) until the update root passes its context; update and reinstall themselves still call clone-cache without a transport (one `networkUrl` attempt). The shared Pi forces HTTPS, so no scenario shows it.
- 04-12: `enable` still reaches the no-context arm; making `checks` required removes it.
- 04-14: the context's `notes` hold one note per `<plugin>@<marketplace>` subject; no row reads them yet.
- 04-17: `apply` and `import` installs each make their own context today; pass one per run through `transportContext` (install and missing-dependency install both take it).

## Known Stubs

None. `PluginTransportContext.notes` has no reader yet; 04-14 reads it into the install rows, as the plan states.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-20: the checks read the base environment Pi started with (`process.env` through the default port) and the user's config through `SSH_CONFIG_READ`; `--get-url` runs on the local lane with no request pair (unit row with the base override set). T-04-21: `ssh -G` launches from the one spawn site with a fixed argv, the absolute-PATH lookup, closed stdin, and a 5000 ms group kill (unit rows). T-04-22: the `-G` output is parsed and dropped, and the debug lines hold the exit code only. T-04-23: `beforeRetry` removes the staging directory; `fetchCommit` and `checkout` failures never retry (unit row). T-04-24: every new scenario runs on the no-override profile with the CONNECT proxy and the stand-in first on PATH; a scenario's `GIT_SSH_COMMAND`, `GIT_SSH`, and `core.sshCommand` admit only `ssh` (the stand-in) or empty. T-04-SC: no package was added. The test-run change (dropping the shell's `GIT_CONFIG_*` rows) narrows what a test process inherits.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`. Coverage item D6 (real OpenSSH `-G` output and real user git config) is for the verifier. If the orchestrator wants the interim no-context arms of deviation 9 and "Lines for later plans" (update's dependency moves, enable) on the ledger, the command is:

```bash
gsd-tools windows append --kind deviation --phase 4 --file extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts --description "[system-git] probeInstallClone's no-context arm (SSH only unless forced) is still reached by enable and by update's dependency moves until 04-11 and 04-12 pass their contexts"
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04-08 can merge beside these commits (one-word exports in its file). 04-10 can add the Windows arm to `planPluginClone` and the context. 04-11 and 04-12 can create contexts at the update, reinstall, fetch, info, and enable roots with `defaultPluginTransportContext()` and pass `CloneTransport` to clone-cache. 04-14 can read the install notes by subject.

## Self-Check: PASSED

- Created files exist: `domain/github-plugin-transport.ts`, `test/domain/github-plugin-transport.test.ts`, `features/plugin/github-transport.feature`, and this SUMMARY.
- Commits `740b9c0`, `7377b1e`, and `7ecb8e5` are ancestors of HEAD; `git rev-list --count 248402d..HEAD` is 3 before this SUMMARY commit.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-25*
