import type { Reason } from "./notify.ts";
import type { SoftDepStatus } from "../platform/pi-api.ts";

/**
 * shared/notify-reasons.ts -- the topic-grouped organization of the closed
 * reasons set (D-09). The byte-critical runtime tuple `REASONS` stays declared
 * in `notify.ts` as the SINGLE source of catalog truth (OUT-08: the 32-entry
 * membership AND order must stay byte-identical for catalog stability); this
 * module reorganizes that closed set into shared topic-grouped enums + a
 * structural completeness proof WITHOUT recomposing the `REASONS` tuple (which
 * would risk reordering). The topic groups below are typed views over the same
 * closed `Reason` literals, so a command module can reference an
 * intent-meaningful group (e.g. the failure-class reasons) instead of the flat
 * 32-entry set.
 *
 * Each group uses the `as const` tuple + `(typeof X)[number]` literal-union
 * idiom. Membership of every literal is checked at compile time against the
 * closed `Reason` set (each group's element type extends `Reason`), and the
 * `_ReasonsCoverageProof` at the bottom asserts the union of all groups + the
 * command-private reasons + the structural `"not added"` marker is EXACTLY the
 * closed set -- a literal added to `REASONS` without a home here, or a typo,
 * becomes a compile error.
 */

/**
 * D-09: idempotent / already-in-requested-state reasons. The resource already
 * matches the exact state the command requested. (These are also today's
 * benign-skip reasons; the benign-skip SET itself is a later-phase concern --
 * only the reason literals are grouped here.)
 */
export const IDEMPOTENT_REASONS = [
  "up-to-date",
  "already installed",
  "already autoupdate",
  "already no autoupdate",
  "already enabled",
  "already disabled",
] as const;
export type IdempotentReason = (typeof IDEMPOTENT_REASONS)[number];

const IDEMPOTENT_REASON_SET: ReadonlySet<Reason> = new Set(IDEMPOTENT_REASONS);

/**
 * SEV-01 / D-03: per-producer severity for a `skipped` row, classified from
 * the reasons the producer is about to stamp. A skip whose reasons are ALL
 * idempotent no-ops (the resource already matches the requested state) is
 * benign -> `info`; any non-idempotent reason -- or a missing/empty reason set
 * that cannot be PROVEN benign -- is actionable -> `warning`. This is the
 * producer-local replacement for the former centralized benign-reason lookup:
 * the command stamps its own desired-vs-actual judgment at the emit site.
 */
export function skipSeverity(reasons: readonly Reason[] | undefined): "info" | "warning" {
  return reasons !== undefined &&
    reasons.length > 0 &&
    reasons.every((r) => IDEMPOTENT_REASON_SET.has(r))
    ? "info"
    : "warning";
}

/**
 * SEV-01: per-producer severity for an otherwise-successful install/update row,
 * classified from the plugin's DECLARED soft-dep companions and the host's
 * companion-loaded probe. A declared `agents` kind requires `pi-subagents`; a
 * declared `mcp` kind requires `pi-mcp-adapter`. When a declared companion is
 * unloaded the clean operation is silently degraded -> `warning`; otherwise
 * (companion present, or none declared) -> `info`. The caller passes the single
 * sanctioned `softDepStatus(pi)` probe (the same one the renderer uses for the
 * `{requires pi-...}` marker), so the row bytes are unchanged -- only the
 * desired-state severity moves.
 */
export function companionSeverity(
  { declaresAgents, declaresMcp }: { declaresAgents: boolean; declaresMcp: boolean },
  probe: SoftDepStatus,
): "info" | "warning" {
  return (declaresAgents && !probe.piSubagentsLoaded) || (declaresMcp && !probe.piMcpAdapterLoaded)
    ? "warning"
    : "info";
}

/**
 * D-09: unsupported-components / soft-dep reasons -- the topic group the user
 * named explicitly (hooks / LSP / companion-extension soft deps / unsupported
 * source / no-longer-installable).
 */
export const UNSUPPORTED_REASONS = [
  "unsupported hooks",
  "lsp",
  "requires pi-subagents",
  "requires pi-mcp",
  "unsupported source",
  "no longer installable",
] as const;
export type UnsupportedReason = (typeof UNSUPPORTED_REASONS)[number];

/**
 * D-09: failure-class reasons -- an operation could not complete (permission /
 * source / network / manifest / lock / concurrency / rollback failures).
 */
export const FAILURE_REASONS = [
  "permission denied",
  "source missing",
  "network unreachable",
  "unreadable",
  "unparseable",
  "unreadable manifest",
  "invalid manifest",
  "not in manifest",
  "rollback partial",
  "lock held",
  "source mismatch",
  "concurrently uninstalled",
  "concurrently updated",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

/**
 * D-09: the shared topic-grouped reasons -- the union of the three groups
 * above. Command-private reasons (`duplicate name` / `stale clone` for
 * `marketplace add`, `not found` / `not installed` for `uninstall`,
 * `plugins remain` for `marketplace remove`, `orphan rewake` for `install`)
 * are NOT declared here -- they belong to the owning command's module. The
 * structural `"not added"` marketplace-absent marker is likewise not a shared
 * topic reason (it is excluded from `ContentReason` in `notify.ts`).
 */
export type SharedTopicReason = IdempotentReason | UnsupportedReason | FailureReason;

/**
 * D-09: the command-private reasons, named here ONLY for the completeness
 * proof below -- they are owned by their command modules, not exported as a
 * shared group. `"not added"` is the structural marketplace-absent marker
 * (excluded from `ContentReason` in `notify.ts`); it is included here solely so
 * the coverage proof sees the full closed set.
 */
type CommandPrivateReason =
  | "not found"
  | "not installed"
  | "plugins remain"
  | "stale clone"
  | "duplicate name"
  | "not added"
  | "orphan rewake";

/**
 * OUT-08 completeness proof: the union of the three shared topic groups + the
 * command-private reasons + the structural marker must be EXACTLY the closed
 * `Reason` set. The two `Exclude` expressions resolve to `never` only when the
 * partition is total (no shared literal missing a home, no stray literal that
 * is not in `REASONS`). `_ReasonsCoverageProof` pins each to `never` via a
 * default-type constraint -- a non-`never` result is a TS2344 compile error.
 * It is a type-only check with no runtime footprint.
 */
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
