# Phase 75: Rename force/unsupported vocabulary to partial/partially-available - Research

**Researched:** 2026-07-02
**Domain:** Brownfield vocabulary rename (codebase census + persisted-literal migration design)
**Confidence:** HIGH (all findings verified by reading the actual source + typebox schemas in-repo)

> This is a CODEBASE CENSUS, not web/domain research. No external stack, no package
> legitimacy audit, no security-domain section — the phase adds no dependencies and changes
> no behavior. Every claim below is `[VERIFIED: codebase grep/read]` unless tagged otherwise.

<user_constraints>
## User Constraints

**No CONTEXT.md exists** — the user opted to plan directly. The ROADMAP Phase 75 goal is the
authoritative spec (verbatim below). There are no locked decisions from a discuss step, which
means the naming ambiguities in this document (§2, Open Questions) are UNRESOLVED and must be
locked by the planner or routed to discuss before execution.

### Authoritative goal (ROADMAP, verbatim)
> Rename the force-install / unsupported feature vocabulary to partial / partially-available
> across code, tests, and docs. The top-level plugin verdict `unsupported` becomes "partially
> available"; the `--force` install/update flag becomes `--partial` (no alias); and the
> force-family (`force-installed`, `force-installed-upgradable`, `force-upgradable`, `forceHint`,
> `FORCE_UPDATE_HINT_TRAILER`, "force installed" prose) moves to the partial vocabulary. Persisted
> status literals are migrated with a `schemaVersion` bump. Explicitly OUT of scope: unrelated
> `force` uses (`git push --force`, `forceGithub`) and the component-level classification — the
> `compatibility.supported`/`unsupported` state arrays and the `unsupported hooks` /
> `unsupported source` reason tokens stay byte-identical (a plugin is partially available
> *because* some component kinds are unsupported).

### Project Constraints (from CLAUDE.md) — treat as locked
- **NFR-1 atomic writes:** all disk mutations atomic (already satisfied by `atomicWriteJson` /
  `write-file-atomic`; the rename adds no new write paths).
- **NFR-3 idempotent/retry-safe:** the only persisted-literal migration (completion cache) is a
  drop-and-rebuild, inherently idempotent.
- **NFR-6 quality bar:** `npm run check` (typecheck + ESLint + Prettier + tests) must stay green.
- **Byte-equality catalog UAT:** the renderer/token change, the catalog doc, and the byte-UAT
  fixtures MUST land in the same commit (atomic-supersession lesson — v1.3). See §5.
- **Comment policy** (`.claude/rules/typescript-comments.md`): do NOT introduce `Phase 75` / `Wave`
  / `Plan` references in comments. Decision IDs (`D-…`), requirement IDs, and domain words
  (`phase ledger`, two-phase-commit narration) are preserved. A NEW decision ID should be minted
  for the rename (e.g. `D-75-01`) rather than a phase reference.
- **Versioning** (CLAUDE.md): before PR, offer to bump `package.json` + `sonar-project.properties`
  + `EXTENSION_VERSION` (drift guard, see §3) + `package-lock.json` + CHANGELOG.
- **Git:** never commit to `main`; branch `features/*`; `--squash` merges; `SKIP=trufflehog` prefix
  when committing from a worktree; run `pre-commit run --all-files` before commit.
</user_constraints>

<phase_requirements>
## Phase Requirements

No formal requirement IDs are defined for this phase (ROADMAP says "Requirements: TBD"). The
ROADMAP goal is the authoritative spec. The planner should mint a small requirement set (suggest
prefix `RVOC-*` "rename vocabulary") or proceed from the goal + this research directly. The seven
research directives below map 1:1 to the sections the planner consumes.

| Directive | Section |
|-----------|---------|
| 1. Occurrence census (in-scope) | §1 |
| 2. Exact current names → proposed targets | §2 |
| 3. Persisted-literal migration | §3 |
| 4. Out-of-scope exclusion list + rule | §4 |
| 5. User-visible output-contract surfaces | §5 |
| 6. Test surfaces | §6 |
| 7. Sequencing / risk | §7 |
| Validation architecture (Nyquist) | Validation Architecture |
</phase_requirements>

## Summary

Phase 75 is a **pure, behavior-preserving vocabulary rename** across a tightly-coupled
TypeScript codebase (`extensions/pi-claude-marketplace/`, NOT `src/`). The in-scope vocabulary is
concentrated in ~20-25 source files, anchored by two hubs: the discriminated notification type
model in `shared/notify.ts` (3627 lines — the closed-set token tuples, per-status interfaces,
glyph constants, hint-trailer literals, and render switch) and the three-way resolver state in
`domain/resolver.ts` (`installable` / `unsupported` / `unavailable`). The user-visible surface is
governed by a byte-equality contract across three coupled artifacts (`shared/notify.ts` renderer
+ `docs/output-catalog.md` + the inline `FIXTURES` map in `tests/architecture/catalog-uat.test.ts`)
that MUST change atomically.

**The single most important finding — and a correction to the phase's framing:** the phrase
"Persisted status literals are migrated with a `schemaVersion` bump" is TRUE only for the
**ephemeral completion cache** (`shared/completion-cache.ts` `PLUGIN_INDEX_CACHE_SCHEMA`,
`schemaVersion: 3`), whose migration is a trivial **drop-and-rebuild on version mismatch** (no
data transform). The **durable `state.json` persists NO in-scope status literal** — force-state is
DERIVED (no persisted flag, milestone-confirmed), and the only `unsupported`/`supported` on disk
is the component-kind array `compatibility.unsupported[]`/`supported[]`, which is EXPLICITLY OUT
OF SCOPE. So `state.json` needs **no schemaVersion bump and no old→new transform** for this rename.
This de-risks the phase substantially.

The dominant risk is not correctness (the TypeScript discriminated union makes the rename
self-guiding via compile errors) but **byte-gate RED windows** during a multi-commit landing, and
**over-rename** of the many out-of-scope `force`/`unsupported` substrings that legitimately remain
(node-fs `rm({force:true})`, isomorphic-git `writeRef({force:true})`, the component-level
`compatibility.unsupported[]`, and the `unsupported hooks`/`unsupported source` reason tokens).

**Primary recommendation:** Lock the naming targets (§2 decisions) FIRST, then execute the rename
as **one atomic, compile-green + byte-green commit** (or at most 2-3 slices each independently
green), governed by the symbol-level exclusion rule in §4. The type system + catalog-UAT byte gate
make this rename self-verifying; splitting it primarily risks byte-gate RED windows without
reducing complexity.

## Architectural Responsibility Map

The "tiers" here are the vocabulary clusters × the layer that owns each. Consumed by the planner
to sanity-check that a rename in one cluster propagates to its coupled surfaces.

| Vocabulary cluster | Primary owner (source of truth) | Coupled surfaces (must move in lockstep) | Rationale |
|--------------------|----------------------------------|-------------------------------------------|-----------|
| `--force` flag (input) | `edge/handlers/plugin/shared.ts` (parse), `edge/handlers/plugin/{install,update}.ts` (USAGE) | `edge/completions/provider.ts` + `data.ts` (tab-completion), `edge/handlers/tools.ts`, hint-trailer strings in `notify.ts`, docs USAGE, `tests/edge/**` | user-typed token; changing it changes USAGE bytes + completion + the two frozen hint trailers |
| Top-level verdict `unsupported` (output + logic) | `domain/resolver.ts` (`state: "unsupported"` discriminator) | `shared/notify.ts` (`PluginUnsupportedMessage`, `STATUS_TOKENS`, render), `plugin-state-classifier.ts`, `shared/completion-cache.ts` literal, `--unsupported` filter, `list.ts`/`info`/`tools.ts`, docs, catalog fixtures | the verdict is the resolver's discriminated state; render token + filter + cache literal all derive from it |
| Force-state family (`force-installed`, `force-upgradable`, `force-installed-upgradable`) (derived output) | `shared/notify.ts` (`PLUGIN_STATUSES`/`STATUS_TOKENS` + per-status interfaces) + `plugin-state-classifier.ts` (`InstalledClassification`) | `shared/completion-cache.ts` literals, `edge/completions/data.ts` status sets, `list/update/reconcile/marketplace` messaging + orchestrators, `edge/handlers/tools.ts`, docs, catalog fixtures | DERIVED from the verdict; no persisted flag; concentrated in the notify type model |
| Glyph constants + hint trailers | `shared/notify.ts` (`ICON_FORCE_INSTALLED`, `ICON_UNSUPPORTED`, `FORCE_INSTALL_HINT_TRAILER`, `FORCE_UPDATE_HINT_TRAILER`, `forceHint`) | `*.messaging.ts` importers, docs (frozen trailer strings), `tests/shared/notify-v2.test.ts`, catalog fixtures | constant/field renames + the frozen trailer byte strings (which embed `--force`) |
| Internal degrade-`force` plumbing (`InstallPluginOptions.force`, `requireForceInstallable`, `forceDegrade`, `forceUpgradable`, `FORCE_*_STATUSES`, `will force install` modifier) | `orchestrators/plugin/{install,update}.ts`, `orchestrators/types.ts`, `domain/resolver.ts` gates | reconcile, marketplace update, edge-deps, completions | NOT enumerated in the goal — DEPTH DECISION (§2.D) whether these follow the flag rename |

## 1. Occurrence Census (in-scope)

Grouped by target rename. File paths are relative to repo root; source lives under
`extensions/pi-claude-marketplace/` (abbreviated `EXT/` below). `[VERIFIED: grep/read]` throughout.

### 1a. `--force` install/update flag → `--partial`

The literal `--force` string (user-typed token + USAGE + completion + hint trailers):

| File:line | Occurrence | Kind |
|-----------|-----------|------|
| `EXT/edge/handlers/plugin/shared.ts:61,63,64` | `token === "--force"` parse arm | flag recognition (install/update) |
| `EXT/edge/handlers/plugin/install.ts:32,43,45` | USAGE string `[--force]` + `extractLocalFlag(...,["--map-model","--force"])` | USAGE + passthrough |
| `EXT/edge/handlers/plugin/update.ts:24,31,32,78` | USAGE string `[--force]` + passthrough | USAGE + passthrough |
| `EXT/edge/completions/provider.ts:120,281,283,288,292` | `name: "--force"` completion; `booleanFlags=["--force"]`; `tokens.includes("--force")` | tab-completion flag |
| `EXT/edge/completions/data.ts:21-33,60-96,305,361-398` | `(mode,--force)` filter comments + `force` param | completion candidate gating (comments + logic) |
| `EXT/shared/notify.ts:2265` | `FORCE_INSTALL_HINT_TRAILER = "Re-run with --force to install the supported components."` | **frozen byte string** |
| `EXT/shared/notify.ts:2276` | `FORCE_UPDATE_HINT_TRAILER = "Re-run with --force to update with the supported components."` | **frozen byte string** |
| `EXT/orchestrators/plugin/install.ts:178,273,367,496-502,1525,1730` | `--force` in comments + the gate-select logic | prose + logic |
| `EXT/orchestrators/plugin/update.ts:78,322,513,759-781,1567,1609,1639` | `--force` prose + gate logic | prose + logic |
| `EXT/domain/resolver.ts:1237,1249,1257` | `--force` narrowing-gate comments | prose |
| `EXT/shared/errors.ts:414` | `--force` hint comment | prose |
| `EXT/edge/handlers/plugin/reinstall.ts:11,32` | comments: `--force` was RETIRED here (RINST-01) | prose only (reinstall rejects the flag) |

**`--partial` collision check:** `grep -- '--partial'` across `extensions/ tests/ docs/` returns
**ZERO** hits `[VERIFIED]`. The target token is free.

### 1b. Top-level verdict `unsupported` → "partially available" (render token + resolver state)

The IN-SCOPE `unsupported` (the discriminated verdict / status / render token / filter) — distinct
from the OUT-OF-SCOPE component-level `unsupported` (see §4):

| File:line | Occurrence | Kind |
|-----------|-----------|------|
| `EXT/domain/resolver.ts:194` | `state: Type.Literal("unsupported")` (schema) | **resolver state discriminator** |
| `EXT/domain/resolver.ts:219` | `ResolvedPluginUnsupported` type | type name |
| `EXT/domain/resolver.ts:229` | `MaterializablePlugin = …Installable \| …Unsupported` | union member name |
| `EXT/domain/resolver.ts:420` | `unsupported()` factory returning `state:"unsupported"` | factory fn + literal |
| `EXT/domain/resolver.ts:1238,1244,1264` | `r.state === "unsupported"` (gates) | verdict test |
| `EXT/domain/components/hooks.ts:7,27,358` | prose: `state: "unsupported"` | prose |
| `EXT/shared/notify.ts:234` | `STATUS_TOKENS` member `"unsupported"` | closed-set token |
| `EXT/shared/notify.ts:416` | `PLUGIN_STATUSES` member `"unsupported"` | closed-set status |
| `EXT/shared/notify.ts:698-721` | `PluginUnsupportedMessage` interface (`status:"unsupported"`) | render variant |
| `EXT/shared/notify.ts:922` | union arm `\| PluginUnsupportedMessage` | union |
| `EXT/shared/notify.ts:2090,2100,2994,3513,3531` | render arm `case "unsupported"` + explicit `"(unsupported)"` string | **render bytes** |
| `EXT/shared/completion-cache.ts:94,118` | `Type.Literal("unsupported")` + `PluginIndexRow.status` union | **persisted cache literal** |
| `EXT/orchestrators/plugin/plugin-state-classifier.ts:53,169` | `ManifestEntryClassification` `"unsupported"` + `case "unsupported"` | classifier |
| `EXT/orchestrators/plugin/list.ts:220,420,544,587,1024` | `bucket==="unsupported"`, `state==="unsupported"`, `case "unsupported"` | list logic + render |
| `EXT/orchestrators/plugin/install.ts:1438` | `installCtx.resolved.state === "unsupported"` | install logic |
| `EXT/orchestrators/plugin/install.messaging.ts:110,115` | `ICON_UNSUPPORTED` + `"(unsupported)"` | **render bytes** |
| `EXT/orchestrators/plugin/list.messaging.ts:122,127,131` | `ICON_UNSUPPORTED` + `"(unsupported)"` | **render bytes** |
| `EXT/orchestrators/plugin/update.ts:1569` | `installable.state === "unsupported"` | update logic |
| `EXT/orchestrators/reconcile/notify.ts:287,316` | `resolved.state === "unsupported"` | reconcile logic |
| `EXT/orchestrators/reconcile/apply.ts:1155` | `resolved.state === "unsupported" ? …` | reconcile logic |
| `EXT/edge/handlers/tools.ts:177,337,364,387` | `case "unsupported"` (LLM tool status projection) | tool surface |
| **`--unsupported` list FILTER** | | |
| `EXT/edge/handlers/plugin/list.ts:22,24,47,77` | USAGE `[--unsupported]`; `BOOLEAN_FLAGS`; `unsupported:true` opt | **user filter flag** |
| `EXT/edge/completions/provider.ts:99,103` | `--unsupported` completion suggestion | completion |
| `EXT/orchestrators/plugin/list.ts:125,200,217,515,527` | `--unsupported` filter prose + `opts.unsupported` | filter logic |
| `EXT/shared/notify.ts:1447-1455` | `ICON_UNSUPPORTED = "⊖"` constant + doc | glyph constant |

### 1c. Force-state family → partial vocabulary

`force-installed`, `force-upgradable`, `force-installed-upgradable` (and derivatives):

| File:line | Occurrence | Kind |
|-----------|-----------|------|
| `EXT/shared/notify.ts:226,227,408,409` | `STATUS_TOKENS` + `PLUGIN_STATUSES` members `"force-installed"`, `"force-upgradable"` | closed-set tokens |
| `EXT/shared/notify.ts:758-766` | `PluginForceInstalledMessage` (`status:"force-installed"`) | render variant |
| `EXT/shared/notify.ts:781-792` | `PluginForceUpgradableMessage` (`status:"force-upgradable"`) | render variant |
| `EXT/shared/notify.ts:932,933` | union arms `\| PluginForceInstalledMessage \| PluginForceUpgradableMessage` | union |
| `EXT/shared/notify.ts:1915-1945` | `forceInstalledRow` SOLE composer + explicit `"(force-installed)"` | **render bytes** |
| `EXT/shared/notify.ts:2111,2991,3538` | render arms `"(force-upgradable)"`, glyph switch, forceHint | **render bytes** |
| `EXT/shared/completion-cache.ts:73,90,91,92,115,116,117` | cache literals `force-installed`, `force-installed-upgradable`, `force-upgradable` + `PluginIndexRow.status` | **persisted cache literals** |
| `EXT/orchestrators/plugin/plugin-state-classifier.ts:42-47,131,137,140,146` | `InstalledClassification` (`force-installed`, `force-installed-upgradable`, `force-upgradable`) + logic | classifier |
| `EXT/edge/completions/data.ts:51-90` | `INSTALLED_INVENTORY_STATUSES`, `FORCE_INSTALL_STATUSES`, `FORCE_UPDATE_STATUSES` sets | completion sets (const names + members) |
| `EXT/orchestrators/plugin/list.ts:397,401` | `status==="force-installed"\|\|"force-installed-upgradable"` | list logic |
| `EXT/orchestrators/plugin/list.messaging.ts:135,139,143` | `ICON_FORCE_INSTALLED`, `"(force-installed)"`, `"(force-upgradable)"` | **render bytes** |
| `EXT/orchestrators/plugin/update.messaging.ts:83` | `"(force-upgradable)"` | **render bytes** |
| `EXT/orchestrators/reconcile/reconcile.messaging.ts:96,202` | `"(will force install)"` modifier + `forceInstalledRow` comment | **render bytes** |
| `EXT/orchestrators/reconcile/notify.ts:369` | `...(force && { force: true })` | will-force modifier plumbing |
| `EXT/orchestrators/marketplace/update.messaging.ts:86` | `(force-installed)` comment | prose |
| `EXT/edge/handlers/tools.ts:170,171,330,331,394,395` | `case "force-installed"`/`"force-upgradable"` (tool projection) | tool surface |

### 1d. `forceHint`, hint-trailer constants, glyph constants, `force` modifier

| Symbol | Definition | Consumers |
|--------|-----------|-----------|
| `forceHint?: boolean` field | `notify.ts:694,720,791` (on `PluginUnavailableMessage`, `PluginUnsupportedMessage`, `PluginForceUpgradableMessage`) | set at `install.ts:1545`, `update.ts:1666`; read at render `notify.ts:3531,3538`; tests `notify-v2.test.ts`, `install.test.ts`, `catalog-uat.test.ts` |
| `FORCE_INSTALL_HINT_TRAILER` | `notify.ts:2265` | render `notify.ts:3532`; docs `messaging-style-guide.md:142` |
| `FORCE_UPDATE_HINT_TRAILER` | `notify.ts:2276` | render `notify.ts:3539`; docs `messaging-style-guide.md:142` |
| `ICON_FORCE_INSTALLED = "◉"` | `notify.ts:1443` | `notify.ts:1941,2991`; `list.messaging.ts:4,139`; `reconcile.messaging.ts:202` |
| `ICON_UNSUPPORTED = "⊖"` | `notify.ts:1455` | `notify.ts:2096,2997`; `install.messaging.ts:4,110`; `list.messaging.ts:7,127` |
| `force?: boolean` modifier on `PluginWillInstallMessage` | `notify.ts:868` → renders `(will force install)` | `reconcile.messaging.ts:96`, `reconcile/notify.ts:369` |

### 1e. "force install" SPACE-form prose

Only 2 comment occurrences use the space form (`EXT/orchestrators/plugin/install.messaging.ts:90`,
`EXT/domain/resolver.ts:228`). Low volume; comment-only.

### Volume summary (per-file `force` counts, in-scope-dominant files) `[VERIFIED: grep -c]`
`shared/notify.ts:109`, `orchestrators/plugin/update.ts:60`, `edge/completions/data.ts:48`,
`orchestrators/plugin/install.ts:42`, `orchestrators/plugin/list.ts:39`,
`plugin-state-classifier.ts:34`, `domain/resolver.ts:30`. Docs: `output-catalog.md:55`,
`prd/…prd.md:24`, `messaging-style-guide.md:6`. (Many `force` hits in bridges/platform/persistence
are OUT of scope — see §4.)

## 2. Exact Current Names → Proposed Targets (LOCK THESE FIRST)

The ROADMAP gives the intent but leaves the exact literal forms ambiguous. **These MUST be locked
before execution** — the byte gate turns every choice into a hard contract. Below is a proposed
coherent scheme; every row flagged **[DECISION]** needs user/planner confirmation.

### 2.A Verdict + status tokens (user-visible render bytes)

| Current | Proposed target | Notes / ambiguity |
|---------|-----------------|-------------------|
| render `(unsupported)` | `(partially available)` **[DECISION]** | Goal says verdict → "partially available" (two words). Space-form has precedent (`(manual recovery)`). Alt: `(partially-available)` hyphen. |
| status literal `"unsupported"` (notify) | `"partially available"` (space) or `"partially-available"` (hyphen) **[DECISION]** | `PLUGIN_STATUSES`/`STATUS_TOKENS` member + discriminator. Precedent `"manual recovery"` uses a SPACE in the literal AND renders `(manual recovery)`. |
| resolver `state: "unsupported"` | `state: "partially-available"` **[DECISION: rename state or keep internal?]** | Renaming avoids the same-object collision with `.unsupported[]`. Alt: keep internal `state:"unsupported"`, rename only render token (smaller blast radius, but keeps `force-installed` derived from a `"unsupported"` state — confusing). **Recommend rename** for coherence. |
| render `(force-installed)` | `(partially installed)` / `(partially-installed)` **[DECISION]** | Goal explicitly flags `force-installed → partially-installed vs partial-installed`. Recommend `partially-installed` to rhyme with `partially-available`. |
| render `(force-upgradable)` | `(partially upgradable)` / `(partially-upgradable)` **[DECISION]** | Follow the same scheme as force-installed. |
| classifier `"force-installed-upgradable"` | `"partially-installed-upgradable"` **[DECISION]** | Internal classifier + cache literal only (renders as `(force-installed)` today → `(partially installed)`). |
| render `(will force install)` | `(will partial install)` / `(will partially install)` **[DECISION]** | `force?` modifier on `PluginWillInstallMessage`. |

### 2.B User-input flags

| Current | Proposed target | Notes / ambiguity |
|---------|-----------------|-------------------|
| `--force` (install/update) | `--partial` (no alias) | Stated in goal. Free token (no collision). |
| `--unsupported` (list filter) | `--partial` OR `--partially-available` **[DECISION]** | NOT enumerated in the goal, but it filters on the renamed verdict, so leaving `--unsupported` is inconsistent. `--partial` would reuse the install flag's word across a different command (no hard collision, mild confusion). Recommend `--partial` for symmetry, or `--partially-available` for precision. **Must be locked.** |

### 2.C Constants, fields, hint trailers, glyph names

| Current | Proposed target | Notes |
|---------|-----------------|-------|
| `forceHint?` field | `partialHint?` **[DECISION]** | 3 interfaces + producers + render + tests |
| `FORCE_INSTALL_HINT_TRAILER` | `PARTIAL_INSTALL_HINT_TRAILER` | + string body `--force`→`--partial` |
| `FORCE_UPDATE_HINT_TRAILER` | `PARTIAL_UPDATE_HINT_TRAILER` | + string body `--force`→`--partial` |
| trailer body `"Re-run with --force to install the supported components."` | `"Re-run with --partial to install the supported components."` | **frozen DOC contract** (D-70-01) — updates in lockstep with `messaging-style-guide.md:142` + catalog fixtures |
| trailer body `"Re-run with --force to update with the supported components."` | `"Re-run with --partial to update with the supported components."` | same |
| `ICON_FORCE_INSTALLED` | `ICON_PARTIALLY_INSTALLED` **[DECISION]** | glyph CHAR `◉` unchanged (visual); only the constant name |
| `ICON_UNSUPPORTED` | `ICON_PARTIALLY_AVAILABLE` **[DECISION]** | glyph CHAR `⊖` unchanged; only the constant name. **DECISION: keep glyph chars ◉/⊖ or change?** Recommend KEEP (changing visual glyphs is a larger UX change than a vocabulary rename). |

### 2.D Internal degrade-`force` plumbing (DEPTH DECISION)

**[DECISION — the single biggest scope lever]** The goal enumerates a specific force-FAMILY but
does NOT list these internal symbols. Leaving them while the user types `--partial` and sees
`(partially installed)` is incoherent; renaming them widens the blast radius. **Recommend: rename
the degrade-force plumbing fully to `partial` vocabulary**, because it is the internal
representation of the renamed flag/verdict. Symbols:

| Current | Proposed | File |
|---------|----------|------|
| `InstallPluginOptions.force` / `opts.force` | `.partial` | `install.ts:275,368,504,993` |
| `UpdatePluginOptions.force` / `args.force` | `.partial` | `update.ts:200,326,514,648,765` |
| `requireForceInstallable` | `requirePartialInstallable` | `resolver.ts:1260`; consumers in install/update/reinstall |
| `forceable?` (thrown-error flag) | `partialable?` / `degradable?` | `install.ts:179`; `resolver.ts:1238` |
| `forceDegrade?` | `partialDegrade?` | `orchestrators/types.ts:166`; marketplace/plugin update |
| `forceUpgradable?` | `partialUpgradable?` | `orchestrators/types.ts:206` |
| `FORCE_INSTALL_STATUSES` / `FORCE_UPDATE_STATUSES` | `PARTIAL_INSTALL_STATUSES` / `PARTIAL_UPDATE_STATUSES` | `edge/completions/data.ts:70,86` |
| `force` boolean modifier + `force: true` (reconcile/autoupdate degrade) | `partial` | `reconcile/notify.ts:369`; `update.ts:514`; `marketplace/update.ts` |

> **Collision warning:** `update.ts:514 force: true` is the DEGRADE force (in-scope), but
> `reinstall.ts:233,1743 rm(dataDir,{force:true})` and `reinstall.ts:1347
> replacePreparedAgents(...,{force:true})` are the OVERWRITE force (OUT of scope, §4). Do not
> blanket-replace `force: true`.

### 2.E New decision ID

Mint `D-75-01` (or `RVOC-01`) for the rename and use it as the comment traceability anchor, per
`.claude/rules/typescript-comments.md`. Do NOT write `Phase 75` in comments.

## 3. Persisted-Literal Migration

**Four persisted surfaces exist; only ONE carries an in-scope literal, and its migration is trivial.**
All verified by reading the typebox schemas.

| Surface | File | Schema version mech | In-scope literal? | Action |
|---------|------|---------------------|-------------------|--------|
| **`state.json`** | `persistence/state-io.ts` (`STATE_SCHEMA`) | `schemaVersion: Union(Literal(1),Literal(2))` — v2 is the `enabled` (ENBL-02) shape | **NO** — only `compatibility.unsupported[]`/`supported[]` (component-kind arrays, OUT of scope, §4); force-state is DERIVED (no persisted flag) | **NONE.** No schemaVersion bump, no transform. |
| **`claude-plugins.json` / `.local.json`** | `persistence/config-io.ts` (`CONFIG_SCHEMA`) | `schemaVersion: Optional(Literal(1))`; fields `source`/`autoupdate`/`enabled` | **NO** | NONE |
| **`agents-index.json`** | `persistence/agents-index-schema.ts` | `schemaVersion: Literal(1)` | **NO** | NONE |
| **completion cache** (`<extensionRoot>/cache/plugins/<mp>.json`) | `shared/completion-cache.ts` (`PLUGIN_INDEX_CACHE_SCHEMA`) | `schemaVersion: Literal(3)` | **YES** — `Type.Literal("force-installed")`, `"force-installed-upgradable"`, `"force-upgradable"`, `"unsupported"` (lines 90-94) + `PluginIndexRow.status` union (111-119) | **bump `Literal(3)`→`Literal(4)` + rename the literal union + rename `PluginIndexRow.status`** |

**Grep proof:** `grep -rInE 'force-install|force-upgrad|"unsupported"|partially' extensions/…/persistence/`
returns EMPTY `[VERIFIED]` — no in-scope status literal is persisted in state/config/agents-index.

### Completion-cache migration design (the only migration)

The completion cache is EXPLICITLY "an ephemeral optimization cache, NOT the persisted state model"
(`completion-cache.ts:78-79`). Its migration reuses the EXISTING drop-and-rebuild-on-mismatch path
(precedent: the `1→3` bump for the force-install milestone, T-67-07):

1. Change `PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion` from `Type.Literal(3)` to `Type.Literal(4)`
   (line 81). **Also** bump the two `schemaVersion: 3 as const` write literals (lines 334 poison-row,
   347 normal-write) to `4`.
2. Rename the `status` union literals (lines 90-94) and the `PluginIndexRow.status` type (111-119)
   to the new vocabulary.
3. Any on-disk cache with `schemaVersion !== 4` (or carrying a now-removed literal) fails
   `PLUGIN_INDEX_VALIDATOR.Check` → the existing "schema mismatch → drop + `atomicWriteJson`
   rebuild" path fires on next read (`getPluginIndex`, lines 212, 307-324). The rebuild regenerates
   rows from `state.json` + `marketplace.json` with the new literals.

**Migration properties (all satisfied by the existing machinery):**
- **Atomic (NFR-1):** rebuild writes via `atomicWriteJson`. ✓
- **Idempotent / retry-safe (NFR-3):** drop-rebuild is stateless; re-reading a fresh v4 cache is a
  hit. ✓
- **Backward-safe:** a pre-bump (v3) file mismatches → dropped → rebuilt (migrates cleanly). A
  post-bump (v4) file matches → used (no double-migration; the schema literal is exact-match). ✓
- **No data transform, no old→new parser needed** — the cache is derived, not authoritative.

`MARKETPLACE_NAMES_CACHE_SCHEMA` (`Literal(2)`, `completion-cache.ts:66`) carries no status literal
→ untouched.

### The "drift guard" clarification

The phase note "the drift guard that couples state schema to EXTENSION_VERSION" is a slight
mischaracterization. The actual coupling is: `EXTENSION_VERSION = "0.7.0"`
(`shared/extension-version.ts:16`) is coupled to `package.json` `version` by
`tests/architecture/extension-version-sync.test.ts` (a bump-in-lockstep guard). The
`lastReconciledExtensionVersion` field in `state.json` STORES `EXTENSION_VERSION` to gate the
load-time backfill scan — but the STATE_SCHEMA version is NOT coupled to EXTENSION_VERSION. This
rename does not touch `EXTENSION_VERSION` logic; a routine release version bump (0.7.0 → next) is a
separate CLAUDE.md versioning concern, not part of the vocabulary migration.

## 4. Out-of-Scope Exclusion List + Distinguishing Rule

These share the substrings `force` / `unsupported` / `supported` but **MUST stay byte-identical**.

### 4a. `force` — OUT of scope (overwrite / node-fs / isomorphic-git semantics)

| Occurrence | File:line | Why out-of-scope |
|-----------|-----------|------------------|
| `forceUpdateRef` / `writeRef({ force: true })` / `force: true` | `platform/git.ts:170,171,179,185,195` | isomorphic-git ref-force API |
| `rm(..., { recursive: true, force: true })` | `bridges/{hooks,skills}/stage.ts`, `bridges/skills/unstage.ts`, `bridges/mcp/stage.ts:292`, `bridges/agents/stage.ts:600`, `orchestrators/plugin/{uninstall.ts:607, reinstall.ts:233,1743}`, `orchestrators/marketplace/remove.ts:172` | node fs `rm` overwrite flag |
| `AgentStageOptions.force` / `options?.force` / `replacePreparedAgents(...,{force:true})` | `bridges/agents/types.ts:148`, `bridges/agents/stage.ts:442,455`, `bridges/skills/stage.ts:156`, `orchestrators/plugin/reinstall.ts:139,1344,1347` | bridge **staging-overwrite** semantics (reinstall repair primitive) — a DIFFERENT `force` than degrade-install |
| `RemoveDataDirFn ... { force: true }` | `reinstall.ts:139` | node fs signature |
| `forceGithub` | — | **DOES NOT EXIST** `[VERIFIED: grep empty]`. The goal lists it defensively; no action needed. |
| `git push --force` | — | Not present as literal; the only git-force is `writeRef` above. |

### 4b. `unsupported` / `supported` — OUT of scope (component-level classification)

| Occurrence | Files (representative) | Why out-of-scope |
|-----------|------------------------|------------------|
| reason tokens `"unsupported source"`, `"unsupported hooks"` | `notify.ts:97,98` (REASONS members) + ~66 occurrences across code/docs/tests | component-level REASON tokens — the goal EXPLICITLY preserves these |
| `compatibility.unsupported[]` / `compatibility.supported[]` (state record) | `state-io.ts:60,61`; classifier `plugin-state-classifier.ts:73,135`; `list.ts:405`; `apply.ts:1155`; ~63 occurrences | component-KIND arrays (`["lsp","hooks"]`) — the goal EXPLICITLY preserves these |
| `resolved.unsupported` / `r.unsupported` / `candidateResolved.unsupported` (resolved-plugin field) | `resolver.ts` (`MATERIALIZABLE_FIELDS`), `list.ts:421,552`, `install.ts:1444`, `reconcile/notify.ts:526` | the component-kind array on the resolved object (co-located with the in-scope `state`) |
| `narrowUnsupportedKinds(...)` helper + `unsupportedKinds` field | `shared/probe-classifiers.ts:157`; consumers in install/update/list/reconcile/marketplace; `resolver.ts:1244`, `update.ts:798` | operates on the OUT-of-scope component KINDS, produces the OUT-of-scope reason tokens — **recommend OUT of scope** (it is a component-kind→reason mapper, not the verdict). **[borderline DECISION]** |
| PRD prose "…(unsupported)" component lists, mermaid `(unsupported source/components)` | `prd/…:118,119,124,546,819`, PR-2/PR-3/PR-9 | describes which COMPONENTS are unsupported |

### 4c. The distinguishing RULE (symbol-level, mechanizable)

> **A token is IN SCOPE iff it is (a) the resolver's discriminated `state` value, (b) a notify
> `status` value / `STATUS_TOKENS`/`PLUGIN_STATUSES` member / `(…)` render string, (c) the
> completion-cache `status` literal, (d) the `--force`/`--unsupported` user flag, or (e) a
> force-family symbol/constant/field name (`force-installed*`, `force-upgradable`, `forceHint`,
> `FORCE_*_HINT_TRAILER`, `ICON_FORCE_INSTALLED`, `ICON_UNSUPPORTED`, the degrade-`force` option
> plumbing per §2.D).**
>
> **A token is OUT OF SCOPE iff it is (a) a `.supported`/`.unsupported` PROPERTY of a
> `compatibility` object or a resolved plugin (component-kind arrays), (b) the exact reason strings
> `"unsupported source"`/`"unsupported hooks"`, (c) `narrowUnsupportedKinds`/`unsupportedKinds`
> (component-kind mappers), or (d) any `force` that is a node-fs `rm`/isomorphic-git
> `writeRef`/bridge staging-OVERWRITE flag (`{ force: true }`, `AgentStageOptions.force`).**

**Executor-friendly corollary for find-replace safety:**
- The in-scope verdict/status is the EXACT standalone quoted `"unsupported"`. The out-of-scope
  reasons are the LONGER strings `"unsupported source"` / `"unsupported hooks"`. The out-of-scope
  component arrays are the UNQUOTED identifiers `unsupported:` / `.unsupported` / `supported:`.
  → A regex targeting `"unsupported"` as a whole quoted literal hits only in-scope; it must NOT
  match inside `"unsupported source"` or the unquoted `.unsupported`.
- **The collision is real and dense.** Adjacent-line examples where in- and out-of-scope co-occur:
  `resolver.ts:1244 unsupportedKinds: r.state === "unsupported" ? r.unsupported : []` (OUT, IN,
  OUT); `apply.ts:1155 unsupported: resolved.state === "unsupported" ? resolved.unsupported : []`
  (OUT-property, IN-state, OUT-field); `list.ts:405,420-421`; `classifier:135,146`. **No blind
  substring replace is safe** — the executor must operate symbol-by-symbol, guided by the type
  system.

## 5. User-Visible Output-Contract Surfaces + Atomic-Supersession

Every byte the user sees is governed by a closed-loop byte-equality gate. The renderer token
change, the catalog doc, and the byte-UAT fixtures MUST land in ONE commit or the gate goes RED
(v1.3 atomic-supersession lesson).

### The atomic-supersession TRIAD (all three change together)

1. **Renderer / producers** — `shared/notify.ts` (render arms, glyph switch, hint trailers,
   `forceInstalledRow`) + the `*.messaging.ts` producers (explicit `"(force-installed)"` /
   `"(unsupported)"` / `"(force-upgradable)"` / `"(will force install)"` strings). **NOTE:** these
   `(…)` render strings are FREE strings, NOT coupled to the discriminated union — the compiler
   will NOT catch a stale `"(force-installed)"` render string if the status literal was renamed;
   only the catalog-UAT byte gate catches it. This is the #1 silent-drift hazard (§Pitfalls).
2. **Catalog doc** — `docs/output-catalog.md`. `catalog-uat.test.ts` READS this file at test time,
   extracts fenced blocks tagged `<!-- catalog-state: STATE -->`, and asserts byte-equality against
   `notify()` output. In-scope sections: `### Glyphs` (⊖), `## Status token reference` (the
   `(unsupported)`/`(force-installed)`/`(force-upgradable)` rows), `### Force-installed inventory
   row` (334), `### Force-installed inventory row -- partial-hook plugin` (345), `### Force-upgradable
   inventory row` (356), `### Force-install success with a soft-dep marker` (429), `### Failure --
   unsupported features in manifest (force-degradable)` (444), `### Force-upgradable decline,
   targeted update` (860), `### Force-upgradable skip, bulk update` (874), the `--unsupported` list
   examples (165-194). Token density: `force-installed:25`, `force-upgradable:13`, `(unsupported):9`,
   `--force:11`, `◉:12`, `⊖:9` `[VERIFIED: grep -c]`.
3. **Byte-UAT fixtures** — the inline `FIXTURES` map in `tests/architecture/catalog-uat.test.ts`
   (programmatic `NotificationMessage` payloads). These are DOUBLY coupled: they carry
   `status: "unsupported"` etc. (compile-checked against the renamed union) AND must produce bytes
   matching the renamed catalog blocks (runtime byte-checked). 72 `force` hits in this file.

### Other doc surfaces (prose, not byte-gated but must stay consistent)

- **`docs/messaging-style-guide.md`** (6 force hits): line 43 (`PluginUnsupportedMessage … ⊖`),
  lines 63-80 (variant list: `unsupported | unavailable | upgradable`), line 118
  (`(force-upgradable)` decline), **line 142 (the two FROZEN `--force` hint-trailer byte strings —
  D-70-01)**. The trailer strings here are the locked DOC contract asserted by the catalog gate.
- **`docs/prd/pi-claude-marketplace-prd.md`** (24 force hits): §Definitions lines 127-130
  (`Unsupported`/`Force-installed`/`Force-upgradable` glossary — the verdict def at 128 becomes
  "Partially available"), §5.2.1 line 272 (`--force` flag def), FORCE-01/04/05 + FSTAT-01a/03a +
  SEV-02a (276-281), §5.2.3 line 300 (`update --force`), **PL-4 (355) the status closed-set +
  glyph roles**, **PL-8 (359) `--unsupported` filter**, PL-9 (360), PR-1/PR-8 (553,560), ES-6
  (662), the command tree (1082-1086 `[--force]`/`[--unsupported]`). The requirement IDs
  themselves (FORCE-*, FSTAT-*, PR-*, PL-*, SEV-*) STAY — only the prose vocabulary moves. The
  component-level `unsupported` in PR-2/PR-3/PR-9/MM-2/MM-6 STAYS (§4).
- **`README.md`** — check for `--force`/`unsupported` command examples (not scanned in depth; the
  planner should grep `README.md` for `--force`/`(unsupported)`/`force-installed`).
- **`CHANGELOG.md`** — add a rename entry (CLAUDE.md versioning convention).

## 6. Test Surfaces (lockstep updates)

### Byte-gate + closed-set architecture tests
- `tests/architecture/catalog-uat.test.ts` — the FIXTURES map + reads `output-catalog.md` (§5).
- `tests/architecture/notify-closed-set-locks.test.ts` — asserts LENGTHS only:
  `STATUS_TOKENS.length===23`, `PLUGIN_STATUSES.length===18`, `REASONS.length===32`,
  `MARKETPLACE_STATUSES.length===7`. **This rename is length-preserving** (renames, doesn't
  add/remove) → the locks stay GREEN with NO count bump. Only test-title/comment prose referencing
  old tokens needs touching.
- `tests/architecture/notify-grammar-invariant.test.ts`, `notify-will-reload-agreement.test.ts`,
  `notify-stamp-coverage.test.ts`, `markers-snapshot.test.ts` — may enumerate token membership or
  assert on force tokens; scan for `force-installed`/`unsupported`/`--force`.

### Unit / behavior tests asserting on the vocabulary (`[VERIFIED: grep -l`])
Referencing `--force` literal: `resolver-strict.test.ts`, `completions/provider.test.ts`,
`handlers/plugin/{install,update,reinstall}.test.ts`, `edge/router.test.ts`, `edge-deps.test.ts`,
`orchestrators/plugin/{install,update,reinstall,plugin-state-classifier}.test.ts`,
`shared/notify-v2.test.ts`, `catalog-uat.test.ts`.

Asserting force-state / unsupported render tokens (glyphs/`(…)`): the above PLUS
`orchestrators/marketplace/update.test.ts`, `orchestrators/plugin/{list,info,cross-surface-reason-parity}.test.ts`,
`orchestrators/reconcile/{backfill,notify}.test.ts`, `shared/completion-cache.test.ts`
(the cache schemaVersion + literal union — must bump to 4 in lockstep), `tests/edge/handlers/tools.test.ts`
(34 force hits — LLM tool status projection).

### Completion / tab-completion tests keyed on `--force`
`tests/edge/completions/provider.test.ts` (38 force hits) + `tests/orchestrators/edge-deps.test.ts`
(33) assert the `--force`-gated candidate sets and the `--force` flag completion. These become
`--partial`. `tests/edge/completions/data.test.ts` (1).

### Persisted-migration test
`tests/persistence/migrate.test.ts` covers state.json migration — but since state.json needs NO
change (§3), no migrate test change is needed there. The completion-cache drop-rebuild is covered
by `tests/shared/completion-cache.test.ts` (add/adjust a v3-file-mismatch→rebuild case for v4).

## 7. Sequencing / Risk

### Recommended decomposition

The TypeScript discriminated union + the catalog-UAT byte gate make this rename **self-verifying
and resistant to partial landing**. Two viable shapes:

- **Option A (RECOMMENDED): 1 plan, 1 wave** — a single atomic, compile-green + byte-green rename
  commit covering all in-scope symbols + render strings + docs + fixtures + the completion-cache
  schemaVersion bump. Rationale: the status-token discriminator cannot be half-renamed without
  compile errors; the byte gate couples renderer+docs+fixtures; splitting mainly creates RED
  windows. Add a small **Wave 0** grep-absence guard test (below) landed first (additive, green on
  the current tree is NOT possible since old tokens still exist — so land the guard IN the same
  commit as the rename, asserting the post-state).
- **Option B: 2-3 plans** if the planner wants smaller reviewable units. The only clean seams that
  each stay independently green:
  1. `--force` → `--partial` flag + internal degrade-`force` plumbing + the two hint-trailer byte
     strings + USAGE + completion (touches catalog via the trailer bytes).
  2. Verdict `unsupported` → `partially-available` + force-state family + glyph constants +
     completion-cache bump (the big output-vocabulary slice; verdict and force-state are too
     intertwined — derived from each other, co-rendered, co-fixtured — to split further without a
     RED byte window).
  Landing order: 1 then 2, each an atomic byte-green commit.

**Do NOT** split "rename verdict" from "rename force-state" — they are derived from each other,
render on the same list/info surfaces, share the completion-cache union, and share catalog-UAT
fixtures; a commit boundary between them guarantees a RED byte gate.

### Riskiest edges

1. **Naming ambiguities unresolved (§2).** No CONTEXT.md exists. Executing before locking the
   render-token forms (`(partially available)` vs `(partially-available)`; `--unsupported` filter
   target; depth of internal `force` rename) would produce a byte contract that may not match
   intent. **This is the #1 blocker — lock §2 decisions first (planner or discuss).**
2. **Over-rename (the collision).** Dense adjacent co-occurrence of in-scope `state:"unsupported"`
   with out-of-scope `.unsupported[]` / `"unsupported hooks"` / `rm({force:true})` (§4c). A blind
   substring replace corrupts the preserved component-level classification and breaks tests.
   Mitigation: symbol-by-symbol edits guided by the type system + the grep-absence guard.
3. **Free-string render drift (§5).** The `(force-installed)`/`(unsupported)` render strings and
   the hint-trailer bodies are FREE strings not type-coupled — a partial rename passes `tsc` but
   fails the catalog-UAT byte gate. Mitigation: the byte gate is the safety net; run it every
   commit.
4. **The `--force` → `--partial` breaking change (no alias).** Users' muscle memory + any external
   scripts/docs break. This is intended (goal says "no alias"). Ensure README + CHANGELOG call it
   out. Tab-completion + arg-parse tests must flip in lockstep or the edge tests go RED.
5. **Completion-cache stale-file window.** After deploy, existing on-disk v3 caches carry old
   literals until the next read drops+rebuilds them. Harmless (the cache is optimization-only and
   self-heals), but the schemaVersion 3→4 bump makes it deterministic. Ensure BOTH the schema
   `Literal` and the two `as const` write literals bump together.

## Runtime State Inventory

> This IS a rename phase — inventory REQUIRED. The reassuring headline: **durable runtime state is
> essentially untouched; the only persisted in-scope literal lives in an ephemeral, self-healing
> cache.**

| Category | Items found | Action required |
|----------|-------------|------------------|
| **Stored data** | `state.json` `compatibility.unsupported[]`/`supported[]` (component-kind arrays) — OUT of scope, byte-identical. Force-state is DERIVED (no persisted flag) — confirmed by milestone design + `grep` of `persistence/` returning no in-scope literal. | **NONE** — no data migration of durable state. |
| **Live service config** | The completion cache files `<extensionRoot>/cache/plugins/<marketplace>.json` store in-scope status literals (`force-installed`, `unsupported`, etc.). These are NOT in git and NOT authoritative — rebuildable from `state.json` + `marketplace.json`. | **Bump `PLUGIN_INDEX_CACHE_SCHEMA` schemaVersion 3→4 + literal union** → existing drop-rebuild path self-heals every stale cache on next read. No manual data touch. (§3) |
| **OS-registered state** | None — the extension registers no OS-level state (no Task Scheduler, launchd, systemd, pm2). | **None — verified** (no such integration in the codebase). |
| **Secrets / env vars** | None reference the force/unsupported vocabulary. Git credentials (`platform/git-credential.ts`) and `PI_CODING_AGENT_DIR` are unrelated. | **None — verified.** |
| **Build artifacts / installed packages** | `EXTENSION_VERSION = "0.7.0"` constant (`shared/extension-version.ts`) is coupled to `package.json` by a drift-guard test. Not vocabulary; a routine release bump is a separate CLAUDE.md concern. No egg-info/compiled-binary analog (pure TS, native strip). | **None for the rename.** Offer a version bump at PR time per CLAUDE.md. |

**Canonical question answered:** *After every file is updated, what runtime systems still hold the
old string?* → Only the ephemeral completion-cache `.json` files under `<extensionRoot>/cache/`,
which drop-and-rebuild automatically on the schemaVersion mismatch. Nothing durable persists an
in-scope literal.

## Common Pitfalls

### Pitfall 1: Blind substring find-replace on `force` / `unsupported`
**What goes wrong:** `sed s/unsupported/partially-available/g` corrupts `"unsupported hooks"`,
`compatibility.unsupported[]`, and `narrowUnsupportedKinds`; `sed s/force/partial/g` corrupts
`rm({force:true})`, `writeRef({force:true})`, `AgentStageOptions.force`.
**How to avoid:** Apply the §4c symbol-level rule. Edit by symbol, not by substring. Let `tsc`
exhaustiveness (assertNever) + the grep-absence guard catch misses.
**Warning sign:** `npm run check` red in `bridges/` or `platform/` (pure-out-of-scope layers that
should be untouched) means over-rename.

### Pitfall 2: Renaming the status discriminator but not the free render string
**What goes wrong:** You rename `PLUGIN_STATUSES`/`status: "force-installed"` → `tsc` passes, but the
explicit `"(force-installed)"` render strings in `notify.ts:1945` and `list.messaging.ts:139` stay
→ catalog-UAT byte gate goes RED (or worse, drifts unnoticed if a fixture is also stale).
**How to avoid:** Treat the `(…)` render strings and hint-trailer bodies as first-class rename
targets (§1c/1d). Run `tests/architecture/catalog-uat.test.ts` every commit.

### Pitfall 3: Splitting verdict-rename from force-state-rename across commits
**What goes wrong:** A commit that renames `(unsupported)` but not `(force-installed)` (or vice
versa) leaves the catalog + fixtures half-migrated → RED byte gate mid-phase (the v1.3 lesson).
**How to avoid:** Keep the output-vocabulary rename atomic (Option A, or Option B slice 2).

### Pitfall 4: Forgetting the completion-cache write-literal bump
**What goes wrong:** Bumping `PLUGIN_INDEX_CACHE_SCHEMA` `Type.Literal(3)`→`4` but leaving
`schemaVersion: 3 as const` at `completion-cache.ts:334,347` → `saveState`-analog writes a v3 doc
that fails its own validator → the cache never stabilizes.
**How to avoid:** Bump all three `3`s together (schema + 2 write sites) and adjust the
`completion-cache.test.ts` expectations.

### Pitfall 5: Assuming a `state.json` migration is needed
**What goes wrong:** Building a `migrate.ts` transform for a non-existent persisted force/unsupported
literal — wasted work + risk of touching the OUT-of-scope `compatibility.unsupported[]`.
**How to avoid:** §3 — state.json persists no in-scope literal; no bump, no transform.

## Validation Architecture

> `workflow.nyquist_validation` is enabled (config.json). Test framework: **node:test** (built-in,
> Node ≥20.19). Run: `npm run check` (typecheck + ESLint + Prettier + `node --test`). Quick per-file:
> `node --test tests/architecture/catalog-uat.test.ts`.

Each rename bucket is verified by an existing, precise gate:

| Rename bucket | Verification | Command |
|---------------|--------------|---------|
| Output tokens (`(partially available)`, `(partially installed)`, glyphs, hint trailers) | **Byte-equality catalog UAT** — reads `output-catalog.md`, byte-compares `notify()` output vs the FIXTURES map | `node --test tests/architecture/catalog-uat.test.ts` |
| Closed-set integrity | Length locks (23/18/32/7) stay GREEN (length-preserving rename) | `node --test tests/architecture/notify-closed-set-locks.test.ts` |
| Resolver verdict rename | typebox `ResolvedPluginSchema` + discriminated `switch`/`assertNever` compile-checks; resolver-strict/loose tests | `node --test tests/domain/resolver-*.test.ts` |
| Force-state derivation | classifier unit tests + list/edge-deps parity | `node --test tests/orchestrators/plugin/plugin-state-classifier.test.ts tests/orchestrators/edge-deps.test.ts` |
| `--force`→`--partial` flag | edge handler parse + provider completion tests | `node --test tests/edge/completions/provider.test.ts tests/edge/handlers/plugin/install.test.ts` |
| Completion-cache migration (v3→v4 drop-rebuild) | cache mismatch→rebuild round-trip test | `node --test tests/shared/completion-cache.test.ts` |

### NEW test to add (Wave 0 gap): grep-based absence/presence guard
A single architecture test asserting the rename is complete AND surgical:
- **ABSENT from `extensions/`:** the literal `--force`; the standalone status literals
  `"force-installed"`, `"force-upgradable"`, `"force-installed-upgradable"`; the verdict render
  string `(unsupported)`; the constant names `ICON_FORCE_INSTALLED` / `FORCE_*_HINT_TRAILER`
  (per the locked §2 targets).
- **STILL PRESENT (regression guard for out-of-scope):** the reason tokens `"unsupported source"` /
  `"unsupported hooks"`; the property accesses `compatibility.unsupported` / `.supported`;
  `rm({ force: true })` in `bridges/`; `writeRef({ force: true })` in `platform/git.ts`;
  `AgentStageOptions.force`.

This guard is the executable form of the §4c rule and the phase's completion criterion. It cannot
be green on the current tree (old tokens still exist), so it lands IN the rename commit asserting
the post-state (not as a pre-added Wave 0 file).

**Sampling rate:** per commit → `catalog-uat` + `closed-set-locks` + the new guard; per phase gate →
full `npm run check` GREEN before `/gsd-verify-work`.

## Environment Availability

No external dependencies for this phase (code/config/docs-only). Toolchain already present:
node:test (built-in), TypeScript (`typescript@^6.0.3`, per package.json), ESLint 10, Prettier 3.8.
`Step 2.6: SKIPPED for external services` — the rename touches no runtime service. `npm run check`
is the sole gate.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The resolver `state: "unsupported"` SHOULD be renamed (not kept internal) | §2.A | If kept internal, the render-only rename is smaller but leaves `force-installed` derived from a `"unsupported"` state — planner must choose. Low risk (both are viable; flagged as DECISION). |
| A2 | `--unsupported` list filter is in-scope-by-implication and should follow the verdict rename | §1b/§2.B | If the user wants `--unsupported` kept, the list handler/provider/tests stay — smaller scope. Flagged as DECISION. |
| A3 | Internal degrade-`force` plumbing (`options.force`, `requireForceInstallable`, `forceDegrade`, `FORCE_*_STATUSES`) should be renamed for coherence | §2.D | If left as `force`, the internal/external vocabulary diverges (working but incoherent). This is the biggest scope lever — flagged as DECISION. |
| A4 | Glyph CHARS `◉`/`⊖` stay; only the constant NAMES change | §2.C | If the user wants new glyphs, that is a larger visual UAT. Recommend keep; flagged. |
| A5 | `narrowUnsupportedKinds`/`unsupportedKinds` are OUT of scope (component-kind mappers) | §4b | Borderline: their NAME contains "unsupported" but they map component KINDS to reason tokens (out of scope). If renamed, blast radius grows. Recommend OUT; flagged as borderline. |
| A6 | The rename ships behavior-identical (no version-gated migration, no new decision beyond token forms) | throughout | Verified: no behavior change; only a routine release version bump at PR time. |

## Open Questions (RESOLVED — locked in 75-CONTEXT.md)

> All questions below were resolved by operator decision at plan-phase; the locked
> answers live in `75-CONTEXT.md` `<decisions>` (hyphen token form, `--partial` for both
> flags, full internal rename, keep glyph chars, `D-75-01`/`RVOC-*` minted, README
> out-of-scope).

1. **Exact render-token forms.** `(partially available)` vs `(partially-available)`; `(partially
   installed)` vs `(partially-installed)`. *Recommendation:* space-form to match the `(manual
   recovery)` precedent, but this is a user/planner LOCK. Blocks the byte contract.
2. **`--unsupported` filter target.** `--partial`, `--partially-available`, or keep `--unsupported`?
   *Recommendation:* `--partial` for symmetry with the install flag. LOCK before execution.
3. **Depth of internal `force` rename (§2.D).** Rename all degrade-force plumbing, or only the
   user-facing tokens? *Recommendation:* rename fully for coherence. LOCK — it is the largest scope
   lever.
4. **`force-installed-upgradable` target.** `partially-installed-upgradable`? (internal
   classifier/cache literal only). Follows from Q1's scheme.
5. **New requirement/decision ID.** Mint `RVOC-*` requirements or proceed from the goal + this
   research? And mint `D-75-01` for comment anchors (comment policy forbids `Phase 75`).
6. **README scope.** `README.md` was not deep-scanned; grep it for `--force`/`(unsupported)`/
   `force-installed` and include any hits in the lockstep set.

## Sources

### Primary (HIGH confidence — read in this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` (lines 1-1178 read; grep for glyphs/tokens/
  trailers/render arms) — the closed-set tuples, per-status interfaces, `forceHint`, hint trailers,
  glyph constants, render mechanism.
- `extensions/pi-claude-marketplace/domain/resolver.ts` (state union 182-235 + gates) — three-way
  verdict, `ResolvedPluginUnsupported`, `MaterializablePlugin`, `requireForceInstallable`.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (full) — `STATE_SCHEMA`,
  `compatibility.unsupported/supported` (out of scope), no in-scope literal.
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` (full) — `PLUGIN_INDEX_CACHE_SCHEMA`
  v3, the only persisted in-scope literals, drop-rebuild mechanism.
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` (full),
  `edge/completions/data.ts` (full), `shared/extension-version.ts` (full).
- `persistence/config-io.ts`, `agents-index-schema.ts`, `locations.ts` (grep) — no in-scope literal.
- `tests/architecture/catalog-uat.test.ts` (header) + `notify-closed-set-locks.test.ts` (grep) —
  byte-gate mechanism + length locks.
- Grep censuses across `extensions/ tests/ docs/` for `force`, `unsupported`, `--force`,
  `--partial`, `forceHint`, `FORCE_*_HINT_TRAILER`, `ICON_*`, `narrowUnsupportedKinds`, glyphs,
  `forceGithub`, `rm({force:true})`.
- `.planning/milestones/force-install-ROADMAP.md`, `.planning/STATE.md` (roadmap-evolution:
  "Force-state is DERIVED … NO persisted flag").
- `docs/output-catalog.md`, `docs/messaging-style-guide.md`, `docs/prd/pi-claude-marketplace-prd.md`
  (grep for token surfaces).

### Not consulted (out of scope for a brownfield rename)
- Context7 / web / package registries — no dependency or API research needed.

## Metadata

**Confidence breakdown:**
- Occurrence census (§1): HIGH — direct grep with file:line, cross-checked against reads.
- Persisted migration (§3): HIGH — read all four typebox schemas; grep-confirmed no in-scope literal
  outside the ephemeral cache.
- Out-of-scope rule (§4): HIGH — verified `forceGithub` absent, git/fs `force` located, component
  arrays vs verdict disambiguated at the schema level.
- Output-contract surfaces (§5): HIGH — read the catalog-UAT coupling mechanism directly.
- Naming targets (§2): MEDIUM — the CURRENT forms are HIGH (verified); the PROPOSED targets are
  recommendations pending user LOCK (flagged as DECISIONs).

**Research date:** 2026-07-02
**Valid until:** stable (brownfield census of a frozen tree) — re-verify only if the tree changes
before planning (currently on `main` after force-install milestone close, 0.7.0).
