// extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
//
// PL-1..7 top-level plugin list. D-06 orchestrator half -- READ-ONLY.
//
// The orchestrator reads BOTH scopes' state (user + project) regardless of
// which scope the caller requested, computes the orphan-fold per
// D-13-17..D-13-19, and constructs a `NotificationMessage` of
// `MarketplaceNotificationMessage`s for the renderer at
// `shared/notify.ts`. The fold rule:
//   - For each marketplace `<mp>` that exists in PROJECT scope: emit a
//     `<mp>[project]` header block with the plugins installed under that
//     project-scope marketplace.
//   - For each marketplace `<mp>` that exists in USER scope: emit a
//     `<mp>[user]` header block; ALSO fold any project-scope plugin records
//     whose marketplace name equals `<mp>` AND for which NO project-scope
//     `<mp>` marketplace record exists (the orphan rule). Each folded
//     plugin row carries `scope: "project"` (D-13-18: actual install scope
//     on every surface).
//
// Each arm emits one notify() call with the full NotificationMessage payload.
// Probe failures manifest as per-row (unavailable) variants rather than a
// separate warning -- the per-row shape already carries the signal.
//
// CMC-13 / MSG-SD-1..3 per-row soft-dep markers: each installed-variant
// `PluginInstalledMessage` carries `dependencies: readonly Dependency[]`
// derived from the plugin's installed resources (state-recorded).
// `notify` owns the single softDepStatus(pi) probe per call
// and emits the `{requires pi-subagents}` / `{requires pi-mcp}` markers
// when (declares AND companion unloaded). RLD-04 / D-08: the list
// orchestrator stamps the steady-state inventory row `installed` with
// `needsReload: false`, so the OR-reduce reload-hint (RLD-02) does NOT
// fire the `/reload to pick up changes` trailer on plain list invocations.
//
// Contract (from PRD §5.3.1):
//   - PL-1 filter union semantics: when NO filter flags (--installed /
//     --available / --unavailable) are set, every bucket is shown. When any
//     one flag is set, show UNION of selected buckets.
//   - PL-3 marketplace narrowing: optional opts.marketplace filters which
//     marketplace records are walked.
//   - PL-5 upgradable: STRING comparison (manifest.version !== installed
//     record version). NOT semver.
//   - PL-6 manifest soft-fail: per-marketplace manifest load failure
//     surfaces as a `(failed)` MarketplaceNotificationMessage with
//     `status: "failed"` and `plugins: []`. No marketplace-level cause
//     trailer (catalog `unparseable-mp` at docs/output-catalog.md:
//     215-226). Installed plugins still render under their normal header
//     when the manifest parses.
//
// Architectural constraints (NFR-5 / PI-2 / PL-3):
//   - No withStateGuard (no mutation, no state file write).
//   - No `platform/git` import, no `DEFAULT_GIT_OPS`, no `gitOps` reference.
//   - `tests/architecture/no-orchestrator-network.test.ts` greps this source
//     after stripComments and asserts zero gitOps surface.

import { loadMarketplaceManifest, type MarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/resolver.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { assertNever, errorMessage } from "../../shared/errors.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
  type Single,
} from "../../shared/notify-context.ts";
import {
  narrowProbeError as sharedNarrowProbeError,
  narrowResolverNotes as sharedNarrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";
import { isRecordedButDisabled } from "../reconcile/plan.ts";

import { LIST_CONTEXT, type ListMsg } from "./list.messaging.ts";
import { classifyInstalledRecord, classifyManifestEntry } from "./plugin-state-classifier.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  PluginAvailableMessage,
  PluginDisabledMessage,
  PluginFailedMessage,
  PluginForceInstalledMessage,
  PluginForceUpgradableMessage,
  PluginInstalledMessage,
  PluginNotificationMessage,
  PluginUnavailableMessage,
  PluginUnsupportedMessage,
  PluginUpgradableMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * PluginRenderStatus retained as an internal alias to keep the orchestrator's
 * bucketing logic (installed / upgradable / available / unavailable) typed.
 * Maps 1:1 onto the PluginNotificationMessage list-surface discriminator
 * subset per shared/notify.ts. RLD-04 / D-08: the installed bucket emits the
 * `installed` token with `needsReload: false` (the stamped flag suppresses the
 * OR-reduce reload-hint on steady-state list invocations); the PL-1
 * `--installed` filter treats `installed`, `upgradable`, and `disabled` as the
 * installed bucket (a disabled plugin IS recorded -- the catalog's
 * `disabled-inventory` state sits under the installed inventory; D-54-01 /
 * ENBL-04).
 */
type PluginRenderStatus =
  | "installed"
  | "upgradable"
  | "available"
  | "unsupported"
  | "unavailable"
  | "disabled"
  // FSTAT-02 / FSTAT-04 / D-66-01 / D-66-02: the derived force-state inventory
  // rows. LIST-01 / D-67-01 / A1: the `--installed` filter now spans them --
  // both are installed-inventory rows, so `shouldShow` admits them under an
  // active `--installed` filter (precedent: the fold-carryover filter below).
  | "force-installed"
  | "force-upgradable";

/**
 * LIST-01 / D-67-01: the internal resolver-state bucket the filter predicate
 * keys on. It is retained as a concept DISTINCT from {@link PluginRenderStatus}
 * even though USTAT-01 / D-64-01 now de-collapses the render tokens (resolver
 * `unsupported` renders `(unsupported)` / `⊖`, structural `unavailable` renders
 * `(unavailable)` / `⊘`): the filter keys on this pre-collapse bucket so
 * `--unsupported` (not-installed plugins resolving `unsupported` -- the
 * force-installable candidates) partitions cleanly from `--unavailable`
 * (structural-unavailable only, A2) regardless of the render token.
 * Installed-inventory rows
 * (installed / upgradable / disabled / force-installed / force-upgradable) are
 * not resolver-classified here -- they carry the `installed-inventory` bucket
 * and the filter keys on their render status instead.
 */
type FilterBucket = "installed-inventory" | "available" | "unsupported" | "unavailable";

/**
 * Options bag for {@link listPlugins}. The edge layer constructs this
 * from `/claude:plugin list` argv parsing.
 *
 * `pi` is REQUIRED -- the `notify(ctx, pi, message)` call consumes it
 * for the single softDepStatus(pi) probe per invocation. The
 * renderer derives per-row soft-dep markers from each
 * `PluginInstalledMessage.dependencies` field plus the probe result.
 */
export interface ListPluginsOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  /** SC-6 enumeration narrowing: when undefined the cross-scope walk + fold
   *  rule applies. When set, the orchestrator STILL reads both scopes (the
   *  fold rule needs visibility into both) but constrains which blocks are
   *  emitted at the end. */
  readonly scope?: Scope;
  /** PL-3 marketplace narrowing: when undefined, every marketplace is walked. */
  readonly marketplace?: string;
  /** PL-1 union filter: include installed plugins. */
  readonly installed?: boolean;
  /** PL-1 union filter: include available (not-yet-installed installable) plugins. */
  readonly available?: boolean;
  /** PL-1 union filter: include STRUCTURALLY-uninstallable (⊘) plugins. A2:
   *  narrowed to the resolver `unavailable` bucket -- it no longer admits the
   *  not-installed `unsupported` rows (those are reached by `unsupported`). */
  readonly unavailable?: boolean;
  /** LIST-01 / D-67-01 union filter: include NOT-installed plugins that resolve
   *  `unsupported` (the force-installable candidates). Keys on the internal
   *  resolver bucket, not the `(unavailable)` render token. */
  readonly unsupported?: boolean;
}

/**
 * PL-1 / LIST-01: when ALL filter flags are absent or false, show every bucket.
 * When any one is true, show UNION of the selected buckets.
 */
function filtersPassive(opts: ListPluginsOptions): boolean {
  return (
    opts.installed !== true &&
    opts.available !== true &&
    opts.unavailable !== true &&
    opts.unsupported !== true
  );
}

/**
 * PL-1 / LIST-01 / D-67-01 filter predicate. `status` is the render status;
 * `bucket` is the internal resolver-state bucket (only meaningful for
 * not-installed rows, where the render `(unavailable)` token is ambiguous
 * between `unsupported` and structural `unavailable`). Installed-inventory rows
 * pass `installed-inventory` and are matched on `status`.
 */
function shouldShow(
  opts: ListPluginsOptions,
  status: PluginRenderStatus,
  bucket: FilterBucket,
): boolean {
  if (filtersPassive(opts)) {
    return true;
  }

  // A1: `--installed` spans the full installed inventory -- the steady-state
  // `installed`/`upgradable`/`disabled` rows PLUS the derived force states
  // (force-installed reached here, NOT via `--unsupported`, per D-67-01). This
  // mirrors the fold-carryover filter's installed-inventory set.
  if (
    opts.installed === true &&
    (status === "installed" ||
      status === "upgradable" ||
      status === "disabled" ||
      status === "force-installed" ||
      status === "force-upgradable")
  ) {
    return true;
  }

  if (opts.available === true && status === "available") {
    return true;
  }

  // D-67-01: `--unsupported` selects not-installed plugins that resolve
  // `unsupported`, keyed on the pre-collapse resolver bucket (the row renders
  // the de-collapsed `(unsupported)` / `⊖` token per USTAT-01).
  if (opts.unsupported === true && bucket === "unsupported") {
    return true;
  }

  // A2: `--unavailable` narrows to the structural `unavailable` bucket only --
  // the not-installed `unsupported` rows (now a distinct `(unsupported)` token)
  // are excluded.
  if (opts.unavailable === true && bucket === "unavailable") {
    return true;
  }

  return false;
}

/**
 * Per-marketplace manifest load. Wraps `loadMarketplaceManifest` so a thrown
 * error becomes a `(failed)` MarketplaceNotificationMessage per CMC-22 +
 * catalog `unparseable-mp` state at docs/output-catalog.md:215-226 (handled
 * in the block builder).
 */
async function loadManifestSoftly(manifestPath: string): Promise<MarketplaceManifest> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * Reasons emitted by the list orchestrator. The resolver-narrowing path
 * produces `unsupported hooks` / `lsp` / `unsupported source`; the
 * probe-error path produces `invalid manifest` / `permission denied` /
 * `source missing` / `unreadable` / `unparseable`. All values are members
 * of the closed `Reason` set so the renderer accepts them unchanged
 * (D-48-B IN-02: `invalid manifest` joined the probe-error path for the
 * schema-invalid manifest case).
 */
type ListReason =
  | "unsupported hooks"
  | "lsp"
  | "unsupported source"
  | "invalid manifest"
  | "permission denied"
  | "source missing"
  | "unreadable"
  | "unparseable";

/**
 * Compute `dependencies: readonly Dependency[]` from boolean declares flags.
 * The renderer probes once and emits `{requires pi-subagents}` / `{requires
 * pi-mcp}` when (declares AND companion unloaded). Empty array elides both
 * markers structurally (D-15-02).
 */
function dependenciesFromDeclares(declaresAgents: boolean, declaresMcp: boolean): Dependency[] {
  const deps: Dependency[] = [];
  if (declaresAgents) {
    deps.push("agents");
  }

  if (declaresMcp) {
    deps.push("mcp");
  }

  return deps;
}

/**
 * Build a `PluginInstalledMessage` (or `PluginUpgradableMessage` when the
 * manifest version differs from the installed record's version per PL-5
 * string compare) for an INSTALLED plugin record. `dependencies` derives
 * from the installed record's `resources` (state-recorded counts).
 *
 * `pluginScope`: the actual install scope of this plugin record. Passed
 * through to the row only when it differs from the owning marketplace's
 * scope -- the renderer's MSG-PL-6 orphan-fold rule suppresses
 * the `[<scope>]` bracket when `p.scope === mp.scope`.
 *
 * Inventory-vs-transition discriminator (RLD-04 / D-08): the steady-state
 * list row emits the `installed` token with `needsReload: false`. The
 * stamped flag suppresses the OR-reduce reload-hint (RLD-02) for inventory,
 * and `reasons` is OMITTED so the orphan-rewake brace never leaks onto a
 * steady-state row; the rendered byte form `● <name> [<scope>] v<ver>
 * (installed)` is preserved.
 *
 * PL-4: `description` is sourced from the manifest entry (when available).
 * The installed state record does not carry description; if the manifest is
 * unavailable (load failure), description is simply absent from the row.
 */
async function installedRowMessage(
  pluginName: string,
  pluginScope: Scope,
  marketplaceScope: Scope,
  marketplaceRoot: string,
  record: ExtensionState["marketplaces"][string]["plugins"][string],
  manifestEntry: MarketplaceManifest["plugins"][number] | undefined,
): Promise<
  | PluginInstalledMessage
  | PluginUpgradableMessage
  | PluginDisabledMessage
  | PluginForceInstalledMessage
  | PluginForceUpgradableMessage
> {
  const declaresAgents = record.resources.agents.length > 0;
  const declaresMcp = record.resources.mcpServers.length > 0;
  const upgradable =
    manifestEntry?.version !== undefined && manifestEntry.version !== record.version;

  // Same-scope: omit the `scope` field so the renderer's orphan-fold rule
  //  suppresses the `[<scope>]` bracket. Cross-scope (orphan
  // fold case): emit the actual install scope so the renderer prints the
  // `[<actualScope>]` bracket on the row.
  const scopeField: { readonly scope?: Scope } =
    pluginScope === marketplaceScope ? {} : { scope: pluginScope };

  const descriptionField: { readonly description?: string } =
    manifestEntry?.description === undefined ? {} : { description: manifestEntry.description };

  // D-54-01 / ENBL-04: a recorded-but-disabled record (empty-resources +
  // `installable: true` -- the canonical `isRecordedButDisabled` marker the
  // disable orchestrator writes) renders the `(disabled)` inventory token,
  // NOT `(installed)`. Checked BEFORE the upgradable branch: the version pin
  // is frozen while disabled (ENBL-02), so a manifest-version drift must not
  // surface a misleading `(upgradable)` on a plugin with no artefacts.
  if (isRecordedButDisabled(record)) {
    return {
      // D-03/D-06: a disabled INVENTORY row (list surface) is steady state,
      // not a realized transition -> info, never reloads.
      status: "disabled",
      name: pluginName,
      version: record.version,
      ...scopeField,
      ...descriptionField,
      severity: "info",
      needsReload: false,
    };
  }

  // D-67-02 / LIST-02: the finer installed-inventory state is derived by the
  // SHARED `classifyInstalledRecord` (the same classifier the completion
  // bucketizer consumes) -- this surface holds no second classifier. The
  // caller still owns the NO-NETWORK candidate probe so the classifier stays
  // pure; the precedence (A4 force-installed wins over upgradable) and the
  // CR-01 degrade live inside the classifier.
  //
  // D-66-02 / FSTAT-04 / FSTAT-05: an upgradable clean record's `(upgradable)`
  // vs `(force-upgradable)` split turns on a NO-NETWORK `resolveStrict` of the
  // CANDIDATE manifest entry. `resolveStrict` is the cache/no-network resolver
  // (NFR-5), guarded by the no-orchestrator-network architecture test. The
  // probe runs only when `upgradable` (no force-installed/installed wasted
  // resolve); `upgradable === true` already narrows `manifestEntry` to defined
  // (its `?.version !== undefined` conjunct), so no extra guard is needed.
  //
  // CR-01: the candidate resolve MUST be wrapped. `resolveStrict` propagates
  // disk-I/O failures (EACCES/EIO/ENOTDIR, malformed plugin.json the lenient
  // path rethrows) rather than folding them into a not-installable variant. A
  // probe failure on the CANDIDATE of a SINGLE upgradable plugin must never
  // escape this row builder -- unguarded it bubbles to the top-level
  // `listPlugins` catch, which blanks the ENTIRE list into one synthetic
  // `(list) (failed)` row, hiding every other plugin. Pass `undefined` to the
  // classifier (degrade to the plain `(upgradable)` row -- the truthful
  // "could not assert a degrade" default), at parity with every sibling
  // force-resolve site (`availableRowMessage`, `info.ts`,
  // `resolvePendingForceInstalls`).
  let candidateResolved: Awaited<ReturnType<typeof resolveStrict>> | undefined;
  if (upgradable) {
    try {
      candidateResolved = await resolveStrict(manifestEntry, { marketplaceRoot });
    } catch {
      candidateResolved = undefined;
    }
  }

  const status = classifyInstalledRecord(
    record,
    upgradable ? { upgradable: true, resolved: candidateResolved } : { upgradable: false },
  );

  // D-66-01 / FSTAT-01 / FSTAT-03: force-installed reads the persisted
  // install-time `compatibility.unsupported` (no new flag, no migration). The
  // dropped-component detail uses the shared `narrowUnsupportedKinds` render
  // helper (D-64-02) for cross-surface marker parity. WR-02: a
  // `force-installed-upgradable` record (a force-installed row that also carries
  // a meaningful upgrade candidate) renders IDENTICALLY to `(force-installed)`
  // here -- the upgrade affordance is a completion-only distinction (offered
  // under `update --force`); the list row reflects the CURRENT degraded state.
  if (status === "force-installed" || status === "force-installed-upgradable") {
    return {
      status: "force-installed",
      name: pluginName,
      reasons: narrowUnsupportedKinds(record.compatibility.unsupported),
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }

  if (status === "force-upgradable") {
    // The classifier returns `force-upgradable` ONLY when the candidate
    // resolved `unsupported`; narrow on the same condition to read its
    // dropped-component kinds for the row reasons.
    return {
      status: "force-upgradable",
      name: pluginName,
      reasons:
        candidateResolved?.state === "unsupported"
          ? narrowUnsupportedKinds(candidateResolved.unsupported)
          : [],
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }

  if (status === "upgradable") {
    // The PluginUpgradableMessage type structurally requires `reasons`
    // per D-15-01. Use the empty-array sentinel -- the renderer's
    // composeReasons helper returns "" for an empty reasons array, so the
    // emitted byte form remains `● <name> [<scope>] v<ver> (upgradable)`
    // without a trailing `{...}` brace.
    return {
      status: "upgradable",
      name: pluginName,
      reasons: [],
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }

  return {
    // RLD-04 / D-08: the list-surface inventory row is `installed` with
    // `needsReload: false` -- the stamped flag IS the old `present`
    // reload-suppression (the OR-reduce reload-hint stays suppressed for
    // steady-state inventory). `reasons` is OMITTED so the orphan-rewake brace
    // never leaks onto an inventory row.
    status: "installed",
    name: pluginName,
    dependencies: dependenciesFromDeclares(declaresAgents, declaresMcp),
    version: record.version,
    ...scopeField,
    ...descriptionField,
    severity: "info",
    needsReload: false,
  };
}

/**
 * Local wrapper that preserves the per-row probe-failure naming at this
 * call site. Delegates to the shared classifier so the body cannot
 * drift from `marketplace/info.ts` and `plugin/info.ts`.
 *
 * Distinct from `narrowListFailReason` below: this helper classifies
 * per-row resolver probe failures (`unreadable` means "could not read
 * the plugin source"); the other classifies orchestrator-level list
 * failures (`unreadable` means "could not load state.json or walk the
 * marketplace records"). Same underlying ladder, two semantic names.
 */
function narrowProbeError(err: unknown): ListReason {
  return sharedNarrowProbeError(err);
}

/**
 * Resolve a not-yet-installed manifest entry into a `{ message, bucket }` pair
 * whose `message` is a `PluginAvailableMessage`, `PluginUnsupportedMessage`, or
 * `PluginUnavailableMessage`.
 *
 * The row de-collapses by `resolved.state`: `installable` -> `(available)`;
 * `unsupported` -> `(unsupported)` with the dropped-component reasons narrowed
 * via the shared kind helper (force-installable); structural `unavailable` (or a
 * resolveStrict throw) -> `(unavailable)` with the failure reasons narrowed to
 * closed-set REASONS.
 *
 * SNM-11: the `available`, `unsupported`, and `unavailable` variants all OMIT
 * `scope` (the list surface does not emit `[<scope>]` brackets for these rows
 * per MSG-PL-6).
 *
 * Probe failures (resolveStrict throws): the thrown error is classified
 * via `narrowProbeError` into a closed-set Reason and threaded onto the
 * `(unavailable)` row's `reasons` array. The user sees the cause CLASS on
 * the per-row line -- there is NO separate trailing summary notification
 * per D-19-01.
 */
async function availableRowMessage(
  manifestEntry: MarketplaceManifest["plugins"][number],
  marketplaceRoot: string,
): Promise<{
  message: PluginAvailableMessage | PluginUnsupportedMessage | PluginUnavailableMessage;
  bucket: FilterBucket;
}> {
  // PL-4: description flows from the manifest entry onto the row for both
  // available and unavailable variants.
  const descriptionField: { readonly description?: string } =
    manifestEntry.description === undefined ? {} : { description: manifestEntry.description };

  try {
    const resolved = await resolveStrict(manifestEntry, { marketplaceRoot });
    // D-67-02 / LIST-02: the filter BUCKET is derived by the SHARED
    // `classifyManifestEntry` (the same classifier the completion bucketizer
    // consumes) -- the `available | unsupported | unavailable` member maps
    // 1:1 onto a {@link FilterBucket}, so the `--unsupported` / `--unavailable`
    // partition keys on the pre-collapse classification without a second
    // classifier on this surface.
    const bucket = classifyManifestEntry(resolved);

    // USTAT-01 / D-64-01: the render now de-collapses by resolver STATE. The
    // `installable` arm is `(available)`; the `unsupported` arm emits the
    // distinct `(unsupported)` / `⊖` row (force-installable: components would be
    // dropped under `--force`); the structural `unavailable` arm keeps
    // `(unavailable)` / `⊘`. The split follows `resolved.state`, NEVER the
    // reason brace (the same `{unsupported hooks}` brace can appear on both
    // arms). The filter `bucket` is unchanged -- `classifyManifestEntry` keeps
    // `--unsupported` / `--unavailable` partitioning on the pre-collapse class.
    //
    // WR-03: discriminate the three-way union with an exhaustive
    // `switch (resolved.state)` + `assertNever` so a future fourth
    // `ResolvedPlugin` arm becomes a compile-time error here rather than
    // silently falling through into the `unavailable`/`notes` path.
    switch (resolved.state) {
      case "installable":
        return {
          message: {
            status: "available",
            name: manifestEntry.name,
            ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
            ...descriptionField,
          },
          bucket,
        };
      case "unsupported":
        // D-64-02 / RSTATE-05: per-kind unsupported markers derive from the
        // typed `unsupported[]` component-kind list via the shared render
        // helper.
        return {
          message: {
            status: "unsupported",
            name: manifestEntry.name,
            reasons: narrowUnsupportedKinds(resolved.unsupported),
            ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
            ...descriptionField,
          },
          // D-67-01: `unsupported` -> the force-installable candidate bucket.
          bucket,
        };
      case "unavailable":
        // The structural `unavailable` arm's reasons stay on the `notes` path.
        return {
          message: {
            status: "unavailable",
            name: manifestEntry.name,
            reasons: sharedNarrowResolverNotes(resolved.notes),
            ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
            ...descriptionField,
          },
          // D-67-01: the structural `unavailable` resolver arm -> the
          // structural bucket.
          bucket,
        };

      default:
        return assertNever(resolved);
    }
  } catch (probeErr) {
    // TR-08 / D-19-01: per-row probe-failure narrowing. Probe failures
    // during list are diagnostic noise, NOT actionable user errors --
    // the user sees the cause class on the `(unavailable)` row's
    // `reasons[]` and decides whether to act. There is no module-level
    // capture-buffer or summary warning.
    //
    // Resolver notes route through `narrowResolverNotes` (the path that produces
    // them is `resolveStrict` returning the structural `unavailable` arm with
    // structured notes -- handled above on the `case "unavailable"` arm of
    // `switch (resolved.state)`; the `case "unsupported"` arm instead narrows its
    // typed component kinds via `narrowUnsupportedKinds`). Thrown probe failures
    // route through `narrowProbeError` so the row reports the actual cause class
    // (EACCES, JSON parse failures, and programming bugs are not hidden behind
    // `{unsupported source}`).
    //
    // TR-08 architecture test at tests/orchestrators/plugin/list.test.ts
    // asserts no module-level `PROBE_FAILURES`-style state may reappear.
    const reason = narrowProbeError(probeErr);
    return {
      message: {
        status: "unavailable",
        name: manifestEntry.name,
        reasons: [reason],
        ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
        ...descriptionField,
      },
      // D-67-01 / A2: a probe failure is STRUCTURAL unavailability (could not
      // read/resolve the source), not an `unsupported` classification -- the
      // `--unavailable` filter owns it.
      bucket: "unavailable",
    };
  }
}

/**
 * Enumerate plugin notification messages for a single (marketplace-record,
 * plugin-scope) pair. Walks the marketplace's installed plugin records
 * first, then the manifest entries that are NOT installed (available /
 * unavailable buckets).
 *
 * `mpRecord` is the marketplace record from `<pluginScope>`'s state;
 * `pluginScope` is the scope under which the plugins are installed (the
 * `[<scope>]` bracket on each plugin row reflects this -- D-13-18 -- via
 * the renderer's orphan-fold rule).
 *
 * `marketplaceScope` is the scope of the OWNING marketplace block. When
 * `pluginScope === marketplaceScope` the plugin row OMITS its `scope`
 * field so the renderer suppresses the bracket; otherwise the row carries
 * the actual install scope.
 *
 * `excludeFromAvailable` is the set of plugin names that should NOT be
 * emitted as `(available)` rows because they are already installed in
 * the OTHER scope under the CLONED marketplace record (orphan-fold rule).
 *
 * Returns the rows in stable (state-iteration + manifest-order) order;
 * the orchestrator applies the final MSG-GR-3 sort at the block boundary.
 */
async function enumerateMarketplacePlugins(
  opts: ListPluginsOptions,
  mpRecord: ExtensionState["marketplaces"][string],
  pluginScope: Scope,
  marketplaceScope: Scope,
  manifest: MarketplaceManifest | undefined,
  excludeFromAvailable: ReadonlySet<string> = new Set(),
): Promise<ListMsg[]> {
  const rows: ListMsg[] = [];
  const installedRecords = mpRecord.plugins;
  const installedNames = new Set(Object.keys(installedRecords));

  // Installed bucket.
  for (const [pluginName, record] of Object.entries(installedRecords)) {
    const manifestEntry = manifest?.plugins.find((p) => p.name === pluginName);
    const row = await installedRowMessage(
      pluginName,
      pluginScope,
      marketplaceScope,
      mpRecord.marketplaceRoot,
      record,
      manifestEntry,
    );
    // Installed-inventory rows are matched on render status; the resolver
    // bucket is not consulted for them (D-67-01).
    if (shouldShow(opts, row.status, "installed-inventory")) {
      rows.push(row);
    }
  }

  // Available / unavailable buckets (manifest entries not in state).
  if (manifest === undefined) {
    return rows;
  }

  for (const manifestEntry of manifest.plugins) {
    if (installedNames.has(manifestEntry.name)) {
      continue;
    }

    if (excludeFromAvailable.has(manifestEntry.name)) {
      // Already installed in the OTHER scope under a CLONED marketplace
      // record (orphan-fold rule). The folded `(installed)` row carries
      // the plugin's actual install scope (D-13-18); we suppress the
      // duplicate `(available)` enumeration so the block matches the
      // catalog `project-orphan-folded` form.
      continue;
    }

    const { message: row, bucket } = await availableRowMessage(
      manifestEntry,
      mpRecord.marketplaceRoot,
    );
    if (shouldShow(opts, row.status, bucket)) {
      rows.push(row);
    }
  }

  return rows;
}

interface ScopedManifest {
  readonly manifest: MarketplaceManifest | undefined;
  readonly loadError: string | undefined;
}

async function loadMarketplaceManifestSoftly(
  mpRecord: ExtensionState["marketplaces"][string],
): Promise<ScopedManifest> {
  try {
    const manifest = await loadManifestSoftly(mpRecord.manifestPath);
    return { manifest, loadError: undefined };
  } catch (err) {
    return { manifest: undefined, loadError: errorMessage(err) };
  }
}

/**
 * D-13-17 / D-13-19 fold rule. For a USER-scope marketplace `<mp>` that
 * has no matching PROJECT-scope marketplace record, the orphan rule folds
 * project-scope plugin records keyed by `<mp>` under the user-scope header.
 *
 * State-shape observation: a project-scope plugin installed from a
 * user-scope marketplace causes the install orchestrator to clone the
 * marketplace record into the project scope. The orphan condition is:
 *   - A PROJECT-scope marketplace `<mp>` EXISTS in project state (cloned
 *     from user scope at install time) AND
 *   - A USER-scope marketplace `<mp>` ALSO exists in user state AND
 *   - The two records reference the SAME marketplace source (same
 *     `marketplaceRoot`).
 *
 * This treatment matches the catalog `project-orphan-folded` state
 * (docs/output-catalog.md:184-196) and the `same-plugin-both-scopes`
 * state (lines 168-182).
 */
function isCloneOfUserMarketplace(
  projectMp: ExtensionState["marketplaces"][string] | undefined,
  userMp: ExtensionState["marketplaces"][string] | undefined,
): boolean {
  if (projectMp === undefined || userMp === undefined) {
    return false;
  }

  // Identity by marketplaceRoot: the install orchestrator copies this from
  // the source marketplace verbatim, so a project-scope clone of a user
  // marketplace always has the same on-disk root.
  return projectMp.marketplaceRoot === userMp.marketplaceRoot;
}

interface BuiltMarketplace {
  readonly mp: MarketplaceRows<ListMsg>;
  readonly emitScope: Scope;
}

async function buildMarketplaceMessage(args: {
  opts: ListPluginsOptions;
  mpName: string;
  mpScope: Scope;
  mpRecord: ExtensionState["marketplaces"][string];
  /** SPLIT-01 rewire: autoupdate read from MergedConfig at the caller. */
  autoupdate: boolean;
  extraPlugins: readonly ListMsg[];
  excludeFromAvailable?: ReadonlySet<string>;
}): Promise<BuiltMarketplace> {
  const { opts, mpName, mpScope, mpRecord, autoupdate, extraPlugins, excludeFromAvailable } = args;
  const { manifest, loadError } = await loadMarketplaceManifestSoftly(mpRecord);

  // Unparseable manifest: catalog `unparseable-mp` form (lines 215-226)
  // -- bare `(failed)` marketplace header with `plugins: []`. No
  // `causeTrailer` per the catalog "notify() does not emit a
  // marketplace-level cause: trailer for failed marketplaces with empty
  // plugins: []" contract. The autoupdate detail also drops on failure --
  // the renderer's failed-status arm at shared/notify.ts:593 emits a
  // bare header with no `<autoupdate>` marker.
  if (loadError !== undefined) {
    return {
      mp: {
        name: mpName,
        scope: mpScope,
        status: "failed",
        // D-03: a failed marketplace header on the list surface -> error.
        severity: "error",
        plugins: [],
      },
      emitScope: mpScope,
    };
  }

  // Normal header + enumerated plugins (own scope) + folded extras.
  const ownPlugins = await enumerateMarketplacePlugins(
    opts,
    mpRecord,
    mpScope,
    mpScope,
    manifest,
    excludeFromAvailable,
  );
  const merged: readonly ListMsg[] = [...ownPlugins, ...extraPlugins];

  // `details` is OPTIONAL and INDEPENDENT of status per D-15-06. The
  // plugin-list surface carries only the `autoupdate` marker;
  // `lastUpdatedAt` is NOT surfaced on the plugin-list rendering (it lives
  // on the marketplace-list surface only). Include `details` ONLY when
  // `autoupdate === true`, and inside `details` carry ONLY `autoupdate`.
  // `lastUpdatedAt` is intentionally omitted so the renderer's
  // `<last-updated <iso>>` token never emits on this surface. Catalog
  // reference: every `/claude:plugin list` fixture at
  // docs/output-catalog.md:139-263 has `details: { autoupdate: true }` --
  // no `lastUpdatedAt` field.
  const detailsField: { readonly details?: { autoupdate: boolean } } = autoupdate
    ? { details: { autoupdate: true } }
    : {};

  return {
    mp: {
      name: mpName,
      scope: mpScope,
      ...detailsField,
      plugins: merged,
    },
    emitScope: mpScope,
  };
}

/**
 * D-02: pure payload builder for the cross-scope
 * plugin list. Reads BOTH scopes' state regardless of `opts.scope` -- the
 * fold rule needs visibility into both; final scope-filtering applies AFTER
 * the blocks are constructed.
 */
export async function loadPluginListPayload(
  opts: ListPluginsOptions,
): Promise<readonly MarketplaceRows<ListMsg>[]> {
  // D-13-19: read both scopes' state.
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);
  const [userState, projectState, userMerged, projectMerged] = await Promise.all([
    loadState(userLocations.extensionRoot),
    loadState(projectLocations.extensionRoot),
    // SPLIT-01 rewire: autoupdate lives in claude-plugins.json (config).
    // Pre-compute the merged view per scope ONCE before the fold loops below.
    loadMergedScopeConfig(userLocations).then((r) => r.merged),
    loadMergedScopeConfig(projectLocations).then((r) => r.merged),
  ]);

  const blocks: BuiltMarketplace[] = [];

  // 1. Project-scope marketplace records.
  for (const [mpName, mpRecord] of Object.entries(projectState.marketplaces)) {
    if (opts.marketplace !== undefined && opts.marketplace !== mpName) {
      continue;
    }

    const userMp = userState.marketplaces[mpName];
    // Orphan-fold rule: if the project-scope record is a CLONE of the
    // user-scope record (same marketplaceRoot), DO NOT emit a separate
    // project-scope block. The project-scope plugins fold under the
    // user-scope header below.
    if (isCloneOfUserMarketplace(mpRecord, userMp)) {
      continue;
    }

    const built = await buildMarketplaceMessage({
      opts,
      mpName,
      mpScope: "project",
      mpRecord,
      autoupdate: projectMerged.marketplaces[mpName]?.entry.autoupdate ?? false,
      extraPlugins: [],
    });
    blocks.push(built);
  }

  // 2. User-scope marketplace records (with optional orphan fold).
  for (const [mpName, mpRecord] of Object.entries(userState.marketplaces)) {
    if (opts.marketplace !== undefined && opts.marketplace !== mpName) {
      continue;
    }

    // Fold orphan project plugins iff the matching project-scope record
    // is a clone (per D-13-17 semantics) and exists.
    const projectMp = projectState.marketplaces[mpName];
    const isProjectMpClone = isCloneOfUserMarketplace(projectMp, mpRecord);
    let folded: readonly ListMsg[] = [];
    let foldedNames: ReadonlySet<string> = new Set();
    if (isProjectMpClone && projectMp !== undefined) {
      // Each folded row carries scope: "project" (D-13-18 actual install
      // scope), surfaced via the renderer's orphan-fold rule when
      // `p.scope !== mp.scope`.
      const { manifest } = await loadMarketplaceManifestSoftly(projectMp);
      // WR-02: filter to ONLY installed/upgradable rows. The project-side
      // enumeration also returns `available` and `unavailable` bucket rows
      // from the same shared manifest (cloned `marketplaceRoot`); folding
      // those into the user-scope block would duplicate every manifest-
      // listed plugin that is not installed in either scope (one row from
      // the project-side enumeration, one from the user-side's own
      // enumeration). The documented fold semantic is "fold installed
      // records from the other scope" -- restrict the carry-over set
      // accordingly.
      const projectSideRows = await enumerateMarketplacePlugins(
        opts,
        projectMp,
        "project",
        "user",
        manifest,
      );
      // RLD-04 / D-08: `installedRowMessage` emits `status: "installed"` with
      // `needsReload: false` for the steady-state inventory row. The
      // carry-over filter MUST discriminate on `"installed"` (plus the
      // `"upgradable"` and ENBL-04 `"disabled"` arms) so orphan-folded rows
      // survive (CR-01). A disabled record IS an installed record -- dropping
      // it here would both hide the row and let the user-side enumeration
      // re-emit the plugin as a duplicate `(available)`. FSTAT-02 / FSTAT-04 /
      // D-66-01 / D-66-02: the derived `force-installed` / `force-upgradable`
      // rows are likewise recorded-installed inventory and join the carry-over
      // set for the same reason (a force-installed orphan would otherwise vanish
      // AND duplicate as `(available)`). The integration regression for this
      // fold lives at tests/integration/fold-adoption.test.ts; the
      // orchestrator-level reproduction is in
      // tests/orchestrators/plugin/list.test.ts
      // ("CR-01 / G-21-01 fold-carryover...").
      folded = projectSideRows.filter(
        (r) =>
          r.status === "installed" ||
          r.status === "upgradable" ||
          r.status === "disabled" ||
          r.status === "force-installed" ||
          r.status === "force-upgradable",
      );
      // Record the folded plugin names so the user-scope manifest's
      // available-bucket enumeration skips them (catalog
      // `project-orphan-folded` state shows a single
      // `● alpha [project] ... (installed)` row -- no duplicate
      // `○ alpha (available)` row under the same header).
      foldedNames = new Set(folded.map((r) => r.name));
    }

    const built = await buildMarketplaceMessage({
      opts,
      mpName,
      mpScope: "user",
      mpRecord,
      autoupdate: userMerged.marketplaces[mpName]?.entry.autoupdate ?? false,
      extraPlugins: folded,
      excludeFromAvailable: foldedNames,
    });
    blocks.push(built);
  }

  // SC-6 scope narrowing: if the caller restricted the scope, only emit
  // blocks whose ORIGINATING scope matches. The fold rule still applied
  // above so the cross-scope visibility is preserved -- but the resulting
  // surface is filtered to the requested scope.
  const filtered =
    opts.scope === undefined ? blocks : blocks.filter((b) => b.emitScope === opts.scope);

  // MSG-GR-3 / CMC-03 sort: pre-sort the marketplace blocks AND the plugin
  // rows within each block at the orchestrator boundary per D-13-19
  // (CMC-03). : notify does NOT sort -- the caller owns iteration
  // order. Name primary case-insensitive, scope secondary
  // project-before-user.
  const sortedBlocks = [...filtered].sort((a, b) => compareMpForSort(a.mp, b.mp));
  return sortedBlocks.map(({ mp }) => ({
    ...mp,
    plugins: sortPluginsInBlock(mp.scope, mp.plugins),
  }));
}

/**
 * MSG-GR-3 marketplace-block comparator. Name primary
 * (case-insensitive base sensitivity), scope secondary
 * (project-before-user). Marketplaces always carry both `name` and
 * `scope` (the field is required on `MarketplaceNotificationMessage`).
 */
function compareMpForSort(a: MarketplaceRows<ListMsg>, b: MarketplaceRows<ListMsg>): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (byName !== 0) {
    return byName;
  }

  if (a.scope === b.scope) {
    return 0;
  }

  return a.scope === "project" ? -1 : 1;
}

/**
 * MSG-GR-3 in-block plugin sort. Name primary (case-insensitive base
 * sensitivity), scope secondary (project-before-user). Plugin rows in
 * `PluginAvailableMessage` / `PluginUnavailableMessage` variants do not
 * carry a `scope` field by construction (SNM-11); for sort purposes those
 * rows are treated as belonging to the owning marketplace's scope, which
 * yields a deterministic ordering against orphan-folded rows that DO
 * carry an explicit cross-scope `scope`.
 */
function sortPluginsInBlock<M extends PluginNotificationMessage>(
  marketplaceScope: Scope,
  plugins: readonly M[],
): readonly M[] {
  if (plugins.length === 0) {
    return plugins;
  }

  // SNM-11: `available` / `unavailable` variants have no `scope` field by
  // construction; the other list-surface variants (`installed` /
  // `upgradable`) carry an optional `scope`. The status-narrowing switch
  // is the only safe access path under TS strict. RLD-04 / D-08: the list
  // orchestrator emits the steady-state inventory row as `installed` (with
  // `needsReload: false`); the same `installed` token also carries the
  // cascade transition. The body `return p.scope ?? marketplaceScope`
  // preserves the cross-scope orphan-fold scope on a
  // `PluginInstalledMessage` (SNM-11 / D-13-18) instead of silently
  // overwriting it with `marketplaceScope`.
  const scopeOf = (p: PluginNotificationMessage): Scope => {
    switch (p.status) {
      // FSTAT-02 / FSTAT-04 / D-66-03: the derived force states are
      // scope-bearing list-surface variants and join the orphan-fold arm.
      case "upgradable":
      case "installed":
      case "disabled":
      case "force-installed":
      case "force-upgradable":
        // D-54-01 / ENBL-04: disabled rows carry an explicit `scope?` and
        // join the scope-bearing list-surface variants. The SNM-11 carve-out
        // applies only to `available` / `unavailable`.
        return p.scope ?? marketplaceScope;
      case "available":
      case "unavailable":
      case "unsupported":
        // USTAT-01 / SNM-11: the `unsupported` row has no `scope` field (the
        // carve-out covers `available` / `unavailable` / `unsupported`).
        return marketplaceScope;
      case "updated":
      case "reinstalled":
      case "uninstalled":
      case "failed":
      case "skipped":
      case "manual recovery":
      case "will install":
      case "will uninstall":
      case "will enable":
      case "will disable":
        // Unreachable on the list surface; renderer-as-spec guard. The
        // DIFF-02 will-* pending variants are emitted only by
        // `/claude:plugin pending`, which does not flow through this list
        // orchestrator.
        return marketplaceScope;
      default:
        // Exhaustiveness guard (matches `assertNever(resolved)` at list.ts:572):
        // when the switch is total, `p` narrows to `never` here and compiles; a
        // future PluginNotificationMessage status variant that is not handled
        // above makes `p` non-`never` and fails `npm run check`, instead of
        // silently relying on noImplicitReturns.
        return assertNever(p);
    }
  };

  return [...plugins].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (byName !== 0) {
      return byName;
    }

    const aScope = scopeOf(a);
    const bScope = scopeOf(b);
    if (aScope === bScope) {
      return 0;
    }

    return aScope === "project" ? -1 : 1;
  });
}

/**
 * WR-03: dedicated closed-set Reason narrower for orchestrator-level list
 * failures. Mirrors the `update.ts::narrowDirectFailReason` precedent:
 * errno-bearing FS errors map to the closed Reason that names the cause
 * class (`permission denied` / `source missing`); `SyntaxError` maps to
 * `unparseable` (state.json schema validation throws or JSON.parse
 * failures); the permissive fallback is `unreadable`.
 *
 * Distinct from `narrowProbeError`: that helper classifies per-row
 * resolver probe failures (NOT orchestrator-level list failures). Using
 * `narrowProbeError` for the catch path conflated two failure surfaces --
 * a `loadState` permission error here would surface as `{unreadable}`
 * which semantically describes a resolver probe failure, not a list
 * orchestration failure. The narrower here returns closed-set Reasons
 * accurate to the list-orchestration failure modes (loadState /
 * loadManifest / cross-scope walk throws).
 */
function narrowListFailReason(err: unknown): ListReason {
  return sharedNarrowProbeError(err);
}

/**
 * D-06 orchestrator entrypoint. Read-only listing of plugins. Constructs
 * the `NotificationMessage` payload inline and forwards it to a single
 * `notify(ctx, pi, message)` call per orchestration arm (success or
 * failure). `notify()` owns the single softDepStatus(pi) probe per
 * invocation and emits per-row `{requires pi-subagents}` /
 * `{requires pi-mcp}` markers when (declares AND companion unloaded).
 */
export async function listPlugins(opts: ListPluginsOptions): Promise<void> {
  const { ctx, pi } = opts;
  try {
    // OUT-07 / D-12: the list surface is a bulk op, so its row slot is typed
    // `Plural<Row>` (a readonly array). Additive typing only.
    // WR-01: loadPluginListPayload is typed to `MarketplaceRows<ListMsg>`, so the
    // annotation holds without a cast -- every plugin row it emits is a ListMsg
    // member by construction.
    const marketplaces: Plural<MarketplaceRows<ListMsg>> = await loadPluginListPayload(opts);
    // notify call mirrors the recipe at
    // orchestrators/plugin/uninstall.ts; list.ts substitutes the
    // list-surface plugin variants (available / unavailable / upgradable
    // / installed) per D-19-02. Severity (info; omitted 2nd arg) and
    // the `/reload to pick up changes` trailer are computed by the cascade
    // seam (the trailer fires when at least one
    // installed/updated/reinstalled/uninstalled plugin row is present;
    // pure available/unavailable/upgradable lists emit no trailer).
    notifyWithContext(ctx, pi, LIST_CONTEXT, marketplaces);
  } catch (err) {
    // Aggregate list-failure path. The list surface has no dedicated
    // catalog state for orchestrator-level failure (D-19-03 Option B):
    // construct a synthetic
    // `MarketplaceNotificationMessage` carrying a single
    // `PluginFailedMessage` so the renderer's 4-space-indent cause
    // chain surfaces the diagnostic verbatim. Severity is
    // computed as "error" by notify (any failed plugin row
    // -> error); no reload-hint (failed is not in the
    // state-changing variant set).
    //
    // WR-03: use the dedicated `narrowListFailReason` instead of
    // `narrowProbeError`. The two failure surfaces have different
    // semantics -- `narrowProbeError` classifies per-row resolver probe
    // failures (where `unreadable` means "we could not read the plugin
    // source"); `narrowListFailReason` classifies list-orchestration
    // failures (where `unreadable` means "we could not load state.json
    // or walk the marketplace records"). Both share the closed-set
    // `ListReason` codomain so the renderer accepts the result unchanged.
    const cause = err instanceof Error ? err : new Error(errorMessage(err));
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name: SYNTHETIC_LIST_FAILURE_PLUGIN_NAME,
      reasons: [narrowListFailReason(err)],
      cause,
      // D-03/D-06: a synthetic list-failure row -> error, no reload.
      severity: "error",
      needsReload: false,
    };
    const mp: MarketplaceRows<ListMsg> = {
      // WR-03: the `MarketplaceNotificationMessage` shape does not support
      // a failure-trailer channel separate from the marketplace-row form,
      // so use a conspicuously-synthetic placeholder name (mirrors the
      // `(reinstall)` / `(update)` precedent in reinstall.ts / update.ts).
      // The cause-chain trailer carries the actual diagnostic text via the
      // failedRow's `cause` field.
      name: SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME,
      scope: opts.scope ?? "user",
      plugins: [failedRow],
    };
    // OUT-07 / D-12: the synthetic list-failure surface emits exactly one
    // marketplace row, so its slot is typed `Single<Row>` (a 1-tuple).
    const failureRows: Single<MarketplaceRows<ListMsg>> = [mp];
    notifyWithContext(ctx, pi, LIST_CONTEXT, failureRows);
  }
}

/**
 * WR-03: synthetic identities used by the list-orchestration catch path.
 * Held as module-level constants so tests can assert against them and
 * future changes are gated behind a single edit point. Both render under
 * the cascade grammar as parens-wrapped tokens -- the renderer does
 * not special-case parens, so the visual marker reads as "synthetic
 * placeholder" to an operator scanning output.
 */
const SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME = "(list)";
const SYNTHETIC_LIST_FAILURE_PLUGIN_NAME = "(list)";

// Test-only re-export. Mirrors the `__test_classifyEntityShapeError` /
// `__test_classifyInstallFailure` precedent in `install.ts`: the helper
// is file-private but its classification table is the load-bearing
// contract that callers (and the user) rely on.
export { narrowProbeError as __test_narrowProbeError };
export { narrowListFailReason as __test_narrowListFailReason };
