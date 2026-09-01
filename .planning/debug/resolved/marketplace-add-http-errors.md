---
status: resolved
trigger: "let's capture in gsd that if i do marketplace add <some non-existent repo/url>, i get a 404 error message like: (no marketplaces) Extension \"command:claude:plugin\" error: HTTP Error: 404 Not Found. we should try to make it more friendly (along with other errors that may occur in a broader set of cases)"
created: 2026-08-29T11:30:31-04:00
updated: 2026-08-29T12:25:14-04:00
---

## Current Focus

hypothesis: "The opt-in source-access helper preserves marketplace-add HTTP mappings while shared transport classification preserves plugin-update fallthroughs."
test: "Run the shared classifier tests, D-76-09 marketplace-add tests, the full plugin update file outside the sandbox, and fallow."
expecting: "All focused gates pass, and plugin update keeps non-installable GitHub sources on the existing no longer installable reason."
next_action: "Commit and push the focused fix, then let CI analyze the branch."
bug_class: bohrbug
reasoning_checkpoint:
  hypothesis: "The shared git transport classifier returns undefined for clone HttpError 404/410/429/5xx, so handleAddFailure rethrows in standalone mode and falls back to unparseable in orchestrated mode."
  confirming_evidence:
    - "tests/shared/git-failure-classifiers.test.ts now shows HttpError 404, 410, 408, 429, 500, 502, 503, and 504 classify as undefined."
    - "tests/orchestrators/marketplace/add.test.ts now shows standalone add rethrows HttpError 404 and 429 before notify() can emit a row."
    - "tests/orchestrators/marketplace/add.test.ts now shows orchestrated add maps HttpError 410 to unparseable instead of source missing."
  falsification_test: "If extending classifyGitTransportFailure does not make the add tests pass, the error is not at this shared classification boundary."
  fix_rationale: "addMarketplace already delegates clone failures to classifyGitTransportFailure; widening that classifier fixes every existing consumer without new output paths."
  blind_spots: "The exact isomorphic-git status shapes are represented by duck-typed test errors; the tests do not perform live network clones."
  candidate_causes:
    - "code: classifyGitTransportFailure omits repository-missing and transient HTTP status classes."
    - "config: no marketplace or auth setting changes classification; the reproducer uses injected GitOps and deterministic status payloads."
    - "environment: real hosts can return 404, 410, 429, or 5xx, but the error shape is the same boundary object."
    - "data: the raw source parses as a valid url or github source, so unsupported-source parsing is not the cause."
  and_gate: "no; one missing classifier branch fully explains both the standalone raw throw and the orchestrated unparseable fallback."
tdd_checkpoint: null

## Symptoms

expected: Marketplace add reports a concise, friendly error that names the failed source and gives useful corrective action when possible.
actual: Pi shows no marketplaces and renders the raw extension error from the command boundary.
errors: 'Extension "command:claude:plugin" error: HTTP Error: 404 Not Found'
reproduction: Run marketplace add with a repository URL that does not exist.
started: Observed on 2026-08-29; whether an earlier version handled this case is unknown.

## Eliminated

- hypothesis: The edge handler prints raw marketplace add errors directly.
  evidence: edge/handlers/marketplace/add.ts delegates to addMarketplace and contains no direct ctx.ui.notify or stdout path for clone failures.
  timestamp: 2026-08-29T11:36:49-04:00

- hypothesis: Source parsing classifies the non-existent repository as an unsupported source before clone.
  evidence: The add tests reach injected gitOps.clone for url sources; the failure occurs after parsePluginSource accepts the URL.
  timestamp: 2026-08-29T11:36:49-04:00

- hypothesis: The plugin update no-longer-installable failures are caused by shared 5xx classification.
  evidence: The sandbox plugin update failures came from pre-existing EAI_AGAIN handling; the escalated aggregate run later failed only where generic NotFoundError/source-missing mapping changed update fallthroughs.
  timestamp: 2026-08-29T12:20:43-04:00

## Evidence

- timestamp: 2026-08-29T11:33:32-04:00
  checked: .planning/debug/knowledge-base.md
  found: No resolved entry matched marketplace add, HTTP 404, or raw repository/network errors.
  implication: Treat the prior-state hypothesis as unconfirmed and trace the command boundary directly.

- timestamp: 2026-08-29T11:33:32-04:00
  checked: .agents/skills/simple-english/SKILL.md
  found: User-facing error text must use short, direct sentences with conditions before commands.
  implication: New marketplace add notifications must be concise and action-oriented.

- timestamp: 2026-08-29T11:35:13-04:00
  checked: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  found: addGitClonedInGuard cleans staging after gitOps.clone throws, then rethrows to addMarketplace.
  implication: The correct notification boundary is the existing handleAddFailure catch, not the clone cleanup block.

- timestamp: 2026-08-29T11:35:13-04:00
  checked: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts and shared/git-failure-classifiers.ts
  found: classifyAddError delegates Git transport errors, but the shared classifier only handles HttpError 401/403 and errno network failures.
  implication: HttpError 404, 410, 429, and 5xx return undefined and escape standalone marketplace add as raw errors.

- timestamp: 2026-08-29T11:35:13-04:00
  checked: tests/orchestrators/marketplace/add.test.ts
  found: Existing tests prove 401/403 and UserCanceledError route through notify, but no test covers repository-missing HTTP statuses.
  implication: No regression guard existed for the reported 404 clone failure.

- timestamp: 2026-08-29T11:36:49-04:00
  checked: node tests/shared/git-failure-classifiers.test.ts
  found: New classifier cases fail because HttpError 404, 410, 408, 429, 500, 502, 503, and 504 all return undefined.
  implication: The regression test directly reproduces the shared classifier gap.

- timestamp: 2026-08-29T11:36:49-04:00
  checked: node tests/orchestrators/marketplace/add.test.ts
  found: New add tests fail because standalone HttpError 404/429 rethrow raw and orchestrated HttpError 410 returns reason unparseable.
  implication: The command-boundary symptom is reproduced without live network access.

- timestamp: 2026-08-29T11:36:49-04:00
  checked: node tests/orchestrators/marketplace/add.test.ts
  found: Pre-existing Unix socket path test fails with sandbox EPERM while binding /tmp/mp-add-sock-2.sock.
  implication: Treat that failure as environment noise unrelated to the marketplace add HTTP classifier change.

- timestamp: 2026-08-29T11:40:04-04:00
  checked: node tests/shared/git-failure-classifiers.test.ts
  found: All 24 classifier tests pass after the shared classifier change.
  implication: The new source missing and network unreachable HTTP mappings are pinned.

- timestamp: 2026-08-29T11:40:04-04:00
  checked: node --test --test-name-pattern D-76-09 tests/orchestrators/marketplace/add.test.ts
  found: The three marketplace-add HTTP regression tests pass.
  implication: Standalone add now emits notify-routed rows and orchestrated mode returns source missing for gone repositories.

- timestamp: 2026-08-29T11:40:04-04:00
  checked: npm run typecheck
  found: TypeScript completed successfully.
  implication: Widening classifyGitTransportFailure to include source missing is type-compatible with consumers.

- timestamp: 2026-08-29T11:40:04-04:00
  checked: npm run lint
  found: ESLint completed successfully.
  implication: The code and tests satisfy the repo lint gate.

- timestamp: 2026-08-29T11:40:04-04:00
  checked: node tests/orchestrators/marketplace/update-transport.test.ts and node --test --test-name-pattern FTCH-06 tests/orchestrators/plugin/fetch.test.ts
  found: Adjacent marketplace update and plugin fetch transport tests pass.
  implication: Existing 401/403 auth behavior and non-auth 500 network behavior still hold for neighboring consumers.

- timestamp: 2026-08-29T11:41:10-04:00
  checked: npm run fallow
  found: fallow health failed because classifyGitTransportFailure reached cyclomatic 23 and cognitive 18.
  implication: The behavioral fix must be refactored before it satisfies the repository quality gate.

- timestamp: 2026-08-29T11:41:10-04:00
  checked: npm run format:check
  found: Prettier reported all matched files use the expected style.
  implication: Formatting is clean before the classifier refactor.

- timestamp: 2026-08-29T11:54:34-04:00
  checked: node tests/shared/git-failure-classifiers.test.ts
  found: All 24 classifier tests pass after the helper refactor.
  implication: The widened HTTP and NotFoundError mappings survived the complexity-reducing refactor.

- timestamp: 2026-08-29T11:54:51-04:00
  checked: node --test --test-name-pattern D-76-09 tests/orchestrators/marketplace/add.test.ts
  found: The marketplace-add HTTP regression pattern passes after the helper refactor.
  implication: Standalone add and orchestrated add still map missing and transient HTTP clone failures to notify-safe reasons.

- timestamp: 2026-08-29T11:55:16-04:00
  checked: npm run fallow
  found: fallow completed with exit code 0 after the helper refactor.
  implication: The prior classifyGitTransportFailure complexity blocker is resolved.

- timestamp: 2026-08-29T11:58:32-04:00
  checked: npm run check
  found: The aggregate gate reached npm test and failed in tests/orchestrators/marketplace/add.test.ts, tests/orchestrators/plugin/update.test.ts, and tests/platform/git-remote-refs.test.ts.
  implication: The failed files must be rerun individually to separate change-caused failures from existing environment noise.

- timestamp: 2026-08-29T12:01:34-04:00
  checked: node tests/orchestrators/marketplace/add.test.ts, node tests/orchestrators/plugin/update.test.ts, and node tests/platform/git-remote-refs.test.ts
  found: Marketplace add and git remote refs fail with sandbox EPERM on local listener setup; plugin update fails because 5xx HttpError is now classified as network unreachable instead of falling through to no longer installable.
  implication: The 5xx HTTP classification is the change-caused regression; the listener failures are environment noise.

- timestamp: 2026-08-29T12:03:23-04:00
  checked: node --input-type=module probe of resolvePluginPin({ source: githubSource("owner/repo") })
  found: The failing plugin update path throws code EAI_AGAIN with message "getaddrinfo EAI_AGAIN github.com".
  implication: The plugin update failures are also sandbox network noise because EAI_AGAIN was classified by the pre-existing errno ladder before this change.

- timestamp: 2026-08-29T12:05:18-04:00
  checked: node tests/shared/git-failure-classifiers.test.ts and node --test --test-name-pattern D-76-09 tests/orchestrators/marketplace/add.test.ts
  found: The shared classifier suite passes, and marketplace add now covers both HTTP 429 and HTTP 500 transient clone failures.
  implication: The broader marketplace-add HTTP behavior is pinned while the aggregate gate still requires unsandboxed listener and DNS access.

- timestamp: 2026-08-29T12:20:43-04:00
  checked: Escalated npm run check result reported by the session manager.
  found: The aggregate run had 3662 passing tests and 3 failing plugin update tests, all changed from no longer installable to source missing.
  implication: Generic NotFoundError classification affected plugin update, but HttpError 404/410 and transient HTTP mappings did not need removal.

- timestamp: 2026-08-29T12:20:43-04:00
  checked: rg -n "NotFoundError|classifyGitSourceAccessFailure|classifyGitTransportFailure|D-76-09|HttpError 500|500" on the changed classifier and marketplace-add tests.
  found: The generic NotFoundError branch and test are absent; classifyGitSourceAccessFailure still maps HttpError 404/410/408/429/5xx for marketplace add.
  implication: Plugin update keeps its existing NotFoundError fallthrough, and marketplace add keeps the requested friendly HTTP handling.

- timestamp: 2026-08-29T12:20:43-04:00
  checked: node tests/shared/git-failure-classifiers.test.ts
  found: 31 tests passed, 0 failed.
  implication: Shared transport and opt-in source-access HTTP classification are pinned.

- timestamp: 2026-08-29T12:20:43-04:00
  checked: node --test --test-name-pattern D-76-09 tests/orchestrators/marketplace/add.test.ts
  found: 1 test-file subtest passed, 0 failed.
  implication: Marketplace add covers missing HTTP repositories and transient HTTP 429/500 clone failures.

- timestamp: 2026-08-29T12:20:43-04:00
  checked: node tests/orchestrators/plugin/update.test.ts
  found: 105 tests passed, 0 failed.
  implication: Removing generic NotFoundError/source-missing classification restored plugin update no-longer-installable semantics.

- timestamp: 2026-08-29T12:20:43-04:00
  checked: npm run fallow
  found: The dead-code, health, and duplicate checks completed with exit code 0.
  implication: The helper refactor satisfies the repository quality gate for fallow.

- timestamp: 2026-08-29T12:25:14-04:00
  checked: npm run check outside the sandbox after the final correction.
  found: Typecheck, ESLint, fallow, Prettier, 3672 unit tests, and 21 integration tests passed; one existing unit test was skipped.
  implication: The focused fix satisfies the complete repository quality gate without changing adjacent plugin-update behavior.

## Resolution

root_cause: Marketplace add delegated clone HttpError 404/429/5xx to the shared transport-only classifier. That classifier returned undefined, so add treated those clone failures as unexpected.
fix: Added an opt-in source-access classifier for HttpError 404/410, 408/429, and 5xx. Marketplace add uses it. The shared transport classifier still handles auth and network errnos only, so plugin update keeps its caller-specific fallthroughs. The generic NotFoundError source-missing branch was removed.
verification:
  target_test: { result: pass, command: "node tests/shared/git-failure-classifiers.test.ts", tests: "31 pass, 0 fail" }
  marketplace_add_http: { result: pass, command: "node --test --test-name-pattern D-76-09 tests/orchestrators/marketplace/add.test.ts", tests: "1 pass, 0 fail" }
  plugin_update: { result: pass, command: "node tests/orchestrators/plugin/update.test.ts", tests: "105 pass, 0 fail" }
  typecheck: { result: pass, command: "npm run typecheck" }
  lint: { result: pass, command: "npm run lint" }
  adjacent_tests: { result: pass, command: "node tests/orchestrators/marketplace/update-transport.test.ts; node --test --test-name-pattern FTCH-06 tests/orchestrators/plugin/fetch.test.ts" }
  format_check: { result: pass, command: "npm run format:check" }
  fallow: { result: pass, command: "npm run fallow", result_detail: "exit code 0" }
  full_check: { result: pass, command: "npm run check", tests: "3672 unit pass, 1 unit skip, 21 integration pass" }
oracle_type: specified
files_changed:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - tests/shared/git-failure-classifiers.test.ts
  - tests/orchestrators/marketplace/add.test.ts

## Prevention

why_not_caught: No marketplace-add test covered non-authentication HTTP clone errors, so raw 404 errors reached the command boundary.
recurrence_guard: D-76-09 tests pin missing-repository and transient HTTP mappings while shared-classifier tests protect other callers' fallthrough behavior.
