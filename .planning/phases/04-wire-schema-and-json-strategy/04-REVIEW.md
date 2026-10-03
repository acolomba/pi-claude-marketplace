---
phase: 04-wire-schema-and-json-strategy
reviewed: 2026-10-03T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-present.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - package.json
  - schema/claude-plugin.schema.json
  - scripts/check-unused-type-members.contracts.json
  - scripts/generate-wire-schema.mjs
  - scripts/wire-schema.mjs
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-wire.test.ts
  - tests/architecture/catalog-uat/fixture-maps.ts
  - tests/architecture/catalog-uat/fixture-types.ts
  - tests/architecture/catalog-uat/fixtures/plugin-list.ts
  - tests/architecture/catalog-uat/fixtures/plugin-update.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/edge/handlers/tools.test.ts
  - tests/orchestrators/marketplace/list.messaging.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/scripts/generate-wire-schema.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-json.test.ts
  - tests/shared/notification-present.test.ts
  - tests/shared/notification-resolve.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-wire.test.ts
  - tests/shared/redact-credentials.test.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

I reviewed the phase diff (`fc8d845d..HEAD`) for the 39 listed files. The
review covered the wire schema, the JSON strategy, the presentation step,
credential redaction and its call sites, the LLM tool details, the schema
generator, and the gates.

Most of the work holds up:

- The converter builds every field explicitly and never spreads a model
  object.
- Optional fields are absent, never `undefined` or `null`, in every arm I
  traced.
- The closed sets are bidirectionally enrolled through
  `Record<ClosedSet, true>`.
- Raw severities now come from one table, `RAW_SURFACE_SEVERITY`, which both
  strategies read.
- The drift test compares both the deep structure and the formatted bytes.
- The WIRE-08 walk has real planted controls.

The main problem is the credential redactor. It is the only security control
this phase adds, and I confirmed four defects in it by running probes against
the module:

1. It leaks the tail of a password that contains an unencoded `@`.
2. It rewrites ordinary prose that follows the word "bearer", across line
   breaks.
3. It misses tokens that sit next to a word character.
4. It misses a URL scheme that sits next to a word character.

Outside the redactor:

- The marketplace LLM tool reads state twice per call, so its content and
  details can disagree.
- Two gates are weaker than they look: the catalog wire harness silently
  falls back when an `emit` fixture has no `present` hook, and the
  credential-leak gate's "text" leg does not run the production text
  strategy.

## Structural Findings (fallow)

Command: `node_modules/.bin/fallow audit --format json --quiet --max-crap 30 --base fc8d845d` (exit 1, verdict `fail`).

- **Dead code:** 0 introduced, 0 inherited.
- **Duplication:** 0 introduced. The 1 clone group in the changed files is inherited from the branch base and is not reported.
- **Complexity:** 14 introduced findings. All of them come from CRAP scoring under the forced `--max-crap 30`, which uses fallow's `static_estimated` coverage model. The project sets `health.maxCrap: 0`, which switches CRAP off (see CONVENTIONS.md), so none of these are real findings. All introduced functions stay within `maxCyclomatic: 20` and `maxCognitive: 15`. Two functions sit exactly at the cyclomatic ceiling; see IN-02:
  - `notification-json.ts` `wireScope` (cyclomatic 20, line 396)
  - `notification-json.ts` `wireVersion` (cyclomatic 20, line 434)

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Userinfo redaction leaks the tail of a password that contains an unencoded `@`

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:22`

**Issue:** The userinfo pattern `[^\s/?#@]+@` stops at the first `@`. Both
WHATWG URL parsing and git treat the last `@` before the host as the end of
the userinfo. As a result, a URL like `https://user:p@ss@host/x` is accepted
by `new URL()` (password `p%40ss`) and by git, but the redactor turns it into
`https://***@ss@host/x`. The end of the password (`ss`) is then disclosed.

This happens in both strategies, at every D-07 site:

- cause chains through `serializeCauseChain`
- the `reconcile-aborted` cause
- `plugin-path-skipped`
- the url-source marketplace-info `url` in `redactMarketplaceInfo`

I confirmed this with a direct probe of `redactCredentials`. No test covers an
`@` inside the password. The AUTH-09 JSON gate plants only `alice:s3cret@`.

**Fix:** Match up to the last `@` inside the authority. A greedy class that
excludes the authority terminators but allows `@` backtracks to the final `@`:

```ts
const userinfo = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#]*@/gi;
```

Then add a `redact-credentials.test.ts` row with input
`https://user:p@ss@host/x` and expected output `https://***@host/x`, and a
`no-credential-leak.test.ts` site that plants `p@ss`.

## Warnings

### WR-01: The Bearer pattern rewrites non-secret prose and crosses line breaks

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:24`

**Issue:** `/\b(Bearer\s+)[\w.~+/=-]+/gi` matches the case-insensitive word
"bearer" followed by any word. It also matches across a newline, because
`\s+` matches `\n`. Probed results:

- `"Bearer token required"` becomes `"Bearer *** required"`.
- `'WWW-Authenticate: Bearer realm="GitHub"'` becomes `'Bearer ***"GitHub"'`.
- `"using bearer\nauthentication"` becomes `"using bearer\n***"`, which
  replaces a word on the next line.

This contradicts the module contract ("Only the secret span changes; the text
around it stays byte for byte"). It also corrupts cause chains and
diagnostics, which are the text a user needs to diagnose an auth failure.

**Fix:** Allow only horizontal whitespace and require a token-shaped secret.
For example:

```ts
const bearer = /\b(Bearer[ \t]+)(?=[\w.~+/-]*[\d_.~+/-])[\w.~+/-]+=*/gi;
```

A minimum length of 16 (the same floor as the prefixed tokens) is a simpler
alternative. Add negative rows for "Bearer token required" and for the
newline case.

### WR-02: The token and userinfo patterns miss secrets next to a word character

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:22,25`

**Issue:** Both patterns have `\b` anchors that fail next to a word character:

- The `gh[pousr]_[A-Za-z0-9]{16,}\b` arm needs a word boundary after the
  body. A token followed by `_` (for example `ghp_<36>_suffix`) is not
  redacted at all, because backtracking cannot find a boundary between two
  word characters.
- The leading `\b` before `gh` or the scheme misses a secret glued to a word
  character. For example, `xghp_<36>` and `remote_https://u:tok@host/x` both
  stay fully intact.

These inputs are unusual. Still, this is fail-open behavior in a security
redactor: a partial non-match exposes the whole secret.

**Fix:** Replace the word-boundary anchors with lookarounds over the token
alphabet:

- `(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{16,}`, with no trailing anchor, so
  the body match is maximal.
- `(?<![a-z0-9+.-])` before the scheme, in place of `\b`.

Add regression rows for each case.

### WR-03: The marketplace LLM tool reads state twice, so content and details can disagree

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:96,121`

**Issue:** `content` is built from `loadVisibleMarketplaces({ cwd })` at line 96. `details` is built from a second, independent `loadMarketplaceListBlocks({ cwd })` at line 121. That second read loads both scopes' `state.json` again and also loads the merged config. A concurrent `marketplace add`/`remove` from another Pi process between the two reads produces a result whose text lines and `details.marketplaces` list different marketplace sets. The empty-state guard is also evaluated only against the first read, so a non-empty content can come with an empty `details` (or the reverse). LLMT-01 / D-09 promise that the details match what the command emits; this path does not guarantee that they match the tool's own content.

**Fix:** Load once and derive both from the same snapshot. One option: call `loadMarketplaceListBlocks` first, then build the content lines from the same per-scope `state` records, for example by having the loader return the records it read. Another option: build the content lines from the blocks plus one plugin-count lookup taken from the same read.

### WR-04: The catalog wire harness silently validates the wrong presentation when an `emit` fixture lacks `present`

**File:** `tests/architecture/catalog-uat/catalog-wire.test.ts:139`, `tests/architecture/catalog-uat/fixture-types.ts:15-21`

**Issue:** `fixture.present?.(run) ?? presentNotification(run, catalogMessage(...))` falls back to the central-policy presentation of `fixture.message` whenever `present` is missing. For a fixture whose bytes come from an `emit` closure (rendered under a command's own row policies or the no-op envelope), that fallback converts a different value from the one the text bytes came from. The JSON-validity and WIRE-08 proofs for that tuple would then pass while checking the wrong payload.

Nothing enforces that `emit` implies `present`. The four `present` hooks also restate their `emit` closure's message and policies by hand (for example in `fixtures/plugin-list.ts`), so the two can drift without any red test.

**Fix:**

- Make the pairing a type: `CatalogFixture = { message; pi } & ({ emit: ...; present: ... } | { emit?: never; present?: never })`.
- Or add a harness assertion: `assert.ok(fixture.emit === undefined || fixture.present !== undefined, tupleKey(...))`.
- Also, derive each `emit` from its `present` (format the presentation it returns) so the message is stated once.

### WR-05: The credential-leak gate's "text" leg does not run the production text strategy

**File:** `tests/architecture/no-credential-leak.test.ts:784-790` (`cascadeText`), and the per-site `text` lambdas

**Issue:** The header says each row reads back "the text the text strategy builds from the same value". The cascade sites build that text with test-local code instead: `composeReconcileAppliedBody(presentation.marketplaces)` plus the raw advisory strings joined with `\n`. The production text strategy is `notify()` -> `emitPresentation` -> `formatCascadePresentation`, which uses `composeContextBlocks`, `foldAdvisories`, and `emitWithSummary`, and reaches the user through `ctx.ui.notify`. None of that code runs here.

If a regression in the dispatch formatter re-introduced a credential (for example a new trailer composed from an unredacted field, or a summary that quotes a cause), the gate would stay green. The info sites have the same gap: they call the grammar renderers directly instead of going through `notify`.

**Fix:** Drive the text leg through `notify(ctx, run, message)` with a capturing `NotificationContext`, as the catalog contract harness does with `makeCtx`. Assert on the captured `ctx.ui.notify` arguments. Keep the presentation and payload legs as they are.

### WR-06: The JSON strategy emits payloads for raw surfaces that the text strategy suppresses

**File:** `extensions/pi-claude-marketplace/shared/notification-json.ts:155-165`, `extensions/pi-claude-marketplace/shared/notification-grammar.ts:1147-1158`

**Issue:** `formatRawSurface` returns `undefined` (nothing is emitted) for a `diagnostic` with zero lines and for an empty `async-rewake-summary` (D-05, D-08). `wireRawSurface` always returns a payload in those cases, and `tests/shared/notification-json.test.ts:1616` pins the empty-diagnostic payload as correct.

The two strategies are supposed to be format-only peers of one value (JOUT-02). Once Phase 5 routes the sink by mode, JSON mode will append session entries for notifications that text mode never shows. That breaks parity, and nothing at the converter boundary signals it.

**Fix:** Decide the emit-or-suppress question once, upstream of both formatters. One way: give `resolveRawSurface` (or a shared predicate next to `RAW_SURFACE_SEVERITY`) a `suppressed` verdict that both the text and JSON paths honor. Another way: let `toWirePayload` return `undefined` for those two cases. Then replace the owner test at line 1616 with a parity test over both strategies.

## Info

### IN-01: The redaction scope leaves common credential forms unhandled

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:21-31`

**Issue:** These forms pass through unchanged (probed). They are outside the D-05 list but are realistic in git and HTTP error text:

- `Authorization: Basic <base64>`
- GitHub's legacy `Authorization: token <40-hex>`
- `x-access-token: <secret>` with a space after the colon (the test at line 93 pins it as "bare prefix, unchanged")
- query-string `?access_token=...`

**Fix:** Record them as an accepted residual risk in the phase SECURITY notes, or extend D-05. At a minimum, treat a space after `x-access-token:` as part of the prefix.

### IN-02: `wireScope` and `wireVersion` sit exactly at the cyclomatic ceiling

**File:** `extensions/pi-claude-marketplace/shared/notification-json.ts:396-423,434-463`

**Issue:** Each function is a 19-arm switch over `PluginStatus` with cyclomatic complexity 20, equal to `maxCyclomatic: 20`. The next `PluginStatus` member turns `fallow health` red in a file unrelated to the change. `wireVersion` also duplicates the grouping in `pluginVersion` (`notification-types.ts:682`), except for the `updated` arm.

**Fix:** Use `as const satisfies Record<PluginStatus, ...>` tables, the same enrollment pattern this file already uses for closed sets. For example, use `INSTALL_SCOPED: Record<PluginStatus, boolean>` for `wireScope`. These tables are exhaustive at the type level and have constant complexity.

### IN-03: The wire `description` is not the text the text form shows

**File:** `extensions/pi-claude-marketplace/shared/notification-json.ts:277`

**Issue:** The text form prints a description only when it is non-empty, and only after `truncateDescription` (`notification-grammar.ts:964-966`). The wire copies it untruncated and also emits `description: ""`. This is not a path or credential disclosure, but it departs from the phase rule "emit what the text form shows, no more".

**Fix:** Either omit an empty description (`row.description.length > 0`), or record the untruncated choice as a deliberate decision in the plan.

### IN-04: The shipped schema cannot express the WIRE-05 summary rule and has no `$id`

**File:** `scripts/wire-schema.mjs:26-34`, `schema/claude-plugin.schema.json`

**Issue:** `summary` is plain `Optional` on every structured kind. A consumer validating against the shipped document cannot learn that `summary` is present exactly on warning and error payloads. The document also has no `$id`, so it cannot be referenced or versioned by URI once it is published in the npm package.

**Fix:** Add an `$id` (for example a versioned package URL). Either document the summary rule in the schema `description`, or express it per kind with `if`/`then` on `severity`.

---

_Reviewed: 2026-10-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
