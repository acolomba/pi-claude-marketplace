import path from "node:path";

import type { PluginEntry } from "./components/plugin.ts";
import type { StatKindReader } from "./resolver-types.ts";

/**
 * HOOK-01: the public closed set of supported component kinds. `hooks` is
 * admitted here even though component-path validation uses a narrower private
 * set: hook discovery owns the convention file `hooks/hooks.json` instead.
 */
export const SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"] as const;

/**
 * PR-3: a declaration or matching convention for these kinds selects the
 * `partially-available` arm and adds the note `contains <kind>`. A normal
 * install rejects that arm. With `--partial`, the install admits its supported
 * components.
 *
 * SECURITY (T-02-25): The list is closed. A new kind upstream that is in
 * neither closed set would be silently ignored. Re-audit when Claude Code adds
 * component kinds.
 *
 * D-90-06: `bin` is intentionally absent. A plugin's `<pluginRoot>/bin` is
 * runtime-honored through the PENV-01 PATH ledger, so a bin-shipping plugin
 * installs by default at Claude Code parity.
 */
export const UNSUPPORTED_COMPONENT_KINDS = [
  "lspServers",
  "monitors",
  "themes",
  "outputStyles",
  "channels",
  "userConfig",
  "settings",
  "workflows",
] as const;

/** One member of the closed unsupported-component vocabulary. */
export type UnsupportedComponentKind = (typeof UNSUPPORTED_COMPONENT_KINDS)[number];

const UNSUPPORTED_COMPONENT_CONVENTIONS: Partial<
  Record<
    UnsupportedComponentKind,
    readonly { readonly relativePath: string; readonly kind: "file" | "dir" }[]
  >
> = {
  lspServers: [{ relativePath: ".lsp.json", kind: "file" }],
  monitors: [{ relativePath: path.join("monitors", "monitors.json"), kind: "file" }],
  themes: [{ relativePath: "themes", kind: "dir" }],
  outputStyles: [{ relativePath: "output-styles", kind: "dir" }],
  settings: [{ relativePath: "settings.json", kind: "file" }],
  workflows: [{ relativePath: "workflows", kind: "dir" }],
};

function nestedExperimentalValue(
  record: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  const experimental = record?.experimental;
  if (typeof experimental !== "object" || experimental === null) {
    return undefined;
  }

  return (experimental as Record<string, unknown>)[key];
}

function declaresUnsupportedKind(
  kind: UnsupportedComponentKind,
  entry: Record<string, unknown>,
  manifest: Record<string, unknown> | null,
): boolean {
  if (entry[kind] !== undefined || manifest?.[kind] !== undefined) {
    return true;
  }

  // Current Claude Code schema nests these experimental components, while
  // older manifests may still use top-level fields.
  if (kind === "themes" || kind === "monitors") {
    return (
      nestedExperimentalValue(entry, kind) !== undefined ||
      nestedExperimentalValue(manifest, kind) !== undefined
    );
  }

  return false;
}

async function hasUnsupportedConvention(
  pluginRoot: string,
  kind: UnsupportedComponentKind,
  statKind: StatKindReader,
): Promise<boolean> {
  for (const convention of UNSUPPORTED_COMPONENT_CONVENTIONS[kind] ?? []) {
    if ((await statKind(path.join(pluginRoot, convention.relativePath))) === convention.kind) {
      return true;
    }
  }

  return false;
}

/**
 * Collects unsupported declarations and conventions in the closed-set order.
 * The injected stat reader keeps filesystem ownership with the resolver.
 */
export async function collectUnsupportedKinds(
  entry: Record<string, unknown>,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  statKind: StatKindReader,
): Promise<UnsupportedComponentKind[]> {
  const found: UnsupportedComponentKind[] = [];

  for (const kind of UNSUPPORTED_COMPONENT_KINDS) {
    if (declaresUnsupportedKind(kind, entry, manifest)) {
      found.push(kind);
      continue;
    }

    if (await hasUnsupportedConvention(pluginRoot, kind, statKind)) {
      found.push(kind);
    }
  }

  return found;
}

function entryDeclaresInstallDisabled(entry: PluginEntry): boolean {
  return entry.defaultEnabled === false;
}

/**
 * OUT-02 / OUT-03 / DFEN-04 / DFEN-05: the whole rule behind the read
 * surfaces' `{installs disabled}` claim.
 *
 * `list` and `info` source their manifest-side answer from the marketplace
 * entry and nothing else, including when a warm clone makes `plugin.json`
 * readable. The entry is available for every declared plugin without a
 * network call, so this keeps warm and cold rows identical. Only a literal
 * `false` is a declaration; absent and non-boolean values are silent.
 *
 * The row predicts an install, so an explicit user configuration declaration
 * wins in either direction. Only where the user is silent may the marketplace
 * entry make the claim.
 */
export function rowClaimsInstallDisabled(
  entry: PluginEntry,
  declaredEnabled: boolean | undefined,
): boolean {
  return declaredEnabled === undefined && entryDeclaresInstallDisabled(entry);
}
