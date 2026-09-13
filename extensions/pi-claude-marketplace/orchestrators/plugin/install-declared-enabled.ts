import type { ScopeConfig } from "../../persistence/config-io.ts";

type PluginConfigMap = ScopeConfig["plugins"];
type PluginConfigEntry = NonNullable<PluginConfigMap>[string];

function entryFor(plugins: PluginConfigMap, key: string): PluginConfigEntry | undefined {
  return plugins?.[key];
}

/**
 * Reads the user's raw install-time enablement opinion across both config files.
 *
 * The local file replaces the base entry wholesale. Its entry therefore wins
 * by physical identity even when the `enabled` field itself is absent. The raw
 * tri-state is preserved so the install flow, not this selector, decides when
 * a plugin declaration may supply the effective default.
 */
export function resolveInstallDeclaredEnabled(args: {
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly targetIsLocal: boolean;
  readonly key: string;
}): boolean | undefined {
  const siblingPlugins = args.sibling?.plugins;
  const local = args.targetIsLocal ? args.current.plugins : siblingPlugins;
  const base = args.targetIsLocal ? siblingPlugins : args.current.plugins;
  return (entryFor(local, args.key) ?? entryFor(base, args.key))?.enabled;
}
