---
phase: 102-workflow-naming-and-script-admission
reviewed: 2026-08-15T12:06:30Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/workflow-script.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - tests/domain/workflow-script.test.ts
  - tests/domain/name.test.ts
  - tests/architecture/runtime-deps.test.ts
findings:
  critical: 2
  warning: 10
  info: 0
  total: 12
resolution:
  fixed: 10
  skipped: 2
  resolved_at: 2026-08-15
  notes: >-
    Both blockers fixed under one commit -- they are the same defect, an
    object-literal model that ignored evaluation order. WR-06 was first
    skipped as contradicting a locked decision, then reopened and fixed
    after the operator amended that decision; the collision now throws
    WorkflowNameCollisionError carrying its groups as fields. WR-07 is
    the one finding deliberately left: sonarjs/no-identical-functions
    does not fire, and the only shared home would breach the
    domain-to-bridges layering the divergence exists to respect.
status: resolved
---

# Phase 102: Code Review Report

**Reviewed:** 2026-08-15T12:06:30Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

`admitWorkflowScript` is a genuinely pure decision function: no disk, no network, no
evaluator, no `new Function`, no `node:vm`, no dynamic `import()`. The parse-first gate
order is implemented as documented, the vendored `DETERMINISM_BLOCKLIST` literal is
byte-identical to the one recorded in
`.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md`
(`/\bDate\s*\.\s*now\b|\bMath\s*\.\s*random\b|\bnew\s+Date\s*\(\s*\)/`), the module-level
regex is correctly flagless with a per-call `g` clone, the string/template containment
bounds are correct (`index >= start && index < end` handles the backtick-excluding template
range the test pins), and the `.workflow` stem trap the requirement exists to prevent is
demonstrably avoided. `npx tsc --noEmit` is clean, `eslint` on the five files is clean, the
36 tests pass, and no `Phase N` / `Plan N` / `Wave N` / bare `Pitfall N` comment-policy
violations are present.

The defects are in the AST walk's model of object-literal semantics. The walk treats a
`meta` object literal as a *set* of properties and stops at the first key match, but
JavaScript object literals are *ordered with last-wins*, and a spread element can overwrite
anything that precedes it. Both shapes were executed against the shipped module and both
produce a `generatedName` that differs from the name the runtime object would carry — the
exact silent-misnaming class WNAM-01 exists to prevent. Everything below CR-02 is
robustness, message accuracy, convention, or test-coverage.

All findings were reproduced by executing the module under `node --experimental-strip-types`
against constructed sources; the reproductions are quoted verbatim.

## Critical Issues

### CR-01: A duplicate `name` key in `meta` yields the FIRST value; JavaScript yields the last

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:477-491`
**Issue:** `metaStringValue` iterates `properties` and `return`s on the first property whose
key matches, but duplicate property names are legal in an ES module object literal (the ES5
strict-mode restriction was removed in ES6; only duplicate `__proto__` is an error) and the
LAST occurrence wins at evaluation. The walk therefore reports a name the runtime object
never has. Reproduced against the shipped module:

```text
input:  export const meta = { name: "first", name: "second" };
actual: {"outcome":"named","metaName":"first","generatedName":"acme:first"}
truth:  the evaluated meta.name is "second"

input:  const v = "x";
        export const meta = { name: v, name: "real" };
actual: {"outcome":"stem-fallback","generatedName":"acme:dup2"}
truth:  the evaluated meta.name is "real"
```

The second row is the worse of the two: the early `return undefined` on the non-literal
first occurrence suppresses a perfectly readable string literal that follows it, and the
verdict silently drops to the file stem. Both rows install a command under a name the
workflow engine does not answer to — the failure mode the whole requirement is built
around, arriving through the AST path rather than the regex path.

**Fix:** Scan every matching property and keep the last, and let a non-literal occurrence
poison only itself, not the search:

```ts
function metaStringValue(properties: readonly Property[], key: string): string | undefined {
  let found: string | undefined;

  for (const p of properties) {
    if (metaPropertyKey(p) !== key) {
      continue;
    }

    found =
      p.value.type === "Literal" && typeof p.value.value === "string" ? p.value.value : undefined;
  }

  return found;
}
```

Add table rows for both shapes to `tests/domain/workflow-script.test.ts`.

### CR-02: A spread element in `meta` is silently discarded, so a literal name can be overwritten at run time

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:443` (the
`.filter((p): p is Property => p.type === "Property")`) and `477-491`
**Issue:** `SpreadElement` nodes are filtered out of `properties` and leave no trace, so a
`meta` whose contents are partly unknowable is treated as if it were fully knowable.
Reproduced:

```text
input:  const base = { name: "frombase" };
        export const meta = { name: "literal", ...base };
actual: {"outcome":"named","metaName":"literal","generatedName":"acme:literal"}
truth:  the evaluated meta.name is "frombase"

input:  const base = { name: "frombase" };
        export const meta = { ...base };
actual: {"outcome":"stem-fallback","generatedName":"acme:spread2"}
```

A spread that follows the `name` property can overwrite it with a value that is only
knowable by running the script, which the module correctly refuses to do. The module's own
stated contract ("a `meta.name` that is not a string literal is never resolved — it is
denied a name instead") is not honoured here: an unresolvable name is confidently resolved
to the wrong literal. The severity is the same as CR-01 — a wrong command name is
installed with no diagnostic.

**Fix:** Treat any `SpreadElement` positioned at or after the matched `name` property as
making the name unreadable. The cheapest sound rule, and the one that matches the existing
`skipped` semantics, is to classify a `meta` containing any spread as
`meta-not-object-literal` (the closed `SkippedCause` union already carries the arm):

```ts
if (d.init.properties.some((p) => p.type === "SpreadElement")) {
  return { kind: "meta-not-object-literal" };
}
```

If a narrower rule is preferred, ignore only spreads that appear before the first `name`
property; do not ignore them entirely. Either way, pin it with a test.

## Warnings

### WR-01: The determinism gate runs before the `no-meta` check, so a non-workflow helper module is refused rather than skipped

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:118-128`
**Issue:** Detection is convention-based over `<pluginRoot>/workflows/**`, so the discovery
path in the next phase will hand this function every `.js` file under that tree, including
shared helper modules that declare no `meta` at all. The blocklist gate settles before the
`meta` walk, so such a file produces a user-facing refusal instead of the silent `skipped`
its lack of `meta` warrants:

```text
input:  export function stamp() { return Date.now(); }   // utils.js, no meta
actual: {"outcome":"refused","cause":"determinism-code",
         "reason":"utils.js calls `Date.now`, which the workflow engine refuses as nondeterministic"}
```

A plugin that ships one date-formatting helper next to its workflows will emit a refusal
naming a file that was never going to become a command. The gate-order doc comment justifies
unparseable-first at length but is silent on determinism-before-meta, and the one test that
pins the order (`GATE_ORDER_SOURCE`) uses a script that *does* declare a usable
`meta.name`, so it does not cover this case.
**Fix:** Either settle the `no-meta` skip before the determinism gate (there is nothing to
install, so the engine's opinion of the file is irrelevant), or record the decision
explicitly in the gate-order comment and make the next phase's discovery filter exclude
files without `meta`. State which, and add the covering test.

### WR-02: An unsafe `pluginName` is misattributed to every file, and the message does not say which name failed

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:278-293`;
`extensions/pi-claude-marketplace/domain/name.ts:142-155`
**Issue:** `generateOrRefuse` catches everything `generatedWorkflowName` throws and renders
it as a per-file `unsafe-name` refusal. `generatedColonName` validates `plugin` first, so a
malformed plugin name blames each innocent file in turn, N times:

```text
plugin: "ac/me",  file: "ok.js",  source: export const meta = { name: "ok" };
actual: {"outcome":"refused","cause":"unsafe-name",
         "reason":"ok.js resolves to an unusable command name: Name \"ac/me\" must not contain path separators."}
```

`assertSafeName` is called without its `label` argument at all three call sites, so the
message says "Name" and the reader cannot tell whether the plugin name, the declared name,
or the joined form was rejected.
**Fix:** Validate `pluginName` once, up front in `admitWorkflowScript`, and let a bad plugin
name throw (it is a defect of the SET, like the collision case, not of one file). Pass
labels through `generatedColonName` so the messages disambiguate:

```ts
assertSafeName(plugin, "plugin name");
assertSafeName(source, "workflow name");
```

### WR-03: `fileStem` strips only a lowercase `.js`, so `.mjs` / `.cjs` names carry their extension into the command name

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:265-267`
**Issue:** The suffix test is a literal `.js` check. Reproduced:

```text
fileName: "thing.workflow.mjs" -> generatedName "acme:thing.workflow.mjs"
fileName: "Thing.JS"           -> generatedName "acme:Thing.JS"
```

ESM workflow scripts are commonly `.mjs`, and the module is documented as the single place
the fallback name is derived, so a caller cannot correct this without duplicating the rule.
**Fix:** Strip the known JavaScript extensions case-insensitively, or take the accepted
extension set as an explicit constant shared with the discovery filter:

```ts
const SCRIPT_EXTENSIONS = [".js", ".mjs", ".cjs"] as const;

function fileStem(fileName: string): string {
  const hit = SCRIPT_EXTENSIONS.find((ext) => fileName.toLowerCase().endsWith(ext));
  return hit === undefined ? fileName : fileName.slice(0, -hit.length);
}
```

### WR-04: The per-call blocklist clone drops flags, so a future flag on the module literal is silently lost

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:345`
**Issue:** `new RegExp(DETERMINISM_BLOCKLIST.source, "g")` rebuilds the pattern from `.source`
and hard-codes the flag string. Today the literal is flagless so the clone is faithful, but
the stated maintenance contract is that this literal tracks an upstream value that must be
re-checked on every engine upgrade. If a future upstream literal carries `i` or `u`, the
`.test()` pre-check would use it and the position scan would not — the two would disagree
about whether a script matched, and `findDeterminismViolation` would return `undefined`
after `.test()` said true, admitting a script the engine will reject.
**Fix:** Preserve the flags and add `g` rather than replacing them:

```ts
new RegExp(DETERMINISM_BLOCKLIST, DETERMINISM_BLOCKLIST.flags + "g")
```

### WR-05: A blocklist hit inside a regex literal is reported as a call, and only the match START index is classified

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:333-377`, `406-408`
**Issue:** `stringRanges` filters the token stream to `tokTypes.string` and
`tokTypes.template` only. A regex literal is `tokTypes.regexp`, so a mention inside one falls
through to the executable arm and produces a factually false reason:

```text
input:  const re = /Date.now/;
        export const meta = { name: "r" };
actual: reason "re.js calls `Date.now`, which the workflow engine refuses as nondeterministic"
```

Nothing is called. Separately, containment is decided from `match.index` alone, so a match
that begins in a comment and ends in code is attributed to the comment together with the
"reword the comment to make it load" remedy — advice that will not make it load. `\s` in the
blocklist matches newlines, which is what lets a match cross a line comment's boundary:

```text
input:  // beware new
        Date();
actual: cause "determinism-comment", reason "... mentions `new\nDate()` in a comment ...
         so reword the comment to make it load"
```

The verdict is `refused` in every case, so this is message accuracy rather than an admission
error — but the messages are the entire product of WVAL-03's classification work.
**Fix:** Add `tokTypes.regexp` to the token filter (a regex literal is as non-executable a
mention as a string for this purpose), and test containment of the whole match span
(`index >= start && index + matched.length <= end`) so a boundary-crossing match falls
through to the code arm, which is the truthful classification.

### WR-06: The collision failure throws a bare `Error` with its structured data only in the message

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:180-185`
**Issue:** The project convention (`.planning/codebase/CONVENTIONS.md`, "Error Handling") is
one typed class per failure mode, `extends Error`, `this.name` set, carrying typed readonly
fields, and explicitly "never encode structured data only in the message string". The
collision map — which generated name, which claimant files — exists only as an interpolated
string, so the next phase's `notify()` path cannot render it per-collision or attach reason
tokens without re-parsing prose. Callers also cannot narrow on `instanceof` to tell a
collision apart from any other throw out of the admission pipeline.
**Fix:** Add a typed class alongside the existing domain errors and throw it here:

```ts
export class WorkflowNameCollisionError extends Error {
  readonly collisions: readonly { generatedName: string; fileNames: readonly string[] }[];
  constructor(collisions: readonly { generatedName: string; fileNames: readonly string[] }[]) {
    super(`Generated workflow name collision detected. ...`);
    this.name = "WorkflowNameCollisionError";
    this.collisions = collisions;
  }
}
```

The pre-existing `assertNoCommandCollisions` has the same shortcoming, so this is a
consistency-with-precedent call rather than a regression — but this is the file that gets to
choose.

### WR-07: `assertNoWorkflowNameCollisions` duplicates `assertNoCommandCollisions` almost line for line

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:160-186` versus
`extensions/pi-claude-marketplace/bridges/commands/stage.ts:77-100`
**Issue:** The grouping loop, the `files.length > 1` filter, the `"${gen}" <- [${quoted}]`
rendering, the `\n  ` join and the headline sentence are the same code with two identifiers
renamed. The locked divergence is about *what* is grouped (whole verdict array, no prior
dedup, file names rather than source names) — not about how the message is rendered, and the
repository runs SonarCloud copy-paste detection plus `sonarjs/no-identical-functions`, which
this evades only because of the `.filter(isAdmitted)` line and the differing string
constants. Two independently-maintained renderers will drift.
**Fix:** Extract the grouping-and-rendering half into one shared helper that takes
`(pairs: readonly [string, string][], headline: string)` and returns the rendered collision
lines (or throws the typed error from WR-06); let each caller keep its own projection and
headline, which is where the deliberate divergence actually lives.

### WR-08: No collision test involves a `stem-fallback` verdict, though the contract says both admitted arms participate

**File:** `tests/domain/workflow-script.test.ts:529-665`
**Issue:** `AdmittedWorkflow` is documented as "the two arms that carry a `generatedName`, and
so the two a collision can involve", and `isAdmitted` tests both. Every collision test builds
its verdicts through `metaSource(...)`, which always produces the `named` arm. The
`stem-fallback` half of the union is exercised only by the negative test (WNAM-05 skipped and
refused verdicts are ignored). The most likely real-world collision — one script declaring
`meta.name: "runner"` while a sibling `runner.js` has no readable name and stem-falls back to
the same generated name — has no coverage.
**Fix:** Add a row pairing `["runner.js", 'export const meta = { description: "d" };']` with
`["other.js", metaSource("runner")]` and assert both file names appear under
`"acme:runner"`.

### WR-09: Test gaps and stringly-typed expectations weaken the admission table

**File:** `tests/domain/workflow-script.test.ts:234-239`, `363-372`; `tests/domain/name.test.ts`
(the WNAM-06 block)
**Issue:** Four points:
1. `SKIPPED_CASES` declares `expectedCause: string` and `refusalOf` returns
   `{ cause: string; reason: string }` rather than the exported `SkippedCause` / `RefusedCause`
   unions, so a typo'd expectation (`"no_meta"`, `"determinism_code"`) compiles and only fails
   at run time — and a *renamed* cause would compile and fail confusingly rather than at the
   type level. The unions are exported precisely so tests can bind to them.
2. No row covers the object-literal shapes in CR-01 and CR-02 (duplicate key, spread), the
   shape that motivated `meta-not-object-literal` through a declaration rather than a call
   (`let meta;` with no initializer), or multiple declarators in one statement
   (`export const a = 1, meta = {...}`) — all of which the AST walk claims to handle.
3. `WNAM-06 / SC-4` tests the 128-character cap only on the failing side (129). The passing
   boundary (a joined name of exactly 128, i.e. `"a".repeat(123)`) is untested, so an
   off-by-one to `>= 128` would keep every test green.
4. The engine-parity gate is asserted only through `generatedWorkflowName`; nothing pins that
   `assertSafeName` was *not* widened (a test that `generatedCommandName("acme", "audit ")`
   still succeeds would nail the stated "wraps rather than widens" invariant).

**Fix:** Type the expectation fields as the exported unions, add the four missing rows, add
the 128-pass boundary, and add the negative widen-guard assertion on
`generatedCommandName` / `generatedSkillName`.

### WR-10: The `rejectedGeneratedName` assertion is vacuous — the preceding equality already pins the value

**File:** `tests/domain/workflow-script.test.ts:136-142`
**Issue:** `assert.equal(verdict.generatedName, c.expectedGeneratedName)` at line 130 fixes the
value exactly. The subsequent
`assert.notEqual(verdict.generatedName, c.rejectedGeneratedName)` can only fail if
`expectedGeneratedName === rejectedGeneratedName`, i.e. if the fixture contradicts itself. It
cannot detect any behavior change the line above has not already detected, and it carries two
extra table fields (`rejectedGeneratedName`, `rejectedNote`) used by exactly one row.
**Fix:** Either drop the two fields and put the intent in the row's `name` string, or move the
claim somewhere it can fail independently — a direct assertion that the stem-derived name is
what the *fallback* path produces for the same file name, proving the two paths differ:

```ts
const fallback = admitWorkflowScript("paperjury", "drafter.workflow.js",
  `export const meta = { description: "x" };\n`);
assert.equal(fallback.outcome === "stem-fallback" ? fallback.generatedName : undefined,
  "paperjury:drafter.workflow");
```

---

_Reviewed: 2026-08-15T12:06:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
