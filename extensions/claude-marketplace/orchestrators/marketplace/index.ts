// orchestrators/marketplace/index.ts
//
// Barrel re-export for the marketplace orchestrators layer (Phase 4).
// Every Wave 2 orchestrator (add/remove/list/update/autoupdate) ships
// its own `.ts` file; this barrel exposes the cross-subcommand helpers
// from `shared.ts` plus the per-subcommand entry-points as they land.

export {
  DEFAULT_GIT_OPS,
  applyAutoupdateFlip,
  cascadeUnstagePlugin,
  formatErrorWithCauses,
  resolveScopeFromState,
} from "./shared.ts";

export type { AutoupdateFlipResult, GitOps, UnstageOutcome } from "./shared.ts";
