# Phase 7: Agent Frontmatter and Grants - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 18
**Analogs found:** 17 / 18

All paths are relative to the worktree `/home/acolomba/src/pi-claude-marketplace-gaps-agents`. `E` = `extensions/pi-claude-marketplace`. Every analog named is git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/shared/frontmatter-repair.ts` (NEW) | utility (pure string) | transform | `E/bridges/skills/frontmatter-degrade.ts` (moved code) + `E/shared/bom.ts` (shared-for-bridges header) | exact (code moves) |
| `test/shared/frontmatter-repair.test.ts` (NEW) | test | transform | `test/bridges/skills/frontmatter-degrade.test.ts`, `test/bridges/skills/frontmatter-scan.test.ts` (cases move) | exact |
| `E/bridges/skills/frontmatter-degrade.ts` (MOD) | utility | transform | itself; import from shared | n/a |
| `E/bridges/skills/frontmatter-scan.ts` (MOD) | utility | transform | keeps `topLevelNodeIndex`, `nodeKeys` | n/a |
| `E/bridges/skills/stage.ts` (MOD) | bridge stage | file-I/O | itself (`extractBodyAfterFrontmatter` moves out) | n/a |
| `E/bridges/agents/frontmatter.ts` (MOD: new YAML reader + `|-` emitter + `GeneratedToolsFields`) | utility (reader/emitter) | transform | `E/bridges/skills/stage.ts:232-256` `parseSkillSource` | role-match |
| `test/bridges/agents/frontmatter.test.ts` (MOD) | test | transform | existing file (18 line-reader cases replaced) | exact |
| `E/bridges/agents/discover.ts` (MOD) | bridge discover | file-I/O | itself `collectAgentFile` (:128-158), `duplicateWarning` warnings channel | exact |
| `E/bridges/agents/convert.ts` (MOD) | converter | transform | itself (`TOOL_MAP` :79, `mapModel` :313, `explicitMcpWarnings` :542, `omittedToolMapping` :578) | exact |
| `test/bridges/agents/convert.test.ts` (MOD) | test | transform | itself (warning asserts at :28,1430,1568,2094,2122,2172,2487,2942; line-reader use :11,2715-2719) | exact |
| `test/bridges/agents/discover.test.ts` (MOD) | test | file-I/O | itself | exact |
| `features/lib/upstream/subagents.ts` (MOD, `projectDetail`) | test harness | transform | itself :216-246 | exact |
| `features/step_definitions/agent/runs.steps.ts` (MOD optional: `subagent` in `AGENT_NAMEABLE_TOOLS`) | test harness | n/a | itself :24-32 | exact |
| `features/agent/frontmatter.feature` (MOD) | behavioral test | n/a | scenario "Apply reports each plugin agent field Claude Code also ignores"; "Tool lists split on commas..." | exact |
| `features/agent/invocation.feature` (MOD) | behavioral test | n/a | :246-267 "A run of an agent without a tools list..." | exact |
| `features/mcp-server/agent-grants.feature` (MOD) | behavioral test | n/a | :403-443 (D-CF6-10 scenario) | exact |
| `test/integration/pi-subagents-child-launch-conformance.test.ts`, `test/integration/agents-adapter-grant-conformance.test.ts` (MOD) | integration test | request-response | themselves | exact |
| `docs/mcp-compatibility.md`, `docs/output-catalog.md`, `README.md`, `README.es.md` (MOD) | docs | n/a | `docs/mcp-compatibility.md` :374-453, :613+ | role-match |
| `E/bridges/agents/legacy-grant-form.ts` | unchanged on purpose (own `NARROW_GRANT_LEAD` constant) | - | - | - |

No analog: none for code. Only the `|-` block emitter is new behavior (no existing multi-line emitter in agents; follow RESEARCH R1).

## Pattern Assignments

### `E/shared/frontmatter-repair.ts` (NEW, utility, transform)

**Header analog** `E/shared/bom.ts:1-6` -- a shared module that exists only because zones forbid bridge-to-bridge imports:
```ts
// shared/bom.ts
//
// FMBOM-01: the single leading-BOM strip used by every bridge read site that
// parses author-supplied frontmatter. It lives here because fallow's zone
// boundaries forbid bridges-agents, bridges-skills and bridges-commands from
// importing one another, and all three need it.
```
Agents must also call the BOM strip (`E/shared/bom.ts`) before the repair (anchored fence). Skills already do (`E/bridges/skills/stage.ts:359`).

**Code to move** (verbatim) from `E/bridges/skills/frontmatter-degrade.ts:143-228`: `OPENING_FENCE`, `TOP_LEVEL_KEY`, `UNREPAIRABLE_VALUE`, `repairableScalar`, `repairSingleLineScalars`; plus private `emitSafeDoubleQuotedScalar` (:89-93) exported; `frontmatterBlockEnd` (`frontmatter-scan.ts:23-31`), `keyValueEnd` (`:62-87`); `extractBodyAfterFrontmatter` (`E/bridges/skills/stage.ts:79-83`). Core loop to preserve:
```ts
export function repairSingleLineScalars(content: string): string {
  if (!OPENING_FENCE.test(content)) { return content; }
  const lines = content.split("\n");
  const blockEnd = frontmatterBlockEnd(lines);
  if (blockEnd === lines.length) { return content; }
  const repaired = [...lines];
  let changed = false;
  for (const [offset, line] of lines.slice(1, blockEnd).entries()) {
    const index = offset + 1;
    const scalar = repairableScalar(line);
    if (scalar === undefined || keyValueEnd(lines, index, blockEnd) !== index) { continue; }
    repaired[index] = `${scalar.key}: ${emitSafeDoubleQuotedScalar(scalar.value)}`;
    changed = true;
  }
  return changed ? repaired.join("\n") : content;
}
```
**Trigger parameter (D-PG7-02 amended):** today's trigger is the `!value.includes(":")` test inside `repairableScalar`:
```ts
if (value === "" || UNREPAIRABLE_VALUE.test(value) || !value.includes(":")) { return undefined; }
```
Replace the colon test with an injected predicate `(value: string) => boolean`; export a `colonTrigger` (skills, byte-identical) and an agents trigger = colon OR `/^[*&!%@`]/`. Keep cognitive complexity under 15 (both gates). Imports: none (no `platform/`, per D-PG7-03 amended).

### `E/bridges/skills/frontmatter-degrade.ts`, `frontmatter-scan.ts`, `stage.ts` (MOD)

Change only imports: `import { frontmatterBlockEnd, keyValueEnd, topLevelNodeIndex } from "./frontmatter-scan.ts";` (degrade.ts:19) becomes a split import with the moved names from `../../shared/frontmatter-repair.ts`; `topLevelNodeIndex`/`nodeKeys` stay local. Other callers of the moved scan helpers (`rewrite-frontmatter.ts`, `skill-names.ts`, `setDescriptionScalar`) re-point. `repairUnparseableFrontmatter` (`stage.ts:97-108`) passes the colon trigger. Use `fallow dead-code --trace` / CodeGraph to find every importer before moving.

### `E/bridges/agents/frontmatter.ts` reader (MOD, transform)

**Analog for parse-repair-parse:** `E/bridges/skills/stage.ts:232-256`:
```ts
function parseSkillSource(content: string, generatedName: string): ParsedSkillSource {
  try {
    return { content, parsed: parseFrontmatter(content), degraded: undefined };
  } catch (parseErr) {
    const repair = repairUnparseableFrontmatter(content);
    if (repair !== undefined) {
      return { content: repair.repaired, parsed: repair.parsed, degraded: undefined };
    }
    return {
      content: synthesizeUnparseableSkill(extractBodyAfterFrontmatter(content), generatedName),
      parsed: undefined,
      degraded: { generatedName, parseError: errorMessage(parseErr) },
    };
  }
}
```
and `repairUnparseableFrontmatter` (`stage.ts:97-108`): returns `undefined` when the repair changed nothing or the reparse throws (`// The colon was not the only defect...`). Agents version: on double failure return `{ raw: {}, body: extractBodyAfterFrontmatter(text), unparseable: <message> }`.

- `parseFrontmatter` must be imported from `../../platform/pi-api.ts` (pi-peer-chokepoint). Name collision: today's exported line reader is also `parseFrontmatter` (`frontmatter.ts:111`, returns `ParsedFrontmatter` at :78) -- rename the new export (e.g. `readAgentFrontmatter`) and delete the old reader once `discover.ts` and `convert.test.ts:11` stop calling it.
- Normalizer: keep `RawAgentFrontmatter` string-typed (`E/bridges/agents/types.ts:24-34`; proof in `test/bridges/agents/types.test.ts:159`). Value rules in RESEARCH R7 table. Copy keys with `setOwn` from `E/shared/own-key.ts:17`:
```ts
export function setOwn<T>(map: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });
}
```

### `E/bridges/agents/frontmatter.ts` emitter + types (MOD)

Current single-line emitter `emitYamlScalar` (:55-66) collapses newlines; used at :536 `` `description: ${emitYamlScalar(frontmatter.description)}` ``. Add a branch: description containing `\n` emits `description: |-` then each line prefixed with two spaces (RESEARCH R1; value already trimmed via `nonBlank` in convert). Keep the AG-8 comment block (:28-50) style and update its "theoretically impossible" note.

`GeneratedToolsFields` (:422-424) today:
```ts
export type GeneratedToolsFields =
  | { readonly tools: readonly [string, ...string[]]; readonly excludeTools?: never }
  | { readonly tools?: never; readonly excludeTools?: readonly [string, ...string[]] };
```
New shape (RESEARCH R3): explicit arm `tools` + optional `excludeTools` + `allowNestedSubagents?: never`; omitted arm `tools?: never` + optional `excludeTools` + optional `allowNestedSubagents?: true`. Emitter appends `allowNestedSubagents: true` in the same `if (... !== undefined) lines.push(...)` style as :554-560 (literal text `true` required by pi-subagents).

### `E/bridges/agents/discover.ts` (MOD, file-I/O)

Edit in place in `collectAgentFile` (:128-158):
```ts
const { raw, body } = parseFrontmatter(bytes.toString("utf8"));
...
const sourceName = raw.name ?? stem;
assertSafeName(sourceName, `agent name in ${sourcePath}`);
```
-> strip BOM, call new reader, `sourceName = raw.name?.trim() || stem` (empty falls back, D-PG7-05), then `assertSafeName`. The unparseable note goes into the same `warnings: string[]` that `duplicateWarning(...)` pushes to (discovery warnings, tagged by `stage.ts:173`), per D-PG7-04 amended. Word it per the messaging style guide; add a row in `docs/output-catalog.md`.

### `E/bridges/agents/convert.ts` (MOD, transform)

- **TOOL_MAP** (:79-87): add `["Agent", "subagent"]`, `["Task", "subagent"]` in the same `Map` literal. `toolNameOf` (:254-257) already strips `(a, b)`.
- **mapModel** (:313-332): change the `inherit` arm from `{ emit: undefined, ... }` to `{ emit: "inherit", originalModel: raw, warning: undefined }`; check the `--map-model` caller at :962-964 keeps inherit.
- **explicitMcpWarnings** (:542-552): delete; per-tool denies whose server survives in `kept` become `excludeTools` using `perToolMcpName`/`excludeName` (:560-563, :119-126). Extend `ExplicitDisallow.perTool` with the exclude name.
- **omittedToolMapping** (:578-615): delete the `` `excludeTools` requires pi-subagents >= 0.62.0 `` push (:607-611) and its doc paragraph; keep the unmapped-entries warning. Set `allowNestedSubagents` when the arm is omitted and `excludeTools` lacks `subagent`. Update stale doc comments (version-floor wording).
- Keep functions under cognitive 15 (both ESLint and fallow); split helpers rather than nesting.

### `test/...` owner tests

Mirror the existing owner files; `node:test` + `node:assert/strict` (+ `strong-mock` only if already used there). Import pattern from CONVENTIONS:
```ts
import assert from "node:assert/strict";
import test from "node:test";

import { repairSingleLineScalars } from "../../extensions/pi-claude-marketplace/shared/frontmatter-repair.ts";
```
Moved functions take their cases with them unchanged; 100% direct coverage per pair. Titles cite D-PG7-NN / PG-AGENT-NN, not phase numbers. Tests that touch HOME use the hermetic home helper.

### `features/lib/upstream/subagents.ts` `projectDetail` (:216-246)

Today it splits fields at the first blank line and reads one `label: value` per line, so a multi-line `Description:` shows only line 1 (and a blank line throws `unreadable("agent detail", text)`). Extend `detailFields` to append continuation lines (lines not matching the label regex) to the previous field; keep scenario descriptions free of blank lines (RESEARCH R8).

### `features/step_definitions/agent/runs.steps.ts` (:24-32)

```ts
const AGENT_NAMEABLE_TOOLS: ReadonlySet<string> = new Set([
  "read", "bash", "edit", "write", "grep", "find", "ls",
]);
```
Adding `"subagent"` makes `features/agent/invocation.feature:246-267` fail-before/pass-after for the omitted-`tools` case; re-check every scenario using the two "offered" steps (:80-100).

### Cucumber scenarios

- Fixture step: `the published plugin {string} of the marketplace {string} has these agents:` (`features/step_definitions/agent/listing.steps.ts:163-174`); `\n` in a cell is a newline (`features/lib/agent-files.ts:59-62`).
- `subagent get`/`list` via scripted model calls + `the model receives these calls:`.
- Nested-call proof: scripted parent `subagent {"agent":"demo:lead",...,"async":false}` then child `subagent {"agent":"demo:helper",...,"async":false}` (probe P2; both must be `async: false`, no MCP server in fixture).
- Staged file text: `the agents folder of the {word} scope holds the file {string} with this text:`; old-release file: `... as an earlier release wrote it, with this text:`.
- Warning removal proof uses `apply`, modeled on "Apply reports each plugin agent field Claude Code also ignores" (`features/agent/frontmatter.feature`).
- PG-AGENT-09 needs separate `@adapter-only` / `@builtin-only` scenarios in `features/mcp-server/agent-grants.feature`, modeled on :403-443.
- Scenarios whose pinned text changes: listed in RESEARCH R8 table (plain agent file gains `allowNestedSubagents: true`; `--map-model` inherit row gains `; model inherit`; `tools: *` starred row must stay unchanged).

## Shared Patterns

### Zone-safe shared helper
**Source:** `E/shared/bom.ts` (header), `E/shared/own-key.ts`. **Apply to:** `shared/frontmatter-repair.ts`. `shared/` may import `platform/` but the repair needs nothing.

### Warnings never refuse an install
**Source:** `discover.ts` `warnings.push(duplicateWarning(...))`; converter warnings array in `omittedToolMapping`. Discovery warnings print on standalone install; converter (hygiene) warnings print only on `apply`/update cascades (`stage.ts:168-174`, `shared/staging-warnings.ts`).

### Stored-text compatibility
`E/bridges/agents/legacy-grant-form.ts` keeps its own `NARROW_GRANT_LEAD` constant and `test/bridges/agents/legacy-grant-form.test.ts:19-25` its own literal; do not edit them when removing the producer. `grant-rewrite.ts` compares stored blocks byte-for-byte and never reads the removed warnings.

### Pi peer chokepoint
`parseFrontmatter` only via `E/platform/pi-api.ts:49`. Never import `yaml` directly.

## No Analog Found

| File/feature | Reason |
|---|---|
| `description: |-` block emission in `emitGeneratedAgentFrontmatter` | No multi-line emitter exists for agent files; follow RESEARCH R1 (two-space indent, `|-`, trimmed first line). |

## Metadata

**Analog search scope:** `E/bridges/{agents,skills}`, `E/shared`, `features/lib`, `features/step_definitions/agent`, `test/shared`
**Files scanned:** ~14
**Pattern extraction date:** 2026-11-14
