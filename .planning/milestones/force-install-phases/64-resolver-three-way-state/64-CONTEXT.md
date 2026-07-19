# Phase 64: Resolver Three-Way State - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor `extensions/pi-claude-marketplace/domain/resolver.ts` so the resolver
returns a three-way discriminated state — `installable` / `unsupported` /
`unavailable` — replacing the binary `installable: true | false`. The new
`unsupported` arm models "force can degrade the unsupported parts" (carries
`pluginRoot` + supported/unsupported component lists); `unavailable` models
"force cannot help" (structural defect, never exposes `pluginRoot`). Adds the
`requireForceInstallable` narrowing gate alongside the existing
`requireInstallable`. This is a type-level refactor of the resolver and its
consumers — it does not yet implement the `--force` install/update behavior
(that is Phase 65).

Requirements RSTATE-01..05 and the five success criteria are locked by the
ROADMAP — discussion below is HOW, not WHAT.

</domain>

<decisions>
## Implementation Decisions

### Discriminant shape (RSTATE-01)
- **D-64-01:** Use a string-literal discriminant `state: "installable" |
  "unsupported" | "unavailable"`; drop the `installable: true | false`
  boolean. This supersedes the old **D-05** (which mandated the boolean form
  *because the old state was binary*). Three-way state naturally requires a
  string tag. Consumers narrow via `switch (r.state)` / `if (r.state === …)`.
  TypeBox 1.x `Type.Union([...])` still takes NO `discriminator` option — the
  literal-tagged `state` field IS the discriminator and drives TS narrowing
  (the existing resolver header comment about this remains accurate).

### Unsupported-reason modeling (RSTATE-05)
- **D-64-02:** Derive per-kind unsupported markers at RENDER time from the
  `unsupported` / component lists, via a shared helper consumed by both `list`
  and `info`. Keep structural reasons in the existing reasons array (the
  marker family is kept distinct from structural reasons by living in a
  separate render path, not by a new resolver field). This guarantees by
  construction that per-kind reasons render identically across `list`, `info`,
  and all force states (success criterion 5). Do NOT introduce a structured
  `{kind, reason}[]` type on the resolver output.

### Consumer migration (RSTATE-04)
- **D-64-03:** Hard-migrate every `if (r.installable)` call site to the new
  discriminant — no back-compat `isInstallable()` shim. Let the compiler
  surface all sites. Keeps NFR-7 enforcement tight (no boolean back-door that
  re-admits reading `pluginRoot` off a non-installable variant). The diff is
  larger but mechanical.
- **D-64-04:** Two narrowing gates: `requireInstallable` narrows to
  `installable` only (default path; preserve current throw behavior — `kind:
  "not-installable"` / `"no-longer-installable"`), and a NEW
  `requireForceInstallable` narrows to `installable | unsupported` (the
  `--force` path; lets the `unsupported` arm through while still rejecting
  `unavailable`).

### `unavailable` arm field set (RSTATE-03)
- **D-64-05:** `unavailable` is a MINIMAL arm: `state`, `name`, structural
  reasons, and `notes` only. It never carries `pluginRoot` (NFR-7,
  compile-enforced) and drops `orphanRewake` / `hooksConfigPath` / the
  component lists — these are meaningless when the manifest/structure is broken
  and cannot be reliably enumerated.
- **D-64-06:** `unsupported` carries `pluginRoot` PLUS the supported and
  unsupported component lists (and the symmetric markers it can populate). It
  is the force-degradable arm.
- **D-64-07:** Structural precedence (RSTATE-02): a plugin that is BOTH
  structurally broken (unreadable/invalid manifest, malformed `hooks.json`,
  NFR-10 path/containment violation) AND has unsupported component kinds
  resolves `unavailable` — the structural defect wins.

### Claude's Discretion
- Exact internal helper names, the shape of the shared render helper from
  D-64-02, and whether the resolver's internal `installable()` /
  `notInstallable()` factory helpers are renamed/split into three — left to
  planning, provided the public union and gates match the decisions above.
- `info.ts` keeps its own lenient path-source component re-derivation (added by
  quick task `260618-qkz`); it re-resolves independently and does not read the
  minimal `unavailable` arm, so D-64-05 does not regress it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Resolver contract & NFR-7
- `extensions/pi-claude-marketplace/domain/resolver.ts` — the file being
  refactored; current binary union, `requireInstallable` gate, internal
  factory helpers, header comment on TypeBox discriminator behavior.
- `docs/prd/pi-claude-marketplace-prd.md` §6.4 — the resolver discriminated-
  union contract and the original D-05 boolean form (now superseded by
  D-64-01 for three-way).

### Requirements
- `.planning/REQUIREMENTS.md` — RSTATE-01..05 (Resolver State block).
- `.planning/ROADMAP.md` — Phase 64 goal, success criteria, RSTATE mapping.

### Output rendering (for the render-time marker family, D-64-02)
- `docs/output-catalog.md` — byte-level output contract for `list` / `info`
  rows and unsupported-component reason markers.
- `docs/hooks-compatibility.md` — hooks supportability boundary (BUCKET_A
  events) that feeds the unsupported-hooks marker.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireInstallable(r, op)` (resolver.ts:1007) — existing narrowing gate;
  `requireForceInstallable` mirrors it with a widened target type.
- Internal `installable()` / `notInstallable()` factory helpers (resolver.ts
  ~262/248) — construct the union arms; will split to cover three states.
- `resolveStrict` / `resolveLoose` (resolver.ts:901/955) — the two entry
  points whose return type changes to the three-way union.

### Established Patterns
- TypeBox literal-tagged union with NO `discriminator` option; TS narrows on
  the literal field. Both arms currently keep symmetric fields except
  `pluginRoot` (installable-only). Three-way keeps `pluginRoot` on
  `installable` + `unsupported`, never on `unavailable`.
- Comment/test-title policy (`.claude/rules/typescript-comments.md`): use
  decision/requirement IDs (D-64-NN, RSTATE-NN, NFR-7), never GSD phase/plan
  references.

### Integration Points
- Every `if (r.installable)` consumer across commands/bridges (`install`,
  `update`, `list`, `info`, reconcile) — must migrate to `switch (r.state)`.
- `info.ts` lenient path-source re-derivation (quick task 260618-qkz) — keep
  independent of the `unavailable` arm.

</code_context>

<specifics>
## Specific Ideas

The three-way state is intentionally NFR-7 *refined, not weakened*: force
degrades components (`unsupported`) but can never bypass a hard structural
failure (`unavailable`). The type system must make "read `pluginRoot` from an
`unavailable` plugin" a compile error, and must make `requireForceInstallable`
unable to admit `unavailable`.

</specifics>

<deferred>
## Deferred Ideas

- `--force` install/update behavior (degrade unsupported components instead of
  blocking) — Phase 65.
- Derived force-installed / force-upgradable states, glyphs, will-force preview
  tokens, `info` detail — Phase 66.
- List filters, completion sets, reinstall-as-repair — Phase 67.
- Load-time backfill of previously-skipped components — Phase 68.
- Force-path notification severities — Phase 69.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 64-resolver-three-way-state*
*Context gathered: 2026-06-27*
