---
phase: 10-github-source-kind-and-suite-close
plan: "06"
subsystem: testing
tags: [cucumber, suite-review, SC4, ADD-11, UPD-12, SRC-02, SRC-03]
status: complete

requires:
  - phase: 10-github-source-kind-and-suite-close
    provides: "10-05: cucumber.json excludes no tag; 429 scenarios, 46 of them @github, all passing"
provides:
  - "The SC4 review record: every feature file of the suite read against the cucumber skill, with each finding, its class, and its fix or WINDOWS entry"
  - "BLOCKER fixes in 6 feature files: failed adds and installs state what they leave on disk, the git-source scenarios state their declarations, and two remove scenarios show the kept dependency"
  - "WINDOWS entries 102-109 for the eight WARNINGs left in files this phase does not own"
  - "The module sweep: one module-level `let` (the run in support/pi-process.ts), every created resource released, no URL outside the git host and the override, no unused, undefined, or ambiguous step"
affects: [10-07]

actuals:
  tokens: 2418
  tasks: 2
  commits: 6
plan_head_before: 5c41d614f219671e4384585a790b25a330dc0581
plan_head_after: 2e3a85ae8f8b595bb080f8b3351b453208e0b2b2

tech-stack:
  added: []
  patterns:
    - "A failed mutation states the state it leaves behind: a failed add says the config does not exist; a refused install says what is declared and installed"

key-files:
  created:
    - .planning/phases/10-github-source-kind-and-suite-close/10-06-SUMMARY.md
  modified:
    - features/marketplace/add.feature
    - features/marketplace/url-source.feature
    - features/marketplace/unsupported-source.feature
    - features/marketplace/git-source.feature
    - features/marketplace/github-source.feature
    - features/marketplace/remove.feature
    - features/plugin/install.feature
    - .planning/WINDOWS.md

key-decisions:
  - "A failed add or install that compares its result but no persisted state is a BLOCKER: an implementation that wrote the declaration before it failed still passes. The fix adds one config step, or a session step where a rollback could remove an earlier install"
  - "A failed update that does not restate the declaration is a WARNING, not a BLOCKER: update does not write the declaration, and update.feature has its own registration-intact scenario"
  - "A second When that only observes the outcome of the first (list, info, or a new session after the action) is accepted, not a finding: the skill says such a When usually hides a second behavior, and in these scenarios it does not"
  - "WINDOWS entries for review WARNINGs use kind lint-warning, the closest kind of the ledger's vocabulary"

requirements-completed: [ADD-11, UPD-12, SRC-02, SRC-03]

duration: 14min
completed: 2026-10-21
---

# Phase 10 Plan 06: Suite review against the cucumber skill Summary

**The SC4 review found 8 BLOCKER classes in 15 scenarios, all of them fixed by added steps. It also found 8 WARNINGs outside this phase's files, now WINDOWS entries 102-109. After the fixes, 429 scenarios and 4005 steps pass, and the review finds no open BLOCKER.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-10-21T15:11:42Z
- **Completed:** 2026-10-21T15:26Z
- **Tasks:** 2
- **Files modified:** 8 (7 feature files, `.planning/WINDOWS.md`)

## Verdict

**No open BLOCKER.** Every scenario and Examples row of the 23 feature files was asked the skill's two questions. Every BLOCKER has a fix commit. No fix changed production code, removed a compared value, or removed a row. The baseline was `429 scenarios (429 passed)` / `3952 steps`. After the fixes it is `429 scenarios (429 passed)` / `4005 steps (4005 passed)`: 53 added steps and no added rows.

## Review record: marketplace feature files (Task 1)

Lines are those of the scenario title before this plan's edits.

| File | Line | Scenario | Class | Finding | Fix |
| ---- | ---- | -------- | ----- | ------- | --- |
| add.feature | 267 | Adding a path that holds no marketplace manifest fails as source missing | BLOCKER | A failed add compared its result but not the config, so an add that wrote the declaration before it failed passed | `5d324645`: states that the base config does not exist |
| add.feature | 286 | Adding a marketplace with a malformed or schema-invalid manifest fails as invalid manifest | BLOCKER | Same as above, for every row (dir, file, url) | `5d324645` |
| add.feature | 208 | Adding a marketplace whose name the scope already holds fails as a duplicate name | WARNING | A shared Outline with no `@github` block | WINDOWS 102 |
| add.feature | 286 | (invalid manifest Outline) | WARNING | No `@github` block | WINDOWS 103 |
| autoupdate.feature | 556 | Enabling autoupdate in the base layer reports already autoupdate while the local layer keeps it off | WARNING | States the local config but not the base config, unlike its siblings | WINDOWS 104 |
| file-source-update.feature | - | - | none | Each scenario compares the whole result and the info record; the observing second `When` is accepted (see decisions) | - |
| git-source.feature | 7 | A removed git marketplace can be added again from the same source | WARNING (phase file) | The declaration after the re-add was not compared | `45b90d3c`: states the declaration |
| git-source.feature | 122 | Adding a url marketplace that needs a credential fails as authentication required without one | BLOCKER | Failed add, config not compared | `45b90d3c`: config does not exist |
| git-source.feature | 138 | Adding a github marketplace that needs a credential fails as authentication required without one | BLOCKER | Failed add, config not compared (3 github rows) | `45b90d3c`: config does not exist |
| git-source.feature | 161 | Adding a git marketplace with a stored credential clones it | WARNING (phase file) | The declaration was not compared, so an add that stored another spelling of the source passed | `45b90d3c`: states the declaration |
| git-source.feature | 190 | Updating a git marketplace whose host now needs a credential fails as authentication required | WARNING (phase file) | The declaration after the refused update was not compared | `45b90d3c`: states the declaration stays |
| github-source.feature | 176 | Adding a github marketplace at a ref clones that ref | BLOCKER | The declaration was not compared, so an add that dropped the ref from the config passed, and a reload would then clone `main`. The add's requests were also unstated | `45b90d3c`: states the declaration (stored verbatim, e.g. `acme/tools#stable`) and the two requests |
| github-source.feature | 117, 135 | Tracer and SRC-02 spelling Outline | none | Each row compares the request paths, the verbatim declaration, and the info identity `github / acme / tools` | - |
| help.feature | - | - | none | Whole usage text compared; no stand-ins needed | - |
| info.feature | 54 | Info shows the source identity and description | none | The `#stable` rows compare `source ref stable`, an info field that a wrong github parser changes. The cloned-ref content is proven by the github-source ref Outline | - |
| info.feature | other | - | none | Single-result scenarios use `the command reports these results:` to show that no fallback payload follows; that is a deliberate choice, not a finding | - |
| list.feature | 3 | (feature description) | WARNING | Does not say that the scenarios use local marketplaces in place of published ones | WINDOWS 105 |
| remove.feature | 465 | Removing a marketplace from the base layer keeps a dependency that a plugin of the local layer still needs | BLOCKER | Only the absence of a row showed the dependency was kept, so a remove that dropped it without a row passed | `49233f15`: a new session offers `beta-skill` and `lib-skill` |
| remove.feature | 596 | Removing a marketplace keeps a dependency that a plugin of another marketplace still needs | BLOCKER | Same | `49233f15`: a new session offers `app-skill` and `lib-skill` |
| unsupported-source.feature | 162 | Adding a refused source form fails as unsupported source and reaches no host | BLOCKER | Failed add, config not compared (8 rows) | `5d324645`: config does not exist |
| update.feature | - | - | none | The refresh is observed through `upgradable` and the session in the autoupdate Outlines; the local-only Outlines (`:832`, `:884`) depend on what a git publication cannot carry (an unreadable file), or have git-kind cover at `:111` | - |
| url-source.feature | 43, 59, 74, 90 | The four failed url adds (404, missing ref, dropped connection, server errors) | BLOCKER | Failed add, config not compared | `5d324645`: config does not exist |
| url-source-update.feature | 7 | Updating a url marketplace the git host answers with an HTTP error fails as network error | WARNING | The declaration after the failed update is not restated | WINDOWS 106 |
| url-source-update.feature | 31 | A bare update continues past a url marketplace whose connection drops | WARNING | Same, for both marketplaces | WINDOWS 107 |
| usage-errors.feature | - | - | none | Whole usage-error records compared; no state to check | - |

## Review record: plugin feature files (Task 2)

| File | Line | Scenario | Class | Finding | Fix |
| ---- | ---- | -------- | ----- | ------- | --- |
| configuration.feature | - | - | none | The Background's published marketplace sharpens the dangling-reference scenario (published but not declared), so every scenario uses it | - |
| cross-scope-install.feature | 144 | The `@github` row of the cross-scope Outline | none | Compares the declaration `acme/tools` that the project scope receives, a value that a wrong github implementation changes. No request log, as the rule requires for a verb-shared Outline | - |
| disable.feature | 3 | (feature description) | WARNING | Promises that disabling keeps the plugin installed; both scenarios are refusals | WINDOWS 108 |
| enable.feature | 3 | (feature description) | WARNING | Promises that enabling materializes the plugin again; both scenarios are refusals | WINDOWS 109 |
| install.feature | 46 | Installing a plugin the marketplace does not offer fails as not in manifest | BLOCKER | Compared the result only, so an install that declared the plugin before it failed passed | `8a27a8fe`: no plugin declared, the project scope has no installed plugins |
| install.feature | 57 | Installing a plugin that is already installed fails as already installed | BLOCKER | Compared the result only, so a rollback that removed the first install passed | `8a27a8fe`: the declaration stays, and a new session still offers `demo-skill` |
| reinstall.feature | - | - | none | Every row and declaration is compared; a same-version rebuild has no other user-visible trace | - |
| uninstall.feature | - | - | none | Each refusal states both configs and the session | - |
| update.feature | - | - | none | Each refusal states the configs and the session; successful updates state from/to and the session | - |
| usage-errors.feature | - | - | none | Whole usage-error records compared | - |

## Module sweep (Task 2)

- **Module-level state.** `rg -n '^(export )?(let|var) ' features` prints only `features/support/pi-process.ts:47:let piRun: PiRun | undefined = undefined;`, the slow-process exception. The other module-level containers are constants that no code writes, and all but three are typed `Readonly*` or `as const`: `INFO_FIELDS` in `lib/marketplace-info-fields.ts` and `CERTIFICATE_ARGUMENTS` in `lib/https-git-host/server.ts` are only read. So the suite has no module-level state. **Pass.**
- **Resources.** `rg -n 'mkdtemp|writeFile|spawn|execFile|createServer' features/step_definitions features/support features/lib` lists:
  - `pi-process.ts:73`: the run root. `AfterAll` removes it, and a failed `BeforeAll` removes it too.
  - `server.ts:294`: an `openssl` child that the code awaits.
  - `server.ts:302`: the https server, which `AfterAll` closes through `gitHost.close()`.
  - `layer-config.ts:89,98`: writes in the sandbox scope roots, which `Before()` empties.
  - `git-host.steps.ts:66,68`: the credential files, freed by `onRelease`.
  - `hermetic-git.ts:35`: git children that the code awaits.
  - `published-marketplace.ts:335,357` and `path-marketplace.ts:65,73,114`: files under a publication root, freed by the `onRelease` of the publishing step. The bare repositories are emptied by `gitHost.reset()`, which asserts that none remain.
  - `cgi.ts:140`: per-request `git http-backend` children. The reset asserts `children: 0`.
  - `mcp-configuration.ts:48`: freed by `onRelease`.

  **Pass.**
- **Network and home.** `rg -n 'https?://' features --glob '*.feature'` finds 43 `https://{git host}` URLs, the refused `http://{git host}` URL, and github.com URLs. The github.com URLs are either spellings that the override sends to the git host, or refused forms (`/tree/main`, `https://github.com/acme`). Pi's environment is the allowlist of `rpcChildEnvironment` (`tests/e2e/_rpc.ts:183`): `HOME` and `PI_CODING_AGENT_DIR` from the sandbox, `PI_OFFLINE=1`, `PATH`, and the four git keys that `features/support/pi-process.ts` sets (CA file, no system config, sandbox global config, the GitHub base override). Pi starts with `--offline`. The suite's own git runs use `hermeticGitEnvironment` (a scratch HOME, `GIT_CONFIG_GLOBAL=/dev/null`). The hostile-config control is the by-hand proof of plan 10-07. **Pass.**
- **Steps.** `npm run check:features` exits 0, and its output has no "Feature gate failed". `npx cucumber-js --dry-run --format usage` exits 0, and `grep -ciE 'UNUSED|undefined|ambiguous'` counts 0 matches. `rg -n '^export' features/step_definitions` finds nothing. **Pass.**

## Verification

| Command | Result |
| ------- | ------ |
| `npm run test:cucumber` (after the last fix) | exit 0, `429 scenarios (429 passed)`, `4005 steps (4005 passed)` |
| `npm run check:features` | exit 0, no "Feature gate failed" |
| `npx cucumber-js --dry-run --format usage` | exit 0, 0 matches of `UNUSED\|undefined\|ambiguous` |
| `git diff --name-only 3bc84b58 -- extensions` | `domain/source.ts` and `orchestrators/marketplace/update.ts` only (the fixes of plans 10-03 and 10-04) |
| `git status --short -- features .planning/WINDOWS.md` | empty |
| per-group runs | `add, url-source, unsupported-source, git-source, github-source`: 88 passed. `remove`: 49 passed. `plugin/install`: 11 passed |

## Task Commits

1. **Task 1, failed adds:** `5d324645` (test) show that a failed add declares nothing
2. **Task 1, git source declarations:** `45b90d3c` (test) compare the declarations of the git source scenarios
3. **Task 1, kept dependencies:** `49233f15` (test) show the dependency that a remove keeps
4. **Task 1, WINDOWS:** `d69ce419` (docs) record the marketplace feature review warnings (entries 102-107)
5. **Task 2, refused installs:** `8a27a8fe` (test) show what a refused install leaves behind
6. **Task 2, WINDOWS:** `2e3a85ae` (docs) record the plugin feature review warnings (entries 108-109)

## Files Created/Modified

- `features/marketplace/add.feature`: config-absence step on two failure Outlines
- `features/marketplace/url-source.feature`: config-absence step on four failed adds
- `features/marketplace/unsupported-source.feature`: config-absence step on the refused-form Outline
- `features/marketplace/git-source.feature`: declarations on the re-add, stored-credential, and refused-update Outlines; config absence on both 401 adds
- `features/marketplace/github-source.feature`: the ref Outline states its declaration and its requests
- `features/marketplace/remove.feature`: session skill checks on the two kept-dependency scenarios
- `features/plugin/install.feature`: persisted-state checks on the two refused installs
- `.planning/WINDOWS.md`: entries 102-109 (through `gsd-tools windows append`)

## Decisions Made

See `key-decisions` in the frontmatter. In short: a failed add or install that compares no persisted state is a BLOCKER. A failed update that compares no persisted state is a WARNING. A second `When` that only observes the first one's outcome is not a finding.

## Deviations from Plan

### Auto-fixed Issues

None. No step module, support module, or library module changed. Every fix used existing step texts.

### Process notes

- The commit of `45b90d3c` piped `git commit` output into `grep`, which the plan forbids. The hook ran in full and passed, and the commit exists. The later commits wrote their output to a scratchpad file.
- A WINDOWS entry kind was not named by the plan; the entries use `lint-warning`.

## Issues Encountered

None. Every edit passed on its first run.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Plan 10-07 (the phase gate) can run `npm run check` on this tree. The open review WARNINGs are WINDOWS 102-109. WINDOWS 101 (the plugin-update github 401 remedy) is still open from plan 10-04.

## Self-Check: PASSED

- FOUND: every modified file in `key-files`
- FOUND: commits 5d324645, 45b90d3c, 49233f15, d69ce419, 8a27a8fe, 2e3a85ae (ancestors of HEAD)
