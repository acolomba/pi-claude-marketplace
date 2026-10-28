---
phase: 05-marketplace-command-parity
reviewed: 2026-10-28T18:45:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - eslint.config.js
  - rule-packs/architecture.json
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/domain/unsupported-components.ts
  - extensions/pi-claude-marketplace/domain/version.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-present.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - features/lib/https-git-host/server.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/info.feature
  - features/step_definitions/marketplace/info.steps.ts
  - test/platform/hosted-manifest-fetch.test.ts
  - test/shared/notification-json.test.ts
  - test/shared/notification-present.test.ts
  - test/orchestrators/marketplace/info.test.ts
  - .planning/phases/05-marketplace-command-parity/05-REVIEW-FIX.md
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-28T18:45:00Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

The final integrated review found two reproducible blockers. Existing tests and
the full gate are green, but they omit these literal-address and successful-info
branches. No Warning or Info findings remain.

## CR-01 — BLOCKER: IPv6 embeddings bypass explicit metadata-address refusals

**File:** `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts:108-135`

`isDisallowedHost` refuses three explicit metadata IPv4 addresses through
`LOCAL_OR_METADATA_HOSTS`. IPv4-embedded IPv6 addresses instead pass through
`isLocalIpv6`, which checks only `isLocalIpv4` ranges and omits those explicit
metadata addresses.

A hermetic injected-fetch probe produced:

| Redirect target | Result |
|---|---|
| `100.100.100.200` | Refused before second request |
| `[::ffff:6464:64c8]` | Second request issued |
| `168.63.129.16` | Refused before second request |
| `[::ffff:a83f:8110]` | Second request issued |
| `192.0.0.192` | Refused before second request |
| `[::ffff:c000:c0]` | Second request issued |

This bypass needs no DNS resolution, so D-PL5-31's accepted DNS residual does
not cover it. It violates the literal-address controls of T-05-10 and D-PL5-29.

**Fix scope:** use one complete IPv4 refusal predicate for dotted IPv4 and
decoded IPv6 embeddings. It must include the explicit metadata set and existing
ranges. Cover all three addresses across supported embedding prefixes while
retaining public-address acceptance.

## CR-02 — BLOCKER: Successful marketplace info exposes credential-bearing names

**Files:**

- `extensions/pi-claude-marketplace/shared/notification-present.ts:204-209`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:122-124`

`c99c6832` redacts names in `PluginInfoMessage`, including failed marketplace
info. A successful result uses `MarketplaceInfoMessage`. Its
`redactMarketplaceInfo` function masks only `source.url`; path and GitHub
messages return unchanged and `message.name` is never redacted.

Real `presentNotification` to `toWirePayload` probes leaked the stored token for
both path and URL sources. The same command-level case is reproduced by keeping
the new stored-name scenario's manifest healthy.

**Fix scope:** redact `MarketplaceInfoMessage.name` while preserving URL masking
and every other field. Cover individual and cascade presentation, the real
presentation-to-wire path, and successful marketplace-info command behavior.
The failed-info fix and bare-versus-qualified ID behavior must remain intact.

## Prior finding dispositions

| Earlier finding | Current disposition |
|---|---|
| WR-01 malformed hosted URL | Resolved by parser and fetch-boundary validation. |
| WR-02 legacy `.json` git source migration | Resolved; stored URL and legacy string sources retain git semantics. |
| WR-03 redirect host classification | Earlier range cases resolved and DNS residual accepted by D-PL5-31; CR-01 is a distinct literal-address bypass. |
| WR-04 network port lint coverage | Resolved by shared selectors and import/fetch restrictions. |
| WR-05 hosted failure cause and credentials | Resolved for failed add; typed failures and presentation masking apply. |
| IN-01 empty URL authority | Resolved by parser refusal. |
| IN-02 write errno wording | Accepted by D-PL5-18. |
| IN-03 hosted marker in git tree | Resolved; hosted leftovers refuse `.git`. |
| IN-04 redirect userinfo classification | Resolved by masked refusal before the next request. |
| IN-05 exact `market` completion | Accepted by D-PL5-11. |
| IN-06 hosted relative entry | Resolved on D-PL5-32 surfaces; explicit exceptions remain accepted. |
| IN-07 repair baseline | Accepted by D-PL5-17; current autoupdate behavior makes the old blanket cascade-skipping description obsolete. |

## Validation evidence

- Fresh `npm run check` at `c99c6832` passed 1,123 scenarios, 11,455 steps,
  and 309 LCOV records.
- Hosted-fetch, notification-present, and notification-json owner suites passed.
- Hermetic diagnostic probes reproduced both omitted branches.
- No files were changed by the reviewer.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
