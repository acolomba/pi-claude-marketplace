# Phase 9: Address tech debt: redact LLM tool error text - Pattern Map

**Mapped:** 2026-10-10
**Files analyzed:** 3
**Analogs found:** 3 / 3

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` (modify) | edge handler (LLM tool) | request-response | itself (TC-9 catch, lines 453-472) + `shared/notification-resolve.ts:597-611` (redaction at serialization) | exact |
| `tests/edge/handlers/tools.test.ts` (modify) | test | request-response | TC-9 test, same file lines 1605-1633 | exact |
| `.planning/phases/04-wire-schema-and-json-strategy/deferred-items.md` (modify) | planning doc | n/a | itself, line 4 `status: open` | exact |

## Pattern Assignments

### `edge/handlers/tools.ts`

**Import to add** (shared/ is in the edge allow-list; keep import-x alphabetic order, slot after `../../shared/notification-types.ts` line 48 -> actually alphabetically `redact-credentials.ts` sorts after `notification-types.ts`):
```ts
import { redactCredentials } from "../../shared/redact-credentials.ts";
```
Analog import: `shared/notification-resolve.ts:10` (`import { redactCredentials } from "./redact-credentials.ts";`).

**Redaction-at-serialization analog** (`shared/notification-resolve.ts:600-611`):
```ts
case "reconcile-aborted":
  return {
    kind: "reconcile-aborted",
    causeMessage: redactCredentials(errorMessage(surface.cause)),
  };
```
Producers keep raw messages; redaction is applied where text is emitted.

**Existing TC-9 error shape to reuse for both tools** (tools.ts lines 456-471):
```ts
} catch (err) {
  return {
    content: [{ type: "text", text: `Failed to load plugin list: ${errorMessage(err)}` }],
    isError: true,
    details: { marketplaces: [] },
  };
}
```

**Return sites that must all route through redaction (D-01):**
- Marketplace tool: line 101 (`No marketplaces configured.`), line 131 (`lines.join("\n")`; the leak via `sourceLogical(source)` at line 110).
- Plugin tool: line 441 (not-found line), line 466 (catch), line 481 (empty), line 500 (`lines.join`).

**Uncaught throw sites (D-03):**
- Marketplace tool: `await loadMarketplaceListEntries({ cwd })` line 97 has no catch; add one yielding `Failed to load marketplace list: <msg>`.
- Plugin tool: `marketplaceExists(...)` lines 433-445 runs before the `try` at line 453; move inside one try covering the whole body.

Recommended shape (RESEARCH primary recommendation): module-private `textContent(text)` helper returning `{ type: "text", text: redactCredentials(text) }` (type `PiTextContentBlock` from `platform/pi-api.ts:79-82`, import type-only), and a module-private `loadFailure(prefix, err)` helper; wrap each execute body as `try { return await body(...) } catch (err) { return loadFailure(...) }`. Keep functions under cognitive complexity 15 (both ESLint and fallow). Comments cite PMOD-04 / D-03 / TC-9, no phase refs. Update the TC-9 comment at lines 457-461 if the catch moves.

---

### `tests/edge/handlers/tools.test.ts`

**Analog:** TC-9 test, lines 1605-1633:
```ts
test("reports a tool error when the recorded state declares an unknown schema", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "unreadable-state");
  await seedScope(scope.cwd, "project", [{ name: "broken-mp", plugins: [] }]);
  const locations = locationsFor("project", scope.cwd);
  await writeFile(locations.stateJsonPath, JSON.stringify({ schemaVersion: 4 }), "utf8");
  const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
    value: scope.cwd,
    reads: 1,
  });
  const expectedResult = {
    content: [{ type: "text", text: `Failed to load plugin list: state.json at ${locations.stateJsonPath} has an unsupported schema version` }],
    isError: true,
    details: { marketplaces: [] },
  };
  // act
  const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);
  // assert
  assert.deepStrictEqual(listed, expectedResult);
  assert.strictEqual(scope.networkCallCount(), 0);
  verifyBoundary();
});
```
Helpers: `createHermeticScope` (line 190), `seedScope` (line 298), `registerToolUnderTest` (line 371). Imports `writeFile` (line 27) and `locationsFor` (line 38) already present.

**Credential fixture (RESEARCH F4, line 214):** overwrite `stateJsonPath` with a `schemaVersion: 3` record whose `source` is `{ kind: "url", raw: "ftp://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git" }`; `state-io.ts:377` throws `state.json marketplace "bad-mp" has an invalid url source: ...`; redacted expected text uses `ftp://***@git.example.com/o/r.git`. For the content-line leak, seed a marketplace with an `https://user:ghp_...@host/o/r.git` url source and assert `https://***@host/...` plus token absent from `JSON.stringify(result)`.
- Marketplace-list failure: register `registerListMarketplacesTool` with the TC-9 `schemaVersion: 4` fixture; expect `Failed to load marketplace list: ...`.
- `marketplaceExists` failure: plugin tool with `{ marketplace: "x" }` param and broken state.
- Use literal expected strings; AAA comments; hermetic home (never real `~/.pi`). Check `reads:` counts for each `registerToolUnderTest` call match the ctx.cwd reads.

---

### `deferred-items.md`
Line 4: `  status: open` -> `  status: resolved` (RESEARCH Pitfall 5: GSD audit treats only `resolved`/`acknowledged` as closed, not `closed`), plus a pointer to phase 9.

## Shared Patterns
- **Redaction:** `redactCredentials` from `shared/redact-credentials.ts:34` only; no path redaction (D-05; TC-9 asserts the path).
- **Error narrowing:** `errorMessage` from `shared/errors.ts` (already imported, line 44).

## No Analog Found
None.

## Metadata
**Search scope:** `edge/handlers/tools.ts`, `shared/notification-resolve.ts`, `tests/edge/handlers/tools.test.ts`, phase 04 deferred-items.
