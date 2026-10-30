/**
 * The official marketplace names of Claude Code 2.1.310, copied from the
 * binary. Upstream lowercases a marketplace name before it checks this set.
 */
export const OFFICIAL_MARKETPLACE_NAMES: ReadonlySet<string> = new Set([
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

/** The official names whose autoupdate Claude Code 2.1.310 leaves off by default. */
const DEFAULT_OFF_OFFICIAL_NAMES: ReadonlySet<string> = new Set([
  "knowledge-work-plugins",
  "first-party-plugins",
]);

export function isOfficialMarketplaceName(name: string): boolean {
  return OFFICIAL_MARKETPLACE_NAMES.has(name.toLowerCase());
}

/**
 * D-PL8-07: the autoupdate setting that applies to a marketplace.
 * A config value wins; without one, autoupdate is on for an official name
 * other than the two default-off names, as in Claude Code. Claude Code also
 * turns it on for its `claudeai` and `pluginDirectory` sources, which have no
 * Pi counterpart.
 */
export function effectiveMarketplaceAutoupdate(name: string, value: boolean | undefined): boolean {
  if (value !== undefined) {
    return value;
  }

  return isOfficialMarketplaceName(name) && !DEFAULT_OFF_OFFICIAL_NAMES.has(name.toLowerCase());
}
