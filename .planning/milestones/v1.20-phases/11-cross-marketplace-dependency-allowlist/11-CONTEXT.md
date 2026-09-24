# Phase 11: Cross-marketplace dependency allowlist - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse the root marketplace's `allowCrossMarketplaceDependenciesOn` list and use
it to decide whether a plugin install may bring in a dependency from another
marketplace. An already-installed dependency still satisfies the declaration.
The same parsed field feeds the read-only `marketplace info` surface. A refused
dependency fails the existing install cascade cleanly; the command never adds a
marketplace on the user's behalf.

</domain>

<decisions>
## Implementation Decisions

### Allowlist policy
- **D-11-01:** Only the marketplace of the root plugin being installed grants
  permission for new cross-marketplace dependency edges. An absent field is an
  empty list. A marketplace merely being added is not permission.
- **D-11-02:** Check whether the dependency is already installed in the target
  scope before checking the allowlist. An installed dependency satisfies the
  declaration even when its marketplace is absent from the list. Preserve the
  existing installed-first guard order.
- **D-11-03:** Do not add or clone a marketplace to satisfy a dependency.

### Marketplace info
- **D-11-04:** Render an `allowed_marketplaces:` line only when the parsed
  allowlist is nonempty. Omit it for both an absent field and an empty array.
  The info surface and the cascade must use the same parsed value.

### Malformed field
- **D-11-05:** A present `allowCrossMarketplaceDependenciesOn` value that is not
  an array of strings invalidates the marketplace manifest. Identify the field
  in the validation error. Do not coerce the value, discard invalid entries,
  or silently replace it with an empty list. This matches Claude Code 2.1.267.

### Refusal message
- **D-11-06:** Use the closed-set `cross-marketplace` reason. Its cause names
  the blocked dependency, the plugin that declared it, and the target
  marketplace. Explain both remedies: install the dependency manually first,
  or add the target marketplace to `allowCrossMarketplaceDependenciesOn` in the
  **root** marketplace's `marketplace.json`. Follow Pi's existing failed-row
  grammar; the information matches Claude Code without copying its exact
  output bytes.

### Agent discretion
- Choose list value separators, order, and line placement consistent with the
  existing `marketplace info` format. The label and omission rule are locked.
- Choose the sentence structure of the failure cause while retaining every
  fact and both remedies in D-11-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract and prior decisions
- `.planning/ROADMAP.md` §"Phase 11: Cross-marketplace dependency allowlist" —
  phase goal, three success criteria, and owner notes.
- `.planning/REQUIREMENTS.md` §"Cross-marketplace dependency allowlist (XMKT)" —
  XMKT-01 and XMKT-02.
- `.planning/HANDOFF-upstream-dependency-parity.md` — parity decision table,
  row 1, and the settled `cross-marketplace` reason.
- `.planning/phases/03-dependency-resolution/03-CONTEXT.md` — D-03-07's
  fail-clean cascade and D-03-08's no-auto-add boundary.
- `docs/dependency-resolution.md` — the user-facing dependency contract to
  update for the new allowlist rule.

### Output contract
- `docs/output-catalog.md` — closed-set reasons and rendered-row catalog.
- `docs/messaging-style-guide.md` — reason and cause-line grammar.

### Upstream primary references
- https://code.claude.com/docs/en/plugin-marketplaces — the marketplace
  schema declares `allowCrossMarketplaceDependenciesOn` as an array.
- https://code.claude.com/docs/en/plugin-dependencies — cross-marketplace
  default, root allowlist, and both remedies.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extensions/pi-claude-marketplace/domain/manifest.ts` has the compiled
  `MARKETPLACE_SCHEMA` and one cached manifest loader used by info and
  dependency reads.
- `extensions/pi-claude-marketplace/domain/dependency-closure.ts` records each
  edge, then checks installed keys before marketplace knowledge and recursive
  resolution. The allowlist check fits after the installed check.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts`
  maps closure failures to a failed dependency row with a cause and a root
  `{dependency failed}` row.

### Established Patterns
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` projects
  parsed manifest data into `MarketplaceInfoMessage`; the central renderer in
  `shared/notification-grammar.ts` emits labeled lines such as `description:`
  and `last_updated:`.
- User-visible reason tokens are a closed set pinned across the shared type,
  catalog, and architecture tests. The new reason must move those together.
- Manifest validation fails through `InvalidMarketplaceManifestError`, so a
  malformed allowlist can use the existing failure path.

### Integration Points
- The closure resolver needs the root marketplace's parsed allowlist threaded
  from each install entry point without changing the installed-first check.
- `MarketplaceInfoMessage` and `renderMarketplaceInfo` carry and render the
  selected nonempty `allowed_marketplaces:` line.
- Dependency failure composition renders the new reason and remedies through
  `notify`; no direct output writes belong in the command path.

</code_context>

<specifics>
## Specific Ideas

- **Info output:** The user chose to omit the field when absent or empty and
  chose `allowed_marketplaces:` over the raw JSON field name.
- **Invalid field evidence (2026-09-23, high confidence):** In an isolated
  temporary marketplace, Claude Code 2.1.267's `plugin validate --json`
  accepted an array of strings (exit 0), rejected a string (exit 1), and
  rejected an array containing a number (exit 1). `plugin marketplace add`
  also rejected the string with a schema error naming
  `allowCrossMarketplaceDependenciesOn`. The binary's schema declares an
  optional string array. No divergence is proposed.
- **Refusal evidence (2026-09-23, high confidence):** The Claude Code 2.1.267
  binary's `cross-marketplace` message names the dependency and declarer,
  describes the blocked target marketplace, and gives both remedies. The
  official dependency guide confirms the same behavior. Pi's cause-row shape
  differs, so match the information within that grammar.
- **Info presentation:** No Claude Code position is known for this extension's
  `marketplace info` line label or omission rule. These are Pi output choices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-cross-marketplace-dependency-allowlist*
*Context gathered: 2026-09-23*
