# Phase 85: `mcpServers` string file-path references - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 7 modified (0 net-new); analogs are sibling patterns in the same files
**Analogs found:** 7 / 7

This phase is edit-heavy. No net-new source files. For each modified site the
"analog" is the sibling pattern already present in that file. Every excerpt
below is anchored to a `file:line` verified this session.

## File Classification

| Modified File | Role | Data Flow | Closest Analog (in-file) | Match Quality |
|---------------|------|-----------|--------------------------|---------------|
| `extensions/pi-claude-marketplace/domain/components/plugin.ts` | model / schema | transform (validate) | `mcpServers: Type.Optional(MCP_SERVERS_SCHEMA)` (L65, L88) — widen to a `Type.Union` | exact |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | service (resolver) | file-I/O + transform | `validateComponentPath` (L799), `readStandaloneMcp` (L905), `applyStrictMcp` (L1124), `applyMcpValue` (L1104) | exact |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | config (closed catalog) | transform | `FAILURE_REASONS` tuple member `"invalid manifest"` (L110) | exact |
| `extensions/pi-claude-marketplace/shared/notify.ts` | config (closed catalog) | transform | `REASONS` tuple failure-class members (L95–L108) | exact |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | utility (note→reason narrower) | transform | `narrowResolverNotes` hooks / lsp branches (L99–L120) | exact |
| `tests/domain/resolver-strict.test.ts` | test | file-I/O (mocked) | `mockCtx` + `basicEntry` fixtures (L31–L82) | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` | test | transform | `REASONS.length` length tripwire (L29–L33) | exact |
| `docs/output-catalog.md` | docs | — | sibling `{invalid manifest}` reason row | role-match |

## Pattern Assignments

### `domain/components/plugin.ts` (schema widening — MCPR-01 / MCPR-02)

**Analog:** the object-only `mcpServers` field in both entry and manifest schemas.

**Current object-only form** (L64–65, identical at L88):
```typescript
  // optional mcpServers map (MM-2 / MC-1)
  mcpServers: Type.Optional(MCP_SERVERS_SCHEMA),
```

**Pattern to copy:** widen the FIELD to a union `Type.Union([Type.String(), MCP_SERVERS_SCHEMA])` in BOTH `PLUGIN_ENTRY_SCHEMA` (L65) and `PLUGIN_MANIFEST_SCHEMA` (L88). Leave `MCP_SERVERS_SCHEMA` / `MCP_SERVERS_VALIDATOR` (the unwrapped-server-map validator) UNCHANGED — see Anti-Patterns. `Type.Union([...])` is the established idiom (no discriminator in TypeBox 1.x). This is the prerequisite Pitfall 2 flags: without it `MARKETPLACE_VALIDATOR.Check` / `PLUGIN_MANIFEST_VALIDATOR.Check` throw the whole-manifest error MCPR-03 forbids.

---

### `domain/resolver.ts` — three additions inside one seam

#### (a) `validateReferencePath` — new local helper (D-01, MCPR-04)

**Analog:** `validateComponentPath` (L799–843).

**Pattern to copy — reject-absolute + resolve + `assertPathInside`** (L822–840):
```typescript
  // PS-3: must be relative.
  if (path.isAbsolute(raw)) {
    return {
      ok: false,
      reason: `component path for "${kind}" must be relative (got absolute "${raw}")`,
    };
  }

  // PR-2 case 8: must not escape pluginRoot.
  const candidate = path.resolve(pluginRoot, raw);

  try {
    await assertPathInside(pluginRoot, candidate, `component path "${kind}"`);
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return { ok: false, reason: `component path for "${kind}" escapes plugin root: "${raw}"` };
    }

    throw err;
  }
```

**Delta from analog:** the new helper returns the ABSOLUTE `candidate` (needed to read the file), not the relative string, and has no `SupportedPathKind`. Do NOT generalize `validateComponentPath`'s `kind` param — it is regression-critical for the five sibling fields. Reason strings use the collision-proof prefix `malformed mcp reference:` (see Pitfall 1). Re-throw non-`PathContainmentError` errors exactly as the analog does (L839).

#### (b) `readReferencedMcp` — new wrapped-only reader (D-04)

**Analog:** `readStandaloneMcp` (L905–924).

**Pattern to copy — injected-reader JSON read shape** (L910–923):
```typescript
  const mcpPath = path.join(pluginRoot, ".mcp.json");
  if ((await statKindOf(ctx)(mcpPath)) !== "file") {
    return { ok: true, value: undefined };
  }

  try {
    const raw = await readFileTextOf(ctx)(mcpPath);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { ok: true, value: "mcpServers" in parsed ? parsed.mcpServers : parsed };
  } catch (err) {
    return {
      ok: false,
      reason: `malformed mcpServers (.mcp.json): ${err instanceof Error ? err.message : String(err)}`,
    };
  }
```

**Delta from analog — CRITICAL (D-04 / criterion 5):** the new reader must be WRAPPED-ONLY. Where `readStandaloneMcp` is tolerant — `"mcpServers" in parsed ? parsed.mcpServers : parsed` — the reference reader must instead REQUIRE the wrapper: a missing top-level `mcpServers` key degrades as `{malformed mcp}`. Do NOT touch `readStandaloneMcp`; add a distinct function so a future edit cannot regress the standalone unwrapped-tolerance guard (criterion 5). Reuse the same `statKindOf(ctx)` / `readFileTextOf(ctx)` injected readers (the testability seam). Emit `malformed mcp reference:`-prefixed reason strings distinguishing the four sub-cases (absolute/escape via the path helper; file-not-found; missing-wrapper; invalid-JSON).

#### (c) `applyStrictMcp` string branch (D-03)

**Analog:** the current dirty-accumulator body of `applyStrictMcp` (L1124–1141).

**Current body** (L1131–1140):
```typescript
  const declaredMcp = (entry as Record<string, unknown>).mcpServers ?? manifest?.mcpServers;
  const mcpResult =
    declaredMcp === undefined ? await readStandaloneMcp(ctx, pluginRoot) : undefined;

  if (mcpResult?.ok === false) {
    partial.notes.push(mcpResult.reason);
    return true;
  }

  return applyMcpValue(partial, declaredMcp ?? mcpResult?.value);
```

**Pattern to copy — push-note + `return true` dirty route.** Insert a `typeof declaredMcp === "string"` branch immediately after computing `declaredMcp` (L1131), BEFORE the `readStandaloneMcp` fallback: validate the path (helper b), read wrapped-only (reader b), and on failure `partial.notes.push(ref.reason); return true;` (identical structure to L1135–1138). On success hand the unwrapped map to the UNCHANGED `applyMcpValue` for inline parity.

**Why `applyMcpValue` is unchanged (inline parity)** (L1104–1122):
```typescript
function applyMcpValue(partial: PartialResolution, mcp: unknown, detail = true): boolean {
  if (mcp === undefined) {
    return false;
  }

  if (MCP_SERVERS_VALIDATOR.Check(mcp)) {
    partial.mcpServers = mcp;
    return false;
  }
  ...
```
The string branch feeds its unwrapped map through this same `MCP_SERVERS_VALIDATOR.Check`, so `partial.mcpServers` is byte-identical to declaring the servers inline.

---

### `shared/notify.ts` — append `{malformed mcp}` to `REASONS` (D-02)

**Analog:** the failure-class members already in the `REASONS` tuple (L95–L108: `"invalid manifest"`, `"unparseable"`, `"unreadable manifest"`).

**Pattern to copy** (L89–L108):
```typescript
export const REASONS = [
  ...
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  ...
  "unparseable",
  "unreadable manifest",
  ...
] as const;
```

**Delta:** append `"malformed mcp"` as one more `as const` member near the failure-class tokens with a `// MCPR-03 / D-02:` comment (per `.claude/rules/typescript-comments.md`, use requirement/decision IDs — never phase numbers). `ContentReason = Exclude<Reason, "not added">` (L157) picks it up automatically. Order does not affect the union type but the length tripwire tracks membership (34 → 35).

### `shared/notify-reasons.ts` — add to `FAILURE_REASONS` (D-02)

**Analog:** the `FAILURE_REASONS` `as const` tuple (L99–L122), sibling `"invalid manifest"` (L110).

**Pattern to copy** (L99–L123):
```typescript
export const FAILURE_REASONS = [
  "permission denied",
  ...
  "invalid manifest",
  ...
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];
```

**Delta:** add `"malformed mcp"` to this tuple (D-02 files it failure-class, NOT unsupported). The `_ReasonsCoverageProof` at L161–164 then stays total by construction — no other edit there. Do NOT add it to `UNSUPPORTED_REASONS` (L85–92).

### `shared/probe-classifiers.ts` — new branch in `narrowResolverNotes` (D-02)

**Analog:** the hooks and lsp `startsWith` / `includes` branches in `narrowResolverNotes` (L99–L120).

**Pattern to copy — prefix-anchored classify + de-dupe** (L113–L125):
```typescript
    if (note.includes("lspServers")) {
      if (!seen.has("lsp")) {
        out.push("lsp");
        seen.add("lsp");
      }

      continue;
    }

    if (!seen.has("unsupported source")) {
      out.push("unsupported source");
      seen.add("unsupported source");
    }
```

**Delta (Pitfall 1 — collision hazard):** insert a new branch BEFORE the catch-all `unsupported source` arm (L122), matching `note.startsWith("malformed mcp reference")` and pushing `"malformed mcp"`. Use the full `reference` prefix — `"malformed mcpServers".startsWith("malformed mcp")` is `true`, so a bare `malformed mcp` match would silently reroute the inline case (which must stay `{unsupported source}`, D-02). Widen the local return type alias `UnsupportedReason` (L74) to a distinct `type ResolverNoteReason = UnsupportedReason | "malformed mcp"` so the sibling `narrowUnsupportedKinds` / `kindToReason` keep their narrow `UnsupportedReason`.

### `tests/domain/resolver-strict.test.ts` — extend (MCPR-01/02/03/04, criterion 5)

**Analog:** the `mockCtx` in-memory context + `basicEntry` fixture (L31–L82).

**Pattern to copy — in-memory reader injection** (L31–60): `mockCtx(marketplaceRoot, files)` maps absolute path → `"dir" | "file" | { contents }` for `statKind`, and stubs `readFileText`.

**Pattern to copy — schema-bypassing entry builder** (L80–82):
```typescript
function basicEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}
```

**Delta:** register a wrapped reference file — `<pluginRoot>/x.mcp.json` → `{ contents: JSON.stringify({ mcpServers: { srv: {...} } }) }` — and build the entry via `basicEntry({ source: "./local", mcpServers: "x.mcp.json" })`. Note `basicEntry` casts to `PluginEntry`, BYPASSING the schema validators, so these tests exercise `applyStrictMcp` directly; the schema-acceptance cases (MCPR-01 load / MCPR-02 `readManifest`) must go through `MARKETPLACE_VALIDATOR` / `PLUGIN_MANIFEST_VALIDATOR` explicitly (new Wave-0 test file). Add cases: parity, missing, malformed-JSON, wrapper-less, `../` escape, symlink escape, plus a criterion-5 regression (undeclared unwrapped `.mcp.json` still installable).

### `tests/architecture/notify-closed-set-locks.test.ts` — bump length (D-02)

**Analog + delta** (L29–L33):
```typescript
test("OUT-08: REASONS is the closed 34-entry reason set", () => {
  ...
  assert.equal(REASONS.length, 34);
});
```
Bump `34` → `35` (title and assertion) with a `// MCPR-03 / D-02: +1 for the malformed mcp failure-class member (34 -> 35).` comment.

## Shared Patterns

### Path containment (NFR-10 / D-14 / MCPR-04)
**Source:** `shared/path-safety.ts::assertPathInside` + `PathContainmentError`, used verbatim by `validateComponentPath` (resolver.ts L833).
**Apply to:** `validateReferencePath` (new). Runs BEFORE any read → "never reads outside plugin root" holds by construction; the D-14 all-symlink refusal is inside `assertPathInside`. Open question A1: confirm equal-path (`pluginRoot === candidate`, empty-string ref) behavior against `path-safety.ts` before asserting the empty-string sub-cause.

### Injected reader seam (testability)
**Source:** `statKindOf(ctx)` / `readFileTextOf(ctx)` (resolver.ts L910–915).
**Apply to:** `readReferencedMcp`. Keeps the same `mockCtx` injection point the resolver-strict harness already stubs.

### Closed-set reason token discipline (OUT-08)
**Source:** the compile-time `_ReasonsCoverageProof` (notify-reasons.ts L161–164) + the length tripwire (notify-closed-set-locks.test.ts L29–33).
**Apply to:** adding `"malformed mcp"` requires the coordinated edit of `REASONS`, `FAILURE_REASONS`, the narrower branch, the length test, and the catalog doc. The coverage proof + tripwire are the enforcement; `npm run check` is the gate.

### Comment-anchor policy
**Source:** `.claude/rules/typescript-comments.md`.
**Apply to:** every new comment / test title in this phase — use requirement IDs (`MCPR-01..04`) and decision IDs (`D-01..D-04`), NEVER `Phase 85` / `Wave N` / bare `Pitfall N`.

## Anti-Patterns to Avoid (from RESEARCH)

- Do NOT edit `MCP_SERVERS_SCHEMA` / `MCP_SERVERS_VALIDATOR` to accept strings — widen only the FIELD type in the entry/manifest schemas. A string in the server-map validator would let a raw string masquerade as a valid map.
- Do NOT reuse `readStandaloneMcp` with a flag that makes its tolerant branch conditional — a separate `readReferencedMcp` is the lower-risk factoring (protects criterion 5).
- Do NOT use note prefix `malformed mcp:` or bare `malformed mcp` — collides with inline `malformed mcpServers`. Use `malformed mcp reference:`.
- Do NOT enforce a `.mcp.json` filename — D-01 accepts any relative path; the `mcpServers` wrapper key is the shape gate.

## No Analog Found

None. Every new construct maps to an in-file sibling pattern.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,shared}`, `tests/{domain,architecture}`, `docs/`.
**Files scanned this session:** resolver.ts (L795–924, L1104–1141), plugin.ts (L45–96), probe-classifiers.ts (L70–129), notify-reasons.ts (L85–164), notify.ts (L89–158), resolver-strict.test.ts (L1–90), notify-closed-set-locks.test.ts (L25–38).
**Pattern extraction date:** 2026-07-22
</content>
</invoke>
