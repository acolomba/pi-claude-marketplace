# Phase 84: Agent skillPath resolution - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 6
**Analogs found:** 6 / 6 (all analogs are self — this phase edits existing files in place, extending patterns already present in the same modules)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | bridge/transform (emitter) | transform (frontmatter string assembly) | itself — existing conditional-emit block (`skills`) and `renderSkillLegend` in the same file | exact (in-file precedent) |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | bridge/transform (producer) | transform | itself — existing `detectSkillTokens` | exact (in-file precedent) |
| `package.json` | config | N/A | itself — existing `peerDependencies` block | exact (in-file precedent) |
| `tests/bridges/agents/frontmatter.test.ts` | test (unit, byte-identity fixtures) | transform | itself — existing whole-file pin tests (AG-8 family, "makeLegendEmitInput") | exact |
| `tests/bridges/agents/convert.test.ts` | test (unit, byte-identity fixtures) | transform | itself — existing `#86 canonical` whole-file pin | exact |
| new SC-2 resolver-contract test (`tests/integration/skill-path-resolution.test.ts` suggested name) | test (integration, cross-package contract) | request-response (calls external installed package function) | `tests/integration/hooks-spawn-end-to-end.test.ts` | role-match |

## Pattern Assignments

### `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` (bridge/transform)

**Analog:** itself, `emitGeneratedAgentFile`'s existing conditional-emit block

**Core pattern — conditional constant-value emission** (current lines ~270-278, per RESEARCH.md):
```typescript
if (frontmatter.skills.length > 0) {
  lines.push(`skills: ${frontmatter.skills.join(",")}`);
  // ADD: lines.push(`skillPath: ../pi-claude-marketplace/resources/skills`);
}

lines.push(
  "systemPromptMode: replace",
  "inheritProjectContext: true",
  `inheritSkills: ${(frontmatter.inheritSkills ?? false) ? "true" : "false"}`,
);
```
Copy the same `if (frontmatter.skills.length > 0) { lines.push(...) }` shape — do not gate on `legend.length`, do not thread a new field through `GeneratedFrontmatterFields`/`convert.ts`. The value is a hardcoded constant, matching how `systemPromptMode: replace` and `inheritProjectContext: true` are emitted unconditionally a few lines below.

**Legend-collapse pattern** (current lines ~200-204 type decl, ~329-337 renderer):
```typescript
// SkillLegendEntry — delete the `preloaded` field:
export interface SkillLegendEntry {
  readonly token: string;
  readonly generatedName: string;
  // readonly preloaded: boolean;  <-- DELETE
}

// renderSkillLegend — collapse ternary to single literal:
function renderSkillLegend(legend: readonly SkillLegendEntry[] | undefined): string {
  if (legend === undefined || legend.length === 0) {
    return "";
  }
  const entryLines = legend.map((entry) => {
    const annotation = "available on demand"; // was: entry.preloaded ? "preloaded in your context" : "available on demand"
    return `- \`${entry.token}\` → skill \`${entry.generatedName}\` (${annotation})`;
  });
  // ... unchanged tail
}
```

---

### `extensions/pi-claude-marketplace/bridges/agents/convert.ts` (bridge/transform, producer of legend entries)

**Analog:** itself, `detectSkillTokens`

**Core pattern — delete the now-dead `preloaded` computation** (current lines ~140-176, 530):
```typescript
// BEFORE
function detectSkillTokens(
  body: string,
  pluginName: string,
  knownSkills: readonly string[],
  emittedSkills: readonly string[],   // delete param
): SkillLegendEntry[] {
  const known = new Set(knownSkills);
  const emitted = new Set(emittedSkills); // delete
  // ...
  entries.push({ token, generatedName: generated, preloaded: emitted.has(generated) }); // drop preloaded key
  // ...
}
// call site:
const legend = detectSkillTokens(substitutedBody, pluginName, knownSkills, skillsResult.emit); // drop 4th arg

// AFTER
function detectSkillTokens(
  body: string,
  pluginName: string,
  knownSkills: readonly string[],
): SkillLegendEntry[] {
  const known = new Set(knownSkills);
  // ...
  entries.push({ token, generatedName: generated });
  // ...
}
const legend = detectSkillTokens(substitutedBody, pluginName, knownSkills);
```
No `skillPath` field is threaded through this file at all (RESEARCH.md finding 1) — `frontmatter.ts` derives it purely from `frontmatter.skills.length`.

---

### `package.json` (config)

**Analog:** itself, existing `peerDependencies` block

**Current pattern** (top-level, no `peerDependenciesMeta` block exists yet):
```json
"peerDependencies": {
  "@earendil-works/pi-coding-agent": ">=0.74.0",
  "@earendil-works/pi-tui": "*",
  "typebox": "*"
},
```

**Target pattern — add as the first *optional* peer** (per RESEARCH.md D-84-03/A2, pitfall "Adding pi-subagents to dependencies instead of peerDependencies"):
```json
"peerDependencies": {
  "@earendil-works/pi-coding-agent": ">=0.74.0",
  "@earendil-works/pi-tui": "*",
  "pi-subagents": ">=0.35.0",
  "typebox": "*"
},
"peerDependenciesMeta": {
  "pi-subagents": {
    "optional": true
  }
},
```
This is an **addition**, not a bump — `pi-subagents` has zero prior representation in `package.json` (it's a presence-only soft-dep probed via `pi.getAllTools()` in `platform/pi-api.ts`, never imported as code). Do NOT add to `dependencies`/`devDependencies`.

Also update the README Prerequisites bullet (currently unversioned: `- [pi-subagents](...) (optional but recommended, ...)`) to state the `>=0.35.0` floor — RESEARCH.md Open Question 1 recommends including this, low risk either way.

---

### `tests/bridges/agents/frontmatter.test.ts` (unit, byte-identity fixtures)

**Analog:** itself — existing whole-file pin tests

**Pattern — partition by `skills` emptiness before touching a fixture:**
- Fixtures with `skills: []` (AG-8 family at ~line 233, and neighbors at 209/256/278/304) assert **omission** of the `skills:` line — these MUST stay byte-identical, no `skillPath:` added.
- Fixtures with non-empty `skills` (`makeLegendEmitInput()` at ~line 336, whole-file pins at ~389-435 and ~489-537) need:
  1. A new `skillPath: ../pi-claude-marketplace/resources/skills` line inserted immediately after the `skills:` line in the expected output.
  2. Every `preloaded: true`/`preloaded: false` field in the `legend: [...]` input objects removed.
  3. Every `(preloaded in your context)` string in the expected output replaced with `(available on demand)`.

**Exact locations (from RESEARCH.md, already grepped and read this session):**
- `frontmatter.test.ts:389-435` — whole-file pin
- `frontmatter.test.ts:489-537` — second whole-file pin

Grep sweep after editing: `grep -rn "preloaded in your context" tests/ extensions/` must return zero hits.

---

### `tests/bridges/agents/convert.test.ts` (unit, byte-identity fixtures)

**Analog:** itself — existing `#86 canonical` whole-file pin

**Pattern — same partition + sweep, plus a type-alias removal:**
- `convert.test.ts:765` — `LegendAnnotation` type alias declaration becomes dead code or collapses to a single string literal; delete or simplify.
- `convert.test.ts:797-812, 923-937, 959-973` — 3 tests asserting `"preloaded in your context"` via `legendEntryLine(...)` helper — update to `"available on demand"`.
- `convert.test.ts:1058-1118` — the `#86 canonical` whole-file pin: both the substring assertion (1078-1086) and the `canonicalExpected` template literal (1089-1117) need the `skillPath:` line inserted and the annotation collapsed.
- `convert.test.ts:1120-1140ish` — the token-free-body companion test (RESEARCH.md Open Question 2): read the full body before editing; it likely needs no change (asserts via substring match on `skills:`, unaffected by `skillPath`), but confirm no assertion assumes `skillPath:` is absent.

---

### New SC-2 resolver-contract test (integration)

**Analog:** `tests/integration/hooks-spawn-end-to-end.test.ts`

**Why this analog:** Same shape as the needed SC-2 test — spins up a real filesystem fixture (temp scope dir), exercises the production code path end-to-end (not a mocked seam), and asserts an observable side effect. `hooks-spawn-end-to-end.test.ts` uses `mkdtemp`/`writeFile`/real `spawn` rather than injected fakes; SC-2 needs the same "real thing, not reimplemented" posture per RESEARCH.md's "Don't Hand-Roll" table (must call pi-subagents' own `resolveSkillsWithFallback`, never a reimplementation).

**Imports pattern** (from `hooks-spawn-end-to-end.test.ts:16-32`):
```typescript
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
```

**Core pattern — dynamic import + graceful skip** (new — no existing precedent in this repo for an optional-peer-guarded test; RESEARCH.md Wave-0-gap explicitly calls for `test.skip` on dynamic-import failure since `pi-subagents` is never a `dependencies`/`devDependencies` entry):
```typescript
test("SC-2: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback, and it does not enter the global catalog", async (t) => {
  let skillsModule: typeof import("pi-subagents/src/agents/skills.js");
  try {
    skillsModule = await import("pi-subagents/src/agents/skills.js");
  } catch {
    t.skip("pi-subagents not installed in this environment");
    return;
  }
  const { resolveSkillsWithFallback, discoverAvailableSkills } = skillsModule;

  // Arrange: mkdtemp scope root, write <scope>/agents/<name>.md with
  // skillPath, stage a real SKILL.md under
  // <scope>/pi-claude-marketplace/resources/skills/<generatedName>/SKILL.md
  // (mirror locations.ts's skillsTargetDir layout).

  const { resolved } = resolveSkillsWithFallback(
    [generatedName],
    skillCwd,
    runtimeCwd,
    [ "../pi-claude-marketplace/resources/skills" ],
    path.dirname(agentFilePath), // localBaseDir = dirname(agent.filePath), per pi-subagents 0.35.1 execution.ts:1202
  );
  assert.ok(resolved.some((s) => s.name === generatedName));

  const globalCatalog = discoverAvailableSkills(runtimeCwd);
  assert.ok(!globalCatalog.some((s) => s.name === generatedName)); // invocation-private guarantee
});
```
Exact resolution contract verified in RESEARCH.md against installed `pi-subagents@0.35.1` source (`src/agents/skills.ts`, `src/runs/foreground/execution.ts:1197-1203`) — reuse those exact call signatures, do not guess the argument order.

**Cleanup pattern** — match `hooks-spawn-end-to-end.test.ts`'s temp-dir teardown (`rm(tmpDir, { recursive: true, force: true })` in a `finally` or `t.after`).

## Shared Patterns

### Conditional frontmatter field emission
**Source:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`, existing `if (frontmatter.skills.length > 0) { lines.push(...) }` block
**Apply to:** the new `skillPath` line — same file, same gate, no new type field.

### Byte-identity test-fixture partitioning
**Source:** existing AG-8-family tests in `tests/bridges/agents/frontmatter.test.ts`
**Apply to:** both test files — always split fixtures into "empty skills, must stay identical" vs "non-empty skills, must gain the new line" before editing, per RESEARCH.md's explicit pitfall.

### Optional peer dependency declaration
**Source:** `package.json` `peerDependencies` (no prior `peerDependenciesMeta` example in this repo — `pi-subagents` is the first optional peer)
**Apply to:** `package.json` only; mirrors the "optional but recommended" language already used in README/`notify.ts` for the pi-subagents soft dependency.

## No Analog Found

None — every file in scope either has a strong in-file precedent to extend (frontmatter.ts, convert.ts, package.json, the two test files) or a close cross-file role-match analog (`hooks-spawn-end-to-end.test.ts` for the new SC-2 integration test). The one genuinely novel element — dynamic-import-with-skip for an optional-peer-only integration test — has no repo precedent; RESEARCH.md's Wave-0-gap section is the authoritative guidance for that pattern instead of a codebase analog.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/bridges/agents/`, `tests/bridges/agents/`, `tests/integration/`, `package.json`
**Files scanned:** frontmatter.ts, convert.ts, package.json, frontmatter.test.ts, convert.test.ts, hooks-spawn-end-to-end.test.ts (plus RESEARCH.md's own prior reads of installed pi-subagents 0.35.1 source, reused here rather than re-read)
**Pattern extraction date:** 2026-07-19
