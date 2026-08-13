---
spike: 005
name: pi-cm-dependency-behavior
type: standard
validates: "Given this repo's real resolver/install code (not a mock), when a plugin entry declares `dependencies`, then observe end-to-end what actually happens on install"
verdict: PARTIAL
related: [004]
tags: [claude-code, plugin-dependencies, resolver, info-command, prototype, bug]
---

# Spike 005: pi-claude-marketplace Dependency Behavior

## What This Validates

Given this repo's real `resolveStrict` resolver and `getPluginInfo`
orchestrator (imported and run directly, not mocked), when a plugin entry
declares `dependencies` in each of the three shapes Spike 004 confirmed are
valid upstream, then observe exactly what happens: does resolution succeed,
does anything get auto-installed, and what does the user actually see.

## Research

No external research needed — this spike runs the actual production
modules. Preceding static-analysis pass (grep) first located every
production read of the `.dependencies` field to scope what to prototype:

- `domain/resolver.ts:1392,1463` — pushes a static note if the field is
  `!== undefined` (both `resolveStrict` and `resolveLoose`); the field's
  shape is never inspected. Backed by `Type.Unknown()` in
  `domain/components/plugin.ts` (PI-13 / PR-5 / MM-2).
- `orchestrators/plugin/info.ts:341-352,850` — `normalizeDependencies()`,
  the only place that inspects individual array *elements* of the field.
- No other production code reads `entry.dependencies`. **Trap avoided:**
  `shared/notify.ts` and `orchestrators/plugin/list.ts` also have a
  `dependencies` field, but it's `Dependency[]` = `("agents"|"mcp")[]` --
  the unrelated *Pi companion soft-dependency* marker (`{requires
  pi-subagents}`), not the Claude-plugin manifest field. Confirmed by
  reading `list.ts:295-300` (`dependenciesFromDeclares`) before treating
  any `.dependencies` grep hit as relevant.

## How to Run

```bash
node .planning/spikes/005-pi-cm-dependency-behavior/prototype.ts
```

Self-contained: builds a hermetic `$HOME` + on-disk path-source marketplace
fixture with 3 plugins (one per dependency shape), then calls the real
`resolveStrict` and `getPluginInfo` against each.

## What to Expect

- Part 1 (`resolveStrict`): all 3 shapes resolve `state: "installable"`
  with the same one-line note, regardless of shape.
- Part 2 (`getPluginInfo`): the `dependencies:` line renders correctly for
  the all-strings case, but silently loses information for the other two.

## Investigation Trail

1. **Static grep pass** (see Research) scoped the prototype to exactly two
   call sites worth exercising live: the resolver's note-push and
   `info.ts`'s `normalizeDependencies`.
2. **First prototype run** used a guessed marketplace-record `source` shape
   (`{ type: "path", path: ... }`) copied from intuition, not the real
   schema. Failed immediately: `state.json marketplace "mp" has malformed
   source object (missing kind/raw)`. Read `state-io.ts`'s
   `normalizeStoredSource` to get the real shape (`{ kind: "path", raw }`,
   built via the exported `pathSource()` factory pattern).
3. **Second run** hit a second real-schema mismatch:
   `MARKETPLACE_RECORD_SCHEMA` requires `name`, `scope`, `addedFromCwd`,
   `manifestPath`, `marketplaceRoot`, `plugins` -- not just `source`. Read
   the schema directly (`state-io.ts:215-232`) rather than guess-and-check
   further, and built a fully compliant record.
4. **Third run succeeded** and immediately surfaced the headline finding:
   `getPluginInfo` renders `dependencies: audit-logger` for the mixed-shape
   plugin -- silently dropping the `{name: "secrets-vault", version:
   "~2.1.0"}` element -- and renders **no `dependencies:` line at all** for
   the all-objects plugin, even though it declares two real dependencies
   (one version-pinned).
5. **Followed the surprising finding one step further** (per project
   convention: trace the "then what," not just "is it dropped"): is this
   information visible through *any* other surface? Checked
   `orchestrators/plugin/install.ts:1784-1788` -- the PI-13 note is
   explicitly **dropped** from the install success message per D-19-01 (a
   deliberate prior decision, comment cites "downstream surfaces (e.g.
   `/claude:plugin list` rendering) can continue to consume it"). Checked
   that claim against `list.ts` directly: its own `dependencies` field is
   the unrelated soft-dep marker (see Research trap above), and the
   resolver's free-form `.notes` array is only read via
   `sharedNarrowResolverNotes` inside the `case "unavailable":` arm
   (`list.ts:729-735`) -- never for an `installable` plugin. So the D-19-01
   comment's claim is stale/inaccurate for the common case: an installable
   plugin's dependency declaration is not, in fact, picked up by `list`.
6. **Net trace:** for a plugin that resolves `installable` (the normal
   case), `install` is silent about `dependencies` by design, `list` is
   silent about it structurally, and `info` -- the only surface left -- is
   silent or incomplete about it for the shape (version-pinned object) that
   actually matters. No crash anywhere; the gap is entirely in what's
   surfaced, not in resolution correctness.

## Results

**PARTIAL.** The "opaque field, no auto-resolution" half of PI-13/PR-5 is
confirmed exactly as documented: `resolveStrict`/`resolveLoose` accept any
`dependencies` shape without inspecting it, always resolve `installable`
(when otherwise valid), and nothing in the install ledger reads the field
to fetch or materialize anything -- there is no auto-install, no version
resolution, no cross-marketplace check, none of the machinery Spike 004
found upstream.

But the "surfaces as a manual-install warning" half is **not** reliably
true today:

| Surface | Shows the dependency declaration? |
|---|---|
| `claude:plugin install` | No -- dropped from the success message (D-19-01) |
| `claude:plugin list` | No -- resolver notes only render for `unavailable` plugins; an installable plugin's notes are never read |
| `claude:plugin info` | Only for bare-string entries; silently drops/omits the version-constrained object form (`{name, version}`) |

Net effect, empirically confirmed by running the real code: a plugin that
declares dependencies using the object form -- which per Spike 004 is the
shape upstream actually documents as the primary use case (semver pinning,
"bundle" plugins) -- is **completely invisible** to a pi-claude-marketplace
user through every command surface. The plugin installs cleanly, but there
is no route by which the user learns it has manual-install obligations.

No crashes, no exceptions, no data corruption in any tested shape --
this is purely a lost-information gap, not a correctness/safety defect.

## Impact / Signal for the Build

`PROJECT.md:379`'s framing ("declared `dependencies` produce a
manual-install warning only") is a documentation drift, not a description
of current behavior: the warning fires at the resolver level but is lost
before reaching any user-visible surface for the shape that matters most.
Composing with Spike 004: closing this gap does not require building
upstream's full auto-install/semver/prune machinery (that remains
explicitly out of scope) -- the minimum fix is narrower and purely a
display fix:

1. `info.ts`'s `normalizeDependencies` should render object-shaped entries
   (at minimum `name`, ideally `name@version`) instead of filtering them
   out.
2. Decide whether the PI-13 note should reappear on `install`/`list` for an
   `installable` plugin, or whether `info` alone is the intended single
   surface (in which case (1) is the only fix needed, but the "manual"
   framing should say "run `claude:plugin info` to see them" rather than
   implying the warning appears at install time).
