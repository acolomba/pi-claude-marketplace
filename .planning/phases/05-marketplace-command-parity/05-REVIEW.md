---
phase: 05-marketplace-command-parity
reviewed: 2026-10-29T04:00:31Z
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

**Reviewed:** 2026-10-29T04:00:31Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** clean

## Narrative Findings (AI reviewer)

No actionable findings remain on the merged tree at `38a18b81`. The review
covers MKT-01 through MKT-08: hosted catalog fetching and refresh, source
classification and shorthand parsing, the `market` alias, reserved-name
controls, add repair and rollback, remove reporting and its exhaustive dropped
axis fold, marketplace row identities, list/info network isolation, and
credential-safe presentation.

The evaluation-scope resolver returned `status: degraded`, source
`phase-range`, reason `no-reachable-task-commits`; its fallback union spans
later milestone phases and is not a valid Phase 5 boundary. This review
therefore uses the workflow handoff's explicit Phase 5 ownership and the exact
35-file scope preserved by the prior Phase 5 review. Against that reviewed
baseline (`b49106b3`), only `eslint.config.js` and the HTTPS git-host test
stand-in changed. The current pass read both diffs and their affected paths;
the Phase 5 production modules remain byte-identical to the clean baseline.

The ESLint change preserves the hosted-fetch network chokepoints while making
the layer-direction zones apply to every extension module. The git-host change
adds an independently selected `hold-git-body` fixture arm; it does not alter
catalog-file serving, redirect handling, request reset, or credential behavior.
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

- The parent's fresh merged-tree `npm run check` exited 0 at the reviewed
  build inputs: 1,142 Cucumber scenarios, 11,734 steps, and 309 merged LCOV
  records.
- The reviewer independently ran the 13-module Phase 5 owner batch at
  `38a18b81`: name and source parsing, router and completions, hosted fetch and
  catalog lifecycle, marketplace shared/update/remove/info, the shared plugin
  fold, JSON rendering, and presentation redaction. All 13 modules passed.
- The Phase 5 validation pass separately records `marketplace/add` at 198/198
  and the focused behavioral set at 16 scenarios / 140 steps.
- The independent frozen-input presentation probe passed all sixteen cases.
- CodeGraph traced the add/update/remove/info, hosted-fetch, row-id, and
  presentation paths. Fallow guard found no boundary violation in the Phase 5
  modules. Fallow security's dynamic-regex candidates in `domain/name.ts` are
  constant-built patterns, not attacker-built expressions; its other
  candidates fall outside this phase scope.
- This review changed only this report and made no commit.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
