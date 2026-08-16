# Phase 101: Manifest field and precedence resolution - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

`defaultEnabled` becomes an optional boolean on both declaration sites — the
marketplace plugin entry and `plugin.json` — and the "marketplace entry wins"
precedence rule is evaluated exactly once, inside the resolver, so that no later
consumer re-derives it.

This phase is schema plus resolution only. Nothing a user can observe changes:
install, list, info, update, reinstall and reconcile all produce identical
output to today for every plugin, including one that declares
`defaultEnabled: false`. The install path merely gains the ability to *read* the
resolved value; acting on it is Phase 102.

</domain>

<decisions>
## Implementation Decisions

### Where the resolved value hangs on the resolver output

- **D-101-01:** The resolved value lands in `MATERIALIZABLE_FIELDS`
  (`domain/resolver.ts`), so it appears on the `installable` and
  `partially-available` arms by construction and is absent from `unavailable`.
  The `unavailable` arm stays the minimal structural-defect arm per D-64-05: a
  plugin that cannot be installed at all has no meaningful install-time
  enablement answer.
- **D-101-02:** The field is **always present** and non-optional
  (`Type.Boolean()`), not `Type.Optional`. The "absent at both sites means
  `true`" default is applied once, at resolution. This is precisely what DFEN-03
  buys — an optional field would push the default back onto every consumer,
  which is the outcome the requirement exists to prevent.
  — **Reversibility:** costly — `MATERIALIZABLE_FIELDS` is a shared shape
  constructed at 17 sites, so removing the field later is a coordinated edit.
- **D-101-03:** The field is named `defaultEnabled`, matching the manifest field
  name, so no mental translation is needed between the declaration and the
  resolved value.
- **D-101-04:** Both `resolveStrict` and `resolveLoose` resolve it, identically.
  `resolveLoose` already reads `plugin.json` through `preflightStages`, so
  making the value mode-dependent would hand the read-surface phase an
  inconsistency it would then have to explain.

### Precedence semantics

- **D-101-05:** The precedence rule lives in **one private helper** in
  `domain/resolver.ts`, called from the shared resolution path that both modes
  already pass through. Not exported from `domain/components/plugin.ts` (that
  module is schema-only), and not inlined at the arm constructors (that would be
  the per-consumer re-derivation DFEN-03 forbids).
- **D-101-06:** "Not declared" is tested with `=== undefined`, per the explicit
  instruction in the `domain/components/plugin.ts` file header: TypeBox
  `Type.Optional` produces `T | undefined` in `Static<>`, not `T?`, so
  `=== undefined` is correct and `in` is not.
- **D-101-07:** The entry wins over the manifest **in both directions**, not only
  the false-wins direction. Entry `true` + manifest `false` resolves `true`. This
  is the asymmetry a reader is most likely to guess wrong, so it gets its own
  pinned test rather than riding along on the false-wins case.
- **D-101-08:** A manifest-only `defaultEnabled`, with the entry silent, is
  **not** a loose-mode declaration conflict. `defaultEnabled` is metadata, in the
  same class as `description` and `version`; the loose-mode conflict rule
  (MM-6/MM-7) applies only to component declarations and `mcpServers`. Declaring
  the field in `plugin.json` alone must never push a plugin to `unavailable`.
- **D-101-09:** A null/unreadable manifest falls back to the entry value, and
  then to `true` — the same path as an absent declaration.

### Validation and the no-op guarantee

- **D-101-10:** A non-boolean `defaultEnabled` fails as a plain TypeBox schema
  violation with no bespoke error class and no coercion. In a marketplace entry
  that is `InvalidMarketplaceManifestError` raised at manifest load
  (`domain/manifest.ts`, `MARKETPLACE_VALIDATOR.Check`); in `plugin.json` it is
  the existing `readManifest` validation-failure path, which resolves
  `unavailable` with the existing reason string.
- **D-101-11:** The blast radius is deliberately unchanged: because
  `PLUGIN_ENTRY_SCHEMA` is validated as part of `MARKETPLACE_SCHEMA`, one
  malformed `defaultEnabled` invalidates the whole `marketplace.json`, exactly as
  a non-string `version` does today. DFEN-01 asks for "the same way any other
  schema violation does", so no per-plugin skip is introduced.
- **D-101-12:** Criterion 5 (nothing observable changes) is proven **in this
  phase** by characterization tests: a plugin declaring `defaultEnabled: false`
  still resolves `installable` and still installs *enabled* here. The full
  six-surface byte-identical sweep remains DFEN-08's job in the closing phase;
  this is the narrow proof that the schema and resolver edits alone changed
  nothing.
- **D-101-13:** The D-09 lenient unknown-key tolerance is pinned with a test that
  a plugin declaring an unrelated unknown key still resolves — a cheap regression
  guard on the schema edit.

### Claude's Discretion

- The exact name and signature of the private precedence helper.
- Whether the resolved value threads through `PartialResolution` or is computed
  at `decideResolution` time, provided it is computed once and both modes share
  it.
- Test file placement and naming, following existing `tests/domain/` conventions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `PLUGIN_METADATA_FIELDS` (`domain/components/plugin.ts:18`) currently holds
  only `description` and `version` and is spread into both
  `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA`. This is the single
  insertion point DFEN-01 names — one added line covers both declaration sites.
- `MATERIALIZABLE_FIELDS` (`domain/resolver.ts:160`) is the field bag spread
  into `ResolvedPluginInstallableSchema` and
  `ResolvedPluginPartiallyAvailableSchema`, keeping the two arms
  token-identical by construction. Adding the field there covers both arms.
- `PartialResolution` is the per-resolution accumulator both modes build before
  handing off to `decideResolution`.

### Established Patterns

- Resolution funnels through `decideResolution(name, pluginRoot, partial,
  structuralDirty)` → `installable()` / `partiallyAvailable()` / `unavailable()`
  for both `resolveStrict` and `resolveLoose`. One change point serves both.
- Entry-over-manifest precedence already exists for component paths (the
  "entry > manifest order" union in strict mode), so the direction of
  precedence has house precedent — but it is implemented per component kind,
  not as a shared metadata mechanism.
- `readManifest` (`domain/resolver.ts:578`) returns
  `{ ok: true, manifest: Record<string, unknown> | null }` or
  `{ ok: false, reason }`; a `null` manifest means "no `plugin.json` on disk"
  and is a normal, non-failing outcome.
- Schemas are JIT-compiled once into `*_VALIDATOR` constants (D-07) and reused.

### Integration Points

- `domain/components/plugin.ts` — the schema edit (`PLUGIN_METADATA_FIELDS`).
- `domain/resolver.ts` — `MATERIALIZABLE_FIELDS`, the precedence helper, and the
  shared build path feeding `decideResolution`.
- `orchestrators/plugin/install.ts` reads the resolver output and is the
  consumer DFEN-03 exists to serve — but it only *reads* in this phase; the
  behavior change is Phase 102.
- No persistence, no `state.json` schema change, no migration.

### Notable

- No metadata field is *resolved* today. `description` and `version` are
  schema-accepted and read straight off the entry by the `info` surface.
  `defaultEnabled` is the first metadata field with genuine entry-vs-manifest
  precedence, so the helper it introduces has no existing analog to copy.

</code_context>

<specifics>
## Specific Ideas

- Upstream contract, verified 2026-08-14 against
  `code.claude.com/docs/en/plugins-reference`: `defaultEnabled` defaults to
  `true`; the marketplace entry value takes precedence over `plugin.json`;
  Claude Code v2.1.154+ honors it and earlier versions ignore it and enable on
  install.
- Test the entry-`true`-beats-manifest-`false` direction explicitly, not only
  the entry-`false`-beats-manifest-`true` direction.

</specifics>

<deferred>
## Deferred Ideas

- Acting on the resolved value at install time — recording the plugin disabled
  and writing `enabled: false` through to `claude-plugins.json` — is Phase 102
  (DFEN-04, DFEN-05).
- Whether `list` and `info` read a warm clone's `plugin.json` for the value, and
  the resulting warm-vs-cold rendering divergence, is Phase 104's design
  question (OUT-05). It is explicitly not settled here.
- The full six-surface byte-identical no-op sweep is Phase 105 (DFEN-08).
- The two milestone-level open questions (install-ledger materialization path
  for a disabled install; orchestrated-mode installs and the pre-existing config
  entry) belong to Phase 102's discuss session and must not be resolved here.

</deferred>
