# Phase 82: Agent Skill Preload Fidelity - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 6 (4 modified, 1 created, 1 optional)
**Analogs found:** 5 / 6 (the byte-identity regression corpus and `escapeRegExp` have partial analogs only)

All paths below are relative to the worktree root
`/Users/acolomba/src/pi-claude-marketplace/.worktrees/issue-86-agent-skill-preloads/`.
Line numbers refer to current HEAD of `features/issue-86-agent-skill-preloads`.

This phase extends existing modules rather than creating parallel ones, so most
"analogs" are established patterns inside the very files being modified
(self-analogs, exact match). The planner should treat the excerpts below as
the style/shape contract for the new code.

## File Classification

| New/Modified File | Change | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | modify (dash-folding in `parseFrontmatter`; legend rendering in `emitGeneratedAgentFile`) | utility (pure parser + emitter) | transform | self: existing line loop (96-114) + emitter optional-field pattern (189-202) | exact |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | modify (`mapSkills` qualifier handling; `mapTools` Skill warning; `convertAgent` legend wiring; new `detectSkillTokens` + `escapeRegExp` helpers) | service (pure mapping pipeline) | transform | self: `mapSkills` (256-279), `mapTools` (148-205), private-helper style (`splitCsv` 79-108) | exact |
| `tests/bridges/agents/frontmatter.test.ts` | modify (extend: dash-folding, legend rendering, byte-layout) | test | — | self: existing AG-6/AG-8 test shapes | exact |
| `tests/bridges/agents/convert.test.ts` | modify (extend: qualifier mapping, Skill warning, legend detection, issue #86 canonical) | test | — | self: `makeDiscovered` convention + warning assertions | exact |
| `tests/bridges/agents/` new byte-identity regression test file | create (Wave 0, captured against unmodified HEAD) | test | — | `convert.test.ts` `makeDiscovered` + `marker.test.ts` byte-for-byte `assert.equal` | role-match |
| `tests/bridges/_fixtures/` new agent fixture `.md` | create (OPTIONAL — recommend avoiding, see below) | fixture | — | `tests/bridges/_fixtures/test-plugin/` | role-match |

Read-only (consumed, never modified): `extensions/pi-claude-marketplace/domain/name.ts`
(`generatedSkillName` 64-77, `assertSafeName` 23-51),
`extensions/pi-claude-marketplace/shared/vars.ts`,
`bridges/agents/{discover,stage,types,marker}.ts`.

## Pattern Assignments

### `bridges/agents/frontmatter.ts` (utility, transform)

**Analog:** itself — the module owns both sides of the frontmatter format and
declares that contract in its header.

**Module contract the changes must respect** (lines 8-18):

```typescript
// On the OUTPUT side, this module is the only place in the extension that
// decides how generated agent files are assembled: which scalars get
// quote-flipped, which strings get HTML-comment-escaped, and what the
// deterministic field order looks like. convertAgent does the field
// mapping but delegates the final byte assembly here.
//
// On the INPUT side, parseFrontmatter mirrors pi-subagents' own line-based
// key:value parser ... The parser is deliberately naive (no nested
// YAML, no list-of-dash arrays) -- pi-subagents is what we round-trip
// through, not real YAML.
```

Note: the header's "no list-of-dash arrays" sentence and the `parseFrontmatter`
doc comment (lines 71-75, "No nested YAML, no list-of-dash arrays") become
stale after AGSK-01 — the plan must update both comments to describe
dash-folding and the D-82-03 mixed-form choice (D-82-03 requires the choice be
"documented in the parser comment").

**Core pattern to extend — the parse loop** (lines 95-114). Dash-folding
(AGSK-01, D-82-01) hooks in BEFORE the colon split so dash lines never reach
`line.indexOf(":")`:

```typescript
  const raw: Record<string, string> = {};
  for (const rawLine of fmText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }

    const colon = line.indexOf(":");
    if (colon === -1) {
      continue;
    }

    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key === "") {
      continue;
    }

    raw[key] = value;
  }
```

RESEARCH.md Pattern 1 gives the fold sketch (`lastKey` / `lastKeyFoldable`
tracking, comma-join into `raw[lastKey]`, `continue` before the colon path).
Fold to a comma-joined string — `splitCsv` downstream needs no change.

**Optional-field emission pattern** (lines 189-202) — the legend block must
follow the same conditional-emission discipline (absent/empty legend ⇒ zero
byte change):

```typescript
  if (frontmatter.model !== undefined) {
    lines.push(`model: ${frontmatter.model}`);
  }
  ...
  if (frontmatter.skills.length > 0) {
    lines.push(`skills: ${frontmatter.skills.join(",")}`);
  }
```

**Assembly tail — the exact bytes the legend inserts into** (lines 226-233).
The legend goes between `provenanceComment` and `bodyFinal` (D-82-04). When no
legend, this expression must remain byte-for-byte what it is today:

```typescript
  // Body: ensure exactly one leading blank line and a trailing newline so
  // the generated file has deterministic separators around the comment.
  const bodyWithLeadingBlank = body.startsWith("\n") ? body : "\n" + body;
  const bodyFinal = bodyWithLeadingBlank.endsWith("\n")
    ? bodyWithLeadingBlank
    : bodyWithLeadingBlank + "\n";

  return generatedFrontmatter + "\n" + provenanceComment + bodyFinal;
```

**Interface extension pattern** — follow the existing readonly/optional style
of `GeneratedFrontmatterFields` (lines 133-140):

```typescript
export interface GeneratedFrontmatterFields {
  readonly name: string;
  readonly description: string;
  readonly model?: string;
  readonly tools: readonly string[];
  ...
}
```

The legend input should be a new optional field on `emitGeneratedAgentFile`'s
input object, e.g.
`legend?: readonly { token: string; generatedName: string; preloaded: boolean }[]`,
with `undefined`/empty meaning "assemble exactly as today" (RESEARCH Pitfall 6).

**Provenance sanitization is inherited for free** (lines 236-238) — new
warning strings pass through this automatically; no new escaping code needed:

```typescript
function formatOptionalProvenanceList(values: readonly string[]): string {
  return values.length === 0 ? "(none)" : sanitizeProvenance(values.join(", "));
}
```

---

### `bridges/agents/convert.ts` (service, transform)

**Analog:** itself — three surgical edits plus two new private helpers in the
established style.

**Warning-string convention** (the wording contract for the two new warnings):
lowercase sentence, ASCII ` -- ` separator, double-quoted offending token.
Existing instances:

- line 144: `` `unknown model "${raw}" -- omitted from generated frontmatter` ``
- line 274: `` `unknown skill reference "${token}" -- dropped` ``
- lines 161-164 (mapTools, the analog for pushing a warning inside mapTools):

```typescript
          warnings.push(
            "source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.",
          );
```

**AGSK-03 site — the mapTools drop loop** (lines 168-177). The D-82-09 warning
is pushed here (inside `mapTools`, into its `warnings` array) when
`token === "Skill"`, so it lands in the tools slot of the aggregate order:

```typescript
  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const token of tokens) {
    const piName = TOOL_MAP[token];
    if (piName === undefined) {
      dropped.push(token);
    } else {
      mapped.push(piName);
    }
  }
```

D-82-09 exact string (ASCII-safe, commit-safe verbatim):

```
dropped tool "Skill" -- generated agents run with skills discovery disabled (inheritSkills: false); only the skills listed in skills: are preloaded into the child's context
```

**AGSK-02 site — mapSkills** (lines 256-279). Qualifier stripping happens
per-token before the `generatedSkillName` call; cross-plugin qualifiers push a
warning and `continue`:

```typescript
function mapSkills(
  rawSkills: string | undefined,
  pluginName: string,
  knownSkills: readonly string[],
): { emit: string[]; warnings: string[] } {
  const tokens = splitCsv(rawSkills);
  if (tokens.length === 0) {
    return { emit: [], warnings: [] };
  }

  const known = new Set(knownSkills);
  const emit: string[] = [];
  const warnings: string[] = [];
  for (const token of tokens) {
    const generated = generatedSkillName(pluginName, token);
    if (known.has(generated)) {
      emit.push(generated);
    } else {
      warnings.push(`unknown skill reference "${token}" -- dropped`);
    }
  }

  return { emit, warnings };
}
```

CRITICAL guard (RESEARCH Pitfall 2): `generatedSkillName` → `assertSafeName`
THROWS on empty string, `"."`, `".."` (name.ts:32-38). Stripped remainders
(`"spec-tree:"` → `""`) must warn-drop BEFORE delegation, never reach the call.
Do NOT add dedupe to the emit list (byte-identity for duplicate-bearing
bare-form agents; pi-subagents dedupes downstream).

**Delegation target (read-only)** — `domain/name.ts::generatedSkillName`
(lines 64-77); prefix elision already makes bare and qualified forms converge:

```typescript
export function generatedSkillName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  if (source === plugin) {
    return plugin;
  }

  const prefix = `${plugin}-`;
  const elided = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  assertSafeName(elided);
  const generated = `${plugin}-${elided}`;
  assertSafeName(generated);
  return generated;
}
```

**Private-helper style for the new `detectSkillTokens` / `escapeRegExp`** —
module-level non-exported functions with a doc/rationale comment, like
`splitCsv` (lines 79-108) and `dedupePreservingOrder` (lines 110-121). Return
shape should mirror `mapSkills`' `{ emit, warnings }` pattern, e.g.
`{ token, generatedName, preloaded }[]`. Export only if a test needs direct
access; prefer testing through `convertAgent` (all existing mapping helpers
are private and tested via `convertAgent`).

**Warnings aggregation order — provenance-visible bytes** (RESEARCH Pitfall 1).
`convertAgent` builds warnings strictly in step order; the excerpt shows the
slots (lines 319-361, abridged):

```typescript
  const warnings: string[] = [];

  // 1. Description (with fallback)
  ...
    warnings.push("source description was missing or empty -- using fallback");
  ...
  if (modelResult.warning !== undefined) {
    warnings.push(modelResult.warning);          // model slot
  }

  // 3. Tools mapping
  const toolsResult = mapTools(raw.tools, raw.disallowedTools);
  warnings.push(...toolsResult.warnings);        // tools slot <- Skill warning lands here
  ...
  if (thinkingResult.warning !== undefined) {
    warnings.push(thinkingResult.warning);       // thinking slot
  }

  // 5. Skills mapping
  const skillsResult = mapSkills(raw.skills, pluginName, knownSkills);
  warnings.push(...skillsResult.warnings);       // skills slot <- cross-plugin warning lands here
```

**AGSK-04 wiring seam — step 7→8** (lines 371-401). Legend detection runs on
`substitutedBody` (all inputs — `pluginName`, `knownSkills`,
`skillsResult.emit`, body — already in scope); the result is passed as a new
field of the `emitGeneratedAgentFile` input:

```typescript
  const substitutedBody = substituteClaudeVars(body, {
    pluginRoot,
    pluginData: pluginDataDir,
  });

  // 8. Hand off to the frontmatter emitter for final assembly. From here on,
  //    parser-safety (YAML quote-flipping, HTML-comment escaping, field
  //    ordering) lives behind a single seam.
  const fileContent = emitGeneratedAgentFile({
    frontmatter: { ... },
    provenance: { ... },
    body: substitutedBody,
  });
```

**Optional-argument spread pattern** if the legend field needs
present-only-when-non-empty semantics (lines 418-424):

```typescript
function optionalModel(model: string | undefined): { model?: string } {
  return model === undefined ? {} : { model };
}
```

---

### `tests/bridges/agents/convert.test.ts` (test — extend)

**Analog:** itself.

**Fixture builder — `makeDiscovered`** (lines 17-28). All new convertAgent
tests (qualifier mapping, Skill warning, legend, issue #86 canonical) use this;
no fixture files needed:

```typescript
function makeDiscovered(overrides: Partial<DiscoveredAgent> = {}): DiscoveredAgent {
  const sourceName = overrides.sourceName ?? "bot";
  const generatedName = overrides.generatedName ?? `pi-claude-marketplace-acme-${sourceName}`;
  return {
    sourceName,
    generatedName,
    sourcePath: overrides.sourcePath ?? "/abs/path/source.md",
    sourceHash: overrides.sourceHash ?? "abc123",
    raw: overrides.raw ?? {},
    body: overrides.body ?? "Body content.",
  };
}
```

**Test title + warning-assertion shape** (lines 156-167) — titles start with
the requirement ID (`AGSK-01`..`AGSK-04`, `D-82-NN`, `#86` per the comment
policy; NEVER `Phase 82`/plan/wave references — `.claude/rules/typescript-comments.md`):

```typescript
test("AG-7 convertAgent skills field warns when reference is unknown", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { tools: "Read", skills: "phantom" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.ok(out.warnings.some((w) => w.includes('unknown skill reference "phantom"')));
});
```

**Frontmatter-block isolation pattern** (lines 363-365) — for asserting a key
does/does not appear in frontmatter specifically:

```typescript
  const fmEnd = out.fileContent.indexOf("\n---\n", 4);
  const frontmatter = out.fileContent.slice(0, fmEnd);
  assert.doesNotMatch(frontmatter, /^model:/m);
```

**Exact-equality snapshot convention** (lines 265-278) — user-contract strings
(D-82-09 warning, legend lines) get pinned with `assert.deepEqual`/`assert.equal`
against inline literals, not regex `includes`:

```typescript
test("TOOL_MAP snapshot: 7 entries with V1-exact values", () => {
  assert.deepEqual(
    { ...TOOL_MAP },
    {
      Read: "read",
      Bash: "bash",
      ...
    },
  );
});
```

**AG-11 throw-assertion shape** (lines 169-189) — reuse for the "qualifier
stripping must NOT throw" guard tests (`skills: "spec-tree:"` warn-drops):

```typescript
  assert.throws(
    () => convertAgent({ ... }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /mapped tool list is empty/);
      return true;
    },
  );
```

(the new tests invert this: `assert.doesNotThrow` + warning presence).

---

### `tests/bridges/agents/frontmatter.test.ts` (test — extend)

**Analog:** itself.

**Parser test shape** (lines 14-25) — dash-folding tests follow this inline
frontmatter-string pattern:

```typescript
test("AG-6 parseFrontmatter tolerates colon in description value", () => {
  const text =
    "---\n" +
    "name: bot\n" +
    "description: hello: world\n" +
    "tools: Read,Bash\n" +
    "---\n" +
    "\n" +
    "Body.\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.description, "hello: world");
});
```

CRLF coverage analog at lines 47-53 (`"---\r\nname: bot\r\n..."`) — dash
folding needs a CRLF twin.

**Emitter test shape** (lines 85-123) — full `emitGeneratedAgentFile` input
literal + field-order assertion. Legend-rendering tests (legend present,
absent, empty) extend this call shape with the new `legend` field. The
byte-layout regression for the no-legend path uses `assert.equal(out, <exact
constant>)` rather than the existing `indexOf`-ordering loop (Pitfall 6:
`includes`-style tests will not catch separator drift).

---

### `tests/bridges/agents/` — NEW byte-identity regression test file

**Analog (partial):** `convert.test.ts` for the driver convention
(`makeDiscovered` + `convertAgent`), `marker.test.ts` for the exact-equality
assertion style (lines 107-113):

```typescript
test("GENERATED_AGENT_MARKER is byte-for-byte 'generated by pi-claude-marketplace'", () => {
  assert.equal(GENERATED_AGENT_MARKER, "generated by pi-claude-marketplace");
});
```

**No existing test pins an entire `fileContent`** — this file is genuinely new.
Shape: for each of the seven unchanged input classes (CSV tools + bare skills,
inline-array tools, extra fields, missing `tools:` default, disallowedTools,
description fallback, CRLF source), call `convertAgent` with `makeDiscovered`
inputs and `assert.equal(out.fileContent, EXPECTED)` where `EXPECTED` is a
full-file template-literal constant captured from unmodified HEAD (Pitfall 5:
this file must be written and green BEFORE any implementation task).

Naming: follow the directory's `<topic>.test.ts` convention (`convert.test.ts`,
`frontmatter.test.ts`, `stage.test.ts`, `marker.test.ts`, ...) — e.g.
`convert-byte-identity.test.ts`. File location is already in the `npm test`
glob (`tests/bridges/**`).

Imports follow the sibling files' relative-path style:

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { convertAgent } from "../../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";

import type { DiscoveredAgent } from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";
```

---

### `tests/bridges/_fixtures/` — OPTIONAL new fixture agent

**Analog:** `tests/bridges/_fixtures/test-plugin/` (existing plugin-shaped
fixture tree, exempt from mdformat/markdownlint but NOT from
trailing-whitespace / end-of-file-fixer hooks).

**Recommendation: skip it.** Every Phase 82 success criterion is assertable on
`convertAgent(...).fileContent`; `makeDiscovered` inline literals avoid the
hook-stability hazard entirely (Pitfall 8). Only create a fixture if a plan
task explicitly exercises the discover/stage path; if so, it must have no
trailing whitespace and exactly one final newline.

## Shared Patterns

### Warning-string convention
**Source:** `bridges/agents/convert.ts` lines 144, 162-164, 274
**Apply to:** the AGSK-03 Skill warning and the AGSK-02 cross-plugin warning
Lowercase sentence, ASCII ` -- ` separator, double-quoted offending token,
actionable tail where useful. Cross-plugin recommended shape (planner pins the
final string, discretion area):

```
skill reference "other-plugin:some-skill" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)
```

### ASCII-only source literals (pre-commit survival)
**Source:** RESEARCH Pitfalls 3-4; `.pre-commit-config.yaml` (fix-unicode-dashes)
**Apply to:** all legend/warning strings in `.ts` sources and tests
Never a literal em-dash (U+2014) — it is rewritten to `--` on commit. Where
the legend needs the `→` arrow (U+2192, untouched by hooks), write it as the
`→` escape in source/test literals so files stay ASCII and BSD-grep-safe.
Preferred annotations: `(preloaded in your context)` / `(not available in this
session)` — pure ASCII, satisfies AGSK-04/SC-4 verbatim.

### Comment/test-title anchor policy
**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** every new comment and test title
Allowed anchors: `AGSK-01`..`AGSK-04`, `D-82-01`..`D-82-09`, `#86`, `AG-6`,
`AG-8`, `SC-N`. Forbidden: `Phase 82`, `Plan NN`, `Wave N`, `Task N`, bare
`Pitfall N`.

### Guard-before-delegate (never throw where warn-drop is required)
**Source:** `domain/name.ts::assertSafeName` (lines 32-38 throw on empty/`.`/`..`)
**Apply to:** `mapSkills` qualifier stripping AND the legend body-scan helper
Check stripped remainders/regex candidates before calling
`generatedSkillName`; on failure, warn-drop (mapSkills) or skip (legend).
The legend regex candidate class `[A-Za-z0-9_-]+` cannot produce an invalid
name, which is the preferred guard for the scanner.

### Provenance sanitization inheritance
**Source:** `bridges/agents/frontmatter.ts` lines 236-238 (`formatOptionalProvenanceList` → `sanitizeProvenance`)
**Apply to:** both new warnings — nothing to do, but verify with a
`-->`-bearing token test (security table in RESEARCH.md).

### Private module-level helpers, exported surface minimal
**Source:** `bridges/agents/convert.ts` (`splitCsv`, `dedupePreservingOrder`,
`mapModel`, `mapTools`, `mapThinking`, `mapSkills` — all private; only
`convertAgent`, maps, `assertNoAgentCollisions` exported)
**Apply to:** `detectSkillTokens`, `escapeRegExp` — private in convert.ts,
tested through `convertAgent`.

## No Analog Found

| File / Pattern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| `escapeRegExp` helper | utility | transform | No regex-escape utility exists anywhere in `extensions/pi-claude-marketplace` (grep: only literal `replaceAll` string patterns, e.g. `shared/vars.ts:34-35`). Use the standard MDN one-liner (`value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`) as a private helper next to `splitCsv`. |
| Full-`fileContent` exact-equality regression corpus | test | — | No existing test asserts an entire generated file as one constant; closest are `marker.test.ts` byte-for-byte constant assertions and `convert.test.ts` `deepEqual` map snapshots. New pattern, governed by RESEARCH Pitfall 5 (capture against HEAD first). |
| Body token-scan (regex over agent body) | utility | transform | No existing body-scanning code; `substituteClaudeVars` (`shared/vars.ts:32-36`) is the only body transform and is literal-`replaceAll`, not regex. The RESEARCH Pattern 4 lookbehind regex is the reference shape. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/` (bridges/agents,
domain, shared), `tests/bridges/agents/`, `tests/bridges/_fixtures/`,
`.claude/rules/`
**Files scanned:** 9 read in full (frontmatter.ts, convert.ts, name.ts,
vars.ts excerpt, convert.test.ts, frontmatter.test.ts, marker.test.ts excerpt,
typescript-comments.md, fixture dir listing); greps for regex helpers and
exact-equality assertions across the extension and agent tests
**Pattern extraction date:** 2026-07-19
