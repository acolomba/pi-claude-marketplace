# Phase 82: Agent Skill Preload Fidelity - Research

**Researched:** 2026-07-19
**Domain:** agents-bridge conversion pipeline (frontmatter parsing, skill/tool mapping, provenance, generated-file emission) in this repository
**Confidence:** HIGH — every load-bearing claim verified against the V1 source in this worktree, the locally installed pi-subagents 0.28.0, or a live reproduction run

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Frontmatter parsing (block lists)
- **D-82-01:** Dash-list folding applies to ANY frontmatter key: a key with
  an empty value followed by `- item` continuation lines folds the items
  into that key's CSV value. Unsupported list-valued keys then land in
  `droppedFields` as one clean key name (no bogus `- token` fragments).
- **D-82-02:** Keep the lenient line-based parser; a real YAML parser is
  rejected. Empirical basis: `claude-plugins-official` ships
  `plugins/pr-review-toolkit/agents/silent-failure-hunter.md` whose
  1442-char unquoted description (`... <example>\nContext: Daisy ...`)
  fails BOTH js-yaml (1.1) and yaml (1.2); Claude Code accepts it; our
  parser accepts it (AG-6 contract). Also: YAML 1.1 coerces
  `thinking: off` to boolean false. Official marketplace scan (27 agents):
  0 mixed forms, 0 dash block lists, 0 coercion hazards.
- **D-82-03:** Mixed form (inline value + dash items under one key —
  invalid YAML, zero occurrences in the wild): Claude's discretion.
  Inclination: inline value wins, dash items ignored. Whatever is chosen
  must be documented in the parser comment and pinned by a test.

#### Skill legend (body advisory note)
- **D-82-04:** Placement: top of the generated body, immediately after the
  provenance HTML comment, before the original agent prose.
- **D-82-05:** Format: markdown heading + section. Heading exactly
  `## Pi coding agent skill legend`. Accepted shape:

  ```markdown
  ## Pi coding agent skill legend

  These instructions reference Claude skills by their original
  names. In this Pi session:

  - `spec-tree:review-changes` → skill `spec-tree-review-changes`
    (preloaded in your context)
  - `spec-tree:other-skill` — not available in this session
  ```

- **D-82-06:** Detection scope: only `<this-plugin>:<skill>` tokens where
  the skill is actually discovered in the plugin. Annotation is
  "(preloaded in your context)" when the skill is in the emitted `skills:`
  list, "— not available in this session" otherwise. Cross-plugin and
  unknown-skill tokens get NO legend entry (unverifiable, false-positive
  prone).
- **D-82-07:** Detection scans the whole body including fenced code blocks
  (legend is aggregated at top; no inline rewriting, so code-block matches
  are safe and useful; avoids fence-parsing edge cases).

#### Skill-drop provenance warning
- **D-82-08:** The new warning fires ONLY when the `Skill` tool is dropped.
  Other dropped tools keep today's silent `droppedTools` behavior — a
  warning for every dropped tool would change output bytes for agents this
  phase must leave byte-identical.
- **D-82-09:** Warning wording (forward-compatible with Phase 83; the
  statement stays true for non-Skill agents after 83 lands):
  `dropped tool "Skill" -- generated agents run with skills discovery
  disabled (inheritSkills: false); only the skills listed in skills: are
  preloaded into the child's context`. Minor final polish is Claude's
  discretion; the two required elements are (a) why the child cannot load
  skills dynamically and (b) the `skills:` list is the child's entire
  skill context.

#### Carried forward from milestone kickoff (STATE.md)
- Legend lives in the generated agent body (pi-subagents passes the body
  verbatim as the child's system prompt); never in frontmatter or skill md.
- Generated frontmatter keeps emitting CSV `skills:` (pi-subagents 0.28.x
  compatibility floor).
- Cross-plugin qualified `skills:` entries warn-and-drop, naming the token.
- Legend emission is reference-gated: no body tokens → byte-identical
  output.

### Claude's Discretion
- Mixed-form parser behavior (D-82-03).
- Final polish of warning string (D-82-09) and legend line phrasing beyond
  the accepted shape (D-82-05).

### Deferred Ideas (OUT OF SCOPE)
- **Phase 83 (AGSK-05, same milestone):** map source `Skill` tool →
  `inheritSkills: true` (unless disallowed via `disallowedTools`). Pi's
  lazy skill catalog + read-on-demand is a faithful analog of Claude's
  Skill tool (catalog is environment-dependent in Claude Code too).
  Interactions identified: AGSK-03 warning wording branches for
  Skill-declaring agents; legend gains an "available on demand as
  `<pi-name>`" state; byte-identical carve-out extends to Skill-declaring
  agents; duplication edge (skill both preloaded and in catalog) needs a
  pinning test. The REQUIREMENTS.md out-of-scope rationale ("no Pi-native
  dynamic invocation surface exists") was found to be overstated and the
  row is removed as part of registering AGSK-05.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGSK-01 | Documented YAML block-list form for `skills:`/`tools:` converts with list values intact; no bogus `- <token>` droppedFields; CSV/inline-array forms parse byte-identically | Reproduction confirms exact bug mechanism (line-based parser splits `- spec-tree:review-changes` on first colon into bogus key `- spec-tree`); fold site is the `for` loop in `parseFrontmatter` (frontmatter.ts:96-114); `splitCsv` (convert.ts:79-108) consumes comma-joined folded values unchanged |
| AGSK-02 | `<plugin>:<skill>` same-plugin qualifier maps like bare form; cross-plugin qualifier warns-and-drops naming the token | `mapSkills` (convert.ts:256-279) is the single site; `generatedSkillName` (name.ts:64-77) already handles prefix elision, so qualifier handling reduces to stripping `<plugin>:` before delegation; existing warning-wording pattern documented |
| AGSK-03 | Dropped `Skill` tool produces provenance warning explaining `inheritSkills: false` and preload-only context | Drop site is `mapTools` loop (convert.ts:170-177); warnings already thread `mapTools → convertAgent → provenance` (convert.ts:341, 398); D-82-09 wording is already ASCII-safe for pre-commit hooks |
| AGSK-04 | Body `<plugin>:<source-skill>` tokens produce a converter-authored legend; token-free bodies stay byte-identical | Insertion seam is `emitGeneratedAgentFile` (frontmatter.ts:174-234, assembly at line 233); all detection inputs (`pluginName`, `knownSkills`, emitted skills list, substituted body) are in scope at convertAgent step 7→8 (convert.ts:374-401); regex-boundary and hook-safety pitfalls documented below |
</phase_requirements>

## Summary

This phase is a self-contained modification of three files in the V1 agents bridge — `bridges/agents/frontmatter.ts` (parser + emitter), `bridges/agents/convert.ts` (mapSkills/mapTools/convertAgent), and their tests — with `domain/name.ts` consumed read-only. No new dependencies, no new architecture, no network. The whole phase is deterministic string transformation with an unusually strict regression bar: agents outside the four fix classes must produce byte-identical generated files.

Live reproduction against the current parser confirms the issue #86 mechanism exactly: `skills:` followed by `  - spec-tree:review-changes` yields `raw = { skills: "", "- spec-tree": "review-changes" }`, which lands `- spec-tree` in `droppedFields` and emits no `skills:` line. All four fixes have precise, already-identified seams, and the conversion pipeline (`convertAgent`) already receives every input the legend needs (`pluginName`, `knownSkills`, emitted skills, body). The dominant risks are not design risks but bytes-and-tooling risks: warnings array ordering is provenance-visible, `generatedSkillName` throws on malformed elided names (new qualifier-stripping and body-scanning code paths must guard against introducing a throw where a warn-drop is required), and the repository's `fix-unicode-dashes` pre-commit hook rewrites the em-dash that appears in D-82-05's accepted legend shape — string literals in `.ts` sources must use `—`/`→` escapes (or ASCII equivalents) to survive commit.

**Primary recommendation:** Structure the plan as (1) pin current output bytes with a regression corpus test written against HEAD before any code change, (2) implement dash-folding in `parseFrontmatter`, (3) implement qualifier handling in `mapSkills` + Skill warning in `mapTools`, (4) implement legend detection in convert.ts and rendering in `emitGeneratedAgentFile`, each with exact-string pinning tests, closing with the issue #86 canonical end-to-end fixture.

## Architectural Responsibility Map

All work is inside one tier (the Pi extension's agents bridge, pure Node library code). The map below assigns capabilities to modules rather than deployment tiers.

| Capability | Primary Owner | Secondary | Rationale |
|------------|--------------|-----------|-----------|
| Dash-list folding (AGSK-01) | `frontmatter.ts::parseFrontmatter` | — | Input-side parser owns all frontmatter shape decisions (module header contract, frontmatter.ts:14-18) [VERIFIED: codebase] |
| CSV/inline-array normalization | `convert.ts::splitCsv` (unchanged) | — | Folded values are comma-joined upstream so splitCsv needs no change (CONTEXT.md reusable assets) [VERIFIED: codebase] |
| Qualifier stripping + cross-plugin drop (AGSK-02) | `convert.ts::mapSkills` | `domain/name.ts::generatedSkillName` (read-only) | mapSkills is the only consumer of `raw.skills`; name.ts stays untouched — bare/qualified agreement is achieved by stripping the qualifier then delegating [VERIFIED: codebase] |
| Skill-drop warning (AGSK-03) | `convert.ts::mapTools` | `convertAgent` warnings aggregation | The drop happens in mapTools' loop (convert.ts:170-177); pushing the warning there keeps warning order stable relative to the existing omitted-`tools:` warning [VERIFIED: codebase] |
| Legend detection (AGSK-04) | `convert.ts` (new helper, called between steps 7 and 8) | — | Needs `pluginName`, `knownSkills`, emitted skills, substituted body — all in scope in convertAgent (convert.ts:291-401) [VERIFIED: codebase] |
| Legend rendering + placement (AGSK-04) | `frontmatter.ts::emitGeneratedAgentFile` | — | Single byte-assembly seam; keeps all byte-layout decisions in one module (module header, frontmatter.ts:8-12; CONTEXT.md integration points) [VERIFIED: codebase] |
| Byte-identity regression harness | `tests/bridges/agents/` (new test file) | `tests/bridges/_fixtures/` | Existing convention: exact-equality user-contract tests (MODEL_MAP/TOOL_MAP snapshots in convert.test.ts:253-287) [VERIFIED: codebase] |

## Standard Stack

### Core

No new libraries. The phase uses only what is already in the repo.

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Node.js | local v26.5.0; CI pins 24; engines `>=20.19.0` | Runtime + native TS strip + `node --test` | [VERIFIED: `node --version`, `.github/workflows/ci.yml:46`] |
| TypeScript strict | repo-pinned | Language | Existing (NFR-6 / CLAUDE.md) [VERIFIED: codebase] |
| node:test | built-in | Test framework — `npm test` glob already includes `tests/bridges/**` | [VERIFIED: package.json scripts] |
| pre-commit | 4.5.1 (local) | Hook gate before commit | [VERIFIED: `pre-commit --version`] |

### Supporting

| Module (existing, in-repo) | Role in this phase |
|----------------------------|--------------------|
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | Modified: parser (dash-folding) + emitter (legend insertion) |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | Modified: mapSkills, mapTools, convertAgent (legend detection wiring) |
| `extensions/pi-claude-marketplace/domain/name.ts` | Read-only: `generatedSkillName` delegation target |
| `extensions/pi-claude-marketplace/bridges/agents/discover.ts`, `stage.ts`, `types.ts` | Unchanged: threading of `raw`, `body`, `knownSkills` already exists (stage.ts:134-144) |

### Alternatives Considered

| Instead of | Could Use | Verdict |
|------------|-----------|---------|
| Extending the line-based parser | js-yaml / yaml package | **Rejected by locked D-82-02** — real YAML parsers fail on shipped Claude agents (1442-char unquoted description) and YAML 1.1 coerces `thinking: off` to boolean. Do not relitigate. |
| Inline exact-string expected constants in tests | node:test snapshot files (`t.assert.snapshot`) | Inline constants match the established repo convention (MODEL_MAP/TOOL_MAP snapshot tests are `deepEqual` literals) and avoid snapshot-file management; snapshots also only stabilized in Node 23.4 while engines floor is 20.19 [VERIFIED: codebase + nodejs.org/api/test.html cited in CLAUDE.md] |

**Installation:** none — no packages are added.

## Package Legitimacy Audit

**This phase installs no external packages.** No new entries in `dependencies`, `devDependencies`, or `peerDependencies`. slopcheck run not applicable; audit table intentionally empty.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

Data flow of one plugin-agent conversion, with the four Phase 82 change points marked `[*]`:

```
<pluginRoot>/agents/*.md  (untrusted plugin content)
        |
        v
discover.ts::discoverPluginAgents          (unchanged)
        |  readFile -> parseFrontmatter
        v
frontmatter.ts::parseFrontmatter  [* AGSK-01: dash-list folding]
        |  { raw: Record<string,string>, body }
        v
stage.ts::prepareStagePluginAgents         (unchanged; threads knownSkills ?? [])
        |
        v
convert.ts::convertAgent
        |-- mapModel(raw.model)                       (unchanged)
        |-- mapTools(raw.tools, raw.disallowedTools)  [* AGSK-03: Skill-drop warning]
        |-- mapThinking(...)                          (unchanged)
        |-- mapSkills(raw.skills, pluginName, knownSkills)  [* AGSK-02: qualifier handling]
        |-- droppedFields = keys(raw) - SUPPORTED_SOURCE_FIELDS   (fixed transitively by AGSK-01)
        |-- substituteClaudeVars(body)                (unchanged)
        |-- detectSkillTokens(substitutedBody, pluginName, knownSkills, emittedSkills)  [* AGSK-04: new]
        v
frontmatter.ts::emitGeneratedAgentFile  [* AGSK-04: legend block between provenance comment and body]
        |  "---\n<frontmatter>\n---\n" + "\n" + "<!--provenance-->\n" + [legend] + "\n<body>\n"
        v
stage.ts staging dir -> atomic rename -> <scopeRoot>/agents/<generatedName>.md
        |
        v  (consumed at runtime by)
pi-subagents (floor 0.28.0): comma-splits `skills:` (agents.ts:654-658),
  full-content-injects each skill into child system prompt (skills.ts:579-585),
  spawns child with --no-skills when inheritSkills: false (pi-args.ts:132-134)
```

[VERIFIED: all repo paths read this session; pi-subagents claims verified against the locally installed 0.28.0 at `~/.pi/agent/npm/node_modules/pi-subagents/` — this is exactly the compatibility-floor version]

### Current parser behavior on the canonical input (reproduced live this session)

Input frontmatter:

```yaml
name: changes-reviewer
description: Reviews changes
tools: Bash, Read, Skill
skills:
  - spec-tree:review-changes
```

Actual `parseFrontmatter` output today [VERIFIED: executed against worktree code, Node 26.5.0]:

```json
{
  "name": "changes-reviewer",
  "description": "Reviews changes",
  "tools": "Bash, Read, Skill",
  "skills": "",
  "- spec-tree": "review-changes"
}
```

Consequences downstream: `raw.skills === ""` → `splitCsv("")` → `[]` → no `skills:` line emitted; the bogus `- spec-tree` key is not in `SUPPORTED_SOURCE_FIELDS` (convert.ts:28-37) → `droppedFields: ["- spec-tree"]` — matching the issue #86 report (`droppedFields: - spec-tree`) exactly. Note: the trimmed dash line is split on its FIRST colon (frontmatter.ts:102), which is why the item token itself is destroyed.

### Pattern 1: Dash-list folding in the line loop (AGSK-01, D-82-01)

**What:** Track the most recently parsed key. When a trimmed line starts with `- ` (dash + space), and the tracked key's current value is empty (or was itself produced by folding), append the item text (everything after `- `, trimmed, taken verbatim — no colon split) to that key's value, comma-joined. Dash lines with no preceding key are ignored. Dash lines following a key with a non-empty inline value: per D-82-03 (Claude's discretion, inclination locked as "inline wins") ignore them — document in the parser comment and pin with a test.

**Sketch (shape, not final code):**

```typescript
// Inside parseFrontmatter's line loop (frontmatter.ts:96-114)
let lastKey: string | null = null;
let lastKeyFoldable = false; // true when raw[lastKey] started empty or has only folded items

for (const rawLine of fmText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (line === "") continue;

  if (line.startsWith("- ") || line === "-") {
    const item = line === "-" ? "" : line.slice(2).trim();
    if (lastKey !== null && lastKeyFoldable && item !== "") {
      raw[lastKey] = raw[lastKey] === "" ? item : `${raw[lastKey]},${item}`;
    }
    continue; // NEVER falls through to the colon-split path
  }

  const colon = line.indexOf(":");
  if (colon === -1) continue;
  const key = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (key === "") continue;
  raw[key] = value;
  lastKey = key;
  lastKeyFoldable = value === "";
}
```

**Why comma-join:** `splitCsv` (convert.ts:79-108) already normalizes CSV and strips per-item surrounding quotes, so `- "quoted-item"` folds correctly with zero changes to splitCsv. Items containing literal commas would corrupt the fold — no real skill/tool name contains a comma; document as a known limitation in the parser comment. [VERIFIED: splitCsv read this session]

**Byte-identity analysis of this change** (enumerated so the planner can pin each class):

| Input class | Today | After fix | Byte-identical? |
|---|---|---|---|
| CSV / inline-array `tools:`/`skills:` | parsed | unchanged path | YES (required by SC-5) |
| Key with empty value, no dash items (`skills:` then next key) | `raw.skills=""` | same | YES |
| Dash item WITH colon (`- spec-tree:review-changes`) | bogus key → droppedFields | folded into preceding key | Changes (intended — fix class) |
| Dash item WITHOUT colon (`- knowledge`) | line skipped (no colon, frontmatter.ts:103) | folded | Changes (intended — block list now works) |
| Dash items under an unsupported key (`hooks:` + items) | `hooks` in droppedFields + possible bogus keys | `hooks` in droppedFields (one clean name), value folded but unused | droppedFields identical when items had no colon; cleaner when they did (intended, D-82-01) |
| Mixed form (`tools: Read` then `- Edit:x`) | bogus `- Edit` key → droppedFields | dash line ignored (D-82-03 inclination) | Changes — acceptable: agent has a dash list, so the fix applies; zero occurrences in the wild (D-82-02 scan); pin with test |

### Pattern 2: Qualifier handling in mapSkills (AGSK-02)

**What:** Before calling `generatedSkillName`, split each token on its FIRST colon. If there is no colon → bare path, exactly today's behavior. If the qualifier equals `pluginName` → strip it and delegate the remainder (prefix elision in `generatedSkillName` makes `spec-tree:review-changes` and `spec-tree:spec-tree-review-changes` converge on `spec-tree-review-changes`). If the qualifier differs → push a warning naming the full token and drop; do NOT fall through to the unknown-skill warning.

**Sketch:**

```typescript
// convert.ts::mapSkills (currently lines 256-279)
for (const token of tokens) {
  const colon = token.indexOf(":");
  if (colon !== -1) {
    const qualifier = token.slice(0, colon);
    const rest = token.slice(colon + 1);
    if (qualifier !== pluginName) {
      warnings.push(/* cross-plugin wording naming `token` -- planner pins exact string */);
      continue;
    }
    if (rest === "") {
      warnings.push(`unknown skill reference "${token}" -- dropped`); // guard: generatedSkillName throws on ""
      continue;
    }
    // fall through with `rest` as the effective token
  }
  const generated = generatedSkillName(pluginName, effectiveToken);
  ...
}
```

**Critical guard:** `generatedSkillName` calls `assertSafeName`, which THROWS on empty strings, `"."`, `".."`, path separators, and control characters (name.ts:23-51). Today the token `"spec-tree:"` survives (it maps to the never-known `spec-tree-spec-tree:` and warn-drops); after qualifier stripping the naive path would call `generatedSkillName("spec-tree", "")` and **throw, converting a warn-drop into an install-failing error**. The stripped remainder must be guarded (empty / `.` / `..` → warn-drop). [VERIFIED: name.ts assertions read this session]

**Cross-plugin warning wording:** existing convention is lowercase sentence + ASCII ` -- ` separator + quoted token, e.g. `unknown skill reference "phantom" -- dropped` (convert.ts:274). The new warning must name the token (SC-3); recommended shape (planner pins): `skill reference "other-plugin:some-skill" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)`. [VERIFIED: existing wording; recommendation ASSUMED — Claude's discretion under D-82-09-adjacent polish]

**Dedupe note:** `mapSkills` does NOT dedupe its emit list today (no `dedupePreservingOrder` call — convert.ts:267-277), so `skills: knowledge,knowledge` already emits `acme-knowledge,acme-knowledge`. A source listing both `review-changes` and `spec-tree:review-changes` will emit the generated name twice. Recommendation: do NOT add dedupe in this phase — adding it would change bytes for duplicate-bearing bare-form agents that are outside the fix classes, violating SC-5. pi-subagents dedupes downstream anyway (`normalizeSkillInput` uses `new Set`, skills.ts:587-595 in 0.28.0), so the child is unaffected. [VERIFIED: both codebases]

### Pattern 3: Skill-drop warning in mapTools (AGSK-03, D-82-08/09)

**What:** In the mapTools drop loop (convert.ts:170-177), when the dropped token is exactly `Skill` (case-sensitive, matching TOOL_MAP's exact-match convention), push the D-82-09 warning into mapTools' `warnings` array. All other dropped tools stay silent (D-82-08).

**Placement rationale:** mapTools already owns a warnings array (the omitted-`tools:` default warning, convert.ts:161-164) that convertAgent splices into the aggregate at position 3 (convert.ts:341). Pushing the Skill warning inside mapTools keeps the aggregate warnings order deterministic: description-fallback → model → tools (omitted-default first if present, then Skill-drop) → thinking → skills. Warnings order is provenance-visible bytes — pin it with the canonical fixture test. [VERIFIED: convertAgent warnings assembly, convert.ts:319-361]

**Wording:** D-82-09's string is already ASCII-safe (uses ` -- `, no unicode) and can be committed verbatim in source and tests:

```
dropped tool "Skill" -- generated agents run with skills discovery disabled (inheritSkills: false); only the skills listed in skills: are preloaded into the child's context
```

Interaction notes: (a) when the source omits `tools:` entirely, the default is `Read,Bash,Edit` — no Skill, no warning; (b) `Skill` in `disallowedTools` only: disallowed tokens that aren't in TOOL_MAP are ignored (convert.ts:181-189) and `Skill` never reaches `dropped`, so no warning — correct for this phase (Phase 83 owns disallowedTools/Skill semantics). [VERIFIED: mapTools read this session]

### Pattern 4: Legend detection + rendering (AGSK-04, D-82-04..07)

**Detection (convert.ts, new helper):** Scan the SUBSTITUTED body (step 7 output — that is what gets emitted; skill tokens contain no `${...}` vars so pre/post substitution is equivalent, but scanning the emitted text is the honest contract). For each match of `<pluginName>:<candidate>`:
1. compute `generatedSkillName(pluginName, candidate)` (guarded — see pitfalls),
2. keep the entry ONLY if the generated name is in `knownSkills` (D-82-06),
3. annotate "(preloaded)" iff the generated name is in the emitted `skills:` list,
4. dedupe by token, first-occurrence order (deterministic).

Regex shape (planner refines): candidate class `[A-Za-z0-9_-]+` with a negative lookbehind so `other-spec-tree:foo` does not false-positive as `spec-tree:foo`:

```typescript
const re = new RegExp(`(?<![A-Za-z0-9_:-])${escapeRegExp(pluginName)}:([A-Za-z0-9_-]+)`, "g");
```

Node 26 / 24 / 20.19 all support lookbehind. `escapeRegExp` matters: plugin names may contain regex metacharacters only in theory (assertSafeName allows `.`), but escaping is one line and eliminates the class of bug. The candidate class excludes `.` so a sentence-final period (`...use spec-tree:review-changes.`) does not poison the candidate and cause a false NEGATIVE against knownSkills; skill dirs with dots in their names would be missed by the legend — acceptable, document in the helper comment. [VERIFIED: lookbehind supported since Node 8.3/V8 6.2; ASSUMED: no real-world skill names contain dots — official marketplace scan in D-82-02 found none]

**Rendering (frontmatter.ts::emitGeneratedAgentFile):** Extend the emit input with an optional legend field (e.g. `legend?: readonly { token: string; generatedName: string; preloaded: boolean }[]`). When absent or empty, the assembly at frontmatter.ts:233 must produce today's exact bytes (`generatedFrontmatter + "\n" + provenanceComment + bodyFinal`). When non-empty, insert the legend block between `provenanceComment` and the body's leading blank line (D-82-04), heading exactly `## Pi coding agent skill legend` (D-82-05, locked). Keep the rendering in frontmatter.ts so every byte-layout decision stays in the one module (module contract, frontmatter.ts:8-12).

**Exact legend strings — a locked-decision conflict the planner must resolve (flagged, with recommendation):**
- D-82-05's accepted shape annotates the not-preloaded case as `— not available in this session` (em-dash), and uses `→` (U+2192) in the mapping line.
- AGSK-04 and ROADMAP SC-4 both specify the parenthesized form `"(not available in this session)"`.
- The repo's `fix-unicode-dashes` pre-commit hook REWRITES em-dash (U+2014) to `--` in every file outside `.planning/` and `.claude/` [VERIFIED: `.pre-commit-config.yaml` + texthooks docs — U+2014 is in the double-hyphen replacement set]. A literal `—` in a `.ts` string or test expectation cannot survive commit. `→` (U+2192) is touched by NO hook [CITED: github.com/sirosen/texthooks].

**Recommendation (within Claude's-discretion polish):** use the parenthesized annotations `(preloaded in your context)` / `(not available in this session)` — this satisfies the literal AGSK-04/SC-4 wording AND is pure ASCII; keep the `→` mapping arrow per D-82-05 but write it as the `→` escape in source/test literals (real arrow in output bytes; source stays ASCII — also avoids the known macOS BSD-grep binary-detection problem with glyph-bearing TS files). If the planner prefers the em-dash form for the not-available line, it MUST be written as `—` escape — never a literal.

### Recommended Project Structure (files touched)

```
extensions/pi-claude-marketplace/bridges/agents/
├── frontmatter.ts     # parseFrontmatter (dash folding) + emitGeneratedAgentFile (legend)
├── convert.ts         # mapSkills (qualifier), mapTools (Skill warning), convertAgent (legend wiring)
└── (discover.ts, stage.ts, types.ts, domain/name.ts unchanged)

tests/bridges/agents/
├── frontmatter.test.ts        # extend: dash-folding + legend-rendering + byte-layout tests
├── convert.test.ts            # extend: qualifier mapping, Skill warning, legend detection, issue #86 canonical
└── (new) byte-identity regression test — pins full fileContent for unchanged classes

tests/bridges/_fixtures/       # optional new fixture agent .md (mdformat/markdownlint EXCLUDE this dir)
```

### Anti-Patterns to Avoid

- **Adding a YAML dependency:** rejected by locked D-82-02. The lenient parser IS the contract (AG-6).
- **Rewriting skill tokens inline in the body:** REQUIREMENTS.md out-of-scope — legend is aggregated at top, advisory-only (D-82-07 makes code-block matches safe precisely because nothing is rewritten).
- **Emitting block-list `skills:` in generated frontmatter:** out-of-scope — pi-subagents 0.28.0 comma-splits only (verified: `frontmatter.ts` key regex `^([\w-]+):\s*(.*)$` never matches a `- item` line; `agents.ts:654-658` splits the scalar on commas).
- **Warning on every dropped tool:** violates D-82-08 and breaks byte-identity for e.g. `WebFetch`-dropping agents.
- **Adding dedupe to mapSkills emit:** changes bytes for duplicate-bearing bare-form agents outside the fix classes (see Pattern 2 dedupe note).
- **`git commit` from the phase executor:** orchestrator commits (task constraint); also worktree commits need `SKIP=trufflehog` per project CLAUDE.md when they do happen.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV/inline-array/quote normalization of folded values | A second tokenizer in the parser | Existing `splitCsv` (convert.ts:79-108) — fold to comma-joined string upstream | splitCsv already strips brackets + per-item quotes and filters empties; two tokenizers would drift [VERIFIED: codebase] |
| Bare/qualified name agreement | A parallel qualified-name mapper | Strip qualifier, delegate to `generatedSkillName` (name.ts:64-77) | Prefix elision already makes both spellings converge; a second implementation is the recurring-bug surface the name.ts header explicitly warns about [VERIFIED: codebase] |
| Legend byte layout | Assembling legend bytes in convert.ts | `emitGeneratedAgentFile` extension | Frontmatter.ts is the declared single seam for generated-file byte decisions (frontmatter.ts:8-12) [VERIFIED: codebase] |
| Fence-aware body scanning | Markdown/fence parser for D-82-07 | Whole-body regex scan | D-82-07 locks whole-body scanning specifically to avoid fence-parsing edge cases |

**Key insight:** every capability this phase needs except dash-folding and token detection already exists as a tested unit; the plan should be dominated by wiring + exact-string pinning, not new machinery.

## Common Pitfalls

### Pitfall 1: Warnings-array ordering is provenance-visible bytes
**What goes wrong:** The provenance comment renders `warnings:` as a comma-joined list (frontmatter.ts:221, 236-238). Inserting the Skill warning or skills warnings at a different aggregate position than expected changes output bytes and breaks exact-match tests.
**Why it happens:** convertAgent builds warnings strictly in step order: description (l.325) → model (l.335) → tools (l.341) → thinking (l.354) → skills (l.360).
**How to avoid:** Push the Skill warning inside mapTools (keeps it in the tools slot); pin the full provenance `warnings:` line for the canonical fixture with an exact-equality assertion.
**Warning signs:** A test matching `warnings:.*Skill` passes while a full-file byte assertion fails.

### Pitfall 2: `assertSafeName` throws where the contract requires warn-and-drop
**What goes wrong:** Qualifier stripping (`"spec-tree:"` → `""`) or body-scan candidates (`"."`) reach `generatedSkillName`, which throws (name.ts:32-38), turning a warn-drop into a failed conversion — a new failure mode for inputs that today convert successfully.
**Why it happens:** Today the full colon-bearing token goes through `assertSafeName` intact (colons are legal) and merely fails the knownSkills lookup; stripped remainders lose that accidental safety.
**How to avoid:** Guard stripped remainders (empty, `.`, `..`) before delegation in mapSkills; in the legend scanner either constrain the regex candidate class so invalid names cannot match, or wrap the call in try/catch → skip. Pin both with tests (`skills: spec-tree:` must warn-drop, not throw).
**Warning signs:** New tests pass but an existing AG-11/AG-6 tolerance test starts throwing.

### Pitfall 3: Unicode hooks silently rewrite legend literals
**What goes wrong:** A literal `—` (U+2014) in convert.ts/frontmatter.ts or a test expectation is rewritten to `--` by `fix-unicode-dashes` on commit; the committed code no longer matches the runtime string the tests pinned pre-commit, or the pre-commit run fails and confuses the commit loop.
**Why it happens:** texthooks fix-hooks apply to all files except `.planning/` (config `exclude`) and `.claude/` (global exclude) [VERIFIED: .pre-commit-config.yaml]; U+2014 is in fix-unicode-dashes' replacement set [CITED: github.com/sirosen/texthooks].
**How to avoid:** ASCII-only string literals; where the accepted shape requires unicode output (`→`), use `→` escapes. Never a literal em-dash outside `.planning/`.
**Warning signs:** `pre-commit run` reports "files were modified by this hook" on fix-unicode-dashes.

### Pitfall 4: Glyph-bearing TS files break BSD grep audits
**What goes wrong:** macOS `grep` silently treats files containing certain non-ASCII glyphs as binary and skips them, so later verification sweeps miss the legend code (known project incident with ◉/⊖ files).
**How to avoid:** Prefer `→` escapes over literal arrows in source (same fix as Pitfall 3); use `grep -a` or Node-based search in any verification step that must scan generated output containing real glyphs.

### Pitfall 5: Regression corpus captured AFTER the change proves nothing
**What goes wrong:** Writing the byte-identity test alongside the implementation pins the NEW bytes, not today's bytes — SC-5 is then unverified.
**How to avoid:** Task ordering — the byte-identity test (full `fileContent` expected constants for CSV-form, inline-array-form, empty-skills, extra-fields, missing-tools-default, disallowedTools, CRLF agents) must be written and green against unmodified HEAD first, then survive every subsequent task untouched. Generating the expected constants via a scratch script against HEAD is legitimate; committing the script is not required.
**Warning signs:** A plan wave that edits `parseFrontmatter` and creates the regression test in the same task.

### Pitfall 6: Legend/emit seam accidentally perturbs the no-legend byte layout
**What goes wrong:** Refactoring `emitGeneratedAgentFile`'s tail (frontmatter.ts:226-233) to insert the legend changes the blank-line discipline (`provenanceComment` + `\n`-leading body) even when no legend is emitted.
**How to avoid:** Make the legend parameter optional with `undefined`/empty meaning "assemble exactly as today"; assert byte-equality of a no-legend emit against a pre-change captured constant.
**Warning signs:** stage.test.ts round-trip tests still pass (they use `includes(...)`) while the new exact-byte test fails — `includes`-based tests will NOT catch separator drift.

### Pitfall 7: False-positive/negative token boundaries in body scan
**What goes wrong:** Without a lookbehind, `other-spec-tree:foo` in prose produces a `spec-tree:foo` legend candidate (false positive if `foo` happens to be a known skill); with a `.`-inclusive candidate class, `spec-tree:review-changes.` (sentence-final period) fails the knownSkills check (false negative — token silently gets no legend entry).
**How to avoid:** `(?<![A-Za-z0-9_:-])` lookbehind; candidate class without `.`; pin both edges with tests.
**Warning signs:** Legend entries appearing for tokens the plugin does not own, or prose-referenced known skills missing from the legend.

### Pitfall 8: Fixture files fight the generic pre-commit fixers
**What goes wrong:** New `.md` fixture agents under `tests/bridges/_fixtures/` are exempt from mdformat/markdownlint [VERIFIED: excludes in .pre-commit-config.yaml] but NOT from `trailing-whitespace` and `end-of-file-fixer` — a fixture relying on trailing spaces or a missing final newline gets rewritten on commit, changing its sourceHash and any byte assertions derived from it.
**How to avoid:** Design fixtures to be hook-stable (no trailing whitespace, exactly one final newline), or build canonical inputs as string literals inside tests (convert.test.ts's `makeDiscovered` pattern already does this and avoids fixture files entirely for parser-level tests).

## Code Examples

### Issue #86 canonical fixture — expected end state (SC-1, SC-2)

```typescript
// Source: ROADMAP SC-1/SC-2 + verified current-code behavior; test shape follows
// tests/bridges/agents/convert.test.ts::makeDiscovered convention
const out = convertAgent({
  pluginName: "spec-tree",
  pluginRoot: "/root",
  pluginDataDir: "/data",
  knownSkills: ["spec-tree-review-changes"],
  discovered: makeDiscovered({
    // After AGSK-01 lands, parseFrontmatter produces:
    raw: { tools: "Bash, Read, Skill", skills: "spec-tree:review-changes" },
    body: "Invoke spec-tree:review-changes on the diff.",
  }),
  sourceHash: "abc",
  mapModel: false,
});
// Frontmatter: `tools: bash,read` and `skills: spec-tree-review-changes`
// Provenance:  `droppedTools: Skill`, droppedFields: (none),
//              warnings contains the D-82-09 string
// Body:        legend maps `spec-tree:review-changes` -> spec-tree-review-changes (preloaded)
```

Note the tools result: `Bash, Read` maps in source order to `bash,read` (splitCsv preserves order, TOOL_MAP lookup, convert.ts:168-177) — matching SC-1's `tools: bash,read` exactly. [VERIFIED: mapping logic read this session]

### Parser test cases the plan must pin (AGSK-01 + D-82-03)

```typescript
// 1. Block list folds (colon-bearing items intact):
//    "skills:\n  - spec-tree:review-changes\n" -> raw.skills === "spec-tree:review-changes"
// 2. Multi-item fold comma-joins: "tools:\n  - Read\n  - Bash\n" -> raw.tools === "Read,Bash"
// 3. Unsupported list key -> ONE clean droppedFields name, no "- token" fragments
// 4. Mixed form (D-82-03, discretion: inline wins): "tools: Read\n- Edit\n" -> raw.tools === "Read"
// 5. Orphan dash items (no preceding key) are ignored
// 6. Existing forms untouched: CSV, inline-array, empty-value key with no items, CRLF
```

### Current-behavior invariants that must NOT change (regression corpus classes)

```typescript
// Each pins the ENTIRE fileContent as an exact string, captured from HEAD:
// - CSV tools + bare CSV skills (known + unknown mix)
// - inline-array tools (["Read", "Bash"])
// - extra frontmatter keys -> droppedFields
// - missing tools: -> default read,bash,edit + its existing warning
// - disallowedTools filtering
// - description fallback
// - CRLF source
// None of these contains: dash lists, qualified skill refs, `Skill` in tools, body tokens.
```

## State of the Art

| Old approach (V1 today) | Current approach (post-phase) | Where | Impact |
|--------------------------|------------------------------|-------|--------|
| Dash lines colon-split into bogus keys | Dash items fold into preceding empty-value key | parseFrontmatter | Documented Claude block-list form works (AGSK-01) |
| Qualified `<plugin>:<skill>` never matches knownSkills | Same-plugin qualifier strips; cross-plugin warns-and-drops | mapSkills | Issue #86 preload lands in `skills:` (AGSK-02) |
| `Skill` drop is silent (droppedTools only) | D-82-09 warning accompanies the drop | mapTools | Child-context opacity explained (AGSK-03) |
| Child LLM told nothing about body skill tokens | Reference-gated legend after provenance comment | emitGeneratedAgentFile | Child knows what is/is not in context (AGSK-04) |

**Relevant external versions (informational, not load-bearing):** issue reporter ran pi-subagents 0.34.0; the compat floor is 0.28.x and the locally installed copy IS 0.28.0 — the CSV-only `skills:` split and `--no-skills` spawn behavior were verified against the floor version itself, which is stronger evidence than the CONTEXT.md citations (which referenced line numbers that match approximately). CONTEXT.md's upstream claim that 0.35.x also accepts block lists was not re-verified (irrelevant — we emit CSV). [VERIFIED: local 0.28.0; ASSUMED: 0.35.x block-list acceptance]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No real-world skill/tool names contain commas (fold-to-CSV is lossless in practice) | Pattern 1 | A comma-bearing item would split into two tokens and warn-drop; documented limitation, matches D-82-02's 27-agent scan finding zero exotic forms |
| A2 | No real-world skill names contain dots (legend candidate class excludes `.`) | Pattern 4 | Dot-bearing skill tokens get no legend entry (false negative, advisory-only feature — degraded, not broken) |
| A3 | Recommended cross-plugin warning wording (exact string is planner's/discretion) | Pattern 2 | None — any wording naming the token satisfies AGSK-02/SC-3 |
| A4 | pi-subagents 0.35.x accepts block-list `skills:` (upstream claim from CONTEXT.md, not re-verified) | State of the Art | None for this phase — CSV emission is the locked floor contract |
| A5 | The parenthesized "(not available in this session)" form is the right resolution of the D-82-05 em-dash vs AGSK-04 parenthesized-wording conflict | Pattern 4 | If user insists on em-dash shape, use `—` escapes — both paths documented |

## Open Questions (RESOLVED)

All three questions below were resolved during planning — 82-04-PLAN.md's objective encodes them under "Resolved discretion choices — encode exactly, do not revisit."

1. **Exact legend line format for the not-preloaded case** (D-82-05 accepted shape vs AGSK-04 literal wording — see Pattern 4).
   - What we know: heading and overall shape are locked; annotation strings conflict between two locked sources; em-dash literal cannot be committed in `.ts` files.
   - Recommendation: planner picks the parenthesized ASCII form (satisfies AGSK-04/SC-4 verbatim) with `→` arrow, documents the choice in the plan, pins it with a user-contract test. Does not need user input — it is inside the declared discretion area.
   - RESOLVED: 82-04-PLAN.md locks the parenthesized ASCII forms "(preloaded in your context)" / "(not available in this session)" with the arrow escaped as `→` in source literals.

2. **Should the legend's not-available line still show the Pi-name mapping?** D-82-05's example omits the arrow for the not-available skill; AGSK-04 says the note maps "each referenced Claude skill name to its Pi skill name."
   - Recommendation: include the mapping on both line kinds (AGSK-04 is the requirement; D-82-05's example is "accepted shape", phrasing beyond it is discretion). Pin whichever is chosen.
   - RESOLVED: 82-04-PLAN.md renders the mapping on both line kinds, per AGSK-04.

3. **Legend entry ordering** (first-occurrence vs sorted): either is deterministic; recommend first-occurrence in body order. Planner decides and pins.
   - RESOLVED: 82-04-PLAN.md pins first-occurrence body order.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, typecheck | ✓ | v26.5.0 (local); CI 24 | — |
| npm | `npm run check` | ✓ | 11.17.0 | — |
| pre-commit | commit gate | ✓ | 4.5.1 | — |
| pi-subagents source (floor behavior evidence) | verification only | ✓ | 0.28.0 at `~/.pi/agent/npm/node_modules/pi-subagents/` | not needed at build/test time |

**Missing dependencies:** none. The phase is pure code/tests; no network, no new installs (NFR-5 untouched).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in), native TS strip (Node 26 local / 24 CI) |
| Config file | none (glob in package.json `test` script; `tests/bridges/**` already included) |
| Quick run command | `node --test "tests/bridges/agents/*.test.ts"` |
| Full suite command | `npm test` (unit) / `npm run check` (typecheck + lint + format + unit + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGSK-01 | Dash-list folding; clean droppedFields; CSV/inline-array unchanged | unit | `node --test tests/bridges/agents/frontmatter.test.ts` | ✅ extend existing |
| AGSK-01/SC-5 | Byte-identical regression corpus (full fileContent pins captured at HEAD) | unit | `node --test tests/bridges/agents/<new-regression-file>.test.ts` | ❌ Wave 0 |
| AGSK-02 | Same-plugin qualifier maps; cross-plugin warns-and-drops naming token; bare names unchanged; `plugin:` empty-rest warn-drops (no throw) | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ extend existing |
| AGSK-03 | D-82-09 warning fires iff `Skill` dropped; other drops silent; warning position pinned in provenance bytes | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ extend existing |
| AGSK-04 | Legend detection (boundaries, dedupe, known-only), rendering, placement, reference-gated byte-identity | unit | `node --test tests/bridges/agents/frontmatter.test.ts` + convert.test.ts | ✅ extend existing |
| SC-1..4 | Issue #86 canonical fixture end-to-end through convertAgent (exact fileContent) | unit | `node --test tests/bridges/agents/convert.test.ts` | ✅ extend existing |
| all | Staged-file round-trip still healthy (stage/commit path) | unit (fs-backed) | `node --test tests/bridges/agents/stage.test.ts` | ✅ exists (content checks are `includes`-based — byte pins live in the new regression file, see Pitfall 6) |

Manual-only: none — every success criterion is assertable on `convertAgent(...).fileContent` strings.

### Sampling Rate
- **Per task commit:** `node --test "tests/bridges/agents/*.test.ts"` (sub-second)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green (NFR-6) before `/gsd-verify-work`; `pre-commit run --files <changed>` clean before any commit (orchestrator commits; from a worktree, `SKIP=trufflehog` applies per project CLAUDE.md)

### Wave 0 Gaps
- [ ] New byte-identity regression test file under `tests/bridges/agents/` — full-fileContent expected constants for the seven "unchanged" input classes, captured against unmodified HEAD **before** any implementation task (Pitfall 5)
- [ ] (optional) canonical issue-#86 fixture agent `.md` under `tests/bridges/_fixtures/` if the stage-level path is exercised — hook-stable formatting required (Pitfall 8); pure-convertAgent tests can use inline `makeDiscovered` instead and need no fixture

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Existing `assertSafeName` (name.ts) + allowlist maps (TOOL_MAP/SUPPORTED_SOURCE_FIELDS); new code must preserve warn-drop (never throw, never emit unvalidated names into frontmatter) |
| V6 Cryptography | no (sha256 source hashing exists, unchanged) | node:crypto |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious plugin frontmatter/body breaks out of the provenance HTML comment via `-->` in a crafted skill token that lands in a warning | Tampering | Already mitigated: all provenance list fields (including `warnings:`) pass through `sanitizeProvenance` via `formatOptionalProvenanceList` (frontmatter.ts:236-238) — new warnings inherit this; verify with a `-->`-bearing token test [VERIFIED: codebase] |
| Legend injection: crafted body token puts markdown/HTML into the legend block | Tampering | Legend tokens only render when they match the constrained regex class AND resolve to a knownSkills entry — arbitrary strings cannot reach the legend; the token char class excludes backticks, brackets, and HTML metacharacters |
| ReDoS via body scan on attacker-controlled bodies | DoS | Regex is a single linear char-class with no nested quantifiers; `escapeRegExp` the plugin name so metacharacters cannot create pathological patterns |
| Throw-based DoS of install via crafted `skills:` tokens (`plugin:`, `plugin:.`) | DoS | Guard stripped remainders before `generatedSkillName` (Pitfall 2) |

## Project Constraints (from CLAUDE.md)

Directives from the project CLAUDE.md that bind this phase's plans:

- **Quality bar:** `npm run check` stays green (NFR-6) — typecheck + ESLint + Prettier + tests.
- **Comment policy** (`.claude/rules/typescript-comments.md`, present in worktree): anchor comments/test titles with `AGSK-NN`, `D-82-NN`, `#86` — never `Phase 82` / plan / wave / task references.
- **Output channel (IL-2):** no `process.stdout/stderr` in bridge code — this phase adds warnings via the existing provenance/warnings plumbing only; no notify changes needed.
- **No new deps:** no telemetry (IL-4), no i18n (IL-1), nothing added to package.json.
- **Git:** never commit to main; work stays on `features/issue-86-agent-skill-preloads` in this worktree; conventional commits, ASCII commit messages (fix-unicode-dashes runs on COMMIT_EDITMSG); `pre-commit run --files <changed>` before commit; `SKIP=trufflehog` prefix for worktree commits; no rebase/history rewrite; orchestrator performs the commits for this phase.
- **GSD workflow enforcement:** implementation happens via `/gsd-execute-phase`, not ad-hoc edits.
- **Atomicity (NFR-1) / containment (NFR-10):** untouched — this phase changes generated-content bytes, not file-operation mechanics; the staging/rename pipeline is out of scope.
- **Versioning note:** milestone targets npm 0.10.0 (REQUIREMENTS.md header); with concurrent-milestone policy, feature branches record CHANGELOG under `[Unreleased]` and do not bump versions mid-flight (accumulated project memory) — planner should defer version bumps to the release step.

## Sources

### Primary (HIGH confidence)
- Worktree source, read this session: `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` (parser 76-117, emitter 174-234), `convert.ts` (SUPPORTED_SOURCE_FIELDS 28-37, TOOL_MAP 53-61, splitCsv 79-108, mapTools 148-205, mapSkills 256-279, convertAgent 291-416), `domain/name.ts` (assertSafeName 23-51, generatedSkillName 64-77), `discover.ts`, `types.ts`, `stage.ts` (97-144), `orchestrators/plugin/install.ts:947`, `reinstall.ts:1526`
- Live reproduction: `parseFrontmatter` executed on the issue #86 canonical frontmatter (Node 26.5.0) — output captured verbatim above
- GitHub issue #86 (via `gh issue view 86`): canonical repro, observed `droppedFields: - spec-tree`, reporter environment
- Locally installed pi-subagents **0.28.0** (`~/.pi/agent/npm/node_modules/pi-subagents/`): `agents/frontmatter.ts` (key regex, quote stripping), `agents/agents.ts:654-658` (skills CSV split), `runs/shared/pi-args.ts` (`--no-skills` when `!inheritSkills`), `agents/skills.ts:579-595` (`buildSkillInjection` full-content injection; `normalizeSkillInput` Set-dedupe)
- Repo tooling: `.pre-commit-config.yaml` (hook set + excludes), `package.json` (scripts, engines, version 0.9.0), `.github/workflows/ci.yml` (Node 24), existing tests `tests/bridges/agents/{convert,frontmatter,stage}.test.ts`

### Secondary (MEDIUM confidence)
- texthooks documentation (github.com/sirosen/texthooks, fetched this session): fix-unicode-dashes replaces U+2014 with `--`; U+2192 untouched by all hooks

### Tertiary (LOW confidence)
- CONTEXT.md's claim that pi-subagents 0.35.x accepts block-list `skills:` — not re-verified, not load-bearing (A4)

## Metadata

**Confidence breakdown:**
- Bug mechanism + fix seams: HIGH — reproduced live; all seams read at line level
- pi-subagents floor behavior: HIGH — verified against the installed floor version itself
- Byte-identity class analysis: HIGH — derived from read code paths, but the regression corpus (Wave 0) is the actual proof
- Legend exact strings: MEDIUM — discretion area with a documented locked-decision conflict and recommendation (Open Question 1)

**Research date:** 2026-07-19
**Valid until:** 2026-08-18 (stable in-repo domain; re-verify only the pi-subagents floor claim if the compat floor is renegotiated)
