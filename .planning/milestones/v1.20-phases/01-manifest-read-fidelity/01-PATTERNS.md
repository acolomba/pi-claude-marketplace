# Phase 1: Manifest read fidelity - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 11 (4 created, 7 modified)
**Analogs found:** 11 / 11
**Tracked-source gate:** every analog path below verified with `git ls-files` (13/13 tracked). No gitignored mirror paths appear in this document.

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/manifest-path.ts` | NEW | domain constant (leaf) | pure / no I/O | `extensions/pi-claude-marketplace/domain/version.ts` (frozen const + stability-contract header); `domain/manifest-lookup.ts` (leaf-placement rationale header) | exact |
| `extensions/pi-claude-marketplace/domain/dependencies.ts` | NEW | domain parser (leaf) | transform (untrusted `unknown` → typed) | `extensions/pi-claude-marketplace/domain/source.ts::parsePluginSource` | exact |
| `tests/domain/manifest-path.test.ts` | NEW | test (mandatory pair) | pure assertions | `tests/domain/manifest-lookup.test.ts` | exact |
| `tests/domain/dependencies.test.ts` | NEW | test (mandatory pair) | pure assertions | `tests/domain/manifest-lookup.test.ts` | exact |
| `tests/architecture/<cross-reader>.test.ts` | NEW | architecture behavioral test | file-I/O (plants real tree) | `tests/architecture/integration-materialization-gate.test.ts` (planting) + `tests/architecture/manifest-lookup-drift.test.ts` (header/purpose framing) | exact |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | MOD | domain resolver | file-I/O via injected seams | itself — `readManifest` / `validateComponentPath` current bytes | in-place |
| `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` | MOD | orchestrator helper | file-I/O (real disk, no seam) | `domain/resolver.ts::readManifest` stat-then-read gate | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | MOD | orchestrator (read surface) | file-I/O + transform + render | `info.ts::readLenientHookSummary` / `readLenientHooksFile` (same file, fs-only no-network tolerant read) | exact |
| `extensions/pi-claude-marketplace/bridges/skills/discover.ts` | MOD | bridge discover | file-I/O + dedup | `extensions/pi-claude-marketplace/bridges/commands/discover.ts::seenByFile` | exact (semantics inverted — see note) |
| `docs/output-catalog.md` | MOD | docs (user contract) | catalogued byte state | `installed-single-scope-with-dependencies` block at `docs/output-catalog.md:1740-1768` | exact |
| `tests/architecture/catalog-uat.test.ts` (FIXTURES + count) | MOD | test fixture table | data | `FIXTURES["/claude:plugin info <plugin>@<marketplace>"]["installed-single-scope-with-dependencies"]` at `:3347` | exact |

---

## Pattern Assignments

### `domain/manifest-path.ts` (domain constant, pure)

**Analog:** `extensions/pi-claude-marketplace/domain/version.ts` (frozen constant + contract header) and `extensions/pi-claude-marketplace/domain/manifest-lookup.ts` (leaf-placement header).

**File header pattern** (`domain/manifest-lookup.ts:1-11`) — state the rule, name the consumers, justify `domain/` placement, cite the decision ID:

```ts
// domain/manifest-lookup.ts
//
// The membership rule: does a marketplace manifest DECLARE a given plugin
// name? Every surface that renders an absence claim -- the list inventory row
// (INV-01), the info block (INFO-09 / INFO-10 / BOUND-02) and the update
// transition row -- reads it from here, so the three cannot drift apart.
//
// D-99-02a: the rule lives in `domain/` because it is a pure, network-free,
// write-free derivation over a domain type. `domain/` depends only on
// `shared/`, so no consumer can close an import cycle by reading it.
```

Adapt verbatim in shape: name the THREE readers (`domain/resolver.ts::readManifest`,
`orchestrators/plugin/shared.ts::resolvePluginVersion`, and the new `info.ts` read per
D-01-32), cite D-01-06 / D-01-07 / MANF-01 / MANF-02.

**Frozen-constant + stability-contract pattern** (`domain/version.ts:24-27`):

```ts
/** D-12: walk filter -- entries by name that are skipped at every level. */
const HASH_WALK_SKIP = Object.freeze([".git", "node_modules", ".DS_Store"] as const);

const HASH_TRUNC = 12;
```

`version.ts:9-18` carries the ordered-algorithm + stability-contract comment block that
`MANIFEST_CANDIDATES` should mirror — ORDER IS THE CONTRACT (wrapped first, bare second),
and a change to that order is a user-visible behavior change.

**Import discipline:** `version.ts` imports `node:path`; `manifest-lookup.ts` imports only a
type. Either is legal for `manifest-path.ts` under `.fallowrc.json`
`{ "from": "domain", "allow": ["shared", "platform"] }`. If `MANIFEST_CANDIDATES` ships as
pre-joined relative paths (CONTEXT discretion), prefer `path.join` at module load over hand-written
separators so Windows byte form matches — `version.ts:56-58` documents the posix-vs-OS joiner
distinction and is the in-repo precedent for thinking about it.

---

### `domain/dependencies.ts` (domain parser, untrusted `unknown` → typed)

**Analog:** `extensions/pi-claude-marketplace/domain/source.ts::parsePluginSource`. This is the
codebase's canonical pure parser over an untrusted field: `unknown` at the boundary, `readonly`
typed interfaces out, arm-ordered dispatch, `@`-splitting on `lastIndexOf`.

**Boundary signature + non-string arm** (`domain/source.ts:371-383`):

```ts
export function parsePluginSource(raw: unknown): ParsedSource {
  if (typeof raw !== "string") {
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      return parseObjectPluginSource(raw as Record<string, unknown>);
    }

    return { kind: "unknown", raw: String(raw), reason: "source must be a string or object" };
  }

  // Arm order is load-bearing: paths, then URL schemes, then the scheme-less
  // shorthands as the catch-all.
  return parsePathSourceForm(raw) ?? parseUrlSourceForm(raw) ?? parseShorthandSourceForm(raw);
}
```

This is the exact shape `dependencies.ts` wants: an element-level `parse(raw: unknown)` that
splits string-arm from object-arm, with the object arm widened via `as Record<string, unknown>`
(RESEARCH Pattern 3 — the widening is mandatory here because the schema field is
`Type.Optional(Type.Unknown())` at `domain/components/plugin.ts:82-83` and `:104`).

**Readonly typed result interfaces** (`domain/source.ts:39-68`):

```ts
export interface UrlSource {
  readonly kind: "url";
  readonly raw: string;
  readonly url: string;
  readonly ref?: string;
  readonly sha?: string;
}
```

Every field `readonly`, optionals as `?:`. The parsed dependency type per D-01-20 / D-01-26 is
therefore `{ readonly name: string; readonly version?: string; readonly marketplace?: string; readonly sha?: string }`.

**`@`-splitting precedence** (`domain/source.ts:349-368`, `parseShorthandSourceForm`) — the
in-repo template for D-01-27's ordered bare-string split (trailing `@^<range>`, then
`@<marketplace>`, then the name). Note it splits on the LAST `@` and falls back to a rejected
arm when the left half does not validate:

```ts
function parseShorthandSourceForm(raw: string): ParsedSource {
  const atIdx = raw.lastIndexOf("@");
  if (atIdx !== -1) {
    const github = parseOwnerRepo(raw.slice(0, atIdx), raw);
    const ref = raw.slice(atIdx + 1);
    if (github.kind === "github" && ref.length > 0) {
      return { ...github, ref };
    }

    return { kind: "unknown", raw, reason: nonRelativeReason(raw) };
  }
  ...
}
```

**Divergence from the analog, deliberate:** `parsePluginSource` returns an `unknown` ARM carrying a
`reason`. D-01-05 / D-01-25 say an unusable dependency element is DROPPED SILENTLY, so the
dependency parser returns `undefined` (or filters) rather than an `unknown`-kind arm. Do not
copy the `UnknownSource` reason-carrying arm — it would create catalog surface for a case
D-01-05 explicitly rejected.

**Allowlist constant** (D-01-25) — follow the `SCREAMING_SNAKE_CASE` module-constant convention
seen at `domain/version.ts:24-26` and `domain/source.ts:80-81`:

```ts
/** Per-user tilde reject message (SP-4). */
const TILDE_USER_HINT = "per-user tilde (~user/...) is not supported; use ~/...";
```

Do NOT reuse `assertSafeName` from `domain/name.ts` — D-01-25 forbids it (upstream validates
dependency entries more strictly than plugin names).

---

### `tests/domain/manifest-path.test.ts` and `tests/domain/dependencies.test.ts` (mandatory pairs)

**Analog:** `tests/domain/manifest-lookup.test.ts`.

**Import block + type-level assertion prelude** (`tests/domain/manifest-lookup.test.ts:1-20`):

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  lookupDeclaredPlugin,
  type ManifestLookup,
  type ManifestPluginEntry,
} from "../../extensions/pi-claude-marketplace/domain/manifest-lookup.ts";

void ({ name: "plugin", source: "./plugin" } satisfies ManifestPluginEntry);
void ({ kind: "absent" } satisfies ManifestLookup);
// @ts-expect-error A declared lookup includes its manifest entry.
void ({ kind: "declared" } satisfies ManifestLookup);
```

Three load-bearing details for the corresponding-test gate
(`scripts/check-corresponding-tests.mjs:10,134-171`):

1. The import must name the EXACT source path — a re-export proxy is a `proxy-owned` violation.
2. Explicit `.ts` extension, relative path, no alias.
3. `void (x satisfies T)` type-level assertions are the house idiom and are why
   `sonarjs/void-use` is scoped off `tests/**`.

**Test body pattern** (`tests/domain/manifest-lookup.test.ts:22-35`) — `// arrange` / `// act` /
`// assert` comment sections, one behavior per `test()`, sentence-case title naming the behavior
not the function.

---

### `tests/architecture/<cross-reader>.test.ts` (D-01-12)

**Analog for the planting mechanics:** `tests/architecture/integration-materialization-gate.test.ts`.
**Analog for the header framing:** `tests/architecture/manifest-lookup-drift.test.ts`.

**Temp-tree planting + cleanup** (`tests/architecture/integration-materialization-gate.test.ts:27-50`):

```ts
test("MCP-only staging materializes no agent, command, or skill target", async (t) => {
  // arrange
  const scopeRoot = await mkdtemp(path.join(tmpdir(), "mcp-materialization-isolation-"));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", scopeRoot);
  const pluginRoot = path.join(scopeRoot, "plugin-source");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "dormant"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    '{"name":"acme","version":"1.0.0","description":"case-local isolation source"}\n',
  );
```

Copy this exactly: `mkdtemp(path.join(tmpdir(), "<prefix>-"))`, `t.after(() => rm(..., { recursive: true, force: true, maxRetries: 3 }))`,
inline `writeFile` of the manifest. RESEARCH recommends option 2 (inline `writeFile`) over
extending `tests/edge/handlers/marketplace-seed.ts` — this analog IS option 2 and it needs no
new helper. Note it does NOT swap `HOME`; the cross-reader test does not need a hermetic HOME
either, since `resolveStrict` and `resolvePluginVersion` both take explicit roots.

**Header framing** (`tests/architecture/manifest-lookup-drift.test.ts:1-25`) — a `/** ... */`
block that names the hazard, the decision ID, and the two halves of the assertion. The
cross-reader test's two halves are: (a) `resolveStrict` honors the bare manifest, and
(b) `resolvePluginVersion` returns its declared version. Per D-01-32 add a third: (c) `info`'s
new manifest read finds the same file.

**HOME-swapping variant, if the `info` half needs it:** `tests/architecture/cross-op-convergence.test.ts:89-108`
holds the local `withHermeticHome` (there is NO shared `tests/helpers/` — write a local copy):

```ts
async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "xop-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "xop-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}
```

---

### `domain/resolver.ts` (domain resolver, file-I/O via injected seams)

**Analog:** itself. Both edits are in-place transformations of code already at the seam.

**`readManifest` — the one line that becomes a loop** (`domain/resolver.ts:628`):

```ts
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
  if ((await statKindOf(ctx)(manifestPath)) !== "file") {
    return { ok: true, manifest: null };
  }
```

The stat-then-read gate is already the D-01-07 shape; the change is to wrap it in
`for (const candidate of MANIFEST_CANDIDATES)` and `continue` ONLY on the stat miss, returning
`{ ok: true, manifest: null }` after the loop (D-01-13 / MANF-05).

**`validateComponentPath` — the resolve is already computed** (`domain/resolver.ts:987-999`):

```ts
  const candidate = path.resolve(pluginRoot, raw);

  try {
    await assertPathInside(pluginRoot, candidate, `component path "${kind}"`);
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return { ok: false, reason: `component path for "${kind}" escapes plugin root: "${raw}"` };
    }

    throw err;
  }

  return { ok: true, relative: raw };
```

D-01-14 replaces the final `raw` with `path.relative(pluginRoot, candidate)`, plus D-01-16's
`""` → `"."` guard. Note the `reason` string still echoes `raw` (the user-facing spelling), not
the normalized value — do not normalize inside the error message.

**Dedup consumer, unchanged** (`domain/resolver.ts:1002-1014`):

```ts
function addComponentPath(
  partial: PartialResolution,
  kind: SupportedPathKind,
  seenPaths: Set<string>,
  relative: string,
): void {
  if (seenPaths.has(relative)) {
    return;
  }

  seenPaths.add(relative);
  partial.componentPaths[kind].push(relative);
}
```

D-01-15 is satisfied by the upstream change alone — `addComponentPath` needs no edit, because the
normalized value arrives as `relative` and is both the key and the stored value.

**Do not miss the loose-mode sibling:** `collectLooseComponentKind` (`domain/resolver.ts:1396-1436`)
routes through the same `addValidatedComponentPath`, so it inherits normalization. Name it in the
plan so the change is not documented as strict-only.

---

### `orchestrators/plugin/shared.ts` (orchestrator helper, real-disk read)

**Analog:** `domain/resolver.ts::readManifest`'s stat-then-read gate (quoted above). D-01-11 asks
for a structurally matching loop, deliberately.

**Current bytes to replace** (`orchestrators/plugin/shared.ts:914-935`):

```ts
export async function resolvePluginVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
): Promise<string> {
  // Tier 1: the plugin's own plugin.json `version`. Re-read in place; any
  // failure falls through to the next tier (D-23-02 / D-23-03).
  try {
    const manifestPath = path.join(installable.pluginRoot, ".claude-plugin", "plugin.json");
    const raw = await readFile(manifestPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const pluginJsonVersion = (parsed as { version?: unknown }).version;
    if (typeof pluginJsonVersion === "string" && pluginJsonVersion.length > 0) {
      return pluginJsonVersion;
    }
  } catch {
    // Fall through -- plugin.json is absent, unparseable, or carries no usable
    // version; tier 2 / tier 3 cover it.
  }
```

**Import pattern** (`orchestrators/plugin/shared.ts:16-19`) — D-01-23 says extend the existing
`node:fs/promises` import, alphabetized:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";

import { computeHashVersion } from "../../domain/version.ts";
```

becomes `import { readFile, stat } from "node:fs/promises";` plus a new
`import { MANIFEST_CANDIDATES } from "../../domain/manifest-path.ts";` slotted alphabetically
BEFORE `../../domain/version.ts` in the internal group (`import-x/order`, `alphabetize: asc`).
The file header at `:12-14` already declares `may import from domain/` — no boundary edit needed.

**Note the untrusted-field widening idiom is already here:** `(parsed as { version?: unknown }).version`.
Preserve it; it is the same RESEARCH Pattern 3 widening `info.ts:838` uses.

---

### `orchestrators/plugin/info.ts` (orchestrator read surface)

Two distinct edits. Both have analogs INSIDE the same file — prefer them over cross-file patterns.

**(a) The new D-01-32 manifest read.** Analog: `readLenientHookSummary` / `readLenientHooksFile`
(`orchestrators/plugin/info.ts:557-618`) — the file's own fs-only, no-network, tolerant
`<pluginRoot>/...` reader, with an explicit errno contract in its doc comment:

```ts
/**
 * ... Error contract -- parity with `readEntriesOrEmpty` and with the
 * strict sibling `readHookSummaryEntries`: ENOENT / ENOTDIR / SyntaxError
 * / wrong-shape collapse to `undefined`; EACCES / EPERM / EIO and every
 * other programmer-bug throw PROPAGATE to the row builder's outer catch
 * for classification via `narrowProbeError`. NFR-5: reads
 * `<pluginRoot>/hooks/hooks.json` only, no network.
 */
```

```ts
async function readLenientHooksFile(absPath: string): Promise<string | undefined> {
  try {
    return await readFile(absPath, "utf8");
  } catch (err) {
    if (isErrnoException(err) && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return undefined;
    }

    throw err;
  }
}
```

Copy the doc-comment shape (state the errno contract AND the `NFR-5: reads <path> only, no
network` sentence — `info.ts` is pinned by `tests/architecture/no-orchestrator-network.test.ts`,
so this sentence is load-bearing documentation for the gate reviewer). D-01-32's "readable
without network" fallback maps onto this file's existing `derivePluginRootForInfo`
(`info.ts:216-242`), which already re-derives `pluginRoot` for a path source and calls
`assertPathInside`:

```ts
  const pluginRoot = path.resolve(marketplaceRoot, source.raw);
  await assertPathInside(marketplaceRoot, pluginRoot, `plugin source for "${source.raw}"`);
  return pluginRoot;
```

Note D-01-11 specifies a stat-first probe for the OTHER two readers; here the tolerant
`catch (ENOENT/ENOTDIR) → undefined` form is the established in-file contract, and using it
avoids adding a third structurally identical stat loop (see the duplication note below).

**(b) `normalizeDependencies` → parse + render.** Current bytes
(`orchestrators/plugin/info.ts:333-345`):

```ts
function normalizeDependencies(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const strings = raw.filter((d): d is string => typeof d === "string");
  if (strings.length === 0) {
    return undefined;
  }

  return [...strings].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
```

Call site (`orchestrators/plugin/info.ts:838`):

```ts
  const dependencies = normalizeDependencies((entry as Record<string, unknown>).dependencies);
```

Three things to preserve exactly:

- The `(entry as Record<string, unknown>)` widening (RESEARCH Pattern 3).
- The comparator `(a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })` — D-01-04
  moves it onto the dependency NAME, but the options object must not change or existing fixture
  byte order shifts.
- The empty-result → `undefined` contract, because `shared/notify.ts:3563-3565` omits the line
  on `undefined`:
  ```ts
  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
  ```
  notify stays a dumb renderer (IL-2). Its interface doc comment at `shared/notify.ts:1504-1508`
  says "in `<plugin>@<marketplace>` form" and needs a wording update for D-01-01/D-01-30; the
  CODE does not change.

---

### `bridges/skills/discover.ts` (bridge discover, `seenByDir` — D-01-21)

**Analog:** `extensions/pi-claude-marketplace/bridges/commands/discover.ts::seenByFile`. The two
bridges are an existing fallow-reported mirrored clone pair (D-01-24), so the shapes should stay
parallel.

**Map declaration + rationale comment** (`bridges/commands/discover.ts:359-366`):

```ts
  const seenByGenerated = new Map<string, DiscoveredCommand>();
  // Keyed on the absolute source file. Two componentPaths.commands entries
  // that overlap -- "commands" and "commands/build", say -- reach the same
  // file at two different depths, so it generates two DIFFERENT names and
  // the dedup above never sees it. Both names install and the user gets the
  // one command twice under two spellings, which is worth saying out loud.
  const seenByFile = new Map<string, DiscoveredCommand>();
```

**Check-and-record** (`bridges/commands/discover.ts:384-397`):

```ts
      const sameFile = seenByFile.get(command.commandFile);
      if (sameFile !== undefined) {
        warnings.push(
          duplicateFileWarning(
            relFrom(input.resolved.pluginRoot, command.commandFile),
            sameFile.generatedName,
            command.generatedName,
          ),
        );
      }

      seenByFile.set(command.commandFile, command);
      seenByGenerated.set(command.generatedName, command);
```

**Two deliberate inversions — do NOT copy the analog's semantics, only its shape:**

1. **Placement.** `seenByFile` is consulted AFTER the `seenByGenerated` warning. D-01-21 requires
   `seenByDir` to be consulted BEFORE the `seenByGenerated` warning, at BOTH emission points.
2. **Effect.** `seenByFile` WARNS on a hit. `seenByDir` must `continue` SILENTLY on a hit (same
   resolved directory = one skill reached twice).

**The two emission points to guard** — subdir loop (`bridges/skills/discover.ts:184-200`):

```ts
      const generatedName = generatedSkillName(input.pluginName, entry.name);

      // D-07: first-wins dedup by GENERATED name. ...
      const winner = seenByGenerated.get(generatedName);
      if (winner !== undefined) {
        warnings.push(duplicateWarning(entry.name, skillsDir, generatedName, winner.sourceName));
        continue;
      }

      seenByGenerated.set(generatedName, {
        sourceName: entry.name,
        generatedName,
        skillDir: full,
      });
```

and `collectSelfSkillDir` (`bridges/skills/discover.ts:101-125`), whose signature grows a
`seenByDir` parameter alongside `seenByGenerated` and `warnings`:

```ts
async function collectSelfSkillDir(
  pluginName: string,
  skillsDir: string,
  seenByGenerated: Map<string, DiscoveredSkill>,
  warnings: string[],
): Promise<boolean> {
```

**Key-normalization hazard — verify before implementing.** The skills bridge joins with
`path.join`, which PRESERVES a trailing separator; the commands bridge uses `path.resolve`, which
strips it (`bridges/skills/discover.ts:154-156` vs `bridges/commands/discover.ts:372-374`):

```ts
    const skillsDir = path.isAbsolute(skillsRel)
      ? skillsRel
      : path.join(input.resolved.pluginRoot, skillsRel);
```

`path.join("/a", "./skills/")` → `"/a/skills/"`. `DiscoveredSkill.skillDir` is therefore not a
canonical key by construction. D-01-14's normalization removes trailing slashes upstream, but the
`seenByDir` key must still be canonicalized (`path.resolve(...)`) so the fix does not depend on
the resolver change having landed first, and so the self-skill-dir key (`skillsDir`) and the
subdir key (`full`) compare on the same footing.

**Regression safety:** all four existing collision tests in `tests/bridges/skills/discover.test.ts`
(`:246`, `:283`, `:321`, `:362`) use DISTINCT directories, so none changes.

---

### `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` (D-01-22, D-01-30)

Both walks are gated in each direction, so the doc block and the `FIXTURES` entry MUST land in
the same change (`tests/architecture/catalog-uat.test.ts:5228` forward, `:5374` inverse).

**Complete existing pair — use as the template.** Doc side (`docs/output-catalog.md:1751-1768`),
prose paragraph then the annotation then the fenced `text` block:

```markdown
### Success -- installed single scope with dependencies

Same as above but with a `dependencies: <plugin>@<marketplace>, ...` line emitted LAST (after every per-kind component line) per INFO-02. PI-13 keeps the field opaque at the manifest layer; when it contains an array of `<plugin>@<marketplace>` strings the orchestrator passes them through (sorted alphabetically). Severity `info`.

<!-- catalog-state: installed-single-scope-with-dependencies -->

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    agents: review-bot
    commands: c1, c2
    skills: commit-summary
    dependencies: helper@utils-mp
```
```

Fixture side (`tests/architecture/catalog-uat.test.ts:3347-3369`), keyed
`FIXTURES[<section>][<state>]`:

```ts
    "installed-single-scope-with-dependencies": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "claude-plugins-official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
          dependencies: ["helper@utils-mp"],
        },
      } satisfies NotificationMessage,
    },
```

**Three details the planner must carry:**

1. **The exact-count assertion must be bumped.** `tests/architecture/catalog-uat.test.ts:5236-5240`
   asserts `examples.length === 182` with a message saying to update it deliberately. Adding one
   catalog state makes it 183. This is not mentioned in RESEARCH and is a guaranteed red build
   otherwise.
2. **The section index comment must be amended.** The `// -----` block at
   `tests/architecture/catalog-uat.test.ts:3292-3323` enumerates every state under
   `/claude:plugin info <plugin>@<marketplace>` by name. Add the new state to that list.
3. **The existing state is not edited** (D-01-22). Its fixture value `["helper@utils-mp"]`
   already contains `@`, so D-01-03 passes it through verbatim and the bytes hold.
   Markdown is formatted by `mdformat` + `markdownlint-cli2` in pre-commit, NOT prettier.

---

## Shared Patterns

### Untrusted-field widening

**Source:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:838`,
`extensions/pi-claude-marketplace/domain/resolver.ts:1616-1620`
**Apply to:** `domain/dependencies.ts`, `info.ts` call site, `shared.ts` version extraction

```ts
  const dependencies = normalizeDependencies((entry as Record<string, unknown>).dependencies);
```

```ts
function noteDeclaredDependencies(entry: PluginEntry, partial: PartialResolution): void {
  if ((entry as Record<string, unknown>).dependencies !== undefined) {
    partial.notes.push(`declares dependencies that must be installed manually`);
  }
}
```

Rationale, stated in the resolver's own doc comment (`domain/resolver.ts:948-955`): "the
schema-level guard does not survive the `as unknown` coercion that the resolver uses to read
untrusted entry / manifest fields." Corollary from `domain/components/plugin.ts:11-12`: TypeBox
`Type.Optional` yields `T | undefined` in `Static<>`, so use `=== undefined`, never `in`.

### Typed result objects, not thrown errors, on this path

**Source:** `extensions/pi-claude-marketplace/domain/resolver.ts:624-651` (`{ ok, manifest } | { ok, reason }`),
`extensions/pi-claude-marketplace/domain/manifest-lookup.ts:32-35` (discriminated `kind` union)
**Apply to:** every new/modified function in this phase

```ts
export type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: ManifestPluginEntry }
  | { readonly kind: "absent" }
  | { readonly kind: "unverified" };
```

Do NOT add a class to `shared/errors.ts` for MANF-04. `shared/probe-classifiers.ts` has no
`malformed plugin.json:` arm and needs none — no closed-set amendment.

### Doc-comment traceability

**Source:** `domain/manifest-lookup.ts:1-11`, `domain/version.ts:9-18`, `domain/plugin-root.ts:1-12`
**Apply to:** both new modules and every amended function

Every header states WHY the module exists at that layer and cites durable IDs
(`D-99-02a`, `PI-7`, `NFR-7`, `INV-01`). Never `Phase N`, `Plan N`, `Wave N`, `Pitfall N`.

### Import ordering

**Source:** `tests/architecture/integration-materialization-gate.test.ts:1-12`,
`orchestrators/plugin/shared.ts:16-30`

builtin → external → internal, blank line between groups, alphabetized case-insensitively,
type-only imports last, explicit `.ts` extensions on every relative import.

---

## Duplication-Gate Assessment (Pitfall 7)

**Question:** do the resolver / shared.ts / info.ts candidate loops trip `fallow dupes` at
`threshold: 3`?

**Assessment: low risk, but the three-reader count under D-01-32 raises it above where RESEARCH
left it.** RESEARCH measured the baseline at `887 lines (1.3%) duplicated across 40 files` with
`npm run fallow` exiting 0 — comfortable headroom against a 3% ceiling. It assessed TWO loops.
D-01-32 makes it THREE. Mitigating facts:

- The threshold is a PERCENTAGE of total duplicated lines, not an occurrence count, so three
  short loops move the needle fractionally.
- The loop BODIES diverge sharply: resolver runs `PLUGIN_MANIFEST_VALIDATOR` and builds the
  `malformed plugin.json: <detail>` reason; `shared.ts` extracts `.version` and falls to tier 2;
  `info.ts` extracts `.dependencies` and falls back to the marketplace entry.
- The `info.ts` reader can and should follow the file's own `readLenientHooksFile` tolerant-catch
  contract (`info.ts:605-618`) rather than a third stat-first loop — this both matches the local
  convention and structurally de-duplicates the third instance.

**What the codebase does about deliberate parallel structure** — two mechanisms, both narrow:

1. `.fallowrc.json` `duplicates.ignoredClones` holds exactly TWO entries
   (`dup:cc950b18:2`, `dup:6d8c002d:2`), both in `tests/live-uat/*.mjs`, each justified by an
   inline comment header in BOTH cloned files (the array is `string[]`, so the justification
   cannot live in the JSON). Fingerprint keys are content-addressed `dup:<hash>`; the
   index-suffixed `dup:<hash>-NN` form is NOT stable and must never be used.
2. `sonar-project.properties` `sonar.cpd.exclusions` lists deliberately-parallel files
   (agents/commands bridge `stage.ts`, `orchestrators/plugin/shared.ts`, several
   `*.messaging.ts`). Note `orchestrators/plugin/shared.ts` is ALREADY on that list — the
   Sonar-side risk for reader 2 is already absorbed.

**Planner instruction:** do not pre-emptively add an `ignoredClones` entry. Implement, then run
`npm run fallow` and read the actual finding. If a clone is reported, prefer diverging the loop
bodies (the D-01-32 tolerant-catch route above) over adding a third suppression entry.

**Second, independent complexity risk worth flagging:** `sonarjs/cognitive-complexity: 15` and
fallow `health.maxCognitive: 15` are computed by DIFFERENT algorithms and must both pass. There
are currently ZERO `health.thresholdOverrides` in `.fallowrc.json`. The riskiest function is
`domain/dependencies.ts`'s bare-string parser (D-01-27's three-way ordered split + D-01-25's
allowlist + D-01-31's last-wins collapse). `domain/source.ts` handles equivalent branching by
splitting into small named helpers (`parseShorthandSourceForm`, `parseOwnerRepo`,
`stripUrlDecorations`) rather than one flat function — copy that decomposition.

## No Analog Found

None. Every file has an in-repo analog.

Two near-misses worth recording so the planner does not go looking:

| Sought | Verdict |
|--------|---------|
| A shared `tests/helpers/` module | Does NOT exist. `withHermeticHome` is a per-file local helper with three different signatures (`tests/architecture/cross-op-convergence.test.ts:89`, `tests/integration/transaction-lifecycle-cascade.test.ts:45`, `tests/orchestrators/plugin/info.test.ts:272`). Write a local copy; do not extract. `.planning/codebase/STACK.md` and `CONVENTIONS.md` are stale on this point. |
| A shared fixture helper that plants a plugin `plugin.json` | `tests/edge/handlers/marketplace-seed.ts::materializeMarketplaceTree` (`:137-155`) writes dirs and EMPTY files only — no manifest. The only manifest-writing helper is `seedWarmMirror` (`tests/orchestrators/plugin/info.test.ts:424-428`), which hardcodes the wrapped path and is git-mirror-only. Plant inline. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,orchestrators/plugin,bridges/{skills,commands},shared}/`, `tests/{domain,architecture,orchestrators/plugin,bridges/skills}/`, `docs/output-catalog.md`
**Files read this pass:** 14
**Tracked-source verification:** `git ls-files` over all 13 analog paths → 13 tracked
**Pattern extraction date:** 2026-09-13
