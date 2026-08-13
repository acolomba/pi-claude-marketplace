---
spike: 004
name: claude-plugin-dependency-spec
type: standard
validates: "Given Anthropic's official Claude Code plugin/marketplace docs, when researched for a `dependencies` field, then determine whether it exists, its shape, and what Claude Code itself does with it at install time"
verdict: VALIDATED
related: [005]
tags: [claude-code, plugin-dependencies, upstream-spec, research]
---

# Spike 004: Claude Plugin Dependency Spec

## What This Validates

Given Anthropic's official Claude Code documentation, when researched for a
`dependencies` field on plugins, then determine whether Claude Code plugins
support declaring dependencies on other plugins, and if so, exactly how
declaration, resolution, and installation are implemented.

## Research

Sources consulted (official Anthropic docs, primary source):

- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) —
  complete `plugin.json` schema
- [Constrain plugin dependency versions](https://code.claude.com/docs/en/plugin-dependencies)
  — the dedicated deep-dive page for this exact feature
- [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
  — `marketplace.json` schema, `allowCrossMarketplaceDependenciesOn`
- [Create plugins](https://code.claude.com/docs/en/plugins) — general plugin
  authoring guide (no dependency content beyond a pointer to the reference)

Also inspected, as corroborating (non-authoritative) signal:

- [anthropics/claude-code#48864](https://github.com/anthropics/claude-code/issues/48864)
  (closed, filed 2026-04-16) — a docs bug: "Claude Code v2.1.110 fixed plugin
  install not honoring dependencies declared in `plugin.json` when the
  marketplace entry omits them; `/plugin install` now lists auto-installed
  dependencies. That behavior is currently undocumented." This establishes
  that dependency auto-install already existed by v2.1.110 and was being
  actively hardened, not newly invented.
- [anthropics/claude-code#9444](https://github.com/anthropics/claude-code/issues/9444)
  (still open, filed 2025-10-12) — the original feature request that
  proposed this exact shape (`dependencies` map, "library"-type plugins,
  automatic resolution). Predates implementation; superseded in fact by what
  shipped, but never closed/linked, so it reads misleadingly as "not
  supported" if found in isolation. **Trap:** a shallow search on this
  question turns up this open issue first and concludes "no" — the reference
  docs (a different, authoritative source) say otherwise.

**No approach comparison table** — this is a single external fact-finding
question, not a build decision with competing implementations.

## What to Expect

N/A — pure documentation research, no runnable artifact for this spike.
Spike 005 is the runnable companion that exercises this repo's own handling
of the same field against the real resolver code.

## Investigation Trail

1. **First pass (WebSearch, 2 queries):** surfaced conflicting signals in
   the auto-generated summaries — one implied auto-install exists
   ("undocumented" per a closed DOCS issue), the other implied it's still
   just a feature request. Did not trust either summary; went to primary
   sources.
2. **Fetched issue #48864 and #9444 directly** (WebFetch, full issue body +
   state + dates). Confirmed #48864 is closed and describes a *bug fix* to
   already-existing auto-install behavior (v2.1.110), while #9444 is an
   **older, still-open, unrelated-in-status** feature request from before
   the feature shipped. The two are not in tension once dated and read in
   full — #9444 was simply never closed even though its ask now matches
   shipped behavior.
3. **Fetched the "Create plugins" guide.** No dependency content beyond a
   pointer to `plugins-reference#plugin-manifest-schema`. Confirms
   dependencies are not part of the beginner quickstart surface.
4. **Fetched `plugins-reference` (96KB, truncated in the tool's inline
   preview).** Grepped the persisted full-text file for "dependenc" rather
   than re-fetching with a narrower prompt — found the complete-schema JSON
   example and the component-path field table, both containing
   `dependencies`.
5. **Fetched the dedicated `plugin-dependencies` page** — the authoritative,
   complete treatment. This single page answered every follow-up question
   (version constraints, cross-marketplace, enable/disable cascade, prune,
   error taxonomy) without further searching.
6. **Cross-checked `plugin-marketplaces`** (grepped the persisted file) to
   confirm `allowCrossMarketplaceDependenciesOn` lives in `marketplace.json`
   at the root level, not per-plugin, and that marketplace entries can also
   carry their own `dependencies` array (overriding/supplementing
   `plugin.json`'s).

No dead ends beyond the initial WebSearch-summary confusion in step 1 —
once primary sources were fetched directly, the picture was internally
consistent and unambiguous.

## Results

**VALIDATED.** Yes — Claude Code plugins support declaring dependencies on
other plugins, and it is a fully operational, non-trivial feature, not a
stub or informational-only declaration.

### Schema (as documented today)

`dependencies` is a top-level array field in `.claude-plugin/plugin.json`
(and may also appear per-entry in a marketplace's `marketplace.json`). Each
array element is either:

- a bare string — the plugin name, unversioned, resolved in the same
  marketplace as the declaring plugin: `"audit-logger"`
- an object with:
  - `name` (string, required) — plugin name
  - `version` (string, optional) — a semver range (`~2.1.0`, `^2.0`,
    `>=1.4`, `=2.1.0`); pre-releases excluded unless the range opts in
    (`^2.0.0-0`)
  - `marketplace` (string, optional) — resolve `name` in a *different*
    marketplace than the declaring plugin's own

```json
"dependencies": [
  "audit-logger",
  { "name": "secrets-vault", "version": "~2.1.0" }
]
```

A manifest can consist of little more than a `name` plus a `dependencies`
array — a "bundle" plugin whose sole purpose is to pull in a curated set on
one install (e.g. a team's standard toolkit).

### Resolution and install-time behavior

- Installing a plugin that declares `dependencies` **auto-resolves and
  auto-installs them** — no separate step, no opt-in flag.
- Version resolution is git-tag-based for git-backed sources: the
  dependency's own repo (or the hosting marketplace repo, for relative-path
  plugins) must carry tags of the form `{plugin-name}--v{version}`; the
  highest tag satisfying the range is fetched. `claude plugin tag --push`
  automates tag creation.
- For `npm`/`archive` sources, tag-based resolution doesn't apply; the
  constraint is checked at *load* time instead, and violation disables the
  plugin with `dependency-version-unsatisfied`.
- **Constraint intersection:** when multiple installed plugins constrain the
  same transitive dependency, Claude Code intersects the ranges and
  installs the highest version satisfying all of them. An unsatisfiable
  intersection fails the new install with `range-conflict`, leaving the
  existing dependency untouched.
- **Cross-marketplace dependencies are blocked by default** — a dependency
  declared in a different marketplace than the declaring plugin only
  resolves if the *declaring plugin's own marketplace* lists the target
  marketplace in root-level `allowCrossMarketplaceDependenciesOn`. Trust
  does not chain through intermediate marketplaces.
- **Self-healing:** if an auto-installed dependency later goes missing,
  `/reload-plugins` and background auto-update reinstall it (if its
  marketplace is still configured). A dependency from an unconfigured
  marketplace is left unresolved until the user adds that marketplace.

### Enable/disable cascade

- Enabling a plugin transitively enables its dependencies (recursively) at
  the same scope, overriding a dependency's own `defaultEnabled: false` by
  writing an explicit `true`. Fails loudly (naming the exact blocker and
  fix) if a dependency is missing, org-policy-blocked, or pinned `false` at
  a higher-precedence scope.
- Disabling a plugin that other enabled plugins still depend on is
  **refused**, with an error that supplies the exact chained
  `disable`-in-order command to unwind the whole set.

### Cleanup

- `claude plugin prune` removes auto-installed dependencies no longer
  required by anything, after a confirmation prompt (`--dry-run`, `-y`,
  `--scope` available). Manually-installed plugins are never pruned, only
  ones pulled in transitively.
- `claude plugin uninstall <plugin> --prune` combines the two steps.
- Un-constraining the last plugin that pinned a dependency lets it resume
  tracking the marketplace's latest version on the next update.

### Error taxonomy

`dependency-unsatisfied`, `range-conflict`, `dependency-version-unsatisfied`,
`no-matching-tag`, `cross-marketplace` — each with a documented, actionable
recovery step. `claude plugin list --json` surfaces these per-plugin in an
`errors` field.

## Impact / Signal for the Build

This is the load-bearing finding for the sibling question in Spike 005:
this repo's own `dependencies` handling (`domain/components/plugin.ts`,
`domain/resolver.ts` — see Spike 005) treats the field as **entirely
opaque** (`Type.Unknown()`) and, by design (PI-13 / PR-5 / D-19-01), never
resolves or auto-installs anything — it only appends a static
"declares dependencies that must be installed manually" note and otherwise
ignores the field's shape.

That gap is intentional and explicitly scoped out today (`PROJECT.md:379`:
"Automatic dependency resolution / pruning -- declared `dependencies`
produce a manual-install warning only; auto-resolution defers to
package-manager primitives"). Spike 004 does not change that decision by
itself, but it does mean the "manual-install warning" framing is a real,
scoped simplification relative to upstream today, not an assumption that
upstream also treats dependencies as informational-only. Any future
decision to close this gap (or to explicitly keep deferring it) should cite
the concrete shape above rather than a general "dependencies are probably
opaque" assumption.
