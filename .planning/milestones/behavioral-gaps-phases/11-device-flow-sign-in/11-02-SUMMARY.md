---
phase: 11-device-flow-sign-in
plan: 02
subsystem: testing
tags: [cucumber, device-flow, github, git-source, background-update, behavioral-tests]

requires:
  - phase: 11-device-flow-sign-in
    provides: "11-01: the credential store Thens in features/step_definitions/marketplace/device-flow.steps.ts"
provides:
  - "`Given the user has stored a credential for github.com with the user {string} and the password {string}`"
  - "DFLOW-03: an install from a private GitHub source signs in on a cache miss, and makes no request and no sign-in when a fetch cached its pinned clone"
  - "DFLOW-04: the background update never signs in; it stops at the 401 with no stored credential and fetches with a stored github.com credential"
affects: [the behavioral-gaps merge of this branch]

plan_head_before: 5677cc23
plan_head_after: bb718ff5

key-files:
  modified:
    - features/step_definitions/marketplace/device-flow.steps.ts
    - features/marketplace/device-flow.feature

requirements-completed: [DFLOW-03, DFLOW-04]
---

# Phase 11 Plan 02: Device Flow on installs and background updates

Executed inline by the phase session (the coordinator's rule after 11-01: no
more subagents), not by a dispatched executor.

## Accomplishments

- New Given `the user has stored a credential for github.com with the user {string} and the password {string}`: writes `.gitconfig` (git's `store` helper) and `.git-credentials` (`https://<user>:<password>@github.com`) into the sandbox HOME only, with flag `wx` and mode 0600, releases both, and asserts the read-back as one record. `npx fallow dupes --fail-on-issues` exits 0: no clone group with the frozen git-host Given, and no marker was needed.
- Four scenarios in `features/marketplace/device-flow.feature`:
  - "Installing a plugin from a private GitHub source with no cached clone signs in through Device Flow" (DFLOW-03): the prompt row, then an info cascade with needs reload true; `ghp@gits` installed in the project scope at 1.0.0; git host 401, 200, POST; one code request and two polls; six routed requests.
  - "Installing a pinned GitHub plugin whose clone is already cached makes no request and does not sign in" (DFLOW-03): after `fetch ghp@gits` (which signs in), the install is one info cascade with `ghp@gits` installed, the git host receives no request, and the sign-in receives no request. No credential store is configured and the poll script holds one authorization, so a second network trip would fail.
  - "The background update of a private GitHub marketplace with no stored credential does not sign in" (DFLOW-04): no notice, one 401, no sign-in request, one routed request.
  - "The background update of a private GitHub marketplace fetches with the stored GitHub credential" (DFLOW-04): no notice, 401, 200, POST, no sign-in request.
- Both seeds unchanged; no MCP implementation tag. `npx cucumber-js features/marketplace/device-flow.feature`: 9 scenarios (9 passed), 145 steps, 1 min 27 s wall under load. `npm run check:features`, `npx eslint` on the step module, and `npx prettier --check` exit 0.
- The install did reuse the fetched pinned clone, so the reinstall fallback was not needed. No product bug showed; no product file changed.

## Red proofs

Originals copied to `/tmp/claude-1000/bg-phase-11/orig/` and copied back; `git diff --exit-code -- extensions` exited 0 afterward, and the full feature then ran 9 of 9 green.

| Run | Temporary edit | Scenario | Failed at |
| --- | --- | --- | --- |
| A | `orchestrators/auth-host.ts` `buildAuthForHost`: drop the `run.origin.kind !== "command"` condition and the print-mode `DeviceFlowUnavailableError` throw | background update, no stored credential | `github's sign-in receives no request` (the pass requested a code) |
| A | `orchestrators/plugin/clone-cache.ts` `materializePluginClone`: skip the warm-cache return | pinned cached install | `the result has these fields:` (a prompt row and an error cascade: the install went to the network, signed in again, and failed on the exhausted poll script with `authentication required`) |
| B | `platform/git-auth-callbacks.ts` `onAuth`: a `stored-credential` bundle skips `credentialOps.fill` | background update, stored credential | `the git host receives these requests:` (the pass cancelled after the 401) |
| B | `orchestrators/auth-host.ts` `buildGitHubAuth`: return the stored-credential bundle for github.com | uncached install | `the command reports these results:` (no prompt row; failed as authentication required) |

Run A's first attempt timed out at `pi runs with github's requests routed to the stand-ins` (Pi's start passed 90 s while the edited extension recompiled under a load average near 66); the rerun reached the steps above.

## Task Commits

- `bb718ff5` test(features): pin github sign-in on installs and background updates (both tasks in one commit: they share the feature file, and the session's git guard rules out partial staging)

## Parent lines

- `.planning/PROJECT.md` Key Decisions, one row each (shape of the D-BG-01 row):
  - `| **D-BG-1101 (behavioral-gaps, Phase 11, settled with the recommended answer, pending user review): the GitHub sign-in is the project's own contract, pinned as the product renders it**. Claude Code runs no Device Flow (system git, credential helpers, prompts off without a terminal); this extension clones through isomorphic-git, which cannot prompt (AUTH-01, D-79-04, D-79-05, GHB-02). A sign-in shows a device-flow-prompt row before the command's own row. | Claude Code is the reference only for the background pass, which never prompts. | -- Pending |`
  - `| **D-BG-1102 (...): the token lives in the user's git credential helper, and scenarios read it from the sandbox credential store**. The next command finds it through git credential fill (AUTH-02). | The store file is git's, a file the user reads. | -- Pending |`
  - `| **D-BG-1103 (...): a denied or expired sign-in is the bare authentication required row, and nothing is left**. No record, checkout, clone, config, or credential (GAUTH-05). | The product's denial and expiry texts reach only the debug log. | -- Pending |`
  - `| **D-BG-1104 (...): a GitHub git-source install signs in on a cache miss and runs no sign-in on a cache hit**. The hit is one pinned github plugin whose clone a fetch cached. | Two plugins pinned to one commit is impossible with a github source (one plugin at the root), and a git-subdir source never reaches github.com. | -- Pending |`
  - `| **D-BG-1105 (...): the background pass never starts a Device Flow**. Without a stored credential it stops at the 401; with a stored github.com credential it fetches with it (D-PL8-12). | Claude Code's GITHUB_TOKEN reading for background updates stays out of scope. | -- Pending |`
  - `| **D-BG-1106 (...): the two Phase 1 seeds stay**. Seed 1 is DFLOW-01's main scenario, extended with the credential store check. | -- | -- Pending |`
- `CHANGELOG.md`: None (no product change).
- `README.md`, `README.es.md`: None.
- `.planning/BACKLOG.md` (not tracked there today): Device Flow in print mode (`DeviceFlowUnavailableError`) has no scenario; a sign-in stand-in that fails its code request has no scenario; GitLab's Device Flow has no stand-in or scenario; a denied and an expired sign-in read the same to the user (GAUTH-05), which may deserve a user-facing reason.
- Frozen files: None.
- Unowned feature files whose rows changed: None.
- CI timing: the device-flow feature takes about 1.5 min wall of the adapter lifecycle leg under load; the wave 1 gate's adapter leg ran 28 min under a load average of 56 to 66 on this shared machine (not representative of CI).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The new Given writes only under `this.tokens.home` (no `homedir`, no `process.env` in the module).

## Dubious Choices

- Both tasks landed in one commit (Low).
- The plan was executed inline by the phase session rather than by an executor subagent, per the coordinator's rule (Low).
- The D-BG-1104 hit shape: one pinned github plugin warmed by a fetch (already P11-DC-06).
- The red proofs ran in two combined runs, two edits each; each scenario's failing step is specific to its own edit (Low).
