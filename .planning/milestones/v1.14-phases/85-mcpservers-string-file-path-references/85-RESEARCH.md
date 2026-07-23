# Phase 85: `mcpServers` string file-path references - Research

**Researched:** 2026-07-22
**Domain:** Internal TypeScript refactor — `domain/resolver.ts` MCP resolution seam + closed-set reason catalog wiring
**Confidence:** HIGH (all findings verified by reading the current source in this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Resolve the string reference by reusing the existing `validateComponentPath` pattern — reject absolute paths, then `path.resolve(pluginRoot, str)` + `assertPathInside(pluginRoot, candidate)` (enforces no-`../`-escape AND the D-14 all-symlink refusal). Any relative form is accepted (`./x.mcp.json` and `config/x.mcp.json` alike); a literal `./` prefix is **not** required. Documented divergence from Claude's literal "must start with `./`" wording — we follow *semantic* containment parity, matching the five sibling component-path fields.
- **D-02:** A broken/malformed mcp string reference surfaces a **new failure-class reason token `{malformed mcp}`** — *not* an "unsupported"-family token. One umbrella token covers all four failure modes (missing file / malformed JSON / missing `mcpServers` wrapper / out-of-root escape); the specific cause rides `notes[]` and surfaces via `info`. Inline malformed `mcpServers` stays **as-is** (`{unsupported source}`) — out of scope (deferred REASON-01).
- **D-03:** Add string-reference resolution to **`applyStrictMcp` only** (strict mode). `resolveLoose`/`applyLooseMcp` is exported but has no wired dispatch caller — no speculative work on unreachable code.
- **D-04:** The referenced file MUST be a **wrapped** `.mcp.json` (`{ "mcpServers": {...} }`). A bare server map degrades as malformed → `{malformed mcp}`. This is distinct from the conventional standalone `<pluginRoot>/.mcp.json` read by `readStandaloneMcp`, which keeps its existing unwrapped-superset tolerance **unchanged** (regression guard, success criterion 5).

### Claude's Discretion
- Reader factoring: a separate `readReferencedMcp` vs. a wrapped-only flag on `readStandaloneMcp` — correctness identical; pick the cleaner factoring.
- Exact `notes[]` wording per sub-case (as long as the token is `{malformed mcp}` and the note distinguishes missing / malformed-JSON / unwrapped / escape).
- Which exported group `{malformed mcp}` is filed under, subject to D-02's semantic intent (failure-class, not unsupported).

### Deferred Ideas (OUT OF SCOPE)
- **REASON-01** (BACKLOG.md): unify malformed-input failures under a `{malformed <feature>}` family and reroute existing mislabeled cases (inline malformed `mcpServers`, malformed `hooks.json`). Requires re-auditing `narrowResolverNotes`. Not in v1.14.
- **MCPR-F1** (REQUIREMENTS Future): `plugin.json` `mcpServers` as an **array** of string paths / inline configs. Extends the same seam later.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCPR-01 | A `marketplace.json` plugin entry with a `./`-relative string `mcpServers` resolves + installs the referenced servers at parity with the inline-object form. | Requires (a) schema widening in `PLUGIN_ENTRY_SCHEMA` so the marketplace manifest load does not throw, and (b) the `applyStrictMcp` string branch. See Finding 1 + Pattern 1. |
| MCPR-02 | A `plugin.json` with a `./`-relative string `mcpServers` resolves + installs at the same parity. | Requires (a) schema widening in `PLUGIN_MANIFEST_SCHEMA` so `readManifest` does not reject it as `malformed plugin.json`, and (b) the same `applyStrictMcp` branch. See Finding 1. |
| MCPR-03 | A missing / malformed-JSON / wrapper-less reference resolves the plugin `unavailable` with a note; the marketplace load still succeeds and sibling plugins resolve normally — never a whole-manifest throw, never a silent drop to `undefined`. | The dirty-accumulator route in `applyStrictMcp` (push note + `return true` → `decideResolution` → `unavailable`) is the existing per-plugin structural-defect path. The whole-manifest-throw risk is eliminated by the permissive schema widening (Finding 1). See Pattern 1 + Pattern 3. |
| MCPR-04 | A reference resolving outside the plugin root (`../` traversal or a symlink, D-14) resolves `unavailable` with a note, per-plugin; the resolver never reads outside the plugin root. | `assertPathInside` / `PathContainmentError` reused verbatim (D-01). The escape check runs BEFORE any read, so no out-of-root file is ever opened. See Pattern 2. |
</phase_requirements>

## Summary

This is a small, surgical feature that extends one resolver seam (`applyStrictMcp`) plus one closed-set reason token — but the scouting in CONTEXT.md under-emphasized a **prerequisite that blocks the whole feature**: today both `PLUGIN_ENTRY_SCHEMA.mcpServers` and `PLUGIN_MANIFEST_SCHEMA.mcpServers` are typed **object-only** (`Type.Optional(MCP_SERVERS_SCHEMA)` where `MCP_SERVERS_SCHEMA = Type.Record(Type.String(), Type.Unknown())`). Because `MARKETPLACE_VALIDATOR.Check` validates the entire `plugins: Type.Array(PLUGIN_ENTRY_SCHEMA)` on load, a single marketplace entry with a **string** `mcpServers` fails the whole-marketplace validation → `InvalidMarketplaceManifestError` → the exact whole-manifest throw MCPR-01/MCPR-03 forbid. Likewise a `plugin.json` string `mcpServers` fails `PLUGIN_MANIFEST_VALIDATOR.Check` in `readManifest`, returning a `malformed plugin.json` note (wrong reason, and `applyStrictMcp` never sees the string). **The schema field type must be widened to `string | object` first.** Everything else (the `applyStrictMcp` branch, the reader, the reason token) rides on top of that.

The resolver's own read of the raw entry uses `(entry as Record<string, unknown>).mcpServers` casts, so widening the static `PluginEntry` type to `string | Record<string, unknown> | undefined` breaks nothing downstream: the *resolved* output `partial.mcpServers` is always the unwrapped object map, and `declaresMcp` / staging read that resolved map, never the raw string.

**Primary recommendation:** (1) Widen the `mcpServers` field schema to `Type.Union([Type.String(), MCP_SERVERS_SCHEMA])` in `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` (leave `MCP_SERVERS_SCHEMA`/`MCP_SERVERS_VALIDATOR` — the server-map validator — unchanged). (2) Add a `typeof declaredMcp === "string"` branch at the top of `applyStrictMcp` that validates the path (reject-absolute + `assertPathInside`), reads a **wrapped-only** referenced file via a new `readReferencedMcp`, unwraps it, and feeds the map to the unchanged `applyMcpValue` for inline parity. (3) Wire the failure-class `{malformed mcp}` token through the five closed-set edit sites, using a **collision-proof note prefix** (`malformed mcp reference:`) so it does not accidentally reclassify the existing `malformed mcpServers` inline note.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Accept string `mcpServers` at manifest load (no whole-manifest throw) | Schema (`domain/components/plugin.ts`, `domain/manifest.ts`) | — | Validation is the layer that decides whether a marketplace/plugin manifest is well-formed; a string must be *legal input* here or the load throws before resolution. |
| Resolve string → server map (path validate, read, unwrap) | Domain resolver (`domain/resolver.ts::applyStrictMcp` + a new reader) | Path safety (`shared/path-safety.ts`) | The resolver is the single seam that turns declared config into a `ResolvedPlugin`; containment lives in the shared path-safety helper it already calls. |
| Containment / traversal / symlink refusal | Path safety (`shared/path-safety.ts::assertPathInside`) | — | NFR-10 / D-14 house policy already owns this; reuse verbatim. |
| Per-plugin degrade to `unavailable` with a reason | Domain resolver (dirty accumulator → `decideResolution`) | Reason catalog (`shared/notify.ts` / `shared/notify-reasons.ts`) + narrower (`shared/probe-classifiers.ts`) | The resolver classifies structural defects; the closed-set catalog + `narrowResolverNotes` map the note to a user-facing token. |
| Stage the resolved MCP servers | MCP bridge (`bridges/mcp/*`) | — | Unchanged. The bridge reads `resolved.mcpServers` (always an object map); string-vs-inline sourcing is invisible to it → parity for free. |

## Standard Stack

No external packages. This phase edits existing TypeScript modules only. The relevant in-repo libraries:

| Module | Purpose | Why It's The Tool |
|--------|---------|-------------------|
| `typebox` (`Type`, `Compile`) | Schema union for the widened `mcpServers` field | Already the project's validation contract (NFR; carried from V1). `Type.Union([...])` is the existing idiom — see `DroppedHookSchema`/`ResolvedPluginSchema` in `resolver.ts`. `[VERIFIED: domain/resolver.ts L76, L219 use Type.Union]` |
| `node:path` (`path.isAbsolute`, `path.resolve`, `path.join`) | Path handling for the reference | Built-in; the `validateComponentPath` pattern already uses these. `[VERIFIED: resolver.ts L822–830]` |
| `shared/path-safety.ts::assertPathInside` / `PathContainmentError` | Containment + D-14 symlink refusal | Reused verbatim (D-01, MCPR-04). `[VERIFIED: resolver.ts L833–839]` |
| `domain/components/mcp.ts::MCP_SERVERS_VALIDATOR` | Validate the **unwrapped** server map | The same JIT-compiled validator `applyMcpValue` already runs → inline parity. `[VERIFIED: resolver.ts L1109]` |
| `node:test` + `node:assert/strict` | Test framework | Repo standard; all existing resolver/probe/notify tests use it. `[VERIFIED: tests/*.test.ts]` |

**Installation:** none.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. All work is against modules already in the repository.

## Architecture Patterns

### System Architecture Diagram

```
marketplace.json ──► loadMarketplaceManifest ──► MARKETPLACE_VALIDATOR.Check
 (plugin entry)          (domain/manifest.ts)       │  validates plugins[]
                                                     │  against PLUGIN_ENTRY_SCHEMA
                                                     ▼
                                          [ (1) SCHEMA WIDENING NEEDED HERE ]
                                          mcpServers must allow string|object
                                                     │ (entry survives load)
                                                     ▼
plugin.json ──► readManifest ──► PLUGIN_MANIFEST_VALIDATOR.Check
                (resolver.ts)     [ (1) SAME WIDENING NEEDED HERE ]
                                                     │
                                                     ▼
                        resolveStrict ──► ... ──► applyStrictMcp(entry, manifest, partial, pluginRoot, ctx)
                                                     │
              declaredMcp = entry.mcpServers ?? manifest.mcpServers
                                                     │
                    ┌────────────────────────────────┼───────────────────────────────┐
       typeof === "string"                    object / array                      undefined
                    │                                 │                                │
    [ (2) NEW STRING BRANCH ]              applyMcpValue(map)              readStandaloneMcp (tolerant,
    validateReferencePath (reject          (existing, unchanged)          unwrapped-superset — UNCHANGED,
     abs + assertPathInside)  ──► escape ──┐                              criterion-5 regression guard)
    readReferencedMcp (wrapped-only) ──► fail (missing/JSON/no-wrapper) ──┤
                    │ ok: unwrapped map                                    │
                    ▼                                                      ▼
          applyMcpValue(partial, map)                       push "malformed mcp reference: <cause>"
          (inline parity → partial.mcpServers)              return true (dirty)
                    │                                                      │
                    ▼                                                      ▼
            decideResolution: installable                    decideResolution: unavailable
                                                                           │
                                                     narrowResolverNotes(notes) ──► {malformed mcp}
                                                     [ (3) NEW BRANCH + closed-set token ]
```

### Recommended Project Structure
No new files required. Edits land in existing modules:
```
domain/components/plugin.ts     # (1) widen PLUGIN_ENTRY_SCHEMA + PLUGIN_MANIFEST_SCHEMA mcpServers field
domain/resolver.ts              # (2) applyStrictMcp string branch + new readReferencedMcp + validateReferencePath
shared/notify.ts                # (3a) append "malformed mcp" to REASONS (34 -> 35)
shared/notify-reasons.ts        # (3b) add "malformed mcp" to FAILURE_REASONS
shared/probe-classifiers.ts     # (3c) narrowResolverNotes: new branch before catch-all
docs/output-catalog.md          # (3d) reason-catalog + (unavailable) row update, optional recipe
tests/...                        # see Validation Architecture
```

### Pattern 1: The `applyStrictMcp` string branch (D-03)

Current `applyStrictMcp` `[VERIFIED: resolver.ts L1124–1141]`:

```typescript
async function applyStrictMcp(entry, manifest, partial, pluginRoot, ctx): Promise<boolean> {
  const declaredMcp = (entry as Record<string, unknown>).mcpServers ?? manifest?.mcpServers;
  const mcpResult = declaredMcp === undefined ? await readStandaloneMcp(ctx, pluginRoot) : undefined;
  if (mcpResult?.ok === false) { partial.notes.push(mcpResult.reason); return true; }
  return applyMcpValue(partial, declaredMcp ?? mcpResult?.value);
}
```

Insert the string branch immediately after computing `declaredMcp`, BEFORE the `readStandaloneMcp` fallback and the object `applyMcpValue`:

```typescript
const declaredMcp = (entry as Record<string, unknown>).mcpServers ?? manifest?.mcpServers;

// MCPR-01/02/04: a string mcpServers is a ./-relative reference to a wrapped .mcp.json.
if (typeof declaredMcp === "string") {
  const ref = await readReferencedMcp(ctx, pluginRoot, declaredMcp);
  if (!ref.ok) { partial.notes.push(ref.reason); return true; }   // D-02 -> {malformed mcp}
  return applyMcpValue(partial, ref.value);                        // inline parity for free
}
// ... existing undefined/object path unchanged
```

**Why `applyMcpValue` unchanged:** it runs `MCP_SERVERS_VALIDATOR.Check(mcp)` and assigns `partial.mcpServers` — identical to the inline path, so the staged output is byte-identical to declaring the same servers inline (criterion 1/2 parity). `[VERIFIED: resolver.ts L1104–1122]`

### Pattern 2: Reference path validation (D-01, MCPR-04) — reuse the pattern, not the function

`validateComponentPath(kind: SupportedPathKind, raw, pluginRoot)` returns `{ ok, relative }` and is tied to `SupportedPathKind` (skills/commands/agents/hooks/lspServers) and to appending into `componentPaths[kind]`. `[VERIFIED: resolver.ts L799–843]` The reference needs the **absolute** resolved path (to read the file), not the relative string, and has no `SupportedPathKind`. **Recommendation:** a small parallel local helper that reuses the identical three checks but returns the absolute path:

```typescript
async function validateReferencePath(raw: string, pluginRoot: string):
  Promise<{ ok: true; absPath: string } | { ok: false; reason: string }> {
  if (path.isAbsolute(raw)) {
    return { ok: false, reason: `malformed mcp reference: must be relative (got absolute "${raw}")` };
  }
  const candidate = path.resolve(pluginRoot, raw);
  try {
    await assertPathInside(pluginRoot, candidate, `mcpServers reference`);
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return { ok: false, reason: `malformed mcp reference: escapes plugin root: "${raw}"` };
    }
    throw err;   // re-throw non-containment I/O errors (matches validateComponentPath)
  }
  return { ok: true, absPath: candidate };
}
```

This keeps `validateComponentPath` untouched (it's regression-critical for the five sibling fields) rather than generalizing its `kind` parameter to `string`. `assertPathInside` runs BEFORE any read, so MCPR-04's "never reads outside the plugin root" holds by construction — the symlink refusal (D-14) is inside `assertPathInside`.

### Pattern 3: The wrapped-only reader (D-04) — separate function, do NOT touch `readStandaloneMcp`

`readStandaloneMcp` is deliberately *tolerant* — `"mcpServers" in parsed ? parsed.mcpServers : parsed` accepts an unwrapped superset. `[VERIFIED: resolver.ts L905–924]` Criterion 5 is a regression guard that this stays unchanged. Add a distinct wrapped-only reader:

```typescript
async function readReferencedMcp(ctx: ResolveContext, pluginRoot: string, raw: string):
  Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  const v = await validateReferencePath(raw, pluginRoot);
  if (!v.ok) return v;                                    // escape / absolute sub-case
  if ((await statKindOf(ctx)(v.absPath)) !== "file") {    // missing / directory sub-case
    return { ok: false, reason: `malformed mcp reference: file not found: "${raw}"` };
  }
  try {
    const parsed = JSON.parse(await readFileTextOf(ctx)(v.absPath)) as Record<string, unknown>;
    if (!("mcpServers" in parsed)) {                       // wrapper-less sub-case (D-04)
      return { ok: false, reason: `malformed mcp reference: missing top-level "mcpServers": "${raw}"` };
    }
    return { ok: true, value: parsed.mcpServers };         // WRAPPED-ONLY: unwrap exactly once
  } catch (err) {                                          // malformed-JSON sub-case
    return { ok: false, reason: `malformed mcp reference: invalid JSON in "${raw}": ${err instanceof Error ? err.message : String(err)}` };
  }
}
```

Uses the injected `statKindOf(ctx)` / `readFileTextOf(ctx)` readers (same testability seam as `readStandaloneMcp`). `[VERIFIED: resolver.ts L305–310]`

### Pattern 4: Closed-set `{malformed mcp}` token wiring (D-02) — the five edit sites

The reason catalog is a closed set with a compile-time completeness proof plus a length tripwire. Enumerated edit sites:

1. **`shared/notify.ts::REASONS`** — append `"malformed mcp"` to the tuple (order does not matter for the union type, but the length test tracks membership). Place it near the failure-class members (`"invalid manifest"`, `"unparseable"`) with a `// MCPR-03 / D-02:` comment. `ContentReason = Exclude<Reason, "not added">` picks it up automatically (it is NOT `"not added"`). `[VERIFIED: notify.ts L89–157]`
2. **`shared/notify-reasons.ts::FAILURE_REASONS`** — add `"malformed mcp"` to this `as const` tuple (D-02 files it failure-class, not unsupported). The `_ReasonsCoverageProof` at the bottom then stays total by construction — no other edit needed there. `[VERIFIED: notify-reasons.ts L99–164]`
3. **`shared/probe-classifiers.ts::narrowResolverNotes`** — add a branch that matches the reference note prefix and emits `"malformed mcp"`, BEFORE the catch-all `unsupported source` arm. Widen this function's local return type (currently `UnsupportedReason = "unsupported hooks" | "lsp" | "unsupported source"`) to a distinct alias, e.g. `type ResolverNoteReason = UnsupportedReason | "malformed mcp"`, so `narrowUnsupportedKinds`/`kindToReason` keep their narrow `UnsupportedReason` type. `[VERIFIED: probe-classifiers.ts L74, L95–129]` **Critical ordering/collision hazard — see Pitfall 1.**
4. **`tests/architecture/notify-closed-set-locks.test.ts`** — bump `assert.equal(REASONS.length, 34)` to `35` with a `// MCPR-03 / D-02: +1 for the malformed mcp failure-class member (34 -> 35).` comment. This tripwire is intentional; it is the prompt to also add the catalog doc row. `[VERIFIED: tests/architecture/notify-closed-set-locks.test.ts L29–33]`
5. **`docs/output-catalog.md`** — add `{malformed mcp}` to the reason vocabulary and update the `(unavailable)` row description (L140) to mention a malformed mcp reference; optionally add a recipe block. `[VERIFIED: docs/output-catalog.md L60–62, L140, L1489]`

**No change needed** to `list.ts::ListReason` (L280) — that local union types only the `narrowProbeError` wrapper return; the `unavailable` arm assigns `sharedNarrowResolverNotes(...)` into a `reasons: readonly ContentReason[]` field, which accepts `"malformed mcp"` once it is in `REASONS`. `[VERIFIED: list.ts L648–657]` `fetch.ts` (L512) similarly assigns into a `ContentReason[]` field. Confirm the build with `npm run check` after the token lands.

### Anti-Patterns to Avoid
- **Editing `MCP_SERVERS_SCHEMA` / `MCP_SERVERS_VALIDATOR`** to accept strings. That validator checks the *unwrapped server map* in `applyMcpValue`; a string there would let a raw string masquerade as a valid server map. Widen the **field type in the entry/manifest schemas** only.
- **Reusing `readStandaloneMcp` with a flag** if it makes the tolerant `"mcpServers" in parsed ? ... : parsed` branch conditional. Correctness is identical either way (Claude's Discretion), but a shared function risks a future edit regressing criterion 5. A separate `readReferencedMcp` is the lower-risk factoring.
- **Note prefix `malformed mcp:` or bare `malformed mcp`** for the reference note. It collides with the existing inline `malformed mcpServers` note under a naive `startsWith("malformed mcp")` match. Use an unambiguous prefix (`malformed mcp reference:`) — see Pitfall 1.
- **Enforcing a `.mcp.json` filename** on the reference. D-01 accepts any relative path; the wrapper check (`"mcpServers" in parsed`) is the shape gate, not the filename.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path containment / traversal / symlink refusal | A custom `..`/prefix check | `assertPathInside` + `PathContainmentError` | Already implements NFR-10 containment AND the stricter D-14 all-symlink refusal; hand-rolling would diverge from the five sibling fields. `[VERIFIED: resolver.ts L833]` |
| Validating the unwrapped server map | A bespoke shape check | `applyMcpValue` (which runs `MCP_SERVERS_VALIDATOR`) | Guarantees inline parity — the string path and the object path validate identically. `[VERIFIED: resolver.ts L1104]` |
| Mapping a resolver note to a user reason | A new orchestrator-layer classifier | `narrowResolverNotes` (widen it) | The `unavailable` arm on both `list` and `fetch` already routes `resolved.notes` through this single shared narrower — adding a branch keeps cross-surface parity. `[VERIFIED: list.ts L654, fetch.ts L512]` |
| Test disk I/O | Real filesystem fixtures | The in-memory `mockCtx(files)` injecting `statKind`/`readFileText` | Existing resolver-strict harness; maps absolute path → `"file"|"dir"|null` and stubs file contents. `[VERIFIED: tests/domain/resolver-strict.test.ts L25–50]` |

**Key insight:** the resolver already has every primitive this feature needs (containment, map validation, note→reason narrowing, injected readers). The work is *wiring*, plus the one prerequisite schema widening the scouting missed.

## Runtime State Inventory

Not applicable — this is a greenfield feature addition to the resolver, not a rename/refactor/migration. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry a string that changes. The only cross-module coupling is the closed-set reason catalog (handled by the compile-time proof + the length tripwire in Pattern 4). Verified by reading the four consumer sites (`notify.ts`, `notify-reasons.ts`, `probe-classifiers.ts`, `list.ts`/`fetch.ts`).

## Common Pitfalls

### Pitfall 1: Note-prefix collision reclassifies the existing inline `malformed mcpServers` note
**What goes wrong:** The inline object path already pushes notes `malformed mcpServers: <detail>` and `malformed mcpServers` (from `applyMcpValue`) and `malformed mcpServers (.mcp.json): <detail>` (from `readStandaloneMcp`). `[VERIFIED: resolver.ts L1116–1118, L921]` D-02 requires those to STAY `{unsupported source}`. If `narrowResolverNotes` adds a branch `note.startsWith("malformed mcp")`, it matches `"malformed mcpServers…"` too and silently reroutes the inline case to `{malformed mcp}` — a scope violation and a cross-surface parity regression.
**Why it happens:** `"malformed mcpServers".startsWith("malformed mcp")` is `true` (shared 13-char prefix).
**How to avoid:** Give the *reference* note a distinct prefix — `malformed mcp reference:` — and match `note.startsWith("malformed mcp reference")`. `"malformed mcpServers…".startsWith("malformed mcp reference")` is `false`, so inline notes fall through to the catch-all `unsupported source` unchanged. The rendered *token* is still `{malformed mcp}` (independent of the note text, which is Claude's Discretion).
**Warning signs:** An existing `resolver-strict` or `cross-surface-reason-parity` test that asserts `{unsupported source}` for an inline malformed `mcpServers` starts failing.

### Pitfall 2: Forgetting the schema widening → whole-marketplace throw (MCPR-03 violation)
**What goes wrong:** You implement only the `applyStrictMcp` branch. A marketplace.json entry with a string `mcpServers` never reaches the resolver — `MARKETPLACE_VALIDATOR.Check` rejects the whole `plugins[]` array → `InvalidMarketplaceManifestError` → every plugin in that marketplace becomes unreadable. That is precisely PR #99's whole-manifest failure the requirements forbid.
**Why it happens:** `domain/manifest.ts::MARKETPLACE_SCHEMA.plugins = Type.Array(PLUGIN_ENTRY_SCHEMA)` and `PLUGIN_ENTRY_SCHEMA.mcpServers = Type.Optional(MCP_SERVERS_SCHEMA)` (object-only). `[VERIFIED: manifest.ts L28, L70; plugin.ts L65]`
**How to avoid:** Widen the field to `Type.Union([Type.String(), MCP_SERVERS_SCHEMA])` in BOTH `PLUGIN_ENTRY_SCHEMA` (marketplace entries, MCPR-01) and `PLUGIN_MANIFEST_SCHEMA` (plugin.json, MCPR-02). The `plugin.json` case fails the same way via `readManifest` → `PLUGIN_MANIFEST_VALIDATOR.Check` → `malformed plugin.json` note. `[VERIFIED: resolver.ts L583–588]`
**Warning signs:** A test loading a real marketplace.json (through `loadMarketplaceManifest` / `MARKETPLACE_VALIDATOR`) with a string entry throws instead of resolving one plugin `unavailable`.

### Pitfall 3: Empty-string / directory / conventional-`.mcp.json` edge cases
**What goes wrong:** Ambiguous inputs resolve inconsistently.
**How to avoid — verified behavior of the recommended code:**
- **Empty string `""`:** `path.resolve(pluginRoot, "")` === `pluginRoot`; `assertPathInside(pluginRoot, pluginRoot)` passes (equal path is inside); then `statKind(pluginRoot) === "dir"` (not `"file"`) → `malformed mcp reference: file not found`. Degrades cleanly. Confirm `assertPathInside` treats an equal path as inside; if it refuses, the empty string still degrades (just via the escape sub-case). Verify against `path-safety.ts`.
- **Directory reference:** `statKind === "dir"` → not `"file"` → file-not-found sub-case. Clean.
- **String pointing at the conventional `./.mcp.json`:** read as **wrapped-only**. If that conventional file is unwrapped (bare map), the string reference degrades `{malformed mcp}` — correct and consistent with D-04 (the string always means wrapped; only the *undeclared* conventional read stays tolerant). Not a bug.
- **Non-`.mcp.json` filename (`config/servers.json`):** accepted (D-01, any relative path) as long as it is a wrapped file.

### Pitfall 4: `PluginEntry` static-type widening ripples
**What goes wrong:** Widening `mcpServers` to `string | Record<...>` changes the `PluginEntry` / `PluginManifest` static types; a consumer that assumed `object` could fail to compile or misbehave.
**Why it (mostly) doesn't happen:** Every read of the raw entry's `mcpServers` in `resolver.ts` goes through `(entry as Record<string, unknown>).mcpServers`. `[VERIFIED: resolver.ts L1131, L1184]` `declaresMcp` and staging read the *resolved* `mcpServers` (always the unwrapped object) or `resources.mcpServers` (always `string[]`), never the raw string. `[VERIFIED: grep of orchestrators/bridges — all typed reads are on resolved output]`
**How to avoid:** After widening, run `npm run check` (typecheck is the gate). Expect zero downstream type errors; if any appear, they are legitimate spots that assumed object-only and should narrow explicitly.

## Code Examples

### Widening the field schema (`domain/components/plugin.ts`)
```typescript
// Source: current object-only form at plugin.ts L65 / L88 (VERIFIED this session)
// MCPR-01/02: mcpServers may be a ./-relative string reference OR an inline server map.
// The server-map VALIDATOR (MCP_SERVERS_SCHEMA / MCP_SERVERS_VALIDATOR) is unchanged;
// only the FIELD type in the entry/manifest schemas widens.
const McpServersField = Type.Union([Type.String(), MCP_SERVERS_SCHEMA]);
// ...
mcpServers: Type.Optional(McpServersField),   // in PLUGIN_ENTRY_SCHEMA and PLUGIN_MANIFEST_SCHEMA
```
`Type.Union([...])` is the established idiom (no discriminator in TypeBox 1.x). `[VERIFIED: resolver.ts L11 comment, L76, L219]`

### `narrowResolverNotes` new branch (`shared/probe-classifiers.ts`)
```typescript
// Source: current narrowResolverNotes at probe-classifiers.ts L95–129 (VERIFIED)
// Inserted BEFORE the catch-all `unsupported source` arm, AFTER the hooks + lsp arms.
// The prefix is collision-proof vs the inline `malformed mcpServers` note (Pitfall 1).
if (note.startsWith("malformed mcp reference")) {
  if (!seen.has("malformed mcp")) { out.push("malformed mcp"); seen.add("malformed mcp"); }
  continue;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PR #99 (@lucatume): inline the referenced file at the manifest-loader layer | Resolve at the resolver layer (`applyStrictMcp`) | This phase | Per-plugin isolation instead of whole-manifest throw; preserves manifest-cache `(mtimeMs, size)` coherence and the WR-01 change-detection key. `[CITED: REQUIREMENTS.md Out of Scope table]` |
| `mcpServers` object-only in schema | `string \| object` union | This phase | Unblocks the feature; prevents the whole-marketplace validation throw. |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `assertPathInside(pluginRoot, pluginRoot)` treats an equal path as *inside* (so empty-string references degrade via file-not-found rather than escape). | Pitfall 3 | Low — either way the plugin degrades `{malformed mcp}`; only the note sub-cause differs. The planner should have the executor read `shared/path-safety.ts` to confirm which sub-case fires and assert the actual one in tests. |
| A2 | No downstream module reads the raw `entry.mcpServers` / `manifest.mcpServers` as a typed object (all resolver reads cast to `Record<string, unknown>`; downstream reads the resolved object map). | Pitfall 4 | Low — verified by grep this session; `npm run check` is the backstop. If a hidden typed read exists, typecheck fails loudly (not silently). |

## Open Questions

1. **Does `assertPathInside` accept an equal path (pluginRoot === candidate)?**
   - What we know: it is the containment + D-14 symlink-refusal helper reused by `validateComponentPath`.
   - What's unclear: exact equal-path behavior for the empty-string edge case.
   - Recommendation: executor reads `shared/path-safety.ts` before writing the empty-string test and asserts the actual sub-cause. Non-blocking (both outcomes degrade cleanly).

2. **Should `docs/output-catalog.md` gain a full recipe block for the malformed-mcp-reference case, or only a reason-vocabulary + `(unavailable)`-row mention?**
   - Recommendation: minimum viable — add `{malformed mcp}` to the reason list and extend the `(unavailable)` row (L140). A dedicated recipe is optional polish; match the granularity of the sibling `{invalid manifest}` treatment.

## Environment Availability

Skipped — no external tools, services, runtimes, or CLIs beyond the repo's own Node/TypeScript toolchain (already required for every phase). This is a code-only change.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (built-in) |
| Config file | none — test scripts in `package.json` |
| Quick run command | `node --test tests/domain/resolver-strict.test.ts` (single file) |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + full `node --test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCPR-01 | marketplace-entry string ref installs at inline parity | unit (resolver) + schema | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| MCPR-01 | marketplace.json with a string entry LOADS (no whole-manifest throw) | unit (manifest/validator) | `node --test tests/domain/*manifest*.test.ts` | ❌ Wave 0 — add a manifest-validator acceptance test (verify `MARKETPLACE_VALIDATOR.Check` passes with a string `mcpServers` entry) |
| MCPR-02 | plugin.json string ref installs at parity; `readManifest` accepts it | unit (resolver) | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| MCPR-03 | missing / malformed-JSON / wrapper-less ref → `unavailable` + note; sibling plugins resolve; no throw | unit (resolver) | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| MCPR-03 | `{malformed mcp}` token surfaces; inline `malformed mcpServers` still `{unsupported source}` | unit (narrower) | `node --test tests/shared/probe-classifiers.test.ts` | ✅ extend |
| MCPR-04 | `../` traversal AND symlink ref → `unavailable` + note; no out-of-root read | unit (resolver) | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| Criterion 5 | conventional standalone `.mcp.json` unwrapped tolerance UNCHANGED | unit (resolver, regression) | `node --test tests/domain/resolver-strict.test.ts` | ❌ Wave 0 — add an explicit regression test asserting an undeclared unwrapped `.mcp.json` still resolves installable |
| Closed set | `REASONS.length === 35` | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ bump |

**Fixture pattern (from `resolver-strict.test.ts`):** `mockCtx(marketplaceRoot, files)` maps absolute paths → `"file" | "dir" | null` for `statKind`, and stubs `readFileText`. For a wrapped reference: register `<pluginRoot>/x.mcp.json` → `"file"` and `readFileText` returning `JSON.stringify({ mcpServers: { srv: {...} } })`; build the entry via `basicEntry({ source: "./local", mcpServers: "x.mcp.json" })`. `basicEntry` casts an in-memory object to `PluginEntry`, BYPASSING the schema validators — so resolver-strict tests exercise `applyStrictMcp` directly; the schema-acceptance tests (MCPR-01 load / MCPR-02 readManifest) must go through `MARKETPLACE_VALIDATOR` / `PLUGIN_MANIFEST_VALIDATOR` explicitly. `[VERIFIED: tests/domain/resolver-strict.test.ts L25–50, L80–82]`

### Sampling Rate
- **Per task commit:** `node --test <the one file the task touches>`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/domain/resolver-strict.test.ts` — add string-ref cases (parity, missing, malformed-JSON, wrapper-less, `../` escape, symlink escape) covering MCPR-01/02/03/04.
- [ ] Schema-acceptance test — a marketplace.json with a string `mcpServers` entry passes `MARKETPLACE_VALIDATOR.Check` (MCPR-01 no-throw) and a plugin.json string passes `PLUGIN_MANIFEST_VALIDATOR.Check` (MCPR-02). Likely `tests/domain/` near existing manifest tests.
- [ ] Criterion-5 regression test — undeclared unwrapped conventional `.mcp.json` still resolves installable.
- [ ] `tests/shared/probe-classifiers.test.ts` — `narrowResolverNotes(["malformed mcp reference: …"])` → `["malformed mcp"]`, AND `narrowResolverNotes(["malformed mcpServers: …"])` still → `["unsupported source"]` (Pitfall 1 guard).
- [ ] `tests/architecture/notify-closed-set-locks.test.ts` — bump length 34 → 35.

## Security Domain

`security_enforcement` is not disabled in config → enabled. This phase reads an **untrusted file path** sourced from a third-party `marketplace.json` / `plugin.json`, so input validation and path containment are directly in scope (they ARE MCPR-04).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | TypeBox schema (`string \| object` union) + resolver-side `validateReferencePath` (reject absolute, resolve, contain). |
| V12 File / Path (traversal) | yes | `assertPathInside` + `PathContainmentError` — refuse `../` escape AND symlinks (D-14), before any file read. |
| V6 Cryptography | no | — |
| V2/V3/V4 Auth/Session/Access | no | — |

### Known Threat Patterns for this change
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `../` in the reference | Tampering / Information Disclosure | `assertPathInside` rejects → `{malformed mcp}`; no read occurs. `[VERIFIED: reuse of resolver.ts L833 pattern]` |
| Symlink escape (ref points at an in-root symlink to outside) | Information Disclosure | D-14 all-symlink refusal inside `assertPathInside`; stricter than Claude's model (documented divergence). |
| Absolute-path reference (`/etc/...`) | Information Disclosure | `path.isAbsolute` rejected before resolve. |
| Malicious/huge JSON at the referenced path | DoS | Out of scope — same exposure as the existing `readStandaloneMcp` / `readManifest` reads; no new attack surface (the read is inside the plugin's own materialized root). |
| Absolute path leaked in a note/reason | Information Disclosure | Reason notes render through `redactAbsolutePaths` at the notify boundary; keep note text to the relative `raw` string where possible. `[VERIFIED: notify.ts L180]` |

## Sources

### Primary (HIGH confidence — read this session)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `applyStrictMcp` (L1124), `applyMcpValue` (L1104), `readStandaloneMcp` (L905), `validateComponentPath` (L799), `readManifest` (L570), injected readers (L305), resolved-schema `MATERIALIZABLE_FIELDS.mcpServers` (L170), `Type.Union` precedent (L76/L219).
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` — `PLUGIN_ENTRY_SCHEMA` (L49/L65) + `PLUGIN_MANIFEST_SCHEMA` (L81/L88), both object-only mcpServers.
- `extensions/pi-claude-marketplace/domain/components/mcp.ts` — `MCP_SERVERS_SCHEMA` / `MCP_SERVERS_VALIDATOR` (L13–18).
- `extensions/pi-claude-marketplace/domain/manifest.ts` — `MARKETPLACE_SCHEMA.plugins = Type.Array(PLUGIN_ENTRY_SCHEMA)` (L28) + whole-manifest `MARKETPLACE_VALIDATOR.Check` throw (L70–76).
- `extensions/pi-claude-marketplace/shared/notify.ts` — `REASONS` tuple (L89–143), `Reason`/`ContentReason` (L145/L157), `redactAbsolutePaths` (L180).
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — `FAILURE_REASONS` (L99) + `_ReasonsCoverageProof` (L161–164).
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` — `narrowResolverNotes` (L95–129), local `UnsupportedReason` (L74).
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (L280 `ListReason`, L648–657 unavailable arm) + `fetch.ts` (L505–526 `reasonedRow`).
- `tests/architecture/notify-closed-set-locks.test.ts` (L29–33), `tests/shared/probe-classifiers.test.ts`, `tests/domain/resolver-strict.test.ts` (L25–82).
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 85 (five success criteria), `85-CONTEXT.md`.

### Secondary (MEDIUM confidence)
- `docs/output-catalog.md` (reason vocabulary L60–62, `(unavailable)` row L140, info-surface recipe L1489) — the doc rows to update.
- `code.claude.com/docs/en/plugins-reference` — `mcpServers` is `string|object` (marketplace entry) / `string|array|object` (plugin.json); "paths must be relative to the plugin root"; "cannot reference files outside their directory". `[CITED via CONTEXT.md, verified 2026-07-22 by the discuss-phase]`

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external deps; all in-repo modules read directly.
- Architecture / edit sites: HIGH — every seam (schema, resolver branch, reader, token wiring) traced to specific verified line numbers.
- Pitfalls: HIGH — the note-prefix collision and the schema-widening prerequisite are both confirmed against source, not inferred.
- Edge-case sub-causes (empty string): MEDIUM — one open question on `assertPathInside` equal-path behavior (A1), non-blocking.

**Research date:** 2026-07-22
**Valid until:** 2026-08-21 (stable internal codebase; re-verify line numbers if the resolver is refactored before planning).
