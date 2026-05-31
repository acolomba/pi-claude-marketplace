# Phase 23: Version Display Bundle - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Render versions to the user with maximum signal, in two independent fixes that
both touch version handling:

- **SNM-34 (resolution):** When a plugin's own `<pluginRoot>/.claude-plugin/plugin.json`
  declares a `version`, that version is recorded and rendered instead of a
  PI-7 content hash. `resolvePluginVersion` (`orchestrators/plugin/shared.ts`)
  gains a plugin.json tier.
- **SNM-35 (display):** A persisted PI-7 hash-version (`hash-<12hex>`) renders
  to the user as a git-style short SHA `v#<7hex>` instead of the verbose
  `vhash-<12hex>`. Renderer-only transform in `shared/notify.ts`.

**Persistence is unchanged:** `state.json` keeps `hash-<12hex>` (PI-7 contract
intact, no state migration). The changes are scoped to resolution and rendering.

**In scope:** the resolver version-precedence tier, the renderer hash-display
transform, and the catalog/fixture/doc updates required to keep byte-equality
GREEN.

**Out of scope:** grammar leak (Phase 24), runtime publish/verification
(Phase 25), state-migration tooling for already-installed hash-versioned
plugins (REQUIREMENTS Out of Scope -- the new resolver tier fires at NEXT
install/reinstall/update only). No new commands.
</domain>

<decisions>
## Implementation Decisions

### Version precedence (SNM-34)
- **D-23-01:** `resolvePluginVersion` order becomes **plugin.json `version` →
  marketplace.json `entry.version` → PI-7 hash**. This is a **reorder**, not a
  mere insert: the current code (`shared.ts:171-176`) consults `entry.version`
  FIRST, so the plugin's own manifest version must move ahead of it.
  - **Confirmed from two authoritative sources:** PRD §11 PI-7 (`:257`) already
    states this exact order ("the plugin manifest `version`, then the marketplace
    entry `version`, then a `hash-<12hex>`"); and Claude Code upstream
    (`code.claude.com/docs/en/plugins-reference`) states *"If also set in the
    marketplace entry, `plugin.json` wins."*
  - **Supersedes SNM-34's stated order.** SNM-34's wording lists marketplace
    first ("(1) marketplace.json … if declared; (2) plugin.json …"); that is
    backwards relative to the PRD + upstream. **Correct SNM-34's text to
    plugin.json-first in lockstep with the code change.** PRD §11:257 needs no
    change (it is already correct).

### Read mechanism (SNM-34)
- **D-23-02:** `resolvePluginVersion` **re-reads
  `<installable.pluginRoot>/.claude-plugin/plugin.json` itself** (read file →
  `JSON.parse` → pick `.version`). Do **NOT** add a `manifest` field to
  `ResolvedPluginInstallable` -- the NFR-7 discriminated union
  (`resolver.ts:50-59`) stays untouched.
  - **SNM-34's literal `installable.manifest?.version` reference is a phantom** --
    that field does not exist on the installable and will not be added. The
    manifest IS read at preflight (`resolver.ts:317-345`) but is not threaded
    onto the result; re-reading is the contained fix.
  - The extra read is trivial next to the full-tree `computeHashVersion` walk it
    short-circuits.
  - **Failure handling:** read/parse failure (ENOENT, malformed JSON, missing
    `.version`) **falls through to the next tier -- never throws.** A non-string
    `version` (number/object) also falls through.

### Validation (SNM-34) -- NO SemVer enforcement
- **D-23-03:** Accept **any non-empty string** as the plugin.json version
  (guard `typeof v === "string" && v.length > 0`), identical to the existing
  `entry.version` gate. **No SemVer regex, no `looksLikeSemver` predicate.**
  - **Rationale (researched):** Claude Code's `plugin.json` `version` is
    `Optional` and treated as an opaque *version string* -- semver is convention
    only, and the CLI accepts non-strict forms like `1.0`
    (`code.claude.com/docs/en/plugins-reference`). The repo already treats it as
    `Type.Optional(Type.String())` (`domain/components/plugin.ts:19`), PRD MM-2
    (`:520`) calls it "optional string `version`", and PRD PL-5 (`:340`) defines
    `upgradable` by **plain string compare** -- so a non-semver string cannot
    "break" comparison (the original SemVer-validation concern in the UAT recon
    was overcautious).
  - **Amend SNM-34's "with SemVer shape validation" and Roadmap SC#1's "A typo
    or non-SemVer string in plugin.json is rejected by shape validation and
    falls through to the PI-7 hash fallback"** to reflect non-empty-string
    validation. (A genuinely malformed/empty/non-string value still falls
    through to the hash, satisfying the spirit of SC#1.)

### Hash display (SNM-35)
- **D-23-04:** Create two helpers in `shared/notify.ts`:
  - `looksLikeHashVersion(v)` -- **anchored exact** `^hash-[0-9a-f]{12}$`.
  - `formatHashVersionForDisplay(v)` -- if `looksLikeHashVersion(v)`, strip the
    `hash-` prefix and return `#<first 7 hex>`; otherwise return `v` unchanged.
  - Neither exists today despite SNM-35 calling `looksLikeHashVersion`
    "existing" -- both are **net-new**. The shape they match is defined by
    `computeHashVersion`'s output (`domain/version.ts:33`, `"hash-" + 12hex`).
  - Renderer-only; persistence stays `hash-<12hex>` (PI-7 intact, no migration).
- **D-23-05:** Apply the transform on **BOTH update-arrow sides** and every
  version surface. `renderVersion` (`:752`) and `composeVersionArrow` (`:798`)
  route their version token(s) through `formatHashVersionForDisplay` before the
  `v`-prefix discipline. Per `docs/output-catalog.md:494` the `from` side is
  rendered **bare** and `to` is `v`-prefixed -- so a hash renders `from → #<7hex>`,
  `to → v#<7hex>` (full arrow e.g. `#2ea95f8 → v#1c3d9a0`). List rows,
  install/reinstall/uninstall cascade rows all render `v#<7hex>`.
- **D-23-06:** The catalog has **zero hash-version examples today** (all current
  examples are SemVer). Add representative hash-version catalog states + byte
  fixtures so the new `v#<7hex>` form is locked by byte-equality
  (`docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` +
  `tests/shared/notify-v2.test.ts`).

### Within-phase sequencing
- **D-23-07:** Per the v1.4.1 `shared/notify.ts` convergence constraint
  (ROADMAP `:83-91`), SNM-34 (resolver) and SNM-35 (renderer) ship as
  **separate serialized plans, not parallel waves**. Their files are largely
  disjoint (SNM-34: `orchestrators/plugin/shared.ts` + `install.test.ts`;
  SNM-35: `shared/notify.ts` + catalog + `notify-v2`/`catalog-uat` fixtures),
  but the planner owns final decomposition.

### Claude's Discretion
- Exact placement of the two new helpers within `shared/notify.ts`, and whether
  `formatHashVersionForDisplay` is invoked inside `renderVersion` /
  `composeVersionArrow` versus a shared chokepoint both call.
- The specific representative hash-version catalog states to add (D-23-06).
- Plan/wave decomposition within the phase (D-23-07).
- Whether to also touch PRD §11:257 wording (already correct -- likely just
  confirm, no edit).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement & gap source
- `.planning/REQUIREMENTS.md` §SNM-34 (`:18`), §SNM-35 (`:20`) -- the two
  requirements this phase closes. **NOTE:** SNM-34's stated precedence order
  (marketplace-first) and "SemVer shape validation" wording are CORRECTED by
  D-23-01 / D-23-03 -- amend in lockstep.
- `.planning/REQUIREMENTS.md` Out of Scope (`:103`) -- no state migration for
  already-installed hash-versioned plugins.
- `.planning/v1.4-MILESTONE-UAT.md` -- G-MIL-05 (`:533-591`, resolver tier
  recon) and G-MIL-08 (`:628-684`, incl. the user-clarified `v#<7hex>` design
  sketch at `:649-677`).
- `.planning/ROADMAP.md` -- Phase 23 goal + SC#1-#4 (`:420-435`); cross-cutting
  v1.4.1 constraints (`:85-91`). SC#1's "rejected by shape validation" wording
  is amended per D-23-03.

### Resolver (SNM-34)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` --
  `resolvePluginVersion` (`:166-176`): the reorder + re-read target (D-23-01,
  D-23-02). The existing `entry.version` gate (`:171`) is the validation shape
  D-23-03 reuses.
- `extensions/pi-claude-marketplace/domain/resolver.ts` --
  `ResolvedPluginInstallableSchema` (`:50-59`): **not modified** (D-23-02 adds
  no `manifest` field); `readManifest` (`:317-345`) reads plugin.json at
  preflight (reference only -- resolvePluginVersion re-reads independently).
- `extensions/pi-claude-marketplace/domain/version.ts` -- `computeHashVersion`
  (`:29-34`): tier-3 fallback, unchanged; defines the `hash-<12hex>` shape.
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` --
  `version: Type.Optional(Type.String())` (`:19`): confirms opaque-string
  treatment (no semver constraint), grounding D-23-03.

### Renderer (SNM-35)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `renderVersion`
  (`:752-758`), `composeVersionArrow` (`:798-800`), `updated`-arm call site
  (`:906`). The two new helpers land here.
- `docs/output-catalog.md` -- version-token rule (`:40`), update-arrow asymmetry
  note (`:494`: `from` bare, `to` v-prefixed); add hash-version example states
  (D-23-06).

### Contract / external (amendments + confirmation)
- `docs/prd/pi-claude-marketplace-prd.md` -- §11 PI-7 (`:257`, **already states
  the chosen precedence** -- confirm, likely no edit); PL-5 (`:340`, string-compare
  upgradable); MM-2 (`:520`, optional string version).
- `https://code.claude.com/docs/en/plugins-reference` -- **authoritative external
  confirmation**: `version` is `Optional`, treated as a version string (semver
  is convention, not enforced), and *"If also set in the marketplace entry,
  `plugin.json` wins."* Grounds D-23-01 + D-23-03.

### Tests
- `extensions/pi-claude-marketplace/tests/orchestrators/plugin/install.test.ts`
  -- SNM-34 tier test (fixture: marketplace omits `version`, plugin.json declares
  one → resolved/rendered as that version, not a hash).
- `extensions/pi-claude-marketplace/tests/shared/notify-v2.test.ts` -- add
  `v#<7hex>` byte fixtures (D-23-06).
- `extensions/pi-claude-marketplace/tests/architecture/catalog-uat.test.ts` --
  per-command byte-equality; add hash-version states (D-23-06).
- `extensions/pi-claude-marketplace/tests/domain/version.test.ts` -- pins the
  `computeHashVersion` snapshot (persistence stays `hash-<12hex>`; no change).

### Precedent to mirror
- `.planning/phases/22-reload-hint-discipline-family/22-CONTEXT.md` -- the
  catalog/fixture byte-equality lockstep pattern (D-22-06) this phase repeats.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The existing `entry.version` gate (`shared.ts:171`,
  `typeof v === "string" && v.length > 0`) is the exact validation shape the
  new plugin.json tier reuses (D-23-02 / D-23-03).
- `renderVersion` + `composeVersionArrow` are the SOLE version-rendering
  chokepoints (D-16-04 canonical); the hash transform plugs into these two only.
- `computeHashVersion`'s `"hash-" + 12hex` output (`version.ts:33`) defines the
  exact shape `looksLikeHashVersion` matches.

### Established Patterns
- The discriminated `installable: true | false` union (NFR-7) is deliberately
  NOT widened (D-23-02 re-reads rather than threading the manifest).
- Version compare is plain string equality (PRD PL-5), not semver ordering --
  underpins D-23-03 (non-semver strings are safe; they just differ-or-match).
- Catalog UAT byte-equality is the user-contract gate -- any rendered-output
  change updates `docs/output-catalog.md` + fixtures in the same commit
  (mirrors Phase 22's D-22-06 lockstep).
- Persistence/display separation: PI-7 `hash-<12hex>` persists; the `v#<7hex>`
  form is a renderer-only transform (the SNM-35 user-clarified design).

### Integration Points
- `resolvePluginVersion` feeds the persisted `state.json` `version` field and
  the `notify()` payload across install / update / reinstall orchestrators; the
  reorder (D-23-01) is transparent to callers.
- `formatHashVersionForDisplay` sits between the persisted version string and
  the rendered token -- callers keep passing the full version; only the two
  render helpers change.
- No edge-handler, completion-provider, or persistence-layer changes.
</code_context>

<specifics>
## Specific Ideas

- Canonical example: persisted `hash-2ea95f85703d` → rendered `v#2ea95f8`
  (first 7 of the 12-hex truncation; matches git `--short=7`). The full 12-hex
  collision envelope is retained internally for compare semantics.
- Update arrow with a hash on both sides: `#<7hex-from> → v#<7hex-to>`
  (the `from` side is bare; only `to` carries the `v` per
  `composeVersionArrow`).
- plugin.json read path: `<pluginRoot>/.claude-plugin/plugin.json`, field
  `.version`.
- Precedence is corroborated verbatim by Claude Code upstream: *"If also set in
  the marketplace entry, `plugin.json` wins."*
</specifics>

<deferred>
## Deferred Ideas

- **State migration for already-installed hash-versioned plugins** whose
  plugin.json declares a version -- explicitly out of scope (REQUIREMENTS `:103`).
  The new resolver tier fires at the NEXT install/reinstall/update;
  `marketplace update` naturally surfaces the discrepancy as upgradable. Carried
  from the v1.4.1 milestone deferral; not re-litigated here.
- None new from this discussion -- stayed within phase scope.
</deferred>

---

*Phase: 23-version-display-bundle*
*Context gathered: 2026-05-29*
