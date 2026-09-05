---
phase: 110-domain-and-platform-modules
reviewed: 2026-09-05T05:48:38Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/workflow-project-key.ts
  - extensions/pi-claude-marketplace/domain/workflow-script.ts
  - extensions/pi-claude-marketplace/platform/workflow-home.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - package.json
  - tests/domain/name.test.ts
  - tests/domain/workflow-project-key.test.ts
  - tests/domain/workflow-script.test.ts
  - tests/platform/workflow-home.test.ts
  - tests/shared/errors.test.ts
findings:
  critical: 1
  warning: 9
  info: 6
  total: 16
status: issues_found
---

# Phase 110: Code Review Report

**Reviewed:** 2026-09-05T05:48:38Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Three ported leaf modules plus their owner tests, ~2,150 added lines. The toolchain
is clean on the scope: `tsc --noEmit`, `eslint`, and `prettier --check` all pass, all
219 tests in the five files pass, and `npm run test:coverage:direct` reports 100%
line/branch/function coverage for each of the four source-test pairs run alone.

The parity claims were checked against the real engine rather than taken on trust. I
unpacked `@quintinshaw/pi-dynamic-workflows@3.10.1` and ran its own
`workflowProjectKey` over all thirteen rows of `tests/domain/workflow-project-key.test.ts`:
all thirteen match byte-for-byte. `workflowHomeDir` matches
`dist/workflow-paths.js:13-15` exactly. The security property of
`domain/workflow-script.ts` also holds: I traced every path that touches an AST node
(`readMetaString`, `metaPropertyKey`, `findMetaObject`, `stemFallbackVerdict`) and no
non-`Literal` node's value is ever resolved, coerced, or evaluated — there is no
evaluator, no `Function`, no `vm`, no dynamic import.

What did not survive scrutiny:

- One test group asserts nothing about the behavior it names and would stay green
  against three materially different wrong implementations (CR-01).
- The module's own stated invariant — "matching the engine exactly is the goal, never
  exceeding it" — is violated in three demonstrated directions (WR-02), and a fourth
  divergence silently misnames a command the engine can read (WR-01).
- Attacker-supplied filenames and `meta.name` values reach user-facing `reason`
  strings verbatim, carrying newlines and bidi overrides into `notify()` output (WR-05).

Findings are weighted per the phase brief: style nits inside verbatim-ported code are
Info; defects are graded on impact regardless of origin.

## Critical Issues

### CR-01: Encoding tests assert only that a pure function is deterministic

**File:** `tests/domain/workflow-script.test.ts:514-540`

**Issue:** The three "answers deterministically and throws nothing for a source
carrying …" cases call `admitWorkflowScript` twice and assert only
`assert.deepStrictEqual(firstVerdict, secondVerdict)` plus `assert.doesNotThrow(admit)`.
`admitWorkflowScript` is a pure function of its three string arguments and holds no
module-level mutable state, so the equality assertion is satisfied by *any*
implementation, correct or not. The verdict itself is never asserted.

That this matters is not hypothetical. I ran the three sources; they do not agree:

| row | actual verdict |
| --- | --- |
| leading byte-order mark | `named`, `generatedName: "acme:ship"` |
| lone surrogate | `named`, `generatedName: "acme:ship"` |
| replacement characters | `refused`, `cause: "unparseable"` |

A UTF-8 BOM is common in real files. If a future acorn option change or a source
pre-processing step turned the BOM row into `refused`/`unparseable` — a genuine
regression that would silently drop a plugin's workflow — this test would still pass.
The suite's 100% branch coverage of `workflow-script.ts` makes this worse, not better:
the lines execute, so nothing else flags the gap.

The project's own `typescript-unit-testing-review` skill classifies exactly this as a
BLOCKER: "a case a wrong implementation would pass (weak, missing, or replaced
assertions)".

**Fix:** Pin the verdict for each row, and split the row whose outcome differs so the
title tells the truth.

```ts
for (const { encoding, source, expectedVerdict } of [
  {
    encoding: "a leading byte-order mark",
    source: `\uFEFFexport const meta = { name: "ship" };\n`,
    expectedVerdict: {
      outcome: "named",
      metaName: "ship",
      generatedName: "acme:ship",
    },
  },
  {
    encoding: "a lone surrogate in an unrelated literal",
    source: `const marker = "\uD800";\nexport const meta = { name: "ship" };\n`,
    expectedVerdict: {
      outcome: "named",
      metaName: "ship",
      generatedName: "acme:ship",
    },
  },
] satisfies readonly { encoding: string; source: string; expectedVerdict: Admission }[]) {
  test(`reads the declared name from a source carrying ${encoding}`, () => {
    // act
    const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });
}

test("refuses a source whose replacement characters make it unparseable", () => {
  // arrange
  const source = `const \uFFFD = 1;\nexport const meta = { name: "ship" };\n`;
  const expectedVerdict = { outcome: "refused", cause: "unparseable" } satisfies NonAdmission;

  // act
  const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

  // assert
  assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
});
```

## Warnings

### WR-01: A no-substitution template-literal `meta.name` is the one non-`Literal` form the engine *does* resolve — treating it as unreadable silently misnames the command

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:628-648` (and the row pinning it at `tests/domain/workflow-script.test.ts:300-304`)

**Issue:** `readMetaString` accepts a value only when
`element.value.type === "Literal" && typeof element.value.value === "string"`. A
template literal is `TemplateLiteral`, so `` name: `deploy` `` falls to `no-literal`
and the file stem names the command.

But the engine resolves that shape statically, without evaluating anything
(`dist/workflow.js:1074` `evaluateLiteral`, `TemplateLiteral` arm: it throws only when
`node.expressions.length > 0`, otherwise it joins
`quasi.value.cooked ?? quasi.value.raw`). So for a script declaring
`` export const meta = { name: `deploy`, description: "d" } ``, the engine reads
`deploy` while we produce:

```
{"outcome":"stem-fallback","fileName":"shipper.workflow.js","generatedName":"acme:shipper.workflow","description":"d"}
```

That is the exact failure the module header opens by naming — "stem naming misnames
every command such a plugin ships, and it does so silently: a dot passes every name
validator in the chain." The fix is a static read, not an evaluation, so it does not
cost the module its security property.

**Fix:** Mirror the engine's arm in `readMetaString`.

```ts
function literalString(node: Property["value"]): string | undefined {
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }

  // Matches the engine's `evaluateLiteral` TemplateLiteral arm: a template with no
  // substitutions is statically known text, read off the quasis and never evaluated.
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join("");
  }

  return undefined;
}
```

Then `readMetaString` sets `{ kind: "literal", value }` when `literalString` returns a
string and `{ kind: "no-literal" }` otherwise. Update the test row at line 300 to
expect `named` / `acme:deploy`, and add a negative row for
`` name: `a${x}b` `` still falling back.

### WR-02: The name gate is stricter than the engine for three inputs, contradicting the module's own "never exceed it" invariant

**File:** `extensions/pi-claude-marketplace/domain/name.ts:172-182`

**Issue:** `assertSafeSavedWorkflowName`'s doc comment states the invariant plainly:
"Matching the engine exactly is the goal, never exceeding it: a gate stricter than the
engine refuses a name the engine would accept". The four clauses in
`assertSafeSavedWorkflowName` do match the engine (`dist/workflow-saved.js:27-35`).
The problem is the surrounding `generatedWorkflowName` chain, which runs
`assertSafeName` on `plugin`, `source`, and `elided` *before* the join — screening the
parts against rules the engine only applies to the whole.

I ran a differential against the engine's real `isSafeSavedWorkflowName` over the
joined names. Three inputs come back stricter:

| `meta.name` | joined name | engine accepts | we accept |
| --- | --- | --- | --- |
| `"."` | `acme:.` | yes | no — `Name must not be "." or "..".` |
| `".."` | `acme:..` | yes | no — same |
| `"acme-"` (plugin `acme`) | `acme:` | yes | no — `Name must be a non-empty string.` |

Each becomes a `refused` / `unsafe-name` verdict for a plugin the engine would have
installed. The third case is pinned as expected behavior at
`tests/domain/name.test.ts` (`sourceName: "acme-"`), so the test suite locks the
excess in rather than catching it. Note that `generatedCommandName` already solves the
identical empty-head problem for commands (D-141-02, `name.ts:99-104,123-124`); the
"Commands only" rationale at `name.ts:106-109` rests on Pi's *skill*-name validator,
which does not govern workflow names.

Practical hit rate is low, but the invariant is load-bearing: the whole point of the
comment is that only the lax direction self-corrects on an engine upgrade.

**Fix:** Validate the parts only for the properties the join cannot fix (path
separators, so the plugin prefix cannot smuggle one in), and let the joined name be
the sole subject of the dot/empty/whitespace rules. Concretely, apply D-141-02's
empty-head rule to `generatedWorkflowName` (keep the head verbatim when elision empties
it) and drop the `assertSafeName(elided)` call, keeping `assertSafeName(generated)` +
`assertSafeSavedWorkflowName(generated)`. Add a test asserting `"."`, `".."`, and
`"acme-"` produce a `named` verdict, so the invariant becomes enforced rather than
narrated.

### WR-03: `findMetaObject` takes the first `meta` declarator; JavaScript takes the last

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:553-575`

**Issue:** The loop `return`s on the first top-level declarator named `meta`.
`readMetaString` (line 611-627) goes out of its way to implement the opposite rule for
*properties* — "read one `meta` key the way JavaScript reads it — in order, LAST WINS
… stopping at the first match reports a name the evaluated object never carries."
The same argument applies one level up and is not honored:

```js
var meta = { name: "first" };
var meta = { name: "second" };
```

`var` redeclaration is legal in a module, the evaluated binding is `{name:"second"}`,
and we report:

```
{"outcome":"named","metaName":"first","generatedName":"acme:first"}
```

Related and from the same loop: a *non-exported* `const meta = { name: "hidden" }`
yields `named` / `acme:hidden`, but the engine requires
`ast.body[0].type === "ExportNamedDeclaration"` with `kind === "const"` and exactly one
declarator (`dist/workflow.js:1043-1058`), so it rejects both scripts outright. The
module header's decision to under-replicate the engine's structural rules is
deliberate and reasonable; the *first-wins vs last-wins inconsistency* inside our own
code is not.

**Fix:** Keep scanning and retain the last matching declarator, so the two readers
agree on one evaluation model:

```ts
function findMetaObject(ast: Program): MetaLookup {
  let found: MetaLookup = { kind: "no-meta" };

  for (const node of ast.body) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;

    if (decl?.type !== "VariableDeclaration") {
      continue;
    }

    for (const d of decl.declarations) {
      if (d.id.type !== "Identifier" || d.id.name !== "meta") {
        continue;
      }

      // Last wins, matching `readMetaString`'s property rule and JavaScript's own.
      found =
        d.init?.type === "ObjectExpression"
          ? { kind: "object-literal", elements: d.init.properties }
          : { kind: "meta-not-object-literal" };
    }
  }

  return found;
}
```

Add a case for the double-`var` shape.

### WR-04: `generateOrRefuse` catches every throwable, laundering programming errors into a user-facing refusal

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:333-348`

**Issue:** The `catch (err)` is unqualified. Its documented job is to convert one
specific class of failure — an unsafe *name* — into a per-file `refused` verdict. In
practice it also swallows a `TypeError` from a null dereference, a `RangeError`, or any
future defect inside `generatedWorkflowName`/`assertSafeName`, and reports all of them
to the user as `"<file> resolves to an unusable command name: <internal message>"`. A
crash in our own code becomes a plausible-looking accusation against the plugin, and
nothing surfaces the defect.

This also conflicts with `CONVENTIONS.md`'s error contract: domain errors are typed
classes narrowed with `instanceof`, "never on message substring matching or
`error.name` string comparison". `assertSafeName` and `assertSafeSavedWorkflowName`
both throw a bare `Error`, which is why the callers here and in
`tests/domain/name.test.ts` are forced to discriminate on `error.constructor === Error`
and an exact message string.

**Fix:** Give `name.ts` a typed error and narrow on it, rethrowing everything else.

```ts
// shared/errors.ts
export class UnsafeGeneratedNameError extends Error {
  readonly attemptedName: string;
  constructor(attemptedName: string, detail: string) {
    super(detail);
    this.name = "UnsafeGeneratedNameError";
    this.attemptedName = attemptedName;
  }
}

// workflow-script.ts
} catch (error: unknown) {
  if (!(error instanceof UnsafeGeneratedNameError)) {
    throw error;
  }

  return { outcome: "refused", fileName, reason: unsafeNameReason(fileName, error.message), cause: "unsafe-name" };
}
```

If retyping `assertSafeName` is out of scope (it is shared by skills, commands, and
agents), scope the change to `generatedWorkflowName`: wrap its own throws in the typed
class and let the rest propagate.

### WR-05: Untrusted `fileName` and `meta.name` are interpolated verbatim into user-facing `reason` strings

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:650-684`

**Issue:** Every `*Reason` builder interpolates `fileName`, `matched`, or an error
message containing `meta.name` directly into a `reason` the install surface renders
through `notify()`. All three sources are third-party plugin content. Measured:

```
newline-filename reason: "ok.js\nInstalled 5 workflows\n resolves to an unusable command name: …"
bidi reason:             "x.js resolves to an unusable command name: Name \"a\u202Eb/c\" must not contain path separators."
whitespace-matched:      "y.js calls `new\n\n\n\n\nDate()`, which the workflow engine refuses as nondeterministic"
```

A POSIX filename may contain `\n`, so a plugin can forge an extra output line inside a
refusal block. `meta.name` may contain U+202E RIGHT-TO-LEFT OVERRIDE — which
`assertSafeName` does not screen (it stops at 0x7F) but which reaches the message
*because* the name was rejected — visually reversing the remainder of the line. And
`\s` in the blocklist matches newlines, so `matched` can be arbitrarily long
multi-line text.

The repository already treats these characters as a threat: `.pre-commit-config.yaml`
runs a texthooks bidi-control fixer over its own sources, the engine's
`isSafeSavedWorkflowName` comment calls out "Unicode format characters (including bidi
controls)", and `tests/domain/name.test.ts` has a dedicated U+202E case. `notify.ts` is
a dumb renderer by design, so the sanitizing has to happen here.

**Fix:** Route every untrusted interpolation through one escaper before it enters a
reason string.

```ts
/** Render untrusted plugin text safely inside a one-line notification. */
function forMessage(text: string): string {
  return text.replaceAll(/[\p{Cc}\p{Cf}]/gu, (ch) => `\\u{${ch.codePointAt(0)!.toString(16)}}`);
}
```

Apply it to `fileName`, `matched`, and the `errorMessage(err)` detail at every call
site, and add cases asserting the escaped forms for a newline-bearing file name and a
bidi-bearing `meta.name`.

### WR-06: The "no match position is carried over" test cannot fail, and the two halves of the blocklist are defended asymmetrically

**File:** `tests/domain/workflow-script.test.ts:468-486`; `extensions/pi-claude-marketplace/domain/workflow-script.ts:370-383,410`

**Issue:** `determinismScanner()` goes to real trouble to survive a future `g` flag
arriving on the vendored literal (`DETERMINISM_BLOCKLIST.flags.replaceAll("g", "")`).
The `.test()` call at line 410 does not — it runs the literal directly. If an engine
upgrade brought a `g` flag along with the pattern (the documented re-check ritual
explicitly anticipates the literal changing), `.test()` would become stateful across
calls and eventually return `false` for a script that matches. The failure direction is
**admit a script the engine refuses**.

The test named for this hazard would not catch it. Its fixture contains *two*
`Date.now()` occurrences and it performs exactly two `admitWorkflowScript` calls, so a
retained `lastIndex` would still yield `true` on both passes and the test would stay
green.

**Fix:** Two changes.

1. Make the guard structural rather than by convention — reuse the same clone for both
   halves:

   ```ts
   function determinismMatcher(): RegExp {
     return new RegExp(
       DETERMINISM_BLOCKLIST,
       `${DETERMINISM_BLOCKLIST.flags.replaceAll("g", "")}g`,
     );
   }

   // findDeterminismViolation
   const scanner = determinismMatcher();
   const matches = [...source.matchAll(scanner)];

   if (matches.length === 0) {
     return undefined;
   }
   ```

2. Make the test able to fail: use a single-match fixture and call three times, or
   assert `DETERMINISM_BLOCKLIST.lastIndex === 0` after the scan.

### WR-07: Collision detection compares names as exact strings, but the engine writes `<name>.json` on the user's filesystem

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:190-211`; pinned at `tests/domain/workflow-script.test.ts:712-736`

**Issue:** `assertNoWorkflowNameCollisions` groups by exact string equality. The engine
persists a saved workflow as `join(dirs[source], `${name}.json`)`
(`dist/workflow-saved.js:78`), so the generated name *is* a filename. Two consequences
the gate does not catch:

- Case-only differences. `meta.name: "Ship"` and `meta.name: "ship"` in one plugin
  produce `acme:Ship` and `acme:ship`, pass the collision check, and then map to the
  same file on a case-insensitive volume (APFS/HFS+ default, NTFS). One workflow
  silently overwrites the other — the misnaming WNAM-05 exists to prevent, arriving by
  a different door.
- Unicode normalization. `tests/domain/workflow-script.test.ts:712` deliberately
  asserts that NFC `café` and NFD `café` do **not** collide. On a normalizing
  filesystem they name the same file.

**Fix:** Group by a fold key while still reporting the names as written:

```ts
// Filesystem identity, not string identity: the engine persists this name as
// `<name>.json`, and case-insensitive and normalizing volumes fold both axes.
const foldKey = (name: string): string => name.normalize("NFC").toLowerCase();
```

Key `groups` on `foldKey(admitted.generatedName)` and carry the first-seen
`generatedName` for the message. Retitle the NFC/NFD test to assert a collision *is*
reported, and add a case-only-difference case.

### WR-08: `generateOrRefuse`'s `source` parameter means the opposite of `source` everywhere else in the module

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:333-339`

**Issue:** In `admitWorkflowScript`, `parseScript`, and `findDeterminismViolation`,
`source` is the untrusted script text. In `generateOrRefuse` it is the *name* to
generate from — `metaName` at line 247, `fileStem(fileName)` at line 273. Both are
`string`, so swapping them compiles: passing the script text would produce a
`refused`/`unsafe-name` verdict for every script (the text contains whitespace) rather
than a type error. In a module whose whole contract is "never let script text become a
name", this is the wrong two things to give one name.

**Fix:** Rename to `declaredName` (or `nameSource`) and update the doc comment at line
322-331, which currently says "the name the FILE supplies" while the parameter says
`source`.

### WR-09: Every stem-fallback verdict names a workflow the engine cannot load

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:268-285`

**Issue:** The stem fallback fires when `meta.name` is absent or not a readable string
literal. The engine's `validateMeta` (`dist/workflow.js:1126-1133`) requires *both*
`meta.name` and `meta.description` to be non-empty strings after `evaluateLiteral`, and
`evaluateLiteral` (line 1074) rejects `Identifier`, `BinaryExpression`, and a numeric
`name`. Walking the five stem-fallback rows in the test file against those rules:

| test row | engine outcome |
| --- | --- |
| `{ description: "d" }` | rejects — `meta.name must be a non-empty string` |
| `` { name: `never-evaluated` } `` | rejects — `meta.description must be a non-empty string` |
| `{ name: "a" + "b" }` | rejects — `non-literal node type in meta.name: BinaryExpression` |
| `{ name: 42 }` | rejects — `meta.name must be a non-empty string` |
| `{ name: chosenName }` | rejects — `non-literal node type in meta.name: Identifier` |

So the entire WNAM-02 arm, as tested, installs commands that fail the moment they run.
The module header's rationale for not replicating the engine's structural rules ("an
engine upgrade may drop them") is sound for *refusing* a script, but here we are
actively *admitting* and *naming* one. `NamedWorkflow.description` is also never
checked for non-emptiness, so `{ name: "x", description: "" }` has the same fate.

This is a cross-phase concern — the bridge that writes the envelope lands in 111 — but
it needs to be settled before that bridge exists, because the choice is between
narrowing the stem fallback here and adding a second gate there.

**Fix:** Decide and record one of: (a) restrict the stem fallback to shapes the engine
can load — a `name` it resolves plus a non-empty `description` — and skip the rest with
a distinct cause; or (b) keep admitting them and have the 111 bridge emit a warning
row noting the command will not run until the script declares a literal `name` and
`description`. Whichever is chosen, add a test that states it, so the arm is not
silently a dead-command factory.

## Info

### IN-01: `acorn.parse` is handed unbounded third-party input

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:506-533`

**Issue:** `parseScript` parses whatever text the caller passes with no size ceiling. A
plugin shipping a very large `.js` under `workflows/` costs proportional memory and CPU
in-process during install and reconcile. Recorded as consciously deferred by the phase
brief; noted here only for traceability.

**Fix:** When the deferral is picked up, gate on `source.length` before `parse()` and
refuse with a distinct `RefusedCause` rather than an `unparseable` misattribution.

### IN-02: Three alternatives in the `[\s/\\\0]` screen can never fire, and the error message names them anyway

**File:** `extensions/pi-claude-marketplace/domain/name.ts:223-227`

**Issue:** `generatedWorkflowName` runs `assertSafeName(generated)` first, which already
rejects `/`, `\`, and every code point below 0x20 (including NUL). By the time
`assertSafeSavedWorkflowName` runs, only the `\s` alternative is reachable — yet the
message reads "must not contain whitespace, path separators, or NUL", naming two causes
that are structurally impossible. The `\p{Cc}` half of the fourth screen is likewise
reachable only for U+0080–U+009F. Keeping the regex byte-identical to the engine is
correct; the message is what misleads.

**Fix:** Keep both patterns verbatim (they are the diffable artifact) and narrow the
message to "must not contain whitespace", noting in the comment that the separator and
NUL alternatives are pre-screened by `assertSafeName`.

### IN-03: `WorkflowNameCollisionError` freezes only the outer array, and the test avoids exercising the difference

**File:** `extensions/pi-claude-marketplace/shared/errors.ts:643`; `tests/shared/errors.test.ts` ("freezes a defensive copy…")

**Issue:** `Object.freeze([...collisions])` is a shallow freeze: the caller keeps a live
handle on each `WorkflowNameCollision` object and its `fileNames` array. The test proves
only that a `push` onto the *outer* array does not reach; it never mutates
`collisions[0].fileNames`, which would. This matches the existing
`AggregateResourcesDiscoverError` pattern, and `readonly` typing covers it at compile
time, so it is a documentation gap more than a defect.

**Fix:** Either deep-freeze (`collisions.map((c) => Object.freeze({ ...c, fileNames: Object.freeze([...c.fileNames]) }))`)
or state in the doc comment that the freeze is shallow and the inner objects are
caller-owned.

### IN-04: The workflow-home test depends on `os.homedir()` honoring `process.env.HOME`, which is POSIX-only

**File:** `tests/platform/workflow-home.test.ts:22-37`

**Issue:** `hermeticHome` relocates storage by assigning `process.env.HOME`. Node's
`os.homedir()` reads `HOME` on POSIX but `USERPROFILE` on Windows, so all three cases
would assert against the developer's real home directory on Windows — writing nothing,
but comparing the wrong root. CI is Linux-only, so this is latent.

**Fix:** Set both variables in `hermeticHome`, saving and restoring each, or state the
POSIX assumption in the helper's doc comment alongside the existing `process.env`
stringification note.

### IN-05: Single-letter identifiers in scopes longer than ten lines

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:414,526-530,561-570,582`

**Issue:** `c` for a comment, `t` for a token, `d` for a declarator, `p` for a property.
The Google-style skill permits short names "only in scopes of ten lines or fewer";
`findMetaObject` is roughly twenty. The surrounding code is otherwise carefully named.

**Fix:** `comment`, `token`, `declarator`, `property`.

### IN-06: A new runtime dependency landed without a CHANGELOG entry

**File:** `package.json:9`

**Issue:** `acorn@^8.16.0` is correctly placed in `dependencies` (it is imported at
runtime by `domain/workflow-script.ts`, and `files` ships `extensions/**`), the lockfile
is in step, and the resolved version is 8.16.0. `CHANGELOG.md` records no new
dependency. `CLAUDE.md` ties that step to PR creation rather than to the phase, so this
is a reminder for the release, not a defect now.

**Fix:** Add the acorn dependency line to `CHANGELOG.md` at the next version bump.

---

_Reviewed: 2026-09-05T05:48:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
