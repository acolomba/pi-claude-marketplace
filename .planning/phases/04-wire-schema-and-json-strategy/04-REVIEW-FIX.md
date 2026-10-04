---
phase: 04-wire-schema-and-json-strategy
fixed_at: 2026-10-03T20:30:00Z
review_path: .planning/phases/04-wire-schema-and-json-strategy/04-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-03T20:30:00Z
**Source review:** .planning/phases/04-wire-schema-and-json-strategy/04-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (1 Critical, 6 Warning; Info out of scope)
- Fixed: 6
- Skipped: 1 (WR-06, deferred to Phase 5 by the orchestrator)

**Where verification ran:** in the main checkout
(`/home/acolomba/src/pi-claude-marketplace-json`, branch `features/json`). No
worktree was used. The orchestrator's project rules pin this checkout through
`root-pin.sh` and forbid other checkouts, and a `.claude/worktrees/` copy has no
`node_modules` to run the gates. Every commit was gated on
`SKIP=trufflehog pre-commit run --files <changed files>` exiting 0. For each
change to a `tests/architecture` file, that run escalated to the full
`npm run check`. The last run (WR-05) covered the exact tree committed as
`29ec1fc1`.

**Byte locks:**

- `node scripts/notify-corpus.mjs check` after the three redactor fixes:
  `3134 baseline entries present, 0 extra`.
- The same check after WR-05: `3134 baseline entries present, 9 extra`. The
  9 extras are new emissions from the AUTH-09 gate itself, which now calls
  `notify`. They are all in `tests/architecture/no-credential-leak.test.ts`,
  and every one shows the redacted form. No baseline entry changed or went
  missing.
- `git diff --exit-code 4e6c568a -- docs/output-catalog.md` is empty.
- D-13 (user-approved): the 9 extras are ledgered in
  `04-CORPUS-CHANGES.json` and spliced into
  `notify-corpus/baseline.jsonl` and `meta.json` in commit `2d3e6ba9`
  (`test(notify): ledger the approved credential-gate corpus additions`).
  The ledger has 8 records, one with multiplicity 2, and each names its
  gate site and the behavior it preserves. The splice took the entries from
  a capture of only `tests/architecture/no-credential-leak.test.ts` and
  recaptured nothing else.
  - Ledger command:
    `Approved corpus changes: 0 removals, 9 additions; unchanged occurrences: 3134; total: 3143`.
  - Negative controls each exit 1, and the files were restored and checked
    with `cmp` afterwards:
    - dropping one `tests/index.test.ts` baseline entry
    - un-redacting one ledger message
    - lowering the multiplicity-2 record to 1
  - `node scripts/notify-corpus.mjs check` after the splice:
    `3143 baseline entries present, 0 extra`.
  - Pre-commit on the four committed files reported every hook Passed or
    Skipped and modified no file.

## Fixed Issues

### CR-01: Userinfo redaction leaks the tail of a password that contains an unencoded `@`

**Files modified:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts`, `tests/shared/redact-credentials.test.ts`, `tests/architecture/no-credential-leak.test.ts`
**Commit:** 45449a48
**Applied fix:** The userinfo class now allows `@` (`[^\s/?#]+@`). Greedy
backtracking stops at the last `@` before the host, as WHATWG URL parsing and
git do. New unit row: `https://user:p@ss@host/x` -> `https://***@host/x`. New
AUTH-09 site plants `alice:p@ss@`. Both fail on the old pattern (control run).

### WR-01: The Bearer pattern rewrites non-secret prose and crosses line breaks

**Files modified:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts`, `tests/shared/redact-credentials.test.ts`
**Commit:** 6268a0be
**Applied fix:** The prefix allows only `[ \t]+`, so it no longer crosses a
newline. The secret span (`[\w.~+/-]*\w=*`) ends on a word character or `=`
padding, so trailing sentence punctuation stays. A new `isTokenShaped` helper
redacts the secret only when it carries a digit or one of `_.~+/-`, or runs 16
or more characters. The D-06 form (`Bearer ***`) is kept.

The existing lower-case row changed from `bearer abc` to `bearer abc123`,
because a bare word is now prose by definition. New rows:

- negatives: `Bearer token required`, `a Bearer token.`,
  `Bearer realm="GitHub"`, and the newline case
- positives: a letters-only 16-character secret, and a period after a secret

All 5 new negative/period rows fail on the old pattern. The existing AUTH-09
Bearer sites (`abc.def.secret`) still redact.

**Status:** fixed: requires human verification. The token-shape rule is a
judgment call. A hyphenated prose word after `Bearer` (`Bearer re-auth`) is
still redacted.

### WR-02: The token and userinfo patterns miss secrets next to a word character

**Files modified:** `extensions/pi-claude-marketplace/shared/redact-credentials.ts`, `tests/shared/redact-credentials.test.ts`, `tests/architecture/no-credential-leak.test.ts`
**Commit:** a2f32c6e
**Applied fix:**

- The GitHub-token pattern has no boundary anchor on either side
  (`gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,}`). `xghp_<36>` becomes `x***`
  and `ghp_<36>_suffix` becomes `***_suffix`.
- The userinfo pattern starts at the first character of a run of scheme
  characters: `(?<![a-z0-9+.-])([a-z0-9+.-]+:\/\/)`.

The review's suggested `(?<![A-Za-z0-9])` lookbehind for tokens would still
have missed `xghp_`, so it was not used. A fully unanchored userinfo pattern
failed `sonarjs/super-linear-regex`. The run-start lookbehind keeps the scan
linear and also covers `1https://u:tok@host`.

New unit rows (4) and a new AUTH-09 diagnostic site with
`remote_https://...` and `x<token>_suffix` all fail on the old patterns.

### WR-03: The marketplace LLM tool reads state twice, so content and details can disagree

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`, `extensions/pi-claude-marketplace/edge/handlers/tools.ts`, `tests/orchestrators/marketplace/list.test.ts`
**Commit:** 21f69324
**Applied fix:** `loadMarketplaceListBlocks` is replaced by
`loadMarketplaceListEntries`. It returns `MarketplaceListEntry { scope, record,
block }` from one pass over state and the merged config. `listMarketplaces`
maps the entries to blocks. `pi_claude_marketplace_list` builds its content
lines from `{scope, record}` and its details from `block`, so both come from
the same entries. Content bytes and strict-mock read counts are unchanged.

The owner tests were moved to the new loader, and a new test pins the
record/block/scope pairing.

Behavior note: when both scopes have no records, the tool now also reads the
merged config. The command already did this.

### WR-04: The catalog wire harness silently validates the wrong presentation when an `emit` fixture lacks `present`

**Files modified:** `tests/architecture/catalog-uat/fixture-types.ts`, `tests/architecture/catalog-uat/catalog-wire.test.ts`, `tests/architecture/catalog-uat/fixtures/plugin-list.ts`, `tests/architecture/catalog-uat/fixtures/plugin-update.ts`
**Commit:** 53cab366
**Applied fix:**

- `CatalogFixture` is now a union of `SeamFixture` (`emit` and `present` both
  required) and `DispatchFixture` (both `never`). An emit-only fixture does
  not type-check.
- New control `JOUT-02 control: an emit fixture without its present hook does
  not type-check` uses `@ts-expect-error`. With the old type, tsc reports
  TS2578 (unused directive), so the control is proven.
- The hand-copied pairs are replaced by one helper per surface,
  `listSurfaceSeam(rows)` and `updateNoOpSeam(rows)`. Each builds `emit` (still
  through the real `notifyWithContext` / `notifyUpdateNoOpWithContext` seam)
  and `present` from the same rows, context label, cardinality, and row
  policies.

### WR-05: The credential-leak gate's "text" leg does not run the production text strategy

**Files modified:** `tests/architecture/no-credential-leak.test.ts`
**Commit:** 29ec1fc1
**Applied fix:** `probePresentation(message)` now calls
`notify(ctx, run, message)` with a recording `NotificationContext`. It asserts
exactly one delivery and uses the delivered text as the text leg. The
presentation and payload legs are unchanged. The test-local `cascadeText` and
the per-site grammar lambdas are removed. Raw-surface rows still use
`formatRawSurface`.

Non-vacuity was checked by appending planted credentials in
`emitPresentation`. All 9 structured rows failed with "the text shows a
planted credential". The planted change was reverted.

Corpus impact: this adds 9 test-only corpus entries. The user approved
them as D-13, and they are ledgered and spliced in `2d3e6ba9` (see Byte
locks).

## Skipped Issues

### WR-06: The JSON strategy emits payloads for raw surfaces that the text strategy suppresses

**File:** `extensions/pi-claude-marketplace/shared/notification-json.ts:155-165`
**Reason:** Deferred by the orchestrator. ROADMAP Phase 5 success criterion 6
already covers it: "the JSON strategy keeps the text strategy's empty no-ops".
Behavior is unchanged in this phase.
**Original issue:** `formatRawSurface` emits nothing for an empty `diagnostic`
and an empty `async-rewake-summary`. `wireRawSurface` still returns a payload
for both, so JSON mode would append entries that text mode never shows.

---

_Fixed: 2026-10-03T20:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
