import { extractEnabledPluginRefs } from "./refs.ts";

import type {
  ClaudeImportPlan,
  EnabledPluginRef,
  ImportDiagnostic,
  MarketplaceSourcePlanResult,
  PlannedMarketplaceSource,
  PlannedPluginImport,
  ScopedClaudeImportPlan,
  ScopedClaudeImportPlanInput,
  SkippedPluginImport,
} from "./types.ts";
import type { Scope } from "../../shared/types.ts";

const OFFICIAL_CLAUDE_MARKETPLACE = "claude-plugins-official";
const OFFICIAL_CLAUDE_MARKETPLACE_SOURCE = "anthropics/claude-plugins-official";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unmappableMarketplaceDiagnostic(scope: Scope, marketplace: string): ImportDiagnostic {
  return {
    severity: "warning",
    scope,
    code: "unmappable-marketplace-source",
    marketplace,
    message: `Skipping Claude marketplace ${JSON.stringify(marketplace)} because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).`,
  };
}

/**
 * D-76-13: read the nested upstream `{ source: { source: <kind>, ... } }`
 * shape into a source STRING the parser accepts. Marketplace-level url
 * sources support `ref` but NOT `sha` per the upstream docs. The `file`
 * shape (remote marketplace.json URL) and any unrecognized discriminator
 * stay unmappable (return undefined).
 */
function nestedMarketplaceSource(src: Record<string, unknown>): string | undefined {
  switch (src.source) {
    case "url": {
      if (typeof src.url !== "string") {
        return undefined;
      }

      const refSuffix = typeof src.ref === "string" ? `#${src.ref}` : "";
      return src.url + refSuffix;
    }

    case "github": {
      // The @ref form folds into a github source with ref (D-76-04).
      if (typeof src.repo !== "string") {
        return undefined;
      }

      const refSuffix = typeof src.ref === "string" ? `@${src.ref}` : "";
      return src.repo + refSuffix;
    }

    case "directory":
      return typeof src.path === "string" ? src.path : undefined;

    default:
      return undefined;
  }
}

/**
 * MURL-07 / D-76-13: read BOTH the flat legacy shape (`{directory}`,
 * `{github:{repo}}`) AND the upstream nested `{source:{...}}` shape. Reading
 * both is the no-regression path: the current code and its tests exercise
 * the flat shape, while the official docs (verified 2026-07-11) document only
 * the nested shape.
 */
function marketplaceSourceFromExtra(entry: unknown): string | undefined {
  if (!isPlainObject(entry)) {
    return undefined;
  }

  if (typeof entry.directory === "string") {
    return entry.directory;
  }

  const github = entry.github;
  if (isPlainObject(github) && typeof github.repo === "string") {
    return github.repo;
  }

  const source = entry.source;
  if (isPlainObject(source)) {
    return nestedMarketplaceSource(source);
  }

  return undefined;
}

/**
 * D-PL6-01: plans every marketplace Claude Code registers for the scope -- the
 * enabled plugins' marketplaces first, in settings order, then every other
 * `extraKnownMarketplaces` entry in settings order. D-PL6-08: the official
 * marketplace is planned only when an enabled plugin names it.
 */
function planMarketplaceSources(
  scope: Scope,
  refs: readonly EnabledPluginRef[],
  extraKnownMarketplaces: Record<string, unknown>,
): MarketplaceSourcePlanResult {
  const marketplacesToEnsure: PlannedMarketplaceSource[] = [];
  const diagnostics: ImportDiagnostic[] = [];
  const unmappableMarketplaces: string[] = [];
  const seen = new Set<string>();
  const planOne = (marketplace: string, source: string | undefined): void => {
    seen.add(marketplace);
    if (source === undefined) {
      unmappableMarketplaces.push(marketplace);
      diagnostics.push(unmappableMarketplaceDiagnostic(scope, marketplace));
      return;
    }

    marketplacesToEnsure.push({ scope, marketplace, source });
  };

  for (const ref of refs) {
    if (seen.has(ref.marketplace)) {
      continue;
    }

    planOne(
      ref.marketplace,
      ref.marketplace === OFFICIAL_CLAUDE_MARKETPLACE
        ? OFFICIAL_CLAUDE_MARKETPLACE_SOURCE
        : marketplaceSourceFromExtra(extraKnownMarketplaces[ref.marketplace]),
    );
  }

  for (const marketplace of Object.keys(extraKnownMarketplaces)) {
    if (!seen.has(marketplace) && marketplace !== OFFICIAL_CLAUDE_MARKETPLACE) {
      planOne(marketplace, marketplaceSourceFromExtra(extraKnownMarketplaces[marketplace]));
    }
  }

  return { marketplacesToEnsure, diagnostics, unmappableMarketplaces };
}

function scopedPlan(input: ScopedClaudeImportPlanInput): ScopedClaudeImportPlan {
  const extracted = extractEnabledPluginRefs(input.scope, input.settings);
  const marketplacePlan = planMarketplaceSources(
    input.scope,
    extracted.refs,
    input.settings.extraKnownMarketplaces,
  );
  const unmappable = new Set(marketplacePlan.unmappableMarketplaces);
  const pluginsToInstall: PlannedPluginImport[] = [];
  const skippedPlugins: SkippedPluginImport[] = [];

  for (const ref of extracted.refs) {
    if (unmappable.has(ref.marketplace)) {
      skippedPlugins.push({ scope: input.scope, ref, reason: "unmappable-marketplace-source" });
    } else {
      pluginsToInstall.push({ scope: input.scope, ref });
    }
  }

  return {
    scope: input.scope,
    settingsMarketplaces: [
      ...new Set([
        ...extracted.refs.map((ref) => ref.marketplace),
        ...Object.keys(input.settings.extraKnownMarketplaces),
      ]),
    ],
    marketplacesToEnsure: marketplacePlan.marketplacesToEnsure,
    pluginsToInstall,
    skippedPlugins,
    diagnostics: [...extracted.diagnostics, ...marketplacePlan.diagnostics],
  };
}

/**
 * Builds the per-scope import plan for every input scope's Claude settings:
 * the marketplaces to ensure, the plugins to install under them, the plugins
 * skipped for an unmappable marketplace source, and the diagnostics raised
 * along the way.
 */
export function buildClaudeImportPlan(
  inputs: readonly ScopedClaudeImportPlanInput[],
): ClaudeImportPlan {
  const scopes = inputs.map(scopedPlan);
  return {
    scopes,
    diagnostics: scopes.flatMap((scopePlan) => scopePlan.diagnostics),
  };
}
