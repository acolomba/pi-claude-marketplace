# Phase 4: Wire Schema and JSON Strategy - Pattern Map

**Mapped:** 2026-10-03
**Files analyzed:** 17 (9 new, 8 modified)
**Analogs found:** 15 / 17

Paths below are relative to the repo root; `E/` = `extensions/pi-claude-marketplace/`.
All analogs are git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/shared/redact-credentials.ts` (NEW) | utility (leaf) | transform | `E/shared/redact-absolute-paths.ts` | exact |
| `E/shared/errors.ts` (MOD, `serializeCauseChain`) | utility | transform | itself, lines 155-165 | n/a |
| `E/shared/notification-resolve.ts` (MOD, `resolveFailure`, `resolveRawSurface`) | service | transform | itself, lines 494-558 | n/a |
| `E/shared/notification-present.ts` (NEW, optional name) | service | transform | `E/shared/notification-dispatch.ts` `emitCascadeWith`/`emitUpdateNoOpCascade`/`dispatchInfoMessage` (the code it extracts) | exact (extraction) |
| `E/shared/notification-dispatch.ts` (MOD) | service | request-response | itself | n/a |
| `E/shared/notification-wire.ts` (NEW) | model (schema) | transform | `E/domain/components/plugin.ts` | role-match |
| `E/shared/notification-json.ts` (NEW) | utility (converter) | transform | `E/shared/notification-resolve.ts` `resolveFailure` (field-by-field literal, conditional spread) | role-match |
| `E/edge/handlers/tools.ts` (MOD) | controller | request-response | itself, lines 74-145, 351-394 | n/a |
| `E/orchestrators/marketplace/list.ts` (MOD, extract block builder) | service | CRUD (read) | itself, lines 49-85 | n/a |
| `scripts/generate-wire-schema.mjs` (NEW) | config/script | file-I/O | `scripts/check-unused-type-members.mjs` (main guard 233-240), `scripts/notify-corpus.mjs` (header/root, 1-40) | role-match |
| `schema/claude-plugin.schema.json` (NEW, generated) | config | — | none | no analog |
| `package.json` (MOD: `files`, `schema:generate` script) | config | — | itself, lines 38-43 | n/a |
| `tests/shared/redact-credentials.test.ts` (NEW) | test | — | `tests/shared/redact-absolute-paths.test.ts` | exact |
| `tests/shared/notification-{present,wire,json}.test.ts` (NEW) | test | — | `tests/shared/redact-absolute-paths.test.ts` (table-driven `describe`) | role-match |
| `tests/architecture/catalog-uat/catalog-wire.test.ts` (NEW) | test (architecture) | batch | `tests/architecture/catalog-uat/catalog-contract.test.ts` | exact |
| `tests/architecture/catalog-uat/fixture-types.ts` + 4 `emit` fixtures (MOD) | test support | — | itself (`emit?` hook, line 14) | n/a |
| `tests/scripts/generate-wire-schema.test.ts` (NEW) | test | file-I/O | `tests/scripts/check-unused-type-members.contracts.test.ts` | role-match |
| `tests/architecture/no-credential-leak.test.ts` (MOD, JSON case) | test (gate) | — | itself, lines 56-87 | n/a |
| `tests/edge/handlers/tools.test.ts` (+ `register.test.ts`, `index.test.ts`) (MOD) | test | — | itself (`ExpectedPluginRow` :128-136, mp details :434-447) | n/a |

## Pattern Assignments

### `E/shared/redact-credentials.ts` (utility leaf, transform)

**Analog:** `E/shared/redact-absolute-paths.ts` lines 3-24. Copy: single exported pure `(text: string): string`, regex declared inside the function, a doc comment explaining *why* the anchors exist (WR-04 style). Unlike the analog, import **nothing** internal (so `errors.ts` can import it without a cycle; `redact-absolute-paths.ts` already imports `errors.ts`).

```ts
export function redactAbsolutePaths(text: string): string {
  const absolutePath = /(?<![\w:/\\])(?:[A-Za-z]:[\\/]|\\\\\?\\|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;
  return text.replace(absolutePath, (match) => { ... });
}
```
Regex set and order: RESEARCH "Credential redaction design" (USERINFO, X_ACCESS, BEARER, GH_TOKEN `{16,}`). Doc comment must say the scp `git@host:o/r` subject is deliberately untouched (cite PMOD-04, D-05, D-06).

### `E/shared/errors.ts` `serializeCauseChain` (MOD)

Current line 164 (doc comment at 153 already reserves the site):
```ts
const links = [...causeChain(err)];
return { causeChain: links.map(linkMessage), truncated: hasOnwardCause(links.at(-1)) };
```
Change to `links.map((link) => redactCredentials(linkMessage(link)))`. Import `./redact-credentials.ts` (sibling, value import group).

### `E/shared/notification-resolve.ts` (MOD)

`resolveFailure` (494-510): `leaks: manualRecoveryLeaks(cause)` -> `.map(redactCredentials)`. Note the house conditional-spread idiom for absent-not-undefined, reused by the converter:
```ts
return {
  ...(chain === undefined ? {} : { cause: chain }),
  leaks: manualRecoveryLeaks(cause),
  rollbackPartial: rollbackPartial.map((entry) => { ... }),
};
```
`resolveRawSurface` (552-558): today returns `surface` unchanged for non-aborted kinds; add per-kind redaction for `reconcile-aborted` `causeMessage`, `plugin-path-skipped` `reason`, `diagnostic` `header`/`lines`. Use a `switch (surface.kind)` with no `default` (switch-exhaustiveness / TS7030). Doc comment at 545-550 already names this as the PMOD-04 site.

### `E/shared/notification-present.ts` (NEW, extraction)

**Analog / source of the extracted code:** `E/shared/notification-dispatch.ts`.
- `emitCascadeWith` (~406-427): `resolveRows(message.marketplaces, run.softDeps, rowPolicies)` + `resolveEnvelope(message)` -> becomes `presentCascade`; the `"(no marketplaces)"` sentinel stays in dispatch (text-only).
- `emitUpdateNoOpCascade` (~440-454): `resolveUpdateNoOpEnvelope(message)` -> `presentUpdateNoOp`.
- `emitReconcileAppliedContextCascade` (~457-464): advisories `undefined`.
- `dispatchInfoMessage` (250-310): the `prune-committed-warning` arm serializes the cause at render time:
```ts
case "prune-committed-warning":
  body = renderPruneCommittedWarning(
    message,
    causeChainTrailer(redactCauseChain(message.cause)),
  );
```
  The present step must produce one `SerializedCauseChain` here for both strategies, and redact `marketplace-info` `source.url`.
- `emitRawSurface` (98-101) -> `presentRawSurface` = `resolveRawSurface`.
Dispatch then formats from the presentation; catalog/corpus bytes unchanged. Import style follows dispatch lines 1-49 (value imports, then `import type` group last).

### `E/shared/notification-wire.ts` (NEW, typebox schema)

**Analog:** `E/domain/components/plugin.ts` lines 1-50.
```ts
import Type from "typebox";
import { Compile } from "typebox/compile";   // do NOT copy into production wire (D-12: tests only)

const PLUGIN_METADATA_FIELDS = {
  description: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
};
```
Copy: default `Type` import, module-private `SCREAMING_SNAKE` sub-schemas, field bags, a top file comment citing IDs. Do NOT copy the line-11 comment ("`Type.Optional` produces `T | undefined`") -- stale for typebox 1.3.34. Use `{ additionalProperties: false }` on every object. Export only the top-level union (e.g. `NOTIFICATION_PAYLOAD_SCHEMA`); its production reader is the type-only import in `notification-json.ts` (RESEARCH Pattern 1). Build literal lists from the closed sets in `E/shared/notification-types.ts:248-325` and `Reason` (:14), not `ContentReason` (RESEARCH Pitfall 2).

### `E/shared/notification-json.ts` (NEW, converter)

**Analog:** the field-by-field + conditional-spread construction in `resolveFailure` (above) and `listMarketplaces` (`E/orchestrators/marketplace/list.ts` ~78-85 `marketplaces.push({ name: record.name, ... })`).
```ts
import type Type from "typebox";
import type { NOTIFICATION_PAYLOAD_SCHEMA } from "./notification-wire.ts";
export type WirePayload = Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>;
```
Rules: no `...row` spreads of model objects, no `JSON.stringify(model)`, no replacer (PITFALLS Pitfall 10); `switch` with no `default`; cascade with absent `kind` emits `"cascade"`; `id: \`${row.name}@${mp.name}\``; `noOp` only when true; never emit `missingPolicy`. All exported param/return types exported too (`private-type-leaks: error`).

### `E/edge/handlers/tools.ts` (MOD, LLMT-01)

Current marketplace tool (74-120) builds `{ name, scope, pluginCount, source }` details and lines `` `[${scope}] ${record.name} -- ${pluginCount} plugin(s) -- ${logical}` ``. Keep `lines` byte-identical; replace `details.marketplaces` items with wire blocks from the extracted builder. Empty case `details: { marketplaces: [] }` keeps shape.
Plugin tool: local `ToolPluginStatus`/`PluginRow` (126-145) and `projectRowStatus` (147) stay for line text only; `details.plugins` comes from `presentCascade(openNotificationRun(pi), {...filtered, label: "Plugin list", cardinality: "plural"}, LIST_CONTEXT.rowPolicies)` -> `toWirePayload` -> flatten. `openNotificationRun(pi)` precedent: `E/edge/register.ts:138`. Edge may import orchestrators and shared (already imports `orchestrators/plugin/list-flow.ts`, line 39).

### `E/orchestrators/marketplace/list.ts` (MOD)

Extract the per-record block construction in the loop at ~62-85 (`autoupdate = merged.marketplaces[record.name]?.entry.autoupdate ?? false; marketplaces.push({ name: record.name, ... })`) into an exported function used by both `listMarketplaces` and the tool (house-machinery reuse). Keep the WR-01 `MarketplaceRows<never>` typing comment.

### `scripts/generate-wire-schema.mjs` (NEW)

**Analogs:** root resolution from `scripts/notify-corpus.mjs:31`:
```js
const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
```
Main guard from `scripts/check-unused-type-members.mjs:233-240`:
```js
const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
```
Export `buildWireSchemaDocument()` as the pure core; format via prettier API before `writeFile` (Pitfall 6). Register `"schema:generate"` in `package.json` scripts; if fallow still flags it, use a reasoned `// fallow-ignore-file ...` header like `notify-corpus.mjs` lines 1-2.

### `package.json` (MOD)

`files` (38-43): add `"schema/claude-plugin.schema.json"` alongside `"extensions/pi-claude-marketplace/**"`.

### `tests/shared/redact-credentials.test.ts` and other owner tests

**Analog:** `tests/shared/redact-absolute-paths.test.ts` lines 1-30:
```ts
import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import { redactAbsolutePaths, redactCauseChain } from "../../extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts";

describe("redactAbsolutePaths", () => {
  for (const { name, input, expected } of [
    { name: "redacts a POSIX absolute path to its basename", input: "...", expected: "..." },
  ]) { test(name, () => { ... }); }
});
```
Table-driven cases; include negative controls (scp subject unchanged, 15-char `ghp_` body unchanged). `notification-json.test.ts` must reach 100% direct coverage alone (Pitfall 8).

### `tests/architecture/catalog-uat/catalog-wire.test.ts` (NEW)

**Analog:** `catalog-contract.test.ts`. Reuse its import block (1-34) and `FIXTURE_MAPS` (43-65), and assert counts against `EXPECTED_STATE_COUNT = 260` / module count 21 rather than hardcoding (Pitfall 1). Per-fixture driving mirrors `renderFailure` (238-254):
```ts
const run = openNotificationRun(fixture.pi);
if (fixture.emit !== undefined) {
  fixture.emit(boundary.ctx, run);
} else {
  const message =
    example.section === "/claude:plugin list" && "marketplaces" in fixture.message
      ? { ...fixture.message, label: "Plugin list", cardinality: "plural" as const }
      : fixture.message;
  notify(boundary.ctx, run, message);
}
```
Inject the converter as a parameter so the `{}`-converter control and planted invalid fixture prove failure (JOUT-02). Validate `JSON.parse(JSON.stringify(dto))` with `Compile(...)` (Pitfall 3); prototype/undefined/null walk (D-10). Consider sharing `FIXTURE_MAPS` via a small exported module rather than duplicating (fallow dupes threshold 3).

### `fixture-types.ts` (MOD)

Current hook (line 14): `readonly emit?: (ctx: MockCtx, run: NotificationRun) => void;`. Add a sibling optional `present?` (or make `emit` return the presentation) for the 2 `plugin-list.ts` + 2 `plugin-update.ts` emit fixtures (Pitfall 4).

### `tests/scripts/generate-wire-schema.test.ts` (NEW)

**Analog:** `tests/scripts/check-unused-type-members.contracts.test.ts` lines 1-29 -- `.mjs` loaded by runtime URL with an explicit test-side interface:
```ts
const analysisModuleUrl = new URL("../../scripts/check-unused-type-members.analysis.mjs", import.meta.url).href;
```
Deep-compare `buildWireSchemaDocument()` against parsed `schema/claude-plugin.schema.json`; assert `package.json` `files` includes the path.

### `tests/architecture/no-credential-leak.test.ts` (MOD)

Registry destructuring of `CREDENTIAL_LEAK_TARGETS` (56-87) with pinned `DECLARED_MODULE_ORDER`. Add behavioural planted-credential cases (imports only); do not add production path literals unless registered in `tests/architecture/gate-targets.ts` (D-07-06).

## Shared Patterns

### Absent-not-undefined construction
**Source:** `E/shared/notification-resolve.ts` `resolveFailure` (494-510), `hintFor` (490-492: `flag === true ? { hint } : {}`).
**Apply to:** converter, present step, tool details.

### Closed-set exhaustive switch
**Source:** `dispatchInfoMessage` (`E/shared/notification-dispatch.ts` 250-310), no `default`.
**Apply to:** `toWirePayload`, `resolveRawSurface` redaction, present functions.

### Import ordering
builtin / external / internal / parent / sibling, blank lines between, `import type` last (`notification-dispatch.ts` 1-49; `tools.ts` 35-44).

### Comments
Cite IDs (PMOD-04, D-05..D-12, WIRE-0x, JOUT-02, LLMT-01, NFR-9); no phase/plan numbers.

### Type-member pins
Edits to dispatch/resolve/types/notify-context move `scripts/check-unused-type-members.contracts.json` line pins: prettier first, then remap LINE only.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `schema/claude-plugin.schema.json` | generated artifact | — | No generated committed artifact exists; follow RESEARCH generator sketch |
| typebox **union keyed by kind** in `notification-wire.ts` | model | — | Existing typebox modules validate input objects, none model a discriminated output union; use RESEARCH "Standard Stack" probe output |

## Metadata

**Analog search scope:** `E/shared`, `E/domain/components`, `E/edge/handlers`, `E/orchestrators/marketplace`, `scripts/`, `tests/shared`, `tests/scripts`, `tests/architecture`
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-03
