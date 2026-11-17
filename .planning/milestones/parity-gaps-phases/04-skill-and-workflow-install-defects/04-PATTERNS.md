# Phase 04: Skill and Workflow Install Defects - Pattern Map

**Mapped:** 2026-11-13
**Scope:** D-PG4-01..16 (PG-CORE-01, PG-SKILL-04, PG-WF-01, PG-SEC-01); current tracked source on `features/gaps`, not the saved codebase maps.
**Files classified:** 33 candidate files. Names marked "(proposed)" do not exist yet and are the planner's to rename. Final plans must count every file.
**Analogs found:** 33 / 33. Most changes land in an existing owner, which is its own analog. Three behaviors have no code to copy (see "No Analog Found").

## File Classification

Paths abbreviated: `S` = `extensions/pi-claude-marketplace`. A paired owner test replaces `S/` with `test/` and `.ts` with `.test.ts`.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `S/domain/component-paths.ts` | utility (resolver) | transform | existing owner: `collectStrictCommandPaths` beside `collectStrictComponentKind` | exact |
| `test/domain/component-paths.test.ts` | test | transform | existing owner | exact |
| `S/orchestrators/plugin/info.ts` | service (read-only row builder) | request-response | existing owner: `deriveLenientComponentPaths`, `discoverComponentNames`, `composeResolvedComponents` | exact |
| `test/orchestrators/plugin/info.test.ts` | test | request-response | existing owner | exact |
| `test/domain/version.test.ts` | test | file-I/O | existing owner ("hashes equal content by sorted path and changed bytes") | exact |
| `S/domain/skill-sibling-paths.ts` (proposed; may instead be a second export of `skill-tokens.ts`) | utility | transform | `S/domain/skill-tokens.ts` `rewriteMarkdownReferences` | role-match; path grammar is new |
| `test/domain/skill-sibling-paths.test.ts` (proposed) | test | transform | `test/domain/skill-tokens.test.ts` | role-match |
| `S/bridges/skills/stage.ts` | service (bridge) | file-I/O | existing owner: `stageSkill`, `rewriteSupportingMarkdown`, `prepareStageSkills` | exact |
| `test/bridges/skills/stage.test.ts` | test | file-I/O | existing owner | exact |
| `S/domain/skill-tokens.ts` | utility | transform | existing owner (workflow arm, `:114-115`) | exact |
| `test/domain/skill-tokens.test.ts` | test | transform | existing owner (`:271-301`) | exact |
| `S/domain/workflow-script.ts` | utility (AST reader) | transform | existing owner: `readEngineGate`, `metaPropertyKey`, `literalString` | exact; whole-AST walk is new |
| `test/domain/workflow-script.test.ts` | test | transform | existing owner | exact |
| `S/orchestrators/plugin/workflow-agent-restrictions.ts` (proposed) | utility (cross-kind join) | transform | `S/orchestrators/plugin/mcp-verdict.ts` (pure orchestrator leaf) + `shadowedFolderDiscoveryWarnings` in `S/domain/component-paths.ts` | role-match |
| `test/orchestrators/plugin/workflow-agent-restrictions.test.ts` (proposed) | test | transform | `test/orchestrators/plugin/mcp-verdict.test.ts`; fixture writers from `test/orchestrators/plugin/discover-names.test.ts` | role-match |
| `S/orchestrators/plugin/discover-names.ts` | service | file-I/O | existing owner | exact |
| `test/orchestrators/plugin/discover-names.test.ts` | test | file-I/O | existing owner | exact |
| `S/orchestrators/plugin/install-outcome.ts` | service (ledger body) | CRUD | existing owner (`:1238-1240`) | exact |
| `test/orchestrators/plugin/install-outcome.test.ts` | test | CRUD | existing owner | exact |
| `S/orchestrators/plugin/update-swap.ts` | service | CRUD | existing owner (`:1702-1705`) | exact |
| `test/orchestrators/plugin/update-swap.test.ts` | test | CRUD | existing owner | exact |
| `features/plugin/component-directories.feature` (or a new `features/skill/` feature) | test | request-response | its own "A declared skills path adds to the skills folder" scenario (`:50-`) | exact |
| `features/skill/<capability>.feature` (sibling links; file chosen by the planner) | test | request-response | `features/skill/model-reads.feature` | exact |
| `features/workflow/run.feature` | test | event-driven | existing feature | exact |
| `features/workflow/<capability>.feature` (restriction note; new, or `refusals.feature`) | test | request-response | `features/workflow/refusals.feature` | role-match |
| `features/lib/published-marketplace.ts` | utility (fixture writer) | file-I/O | its own `writePublishedPluginFiles` (`:719-736`) | exact |
| `features/step_definitions/marketplace/publishing.steps.ts` | test (step module) | file-I/O | `features/step_definitions/plugin/publishing.steps.ts:328-337` | exact |
| `features/step_definitions/workflow/runs.steps.ts` (or `model.steps.ts`; see below) | test (step module) | event-driven | `features/step_definitions/hook/tool-use.steps.ts:218-225` and its own `endsRun` | role-match |
| `features/step_definitions/workflow/refusals.steps.ts` or `listing.steps.ts` | test (step module) | request-response | `refusals.steps.ts:41-79` | exact |
| `features/step_definitions/plugin/installation.steps.ts` (only if a record-skills `Then` is added) | test (step module) | file-I/O | its own `the staged skills directory of the {word} scope holds these files:` (`:451-460`) | exact |
| `docs/workflows-compatibility.md` | documentation | transform | existing rows (`:39`, `:174`, `:176-182`) | exact |
| `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md` | documentation | transform | `.planning/upstream/pi-subagents-long-tool-names.md` | exact |
| `CHANGELOG.md` | documentation | transform | existing entries; `.agents/skills/changelog/rules/entries.md` | exact |

Not edited, despite D-PG4-07's text: `S/orchestrators/marketplace/shared.ts` builds no skills staging context (it only unstages, `:577`), and the skills bridge already holds the sibling map. RESEARCH records this as the chosen reading of D-PG4-07. The planner states it in the plan.

## Pattern Assignments

### PG-CORE-01: `S/domain/component-paths.ts` (resolver, transform)

**Analog:** the file's own per-kind branch. `collectStrictComponentKind` already hands `commands` to its own function; the root-source `skills` rule takes the same exit, so the existing function stays under both complexity gates.

**Imports** (lines 1-8). No new import is needed; `path`, `discoveryWarning`, and `StatKindReader` are present:

```typescript
import path from "node:path";

import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";
import { discoveryWarning } from "../shared/staging-warnings.ts";

import type { PluginEntry } from "./components/plugin.ts";
import type { CommandMapEntry, StatKindReader } from "./resolver-types.ts";
import type { DiscoveryWarning } from "../shared/staging-warnings.ts";
```

**Dispatch and conventional-folder pattern** (lines 493-526). Add the root-source branch as an early `kind === "skills"` exit, shaped like the `commands` one:

```typescript
async function collectStrictComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  resolution: ComponentPathResolution,
  statKind: StatKindReader,
  kind: ComponentPathKind,
): Promise<boolean> {
  if (kind === "commands") {
    return await collectStrictCommandPaths(entry, manifest, pluginRoot, resolution, statKind);
  }

  const seenPaths = new Set<string>();
  const entryRaw = (entry as Record<string, unknown>)[kind];
  const manifestRaw = manifest?.[kind];
  const dirty = await addValidatedComponentPaths(
    resolution,
    kind,
    seenPaths,
    [...readPathOrArray(entryRaw), ...readPathOrArray(manifestRaw)],
    pluginRoot,
  );

  if ((await statKind(path.join(pluginRoot, kind))) === "dir") {
    if (conventionalFolderApplies(kind, entryRaw, manifestRaw)) {
      addComponentPath(resolution, kind, seenPaths, kind);
    } else {
      recordShadowedFolder(resolution, kind);
    }
  }

  markSupportedWhenCollected(resolution, kind);
  return dirty;
}
```

In the root-source branch: do not call `recordShadowedFolder` (D-PG4-01: upstream drops `skills/` silently). "Survives" means `validateComponentPath` accepts the path AND `statKind(path.join(pluginRoot, relative)) === "dir"`. Never stat a refused path.

**Decision-ID doc comment pattern** (lines 467-481). The new predicate and branch carry `D-PG4-01` and `Claude Code 2.1.323` the same way:

```typescript
/**
 * D-CF1-06: whether the conventional `<kind>/` folder joins the declared
 * paths. Claude Code 2.1.316 always reads `skills/`, and reads `agents/` and
 * `workflows/` only when the kind's declaration is falsy (absent, `null`, or
 * `""`), so a declared `[]` also leaves the folder unread. `commands/` follows
 * its own rule (D-CF3-04) in `collectStrictCommandPaths` and never reaches
 * this function.
 */
function conventionalFolderApplies(
  kind: ComponentPathKind,
  entryRaw: unknown,
  manifestRaw: unknown,
): boolean {
  return kind === "skills" || (!entryRaw && !manifestRaw);
}
```

**Validation / refusal-cause pattern** (lines 93-132). `validateComponentPath` returns `{ ok: false; reason }` only. The rule needs to tell a traversal (absolute or escaping) from a non-string, and the cause is already computed two lines above the reason:

```typescript
  const contained = await resolveContainedComponentPath(
    pluginRoot,
    raw,
    `component path "${kind}"`,
  );
  if (!contained.ok && contained.cause === "absolute") {
    return {
      ok: false,
      reason: `${subject} must be relative (got absolute "${raw}")`,
    };
  }

  if (!contained.ok) {
    return { ok: false, reason: `${subject} escapes plugin root: "${raw}"` };
  }

  // Deduplicate equivalent spellings only after enforcing containment.
  const relative = path.relative(pluginRoot, contained.absolutePath);
  return { ok: true, relative: relative === "" ? "." : relative };
```

Extend the failure arm with the cause (`resolveContainedComponentPath` already returns `cause: "absolute" | "escape"`, lines 14-39). Keep the reason strings byte-identical: `test/domain/component-paths.test.ts:125-146` pins them.

**Shared predicate.** Export one `isMarketplaceRootSource(source: unknown): boolean` from this module (sketch in RESEARCH "Code Examples") and import it from `info.ts`. A second copy fails `fallow dupes`. `orchestrators` importing `domain` is a legal zone edge; `info.ts` already takes values from `domain/`.

---

### PG-CORE-01: `S/orchestrators/plugin/info.ts` (read-only row builder)

**Analog:** the file's own three sites.

**Lenient mirror** (lines 2111-2129). Apply the rule lexically here (the function is synchronous and has no `stat`): listed strings replace `skills`; keep `skills` only when a listed path normalizes to `skills` or `.`; when every listed path is absolute or escapes lexically, list nothing.

```typescript
function deriveLenientComponentPaths(
  entry: MarketplaceManifest["plugins"][number],
): LenientComponentPaths {
  const out: LenientComponentPaths = { skills: [], commands: [], agents: [], workflows: [] };
  for (const kind of ["skills", "commands", "agents", "workflows"] as const) {
    const declared = (entry as Record<string, unknown>)[kind];
    if (kind === "skills" || kind === "commands" || !declared) {
      out[kind].push(kind);
    }

    for (const d of asDeclaredList(declared)) {
      if (typeof d === "string" && !out[kind].includes(d)) {
        out[kind].push(d);
      }
    }
  }

  return out;
}
```

Its doc comment (lines 2100-2110) says "`skills` always starts from `skills/` (D-CF1-06)"; amend that sentence with the D-PG4-01 exception.

**Self-skill listing defect** (lines 331-341 and 385-405). RESEARCH finding 1: without this fix, success criterion 1 fails (`info` prints `references`, not `a`).

```typescript
function nameFromEntry(
  entry: { name: string; isDirectory(): boolean; isFile(): boolean },
  kind: "skills" | "commands" | "agents",
): string | undefined {
  if (kind === "skills") {
    return entry.isDirectory() ? entry.name : undefined;
  }

  // commands + agents: `.md` files; strip the suffix for display.
  return entry.isFile() && entry.name.endsWith(".md") ? entry.name.slice(0, -3) : undefined;
}
```

```typescript
  for (const rel of componentDirs) {
    const abs = path.isAbsolute(rel) ? rel : path.join(pluginRoot, rel);
    // eslint-disable-next-line no-await-in-loop -- bounded by the declared component dirs, one readdir each
    const entries = await readEntriesOrEmpty(reader, abs);
    for (const entry of entries) {
      const name = nameFromEntry(entry, kind);
```

For `kind === "skills"`: when `entries` holds a regular file `SKILL.md`, the path is one skill named `path.basename(abs)` and its subfolders are not skills. The entries are already read; add no read. The rule to mirror is `isSelfSkillDir` in `S/bridges/skills/discover.ts:90-95` (do not import it into a domain file; `info.ts` is an orchestrator and may, but the entry list is cheaper):

```typescript
async function isSelfSkillDir(skillsDir: string): Promise<boolean> {
  const stat = await lstat(skillsDir).catch(() => null);
  return (
    stat?.isDirectory() === true && !stat.isSymbolicLink() && (await hasRegularSkillFile(skillsDir))
  );
}
```

**Notes composition** (lines 1100-1115): see PG-SEC-01 below.

---

### PG-CORE-01 owner tests

**`test/domain/component-paths.test.ts`**: injected `statKind`, whole-`resolution` deep equality (lines 22-51):

```typescript
    const dirty = await collectStrictComponentPaths(
      {
        entry: { name: "alpha", source: "./alpha", skills: ["entry", "shared"] },
        manifest: { skills: ["shared", "manifest"] },
        pluginRoot,
        resolution,
      },
      (candidate) => Promise.resolve(candidate === path.join(pluginRoot, "skills") ? "dir" : null),
    );

    // assert
    assert.strictEqual(dirty, false);
    assert.deepStrictEqual(resolution, {
      supported: ["skills"],
      notes: [],
      componentPaths: {
        skills: ["entry", "shared", "manifest", "skills"],
        commands: [],
        agents: [],
        workflows: [],
      },
    });
```

Table-driven arms (lines 125-172): `const cases = [{ title, value, reason }] as const; for (const {...} of cases) { test(title, ...) }`. Use the same shape for the four D-PG4-01 arms (a path survives; none survives with a traversal; none survives without one; non-root or object source unaffected). Every existing case uses `source: "./alpha"`, so none changes. New cases use `source: "./"` and `"."`, and one object-form source.

**`test/domain/version.test.ts`**: the "changed bytes" case (lines 69-82) is the template for "the hash changes when only `.claude-plugin/marketplace.json` changes". Note the file pins literal `hash-…` values; follow that:

```typescript
    const pluginRoot = await createVersionSandbox(t);
    await writeFile(path.join(pluginRoot, "a.txt"), "same\n");
    await writeFile(path.join(pluginRoot, "b.txt"), "same\n");

    // act
    const equalContentVersion = await computeHashVersion(pluginRoot);
    await writeFile(path.join(pluginRoot, "b.txt"), "same!\n");
    const changedContentVersion = await computeHashVersion(pluginRoot);
```

No `.claude-plugin` case exists in that file today (grep found none), so the case is new.

---

### PG-SKILL-04: sibling rewrite function (utility, transform)

**Analog:** `S/domain/skill-tokens.ts` `rewriteMarkdownReferences` (lines 82-119): a pure function, one anchored regex with a negative look-behind, a per-line `replaceAll` callback that returns `token` unchanged on any miss.

```typescript
  const tokenRe = new RegExp(
    `(?<![A-Za-z0-9_.:/-])/?(?:(${escapeRegExp(pluginName)}):|skill:)([A-Za-z0-9_-]+(?:[:.][A-Za-z0-9_-]+)*)`,
    "g",
  );

  const rewriteLine = (line: string): string =>
    line.replaceAll(tokenRe, (token, qualifiedPlugin: string | undefined, source: string) => {
      if (qualifiedPlugin === undefined) {
        const skill = resolveSkillReference(pluginName, source, skills);
        return skill.kind === "known" ? `/skill:${skill.generatedName}` : token;
      }
      ...
    });

  return content.split("\n").map(rewriteLine).join("\n");
```

Copy: the look-behind that stops a token starting mid-path (the sibling token must not follow `/`, `.`, or a word character); line-by-line application; a linear pattern with single separators (RESEARCH security table: no nested quantifiers on plugin text). Copy also the "required member" input convention (lines 22-31): the function takes its sibling list as a required parameter, never an optional one a caller could forget. Rule and arithmetic: RESEARCH "PG-SKILL-04: Rewrite rule". No filesystem access; output uses `/`.

**Owner test analog:** `test/domain/skill-tokens.test.ts:1-20`: `describe` per export, `// arrange / // act / // assert`, whole-string `assert.strictEqual`:

```typescript
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  resolveSkillReference,
  rewriteMarkdownReferences,
} from "../../extensions/pi-claude-marketplace/domain/skill-tokens.ts";
import { setCasePlatform } from "../platform/case-platform.ts";

describe("rewriteMarkdownReferences", () => {
  test("leaves an already-native reference byte-identical", () => {
    // arrange
    const content = "Use acme-foo when linting.\n";
```

Cases (RESEARCH Pitfall 6): depth 0, depth 1, `${CLAUDE_SKILL_DIR}/`, trailing `/`, own-skill link, `../../docs` outside every skill, unstaged sibling, a `/`-preceded path, a long adversarial line.

---

### PG-SKILL-04: `S/bridges/skills/stage.ts` (bridge, file-I/O)

**Analog:** the file itself.

**Context type** (lines 255-266). Add the sibling map here, beside `referenceNames`. No `StageSkillsInput` field:

```typescript
/** What every skill of one `prepareStageSkills` call is staged with. */
interface SkillStagingContext {
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly pluginDataDir: string;
  /** SUB-02: the install cwd at project scope, `undefined` at user scope. */
  readonly projectDir: string | undefined;
  readonly locations: StageSkillsInput["locations"];
  readonly stagingRoot: string;
  readonly referenceNames: InstalledReferenceNames;
  readonly claims: SkillNameClaims;
}
```

**Where the map is built** (lines 431-434 and 469-481). `discovered` is exactly the set that stages (collision losers and command-shadowed skills are gone), and each row holds `skillDir` (absolute source folder) and `generatedName` (`bridges/skills/types.ts:19-26`):

```typescript
  const { discovered, warnings: discoverWarnings } = await discoverPluginSkills({
    pluginName,
    resolved,
  });
```

```typescript
  const context: SkillStagingContext = {
    pluginName,
    pluginRoot,
    pluginDataDir,
    projectDir: locations.scope === "project" ? cwd : undefined,
    locations,
    stagingRoot,
    // SKTK-01: the same-plugin reference targets this install materializes.
    referenceNames: skillReferenceNames(
      input.referenceNames,
      discovered.map((skill) => skill.generatedName),
      input.knownWorkflowNames,
    ),
```

Line 430 carries a `fallow-ignore-next-line code-duplication` marker over the `discoverPluginSkills` call. Per CONVENTIONS, when a marked span changes: delete the marker, run `npx fallow dupes`, check `$?`, and restore the marker only above a line the reviewed group still spans.

**Ordering in `stageSkill`** (lines 357-372). The sibling pass goes before `substituteClaudeVars` (D-PG4-05), next to the reference rewrite, and again inside `rewriteSupportingMarkdown`:

```typescript
  // SKTK-01: retarget same-plugin `<plugin>:<skill>`, `<plugin>:<command>`
  // and `<plugin>:<workflow>` references (both arms -- a degraded skill's
  // body is prose too). Runs before SK-4 substitution so the PARSE-02
  // backstop validates the final bytes.
  content = rewriteMarkdownReferences(content, pluginName, context.referenceNames);
  content = substituteClaudeVars(content, skillVars);
  // D-CF2-02 / D-CF2-06 / T-02-02: the record goes in last, after every
  // rewrite, so no reference rewrite reads its names. Its `pluginRoot` and
  // `pluginData` are the values the SK-4 substitution used.
  content = writeSkillRecord(content, {
    names,
    pluginRoot: context.pluginRoot,
    pluginData: context.pluginDataDir,
  });
  await writeFile(skillMdPath, content, "utf8");
  await rewriteSupportingMarkdown(stagedDir, pluginName, context.referenceNames, skillMdPath);
```

**Supporting-file walk** (lines 165-196). Keep its symlink skip, the own-`SKILL.md` skip, the write-only-when-changed test, and the reasoned `no-await-in-loop` disables. The walk needs each file's depth inside the skill (staged path relative to `stagedDir` equals source path relative to `skill.skillDir`, because `cp` copied the tree):

```typescript
    if (fileStat.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- the caller's staging cleanup needs no write in flight
      await rewriteSupportingMarkdown(file, pluginName, names, skillFile);
    } else if (fileStat.isFile() && entry.name.endsWith(".md")) {
      // eslint-disable-next-line no-await-in-loop -- the caller's staging cleanup needs no write in flight
      const content = await readFile(file, "utf8");
      const rewritten = rewriteMarkdownReferences(content, pluginName, names);
      if (rewritten !== content) {
        // eslint-disable-next-line no-await-in-loop -- the caller's staging cleanup needs no write in flight
        await writeFile(file, rewritten, "utf8");
      }
    }
```

The function already takes four positional parameters; pass the rewrite inputs as one object or a closure rather than growing the list (CONVENTIONS "Parameters").

**Owner test analog:** `test/bridges/skills/stage.test.ts:426-456`: real temp tree, `prepareStageSkills(createRemovalOps(), {...})`, then compare the staged bytes whole:

```typescript
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: ["acme:audit"],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const alphaBytes = await readFile(path.join(prepared.stagingRoot, "acme-alpha", "SKILL.md"));

    // assert
    assert.deepStrictEqual(
      alphaBytes,
      Buffer.from(
        "---\nname: acme-alpha\ndescription: Runs the audit\n" +
          recordLine(["acme:alpha", "alpha"], pluginRoot, pluginDataDir) +
          "---\n\nRun /acme:audit, then /acme:acme-release.\n",
      ),
    );
```

This existing case feeds slash forms and stays green under PG-WF-01. Imports at lines 1-21 show `createHermeticEnvironment` from `test/platform/hermetic-environment.ts`: use it; never the real home.

---

### PG-WF-01: `S/domain/skill-tokens.ts` (utility, transform)

**Analog:** itself. The whole change is the last two lines of the callback (lines 114-115):

```typescript
      const workflowName = resolveWorkflowReference(pluginName, source, workflows);
      return workflowName === undefined ? token : `/${workflowName}`;
```

`token` is the whole match and the pattern starts with an optional `/?`, so `token.startsWith("/")` is the source's slash state (D-PG4-08). Leave the command arm (`:104-106`) and the skill arm (`:108-112`) as they are. Update the file header (lines 5-9): it calls all three kinds "`/`-invocable"; the workflow now keeps the source's slash state.

Callers that inherit the change with no edit: `bridges/skills/stage.ts:361` and `:189`, `bridges/commands/staged-command.ts:270`, `bridges/agents/convert.ts:1014`, `bridges/agents/skill-preload.ts:89`.

**Owner test:** `test/domain/skill-tokens.test.ts:271-301`. The two cases D-PG4-09 names; change the expected strings to the bare name and add a slash-preserving case in the same shape:

```typescript
  test("converges an elidable reference onto a generated workflow name", () => {
    // arrange -- the plugin ships no skill or command by that name, so only
    // the workflow resolver can claim the token.
    const content = "Run acme:acme-audit on every branch.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: [],
      commands: [],
      workflows: ["acme:audit"],
    });

    // assert
    assert.strictEqual(rewritten, "Run /acme:audit on every branch.\n");
  });
```

The win32 case (`:287-301`) uses `setCasePlatform(t, "win32")` from `test/platform/case-platform.ts`; keep it.

---

### PG-SEC-01: `S/domain/workflow-script.ts` (AST reader, transform)

**Analog:** itself.

**Optional, absent-when-empty verdict field** (lines 82-94). The `gate` member is the precedent: optional, so every existing `deepStrictEqual` on a verdict keeps passing:

```typescript
export interface NamedWorkflow {
  readonly outcome: "named";
  readonly fileName: string;
  readonly metaName: string;
  readonly generatedName: string;
  readonly description?: string; // WBRG-01 envelope input; unused by the verdict
  /**
   * WGATE-01: the engine gate this script would be refused at, absent when the
   * engine would load it. Advisory only -- it rides the two ADMITTED arms
   * precisely because a gate reading may never turn into a refusal (WGATE-03).
   */
  readonly gate?: WorkflowGate;
}
```

`exactOptionalPropertyTypes` is on: spread the field conditionally in `namedVerdict`, never assign `undefined`.

**Where it is read** (lines 221-229): after both refusal arms, beside `readEngineGate`:

```typescript
  const read = readMetaString(meta.elements, "description");
  const description = read.kind === "literal" ? read.value : undefined;
  // WGATE-01: read the gate AFTER both refusal arms have been settled and
  // BEFORE the admitted verdict is built. ...
  const gate = readEngineGate(parsed.ast, meta.elements);

  return namedVerdict(pluginName, fileName, metaName.value, description, gate);
```

**Contained-walk error pattern** (lines 800-808). The `agentType` walk copies this: any throw costs a note, never an install:

```typescript
function readEngineGate(ast: Program, elements: readonly MetaElement[]): WorkflowGate | undefined {
  try {
    const ctx = gateContext(ast, elements);

    return GATE_ORDER.find((gate) => GATE_PREDICATES[gate](ctx));
  } catch {
    return undefined;
  }
}
```

**Key and literal readers to reuse** (lines 654-666, 753-763). Do not write new ones:

```typescript
function metaPropertyKey(p: Property): string | undefined {
  if (p.key.type === "Identifier") {
    return p.key.name;
  }

  if (
    p.key.type === "Literal" &&
    (typeof p.key.value === "string" || typeof p.key.value === "number")
  ) {
    return String(p.key.value);
  }

  return undefined;
}
```

```typescript
function literalString(node: Property["value"]): string | undefined {
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }

  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((quasi) => String(quasi.value.cooked)).join("");
  }

  return undefined;
}
```

Skip computed properties (`p.computed`). Walk the AST; never regex the script text. No `acorn-walk` (the module header refuses a walker package).

**Owner test analog:** `test/domain/workflow-script.test.ts:199-232`: a one-line script literal, a projected expected verdict with `satisfies`, one `deepStrictEqual`:

```typescript
    const source = `export const meta = { name: \`deploy\`, description: "d" };\n`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "deploy",
      generatedName: "acme:deploy",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "shipper.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
```

The `admission(...)` projection (declared near lines 25-40) drops fields it does not name. Check whether it must gain the new field, or assert the field directly in the new cases.

---

### PG-SEC-01: the join module (proposed `S/orchestrators/plugin/workflow-agent-restrictions.ts`)

**Analogs:** `S/orchestrators/plugin/mcp-verdict.ts` for the module shape (pure orchestrator leaf, header states purity and what it must not import); `shadowedFolderDiscoveryWarnings` for the output shape; `softFailWarning` for the message shape.

**Header and import pattern** (`mcp-verdict.ts:1-23`):

```typescript
// orchestrators/plugin/mcp-verdict.ts
//
// D-P3-06 / D-P3-10: a plugin's MCP dependency, computed from its declared or
// recorded server configs. ...
//
// Pure: it does no I/O. It must never import `mcp-verdict-read.ts` or
// `recorded-servers.ts`, which reach `install-outcome.ts`, so any module
// may import it without closing a cycle.

import { profileFor } from "../../domain/mcp-implementation.ts";

import type {
  ActiveMcpImplementation,
  McpImplementationId,
  RecordedMcpServers,
} from "../../domain/mcp-implementation.ts";
```

The join imports types only from the two bridge barrels (`bridges/agents/index.ts`, `bridges/workflows/index.ts`), as `discover-names.ts:20-23` does for values. A bridge may not import a sibling bridge; an orchestrator may import both.

**Output shape** (`S/domain/component-paths.ts:69-73`):

```typescript
export function shadowedFolderDiscoveryWarnings(
  shadowedFolders: readonly ComponentPathKind[] | undefined,
): readonly DiscoveryWarning[] {
  return (shadowedFolders ?? []).map((kind) => discoveryWarning(shadowedFolderWarning(kind)));
}
```

`discoveryWarning` and `DiscoveryWarning` come from `S/shared/staging-warnings.ts:14-32`. Return plain strings from the pure builder and tag them at the install/update sites, because `info` wants strings (`notes`) and the ledgers want `DiscoveryWarning`.

**Message shape** (`S/bridges/workflows/discover.ts:142-149`), which D-PG4-12's wording follows:

```typescript
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  return `workflow script "${forMessage(fileName)}" in "${forMessage(workflowsDir)}" ${outcome}: ${forMessage(reason)}`;
}
```

`softFailWarning` is module-private to the workflows bridge; build the new sentence in the join with `forMessage` (exported, `S/domain/workflow-script.ts:1064-1069`) on the file name and the agent type. Pass the absolute folder (`path.dirname(scriptFile)`); `redactAbsolutePaths` at the existing surfacing sites reduces it to `"workflows"`.

**Inputs that already exist:**

```typescript
// S/bridges/agents/types.ts:24-55
export interface RawAgentFrontmatter {
  readonly name?: string;
  ...
  readonly tools?: string;
  readonly disallowedTools?: string;
  ...
}

export interface DiscoveredAgent {
  readonly sourceName: string;
  readonly generatedName: string;
  readonly sourcePath: string;
  readonly namespace?: readonly string[];
  readonly sourceHash: string;
  readonly raw: RawAgentFrontmatter;
  readonly body: string;
}
```

```typescript
// S/domain/name.ts:594-608 -- the upstream agent name (D-PG4-11 match target)
export function declaredAgentName(
  plugin: string,
  source: string,
  namespace: readonly string[] = [],
): string {
```

"Non-empty" is a trimmed-string test: a YAML list is folded to a comma-joined string (`bridges/agents/frontmatter.ts:20-24`). `declaredAgentName` throws on an unsafe name; contain that per agent so one odd agent costs a note, not the pass.

**Owner test analog:** `test/orchestrators/plugin/mcp-verdict.test.ts` for a pure table-style test; no disk is needed when the function takes discovery results as data.

---

### PG-SEC-01: `S/orchestrators/plugin/discover-names.ts`

**Analog:** itself (lines 65-91). Both discoveries already run here; compute the notes from `agentsDiscovery.discovered` and `workflowsDiscovery.discovered` and return them beside the names:

```typescript
  const agentsDirs = resolvedAgentsDirs(resolved);
  const agentsDiscovery = await discoverPluginAgents({ pluginName: plugin, agentsDirs });
  const workflowsDiscovery = await discoverPluginWorkflows({
    pluginName: plugin,
    resolved,
    tense: "install",
  });

  return {
    skills: skillsDiscovery.discovered.map((s) => s.generatedName),
    commands: commandsDiscovery.discovered.map((c) => c.generatedName),
    agents: agentsDiscovery.discovered.map((a) => a.generatedName),
    agentsDirs,
    workflows: workflowsDiscovery.discovered.flatMap((w) =>
      w.verdict.outcome === "named" ? [w.verdict.generatedName] : [],
    ),
  };
```

The header at lines 46-64 says "Name preview only ... this function drops them on purpose ... Reporting here as well would print every warning twice". That stays true for the bridges' own warnings. Rewrite the comment to say the restriction notes are the one output produced here, and why (the join needs both kinds; no bridge can do it).

`DiscoveredGeneratedNames` (lines 27-38) gains a required member, in the style of its `workflows` member. Required, not optional: see the "optional-field silent-omission" rule in `skill-tokens.ts:22-26`. Trace every constructor of this type before adding it (CodeGraph: `DiscoveredGeneratedNames`), tests included.

**Owner test analog:** `test/orchestrators/plugin/discover-names.test.ts:12-76`: temp plugin root with `t.after` cleanup and small writers. `writeAgent` needs a frontmatter variant with `tools:`, and `writeWorkflow` a body with `agentType`:

```typescript
async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));
  return pluginRoot;
}
```

```typescript
async function writeWorkflow(
  directory: string,
  fileName: string,
  metaName?: string,
): Promise<void> {
  await mkdir(directory, { recursive: true });
  const contents =
    metaName === undefined
      ? "export function help() {\n  return 1;\n}\n"
      : `export const meta = { name: ${JSON.stringify(metaName)}, description: "d" };\n`;
  await writeFile(path.join(directory, fileName), contents, "utf8");
}
```

---

### PG-SEC-01: delivery sites

**`S/orchestrators/plugin/install-outcome.ts:1238-1240`** (names come from `discoverGeneratedNames` at `:1173`):

```typescript
    // D-CF1-06: every conventional folder a declaration leaves unread, so
    // each verb that runs this ledger names it, and a failed install keeps it.
    discoveryWarnings: [...shadowedFolderDiscoveryWarnings(installable.shadowedFolders)],
```

**`S/orchestrators/plugin/update-swap.ts:1702-1705`** (names from `:1502`):

```typescript
  const stagingWarnings = [
    ...shadowedFolderDiscoveryWarnings(installable.shadowedFolders),
    ...collectUpdateWarnings(handles),
  ];
```

Add the notes at exactly these two sites, once each (RESEARCH Pitfall 8). Both files are near the complexity ceilings: add a spread element, not a branch.

**`S/orchestrators/plugin/info.ts:1100-1115`** (`composeResolvedComponents`, called by all four row builders):

```typescript
  const workflows = await previewWorkflows(pluginRoot, resolved.componentPaths.workflows, {
    pluginName,
  });

  return {
    components: {
      ...(agents.length > 0 && { agents }),
      ...
      ...(workflows.names.length > 0 && { workflows: workflows.names }),
    },
    notes: workflows.warnings,
    mcpDependency: mcpDependencyOf(Object.values(resolved.declaredMcpServers)),
  };
```

`previewWorkflows` (lines 1166-1187) returns names and redacted warnings only; it must also hand back the `named` verdicts (or their literal agent types) for the join. It applies `redactAbsolutePaths` to each warning; the new notes pass through the same call:

```typescript
    warnings: warnings.map((warning) => redactAbsolutePaths(warning)),
```

`info` names agents from file names today and never parses frontmatter. Read agent files through `discoverPluginAgents` only when some admitted script has a literal `agentType`. The failure policy for that read is the planner's call (RESEARCH: "no note" or the existing row-level `narrowProbeError` fallback).

---

### Cucumber: features, steps, fixtures

Read `.agents/skills/cucumber/rules/{layout,features,steps,world-and-stand-ins}.md` before writing; `layout.md` gives each shared file one owner, so order the plans that touch `features/lib/**` and the topic step modules.

**PG-CORE-01 scenarios.** Analog: `features/plugin/component-directories.feature:50-` ("A declared skills path adds to the skills folder"). Its feature description says a declared path "adds to the skills folder"; amend that sentence if the scenarios land there. Full-row `info` table (every field stated, lines 34-48):

```gherkin
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components commands     | hello         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |
      | plugin id                      | demo@fixtures |
      | plugin name                    | demo          |
      | plugin reasons                 |               |
      | plugin status                  | available     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |
```

Existing steps to reuse:

- Root-source entry: `Given the marketplace {string} publishes this manifest:` (`features/step_definitions/marketplace/publishing.steps.ts:180-185`, over `rewritePublishedManifest`). The "update drops a listed skill" scenario publishes a second manifest with a bumped entry `version` (RESEARCH Pitfall 4).
- Staged tree: `Then the staged skills directory of the {word} scope holds these files:` (`features/step_definitions/plugin/installation.steps.ts:451-460`), a complete `file | text` listing with run tokens:

```typescript
Then(
  "the staged skills directory of the {word} scope holds these files:",
  async function (this: ScenarioWorld, scope: string, table: DataTable) {
    const directory = path.join(extensionRoot(this, scope), "resources", "skills");
    const rows = (await fileRows(directory)).map((row) =>
      row.map((cell) => projectTokens("text", cell, this.tokens)),
    );
    assert.deepStrictEqual(rows, table.raw());
  },
);
```

- Session view: `Then the session offers these skills:` / `the session offers no skills` (`features/step_definitions/session.steps.ts:178,183`).
- Record: `the installation record of the {word} scope holds these plugins:` (`installation.steps.ts:417`); its helper already checks recorded skill names (`:302-310`). Read that helper before adding a new record-skills `Then`.

New fixture writer for a file at the marketplace root. Analog: `features/lib/published-marketplace.ts:719-736`. Keep `ownedTarget` (`:404-418`) and `changePublication`, drop the `plugins/<plugin>` join:

```typescript
export async function writePublishedPluginFiles(
  published: PublishedMarketplace,
  plugin: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  const targets = Object.entries(files).map(
    ([file, text]) =>
      [ownedTarget(published, path.join(published.root, "plugins", plugin, file)), text] as const,
  );
  await changePublication(published, async () => {
    await Promise.all(
      targets.map(async ([target, text]) => {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, text);
      }),
    );
  });
}
```

New step. Analog: `features/step_definitions/plugin/publishing.steps.ts:328-337` (write, then read back and assert). It belongs in `marketplace/publishing.steps.ts`, the marketplace topic module, because the thing named is the marketplace's file:

```typescript
Given(
  "the published plugin {string} of the marketplace {string} has the file {string} with this text:",
  async function (this: ScenarioWorld, plugin: string, name: string, file: string, text: string) {
    const published = this.requirePublished(name);
    await writePublishedPluginFiles(published, plugin, { [file]: text });
    assert.strictEqual(
      await readFile(path.join(published.root, "plugins", plugin, file), "utf8"),
      text,
    );
```

**PG-SKILL-04 scenario.** Analog: `features/skill/model-reads.feature:27-41`: scripted model reads a staged file and the table pins the whole text the model receives:

```gherkin
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                                |
      |        | read | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"} |
      | Noted. |      |                                                                                          |
    When the user prompts "Check the status."
    Then the model receives these calls:
```

Steps exist (`features/step_definitions/model.steps.ts:97`, and `the published plugin ... has the skill {string} with this skill file:`). Use an ordinary `./plugins/demo` plugin with two skills that both stage (RESEARCH Pitfall 5). To prove the rewritten path "names an existing staged file", the model reads the rewritten path and the tool result shows the sibling's text; add the staged-files step for the supporting-Markdown depth case.

**PG-WF-01 scenario.** Analog: `features/workflow/run.feature` Background (lines 7-14) and its run-end step:

```gherkin
  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
```

```gherkin
    Then the workflow run ends with the status "completed" and the result "Hello from demo."
    Then the workflow engine shows these notices:
```

New step support (a model-started run with a reduced tool result). Analog for the reduction: `features/step_definitions/hook/tool-use.steps.ts:218-225`:

```typescript
Then(
  "the model receives these calls, with an empty tool result:",
  function (this: ScenarioWorld, table: DataTable) {
    const rows = toolCallRows(this);
    assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
```

A second precedent is `the model receives these calls, with each tool search reduced to the tools it loads:` (`features/step_definitions/mcp-server/builtin-tool-search.steps.ts:19`). Analog for the wait: `features/step_definitions/workflow/runs.steps.ts:29-39`. Wait on the run-ending progress record, never a fixed time:

```typescript
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "failed", "aborted"]);

// A script with no agent call ends within a second; the margin covers a
// loaded CI runner and stays below the 30-second step timeout, so a run that
// never ends fails here with Pi's stderr (D-CF1-17).
const WORKFLOW_RUN_TIMEOUT_MS = 20_000;

function endsRun(record: RpcRecord): boolean {
  const status = progressOf(record)?.status;
  return typeof status === "string" && TERMINAL_STATUSES.has(status);
}
```

The step text must name its topic (workflow), and the background `workflow` tool result carries a random run ID (`scan-mwfq5idg-sqbmun`), so reduce or tokenize it. Use the default background call; `background: false` fails an agent-less script (RESEARCH Pitfall 7). The discriminating assertion is the prompt text the model receives (`Workflow({ name: "demo:scan" })`), not the scripted call.

**PG-SEC-01 scenario.** Analog: `features/workflow/refusals.feature:40-` and `features/step_definitions/workflow/refusals.steps.ts`. Two existing steps fit:

```typescript
Then(
  "the workflow install diagnostic reports these lines:",
  function (this: ScenarioWorld, table: DataTable) {
    const [lines, ...others] = this.resultsOf("command").flatMap((payload) =>
      payload.kind === "diagnostic" ? [payload.lines] : [],
    );
    assert.deepStrictEqual(others, [], "the command reported more than one diagnostic");
    const rows = (lines ?? assert.fail("the command reported no diagnostic")).map((line) => [
      projectTokens("lines", line, this.tokens),
    ]);
    assert.deepStrictEqual([["line"], ...rows], table.raw());
  },
);
```

The `Given ... which reported these notes on workflow scripts:` step (`:41-62`) does NOT fit as written: its `WORKFLOW_NOTE` regex (`:20`) admits only three dispositions (`was refused|was not installed|was installed but the engine will refuse to load it`), so a restriction note would land whole in the `script` cell and fail. Use the `Then` above with full lines, or extend the regex in the same commit as its feature rows. `info` reads the note through the field `plugin notes` in `Then the result has these fields:`. Agent fixture: `features/lib/agent-files.ts` and `publishAgent` (`features/lib/published-marketplace.ts:795`). A new feature file is likely cleaner than extending "Workflow refusals" (RESEARCH Open Question 4); if a new verb step module is needed, its name and step text name the topic.

**Tags.** None of the four requirements names an MCP implementation: scenarios stay untagged and run under the adapter profile only (`cucumber.json` builtin profile: `(@mcp or @builtin-only) and not @adapter-only`).

---

### Documents

**`docs/workflows-compatibility.md`.** Row format (lines 176-182): four columns, `✓`/`✗`/`--`, notes cite the measured version or decision ID:

```markdown
| Rule                                          | Claude Code | Pi  | Notes                                                                                                                                                 |
| --------------------------------------------- | ----------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| leading `<plugin>-` elided from the name half | ✗           | ✓   | `acme` plus `acme-audit` gives `acme:audit` here and `acme:acme-audit` upstream; skill prose is retargeted, script bytes are not                      |
```

Edits: the retargeting sentence inside the `:174` paragraph (D-PG4-10); a new row for an agent type's tool restriction, upstream `✓`, Pi `✗`, spike S4 on engine 3.15.1 and Pi 1.5.2 (D-PG4-14); the `skills` clause at `:39` ("a declared `skills` path still adds to `skills/`") gains the D-PG4-01 exception. Line 126 is PG-WF-02: do not touch. Markdown is formatted by mdformat, not Prettier; table columns are re-padded by the hook.

**`.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`.** Analog: `.planning/upstream/pi-subagents-long-tool-names.md` (the no-patch model), lines 1-39:

```markdown
# pi-subagents: granted adapter tool names over 64 characters

Patch: no patch exists; this report is not filed.
Repository: https://github.com/nicobailon/pi-subagents
Package version: 0.88.0, measured 2026-11-11.

## Problem: a granted adapter tool keeps a name the adapter cuts
...
### Evidence and test
...
## Draft issue

**Title:** Match pi-mcp-adapter's 64-character tool names in MCP grant resolution

**Body:**
```

then a fenced `markdown` body. Evidence lines for the draft are in RESEARCH's engine table (`applyToolPolicy(` at 1210/1210/1211, `if (childCodemode) {` at 1247/1247/1248 for 3.15.0/3.15.1/3.15.2): name 3.15.2 as the newest version read and S4 (3.15.1) as measured.

**`CHANGELOG.md`.** One reader-facing aggregate bullet per `.agents/skills/changelog/rules/entries.md`; it tells users of root-source plugins such as `anthropics/skills` to run `reinstall` once (D-PG4-02).

## Shared Patterns

### Notes never refuse an install

**Sources:** `S/domain/workflow-script.ts:800-808` (contained read), `S/shared/staging-warnings.ts:29-32` (tag), `S/orchestrators/plugin/install-outcome.ts:1240` and `update-swap.ts:1702-1705` (delivery).
**Apply to:** the `agentType` walk, the join, both delivery sites.

```typescript
/** Tags a message as a discovery warning. */
export function discoveryWarning(message: string): DiscoveryWarning {
  return { kind: "discovery", message };
}
```

Recompute; never persist (D-PG4-13): no `state.json` field, no schema change.

### Plugin-controlled text in a message

**Source:** `S/domain/workflow-script.ts:1064-1069`
**Apply to:** every span of the restriction note (file name, folder, agent type).

```typescript
export function forMessage(text: string): string {
  return text.replaceAll(
    /[\p{Cc}\p{Cf}]/gu,
    (character) => String.raw`\u{${Number(character.codePointAt(0)).toString(16)}}`,
  );
}
```

### Containment before any filesystem read

**Source:** `S/domain/component-paths.ts:14-39` (`resolveContainedComponentPath` over `assertPathInside`).
**Apply to:** the root-source branch (validate, then `statKind`), and the sibling rewrite by construction (lexical `path.resolve` only; the replacement is always a `../` run plus an `assertSafeName`-checked generated name, `stage.ts:288`).

### Required members over optional ones

**Source:** `S/domain/skill-tokens.ts:22-31`
**Apply to:** the sibling map on `SkillStagingContext`, the notes member on `DiscoveredGeneratedNames`.

```typescript
/**
 * Names selected by discovery for one plugin. Every member is required: a
 * caller that stages no workflows says so with an empty list rather than by
 * omission, which would let a bridge that forgot to thread the names compile.
 */
```

The one deliberate exception is the verdict's absent-when-empty `agentType` field, which follows `NamedWorkflow.gate`.

### Imports, comments, complexity

- Import order (`import-x/order`): `node:` builtins, externals, internal values, then `import type` last, each group blank-line separated and alphabetized. Test files import production modules by relative path with the `.ts` extension. Example: `test/bridges/skills/stage.test.ts:1-21`.
- Comments cite `D-PG4-NN`, `PG-CORE-01`, `PG-SKILL-04`, `PG-WF-01`, `PG-SEC-01`, and the Claude Code version read (`2.1.323`); never a phase, plan, or wave number. No comment on trivial code.
- Every new rule is its own small function: `collectStrictComponentKind`, `stageSkill`, `prepareUpdateHandles`, and the `info.ts` composers sit near the ESLint (15) and fallow (15 / 20) ceilings, which are computed independently.
- A loop `await` needs `// eslint-disable-next-line no-await-in-loop -- <reason>`; copy the reason style at `stage.ts:177`.
- `fallow dupes` fails on every clone group: one exported root-source predicate for the strict and lenient sites; check `$?`, not the glyph.

### Unit-test conventions

- `node:test` + `node:assert/strict` (+ `strong-mock` where an interaction is mocked). `// arrange`, `// act`, `// assert` sections. Whole-value `deepStrictEqual` or whole-string `strictEqual`; a case must fail under a plausible wrong implementation (`.agents/skills/typescript-unit-tests/rules/cases.md`).
- Every production source keeps its mirrored owner test and 100% direct coverage: `npm run test:coverage:direct -- <path>`. The two proposed sources each need a new owner test in the same commit (`test:corresponding`).
- Filesystem cases use real temp dirs with `t.after` cleanup (`discover-names.test.ts:12-16`, `version.test.ts:22-28`) or the hermetic environment (`test/platform/hermetic-environment.ts`). Never the real `~/.pi/agent`.
- Owner test command: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>`.

## No Analog Found

| Behavior / proposed file | Role | Data Flow | Reason |
|---|---|---|---|
| Relative-path token grammar and depth arithmetic of the sibling rewrite | utility | transform | `rewriteMarkdownReferences` supplies the function shape, but no code resolves a `../` token against a source location. Use RESEARCH "Rewrite rule" and "Code Examples: Sibling rewrite". |
| Whole-AST property walk for literal `agentType` | utility | transform | The module reads only the top-level `meta`; `gateContext` is the nearest contained walk, and its predicates are gate-specific. Use RESEARCH "Literal `agentType` values" sketch with `metaPropertyKey` and `literalString`. |
| Cucumber step for a model-started workflow run with a reduced tool result | test | event-driven | Run steps cover typed commands only (`runs.steps.ts`); the reduction precedents are in the hook and MCP verticals. Compose from the two analogs above. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,bridges/skills,bridges/workflows,bridges/agents,orchestrators/plugin,shared}`, their `test/` pairs, `features/{plugin,skill,workflow}`, `features/step_definitions/**`, `features/lib/published-marketplace.ts`, `docs/workflows-compatibility.md`, `.planning/upstream/`.
**Files scanned:** 31 (targeted line ranges; no file was read whole).
**Tracked-source gate:** every named existing analog was checked with `git ls-files` and is tracked. The engine source under `node_modules/.cache/optional-peers/` is research evidence for the upstream draft only and is never an edit target or an analog.
**Line numbers:** read from the working tree on 2026-11-13 at commit `5d900f5b`. `info.ts`, `install-outcome.ts`, and `update-swap.ts` are large; re-locate by symbol before editing.
**Not verified here:** `test/orchestrators/plugin/mcp-verdict.test.ts` is tracked but was not opened; the `admission(...)` projection in `workflow-script.test.ts` and the record-skills helper at `installation.steps.ts:302-310` were located, not read in full. No check was run and no source was changed.
**Pattern extraction date:** 2026-11-13
