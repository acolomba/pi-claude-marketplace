// edge/completions/provider.ts
//
// `getArgumentCompletions(prefix, resolver)` dispatcher -- the single entry
// point Pi calls per keystroke. Five branches mirror the V1 dispatcher
// (PRD §6.7 TC-1..TC-6) with status-aware refinements per D-03 corollary.
//
// Branches in priority order:
//
//   1. TC-1 -- tokens.length === 0 -> top-level keywords
//      (install / uninstall / update / list / marketplace).
//   2. TC-4 -- prevToken === "--scope" -> user / project.
//   2b. TC-3 -- current.startsWith("-") -> flag names (--scope
//      always; --installed / --available / --unavailable when head ===
//      "list").
//   3. TC-2 -- head === "marketplace" && tokens.length === 1 -> nested
//      marketplace subcommand keywords, including aliases (`rm`, `ls`).
//   4. TC-6 -- head in {install, uninstall, update} && tokens.length === 1
//      -> `<plugin>@<marketplace>` via getPluginRefCompletions (status-
//      aware filter per D-03).
//   5. TC-5 -- (head === "list" && tokens.length === 1) ||
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
  buildItem,
  extractPositionals,
  getMarketplaceCompletions,
  getMarketplaceNamesAcrossScopes,
  getPluginRefCompletions,
  splitCompletionInput,
} from "./data.ts";

import type { LocationsResolver } from "./data.ts";
import type { AutocompleteItem } from "@mariozechner/pi-tui";

export const TOP_LEVEL_SUBCOMMANDS = [
  "install",
  "uninstall",
  "update",
  "list",
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
const MARKETPLACE_VERBS_WITH_NAME_ARG: readonly string[] = [
  "remove",
  "rm",
  "update",
  "autoupdate",
  "noautoupdate",
];

export async function getArgumentCompletions(
  prefix: string,
  resolver: LocationsResolver,
): Promise<AutocompleteItem[] | null> {
  const { tokens, current } = splitCompletionInput(prefix);
  const argumentTextPrefix = tokens.join(" ");
  const headPrefix = argumentTextPrefix === "" ? "" : argumentTextPrefix + " ";

  // Branch 1 (TC-1): top-level subcommand keyword.
  if (tokens.length === 0) {
    return TOP_LEVEL_SUBCOMMANDS.filter((s) => s.startsWith(current)).map((label) => ({
      label,
      value: label + " ",
    }));
  }

  const positionals = extractPositionals(tokens);
  const positionalHead = positionals[0] ?? "";

  // Branch 2a (TC-4): token immediately after `--scope`.
  const prevToken = tokens[tokens.length - 1];
  if (prevToken === "--scope") {
    return ["user", "project"]
      .filter((v) => v.startsWith(current))
      .map((v) => ({ label: v, value: `${headPrefix}${v} ` }));
  }

  // Branch 2b (TC-3): flag-name completion (- or -- prefix; pi only has
  // long flags so both behave identically).
  if (current.startsWith("-")) {
    const flags: { name: string; description?: string }[] = [
      { name: "--scope", description: "Scope: user or project" },
    ];
    if (positionalHead === "list") {
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
        ...(f.description !== undefined ? { description: f.description } : {}),
      }));
  }

  // Branch 3 (TC-2): nested marketplace subcommand keyword. The completion
  // value rebuilds the entire argumentText as `marketplace <chosen> ` --
  // the existing `marketplace` head is already in argumentTextPrefix, so
  // `headPrefix + label + " "` produces the correct shape.
  if (positionalHead === "marketplace" && positionals.length === 1) {
    return MARKETPLACE_SUBCOMMANDS.filter((s) => s.startsWith(current)).map((label) => ({
      label,
      value: `${headPrefix}${label} `,
    }));
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

  // Branch 5 (TC-5): marketplace-name positional for `list <here>` and
  // `marketplace <verb> <here>`. Skip `marketplace add` (free-form source)
  // and `marketplace list` (no positional).
  const wantsMarketplaceName =
    (positionalHead === "list" && positionals.length === 1) ||
    (positionalHead === "marketplace" &&
      positionals.length === 2 &&
      positionals[1] !== undefined &&
      MARKETPLACE_VERBS_WITH_NAME_ARG.includes(positionals[1]));
  if (wantsMarketplaceName) {
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
export { buildItem };
