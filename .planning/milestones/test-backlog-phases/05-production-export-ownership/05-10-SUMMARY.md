---
phase: 05-production-export-ownership
plan: "10"
subsystem: domain-resolution
tags: [export-ownership, resolver, type-contracts, drift-proofs]
status: complete
requires:
  - phase: 05-production-export-ownership
    plan: "08"
    provides: Live strict MCP materialization ownership and obsolete bridge parser retirement
provides:
  - Retirement of the unreachable loose resolver and its exclusive MCP and path collectors
  - Public provider and component classification assertions
  - Type-only canonical resolver schema with unchanged public contracts and consumed drift proofs
affects: [05-production-export-ownership]
tech-stack:
  added: []
  patterns: [private-schema-types, public-contract-assertions, isolated-drift-controls]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - tests/domain/plugin-resolver.test.ts
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - tests/domain/mcp-resolution.test.ts
    - extensions/pi-claude-marketplace/domain/auth-registry.ts
    - tests/domain/auth-registry.test.ts
    - extensions/pi-claude-marketplace/domain/unsupported-components.ts
    - tests/domain/unsupported-components.test.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - tests/domain/resolver-types.test.ts
    - extensions/pi-claude-marketplace/domain/component-paths.ts
    - tests/domain/component-paths.test.ts
    - tests/architecture/hooks-foundation.test.ts
    - eslint.config.js
    - tests/architecture/sonar-test-rules.test.ts
key-decisions:
  - Retire only loose-specific conflict behavior; retain shared validation, metadata, materializability and ordering assertions through strict resolution.
  - Represent the unconsumed runtime resolver schemas as private TypeBox types and prove all nine public contracts exactly equivalent.
  - Replace three old proof annotations with one calibrated adjacent private-schema annotation on the existing public union.
  - Retire the unconsumed supported-kind tuple and preserve real supported and unsupported component behavior through public owners.
completed: 2026-09-14
plan_head_before: 80705c58c34f10fb810276669fc9ae8d9915aba0
actuals:
  tasks: 5
  commits: 1
---

# Phase 5 Plan 10: Production-owned resolver contracts summary

The unreachable loose resolver and its exclusive collectors are retired. Shared behavior remains covered through strict resolution, and the resolver's canonical schema is now type-only with all nine public type contracts preserved exactly.

## Completion and coordination

The five amended tasks are implemented: this executor owns thirteen source/test files, and the parent owns the two-file Sonar policy task. The plan's estimate.tasks is corrected to five. Preparation stayed entirely under `/tmp` until the parent authorized execution after Wave 2 commits `080d395e` and `80705c58`. Before applying, all thirteen executor-owned baseline SHA-256 hashes matched; afterward all thirteen prepared hashes matched. CodeGraph caller revalidation is recorded in `/tmp/phase5-10-execution-codegraph.txt`.

Source writes are frozen for review. This executor created no commits and changed no shared configuration, census pin, root planning, or unrelated source. The parent owns the exact Sonar type-only-owner exception and its independent control inventory, stable-wave census, aggregate coverage, precommit, commits, and root planning updates. This summary remains pending verification until those gates finish.

## Caller and implementation evidence

- `resolveLoose` had no production caller. `resolveLooseMcp` and `collectLooseComponentPaths` had only that production caller; their same-module helpers and loose-only branches retire with them.
- Strict component, MCP, and hook resolution still runs in the same order. The now-unnecessary `ResolveMode` driver and callback interface are removed; the strict public operation calls its existing stages directly. Structural defects still outrank unsupported-kind degradation.
- The MCP `detail=false` option was used only by loose resolution. That short-note branch retires; every strict detailed malformed note remains unchanged.
- `GITLAB_PROVIDER` stays registered in the private provider list and is observed through `findProviderForHost`. GitHub's legitimately consumed export remains public.
- `SUPPORTED_COMPONENT_KINDS` had no production reader and is retired. `UNSUPPORTED_COMPONENT_KINDS` stays private and drives the real ordered classifier. Actual supported kinds remain covered through strict resolution.
- The runtime resolver schema had no production validation or runtime consumer. Its private TypeBox shape now exists only at the type level; the public union and arm contracts remain derived from that same shape. No new production caller, runtime test seam, or exported schema alias was introduced.

## Assertion ledger

The exact original loose-case titles and dispositions are preserved in `/tmp/phase5-10-prepared/assertion-ledger.json`: twenty-eight test declarations, including the convention loop; twenty-two migrate with their existing assertions and six exclusive contracts retire.

| Original contract | Final disposition and assertion |
| --- | --- |
| Declared skills, skills/commands happy path, and multi-element path order/dedup | Same materializability, complete component arrays, supported-kind, and order assertions now call `resolveStrict`. |
| Manifest-only defaultEnabled without conflict; entry false/manifest true; entry true/manifest false; neither declared; manifest fallback; partial arm with manifest fallback | Every existing value, result and gate assertion remains, now through strict resolution. No shared metadata case is deleted. |
| Valid and malformed inline MCP | Same resolver result and notes assertions remain through `resolveStrict`. Existing strict MCP owner cases additionally pin complete detailed malformed notes and complete output maps. |
| Unsupported entry kind and every filesystem convention row | Same state and exact contains-kind assertions now call strict resolution. |
| Bin directory admission and dependency note | Same installable and note assertions remain through strict resolution. |
| Valid, malformed and absent hook configuration | Same state, supported-kind, absence and error-note assertions remain through strict resolution. |
| Partial gate admits installable, admits unsupported, rejects unavailable | Same gate and root/error assertions remain; results now come from strict resolution. Existing stronger typed error-carrier cases remain unchanged. |
| Parallel strict/loose independence | Two strict calls with separate contexts retain independent ordered component-path results and materializability assertions. |
| Loose MCP inline map without filesystem access | Migrated to `resolveStrictMcp`; both filesystem boundaries reject unexpected access. Exact dirty flag and whole mutated resolution remain. |
| Fully absent loose MCP | Migrated to strict MCP with absent files; exact false dirty flag, empty notes and empty map remain. |
| Loose MCP manifest/standalone conflicts and string reference refusal | These exclusive obsolete errors retire. Existing strict manifest, standalone and reference cases retain their complete live success/failure results. |
| Loose malformed MCP's exact detail-free note | Only the unreachable short-note contract retires. Existing strict malformed cases retain complete detailed notes and empty maps. |
| Loose component entry dedup and absent/null values | Migrated to `collectStrictComponentPaths` with no matching convention; exact dirty flags and whole ordered resolution objects remain. |
| Loose component manifest-only conflict | Exclusive conflict error retires with its implementation. All existing strict declaration union, containment, malformed-path and propagation cases remain unchanged. |
| Loose hook-only architecture fixture | Subsumed by the strict fixture, strengthened to the complete resolved object: exact discriminants, root, hooks support, empty unsupported/notes, component paths, MCP map, hook config path and defaultEnabled. The unavailable-root negative type proof remains. |
| GitLab complete descriptor | Lookup through `findProviderForHost` preserves exact id, hostname result, device/token URLs, client id, scope and token credential mapping. |
| GitLab private constant identity | Direct private binding identity retires; the complete public lookup descriptor remains. GitHub identity, all hostile hostnames and both cross-provider predicate refusals remain. |
| Supported/unsupported tuple exports | The unused supported tuple's representation assertion retires; strict owners retain actual supported behavior. Unsupported tuple representation is observed through the existing complete eight-kind ordered classifier result. Every convention, declaration and default-enabled predicate case remains. |
| Six runtime schema Check results | Three accepted arm objects and the accepted extra-property structural assignment become public `satisfies` proofs. Unknown state and inconsistent state/installable values become exact negative compile controls. There is no remaining runtime validation consumer to test. |
| Original resolver type proofs | Exact discriminants, successful narrowing, unavailable root/defaultEnabled refusals, partial materializability and collaborator contracts remain. Direct proof imports become independent public droppedHooks shape checks; the private arm/key guards are consumed by that field's actual schema. |

### Six exclusive resolver cases retired

1. Manifest-only skills declaration conflicts with a silent loose entry.
2. Loose resolution ignores an existing implicit skills directory.
3. Manifest-only MCP declaration conflicts with a silent loose entry.
4. Standalone MCP declaration conflicts with a silent loose entry.
5. Loose resolution refuses an MCP string reference as unsupported.
6. Loose MCP conflict plus unsupported themes selects structural failure.

Only those mode-specific contracts retire. All existing strict convention, reference, union and structural precedence cases remain, and every shared loose-case assertion listed above moves to the real strict path.

## Exact type and drift evidence

Preparation compiled bidirectional exact equality checks against a temporary copy of the original schema implementation for all nine original public contracts:

`ResolvedPlugin`, `ResolvedPluginInstallable`, `ResolvedPluginPartiallyAvailable`, `ResolvedPluginUnavailable`, `MaterializablePlugin`, `ResolveContext`, `StatKind`, `StatKindReader`, and `GitPluginRootResult`.

All nine passed, including after the final mapped-property correction required by TypeBox's property-record constraint. The temporary comparison source was not added to production or the repository. Evidence: `/tmp/phase5-10-type-equivalence-reviewed.log`.

Private `DroppedHookDriftCheck` and `DroppedHookArmKeysCheck` are consumed in the actual droppedHooks schema field. Arm compatibility, reverse arm membership and per-arm key equality remain enforced. Isolated controls against the prepared schema and real imported hook/source contracts produced:

| Compiler control | Exit | Result |
| --- | --- | --- |
| Unchanged schema and hook contract | 0 | Compiles |
| Added DroppedHook arm | 2 | TS2344 at arm guard |
| Added required event-arm field | 2 | TS2344 at key guard |
| Added schema-only arm | 2 | TS2344 at reverse arm guard |

Logs: `/tmp/phase5-10-drift-{benign,added-arm,extra-field,added-schema-arm}.log`. The reviewed implementation was applied byte-for-byte, so unchanged temporary probes were not rerun during execution.

## Calibrated private-schema annotation

The parent reviewed and accepted one adjacent `private-type-leak` annotation on `ResolvedPlugin`'s private schema reference, replacing three former proof annotations. Fallow's rule remains enabled. This retains one canonical structural schema and the guards that protect its dropped-hook field without exposing schema internals as a public API.

| Analyzer control | Exit | Complete findings |
| --- | --- | --- |
| Prepared schema without annotation | 1 | ResolvedPlugin → ResolvedPluginSchema |
| Exact adjacent annotation | 0 | None |
| Annotation plus unrelated sibling | 1 | ForeignPublic → ForeignPrivate only |
| Outer union inlined | 1 | Three leaks, one for each private arm schema |

Each isolated report has one discovered entry, valid JSON, separate stdout/stderr files and empty stderr. Logs: `/tmp/phase5-10-schema-analyzer-{unsuppressed,scoped,sibling,inline-union}.json`.

Inlining only the union moves the findings to the three arm schemas. Full recursive inlining would duplicate the common materializable and dropped-hook definitions needed by the independent parity checks, or disconnect those checks from the actual field. The exact local annotation preserves coherent ownership. An ambient declaration alternative also preserved types but failed the unused-value lint rule; no unused ambient values or lint suppression for them remain.

## Finding dispositions for parent reconciliation

Exactly seven initial identities are expected to disappear:

```text
unused_exports|extensions/pi-claude-marketplace/domain/auth-registry.ts|GITLAB_PROVIDER
unused_exports|extensions/pi-claude-marketplace/domain/plugin-resolver.ts|resolveLoose
unused_exports|extensions/pi-claude-marketplace/domain/resolver-types.ts|ResolvedPluginSchema
unused_exports|extensions/pi-claude-marketplace/domain/unsupported-components.ts|SUPPORTED_COMPONENT_KINDS
unused_exports|extensions/pi-claude-marketplace/domain/unsupported-components.ts|UNSUPPORTED_COMPONENT_KINDS
unused_types|extensions/pi-claude-marketplace/domain/resolver-types.ts|DroppedHookDriftCheck
unused_types|extensions/pi-claude-marketplace/domain/resolver-types.ts|DroppedHookArmKeysCheck
```

The loose MCP and component collectors were reachable through the dead resolver at baseline. Their retirement prevents new orphan findings rather than removing extra initial identities. The parent owns the stable-wave census and exact pin reconciliation; this executor ran no full-tree census.

## Real-checkout verification

- `node --test tests/domain/plugin-resolver.test.ts tests/domain/mcp-resolution.test.ts tests/domain/auth-registry.test.ts tests/domain/unsupported-components.test.ts tests/domain/component-paths.test.ts tests/domain/resolver-types.test.ts tests/architecture/hooks-foundation.test.ts`: **198/198 passed**, zero failed, cancelled, skipped or todo. This includes the type-only owner file's native Node discovery. Log: `/tmp/phase5-10-focused.log`.
- Direct checks ran separately with `node scripts/test-coverage-direct.mjs <source>` outside the sandbox:

| Domain source | Lines | Functions | Branches |
| --- | --- | --- | --- |
| plugin-resolver.ts | 630/630 | 23/23 | 108/108 |
| mcp-resolution.ts | 144/144 | 6/6 | 45/45 |
| auth-registry.ts | 107/107 | 6/6 | 7/7 |
| unsupported-components.ts | 144/144 | 6/6 | 28/28 |
| component-paths.ts | 183/183 | 7/7 | 47/47 |
| resolver-types.ts | type-only | type-only | type-only |

All six direct commands exited zero. Logs: `/tmp/phase5-10-direct-<owner>.log`. The unchanged direct instrument classifies the resolver schema by its genuinely empty runtime emit; no direct coverage exception was added.

- Real-checkout strict typecheck passed with no diagnostics, exit zero: `/tmp/phase5-10-typecheck.log`.
- Scoped ESLint passed for all thirteen executor-owned files with the repository configuration and no command-line rule overrides, exit zero: `/tmp/phase5-10-eslint.log`.
- The parent added `tests/domain/resolver-types.test.ts` as the ninth exact type-only-owner Sonar exception in `eslint.config.js` and its independent inventory in `tests/architecture/sonar-test-rules.test.ts`. The parent's fifteen-control verification was running at handoff; its final result remains parent coordinated.
- `git diff --check` passed after applying the reviewed patch. Temporary formatting used the repository's exact Prettier and EditorConfig settings.
- Full aggregate coverage, complete census, precommit and commits remain parent coordinated.

## Deviations from plan

**Exclusive component dependency added.** Caller revalidation proved that removing `resolveLoose` would orphan the loose path collector. The parent approved its source/owner pair as a bounded fourth task. Complete shared assertions moved to the strict collector; only its exclusive conflict error retired.

**Runtime schema retired as type-only.** No real runtime consumer existed. The parent accepted the exact type-equivalence, compiler drift and analyzer controls before authorizing the pure type representation and adjacent schema annotation. The parent separately owns the ninth exact Sonar type-only-owner entry and its independent control inventory.

**Parent-owned policy task added.** The exact Sonar exception and independent control inventory are recorded as a fifth bounded two-file task. The parent implemented those two files; this executor only amended the plan and summary. All other assertion rules and ordinary runtime-owner refusals remain enforced.

**Unused supported tuple retired.** It had no real reader, so keeping a private unused constant would not establish ownership. Public strict component results retain the behavior.

**Nonexistent gate obligation removed.** `closed-set-enrollment.test.ts` contains no resolver schema scan; its unrelated enrollment checks remain unchanged. The actual resolver owner carries the public type proofs. The final scope is thirteen executor-owned source/test files plus the parent's two policy/control files, each task at most five files; no pending plan owns the added collector files.

## Self-Check: PASSED

All thirteen executor-owned source/test files, both parent-owned policy/control files and the amended plan exist. Executor-applied hashes match the reviewed preparation. The focused suite, six direct owners, strict typecheck and scoped lint pass. No stub, skipped test, fake runtime assertion, added dependency, coverage exclusion, threshold reduction, new trust boundary or manufactured production caller was introduced. All executor writes are stopped; parent integration and commits remain explicit pending work.


## Final parent acceptance

Completed in `6a463603` with the five-plan stable wave. Earlier pending statements record executor handoff and are superseded by this acceptance. All 6,238 unit tests pass; each of 225 emitted production modules retains exact 100% coverage, totaling 62,680/62,680 lines, 1,835/1,835 functions and 9,065/9,065 branches. All 234 direct pairs pass, including nine type-only owners and the two unchanged existing pins. The complete census moves from 85 to 57 through exactly 28 reviewed removals, with zero additions; all 43 analyzer/census controls and fifteen Sonar controls pass. Independent review reports zero findings across the 56-file scope. Full mandatory pre-commit passes. See [wave verification](05-WAVE-3-VERIFICATION.md) for evidence and limits. Remaining export plans keep EXPORT-01 and EXPORT-02 open.
