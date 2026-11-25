---
phase: 04-ssh-sources-and-transport-selection
plan: 01
subsystem: source-parser
tags: [system-git, ssh, source-parser, validator, cucumber]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: system git transport with the D-SG-05 protocol bans, and the ssh stand-in features/lib/ssh-git-host/
provides:
  - domain/git-url.ts gitUrlRefusal, the port of Claude Code's git address validator iTs, and isScpGitAddress
  - scp, http, ssh, git+ssh, ssh+git, and host-less file arms in domain/source.ts, all gated by the validator
  - git-subdir url validation (F-2 closed at parse)
  - AddMarketplaceOptions.commandLine and parseAddableSource(rawSource, "command-line")
  - the import git kind in nestedMarketplaceSource
  - scp-safe hostFromCloneUrl
  - harness - ssh launch window, the user's-ssh steps, the ssh plugin source kind, the F-5 profile guard
affects: [04-03, 04-04, 04-05, 04-06, transport-selection, identity-fold]

actuals:
  tokens: 22100
  tasks: 3
  commits: 3
plan_head_before: 6c23d09f1f0de6e8cdcb2a7601973e6cd8c6dff0
plan_head_after: 7e38f262a4815117b3addd7557e694e07206a2f0

tech-stack:
  added: []
  patterns:
    - "Validator as ordered rule tables: AddressRule before the URL parse, UrlRule after, each a small function"
    - "Wire form validated: a source's #ref and trailing slashes come off before gitUrlRefusal reads it"
    - "Command-line form is a parser flag threaded from the edge handler only, never refused in domain/source.ts"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/git-url.ts
    - test/domain/git-url.test.ts
    - features/support/ssh-git-host.ts
    - features/step_definitions/ssh-host.steps.ts
    - features/marketplace/ssh-source.feature
    - features/plugin/ssh-source.feature
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
    - test/domain/source.test.ts
    - test/orchestrators/auth-host.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/edge/handlers/marketplace/add.test.ts
    - test/orchestrators/import/marketplaces.test.ts
    - features/support/world.ts
    - features/lib/git-plugin.ts
    - features/step_definitions/git-host.steps.ts
    - features/marketplace/unsupported-source.feature
    - features/marketplace/url-source.feature
    - features/plugin/import.feature

key-decisions:
  - "The https arm also goes through gitUrlRefusal, so every non-GitHub git address meets the same validator; a github.com URL still folds to the github kind first"
  - "Every string holding ://, starting with git@ or file:, or matching the scp form reaches the validator; ext::cmd with no :// stays a non-relative refusal in the url object form (the git-subdir url always reaches the validator)"
  - "A malformed percent escape in a file: URL is refused as network-shaped (assumption A2, conservative)"
  - "Validator messages show the address through redactCredentials, with control characters as \\u escapes; no 200-character truncation (assumption A1)"
  - "The command-line refusal matches only a real scheme:// prefix other than the case-sensitive http:// and https://, so an scp address holding :// still gets the validator's own message"

patterns-established:
  - "the user's ssh authenticates to {string} as {string} registers a stand-in host; the user's ssh receives these launches: compares the whole argv table of the last When"

requirements-completed: [SG-SSH-01]

coverage:
  - id: D1
    description: "gitUrlRefusal ports Claude Code's ten validator rules with their messages"
    requirement: SG-SSH-01
    verification:
      - kind: unit
        ref: "test/domain/git-url.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "marketplace add git@127.0.0.1:acme/tools.git clones over ssh through the stand-in, with no https request"
    requirement: SG-SSH-01
    verification:
      - kind: e2e
        ref: "features/marketplace/ssh-source.feature#Adding a marketplace from a git@host:path address clones it over ssh"
        status: pass
    human_judgment: false
  - id: D3
    description: "a plugin url source git@host:path installs over ssh; a git-subdir ext:: url is refused before git runs (F-2)"
    requirement: SG-SSH-01
    verification:
      - kind: e2e
        ref: "features/plugin/ssh-source.feature"
        status: pass
      - kind: unit
        ref: "test/domain/source.test.ts#F-2: rejects a git-subdir url that is an ext:: command"
        status: pass
    human_judgment: false
  - id: D4
    description: "the add command line refuses ssh://, git+ssh://, ssh+git://, git:// with upstream's format text; apply and import accept an ssh:// marketplace"
    requirement: SG-SSH-01
    verification:
      - kind: e2e
        ref: "features/marketplace/unsupported-source.feature"
        status: pass
      - kind: e2e
        ref: "features/marketplace/ssh-source.feature#Applying a config that declares an ssh:// marketplace adds it over ssh"
        status: pass
      - kind: e2e
        ref: "features/plugin/import.feature#Importing settings that declare an ssh git marketplace adds it over ssh"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#D-SG-17: the command-line form refuses"
        status: pass
    human_judgment: false
  - id: D5
    description: "an http:// git address reaches git; an http:// catalog URL stays refused (D-PL5-36)"
    requirement: SG-SSH-01
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a marketplace from an http:// git address reaches git instead of being refused"
        status: pass
      - kind: unit
        ref: "test/domain/source.test.ts#D-PL5-36: rejects an HTTP URL to a .json file, since a catalog must use https"
        status: pass
    human_judgment: false
  - id: D6
    description: "usePiWithProfile refuses a no-override profile without the CONNECT proxy (F-5)"
    verification: []
    human_judgment: true
    rationale: "Harness guard in features/support/world.ts; no unit pair exists for the world, and every existing caller passes the proxy, so the throw has no automated case"

duration: 2h 10m
completed: 2026-11-25
status: complete
---

# Phase 4 Plan 01: Git address forms and the validator Summary

**Claude Code's git address validator ported to `domain/git-url.ts` and wired into every git address the parser reads, so scp, http, ssh, git+ssh, ssh+git, and host-less file sources parse and clone over the user's ssh, `git://` and `ext::` are refused at parse, and the add command line keeps refusing the URL-scheme ssh forms with upstream's text.**

## Performance

- **Duration:** about 2h 10m
- **Started:** 2026-11-25
- **Completed:** 2026-11-25
- **Tasks:** 3 of 3
- **Files modified:** 22 (6 created, 16 modified)

## Accomplishments

- `gitUrlRefusal` runs upstream's ten rules in order (control characters, `%00`, brackets, scp, unparseable, protocol, backslash, ssh form, scheme spelling, file). Each rule is a small function in a rule table, with every message verbatim and every address redacted.
- `domain/source.ts` reads an scp address as a `url` source that clones as written (a `git@github.com:` address stays `url`, per OQ-1). It sends every other non-GitHub git address through the validator: the `#ref` splits off first (OQ-6), then the validator reads the wire form. The D-76-01 `unsupportedUrlReason`/`rejectedScheme` helpers are gone.
- A git-subdir `url` that is not an `owner/repo` shorthand goes through the validator, so `ext::sh -c id` and `file://host/share` are refused before git runs. This closes 03-SECURITY F-2.
- `parseAddableSource(raw, "command-line")`, reached only from the `marketplace add` handler through `commandLine: true`, refuses a non-http(s) `scheme://` source with `Invalid marketplace source format. Try: owner/repo, https://..., or ./path`. Apply, import, bootstrap, and the D-MF-04 add accept every validator form.
- Import maps upstream's `{source: "git", url, ref}` marketplace to `url#ref`.
- `hostFromCloneUrl` binds an scp address to its host instead of throwing.
- The cucumber harness has its first ssh steps: a launch window per `When`, `the user's ssh authenticates to {string} as {string}`, `the user's ssh receives these launches:`, and `the user's ssh receives no launch`. It also gains an `ssh` plugin source kind, a git-host connection-count step, and the F-5 guard.

## Task Commits

1. **Task 1: Adding a marketplace from a git@host:path address clones it over SSH, end to end** (tracer) - `c6dc15f` (feat)
2. **Task 2: Every git address goes through upstream's validator, and a plugin url source installs over SSH** - `6f04d5e` (feat)
3. **Task 3: The add command line keeps refusing the URL-scheme SSH forms while config, apply, and import accept them** - `7e38f26` (feat)

TDD note: the commit hook typechecks and lints the whole tree, so each task's tests and code went into one commit. Each task's tests ran red locally first (recorded below). The tracer gate after Task 1 re-ran its scenario on the committed tree and it passed ("Tracer verified end-to-end -- expanding").

## TDD red runs

- **Task 1:**
  - `node --test test/domain/git-url.test.ts` with `domain/git-url.ts` absent: `ℹ tests 1, fail 1` (module missing).
  - `test/domain/source.test.ts` before the scp arm: `ℹ tests 218, pass 208, fail 10`. The failures were the scp rows ("parses an scp address as a url source", the object-form scp rows, and others).
  - `test/orchestrators/auth-host.test.ts`: `ℹ tests 52, fail 4` (the four scp-host rows).
  - Scenario "Adding a marketplace from a git@host:path address clones it over ssh" on the old parser: failed at `the result has these fields` (`severity error`, `A marketplace operation has failed.`; the add said `unsupported source`).
- **Task 2:**
  - `test/domain/source.test.ts` and `test/domain/git-url.test.ts` against the Task 1 sources: `ℹ tests 288, pass 242, fail 46`. The failures covered every new validator rule, the ssh/http/file arms, F-2, and D-PL5-36.
  - `features/plugin/ssh-source.feature` against the Task 1 tree: the ext:: scenario failed at `the result lists these plugins`. Against the base tree, both scenarios failed. The scp plugin scenario already passes on the Task 1 tree, because Task 1's scp arm covers the url object form.
- **Task 3:**
  - Unit tests against the Task 2 sources: `ℹ tests 266, pass 257, fail 9`. The failures were the command-line refusals, the handler case, the addMarketplace `commandLine` case, and the import `git` shape.
  - Cucumber against the Task 2 sources: 4 failed. They were the import ssh scenario and the `ssh://`, `git+ssh://`, and `ssh+git://` rows of `unsupported-source.feature`.
  - The apply ssh:// scenario and the http:// git scenario pass on the Task 2 tree and fail on the base tree. Measured: apply failed at its fields, and the http add reported `unsupported source`.

## Whole-suite counts (after Task 3)

- `npm run test:modules`: 19436 tests, 19436 pass, 0 fail. The `dispatch-exec.test.ts:39` baseline did not fail.
- `npm run test:integration`: 236 tests, 236 pass, 0 fail.
- `test:cucumber:profile --profile adapter features/marketplace features/plugin`: 1455 scenarios, 1455 passed (17264 steps).
- `test:cucumber:profile --profile builtin features/plugin`: 41 scenarios, 41 passed (528 steps).
- The commit hook (`check:commit`: typecheck, lint, fallow, format, test:corresponding, check:features, unpaired tests, direct coverage of staged pairs) passed on all three commits.
- Direct coverage of all six plan sources is 100%: `test:coverage:direct` exits 0 for git-url, source, auth-host, marketplace add, the edge add handler, and import marketplaces.

## Decisions Made

See `key-decisions` in the frontmatter. The main judgement calls:

- **The https arm also goes through the validator.** The plan names the http and ssh arms, but D-SG-17 says every git address goes through the validator. No existing test changed.
- **The command-line refusal matches only a real `scheme://` prefix.** An scp address that holds `://` keeps the validator's own message, as upstream's `$Ce` scp arm would give it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two add.test.ts cases broke in Task 1 and were not caught by the hook**
- **Found during:** Task 2 (a run of every test that names an address form)
- **Issue:** "MA-10 / ATTR-07: unknown source kind renders..." and "RECON-03 orchestrated mode -- unsupported source..." used `git@github.com:foo/bar.git` as the refused source, which Task 1 made valid. The hook runs only the tests paired with staged sources, so Task 1's commit passed with these two cases failing.
- **Fix:** they now use `git://github.com/foo/bar.git`, which the validator refuses in every form.
- **Files modified:** test/orchestrators/marketplace/add.test.ts
- **Committed in:** 6f04d5e

**2. [Rule 3 - Blocking] Lint rejected the control-character regexes and a super-linear regex**
- **Found during:** Task 2 commit
- **Fix:** a char-code predicate (`isControlCharacter`) replaces the regexes, and an indexOf-based `maskedQuery` replaces the backtracking replace. A new bracket-free test row covers the remaining branches.
- **Committed in:** 6f04d5e

**3. [Rule 1 - Plan example] `git@host://x` never reaches the scp-with-`://` rule**
- **Issue:** upstream's scp regex ends in `(?!\/\/)`, so `git@host://x` is no scp address. It gets the "could not be read as a URL" message.
- **Fix:** the tests pin that outcome, and they pin the scp message with `git@host.example:o/r://x`.

**4. [Scope] Plan rows and steps adjusted to measured behavior**
- `unsupported-source.feature`: the new `git+ssh://` and `ssh+git://` rows have no `git@` userinfo. The row name is the redacted subject, so `git@` would show as `***@` in the outline's `<source>` name column.
- `url-source.feature`: the http:// scenario cannot state `the git host receives no request`. git's plain-http attempt on the host's TLS port is one connection with no request, which proves the add reached the host. For that, `features/step_definitions/git-host.steps.ts` gained `the git host accepts {int} connection(s) and receives no request`. That file is outside `files_modified`, and plan 04-02 does not touch it. The measured reason is `network unreachable`.
- The `git://` and `http://…/marketplace.json` rows of `unsupported-source.feature` and the apply and http scenarios pass on the tree before Task 3, because Task 2 or the base tree already refuses or accepts those forms. They fail on the base tree, except the two refusal rows, which have always been refused.
- `the user's ssh receives no launch` was added in Task 2, not Task 1, because `check:features` rejects an unused step.

**Total deviations:** 4 (2 auto-fixed bugs or blockers, 2 adjustments to measured behavior). **Impact:** none on scope. The extra files are `features/step_definitions/git-host.steps.ts` (one step) and `test/orchestrators/marketplace/add.test.ts` (it is in the plan, but changed one task early).

## Issues Encountered

- The Write tool turned `\u2014` and `\u2026` escapes into the literal characters in `git-url.ts`. They were restored as escapes so the pre-commit dash fixer cannot rewrite upstream's messages.
- The worktree had no optional-peer cache. `node scripts/install-test-peers.mjs`, the project's own script for its pinned test peers, installed it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-01 (F-2), T-04-02 (leading `-` in an scp or ssh user or host), T-04-03 (file host or UNC path), T-04-04 (redacted messages), and T-04-05 (F-5 guard) are mitigated as planned. No package was added (T-04-SC).

## Orchestrator actions

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 04-03 through 04-06 can build on `gitUrlRefusal`, the scp-safe `hostFromCloneUrl`, and the ssh steps. The git-subdir `owner/repo` shorthand still keeps its `url` as written. Its wire form belongs to D-SG-20, in a later plan.

## Self-Check: PASSED

- Files created exist: domain/git-url.ts, test/domain/git-url.test.ts, features/support/ssh-git-host.ts, features/step_definitions/ssh-host.steps.ts, features/marketplace/ssh-source.feature, features/plugin/ssh-source.feature.
- Commits c6dc15f, 6f04d5e, and 7e38f26 are ancestors of HEAD.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-25*
