---
phase: 06-failure-message-parity
plan: 01
subsystem: redaction
tags: [system-git, failure-messages, redaction, d-sg-35, d-sg-32, d-sg-31]

requires:
  - phase: 05-credential-surface
    provides: "GitCommandError typed kinds, runRemote as the one network request path, gitHubAddressOf"
provides:
  - "widened redactCredentials (query and name=value fragment values, %40 userinfo, Authorization Basic, long Basic tokens, 42 fixed-prefix provider token rows)"
  - "redactUrlSpellings (port of Claude Code mn/i3e)"
  - "redactShownText, the one per-line D-SG-35 pass"
  - "GitRemote, GitCommandError.remote, GitRequest.remote set by runRemote"
  - "class-preserving redactCauseChain for GitCommandError links"
  - "shared/child-output.ts: compactOutput and boundedNote(note, head|tail)"
  - "features/marketplace/failure-messages.feature"
affects: [06-02, 06-03, 06-04, failure-message remedies, debug-log redaction]

actuals:
  tokens: 20289
  tasks: 3
  commits: 3
plan_head_before: 940dcc0dd738f0734eb4fa2cdb5d27cbec798851
plan_head_after: e11e4dc450aa228b5cf640072f5e8f9e3a2ff7ee

tech-stack:
  added: []
  patterns:
    - "Facts on the error (remote, redacted stderr), wording chosen when shown"
    - "One module-level readonly RegExp[] table for provider token shapes"
    - "Child output shown under one shared compaction and bounding leaf"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/child-output.ts
    - test/shared/child-output.test.ts
    - features/marketplace/failure-messages.feature
  modified:
    - extensions/pi-claude-marketplace/shared/redact-credentials.ts
    - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/platform/git-process.ts
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
    - test/shared/redact-credentials.test.ts
    - test/shared/redact-absolute-paths.test.ts
    - test/shared/errors.test.ts
    - test/platform/git-process.test.ts
    - test/platform/git.test.ts
    - test/architecture/no-credential-leak.test.ts
    - test/orchestrators/plugin/package-install.test.ts

key-decisions:
  - "redactUrlSpellings replaces all spellings of one URL in a single left-to-right pass (longest spelling wins at a position), so a shorter spelling never matches inside the safe form just written"
  - "The query and fragment pair pattern excludes ? from both the name and the value class, which keeps it linear under sonarjs/super-linear-regex; a value then ends at the next ?, &, or #"
  - "The Basic-token rule matches the capitalised word Basic only, with \\s+ as upstream does; Authorization: Basic matches any case"
  - "GitCommandError's details parameter is typed Readonly<{...}>, so the remote field is declared once"

patterns-established:
  - "D-SG-35 order: URL spellings, then redactCredentials, then redactAbsolutePaths, line by line (redactShownText)"
  - "Classify git failures from the raw stderr, store and show the redacted stderr"

requirements-completed: [SG-ERR-02, SG-ERR-01]

coverage:
  - id: D1
    description: "A failed marketplace add shows neither the URL password nor its query token in any result"
    requirement: SG-ERR-02
    verification:
      - kind: e2e
        ref: "features/marketplace/failure-messages.feature#Adding a marketplace from a URL whose password and query token the git host refuses shows neither in the result"
        status: pass
    human_judgment: false
  - id: D2
    description: "redactCredentials masks query and fragment-pair values, %40 userinfo, Basic values, and every provider token row, and keeps #ref, query names, and Basic realm prose"
    requirement: SG-ERR-02
    verification:
      - kind: unit
        ref: "test/shared/redact-credentials.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/no-credential-leak.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "GitCommandError from system git holds stderr redacted in upstream order and a redacted remote; redactCauseChain keeps git links as GitCommandError"
    requirement: SG-ERR-02
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts#createGitProcess failure redaction"
        status: pass
      - kind: unit
        ref: "test/shared/redact-absolute-paths.test.ts#redactShownText"
        status: pass
      - kind: unit
        ref: "test/platform/git.test.ts#D-SG-35, D-SG-23"
        status: pass
    human_judgment: false
  - id: D4
    description: "Package-install notes compact and bound exactly as before through shared/child-output.ts, which can also keep the tail"
    requirement: SG-ERR-01
    verification:
      - kind: unit
        ref: "test/shared/child-output.test.ts"
        status: pass
      - kind: e2e
        ref: "features/plugin/package-dependencies.feature"
        status: pass
    human_judgment: false

duration: 37min
completed: 2026-11-28
status: complete
---

# Phase 6 Plan 01: Redaction before display Summary

**Every git failure is now safe to show before anything shows it: redactCredentials masks URL query tokens, `%40` userinfo, Basic values, and 42 provider token shapes; git's stderr is redacted in Claude Code's `rRe` order when the error is built; the error carries its remote; a redacted cause chain keeps git links typed; and child-output compaction lives in one shared leaf.**

## Performance

- **Duration:** 37 min
- **Started:** 2026-11-28T16:20:24Z
- **Completed:** 2026-11-28T16:57:00Z
- **Tasks:** 3
- **Files modified:** 16
- **PLAN_BASE:** `940dcc0dd738f0734eb4fa2cdb5d27cbec798851`

## Accomplishments

- `redactCredentials` (D-SG-35) gained encoded userinfo, query values, `#name=value` fragment values, `Authorization: Basic`, long `Basic` tokens, and a provider token table, and stays a leaf with no imports.
- `redactUrlSpellings` and `redactShownText`: `settleRun` builds every `GitCommandError` with `stderr: redactShownText(run.stderr, [remote.url])` and still classifies from the raw stderr.
- `GitRemote`, `GitRequest.remote`, `GitCommandError.remote`: `runRemote` sets `{ url: wireUrl, gitHub: gitHubAddressOf(wireUrl) !== undefined }`.
- `redactCauseChain` rebuilds a `GitCommandError` link as a `GitCommandError` (private `rebuiltLink`), with its stderr redacted again (D-SG-31).
- `shared/child-output.ts` holds `compactOutput` and `boundedNote(note, "head" | "tail")` (D-PL9-10, D-SG-32).

## Provider rows added (Claude Code 2.1.332 table)

aws-access-token; gcp-api-key; google-oauth-client-secret; digitalocean-pat; digitalocean-access-token; anthropic-api-key; anthropic-admin-api-key; anthropic-oauth-token; openai-api-key; huggingface-access-token; supabase-secret-key; supabase-pat; gitlab (one pattern, eleven prefixes: `glpat-`, `gldt-`, `glrt-`, `gloas-`, `glptt-`, `glagent-`, `glimt-`, `glsoat-`, `glcbt-`, `glft-`, `glffct-`, with the optional `.xxxxxxxxx` suffix); slack bot, user, config, app, and webhook tokens; npm-access-token; pypi-upload-token; sendgrid-api-token; databricks-api-token; pulumi-api-token; postman-api-token; grafana-cloud-api-token; grafana-service-account-token; sentry-user-token; stripe-access-token; shopify-access-token; shopify-shared-secret. hashicorp-tf (no fixed prefix) and the GitHub rows (the existing rule covers them) are left out, as the plan says. Upstream's consumed trailing boundary became `\b` or a negative lookahead. Where an upper length bound exists (openai, stripe, pypi, grafana-cloud), no trailing boundary is used, so an over-long token still loses its first part. The unit test has one row per provider row and one per gitlab prefix. Each token is built at run time from a prefix constant and a body constant.

## Task 1 scenario: red then green

The scenario is in `features/marketplace/failure-messages.feature`: "Adding a marketplace from a URL whose password and query token the git host refuses shows neither in the result".

- **RED on PLAN_BASE:** I wrote `git show 940dcc0:extensions/pi-claude-marketplace/shared/redact-credentials.ts` over the working file, then ran `node scripts/cucumber.mjs --profile adapter features/marketplace/failure-messages.feature`. Result: `1 scenario (1 failed)`. The step `Then the result lists these marketplaces` showed the actual name `https://***@{git host}/acme/tools.git?private_token=token-word`, so the query token leaked. The new module was restored right after.
- **GREEN on this tree:** the same run gives `1 scenario (1 passed)`, `11 steps (11 passed)`.
- The git host answers 404. The request it receives is `GET /acme/tools.git?private_token=token-word/info/refs&service=git-upload-pack` with status 404. git appends `/info/refs` after the query. The scenario keeps that request table, because it proves the host refused the URL.
- **Rows the run prints:** the failed row shows `{source missing}` and **no cause line**. On PLAN_BASE a single-attempt `marketplace add` shows no cause (`failedAddRow`/`showsAddCause`, the D-SG-31 gap a later plan closes), so no `404 on ...` frame exists yet. The scenario pins the subject `https://***@{git host}/acme/tools.git?private_token=***` and `no result of the command contains` for `pw-word` and `token-word`. This follows the plan's instruction to keep the rows the run shows.

## Task Commits

1. **Task 1: A URL's password and query token stay out of a failed add's result, end to end** - `5786649` (fix)
2. **Task 2: The git process module redacts git's stderr in upstream's order and the error keeps its class and remote** - `826db62` (fix)
3. **Task 3: The package-install output note runs through a shared leaf that can keep either end of the output** - `e11e4dc` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/redact-credentials.ts`: the widened rules, the provider table, `redactUrlSpellings`
- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`: `redactShownText`, `rebuiltLink`
- `extensions/pi-claude-marketplace/shared/errors.ts`: `GitRemote`, `GitCommandError.remote`
- `extensions/pi-claude-marketplace/platform/git-process.ts`: `GitRequest.remote`, redacted `settleRun` details, header paragraph
- `extensions/pi-claude-marketplace/platform/git.ts`: `runRemote` sets `remote`
- `extensions/pi-claude-marketplace/shared/child-output.ts`: new leaf
- `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts`: uses the leaf
- `features/marketplace/failure-messages.feature`: new feature and scenario
- Tests: `test/shared/{redact-credentials,redact-absolute-paths,errors,child-output}.test.ts`, `test/platform/{git-process,git}.test.ts`, `test/architecture/no-credential-leak.test.ts` (four planted rows: a query token and a `%40` password, each in a failed add's block name and in a plain `Error` cause), `test/orchestrators/plugin/package-install.test.ts`

## Decisions Made

- `redactUrlSpellings` makes one left-to-right pass per URL. A sequential `replaceAll` per spelling turned `https://alice:pw@host` into `https://host//`, because the shorter spelling `https://host` matched inside the safe form `https://host/`. One pass has no such interaction.
- `URL_PAIR` is `/([?&#][^=?&#]*=)[^?&#]+/g`. ESLint's `sonarjs/super-linear-regex` flagged the first form, `[^=&#]*`. Leaving `?` out of both classes keeps the pattern linear. A value now also ends at a later `?`, and the later pair is redacted too.
- The `Basic` token rule matches the capitalised word only (`\bBasic\s+` then 20 or more token characters), so lower-case prose such as "basic configuration_management" stays. `Authorization: Basic` matches in any case.
- `GitCommandError`'s `details` type is `Readonly<{ operation; exitCode?; stderr?; remote? }>`, so `readonly remote?: GitRemote` appears once in `errors.ts`, as the acceptance grep expects.
- `remote` follows the file's convention for optional fields (`mpName`). The class field exists as an own `undefined` property when no remote was given, so the unit test asserts `error.remote === undefined`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shorter URL spelling matched inside the safe form**
- **Found during:** Task 2
- **Issue:** Replacing spellings one after another doubled the root slash (`https://host//`).
- **Fix:** A single-pass `replaceSpellings` / `nextSpelling`.
- **Files modified:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts`
- **Verification:** the `redactUrlSpellings` row "replaces a URL with no path by its safe form with the root path"; 100% direct coverage
- **Committed in:** `826db62`

**2. [Rule 3 - Blocking] Existing expectations changed by the new redaction**
- **Found during:** Task 2
- **Issue:** Per-line path redaction cuts paths in git's stderr: `(/Library/Developer/CommandLineTools)` becomes `(CommandLineTools)`, and `/home/user/.gitconfig` becomes `.gitconfig`. Four `git.test.ts` request expectations also lacked the new `remote` field.
- **Fix:** I updated the two `git-process.test.ts` expectations (with a `shownStderr` column on the D-SG-04 rows) and added `remote` to the four `git.test.ts` request literals.
- **Files modified:** `test/platform/git-process.test.ts`, `test/platform/git.test.ts`
- **Committed in:** `826db62`

**3. [Rule 3 - Blocking] super-linear query-pair regex**
- **Found during:** Task 1
- **Fix:** as in Decisions above.
- **Committed in:** `5786649`

**4. Scenario rows differ from the plan's expectation**
- **Found during:** Task 1
- **Issue:** The plan expected a `404 on ...` frame. PLAN_BASE's single-attempt add shows no cause line.
- **Fix:** Kept the rows the run prints, as the plan allows, and added the git host request table that shows the 404.
- **Committed in:** `5786649`

**5. Task 3 test split**
- The two package-install cases that pinned `compactOutput`'s own rules (npm errors, prefixes, and control characters; warnings only) moved to `test/shared/child-output.test.ts`. That file also adds one case for another tool's lines and one for blank-only output. The whole-note package-install cases stay: the 500 cut and the surrogate cases. `package-install.ts` direct coverage stays at 100%.

---

**Total deviations:** 5 (1 bug, 2 blocking, 2 recorded differences)
**Impact on plan:** None changes scope; all keep the locked rules.

## Issues Encountered

- The commit hook's `check:static` reads untracked files. The Task 3 files existed while Task 2 was being committed, so I moved them to the scratch directory for that commit and put them back after it, as the committing skill directs.
- TDD note: this is not a `type: tdd` plan. The Task 1 RED run was local and is recorded above. The scenario and the fix went into one commit, because the hook runs typecheck and every architecture test.

## Verification

- Task 1: `node --test test/shared/redact-credentials.test.ts test/architecture/no-credential-leak.test.ts` passed (96 and 118 tests at Task 1). Cucumber adapter on `failure-messages.feature`, `url-source.feature`, and `hosted-source.feature`: 48 scenarios passed. Direct coverage for `redact-credentials.ts`: 100%. `check:features` exit 0. Acceptance greps: `glpat` 1, `D-SG-35` 5, `^import` 0, and the feature title is present once.
- Task 2: the five owner tests passed (939 tests). Direct coverage for `redact-absolute-paths.ts`, `git-process.ts`, `git.ts`, `errors.ts`, and `redact-credentials.ts`: 100%. `fallow dead-code --no-production --circular-deps --re-export-cycles` exit 0. Greps: `redactUrlSpellings` 1, `redactShownText` 1, `readonly remote?: GitRemote` 1 in `git-process.ts` and 1 in `errors.ts`, `gitHubAddressOf` 3 in `git.ts`.
- Task 3: `child-output` and `package-install` tests passed (96). Direct coverage for both: 100%. `features/plugin/package-dependencies.feature`: 22 scenarios passed. `fallow dupes` exit 0 and `fallow dead-code` exit 0. Greps: `^function (compactOutput|boundedNote)` 0 in `package-install.ts`, `export function boundedNote` 1.
- Plan level: `npm run check:static` passed on the final tree. `test:cucumber:profile -- --profile adapter features/marketplace features/plugin`: **1544 scenarios passed, 18537 steps passed**, run both after Task 2 and on the final tree. `npm run test:modules` passed after Task 1. Every commit hook (`npm run check:commit`) passed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and no stub, skipped test, or unrun verify remains.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later plans can show git's stderr from `GitCommandError.stderr`, already redacted in D-SG-35 order. They can bound it with `boundedNote(compactOutput(stderr), "tail")` and name the host from `error.remote`.
- The single-attempt add row still shows no cause line (D-SG-31). The new feature file is ready for the scenarios that pin each remedy.

---
*Phase: 06-failure-message-parity*
*Completed: 2026-11-28*

## Self-Check: PASSED
