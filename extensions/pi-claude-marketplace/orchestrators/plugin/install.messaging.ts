import {
  assertNever,
  causeChainTrailer,
  errorMessage,
  PluginShapeError,
} from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import {
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  installedLikeRow,
  partiallyInstalledRow,
  pluginRow,
  renderPartiallyAvailableRow,
  renderUnavailableRow,
  renderVersion,
  type ContentReason,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyAvailableMessage,
  type PluginPartiallyInstalledMessage,
  type PluginUnavailableMessage,
  type StatusToken,
} from "../../shared/notify.ts";
import { PathContainmentError } from "../../shared/path-safety.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";
import type { RollbackPartial } from "../../transaction/phase-ledger.ts";
import type { InstallPluginOutcome } from "../types.ts";

/**
 * install.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin install` (MOD-01). It co-locates install's private status
 * set, the message shapes those statuses carry, install's command-private
 * reasons, and a render map total over install's OWN statuses (D-10) whose
 * arm bodies are lifted VERBATIM from the central `renderPluginRow` switch so
 * the dispatched output is byte-identical.
 *
 * The shared presentation vocabulary (`ICON_*`, `joinTokens`,
 * `renderScopeBracket`, `renderVersion`, `composeReasons`, `pluginRow`) stays
 * central in `shared/notify.ts` (D-11); this module CALLS it, never duplicates
 * it.
 */

/**
 * install's private status set. A single-target install emits exactly one of
 * these: a success `installed` row, a `failed` row, or -- when the
 * entity-shape classifier narrows a not-installable error -- an `unavailable`
 * row (structural defect) or, per XSURF-01, a `partially-available` row (the
 * partially-available arm, consistent with `list` / `info`).
 *
 * DFEN-04: `disabled` joins for the install that landed disabled because the
 * plugin's own `defaultEnabled` declaration said so. The install ran to
 * completion and then unstaged, so the terminal state -- and therefore the row
 * -- is the one the `disable` verb already renders.
 */
type InstallStatus =
  | "installed"
  | "partially-installed"
  | "failed"
  | "unavailable"
  | "partially-available"
  | "disabled";

/**
 * Entity-shaped non-cascade error line (MSG-NC-1 / CMC-34) -- internal
 * classified-error return shape for `classifyEntityShapeError` and the
 * install.ts error-routing path. It lives here beside `InstallMsg` because
 * it is a message-row shape: `composeInstallFailureMessage` consumes it and
 * returns `InstallMsg`.
 *
 * Examples: `⊘ unknown@claude-plugins-official (failed) {not found}`;
 * `⊘ hookify [user] (unavailable) {unsupported hooks}`.
 */
export interface EntityErrorRow {
  readonly kind: "entity-error";
  readonly name: string;
  readonly marketplace?: string;
  readonly scope?: Scope;
  readonly status: Extract<StatusToken, "failed" | "unavailable">;
  readonly reasons: readonly ContentReason[];
  // SEV-02 / D-69-03: carried from the thrown PluginShapeError's `partialable`
  // discriminant on the `unavailable` arm -- `true` when the resolver verdict
  // is partially-available, so the composed row points at `--partial`.
  readonly partialable?: boolean;
}

/**
 * install's row message union -- the subset of the central plugin message
 * shapes whose status install actually emits. `dependencies` stays REQUIRED on
 * the `installed` arm so the soft-dep marker injection in `composeReasons`
 * fires for exactly that arm (D-06 / TYPE-04 gating).
 */
export type InstallMsg =
  | PluginInstalledMessage
  | PluginPartiallyInstalledMessage
  | PluginFailedMessage
  | PluginUnavailableMessage
  | PluginPartiallyAvailableMessage
  | PluginDisabledMessage;

/**
 * Render map total over install's OWN statuses (D-10): omitting an arm is a
 * TS2741 compile error at the `satisfies` site below. Each arm reproduces the
 * verbatim bytes of the matching `renderPluginRow` switch arm.
 */
const INSTALL_RENDER: { [K in InstallStatus]: RenderFn<Extract<InstallMsg, { status: K }>> } = {
  installed: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      renderVersion(p.version),
      "(installed)",
      p.reasons,
      probe,
    ),
  // FSTAT-07 / D-66-04: a partial install that re-resolves `partially-available` reports
  // (partially-installed) with the dropped-component detail. WR-03: the shared
  // `partiallyInstalledRow` threads `dependencies` so the soft-dep markers fire on a
  // degraded install exactly as on a clean `(installed)` row.
  "partially-installed": (p, probe, mpScope) => partiallyInstalledRow(p, mpScope, probe),
  unavailable: (p, probe, mpScope) => renderUnavailableRow(p, probe, mpScope),
  // XSURF-01: the partially-available install-failure arm. Byte-identical to the
  // `unavailable` arm but with the `⊖` glyph + `(partially-available)` token; the
  // `--partial` hint trailer is composed centrally by the renderer, not here.
  "partially-available": (p, probe, mpScope) => renderPartiallyAvailableRow(p, probe, mpScope),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  // DFEN-04 / OUT-04: the install-disabled arm. Lifted verbatim from the
  // `disable` verb's own arm so an install that landed disabled and an install
  // followed by a disable render byte-identically. ENBL-15 / D-100-06: both
  // soft-dep flags stay hard-coded false, so the row cannot emit a
  // `{requires pi-subagents}` / `{requires pi-mcp}` marker whatever inventory
  // the record retained (ENBL-18). The enable-hint trailer is composed
  // centrally by the renderer, not here.
  disabled: (p, probe, mpScope) => pluginRow(ICON_DISABLED, p, mpScope, "(disabled)", probe),
};

/**
 * D-04 / D-05: install's `CommandContext`. `Messaging.label` is the human
 * operation name; `render` is the total render map. The `as const satisfies`
 * pin enforces that install cannot be wired without supplying both.
 */
export const INSTALL_CONTEXT = {
  Messaging: { label: "Plugin install" },
  render: INSTALL_RENDER,
} as const satisfies CommandContext<InstallStatus, InstallMsg>;

/**
 * SEV-02 / D-69-03 / D-70-02 / XSURF-01: build the install-failure row,
 * branching on the three-way `partialable` discriminant the resolver stamped on
 * the throw. BOTH arms render at error severity (so the leading summary line
 * fires) -- an install failure must read as an error, not a benign info row.
 * The partially-available arm surfaces as the resolver-state-driven `partially-available`
 * token (XSURF-01: consistent with how `list` / `info` describe the same
 * plugin) and ALSO carries the `--partial` hint trailer (`--partial` can degrade-install
 * it). The structural arm stays the `unavailable` token with NO hint (force
 * cannot degrade-install a structural defect). The split keys on
 * `entityErrorRow.partialable`, NOT the reason brace -- `{unsupported source}`
 * appears on both arms; only the resolver verdict distinguishes them. Neither
 * message carries a `cause?` field per D-15-01 -- the reason text carries the
 * explanation.
 */
function composeNotInstallableMessage(
  plugin: string,
  version: string | undefined,
  entityErrorRow: EntityErrorRow,
): PluginUnavailableMessage | PluginPartiallyAvailableMessage {
  if (entityErrorRow.partialable === true) {
    return {
      status: "partially-available",
      name: plugin,
      reasons: entityErrorRow.reasons,
      ...(version !== undefined && version !== "" && { version }),
      severity: "error" as const,
      partialHint: true,
    };
  }

  return {
    status: "unavailable",
    name: plugin,
    reasons: entityErrorRow.reasons,
    ...(version !== undefined && version !== "" && { version }),
    severity: "error" as const,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Error classification and failure-row composition.
//
// This family lived in install.ts and was reached through four `__test_*`
// re-exports. `EntityErrorRow` above already moved here on the grounds that it
// is a message-row shape; the functions that produce and consume it belong on
// the same side of that line. The orchestrator now calls them across a public
// interface, which is the one the tests use (FLOW-09).
// ───────────────────────────────────────────────────────────────────────────

/**
 * PROV-04 / D-76-08 / D-79-03: classify a git-source clone auth challenge into
 * the EXISTING closed-set `authentication required` REASON -- no new token. A
 * private clone on a no-provider host (or a still-401 after a fresh credential,
 * D-79-02) throws the isomorphic-git `HttpError` with a 401/403 status; an
 * unsuccessful device flow (denied / expired / poll network error) makes
 * platform/git.ts's onAuth return `{ cancel: true }`, which isomorphic-git
 * throws as `UserCanceledError` instead. The seam append-leak-rethrows either
 * up to the install catch; both shapes narrow through the shared
 * `classifyGitTransportFailure` ladder. Install keeps ONLY its auth
 * classification: a network-class transport failure stays undefined here so it
 * rides the generic-runtime cause-chain fallthrough.
 *
 * D-79-03 (amended): the install row is the BARE `(failed) {authentication
 * required}` -- no `no auth provider is registered for <host>` cause line (the
 * plugin failure grammar has no cause-chain trailer slot that renders on the
 * SUBJECT row; the cause line lives ONLY on the update path's synthetic
 * failed-plugin child row). Returns undefined for a non-auth throw so the caller
 * keeps its generic-runtime cause-chain fallthrough.
 */
function classifyGitAuthFailure(err: unknown): "authentication required" | undefined {
  return classifyGitTransportFailure(err) === "authentication required"
    ? "authentication required"
    : undefined;
}

export function composeInstallFailureMessage(args: {
  err: unknown;
  plugin: string;
  scope: Scope;
  version: string | undefined;
  rolledBackPartial: boolean;
  rollbackPartials: readonly RollbackPartial[];
  entityErrorRow: EntityErrorRow | undefined;
}): InstallMsg {
  const { err, plugin, scope, version, rolledBackPartial, rollbackPartials, entityErrorRow } = args;
  const cause = err instanceof Error ? err : undefined;
  const isPathContainment = err instanceof PathContainmentError;

  // Branch 1: PI-14 PathContainmentError. Bare failed row with cause
  // trailer; no rollback-partial children, no entity-shape narrowing.
  if (isPathContainment) {
    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: [] as const,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
      // D-03/D-06: a failed install -> error, no reload (nothing landed).
      severity: "error",
      needsReload: false,
    };
    return failed;
  }

  // Branch 2: rollback-partial. Thread RollbackPartial.cause directly
  // -- no synthesis from the free-form .msg.
  if (rolledBackPartial) {
    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: ["rollback partial"] as const,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
      // D-03/D-06: a failed install -> error, no reload (nothing landed).
      severity: "error",
      needsReload: false,
      rollbackPartial: rollbackPartials.map((p) => ({
        phase: p.phase,
        ...(p.cause !== undefined && { cause: p.cause }),
      })),
    };
    return failed;
  }

  // Branch 3: entity-shape error. Preserve the classifier's status
  // discriminator (`failed` | `unavailable`) so the catalog byte forms
  // round-trip. The classifier's reasons array is closed-set Reason[]
  // already; thread it verbatim. PluginUnavailableMessage has no `cause?`
  // field per D-15-01 -- the reason text carries the explanation.
  if (entityErrorRow !== undefined) {
    if (entityErrorRow.status === "unavailable") {
      return composeNotInstallableMessage(plugin, version, entityErrorRow);
    }

    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: entityErrorRow.reasons,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
      // D-03/D-06: a failed install -> error, no reload (nothing landed).
      severity: "error",
      needsReload: false,
    };
    return failed;
  }

  // Branch 4: runtime throw. A PROV-04 git-source clone auth challenge maps to
  // the bare `(failed) {authentication required}` row (amended D-79-03: the
  // closed-set REASON carries the classification and NO cause line renders on
  // the install subject row -- the no-provider cause line lives only on the
  // update path's child row), so `cause` is omitted for it. Every other runtime
  // throw keeps an empty reasons array and rides the cause-chain trailer (the
  // renderer suppresses the `{}` brace per D-15-01).
  const authReason = classifyGitAuthFailure(err);
  const failed: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: authReason !== undefined ? ([authReason] as const) : ([] as const),
    ...(version !== undefined && version !== "" && { version }),
    scope,
    ...(authReason === undefined && cause !== undefined && { cause }),
    // D-03/D-06: a failed install -> error, no reload (nothing landed).
    severity: "error",
    needsReload: false,
  };
  return failed;
}

/**
 * Format the orchestrated-mode `cause` string for the
 * `InstallPluginOutcome.cause` field. The import cascade caller at
 * `orchestrators/import/execute.ts` reads this string for its
 * `dispatchFailedOutcome` rendering. Follows the D-CMC-12 join
 * discipline: `<errorMessage>` plus the depth-5 cause-chain trailer
 * (shared/errors.ts::causeChainTrailer) joined with a blank line when
 * present. Standalone-mode trailers are emitted by `notify()` from
 * the structural `PluginFailedMessage.cause` field; this helper exists
 * solely to preserve the orchestrated-mode string contract.
 */
export function formatOrchestratedCause(err: unknown): string {
  const head = errorMessage(err);
  const trailer = causeChainTrailer(err);
  return trailer === "" ? head : `${head}\n\n${trailer}`;
}

/**
 * CMC-34 / MSG-NC-1 entity-shape error classifier for the single-plugin
 * install failure surface. Returns an `EntityErrorRow` when the orchestrator's
 * thrown error matches a recognised entity-shape pattern (PI-3 / PI-4 / PI-5);
 * returns `undefined` for generic runtime errors which surface via
 * bare `errorMessage(err)` + the cause-chain trailer.
 *
 * Pattern map (PRD §5.2.1 + catalog §"/claude:plugin install"):
 *   - "not found in marketplace"       -> (failed)      {not in manifest}
 *   - "is already installed"           -> (failed)      {already installed}
 *   - "is not installable: <notes>"    -> (unavailable) {<narrowed reasons from notes>}
 *
 * The `is not installable` notes are split on `; ` and each segment narrowed
 * to a closed `Reason`: manifest field names (`hooks` / `lspServers` etc.)
 * pass verbatim per the MSG-GR-4 manifest-field carve-out; the catch-all
 * is `unsupported source` (closed REASONS member).
 */
export function classifyEntityShapeError(
  err: unknown,
  ctx: { plugin: string; marketplace: string; scope: Scope },
): EntityErrorRow | undefined {
  // Dispatch on `instanceof PluginShapeError` + `.shape.kind` rather than
  // substring-matching `.message`. The throw sites carry their structural
  // classification verbatim, so the catch site does not need to reparse text.
  if (!(err instanceof PluginShapeError)) {
    return undefined;
  }

  switch (err.shape.kind) {
    case "already-installed":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "failed",
        reasons: ["already installed"] as const,
      };
    case "not-in-manifest":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "failed",
        reasons: ["not in manifest"] as const,
      };
    case "not-installable":
    case "no-longer-installable":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "unavailable",
        // Resolver `r.notes` are free-form strings; narrow to closed
        // `Reason` members for the renderer. Reading from `err.shape`
        // (the typed discriminated union) means the narrow on
        // `.kind === "not-installable" | "no-longer-installable"`
        // guarantees `.reasons` is present -- no `?? []` fallback
        // needed.
        reasons: narrowResolverReasons(
          err.shape.reasons,
          err.shape.unsupportedKinds,
          err.shape.partialable,
        ),
        // SEV-02 / D-69-03: thread the three-way distinction the resolver
        // stamped on the throw so the composer conditions the `--partial` hint.
        partialable: err.shape.partialable,
      };
    default:
      return assertNever(err.shape);
  }
}

// Manifest field names detected through the MSG-GR-4 carve-out. The closed
// set holds the BARE camelCase token (`lspServers`) -- the DETECTION key
// sliced from the resolver note, derived from the real `.claude-plugin/
// plugin.json` JSON key. The resolver prefixes the kind with `"contains "`
// when populating `r.notes` (the `addUnsupportedKindNotes` helper pushes
// a `contains ${kind}` note for every UNSUPPORTED_COMPONENT_KINDS member
// it detects).
// The carve-out: `startsWith("contains ")` strips the resolver's prefix,
// then checks the remaining token against the set.
// HOOK-04 / D-58-02: `lspServers` is now the SOLE manifest-field
// carve-out. `hooks` was a supported component kind under v1.13 (the
// `SUPPORTED_COMPONENT_KINDS` extension) so the resolver no longer
// emits a `"contains hooks"` note; the dead carve-out entry was
// dropped. The `{unsupported hooks}` reason is now a normal 2-word
// REASON sourced through `shared/probe-classifiers.ts::narrowResolverNotes`
// against the `parseHooksConfig` prefix tokens, not a manifest-field
// carve-out emitted here.
// New detection tokens added here MUST also have an entry in
// `MANIFEST_FIELD_TO_REASON` below mapping them to a member of the closed
// `Reason` set in `shared/notify.ts::REASONS` so the renderer accepts them.
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["lspServers"]);
const MANIFEST_FIELD_NOTE_PREFIX = "contains ";

/**
 * Extract the bare manifest-field token from a resolver `"contains <kind>"`
 * note and map it to the emitted closed-set `Reason`. Returns `undefined`
 * when the note does not start with the prefix or the token is not a
 * recognized per-kind unsupported marker.
 *
 * SNM-36 / D-24-04 detection-vs-emission seam: the DETECTION token stays
 * camelCase (matches the resolver note derived from the JSON manifest key);
 * the EMITTED closed-set Reason is the user-rendered value. `lspServers`
 * detects but renders as `lsp`.
 *
 * D-64-02 / RSTATE-05: the token -> Reason mapping is the single shared
 * render helper `narrowUnsupportedKinds`, so the install error surface emits
 * the same per-kind marker `list` and `info` do (SURF-01 cross-surface
 * parity); install no longer carries its own per-kind mapping table.
 */
function manifestFieldTokenFromNote(note: string): ContentReason | undefined {
  if (!note.startsWith(MANIFEST_FIELD_NOTE_PREFIX)) {
    return undefined;
  }

  const token = note.slice(MANIFEST_FIELD_NOTE_PREFIX.length);
  // DETECT: gate on the camelCase manifest-field token (STAYS camelCase --
  // it matches the resolver note derived from the JSON manifest key).
  if (!MANIFEST_FIELD_REASONS.has(token)) {
    return undefined;
  }

  // EMIT: map the detected camelCase token to its closed-set Reason via the
  // shared render helper (D-64-02). The detection gate above admits only
  // `lspServers`, so this always resolves to `lsp`.
  return narrowUnsupportedKinds([token])[0];
}

/**
 * Cross-surface parity with `shared/probe-classifiers.ts::narrowResolverNotes`.
 * The resolver emits four `hooks.json`-prefix families when `parseHooksConfig`
 * rejects an on-disk hooks config (HOOK-03 / LIFE-01); both this install-side
 * classifier and the read-only probe classifier MUST emit the same
 * `unsupported hooks` token for the same on-disk condition (SURF-01). Mirrors
 * the probe-side prefix set verbatim -- if a prefix is added or renamed on one
 * side, the other side MUST follow in lockstep (pinned by
 * tests/orchestrators/plugin/cross-surface-reason-parity.test.ts).
 */
function isHooksResolverNote(reason: string): boolean {
  return (
    reason.startsWith("hooks.json is not valid JSON:") ||
    reason.startsWith("hooks.json failed schema validation:") ||
    reason.startsWith("unsupported hooks:") ||
    reason.startsWith("malformed hooks.json:")
  );
}

/**
 * Defensive errno-substring fallback for notes already serialised by deeper
 * helpers. The preferred path is typed errno-bearing Errors dispatched at the
 * orchestrator catch site via `.code`, so this only catches what slipped
 * through as prose. Returns undefined when nothing matches.
 */
function errnoReasonFromNote(reason: string): ContentReason | undefined {
  if (reason.includes("EACCES") || reason.includes("EPERM")) {
    return "permission denied";
  }

  if (reason.includes("ENOENT") || reason.includes("ENOTDIR")) {
    return "source missing";
  }

  if (reason.includes("SyntaxError") || reason.includes("Unexpected token")) {
    return "unparseable";
  }

  return undefined;
}

/**
 * Map ONE resolver note to its closed-set reason tokens. Arm order is
 * load-bearing and documented on `narrowResolverReasons`; returns an empty
 * list for a note that classifies to nothing.
 */
function classifyResolverReason(reason: string, partialable: boolean): readonly ContentReason[] {
  if (reason === "") {
    return [];
  }

  if (isHooksResolverNote(reason)) {
    return ["unsupported hooks"];
  }

  // The resolver emits `"contains hooks"` / `"contains lspServers"` -- extract
  // the bare token via the typed helper for the MSG-GR-4 carve-out.
  const manifestFieldToken = manifestFieldTokenFromNote(reason);
  if (manifestFieldToken !== undefined) {
    return [manifestFieldToken];
  }

  // SURF-01 / WR-01 / D-64-07: a `contains <kind>` note for a kind OTHER than
  // the `lspServers` carve-out (e.g. `monitors`, `themes`) is arm-dependent.
  // On the partially-available arm it is a per-kind COMPONENT marker, routed
  // through the SAME shared helper `list`/`info` consume so a multi-kind
  // plugin emits a byte-identical marker set on every surface (CR-01 /
  // D-64-02 / D-90-05). On the structural `unavailable` arm the note stays on
  // the SOURCE axis, mirroring `narrowResolverNotes`'s permissive catch-all.
  // The component axis belongs to the partially-available arm ONLY (D-64-07
  // structural precedence); leaking it onto the structural arm was the
  // SURF-01 divergence.
  if (reason.startsWith(MANIFEST_FIELD_NOTE_PREFIX)) {
    return partialable
      ? narrowUnsupportedKinds([reason.slice(MANIFEST_FIELD_NOTE_PREFIX.length)])
      : ["unsupported source"];
  }

  // MCPR-03 / D-02: mirror the shared `classifyResolverNote` arm so a broken
  // `mcpServers` string reference renders `{malformed mcp}` here too. Placed
  // BEFORE the `Unexpected token` arm so a JSON-parse-error reference maps to
  // `malformed mcp` rather than `{unparseable}`, and before the
  // `includes("source")` catch-all.
  if (reason.startsWith("malformed mcp reference")) {
    return ["malformed mcp"];
  }

  if (reason.includes("source")) {
    return ["unsupported source"];
  }

  const errnoReason = errnoReasonFromNote(reason);
  return errnoReason === undefined ? [] : [errnoReason];
}

/**
 * Narrow resolver `r.notes` (free-form strings) to the closed `Reason` set
 * for renderer consumption. Classification order:
 *   0. four `hooks.json` prefix families
 *      (`hooks.json is not valid JSON:` / `hooks.json failed schema validation:` /
 *      `unsupported hooks:` / `malformed hooks.json:`) -> `unsupported hooks`
 *      -- mirrors `shared/probe-classifiers.ts::narrowResolverNotes` for
 *      cross-surface parity (HOOK-03 / LIFE-01 / SURF-01)
 *   1. manifest-field carve-out (`contains lspServers`) -- HOOK-04 / D-58-02
 *      dropped the dead `contains hooks` half (hooks is supported under v1.13)
 *   1b. any other `contains <kind>` note (e.g. `monitors`, `themes`) is arm-
 *      dependent: on the partially-available arm (`partialable`) it routes its
 *      bare token through the shared `narrowUnsupportedKinds` helper so the
 *      install surface emits the same per-kind `unsupported component` marker
 *      set as `list`/`info` (CR-01 / D-64-02 / D-90-05); on the structural
 *      `unavailable` arm it stays on the source axis as `unsupported source`,
 *      mirroring `narrowResolverNotes`'s catch-all (SURF-01 / WR-01 / D-64-07)
 *   2. "source" substring -> `unsupported source`
 *   3. errno-like substrings (EACCES / EPERM / ENOENT / SyntaxError)
 *   4. permissive fallback: `unsupported source`
 * Steps 3-4 are defensive for notes already serialised by deeper helpers;
 * the preferred path is typed errno-bearing Errors dispatched at the
 * orchestrator catch site via `.code`.
 *
 * IN-02 / RSTATE-05: `unsupportedKinds` is the resolver's typed `unsupported[]`
 * component-kind list (carried on the thrown `PluginShapeError`). It is narrowed
 * FIRST, through the shared `narrowUnsupportedKinds` helper, so the failure row
 * renders the same per-kind markers `list`/`info` do. This is the ONLY reason
 * source for a `hooks`-only partially-available plugin (which carries no `contains hooks`
 * note), and it is deduped against the note-derived markers (e.g. a `lspServers`
 * plugin yields one `lsp`, sourced from both the note and the typed kind). The
 * permissive `unsupported source` fallback fires only when BOTH sources are empty.
 *
 * SURF-01 / WR-01 / D-64-07: `partialable` is the resolver arm discriminant
 * (`err.shape.partialable`). It defaults to the structural `unavailable` arm
 * (`false`) and only affects the non-carve-out `contains <kind>` note handler
 * (step 1b) -- the component-axis `unsupported component` token is emitted for
 * such a note ONLY on the partially-available arm; the structural arm keeps it on
 * the source axis (`unsupported source`), agreeing with `narrowResolverNotes`.
 */
export function narrowResolverReasons(
  reasons: readonly string[],
  unsupportedKinds: readonly string[] = [],
  partialable = false,
): readonly ContentReason[] {
  const out: ContentReason[] = [...narrowUnsupportedKinds(unsupportedKinds)];
  for (const reason of reasons) {
    out.push(...classifyResolverReason(reason, partialable));
  }

  if (out.length === 0) {
    // Conservative fallback: at least one Reason is required for the
    // EntityErrorRow `reasons` field. `unsupported source` is the
    // documented permissive default for an unclassifiable PI-4 cause.
    out.push("unsupported source");
  }

  // Dedup, preserving first-seen order: a multi-note resolver failure can
  // map several notes to the same closed Reason, and the row must not
  // render a duplicate token.
  return [...new Set(out)];
}

export function classifyInstallFailure(err: unknown, formattedCause: string): InstallPluginOutcome {
  // All failure variants collapse to `{ status: "failed"; error; cause }`.
  // `error` is the dispatch surface (narrow on `instanceof PluginShapeError`
  // to recover `.shape.kind`); `cause` is the formatted user-visible text.
  // `ConcurrentInstallError` is preserved as a distinct typed branch (PI-15);
  // non-Error inputs are wrapped so the contract guarantees `error instanceof Error`.
  const wrapped = err instanceof Error ? err : new Error(formattedCause);
  return { status: "failed", error: wrapped, cause: formattedCause };
}
