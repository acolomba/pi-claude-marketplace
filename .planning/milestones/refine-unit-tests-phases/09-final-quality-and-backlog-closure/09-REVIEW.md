---
phase: 09-final-quality-and-backlog-closure
reviewed: 2026-09-11T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
  - extensions/pi-claude-marketplace/index.ts
  - scripts/revalidation.mjs
  - tests/architecture/config-state-consistency.test.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/hooks-if-field.test.ts
  - tests/architecture/hooks-lifecycle.test.ts
  - tests/architecture/revalidation.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/bridges/hooks/index.test.ts
  - tests/bridges/hooks/stage.test.ts
  - tests/e2e/import-command.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/register.test.ts
  - tests/index.test.ts
  - tests/integration/concurrent-install-child.ts
  - tests/integration/fold-adoption.test.ts
  - tests/integration/hooks-additionalcontext-end-to-end.test.ts
  - tests/integration/hooks-cross-scope-reconcile.test.ts
  - tests/integration/hooks-dispatch-end-to-end.test.ts
  - tests/integration/hooks-spawn-end-to-end.test.ts
  - tests/integration/load-reconcile-race-child.ts
  - tests/integration/transaction-lifecycle-cascade.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/types.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-09-11
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

The substantive change — routing both `readFile` call sites in
`bridges/hooks/event-router.ts` through one injected `HooksFileReader` — is
correct. I traced the four specific risks named in the brief and none of them
materialized:

1. **Containment guard position (NFR-10).** Preserved exactly.
   `tryHydrateOnePlugin` still runs
   `assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate path")` at
   `event-router.ts:613`, and the ported read is at `event-router.ts:641`, 28
   lines later. `hooksJsonPath` is a `const` parameter and is never reassigned
   between the two, so no path the guard approved can be swapped before the
   read. The only change in that block is the comment wording at lines 610-611.
2. **Generation-staleness interleaving.** Not reordered and not dropped. The
   three guards in `tryHydrateOnePlugin` (lines 621, 649) and the loop guard in
   `hydrateScopeFromState` (line 586) are byte-for-byte where they were; the
   diff adds only the `reader` parameter to those signatures.
3. **Error-handling parity.** Both ported sites keep their original
   `try`/`catch` → `hookDebugLog` → `return` shape (`event-router.ts:137-143`
   and `641-647`). A read failure is still non-fatal on both paths.
4. **Test seam vs. production design.** `HooksFileReader` is not a test-only
   surface. It carries no `__`-prefixed member (so
   `tests/architecture/no-test-only-production-surface.test.ts` is not merely
   being dodged on a technicality), the composition root at `index.ts:38,41`
   supplies the real implementation, and the shape matches an existing house
   pattern — `orchestrators/plugin/info.ts:513` already reads the *same*
   `hooks.json` file through its own injected `PluginInfoReader.readTextFile`.
   CONVENTIONS.md's "dependency injection over test-only seams" rule is
   satisfied.

The mechanical half is uniform. I diffed all ~36 test files: every added line is
either the `readHooksJson` import, the literal `{ readHooksJson }` /
`readHooksJson` argument, or a Prettier re-wrap forced by the longer call. Two
call sites gained a multi-line wrap
(`tests/orchestrators/plugin/reinstall-flow.test.ts:107`,
`tests/edge/handlers/plugin/reinstall.test.ts:128`) and one gained a wrapped
argument list (`tests/orchestrators/plugin/enable-disable.test.ts:143`); all
three are formatting only. No site deviates from the pattern, and no site
smuggled in a substituted reader where a real one was intended. The single
non-mechanical test edit — the stale-generation case at
`tests/bridges/hooks/event-router.test.ts:1929` — is a genuine improvement: it
replaces a runtime decorator plus a hard-coded `currentGeneration()` call index
with a named trigger, and it still discriminates the guard it names (deleting
`event-router.ts:649` would let `setParsedConfig` run and fail the empty-cache
assertion). Its comment about object-literal method shorthand not binding an
identifier in its own body is correct, so the delegation to the imported
`readHooksJson` is not accidental recursion.

`scripts/revalidation.mjs` is an eight-value status flip that matches
`.planning/REQUIREMENTS.md:185-194` row for row; the two paired test-fixture
edits in `tests/architecture/revalidation.test.ts` (lines 1026, 1219) track it,
and both are self-guarding (a marker that stopped matching would make
`String.replace` a no-op and flip the expected exit status).

No comment in the changed source cites a phase, plan, or wave number. The only
`Phase 9` token added is the traceability-table fixture string at
`tests/architecture/revalidation.test.ts:1026`, which is contract data, not a
comment. All new exports carry explicit return types.

Findings below are quality and documentation defects. None blocks the change.

## Warnings

### WR-01: The byte-fidelity case cannot discriminate the utf-8 half of `readHooksJson`'s contract

**File:** `tests/bridges/hooks/stage.test.ts:879-892`

**Issue:** `readHooksJson`'s doc comment
(`extensions/pi-claude-marketplace/bridges/hooks/stage.ts:47-48`) promises "one
utf-8 read". The new case titled "reads back the exact bytes written to a
hooks.json path" asserts against `EXPECTED_HOOKS_BYTES`
(`tests/bridges/hooks/stage.test.ts:88-91`), which is pure ASCII. Under an
ASCII-only fixture, `readFile(p, "latin1")`, `readFile(p, "ascii")`, and
`readFile(p, "utf8")` all produce the identical string, so a wrong
implementation passes. The encoding argument is the *only* thing this
one-line function does beyond delegating, and it is the part left unpinned.
The direct-coverage gate cannot see this — the line is covered either way.

The sibling ENOENT case at line 896 is fine, and the `Buffer`-returning
mistake (dropping the encoding argument entirely) *is* caught by
`assert.strictEqual` against a string. Only the wrong-codec class slips through.

**Fix:** Give the read case its own fixture containing at least one multi-byte
character, rather than reusing the write-path constant:

```ts
// tests/bridges/hooks/stage.test.ts
const MULTIBYTE_HOOKS_BYTES = '{\n  "note": "café — éçü"\n}\n';

test("reads back the exact bytes written to a hooks.json path", async () => {
  const { scopeRoot } = await allocateCasePaths("hooks-stage-read-bytes-");
  try {
    // arrange
    const hooksJsonPath = path.join(scopeRoot, "hooks.json");
    await writeFile(hooksJsonPath, MULTIBYTE_HOOKS_BYTES, "utf8");

    // act
    const raw = await readHooksJson(hooksJsonPath);

    // assert
    assert.strictEqual(raw, MULTIBYTE_HOOKS_BYTES);
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});
```

### WR-02: `hookConfigPathFor`'s doc comment now promises a consumer this phase declined to wire

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:37-44`,
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:573`

**Issue:** `hookConfigPathFor`'s doc comment reads: "Single source of truth for
the hooks bridge write path. Consumed by `writeHookConfig` and (later) by any
hydrate-side reader so the same composition is never duplicated." This phase
landed the hydrate-side reader — and composed the path inline anyway.
`event-router.ts:573` still builds `path.join(loc.hooksDir, slug, "hooks.json")`
by hand, as does `orchestrators/plugin/info.ts:511`. So the comment's forward
promise is now contradicted by the code, and it also contradicts a recorded
decision in a sibling file: `info.ts:506-510` states the duplication is
deliberate because the barrel does not re-export `hookConfigPathFor`.

Two files in the same bridge now tell a reader opposite things about whether
the join is supposed to be deduplicated. The project comment policy
(`.claude/rules/typescript-comments.md`) forbids comments that describe a shape
the code does not have; a promise about a consumer that arrived and did not
consume is the same defect class.

Note the dedup is directly available if wanted: `hookConfigPathFor(loc, slug)`
is textually identical to the inline join, since `resources.hooks` carries the
same generated name the write path uses (D-57-03).

**Fix:** Pick one and make both files agree. Either route the composition
through the helper:

```ts
// extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
import { hookConfigPathFor } from "./stage.ts";
// ...
const hooksJsonPath = hookConfigPathFor(loc, slug);
```

or drop the unfulfilled clause so the comment describes what is true today:

```ts
/**
 * Single source of truth for the hooks bridge write path. The hydrate and info
 * read sites compose the same join inline (see `info.ts`'s D-57-03 note).
 */
```

### WR-03: `SEALED_REQUIREMENT_ROUTES` can silently desynchronize from `SEALED_REQUIREMENT_SIGNATURES`, crashing the gate

**File:** `scripts/revalidation.mjs:2283-2288` (table at lines 58-132, edited by
this phase)

**Issue:** Pre-existing, but this phase edited the exact table, so it is worth
recording. Two frozen objects are keyed by requirement ID:
`SEALED_REQUIREMENT_SIGNATURES` (line 58) and `SEALED_REQUIREMENT_ROUTES`
(line 93). `SEALED_REQUIREMENT_IDS` is derived from the *signatures* keys
(line 92) and is what gates the call into `validateRequirementDisposition`
(line 2477). Inside, line 2283 does:

```js
const sealedDisposition = SEALED_REQUIREMENT_ROUTES[requirementId];
if (
  routeIsValid &&
  statusIsValid &&
  (disposition.route !== sealedDisposition.route || ...
```

with no presence check. Add an ID to `SEALED_REQUIREMENT_SIGNATURES` and forget
`SEALED_REQUIREMENT_ROUTES` and the gate throws
`TypeError: Cannot read properties of undefined (reading 'route')` instead of
emitting a violation — a validator that dies with a stack trace rather than
naming the contract breach it exists to name. `grep -rn SEALED_REQUIREMENT
tests/` returns nothing, so no test pins the keysets together. (The opposite
drift — routes without signatures — is loud, via the `phase-requirements`
violation at line 2499.)

**Fix:** Derive one table from the other, or assert parity at module load:

```js
const SEALED_REQUIREMENT_IDS = new Set(Object.keys(SEALED_REQUIREMENT_SIGNATURES));
for (const id of SEALED_REQUIREMENT_IDS) {
  if (!Object.hasOwn(SEALED_REQUIREMENT_ROUTES, id)) {
    throw new Error(`sealed requirement ${id} has a signature but no route`);
  }
}
```

## Info

### IN-01: `HooksFileReader` is declared under the "Factory-time hydrate" banner, not near its first consumer

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:408-448`

**Issue:** The port's own doc comment says it is "the one filesystem read
**both** the routing and the hydration chain perform", yet it is declared at
line 442, under the `// Factory-time hydrate (DISP-02 cold-start path)` section
banner at lines 408-410. Its first consumer,
`readAndCachePluginHooksWith`, is at line 130 — ~310 lines earlier, in the
routing half of the file. Interfaces hoist, so this compiles, but a reader
looking for the routing port will not find it under a hydrate banner.

**Fix:** Move both `HooksFileReader` and `HooksHydrationReader` above
`readAndCachePluginHooksWith` (near the `EventRouterRoutingState` alias at line
99), or give them their own banner such as
`// The hooks bridge read port (D-09-05)`.

### IN-02: `HooksHydrationReader extends HooksFileReader` is defensible, but the two names describe one concept badly

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:442-456`

**Issue:** You asked for a judgement, so: the *segregation* is right and the
*naming* is not. Keeping `createHooksRouting` off `loadState` is correct and the
stated reason holds — routing provably never loads state, and merging would have
forced a stub at every one of the ~139 call sites for a member none of them
exercise. That matches the `RemovalOps` precedent at
`shared/fs-utils.ts:58-66`.

What reads poorly is that `HooksHydrationReader` is not a kind of file reader.
It is a two-member dependency bundle: one filesystem read plus one
persistence-layer load. The `extends` relation asserts an is-a that is only
true structurally, and the two names differ by an unhelpful middle word
(`File` vs `Hydration`) rather than by what they carry. A reader has to open
both declarations to learn which is the wide one.

**Fix:** If revisited, prefer names that state the payload rather than the
consumer — e.g. keep `HooksFileReader` and rename the wide one
`HooksHydrationDeps`, declared as an intersection instead of an extension:

```ts
export interface HooksHydrationDeps extends HooksFileReader {
  readonly loadState: (extensionRoot: string) => Promise<ExtensionState>;
}
```

Low priority: this is a readability trade, not a defect, and the current shape
is a recorded decision.

### IN-03: NFR-10 containment now depends on an injected collaborator honoring a prose-only contract

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:444-447`,
`extensions/pi-claude-marketplace/bridges/hooks/stage.ts:53-58`

**Issue:** Both doc comments correctly state the rule — "the path arrives
already contained; an implementation performs no resolution, joining or
normalization of its own". Nothing enforces it. Before this change the read was
a direct `node:fs/promises` call that structurally could not re-resolve the
guarded path; now any object satisfying `HooksFileReader` can. The production
risk is effectively nil (one implementation, one composition-root wiring point,
and `index.ts:38,41` is source-pinned by `tests/index.test.ts:775-796`), so this
is recorded as context rather than a defect. It is the residual cost the design
chose, and the comments do disclose it.

**Fix:** None required. If a second implementation ever appears, consider
having callers pass the already-contained path as a branded type so the
no-re-resolution rule is carried by the type rather than by prose.

### IN-04: Trailing generation guards at the end of two async voids are no-ops

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:916-918`,
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:991-993`

**Issue:** Pre-existing, not introduced here. Both sites end with:

```ts
await sessionStartHandler(event, ctx);

if (!generationIsCurrent()) {
  return;
}
```

and

```ts
await hydrateProjectScopeForCwdWith(reader, cwd, routingState, generationIsCurrent);
if (!generationIsCurrent()) {
  return;
}
```

In both, the guard is the final statement of an `async` function returning
`void`/`Promise<void>`. Taking the early return and falling off the end are
indistinguishable, so neither branch changes any observable behavior. Neither
fallow nor the coverage gate can flag this — the branches are reachable and
covered, they just do nothing.

**Fix:** Delete both trailing guards, or, if they are intended as a
belt-and-braces marker for future code appended below them, say so in a
comment. Out of scope for this phase; recorded so the next editor of these
functions does not assume they carry weight.

---

_Reviewed: 2026-09-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
