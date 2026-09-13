# Phase 1: Manifest read fidelity - Context

**Gathered:** 2026-09-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Everything a plugin's `plugin.json` declares reaches the user. Two defects sit
on the read path of that one file:

1. A manifest at a bare `<pluginRoot>/plugin.json` is never opened. Only the
   wrapped `.claude-plugin/plugin.json` path is ever built, at two independent
   hardcoded call sites.
2. An object-shaped `{name, version, marketplace}` dependency entry is filtered
   out before `info` renders it.

Requirements: MANF-01..05, DEPS-01, DEPS-02.

Not in this phase: dependency resolution or auto-install (Phase 3), install
provenance (Phase 4), prune (Phase 5), and the other half of `PDEP-01` --
whether the dependency note should also appear on `install` and `list`.
DEPS-01/02 name `info` and only `info`.

</domain>

<decisions>
## Implementation Decisions

### Dependency rendering (DEPS-01, DEPS-02)

- **D-01-01:** An object dependency renders `<name>@<marketplace> (<version>)`.
  `@` keeps meaning marketplace, consistently with the project-wide
  `<plugin>@<marketplace>` address form used by `install`, `uninstall`, and the
  existing `dependencies:` line. The version constraint rides in parentheses.
  Upstream's npm-style `name@version` was rejected for overloading `@`.
  — **Reversibility:** costly — the byte form is a catalogued output state
  (`docs/output-catalog.md`, `installed-single-scope-with-dependencies`), so a
  later change means a catalog amendment plus every test asserting the line.

- **D-01-02:** An object that omits `marketplace` renders with the DECLARING
  plugin's marketplace filled in. Upstream resolves an unqualified dependency in
  the declaring plugin's own marketplace, so the fill-in states the real
  resolution target rather than leaving the field blank.

- **D-01-03:** Bare-string dependencies get the same fill-in, but ONLY when the
  string contains no `@`. A string already carrying an address is authoritative
  and passes through verbatim. This keeps the existing catalogued example
  (`dependencies: helper@utils-mp`, `docs/output-catalog.md:1765`) byte-valid
  while giving `audit-logger` the same treatment an equivalent object gets.

- **D-01-04:** The array sorts on the DEPENDENCY NAME (an object's `name`, or
  the bare string as written), not on the rendered display string. Identity
  ordering survives a later change to the render form.

- **D-01-05:** An element with no usable name -- `name` missing, empty, or not a
  string -- is dropped silently. The schema keeps this field `Type.Unknown()`, so
  any shape can arrive; `info` is a read-only surface and does not error on
  manifest content. A placeholder token was rejected as new catalog surface for
  a case with no known instance.

### Manifest location (MANF-01, MANF-02, MANF-04, MANF-05)

- **D-01-06:** The two readers share an ordered candidate constant --
  `MANIFEST_CANDIDATES`, wrapped path first, bare path second -- exported from a
  NEW leaf module `extensions/pi-claude-marketplace/domain/manifest-path.ts`.
  Each reader loops it with its own I/O and keeps its own error contract; no
  shared read/parse function. A full shared reader was rejected because it would
  put `PLUGIN_MANIFEST_VALIDATOR` in the version path, where a schema-invalid
  manifest currently still yields a tier-1 version.
  — **Reversibility:** reversible — one new leaf module and two loop bodies.

- **D-01-07:** The loop falls through on ABSENCE ONLY. The first candidate that
  EXISTS is the manifest, and the loop stops there. A present-but-unusable
  candidate does not hand off to the next one.

- **D-01-08:** Parse failure and schema rejection are the same rule -- both stop
  the loop and produce the existing `malformed plugin.json: <detail>` reason.
  There is no second concept distinguishing "not JSON" from "JSON that violates
  the schema".

- **D-01-09:** An unreadable present candidate (EACCES and friends) surfaces as
  `malformed plugin.json:`, not as a silent skip. In `readManifest` this is
  already today's behavior -- its `try` wraps the read, so an EACCES throw
  already lands on the malformed arm. The decision records it so the version
  reader's new loop matches rather than swallowing it.

- **D-01-10:** ROADMAP criterion 2 and MANF-04 stand UNAMENDED. A plugin
  shipping a malformed wrapped manifest and a valid bare one resolves
  `(unavailable)`; the bare file cannot change the outcome. This was chosen
  explicitly over a more forgiving "first parsable file wins" reading.

- **D-01-11:** `resolvePluginVersion` tier 1 stats each candidate before reading,
  mirroring `readManifest`'s `statKindOf(ctx)` gate, rather than branching on
  `err.code === "ENOENT"`. D-01-07 requires telling absent from unreadable, and
  two structurally identical loops are what the D-01-12 behavioral test asserts.
  This is a deliberate change from the current swallow-everything `catch`.

- **D-01-12:** Agreement is proved by a BEHAVIORAL test that plants a
  bare-manifest fixture on disk and asserts BOTH that the resolver honors it and
  that `resolvePluginVersion` returns its declared version. Not a source-grep or
  config-reading test. Matches the CONVENTIONS.md rule that a gate wants a test
  that plants the violation.

- **D-01-13:** MANF-05 needs no behavior change. `readManifest` already returns
  `{ ok: true, manifest: null }` on a stat miss, so a plugin with no manifest at
  either location still installs. Preserve that; do not make absence fatal.

### Component-path normalization (MANF-03)

- **D-01-14:** The normalized form is
  `path.relative(pluginRoot, path.resolve(pluginRoot, raw))`.
  `validateComponentPath` already computes the `path.resolve` for its
  `assertPathInside` check, so this is one additional line and it canonicalizes
  `./` prefixes, trailing separators, interior `..` segments, and separator
  style in a single step. A string-level strip of `./` and trailing `/` was
  rejected for leaving `a/../skills` as a distinct key.

- **D-01-15:** The normalized form REPLACES the value stored in
  `componentPaths[kind]`, not just the `seenPaths` dedup key. These values are
  never printed to the user -- bridges join them for I/O and `info` enumerates
  them into component names (`info.ts:667-673`) -- so canonicalizing them has no
  user-visible byte consequence. One spelling per directory flows downstream.

- **D-01-16:** When `path.relative` returns the empty string (a plugin declaring
  `"."` or `"./"`, resolving to `pluginRoot` itself), store `"."`. This
  preserves today's stored byte; `path.join(root, ".")` and `path.join(root, "")`
  both yield `root`, and the array never holds an empty string.

- **D-01-17:** The dedup key stays CASE-SENSITIVE. `Skills` and `skills` remain
  distinct, as today. Case folding would collapse two genuinely distinct
  directories on Linux, and no known plugin declares a case-variant path -- the
  four bare-manifest plugins all declare lowercase `./skills/`.

### Dependency source and parsing (DEPS-01, DEPS-02)

- **D-01-18 [SUPERSEDED by D-01-32 -- do not implement this]:** `info` continues
  to read `dependencies` from the MARKETPLACE ENTRY only. It does not read the plugin's own `plugin.json` for this field,
  even though this phase makes a bare manifest readable. This preserves the
  warm/cold render symmetry rule the read surfaces already follow (OUT-05 /
  DOC-02, `domain/resolver.ts:653`): the entry is readable for every plugin
  regardless of clone state, so an unfetched `(remote)` plugin renders the same
  dependency list a cloned one does. It also avoids a THIRD independent manifest
  read -- the resolver deliberately does not carry the manifest on its result
  (D-23-02 / NFR-7), and `info` re-resolves independently (`info.ts:1300`).
  DEPS-01/02 are therefore purely the filter fix.
  — **Reversibility:** reversible — the source is one expression at
  `info.ts:838`.

- **D-01-19 [MOOT under D-01-32 -- both now read the same source]:** Phase 3 is
  EXPLICITLY FREE to read dependencies from
  `plugin.json` for resolution. D-01-18 is a display decision, not a project-wide
  source of truth. Display must render identically warm and cold; resolution
  already requires a materialized clone and can read the manifest freely.
  Phase 3 must not read D-01-18 as precedent binding its own source choice.

- **D-01-20:** Dependency PARSING extracts now into a new
  `extensions/pi-claude-marketplace/domain/dependencies.ts`, returning typed
  `{ name, version?, marketplace? }` entries. `info.ts` is reduced to rendering
  the parsed result. Phase 3 reuses this parser rather than writing a second one
  beside it. The fill-in of a missing marketplace (D-01-02, D-01-03) is a
  RENDER-time concern -- the caller supplies the declaring marketplace -- so the
  parser stays pure and Phase 3 can apply its own resolution semantics to the
  same parsed shape.

### Resolutions to research open questions (added 2026-09-12, after 01-RESEARCH.md)

- **D-01-21 (resolves OQ-1):** The phase ABSORBS a bridge-side fix in
  `bridges/skills/discover.ts`. The locked resolver normalization (D-01-14 /
  D-01-15) closes MANF-03 for `ui5` (8 warnings to 0) but NOT for
  `ui-theme-designer`, which declares `"./skills/<name>"` -- normalizing to
  `"skills/<name>"`, a legitimately distinct key from the convention path
  `"skills"`, so the convention probe re-enumerates the same directories. Verified
  by executing the real modules, not inferred. This is a REGRESSION the phase
  would otherwise introduce: `ui-theme-designer` emits zero warnings today
  precisely because its bare manifest is never opened, and MANF-01 is what makes
  the two warnings appear.

  The fix: a `seenByDir: Map<string, DiscoveredSkill>` in `discoverPluginSkills`,
  keyed on the RESOLVED skill directory, consulted BEFORE the `seenByGenerated`
  warning at both emission points. Same resolved directory means one skill
  reached twice -- skip silently. A different directory that merely elides to the
  same generated name keeps today's warning, preserving D-141-04 semantics. All
  four existing collision tests in `tests/bridges/skills/discover.test.ts` use
  DISTINCT directories, so none of them change.

  REJECTED alternative: suppressing the convention path when a declared path
  lives under it. The research probe `subdir-plus-sibling` shows it silently
  DROPS sibling skill directories that were never declared -- a data regression,
  strictly worse than the output regression it fixes.

  ROADMAP criterion 3 stands as written; both named witnesses must reach zero
  warnings.

- **D-01-22 (resolves OQ-2):** The new `<name>@<marketplace> (<version>)` byte
  form GETS an output-catalog state in this phase. D-01-01 already calls the byte
  form a catalogued output state, and the catalog is the user contract. Both
  walks are gated in each direction, so the doc block in
  `docs/output-catalog.md` and the matching `FIXTURES` entry must land in the
  SAME change. The existing `installed-single-scope-with-dependencies` state
  stays byte-valid and is not edited.

- **D-01-23 (resolves OQ-3, discretion):** `resolvePluginVersion`'s stat for
  D-01-11 comes from adding `stat` to the existing `node:fs/promises` import in
  `orchestrators/plugin/shared.ts`. Do NOT export `defaultStatKind` from
  `domain/resolver.ts` -- it stays module-private, and `domain/manifest-path.ts`
  stays a pure constant module per D-01-06.

- **D-01-24 (scope fence, from the OQ-1 symmetry note):** `bridges/commands/discover.ts`
  has the same overlap shape and would warn identically, but the four
  bare-manifest plugins declare NO commands, so it is outside MANF-03's letter.
  Do not widen this phase to the commands bridge. Note for the backlog that the
  two bridges are an existing fallow-reported mirrored clone pair, so if it is
  ever fixed, fixing both symmetrically is the lower-duplication move.

### Upstream parity corrections (added 2026-09-13, from the Claude Code 2.1.251 binary)

Verified by reading the compiled schema out of the installed CLI, not from docs.
These SUPERSEDE the spike's summary where they disagree.

- **D-01-25 (supersedes the control-character question):** `domain/dependencies.ts`
  applies a POSITIVE ALLOWLIST to a dependency's `name` and `marketplace`:
  `^[A-Za-z0-9][-A-Za-z0-9._]*$`. This is upstream's own rule, verbatim:

  ```js
  un = /^[A-Za-z0-9][-A-Za-z0-9._]*(@[A-Za-z0-9][-A-Za-z0-9._]*)?(@\^[^@]*)?$/
  // object arm: { name: /^[A-Za-z0-9][-A-Za-z0-9._]*$/,
  //               marketplace: same, optional }
  ```

  An element failing it is not a usable name and is dropped, folding into D-01-05
  rather than adding a second rule. Do NOT reach for `assertSafeName` or a
  control-character denylist here: upstream validates dependency entries MORE
  strictly than it validates plugin names (its plugin-name check omits general
  `\p{Cf}`, so a zero-width space passes as a name and fails as a dependency).
  The output-forgery vector closes for THESE TWO FIELDS, since the allowlist
  admits no control, bidi, ANSI, whitespace, or quote characters at all. It does
  NOT close for `version` and `sha`, which also render verbatim -- see D-01-33,
  which corrects this paragraph's original overreach.

- **D-01-26:** A dependency object may carry `sha` alongside `version`. Upstream
  declares NEITHER in its object schema -- the schema is `.loose()` with only
  `{name, marketplace?}`, and a post-parse pass reads `version` and `sha` off the
  RAW manifest. Our parser returns both as optional typed fields, and `info`
  renders whichever is present. A sha pin is a declared constraint, so dropping
  it would reproduce in a new place exactly the defect this phase closes.

- **D-01-27:** The bare-string form may carry a trailing range: `foo@^1.0.0`.
  Upstream's regex splits it off and its transform DISCARDS it. We split it off
  and RENDER it as a constraint, so one dependency renders identically whichever
  shape declared it. This is a deliberate divergence from upstream behavior in
  the direction of the phase goal -- upstream discards a declared constraint, and
  this phase exists to stop doing that. Parsing precedence for a bare string is
  therefore: optional trailing `@^<range>`, then optional `@<marketplace>`, then
  the name.

- **D-01-28 (corrects the spike):** `.planning/spikes/004-claude-plugin-dependency-spec/README.md`
  states that a bare string is "the plugin name, unversioned, resolved in the same
  marketplace as the declaring plugin". The compiled schema says otherwise: the
  string form accepts `name`, `name@marketplace`, AND a trailing `@^<range>`. This
  independently CONFIRMS D-01-03 -- a bare string containing `@` is already an
  address, so appending the declaring marketplace only when no `@` is present
  matches upstream semantics rather than merely preserving our catalog example.
  It also confirms D-01-01: upstream's object arm is transformed INTO the string
  `name@marketplace`, so `@` meaning marketplace is upstream's own canonical
  identity, not just our token-collision workaround.

- **D-01-29 (scope note, not a task):** Upstream renders NO dependency list
  anywhere -- no `/plugin` info view lists them; dependency names reach the user
  only inside error and status text. Our `info` dependency line has no upstream
  counterpart to match byte-for-byte, so the D-01-22 catalog state is ours to
  define. Upstream's failure handling is also asymmetric in a way worth knowing
  but NOT worth copying here: a bad dependency in `plugin.json` throws and kills
  the whole plugin load, while a bad one in a marketplace entry degrades to a
  stubbed `source:"unsupported"` entry or is dropped with a warn log. D-01-18
  keeps `info` entry-sourced, so the degrade path is the one our behavior sits
  beside.

- **D-01-30 (byte form of the constraint parenthetical):** A version range renders
  BARE; a sha renders LABELLED and short-formed to 7 characters. When both are
  present, version first, comma-space separated, in one parenthetical. A range is
  self-evidently a version, a 40-hex string is not, and the short form matches how
  resolved shas already render elsewhere in the project.

  ```text
      dependencies: a@mp (^1.0.0), b@mp (sha abc1234), c@mp (^2.0.0, sha def5678)
  ```

  A dependency with neither constraint renders as the bare address, unchanged:
  `a@mp`. This is the byte form D-01-22 catalogues, and the doc block plus its
  `FIXTURES` entry must land in the same change.

### Dependency source reversal and duplicate handling (added 2026-09-13)

- **D-01-31 (duplicates within one manifest):** Same-name dependencies collapse
  LAST-WINS, keyed on the resolved `name@marketplace`. This matches upstream's
  `mze` exactly (`r.set(A, {version, sha})` overwrites). A manifest declaring
  `a@^1` then `a@^2` renders `a@mp (^2.0.0)`; the discarded `^1` is not surfaced.

  Note for Phase 3, which must NOT copy this rule blindly: upstream collapses
  last-wins only WITHIN one manifest. ACROSS manifests it does the opposite --
  ranges accumulate into an array and are intersected (`xn.push(Ar.version)`,
  then `Tct(ps)`), and an unsatisfiable intersection raises `range-conflict`
  naming every contributing range. Display is within-manifest, so last-wins is
  the right rule here; resolution is cross-manifest and needs the intersection.

- **D-01-32 (SUPERSEDES D-01-18 and D-01-19):** `info` reads `dependencies` from
  the plugin's own `plugin.json` when that manifest is readable WITHOUT NETWORK,
  and falls back to the marketplace entry when it is not. D-01-18's entry-only
  rule is RETIRED.

  Reason for the reversal: upstream treats `plugin.json` as authoritative and the
  marketplace entry as a mirror that can go stale, and says so out loud --

  ```js
  if (!Tn.has(Jm(Qn, e)))
    n(`Marketplace entry for ${e} lists dependency "${Qn}" not present in ` +
      `plugin.json -- catalog may be stale`)
  ```

  Reading the entry alone means reading the source upstream considers the less
  trustworthy of the two.

  Three consequences the planner MUST carry:

  1. **Warm/cold symmetry is deliberately given up for this field.** A git-source
     plugin with no clone renders its entry-declared dependencies; the same plugin
     once cloned renders its `plugin.json`-declared ones, and the two can differ.
     This is a knowing, scoped exception to the OUT-05 / DOC-02 principle, taken
     for `dependencies` ONLY. Do not generalize it: `defaultEnabled` and every
     other manifest-side claim on the read surfaces stay entry-sourced, and
     `entryDeclaresInstallDisabled`'s one-parameter containment argument
     (`domain/resolver.ts:653`) is untouched.

  2. **"Readable" never means fetching.** NFR-5 forbids `info` touching the
     network, and `orchestrators/plugin/info.ts` is one of the files the
     no-orchestrator-network architecture test pins. Readable means a path source
     or an already-warm clone. A cold git source falls back to the entry; it does
     NOT trigger a clone.

  3. **There are now THREE manifest readers, not two.** `info` gains its own read
     alongside `domain/resolver.ts::readManifest` and
     `orchestrators/plugin/shared.ts::resolvePluginVersion`. All three consume
     `MANIFEST_CANDIDATES` (D-01-06) with the same absence-only fall-through
     (D-01-07), and the D-01-12 behavioral test extends to cover the third. This
     strengthens rather than weakens the shared-constant decision. The resolver's
     result is still NOT widened with a `manifest` field -- D-23-02 / NFR-7 stand.

  D-01-19 is now moot: `info` and Phase 3 read the same source, so there is no
  display-vs-resolution split left to record.

  No disagreement warning is emitted when the entry and `plugin.json` differ.
  Upstream logs one; we render the authoritative source and stay silent. Revisit
  only if a real plugin makes the divergence visible.

### Constraint-field validation (added 2026-09-13, ratifying a planner-derived extension)

- **D-01-33 (corrects D-01-25):** The positive allowlist extends to the two
  CONSTRAINT fields, which D-01-25 left unguarded while claiming the forgery
  vector was closed. `version` and `sha` render verbatim into a line-oriented
  notification row exactly as `name` and `marketplace` do, so a newline or ANSI
  escape in either forges a row.

  D-01-25 bars `assertSafeName` and bars a control-character DENYLIST. It does not
  bar extending its own chosen mechanism, so the same POSITIVE-allowlist treatment
  applies:

  ```text
  version: ^[A-Za-z0-9.\-+*~^<>=| ]+$
  sha:     ^[0-9a-fA-F]{7,40}$
  ```

  The `version` charset admits every semver range form upstream accepts --
  `^1.0.0`, `~1.2`, `>=1.0.0 <2.0.0`, `1.x`, `*`, `1.0.0-beta.1`,
  `1.0.0 || 2.0.0` -- and admits no control character, newline, escape, quote,
  bidi mark, or `@`. The space and the pipe are deliberately admitted: dropping
  them would reject compound ranges upstream genuinely accepts, silently losing a
  declared constraint, which is the defect this phase exists to close. The `sha`
  charset is also exactly what D-01-30's short-form-to-7 rendering assumes.

  **One usability rule, covering all four fields.** A field that is ABSENT was not
  declared and is simply not rendered. A field that is PRESENT but unrenderable --
  any non-string value, or a string failing its allowlist -- makes the WHOLE
  element unusable, and the element is dropped silently exactly as D-01-05 drops
  one with no usable name. Nothing is ever half-rendered with a constraint quietly
  removed.

  Carried in the plans as threat `T-01-03` (Spoofing / output forgery, severity
  high, ASVS V5).

### Claude's Discretion

- Exact wording and placement of doc comments, and which requirement IDs each
  cites. Follow the house convention: cite durable spec IDs, never GSD phase or
  plan numbers.
- Whether `MANIFEST_CANDIDATES` is typed as nested string arrays or as
  pre-joined relative paths, so long as both readers consume the same export.
- Test file placement and naming within the existing `tests/` layout.
- Whether the `domain/dependencies.ts` parser exposes one function or a small
  pair (parse + render helper), so long as parsing is reusable by Phase 3 and
  the marketplace fill-in stays out of the parse step.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream dependency contract
- `.planning/spikes/004-claude-plugin-dependency-spec/README.md` — the VALIDATED
  upstream spec for the `dependencies` field, researched against Anthropic's
  primary docs. Defines the two element shapes (bare string = plugin name
  resolved in the declaring plugin's marketplace; object = `{name, version?,
  marketplace?}` with a semver range). Read this before touching
  `normalizeDependencies` — it is the source for D-01-01 through D-01-05, and
  for the fact that a bare string carries no address upstream.

### The two defects, verified first-hand
- `.planning/BACKLOG.md` — entry `PMAN-01` (the bare-manifest gap: both
  hardcoded call sites with line numbers, the four in-the-wild plugins, and an
  explicit writeup of the MANF-03 regression trap) and entry `PDEP-01` (the
  object-dependency filter, with the live-prototype evidence that the three
  array shapes render correctly / partially / not at all).

### Output contract
- `docs/output-catalog.md` — the `dependencies:` line is a catalogued state.
  §`installed-single-scope-with-dependencies` (~line 1752) holds the current
  byte form and its example `dependencies: helper@utils-mp`. Any new byte form
  is a closed-set catalog amendment, not a free choice.
- `docs/messaging-style-guide.md` — row and token grammar the rendered
  dependency entries must obey.
- `docs/plugin-enablement.md` — the durable home of the read-surface precedence
  argument that D-01-18 leans on (warm/cold symmetry; the entry as the one
  source readable for every plugin).

### Project rules
- `.planning/REQUIREMENTS.md` §"Planning Notes" — facts verified on 2026-09-09
  that planning MUST NOT re-derive: the two hardcoded manifest paths, why
  MANF-03 keeps MANF-01 from being a regression, and that no in-the-wild
  dependency fixtures exist (all DEPS test data is necessarily synthetic; pin
  accepted shapes from the spike rather than inventing them).
- `.planning/codebase/CONVENTIONS.md` — typed error classes, import ordering,
  the dual cognitive-complexity ceilings (ESLint `sonarjs/cognitive-complexity`
  15 AND fallow `health.maxCognitive` 15, independently computed), and the
  "plant the violation, do not read the config" rule for gates (D-01-12).
- `.planning/codebase/ARCHITECTURE.md` — layer import rules. `domain/` depends
  on `shared/` only; `orchestrators/` may import `domain/`. Both new modules
  land in `domain/`, which `orchestrators/plugin/shared.ts` already imports at
  runtime (`domain/version.ts`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/resolver.ts::validateComponentPath` (~line 956) already computes
  `path.resolve(pluginRoot, raw)` for its `assertPathInside` containment check
  and returns `{ ok: true, relative: raw }` — the RAW string. D-01-14 changes
  only that returned value; the resolve it needs is already there.
- `domain/resolver.ts::statKindOf` / `readFileTextOf` (~lines 331-337) are the
  injected fs seams (`ctx.statKind ?? defaultStatKind`,
  `ctx.readFileText ?? readFile`). `readManifest` reads through them, which is
  what makes it testable; `resolvePluginVersion` does not, and D-01-11 does not
  ask it to adopt them — it needs a stat, not the seam.
- `PLUGIN_MANIFEST_VALIDATOR` in `domain/components/plugin.ts` — the typebox
  validator `readManifest` already runs, and the source of the
  `malformed plugin.json: <instancePath>: <message>` detail string. The
  `dependencies` field is `Type.Optional(Type.Unknown())` there (lines 82-83 and
  104), which is why any element shape can reach the parser.
- `shared/notify.ts:3564` renders the line as
  `lines.push(\`    dependencies: ${dependencies.join(", ")}\`)` from a
  `readonly string[]`. notify stays a dumb renderer — the whole render decision
  (D-01-01..05) lands in the orchestrator/parser, not in notify.

### Established Patterns

- Two independently-computed complexity gates must BOTH pass; a green ESLint run
  is not evidence fallow will be green. Keep the new loop bodies flat.
- `npm run check` is the gate: typecheck, lint, fallow (dead-code + health +
  dupes), format:check, unit tests, integration tests.
- Typed error classes live in `shared/errors.ts`; callers narrow on
  `instanceof`, never on message substrings. The manifest failure path here is
  NOT a thrown error — it is the existing `{ ok: false, reason }` result shape,
  and it stays that way.
- All exported functions need explicit return type annotations.

### Integration Points

- `domain/resolver.ts::readManifest` (~line 623) — hardcoded wrapped path,
  becomes a `MANIFEST_CANDIDATES` loop. Owns the typed malformed reason.
- `orchestrators/plugin/shared.ts::resolvePluginVersion` tier 1 (~line 919) —
  the second hardcoded wrapped path, plus a bare `node:fs` `readFile` and a
  swallow-everything `catch`. Becomes a stat-then-read loop over the same
  constant. Its only callers are `install.ts:646` and `update.ts:947`, both
  passing a `MaterializablePlugin`, so it runs only after the resolver has
  already produced an installable verdict.
- `domain/resolver.ts::addComponentPath` (~line 1001) — the raw-string dedup
  key and the push into `partial.componentPaths[kind]`. Both become the
  normalized form (D-01-14, D-01-15).
- `domain/resolver.ts::collectStrictComponentKind` (~line 1033) — adds the
  convention path (`<pluginRoot>/skills`) additively and unconditionally after
  the declared paths. This is what makes `"./skills/"` plus a real `skills/`
  directory produce two entries today. It needs no logic change once the key is
  normalized; the added `kind` string is already in canonical form.
- `orchestrators/plugin/info.ts::normalizeDependencies` (line 333) and its call
  site (line 838, reading `(entry as Record<string, unknown>).dependencies`) —
  the filter to fix, and the seam that keeps the source entry-only per D-01-18.
  The declaring marketplace needed for the D-01-02/D-01-03 fill-in is already in
  scope at that call site as `getPluginInfo`'s `marketplace` argument.
- `tests/orchestrators/plugin/info.test.ts:1477-1545` — the two existing
  `normalizeDependencies` tests. The object-shaped one asserts the line is
  OMITTED for `dependencies: { foo: ..., bar: ... }`; that case is an object
  rather than an ARRAY of objects, so it stays correct under the new rule and
  must not be deleted. The empty-array test also stays.

</code_context>

<specifics>
## Specific Ideas

- MANF-03 has two named in-the-wild witnesses to verify against, from PMAN-01:
  `ui5` (8 skill directories under `skills/`, so 8 spurious duplicate warnings
  without the fix) and `ui-theme-designer` (2). ROADMAP criterion 3 names both.
  Use their declared shapes — `["./skills/"]` and
  `["./skills/ui-theme-designer-help", "./skills/ui-theme-designer-design-tokens"]`
  — as the normalization fixtures rather than invented ones.
- The four bare-manifest plugins declare no commands, agents, `mcpServers`,
  hooks, or unsupported kinds, so MANF-01 fixtures need only the skills kind to
  be realistic.
- Their declared `version` values are unreachable in production anyway: all four
  are git-subdir sources with a pinned sha, and `deriveInstallVersion`
  (`orchestrators/plugin/install.ts:640`) makes a resolved sha replace the whole
  three-tier ladder. MANF-01's version half is a parity fix with no in-the-wild
  victim — the D-01-12 test proves it directly against `resolvePluginVersion`
  rather than through an install.

</specifics>

<deferred>
## Deferred Ideas

- **Case-variant component paths on case-insensitive filesystems.** A plugin
  declaring `"./Skills/"` alongside a real `skills/` directory still produces
  two keys and therefore duplicate warnings on macOS and Windows (D-01-17). No
  known plugin does this. Backlog it if it ever bites.
- **PDEP-01's other half.** Whether the "declares dependencies, install them
  manually" note should also reappear on `install` (dropped per D-19-01) and
  `list` (which reads resolver notes only for an `unavailable` plugin). DEPS-01
  and DEPS-02 name `info` and only `info`, and `.planning/REQUIREMENTS.md`
  scopes this phase to the display fix.
- **MIGR-01's staleness gate.** Named in REQUIREMENTS as a dependency of
  PROV-04, which is Phase 4. Nothing for this phase.

### Reviewed Todos (not folded)

- `2026-09-02-detect-unused-code-and-type-members.md` — matched at score 0.6 on
  generic keywords ("resolves", "phase", "milestone", "nothing"), not on
  subject matter. It concerns dead-code and unused-type-member detection, which
  is unrelated to manifest reading. Not folded.

</deferred>

---

*Phase: 1-Manifest read fidelity*
*Context gathered: 2026-09-12*
