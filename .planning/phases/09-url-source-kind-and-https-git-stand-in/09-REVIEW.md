---
phase: 09-url-source-kind-and-https-git-stand-in
reviewed: 2026-10-21T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - .agents/skills/cucumber/rules/features.md
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/steps.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - CHANGELOG.md
  - cucumber.json
  - docs/json-output.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/lib/git-marketplace.ts
  - features/lib/hermetic-git.ts
  - features/lib/https-git-host/cgi.ts
  - features/lib/https-git-host/server.ts
  - features/lib/mcp-configuration.ts
  - features/lib/pi-process.ts
  - features/lib/published-marketplace.ts
  - features/lib/run-tokens.ts
  - features/marketplace/git-source.feature
  - features/marketplace/info.feature
  - features/marketplace/unsupported-source.feature
  - features/marketplace/update.feature
  - features/marketplace/url-source.feature
  - features/marketplace/url-source-update.feature
  - features/step_definitions/marketplace/add.steps.ts
  - features/step_definitions/marketplace/git-host.steps.ts
  - features/step_definitions/marketplace/info.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/support/https-git-host.ts
  - features/support/pi-process.ts
  - features/support/world.ts
  - scripts/check-features.mjs
  - tests/architecture/hermetic-git-environment.test.ts
  - tests/architecture/https-git-host-cgi.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/e2e/_rpc.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/shared/git-failure-classifiers.test.ts
  - tests/shared/notification-json.test.ts
findings:
  critical: 0
  warning: 3
  info: 8
  total: 11
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-10-21
**Depth:** standard (changed hunks since `a5681207`)
**Files Reviewed:** 42
**Status:** issues_found

## Structural Findings (fallow)

Repo-scoped `fallow audit` (normalized) was provided as a pre-pass:

- 6 duplicate blocks, all in files outside this phase's scope (`persistence/migrate.ts`, `plugin/reinstall.messaging.ts` vs `reconcile/apply-outcomes.ts`, `plugin/info.ts`, `install-flow.ts` vs `uninstall.ts`, `catalog-uat/fixtures/plugin-uninstall.ts`).
- No unused exports, unused files, or cycles.
- The audit's CRAP threshold is not a project rule (the repo gate runs `maxCrap: 0`, CRAP off).

These are pre-existing context and not findings of this phase.

## Narrative Findings (AI reviewer)

## Summary

I checked the two product fixes against their callers. D-16 sends an isomorphic-git `NotFoundError` to `source missing` in `classifyGitSourceAccessFailure`. D-19 makes `marketplaceSubject` set the row id in `rowId`. Both are correct and narrowly scoped:

- `classifyGitSourceAccessFailure` has one caller, `classifyAddError`.
- `resolveRow` carries `marketplaceSubject` through on `...rest` for failed rows.
- `wireRow` builds its fields one by one, so the marker never reaches the wire schema.
- The no-credential-leak probe covers the redacted id.

The cucumber scenarios do discriminate. The `#stable` row fails under the old classifier. The 5xx Outline's `id` column fails under the old `<src>@<src>` form. The credential scenario fails if the store helper is not read.

The defects are mostly in the test suite. The first is a `@github` row that will break as soon as its tag is lifted, which goes against the rule that lifting a tag needs no feature edit. The second is feature descriptions that no longer match their stand-ins. The third is an async error path in the stand-in server that can crash a worker instead of answering 500. I found no BLOCKER.

Known items I did not re-report: the security audit note about `cgiEnvironment`/`decodeURIComponent` running before the `try` in `answer()` (WR-03 is a different throw site on the same promise), WINDOWS #100, and BACKLOG ROWID-01.

## Warnings

### WR-01: The `@github` info row still adds at `#stable`, so lifting `@github` turns it red because of D-16

**File:** `features/marketplace/info.feature:44`
**Issue:** This phase changed the `@url` row of "Info shows the source identity and description" from `#stable` to `#main`. With D-16, a `#ref` the repository lacks now fails the `Given the user has run "/claude:plugin marketplace add <source> ..."` step as `{source missing}`, and the git fixture publishes only `main` (`features/lib/git-marketplace.ts` runs `init.defaultBranch=main`, and its header says the github kind will share it). The `@github` row on line 44 still reads `acme/tools#stable` with `source ref` = `stable`. The github stand-in will publish through the same `publishGitRepository`, so lifting `@github` in `cucumber.json` makes this row fail. That breaks the `features.md` contract: "Removing a tag turns on every row of that kind, with no edit to a feature file."
**Fix:** Make the github row match the url row now:
```gherkin
    @github
    Examples:
      | source kind | source          | expected source kind | source abs path | source url | source owner | source repo | source ref |
      | github      | acme/tools#main | github               |                 |            | acme         | tools       | main       |
```

### WR-02: Six feature descriptions still say "local marketplaces in place of published ones" though their `@url` rows now run against the https git host

**File:** `features/marketplace/add.feature:3-5`, `features/marketplace/autoupdate.feature:3-5`, `features/marketplace/info.feature:3-5`, `features/marketplace/remove.feature:3-5`, `features/marketplace/update.feature:3-5`, `features/plugin/cross-scope-install.feature:3-6`
**Issue:** `features.md` requires each description to say "what the scenarios stand in for". This phase removed `not @url` from `cucumber.json`, so every `@url` row in these features now clones from the loopback https git host. Each description still says the scenarios "use local marketplaces in place of published ones", which is now wrong for those rows. A reader who trusts the description will not expect network-shaped failures, such as TLS trust or `NODE_EXTRA_CA_CERTS`, from these files.
**Fix:** Name both stand-ins, for example: "The scenarios run the real extension in a headless Pi, with local marketplaces and a loopback https git host in place of published ones."

### WR-03: The `answer()` promise in the stand-in is `void`ed, and `writeResponse` and the parsed status sit outside its `try`. A throw there crashes the worker instead of answering 500

**File:** `features/lib/https-git-host/server.ts:397-399`, `features/lib/https-git-host/server.ts:430-431`, `features/lib/https-git-host/cgi.ts:541-543`
**Issue:** `receive()` calls `void this.answer(...)` with no `.catch`. Inside `answer()`, only `runHttpBackend` and `parseCgiResponse` are inside the `try`. Two things run after it:
- `writeResponse` sets `res.statusCode = response.status`. Node throws `RangeError [ERR_HTTP_INVALID_STATUS_CODE]` for a status outside 100-999.
- It calls `res.appendHeader(name, value)`, which throws `ERR_INVALID_CHAR` for a bad header value.

`parseCgiResponse` sets `status = Number.parseInt(value, 10)` and never validates it, so a non-numeric `Status:` line becomes `NaN`. That reaches the `RangeError` above. Under Node's default `--unhandled-rejections=throw`, the rejection kills the cucumber worker, which hosts both the git host and Pi. Every remaining scenario on that worker then fails, and the cause is lost, where the host should log 500 for the one request. The comment on line 423 ("A CGI that fails ... answers 500, and the log says so") promises the 500 path, but only part of the code follows it. This is a separate throw site from the known `cgiEnvironment` note.
**Fix:** Have `parseCgiResponse` throw on a bad status, and move the response write inside the guarded path:
```ts
// cgi.ts
if (name.toLowerCase() === "status") {
  status = Number.parseInt(value, 10);
  if (!Number.isInteger(status) || status < 100 || status > 999) {
    throw new Error(`the CGI response status "${value}" is not an HTTP status`);
  }
}

// server.ts
req.on("end", () => {
  this.answer(logged, req.headers, Buffer.concat(chunks), res).catch(() => {
    logged.status = 500;
    res.destroy();
  });
});
```
and in `answer()`, put `cgiEnvironment(...)` and `writeResponse(...)` inside the `try` (falling back to `res.statusCode = 500; res.end()` only when `!res.headersSent`).

## Info

### IN-01: The parser's negative case accepts any `Error`

**File:** `tests/architecture/https-git-host-cgi.test.ts:88`
**Issue:** `assert.throws(() => parseCgiResponse(backendOutput), Error)` also passes for a `TypeError` or `RangeError` caused by a regression in `headerBlockEnd`. The `typescript-unit-tests` rule says to assert errors by class and structured fields. Nothing covers the other throw, `headerLine` on a header with no colon.
**Fix:** Assert the exact error, `assert.throws(() => parseCgiResponse(backendOutput), { name: "Error", message: "the CGI response has no blank line after its headers" })`, which `assert.throws` checks as whole field values. Add one row for a header line with no colon.

### IN-02: The CHANGELOG adds two top-level bullets for one change set, and the first sentence exceeds the length cap

**File:** `CHANGELOG.md:5-7`
**Issue:** The changelog rules say "One top-level bullet per pull request ... do not split one PR across several top-level entries", and each sentence must be 25 words or fewer. The first bullet is one sentence of about 30 words. Its clause "instead of `Command failed unexpectedly.`, or `{unparseable}` during a reload or an import" is also hard to parse. The branch already collects one bullet per phase, so this may be waiting for consolidation when the PR opens.
**Fix:** When the PR opens, fold these into the branch's single entry as sub-bullets, and split the first sentence. For example: "Adding a git marketplace at a missing `#ref` now fails as `{source missing}`. It used to fail as `Command failed unexpectedly.`, or as `{unparseable}` on a reload or an import."

### IN-03: The `GitHostArm` doc says `drop` fails "on the first request", but the arm drops every request

**File:** `features/lib/https-git-host/server.ts:60-64`
**Issue:** `failArmed`'s `drop` case destroys the socket on every request that matches the arm until reset, not just the first one. A future scenario that expects a retry to succeed would be misled.
**Fix:** Write "drops the connection on every request".

### IN-04: The comment above "the git host receives no request" describes keep-alive wrongly

**File:** `features/step_definitions/marketplace/git-host.steps.ts:86-87`
**Issue:** "A request over a kept-alive socket ... still counts as a connection" is wrong. A request on a reused socket emits no `connection` event and shows up only in `requests`. Only the non-TLS attempt shows up only in `connections`. The step is right to assert both fields, but the comment gives the wrong reason.
**Fix:** "A request over a kept-alive socket shows only in the requests, and a non-TLS attempt that never becomes a request shows only in the connection count, so the step asserts both."

### IN-05: In `unsupported-source.feature`, "reaches no host" is vacuous for two rows, and the log step sits outside a git-kind feature file

**File:** `features/marketplace/unsupported-source.feature:332-333`
**Issue:** `git@127.0.0.1:acme/tools.git` (ssh to port 22) and `~other/marketplaces/tools` (a local path) could never reach the host's port, even if the product wrongly accepted them. For those rows, `the git host receives no request` can never fail. Only the `unsupported source` reason does the checking. `steps.md` also says log steps appear "only in the feature files of the git source kinds". This file is a refused-forms feature with a path-form row.
**Fix:** Accept this knowingly and record it in the feature description ("the host check covers the forms that name the host's address"). Alternatively, use `ssh://git@{git host}/acme/tools.git` so the ssh form carries the host's port.

### IN-06: An arm matches the raw request path, but the CGI serves the decoded path

**File:** `features/lib/https-git-host/server.ts:167-179`, `features/lib/https-git-host/cgi.ts:484`
**Issue:** `armFor` compares `req.url` as sent. `PATH_INFO` is `decodeURIComponent(pathname)`. A request for `/acme/tool%73.git/info/refs` skips the `tools` arm and is served normally. isomorphic-git does not percent-encode these paths, so no current scenario is affected, but the HOST-03 claim that an armed repository fails depends on the client's encoding.
**Fix:** Match arms on `decodeURIComponent(new URL(path, base).pathname)`, the same value the CGI receives.

### IN-07: A partial failure in `BeforeAll`/`AfterAll` leaks the git host

**File:** `features/support/pi-process.ts:167-183`, `features/support/pi-process.ts:216-221`
**Issue:** If `PiProcess.start` rejects after `HttpsGitHost.start`, `piRun` is never assigned. The listening server and its temp root then outlive the hook, and `AfterAll`'s `currentRun()` throws. In `AfterAll`, a rejecting `run.pi.stop()` also skips `gitHost.close()` and the `rm` of the root.
**Fix:** Close the host in a `catch` around `PiProcess.start`. In `AfterAll`, run the three teardowns through `Promise.allSettled` and surface the failures together, the way the world's releases do.

### IN-08: The `id` doc says "the source as typed", but the row carries the redacted source, and only some failures have the row

**File:** `docs/json-output.md:580`
**Issue:** `failedAddRow` adds the child row only for a `network error` (`hostFrame`) or a GitHub-base-override fetched-URL cause. Other failed adds render a bare marketplace row with no plugin row. The name is also the redacted subject, with userinfo stripped, as the `rowId` comment and the no-credential-leak probe confirm. So "as typed" is wrong for a URL that carries credentials. The CHANGELOG line ("the source you typed") has the same gap.
**Fix:** "The child row of a failed `marketplace add` names the source, after redaction, and its id is that name alone."

---

_Reviewed: 2026-10-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
