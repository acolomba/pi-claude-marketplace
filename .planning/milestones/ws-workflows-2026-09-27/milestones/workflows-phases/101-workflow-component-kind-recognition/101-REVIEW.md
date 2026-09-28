---
phase: 101-workflow-component-kind-recognition
reviewed: 2026-08-16T04:35:57Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/domain/components/plugin.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - docs/output-catalog.md
  - tests/domain/resolver-strict.test.ts
  - tests/domain/resolver-loose.test.ts
  - tests/architecture/hooks-foundation.test.ts
  - tests/orchestrators/plugin/info-manifest-absent.test.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 101: Code Review Report

**Reviewed:** 2026-08-16T04:35:57Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 101's core contribution holds up. The both-axes admission is genuinely wired
and generic, not a field-only implementation: `collectStrictComponentKind`
(`domain/resolver.ts:901-927`) probes `<pluginRoot>/<kind>` with `statKindOf` at line
918 for every member of `SUPPORTED_COMPONENT_PATH_KINDS`, and `workflows` was added to
that tuple with no special case. A convention-only plugin therefore resolves
`installable` with `componentPaths.workflows === ["workflows"]`, and the loose-mode
negative (no convention axis) is pinned separately. `componentPaths.workflows` is a
required schema member (`resolver.ts:71`, `:401`, `:429`) with no `?? []` anywhere in
the tree. The declared axis rides the shared
`readPathOrArray -> validateComponentPath -> assertPathInside` chain with no
kind-specific validator, so containment, absolute-path rejection and dedup are
inherited rather than reimplemented. Both lenient `unavailable`-arm literals
(`info.ts:1334`, `info.ts:2005`) seed `workflows: ["workflows"]`, so no surface reads
a workflows directory as absent. The `nameFromEntry` silent-empty trap is closed
twice over: the current arm derives its suffix set and its strip length from
`domain/workflow-script.ts` (`WORKFLOW_SCRIPT_EXTENSIONS` + `fileStem`), so `.mjs` and
`.cjs` and mixed case all strip correctly. The `SUPPORTED_COMPONENT_KINDS` closed-set
gate counts the new member (`tests/architecture/hooks-foundation.test.ts:199`) and the
no-expansion gates pass unedited. The lenient declared-path read that Phase 103 flagged
as CR-04 is now gated by `isContainableComponentPath` (`info.ts:1363-1371`), and the
workflows bridge re-asserts containment on the read side (`bridges/workflows/discover.ts:239-243`).

Two problems remain.

The phase recorded as its closure mechanism that the length-exact `COMPONENT_KINDS`
tuple makes it impossible for the renderer to silently omit a newly-admitted kind.
That mechanism does not exist. It is a 6-element tuple of a union type; adding a
seventh key to the interface without growing the tuple typechecks cleanly. I verified
this against the repo's own `tsc` with an isolated reduction of the exact declaration,
exit 0. The guard catches removals and renames only, and no test pins the tuple's
membership. That missing gate has already been paid for: a second producer of the same
`components` object, `composeStateOnlyComponents`, renders every kind from
`resources.*` except `workflows` — so the record-backed `info` arm still reads as
though the directory were not there, which is the exact outcome the phase's third
success criterion names.

## Structural Findings (fallow)

No structural pre-pass was supplied with this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The record-backed `info` arm silently drops the `workflows:` line

**Severity:** BLOCKER
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1203-1246` (specifically `:1211-1214` and `:1230-1243`)

**Issue:**
`composeStateOnlyComponents` builds the component inventory for the state-only arm
(INFO-09 / INFO-11 — an installation record whose marketplace manifest loaded but no
longer declares the plugin, reached at `info.ts:927`, and reused for the disabled row
via `applyDisabledRowShape` at `:932`). It reads four name-list arrays plus hooks:

```ts
const agents = sortComponentNames(record.resources.agents);
const commands = sortComponentNames(record.resources.prompts);
const mcp = sortComponentNames(record.resources.mcpServers);
const skills = sortComponentNames(record.resources.skills);
```

`record.resources.workflows` is never read, and the returned `components` object has
no `workflows` key. `resources.workflows` is a REQUIRED persisted field
(`persistence/state-io.ts:132`, WLIF-01) holding the generated names the workflows
phase staged, and it is already consumed elsewhere on a sibling surface
(`orchestrators/plugin/list.ts:466`). So the data exists, is populated, and is
reachable — this arm just does not render it.

Consequences:

- A workflow-bearing plugin whose manifest entry has gone away renders
  `agents:`, `commands:`, `hooks:`, `mcp:` and `skills:` lines and no `workflows:`
  line, on a row that emits `componentsResolved: true` — which per the arm's own
  docstring (`info.ts:1127-1129`) means "we looked and these are the components". The
  row makes a positive, wrong claim rather than declining to answer.
- The same omission hits the disabled state-only row.
- This is a direct miss of the phase's third success criterion ("reports a workflow
  component count on `list` and `info` instead of resolving as though the directory
  were not there") on one of the two `info` arms.
- The function's own docstring at `info.ts:1124` states the inventory comes from
  `resources.*`, and `info.ts:1183` says "the four name-list `resources` arrays" —
  both stale now that the record carries six.

It is untested and the test file's banner comment actively claims otherwise:
`tests/orchestrators/plugin/info-manifest-absent.test.ts:372` states the kind order is
`agents, commands, hooks, mcp, skills, workflows`, while every fixture in that file
seeds `workflows: []` (`:231`, `:442`, `:864`, `:1184`). A green suite there is
consistent with the line never being renderable.

**Fix:**
Read the sixth array and spread it in the tuple-ordered position:

```ts
  const skills = sortComponentNames(record.resources.skills);
  // WLIF-01: the record names the staged envelopes; workflow artifacts live
  // outside every scope root, so this array is the only inventory of them.
  const workflows = sortComponentNames(record.resources.workflows);
  ...
  return {
    components: {
      ...(agents.length > 0 && { agents }),
      ...(commands.length > 0 && { commands }),
      ...(hooksRead.kind === "listed" &&
        hooksRead.entries.length > 0 && { hooks: hooksRead.entries }),
      ...(mcp.length > 0 && { mcp }),
      ...(skills.length > 0 && { skills }),
      ...(workflows.length > 0 && { workflows }),
    },
```

Then add a non-empty `resources.workflows` case to
`tests/orchestrators/plugin/info-manifest-absent.test.ts` asserting the rendered line
position, and correct the "four name-list kinds" phrasing at `info.ts:1183` and in that
test's banner. A paired `docs/output-catalog.md` state is warranted if the byte-equality
contract is to cover this arm the way `installed-single-scope-with-workflows` covers
the manifest-backed one.

## Warnings

### WR-01: The `COMPONENT_KINDS` "exact-length tuple" guard does not guard against what its comment claims

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/shared/notify.ts:3357-3372`

**Issue:**
The comment asserts:

> The tuple is sized exactly (6 entries): adding a 7th key to
> `PluginInfoComponentsResolved.components` without extending this tuple breaks the
> typecheck here -- TS rejects the literal because `ComponentKind` would no longer
> cover every keyof the interface. Without the explicit tuple length, the renderer
> would silently omit the new kind from output.

That is false. `ComponentKind` is `keyof PluginInfoComponentsResolved["components"]`,
a union. Adding a seventh key widens the union; all six existing literals remain
assignable to the widened union and the arity still matches six literals, so the
declaration compiles unchanged. I reduced the exact declaration to an isolated file
with a simulated seventh key and ran the repo's own `tsc --strict`: exit 0.

The construct does catch a REMOVED or RENAMED key (the stale literal stops being
assignable), which is real but is not the failure mode the comment names. And no test
pins the tuple's membership — `grep -rn COMPONENT_KINDS tests/` returns only comments,
and neither `compat-01-no-expansion.test.ts` nor `notify-closed-set-locks.test.ts`
covers it.

This matters beyond the comment: Phase 101 recorded this construct as the closure proof
for the renderer half of the widening ("the length-exact `COMPONENT_KINDS` tuple makes
it impossible for the renderer to silently omit a newly-admitted kind",
`101-01-SUMMARY.md` patterns-established). CR-01 above is a live instance of exactly the
omission the construct was believed to prevent, on the other producer of the same object.

**Fix:**
Either replace the comment with what the construct actually enforces, or make it
enforce the claim. A real exhaustiveness gate costs one line:

```ts
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS = ["agents", "commands", "hooks", "mcp", "skills", "workflows"] as const;
// Exhaustiveness: every key of the interface must appear in the tuple. A newly
// added kind that is not listed here fails this line, not silently at render time.
type _AssertAllKindsRendered = _AssertTrue<
  [Exclude<ComponentKind, (typeof COMPONENT_KINDS)[number]>] extends [never] ? true : false
>;
```

and pair it with an architecture test that walks the tuple against the producers, so a
kind admitted in `resolver.ts` but never populated by a `components` producer is caught
by a failing assertion rather than by a reader.

### WR-02: The `discoverWorkflowNames` fallback bypasses the containment its own module header requires, and is unreachable

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:393-411` (fallback at `:398-402`)

**Issue:**
Two defects in one branch.

1. **Containment asymmetry.** The primary path calls `discoverPluginWorkflows`, which
   runs `assertPathInside` on every declared workflows directory before it reads
   anything (`bridges/workflows/discover.ts:239-243`). That module's header
   (`:20-26`) names the `info` surface explicitly as the reason the check lives there:
   "the read-only `info` surface re-derives component paths for the arm the resolver
   could not resolve, from raw manifest strings". The fallback at `:398-402` calls
   `discoverComponentNames` instead, which does `readdir` with no containment check at
   all (`info.ts:341-343`). `deriveLenientComponentPaths` does apply the string-level
   `isContainableComponentPath`, so a declared `../..` or `/etc` is rejected — but a
   symlinked directory under the plugin root is not, and `assertPathInside` is the only
   thing in the codebase that refuses symlinks (D-14, `shared/path-safety.ts:107-118`).
   Disclosure is limited to directory-entry names, not file contents, and matches what
   `skills`/`commands`/`agents` already do on the same call — but the workflows path
   was deliberately given a stronger guarantee, and this branch quietly drops back to
   the weaker one.

2. **Dead code.** The fallback fires only when `assertSafeName(pluginName)` throws. It
   cannot: `resolveStrict`'s preflight calls `assertSafeName(entry.name)` unguarded at
   `domain/resolver.ts:733` and lets it throw, so an unsafe entry name never produces a
   resolver arm at all — it becomes a `(failed)` row. Every caller of
   `composeResolvedComponents` (`info.ts:1299`, `:1651`, `:1743`, `:2010`, `:2194`) sits
   downstream of a successful `resolveStrict`. The docstring's rationale ("an unsafe
   plugin name disqualifies every script at once ... one bad name must not cost the user
   the whole plugin's view") describes a scenario the control flow forbids.

**Fix:**
Preferred: delete the fallback and call `discoverPluginWorkflows` unguarded, since the
condition it guards against cannot occur — the pre-check and its `discoverComponentNames`
sibling both go, and `nameFromEntry`'s `workflows` arm loses its only caller. If the
branch is kept as defence in depth, route it through the same containment the primary
path uses rather than the unchecked walk:

```ts
for (const rel of componentDirs) {
  await assertPathInside(pluginRoot, path.resolve(pluginRoot, rel), `workflows component path "${rel}"`);
}
return await discoverComponentNames(pluginRoot, componentDirs, "workflows");
```

Either way, correct the docstring so it does not assert a reachability the code does not
have.

## Info

### IN-01: Contradictory documentation on the same schema object

**Severity:** WARNING (documentation)
**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts:27` vs `:66-67`

**Issue:**
Phase 101 added, at line 27:

```ts
  // WFLW-01: path-bearing (`string | array`), same shape as the three above.
  workflows: Type.Optional(Type.Unknown()),
```

Forty lines below, the spread of that same object into `PLUGIN_ENTRY_SCHEMA` is
annotated:

```ts
  // optional supported component-path fields (MM-2: string form preferred;
  // array form is rejected by the resolver per PR-2)
```

The second comment is stale — it predates D-07/COMP-01, which replaced PR-2's
short-circuit semantics with `readPathOrArray` (`resolver.ts:797-807`) plus additive
union. Arrays are accepted for all four path-bearing kinds; `resolver-strict.test.ts`
pins the array form for `workflows` explicitly. A reader now meets two comments on one
object stating opposite contracts, and cannot tell which is current. This was
pre-existing (commit `751836d6`), but Phase 101 is the change that put the
contradicting statement next to it.

**Fix:** Update lines 66-67 to state the D-07 contract:
`// optional supported component-path fields (MM-2 / D-07: string OR array of strings; the resolver unions declared paths with the convention directory)`.

### IN-02: Orphaned doc block above `nameFromEntry`

**Severity:** WARNING (documentation)
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:257-278`

**Issue:**
The block comment describing "Walk one or more component-kind DIRECTORIES ... Read
failures of ENOENT/ENOTDIR yield an empty bucket ... this helper sorts before
returning" documents `discoverComponentNames` (`:335`), but sits directly above
`nameFromEntry` (`:281`) with a second doc comment wedged between them at `:279-280`.
Neither function's real doc comment is the one a reader or an IDE hover picks up.
Phase 101 amended this block (it added the `workflows` bullet at `:267`) without
relocating it. Its `workflows` bullet is also now imprecise: it says "basename minus
its script suffix", while the arm at `:289-299` additionally lower-cases the name for
the suffix test and admits three suffixes, not one.

**Fix:** Move lines 257-278 to immediately above `discoverComponentNames` at `:335`,
and either drop the per-kind bullet list or point it at `nameFromEntry` as the single
authority on per-kind naming.

---

_Reviewed: 2026-08-16T04:35:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
