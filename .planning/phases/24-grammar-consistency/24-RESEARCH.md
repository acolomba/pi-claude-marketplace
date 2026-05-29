# Phase 24: Grammar Consistency - Research

**Researched:** 2026-05-29
**Domain:** Internal closed-set Reason rename (`lspServers` → `lsp`) with a detection-vs-emission seam
**Confidence:** HIGH (fully internal codebase; every claim verified by direct file read)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-24-01:** The renamed reason renders as **`"lsp"`** -- NOT `"lsp servers"`. `{lsp}` parallels the single-word `{hooks}` carve-out and is terser. Trade-off accepted.
- **D-24-02:** Strategy = option (a) from SNM-36 (rename the closed-set discriminator), NOT option (b) (renderer-side translation in `composeReasons`). Option (b) was rejected: it re-hides the camelCase smell and violates closed-set purity (every Reason renders verbatim).
- **D-24-03 (amendment, lockstep):** ROADMAP SC#1, SC#3, and REQUIREMENTS SNM-36 currently spell the new token `"lsp servers"`. Amend that wording to `"lsp"` in lockstep (mirrors Phase 23's SNM-34 correction). The design endorsement of option (a) still holds; only the literal token string changes. The "13 consumer call-sites" framing in SNM-36/SC#3 is imprecise (see D-24-04) -- note that in the amendment.
- **D-24-04 (load-bearing):** NOT a blanket find/replace. The resolver emits degradation notes derived from the manifest JSON key -- they literally contain camelCase `lspServers` (`"contains lspServers"`). **Detection substrings STAY camelCase `lspServers`; only the EMITTED Reason becomes `"lsp"`.** Two seams:
  - `list.ts narrowResolverNotes`: `note.includes("lspServers")` + `seen` bookkeeping STAY camelCase; the pushed value + the local emitted-union types change `lspServers` → `"lsp"`.
  - `install.ts manifestFieldTokenFromNote`: `MANIFEST_FIELD_REASONS = new Set(["hooks","lspServers"])` STAYS camelCase (it matches the bare token sliced from the resolver note); but the function must MAP `lspServers → "lsp"` instead of `return token as Reason`.
- **D-24-06:** Every `lspServers` occurrence partitions into RENAME→`"lsp"` (closed-set Reason value / rendered byte form) vs KEEP camelCase (manifest / resolver-note / error-message / detection-input layer). Do NOT rename the KEEP bucket. (Exact site map validated below.)
- **D-24-07:** Any rendered byte-form change updates `docs/output-catalog.md` + `catalog-uat.test.ts` (+ `notify-v2.test.ts` if affected) in the SAME commit. Catalog UAT byte-equality must be GREEN at the phase boundary.
- **D-24-08:** Fold ALL 6 stale `shared/grammar/reasons.ts` references in this phase; re-point each to `shared/notify.ts::REASONS`. (`shared/grammar/` was retired in Phase 21 -- confirmed absent below.)
- **D-24-09:** Do NOT touch `domain/components/plugin.ts:31` (typebox schema) or `domain/resolver.ts:142,160` (manifest-field detection + fixture). The JSDoc at `plugin.ts:46` is manifest-side prose; default is leave it untouched.

### Claude's Discretion
- **D-24-05:** Seam mechanism -- a shared `MANIFEST_FIELD_TO_REASON` lookup (`{ hooks: "hooks", lspServers: "lsp" }`) applied at both seams vs. inline conditional at each push site. The PRINCIPLE in D-24-04 is locked; the mechanism is the planner's/executor's call.
- Plan/wave decomposition (single SNM-36; likely one or two serialized plans).
- Whether `plugin.ts:46` JSDoc stays verbatim (D-24-09) -- it is manifest-side, default leave.

### Deferred Ideas (OUT OF SCOPE)
None. Scope was tightened, not expanded: rendered token shrank from `"lsp servers"` → `"lsp"`; the stale-`shared/grammar/` hygiene was pulled IN.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNM-36 | Eliminate the lone camelCase token leak in the user-rendered `REASONS` closed set at `shared/notify.ts:79`. Per D-24-02 use option (a): rename the discriminator. Per D-24-01 the token is `"lsp"` (NOT `"lsp servers"`). Manifest-side `lspServers` (schema + resolver) stays. | Verified the exact emission seams (§Emission Seams), the type-driven compile cascade (§Type Cascade), the RENAME-vs-KEEP partition against live code (§Partition Validation), and the catalog byte-equality gate (§Validation Architecture). |
</phase_requirements>

## Summary

This is a fully internal, zero-network, no-new-dependency phase. The entire change pivots on a **single closed-set tuple edit** (`shared/notify.ts:79`, `"lspServers"` → `"lsp"`) plus the propagation that edit forces through TypeScript's type system, plus a hand-driven sweep of string-literal and prose sites the compiler will NOT catch.

The load-bearing structural fact (D-24-04) is fully confirmed by the code: the resolver writes degradation notes as `"contains lspServers"` (camelCase, derived from the real JSON manifest key). Two seams -- `list.ts::narrowResolverNotes` and `install.ts::manifestFieldTokenFromNote` -- **detect** by substring/set-membership on that camelCase token, then **emit** a closed-set `Reason`. The detection side must stay camelCase (it matches resolver notes the resolver still produces verbatim); only the emitted value becomes `"lsp"`. Today `manifestFieldTokenFromNote` does `return token as Reason` -- after the rename `"lspServers"` is no longer a `Reason` member, so the cast breaks at compile time and the function MUST map. This is the cleanest possible failure mode: the compiler forces the fix at the one site where detection meets emission.

The catalog UAT (`tests/architecture/catalog-uat.test.ts`) is a self-checking byte-equality gate: it feeds structured fixtures (e.g., `reasons: ["hooks", "lspServers"]`) to `notify()` and asserts the rendered bytes equal the fenced block in `docs/output-catalog.md` (`{hooks, lspServers}`). Both the fixture array AND the doc byte form must flip to `lsp` in the same commit, or the test goes RED -- which makes false-GREEN on the EMIT side structurally impossible.

**Primary recommendation:** Use a single shared `MANIFEST_FIELD_TO_REASON: Record<string, Reason> = { hooks: "hooks", lspServers: "lsp" }` lookup applied at both seams (D-24-05). It is self-documenting, keeps the detect-camelCase / emit-`lsp` mapping in one place, and is more robust than two divergent inline conditionals. Drive the rename from the `notify.ts:79` tuple edit, let `tsc --noEmit` enumerate the type-caught sites, then run the literal/prose sweep from the validated partition in this document.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manifest field detection (`lspServers` JSON key) | Domain (resolver/schema) | -- | The resolver reads the real `.claude-plugin/plugin.json` key; this is the source of the camelCase token and is OUT OF SCOPE (D-24-09 / SC#4). |
| Closed-set Reason definition | Shared (`notify.ts`) | -- | `REASONS` tuple is the single source of truth (D-21-01); `type Reason` derives from it. The one tuple edit lives here. |
| Detection→emission seam | Orchestrator (`list.ts`, `install.ts`) | -- | Both orchestrators match resolver notes (camelCase) and push a `Reason`. The seam is where detect-camelCase meets emit-`lsp`. |
| Reason-brace rendering | Shared (`notify.ts::composeReasons`) | -- | Sole render chokepoint; renders each Reason verbatim (D-24-02 rejected swapping here). No change needed -- purity means the renamed value flows through unchanged. |
| User-contract byte-equality proof | Test/Docs (`catalog-uat.test.ts` ↔ `output-catalog.md`) | `notify-v2.test.ts` | The catalog UAT is the user-contract gate; doc + fixture must change in lockstep (D-24-07). |

## Standard Stack

No external packages. This phase touches only first-party TypeScript files and Markdown docs. No `npm install`. No `## Package Legitimacy Audit` required (no external packages installed).

**Toolchain (already present, carried forward):**
- Node ≥22, TypeScript strict (`tsc --noEmit` is the typecheck gate).
- Test runner: `node --test` over `tests/{architecture,…}/**/*.test.ts` (verified in `package.json` scripts).
- Quality gate: `npm run check` = `typecheck && lint && format:check && test` (verified in `package.json`).

## Architecture Patterns

### Data flow through the seam (trace the canonical use case)

```
.claude-plugin/plugin.json  { "lspServers": {...} }   ← real manifest JSON key (NEVER renamed; D-24-09)
        │
        ▼
domain/resolver.ts  UNSUPPORTED_COMPONENT_KINDS includes "lspServers" (:142)   ← STAYS camelCase
        │  addUnsupportedKindNotes() pushes  partial.notes = ["contains lspServers"]
        ▼
   ┌──────────────────────────────── two emission seams ────────────────────────────────┐
   │                                                                                      │
   ▼ (list path)                                              ▼ (install path)
list.ts narrowResolverNotes(notes)                  install.ts narrowResolverReasons(reasons)
  note.includes("lspServers")  ← DETECT, STAYS         → manifestFieldTokenFromNote(note)
  out.push(  "lsp"  )          ← EMIT, RENAMES            note.startsWith("contains ")
                                                           token = "lspServers"  ← DETECT, STAYS
                                                           MANIFEST_FIELD_REASONS.has(token) ← STAYS
                                                           return MAP[token] = "lsp"  ← EMIT, RENAMES
   │                                                                                      │
   └──────────────────────────────────────┬───────────────────────────────────────────┘
                                           ▼
              PluginUnavailableMessage { reasons: [..., "lsp"] }   ← closed-set Reason
                                           ▼
              notify.ts composeReasons()  → renders verbatim  →  "{hooks, lsp}"   ← USER BYTES
```

A reader can trace: manifest JSON key (untouched) → resolver note (camelCase, untouched) → seam detects camelCase → seam emits `lsp` → renderer prints `{lsp}`.

### Pattern: Detection-vs-emission separation (the core pattern)
**What:** The same camelCase token serves two roles. As a *detection key* (matching resolver notes derived from the JSON manifest field) it stays `lspServers`. As an *emitted value* (the user-rendered closed-set Reason) it becomes `lsp`.
**When to use:** Exactly here. This parallels Phase 23's persistence-vs-display separation (`hash-<12hex>` persists, `v#<7hex>` renders).
**Mechanism (D-24-05 recommendation -- shared lookup):**
```typescript
// Source: install.ts:1221 (current) -- recommended generalization
// Detection set STAYS camelCase (matches the bare token sliced from "contains <kind>"):
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["hooks", "lspServers"]);
// Emission map translates detected manifest token → closed-set Reason:
const MANIFEST_FIELD_TO_REASON: Readonly<Record<string, Reason>> = {
  hooks: "hooks",
  lspServers: "lsp",
};
// manifestFieldTokenFromNote(): replace `return token as Reason` with:
//   return MANIFEST_FIELD_TO_REASON[token];  // typed; no cast needed
```
Applying the same map shape conceptually at `list.ts::narrowResolverNotes` keeps both seams aligned. In `list.ts` the structure is an explicit `if (note.includes("lspServers"))` chain -- the cleanest change there is to keep the camelCase `includes(...)` and `seen` key but push `"lsp"` and seed `seen.add("lsp")` (the `seen` set is internal bookkeeping; its key choice is free, but keeping it parallel to the pushed value avoids confusion -- see Pitfall 4).

### Anti-Patterns to Avoid
- **Blanket find/replace `lspServers` → `lsp`:** Would break the resolver note match (`note.includes("lspServers")` would never fire against `"contains lspServers"`), silently degrading every LSP row to `{unsupported source}`. This is the single most dangerous mistake. D-24-04 exists precisely to prevent it.
- **Renderer-side translation (option b):** Rejected by D-24-02. Do not add a swap inside `composeReasons`.
- **Renaming the typebox schema field or `UNSUPPORTED_COMPONENT_KINDS`:** Would break parsing of real Claude manifests. SC#4 / D-24-09 forbid it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token→Reason mapping at the seam | Two divergent inline `=== "lspServers" ? "lsp" : ...` conditionals | One shared `MANIFEST_FIELD_TO_REASON` map | Single source of truth for the detect→emit translation; trivially extensible if a future field joins the carve-out. |
| Catalog byte-equality verification | A new bespoke assertion | Existing `catalog-uat.test.ts` ↔ `output-catalog.md` lockstep | The gate already exists and is self-checking; just update both sides. |
| Closed-set membership proof | Manual grep audit only | `tsc --noEmit` (type cascade) + existing `notify-types.test.ts` | The type system enumerates every typed emission site for free. |

**Key insight:** The rename is *mostly* compiler-driven. The danger is entirely in the sites the compiler does NOT see (string literals, JSDoc, Markdown). Lean on `tsc` for the typed sites; use the validated partition below for the rest.

## Runtime State Inventory

> This is a code/docs-only rename. No stored data, services, OS state, secrets, or build artifacts carry the user-rendered token.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- verified. The rendered Reason `lsp`/`lspServers` is never persisted. `state.json` records `resources` (counts), not reason tokens. The manifest JSON key `lspServers` lives only in upstream `.claude-plugin/plugin.json` files (read at resolve time, never written by this extension). | None |
| Live service config | None -- no external services. | None |
| OS-registered state | None -- no OS registrations. | None |
| Secrets/env vars | None -- no env var or secret references the token. | None |
| Build artifacts | None -- TS is type-stripped at load; no compiled artifact caches the token. | None |

**The canonical question (after every file is updated, what still has the old string?):** Only upstream third-party `.claude-plugin/plugin.json` files in installed plugins -- and those are correctly left alone (manifest-side; D-24-09). Nothing in this repo's runtime state caches the rendered Reason.

## Partition Validation (D-24-06 audit against live code)

I grepped every `lspServers` occurrence in `extensions/`, `docs/`, and `tests/` (excluding `node_modules` and `.worktrees`) and cross-checked each against the D-24-06 partition. **The partition is exhaustive and correct in classification, but several CONTEXT.md line numbers have drifted (tests live at repo-root `tests/`, NOT `extensions/pi-claude-marketplace/tests/`).** Corrected map below -- the planner should cite these.

### RENAME → `"lsp"` (emitted Reason value / rendered byte form)

| Site | CONTEXT line | Actual line | What changes | Compiler-caught? |
|------|--------------|-------------|--------------|------------------|
| `shared/notify.ts` REASONS tuple | :79 | :79 ✓ | `"lspServers"` → `"lsp"` (the one source-of-truth edit) | n/a (the cause) |
| `list.ts` `ListReason` union | :171 | :171 ✓ | `\| "lspServers"` → `\| "lsp"` | YES |
| `list.ts` `narrowResolverNotes` return type | :272 | :272 ✓ | `"lspServers"` → `"lsp"` in the readonly tuple type | YES |
| `list.ts` `narrowResolverNotes` accumulator type | :273 | :273 ✓ | `"lspServers"` → `"lsp"` | YES |
| `list.ts` pushed value | :284 | :284 ✓ | `out.push("lspServers")` → `out.push("lsp")` | YES (after type change) |
| `list.ts` `seen` key | :283,285 | :283,285 ✓ | discretion -- recommend flip to `"lsp"` for parallelism (the `note.includes("lspServers")` substring at :283 STAYS) | NO (string literal) |
| `install.ts` `manifestFieldTokenFromNote` return | :1240 | :1240 ✓ | `return token as Reason` → `return MANIFEST_FIELD_TO_REASON[token]` | YES (the `as Reason` cast breaks) |
| `catalog-uat.test.ts` fixture | :246 | tests/architecture/catalog-uat.test.ts:**246** ✓ | `reasons: ["hooks","lspServers"]` → `["hooks","lsp"]` | NO (string literal in fixture) |
| `catalog-uat.test.ts` fixture | :490 | tests/architecture/catalog-uat.test.ts:**490** ✓ | `reasons: ["hooks","lspServers"]` → `["hooks","lsp"]` | NO |
| `install.test.ts` narrowed output | :1589 | tests/orchestrators/plugin/install.test.ts:**1589** ✓ | `assert.deepEqual(row.reasons, ["hooks","lspServers"])` → `["hooks","lsp"]` (this is the EMIT side of `classifyEntityShapeError`; INPUT at :1579 STAYS -- see KEEP) | NO |
| `install.test.ts` expected output of `__test_narrowResolverReasons` | :1698,1712 | tests/orchestrators/plugin/install.test.ts:**1698,1712** ✓ | expected `["lspServers"]` → `["lsp"]` (the `["contains lspServers"]` INPUT on the same lines STAYS) | NO |
| `docs/output-catalog.md` byte forms | :158,300 | :158,300 ✓ | `{hooks, lspServers}` → `{hooks, lsp}` (two blocks) | NO |
| `docs/output-catalog.md` carve-out prose | :58,118 | :58,118 ✓ | `{lspServers}` example → `{lsp}` (reason-describing prose) | NO |

### KEEP camelCase `lspServers` (manifest / resolver-note / error-message / detection-input)

| Site | CONTEXT line | Actual line | Why it STAYS | Risk if wrongly renamed |
|------|--------------|-------------|--------------|--------------------------|
| `domain/components/plugin.ts` typebox schema | :31 | :31 ✓ | Real JSON manifest key (SC#4) | Breaks parsing real manifests |
| `domain/resolver.ts` `UNSUPPORTED_COMPONENT_KINDS` | :142 | :142 ✓ | Drives `"contains lspServers"` note generation | Detection breaks |
| `domain/resolver.ts` `UNSUPPORTED_COMPONENT_CONVENTIONS` | :160 | :160 ✓ | Manifest-field path map (`.lsp.json`) | File-probe breaks |
| `list.ts` detection substring | :283 | :283 ✓ | `note.includes("lspServers")` matches resolver note | Silent degrade to `{unsupported source}` |
| `install.ts` `MANIFEST_FIELD_REASONS` set | :1221 | :1221 ✓ | Matches bare token sliced from `"contains lspServers"` | Carve-out goes dead → `{unsupported source}` |
| `errors.test.ts` `PluginShapeError` raw reasons + composed message | :201,204,208 | tests/shared/errors.test.ts:**202,204,208** (⚠ :201 drifted; raw `reasons` array is at **:202**) | Built from manifest field names, PRE-narrowing (`…is not installable: hooks; lspServers`) | False regression on the error-message contract |
| `resolver-loose.test.ts` `kind: "lspServers"` fixture | :194 | tests/domain/resolver-loose.test.ts:**194** ✓ | Manifest-component fixture (detection input) | Detection-input fixture diverges from real key |
| `resolver-strict.test.ts` `kind: "lspServers"` fixture | :163 | tests/domain/resolver-strict.test.ts:**163** ✓ | Same | Same |
| `install.test.ts` resolver-note INPUT | :1579 | tests/orchestrators/plugin/install.test.ts:**1579** ✓ | `["contains hooks","contains lspServers"]` is the DETECTION input | Test would no longer exercise the live detect path |
| `install.test.ts` `__test_narrowResolverReasons` INPUT | :1698,1712 | tests/orchestrators/plugin/install.test.ts:**1698,1712** ✓ | `["contains lspServers"]` input (same lines as the RENAMED expected output) | Detection input diverges |

**Occurrences NOT in either CONTEXT bucket (newly surfaced -- planner must classify):**
- `docs/prd/pi-claude-marketplace-prd.md:118,1011` -- `lspServers` listed among unsupported component kinds. **KEEP** -- these describe the manifest field / component taxonomy, not the rendered Reason. The PRD is the authoritative spec of the JSON field set; leave verbatim. (Not in scope per `<domain>` which scopes to notify/list/install/catalog/fixtures + grammar hygiene.)
- `install.ts:1141, :1208, :1254, :1277` -- JSDoc/comments. PARTITION each (see §Landmines below): `:1208` and `:1277` are **detection-describing** (`"contains lspServers"` note shape) → STAY; `:1141` and `:1254` describe the carve-out token list (`hooks / lspServers`) -- these reference the manifest *field name* the resolver matches, so they STAY camelCase too. The emitted-value description is none of these (the emitted value is `lsp` now, but these comments narrate the detection-input token).
- `list.ts:164, :265, :310, :393` -- JSDoc/comments. `:164` JSDoc says "produces `hooks` / `lspServers`" describing the EMITTED reasons → **RENAME to `lsp`** (CONTEXT.md :174 flags this). `:265` ("passes `hooks` / `lspServers` verbatim") describes emission → **RENAME**. `:310` and `:393` describe what `narrowResolverNotes` *recognises* (the detection token) → **KEEP** camelCase (they narrate the substring it matches).
- `notify.ts:192` -- already correct history ("previously imported from `shared/grammar/reasons.ts`"). Leave (D-24-08 carve-out).

**Verdict:** D-24-06 classification is correct. Two line-number drifts to fix in the plan: tests are at **repo-root `tests/`** (not `extensions/.../tests/`), and `errors.test.ts` raw-reasons array is at **:202** not :201. Four `list.ts`/`install.ts` comment sites need explicit detect-vs-emit partitioning (above).

## Type Cascade (compiler-caught vs string-literal sites)

The rename starts at `notify.ts:79`. `type Reason = (typeof REASONS)[number]` (`:100`) re-derives, so `"lspServers"` is no longer assignable to `Reason`. `tsc --noEmit` will then flag exactly:

**Compiler-CAUGHT (TypeScript surfaces these -- safe):**
1. `install.ts:1240` -- `return token as Reason` where `token` can be `"lspServers"`: the cast is now to a type that excludes `"lspServers"`. (Note: `as` casts are permissive; this specific site only errors if the surrounding types tighten. **Verify during execution** -- if `tsc` does NOT flag it, treat it as a string-literal site and fix by hand. The map rewrite eliminates the cast entirely, which is the robust fix regardless.)
2. `list.ts:171` `ListReason` union member `"lspServers"` -- once you change `out.push("lspServers")` to `out.push("lsp")`, the push fails against the unchanged union type, forcing the union + the `narrowResolverNotes` return/accumulator types (:272,:273) to update. These are genuine compile errors.
3. Any other site that assigns a literal `"lspServers"` into a `Reason`-typed slot (none found beyond the seams).

**String-literal / NOT compiler-caught (the dangerous ones -- must be hand-swept):**
- All test fixture arrays (`["hooks","lspServers"]`) -- these are inferred as `string[]` or `readonly Reason[]` depending on context; `deepEqual` comparisons are runtime, so a stale fixture fails at TEST time (RED), not COMPILE time. Good: the test failure catches it, but only if the fixture is on the RENAME side.
- `note.includes("lspServers")` and `seen` keys -- plain strings, never checked.
- `MANIFEST_FIELD_REASONS` set members -- typed `ReadonlySet<string>`, not `Reason`, so unaffected by the cascade (correctly -- they're detection keys).
- All JSDoc / Markdown -- invisible to the compiler.

**Implication for the planner:** Order the work as (1) tuple edit, (2) `tsc --noEmit` to enumerate the genuine type breaks and fix the seams, (3) run the test suite -- the catalog UAT + install/errors unit tests go RED and pinpoint the fixture sites, (4) hand-sweep the validated prose/comment partition, (5) `npm run check` GREEN.

## Stale `shared/grammar/` Hygiene (D-24-08)

`shared/grammar/` directory: **CONFIRMED ABSENT** (`ls` returns "No such file or directory"). Retired in Phase 21 (SNM-29).

The 6 stale `shared/grammar/reasons.ts` pointers to re-point to `shared/notify.ts::REASONS` (D-24-08), verified present:

| # | File | Line | Form |
|---|------|------|------|
| 1 | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | :1219 | carve-out comment "MUST also be added to `shared/grammar/reasons.ts`" |
| 2 | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | :1239 | cast-safety comment "in `shared/grammar/reasons.ts`" |
| 3 | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | :99 | "Closed-set Reasons live in `shared/grammar/reasons.ts`" |
| 4 | `docs/messaging-style-guide.md` | :54 | "defined in `…/shared/grammar/reasons.ts`" |
| 5 | `docs/messaging-style-guide.md` | :146 | markdown link to `…/shared/grammar/reasons.ts` |
| 6 | `docs/output-catalog.md` | :58 | "closed-set membership is defined by `…/shared/grammar/reasons.ts::REASONS`" |

**Confirmed: 6 sites, all live pointers.** All match CONTEXT.md D-24-08 exactly.

**Additional `shared/grammar/` references that are OUT OF D-24-08 SCOPE (do NOT re-point -- they point to *other* retired files or describe the directory, not `reasons.ts`):**
- `notify.ts:37,51,192,202,216,508` -- narrate Phase-21 history / point at `status-tokens.ts`. `:192` is explicitly carved out by D-24-08 ("leave it"). The rest reference `status-tokens.ts` or the directory generically -- out of this phase's scope.
- `reinstall.ts:714` -- points at `shared/grammar/status-tokens.ts` (different file). Out of scope.
- `shared/constants/marketplace-label-probe.ts:13,14,17` -- describe the `shared/grammar/` directory concept generically. Out of scope.
- `docs/adr/v2-001-structured-notify.md:195` -- historical migration-plan prose ("resolve `shared/grammar/` retain-or-delete (SNM-29)"). Accurate history. Out of scope.

> Recommendation: the planner should scope D-24-08 strictly to the 6 `reasons.ts` pointers above; do not let the executor over-reach into the `status-tokens.ts` / generic-directory references (that would be scope creep beyond the user-locked 6).

## Common Pitfalls

### Pitfall 1: Blanket find/replace breaks detection silently
**What goes wrong:** Replacing `lspServers` → `lsp` everywhere makes `note.includes("lspServers")` (list.ts:283) and `MANIFEST_FIELD_REASONS.has("lspServers")` (install.ts:1221) stop matching the resolver's `"contains lspServers"` note. Rows degrade to `{unsupported source}`.
**Why it happens:** The token wears two hats (detection key vs emitted value). A naive sweep treats them identically.
**How to avoid:** Honor the D-24-06 partition. Detection-input sites STAY camelCase.
**Warning signs:** Catalog UAT goes RED with `{unsupported source}` where `{lsp}` was expected; `install.test.ts:1698/1712` (`["contains lspServers"]` → expected) returns `["unsupported source"]`.

### Pitfall 2: False-GREEN if a KEEP-bucket fixture is mistakenly renamed
**What goes wrong:** Renaming `errors.test.ts:204` (`is not installable: hooks; lspServers`) or the `kind: "lspServers"` resolver fixtures would make the test pass against wrong-direction code, hiding a real regression in the error-message contract or detection input.
**Why it happens:** The error message is built from manifest field names PRE-narrowing -- it legitimately contains camelCase. Renaming it desyncs from `PluginShapeError`'s actual output.
**How to avoid:** The KEEP bucket fixtures assert detection-input / manifest-layer behavior; leave them. The RENAME bucket asserts emitted/rendered output.
**Warning signs:** A test that "passes" but no longer matches what `PluginShapeError.message` actually produces.

### Pitfall 3: `errors.test.ts:204` composed message direction
**What goes wrong:** Treating `'…is not installable: hooks; lspServers'` as a RENAME site.
**Why it happens:** It LOOKS like user output. It is NOT the closed-set Reason render -- it is the `PluginShapeError.message` built from raw manifest field names (pre-narrowing). It STAYS camelCase. The narrowed `["hooks","lsp"]` only appears AFTER `classifyEntityShapeError` runs (that's `install.test.ts:1589`, the RENAME site).
**How to avoid:** Distinguish the pre-narrow error message (KEEP) from the post-narrow rendered Reason (RENAME). The seam IS the boundary.

### Pitfall 4: `seen` set key drift in `narrowResolverNotes`
**What goes wrong:** Changing `out.push` to `"lsp"` but leaving `seen.add("lspServers")` (or vice versa) -- the dedup key and the pushed value diverge.
**Why it happens:** The `seen` set is internal bookkeeping; its key is free, so the compiler won't complain.
**How to avoid:** Keep `seen` parallel to the pushed value: push `"lsp"`, `seen.add("lsp")`, `seen.has("lsp")`. The `note.includes("lspServers")` detection substring at :283 STAYS camelCase. (This is one site mixing both hats -- the most error-prone single line.)

### Pitfall 5: ROADMAP/REQUIREMENTS say "lsp servers", phase ships "lsp"
**What goes wrong:** Leaving `.planning/ROADMAP.md` SC#1/#3 (:447,455,456,457,490 + :95) and `.planning/REQUIREMENTS.md` SNM-36 (:24) spelling `"lsp servers"` desyncs the spec from the code.
**How to avoid:** D-24-03 lockstep amendment -- correct these to `"lsp"` in the SAME phase (Phase 23 / SNM-34 precedent). Also note the "13 consumer call-sites" framing is imprecise (the real shape is two seams + type cascade + fixtures). `.planning/PROJECT.md:30` (G-MIL-04) and `.planning/v1.4-MILESTONE-UAT.md:496-525` also say "lsp servers" -- planner decides whether these milestone/UAT records get the same lockstep correction (recommend yes for the UAT truth statement at :497, since it is the acceptance oracle).

## Code Examples

### The seam rewrite (install.ts -- recommended D-24-05 mechanism)
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1221-1244 (current)
// DETECTION set -- STAYS camelCase (matches bare token from "contains lspServers"):
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["hooks", "lspServers"]);
const MANIFEST_FIELD_NOTE_PREFIX = "contains ";

// NEW -- emission map (detect-camelCase key → emit closed-set Reason value):
const MANIFEST_FIELD_TO_REASON: Readonly<Record<string, Reason>> = {
  hooks: "hooks",
  lspServers: "lsp",
};

function manifestFieldTokenFromNote(note: string): Reason | undefined {
  if (!note.startsWith(MANIFEST_FIELD_NOTE_PREFIX)) return undefined;
  const token = note.slice(MANIFEST_FIELD_NOTE_PREFIX.length);
  // was: if (MANIFEST_FIELD_REASONS.has(token)) return token as Reason;
  return MANIFEST_FIELD_TO_REASON[token];   // typed; undefined for non-carve-out tokens
}
```

### The seam rewrite (list.ts -- keep detect, flip emit)
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:270-296 (current)
function narrowResolverNotes(
  notes: readonly string[],
): readonly ("hooks" | "lsp" | "unsupported source")[] {        // ← emitted union: lsp
  const out: ("hooks" | "lsp" | "unsupported source")[] = [];   // ← lsp
  const seen = new Set<string>();
  for (const note of notes) {
    if (note.includes("hooks") && !seen.has("hooks")) {
      out.push("hooks"); seen.add("hooks"); continue;
    }
    if (note.includes("lspServers") && !seen.has("lsp")) {      // ← DETECT camelCase, dedup on lsp
      out.push("lsp"); seen.add("lsp"); continue;               // ← EMIT lsp
    }
    if (!seen.has("unsupported source")) {
      out.push("unsupported source"); seen.add("unsupported source");
    }
  }
  return out;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spec wording `"lsp servers"` (ROADMAP/REQUIREMENTS) | `"lsp"` (D-24-01) | This phase | Lockstep amendment of spec docs (D-24-03). |
| `shared/grammar/reasons.ts` as REASONS home | `shared/notify.ts::REASONS` | Phase 21 (SNM-29) | 6 stale pointers folded in this phase (D-24-08). |

**Deprecated/outdated:** `shared/grammar/` directory (retired Phase 21; absent -- verified).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `install.ts:1240`'s `as Reason` cast may NOT be flagged by `tsc` (TS `as` is permissive). | §Type Cascade | LOW -- the map rewrite removes the cast regardless; execution-time `tsc` run confirms. Flagged so the planner does not assume the compiler alone catches this seam. |
| A2 | PRD `lspServers` references (`:118,:1011`) and the milestone/UAT records are OUT of code scope; only the planner decides whether to lockstep-correct the UAT truth statement. | §Partition / Pitfall 5 | LOW -- these are spec/record docs; mis-scoping causes either harmless extra edits or a residual spec desync, both caught at milestone review. |

All structural code claims (seams, partition, type derivation, `shared/grammar/` absence, line numbers) are VERIFIED by direct file read -- not assumed.

## Open Questions

1. **Does `tsc --noEmit` actually flag `install.ts:1240`?**
   - What we know: `return token as Reason` where the set holds `"lspServers"`; after the rename `"lspServers" ∉ Reason`.
   - What's unclear: TS `as` assertions are permissive; whether THIS narrows to an error depends on surrounding inference.
   - Recommendation: Don't rely on it. Rewrite to the map (removes the cast). Run `tsc --noEmit` during execution to confirm the genuine type breaks (the `list.ts` union sites WILL break).

2. **Do `.planning/PROJECT.md:30` and `.planning/v1.4-MILESTONE-UAT.md` get the lockstep "lsp" correction?**
   - What we know: D-24-03 mandates amending ROADMAP + REQUIREMENTS. PROJECT.md/UAT also say "lsp servers".
   - What's unclear: D-24-03 names only ROADMAP SC#1/#3 + REQUIREMENTS SNM-36 explicitly.
   - Recommendation: Amend the UAT truth statement (:497) too -- it is the acceptance oracle for G-MIL-04 and would otherwise assert the wrong target. PROJECT.md G-MIL-04 (:30) is a milestone gap record; lower priority, planner's call.

## Environment Availability

> Skipped -- no external dependencies. Pure first-party TypeScript + Markdown edits. Toolchain (`node`, `tsc`, `eslint`, `prettier`) already present and used by `npm run check`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), Node ≥22 |
| Config file | none -- glob-driven via `package.json` scripts |
| Quick run command | `node --test "tests/architecture/catalog-uat.test.ts" "tests/orchestrators/plugin/install.test.ts" "tests/shared/errors.test.ts"` |
| Full suite command | `npm test` (or `npm run check` for typecheck+lint+format+test) |

### Phase Requirements → Test Map
| Req ID | Behavior (dimension) | Test Type | Automated Command | File Exists? |
|--------|----------------------|-----------|-------------------|-------------|
| SNM-36 (a) EMIT renders `{lsp}` / `{hooks, lsp}` | Catalog byte-equality: fixture `["hooks","lsp"]` → doc `{hooks, lsp}` | architecture/UAT | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ (update fixtures :246,:490 + doc :158,:300 in lockstep) |
| SNM-36 (a) EMIT via install seam | `classifyEntityShapeError` narrows `["contains hooks","contains lspServers"]` → `["hooks","lsp"]` | unit | `node --test "tests/orchestrators/plugin/install.test.ts"` (the :1576-1589 test) | ✅ (update expected output :1589) |
| SNM-36 (a) EMIT via narrow helper | `__test_narrowResolverReasons(["contains lspServers"])` → `["lsp"]` | unit | `node --test "tests/orchestrators/plugin/install.test.ts"` (:1697-1713) | ✅ (update expected :1698,:1712; INPUT stays) |
| SNM-36 DETECT still matches camelCase | The INPUT `["contains lspServers"]` (:1579,:1698,:1712) still drives the carve-out | unit | same as above | ✅ (INPUT unchanged -- proves detect side) |
| SNM-36 KEEP-bucket not renamed (false-GREEN guard) | `PluginShapeError` message `…: hooks; lspServers` byte-equal; `kind:"lspServers"` fixtures resolve | unit | `node --test "tests/shared/errors.test.ts" "tests/domain/resolver-loose.test.ts" "tests/domain/resolver-strict.test.ts"` | ✅ (assert UNCHANGED -- if these go RED you renamed a KEEP site) |
| SC#4 manifest schema/resolver untouched | typebox field + `UNSUPPORTED_COMPONENT_KINDS` unchanged | unit + grep | `node --test "tests/domain/resolver-strict.test.ts"` + `grep -n lspServers domain/components/plugin.ts domain/resolver.ts` (must still show :31,:142,:160) | ✅ |

### Minimum sampling to detect a regression in each dimension
- **(a) EMIT side:** catalog-uat.test.ts (both fixture sites) + install.test.ts :1589 + :1698/:1712 expected. If any stays `lspServers`, byte-equality fails RED.
- **(b) DETECT side:** install.test.ts :1579/:1698/:1712 INPUTS stay `contains lspServers` AND still produce `["lsp"]` -- this single test proves detect-camelCase / emit-`lsp` end to end.
- **(c) KEEP-bucket false-GREEN guard:** errors.test.ts :204 (composed message) + resolver-loose/strict `kind:"lspServers"`. These MUST stay GREEN with camelCase; a RED here means a KEEP site was wrongly renamed.
- **(d) SC#4 untouched:** grep `domain/components/plugin.ts:31` + `domain/resolver.ts:142,160` post-edit (must still be `lspServers`) + resolver-strict.test.ts GREEN.

### Wave 0 Gaps
- None -- existing test infrastructure covers all phase requirements. Every dimension above maps to an EXISTING test; the phase only updates fixtures/expectations (lockstep) and leaves KEEP-bucket assertions as the regression guard. No new test file or framework install needed.

> Note: the catalog-uat ↔ output-catalog.md byte-equality (D-24-07) is self-checking: it reads the doc's `<!-- catalog-state: STATE -->` fenced blocks at runtime and asserts `notify()` output equals them. Update doc + fixture together or it goes RED -- this structurally prevents false-GREEN on the EMIT side.

## Security Domain

> No applicable ASVS category for this phase. Verified scope: a rename of a user-facing display token + doc/comment hygiene. No authentication, session, access-control, input-validation, or cryptography surface is touched. The one security-adjacent note (`resolver.ts:135` T-02-25: the unsupported-kinds list is closed) is explicitly OUT OF SCOPE and unchanged. Input validation (V5) for manifests is owned by the typebox schema, which D-24-09 forbids touching. No threat pattern is introduced or altered.

## Sources

### Primary (HIGH confidence)
- Direct file reads (verified 2026-05-29):
  - `extensions/pi-claude-marketplace/shared/notify.ts:60-216` -- REASONS tuple :79, `type Reason` :100, `composeReasons` (sole render point), `shared/grammar` history :192.
  - `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:160-396` -- `ListReason` :169-176, `narrowResolverNotes` :270-296, comments :164,:265,:310,:393.
  - `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1130-1289` -- `classifyEntityShapeError`, `MANIFEST_FIELD_REASONS` :1221, `manifestFieldTokenFromNote` :1231-1244, `narrowResolverReasons` :1269, comments :1141,:1208,:1239,:1254,:1277.
  - `extensions/pi-claude-marketplace/domain/components/plugin.ts:20-59` -- typebox schema :31, JSDoc :46.
  - `extensions/pi-claude-marketplace/domain/resolver.ts:130-174` -- `UNSUPPORTED_COMPONENT_KINDS` :142, conventions :160.
  - `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:93-101` -- stale pointer :99.
  - `tests/architecture/catalog-uat.test.ts:5-100,238-253,483-496` -- UAT mechanism + fixtures :246,:490.
  - `tests/orchestrators/plugin/install.test.ts:1570-1713` -- INPUT :1579, EMIT :1589, narrow-helper :1697-1713.
  - `tests/shared/errors.test.ts:195-212` -- KEEP message :204, raw reasons :202.
  - `docs/output-catalog.md:58,118,158,300` -- byte forms + carve-out prose + stale pointer.
  - `docs/messaging-style-guide.md:54,146` -- stale pointers.
- Tool-verified: `ls extensions/pi-claude-marketplace/shared/grammar/` → absent. `grep -rn "lspServers"` across `extensions/`, `docs/`, `tests/` (exhaustive occurrence audit). `grep -rn "shared/grammar"` (6-pointer confirmation + out-of-scope identification). `package.json` scripts (test runner + check gate).

### Secondary / Tertiary
None -- no web research performed (fully internal domain, per research focus).

## Metadata

**Confidence breakdown:**
- Emission seams: HIGH -- read both seams line-by-line; the detect/emit boundary is explicit in code.
- Type cascade: HIGH (with one flagged caveat A1 -- the `as Reason` cast at install.ts:1240 may not error; the map rewrite makes this moot).
- Partition (D-24-06): HIGH -- every `lspServers` occurrence enumerated and classified; CONTEXT line-number drifts corrected.
- Stale-path hygiene (D-24-08): HIGH -- directory confirmed absent; 6 pointers verified, out-of-scope siblings identified.
- Validation architecture: HIGH -- catalog UAT mechanism read directly; self-checking byte-equality confirmed.

**Research date:** 2026-05-29
**Valid until:** Stable -- internal code; valid until the cited files are edited (i.e., until this phase executes). The corrected line numbers will drift once edits begin; treat them as anchors, not invariants.
