---
phase: 06-failure-message-parity
plan: 04
subsystem: failure-messages
tags: [system-git, failure-messages, remedy, cause-chain, d-sg-31, d-sg-32, d-sg-33, d-sg-34]

requires:
  - phase: 06-failure-message-parity
    provides: "GitCommandError.remote and redacted stderr, shared/child-output.ts (06-01); the one HTTPS auth typed line (06-03)"
provides:
  - "shared/git-failure-remedy.ts: gitFailureRemedy, GitRemedyClass, GitRemedyFacts (a leaf with no imports)"
  - "shared/errors.ts: GIT_REMEDY_CLASSES, gitFailureDetails, and serializeCauseChain expanding each git link into typed line, remedy, and git printed: output"
  - "the plugin both-transports text ends with `Then run the command again.`"
  - "features/lib/run-tokens.ts: {uuid} and {clone key} projections of a causeChain cell"
  - "every marketplace and plugin pin of a git cause chain rewritten to show the remedy and git's output"
affects: [06-05, 06-06, 06-07, cause-chain rendering, cucumber run tokens]

actuals:
  tokens: 38844
  tasks: 3
  commits: 3
plan_head_before: 82b306d5e5e3a3c98f26ef809a8dc6b48690c103
plan_head_after: 080fe39879c9588c1b2f80dd696017903fac521f

tech-stack:
  added: []
  patterns:
    - "A cause chain link expands into entries in the serializer; the depth bound counts links, not entries"
    - "The remedy class comes from the typed kind through a satisfies Record table; the wording lives in a leaf with no imports"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/git-failure-remedy.ts
    - test/shared/git-failure-remedy.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - test/shared/errors.test.ts
    - features/lib/run-tokens.ts
    - .agents/skills/cucumber/rules/features.md
    - features/marketplace/credentials.feature
    - features/marketplace/git-source.feature
    - features/marketplace/github-refresh.feature
    - features/marketplace/github-transport.feature
    - features/marketplace/url-source-update.feature
    - features/marketplace/url-source.feature
    - features/plugin/bootstrap.feature
    - features/plugin/credentials.feature
    - features/plugin/fetch.feature
    - features/plugin/git-source-update.feature
    - features/plugin/git-source.feature
    - features/plugin/github-transport-update.feature
    - features/plugin/github-transport.feature
    - features/plugin/reinstall.feature
    - features/plugin/update.feature
    - features/plugin/url-marketplace-update.feature
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/github-transport.test.ts
    - test/orchestrators/plugin/fetch.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/edge/handlers/plugin/reinstall.test.ts

key-decisions:
  - "gitFailureDetails stays exported, as the plan says, with a fallow-ignore-next-line unused-export marker: serializeCauseChain uses it in production and the module test reads it directly. When 06-06's redactOnwardChain imports it, fallow reports the marker as stale, and that plan removes it"
  - "A causeChain cell also projects mirror-<12 hex> to mirror-{clone key}, because a url source's mirror key hashes a URL that holds the git host's port"
  - "A URL with a scheme that parses but has no host (file:///...) names the generic host phrase; otherwise the plan's host rules apply as written"
  - "A timeout fact with no limit renders 0 seconds (`?? 0`); a GitCommandError timeout always carries its limit"

patterns-established:
  - "linkEntries: a GitCommandError link yields [message, ...gitFailureDetails(link)], any other link [linkMessage(link)], and every entry is redacted again"
  - "An Outline whose git output differs per row takes a <git output> Examples column"

requirements-completed: [SG-ERR-01, SG-ERR-02]

coverage:
  - id: D1
    description: "Each remedy class words its sentence exactly as locked, with the host rules (scp host, <host>, GitHub, host with port, your git host, this host) and the remote:-free network check"
    requirement: SG-ERR-01
    verification:
      - kind: unit
        ref: "test/shared/git-failure-remedy.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "serializeCauseChain expands a git link into typed line, remedy, and git printed: output in that order; no output entry for blank stderr or git-missing; D-SG-34 kinds show output only; truncation unchanged; a second redaction pass; only the last both-transports attempt expands"
    requirement: SG-ERR-01
    verification:
      - kind: unit
        ref: "test/shared/errors.test.ts#serializeCauseChain"
        status: pass
      - kind: unit
        ref: "test/shared/errors.test.ts#gitFailureDetails"
        status: pass
      - kind: unit
        ref: "test/architecture/no-credential-leak.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed marketplace update answered 403 shows the HTTPS remedy for {git host} and git's 403 line"
    requirement: SG-ERR-01
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a git marketplace whose host answers 403 before any credential is sent fails as authentication required and says how to give git a credential"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every marketplace and plugin row that shows a git cause chain shows its class's remedy and git's output, and the plugin both-transports text ends with the neutral sentence"
    requirement: SG-ERR-01
    verification:
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile adapter features/marketplace features/plugin (1545 passed)"
        status: pass
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile builtin features/marketplace features/plugin (42 passed)"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-11-28
status: complete
---

# Phase 6 Plan 04: Remedy and git output in every git cause chain Summary

**Every `GitCommandError` link of a cause chain now renders as its typed line, then the remedy that Claude Code 2.1.332 gives its class in Pi's plain wording, then `git printed: <output>` with git's redacted stderr compacted to one line and cut to its last 500 characters. The plugin both-transports text ends with `Then run the command again.`, and every marketplace and plugin pin shows the new chain.**

## Performance

- **Duration:** about 42 min
- **Started:** 2026-11-28T18:55:02Z
- **Completed:** 2026-11-28T19:37:00Z
- **Tasks:** 3
- **Files modified:** 29
- **PLAN_BASE:** `82b306d5e5e3a3c98f26ef809a8dc6b48690c103`

## Accomplishments

- `shared/git-failure-remedy.ts`: a leaf with no imports. `gitFailureRemedy` switches over the closed `GitRemedyClass` union with no `default`, one small function per class, with every sentence copied from the plan's locked wording table. It names no GitHub host literal: GitHub comes from `remote.gitHub`. The network check removes `remote: ` lines first (WR-01) and looks for `timed out`, `timeout`, or `Could not resolve host`.
- `shared/errors.ts`: `GIT_REMEDY_CLASSES` (`as const satisfies Record<GitFailure["kind"], GitRemedyClass | "none">`), `gitFailureDetails`, and the private `linkEntries`. `serializeCauseChain` now returns `links.flatMap(linkEntries).map(redactCredentials)`. The walk, `CAUSE_CHAIN_MAX_DEPTH`, and `truncated` did not change. The walker JSDoc and the `GitCommandError` JSDoc say a git link yields up to three entries.
- The plugin wrapper's last sentence is now `Then run the command again.`. The class JSDoc says the sentence names no verb.
- `features/lib/run-tokens.ts`: in a `causeChain` cell, a lowercase UUID becomes `{uuid}`, and `mirror-<12 hex>` becomes `mirror-{clone key}`. Both are documented in `.agents/skills/cucumber/rules/features.md`.

## Pins rewritten (rows that gained a remedy, `git printed:`, or the new last sentence)

| File | Rows |
|---|---|
| features/marketplace/credentials.feature | 4 |
| features/marketplace/git-source.feature | 9 (the 403 update Outline is retitled) |
| features/marketplace/github-refresh.feature | 1 |
| features/marketplace/github-transport.feature | 1 |
| features/marketplace/url-source-update.feature | 4 (the status Outline gains a `git output` column) |
| features/marketplace/url-source.feature | 1 (the status Outline template) |
| features/plugin/bootstrap.feature | 1 |
| features/plugin/credentials.feature | 2 |
| features/plugin/fetch.feature | 3 |
| features/plugin/git-source-update.feature | 3 |
| features/plugin/git-source.feature | 3 |
| features/plugin/github-transport-update.feature | 1 |
| features/plugin/github-transport.feature | 1 |
| features/plugin/reinstall.feature | 1 |
| features/plugin/update.feature | 2 |
| features/plugin/url-marketplace-update.feature | 1 (the status Outline gains a `git output` column) |

I read each new cell against the wording table. Each HTTPS auth row (401, refused, no credential) shows the HTTPS remedy for `{git host}`. Under the base override, that is also true for GitHub sources (RESEARCH A1). Each SSH key refusal on GitHub shows the `SSH authentication with GitHub failed` remedy. A 404, a 5xx, a TLS drop, and a protocol error show `git printed:` with no remedy (D-SG-34). No row hit the network remedy's three texts. Acceptance counts: `git printed: ` appears 20 times in features/marketplace and 18 in features/plugin. `SSH authentication with GitHub failed` appears 6 times in features/marketplace. `Then install again.` appears 0 times in features/. `check:features` exits 0.

These files were listed in the plan but needed no change, because their scenarios and tests passed unchanged: `features/marketplace/failure-messages.feature`, `features/marketplace/ssh-source.feature`, `test/orchestrators/marketplace/add.test.ts`, `test/orchestrators/marketplace/clone-swap.test.ts`, and `test/orchestrators/plugin/install-cascade.messaging.test.ts`.

## Unit tests changed

- `test/shared/git-failure-remedy.test.ts` (new, 27 rows): every wording row and host rule. It covers 1499 ms and 1500 ms, the scp host, `<host>`, GitHub, an https host with its port, the default port left out, an ssh:// host and port, `your git host`, `this host`, `file:///`, a local path, the three network texts, CRLF input, a `remote:`-only text, a refused connection, and both `no-stderr` forms.
- `test/shared/errors.test.ts`: seven `serializeCauseChain` cases (the three entries in order, blank stderr, git-missing, a D-SG-34 kind, the depth bound with `truncated`, a token that shows only once its escape codes are gone (the second pass), and a both-transports error where only the last attempt expands). Four `gitFailureDetails` cases (timeout seconds, the no-stderr exit code, a 502 with output only, and the 500-character tail). The two plugin wrapper pins now end with the new sentence, and one title changed.
- `test/orchestrators/marketplace/update.test.ts` (seven expectations, plus a module `HTTPS_AUTH_REMEDY` constant).
- `test/orchestrators/github-transport.test.ts` (wrapper sentence).
- `test/orchestrators/plugin/fetch.test.ts` (two HTTPS remedies and the wrapper sentence), `update-flow.test.ts` (three), `install-flow-ledger.test.ts` (two), and `reinstall-flow.test.ts` (git's 404 line).
- `test/edge/handlers/plugin/reinstall.test.ts`: the real-git cold-clone case now pins git's output with `assert.match`, so that curl's `after <n> ms` may vary.

## Task Commits

1. **Task 1: A failed marketplace update says how to give git a credential and shows what git printed, end to end**: `1be1b49` (feat)
2. **Task 2: Every marketplace pin shows the remedy and git's output for its failure**: `17e4de3` (test)
3. **Task 3: Every plugin pin shows the remedy and git's output, and the plugin wrapper ends with the neutral sentence**: `080fe39` (test)

## TDD and RED record

This is not a `type: tdd` plan. Task 1 is the tracer. The commit hook runs typecheck and every architecture test, so I committed the tests and the code together.

- RED: `node scripts/cucumber.mjs --profile adapter features/marketplace/git-source.feature --name 'answers 403'` against the old pin failed (`1 scenario (1 failed)`). The run's actual cell was `..., git ls-remote failed: https-auth, exit code 128, HTTPS authentication with {git host} failed. ... git printed: fatal: unable to access 'https://{git host}/acme/tools.git/': The requested URL returned error: 403`, and the pin expected the typed line only. On PLAN_BASE the serializer has no remedy, so the new pin fails there as well.
- GREEN: the same run gives `11 steps (11 passed)`.
- Tracer gate: after Task 1, the automated verify passed end to end: owner tests 309/309, 100% direct coverage of both sources, and the 403 scenario. Then expansion went ahead.

## Verification

- Task 1: `node --test test/shared/git-failure-remedy.test.ts test/shared/errors.test.ts test/architecture/no-credential-leak.test.ts`: 309 pass. `test:coverage:direct` for `git-failure-remedy.ts` and `errors.ts`: exit 0, no line below 100%. The 403 scenario passes. Acceptance greps: the leaf exists, `^import` 0, `ssh-keygen -R` 2, `export function gitFailureDetails` 1, `Then install again.` 0 and `Then run the command again.` 1 in errors.ts, and `claude code` 0 in the leaf.
- Task 2: `features/marketplace` adapter: 607 scenarios passed. The first run had 26 failures, all of them pins. The four marketplace unit files: 554 pass.
- Task 3: `features/plugin` adapter: 938 passed after the rewrite. The six plugin and edge unit files: 942 pass. `test:coverage:direct -- --base 82b306d...`: exit 0.
- Plan level: `npm run test:modules` exit 0 and `npm run test:integration` exit 0, both on the Task 3 tree. Adapter `features/marketplace features/plugin`: **1545 scenarios passed, 18549 steps passed**. Builtin profile over the same trees: 42 passed. `check:static` passed in all three commit hooks (`npm run check:commit`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow reported `gitFailureDetails` as an unused export**
- **Found during:** Task 1 commit hook
- **Issue:** No production module outside errors.ts imports it yet. 06-06's `redactOnwardChain` is the first one.
- **Fix:** I kept the export, as the plan says, and added `// fallow-ignore-next-line unused-export -- serializeCauseChain above expands each git link through it in production, and the module test reads it directly.` The precedent is `createGitProcess` in `platform/git-process.ts`. The repo now has 54 `fallow-ignore` markers, and `.planning/codebase/CONVENTIONS.md` still says 53. When 06-06 imports the function, fallow reports this marker as stale, and that plan must delete it.
- **Files modified:** `extensions/pi-claude-marketplace/shared/errors.ts`
- **Committed in:** `1be1b49`

**2. [Rule 3 - Blocking] A plugin mirror folder name changes on every run**
- **Found during:** Task 3
- **Issue:** git prints `Cloning into 'mirror-<key>'...`. For a url source, the key hashes a URL that holds the git host's port, so two runs printed `mirror-42c2497e6fc9` and `mirror-9ead84b61e5b` for the same row.
- **Fix:** In a `causeChain` cell, `features/lib/run-tokens.ts` also projects `mirror-<12 hex>` to `mirror-{clone key}`. The cucumber features rule documents the token. Every new pin uses it, GitHub mirrors too, because their key never changes and one form is simpler.
- **Files modified:** `features/lib/run-tokens.ts`, `.agents/skills/cucumber/rules/features.md`, and six plugin feature files
- **Committed in:** `080fe39`

**3. [Rule 1 - Bug] A pin that varies with curl's timing**
- **Found during:** Task 3
- **Issue:** The real-git edge reinstall case reaches `127.0.0.1:9`. curl prints `after 0 ms`, and that number can vary.
- **Fix:** `assert.match` with an anchored pattern that pins the whole notice and allows `\d+` milliseconds, plus a `deepStrictEqual` on the severities.
- **Files modified:** `test/edge/handlers/plugin/reinstall.test.ts`
- **Committed in:** `080fe39`

**4. Outline templates**
- The url status Outlines of `features/marketplace/url-source-update.feature` and `features/plugin/url-marketplace-update.feature` gained a `git output` column, because the 404 row prints a different git line. `features/marketplace/url-source.feature` appends `git printed: ...<status>` to its template.

**5. Small logic choices in the leaf (no wording changed)**
- A timeout fact with no `timeoutMs` renders `0 seconds` (`?? 0`, unit-tested). A `GitCommandError` timeout always carries its limit.
- A URL with `://` that parses but has an empty host (`file:///...`) names `your git host` or `this host`. It does not fall through to the scp pattern, which would read the scheme as a host.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug), plus 2 recorded choices
**Impact on plan:** No wording, reason, kind, retry rule, or transport changed. The locked sentences are copied exactly.

## Issues Encountered

- Some pins now hold text that git and curl print, for example `GnuTLS recv error (-110): The TLS connection was non-properly terminated.` for a dropped connection, `protocol error: bad line length character: this`, and curl's `Couldn't connect to server`. They are stable across runs here (git 2.43, Ubuntu GnuTLS build), and CI uses the same Ubuntu git family. A git built against OpenSSL would word the TLS drop differently.
- The harness refuses command text that names paths containing `git`, so every check ran from small scripts in the scratch directory.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and no stub, skipped test, or unrun verify remains. `.planning/codebase/CONVENTIONS.md` and `STACK.md` now undercount the `fallow-ignore` markers (53 there, 54 in the tree) and do not list the `{clone key}` token. Update them when the codebase map is refreshed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-05 can add the AUTH-09 interpolation scan of the leaf. The leaf interpolates only `host`, `label`, `seconds`, `unit`, and `code`. 06-05 can also add the planted git-output row; `no-credential-leak.test.ts` passes unchanged.
- 06-06 can import `gitFailureDetails` for `redactOnwardChain`, and must delete its `unused-export` marker in the same commit.

---
*Phase: 06-failure-message-parity*
*Completed: 2026-11-28*

## Self-Check: PASSED
