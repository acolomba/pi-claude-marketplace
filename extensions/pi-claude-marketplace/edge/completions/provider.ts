// edge/completions/provider.ts
//
// `getArgumentCompletions(prefix, resolver)` dispatcher -- the single entry
// point Pi calls per keystroke. Five branches implement PRD §6.7 TC-1..TC-6
// with status-aware refinements per D-03 corollary.
//
// Branches in priority order:
//
//   1. TC-1 -- tokens.length === 0 -> top-level keywords
//      (install / uninstall / update / reinstall / list / ls / marketplace /
//       bootstrap / import).
//   2. TC-4 -- prevToken === "--scope" -> user / project.
//   2b. TC-3 -- current.startsWith("-") -> flag names (--scope
//      always; --installed / --available / --unavailable when head ===
//      "list").
//   3. TC-2 -- head === "marketplace" && tokens.length === 1 -> nested
//      marketplace subcommand keywords, including aliases (`rm`, `ls`).
//   4. TC-6 -- head in {install, uninstall, update, reinstall, info}
//      && tokens.length === 1 -> `<plugin>@<marketplace>` via
//      `getPluginRefCompletions`. The `info` mode unions every status
//      across both scopes; the orchestrator handles scope-mismatch via
//      the `{not added}` row.
//   5. TC-5 -- (head in {list, ls} && tokens.length === 1) ||
//             (head === "marketplace" && tokens.length === 2 && verb in
//              {remove, rm, info, update, autoupdate, noautoupdate}) ->
//      marketplace names union across both scopes. `info` is in the
//      verbs-with-name-arg set; `--scope` does not narrow the candidate
//      set (the orchestrator handles scope-mismatch).
//
// Returns `null` when no completion makes sense at the cursor position --
// Pi-tui contract; NOT `[]`.
//
// `resolver` is the LocationsResolver from data.ts; constructed by
// register.ts from persistence/ + domain/ surfaces and threaded through
// this dispatcher. Tests inject a hermetic mock resolver.

import { SCOPES } from "../../shared/types.ts";
import { MARKETPLACE_SUBCOMMANDS, TOP_LEVEL_SUBCOMMANDS } from "../router.ts";

import {
  extractPositionals,
  extractScope,
  getMarketplaceCompletions,
  getMarketplaceNamesAcrossScopes,
  getPluginRefCompletions,
  splitCompletionInput,
} from "./data.ts";

import type { LocationsResolver } from "./data.ts";
import type { Scope } from "../../shared/types.ts";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

/**
 * Verbs (after `marketplace`) that take a marketplace-name positional.
 * `add` and `list` are excluded (`add` takes a source URL; `list` has
 * no positional). `rm` is the router alias for `remove`. `info` takes
 * a marketplace-name positional and surfaces the TC-5 union; `--scope`
 * does not narrow it.
 */
const MARKETPLACE_VERBS_WITH_NAME_ARG = new Set([
  "remove",
  "rm",
  "info",
  "update",
  "autoupdate",
  "noautoupdate",
]);

function topLevelCompletions(current: string): AutocompleteItem[] {
  return TOP_LEVEL_SUBCOMMANDS.filter((s) => s.startsWith(current)).map((label) => ({
    label,
    value: label + " ",
  }));
}

function scopeValueCompletions(current: string, headPrefix: string): AutocompleteItem[] {
  // Enumerate via the canonical `SCOPES` constant; the architecture drift
  // guard (scope-order-drift.test.ts) enforces import-and-reuse here.
  return SCOPES.filter((v) => v.startsWith(current)).map((v) => ({
    label: v,
    value: `${headPrefix}${v} `,
  }));
}

function flagCompletions(
  current: string,
  positionalHead: string,
  headPrefix: string,
): AutocompleteItem[] {
  const flags: { name: string; description?: string }[] = [
    { name: "--scope", description: "Scope: user or project" },
  ];
  if (positionalHead === "reinstall") {
    flags.push({
      name: "--force",
      description:
        "Allow overwriting agents that previously had foreign content from this plugin's own install",
    });
  }

  if (positionalHead === "list" || positionalHead === "ls") {
    flags.push(
      { name: "--installed", description: "Show installed plugins" },
      { name: "--available", description: "Show available plugins" },
      { name: "--unavailable", description: "Show unavailable plugins" },
    );
  }

  if (positionalHead === "install" || positionalHead === "update") {
    // AG-7 opt-in: surface `--map-model` as a completion suggestion under
    // the install and update positional heads, mirroring the existing
    // list-flag pattern.
    flags.push({
      name: "--map-model",
      description: "Enable model field mapping in generated agents (default: omit)",
    });
  }

  return flags
    .filter((f) => f.name.startsWith(current))
    .map((f) => ({
      label: f.name,
      value: `${headPrefix}${f.name} `,
      ...optionalDescription(f.description),
    }));
}

function optionalDescription(description: string | undefined): { description?: string } {
  return description === undefined ? {} : { description };
}

function marketplaceSubcommandCompletions(current: string, headPrefix: string): AutocompleteItem[] {
  return MARKETPLACE_SUBCOMMANDS.filter((s) => s.startsWith(current)).map((label) => ({
    label,
    value: `${headPrefix}${label} `,
  }));
}

function isTopLevelSubcommand(token: string): token is (typeof TOP_LEVEL_SUBCOMMANDS)[number] {
  return TOP_LEVEL_SUBCOMMANDS.includes(token as (typeof TOP_LEVEL_SUBCOMMANDS)[number]);
}

function isMarketplaceSubcommand(token: string): token is (typeof MARKETPLACE_SUBCOMMANDS)[number] {
  return MARKETPLACE_SUBCOMMANDS.includes(token as (typeof MARKETPLACE_SUBCOMMANDS)[number]);
}

function promoteExactSubcommandToken(parts: { tokens: string[]; current: string }): {
  tokens: string[];
  current: string;
} {
  const { tokens, current } = parts;
  if (tokens.length === 0 && isTopLevelSubcommand(current)) {
    return { tokens: [current], current: "" };
  }

  if (tokens.length === 1 && tokens[0] === "marketplace" && isMarketplaceSubcommand(current)) {
    return { tokens: [tokens[0], current], current: "" };
  }

  return parts;
}

function marketplaceNameWanted(positionals: readonly string[]): boolean {
  const positionalHead = positionals[0] ?? "";
  return (
    ((positionalHead === "list" || positionalHead === "ls") && positionals.length === 1) ||
    (positionalHead === "marketplace" &&
      positionals.length === 2 &&
      positionals[1] !== undefined &&
      MARKETPLACE_VERBS_WITH_NAME_ARG.has(positionals[1]))
  );
}

type PluginRefMode =
  | "install"
  | "uninstall"
  | "update"
  | "reinstall"
  | "info"
  | "enable"
  | "disable";

interface PluginRefBranchConfig {
  readonly mode: PluginRefMode;
  readonly allowMarketplaceOnly: boolean;
  readonly targetScope?: Scope;
}

function pluginRefBranchConfig(
  positionalHead: string,
  explicitScope: Scope | undefined,
): PluginRefBranchConfig | null {
  switch (positionalHead) {
    case "install":
      return { mode: "install", allowMarketplaceOnly: false, targetScope: explicitScope ?? "user" };
    case "uninstall":
      return {
        mode: "uninstall",
        allowMarketplaceOnly: false,
        ...(explicitScope !== undefined && { targetScope: explicitScope }),
      };
    case "update":
      return {
        mode: "update",
        allowMarketplaceOnly: true,
        ...(explicitScope !== undefined && { targetScope: explicitScope }),
      };
    case "reinstall":
      return {
        mode: "reinstall",
        allowMarketplaceOnly: true,
        ...(explicitScope !== undefined && { targetScope: explicitScope }),
      };
    case "info":
      // `info` requires both halves of the `<plugin>@<marketplace>` ref
      // (no bare `@<marketplace>` form). `--scope` does not narrow the
      // candidate set -- the orchestrator handles scope mismatch via
      // the `{not added}` row.
      return {
        mode: "info",
        allowMarketplaceOnly: false,
        ...(explicitScope !== undefined && { targetScope: explicitScope }),
      };
    case "enable":
      // D-54-01 / ENBL-01: enable targets recorded plugins (the state record
      // exists; the empty-resources marker discriminates disabled from
      // populated, but the completion surface accepts any installed plugin).
      // Reuse the installed-only completion (mirrors `uninstall`).
      return {
        mode: "enable",
        allowMarketplaceOnly: false,
        ...(explicitScope !== undefined && { targetScope: explicitScope }),
      };
    case "disable":
      // D-54-01 / ENBL-02: disable targets installed plugins (the state
      // record must exist). Reuse the installed-only completion.
      return {
        mode: "disable",
        allowMarketplaceOnly: false,
        ...(explicitScope !== undefined && { targetScope: explicitScope }),
      };
    default:
      return null;
  }
}

export async function getArgumentCompletions(
  prefix: string,
  resolver: LocationsResolver,
): Promise<AutocompleteItem[] | null> {
  const { tokens, current } = promoteExactSubcommandToken(splitCompletionInput(prefix));
  const argumentTextPrefix = tokens.join(" ");
  const headPrefix = argumentTextPrefix === "" ? "" : argumentTextPrefix + " ";

  // Branch 1 (TC-1): top-level subcommand keyword.
  if (tokens.length === 0) {
    return topLevelCompletions(current);
  }

  const rawHead = extractPositionals(tokens)[0] ?? "";
  const positionals = extractPositionals(tokens, rawHead === "reinstall" ? ["--force"] : []);
  const positionalHead = positionals[0] ?? "";
  const explicitScope = extractScope(tokens);

  // Branch 2a (TC-4): token immediately after `--scope`.
  const prevToken = tokens.at(-1);
  if (prevToken === "--scope") {
    return scopeValueCompletions(current, headPrefix);
  }

  // Branch 2b (TC-3): flag-name completion (- or -- prefix; pi only has
  // long flags so both behave identically).
  if (current.startsWith("-")) {
    return flagCompletions(current, positionalHead, headPrefix);
  }

  // Branch 3 (TC-2): nested marketplace subcommand keyword. The completion
  // value rebuilds the entire argumentText as `marketplace <chosen> ` --
  // the existing `marketplace` head is already in argumentTextPrefix, so
  // `headPrefix + label + " "` produces the correct shape.
  if (positionalHead === "marketplace" && positionals.length === 1) {
    return marketplaceSubcommandCompletions(current, headPrefix);
  }

  // Branch 4 (TC-6): <plugin>@<marketplace> for install / uninstall / update / reinstall.
  // CMP-6..8: install completion follows target-scope/source-marketplace
  // visibility and is available-only. Uninstall/update/reinstall consume installed
  // plugins, with project precedence when --scope is omitted. `allowMarketplaceOnly`
  // is true for update and reinstall (bare `@<marketplace>` operates on every
  // installed plugin in that marketplace).
  const pluginRefConfig = pluginRefBranchConfig(positionalHead, explicitScope);
  if (pluginRefConfig !== null && positionals.length === 1) {
    const { mode, ...options } = pluginRefConfig;
    return getPluginRefCompletions(mode, current, argumentTextPrefix, resolver, options);
  }

  // Branch 5 (TC-5): marketplace-name positional for `list <here>` / `ls <here>` and
  // `marketplace <verb> <here>`. Skip `marketplace add` (free-form source)
  // and `marketplace list` (no positional).
  if (marketplaceNameWanted(positionals)) {
    return getMarketplaceCompletions(
      await getMarketplaceNamesAcrossScopes(resolver),
      current,
      argumentTextPrefix,
    );
  }

  // No completion makes sense at this cursor position -- Pi-tui contract
  // requires `null` here, NOT `[]` (the latter would suppress the file-
  // completion fallback when irrelevant; null lets Pi-tui try other
  // providers).
  return null;
}

// Re-export buildItem so unit tests of the dispatcher can compare values.
export { buildItem } from "./data.ts";
