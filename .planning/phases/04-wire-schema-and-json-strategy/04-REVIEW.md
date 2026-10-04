---
phase: 04-wire-schema-and-json-strategy
reviewed: 2026-10-03T21:30:00Z
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
  critical: 0
  warning: 0
  info: 9
  total: 9
status: clean
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-03T21:30:00Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** clean

## Summary

This is the second review pass. I checked the fixes in `45449a48^..2d3e6ba9`
against the iteration-1 findings, looked for regressions they introduced, and
re-read the full file scope.

All six fixes resolve their findings:

- **CR-01:** The userinfo class now admits `@`, and greedy backtracking stops
  at the last `@` before `/ ? #` or whitespace. A probe of
  `https://user:p@ss@host/x` returns `https://***@host/x`. The AUTH-09 gate
  plants `alice:p@ss@` and `@ss@`.
- **WR-01:** The Bearer prefix is `[ \t]+`, so it no longer crosses a line
  break. Prose (`Bearer token required`, `Bearer realm="GitHub"`,
  `Bearer error="invalid_token"`) stays intact.
- **WR-02:** `xghp_…`, `ghp_…_suffix`, `remote_https://u:tok@host`, and
  `1https://…` are all redacted. The run-start lookbehind
  `(?<![a-z0-9+.-])` keeps the userinfo scan linear. I timed 8 adversarial
  shapes at 10^4 to 2x10^5 characters, and none took more than 50 ms.
- **WR-03:** `loadMarketplaceListEntries` returns `{scope, record, block}`
  from one pass. The tool's content and details come from the same entries.
  The extra merged-config read on the empty path cannot throw, because
  `loadConfig` turns every read or parse failure into `invalid`.
- **WR-04:** `CatalogFixture = SeamFixture | DispatchFixture` makes `emit`
  without `present` a type error. The `@ts-expect-error` control proves it.
  The seam helpers build `emit` and `present` from the same rows.
- **WR-05:** `probePresentation` drives the text leg through production
  `notify` with a recording context. It asserts one delivery, and
  `assertNoPlantedCredential` requires the `***` marker in the text, so the
  leg is not vacuous.

**Verification:**

- The five targeted suites pass: 138 tests in `redact-credentials`,
  `no-credential-leak`, `catalog-wire`, marketplace `list`, and `tools`.
- `fallow audit --base 45449a48^` passes, with 0 dead-code findings, 0
  complexity findings, and no introduced clones.
- The comments in the fixes carry no phase, plan, or wave references.

No Critical or Warning findings remain. The Info items below are the
redactor's residual edges, which I confirmed with probes, plus two stale
comments and one dead fixture field from the fixes. The iteration-1 Info items
that are still open are carried forward unchanged.

I did not re-report these dispositioned items: WR-06 (Phase 5 SC-6), T-04-06,
the plugin-tool `Failed to load plugin list:` text, the `Bearer re-auth`
judgment call, and the D-13 corpus additions. I see no reason to challenge any
of those dispositions.

## Narrative Findings (AI reviewer)

## Info

### IN-01: The `x-access-token:` arm keeps the boundary and first-`@` limits that WR-02 and CR-01 removed elsewhere

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:33`

**Issue:** `accessToken = /\b(x-access-token:)[^\s@/]+/gi` still has a leading
`\b`, and its secret class still stops at the first `@`. Probe results:

- `foo_x-access-token:supersecretvalue` is unchanged.
- `ax-access-token:supersecretvalue` is unchanged.
- `x-access-token:p@ss@host` becomes `x-access-token:***@ss@host`.

The module doc (lines 18-22) says "a secret glued to a word character … is
still replaced". This arm does not meet that claim.

The real-world exposure is small. Inside a `scheme://` URL, the userinfo arm
runs first and covers the token. The only `x-access-token` producer
(`domain/auth-registry.ts:59`) passes a GitHub token, which the unanchored
`githubToken` arm catches anyway.

**Fix:** Use the same run-start lookbehind
(`(?<![a-z0-9_-])x-access-token:`). Alternatively, scope the doc sentence to
the GitHub-token and userinfo arms.

### IN-02: The Bearer secret span backtracks off trailing `+ / - . ~`, so `isTokenShaped` judges a truncated token

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:34-39,49-51`

**Issue:** `([\w.~+/-]*\w=*)` must end on a word character or `=`, so it gives
back any trailing run of `+ / - . ~`. This keeps a sentence period intact
(the intent). It also has two side effects:

1. A base64 token whose last data character is `+` or `/` leaks its tail.
   `Bearer dGVzdHRva2Vu+/==` becomes `Bearer ***+/==`. Only a few bits leak.
2. `isTokenShaped` runs on the truncated span, not on the whole token. A short
   token with a letters-only head is therefore not redacted at all:
   `Bearer abc/==` and `Bearer abc-` are unchanged, although `/==` makes the
   original obviously token-shaped.

Before WR-01, both cases were redacted in full.

**Fix:** Decide the token shape on the full run, and trim only a trailing
`.`, which is the punctuation the fix meant to keep. For example, match
`([\w~+/-]+(?:\.[\w~+/-]+)*=*)` and test `isTokenShaped` on that capture. Add
rows for `Bearer abc/==` and a `+/==` tail.

### IN-03: Greedy userinfo can swallow a credential-free host when later text in the same authority segment holds an `@`

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:32`

**Issue:** `[^\s/?#]+@` now runs to the last `@` before `/ ? #` or
whitespace. Text glued to a URL that has no credentials loses the host:

- `https://example.com,alice@example.com` becomes `https://***@example.com`.
- `'https://github.com'@x` becomes `'https://***@x`.

The old first-`@` pattern over-matched the same inputs up to the first `@`.
This is not a new failure class, and it fails safe (it hides more, never
less). It still contradicts "Only the secret span changes". No current
producer emits such a string.

**Fix:** Optional. Also exclude `,`, `'`, `"`, `<`, and `>` from the
userinfo class, since none of them appears unencoded in a git-accepted
userinfo. Or record this as accepted over-redaction in the module doc.

### IN-04: Comments left stale by the WR-03 loader change

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:15-19`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:646-648`

**Issue:** The `tools.ts` header still names `loadVisibleMarketplaces` and
`loadPluginListPayload` as "the structured loaders" behind the tools. It says
they "were added … in this plan", which is a planning-artifact reference that
the comment policy forbids. The `loadVisibleMarketplaces` doc still says it
feeds `pi_claude_marketplace_list`. After WR-03, the marketplace tool reads
`loadMarketplaceListEntries`, and `loadVisibleMarketplaces` serves only the
plugin tool's `marketplaceExists` probe.

**Fix:** Name `loadMarketplaceListEntries` in the `tools.ts` header and drop
"in this plan". Narrow the `loadVisibleMarketplaces` doc to the plugin tool's
existence check (and `browse.ts`).

### IN-05: A seam fixture's `message` field is dead data that restates its rows

**File:** `tests/architecture/catalog-uat/fixture-types.ts:7-11`, `tests/architecture/catalog-uat/fixtures/plugin-list.ts:540-543`, `tests/architecture/catalog-uat/fixtures/plugin-update.ts:174-181`

**Issue:** `SeamFixture` inherits a required `message`, but neither harness
reads it once `emit` or `present` is set:

- `catalog-contract.test.ts:175` calls `emit`.
- `catalog-wire.test.ts:139` calls `present`.

Each seam fixture restates the same rows twice: in `message` and in the
`listSurfaceSeam(...)` or `updateNoOpSeam(...)` argument. The two copies can
drift with no test going red. This is the same "stated once" concern WR-04
fixed for `emit` and `present`.

**Fix:** Have the seam helpers return `message` too (built from the same
rows). Or make `message` `never` on `SeamFixture` and derive it where a
harness needs it.

### IN-06: Redaction scope leaves common credential forms unhandled (carried from iteration 1, unchanged)

**File:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts:31-43`

**Issue:** These forms still pass through unchanged (re-probed):

- `Authorization: Basic <base64>`
- `Authorization: token <hex>`
- `x-access-token: <secret>` with a space
- `?access_token=…`

**Fix:** Record them as accepted residual risk, or extend D-05.

### IN-07: `wireScope` and `wireVersion` sit at the cyclomatic ceiling (carried from iteration 1, unchanged)

**File:** `extensions/pi-claude-marketplace/shared/notification-json.ts:396-423,434-463`

**Issue:** Each function is a 19-arm switch with cyclomatic complexity 20,
equal to `maxCyclomatic: 20`. The next `PluginStatus` member turns
`fallow health` red here.

**Fix:** Use `as const satisfies Record<PluginStatus, …>` tables.

### IN-08: The wire `description` differs from what the text form shows (carried from iteration 1, unchanged)

**File:** `extensions/pi-claude-marketplace/shared/notification-json.ts:277`

**Issue:** The wire `description` is not truncated, and an empty
`description: ""` is emitted. The text form truncates the description and
omits it when empty.

**Fix:** Omit an empty description, or record the untruncated choice as a
decision.

### IN-09: The shipped schema has no `$id` and cannot express the WIRE-05 summary rule (carried from iteration 1, unchanged)

**File:** `scripts/wire-schema.mjs:26-34`, `schema/claude-plugin.schema.json:1-4`

**Issue:** The document has no `$id`; a grep of the schema file finds 0
matches. `summary` is plain optional on every kind, so a consumer cannot
learn from the schema that `summary` rides only warning and error payloads.

**Fix:** Add a versioned `$id`. Document the summary rule in the schema
`description`, or express it per kind with `if`/`then` on `severity`.

---

_Reviewed: 2026-10-03T21:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
