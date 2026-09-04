# Edge — args, router, register, flag catalog

**Scope:** `extensions/pi-claude-marketplace/edge/{args.ts,args-schema.ts,flag-catalog.ts,register.ts,router.ts,types.ts}` and their paired tests under `tests/edge/`, plus `tests/edge/notification-boundary.ts` (test support). Excludes `tests/edge/completions/` and `tests/edge/handlers/` per assignment.
**Test files reviewed:** 7 (6 `.test.ts` + 1 test-support file)
**Production modules reviewed:** 6 (every `.ts` file directly under `extensions/pi-claude-marketplace/edge/`; `README.md` is not code)

## Summary

This is the healthiest area reviewed so far: every production module directly under `edge/` has exactly one paired test module, `router.test.ts` is already an exemplary strong-mock dispatch suite (`exactParams: true`, explicit `verify()`, no hand-rolled recorders), `types.test.ts` is correctly type-only, and `args.test.ts`/`args-schema.test.ts`/`flag-catalog.test.ts` all use whole-value `deepStrictEqual`, proper one-`test()`-per-row data tables, and clean AAA structure with no placeholder names, no shared mutable state, and no `it()`/`.only`/`.skip`. The production code is almost entirely pure (no hidden `Date`/`randomUUID`/`process.env` reads; the one `process.cwd()` call in `register.ts` is the explicitly sanctioned registration-glue site). The three themes worth a fixing pass, in priority order: (1) three `register.test.ts` cases hand-roll an `AutocompleteProvider` recorder object to verify a prescribed forwarding call instead of using `strong-mock`; (2) `tests/edge/notification-boundary.ts` is a cross-layer utility (used by `tests/orchestrators/**` and `tests/index.test.ts`, not just `tests/edge/**`) sitting at the edge layer root instead of beside its real concern, `shared/notify.ts`; (3) two small documentation defects in `args.ts`/`args-schema.ts` (missing JSDoc, and a JSDoc block anchored to the wrong declaration).

## Unit test findings

### `tests/edge/register.test.ts`

- **[WARNING] Hand-rolled recorder used for a prescribed collaborator call** — `test('returns the underlying provider's suggestions unchanged (TC-7)')` (lines 367–399), `test('collapses the whitespace run a completion left on its own command line (TC-7)')` (lines 401–434), `test('defers the file-completion trigger to the underlying provider that answers it (TC-7)')` (lines 494–521).
  In each, the `current` object (the `AutocompleteProvider` the wrapper decorates) is a plain literal whose one exercised method pushes its arguments into a local array (`requests`, `applications`, `triggerTests`), which is then compared with `assert.deepStrictEqual` against a hand-written `expected*` array. The interaction under test — "the wrapper calls the underlying provider with exactly these arguments" — is exactly the "callbacks" category the project reserves for `strong-mock`, and this file already uses `strong-mock` correctly everywhere else (`pi`, `ui`, `ctx` are all `mock<T>({ exactParams: true, ... })`). Replace each `current` literal's exercised method with a `mock<AutocompleteProvider>({ exactParams: true, name: "underlying provider" })`, state the one expected call with `when(() => current.getSuggestions(...)).thenResolve(...)` (or `.thenReturn(...)` for `applyCompletion`/`shouldTriggerFileCompletion`), drop the array-push plumbing, and call `verify(current)` in the assert phase alongside the existing `verifyBoundary()`. The other two methods on `current` need no `when()` at all — an unstubbed strong-mock call already throws, which is the same "must not be called" guarantee the current `throw new Error(...)` bodies provide, so those can be dropped once the object is a real mock.
  This does **not** apply to the other `current`-based cases in this file (lines 436–463, 465–492, 523–544): those only return a canned value and never assert what was forwarded to `current`, so a plain stub literal is the correct tool there and needs no change.

### Clean files

- `tests/edge/args.test.ts`
- `tests/edge/args-schema.test.ts`
- `tests/edge/flag-catalog.test.ts`
- `tests/edge/router.test.ts` — already the target shape: every dispatch case uses `mock<SubcommandHandlers>({ exactParams: true, ... })` with an exact-argument `when()` and an explicit `verify(handlers)`; no hand-rolled recorders anywhere.
- `tests/edge/types.test.ts` — correctly type-only: no `test()` import, only `satisfies` bindings and `@ts-expect-error` negatives.

### `tests/edge/notification-boundary.ts` (test support)

- **[WARNING] Cross-layer utility misplaced at the edge layer root** — whole file.
  This factory is imported by 21 files under `tests/edge/**` (including `tests/edge/handlers/**`, out of this assignment's scope) **and** by `tests/orchestrators/import/execute.test.ts`, `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/orchestrators/reconcile/pending.test.ts`, and `tests/index.test.ts`. Its own header comment says the contract it encodes "is not theirs — it belongs to `shared/notify.ts`." So this is not edge-layer test support at all; it is generic-dumping-ground-by-accident — it happens to sit in the first directory that needed it, and every other consumer now reaches across layer boundaries (`../../edge/notification-boundary.ts` from `orchestrators/`, `./edge/notification-boundary.ts` from the root `index.test.ts`) to get it. `tests/shared/notify.test.ts` already exists and is the concern this file actually serves. Move it to `tests/shared/notification-boundary.ts` and update the ~26 import sites across `tests/edge/**`, `tests/orchestrators/{import,plugin,reconcile}/*.test.ts`, and `tests/index.test.ts` to the new relative path.

## Production code findings

### `extensions/pi-claude-marketplace/edge/args.ts`

- **[WARNING] `ParsedArgs` fields are not `readonly`** — lines 21–24.
  Every sibling data interface in this layer (`PositionalSpec`, `FlagEntry`, `EdgeDeps`) declares its fields `readonly`; `ParsedArgs`'s `positional`/`scope` do not, even though the exported value is only ever constructed once and returned. Change to `readonly positional: string[]; readonly scope?: Scope;`.
- **[WARNING] Exported `parseArgs` and `ParsedArgs` carry no JSDoc** — lines 21, 26.
  The sibling exported function in the paired module, `parseCommandArgs` (`args-schema.ts`), has a full JSDoc block with an example; `parseArgs` and the `ParsedArgs` interface it returns have none of their own (only the file-header comment covers behavior). Add a short `/** ... */` directly above each, stating the tokenization/`--scope` contract already described in the header.

### `extensions/pi-claude-marketplace/edge/args-schema.ts`

- **[WARNING] JSDoc block anchored to the wrong declaration** — lines 35–65.
  The `/** Parse + validate command args ... */` block (lines 35–52) sits directly above `export interface PositionalSpec` (line 53), not above `export function parseCommandArgs` (line 65) that it actually documents. As written, `PositionalSpec` and `ParsedCommandArgs` (lines 53–63) are undocumented, and `parseCommandArgs` itself has no doc comment attached to it. Move the existing block down to sit immediately above `export function parseCommandArgs`, and add a one-line doc comment each for `PositionalSpec` and `ParsedCommandArgs`.
- **[WARNING] Uncommented type assertion** — line 95, `return out as ParsedCommandArgs<Spec>;`.
  The cast has no reason stated. Add a one-line comment explaining that `out` is built key-by-key to match the schema's declared shape and that TypeScript cannot verify a dynamically-keyed `Record` against a mapped conditional type generically.

### `extensions/pi-claude-marketplace/edge/flag-catalog.ts`

- **[WARNING] Inline anonymous return type instead of a named interface** — line 174, `completionFlagEntries(verb: CatalogVerb): { name: string; description?: string }[]`.
  The module already defines `FlagEntry` as a named interface for the closely related shape; the exported function's return type should get the same treatment. Extract a small named interface (e.g. `CompletionFlagEntry { readonly name: string; readonly description: string }`) and use it as the return type.

### Clean files

- `extensions/pi-claude-marketplace/edge/register.ts`
- `extensions/pi-claude-marketplace/edge/router.ts`
- `extensions/pi-claude-marketplace/edge/types.ts`

## Not covered

No `npm test`/`npm run check`/coverage command was run, per the diagnostic-review instructions (tree must stay untouched while other reviewers run concurrently); all findings above are from static reading. `tests/edge/completions/` and `tests/edge/handlers/` were excluded per the assignment and not opened.
