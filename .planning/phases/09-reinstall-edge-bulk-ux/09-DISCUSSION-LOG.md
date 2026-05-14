# Phase 9: Reinstall Edge & Bulk UX - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md - this log preserves the analysis.

**Date:** 2026-05-14T01:42:31Z
**Phase:** 09-Reinstall Edge & Bulk UX
**Mode:** assumptions
**Areas analyzed:** Bulk orchestration shape, Notification and output aggregation, Scope and target semantics, Reload hints and soft-dependency warnings, Completion and docs, Force flag exposure

## Assumptions Presented

### Bulk orchestration shape

| Assumption | Confidence | Evidence |
| ---------- | ---------- | -------- |
| Add a bulk reinstall orchestrator above `reinstallPlugin`, rather than making edge loop directly. | Likely | `.planning/ROADMAP.md`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` |
| Edge handler should remain a thin parser/adapter modeled on update. | Likely | `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts`, `extensions/pi-claude-marketplace/edge/router.ts`, `extensions/pi-claude-marketplace/edge/register.ts` |
| Batch execution should prioritize sequential deterministic behavior over parallel throughput. | Likely | Phase 9 success criteria require deterministic partitions; Phase 8 guarantees are per-plugin. |

### Notification and output aggregation

| Assumption | Confidence | Evidence |
| ---------- | ---------- | -------- |
| Bulk reinstall needs a quiet/lower-level path or refactor because current `reinstallPlugin` emits notifications itself. | Likely | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` currently calls notify helpers after each single-plugin operation. |
| Batch output should render deterministic `Reinstalled`, `Skipped`, and `Failed` partitions. | Confident | `.planning/ROADMAP.md` PRL-13; update partition precedent in `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`. |
| Empty target sets should render `No plugins installed.` with no reload hint. | Confident | `.planning/REQUIREMENTS.md` PRL-06 and Phase 9 success criteria. |

### Scope and target semantics

| Assumption | Confidence | Evidence |
| ---------- | ---------- | -------- |
| Scope and target resolution should match update exactly, without copying update's network sync. | Confident | `.planning/ROADMAP.md` Phase 9 success criteria; `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`; Phase 8 no-network guard. |
| Reinstall remains installed-only and never installs absent plugins. | Confident | `.planning/REQUIREMENTS.md` PRL-06 and out-of-scope table. |
| Scope model remains exactly `user` and `project`. | Confident | `.planning/PROJECT.md` constraints and project key decisions. |

### Reload hints and soft-dependency warnings

| Assumption | Confidence | Evidence |
| ---------- | ---------- | -------- |
| Reload hints should aggregate only successful `reinstalled` outcomes with `resourcesChanged === true`. | Confident | `extensions/pi-claude-marketplace/orchestrators/types.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`, `extensions/pi-claude-marketplace/presentation/reload-hint.ts`. |
| Soft-dependency warnings should aggregate only successful staged agents/MCP servers. | Confident | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`, `extensions/pi-claude-marketplace/presentation/soft-dep.ts`, `extensions/pi-claude-marketplace/platform/pi-api.ts`. |

### Completion and docs

| Assumption | Confidence | Evidence |
| ---------- | ---------- | -------- |
| Completion should treat `reinstall` like `update`: installed refs plus `@marketplace`. | Confident | `extensions/pi-claude-marketplace/edge/completions/provider.ts`, `extensions/pi-claude-marketplace/edge/completions/data.ts`, `.planning/research/FEATURES.md`. |
| README/user docs should cover syntax, no-network cached-manifest behavior, recorded-version preservation, and data reset. | Likely | `README.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`. |

### Force flag exposure

| Assumption | Confidence | Evidence |
| ---------- | ---------- | -------- |
| Expose `--force` in Phase 9 because Phase 8 added `force?: boolean` intentionally. | Likely | `.planning/phases/08-atomic-reinstall-core/08-CONTEXT.md` D-12/D-13; `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`. |
| Force must be narrow and reinstall-specific. | Confident | `.planning/phases/08-atomic-reinstall-core/08-CONTEXT.md` D-13/D-14. |

## Corrections Made

No corrections - all assumptions confirmed by the user selecting `Proceed`.

## External Research

No external research was needed. The implementation decisions are driven by roadmap requirements, Phase 8 context, and existing code patterns.
