# Phase 8: Atomic Reinstall Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 8-Atomic Reinstall Core
**Areas discussed:** Absent / invalid target outcomes, Rollback and manual recovery semantics, State-lock boundary and transaction shape, Plugin data directory after success, Agent foreign-content behavior

---

## Absent / Invalid Target Outcomes

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Lenient installed-only | If the plugin is not installed, return a clean skipped/not-installed outcome with no disk mutation. If installed but cached manifest entry is missing/invalid/no longer installable, treat as failure and preserve old install. | ✓ |
| Direct-target strict | If `reinstall foo@bar` targets a plugin that is not installed, treat as an error. Batch forms still skip absent plugins. | |
| Everything skipped | Missing installed record, missing manifest entry, or no-longer-installable all become skipped outcomes, never errors, as long as old install is preserved. | |

**User's choice:** Lenient installed-only.
**Notes:** The user selected option 1. This locks absent installed records as non-mutating skipped/not-installed outcomes, while installed records with broken cached manifest/restage inputs are failures that preserve the old install.

---

## Rollback and Manual Recovery Semantics

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Use existing manual-recovery marker style | Surface an error with `MANUAL RECOVERY REQUIRED:` plus exact failed rollback phases/paths. Preserve old `state.json` if possible; tell user what resources may need manual cleanup/restore. | ✓ |
| Add a reinstall-specific recovery marker | Create a new stable marker like `REINSTALL ROLLBACK FAILED:` specifically for this command. | |
| Best-effort warning only | Treat rollback cleanup failures as warnings, not operation errors, as long as state remains old. | |

**User's choice:** Use existing manual-recovery marker style.
**Notes:** No new reinstall-specific stable marker unless planning discovers the existing manual-recovery discipline cannot carry the needed detail.

---

## State-Lock Boundary and Transaction Shape

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Hold per-scope lock across the whole reinstall transaction | Lock, load fresh state, validate installed record, prepare replacements, perform backup-backed physical replacement, save state, rollback physical replacement if save fails, unlock. | ✓ |
| Prepare outside lock, mutate inside lock with stale checks | Shorter lock window, but prepared resources can become stale and must be revalidated before replacement. | |
| Use existing `withStateGuard` only | Simpler, but likely insufficient because it auto-saves after callback and does not let reinstall rollback physical swaps on `saveState` failure. | |

**User's choice:** Hold per-scope lock across the whole reinstall transaction.
**Notes:** This implies a lock/manual-save helper or equivalent, not direct reuse of existing auto-save-only `withStateGuard` for the whole operation.

---

## Plugin Data Directory After Success

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Delete and leave absent | Reinstall is a reset: remove `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>/` after successful replacement. Future plugin code can recreate it if needed. | ✓ |
| Delete then recreate empty directory | Preserves install's data-dir-exists ergonomics, but weakens the meaning of deleting plugin data and adds another post-success warning/failure point. | |
| Agent discretion | Record only the ordering requirement; planner decides whether to recreate based on existing install semantics. | |

**User's choice:** Delete and leave absent.
**Notes:** The plugin data dir must survive failed reinstall attempts and is only deleted after replacement and state commit both succeed.

---

## Agent Foreign-Content Behavior

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Hard-block reinstall | Treat foreign previous agent content as a reinstall failure before replacement. Preserve old state/resources/data; user must resolve the foreign file manually. | ✓ |
| Preserve foreign rows and continue | Do not overwrite/delete the foreign target, keep the index row, and reinstall the rest. | |
| Warning but replace safe resources only | Reinstall non-agent resources, skip the problematic agent, and warn. This can leave a partial restage but still installed. | |
| Hard-block by default, but allow `--force` | Default hard-blocks on foreign/manual agent content. With `--force`, replacement may overwrite target-plugin-owned previous foreign agent targets while preserving rollback guarantees. | ✓ |

**User's choice:** Hard-block by default, unless `--force` is passed.
**Notes:** The assistant initially treated `--force` as a deferred idea because it adds command capability. The user explicitly corrected this: "no, add --force to the scope here." CONTEXT.md therefore records `force` as in-scope for the reinstall feature. The force override is limited to the target plugin's own previous agents-index rows and does not bypass cross-plugin ownership conflicts, path safety, unsafe names, or MCP collision rules.

---

## the agent's Discretion

- Exact TypeScript naming for new core result/input types, lock/manual-save helper, and bridge replacement handles.
- Exact backup directory naming and cleanup implementation.
- Exact warning text for post-success data-dir cleanup failures, as long as warning severity and notify-channel discipline are preserved.

## Deferred Ideas

- JSON output for reinstall results.
- Dry-run/preview mode.
- Interactive plugin selector.
- Mutating LLM tool for reinstall.
- Parallel/bulk reinstall execution beyond Phase 8's single-plugin atomic core.
