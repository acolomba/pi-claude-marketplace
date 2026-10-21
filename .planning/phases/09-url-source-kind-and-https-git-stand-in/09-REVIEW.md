---
phase: 09-url-source-kind-and-https-git-stand-in
reviewed: 2026-10-21T05:28:45Z
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
  warning: 0
  info: 11
  total: 11
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-10-21T05:28:45Z
**Depth:** standard (changed hunks since `a5681207`; iteration 2, re-checking fixer commits `37da6163`, `962f57b1`, `5acaac75`)
**Files Reviewed:** 42
**Status:** issues_found

## Structural Findings (fallow)

No structural pre-pass came with this iteration. Iteration 1's repo-scoped `fallow audit` reported 6 duplicate blocks, all in files outside this phase's scope. It found no unused exports, no unused files, and no cycles. Nothing in the three fixer commits changes that: they touch only `features/`, `features/lib/https-git-host/`, and one `tests/architecture/` file. ESLint is clean on the two changed `.ts` sources and their test (`--max-warnings 0`).

## Narrative Findings (AI reviewer)

## Summary

All three iteration-1 warnings are fixed. I checked each fix against the source, and none of them adds a defect at WARNING level or above.

- **WR-01 (fixed, `37da6163`).** The `@github` row of the info outline now adds `acme/tools#main` with `source ref` = `main`, the same as the `@url` row. No other `@github` row in `features/` carries a `#ref`. The only remaining `#stable` is in `url-source.feature:61,69`, which is the deliberate missing-ref (`source missing`) scenario.
- **WR-02 (fixed, `962f57b1`).** The seven feature files with an `@url` block are add, autoupdate, git-source, info, remove, update, and cross-scope-install. Each description now names the loopback https git host. No description still says it uses only local marketplaces. `unsupported-source.feature`, which has no `@url` block, already names the host.
- **WR-03 (fixed, `5acaac75`).** `answer()` now builds the URL, the CGI environment, the parse, and `writeResponse` inside one `try`. `answerServerError` cannot throw: it calls `removeHeader` only when `!res.headersSent`. So the `void`ed promise can no longer reject. `parseCgiResponse` refuses a non-integer status or one outside 100-999 through `statusCode()`. The new parser cases discriminate: under the old `parseInt`, "Not Found" gave `NaN`, "99 Low" gave 99, and "1000 High" gave 1000, and none of them threw. I started a real `HttpsGitHost` in the scratchpad and sent three paths. `/acme/%E0%A4%A.git/...` (a `URIError` in `decodeURIComponent`) answered 500 and the log recorded 500. `/acme/%00.git/...` (a NUL in an env value, so `spawn` throws) also answered 500 and logged 500. `%2e%2e` traversal answered 404, because `git http-backend` refuses it. The worker survived all three. `node --test tests/architecture/https-git-host-cgi.test.ts` passes (14/14), and `npm run check:features` passes.

I re-confirmed all eight carried Info items against the current source and updated their line numbers. There are three new Info items. IN-09 and IN-10 are small gaps in the WR-03 fix. IN-11 notes that WR-01 left the info outline proving only the default-branch ref.

Known items I did not re-report: WINDOWS #100 and BACKLOG ROWID-01.

## Info

### IN-01: The parser's "no blank line" negative case still accepts any `Error`, and the no-colon throw is still untested

**File:** `tests/architecture/https-git-host-cgi.test.ts:88`
**Issue:** `assert.throws(() => parseCgiResponse(backendOutput), Error)` also passes for a `TypeError` or `RangeError` that a regression in `headerBlockEnd` would raise. The new status cases in the same `describe` assert `{ name, message }`, so the file now uses two styles. `headerLine`'s throw for a header with no colon (`cgi.ts:86-88`) still has no case.
**Fix:** `assert.throws(() => parseCgiResponse(backendOutput), { name: "Error", message: "the CGI response has no blank line after its headers" })`. Also add a case for `Buffer.from("NoColon\r\n\r\n")` that expects `the CGI response header "NoColon" has no colon`.

### IN-02: The CHANGELOG adds two top-level bullets for one change set, and the first sentence is over the length cap

**File:** `CHANGELOG.md:5-7`
**Issue:** The changelog rules allow one top-level bullet per PR, with sentences of 25 words or fewer. The first bullet is one sentence of about 30 words, and its "instead of ..., or ... during" clause is hard to parse. This may just be waiting for consolidation when the PR opens.
**Fix:** When the PR opens, fold both into the branch's single entry as sub-bullets, and split the first sentence: "Adding a git marketplace at a missing `#ref` now fails as `{source missing}`. It used to fail as `Command failed unexpectedly.`, or as `{unparseable}` on a reload or an import."

### IN-03: The `GitHostArm` doc says `drop` fails "on the first request", but the arm drops every request

**File:** `features/lib/https-git-host/server.ts:60-64`
**Issue:** Until the next reset, `failArmed`'s `drop` case destroys the socket of every request that matches the arm (`server.ts:201-204`). A scenario author who reads the doc would expect a retry to succeed.
**Fix:** "drops the connection on every request".

### IN-04: The comment above "the git host receives no request" gives the wrong keep-alive reason

**File:** `features/step_definitions/marketplace/git-host.steps.ts:86-87`
**Issue:** A request on a reused keep-alive socket emits no `connection` event. It shows up only in `requests`. Only a non-TLS attempt shows up only in `connections`. The step is right to assert both fields, but the comment's reason is wrong.
**Fix:** "A request over a kept-alive socket shows only in the requests, and a non-TLS attempt that never becomes a request shows only in the connection count, so the step asserts both."

### IN-05: In `unsupported-source.feature`, "reaches no host" proves nothing for two rows

**File:** `features/marketplace/unsupported-source.feature:17`, `features/marketplace/unsupported-source.feature:23-24`
**Issue:** `git@127.0.0.1:acme/tools.git` uses ssh on port 22, and `~other/marketplaces/tools` is a local path. Neither could reach the host's port, even if the product wrongly accepted them, so `the git host receives no request` can never fail for those rows. `steps.md` also limits log steps to the feature files of the git source kinds.
**Fix:** Either record the limit in the description ("the host check covers the forms that name the host's address"), or make the scp-style row carry the host's address so the log check can fail.

### IN-06: An arm matches the raw request path, but the CGI serves the decoded, URL-resolved path

**File:** `features/lib/https-git-host/server.ts:167-179`, `features/lib/https-git-host/cgi.ts:51`
**Issue:** `armFor` compares `req.url` as sent. `PATH_INFO` is `decodeURIComponent(new URL(path, base).pathname)`. A request for `/acme/tool%73.git/info/refs` skips the `tools` arm and gets a normal answer. `//acme/tools.git/...` also diverges, because `new URL` reads `acme` as a host. isomorphic-git encodes neither form, so no current scenario is affected. Still, the HOST-03 claim that an armed repository fails depends on the client's encoding.
**Fix:** Match arms against the same decoded `pathname` the CGI receives. Compute it once, before the arm check, inside a guard that answers 500 on a `URIError`.

### IN-07: A partial failure in `BeforeAll` or `AfterAll` leaks the git host

**File:** `features/support/pi-process.ts:66-82`, `features/support/pi-process.ts:115-120`
**Issue:** `piRun` is assigned only after `PiProcess.start` resolves. If it rejects after `HttpsGitHost.start`, the listening server and its temp root outlive the hook, and `AfterAll`'s `currentRun()` throws. In `AfterAll`, a rejecting `run.pi.stop()` also skips `gitHost.close()` and the `rm` of the root.
**Fix:** Close the host in a `catch` around `PiProcess.start`. In `AfterAll`, run the three teardowns through `Promise.allSettled` and report the failures together.

### IN-08: The `id` doc says "the source as typed", but the row carries the redacted source, and only some failures have the row

**File:** `docs/json-output.md:580`
**Issue:** `failedAddRow` (`add.ts:758-766`) adds the child row only for a `hostFrame` failure or a fetched-URL cause. The row's name is the redacted subject with the userinfo stripped, so "as typed" is wrong for a URL that carries credentials. The CHANGELOG line ("the source you typed") has the same gap.
**Fix:** "When a failed `marketplace add` has a child row, the row names the source after redaction, and its id is that name alone."

### IN-09: `answerServerError` logs 500 for a connection it cuts off, although the log has a `dropped` status for that case

**File:** `features/lib/https-git-host/server.ts:235-240`
**Issue:** When `res.headersSent` is true, the helper destroys the response, so the client sees the CGI's status and then a cut connection. It never sees a 500. The log still records `500`. `GitHostRequest.status` documents `dropped` as "an arm destroyed the connection", and a scenario that reads the log would see a status the client never got. In practice this branch is hard to reach, because `writeResponse` sends the headers and the body in one `end()`.
**Fix:** Set `logged.status = "dropped"` in the `headersSent` branch, and widen the `dropped` doc to "the host destroyed the connection". Alternatively, drop the branch and its doc line if it is meant to be unreachable.

### IN-10: No test drives the host's new 500 path

**File:** `features/lib/https-git-host/server.ts:421-449`
**Issue:** `5acaac75` claims that an undecodable path, a status Node cannot send, and a bad header value all answer 500 and do not crash the worker. Only the parser's status check has a test. Nothing exercises `answer()` and `answerServerError()`: a later edit could move `cgiEnvironment` or `writeResponse` back outside the `try`, and no test or scenario would fail. My scratch probe confirmed the current behavior for the path cases only.
**Fix:** Optional. Add one `tests/architecture/` case that starts an `HttpsGitHost` in a temp root, requests `/acme/%E0%A4%A.git/info/refs`, and asserts a 500 answer, a `500` log entry, and a live server afterwards. Or record the gap in the stand-in's header.

### IN-11: The info outline now proves the ref only when it equals the default branch

**File:** `features/marketplace/info.feature:39-44`
**Issue:** Both git rows now add at `#main`, and `features/lib/git-marketplace.ts` publishes only `main`. So the outline can no longer tell the ref the user typed from the branch the clone checked out. Suppose an implementation recorded the resolved HEAD branch, or defaulted the ref to `main`. It would pass both rows, unless that ref also appeared on adds with no `#ref`, which other scenarios would catch. Before D-16, `#stable` told the two apart. `info.ts:78,87` reads the typed `src.ref` today, so this is a coverage gap, not a bug.
**Fix:** Optional. Let the git fixture publish a second branch, such as `stable`, and keep the url and github rows at `#stable`. Or record in the outline that ref round-tripping is covered elsewhere.

---

_Reviewed: 2026-10-21T05:28:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
