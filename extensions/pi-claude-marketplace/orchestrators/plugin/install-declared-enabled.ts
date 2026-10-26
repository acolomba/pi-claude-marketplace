import { ownValue } from "../../shared/own-key.ts";

import type { ScopeConfig } from "../../persistence/config-io.ts";

type PluginConfigMap = ScopeConfig["plugins"];
type PluginConfigEntry = NonNullable<PluginConfigMap>[string];

function entryFor(plugins: PluginConfigMap, key: string): PluginConfigEntry | undefined {
  return ownValue(plugins, key);
}

/**
 * DFEN-05 / LAYER-09: reads the user's raw install-time enablement opinion
 * across the scope's two layers.
 *
 * The merge reads `enabled` field by field, so this read does too: the local
 * entry's `enabled` wins when it is set, and the base entry's applies
 * otherwise. The raw tri-state is preserved (`undefined` when neither layer
 * sets it) so the install flow, not this selector, decides when a plugin
 * declaration may supply the effective default.
 */
export function resolveInstallDeclaredEnabled(args: {
  readonly current: ScopeConfig;
  readonly other: ScopeConfig | undefined;
  readonly targetIsLocal: boolean;
  readonly key: string;
}): boolean | undefined {
  const otherPlugins = args.other?.plugins;
  const local = args.targetIsLocal ? args.current.plugins : otherPlugins;
  const base = args.targetIsLocal ? otherPlugins : args.current.plugins;
  return entryFor(local, args.key)?.enabled ?? entryFor(base, args.key)?.enabled;
}
