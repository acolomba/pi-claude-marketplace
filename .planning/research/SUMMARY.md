# Research Summary: pi-claude-marketplace v1.1 Reinstall Command

**Domain:** Pi extension plugin lifecycle management
**Researched:** 2026-05-13
**Overall confidence:** HIGH

## Executive Summary

The v1.1 `reinstall` feature should be implemented as a dedicated plugin lifecycle path, not as a composition of `uninstall` and `install` and not as a thin wrapper around `update`. `uninstall` intentionally removes resources/state before cleanup, and `install` refuses already-installed records; composing them would violate the core milestone requirement that a failed reinstall must not leave the plugin absent. Existing `update` has useful target enumeration, scope resolution, staging, and presentation patterns, but its state-first physical replacement/recovery model is weaker than reinstall's required preservation contract.

No new dependencies or stack changes are needed. The current TypeScript/ESM stack, `proper-lockfile`-backed state lock, atomic JSON writers, bridge staging APIs, and reload/soft-dependency presentation helpers are sufficient. The main implementation work is a replacement-safe transaction shape: prepare new bridge resources first, replace old resources using backup/restore-capable bridge helpers, save state atomically, rollback physical replacements if state save fails, and delete plugin data only after success.

The safest roadmap is two phases: first land the atomic replacement primitives and single-plugin orchestrator semantics, then wire user-facing edge surfaces, batch target forms, completions, docs, and validation. The critical pitfall is underestimating multi-file atomicity: there is no portable Node API for a true all-or-nothing swap across skills, commands, agents, MCP, agents-index, and state. The implementation must therefore define and test a fail-clean rollback contract, with manual-recovery surfacing only if rollback itself fails.

## Key Findings

**Stack:** No new runtime dependency, peer dependency, or version bump is required. Reuse existing TypeScript strict mode, `proper-lockfile`, `write-file-atomic`, bridge staging modules, and node:test suite. `isomorphic-git` must not be used by reinstall.

**Features:** Table stakes are: top-level `/claude:plugin reinstall`, three update-analogous target forms (`plugin@marketplace`, `@marketplace`, bare), `--scope` anywhere, installed-only behavior, cached manifest reads only, recorded-version preservation, per-plugin atomic replacement, post-success data cleanup, refresh reload hints, soft-dependency warnings, and installed-plugin completions.

**Architecture:** Add a dedicated `orchestrators/plugin/reinstall.ts`, a small lock/manual-save transaction helper or equivalent lock-held flow, and bridge-level backup/restore replacement helpers for skills, commands, agents, and MCP. Wire `edge/handlers/plugin/reinstall.ts`, router/register, completions provider/data, docs, and tests. Reinstall should reuse update's target enumeration and scope resolution but not update's sync/version-bump behavior.

**Critical pitfall:** Existing bridge commit helpers can remove previous resources before staged replacements are fully committed. Reinstall must not call them in a way that can strand the old plugin absent; use backup-capable replacement or another proven preservation mechanism.

## Implications for Roadmap

Suggested phase structure:

1. **Phase 8: Atomic Reinstall Core** - establish the transaction/bridge/orchestrator contract that makes single-plugin reinstall preserve old state/resources on failure.
   - Addresses: target plugin preflight, cached manifest reads, recorded-version preservation, backup/restore bridge replacement, state save rollback, post-success data cleanup, no-network architecture guard.
   - Avoids: unsafe uninstall+install composition, update's weaker recovery model, deleting data too early, recomputing versions.

2. **Phase 9: Reinstall Edge & Bulk UX** - expose the command and batch target forms through the Pi command surface with completions, output, docs, and e2e-style validation.
   - Addresses: router/register/handler wiring, `reinstall @marketplace` and bare `reinstall`, `--scope` parity, completion parity, reload/soft-dep messaging, README usage.
   - Avoids: edge/router omissions, ambiguous scope behavior, noisy or unstable batch output.

**Phase ordering rationale:** Atomic single-plugin semantics must come first because every batch form depends on per-plugin fail-clean behavior. Edge and completion work can safely follow once the core API and result model are stable.

**Research flags for phases:**
- Phase 8 should receive deeper phase planning attention for bridge backup/restore details and rollback-failure/manual-recovery semantics.
- Phase 9 follows existing update/edge patterns and likely does not need external research.

## Confidence Assessment

| Area | Confidence | Notes |
| ---- | ---------- | ----- |
| Stack | HIGH | Existing dependencies and primitives cover the feature; no new library is justified. |
| Features | HIGH | User clarified the key semantics; update provides direct UX precedent. |
| Architecture | MEDIUM-HIGH | Integration points are clear, but backup/restore details need careful plan-phase design. |
| Pitfalls | HIGH | Failure modes are directly evidenced by existing install/update/uninstall code and tests. |

## Gaps to Resolve During Requirements/Planning

- Whether batch reinstall should continue after per-plugin failure and render partitions like update. Research recommends yes: per-plugin atomic continuation with deterministic success/failure partitions.
- Exact direct-target behavior when the installed record exists but the cached manifest entry is missing or no longer installable. Research recommends direct target error and batch skipped/failed partition, always preserving old install.
- Exact manual-recovery marker/message if rollback of a physical replacement fails. Prefer existing marker constants and error-formatting discipline rather than new strings unless necessary.
- Whether successful reinstall should recreate an empty plugin data directory after deletion. Requirement only says delete after replacement; planning should decide based on current install/data semantics.

## Sources

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `README.md`
- `docs/prd/pi-claude-marketplace-prd.md`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- `extensions/pi-claude-marketplace/edge/router.ts`
- `extensions/pi-claude-marketplace/edge/register.ts`
- `extensions/pi-claude-marketplace/edge/completions/provider.ts`
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`
- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`
- `tests/orchestrators/plugin/update.test.ts`
- `tests/orchestrators/plugin/install.test.ts`
- `tests/orchestrators/plugin/uninstall.test.ts`
