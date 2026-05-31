# Phase 23: Version Display Bundle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 23-version-display-bundle
**Areas discussed:** Version precedence order, plugin.json read mechanism, SemVer validation strictness, Hash-display shape & scope

---

## Version precedence order

When BOTH `marketplace.json plugins[].version` AND `plugin.json version` declare
a version, which wins?

| Option | Description | Selected |
|--------|-------------|----------|
| Marketplace wins (SNM-34) | marketplace.json > plugin.json > hash. Curator's pin overrides; matches SNM-34 text + current tier-1 behavior. | |
| Plugin manifest wins (PRD §11) | plugin.json > marketplace.json > hash. Plugin author's self-declared version is authoritative. Reverses current tier-1; correct SNM-34 to match. | ✓ |

**User's choice:** Plugin manifest wins (PRD §11).
**Notes:** Independently confirmed by Claude Code upstream
(`code.claude.com/docs/en/plugins-reference`): *"If also set in the marketplace
entry, `plugin.json` wins."* PRD §11:257 already states this order, so the PRD
needs no change; SNM-34's text (marketplace-first) is the artifact to correct,
and the resolver change is a reorder (plugin.json ahead of entry.version), not a
simple insert.

---

## plugin.json read mechanism

How does `resolvePluginVersion` obtain plugin.json's version, given
`installable.manifest` does not exist on `ResolvedPluginInstallable`?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-read plugin.json in resolver | resolvePluginVersion reads `<pluginRoot>/.claude-plugin/plugin.json` itself. No NFR-7 union change; one tiny extra read. | ✓ |
| Thread full manifest onto installable | Add `manifest: Record<string,unknown>` to the schema; matches the spec literal but widens the typed union. | |
| Thread narrow manifestVersion onto installable | Add `manifestVersion?: string`; tight type but diverges from the spec's `installable.manifest` literal. | |

**User's choice:** Re-read plugin.json in resolver.
**Notes:** Keeps the NFR-7 discriminated union untouched; the extra read is
trivial next to the `computeHashVersion` full-tree walk it short-circuits. The
spec's `installable.manifest?.version` is a phantom reference and will not be
materialized.

---

## SemVer validation strictness

Which plugin.json version shapes are honored vs rejected to the hash fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| Full SemVer 2.0.0 | Honor X.Y.Z + prerelease + build; falls to hash only on malformed. | |
| Strict X.Y.Z triple only | Accept only `^\d+\.\d+\.\d+$`; prerelease/build fall to hash. | |
| (User redirect) Don't enforce if not required by Claude spec | Research whether Claude's plugin docs require version to be semver; if not, don't enforce. | ✓ |

**User's choice:** Free-text -- *"does the claude plugin documentation indicate
that a version is required to be a semver? if not, don't enforce."*
**Notes:** Researched and answered: Claude Code's `plugin.json` `version` is
`Optional` and treated as an opaque version string -- semver is convention only,
and the CLI accepts non-strict forms such as `1.0`
(`code.claude.com/docs/en/plugins-reference`). The repo already models it as
`Type.Optional(Type.String())`, and PRD PL-5 defines `upgradable` by plain
string compare (a non-semver string cannot break comparison). **Resolution:
no SemVer enforcement -- accept any non-empty string (mirrors the existing
`entry.version` gate); no `looksLikeSemver` predicate.** SNM-34 / SC#1
"SemVer shape validation" wording is amended to "non-empty string".

---

## Hash-display shape & scope

| Option | Description | Selected |
|--------|-------------|----------|
| Anchored predicate, both arrow sides | `looksLikeHashVersion` = `^hash-[0-9a-f]{12}$`; `#<7hex>` on both update-arrow sides + all version surfaces; add catalog examples. | ✓ |
| To-side only | Transform only the arrow's `to` side; leave `from` as raw hash. Inconsistent. | |

**User's choice:** Anchored predicate, both arrow sides.
**Notes:** `looksLikeHashVersion` and `formatHashVersionForDisplay` are net-new
(SNM-35 calls the predicate "existing" but it does not exist). Renderer-only;
persistence stays `hash-<12hex>`. `from` renders bare `#<7hex>`, `to` renders
`v#<7hex>` per the existing `composeVersionArrow` asymmetry. Catalog has no
hash-version examples today, so representative states must be added.

---

## Claude's Discretion

- Placement of the two new helpers within `shared/notify.ts`, and whether
  `formatHashVersionForDisplay` is applied inside `renderVersion` /
  `composeVersionArrow` vs a shared chokepoint.
- The specific representative hash-version catalog states to add.
- Plan/wave decomposition within the phase (SNM-34 and SNM-35 serialized per the
  `shared/notify.ts` convergence constraint).
- Whether to touch PRD §11:257 wording (already correct -- likely confirm only).

## Deferred Ideas

- State migration for already-installed hash-versioned plugins whose plugin.json
  declares a version -- out of scope (REQUIREMENTS Out of Scope); the new tier
  fires at next install/reinstall/update. Carried from the v1.4.1 milestone
  deferral; not re-litigated.
