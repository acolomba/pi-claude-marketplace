# Claude Plugin Dependency Support

## Requirements

- Upstream Claude Code's `dependencies` field is a real, fully-resolved
  feature (auto-install, semver ranges, cross-marketplace guards,
  enable/disable cascade, `prune`) -- not informational. Any future work
  MUST NOT assume it's inert or purely advisory.
- pi-claude-marketplace's own scope decision to keep `dependencies` opaque
  (no auto-resolution, no fetching, no semver) stands -- do not build
  upstream's full resolution engine. `PROJECT.md`'s "Automatic dependency
  resolution / pruning" deferral is still the right call.
- What MUST change: the "manual-install warning" that's supposed to
  compensate for the missing auto-resolution has to actually reach the
  user. Today it doesn't for the shape that matters most (see below).

## How to Build It

**The gap is narrow and precisely located.** Every production read of the
Claude-plugin `dependencies` field lives in exactly two places:

1. `domain/resolver.ts` (`resolveStrict` / `resolveLoose`, ~line 1391 and
   1462): pushes a static note (`declares dependencies that must be
   installed manually`) onto `partial.notes` whenever
   `entry.dependencies !== undefined`. Shape-agnostic by construction --
   confirmed by prototype to fire identically for all three upstream
   shapes (bare string, `{name, version}` object, mixed array). Backed by
   `Type.Unknown()` in `domain/components/plugin.ts`'s
   `PLUGIN_ENTRY_SCHEMA` / `PLUGIN_MANIFEST_SCHEMA` -- do not tighten this
   schema; opacity here is correct, the bug is downstream.
2. `orchestrators/plugin/info.ts`'s `normalizeDependencies()` (~line 341):
   the only place that inspects individual array *elements*. It filters to
   `typeof d === "string"` and drops everything else -- silently. This is
   the actual bug.

**The fix:** make `normalizeDependencies` render object-shaped entries
too, not just bare strings. Minimum viable: stringify each object as
`name` or `name@version` (matching the existing `<plugin>@<marketplace>`
convention already used for the string form) instead of filtering it out
via `typeof d === "string"`. An array containing only objects currently
renders zero output; after the fix it must render at least the `name` of
each declared dependency.

**Second decision needed, not yet made by any spike:** whether the PI-13
note should also reappear on `install`/`list` for an installable plugin,
or whether `info` remains the single intended surface. Trace before
touching either:

- `orchestrators/plugin/install.ts` (~line 1784): the note is explicitly
  **dropped** from the standalone-mode success message per D-19-01. A
  comment there claims "downstream surfaces (e.g. `/claude:plugin list`
  rendering) can continue to consume it" -- **that claim is stale**, see
  below. If reinstating an install-time note, do it deliberately (new
  decision ID), not by reverting D-19-01 blind.
- `orchestrators/plugin/list.ts` (~line 729-735): `resolved.notes` is only
  read via `narrowResolverNotes` inside the `case "unavailable":` arm.
  For an `installable` plugin (the normal, common case), notes are never
  read at all. `list.ts` also has its own, *unrelated* `dependencies`
  field (`Dependency[]` = `("agents"|"mcp")[]`, built by
  `dependenciesFromDeclares` in the same file) -- that's the Pi-companion
  soft-dependency marker (`{requires pi-subagents}`), not the Claude-plugin
  manifest field. Do not conflate the two when reading `list.ts`.

If `info` is kept as the sole surface, update the "manual-install warning"
framing in `PROJECT.md`/requirements docs to say "discoverable via
`claude:plugin info`" rather than implying a warning appears at install
time -- it currently doesn't, for any dependency shape.

## What to Avoid

- **Don't assume `dependencies` is informational upstream.** It drives a
  real auto-install/semver/prune/cascade system in Claude Code itself
  (confirmed against the official `code.claude.com` docs, not inferred).
  A shallow web search can suggest otherwise: an old, still-open
  GitHub feature-request issue (`anthropics/claude-code#9444`, filed
  2025-10-12, asking for exactly this feature) reads as "not supported"
  in isolation, because it was never closed even though the feature
  shipped later. Cross-check against a dated, closed issue
  (`anthropics/claude-code#48864`, filed 2026-04-16, a docs-bug report
  citing Claude Code v2.1.110) or the primary reference docs before
  concluding either way.
- **Don't rebuild upstream's resolution engine here.** The scope decision
  to stay opaque is sound given this project's constraints; the actual
  defect is a display bug, not a missing feature.
- **Don't hand-guess `state.json` shapes when prototyping a fix.** The
  marketplace record schema (`MARKETPLACE_RECORD_SCHEMA` in
  `persistence/state-io.ts`) requires `name`, `scope`, `source` (as
  `{kind, raw}`, built via the exported `pathSource()`/`githubSource()`
  factories -- never a hand-rolled shape), `addedFromCwd`, `manifestPath`,
  `marketplaceRoot`, `plugins`. Guessing cost two run-fail-reread-schema
  cycles in the spike; read the schema constant first.

## Constraints

**Upstream `dependencies` array element shapes** (both valid, may mix in
one array):

```json
"dependencies": [
  "bare-plugin-name",
  { "name": "secrets-vault", "version": "~2.1.0", "marketplace": "other-mp" }
]
```

- `name` (string, required in object form) -- resolved within the same
  marketplace as the declaring plugin unless `marketplace` overrides it.
- `version` (string, optional) -- a semver range (`~2.1.0`, `^2.0`,
  `>=1.4`, `=2.1.0`).
- `marketplace` (string, optional) -- cross-marketplace target; blocked
  upstream unless the declaring plugin's marketplace lists the target in
  `allowCrossMarketplaceDependenciesOn`.

**pi-claude-marketplace's current handling, empirically confirmed by
running the real resolver + info orchestrator against all three shapes:**

| Surface | Shows the dependency declaration? |
|---|---|
| `claude:plugin install` | No (dropped per D-19-01) |
| `claude:plugin list` | No (notes only render for `unavailable` plugins) |
| `claude:plugin info` | Bare strings only; object form silently dropped |

No crashes or data corruption in any tested shape -- this is purely a
lost-information gap.

## Origin

Synthesized from spikes: 004, 005
Source files available in: `sources/004-claude-plugin-dependency-spec/`,
`sources/005-pi-cm-dependency-behavior/` (the latter includes
`prototype.ts`, a runnable proof against the real production
`resolveStrict` and `getPluginInfo`).
