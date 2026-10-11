---
phase: 09-address-tech-debt-redact-llm-tool-error-text
reviewed: 2026-10-11T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - tests/edge/handlers/tools.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Structural Findings (fallow)

`fallow audit --changed-since b30468c0 --max-crap 0` verdict: **pass**.

- dead_code_issues: 0
- complexity_findings: 0
- duplication_clone_groups: 0

(`maxCrap 0` turns CRAP off, per project policy.)

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase diff `b30468c0..HEAD` for `edge/handlers/tools.ts` and its
owner test. I traced the called code: `shared/redact-credentials.ts`,
`shared/errors.ts::errorMessage`, `shared/notification-present.ts::presentCascade`,
`shared/notification-resolve.ts::resolveRows`, `domain/source.ts::sourceLogical`,
`orchestrators/marketplace/shared.ts::loadVisibleMarketplaces`, and the
`persistence/state-io.ts` url-source re-parse throw.

Independent checks:

- `node --test tests/edge/handlers/tools.test.ts`: 41 of 41 pass.
- `tsc --noEmit -p .`: exit 0.
- ESLint `--max-warnings 0` on both files: exit 0.

The change does what D-01 to D-04 require:

- Every `content` string goes through one builder, `textContent`, which calls
  `redactCredentials`.
- Both `execute` bodies are now a single `try { return await build...() }`,
  so no throw path reaches Pi. The `marketplaceExists` lookup and the whole
  marketplace-list body were the two throw paths that escaped before.
- `loadFailure` builds the TC-9 shape through `textContent`.

The `details` claim holds. `resolveRows`, which `presentCascade` calls,
redacts block names and row names. The list blocks carry no `source` field
and no cause trailer: PL-6 failed blocks carry `plugins: []` only. So no
unredacted free text reaches `details`.

The tests are hermetic: they use `createHermeticEnvironment` and a network
counter. Each one compares the whole result. The inventory-read count (0 on
the failure paths) shows that the error path never opens a notification
snapshot.

I found no blockers and no warnings. Two info items follow.

Per the review brief, these are recorded decisions and not defects: D-03
(`isError: true` that Pi 0.87.1 ignores) and D-05 (no absolute-path
redaction).

## Info

### IN-01: The lookup-failure test cannot show which call threw

**File:** `tests/edge/handlers/tools.test.ts:1777-1808`
**Issue:** The test "returns a redacted tool error instead of throwing when the
marketplace lookup fails" uses the same `ftp://` fixture as the payload-failure
case at lines 1721-1747. Both `marketplaceExists` (through
`loadVisibleMarketplaces` -> `loadState`) and `loadPluginListPayload` throw the
same `state.json marketplace "..." has an invalid url source: ...` message.
Both calls now share one `try`, and both failures map to
`Failed to load plugin list: ...`.

Today the lookup throws first, so the test does exercise the lookup path. The
test is also red against `b30468c0`, where the lookup ran outside the `try`.
But the assertion does not pin which call failed. Suppose a later refactor
moves the payload load ahead of the lookup, or makes the lookup tolerate the
bad record. The case stays green, and nothing would cover the lookup's catch.
**Fix:** Optional. Make the lookup the only call that can fail. For example,
give the lookup case a fixture where only `loadVisibleMarketplaces` reads the
bad record. Or assert the boundary read counts that tell the two paths apart.
Otherwise, accept the shared-try design as the proof: one catch covers the
whole body by construction.

### IN-02: `loadFailure` labels non-load failures as load failures

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:114-120, 181-185, 541-545`
**Issue:** The catch now wraps the whole body, not just the loads. A failure in
`openNotificationSnapshot`, `presentCascade`, `toWireMarketplaces`, or
`renderPluginPayload` also comes back as `Failed to load marketplace list: ...`
or `Failed to load plugin list: ...`. A programming error, such as a
`TypeError` in row rendering, reads to the model as a state-load failure.
Nothing is logged for diagnosis. Pi would have relayed the throw as plain text
before, so this costs no visibility compared with the old behavior. But the
wording is now less accurate than the scope of the catch.
**Fix:** Optional. Use a neutral wording, such as `Could not list plugins: ...`.
Or keep the current text and note in the `loadFailure` doc comment that the
subject covers any failure of the tool body, not only the state reads.

---

_Reviewed: 2026-10-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
