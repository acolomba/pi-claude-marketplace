import path from "node:path";

import type { PluginEntry } from "./components/plugin.ts";
import type { StatKindReader } from "./resolver-types.ts";

/**
 * PR-3: a declaration or matching convention for these kinds selects the
 * `partially-available` arm and adds the note `contains <kind>`. A normal
 * install rejects that arm. With `--partial`, the install admits its supported
 * components.
 *
 * SECURITY (T-02-25): The list is closed. A new kind upstream that is in
 * neither closed set would be silently ignored. Re-audit when Claude Code adds
 * component kinds. The last audit, on 2026-10-06, read the Claude Code 2.1.291
 * binary and https://code.claude.com/docs/en/plugins/mods/reference.
 *
 * `mod` is a hooks module. A hooks file declares one with a
 * non-empty top-level `modules` array. Hooks resolution checks
 * `hooks/hooks.json` and each hooks file that the `hooks` field names by a
 * path, and reports the result as `declaresHookModule`. No plugin field
 * selects this kind.
 *
 * `syntaxHighlighting` adds highlight.js languages to the terminal
 * UI, like `themes`. It and `outputStyles` also count when nested under
 * `experimental`, as `themes` and `monitors` do.
 *
 * Claude Code downloads the files of a non-empty `binaries` map
 * into `bin/` only when the marketplace name, in lowercase, is in its
 * official set. So `binaries` counts only for those marketplaces, and the
 * field changes nothing for any other marketplace, as in Claude Code.
 *
 * D-90-06: `bin` is intentionally absent. A plugin's `<pluginRoot>/bin` is
 * runtime-honored through the PENV-01 PATH ledger, so a bin-shipping plugin
 * installs by default at Claude Code parity.
 */
const UNSUPPORTED_COMPONENT_KINDS = [
  "lspServers",
  "monitors",
  "themes",
  "outputStyles",
  "channels",
  "userConfig",
  "settings",
  "syntaxHighlighting",
  "mod",
  "binaries",
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
};

// Current Claude Code schemas nest these components under `experimental`,
// while older manifests may still use top-level fields.
const EXPERIMENTAL_KINDS: ReadonlySet<UnsupportedComponentKind> = new Set([
  "themes",
  "monitors",
  "outputStyles",
  "syntaxHighlighting",
]);

/**
 * The official marketplace names of Claude Code 2.1.291, copied
 * from the binary. Upstream lowercases a marketplace name before it checks
 * this set.
 */
const OFFICIAL_MARKETPLACE_NAMES: ReadonlySet<string> = new Set([
  "claude-code-marketplace",
  "claude-code-plugins",
  "claude-plugins-official",
  "anthropic-marketplace",
  "anthropic-plugins",
  "agent-skills",
  "anthropic-agent-skills",
  "life-sciences",
  "knowledge-work-plugins",
  "claude-for-legal",
  "claude-for-financial-services",
  "financial-services-plugins",
  "first-party-plugins",
  "claude-tag-plugins",
]);

function isNonEmptyMap(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function declaresOfficialBinaries(input: {
  readonly entry: Record<string, unknown>;
  readonly manifest: Record<string, unknown> | null;
  readonly marketplaceName: string;
}): boolean {
  if (!OFFICIAL_MARKETPLACE_NAMES.has(input.marketplaceName.toLowerCase())) {
    return false;
  }

  return isNonEmptyMap(input.entry.binaries) || isNonEmptyMap(input.manifest?.binaries);
}

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
  input: {
    readonly entry: Record<string, unknown>;
    readonly manifest: Record<string, unknown> | null;
    readonly declaresHookModule: boolean;
    readonly marketplaceName: string;
  },
): boolean {
  if (kind === "mod") {
    return input.declaresHookModule;
  }

  if (kind === "binaries") {
    return declaresOfficialBinaries(input);
  }

  const { entry, manifest } = input;
  if (entry[kind] !== undefined || manifest?.[kind] !== undefined) {
    return true;
  }

  if (EXPERIMENTAL_KINDS.has(kind)) {
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
    // eslint-disable-next-line no-await-in-loop -- the first matching convention ends the probe
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
  input: {
    readonly entry: Record<string, unknown>;
    readonly manifest: Record<string, unknown> | null;
    readonly pluginRoot: string;
    readonly declaresHookModule: boolean;
    readonly marketplaceName: string;
  },
  statKind: StatKindReader,
): Promise<UnsupportedComponentKind[]> {
  const found: UnsupportedComponentKind[] = [];

  for (const kind of UNSUPPORTED_COMPONENT_KINDS) {
    if (declaresUnsupportedKind(kind, input)) {
      found.push(kind);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- bounded by the fixed unsupported-kind list, a few stats each
    if (await hasUnsupportedConvention(input.pluginRoot, kind, statKind)) {
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
