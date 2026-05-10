---
phase: 02-domain-core-persistence-primitives
reviewed: 2026-05-10T13:21:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - extensions/claude-marketplace/domain/components/mcp.ts
  - extensions/claude-marketplace/domain/components/plugin.ts
  - extensions/claude-marketplace/domain/index.ts
  - extensions/claude-marketplace/domain/manifest.ts
  - extensions/claude-marketplace/domain/name.ts
  - extensions/claude-marketplace/domain/resolver.ts
  - extensions/claude-marketplace/domain/source.ts
  - extensions/claude-marketplace/domain/version.ts
  - extensions/claude-marketplace/persistence/index.ts
  - extensions/claude-marketplace/persistence/locations.ts
  - extensions/claude-marketplace/persistence/migrate.ts
  - extensions/claude-marketplace/persistence/state-io.ts
  - extensions/claude-marketplace/shared/types.ts
  - extensions/claude-marketplace/transaction/index.ts
  - extensions/claude-marketplace/transaction/phase-ledger.ts
  - extensions/claude-marketplace/transaction/rollback.ts
  - extensions/claude-marketplace/transaction/with-state-guard.ts
  - tests/domain/manifest.test.ts
  - tests/domain/name.test.ts
  - tests/domain/resolver-loose.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/domain/resolver.types.test.ts
  - tests/domain/source.test.ts
  - tests/domain/version.test.ts
  - tests/persistence/locations.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/state-io.test.ts
  - tests/transaction/phase-ledger.test.ts
  - tests/transaction/rollback.test.ts
  - tests/transaction/with-state-guard.test.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-10T13:21:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 2 ships the domain-core and persistence primitives that every later
phase composes against: TypeBox schemas, the discriminated `installable`
resolver, the hash-version walker, atomic state I/O, legacy migration, and
the `runPhases` / `withStateGuard` transaction seam. Overall the
implementation is disciplined: the `installable: true | false` discriminator
is correctly tagged with literal types (no `discriminator:` option), all
TypeBox `Compile` imports use `typebox/compile`, atomic writes route through
`write-file-atomic`, the rollback marker uses the imported
`ROLLBACK_PARTIAL` constant, and `PathContainmentError` from undo paths is
re-thrown loudly per PI-14.

Three correctness defects do require fixes before this layer is composed by
Phase 3-5 callers:

1. The `pathSource()` factory used at state-load time does not actually
   validate the input parses as a path source -- it accepts any non-empty
   string. ST-6's "same factories" funnel is therefore broken: a tampered
   `state.json` claiming `kind:"path"` with a github URL inside `raw` is
   accepted verbatim. (BLOCKER)
2. The resolver's "already classified" branch trusts an entry-supplied
   source object whenever it has a `kind` field, with no shape validation.
   A marketplace.json with `source: { kind: "path", raw: 42 }` propagates
   into `path.resolve(marketplaceRoot, 42)` and crashes with a TypeError
   that is not a `PathContainmentError` and is not surfaced as
   `notInstallable`. (BLOCKER)
3. `assertSafeName(entry.name)` inside the resolver's preflight throws on
   third-party-input names like `".."`, `"../escape"`, or names with
   embedded NUL -- breaking the "everything else is `notInstallable`"
   contract that callers (Phase 5 orchestrators) rely on. The shipped
   resolver tests never exercise an unsafe entry name. (BLOCKER)

Beyond these, several warnings are worth addressing now while the surface
is cheap to change: the legacy migration only normalizes
`resources.agents` and `resources.mcpServers` (not `skills` / `prompts`),
which can leave a post-migration shape that the strict
`PLUGIN_INSTALL_RECORD_SCHEMA` rejects; `loadState` silently coerces an
on-disk `schemaVersion: 2` to `1`; and a stray `JSON.parse(raw) as
Record<string, unknown>` plus `"mcpServers" in parsed` will TypeError on a
literal `null` `.mcp.json`, which is then folded into the soft-fail note
(works, but masks the real shape error).

## Critical Issues

### CR-01: `pathSource()` factory does not validate input parses as a path

**File:** `extensions/claude-marketplace/domain/source.ts:169-175`

**Issue:** ST-6 / SP-6 contract says `pathSource()` and `githubSource()` are
"the SAME funnel used by both parse-time and state-load-time validation"
(verbatim from the file header, lines 13-16). `githubSource()` correctly
delegates to `parsePluginSource()` and rejects on `kind !== "github"`.
`pathSource()` does NOT -- it accepts any non-empty string and unconditionally
returns `{ kind: "path", raw, logical: raw }`.

Concrete consequence: a tampered or corrupt `state.json` storing
`{ kind: "path", raw: "https://github.com/o/r" }` flows through
`state-io.ts:172` (`mp.source = pathSource(obj.raw)`) and is accepted
verbatim. `STATE_VALIDATOR` then passes (the schema declares `source` as
`Type.Unknown()`). The resolver later receives a "path" source whose `raw`
is actually a URL and dispatches it to `path.resolve(marketplaceRoot, raw)`.
On a non-Windows host this resolves to `<marketplaceRoot>/https:/github.com/o/r`
-- a path containment escape only if the URL contains `..`, otherwise a
silently-wrong directory lookup that returns "source dir does not exist"
and looks like a benign user error.

This breaks the security promise of ST-6: state-load is supposed to be the
revalidation gate against tampering or schema drift.

**Fix:**
```typescript
export function pathSource(raw: string): PathSource {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Path source must be a non-empty string.");
  }

  const parsed = parsePluginSource(raw);
  if (parsed.kind !== "path") {
    const detail = parsed.kind === "unknown" ? parsed.reason : `wrong kind: ${parsed.kind}`;
    throw new Error(`Not a path source: ${raw} -- ${detail}`);
  }

  return parsed;
}
```

Add a test in `tests/domain/source.test.ts` mirroring the existing
`githubSource()` rejection coverage:
```typescript
test("SP-6 pathSource() throws on non-path input", () => {
  assert.throws(() => pathSource("https://github.com/o/r"), /Not a path source/);
  assert.throws(() => pathSource("owner/repo"), /Not a path source/);
});
```

---

### CR-02: Resolver trusts entry-supplied `source` object with only a `kind` field

**File:** `extensions/claude-marketplace/domain/resolver.ts:220-236`

**Issue:** The "Already classified (e.g., loaded from state.json). Trust
the kind tag." branch checks only that `entry.source` is a non-null object
with a `kind` property, then casts it directly: `parsedSource = entry.source
as ParsedSource`. It does NOT validate `raw`, `owner/repo` (for github),
or that `kind` is one of the three legal literals.

Concrete consequences when a marketplace.json author supplies a malformed
object source:

- `source: { kind: "path", raw: 42 }` → falls past the path-only gate at
  line 239 (kind === "path"), then at line 251
  `path.resolve(ctx.marketplaceRoot, parsedSource.raw)` is
  `path.resolve(root, 42)` which throws `TypeError: Path must be a string. Received 42`
  -- an uncaught throw, NOT a `notInstallable` result. Phase 5 orchestrators
  expecting "everything else is `notInstallable`" crash.
- `source: { kind: "path" }` (raw missing) → same crash.
- `source: { kind: "garbage", raw: "x" }` → falls through to the unsupported-source
  branch at line 239 and reports `unsupported source kind: garbage`. This
  case is fine, but only because of how the path-only check is written; a
  future refactor that switches on `kind` would break it.

The schema (`PLUGIN_ENTRY_VALIDATOR`) does not catch this because
`source: Type.Unknown()` is intentional per MM-3 -- the resolver IS the
validation gate, and it currently has a hole.

**Fix:** Tighten the object-form branch to revalidate via the same
factories ST-6 already documents as the "same funnel":
```typescript
} else if (
  typeof entry.source === "object" &&
  entry.source !== null &&
  "kind" in (entry.source as Record<string, unknown>)
) {
  const obj = entry.source as { kind?: unknown; raw?: unknown };
  try {
    if (obj.kind === "path" && typeof obj.raw === "string") {
      parsedSource = pathSource(obj.raw); // CR-01 fix makes this validating
    } else if (obj.kind === "github" && typeof obj.raw === "string") {
      parsedSource = githubSource(obj.raw);
    } else if (obj.kind === "unknown" && typeof obj.raw === "string") {
      parsedSource = entry.source as UnknownSource;
    } else {
      return {
        kind: "notInstallable",
        result: notInstallable(entry.name, partial, [
          `source field has malformed object shape (kind=${String(obj.kind)})`,
        ]),
      };
    }
  } catch (err) {
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [
        `source field is malformed: ${errorMessage(err)}`,
      ]),
    };
  }
}
```

Add resolver tests for `source: { kind: "path", raw: 42 }` and
`source: { kind: "path" }` (raw missing), each asserting `installable: false`
with a useful note rather than a thrown TypeError.

---

### CR-03: `resolver.preflightStages` throws on unsafe `entry.name`, breaking the `notInstallable` contract

**File:** `extensions/claude-marketplace/domain/resolver.ts:213-215`

**Issue:** `assertSafeName(entry.name)` is called at preflight before any
`notInstallable` short-circuit. The accompanying comment claims "Caller bug
if name validation throws -- entry came through PLUGIN_ENTRY_VALIDATOR."
This is wrong: `PLUGIN_ENTRY_VALIDATOR` only enforces
`name: Type.String()` -- it does NOT enforce the `assertSafeName` rules
(no `.`/`..`, no path separators, no control characters).

A marketplace.json with `{"name": "..", "source": "./foo"}` therefore:
1. Passes `PLUGIN_ENTRY_VALIDATOR.Check(...)` (name is a string).
2. Reaches `resolveStrict` / `resolveLoose`.
3. Hits `assertSafeName("..")` and throws `Error('Name must not be "." or "..".')`.

The thrown error is **not** a `PathContainmentError` and **not** a
`notInstallable` result -- it propagates up as an unhandled exception,
breaking the resolver's documented contract that "PR-2 cases" all surface
as `notInstallable`. Phase 5 orchestrators iterating
`for (const entry of marketplace.plugins)` then `await resolveStrict(entry, ctx)`
will get a panic on the first malicious or careless entry, aborting the
whole list-resolve / install-many loop.

The shipped resolver tests never construct an entry with an unsafe name,
so this bug is invisible to the test suite.

**Fix:** Convert the throw into a `notInstallable` short-circuit, matching
the rest of preflight:
```typescript
try {
  assertSafeName(entry.name);
} catch (err) {
  return {
    kind: "notInstallable",
    result: notInstallable(
      typeof entry.name === "string" ? entry.name : "<unnamed>",
      partial,
      [`plugin name is not safe: ${errorMessage(err)}`],
    ),
  };
}
```

Add a test in `tests/domain/resolver-strict.test.ts` (and one in
resolver-loose) covering `name: ".."`, `name: "../escape"`, and
`name: "foo bar"` -- each asserting `installable: false` rather than
that the call rejects.

---

## Warnings

### WR-01: Migration normalizes `resources.agents`/`resources.mcpServers` only -- schema requires `skills`/`prompts` too

**File:** `extensions/claude-marketplace/persistence/migrate.ts:103-131`
(see also `extensions/claude-marketplace/persistence/state-io.ts:38-55`)

**Issue:** `PLUGIN_INSTALL_RECORD_SCHEMA` declares `resources` as
`Type.Object({ skills: Type.Array(...), prompts: Type.Array(...), agents:
Type.Array(...), mcpServers: Type.Array(...) })` -- all four fields
required. `migrateLegacyMarketplaceRecords` only fills `agents` and
`mcpServers`. A V1 record whose `resources` is `{}` (or missing
`skills`/`prompts`) survives migration with two missing required fields,
and the post-migration `STATE_VALIDATOR.Check(normalized)` throws
"failed schema validation: /marketplaces/.../resources/skills: Required".

This is reachable in practice: the shipped fixture
`tests/persistence/fixtures/legacy/v1-missing-resources.json` has
`resources: { skills: [], prompts: [] }` -- it specifically supplies
`skills`/`prompts` so the test passes. A pre-V1 fixture that omitted those
two fields would fail loadState.

**Fix:** Either (a) extend the migration to fill all four resource arrays
with `[]` defaults, or (b) document and assert in a test that
`skills`/`prompts` were always present in V1 and a fixture missing them
is malformed. Option (a) is the safer choice:
```typescript
for (const k of ["skills", "prompts", "agents", "mcpServers"] as const) {
  if (resources[k] === undefined) {
    resources[k] = [];
    mutated = true;
  }
}
```

---

### WR-02: `loadState` silently coerces on-disk `schemaVersion: N` to `1`

**File:** `extensions/claude-marketplace/persistence/state-io.ts:144-187`

**Issue:** `loadState` migrates `marketplaces` then constructs
`normalized = { schemaVersion: 1, marketplaces }` regardless of what the
source file's `schemaVersion` was. A future Pi build that down-rev'd to
this code (or a state.json hand-edited / written by a future Pi build)
with `schemaVersion: 2` would be silently rewritten as `schemaVersion: 1`
and possibly persisted by the fire-and-forget `persistMigratedState`. The
test at `state-io.test.ts:215` asserts `STATE_VALIDATOR.Check({
schemaVersion: 2 })` returns `false` -- but `loadState` never runs the
validator on the on-disk version field; it constructs a fresh object with
`1` baked in.

ST-1 says schema version is locked at 1 in V1, so no current path produces
this; the concern is forward-compat: a future schemaVersion 2 must not be
silently downgraded by an older client.

**Fix:** Either reject unknown schemaVersion explicitly, or accept it and
preserve verbatim:
```typescript
const onDiskSchemaVersion = (parsed as { schemaVersion?: unknown }).schemaVersion;
if (onDiskSchemaVersion !== undefined && onDiskSchemaVersion !== 1) {
  throw new Error(
    `state.json at ${stateJsonPath} has unsupported schemaVersion ${String(onDiskSchemaVersion)}; expected 1`,
  );
}
```

---

### WR-03: `JSON.parse` of `.mcp.json` not validated for null/array shape; `in` operator on `null` throws

**File:** `extensions/claude-marketplace/domain/resolver.ts:419-429`

**Issue:** The standalone `.mcp.json` branch executes
`const parsed = JSON.parse(raw) as Record<string, unknown>;` then
`"mcpServers" in parsed`. If the file content is the literal `null`
(`JSON.parse` returns `null`), the `in` operator throws `TypeError: Cannot
use 'in' operator to search for 'mcpServers' in null`. Same for a top-level
array (`"mcpServers" in [1,2,3]` returns `false` but happens to work; an
array under `mp` then gets validated by `MCP_SERVERS_VALIDATOR` and fails
with a less informative message than "malformed mcpServers (.mcp.json)").

Currently the surrounding try/catch catches the TypeError and pushes a
"malformed mcpServers (.mcp.json): Cannot use 'in' operator..." note --
correctness is preserved through the catch, but the user-visible reason is
implementation-detail leakage rather than a clean schema-shape message.

**Fix:** Validate shape before the `in` check:
```typescript
const parsed: unknown = JSON.parse(raw);
if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
  partial.notes.push(`malformed mcpServers (.mcp.json): expected object, got ${parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed}`);
  dirty = true;
} else {
  const obj = parsed as Record<string, unknown>;
  mcp = "mcpServers" in obj ? obj.mcpServers : obj;
}
```

---

### WR-04: `migrateLegacyMarketplaceRecords` is documented as "pure" but mutates input objects in place

**File:** `extensions/claude-marketplace/persistence/migrate.ts:38-138`

**Issue:** The docstring says "Pure function -- does NOT touch disk."
The function does not touch disk, but it DOES mutate the caller's input:
`mp.manifestPath = ...`, `mp.marketplaceRoot = ...`, `pl.resources =
resources`, `resources.agents = []`, etc. The `marketplaces` map returned
contains the same object references the caller passed in.

This is a footgun for future callers who might cache or reuse `parsed`
across calls. `loadState` happens to discard `parsed` after migration so
the bug is not currently observable, but the docstring is actively
misleading. A future refactor that re-reads `parsed` after migration
would see surprising mutations.

**Fix:** Either (a) update the docstring to "Normalizes in place; the
returned `marketplaces` map shares references with the input," or (b)
deep-clone the per-mp records before mutation. Option (a) is cheaper and
matches actual behavior; option (b) is safer but adds copy cost on the
load path.

---

### WR-05: `version.normalizeBytes` has unreachable dead branch the type system mandates

**File:** `extensions/claude-marketplace/domain/version.ts:84-99`

**Issue:** Inside the CRLF-collapse loop, `byte === undefined` is checked
on `stripped[i]` for `i < stripped.length`. On a `Buffer`, this is always
a defined number. The author acknowledges this with a comment ("Unreachable:
i < stripped.length, but the type system needs the guard"). The `continue`
in the unreachable branch silently drops a byte if ever reached -- which
would corrupt the hash. The type system needing this guard suggests an
overly-permissive index access type.

This is not a runtime defect today, but the silent `continue` masks a
future bug if the loop bounds are ever changed.

**Fix:** Replace `continue` with `throw new Error("unreachable: indexed read returned undefined")` so any future regression is loud. Alternatively, switch
to a Buffer-typed iteration (`for (const byte of stripped)`) which avoids
the index-undefined widening.

---

### WR-06: `validateComponentPath` rejects array form with the same message regardless of array contents

**File:** `extensions/claude-marketplace/domain/resolver.ts:323-326`

**Issue:** PR-2 case 9 rejects array-form component paths with
`component path for "<kind>" is array-form; must be a string`. This is
correct per spec, but the array could be `[]` (empty), `["a", "b", "c"]`,
or `[42]`. The single message gives no hint about the actual shape, which
hampers operator debugging when a marketplace.json author has accidentally
shipped `skills: ["skills/"]` thinking it's a multi-path declaration.

This is reflected in the PR-2(9) test which asserts only that "array-form"
appears in the note -- no shape detail. Low severity but trivially
improvable.

**Fix:**
```typescript
if (Array.isArray(raw)) {
  return {
    ok: false,
    reason: `component path for "${kind}" is array-form (length=${raw.length}); must be a string`,
  };
}
```

---

## Info

### IN-01: Resolver duplicates Step 7-10 logic between `resolveStrict` and `resolveLoose`

**File:** `extensions/claude-marketplace/domain/resolver.ts:365-540`

**Issue:** `resolveStrict` and `resolveLoose` share preflight via
`preflightStages`, but Steps 7 (component paths), 8 (mcpServers), 9
(unsupported components), and 10 (dependencies) are duplicated. Steps 9
and 10 are byte-for-byte identical between the two functions; Step 7
differs only in the "manifest declaration → conflict vs. fallback to
manifest+implicit" branch; Step 8 differs only in the "entry-only vs.
union-with-manifest-and-standalone" wiring. This is by design per
CONTEXT.md D-04 ("TWO distinct functions, no shared branching") -- the
duplication is intentional anti-coupling. Worth flagging as `info` so a
future contributor doesn't refactor it back into a single switched
function and reintroduce the bug surface D-04 was guarding against.

**Fix:** Add a doc comment near the top of `resolver.ts` linking to
CONTEXT.md D-04 explaining why the duplication is load-bearing and must
not be deduplicated.

---

### IN-02: `version.normalizeBytes` + `walkAndHash` re-allocates on every CRLF-bearing file

**File:** `extensions/claude-marketplace/domain/version.ts:69-102`

**Issue:** Every file with a CR byte allocates a new `Buffer` of the
original length, then `subarray(0, j)` to crop. For large plugin trees
with many CRLF files (Windows-checkout repos), this is O(N×size) memory
churn. Out of scope per the v1 review charter (performance excluded), but
worth noting for the post-V1 perf-pass backlog.

**Fix:** Defer.

---

### IN-03: `tests/transaction/with-state-guard.test.ts` simulates ST-8/ST-9 invariants only inside the closure -- the guard itself never enforces them

**File:** `tests/transaction/with-state-guard.test.ts:152-249`

**Issue:** The SC-3 / ST-8 / ST-9 tests are asserting CALLER-supplied
invariants (the test bodies throw the "was installed concurrently" /
"changed concurrently" errors). This matches the documented contract in
`with-state-guard.ts:13-22` ("ST-8 ... and ST-9 ... are CALLER-supplied
invariants checked INSIDE the mutate closure -- the guard does not
enforce them itself"), so the tests are correct. However, a reader
skimming the test file might misread these as guard-enforced behaviors
and use them as a contract reference. The test descriptions could
foreground the "caller-supplied" framing more clearly so the contract is
unambiguous from the test name alone.

**Fix:** Rename test cases to e.g. `"SC-3 ST-8 (caller-enforced): caller B's ST-8 invariant inside mutate detects A's prior commit"`.

---

### IN-04: `domain/source.ts` browser-paste rejection hint emits multi-segment ref that is not valid github fragment notation

**File:** `extensions/claude-marketplace/domain/source.ts:117-126`

**Issue:** For
`https://github.com/o/r/tree/main/src/foo`, the `treeIdx` slice yields
`ref = "main/src/foo"` (after trailing-slash strip), and the rejection
hint becomes `use https://github.com/o/r#main/src/foo`. But
`#main/src/foo` is not how github URL refs are written
(`#<branch-or-tag>` only -- multi-segment subpath URLs cannot round-trip
through the `#<ref>` form). The user following the hint would still hit
"unsupported".

This is operator UX, not a security or correctness defect. Acceptable as
shipped; flagging for the next docs/UX pass.

**Fix:** Either truncate `ref` at the first `/` and note the truncation,
or drop the suggestion entirely on multi-segment refs:
```typescript
const refSingle = ref.includes("/") ? ref.split("/")[0] : ref;
const noteHint = ref === refSingle
  ? `use https://github.com/${ownerRepo}#${ref} instead`
  : `use https://github.com/${ownerRepo}#${refSingle} (subpath ${ref.slice(refSingle.length + 1)} not supported via #ref)`;
```

---

_Reviewed: 2026-05-10T13:21:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
