---
phase: 110
slug: persistence-and-transaction
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-30
---

# Phase 110 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary                                              | Description                                                                                                   | Data Crossing                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Untrusted persistence bytes → validated domain values | Agents index, config, and state loaders parse and validate external JSON before use.                          | User-controlled JSON, schema versions, stored source records         |
| Scope roots → derived filesystem paths                | Scoped location factories and persistence writers enforce safe names and path containment.                    | User/project roots, environment overrides, target paths              |
| In-memory mutations → durable files                   | Validated atomic writers, migration replay, and config batching control replacement of persistent state.      | Config/state objects, normalized migration results, exact JSON bytes |
| Concurrent callers → state transaction                | Scope locks serialize state callbacks, save attempts, and release behavior.                                   | Lock ownership, callback results, durable state                      |
| Forward phases → compensation and error reporting     | The transaction ledger and rollback formatter preserve deterministic order, causes, and containment failures. | Mutable transaction context, rollback partials, errors, leaks        |

---

## Threat Register

| Threat ID   | Category               | Component                             | Severity | Disposition | Mitigation                                                                                           | Status |
| ----------- | ---------------------- | ------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------- | ------ |
| T-110-01-01 | Tampering              | `loadAgentsIndex`                     | high     | mitigate    | Parse/envelope failures and isolated row validation are pinned in `agents-index-io.test.ts`.         | closed |
| T-110-01-02 | Denial of service      | `saveAgentsIndex`                     | medium   | mitigate    | Validation precedes sanctioned atomic replacement; refusal preserves existing bytes.                 | closed |
| T-110-02-01 | Tampering              | `AGENTS_INDEX_VALIDATOR`              | high     | mitigate    | Exact version, envelope, cardinality, required fields, and optional types are independently tested.  | closed |
| T-110-02-02 | Denial of service      | `AGENTS_INDEX_ENTRY_VALIDATOR`        | low      | accept      | Validator compilation remains module-scoped and bounded literal rejection adds no processing path.   | closed |
| T-110-03-01 | Tampering              | `loadConfig` / `CONFIG_VALIDATOR`     | high     | mitigate    | Parse, root-schema, version, empty-detail, and lenient unknown-field boundaries are pinned.          | closed |
| T-110-03-02 | Elevation of privilege | `saveConfig` containment              | high     | mitigate    | Validation and `assertPathInside` run before atomic replacement; refusal preserves bytes.            | closed |
| T-110-04-01 | Tampering              | `mergeScopeConfigs`                   | high     | mitigate    | Whole-entry replacement, provenance, dangling rows, and stable ordering are asserted.                | closed |
| T-110-04-02 | Repudiation            | `loadMergedScopeConfig`               | medium   | mitigate    | Exact per-file load outcomes remain visible beside the complete merged result.                       | closed |
| T-110-05-01 | Tampering              | Cascade and batch patching            | high     | mitigate    | Matching/adjacent keys, omitted maps, create/delete, and complete saved documents are pinned.        | closed |
| T-110-05-02 | Denial of service      | Repeated physical writes              | medium   | mitigate    | Every public operation produces one complete atomic target document through `saveConfig`.            | closed |
| T-110-06-01 | Elevation of privilege | Derived path methods                  | high     | mitigate    | Every derived path has exact containment and unsafe-name/separator rejection evidence.               | closed |
| T-110-06-02 | Tampering              | `PI_CODING_AGENT_DIR` scope selection | medium   | mitigate    | Tests register cleanup before mutation and restore the exact prior environment state.                | closed |
| T-110-07-01 | Tampering              | `buildConfigFromState`                | high     | mitigate    | Complete projections cover every entry plus unknown-object and nullish source boundaries.            | closed |
| T-110-07-02 | Repudiation            | `migrateFirstRunConfig` replay        | medium   | mitigate    | Result arms, failures, exact bytes, and second-call no-op metadata are pinned.                       | closed |
| T-110-08-01 | Tampering              | `migrateLegacyMarketplaceRecords`     | high     | mitigate    | Invalid root/map/row categories, object-only results, and normalized output are exhaustive.          | closed |
| T-110-08-02 | Repudiation            | `persistMigratedState`                | medium   | mitigate    | Persistence failure retains in-memory state, reports exact cause/path, and preserves disk effects.   | closed |
| T-110-09-01 | Tampering              | `loadState` validation/source funnel  | high     | mitigate    | Parse/schema/source variants, post-normalization validation, and complete errors are pinned.         | closed |
| T-110-09-02 | Denial of service      | Migration persistence watcher         | medium   | mitigate    | Case-local abortable watchers have exact cleanup, no polling, and replay no-op evidence.             | closed |
| T-110-09-03 | Tampering              | `saveState` atomic write              | high     | mitigate    | Validation precedes exact atomic bytes; invalid state leaves prior disk bytes unchanged.             | closed |
| T-110-10-01 | Tampering              | `runPhases` compensation order        | high     | mitigate    | All six forward positions prove own-first/newest-first logs and final context.                       | closed |
| T-110-10-02 | Repudiation            | Rollback partial/cause reporting      | high     | mitigate    | Structured partials, cause identity, leaks, order, and containment propagation are pinned.           | closed |
| T-110-11-01 | Repudiation            | `formatRollbackError`                 | high     | mitigate    | Original identity, causes, raw partials, duplicate rows, leak fields, and order are asserted.        | closed |
| T-110-11-02 | Tampering              | Containment-error bypass              | high     | mitigate    | Path-containment and symlink-refusal errors bypass wrapping by exact identity.                       | closed |
| T-110-12-01 | Tampering              | `withScopeLock` contention            | high     | mitigate    | A controlled real contender proves non-overlap, release, and successful retry.                       | closed |
| T-110-12-02 | Denial of service      | Acquisition/release lifecycle         | high     | mitigate    | Error and non-Error acquisition/release failures retain complete cleanup evidence.                   | closed |
| T-110-12-03 | Tampering              | Explicit state-save lifecycle         | high     | mitigate    | Load/save failures, duplicate save, retained bytes, final state, and retry are independently pinned. | closed |

_Status: open · closed · open — below high threshold (non-blocking)_

_Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`._

_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)._

---

## Accepted Risks Log

| Risk ID   | Threat Ref  | Rationale                                                                                                                | Accepted By                 | Date       |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ---------- |
| AR-110-01 | T-110-02-02 | Module-scoped validator compilation is unchanged; bounded invalid-case tests introduce no new unbounded processing path. | Phase 110 planning decision | 2026-08-30 |

_Accepted risks do not resurface in future audit runs._

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By              |
| ---------- | ------------- | ------ | ---- | ------------------- |
| 2026-08-30 | 26            | 26     | 0    | Codex / GSD ASVS L1 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-30
