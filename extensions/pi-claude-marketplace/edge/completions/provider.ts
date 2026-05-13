// edge/completions/provider.ts
//
// `getArgumentCompletions(prefix, resolver)` dispatcher -- the single entry
// point Pi calls per keystroke. Five branches mirror the V1 dispatcher
// (PRD §6.7 TC-1..TC-6) with status-aware refinements per D-03 corollary.
//
// Branches in priority order:
//
//   1. TC-1 -- tokens.length === 0 -> top-level keywords
//      (install / uninstall / update / list / ls / marketplace).
//   2. TC-4 -- prevToken === "--scope" -> user / project.
//   2b. TC-3 -- current.startsWith("-") -> flag names (--scope
//      always; --installed / --available / --unavailable when head ===
//      "list").
//   3. TC-2 -- head === "marketplace" && tokens.length === 1 -> nested
//      marketplace subcommand keywords, including aliases (`rm`, `ls`).
//   4. TC-6 -- head in {install, uninstall, update} && tokens.length === 1
//      -> `<plugin>@<marketplace>` via getPluginRefCompletions (status-
//      aware filter per D-03).
//   5. TC-5 -- (head in {list, ls} && tokens.length === 1) ||
//             (head === "marketplace" && tokens.length === 2 && verb in
//              {remove, rm, update, autoupdate, noautoupdate}) ->
//      marketplace names union across both scopes.
//
// Returns `null` when no completion makes sense at the cursor position --
// Pi-tui contract; NOT `[]` (06-RESEARCH line 493).
//
// `resolver` is the LocationsResolver from data.ts; constructed by
// register.ts (Plan 06-05) from persistence/ + domain/ surfaces and threaded
// through this dispatcher. Tests inject a hermetic mock resolver.

import {
  extractPositionals,
  getMarketplaceCompletions,
  getMarketplaceNamesAcrossScopes,
  getPluginRefCompletions,
  splitCompletionInput,
} from "./data.ts";

import type { LocationsResolver } from "./data.ts";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

export const TOP_LEVEL_SUBCOMMANDS = [
  "install",
  "uninstall",
  "update",
  "list",
  "ls",
  "marketplace",
] as const;

export const MARKETPLACE_SUBCOMMANDS = [
  "add",
  "remove",
  "rm",
  "list",
  "ls",
  "update",
  "autoupdate",
  "noautoupdate",
] as const;

/**
 * Verbs (after `marketplace`) that take a marketplace-name positional.
 * `add` and `list` are excluded (`add` takes a source URL; `list` has no
 * positional). `rm` is accepted as the router alias for `remove` and still
 * takes the same marketplace-name positional.
 */
const MARKETPLACE_VERBS_WITH_NAME_ARG = new Set([
  "remove",
  "rm",
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
  return ["user", "project"]
    .filter((v) => v.startsWith(current))
    .map((v) => ({ label: v, value: `${headPrefix}${v} ` }));
}

function flagCompletions(
  current: string,
  positionalHead: string,
  headPrefix: string,
): AutocompleteItem[] {
  const flags: { name: string; description?: string }[] = [
    { name: "--scope", description: "Scope: user or project" },
  ];
  if (positionalHead === "list" || positionalHead === "ls") {
    flags.push(
      { name: "--installed", description: "Show installed plugins" },
      { name: "--available", description: "Show available plugins" },
      { name: "--unavailable", description: "Show unavailable plugins" },
    );
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

  const positionals = extractPositionals(tokens);
  const positionalHead = positionals[0] ?? "";

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

  // Branch 4 (TC-6): <plugin>@<marketplace> for install / uninstall / update.
  // D-03 corollary: install hides `installed`; uninstall/update keep only
  // `installed`. `allowMarketplaceOnly` is true only for `update` (V1 parity
  // -- bare @<marketplace> means "update every installed plugin in this mp").
  if (positionalHead === "install" && positionals.length === 1) {
    return getPluginRefCompletions("install", current, argumentTextPrefix, resolver, {
      allowMarketplaceOnly: false,
    });
  }

  if (positionalHead === "uninstall" && positionals.length === 1) {
    return getPluginRefCompletions("uninstall", current, argumentTextPrefix, resolver, {
      allowMarketplaceOnly: false,
    });
  }

  if (positionalHead === "update" && positionals.length === 1) {
    return getPluginRefCompletions("update", current, argumentTextPrefix, resolver, {
      allowMarketplaceOnly: true,
    });
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
