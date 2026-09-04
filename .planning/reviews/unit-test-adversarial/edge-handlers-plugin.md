# Edge — plugin handlers

**Scope:** `extensions/pi-claude-marketplace/edge/handlers/plugin/*.ts` (12 modules) and their paired `tests/edge/handlers/plugin/*.test.ts` suites (12 files, ~7230 lines).
**Test files reviewed:** 12
**Production modules reviewed:** 12

## Summary

This is the strongest tier reviewed so far. Every production module is a thin shim with a paired test module (no pairing gap, no BLOCKER), every test file uses `node:test`'s `test()` with per-case `t.mock` (never the process-wide `mock`), every `strong-mock` use carries `exactParams: true` plus a terminal `verify()`, and there is no `It.isAny()`, `anyTimes()`, hand-rolled recorder, `assert.ok`, weak substring error matching, or committed `only`/`skip`/`todo` anywhere in the tier. Hermeticity is uniformly enforced through a shared `createNotificationBoundary()` fixture (itself a well-built `strong-mock` fake of the Pi context/API) plus per-case `mkdtemp` trees, `HOME`/`PI_CODING_AGENT_DIR` save-and-restore, and a fail-fast `https.request` trap. Every documented flag on every one of the twelve handlers (`--scope`, `--map-model`, `--partial`, `--local`/scope-target, the five `list` filters, `--fetch`) is exercised by at least one discriminating case, including flag-position independence and flag-combination matrices — the anticipated "template copied without exercising the per-handler flag surface" failure mode did not materialize.

The one real theme: 9 of the 12 handlers (`list`, `install`, `uninstall`, `update`, `reinstall`, `enable-disable`, `info`, `pending`, `fetch`) call their orchestrator via a direct static import with no injection seam, unlike `bootstrap.ts`/`import.ts`, which accept the workflow as an injected dependency. That is a production testability gap, not a test-writing mistake: it makes the check's requested "orchestrator call as a `strong-mock` mock with `exactParams` and `verify()`" structurally unavailable, and the suite substitutes a well-executed but heavier alternative — running the real orchestrator over a hermetic fixture and diffing the on-disk footprint. A second, smaller theme follows from the same root cause: five of those nine files (`info`, `uninstall`, `pending`, `reinstall`, `fetch`) fall back to asserting the orchestrator's full rendered notification string (glyphs, status labels, success counts, the `/reload` trailer) rather than reducing to the minimal projection the sibling files (`list`, `install`, `update`, `enable-disable`) use, which duplicates assertions the orchestrator's own test module already owns at full coverage.

## Unit test findings

### `tests/edge/handlers/plugin/info.test.ts`

- **[WARNING] Full orchestrator-rendered message duplicated across every case** — `lines 195–213`, `249–256`, `277–283` (and the surrounding `expectedMessage` literals). Every case asserts the complete `getPluginInfo` rendering verbatim — glyphs (`●`/`○`/`◌`), the `<no autoupdate>` trailer, and the `components: not resolved` line — which is exactly the row-grammar contract the file's own header says belongs to `tests/orchestrators/plugin/info.test.ts` "at full direct coverage." Because this is a read-only verb with no on-disk footprint to fall back on, some observable signal is unavoidable, but the assertion could still be reduced to a minimal projection (plugin name, version, scope, status token — the technique `list.test.ts`'s `projectListing()` already uses) so a reformatting of the orchestrator's row grammar does not also break every case here. Not a correctness bug — the comparison is a strict `deepStrictEqual`, so it still discriminates a wrong implementation — but it is duplicated test surface across two owning modules.

### `tests/edge/handlers/plugin/uninstall.test.ts`

- **[WARNING] Full orchestrator-rendered message duplicated alongside the footprint proof** — `lines 92–98` (`PROJECT_UNINSTALLED`/`USER_UNINSTALLED`), used at `lines 247`, `342`, `389`. Each case already proves delegation through `readObservedEffects()` (the on-disk record disappearing from the right scope), which is the file's own stated "minimal effect" contract (header, lines 8–11). The additional `assert.deepStrictEqual(notifications, [PROJECT_UNINSTALLED])` restates the `/reload to pick up changes` trailer and glyph/status grammar that `tests/orchestrators/plugin/uninstall.test.ts` owns. Consider dropping the message literal (or reducing it to a name/scope/status projection) now that the footprint read already carries the discriminating proof.

### `tests/edge/handlers/plugin/pending.test.ts`

- **[WARNING] Full orchestrator-rendered message duplicated across every case** — `lines 228–229` (`PROJECT_BLOCK`/`USER_BLOCK`), used through `lines 238–283`, and the "will install" row literal at `lines 344–346`. Same pattern as `info.test.ts`: every case restates the diff-row grammar (`(will install)`) that `tests/orchestrators/reconcile/pending.test.ts` owns, rather than projecting to the plugin/scope identity the case is actually proving (which scope root a diff came from).

### `tests/edge/handlers/plugin/reinstall.test.ts`

- **[WARNING] Full orchestrator-rendered message duplicated, including success counts and reload hint** — `lines 308–342` (`ALL_PLUGINS_MESSAGE`, `PROJECT_SCOPE_MESSAGE`, `USER_SCOPE_MESSAGE`, `MARKETPLACE_FORM_MESSAGE`, `PLUGIN_FORM_MESSAGE`). This file already computes a footprint (`readFootprint()`, materialised skill directories + config layers) that alone discriminates target-form/scope correctness. Layering the full `"Plugin reinstall: N successes\n\n/reload to pick up changes"` string on top restates `tests/orchestrators/plugin/reinstall.test.ts`'s row-count and trailer grammar — directly at odds with this file's own closing claim (lines 92–93) that it does not re-derive "the reinstall workflow's own row grammar." Reduce to a minimal projection or drop the message assertion in favor of the footprint.

### `tests/edge/handlers/plugin/fetch.test.ts`

- **[WARNING] Full orchestrator-rendered message duplicated, including reason trailers** — `lines 337–356`, `378–393` (`expectedMessage` literals carrying `{up-to-date}` reason trailers and the `Plugin fetch: N successes` summary line). `fetchPlugins` writes nothing observable on disk (a documented "derive-not-persist" verb), so there is no footprint alternative here either, but the assertion still restates the reason-trailer vocabulary and success-count grammar that belongs to the orchestrator's own suite. A minimal per-row projection (marketplace/scope/plugin/status, dropping the reason trailer and success-count line) would keep the same discriminating power with less duplicated surface.

### Clean files

- `tests/edge/handlers/plugin/bootstrap.test.ts` — the one full-message assertion (`FAILED_ROW_MESSAGE`) is genuinely handler-owned (the catch block in `bootstrap.ts` builds that row itself), so it is correctly this file's own contract, not a re-derivation.
- `tests/edge/handlers/plugin/import.test.ts` — the one handler in the tier whose delegate is a first-class injected dependency; every case states it as an exact-argument `strong-mock` mock with `verify()`.
- `tests/edge/handlers/plugin/install.test.ts` — deliberately never asserts the notification body on a delegating case; every claim rides the on-disk footprint instead. The most thorough flag-matrix coverage in the tier.
- `tests/edge/handlers/plugin/list.test.ts` — the `projectListing()` reduction (dropping glyph and reason trailer, keeping row identity) is the model the other five Group-C files should follow.
- `tests/edge/handlers/plugin/enable-disable.test.ts` — footprint-only for the delegating cases; the full-message assertions it does carry (failure conversion) are handler-owned.
- `tests/edge/handlers/plugin/shared.test.ts` — the one owner with a true injected `run` delegate seam (`withParsedArgs`); textbook `strong-mock` usage throughout, including a proper identity-based `assert.rejects` check.
- `tests/edge/handlers/plugin/update.test.ts` — same discipline as `install.test.ts`; the largest flag/target-form cross product in the tier, all footprint-based.

## Production code findings

### `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts`, `install.ts`, `uninstall.ts`, `update.ts`, `reinstall.ts`, `enable-disable.ts`, `info.ts`, `pending.ts`, `fetch.ts`

- **[WARNING] Orchestrator reached by direct import, not by an injected dependency** — e.g. `list.ts:14` (`import { listPlugins } from "../../../orchestrators/plugin/list.ts";`), `install.ts:23`, `uninstall.ts:7`, `update.ts:14`, `reinstall.ts:14`, `enable-disable.ts:16`, `info.ts:10`, `pending.ts:17`, `fetch.ts:18` — each handler factory calls its orchestrator as a hard-coded module-level import rather than accepting it through a `deps` parameter, unlike `bootstrap.ts` (`EdgeDeps["pluginUpdate"]`/`EdgeDeps["gitOps"]`) and `import.ts` (`ImportHandlerDeps["importClaudeSettings"]`), which already establish the pattern. This is a hidden-dependency testability finding: the orchestrator call is public behavior (per the review brief, "the orchestrator call IS the public promise") but cannot be stated as a `strong-mock` interaction because there is no seam to inject it through, and reaching for `t.mock.module()` to fake the import is independently forbidden. The sanctioned fix already has a working precedent in this same directory — inject a narrow, consumer-declared port (an optional `deps.<verb>` member defaulting to the real function, exactly as `import.ts:16` does with `importClaudeSettings?`) — which would let these nine handlers' tests state an exact-argument `strong-mock` proof of delegation instead of a hermetic-fixture footprint diff. This is not urgent — the current tests are not weak, just heavier and, in five cases (see unit test findings above), duplicative of the orchestrator's own suite — but it is the one structural change that would let this tier fully satisfy the review's stated ideal.

### `extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts`, `info.ts`, `install.ts`, `list.ts`, `pending.ts`

- **[WARNING] Factory JSDoc opens with a noun phrase, not a third-person verb phrase** — `fetch.ts:110–114`, `info.ts:24–28`, `install.ts:40–44`, `list.ts:32–37`, `pending.ts:27–30`, each reading `/** Factory: returns the async handler closed over \`pi\` ... */`. The Typescript Google style guide wants method/function descriptions to open with a third-person verb phrase (e.g. "Returns the async handler..."); "Factory:" is a label, not a verb phrase. Mechanical fix: drop the "Factory:" prefix and start the sentence with "Returns...".

### `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts`, `fetch.ts`, `import.ts`

- **[WARNING] Undocumented top-level exported interfaces** — `shared.ts:18` (`PluginMarketplaceRef`), `shared.ts:23` (`ParsedPluginMarketplaceRef`), `shared.ts:90` (`ParsedMapModelArgs`), `fetch.ts:32` (`ParsedFetchTarget`), `import.ts:14` (`ImportHandlerDeps`) — each is an exported interface with no JSDoc above it (only the function that returns/consumes it is documented). Per the style guide, every top-level export needs documentation unless its name and type make its purpose obvious on their own; these shapes are simple enough that a one-line `/** ... */` above each would close the gap without much overhead.

### Clean files

- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts`

No `as`/`!` assertions, no empty or uncommented catch blocks, no non-`Error` throws, no hidden `Date`/`randomUUID`/`process.env` reads, no `export default`, and no dead exports were found in any of the 12 production modules.

## Not covered

- `tests/edge/notification-boundary.ts` and `tests/edge/handlers/marketplace-seed.ts` (the shared fixtures every file in this tier imports) were read for context but are outside this assignment's file list and are not scored here; both looked well-built on inspection (the boundary is itself a correct `strong-mock` fake with exact `times()` counts and centralized `verify()`, deduplicated from four prior copies per its own header).
- Did not run `node --test`, `npm run test:coverage:direct`, or `npm run check` per the diagnostic-review instructions (read-only sweep, tree must stay untouched for concurrent reviewers).
