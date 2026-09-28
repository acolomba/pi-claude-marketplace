# Phase 102: Workflow naming and script admission - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 5 (2 production TS, 1 manifest, 2 test) + 1 optional test
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/workflow-script.ts` (NEW) | domain module (pure decision) | transform (string -> verdict) | `extensions/pi-claude-marketplace/domain/source.ts` | exact (pure domain, hand-written parser, literal-tagged discriminated union) |
| `extensions/pi-claude-marketplace/domain/name.ts` (MODIFIED) | domain utility (name generation) | transform | itself — `generatedCommandName` / `generatedAgentName` (lines 86-122) | exact (in-file sibling) |
| `package.json` (MODIFIED) | config / manifest | n/a | `dependencies` block, lines 8-12 | exact |
| `tests/domain/workflow-script.test.ts` (NEW) | test | transform | `tests/domain/source.test.ts:14-45` (table-driven domain test) | exact |
| `tests/domain/name.test.ts` (MODIFIED) | test | transform | itself — CM-2 block (lines 123-144) | exact |
| `tests/architecture/*` acorn-in-deps pin (NEW, OPTIONAL) | test (architecture) | file-I/O (reads `package.json`) | `tests/architecture/no-telemetry-deps.test.ts` | exact |

Collision assertion (`assertNoWorkflowNameCollisions`) lives inside
`domain/workflow-script.ts` but its analog is `bridges/commands/stage.ts:77`.

## Pattern Assignments

### `extensions/pi-claude-marketplace/domain/workflow-script.ts` (NEW — domain, transform)

**Analog:** `extensions/pi-claude-marketplace/domain/source.ts`

Chosen over `domain/resolver.ts` deliberately: `resolver.ts` builds its union
from typebox `Type.Static<>` schemas because those shapes are persisted and
re-validated at load time. A workflow verdict is never persisted and never
crosses a disk boundary in this phase, so the plain hand-written union of
`source.ts` is the right precedent. `source.ts:3-9` states the rule verbatim
("TypeBox is not appropriate for character-level work").

**File-header comment pattern** (`domain/source.ts:1-22`):

```ts
// domain/source.ts
//
// Hand-written character-level source-string parser (D-06: TypeBox is not
// appropriate for character-level work). Discriminated `ParsedSource`
// union with literal-tagged variants -- TypeScript narrows automatically
// on `if (s.kind === 'path')` checks. Per D-08 / NFR-12, the `unknown`
// variant is the forward-compat tail: future source kinds become new
// branches; consumers that switch on `kind` get a static-exhaustiveness
// miss they can address.
//
// SECURITY (T-02-03): the path branch deliberately accepts ANY string
// starting with `./`, `../`, `/`, or `~/` as a path. NFR-10 path-traversal
// containment is the responsibility of the bridges + `assertPathInside`.
```

Copy the shape: `// domain/workflow-script.ts` on line 1, blank comment line,
then rationale paragraphs each anchored to a requirement ID (`WNAM-01`,
`WVAL-01`, `WVAL-03`). A SECURITY paragraph is warranted here too — this module
statically analyzes untrusted third-party JS and must state that it executes
nothing.

**Discriminated union pattern** (`domain/source.ts:24-71`):

```ts
export interface PathSource {
  readonly kind: "path";
  readonly raw: string; // SP-7: verbatim user input, never mutated
  readonly logical: string; // currently equal to raw; reserved for future canonicalization
}

export interface UnknownSource {
  readonly kind: "unknown";
  readonly raw: string;
  readonly reason: string; // human-readable; D-08 forward-compat tail
}

export type ParsedSource =
  PathSource | GitHubSource | UrlSource | GitSubdirSource | NpmSource | UnknownSource;
```

Copy exactly: one exported `interface` per arm, `readonly kind: "<literal>"`
as the FIRST field, every other field `readonly`, per-field trailing comments
carrying the requirement ID, then one exported `type` alias unioning them.
The four arms are `named` / `stem-fallback` / `skipped` / `refused`. Note the
`UnknownSource.reason: string` precedent — the `refused` arm's human-readable
reason string is the same idea, and the same `// human-readable` comment
justifies it. Per CONTEXT the reason is a *closed* set of shapes for the
caller to branch on, so prefer a literal-union reason discriminant over a bare
`string` where the caller must act on it.

**Reason-message helper pattern** (`domain/source.ts:89-113`) — small private
functions that build one message each, never inline template strings at the
throw/return site:

```ts
function unsupportedUrlReason(raw: string): string {
  const scheme = rejectedScheme(raw);
  return `${raw} is not supported; ${scheme} URLs are rejected -- only https:// URLs and local paths are accepted`;
}

/** MM-4: non-relative string sources -- the "fallthrough" reason. */
function nonRelativeReason(raw: string): string {
  return `non-relative string source ${raw} cannot be classified`;
}
```

Apply this to the WVAL-03 code-match vs comment-match vs string-match reasons:
three named private builders, not three inline literals. This is also what
keeps `sonarjs/cognitive-complexity: 15` satisfiable in the classification
function.

**Named-constant pattern for a regex** (`domain/source.ts:119-124`) — the
constant carries a doc comment stating the invariant it encodes and who
depends on it:

```ts
/**
 * Clone-key / sha-version invariant (domain/clone-key.ts, domain/version.ts):
 * a git source's `sha` must be the FULL 40-hex commit sha -- `pluginCloneKey`
 * and `shaVersion` slice its first 12 chars unchecked.
 */
const FULL_SHA_RE = /^[0-9a-f]{40}$/i;
```

`DETERMINISM_BLOCKLIST` takes this exact form. RESEARCH Code Examples §3
already supplies the doc-comment body; note it is non-global by design (a
`/g` module constant carries `lastIndex` across calls).

**Imports pattern** (`bridges/commands/stage.ts:23-53`) — groups separated by
blank lines, alphabetized within group, `import type` last:

```ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { discoverPluginCommands } from "./discover.ts";

import type { DiscoveredCommand } from "./types.ts";
```

For the new module the groups are: `external` (`import { parse, tokTypes } from
"acorn"`), `parent` (`../shared/errors.ts` for `assertNever`), `sibling`
(`./name.ts`), then `type` (`import type { Comment, Program, Property, Token }
from "acorn"`). No `node:` group — this module touches no builtins.

**Collision-throw pattern** (`bridges/commands/stage.ts:66-101`) — read
verbatim; mirror both the doc comment (which shows the rendered message) and
the body:

```ts
/**
 * RN-6: detect two source command names that elide to the same generated
 * name. When a collision is found, throw with BOTH source names listed so
 * the user can resolve it without guessing which two collided.
 *
 * Single-collision message:
 *   `Generated command name collision detected. Rename one of the source commands:
 *      "acme:deploy" <- ["acme-deploy", "deploy"]`
 *
 * Multi-collision messages join each line on a fresh `\n  ` separator.
 */
export function assertNoCommandCollisions(discovered: readonly DiscoveredCommand[]): void {
  const groups = new Map<string, string[]>();

  for (const c of discovered) {
    const arr = groups.get(c.generatedName) ?? [];
    arr.push(c.sourceName);
    groups.set(c.generatedName, arr);
  }

  const collisions: string[] = [];

  for (const [gen, sources] of groups) {
    if (sources.length > 1) {
      const quotedSources = sources.map((s) => `"${s}"`).join(", ");
      collisions.push(`"${gen}" <- [${quotedSources}]`);
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `Generated command name collision detected. Rename one of the source commands:\n  ` +
        collisions.join("\n  "),
    );
  }
}
```

Structure to keep byte-for-byte: `Map<string, string[]>` grouping, the
`?? []` push-back-set idiom, the `"${gen}" <- [${quotedSources}]` entry
template, and the `\n  ` lead-and-join. Change the nouns only ("command" ->
"workflow") and — per CONTEXT — the grouped-under identifier is the **file
name**, not a `sourceName`. Note `sonarjs/no-identical-functions` is an error
in this repo: the two functions differ in message text and in the field read
off the record, which is enough divergence, but the executor should not
"helpfully" factor them into one shared helper across the `domain/` <->
`bridges/` boundary (domain must not import from bridges).

**Exhaustiveness pattern** (`bridges/hooks/if-field/glob.ts:260-274`):

```ts
switch (tok.kind) {
  case "literal":
    return /* ... */;
  case "slash":
    return /* ... */;
  default:
    return assertNever(tok);
}
```

`assertNever` is defined at `extensions/pi-claude-marketplace/shared/errors.ts:12`:

```ts
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
```

Import it as `import { assertNever } from "../shared/errors.ts";`. Note the
call form is `return assertNever(x)` in the `default:` arm, never a bare
statement. In this phase the union's exhaustive consumer is Phase 103, so the
`assertNever` import may only appear in the tests here — that is acceptable and
expected; do not manufacture a switch in production code just to use it.

---

### `extensions/pi-claude-marketplace/domain/name.ts` (MODIFIED — domain, transform)

**Analog:** the file itself. `generatedCommandName` (line 86-88) is the exact
shape the new generator copies: a thin exported wrapper with an explicit return
type over the private `generatedColonName`.

**The wrapper to mirror** (`domain/name.ts:79-103`):

```ts
/**
 * Command name generator (RN-1 / CM-2).
 *
 * Format: `<plugin>:<command>` -- the SEPARATOR is a colon, distinct from
 * the dash separator used by skills/agents. The `<plugin>-` prefix is
 * elided from `source` (acme + acme-foo -> acme:foo, NOT acme:acme-foo).
 */
export function generatedCommandName(plugin: string, source: string): string {
  return generatedColonName(plugin, source);
}

function generatedColonName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const prefix = `${plugin}-`;
  const elided = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  // Re-validate the elided portion in isolation to catch e.g. an "acme-"
  // source that elides to empty.
  assertSafeName(elided);
  const generated = `${plugin}:${elided}`;
  // Note: assertSafeName on the colon-bearing form -- colon is allowed
  // (PRD §6.5 RN-2 forbids only "/" and "\"), so this passes.
  assertSafeName(generated);
  return generated;
}
```

`generatedWorkflowName` goes directly after `generatedCommandName` (before
`generatedAgentName` at line 113) and reads:
`export function generatedWorkflowName(plugin: string, source: string): string`
— doc comment headed `Workflow name generator (RN-1 / WNAM-06).`, body calling
`generatedColonName(plugin, source)` **unchanged**, then the new gate. Do NOT
touch `generatedColonName` itself: WNAM-06 requires it reused unchanged, and
four existing tests pin its elision.

**The new private gate — pattern from `assertSafeName`** (`domain/name.ts:8-51`):

```ts
/**
 * RN-2: validate that a name is safe to use as a path basename / generated
 * resource name. Throws Error with descriptive message on failure.
 *
 * Rules (verbatim from PRD §6.5):
 *   - non-empty after trim
 *   ...
 */
export function assertSafeName(name: string, label?: string): void {
  const prefix = label === undefined ? "Name " : `${label} `;

  if (name.trim() === "") {
    throw new Error(`${prefix}must be a non-empty string.`);
  }

  if (name === "." || name === "..") {
    throw new Error(`${prefix}must not be "." or "..".`);
  }
  // ... one `if` per rule, each with its own message
}
```

Copy: `assert*`-prefixed name, `: void` return, a doc comment listing the rules
verbatim from the source of truth (here, the engine's
`isSafeSavedWorkflowName` at `dist/workflow-saved.js:7-14`, quoted in RESEARCH
Pitfall 1), one flat `if` per rule, each throwing a plain `Error` with its own
distinct message. Two rules only: `length > 128` and `trim() !== name`. It is
private (no `export`) — mirrors `generatedColonName`, which is private for the
same reason. The file-header comment at `domain/name.ts:1-6` already warns that
"one shared helper that handled all three was a recurring bug surface", which
is the standing argument against widening `assertSafeName`.

---

### `package.json` (MODIFIED — config)

**Analog:** the existing `dependencies` block, lines 8-12:

```json
  "dependencies": {
    "isomorphic-git": "^1.38.1",
    "proper-lockfile": "^4.1.2",
    "write-file-atomic": "^8.0.0"
  },
```

The block is alphabetized, so `"acorn": "^8.16.0",` becomes the FIRST key.
Every top-level key in this manifest is alphabetized too (`author`, `bugs`,
`dependencies`, `description`, `devDependencies`, ...) — do not disturb that.
Regenerate the lock per RESEARCH Change Map row 2 (hand-edit then bare
`npm install`, not `npm install acorn`).

---

### `tests/domain/workflow-script.test.ts` (NEW — test)

**Analog:** `tests/domain/source.test.ts` — the table-driven domain-parser
suite, the closest existing match by both role and data flow (pure function,
many input shapes, one verdict each).

**Header + table pattern** (`tests/domain/source.test.ts:1-45`):

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  githubSource,
  parsePluginSource,
  pathSource,
  samePlannedSource,
  sourceLogical,
  type ParsedSource,
  type SamePlannedSourceResult,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";

/**
 * PRD §6.1 SP-1..7 + MM-4 + NFR-12 -- table-driven accept/reject coverage
 * for the hand-written parser. Each row maps 1:1 to a requirement so
 * `grep -n "SP-2"` etc. is the source-of-truth audit.
 */

interface AcceptCase {
  readonly name: string;
  readonly raw: unknown;
  readonly expect: Partial<ParsedSource> & { kind: ParsedSource["kind"] };
}

interface RejectCase {
  readonly name: string;
  readonly raw: string;
  readonly reasonContains: string;
}

const ACCEPT_CASES: readonly AcceptCase[] = [
  { name: "SP-7 bare tilde", raw: "~", expect: { kind: "path", raw: "~", logical: "~" } },
  { name: "SP-1 ./relative", raw: "./pkg", expect: { kind: "path", raw: "./pkg" } },
  // ...
];
```

Copy exactly: `node:assert/strict` + `node:test` builtin group, one blank
line, the production import with an explicit `.ts` extension and `type`
members trailing inside the same braces; a block doc comment stating the
requirement range and the "each row maps 1:1 to a requirement so `grep -n`
is the audit" contract; `readonly` case interfaces; `readonly X[] =` const
tables SCREAMING_SNAKE_CASE.

The workflow analogue's case rows carry the script source as an **inline
template literal** on the row (`readonly source: string`), never a path to a
fixture file. RESEARCH Pitfall 4 is decisive: three repo gates (`format:check`
over `**/*.{js,json,ts}`, `eslint extensions tests` with `projectService`, and
the prettier pre-commit hook) reject an on-disk `.js` fixture, and
`find tests -name "*.js"` returns zero today. Note `tests/domain/fixtures/`
exists but holds no `.js`.

**Test-title pattern** (`tests/domain/name.test.ts:97`, `:127`) — requirement
ID first, then behavior, no planning references (`.claude/rules/typescript-comments.md`):

```ts
test("SK-2 generatedSkillName basic case", () => {
  assert.equal(generatedSkillName("acme", "foo"), "acme-foo");
});
```

Workflow titles read `WNAM-01 ...`, `WVAL-03 ...`, `SC-4 ...`.

**Section-banner pattern** (`tests/domain/name.test.ts:93-95`) — used to
separate requirement groups within one file:

```ts
// ──────────────────────────────────────────────────────────────────────────
// RN-1 / SK-2: generatedSkillName -- "<plugin>-<skill>" with prefix elision
// ──────────────────────────────────────────────────────────────────────────
```

---

### `tests/domain/name.test.ts` (MODIFIED — test)

**Analog:** its own CM-2 block, lines 123-144, which the new WNAM-06 / SC-4
section goes directly after (before the AG-1 banner at line 146):

```ts
// ──────────────────────────────────────────────────────────────────────────
// RN-1 / CM-2: generatedCommandName -- "<plugin>:<command>" with prefix elision
// ──────────────────────────────────────────────────────────────────────────

test("CM-2 generatedCommandName basic case", () => {
  assert.equal(generatedCommandName("acme", "foo"), "acme:foo");
});

test("CM-2 generatedCommandName elides plugin- prefix from source", () => {
  assert.equal(generatedCommandName("acme", "acme-foo"), "acme:foo");
});

test("CM-2 generatedCommandName uses COLON separator (not dash)", () => {
  const result = generatedCommandName("acme", "foo");
  assert.ok(result.includes(":"), `expected colon in "${result}"`);
  assert.ok(!result.startsWith("acme-"), `expected colon-form, got "${result}"`);
});

test("CM-2 generatedCommandName throws when elision yields empty string", () => {
  // source 'acme-' elides to '' which fails assertSafeName
  assert.throws(() => generatedCommandName("acme", "acme-"), /non-empty/);
});
```

Four rows, mirrored one-for-one for workflows: basic case, prefix elision,
colon-accepted (the "no `:`-sanitizing step" pin — mirror the
`assertSafeName("acme:foo")` doesNotThrow at line 27-31), plus the two new
SC-4 rejections.

**Rejection-assertion pattern** — `assert.throws(fn, /regex/)` matching a
distinctive *substring of the message*, not the whole message and not an error
class (these are plain `Error`s):

```ts
assert.throws(() => generatedCommandName("acme", "acme-"), /non-empty/);
```

So the >128 case matches something like `/128/` and the untrimmed case
`/whitespace/` — whatever substring the new gate's messages actually carry.
Also add `generatedWorkflowName` to the import block at lines 4-9, keeping it
alphabetized (`assertSafeName, generatedAgentName, generatedCommandName,
generatedSkillName, generatedWorkflowName`).

---

### Optional acorn-dependency pin (NEW — test, architecture)

**Analog:** `tests/architecture/no-telemetry-deps.test.ts` (whole file, 62
lines) — the repo's only precedent for asserting on `package.json` contents.

**Repo-root resolution + read pattern** (lines 1-7, 37-46):

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

test("no telemetry / analytics dependencies in package.json (IL-4)", async () => {
  const raw = await readFile(path.join(REPO_ROOT, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as PackageJson;
  ...
});
```

Copy: `REPO_ROOT` derived from `import.meta.url` with `"../.."` (a test two
levels below the repo root), a local `interface PackageJson` with all four
optional dep maps, `readFile(..., "utf8")` + `JSON.parse(raw) as PackageJson`,
`async` test fn, and a failure message that names the requirement ID
(`IL-4 violation: ...`). For WDOC-03 assert **membership** of `"acorn"` in
`pkg.dependencies`, not the version string, so a future caret bump does not
fail the gate (RESEARCH note under the Requirements→Test map).

Note the file uses a plain `for` loop with no blank line before the closing
`assert` — `@stylistic/padding-line-between-statements` requires a blank line
after block-like statements, so match the surrounding file rather than
reformatting.

## Shared Patterns

### Explicit return types on every export

**Source:** `domain/name.ts:23` (`: void`), `:64` (`: string`);
`domain/source.ts:292` (`: ParsedSource`)
**Apply to:** every exported function in `workflow-script.ts` and `name.ts`
**Why:** `@typescript-eslint/explicit-module-boundary-types: "error"`.

### Requirement-ID-anchored comments and test titles

**Source:** `domain/name.ts:9` (`RN-2:`), `bridges/commands/stage.ts:67`
(`RN-6:`), `tests/domain/name.test.ts:97` (`SK-2 ...`)
**Apply to:** every doc comment, inline rationale comment, and test title
**Rule:** `.claude/rules/typescript-comments.md` — `WNAM-0N` / `WVAL-0N` /
`WDOC-03` / `SC-4` / `D-NN` are ALLOWED and encouraged. `Phase 102`,
`Plan NN`, `Wave N`, `Pitfall N` are FORBIDDEN. RESEARCH's own prose says
"Pitfall 1" and "Pattern 3" repeatedly — those labels must NOT reach source.

### Plain `Error` with a self-describing message for name/collision failures

**Source:** `domain/name.ts:33,37,41,48`; `bridges/commands/stage.ts:96`
**Apply to:** the collision throw and the two new engine-parity gate throws
**Why:** CONTEXT locks "no typed error class is added" for the collision, and
`domain/name.ts` already throws plain `Error` for every RN-2 violation. The
typed-error-class convention in CONVENTIONS.md applies to `shared/errors.ts`
domain errors that callers narrow on via `instanceof`; nothing narrows on
these.

### `readonly` on every union-arm field and every case-table entry

**Source:** `domain/source.ts:24-68`; `tests/domain/source.test.ts:20-30`
**Apply to:** the verdict union and the test case tables

### Test imports use explicit `.ts` extensions and relative paths

**Source:** `tests/domain/name.test.ts:4-9`, `tests/domain/source.test.ts:4-12`
**Apply to:** both test files. No path aliases exist in this repo.

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| acorn AST walking (`parse`, `onComment`, `onToken`, `Property.key` narrowing) | domain | transform | **No existing analog in this codebase.** Nothing under `extensions/` imports acorn or walks a JS AST today. The verified-in-repo skeleton in RESEARCH Code Examples §1 (typechecked, linted, prettier-clean, then deleted) is the substitute for an analog and the planner should reference it directly. |
| Vendoring a copy of a third-party internal constant | domain | n/a | No precedent. The closest thing is `domain/source.ts:124`'s `FULL_SHA_RE` — a named regex constant with a doc comment naming its dependents — which supplies the *form* but not the "byte-identical copy of an upstream private, re-check on upgrade" rationale. RESEARCH Code Examples §3 supplies that comment body. |
| Comment/string-range containment classification | domain | transform | No analog. `bridges/hooks/if-field/glob.ts` is the only tokenizer-shaped code in the repo and it tokenizes globs, not JS; its value here is the `assertNever` switch idiom (cited above), not its scanning approach. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/domain/`,
`extensions/pi-claude-marketplace/bridges/commands/`,
`extensions/pi-claude-marketplace/bridges/hooks/if-field/`,
`extensions/pi-claude-marketplace/shared/errors.ts`, `tests/domain/`,
`tests/architecture/`, `package.json`
**Files read this pass:** 8
**Pattern extraction date:** 2026-08-15
