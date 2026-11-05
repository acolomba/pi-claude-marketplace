import { parsePluginSource } from "../../domain/source.ts";
import { declaredVersionWithPin, isSameVersion } from "../../domain/version.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import { resolveListCandidate } from "./list-candidate-version.ts";
import { readRecordMcpVerdict } from "./mcp-verdict-read.ts";
import { recordMcpDependency } from "./mcp-verdict.ts";
import { candidateFor, classifyInstalledRecord } from "./plugin-state-classifier.ts";

import type { UpgradeCandidate } from "./plugin-state-classifier.ts";
import type { ManifestLookup, ManifestPluginEntry } from "../../domain/manifest-lookup.ts";
import type {
  ActiveMcpImplementation,
  RecordedMcpServers,
} from "../../domain/mcp-implementation.ts";
import type { PluginInstallRecord } from "../../persistence/state-io.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  PluginDisabledMessage,
  PluginInstalledMessage,
  PluginPartiallyInstalledMessage,
  PluginPartiallyUpgradableMessage,
  PluginUpgradableMessage,
} from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";

export type InstalledListRow =
  | PluginDisabledMessage
  | PluginInstalledMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage
  | PluginUpgradableMessage;

/** Facts required to project one recorded plugin into its list inventory row. */
export interface ComposeInstalledListRowOptions {
  readonly pluginName: string;
  readonly pluginScope: Scope;
  readonly marketplaceScope: Scope;
  readonly marketplaceRoot: string;
  readonly marketplaceName: string;
  readonly marketplaceSource: unknown;
  /** The marketplace's cached `marketplace.json`, which a legacy record re-resolves against. */
  readonly manifestPath: string;
  readonly record: PluginInstallRecord;
  readonly lookup: ManifestLookup;
  readonly cwd: string;
  /** D-P3-05: the run's active MCP implementation, whose view the row shows. */
  readonly mcpImplementation: ActiveMcpImplementation;
}

/**
 * D-P3-10: the row's MCP dependency comes from the record's recorded servers,
 * not from the staged count, so it names the implementations that run them.
 */
function dependenciesFromRecord(
  record: PluginInstallRecord,
  recorded: RecordedMcpServers,
): readonly Dependency[] {
  const dependencies: Dependency[] = [];
  if (record.resources.agents.length > 0) {
    dependencies.push("agents");
  }

  const mcp = recordMcpDependency(recorded, record);
  if (mcp !== false) {
    dependencies.push(mcp);
  }

  // WDEP-02: `workflows` pushes LAST, so a row that declares agents and mcp
  // renders the same two-marker brace whether or not it also declares workflows.
  if (record.resources.workflows.length > 0) {
    dependencies.push("workflows");
  }

  return dependencies;
}

/**
 * D-P3-07 / D-MB-07: a partially-installed row carries only its MCP
 * dependency, so its marker can name the implementation that runs a server
 * the active one blocks; agents and workflows markers stay off on it.
 */
function mcpOnlyDependencies(
  record: PluginInstallRecord,
  recorded: RecordedMcpServers,
): Pick<PluginPartiallyInstalledMessage, "dependencies"> {
  const mcp = recordMcpDependency(recorded, record);
  return mcp === false ? {} : { dependencies: [mcp] };
}

function partiallyInstalledReasons(
  effectiveUnsupported: readonly string[],
  notInManifest: boolean,
): PluginPartiallyInstalledMessage["reasons"] {
  const unsupported = narrowUnsupportedKinds(effectiveUnsupported);
  return notInManifest ? ["not in manifest", ...unsupported] : unsupported;
}

function disabledReasonsField(notInManifest: boolean): Pick<PluginDisabledMessage, "reasons"> {
  return notInManifest ? { reasons: ["not in manifest"] } : {};
}

/** GV-01: the entry's version as an install would record it, pin included. */
function catalogVersion(entry: ManifestPluginEntry, marketplaceName: string): string | undefined {
  return entry.version === undefined
    ? undefined
    : declaredVersionWithPin(entry.version, parsePluginSource(entry.source), marketplaceName);
}

/**
 * PL-5 / VER-01 / VER-02: whether a newer candidate exists, decided by the one
 * version rule rather than the entry alone. The candidate version is the one
 * the offline derivation gives the tree, else the entry's, with GV-01's pin,
 * when no candidate resolves (a cold git source, a throw, or a tree with no
 * version). The resolved verdict travels only when the row is upgradable; a
 * cold candidate or a throw carries none (the CR-01 "could not assert" degrade).
 * The verdict is the resolver's neutral one (D-P3-01); the list row takes the
 * active implementation's view of it.
 */
export async function upgradeCandidate(
  manifestEntry: ManifestPluginEntry,
  options: Omit<ComposeInstalledListRowOptions, "manifestPath" | "mcpImplementation">,
): Promise<UpgradeCandidate> {
  const candidate = await resolveListCandidate(
    manifestEntry,
    {
      marketplaceRoot: options.marketplaceRoot,
      marketplaceName: options.marketplaceName,
      marketplaceSource: options.marketplaceSource,
    },
    locationsFor(options.pluginScope, options.cwd),
  ).catch((): undefined => undefined);
  const resolved = candidate?.kind === "resolved" ? candidate : undefined;
  const version = resolved?.version ?? catalogVersion(manifestEntry, options.marketplaceName);
  // GV-01: Claude Code compares the recorded string with the catalog's, so a
  // record at a release tag's commit (`<v>-<commit 12>`) is not `<v>`.
  if (version === undefined || isSameVersion(options.record.version, version)) {
    return { upgradable: false };
  }

  return { upgradable: true, resolved: resolved?.resolved };
}

/** Composes one exact installed-inventory row without network access. */
export async function composeInstalledListRow(
  options: ComposeInstalledListRowOptions,
): Promise<InstalledListRow> {
  const { pluginName, pluginScope, marketplaceScope, record, lookup } = options;
  const manifestEntry = lookup.kind === "declared" ? lookup.entry : undefined;
  const notInManifest = lookup.kind === "absent";
  const scopeField: { readonly scope?: Scope } =
    pluginScope === marketplaceScope ? {} : { scope: pluginScope };
  const descriptionField: { readonly description?: string } =
    manifestEntry?.description === undefined ? {} : { description: manifestEntry.description };

  if (isRecordedButDisabled(record)) {
    return {
      status: "disabled",
      name: pluginName,
      version: record.version,
      ...scopeField,
      ...descriptionField,
      ...disabledReasonsField(notInManifest),
      severity: "info",
      needsReload: false,
    };
  }

  // D-P3-04 / D-P3-05: the record's MCP verdict for the active
  // implementation, read offline, decides the row, so a switch needs no
  // reinstall.
  const { effective, recorded } = await readRecordMcpVerdict(
    record,
    {
      marketplaceName: options.marketplaceName,
      marketplace: {
        manifestPath: options.manifestPath,
        marketplaceRoot: options.marketplaceRoot,
        source: options.marketplaceSource,
      },
      pluginName,
    },
    options.mcpImplementation,
  );
  const candidate = candidateFor(
    manifestEntry === undefined
      ? { upgradable: false }
      : await upgradeCandidate(manifestEntry, options),
    options.mcpImplementation,
  );
  const candidateResolved = candidate.upgradable ? candidate.resolved : undefined;
  const status = classifyInstalledRecord(
    { enabled: record.enabled, compatibility: { unsupported: effective.unsupported } },
    candidate,
  );

  if (status === "partially-installed" || status === "partially-installed-upgradable") {
    return {
      status: "partially-installed",
      name: pluginName,
      reasons: partiallyInstalledReasons(effective.unsupported, notInManifest),
      ...mcpOnlyDependencies(record, recorded),
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }

  if (candidateResolved?.state === "partially-available") {
    return {
      status: "partially-upgradable",
      name: pluginName,
      reasons: narrowUnsupportedKinds(candidateResolved.unsupported),
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }

  if (status === "upgradable") {
    return {
      status: "upgradable",
      name: pluginName,
      reasons: [],
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }

  const notInManifestField: {
    readonly reasons?: NonNullable<PluginInstalledMessage["reasons"]>;
  } = notInManifest ? { reasons: ["not in manifest"] } : {};

  return {
    status: "installed",
    name: pluginName,
    dependencies: dependenciesFromRecord(record, recorded),
    version: record.version,
    ...scopeField,
    ...descriptionField,
    ...notInManifestField,
    severity: "info",
    needsReload: false,
  };
}
