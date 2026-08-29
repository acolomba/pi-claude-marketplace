---
phase: 108-domain-and-platform
verified: 2026-08-29T15:00:11Z
status: gaps_found
score: 64/69 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 20
  total: 20
  not_honored: []
gaps:
  - truth: "All modified runtime cases obey the exact lowercase phase contract, and data rows use separate arrange, act, and assert phases."
    status: failed
    reason: "Ten data-row test definitions use // act & assert. The rule requires separate phases for data rows. Two of these definitions also call assert.doesNotThrow(), which is outside the assert.throws()/assert.rejects() exception."
    artifacts:
      - path: tests/domain/components/mcp.test.ts
        issue: "Line 75 uses // act & assert in a data-row case."
      - path: tests/domain/name.test.ts
        issue: "Lines 17, 98, 108, 144, 212, 323, and 405 use // act & assert in data-row cases. Lines 17 and 98 call assert.doesNotThrow()."
      - path: tests/domain/source.test.ts
        issue: "Lines 655 and 702 use // act & assert in data-row cases."
    missing:
      - "Change the ten data-row definitions to separate // arrange, // act, and // assert phases with blank-line separation."
      - "Replace the two combined assert.doesNotThrow() blocks with separate act and assert phases."
  - truth: "After the concern-local migrations, no generic Git, credential, or device-flow helper reference or file remains."
    status: failed
    reason: "The three helper files are absent, but four source comments still name their deleted paths."
    artifacts:
      - path: extensions/pi-claude-marketplace/domain/github-auth.ts
        issue: "Line 300 references tests/helpers/device-flow-mock.ts."
      - path: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
        issue: "Line 162 references tests/helpers/credential-mock.ts."
      - path: extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
        issue: "Lines 169 and 192 reference tests/helpers/credential-mock.ts."
    missing:
      - "Remove or update the four stale comments without restoring the deleted generic helpers."
deferred:
  - truth: "Every production resolver consumer narrows materializability on installable before it uses state as secondary detail."
    addressed_in: "Phases 113, 114, and 115"
    evidence: "The Phase 108 resolver consumer ledger assigns plugin-state-classifier to P113-24, lifecycle consumers to P114-07/08/09/10/11/12/14, and reconcile consumers to P115-06/07."
---

# Phase 108: Domain and Platform Verification Report

**Phase Goal:** Maintainers can rely on every domain and platform module through a compliant mirrored test and preserved public contract.
**Verified:** 2026-08-29T15:00:11Z
**Status:** gaps_found
**Re-verification:** No. This is the initial verification.

## Goal Achievement

### Observable Truths

| # | Roadmap truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each of the 23 owners passes alone with 100 percent direct function, line, and branch coverage. | ✓ VERIFIED | The verifier ran the focused direct-coverage command for all 23 pairs. Every command passed with exact hit/found equality. |
| 2 | Resolver consumers narrow on `installable`. Only true arms expose `pluginRoot`. `state` keeps three distinctions. | ⚠ DEFERRED IN PART | The union, constructors, resolver-owned gates, and static narrowing tests pass. Ten external production consumers remain assigned to Phases 113-115. |
| 3 | Production and fake Git, credential, and device-flow adapters pass identical public cases with independent broken controls. | ✓ VERIFIED | The 12-case Git, 31-case credential, and 10-case device-flow registrars run in both participants. Each single named broken-control test passed. |
| 4 | Domain and platform tests avoid live network access, developer credentials, and test-only production exports. | ✓ VERIFIED | Restricted-sandbox focused runs passed. Git replaces HTTP requests, device flow replaces `fetch`, credentials use injected processes, and case state has cleanup. |

**Score:** 64/69 truths verified. The count includes 61/65 plan truths and 3/4 roadmap truths.

The deferred roadmap truth does not create an actionable Phase 108 gap. The two gap groups contain four failed plan truths.

### Plan Must-Haves

| Plan | Result | Live evidence |
| --- | --- | --- |
| 108-01 | 3/3 verified | Provider descriptors, host lookup, environment names, usernames, and scopes have exact value assertions. Direct coverage is 7/7 branches, 6/6 functions, 107/107 lines. |
| 108-02 | 3/3 verified | Clone, mirror, and canonical URL keys have independent exact outputs. Guarded consumer support uses concern-local fakes. |
| 108-03 | 3/3 verified | Event tuples and classifications have complete ordered-value assertions. Guarded auth and marketplace support is wired. |
| 108-04 | 3/3 verified | Hook-if mappings and precedence use independent complete mappings. Consumer support is concern-local. |
| 108-05 | 3/3 verified | Forward, inverse, and fallback tool-name behavior has complete assertions. Plugin consumers use guarded support. |
| 108-06 | 4/4 verified | Hooks parsing and projections pass 36/36 branches. Seven preflight fixture sites use exact true-literal spreads. |
| 108-07 | 3/3 verified | Matcher match-all, literal, mapped-token, deduplication, and rejection behavior passes. Consumer state is case-owned. |
| 108-08 | 2/2 verified | Partition results preserve group and handler order through independent whole-value assertions. |
| 108-09 | 2/2 verified | Runtime schema cases pass. Positive `satisfies` and negative `@ts-expect-error` evidence remains at module scope. |
| 108-10 | 1/2 verified | MCP record behavior passes, but the rejection data row at line 75 uses the combined phase marker. |
| 108-11 | 2/2 verified | Plugin entry and manifest shapes have runtime value checks and module-scope type evidence. |
| 108-12 | 4/4 verified | Production and fake device-flow participants share ten cases. The exact polling-order broken control passes. |
| 108-13 | 2/2 verified | Cache identity, invalidation, negative caching, and race behavior have complete direct coverage and case-owned directories. |
| 108-14 | 2/2 verified | Lookup remains exact, case-sensitive, Unicode-sensitive, and first-match-wins. |
| 108-15 | 2/2 verified | Parsed reference identity, key order, extra fields, typed errors, and causes have direct value assertions. |
| 108-16 | 1/2 verified | Name outputs and rejection boundaries pass. Seven data-row definitions violate the separate-phase rule, including two `assert.doesNotThrow()` combined blocks. |
| 108-17 | 2/2 verified | Plugin-root resolution, supported parent segments, exact failures, containment, and cleanup pass. |
| 108-18 | 5/5 verified | The strict union, constructors, two resolver gates, 19 fixtures, legacy-suite removal, caller ledger, and direct coverage are present. |
| 108-19 | 2/3 verified | Source parsing and equality behavior pass 172/172 branches. Two rejection data rows use the combined phase marker. |
| 108-20 | 2/2 verified | Hash order, text normalization, relevant content, ignored paths, symlinks, and truncation pass. |
| 108-21 | 4/4 verified | Credential production/fake contracts, process mechanics, alias control, and structural supplemental classification pass. |
| 108-22 | 4/4 verified | Git production/fake contracts, local repositories, injected HTTP, auth mechanics, and force-update control pass. |
| 108-23 | 2/3 verified | Pi API runtime/type ownership passes. Helper files are absent, but four source comments still reference their deleted paths. |

## Direct Owner Coverage

The verifier ran `node scripts/test-coverage-direct.mjs <source>` once for each Phase 108 source.

| Pair | Source | Branches | Functions | Lines | Status |
| --- | --- | ---: | ---: | ---: | --- |
| P108-01 | `domain/auth-registry.ts` | 7/7 | 6/6 | 107/107 | PASS |
| P108-02 | `domain/clone-key.ts` | 6/6 | 3/3 | 83/83 | PASS |
| P108-03 | `domain/components/hook-events.ts` | 2/2 | 1/1 | 287/287 | PASS |
| P108-04 | `domain/components/hook-if-targets.ts` | 1/1 | 0/0 | 94/94 | PASS |
| P108-05 | `domain/components/hook-tool-names.ts` | 3/3 | 1/1 | 134/134 | PASS |
| P108-06 | `domain/components/hooks.ts` | 36/36 | 9/9 | 421/421 | PASS |
| P108-07 | `domain/components/hooks/matcher.ts` | 22/22 | 2/2 | 59/59 | PASS |
| P108-08 | `domain/components/hooks/partition.ts` | 34/34 | 6/6 | 131/131 | PASS |
| P108-09 | `domain/components/hooks/schema.ts` | 1/1 | 0/0 | 61/61 | PASS |
| P108-10 | `domain/components/mcp.ts` | 1/1 | 0/0 | 16/16 | PASS |
| P108-11 | `domain/components/plugin.ts` | 1/1 | 0/0 | 105/105 | PASS |
| P108-12 | `domain/github-auth.ts` | 78/78 | 10/10 | 439/439 | PASS |
| P108-13 | `domain/manifest-cache.ts` | 21/21 | 2/2 | 134/134 | PASS |
| P108-14 | `domain/manifest-lookup.ts` | 5/5 | 2/2 | 60/60 | PASS |
| P108-15 | `domain/manifest.ts` | 9/9 | 3/3 | 100/100 | PASS |
| P108-16 | `domain/name.ts` | 33/33 | 4/4 | 151/151 | PASS |
| P108-17 | `domain/plugin-root.ts` | 10/10 | 1/1 | 62/62 | PASS |
| P108-18 | `domain/resolver.ts` | 268/268 | 51/51 | 1753/1753 | PASS |
| P108-19 | `domain/source.ts` | 172/172 | 27/27 | 645/645 | PASS |
| P108-20 | `domain/version.ts` | 25/25 | 6/6 | 107/107 | PASS |
| P108-21 | `platform/git-credential.ts` | 45/45 | 18/18 | 310/310 | PASS |
| P108-22 | `platform/git.ts` | 52/52 | 14/14 | 492/492 | PASS |
| P108-23 | `platform/pi-api.ts` | 12/12 | 5/5 | 163/163 | PASS |

## Required Artifacts

`verify.artifacts` passed all 38 declared artifacts. The verifier also examined substance and wiring.

| Artifact group | Count | Status | Details |
| --- | ---: | --- | --- |
| Mirrored owner tests | 23 | ✓ VERIFIED | Every file exists, has substantive assertions, directly imports its paired source, and passes focused coverage. |
| Modified production sources | 3 | ✓ VERIFIED | `hooks.ts`, `resolver.ts`, and `git-credential.ts` contain production logic. No test-only export or coverage ignore exists. |
| Shared contract registrars | 3 | ✓ VERIFIED | Git has 12 cases, credential has 31 cases, and device flow has 10 cases. Each registrar creates a test for each callable case. |
| Concern-local fakes and fake tests | 6 | ✓ VERIFIED | Each fake requires an explicit boundary. Each fake test runs the shared registrar and an independent broken control. |
| Hermetic support | 2 | ✓ VERIFIED | Credential process support checks the spawn boundary. Git repository support requires local boundaries and registers cleanup. |
| Correspondence gate | 1 | ✓ VERIFIED | Structural fake supplements are recognized. The negative-control command passed. |
| Deleted legacy tests/helpers | 8 | ✓ ABSENT | Five resolver proxy suites and three generic adapter helpers are absent. The two former Git proxy suites are also absent. |

The deleted files are expected absences, not part of the 38 positive artifact count.

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| 23 owner tests | 23 paired sources | Direct relative imports | ✓ WIRED | An AST import scan found 23/23 direct imports. The Phase 108 correspondence filter reports zero violations. |
| Production adapter owners | Three contract registrars | Direct import and `register*Contract(factory)` | ✓ WIRED | `github-auth.test.ts`, `git-credential.test.ts`, and `git.test.ts` invoke their shared registrar. |
| Fake adapter tests | Contracts and fakes | Registrar plus callable-case loop | ✓ WIRED | Each fake test imports both companions and iterates callable cases for its planted defect. |
| Resolver fixtures | Literal discriminant bags | 19 spread sites | ✓ WIRED | Static scan found exactly 19 fixture spreads. `npm run typecheck` passed. |
| Correspondence gate | Fake supplemental tests | Suffix, companion, and import structure | ✓ WIRED | The gate accepts structural supplements and rejects its negative fixtures. |
| Local/process support | Git and credential owners | Explicit factory injection | ✓ WIRED | The owners call guarded local repository and deterministic process factories. |

The generic `verify.key-links` text probe reported nine false negatives. Those plan links describe reverse imports or provenance links. Manual call-path checks above resolve them.

## Resolver Contract

The `ResolvedPlugin` schema has two `installable: true` arms. Both arms include `pluginRoot`.

The unavailable arm has `installable: false`. Its schema has no `pluginRoot` field.

`requireInstallable()` first rejects `!r.installable`. It then uses `state` to reject the partial true arm.

`requirePartialInstallable()` returns on `r.installable`. It rejects only the false arm.

Module-scope type evidence proves these rules:

- True-arm `pluginRoot` access compiles.
- False-arm `pluginRoot` access consumes `@ts-expect-error`.
- All three `state` literals remain distinct.
- Type evidence has no artificial runtime test or phase comments.

The current external consumer style is not complete. The explicit ledger defers ten lexical migrations to Phases 113-115.

## Shared Adapter Contracts

| Concern | Ordered cases | Production participant | Fake participant | Broken invariant | Named control result |
| --- | ---: | --- | --- | --- | --- |
| Device flow | 10 | Fetch-backed adapter with replaced `globalThis.fetch` and injected waits | Memory fake with disabled-network boundary | Poll responses do not advance | Only `consumes polling responses in order` fails inside the control. Named test PASS. |
| Credential | 31 | `createCredentialOps` with deterministic injected spawn | Memory credential fake | Returned credential aliases stored state | Only `returns a credential copy that cannot mutate stored state` fails inside the control. Named test PASS. |
| Git | 12 | Local isomorphic-git repositories with replaced HTTP request method | Memory Git fake with allowed-remote poison control | Force update is a no-op | Only `force-updates a ref to the requested commit` fails inside the control. Named test PASS. |

The six participant files passed together. Each of the three named negative-control tests also passed alone.

## Hermeticity

| Boundary | Evidence | Status |
| --- | --- | --- |
| Network | Adapter suites passed in the restricted sandbox. Git replaces `http.request`. Device flow replaces `globalThis.fetch`. Fake URLs use `.invalid`. | ✓ HERMETIC |
| Credentials and processes | Credential tests inject `CredentialSpawn`. The process fake checks command, arguments, environment, and pipe settings. | ✓ HERMETIC |
| Time | Credential timeout cases use `t.mock.timers`. Device flow injects waits or uses case timers. | ✓ HERMETIC |
| Filesystem | Temporary directories use `t.after()` or `finally`. Git support requires `boundary: "local"`. | ✓ HERMETIC |
| Environment | Pi API and Git debug tests save and restore prior environment values through the test context. | ✓ HERMETIC |
| Production surface | The three modified sources add or keep production dependency seams. No export exists only to read or reset test state. | ✓ VERIFIED |

## Data-Flow Trace

Not applicable. Phase 108 contains domain values, adapters, and tests. It does not render dynamic user-interface data.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Every Phase 108 owner has complete direct coverage | 23 focused `node scripts/test-coverage-direct.mjs <source>` commands | 23/23 pass | PASS |
| All adapter participants run | `node --test` with the six production/fake participant files | 6/6 files pass | PASS |
| Device-flow planted defect discriminates one case | Single named `--test-name-pattern` run | 1 pass | PASS |
| Credential planted defect discriminates one case | Single named `--test-name-pattern` run | 1 pass | PASS |
| Git planted defect discriminates one case | Single named `--test-name-pattern` run | 1 pass | PASS |
| Resolver type discrimination compiles | `npm run typecheck` | Exit 0 | PASS |
| Correspondence negatives fail closed | `node scripts/check-corresponding-tests.negative.mjs` | Controls passed | PASS |
| Phase correspondence is clean | Filtered `checkCorrespondingTests()` result | 0 Phase 108 violations. 98 future brownfield violations remain. | PASS |
| Lowercase phase syntax | AST and source scan across 23 owners and three fake tests | 367 case definitions. 10 data-row combined-marker violations. | FAIL |
| Deleted helper references are zero | Repository source/reference scan | 4 stale comment references | FAIL |

The merged gate evidence supplied to the verifier records 3,947 unit passes, one intentional skip, and 21/21 integration passes. The focused checks above provide independent Phase 108 evidence.

## Probe Execution

No shell probe path appears in a Phase 108 plan or summary. No conventional `scripts/**/tests/probe-*.sh` file exists.

The Pi API probe functions run through `tests/platform/pi-api.test.ts`. That owner passed with 12/12 branches, 5/5 functions, and 163/163 lines.

## Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MOD-01 | All 23 plans | All 23 domain and platform pairs complete the pair contract. | ✗ BLOCKED | Pair mapping and coverage pass, but P108-10, P108-16, P108-19, and P108-23 each have one failed compliance truth. |
| RES-01 | 108-06, 108-18, 108-19 | Resolver results expose literal materializability and preserve three states. | ✓ SATISFIED | Runtime schemas, constructors, gates, 19 fixtures, type narrowing, and direct coverage pass. |
| PRES-03 | 108-12, 108-21, 108-22 | Production and fake adapters pass the same public cases. | ✓ SATISFIED | All three participant pairs run the same registrar. |
| PRES-04 | 108-12, 108-21, 108-22 | Each adapter contract has an independent negative control. | ✓ SATISFIED | Each broken implementation fails exactly its named case inside a passing control test. |

There are no orphan Phase 108 requirements. The plan requirement union equals the roadmap requirement set.

## Decision Coverage

`check.decision-coverage-verify` reports 20/20 CONTEXT decisions honored. It reports no unhonored decision.

This gate is advisory. The direct source scan found the stricter data-row and stale-reference gaps that the text heuristic did not find.

## Test Quality Audit

| Test group | Linked requirement | Disabled | Circular fixture generation | Strongest assertion | Verdict |
| --- | --- | ---: | ---: | --- | --- |
| 23 owner tests | MOD-01, RES-01, PRES-03, PRES-04 | 0 | 0 | Value and behavioral | Strong, with the phase-layout gap noted above |
| Three fake participant tests | PRES-03, PRES-04 | 0 | 0 | Behavioral | PASS |
| Three shared contracts | PRES-03 | 0 | 0 | Value and behavioral | PASS |

Expected values use literals or independent fixtures. The broken controls compare the collected failed case names with independent literal arrays.

No requirement depends on a disabled test. No test fixture writer imports the system under test and writes expected output.

## Prohibition Checks

The 23 plans contain 32 legacy string-form prohibitions. All 32 negative checks pass.

Notable results include no coverage ignores, no live service access, no developer credential access, no false-arm `pluginRoot`, and no resolver proxy owner.

The helper-reference failure is a positive Plan 108-23 truth. It is not one of the legacy prohibition entries.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | ---: | --- | --- | --- |
| `tests/domain/components/mcp.test.ts` | 75 | Combined phase marker in a data row | BLOCKER | Fails P108-10 phase-layout truth. |
| `tests/domain/name.test.ts` | 17, 98, 108, 144, 212, 323, 405 | Combined phase markers in data rows. Two use `assert.doesNotThrow()`. | BLOCKER | Fails P108-16 phase-layout truth. |
| `tests/domain/source.test.ts` | 655, 702 | Combined phase markers in data rows | BLOCKER | Fails P108-19 phase-layout truth. |
| `extensions/pi-claude-marketplace/domain/github-auth.ts` | 300 | Reference to deleted helper | BLOCKER | Fails P108-23 zero-reference truth. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | 162 | Reference to deleted helper | BLOCKER | Fails P108-23 zero-reference truth. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | 169, 192 | References to deleted helper | BLOCKER | Fails P108-23 zero-reference truth. |

No modified file contains an untracked `TBD`, `FIXME`, or `XXX` debt marker. Placeholder matches in supporting suites describe tested placeholder behavior, not stubs.

## Human Verification Required

N/A. This is an infrastructure and test-foundation phase. All acceptance behavior is programmatically observable.

There are no present-but-behavior-unverified truths.

## Deferred Item

Repository-wide lexical resolver-consumer migration remains future work. The Phase 108 plan records exact owner assignments:

- P113-24 owns `plugin-state-classifier.ts`.
- P114-07/08/09/10/11/12/14 own the lifecycle consumers.
- P115-06/07 own reconcile backfill and notifications.

This deferred item does not hide a Phase 108 implementation gap. The `ResolvedPlugin` public contract and resolver-owned gates already satisfy RES-01.

## Gaps Summary

Phase 108 does not achieve its full goal because four plan truths fail:

1. P108-10, P108-16, and P108-19 contain ten data-row test definitions with a forbidden combined phase marker.
2. P108-23 leaves four references to helper paths that no longer exist.

All 23 owner mappings, all 23 direct-coverage records, the resolver public union, adapter parity, broken controls, and hermetic boundaries otherwise pass.

---

_Verified: 2026-08-29T15:00:11Z_
_Verifier: the agent (gsd-verifier)_
