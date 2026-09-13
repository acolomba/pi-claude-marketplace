import { resolveStrict } from "../../domain/plugin-resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import { makePresenceProbe } from "./git-source-probe.ts";
import { classifyInstalledRecord } from "./plugin-state-classifier.ts";

import type { ManifestLookup } from "../../domain/manifest-lookup.ts";
import type { ResolveContext } from "../../domain/resolver-types.ts";
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

async function probeUpgradeCandidate(
  manifestEntry: Parameters<typeof resolveStrict>[0],
  marketplaceRoot: string,
  pluginScope: Scope,
  cwd: string,
): Promise<Awaited<ReturnType<typeof resolveStrict>> | undefined> {
  const resolveContext: ResolveContext = {
    marketplaceRoot,
    resolveGitPluginRoot: makePresenceProbe(locationsFor(pluginScope, cwd)),
  };
  try {
    return await resolveStrict(manifestEntry, resolveContext);
  } catch {
    return undefined;
  }
}

/** Composes one exact installed-inventory row without network access. */
export async function composeInstalledListRow(
  options: ComposeInstalledListRowOptions,
): Promise<InstalledListRow> {
  const { pluginName, pluginScope, marketplaceScope, marketplaceRoot, record, lookup, cwd } =
    options;
  const manifestEntry = lookup.kind === "declared" ? lookup.entry : undefined;
  const notInManifest = lookup.kind === "absent";
  const upgradable =
    manifestEntry?.version !== undefined && manifestEntry.version !== record.version;
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

  const candidateResolved = upgradable
    ? await probeUpgradeCandidate(manifestEntry, marketplaceRoot, pluginScope, cwd)
    : undefined;
  const status = classifyInstalledRecord(
    record,
    upgradable ? { upgradable: true, resolved: candidateResolved } : { upgradable: false },
  );

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
