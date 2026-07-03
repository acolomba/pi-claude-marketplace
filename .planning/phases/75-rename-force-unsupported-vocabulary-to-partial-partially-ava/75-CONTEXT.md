# Phase 75: Rename force/unsupported vocabulary to partial/partially-available - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning
**Source:** Direct decisions captured at plan-phase (no discuss-phase); grounded in 75-RESEARCH.md

<domain>
## Phase Boundary

A pure, **behavior-preserving vocabulary rename** across the `extensions/pi-claude-marketplace/`
TypeScript codebase, its tests, and docs. Renames the force-install / top-level-`unsupported`
feature vocabulary to a **partial / partially-available** vocabulary. No behavior change, no new
dependency, no new command. The type system + the byte-equality catalog UAT make the rename
self-verifying.

**In scope:** the top-level plugin verdict, the `--force`/`--unsupported` user flags, the
force-state family, glyph *constant names*, hint-trailer constants + bodies, the completion-cache
status literals, and the full internal degrade-`force` plumbing (see decisions).

**Out of scope (MUST stay byte-identical):** unrelated `force` (`rm({force:true})`,
`writeRef({force:true})`, bridge staging-overwrite `AgentStageOptions.force`, reinstall overwrite
`force`; `git push --force`/`forceGithub` do not exist in-tree), and the **component-level**
classification — `compatibility.supported`/`unsupported[]` arrays, the reason tokens
`"unsupported source"` / `"unsupported hooks"`, and `narrowUnsupportedKinds` / `unsupportedKinds`.
A plugin is *partially available* **because** some component kinds are unsupported — the two senses
coexist and must not collide. Apply the RESEARCH.md §4c symbol-level rule; **no blind substring
replace**.
</domain>

<decisions>
## Implementation Decisions

- **D-75-01:** Rename the force / top-level-`unsupported` vocabulary to partial / partially-available across `extensions/pi-claude-marketplace/`, tests, and docs — a single atomic, behavior-preserving decision comprising every LOCKED sub-facet below (hyphen render-token forms; `--force`/`--unsupported` → `--partial` with no alias; full internal rename incl. the resolver discriminant + degrade-`force` plumbing; keep glyph characters and rename only their constant names; `forceHint`→`partialHint` + hint-trailer constants/bodies; `(will partially install)`; completion-cache-only `schemaVersion 3→4` migration; atomic byte-supersession of the renderer + `output-catalog.md` + catalog-uat fixtures). Implemented across plans 75-01 and 75-02; `D-75-01` is also the code-comment traceability anchor.

All sub-facets below are **LOCKED** (captured from the operator at plan-phase) and are the detailed
elaboration of D-75-01. The byte gate turns each render-string choice into a hard contract.

### Render-token form — HYPHEN
User-visible verdict/status render tokens use the **hyphen** form:
- `(unsupported)` verdict → `(partially-available)`
- `(force-installed)` → `(partially-installed)`
- `(force-upgradable)` → `(partially-upgradable)`

The corresponding closed-set status literals (`STATUS_TOKENS` / `PLUGIN_STATUSES` members and the
resolver discriminant) are the hyphenated forms: `"partially-available"`, `"partially-installed"`,
`"partially-upgradable"`. Internal classifier/cache literal `"force-installed-upgradable"` →
`"partially-installed-upgradable"`.

### `--force` install/update flag → `--partial` (NO alias)
Breaking change, intentional. `--force` is removed entirely (no back-compat alias). USAGE strings,
arg-parse arms, tab-completion, and the two hint-trailer bodies all move to `--partial`. Target
token verified collision-free (`grep -- '--partial'` returns zero hits).

### `--unsupported` list filter → `--partial`
The list filter follows the verdict rename, reusing `--partial` for symmetry with the install/update
flag (different command, no hard collision).

### Rename depth — FULL internal rename
Rename the internal degrade-`force` plumbing to `partial`, not just user-facing surfaces, so internal
code matches what users type/see. Includes:
- resolver discriminant `state: "unsupported"` → `state: "partially-available"`
- `InstallPluginOptions.force` / `UpdatePluginOptions.force` (`opts.force`/`args.force`) → `.partial`
- `requireForceInstallable` → `requirePartialInstallable`
- `forceable?` (thrown-error flag) → `partialable?`
- `forceDegrade?` → `partialDegrade?`; `forceUpgradable?` → `partialUpgradable?`
- `FORCE_INSTALL_STATUSES` / `FORCE_UPDATE_STATUSES` → `PARTIAL_INSTALL_STATUSES` / `PARTIAL_UPDATE_STATUSES`
- the reconcile/autoupdate degrade `force` boolean modifier → `partial`
> **Collision guard:** the degrade `force: true` (in scope) sits next to overwrite `force: true`
> (`reinstall.ts` `rm(...,{force:true})` / `replacePreparedAgents(...,{force:true})`, OUT of scope).
> Do NOT blanket-replace `force: true` — edit symbol-by-symbol per the §4c rule.

### Glyphs — keep the CHARACTERS, rename only the CONSTANTS
Glyph characters stay visually identical (`◉` force-installed, `⊖` unsupported). Rename only the
constant identifiers: `ICON_FORCE_INSTALLED` → `ICON_PARTIALLY_INSTALLED`; `ICON_UNSUPPORTED` →
`ICON_PARTIALLY_AVAILABLE`. Changing the glyph characters is explicitly deferred (larger visual UX).

### Hint fields, trailer constants + bodies
- `forceHint?` field → `partialHint?` (on the 3 carrying interfaces + producers + render + tests)
- `FORCE_INSTALL_HINT_TRAILER` → `PARTIAL_INSTALL_HINT_TRAILER`
- `FORCE_UPDATE_HINT_TRAILER` → `PARTIAL_UPDATE_HINT_TRAILER`
- trailer body → `"Re-run with --partial to install the supported components."`
- trailer body → `"Re-run with --partial to update with the supported components."`

### "will force install" modifier
- render string `(will force install)` → `(will partially install)` (adverb form, **no hyphen** —
  "partially" modifies the verb "install"; hyphenation applies only to the compound-adjective status
  tokens above)
- the `force?` field on `PluginWillInstallMessage` → `partial?`

### Persisted-literal migration — completion cache ONLY
No `state.json` / `claude-plugins.json` / `agents-index.json` `schemaVersion` bump and no old→new
transform — none of them persist an in-scope literal (force-state is derived; the only on-disk
`unsupported`/`supported` is the OUT-of-scope `compatibility.*` arrays). The single migration:
bump `PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion` `3`→`4` (the schema `Type.Literal` **and** both
`schemaVersion: 3 as const` write literals), rename the status literal union + `PluginIndexRow.status`;
the existing drop-and-rebuild-on-mismatch path self-heals every stale cache on next read (atomic,
idempotent, backward-safe — no manual data touch).

### Atomic-supersession (byte-gate discipline)
The renderer (`shared/notify.ts` + `*.messaging.ts` free render strings) + `docs/output-catalog.md`
+ the inline `FIXTURES` map in `tests/architecture/catalog-uat.test.ts` MUST change in the same
commit or the byte-equality gate goes RED. The `(…)` render strings and hint-trailer bodies are
FREE strings not coupled to the union — `tsc` will NOT catch a stale one; only the catalog UAT does.
Do **not** split the verdict rename from the force-state rename across commits (they are derived from
each other, co-rendered, co-fixtured). The rename is length-preserving → the closed-set length locks
(23/18/32/7) stay green with no count bump.

### New completion-criterion test
Add a grep-based absence/presence architecture guard (the executable form of the §4c rule): asserts
the in-scope old tokens are ABSENT from `extensions/` and the out-of-scope tokens are STILL PRESENT
(`"unsupported source"`/`"unsupported hooks"`, `compatibility.unsupported`, `rm({force:true})`,
`writeRef({force:true})`, `AgentStageOptions.force`). It cannot be green on the pre-rename tree, so
it lands **in** the rename commit asserting the post-state.

### Comment traceability
Mint decision ID **`D-75-01`** as the comment anchor for the rename. Do NOT write `Phase 75` / `Wave`
/ `Plan` in code comments (per `.claude/rules/typescript-comments.md`).

### Requirements
No formal requirement IDs are minted; the ROADMAP goal + this CONTEXT + 75-RESEARCH.md are the spec.
Encode completeness in each plan's `must_haves` (positive: new tokens render; negative/prohibition:
old in-scope tokens absent, out-of-scope tokens preserved).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Rename census + mechanics (authoritative)
- `.planning/phases/75-rename-force-unsupported-vocabulary-to-partial-partially-ava/75-RESEARCH.md` — exhaustive file:line occurrence census (§1), current→target name tables (§2), completion-cache migration design (§3), the OUT-of-scope exclusion list + symbol-level rule (§4), output-contract triad (§5), test surfaces (§6), sequencing/risk (§7), Validation Architecture, Pitfalls.

### Byte-contract surfaces (change in lockstep)
- `docs/output-catalog.md` — `<!-- catalog-state -->` fenced blocks, read + byte-compared by the UAT.
- `tests/architecture/catalog-uat.test.ts` — inline `FIXTURES` map (compile-checked + byte-checked).
- `docs/messaging-style-guide.md` — variant list + the two frozen hint-trailer bodies (D-70-01).
- `docs/prd/pi-claude-marketplace-prd.md` — glossary + requirement prose (keep requirement IDs; move prose vocabulary; keep component-level `unsupported` in PR-2/PR-3/PR-9/MM-*).

### Project rules
- `CLAUDE.md` — NFR-1 atomic writes, NFR-3 idempotent/retry-safe, NFR-6 `npm run check` green, byte-equality catalog UAT, versioning (bump `package.json` + `sonar-project.properties` + `EXTENSION_VERSION` + `package-lock.json` + `CHANGELOG.md` at PR time), git rules.
- `.claude/rules/typescript-comments.md` — comment policy (mint `D-75-01`, no `Phase N`).
</canonical_refs>

<specifics>
## Specific Ideas

- **Decomposition (RESEARCH §7):** prefer **Option A** — a single atomic, compile-green + byte-green
  rename commit — OR **Option B** — 2-3 independently-green slices where the only clean seams are:
  (1) `--force`→`--partial` flag + internal degrade-`force` plumbing + the two hint-trailer bodies +
  USAGE + completion; (2) verdict `unsupported`→`partially-available` + force-state family + glyph
  constants + completion-cache v3→v4 bump. Land 1 then 2. **Never** split verdict-rename from
  force-state-rename.
- Bump all THREE `3`s in `completion-cache.ts` together (schema literal + 2 `as const` write sites)
  or the cache never stabilizes.
- Grep `README.md` for `--force` / `(unsupported)` / `force-installed` and fold any hits into the
  lockstep doc set; add a `CHANGELOG.md` entry.
- Versioning: `EXTENSION_VERSION` must bump in lockstep with `package.json` (drift-guard test).
</specifics>

<deferred>
## Deferred Ideas

- Changing the glyph **characters** (`◉`/`⊖`) — only the constant names change this phase.
- Minting a formal `RVOC-*` requirement set — proceed from goal + research; revisit only if
  traceability needs it.
</deferred>

---

*Phase: 75-rename-force-unsupported-vocabulary-to-partial-partially-ava*
*Context captured: 2026-07-02 at plan-phase (operator decisions + 75-RESEARCH.md)*
