---
phase: 05-marketplace-command-parity
reviewed: 2026-10-28T19:15:40Z
depth: standard
files_reviewed: 35
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
  - features/support/pi-process.ts
  - features/support/world.ts
  - test/platform/hosted-manifest-fetch.test.ts
  - test/shared/notification-json.test.ts
  - test/shared/notification-present.test.ts
  - test/orchestrators/marketplace/info.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-28T19:15:40Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** clean

## Narrative Findings (AI reviewer)

No actionable findings remain. The integrated Phase 05 review and the final
re-review at `baab1bf6` cover hosted catalog fetching, source parsing and
migration, network restrictions, source repair and rollback, reserved-name
controls, resource removal, notification identities, credential masking, and
test isolation.

The final pass inspected both blocker-fix commits, their tests, and affected
callers. The remainder of the previously reviewed integrated source is unchanged.
All reviewed files meet quality standards. No issues found.

## Blocker closure

### CR-01: Embedded metadata addresses — resolved

Commit `cd7fdcf5` makes dotted IPv4 and all four supported IPv4-in-IPv6
prefixes call the same complete four-octet refusal predicate. It includes
`100.100.100.200`, `168.63.129.16`, and `192.0.0.192`, together with the
existing local/private ranges.

The regression matrix checks all three dotted addresses and all twelve
embedded forms, asserting refusal before a second request. Public-address
positive controls cover compatible, mapped, translated, and NAT64 forms.
DNS-name handling remains within the explicitly accepted D-PL5-31 boundary.

### CR-02: Successful marketplace-info name disclosure — resolved

Commit `3a8c7e1c` masks stored marketplace names for path, GitHub, and URL
sources while retaining URL masking. Individual and cascade presentations
use the same helper. Copies preserve the other message fields, and unchanged
blocks retain their original object identity.

An independent frozen-input probe passed sixteen combinations of source,
name, URL credentials, and individual/cascade output. It verified masking,
identity, field preservation, and absence of input mutation.

The prior PluginInfo redactor remains intact. Its marketplace-subject marker
survives presentation, preserving bare marketplace IDs and qualified plugin
IDs while remaining absent from serialized output.

The healthy-manifest Cucumber scenario exercises the real command. Its
stored-name fixture writes only the scenario sandbox's state file.
Per-scenario reset removes that state, and run teardown removes the sandbox.
The synthetic credential requires no external account or network access.

## Prior finding dispositions

| Finding | Final disposition |
| --- | --- |
| WR-01 malformed hosted URL | Resolved by parser and fetch-boundary validation. |
| WR-02 legacy `.json` git source migration | Resolved; stored URL and legacy string sources retain git semantics. |
| WR-03 redirect host classification | Literal-address cases resolved, including CR-01; DNS residual remains accepted by D-PL5-31. |
| WR-04 network port lint coverage | Resolved by shared selectors and import/fetch restrictions. |
| WR-05 hosted failure cause and credentials | Resolved by typed failures and presentation masking. |
| IN-01 empty URL authority | Resolved by parser refusal. |
| IN-02 write errno wording | Accepted by D-PL5-18. |
| IN-03 hosted marker in git tree | Resolved; hosted leftovers refuse `.git`. |
| IN-04 redirect userinfo classification | Resolved by masked refusal before the next request. |
| IN-05 exact `market` completion | Accepted by D-PL5-11. |
| IN-06 hosted relative entry | Resolved on D-PL5-32 surfaces; explicit exceptions remain accepted. |
| IN-07 repair baseline | Accepted by D-PL5-17; current autoupdate behavior supersedes the old blanket cascade-skipping description. |
| T-05-17 name masking | Failed-info masking remains covered by `c99c6832`; successful-info masking is covered by `3a8c7e1c`. |

## Validation evidence

- The orchestrator's fresh `npm run check` at `3a8c7e1c` exited 0 on
  Node `v26.12.1`: 1,124 Cucumber scenarios, 11,462 steps, and 309 merged
  LCOV records. All three changed direct pairs reached 100% coverage;
  Fallow and normal commit hooks passed.
- The reviewer independently ran the hosted-manifest-fetch,
  notification-present, and notification-json owner suites together.
  All three modules passed, exit 0.
- The independent frozen-input presentation probe passed all sixteen cases.
- `git diff 3a8c7e1c..HEAD -- . ':(exclude,glob).planning/**/*.md'`
  was empty, and the worktree was clean. The full-gate evidence therefore
  applies to the reviewed build inputs at `baab1bf6`.
- This review made no filesystem changes and no commits.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
