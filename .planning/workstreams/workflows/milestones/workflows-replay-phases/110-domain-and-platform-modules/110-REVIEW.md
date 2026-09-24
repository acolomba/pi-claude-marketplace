---
phase: 110-domain-and-platform-modules
reviewed: 2026-09-05T09:20:00Z
iteration: 2
depth: standard
diff_base: 0c951c6b
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
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 110: Code Review Report (iteration 2)

**Reviewed:** 2026-09-05T09:20:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Ten commits (`101478f3`..`1df0c12a`) answered the iteration-1 review. I did not
re-derive that list. I answered the three questions the pass was scoped to, and
verified every load-bearing engine claim against an unpacked
`@quintinshaw/pi-dynamic-workflows@3.10.1` rather than against the fix report's
account of it.

**Question 2 — is the WR-02 loosening correct? Yes, verified independently.**
Every claim in the fix report checks out against `dist/workflow-saved.js`:

- `isSafeSavedWorkflowName` (line 27) rejects a name that **is** `"."` or `".."`,
  not one ending in one. `acme:.` and `acme:..` pass all seven clauses.
- `sourcePath` (line 78) is `assertSafeSavedWorkflowName(name)` then
  `join(dirs[source], `${name}.json`)`. `acme:..json` and `acme:...json` are
  ordinary one-segment file names; `..` normalizes only as a whole segment, so
  neither is traversal.
- `loadFromFile` reads the name from `data.name` in the JSON body, never by
  parsing it back out of the file name. No round-trip to break.

I then ran my own differential — 31 sources, not the fixer's 25, adding the
lone-surrogate, NFC/NFD, case-only, NBSP and DEL rows — calling the engine's real
`isSafeSavedWorkflowName` on the name our generator would mint:
`{ rows: 31, excess: 1, lax: 0 }`. The single excess is the empty `meta.name`,
which the engine's own `validateMeta` (`dist/workflow.js:1130`) refuses anyway.
The loosening is safe and the module's "never exceed the engine" invariant now
holds. The deliberate contradiction of the `110-02-PLAN.md` `must_have` is sound
on its merits: D-141-02's empty-head rule satisfies the clause's stated purpose
("neither may silently produce the bare `acme:`") by construction.

**Question 3 — did the WR-01 template fix stay inside the engine's rule? Yes.**
The engine's `evaluateLiteral` `TemplateLiteral` arm (`dist/workflow.js:1106`)
throws only when `expressions.length > 0` and otherwise joins
`quasi.value.cooked ?? raw`. Our `literalString` is a strict **subset** of that:
top-level property values only, `expressions.length === 0` only, `cooked` only.
It resolves nothing the engine does not. The security property survives: I
confirmed with acorn that a bad escape in an *untagged* template is a hard parse
error (`Bad escape sequence in untagged template literal`), so `cooked` is never
`null` on this path and `String()` cannot silently mint the name `"null"`; and a
`TaggedTemplateExpression` — the one node type where `cooked: null` is reachable
— never satisfies the `node.type === "TemplateLiteral"` test. No non-`Literal`
node's value reaches evaluation or string coercion on any path.

**Question 1 — did a fix introduce a defect? Yes, one (WR-10).** The WR-03
last-wins rewrite is wrong for `var meta = {…}; var meta;`, which JavaScript
leaves bound to the object. Two further defects (WR-11, WR-12) are not
regressions but were not reported in iteration 1 and are demonstrable.

Gates re-run on the current tree, all green: `tsc --noEmit` exit 0, `eslint` exit
0, `prettier --check` clean, `npm run fallow` exit 0, and 233/233 tests pass
across the five in-scope test files.

IN-01..IN-06 remain present as expected and are not re-reported. None changed
severity: the code around each is untouched or, for IN-02, changed in a way that
leaves the observation intact.

## Warnings

### WR-10: The WR-03 last-wins rewrite reports a wrong verdict for `var meta = {…}; var meta;`

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:583-606`
(assignment at 598-601; the claim it breaks is the doc comment at 573-582)

**Issue:** This is a **regression introduced by the WR-03 fix**. The loop now
overwrites `found` on every top-level declarator named `meta`, including one with
no initializer. JavaScript does not: a bare `var meta;` redeclaration leaves the
existing binding untouched (`var x = 1; var x;` leaves `x === 1`). The function's
own doc comment states the invariant it now violates — "the `meta` declarator the
evaluated module would end up with -- in order, LAST WINS".

Reproduced against the current module:

```
input : var meta = { name: "first", description: "d" };
        var meta;
before: {"outcome":"named","metaName":"first","generatedName":"acme:first"}
after : {"outcome":"skipped","cause":"meta-not-object-literal"}
```

The pre-fix first-wins loop happened to be right here. The new code reports
`meta-not-object-literal` for a script whose `meta` demonstrably *is* an object
literal, so the user-facing reason ("declares `meta` as something other than an
object literal") is a false statement about the file. The blast radius is bounded
— the engine refuses these non-`export const` shapes wholesale — but the module's
entire contract is that it models JavaScript evaluation, and the new test row
("lets a later non-object meta declarator supersede an earlier object literal")
pins `var meta = makeMeta()` only, so nothing guards the no-initializer form.

**Fix:** Only a declarator that actually rebinds may supersede. Skip the
init-less form:

```ts
for (const declarator of decl.declarations) {
  if (declarator.id.type !== "Identifier" || declarator.id.name !== "meta") {
    continue;
  }

  // `var meta;` re-declares without rebinding, so it cannot supersede an
  // earlier initializer -- JavaScript keeps the object.
  if (declarator.init === undefined || declarator.init === null) {
    continue;
  }

  found =
    declarator.init.type === "ObjectExpression"
      ? { kind: "object-literal", elements: declarator.init.properties }
      : { kind: "meta-not-object-literal" };
}
```

Add a row for `var meta = { name: "first", description: "d" }; var meta;`
expecting `named` / `acme:first`.

### WR-11: A computed key can overwrite `meta.name`, and `metaPropertyKey` drops it silently

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:613-627`
(consumed at 659-678)

**Issue:** `readMetaString`'s doc comment makes the argument explicitly for
spreads — "it can introduce a key that was never written and overwrite one that
was. That is why the scan carries spreads instead of filtering them out, and why
the answer is `opaque` rather than a guess." A computed key does exactly the same
thing, and `metaPropertyKey` returns `undefined` for it, which makes
`readMetaString` `continue` past it as if the element were not there. So the
element with the strongest claim on the key is the one form the scan ignores.

Reproduced:

```
input : var meta = { name: "x", ["na"+"me"]: "y" };
actual: {"outcome":"named","metaName":"x","generatedName":"acme:x"}
JS     : meta.name === "y"
```

The same gap as WR-03, in the same file, one level down: a name is minted that
the evaluated object never carries. It is bounded today because the engine's
`evaluateLiteral` throws `computed keys not allowed in meta`, so such a script
never loads — but that is the WR-09 argument, and WR-09 was deferred on the basis
that the *bridge* would warn, which cannot help a verdict that reports `named`
with a confident wrong name.

**Fix:** Treat a computed property the way a spread is treated — it makes the key
set unknowable from that point on:

```ts
for (const element of elements) {
  if (element.type === "SpreadElement" || element.computed) {
    read = { kind: "opaque" };
    continue;
  }
  // ...
}
```

`metaPropertyKey`'s `p.computed` guard then becomes unreachable and should be
dropped rather than left as an uncoverable branch. Add a row pinning
`{ name: "x", ["na"+"me"]: "y" }` as `skipped` / `meta-spread` (or a new cause).

### WR-12: Two distinct generated names collapse to one file when either carries a lone surrogate

**File:** `extensions/pi-claude-marketplace/domain/name.ts:202-229`;
`extensions/pi-claude-marketplace/domain/workflow-script.ts:190-211`

**Issue:** `generatedWorkflowName` admits a lone surrogate — verified,
`generatedWorkflowName("acme", "a\uD800b")` returns `"acme:a\uD800b"` — because
neither `assertSafeName` nor the engine's `\p{Cc}\p{Cf}` screen covers `\p{Cs}`.
`assertNoWorkflowNameCollisions` then compares generated names as exact strings.
Node encodes a lone surrogate as U+FFFD when it converts a JS string to a path,
so two names that are distinct in memory name one file on disk:

```
writeFileSync(dir + "/acme:\uD800.json", "A");
writeFileSync(dir + "/acme:\uDC00.json", "B");
readdirSync(dir) -> [ 'acme:�.json' ]   // one entry
readFileSync(a)  -> "B"                       // A silently overwritten
```

This is the same class as `NAMEFOLD-01`, but `NAMEFOLD-01` scopes itself to
"names that differ only by ASCII case, or only by Unicode normalization form",
and the reason recorded there for declining a fold — "on a case-sensitive volume
-- Linux, which is the only platform CI runs -- `acme:Ship` and `acme:ship` are
two distinct working files" — is **false for this variant**. The collapse above
happened on Linux, on ext4, at the encoding layer, not the volume layer. So the
one argument that made the case-fold a policy question does not cover surrogates,
and no gate watches this door.

There is no writer yet (Phase 111), which is why this is a Warning and not a
Blocker. But the name gate under review is the component that is supposed to
prevent it.

**Fix:** Refuse a lone surrogate in the generated name. It is not an engine-parity
excess in any meaningful sense — a name the filesystem cannot round-trip is one
the engine's own `sourcePath`/`loadFromFile` pair cannot round-trip either:

```ts
// A lone surrogate has no UTF-8 encoding, so the filesystem substitutes U+FFFD
// and two distinct names become one file. The engine writes `${name}.json`, so a
// name that cannot round-trip through a path is not a usable saved name.
if (/\p{Cs}/u.test(name)) {
  throw new UnsafeGeneratedNameError(
    name,
    `Generated workflow name "${name}" must not contain unpaired surrogates.`,
  );
}
```

Then extend `NAMEFOLD-01` to record the encoding-lossy variant alongside the
case/normalization one, and note there that the Linux-is-case-sensitive rebuttal
does not apply to it.

## Info

### IN-07: The new `UnsafeGeneratedNameError` import breaks the alphabetical member order

**File:** `tests/shared/errors.test.ts:28-29`

**Issue:** `UnsafeGeneratedNameError` was appended after `UnsupportedSourceError`.
Case-insensitive ascending order puts `Unsafe…` first (`a` < `u` at position 4).
Every other member in that specifier is in order. ESLint does not enforce member
order inside a specifier, so the gate cannot catch the drift.

**Fix:** Move the import one line up.

### IN-08: `forMessage` does not escape the backslash it uses as its own escape marker

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:741-746`

**Issue:** The escaper renders a control or format character as `\u{a}` but
leaves a pre-existing literal backslash untouched, so a file literally named
`x\u{a}Installed 5 workflows` renders byte-identically to the escaped form of a
real newline. The forged-line-break hazard WR-05 closed does not reopen (the text
still occupies one line), but the rendering is ambiguous about what the plugin
actually shipped.

**Fix:** Escape `\` first, or state in the doc comment that the mapping is
deliberately one-way because only the line-integrity property is being defended.

---

_Reviewed: 2026-09-05T09:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
