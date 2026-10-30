import { parsePluginSource } from "../../domain/source.ts";
import { declaredVersionWithPin, isSameVersion } from "../../domain/version.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import { resolveListCandidate } from "./list-candidate-version.ts";
import { classifyInstalledRecord } from "./plugin-state-classifier.ts";

import type { UpgradeCandidate } from "./plugin-state-classifier.ts";
import type { ManifestLookup, ManifestPluginEntry } from "../../domain/manifest-lookup.ts";
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
  readonly record: PluginInstallRecord;
  readonly lookup: ManifestLookup;
  readonly cwd: string;
}

function dependenciesFromRecord(record: PluginInstallRecord): readonly Dependency[] {
  const dependencies: Dependency[] = [];
  if (record.resources.agents.length > 0) {
    dependencies.push("agents");
  }

  if (record.resources.mcpServers.length > 0) {
    dependencies.push("mcp");
  }

  // WDEP-02: `workflows` pushes LAST, so a row that declares agents and mcp
  // renders the same two-marker brace whether or not it also declares workflows.
  if (record.resources.workflows.length > 0) {
    dependencies.push("workflows");
  }

  return dependencies;
}

function partiallyInstalledReasons(
  record: PluginInstallRecord,
  notInManifest: boolean,
): PluginPartiallyInstalledMessage["reasons"] {
  const unsupported = narrowUnsupportedKinds(record.compatibility.unsupported);
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
 */
export async function upgradeCandidate(
  manifestEntry: ManifestPluginEntry,
  options: ComposeInstalledListRowOptions,
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

  const candidate: UpgradeCandidate =
    manifestEntry === undefined
      ? { upgradable: false }
      : await upgradeCandidate(manifestEntry, options);
  const candidateResolved = candidate.upgradable ? candidate.resolved : undefined;
  const status = classifyInstalledRecord(record, candidate);

  if (status === "partially-installed" || status === "partially-installed-upgradable") {
    return {
      status: "partially-installed",
      name: pluginName,
      reasons: partiallyInstalledReasons(record, notInManifest),
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
    dependencies: dependenciesFromRecord(record),
    version: record.version,
    ...scopeField,
    ...descriptionField,
    ...notInManifestField,
    severity: "info",
    needsReload: false,
  };
}
