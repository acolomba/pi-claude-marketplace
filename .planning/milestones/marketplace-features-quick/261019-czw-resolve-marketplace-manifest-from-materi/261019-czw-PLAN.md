---
phase: quick-261019-czw
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/shared/notification-types.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/catalog-uat/fixtures/marketplace-update.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/catalog-wire.test.ts
  - docs/output-catalog.md
  - docs/json-output.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW-FIX.md
  - .planning/HANDOFF.json
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
autonomous: true
requirements: [WR-02, IN-02, WR-13, FIX-01, ATTR-10]
estimate:
  tokens: 170000
  raw_tokens: 170000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A marketplace update whose state save fails renders the failed marketplace header and a failed child row with no reason brace, followed by the save error's cause line, whatever errno code the save error carries (OD-7, OD-8)."
    - "A marketplace update that cannot take the scope's state lock renders the failed child row with {lock held} and the lock message as its cause line, and a retry after the lock is released succeeds (OD-21)."
    - "An HTTP answer from the git host other than the 401/403 auth challenge renders the failed child row with {network error}, and the first frame of its cause line names the HTTP status and the fetched URL ({status} on {url}) with URL credentials redacted (OD-17)."
    - "Connection failures (network errno codes) keep {network unreachable}; the refresh-read classifications keep source missing, permission denied, invalid manifest, unreadable, and authentication required (OD-9, OD-19)."
    - "No failure renders a reason it was not classified with: the fallback default is gone, so a codeless or non-Error refresh failure renders a failed row with no reason (OD-10)."
    - "network error is a member of the closed Reason set, documented by the catalog state update-host-http-error with a matching fixture, and listed in docs/json-output.md (OD-18)."
    - "add, info, and update locate a recorded marketplace's manifest through one exported helper, recordedManifestPath, in orchestrators/marketplace/shared.ts (OD-2)."
    - "marketplace info shows the recorded manifest file of a file source, including a conventional .claude-plugin/marketplace.json, and the recorded root of a directory source, without resolving the typed source against the add-time directory and without expanding ~ (OD-3, D-01, IN-02)."
    - "marketplace update reads the recorded manifest for github, url, and path records alike and never rewrites a record's manifestPath or marketplaceRoot (OD-1, OD-4, D-02)."
    - "The failed-save owner case compares the whole message and severity of its notification (OD-13)."
    - "06-REVIEW-FIX.md, HANDOFF.json, UPD-11 in REQUIREMENTS.md, and Phase 9 success criterion 3 in ROADMAP.md all record the decisions (OD-15, OD-16, OD-18, PD-6)."
    - "npm run check passes on the final tree."
  artifacts:
    - path: extensions/pi-claude-marketplace/shared/notification-types.ts
      provides: "network error appended at the tail of the closed Reason set"
      contains: "| \"network error\""
    - path: extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
      provides: "Refresh-only failure classification with lock held and network error and no fallback reason; the status-and-URL first frame; every source kind reads the recorded manifest"
    - path: docs/output-catalog.md
      provides: "The update-host-http-error state and the corrected update-path-invalid-manifest paragraph"
      contains: "catalog-state: update-host-http-error"
    - path: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
      provides: "recordedManifestPath, the one manifest locator for a recorded marketplace"
      contains: "export function recordedManifestPath"
    - path: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
      provides: "D-01 path line taken from the recorded root or the recorded manifest"
    - path: tests/orchestrators/marketplace/update.test.ts
      provides: "Whole-notification cases for the failed save, the errno saves, the held lock, the HTTP 500 and the redacted 404, and the unclassified refresh failures"
    - path: tests/orchestrators/marketplace/info.test.ts
      provides: "D-01 rows that show recorded paths, not the typed source resolved again"
  key_links:
    - from: extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
      to: extensions/pi-claude-marketplace/shared/errors.ts
      via: "refreshOneMarketplace classifies a MarketplaceUpdateError and maps a StateLockHeldError to lock held"
      pattern: "instanceof StateLockHeldError"
    - from: tests/architecture/catalog-uat/fixtures/marketplace-update.ts
      to: docs/output-catalog.md
      via: "the update-host-http-error fixture renders the catalog state byte for byte"
      pattern: "update-host-http-error"
    - from: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
      to: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
      via: "buildBlock reads the manifest and picks the path line through recordedManifestPath"
      pattern: "recordedManifestPath"
    - from: extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
      to: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
      via: "manifestContentKey and refreshRecord read the recorded manifest"
      pattern: "recordedManifestPath"
    - from: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
      to: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
      via: "resolvesToRecord compares the typed path with the recorded root and manifest"
      pattern: "recordedManifestPath"
---

<objective>
Implement the Phase 6 review follow-ups the operator decided on 2026-10-19, and record them.

1. Failure reasons of `marketplace update`. A failed state save renders a failed row with no reason and prints its cause chain. A held state lock renders `{lock held}`. An HTTP answer from the git host other than the 401/403 auth challenge renders the new reason `network error`, and the output names the HTTP status and the URL. `network unreachable` stays for real connection failures. Only failures of the refresh itself are classified, errno codes are never mapped on the save path, and the fallback reason is removed.
2. WR-02 and IN-02. A marketplace is a directory on disk. `add`, `info`, and `update` locate a recorded marketplace's manifest the same way, from the record, through one shared helper. `info` stops resolving the typed source against the add-time directory. Legacy records get no repair and no migration.
3. Records. 06-REVIEW-FIX.md, HANDOFF.json, UPD-11, and Phase 9's matching success criterion reflect the decisions.

Purpose: no failure row claims a cause it did not have (ATTR-10, NFR-5), and `info` and `update` can never name different manifest files.
Output: a new closed-set reason with its catalog state, a refresh-only failure classifier, one shared manifest locator, rewritten owner cases, corrected docs, and updated planning records.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/phases/06-marketplace-update-and-c-10-fix/06-CONTEXT.md
@.planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW.md
@.planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW-FIX.md
@.agents/skills/typescript-unit-tests/SKILL.md
@.agents/skills/typescript-unit-tests/rules/cases.md
@.agents/skills/typescript-style/rules/comments.md
@.agents/skills/local-verification/SKILL.md
@.agents/skills/committing/SKILL.md
@extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
</context>

## Operator decisions (locked)

The operator decided these on 2026-10-19. Each task cites them by OD number.

- OD-1: Treat git clones and local path sources the same way. A marketplace is a directory on disk: the clone directory of a github or url source, or the user's directory of a path source.
- OD-2: `add`, `info`, and `update` locate the manifest the same way, from the record's root and the manifest location inside it, through ONE shared helper.
- OD-3: `info` stops deriving its path from `source.logical` plus `addedFromCwd`. Those two fields are provenance only: display and same-source duplicate checks.
- OD-4: Legacy records are not supported: records with a relative manifestPath, and records that the old C-10 bug repointed to the conventional decoy. Write no repair or migration code. Drop or adjust unit cases that exist only for legacy records.
- OD-5: Check how records store manifestPath and marketplaceRoot today, and keep the change minimal.
- OD-6: The change also resolves IN-02 (the tilde expansion that add and info both implement).
- OD-7: A local state-save failure renders a generic failed row with no brace reason and prints the cause chain.
- OD-8: Map no errno code (EACCES/EPERM/ENOENT/ENOTDIR) on the save path.
- OD-9: Keep ENOENT/ENOTDIR as `source missing`, and keep the existing transport classifications, only on the path that reads the marketplace source during the refresh.
- OD-10: Remove the fallback reason default entirely. A failure no rule classifies gets no reason, not a false one.
- OD-11: Check whether the errno mapping in `reasonsFromCascadeError` applies to save errors today, and separate the two paths.
- OD-12: Verify that the grammar renders a failed row with an empty reasons list cleanly. If it cannot, the first task STOPS and reports. It does not invent a token.
- OD-13: The WR-13 failed-save owner case compares the whole `{ message, severity }` notification.
- OD-14: Check features/marketplace/update.feature and docs/output-catalog.md for the network reason on a non-network failure, and update them.
- OD-15: In 06-REVIEW-FIX.md, mark WR-02 fixed with the decision, and mark the save-reason follow-up resolved with the decision.
- OD-16: In HANDOFF.json, mark remaining_tasks 4 and 5 done, and remove the matching human_actions_pending entries.
- OD-17: During an update, an HTTP error from the git host other than 401/403 (5xx, 404, and so on) must NOT say `network unreachable`. It gets a NEW closed-set reason, `network error`, and the user-visible output states the HTTP status code and the URL, for example "404 on {url}". The cause chain matters less than that line. The plan picks the smallest grammar channel that fits the house patterns and names it.
- OD-18: Add the token to shared/notification-types.ts and docs/output-catalog.md, and update UPD-11 in REQUIREMENTS.md so that Phase 9 expects `network error`, with the status and the URL, for a 5xx or 404 answer.
- OD-19: Keep `network unreachable` only for genuine connection failures: network errno codes such as ENOTFOUND, ECONNREFUSED, ETIMEDOUT, and ECONNRESET.
- OD-20: Update the "providerless HTTP 500" owner case to match.
- OD-21: A held state lock (StateLockHeldError) during an update shows `{lock held}`, as autoupdate does.
- OD-22: PD-2, PD-3, and PD-5 are accepted.

Phase 6 decisions that this plan must keep: D-01 (`info` shows the exact file of a file source, including a conventional `.claude-plugin/marketplace.json`, and the directory of a directory source), D-02 (update rereads the exact file the user added and does not fall back), and D-07 (an invalid refreshed manifest fails the update, and a later update succeeds once the source is fixed).

## What planning measured (HEAD 4f3a93e5)

- Record storage (OD-5). `addGitClonedInGuard` in add.ts stores `marketplaceRoot = locations.sourceCloneDir(name)` and `manifestPath = {root}/.claude-plugin/marketplace.json`. `addPathInGuard` resolves the typed path against the add's cwd after expanding `~` (add.ts about line 1210). For a directory source it stores the directory as the root and `{root}/.claude-plugin/marketplace.json` as the manifest. For a file source it stores the exact file as the manifest and the file's grandparent as the root. Every record the current add writes therefore holds an absolute manifestPath inside an absolute root, and the shared helper is a plain accessor.
- Readers today. In update.ts, `manifestContentKey` and the path arm of `refreshRecord` read `record.manifestPath`. The github and url arms read `{cloneDir}/.claude-plugin/marketplace.json` and rewrite the record's two paths when they differ, which is legacy repair. `info` reads `record.manifestPath` for the description, but derives its `path:` line from `source.logical` resolved against the add-time directory, with its own `~` replacement (IN-02). In add.ts, `resolvesToRecord` resolves the RECORDED root and manifest against the add-time directory. That step exists only for legacy relative records.
- Save path (OD-11). The catch in `refreshOneMarketplace` passes every error from `snapshotAfterRefresh` to `reasonsFromCascadeError`: refresh, lock, load, save, and lock-release errors alike. Its `transportReason` reads a top-level errno code first. So today an EACCES/EPERM save error renders `{permission denied}`, an ENOENT/ENOTDIR save error renders `{source missing}`, and a save error with no code falls through to the fallback default. Only `refreshRecord` throws `MarketplaceUpdateError` (checked with grep), so that class identifies a refresh failure exactly.
- Held lock (OD-21). `withExistingScopeLock` throws `StateLockHeldError` when the lock is taken, before the body runs, so the error reaches the catch unwrapped. Its message carries the retry hint. autoupdate.ts maps it to `lock held` (`autoupdateFailedReason`), and autoupdate.test.ts holds the lock with `proper-lockfile`'s `lockfile.lock(extensionRoot, { lockfilePath: stateLockFile, realpath: false })`. The cause line then reads `Another pi-claude-marketplace operation is in progress for project scope ({lock file}). Retry after it completes. -> Lock file is already being held`.
- HTTP errors (OD-17). An isomorphic-git `HttpError` has code `HttpError`, the message `HTTP Error: {status} {statusMessage}`, and `data: { statusCode, statusMessage, response }`. It carries no URL. Today `classifyGitTransportFailure` classifies only 401/403 (authentication required) and the network errno codes ENETUNREACH, ECONNREFUSED, ENOTFOUND, ETIMEDOUT, ECONNRESET, and EAI_AGAIN (network unreachable). Every other HTTP status gets the network reason only through the fallback. The refresh fetches the clone's `origin`, which the add cloned from `networkCloneUrl(source)`. `platform/git.ts` sends `gitHubWireUrl(origin)`, and when the GitHub base override rewrites the URL it appends a `FetchedUrlCause` frame (`fetched {url}`). A probe at HEAD gives `https://gitlab.example.com/team/urlmp-500` for the url seed and `https://github.com/anthropics/claude-plugins-official.git` for the github seed. For a url with userinfo, `redactCredentials` turns `404 on https://user:secret@gitlab.example.com/team/urlmp-404` into `404 on https://***@gitlab.example.com/team/urlmp-404`.
- Grammar (OD-12, OD-17). `composeReasons` in shared/notification-grammar.ts returns the empty string for an empty list, and `joinTokens` drops empty tokens. install-flow.ts builds failed rows with `reasons: []` (D-15-01 suppresses the empty brace). The install case "plugin install authentication: contains a non-Error clone failure without synthesizing a row cause" pins a failed row with no brace and passes at HEAD, so the Task 1 gate is expected to continue. No reason token can interpolate: notification-types.ts says a reason is one to three lowercase words, and every detail that names an identifier rides the row's cause line. `PluginFailedMessage` has no free-text field besides `cause`. `serializeCauseChain` redacts credentials in every frame, in TUI and in JSON.
- Closed-set gates. A new reason must appear in the same commit in: the `Reason` union (appended at the tail), the `FailureReason` group of the notify-reasons.ts partition proof, the `REASONS` wire map in notification-wire.ts, the ordered lists in tests/shared/notification-types.test.ts and tests/architecture/compat-01-no-expansion.test.ts, and the enrollment map and count of tests/architecture/notify-closed-set-locks.test.ts (76). The COMPAT-01 message requires a new token to arrive with its catalog row and fixture. A new catalog state moves the counts in catalog-contract.test.ts (288 states, 46_195 bytes), catalog-parser.test.ts (288), and catalog-wire.test.ts (298 presented, 288 emitted keys). Fixtures must keep the catalog's state order.
- Docs and features (OD-14). No `.feature` file expects the network reason. docs/output-catalog.md has one affected paragraph: the prose of the `update-path-invalid-manifest` state (about line 4021), which describes the fallback. UPD-11 (REQUIREMENTS.md line 125) and Phase 9 success criterion 3 (ROADMAP.md line 461) both expect `network unreachable` for an update against a 5xx or 404 host.

## Status-and-URL channel (OD-17): the first frame of the cause line

The plan uses the first frame of the failed row's cause line. For a host HTTP failure, the `MarketplaceUpdateError` that `refreshRecord` throws takes `{status} on {url}` as its message, in place of `Failed to update marketplace "{name}".`. The header row above it already names the failed marketplace. The transport's own message stays as the next frame. This was the smallest fit:

- A reason token cannot carry a number or a URL, because the vocabulary is fixed literals.
- `PluginFailedMessage` has no other free-text slot, and adding one would change the types, the resolve step, the grammar, and the wire schema.
- The cause chain is the house channel for interpolated detail. Examples: the `dependents constrain` remedy, `FetchedUrlCause`, and the GAUTH-04 stored-credential line already carry hosts and URLs on update failures.
- The chain is redacted on serialization, so URL userinfo never reaches the output.

The URL is the one the fetch sent: `gitHubWireUrl(networkCloneUrl(source))`. This plan adds no new field, error class, or grammar arm.

## Planner decisions

- PD-2 (accepted): `info` picks the D-01 form from the typed source's basename, and both values come from the record. A directory source whose own name equals the manifest's file name shows the manifest file.
- PD-3 (accepted): the clone-path repair in update.ts is removed with its legacy-only owner case.
- PD-4: the helper returns `record.manifestPath`. The ~17 other readers in the plugin and reconcile orchestrators read the same field directly. They are out of scope and their behavior does not change.
- PD-5 (accepted): HANDOFF.json `next_action` is rewritten so a resumed session does not ask the decided questions again.
- PD-6: ROADMAP.md Phase 9 success criterion 3 restates UPD-11, so Task 3 aligns its `update` clause too. Otherwise Phase 9 would inherit two criteria that contradict each other. This is one edit beyond the literal OD-18 request. The `add` clause does not change.
- Observation, out of scope: `marketplace add` still maps a 5xx, 408, or 429 answer to `network unreachable` through `classifyGitSourceAccessFailure`, because OD-17 covers update only.

## Interfaces

- shared/notification-types.ts: `Reason` gains the tail member `"network error"`.
- shared.ts: `export function recordedManifestPath(record: ExtensionState["marketplaces"][string]): string`
- update.ts (module-private, the executor chooses the final names): `refreshFailureReasons(err: unknown): readonly ContentReason[]` and `hostHttpStatus(err: unknown): number | undefined`

## Source coverage audit

| Source | ID | Item | Task | Status |
| --- | --- | --- | --- | --- |
| GOAL | — | Implement the decided follow-ups and record them | 1-3 | COVERED |
| REQ | WR-02 | `info` and `update` name the same manifest file | 2 | COVERED |
| REQ | IN-02 | Tilde expansion implemented twice, in add and info | 2 | COVERED |
| REQ | WR-13 follow-up | Failed-save reason and whole-notification owner case | 1 | COVERED |
| CONTEXT | OD-1 to OD-6 | Uniform locator, `info` provenance, legacy removal | 2 | COVERED |
| CONTEXT | OD-7 to OD-14 | Save-reason decision, grammar gate, docs | 1 | COVERED |
| CONTEXT | OD-17 to OD-21 | `network error` with status and URL, `lock held`, HTTP 500 case | 1 (UPD-11 records: 3) | COVERED |
| CONTEXT | OD-15, OD-16 | Records | 3 | COVERED |
| CONTEXT | D-01, D-02, D-07 | Kept phase decisions | 2, 2, 1 | COVERED (kept) |
| RESEARCH | — | No research for this quick task | — | n/a |

<!-- planner-discipline-allow: network unreachable -->
<!-- planner-discipline-allow: validateManifestAtRoot -->
<!-- planner-discipline-allow: addedFromCwd -->
<!-- planner-discipline-allow: homedir -->
<!-- planner-discipline-allow: lying -->

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Name update failures truthfully: no reason for a failed save, lock held for a held lock, and network error with the HTTP status and URL</name>
  <files>extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts, extensions/pi-claude-marketplace/shared/notification-types.ts, extensions/pi-claude-marketplace/shared/notify-reasons.ts, extensions/pi-claude-marketplace/shared/notification-wire.ts, tests/orchestrators/marketplace/update.test.ts, tests/edge/handlers/marketplace/update.test.ts, tests/shared/notification-types.test.ts, tests/architecture/notify-closed-set-locks.test.ts, tests/architecture/compat-01-no-expansion.test.ts, tests/architecture/catalog-uat/fixtures/marketplace-update.ts, tests/architecture/catalog-uat/catalog-contract.test.ts, tests/architecture/catalog-uat/catalog-parser.test.ts, tests/architecture/catalog-uat/catalog-wire.test.ts, docs/output-catalog.md, docs/json-output.md</files>
  <read_first>update.ts: refreshRecord, snapshotAfterRefresh, cascadeAutoupdates, reasonsFromCascadeError, transportReason, and refreshOneMarketplace (about lines 327-705), and the import block. shared/notification-grammar.ts: joinTokens and composeReasons (about lines 274-385). The tail of the Reason union in shared/notification-types.ts (about lines 262-280). FailureReason in shared/notify-reasons.ts (about lines 122-170). REASONS in shared/notification-wire.ts (about lines 82-159). autoupdate.ts autoupdateFailedReason (about lines 206-227). In autoupdate.test.ts, the case 'reports a held named scope lock and succeeds after the lock is released' (about line 818). In update.test.ts: makeCtx, makeForbiddenGitOps, seedUrlMarketplace, seedPathMarketplace and the ATTR-10 comment above it (about lines 1730-1796), and the cases at about lines 535, 582, 2091, and 3923. In docs/output-catalog.md, the marketplace update section from mp-failure-network to update-missing-not-added (about lines 3990-4040). The update-path-invalid-manifest fixture (about line 294 of fixtures/marketplace-update.ts). The count pins named in "What planning measured". docs/json-output.md line 845. The installNetworkCounter comment in tests/edge/handlers/marketplace/update.test.ts (about lines 138-162). cases.md and comments.md.</read_first>
  <behavior>
    - The failed-save case renders exactly: "Some operations have failed.", a blank line, "⊘ save-retry [project] (failed)", "  ⊘ save-retry (failed)" with no brace, and "    cause: state save failed". Severity is error.
    - A save error carrying EACCES, EPERM, ENOENT, or ENOTDIR renders the same reasonless shape with its own cause line. state.json is unchanged, and no git operation runs.
    - A held project lock renders "  ⊘ {name} (failed) {lock held}" with the lock message cause line. After the lock is released, a retry renders "● {name} [project] (skipped) {up-to-date}".
    - A providerless HTTP 500 renders "{network error}" with "    cause: 500 on https://gitlab.example.com/team/urlmp-500 -> HTTP 500 from fetch".
    - A 404 from a url that has userinfo renders "{network error}" with "    cause: 404 on https://***@gitlab.example.com/team/urlmp-404 -> HTTP 404 from fetch".
    - A non-Error fetch rejection, and a github fetch Error with no code, render the failed child row with no brace, followed by their existing cause lines.
    - These cases do not change: HTTP 403 keeps authentication required with its stored-credential line, ENETUNREACH keeps the network reason, ENOENT on the source read keeps source missing, a bad manifest keeps invalid manifest, and an unparseable baseline keeps unreadable.
  </behavior>
  <action>1. Grammar gate (OD-12), before any edit. In extensions/pi-claude-marketplace/shared/notification-grammar.ts, confirm that composeReasons returns the empty string for an empty list and that joinTokens drops empty tokens. Then run the first verify command, which pins a failed row with no brace. If either check fails, STOP: change nothing, and report that the grammar cannot render a failed row without a reason. Do not invent a reason token. Planning found that both checks hold, so continuing is expected.

2. Vocabulary, as one commit (OD-18). The closed-set gates require all of these in the same change.
 - extensions/pi-claude-marketplace/shared/notification-types.ts: append `network error` at the tail of Reason, after `enabled in local layer`. Its comment (comments.md) cites UPD-11 and says three things: the git host answered with an HTTP status other than the 401/403 auth challenge, so it was reached and refused; `network unreachable` stays for connection failures; and the status and the URL ride the row's cause line, because no token interpolates.
 - extensions/pi-claude-marketplace/shared/notify-reasons.ts: add it to FailureReason directly after `network unreachable`, with a one-line comment.
 - extensions/pi-claude-marketplace/shared/notification-wire.ts: add `"network error": true` to REASONS, after `enabled in local layer`.
 - Pins: append `network error` to EXPECTED_REASONS in tests/shared/notification-types.test.ts and in tests/architecture/compat-01-no-expansion.test.ts. Add it to REASON_ENROLLMENT in tests/architecture/notify-closed-set-locks.test.ts, and change 76 to 77 in that test's title and assertion.
 - docs/output-catalog.md: after the update-path-invalid-manifest block and before the 'Failure -- marketplace not added, explicit scope' heading, add a state headed 'Marketplace update failed (git host HTTP error)'.
   - Its prose, in the catalog's style: the state triggers when `marketplace update` fetches a github or url marketplace and the host answers with an HTTP status other than the 401/403 challenge (5xx, 404, and others; UPD-11). The reason is `{network error}`, because the host was reached. `{network unreachable}` stays for connection failures, meaning the network errno codes. The first frame of the cause line names the status and the URL the refresh fetched, with credentials redacted, and the transport's own message follows. The reason rides the synthetic child, the severity is error, and there is no reload-hint.
   - Then the marker comment for catalog state update-host-http-error, and a text fence of five lines:
     1. 'Some operations have failed.'
     2. an empty line
     3. '⊘ official [user] (failed)'
     4. two spaces, then '⊘ official (failed) {network error}'
     5. four spaces, then 'cause: 404 on https://git.example.com/acme/official.git -> HTTP Error: 404 Not Found'
 - tests/architecture/catalog-uat/fixtures/marketplace-update.ts: add the fixture 'update-host-http-error' directly after 'update-path-invalid-manifest'. The contract compares order. Use the shape of that fixture, with reasons ["network error"] and a cause: an Error with the first-frame message whose own cause is an Error with the message 'HTTP Error: 404 Not Found'.
 - Count pins:
   - tests/architecture/catalog-uat/catalog-contract.test.ts: EXPECTED_STATE_COUNT 288 to 289 (also in the title that says 288 states), and EXPECTED_UTF8_BYTES 46_195 to 46_382. The five lines above are 187 bytes as Buffer.byteLength of the lines joined with a newline, the way the parser builds them. Recompute the same way if the block text changes.
   - tests/architecture/catalog-uat/catalog-parser.test.ts: 288 to 289, in the title and the assertion.
   - tests/architecture/catalog-uat/catalog-wire.test.ts: PRESENTED.length 298 to 299, and the emitted-key set size 288 to 289.
 - docs/json-output.md: append `network error` to the Reason list (line 845).
 - Run the vocabulary verify commands. Then run SKIP=npm-check pre-commit run --files on those 12 files, and commit them as 'feat(output): add the network error reason'. The fixture counts as test support, so the hook runs every source-test pair.

3. Red first, in tests/orchestrators/marketplace/update.test.ts. Observe the failures locally; tests and code land in one commit.
 a. In 'a failed state save retains the baseline and retries without cascading early', replace the count and severity assertions on failed.notifications with one whole { message, severity } comparison (OD-13). The message is the summary line, a blank line, the save-retry header in the project scope, the child row with no brace, and the line 'cause: state save failed' at the four-space indent. The severity is error. Write the string by hand.
 b. Directly after that case, add one sibling test per save errno code, EACCES, EPERM, ENOENT, and ENOTDIR, from a typed row list with no conditional in the loop body. Title each one 'a state save failing with {code} renders a failed row with no reason'. Each row starts a fresh withHermeticHome, copies the valid-marketplace fixture under cwd, and seeds it with seedPathMarketplace under its own name. It captures loadState first, and runs updateMarketplace with makeForbiddenGitOps and stateTransaction.saveState rejecting with an Error whose message is '{code}: state save failed' and whose code is the row's code. It asserts three things: the whole notification array, that loadState still equals the captured state, and that the git ops recorded no call (OD-8). If fallow reports a new clone group, extract the shared arrange into a helper local to update.test.ts. Do not add a suppression.
 c. Add the case 'a held scope lock fails the update as lock held and a retry after release succeeds' (OD-21), with the lock handling of the autoupdate.test.ts case and proper-lockfile imported the same way. Seed a valid path marketplace, take the project lock, and run updateMarketplace with makeForbiddenGitOps. Then release the lock, and run it again. Assert three things: the whole blocked notification (the child row with {lock held}, then the cause line naming locations.stateLockFile with the 'Retry after it completes.' sentence and the '-> Lock file is already being held' frame; severity error), that state is unchanged after the blocked run, and that the retry renders the up-to-date skipped row. Also assert that neither run made a git call.
 d. OD-20, OD-17: retitle 'marketplace update transport: classifies a providerless HTTP 500 as network unreachable' to 'marketplace update transport: names the status and URL of a providerless HTTP 500 as a network error'. Its expected child row becomes '  ⊘ urlmp-500 (failed) {network error}', and its cause line becomes 'cause: 500 on https://gitlab.example.com/team/urlmp-500 -> HTTP 500 from fetch'. Keep its fetchCalls assertion.
 e. Add 'marketplace update transport: names a 404 answer as a network error with its URL credentials redacted'. Use seedUrlMarketplace with name urlmp-404, ref main, and host 'user:secret@gitlab.example.com', with the credential ops fake as the HTTP 500 case uses it. The fetch throws an Error with message 'HTTP 404 from fetch', code 'HttpError', and data.statusCode 404. The expected whole notification has the header row for urlmp-404, the child row with {network error}, and 'cause: 404 on https://***@gitlab.example.com/team/urlmp-404 -> HTTP 404 from fetch'. The severity is error.
 f. Retitle 'marketplace update transport: folds a non-Error rejection into network unreachable' to 'marketplace update transport: renders a non-Error rejection with no reason', and remove the brace from its expected child row.
 g. Retitle the case whose title starts 'github-source no-errno refresh failure still renders' to 'an unclassified github fetch failure renders a failed row with no reason'. Rewrite its comment, and replace its partial assertions with a whole comparison: the ghnet header, the child row with no brace, the cause 'Failed to update marketplace "ghnet". -> mock: connection failed reaching github.com', and severity error.
 h. Rewrite the ATTR-10 section comment above seedPathMarketplace to state the current rule, without claiming that the fallback fires.
 Run node --test tests/orchestrators/marketplace/update.test.ts and confirm that a through g fail on HEAD for the expected reason. In a, d, e, f, and g the network reason shows. In b, permission denied or source missing shows, which proves OD-11. In c, the network reason shows.

4. Green, in extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts (OD-7 to OD-11, OD-17, OD-19, OD-21).
 - Add a module-private hostHttpStatus(err: unknown): number | undefined. It returns data.statusCode when err is an Error whose code is "HttpError", whose data.statusCode is a number, and which classifyGitTransportFailure leaves unclassified. That last condition keeps the 401/403 challenge as authentication required. Otherwise it returns undefined.
 - In refreshRecord, compute the remote URL once before the try, for the github and url kinds only, with networkCloneUrl(source) from domain/clone-key.ts. That function is pure. In the catch, when hostHttpStatus(err) returns a status, the MarketplaceUpdateError message is '{status} on {url}', where url is gitHubWireUrl(remote URL) from shared/github-base-url.ts. Call gitHubWireUrl only in that branch, because the fetch already went out with a valid override. Every other failure keeps its current message, and the retry hint does not change.
 - Add a module-private refreshFailureReasons(err: unknown): readonly ContentReason[]. It applies these rules in order:
   (1) a StateLockHeldError: ["lock held"], the same mapping autoupdateFailedReason uses;
   (2) any other error that is not a MarketplaceUpdateError: an empty list. That error failed outside the refresh (the state load, the state save, or the lock release), and no errno code on it is mapped;
   (3) reasonsFromCascadeError(err) when it returns a list. This keeps invalid manifest, unreadable, and the refresh-read mappings of transportReason, including classifyGitTransportFailure's authentication required and its connection-errno `network unreachable`;
   (4) hostHttpStatus(err.cause) returns a status: ["network error"] (UPD-11);
   (5) otherwise an empty list.
 - In the catch of refreshOneMarketplace, set the failed child row's reasons from refreshFailureReasons, and delete the fallback default entirely (OD-10). Keep rethrowInvalidGitHubBaseUrl first. Keep cause, severity, needsReload, the header row, and the notifyWithContext call unchanged. Import StateLockHeldError, networkCloneUrl, and gitHubWireUrl.
 - Do not change cascadeAutoupdates, or the logic of reasonsFromCascadeError or transportReason. The plugin cascade path is out of scope.
 - Rewrite each comment that describes the removed fallback in the present tense (comments.md): the concurrent-removal comment in snapshotAfterRefresh, the ATTR-10 block inside reasonsFromCascadeError, the transportReason doc comment, and the snapshot-undefined comment in refreshOneMarketplace. Extend the doc comment of reasonsFromCascadeError to say that the refresh classification calls it as well. Afterwards update.ts contains the token `network unreachable` nowhere: the shared classifier owns that reason. No comment calls a reason a lie.

5. Docs and outdated comments (OD-14).
 - docs/output-catalog.md: edit the prose paragraph of update-path-invalid-manifest. Remove three things: the parenthetical about recognizing the typed error before the fallback default, the sentence saying the former default must not fire, and the sentence saying github no-errno failures keep the network reason as the catch-all. State instead that only a refresh failure is classified. A held state lock renders `{lock held}`. An HTTP answer from the git host renders `{network error}` (see update-host-http-error). A refresh failure no rule names, and any other failure outside the refresh, renders the child row with no reason, followed by its cause chain. Change no catalog-state text block. No feature file needs a change.
 - tests/edge/handlers/marketplace/update.test.ts: in the installNetworkCounter doc comment, replace the parenthetical after 'go red on their MESSAGE' with: a failed row with no reason whose cause reads `The function requires a "remote OR url" parameter but none was provided`.
 - Run the remaining verify commands. Then run pre-commit on update.ts, update.test.ts, the edge test, and docs/output-catalog.md, and commit them as 'fix(marketplace): report update failures without a false reason'.</action>
  <verify>
    <automated>node --test --test-name-pattern 'contains a non-Error clone failure without synthesizing a row cause' tests/orchestrators/plugin/install-flow.test.ts</automated>
    <fails_when>The existing case for a failed row with no brace fails. STOP as step 1 says and report back. Do not invent a reason token.</fails_when>
    <automated>node --test tests/shared/notification-types.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts</automated>
    <fails_when>An enrollment, an ordered list, or a count pin misses network error; the fixture order differs from the catalog; or the new state's bytes do not match the fixture render.</fails_when>
    <automated>node --test tests/orchestrators/marketplace/update.test.ts tests/edge/handlers/marketplace/update.test.ts</automated>
    <fails_when>A save, errno-save, non-Error, or codeless-github case still shows a reason. The lock case lacks lock held. An HTTP case lacks network error or its status-and-URL first frame, or shows the raw credentials. The 403, ENETUNREACH, missing-source, invalid-manifest, or unreadable cases changed.</fails_when>
    <automated>npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts extensions/pi-claude-marketplace/shared/notify-reasons.ts extensions/pi-claude-marketplace/shared/notification-wire.ts extensions/pi-claude-marketplace/shared/notification-types.ts</automated>
    <fails_when>A rule of the classifier or of hostHttpStatus, or the HTTP message branch, has no covering case.</fails_when>
    <automated>test "$(grep -c 'network unreachable' extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 5. The fallback, or a comment that describes it, survives.</fails_when>
    <automated>test "$(grep -cF '"network error"' extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts)" -ge 1</automated>
    <fails_when>Baseline at HEAD is 0. The HTTP rule is missing.</fails_when>
    <automated>test "$(grep -cF '"lock held"' extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts)" -ge 1</automated>
    <fails_when>Baseline at HEAD is 0. The lock rule is missing.</fails_when>
    <automated>test "$(grep -cw lying extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 3. A comment still describes the removed fallback.</fails_when>
    <automated>test "$(grep -cF '| "network error"' extensions/pi-claude-marketplace/shared/notification-types.ts)" -eq 1</automated>
    <fails_when>Baseline at HEAD is 0. The token is not in the closed Reason set.</fails_when>
    <automated>test "$(grep -c 'catalog-state: update-host-http-error' docs/output-catalog.md)" -eq 1</automated>
    <fails_when>Baseline at HEAD is 0. The catalog state is missing.</fails_when>
    <automated>test "$(grep -cF '?? ["network unreachable"]' docs/output-catalog.md)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 1. The catalog paragraph still describes the fallback.</fails_when>
    <automated>test "$(grep -c 'network unreachable' tests/edge/handlers/marketplace/update.test.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 1. The edge handler comment still names the network reason for an unclassified failure.</fails_when>
    <automated>npm run test:cucumber -- features/marketplace/update.feature features/marketplace/file-source-update.feature</automated>
    <fails_when>A real-Pi update scenario lost its invalid manifest, source missing, or permission denied reason.</fails_when>
  </verify>
  <acceptance_criteria>network error is the 77th Reason, enrolled everywhere the closed-set gates look, and the catalog state update-host-http-error has a matching fixture with the counts bumped. refreshOneMarketplace maps a held lock to lock held, gives every other failure outside the refresh no reason, classifies refresh failures, and maps a host HTTP status to network error. No fallback default exists. For a host HTTP failure, the first frame of the cause line is '{status} on {url}', with credentials redacted in the output. update.ts never names the network-unreachable token. Every case listed under behavior passes. update.ts and the three shared modules keep 100% direct coverage. Both commits passed the hook.</acceptance_criteria>
  <done>Every marketplace update failure row carries only a reason it was classified with: none for a save failure, lock held for a held lock, network error with the HTTP status and URL for a host HTTP answer, and the existing reasons for the refresh-read failures.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Locate every recorded manifest through one helper in add, info, and update</name>
  <files>extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts, tests/orchestrators/marketplace/shared.test.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts, tests/orchestrators/marketplace/info.test.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts, tests/orchestrators/marketplace/update.test.ts</files>
  <read_first>info.ts (the whole file, 224 lines). The D-01 data-driven table in tests/orchestrators/marketplace/info.test.ts (about lines 564-640) and its helpers marketplaceRecord, writeMarketplaceJson, snapshotEnvironment, and notificationBoundary (about lines 38-198). add.ts: resolvesToRecord and redeclareRecordedSource (about lines 386-460), addPathInGuard, and expandTildePath (about lines 1190-1263). shared.ts: the import block and the type imports (about lines 28-75). shared.test.ts: the import block (about lines 1-60). update.ts after Task 1: the header flow comment (lines 47-96), manifestContentKey, refreshRecord, validateManifestAtRoot, and the import block. update.test.ts: the MU-5 case 'clone advances + manifest re-validation fails' (about line 1444), the case 'a pre-persistence manifest failure leaves cache rows intact and calls zero git operations' (about line 1886), and the stale-paths case (about line 4951 at HEAD). tests/edge/handlers/marketplace/info.test.ts: seedMarketplace (about lines 114-140).</read_first>
  <behavior>
    - recordedManifestPath returns the record's manifestPath, even when the manifest is not at the conventional place in its root and the typed source points elsewhere.
    - info shows the recorded root for a directory source, typed as an absolute path or as ~.
    - info shows the recorded manifest for a file source, whether typed as a conventional .claude-plugin/marketplace.json, an external file, a relative path, or a ~ path.
    - In every row, the shown path is the recorded one, not the typed source resolved again.
    - add still re-declares a path typed in the same directory, and still adds a new directory for a path typed in another directory (WR-06).
    - The github, url, and path refresh cases keep their outcomes when the refresh reads the recorded manifest. No refresh rewrites a record's two paths.
  </behavior>
  <action>1. Helper, red first (OD-2, OD-5). Add a top-level case to tests/orchestrators/marketplace/shared.test.ts (the file uses top-level cases) titled 'recordedManifestPath returns the manifest path the record holds'. Build a record whose manifest is not at the conventional place in its root, and whose typed source and add-time directory point elsewhere: root '/marketplaces/tools', manifestPath '/marketplaces/tools/catalog/marketplace.json', source pathSource('./elsewhere/.claude-plugin/marketplace.json'), addedFromCwd '/work', name 'tools', scope project, and plugins {}. Assert that the result equals the literal '/marketplaces/tools/catalog/marketplace.json'. Then export recordedManifestPath(record: ExtensionState["marketplaces"][string]): string from extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts. It returns the record's manifestPath. Its doc comment follows comments.md and cites WR-02, D-01, and D-02. It says four things. Every marketplace is a directory on disk: the managed clone of a github or url source, or the user's own directory of a path source. The add records the absolute path of the manifest inside that directory: the conventional .claude-plugin/marketplace.json for a clone or a directory source, and the exact file for a file source. Every reader locates the manifest here. The typed source and the add-time directory only say where the marketplace came from. Write no relative-path resolution, legacy repair, or migration (OD-4).

2. info cases, red first (OD-3, D-01). Rewrite the D-01 data-driven table in tests/orchestrators/marketplace/info.test.ts, the for loop at about lines 564-640. Each row records its root and manifest under {cwd}/recorded/{row}, in the form the add writes for that source kind. For a directory source, the manifest is the root plus .claude-plugin/marketplace.json. For a file source, the manifest is the root plus the last two path segments of the typed file. The source keeps the typed spelling, and the add-time directory stays cwd. Write the manifest at the recorded manifest path with writeMarketplaceJson before the snapshot. The rows (title, then typed source, then shown path) are:
   'directory source', {cwd}/sources/directory, the recorded root;
   'conventional manifest file', {cwd}/sources/conventional/.claude-plugin/marketplace.json, the recorded manifest;
   'external manifest file', {cwd}/sources/external/catalog/marketplace.json, the recorded manifest;
   'relative manifest file', ./sources/relative/catalog/marketplace.json, the recorded manifest;
   'tilde manifest file', ~/sources/tilde/catalog/marketplace.json, the recorded manifest;
   'home directory source', ~, the recorded root.
 Title each case 'D-01: marketplace info shows the recorded path for the {title}'. Build each expected path with path.join from cwd, in a field of its own row, so the loop body has no conditional (WR-12). Keep the snapshot-unchanged assertion and the strict notification boundary. Run node --test tests/orchestrators/marketplace/info.test.ts and confirm that every row fails on HEAD, which shows the typed source resolved again.

3. info, green. In buildBlock in extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts, take the manifest path once from recordedManifestPath(record), and use it for the loadMarketplaceManifest read. In the path arm, set absPath from the record. When the typed source's basename equals the basename of that manifest path, the user named the manifest file, so absPath is the recorded manifest path. This covers a file source, including a conventional .claude-plugin/marketplace.json (D-01). Otherwise absPath is record.marketplaceRoot (a directory source). Read the typed source only for that basename: it is provenance, used for display only. Never resolve it against the add-time directory, and never expand ~ (OD-3). Remove the node:os import. Update the doc comment of buildBlock for the path arm (PD-2). In the other path-source cases in info.test.ts and in tests/edge/handlers/marketplace/info.test.ts, the recorded directory's basename differs from the manifest's basename, so those cases keep their expected root.

4. add (OD-2, OD-4, OD-6). In resolvesToRecord in extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts, keep resolving the typed path as the add does: expandTildePath first, then relative to the command's cwd. Compare the result directly with record.marketplaceRoot and with recordedManifestPath(record). Remove the step that resolves the recorded paths against the record's add-time directory, which existed only for legacy relative records. Update the WR-06 doc comment, and change the doc comment of redeclareRecordedSource only where it repeats that resolution. expandTildePath stays in add.ts as the only ~ expansion in the marketplace orchestrators, which resolves IN-02. The existing add.test.ts cases cover both outcomes; add no case.

5. update (OD-1, OD-2, OD-4, D-02, PD-3). In extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts, import recordedManifestPath from ./shared.ts. manifestContentKey reads loadMarketplaceManifestDocument(recordedManifestPath(record)). In refreshRecord, keep each kind's refresh step. For github, refreshGitHubClone runs in locations.sourceCloneDir(name). For url, refreshUrlClone runs in the same directory. For path, there is no refresh step. Any other kind throws the existing unsupported-source-kind Error before any read. After the kind dispatch, read the document once for every kind with loadMarketplaceManifestDocument(recordedManifestPath(record)). Keep the remote-URL and status-and-URL message logic from Task 1 unchanged. Delete validateManifestAtRoot and its doc comment. Remove the node:path import and the MarketplaceManifestDocument type import once they are unused. The fetch still targets the containment-checked locations.sourceCloneDir(name) (NFR-10). In the header flow comment, change only the github arm's read+validate line and the path arm's refreshPathManifest(record) line, so they say that the refresh reads the recorded manifest through recordedManifestPath. Leave the rest of the header (IN-01) as it is. Name the deleted function in no comment.
 In tests/orchestrators/marketplace/update.test.ts, delete the case titled 'validateManifestAtRoot: stale manifestPath and marketplaceRoot are corrected (lines 382-388)': it exists only for a legacy record (OD-4). Two comments name the deleted function: the one in the MU-5 case 'clone advances + manifest re-validation fails', and the one in 'a pre-persistence manifest failure leaves cache rows intact and calls zero git operations'. Reword both to say that the read of the recorded manifest throws. Add no case: for every record the current add writes, the recorded manifest is the file HEAD reads, so the existing github, url, and path cases prove there is no regression.

6. Run the verify commands. Then run SKIP=npm-check pre-commit run --files on the seven files, and commit them as 'fix(marketplace): read every recorded manifest through one helper'.</action>
  <verify>
    <automated>node --test tests/orchestrators/marketplace/shared.test.ts tests/orchestrators/marketplace/info.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts tests/edge/handlers/marketplace/info.test.ts tests/edge/handlers/marketplace/update.test.ts</automated>
    <fails_when>A D-01 row shows the typed source resolved again, or the wrong form; the helper case gets a rebuilt or re-resolved path; an add re-declaration case changed outcome; or a github, url, or path refresh case changed outcome.</fails_when>
    <automated>npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts</automated>
    <fails_when>The helper, either form of the info path line, resolvesToRecord, a refresh kind arm, or the unsupported-kind throw is no longer fully covered by its own pair.</fails_when>
    <automated>npm run test:cucumber -- features/marketplace/info.feature features/marketplace/file-source-update.feature</automated>
    <fails_when>A real-Pi info or file-source scenario shows the wrong form, or a different path than the one update reads.</fails_when>
    <automated>test "$(grep -cE 'homedir|addedFromCwd' extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 1. info still resolves the typed source or expands ~ (OD-3, IN-02).</fails_when>
    <automated>test "$(grep -cF 'record.addedFromCwd' extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 1. add still resolves recorded paths for legacy relative records.</fails_when>
    <automated>grep -q 'export function recordedManifestPath' extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts</automated>
    <fails_when>The helper is missing or is not exported. Baseline at HEAD is absent.</fails_when>
    <automated>grep -q 'recordedManifestPath(record)' extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts</automated>
    <fails_when>info does not read the record through the helper. Baseline at HEAD is absent.</fails_when>
    <automated>grep -q 'recordedManifestPath(record)' extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts</automated>
    <fails_when>add does not read the record through the helper. Baseline at HEAD is absent.</fails_when>
    <automated>test "$(grep -c 'recordedManifestPath(record)' extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts)" -ge 2</automated>
    <fails_when>Baseline at HEAD is 0. manifestContentKey or refreshRecord still reads the manifest some other way.</fails_when>
    <automated>test "$(grep -c validateManifestAtRoot extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 3. The repair function, or a comment naming it, survives.</fails_when>
    <automated>test "$(grep -c validateManifestAtRoot tests/orchestrators/marketplace/update.test.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 4. The legacy-only case, or a comment naming the deleted function, survives.</fails_when>
    <automated>test "$(grep -c 'resolves the original' tests/orchestrators/marketplace/info.test.ts)" -eq 0</automated>
    <fails_when>Baseline at HEAD is 1. The D-01 table was not rewritten.</fails_when>
  </verify>
  <acceptance_criteria>shared.ts exports recordedManifestPath, and info.ts, add.ts, and update.ts read the record through it. info.ts holds neither the add-time directory nor home-directory expansion. The six D-01 rows each fail on HEAD and pass after the change. The helper case discriminates against both plausible wrong implementations. update.ts reads every kind's manifest from the record and never writes a record's two paths. The repair function and its legacy-only case are gone. The info and file-source feature files pass in real Pi. All four production modules keep 100% direct coverage. The commit hook passed.</acceptance_criteria>
  <done>add, info, and update locate every recorded manifest the same way. info shows the path the record holds: the manifest file of a file source, the root of a directory source.</done>
</task>

<task type="auto">
  <name>Task 3: Record the decisions and pass the full check</name>
  <files>.planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW-FIX.md, .planning/HANDOFF.json, .planning/REQUIREMENTS.md, .planning/ROADMAP.md</files>
  <read_first>06-REVIEW-FIX.md (the whole file). .planning/HANDOFF.json (the whole file). .planning/REQUIREMENTS.md line 125 (UPD-11). .planning/ROADMAP.md lines 451-466 (Phase 9, success criterion 3 at line 461).</read_first>
  <action>1. Take the short hashes of the three code commits from git log: Task 1's vocabulary commit and its fix commit, and Task 2's commit.

2. .planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW-FIX.md (OD-15).
 - In the frontmatter, set fixed to 15, skipped to 0, and status to all_fixed. In the Summary, write 'Fixed: 15' and 'Skipped: 0'.
 - Move WR-02 into Fixed Issues, between WR-01 and WR-03. Give it Files modified (the seven Task 2 files), Commit (Task 2's commit), and an Applied fix that starts 'Operator decision, 2026-10-19.' and states the decision. Git clones and local path sources are treated alike, because a marketplace is a directory on disk. add, info, and update locate the manifest through one helper, recordedManifestPath. info shows the recorded manifest file of a file source and the recorded root of a directory source (D-01), and no longer resolves source.logical against addedFromCwd. Those two fields are provenance only. Legacy records are not supported, so no repair or migration was written, and the clone-path repair in update was removed with its legacy-only unit case. This also resolves IN-02.
 - Replace the body of Skipped Issues with 'None.'.
 - In the WR-13 entry, replace the 'Partly done' sentences with one sentence saying that the failed-save case now also compares the whole notification. Add Task 1's fix commit.
 - Under 'Follow-ups found while fixing', mark the save-reason bullet resolved, starting with 'Resolved (operator decision, 2026-10-19, commits {vocabulary hash} and {fix hash}):', and state the decision. A local state-save failure renders a failed row with no reason and prints its cause chain. Errno codes are not mapped on the save path, because only a refresh failure is classified. A held state lock renders lock held, as autoupdate does. ENOENT/ENOTDIR as source missing, and the transport classifications, stay on the refresh-read path. network unreachable is kept for connection failures. An HTTP answer from the git host other than 401/403 renders the new reason network error, and the first frame of the cause line names the status and the URL. The fallback reason was removed, so a failure no rule classifies carries no reason. UPD-11 and Phase 9's success criterion 3 now expect network error with the status and URL.
 - Keep the rest of the file unchanged.

3. .planning/HANDOFF.json (OD-16, PD-5).
 - Set remaining_tasks ids 4 and 5 to status 'done', each with a commit field in the shape of the completed_tasks entries. Id 4 gets Task 2's commit, and id 5 gets Task 1's fix commit.
 - Remove the two human_actions_pending entries whose action starts with 'Decide WR-02' and 'Decide the reason a failed state save reports'. Keep the WR-01 and WR-03 entries.
 - Set next_action to 'Review the two pending human actions (WR-01 wording, WR-03 reversal), then /gsd-discuss-phase 7.'.
 - Change nothing else. Keep the existing layout, and keep the file valid JSON.

4. .planning/REQUIREMENTS.md (OD-18): replace the UPD-11 sentence, and leave its checkbox open (Phase 9 still owns it). The new sentence says: a git marketplace whose host answers 5xx or 404 fails as `network error`, with a cause line that names the HTTP status and the fetched URL; and one whose connection drops fails as `network unreachable`. Leave the traceability table row unchanged.

5. .planning/ROADMAP.md (PD-6): in Phase 9 success criterion 3, use a scoped Edit to replace only the clause starting 'and `update` against a host armed for'. The new clause says that update against a host armed for 5xx or 404 fails as `network error`, with a cause line that names the status and the URL, and that a dropped connection fails it as `network unreachable`. Leave the add clauses and every other line unchanged.

6. Commit the four files as 'docs(planning): record the marketplace path and failure-reason decisions'. Then run npm run check in this checkout on the final tree, which is the quick-task gate for committed build inputs. For the SUMMARY, record the command, its exit status, git rev-parse --short HEAD, node --version, and the scope (full tree). If the check fails, fix the cause in a new commit and run it again.</action>
  <verify>
    <automated>node -e 'const h=JSON.parse(require("fs").readFileSync(".planning/HANDOFF.json","utf8"));const s=Object.fromEntries(h.remaining_tasks.map((t)=>[t.id,t.status]));process.exit(s[4]==="done"&&s[5]==="done"&&s[6]==="not_started"&&h.human_actions_pending.length===2&&!h.human_actions_pending.some((a)=>a.action.startsWith("Decide"))?0:1)'</automated>
    <fails_when>At HEAD, task 4 is not_started and there are 4 pending actions. A failure here means the HANDOFF edits are incomplete, or the JSON is invalid.</fails_when>
    <automated>grep -q '^status: all_fixed$' .planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW-FIX.md</automated>
    <fails_when>At HEAD the status is partial. The REVIEW-FIX frontmatter was not updated.</fails_when>
    <automated>grep -n 'UPD-11' .planning/REQUIREMENTS.md | grep -q 'network error'</automated>
    <fails_when>At HEAD UPD-11 expects only network unreachable. The requirement was not updated.</fails_when>
    <automated>test "$(grep -c 'network error' .planning/ROADMAP.md)" -ge 1</automated>
    <fails_when>Baseline at HEAD is 0. Phase 9 success criterion 3 still contradicts UPD-11.</fails_when>
    <automated>npm run check</automated>
    <fails_when>Any static check, unpaired test, integration test, cucumber scenario, or direct-coverage pair fails on the combined tree.</fails_when>
  </verify>
  <acceptance_criteria>06-REVIEW-FIX.md shows 15 fixed, 0 skipped, and status all_fixed, with WR-02, the WR-13 completion, and the resolved follow-up each carrying the decision and their commits. HANDOFF.json passes the node check. UPD-11 and Phase 9 success criterion 3 expect network error with the status and URL for 5xx and 404, and network unreachable for a dropped connection. npm run check exits 0, and its command, exit status, commit, Node version, and scope are recorded for the SUMMARY.</acceptance_criteria>
  <done>The decisions are recorded, Phase 9 inherits one consistent expectation, and the full check is green on the final tree.</done>
</task>

</tasks>

<threat_model>
## Trust boundaries

| Boundary | Description |
| --- | --- |
| state.json to the marketplace orchestrators | User-owned records, loaded verbatim (T-02-16); manifestPath and marketplaceRoot are not containment-checked at load |
| marketplace source and git host to update and info | Local directories and files, or a clone fetched from a git host that may answer with any HTTP status |
| failure to notification | A thrown error becomes a reason token plus a cause chain the user reads, in TUI or JSON |

## STRIDE threat register

| Threat ID | Category | Component | Severity | Disposition | Mitigation plan |
| --- | --- | --- | --- | --- | --- |
| T-czw-01 | Repudiation | update.ts failed row in refreshOneMarketplace | medium | mitigate | Classify only refresh failures, map a held lock to lock held, and map a host HTTP status to network error. Every other failure carries no reason, and the cause chain always prints. Proven by the Task 1 owner cases: whole notifications for the save, errno-save, lock, HTTP, non-Error, and codeless rows. |
| T-czw-02 | Information disclosure | the status-and-URL first frame of an HTTP failure | medium | mitigate | The URL can carry userinfo from a url source. serializeCauseChain applies redactCredentials to every frame for TUI and JSON. Task 1's 404 case pins `https://***@...`. |
| T-czw-03 | Tampering | git arms of update.ts reading the recorded manifestPath | low | accept | Reads only. The fetch and checkout write only to the containment-checked locations.sourceCloneDir(name) (NFR-10). The path arm and ~17 other readers already read record.manifestPath, and state.json is the user's own file. |
| T-czw-04 | Information disclosure | cause lines of a failed save and a held lock | low | accept | The save error's text and the lock path appear as on every failed row, as autoupdate's lock row already shows. JSON mode keeps its PMOD-04 path redaction. No new output channel (IL-2). |
| T-czw-05 | Spoofing | form of the info path line (PD-2) | low | accept | Classification by basename. A directory named like the manifest file shows the manifest file. Both values come from the record, so info and update never name different files. |
| T-czw-SC | Tampering | npm/pip/cargo installs | high | accept | No package installs in this plan. package.json and package-lock.json stay unchanged. |
</threat_model>

<verification>
Task 3 runs npm run check on the final tree. That is the quick-task gate for committed build inputs (local-verification gates.md). Record the command, exit status, commit, Node version, and scope in the SUMMARY. Confirm that git diff 4f3a93e5..HEAD -- package.json package-lock.json is empty. Confirm that no .feature file or step module changed: Phase 9 owns the real-Pi HTTP scenarios that UPD-11 now describes.
</verification>

<success_criteria>
- A failed state save renders a reasonless failed row with its cause line, and no errno code changes that.
- A held lock renders lock held. A host HTTP status renders network error, with '{status} on {url}' as the first frame of the cause line and credentials redacted.
- Connection failures keep network unreachable, and refresh-read failures keep their reasons. No fallback reason exists.
- network error is in the closed Reason set, with its catalog state and fixture, and is listed in docs/json-output.md.
- add, info, and update locate the manifest through recordedManifestPath. info shows recorded paths in the D-01 forms. No legacy repair, relative-path resolution, or migration code remains or is added.
- 06-REVIEW-FIX.md, HANDOFF.json, UPD-11, and Phase 9 success criterion 3 reflect the decisions.
- npm run check exits 0, with 100% direct coverage for every changed pair.
</success_criteria>

<output>
Create .planning/quick/261019-czw-resolve-marketplace-manifest-from-materi/261019-czw-SUMMARY.md. Report the status-and-URL channel, PD-4, PD-6, and the add-side observation as decisions or notes the operator can review, together with the npm run check evidence. Include ## Threat Flags; when it applies, write: None -- no security-relevant surface outside the plan's threat model was introduced. Do not commit the SUMMARY, PLAN, or STATE.md. The quick-task orchestrator commits those docs.
</output>
