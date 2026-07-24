# Phase 84: Agent skillPath resolution - Research

**Researched:** 2026-07-19
**Domain:** pi-claude-marketplace agent-frontmatter emission (`bridges/agents/`), pi-subagents skill resolution contract
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Legend accuracy (re-amends AGSK-04)
- **D-84-01:** Collapse the body skill legend to a **single state** — every
  referenced skill annotates as `(available on demand)`. Drop the
  `(preloaded in your context)` state and the `preloaded` branch at
  `frontmatter.ts:335` (`entry.preloaded ? "preloaded in your context" : "available on demand"`).
  Rationale: pi-subagents 0.35.x delivers skills **lazily** — `buildSkillInjection`
  emits `<available_skills>` with name/description/`<location>` and "read on
  demand", even for emitted `skills:`. Nothing is eagerly preloaded, so
  "preloaded in your context" overclaims. This re-amends AGSK-04 from its
  two-state form to a single-state legend.
- **D-84-02:** Collapsing strictly improves accuracy and introduces no new
  mislabeling — the non-preloaded branch already said `(available on demand)`;
  only the this-plugin emitted entries change wording. Planner should still
  confirm dropped cross-plugin / unknown references are not newly mislabeled as
  available (they were already `(available on demand)` under the old
  `preloaded=false` branch, so behavior is unchanged there).

#### Peer dependency floor
- **D-84-03:** Pin the pi-subagents peer floor to **`>=0.35.0`** (where
  agent-local `skillPath` shipped) — matches success criterion 3.
  Planning MUST confirm pi-subagents #526 (0.35.1 async-runner peer resolution)
  does not affect the real subagent spawn/resolution path before finalizing
  the floor. Live end-to-end verification was done on 0.35.1, but skillPath
  itself exists from 0.35.0.

#### skillPath emission (from the locked goal)
- **D-84-04:** Emit `skillPath: ../pi-claude-marketplace/resources/skills` when
  the generated agent's `skills:` list is non-empty; agents with no skills emit
  **no** `skillPath` and stay byte-identical to their Phase 83.1 output. Fixed
  relative-path constant. It resolves to
  `<scope>/pi-claude-marketplace/resources/skills` in both user and project
  scope because the agent file lives at `<scope>/agents/<name>.md`. Surface:
  `bridges/agents/frontmatter.ts`, alongside the existing conditional emission of
  `skills`, `systemPromptMode`, `inheritProjectContext`, `inheritSkills`.
- **D-84-05:** Update the byte-identity fixture corpus: skill-referencing agents
  now carry the new `skillPath` line **and** the collapsed annotation;
  skill-less agents must remain byte-identical.

### Claude's Discretion
- **AGSK-06 requirement text:** author to mirror the four ROADMAP success criteria
  (agent-local skillPath resolution); add to REQUIREMENTS.md during planning.
- **Exact refactor** of the legend entry type / how the `preloaded` field is
  removed is the planner's call, provided the emitted annotation is uniformly
  `(available on demand)` and the reference-gated emission stays byte-identical
  for agents with no `<plugin>:<source-skill>` tokens.

### Deferred Ideas (OUT OF SCOPE)
- Merge `main` into `features/issue-86-agent-skill-preloads` before shipping — the
  branch predates main's fetch-plugin / git-source / url-source work. Release
  hygiene, not Phase 84 scope; tracked outside discuss.

None other — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| AGSK-06 | A generated agent whose `skills:` list is non-empty carries a fixed-constant `skillPath: ../pi-claude-marketplace/resources/skills` frontmatter line so pi-subagents' `resolveSkillsWithFallback` resolves those skill names for the spawned subagent (invocation-private, never entering the parent/global catalog); an agent with no skills stays byte-identical; the body skill legend collapses to a single `(available on demand)` annotation; `package.json` declares an optional `pi-subagents >=0.35.0` peer and `npm run check` stays green; a live foreground subagent spawn demonstrates the skill resolves and loads. | Architecture Patterns (Pattern 1 & 2) locate the exact emission seam and verify pi-subagents' resolution contract from installed 0.35.1 source; Common Pitfalls enumerates every fixture location the legend-collapse and skillPath-gating changes touch; Validation Architecture maps each of the four ROADMAP success criteria to a concrete test/verification method, including the SC-2 gap (no existing automated resolver-contract test) and the SC-4 `#526` confound to avoid. |
</phase_requirements>

## Summary

This phase is a small, mechanically precise change to one function
(`emitGeneratedAgentFile` in `bridges/agents/frontmatter.ts`) plus a
documentation-only peer-floor addition. Both the fix design and the
verification were already done in `84-NOTES.md`; this research grounds that
design in the exact current code, exact current pi-subagents source (I read
the installed `pi-subagents@0.35.1` package directly, not docs), and the
exact byte-identity fixtures that must change.

Three findings materially sharpen or correct the plan inputs from
CONTEXT.md/NOTES.md:

1. **`skillPath` needs no new field threaded through `convert.ts`.** It is
   fully derivable inside `emitGeneratedAgentFile` from
   `frontmatter.skills.length > 0` — the same gate already used for the
   existing `skills:` line. `GeneratedFrontmatterFields` needs no new member.
2. **`package.json` has no existing pi-subagents entry to "raise."**
   pi-subagents is a *soft* runtime dependency (probed via
   `pi.getAllTools()` tool-name presence in `platform/pi-api.ts`, never
   imported as code) and today has **zero** representation in
   `package.json` — not in `dependencies`, not in `peerDependencies`. SC-3's
   "raises the ... peer floor to `>=0.35.0`" is therefore an **addition**,
   not a bump, and must use `peerDependenciesMeta: { optional: true }` so
   `npm install` doesn't demand the package be present.
3. **pi-subagents #526 is real but does not affect this phase's mechanism.**
   It is a module-resolution regression (`Cannot find module
   'typebox/compile'`) confined to the **detached async runner**
   (`async: true` subagent launches), introduced by PR #513 in the same
   0.35.0 release that shipped `skillPath`. It is unrelated to skill
   resolution — `resolveSkillsWithFallback` is called identically on both the
   foreground and async paths and neither call touches TypeBox. Still open
   as of 2026-07-20. The plan's SC-4 live-spawn verification should use a
   **foreground** (`async: false`) subagent call to avoid this confound.

**Primary recommendation:** In `frontmatter.ts`, add one unconditional line
push (`skillPath: ../pi-claude-marketplace/resources/skills`) gated on
`frontmatter.skills.length > 0`, placed directly after the existing `skills:`
push and before `systemPromptMode`. Collapse `renderSkillLegend`'s ternary to
the single literal `"available on demand"` and delete the now-dead
`preloaded` field from `SkillLegendEntry` and its sole producer in
`convert.ts`'s `detectSkillTokens`. Add `pi-subagents": ">=0.35.0"` to
`package.json` `peerDependencies` with a matching `peerDependenciesMeta`
optional entry, and update the README Prerequisites line. Update the two
test files that hold the byte-identity fixture corpus.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Emit `skillPath:` frontmatter line | Extension / bridge (`bridges/agents/frontmatter.ts`) | — | Pure byte-assembly concern already owned by this module; no I/O, no new inputs |
| Collapse legend annotation to one state | Extension / bridge (`bridges/agents/frontmatter.ts` render) + producer (`bridges/agents/convert.ts` `detectSkillTokens`) | — | Rendering and the field it renders from are two ends of the same seam; both must change together |
| Resolve `skillPath` against the agent file and load skills | External companion extension (pi-subagents, `resolveSkillsWithFallback` / `resolveSkills` in its own `src/agents/skills.ts`) | — | Out of this repo's control surface; this phase only emits the pointer, pi-subagents does the resolving |
| Materialize the skill files the `skillPath` points at | Extension / persistence (`persistence/locations.ts` `skillsTargetDir`, `bridges/skills/stage.ts`) | — | Already built by Phase-prior skill-install work; unchanged by this phase |
| Declare the pi-subagents version floor | Package manifest (`package.json` `peerDependencies`/`peerDependenciesMeta`) + docs (`README.md`) | — | No runtime enforcement exists (soft-dep probe is presence-only, not version-aware); the floor is purely declarative |

## Package Legitimacy Audit

No new packages are installed by this phase. `pi-subagents` already exists on
the npm registry — `npm view pi-subagents version` returns `0.35.1`
`[VERIFIED: npm registry]` — and the phase only adds a `peerDependencies`
entry for it (declarative; npm never resolves/installs a peer unless the
consumer separately installs it). No `package-legitimacy check` run is
required because no dependency is added to `dependencies`/`devDependencies`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pi-subagents | npm | multi-year (23 published versions, 0.23.1→0.35.1) | not queried (peer-only, not installed) | github.com/nicobailon/pi-subagents | OK | Approved — peerDependencies entry only, `optional: true` |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Source Claude agent .md (skills:, body prose referencing <plugin>:<skill>)
            |
            v
   convert.ts: convertAgent()
     - mapSkills()            -> skillsResult.emit  (Pi skill names, CSV list)
     - detectSkillTokens()    -> legend[]  (token, generatedName)   [preloaded field REMOVED]
            |
            v
   frontmatter.ts: emitGeneratedAgentFile()
     - frontmatter.skills.length > 0 ?
          emit "skills: <csv>"
          emit "skillPath: ../pi-claude-marketplace/resources/skills"   <-- NEW, this phase
     - renderSkillLegend(legend)
          every entry -> "(available on demand)"                        <-- collapsed, this phase
            |
            v
   Generated agent file written to <scopeRoot>/agents/<name>.md
            |
            v
   pi-subagents loadAgentsFromDir() parses frontmatter
     - skillPath: string[] (CSV-parsed, same parseFrontmatterList as skills:)
            |
            v
   pi-subagents execution.ts / async-execution.ts (spawn time)
     resolveSkillsWithFallback(
       skillNames,           # from agent.skills
       skillCwd, runtimeCwd,
       agent.skillPath,      # ["../pi-claude-marketplace/resources/skills"]
       dirname(agent.filePath)  # <scopeRoot>/agents  <- localBaseDir
     )
       -> path.resolve(localBaseDir, "../pi-claude-marketplace/resources/skills")
       -> <scopeRoot>/pi-claude-marketplace/resources/skills   (matches skillsTargetDir)
       -> walks <that dir>/<generatedName>/SKILL.md, resolves by name
            |
            v
   buildSkillInjection() -> <available_skills> XML block (lazy: name+description+<location>,
                             "use the read tool to load" -- NOT full-body preload)
            |
            v
   Subagent system prompt: skill is discoverable and readable, never
   eagerly injected -- this is why D-84-01 drops "(preloaded in your context)"
```

### Recommended Project Structure

No new files or directories. Every change lands in existing modules:

```
extensions/pi-claude-marketplace/bridges/agents/
├── frontmatter.ts   # emitGeneratedAgentFile: add skillPath line; renderSkillLegend: collapse annotation
├── convert.ts       # detectSkillTokens: drop emittedSkills param + preloaded computation
└── types.ts         # unchanged (RawAgentFrontmatter already line-based; skillPath is emit-only, not parsed on input)

tests/bridges/agents/
├── frontmatter.test.ts   # 4 whole-file pins to update (see Runtime State Inventory / Common Pitfalls)
└── convert.test.ts       # 2 whole-file pins + ~7 substring assertions using "preloaded in your context"

package.json         # peerDependencies + peerDependenciesMeta: add pi-subagents ">=0.35.0"
README.md            # Prerequisites bullet: note the version floor
```

### Pattern 1: Derive `skillPath` inside the emitter, not the caller

**What:** `emitGeneratedAgentFile` already gates the `skills:` line on
`frontmatter.skills.length > 0`. Add the `skillPath:` line under the exact
same condition, immediately after, with a hardcoded constant value. Do NOT
add a `skillPath` field to `GeneratedFrontmatterFields` or thread anything
new from `convert.ts` — the value is a fixed relative-path constant with no
per-agent variation.

**When to use:** Any generated-frontmatter field whose value is a
build-time constant rather than data derived from the source agent
(compare: `systemPromptMode: replace` and `inheritProjectContext: true` are
already emitted this way, unconditionally, a few lines below).

**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts (current, pre-phase-84)
if (frontmatter.skills.length > 0) {
  lines.push(`skills: ${frontmatter.skills.join(",")}`);
  // ADD HERE: lines.push(`skillPath: ../pi-claude-marketplace/resources/skills`);
}

lines.push(
  "systemPromptMode: replace",
  "inheritProjectContext: true",
  `inheritSkills: ${(frontmatter.inheritSkills ?? false) ? "true" : "false"}`,
);
```

### Pattern 2: pi-subagents' `localBaseDir` contract (verified from installed 0.35.1 source)

**What:** `resolveSkillsWithFallback(skillNames, primaryCwd, fallbackCwd,
localSkillPaths, localBaseDir)` resolves each entry of `localSkillPaths`
(the agent's `skillPath` array) via `path.resolve(localBaseDir ?? cwd,
entry)`. Both call sites (`runs/foreground/execution.ts:1202` and
`runs/background/async-execution.ts:588`) pass `localBaseDir = agent.filePath
? path.dirname(agent.filePath) : skillCwd` — i.e. **the directory containing
the agent `.md` file**, exactly as CONTEXT.md/NOTES.md assumed.
`collectFilesystemSkills` then walks each resolved dir for `SKILL.md` files
(matching `<generatedName>/SKILL.md` layout `skillsTargetDir` already
produces) and looks results up by directory-basename in a **throwaway**
`localByName` map — this map is never written into `loadSkillsCache` (the
process-wide skill cache backing `discoverAvailableSkills`), which is the
source of the "does not enter parent/global catalog" guarantee.

**When to use:** Confirming SC-2's exact acceptance check — a deterministic
unit-level verification should call `resolveSkillsWithFallback` (or its own
copy of the same math) with `localBaseDir = path.dirname(agentFilePath)` and
assert the skill resolves, AND assert `discoverAvailableSkills(cwd)` (the
global catalog) does NOT include it.

**Example:**
```typescript
// Source: /opt/homebrew/lib/node_modules/pi-subagents/src/runs/foreground/execution.ts:1197-1203
const { resolved: resolvedSkills, missing: missingSkills } = resolveSkillsWithFallback(
  skillNames,
  skillCwd,
  runtimeCwd,
  agent.skillPath,
  agent.filePath ? path.dirname(agent.filePath) : skillCwd,
);
```

### Anti-Patterns to Avoid

- **Passing `skillPath` as an absolute path or a dynamically-computed
  value:** The whole point of D-84-04 is a fixed relative constant that
  works identically in user and project scope because the agent file and
  `resources/skills/` are always siblings-of-a-sibling
  (`<scopeRoot>/agents/` and `<scopeRoot>/pi-claude-marketplace/resources/skills/`).
  Computing it from `locations.ts` at generation time would add
  indirection with zero behavioral benefit — the relative form is scope-agnostic
  by construction.
- **Threading a `preloaded` replacement flag through the type system
  instead of deleting it:** D-84-01/D-84-02 call for a *strict* collapse to
  one state. Keeping `preloaded` as an unused field (or renaming it to
  something like `available: true` that's always true) leaves dead code and
  invites future readers to wonder what distinguishes entries. Delete the
  field, delete its sole producer expression
  (`emitted.has(generated)` in `convert.ts`), and delete the now-unused
  `emittedSkills` parameter of `detectSkillTokens` plus its `skillsResult.emit`
  call-site argument.
- **Enforcing the pi-subagents version floor at runtime:** `platform/pi-api.ts`'s
  soft-dep probe (`hasLoadedPiSubagents`) is presence-only (checks for a tool
  named `"subagent"`); it has no version-awareness and this phase should not
  add any. The floor lives in `package.json` (declarative, npm-tooling-facing)
  and `README.md` (human-facing) only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill directory resolution/lookup by name | A custom directory walker mirroring pi-subagents' `collectFilesystemSkills` | pi-subagents' own `resolveSkillsWithFallback` (consumed only for verification/testing purposes, not reimplemented) | pi-subagents owns the resolution contract end to end; this repo's job stops at emitting the pointer field. Reimplementing the walk in a test would silently drift from the real resolver's semantics (priority ordering, dedup, `.md`-vs-dir handling) |
| CSV/list emission for `skillPath` | New parsing/serialization logic | The existing `frontmatter.skills.join(",")` pattern, single-entry | `skillPath` is parsed by pi-subagents with the identical `parseFrontmatterList` used for `skills`/`tools`/etc — a single relative-path string is a one-element CSV list, no new format needed |

**Key insight:** This phase's entire code-side surface is two small,
already-precedented emission patterns (conditional-field-on-non-empty-list,
constant-value push) in a module that already does both. No new abstraction,
no new dependency, no new file.

## Common Pitfalls

### Pitfall: Forgetting `skillPath` is gated on `skills` non-emptiness, not on legend presence

**What goes wrong:** A plan or implementation that gates `skillPath`
emission on `legend.length > 0` (i.e. only when the body references a
`<plugin>:<skill>` token) would break agents that declare `skills:` in
source frontmatter but never mention the skill by qualified token in body
prose — those agents currently emit `skills:` with **no** legend (see
`tests/bridges/agents/frontmatter.test.ts`'s `NO_LEGEND_EXPECTED` fixture,
and `tests/bridges/agents/convert.test.ts`'s `preLegendExpected` /
`"AGSK-04 token-free body emits no legend and stays byte-identical..."`
test), yet they still need `skillPath` for resolution to work at all.

**Why it happens:** The legend and `skillPath` are visually adjacent in the
generated file, but they are gated on two different signals: legend on
"does the body reference a resolvable token," `skillPath` on "is `skills:`
non-empty." Conflating them silently breaks skill resolution for the
legend-less, skills-bearing case.

**How to avoid:** Implement the `skillPath` push inside the same `if
(frontmatter.skills.length > 0) { ... }` block that already emits `skills:`,
not inside `renderSkillLegend`.

**Warning signs:** A byte-identity test where `skills:` is present but
`skillPath:` is absent and the test still passes — that's the bug this
pitfall describes.

### Pitfall: Missing whole-file fixtures when updating the legend annotation

**What goes wrong:** `"preloaded in your context"` appears as a literal
string in **9 places** across the two test files (5 substring assertions +
2 whole-file template-literal pins in `frontmatter.test.ts`, 4 substring
assertions + 1 whole-file pin in `convert.test.ts`, plus the
`LegendAnnotation` type alias declaration in `convert.test.ts:765` and the
`entry.preloaded` field usages inside two whole-file pins' `legend: [...]`
input objects). A search-and-replace that only touches the emitter source
leaves these fixtures asserting the old two-state text, causing `npm test`
failures that look unrelated to the actual defect.

**Exact locations found this session:**
- `frontmatter.ts:200-204` (`SkillLegendEntry.preloaded` field declaration)
- `frontmatter.ts:335` (the ternary itself)
- `convert.ts:145,171` (`detectSkillTokens` `emittedSkills` param + `emitted.has(generated)` computation)
- `tests/bridges/agents/frontmatter.test.ts:389-435` (whole-file pin, `preloaded: true`/`false` inputs, `(preloaded in your context)` / `(available on demand)` in expected output)
- `tests/bridges/agents/frontmatter.test.ts:489-537` (second whole-file pin, same shape)
- `tests/bridges/agents/convert.test.ts:765` (`LegendAnnotation` type alias — becomes dead or collapses to a single string literal)
- `tests/bridges/agents/convert.test.ts:797-812, 923-937, 959-973` (3 tests asserting `"preloaded in your context"` via `legendEntryLine(...)`)
- `tests/bridges/agents/convert.test.ts:1058-1118` (the `#86 canonical` whole-file pin — both the substring assertion at 1078-1086 and the `canonicalExpected` template literal at 1089-1117)

**How to avoid:** Grep for the literal string `"preloaded in your context"`
across `tests/` and `extensions/` after the source change, not just in the
file(s) directly touched; every hit must become `"available on demand"` (or
be deleted, for the type alias and the now-single-branch ternary).

**Warning signs:** `npm test` failures in `frontmatter.test.ts` or
`convert.test.ts` naming a legend-annotation mismatch after the emitter is
already collapsed.

### Pitfall: Confusing the `skillPath` emission fixtures with the `skills`-empty fixtures

**What goes wrong:** Several existing tests use `skills: []` specifically to
assert omission behavior (`"AG-8 emitGeneratedAgentFile omits skills line
when skills array is empty"` at `frontmatter.test.ts:233`, and its
neighbors at 209/256/278/304 which all use `skills: []` incidentally). These
MUST stay byte-identical (no `skillPath` line) — D-84-04's explicit
byte-identity guarantee for skill-less agents. Only fixtures using a
non-empty `skills` array (`makeLegendEmitInput()` at line 336, and the
`#86 canonical` fixtures in `convert.test.ts`) need the new line inserted.

**How to avoid:** Before editing, partition every whole-file-pin test by
whether its `frontmatter.skills` (or source `skills:`) is empty or
non-empty; only touch the non-empty set.

**Warning signs:** A diff that adds `skillPath:` to a fixture whose
`skills:` array is empty — that fixture's test will fail immediately since
the line shouldn't be there.

### Pitfall: Treating pi-subagents #526 as blocking the `>=0.35.0` floor

**What goes wrong:** #526 ("async subagents fail because detached runner
cannot resolve host-provided typebox/compile") is open, reproduced by
multiple independent users on 0.35.1, and traces to PR #513 (same 0.35.0
release that shipped `skillPath`, per PR #428). A plan that reads this as
"skillPath and the async runner share a defect" would either delay the
floor bump unnecessarily or add unneeded async-specific workaround code to
this repo.

**Why it happens:** Surface-level, #526 and skillPath both land in "0.35.0release notes," inviting an assumption of coupling.

**How to avoid:** The defect is isolated to `structured-output.ts`'s
top-level `import { Compile } from "typebox/compile"` reached
unconditionally through `pi-args.ts` in the **detached Jiti runner**
(`async: true` spawns only). `resolveSkillsWithFallback` — the function this
phase's fix depends on — has no TypeBox dependency and runs identically on
both the foreground and async code paths. The 84-NOTES.md verification
(foreground read-and-emit-token A/B) already avoided the confound; SC-4's
plan-level verification step should explicitly specify `async: false` /
foreground subagent invocation and note in a comment why (so a future
reader doesn't "fix" it into async mode and get spurious failures).

**Warning signs:** A live-spawn verification failing with `Cannot find
module 'typebox/compile'` — that is #526, not a skillPath regression; do not
debug it as one.

### Pitfall: Adding `pi-subagents` to `dependencies` instead of `peerDependencies`

**What goes wrong:** Adding `pi-subagents` to `package.json`'s
`dependencies` would make `npm install` fetch and install the entire
pi-subagents extension (with its own dependency tree: `jiti`, `yaml`, etc.)
into this repo's `node_modules`, even though this repo never imports a
single symbol from it — the two extensions communicate only through Pi's
tool registry and the shared filesystem convention this phase implements.

**How to avoid:** Use `peerDependencies` (documents the compatible version
range without installing) paired with `peerDependenciesMeta: { "pi-subagents":
{ "optional": true } }` (tells npm not to warn/fail when the peer is
absent — this repo's existing three peers, `@earendil-works/pi-coding-agent`,
`@earendil-works/pi-tui`, `typebox`, are all *required* peers with no
`peerDependenciesMeta` entry today; `pi-subagents` would be the first
**optional** peer, mirroring the "requires pi-subagents" soft-dep language
already used throughout `notify.ts`/README).

**Warning signs:** A `package-lock.json` diff showing new `node_modules/pi-subagents/*`
entries after `npm install` — that means it landed in the wrong dependency
bucket.

## Code Examples

### Current emitter (frontmatter.ts, lines 270-278) — the exact insertion point

```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts (as of this research)
if (frontmatter.skills.length > 0) {
  lines.push(`skills: ${frontmatter.skills.join(",")}`);
}

lines.push(
  "systemPromptMode: replace",
  "inheritProjectContext: true",
  `inheritSkills: ${(frontmatter.inheritSkills ?? false) ? "true" : "false"}`,
);
```

### Current legend renderer (frontmatter.ts, lines 329-337) — the collapse target

```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts (as of this research)
function renderSkillLegend(legend: readonly SkillLegendEntry[] | undefined): string {
  if (legend === undefined || legend.length === 0) {
    return "";
  }

  const entryLines = legend.map((entry) => {
    const annotation = entry.preloaded ? "preloaded in your context" : "available on demand";
    return `- \`${entry.token}\` → skill \`${entry.generatedName}\` (${annotation})`;
  });
  // ...
}
```

### Current legend producer (convert.ts, lines 140-176) — the `preloaded` computation to delete

```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/convert.ts (as of this research)
function detectSkillTokens(
  body: string,
  pluginName: string,
  knownSkills: readonly string[],
  emittedSkills: readonly string[],   // <-- becomes unused once preloaded is removed
): SkillLegendEntry[] {
  const known = new Set(knownSkills);
  const emitted = new Set(emittedSkills);   // <-- delete
  // ...
  const generated = generatedSkillName(pluginName, candidate);
  if (known.has(generated)) {
    entries.push({ token, generatedName: generated, preloaded: emitted.has(generated) }); // <-- delete preloaded field
  }
  // ...
}

// call site, line 530:
const legend = detectSkillTokens(substitutedBody, pluginName, knownSkills, skillsResult.emit); // <-- drop 4th arg
```

### pi-subagents' skillPath frontmatter parse (agents.ts, lines 1240, 1336) — confirms the emitted key name and CSV form

```typescript
// Source: /opt/homebrew/lib/node_modules/pi-subagents/src/agents/agents.ts (installed 0.35.1)
const skillPath = parseFrontmatterList(frontmatter.skillPath);
// ...
skillPath: skillPath && skillPath.length > 0 ? skillPath : undefined,
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Full-body skill preload into subagent system prompt (Claude Code's native `skills:` behavior, and pi-subagents pre-#183) | Lazy `<available_skills>` XML listing (name/description/`<location>`), read on demand | pi-subagents #183, landed by 0.35.x per NOTES.md | The "(preloaded in your context)" legend annotation is now false for every generated agent regardless of `skillPath`/`skills:` — this is the direct cause of D-84-01 |
| `skills:` resolved only against pi-subagents' own filesystem scan roots (`.pi/skills`, `.agents/skills`, npm `pi.skills`, settings) | Agent-local `skillPath` adds a per-agent, invocation-private search root resolved relative to the agent file | pi-subagents 0.35.0, PR #428 (changelog credits @kylegl; NOTES.md's "PR #470" appears to be a citation error — verify against the live GitHub PR before citing it in code comments or commit messages) | This is the mechanism this phase depends on; confirmed present and unchanged in 0.35.1 |
| TypeBox bundled as a direct `dependencies` entry inside pi-subagents | TypeBox moved to an optional peer dependency, host-resolved | pi-subagents PR #513, 0.35.0 | Introduced #526 (detached-async-runner module resolution failure); unrelated to this phase's skillPath mechanism but worth knowing when interpreting `npm run check` or live-spawn test failures against pi-subagents 0.35.x |

**Deprecated/outdated:**
- The two-state skill legend ("preloaded in your context" / "available on demand") introduced in Phase 82 and only recently unified for the non-preloaded branch in Phase 83.1 is now fully retired by D-84-01 — it never had a faithful preloaded state to describe under 0.35.x lazy delivery.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact PR number that shipped agent-local `skillPath` is #428 (per the installed pi-subagents CHANGELOG.md, crediting @kylegl), not #470 as stated in `84-CONTEXT.md`/`84-NOTES.md`/ROADMAP.md. This is a citation correction, not a design-affecting claim — the version floor (`>=0.35.0`) and the resolution mechanics were independently verified by reading the installed 0.35.1 source directly. | State of the Art table; Summary point 1 area | Low — if a commit message or code comment cites "PR #470" it would be a harmless but incorrect provenance note. Worth a quick GitHub check before finalizing commit/PR text, but does not affect any implementation decision. |
| A2 | `pi-subagents` should be added to `package.json` as an **optional** peer dependency (`peerDependenciesMeta.optional: true`) rather than a required peer or a plain `dependencies` entry. No test in this repo currently pins the expected shape of a soft-dependency's `package.json` representation (this is the first such entry), so this is a design recommendation grounded in npm semantics, not a locked convention from prior phases. | Anti-Patterns / Pitfall: "Adding pi-subagents to dependencies instead of peerDependencies" | Medium — if the planner instead makes it a required peer, `npm install` in environments without pi-subagents installed globally would emit an `ERESOLVE`/peer-warning noise that doesn't reflect the true optional nature of the integration. Easy to fix later (single-line package.json edit) if this recommendation is wrong. |

## Open Questions (RESOLVED)

1. **Should the README Prerequisites bullet gain the `>=0.35.0` floor text, and is that in scope for "package.json raises the ... peer floor" (SC-3)?**
   - What we know: SC-3's literal text only names `package.json`. The existing Prerequisites bullet (`- [pi-subagents](https://pi.dev/packages/pi-subagents) (optional but recommended, `pi install npm:pi-subagents`)`) does not currently state any version.
   - What's unclear: Whether the planner should treat the README update as in-scope (for user-facing accuracy) or defer it as out-of-phase-scope since SC-3 doesn't name it.
   - Recommendation: Include it — it's a one-line edit, keeps the two floor-statements (package.json, README) from drifting, and CONTEXT.md's discretion note leaves "exact refactor" details to the planner. Low risk either way.
   - **RESOLVED:** In scope. Implemented in Plan 84-02 Task 1 (README Prerequisites floor text alongside the `package.json` optional-peer addition).

2. **Does D-84-05's "byte-identity fixture corpus" also include the `#86 canonical agent without a body token converts with no legend (reference-gated)` test at `convert.test.ts:1120`?**
   - What we know: That test (lines 1120-1133, truncated in this research's reads but confirmed to reuse `convertCanonical(makeCanonicalSource(...))` with a token-free body) asserts frontmatter facts via `assert.match` on substrings, not a whole-file template-literal pin — so it likely doesn't need a byte-for-byte fixture update, only implicit correctness (the `skills:` line it matches on is unaffected by the `skillPath` addition).
   - What's unclear: Whether it has additional un-read assertions further down that assume no `skillPath:` line is present.
   - Recommendation: Planner/implementer should read the full test body (lines 1120-1140ish) before editing, but this is a low-risk, mechanical check — flagging so it isn't missed in the sweep for `"preloaded in your context"` and whole-file pins.
   - **RESOLVED:** Flagged in Plan 84-01 Task 2's `<read_first>` — the token-free companion test at `convert.test.ts:1120` needs no change (asserts on the unaffected `skills:` line, not a whole-file pin).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pi-subagents (npm, global or project) | SC-2 (deterministic resolver check), SC-4 (live spawn) | Yes | 0.35.1 (confirmed installed at `/opt/homebrew/lib/node_modules/pi-subagents`; `npm view pi-subagents version` also resolves 0.35.1 from the public registry) | none needed |
| `@earendil-works/pi-coding-agent` (host, for live spawn) | SC-4 | Assumed available in the dev environment per existing devDependency `^0.79.0` / peer `>=0.74.0` | — | none needed; not independently re-verified this session (unchanged by this phase) |

**Missing dependencies with no fallback:** none — pi-subagents 0.35.1 is
already installed and is at or above the target floor.

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (via `node --test`) |
| Config file | none — glob-driven via `package.json` `scripts.test` (`tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`) |
| Quick run command | `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts` |
| Full suite command | `npm run check` (typecheck + lint + format:check + `npm test` + `npm run test:integration`) |

### Phase Requirement -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGSK-06 (SC-1) | `skillPath` emitted iff `skills:` non-empty; skill-less agents byte-identical | unit | `node --test tests/bridges/agents/frontmatter.test.ts` | Existing file, fixtures need updates (see Pitfalls) |
| AGSK-06 (SC-1, legend collapse) | Legend annotates every entry `(available on demand)`, never `(preloaded in your context)` | unit | `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts` | Existing files, fixtures need updates |
| AGSK-06 (SC-2) | pi-subagents `resolveSkillsWithFallback` resolves the bridged skill by generated name given the emitted `skillPath`; skill does not enter the parent/global catalog | integration / manual-with-script | A small Node script (or `tests/integration/`) that imports the installed pi-subagents module directly and calls `resolveSkillsWithFallback` against a real staged skill install, asserting `resolved` is non-empty and `discoverAvailableSkills(cwd)` excludes the skill name | ❌ — no such test exists today; this is genuinely new coverage the plan must add (a resolveSkillsWithFallback-shaped fixture, not a byte-identity one) |
| AGSK-06 (SC-3) | `package.json` declares `pi-subagents >=0.35.0`; `npm run check` stays green | manual + CI gate | `npm run check` | N/A — package.json inspection, not a test file |
| AGSK-06 (SC-4) | Live foreground spawn of a skill-referencing bridged agent loads and uses the skill; A/B without `skillPath` fails | manual UAT (documented in 84-NOTES.md as already performed once) | A real `subagent({ agent: <bridged-agent>, task: "...", async: false, ... })` call with a unique-token skill, run twice (with/without `skillPath` in the generated file) | N/A — this is inherently a live-environment check, not automatable in `node --test`; explicitly use `async: false` per the #526 pitfall above |

### Sampling Rate

- **Per task commit:** `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green, plus the manual SC-2 resolver script and SC-4 live-spawn A/B both re-run and their transcripts/output captured for UAT (mirroring 84-NOTES.md's existing verification shape, since neither is expressible as a `node:test` unit test without either vendoring or dynamically importing the installed pi-subagents package).

### Wave 0 Gaps

- [ ] No existing test exercises `resolveSkillsWithFallback` against a real
      staged skill directory (SC-2). The plan should decide whether this
      becomes a permanent `tests/integration/` fixture (importing
      `pi-subagents`'s `src/agents/skills.ts` directly, guarded by a
      presence check since pi-subagents is an optional peer not vendored in
      `node_modules` by default) or a one-off manual verification script
      captured in the phase's UAT evidence, matching how 84-NOTES.md
      documented its own three-way verification. Given pi-subagents is not a
      `dependencies`/`devDependencies` entry, a permanent automated test
      importing it would need to skip gracefully when the package isn't
      installed (e.g. `test.skip` on a dynamic-import failure) to keep
      `npm run check` green in CI environments that don't have pi-subagents
      globally installed.
- [ ] No test file currently pins `package.json`'s `peerDependencies`
      shape beyond the telemetry-denylist check (`no-telemetry-deps.test.ts`,
      confirmed unaffected by adding `pi-subagents`). No new test is
      strictly required for SC-3 beyond `npm run check` passing, but the
      planner may choose to add a lightweight architecture test asserting
      `pi-subagents` appears in `peerDependencies` with the expected range,
      mirroring the existing `extension-version-sync.test.ts` pattern.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no (new surface is a fixed constant string, not user/plugin-controlled input) | N/A |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Path traversal via a name-derived path | Tampering | Not applicable here — `skillPath`'s value (`../pi-claude-marketplace/resources/skills`) is a **hardcoded constant**, never built from plugin/skill/marketplace names, so none of `locations.ts`'s `assertPathInside`/`assertSafeName` chokepoints are bypassed or newly required. The existing NFR-10 containment model (skills always materialize under `<scope>/pi-claude-marketplace/resources/skills/`, per `locations.ts`) is unchanged; this phase only adds a *pointer* to that already-contained directory, consumed by an external process (pi-subagents) outside this repo's containment boundary. |

This phase introduces no new attack surface: no new user input, no new
network call, no new file write location. The `skillPath` value is a
compile-time literal string.

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` (this repo, read directly) — exact current emit/parse/render logic, insertion points.
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` (this repo, read directly) — `detectSkillTokens`, `preloaded` computation, `emitGeneratedAgentFile` call site.
- `extensions/pi-claude-marketplace/persistence/locations.ts` (this repo, read directly) — `skillsTargetDir` = `<extensionRoot>/resources/skills`, confirming the relative-path target.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` (this repo, read directly) — confirms pi-subagents is a presence-only soft-dep probe, no code import, no version awareness.
- `extensions/pi-claude-marketplace/orchestrators/discover.ts` (this repo, read directly) — confirms the `resources_discover` pointer-only surface is unrelated to and unaffected by this phase.
- `package.json` (this repo, read directly) — confirmed no existing pi-subagents entry in any dependency bucket.
- `tests/bridges/agents/frontmatter.test.ts`, `tests/bridges/agents/convert.test.ts` (this repo, read directly) — the full byte-identity fixture corpus and every "preloaded in your context" occurrence, enumerated exactly.
- `/opt/homebrew/lib/node_modules/pi-subagents/src/agents/skills.ts` (installed pi-subagents 0.35.1, read directly) — `resolveSkills`, `resolveSkillsWithFallback`, `buildSkillInjection`, `collectFilesystemSkills`, confirming the local/invocation-private resolution mechanics.
- `/opt/homebrew/lib/node_modules/pi-subagents/src/runs/foreground/execution.ts:1197-1203`, `/opt/homebrew/lib/node_modules/pi-subagents/src/runs/background/async-execution.ts:583-589` (installed 0.35.1, read directly) — confirmed `localBaseDir = dirname(agent.filePath)` at both call sites.
- `/opt/homebrew/lib/node_modules/pi-subagents/src/agents/agents.ts:1240,1336` (installed 0.35.1, read directly) — confirmed `skillPath` frontmatter parses via `parseFrontmatterList`, same as `skills:`.
- `/opt/homebrew/lib/node_modules/pi-subagents/CHANGELOG.md` (installed 0.35.1, read directly) — confirmed 0.35.0 shipped agent-local `skillPath` (PR #428, not #470) and the lazy `buildSkillInjection` change (#183, referenced in prior-phase NOTES).
- `npm view pi-subagents version` — `[VERIFIED: npm registry]` 0.35.1 is the current published version.
- `gh issue view 526 -R nicobailon/pi-subagents` — full issue text and 4 comments read directly, confirming #526 is a detached-async-runner-only TypeBox module-resolution regression, unrelated to skill resolution, still open as of 2026-07-20.

### Secondary (MEDIUM confidence)
- WebSearch results on `pi-subagents skillPath` — used only to orient the search before falling back to reading installed source directly; no claim in this document is sourced solely from the search results.

### Tertiary (LOW confidence)
- None — every substantive claim in this document was verified against either this repo's own source, the installed pi-subagents package source, or a live `gh`/`npm` query.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing patterns extended.
- Architecture: HIGH — verified against both sides of the integration (this repo's emitter, pi-subagents' resolver) by reading actual installed source, not documentation.
- Pitfalls: HIGH — every fixture location was grepped and read, not inferred.

**Research date:** 2026-07-19
**Valid until:** 30 days, or immediately upon any pi-subagents version bump beyond 0.35.1 (re-check #526 status and the exact `skillPath` PR number before citing either in commit/PR text).
