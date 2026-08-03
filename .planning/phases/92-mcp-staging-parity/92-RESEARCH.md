# Phase 92: MCP staging parity - Research

**Researched:** 2026-08-03
**Domain:** MCP `mcp.json` staging — install-time variable substitution + env injection in `bridges/mcp/stage.ts`
**Confidence:** HIGH (all findings verified against in-repo source read this session)

## Summary

Phase 92 closes the milestone's biggest env-parity gap: `stampServers`
(`bridges/mcp/stage.ts:144-158`) today writes every plugin MCP entry to
`mcp.json` verbatim + a marker, performing zero substitution and zero env
injection. This phase makes staging deliver Claude-Code-equivalent environment:
(1) deep-substitute `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and —
project-scope only — `${CLAUDE_PROJECT_DIR}` in every string value of the
plugin's own entries at any nesting depth (D-92-01), and (2) inject those same
keys into each **stdio-shaped** entry's `env` map with plugin-declared keys
winning (D-92-02, MENV-02/03). `update`/`reinstall` re-derive from the freshly
resolved plugin root, so a new sha-addressed clone dir never leaves stale paths
(MENV-04).

The change is surgically contained. All three lifecycle call sites
(`install.ts:1066`, `update.ts:1170`, `reinstall.ts:1528`) already hold the
resolved `pluginRoot` and a computed `pluginDataDir` in hand — they simply do
not thread them into `StageMcpInput` yet. Scope is already carried on
`locations.scope`, and `cwd` is already a `StageMcpInput` field. The substitution
+ injection logic lands ONLY on the plugin's own `servers` (the `stamped`
branch); the `theirs` partition stays verbatim, and the non-object-entry
tolerance stays intact. No external packages, no network, no new disk-write
machinery — the existing single `atomicWriteJson` commit (NFR-1) and the
four-slot collision check (MC-4) are untouched.

**Primary recommendation:** Add `pluginRoot`/`pluginData` to `StageMcpInput`;
build a bridge-local pure helper (`bridges/mcp/substitute.ts`) that deep-walks an
entry substituting string leaves via a **single-pass alternation regex** (kills
the T-03-01 cross-variable re-expansion risk and gives unknown-`${...}`
pass-through for free), then injects env for stdio entries with
`{ ...injected, ...declared }` spread; wire it into `stampServers` so it runs
before the marker is stamped. Do NOT extend `shared/vars.ts::substituteClaudeVars`
— Phase 93 owns that signature for content substitution with a different
variable set.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Variable substitution in MCP entries | Install-time staging (bridges/mcp) | — | Values must be baked at stage time; pi-mcp-adapter never interpolates command/args and blanks unknown `${VAR}` in env `[VERIFIED: .planning/REQUIREMENTS.md:29]` |
| Env injection (CLAUDE_PLUGIN_ROOT/DATA/PROJECT_DIR) | Install-time staging (bridges/mcp) | — | Baked into `mcp.json` because Pi's mcp-adapter spawns the servers, not this extension `[VERIFIED: .planning/REQUIREMENTS.md:63]` |
| Path/scope resolution (pluginRoot, pluginData, cwd, scope) | Orchestrators (install/update/reinstall) | persistence/locations | Orchestrators own the resolver output and `locations`; the bridge is a pure sink |
| Atomic write + containment | bridges/mcp commit + persistence | — | Unchanged — `atomicWriteJson` (NFR-1); `mcpJsonPath` is a hard-coded suffix on scopeRoot (NFR-10) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Restated from ROADMAP/REQUIREMENTS (not re-decided):
- Substitution set: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and
  `${CLAUDE_PROJECT_DIR}` for project-scope installs ONLY (user-scope
  `${CLAUDE_PROJECT_DIR}` is a documented absence — unknowable at install time;
  passes through untouched).
- Injection keys: `CLAUDE_PLUGIN_ROOT` + `CLAUDE_PLUGIN_DATA` always (for
  injected entries); `CLAUDE_PROJECT_DIR` additionally for project-scope only.
- Precedence: plugin-declared env keys WIN over injected defaults (Claude Code's
  spread order — injected first, declared spread over).
- Rationale (verified): Claude Code substitutes at config load; pi-mcp-adapter
  does NOT interpolate `command`/`args` at all and interpolates env values
  against `process.env` replacing unknown `${VAR}` with the empty string —
  stage-time substitution is the only delivery path for `command`/`args` and the
  only correct one for per-plugin `env` values.
- MENV-04: `update`/`reinstall` re-stage paths re-derive substitution + injection
  from the CURRENT resolved plugin root.
- All disk mutations atomic (NFR-1); containment (NFR-10); no network (NFR-5).

**D-92-01 (Substitution surface):** Substitution is **whole-entry, deep** — walk
every string value in each server entry at any nesting depth
(`command`, `args`, `env`, `cwd`, `headers`, `url`, transport-specific fields…)
and substitute the three-var set. Unknown `${...}` tokens pass through untouched.
Only string VALUES are substituted — never object keys, never the extension's own
`_piClaudeMarketplace` marker.

**D-92-02 (Env injection targeting):** Injection applies to **stdio-shaped
entries only** — entries with a `command` field. Remote http/sse (url-type)
entries keep their declared `env` untouched. Substitution (D-92-01) still applies
to url-type entries' string values.

### Claude's Discretion
- Where the deep-substitution walker lives (extend `shared/vars.ts` vs an
  mcp-bridge-local helper) — respect the D-11 import matrix; keep Phase 93's
  content-substitution concern cleanly separable (per-surface variable sets
  differ: MCP gets the project-scope `${CLAUDE_PROJECT_DIR}` arm; content
  substitution's set is Phase 93's).
- How pluginRoot/pluginData/scope thread into `StageMcpInput`.
- Test structure; fixture design for nested entries and precedence.

### Deferred Ideas (OUT OF SCOPE)
- "Coverage sweep: test rare failure arms in update/reinstall/install" —
  keyword-matched again; carried forward from Phase 90 as unrelated, stays
  pending.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MENV-01 | Substitute `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}`/(project) `${CLAUDE_PROJECT_DIR}` in each server's string values with real install paths | Deep walker in `bridges/mcp/substitute.ts`; values sourced from resolver `pluginRoot` + `locations.pluginDataDir` + `cwd`. See Architecture Patterns 1 & 2 |
| MENV-02 | Every stdio server's `env` carries `CLAUDE_PLUGIN_ROOT`+`CLAUDE_PLUGIN_DATA`; declared keys win | `{ ...injected, ...declared }` spread. See Pattern 3 |
| MENV-03 | Project-scope adds `CLAUDE_PROJECT_DIR`; user-scope absence documented | Scope arm keyed on `locations.scope === "project"`; value = `input.cwd`. See Pattern 4 |
| MENV-04 | `update`/`reinstall` re-derive; no stale paths after plugin-root change | Both call `prepareStageMcpServers` with freshly-resolved `installable.pluginRoot` + freshly-computed `pluginDataDir`; source servers carry placeholders (no double-substitution). See Pattern 5 + Pitfall 1 |
</phase_requirements>

## Standard Stack

**No external packages.** This phase is pure in-repo TypeScript. All primitives
already present:

| Primitive | Source | Purpose |
|-----------|--------|---------|
| `atomicWriteJson` | `shared/atomic-json.ts` (already imported by stage.ts:26) | NFR-1 atomic commit — unchanged |
| `write-file-atomic` | `^8.0.0` (already a dep) | rollback path — unchanged |
| `String.prototype.replaceAll` / single-pass `String.prototype.replace` | Node built-in | leaf substitution |
| `locations.scope` / `locations.scopeRoot` | `persistence/locations.ts` (frozen brand) | scope arm |

No `npm install`. No Package Legitimacy Audit needed (no external packages
introduced). No Environment Availability audit (code-only change).

## Architecture Patterns

### System Architecture Diagram

```
install / update / reinstall orchestrator
  holds: resolved pluginRoot, pluginDataDir, locations(scope), cwd, servers(SOURCE)
        │  (servers still carry ${CLAUDE_PLUGIN_ROOT} etc. — verbatim resolver output)
        ▼
prepareStageMcpServers(StageMcpInput + pluginRoot + pluginData)
        │
        ├─ readScopedDoc → partition ours/theirs by marker   (theirs = VERBATIM, untouched)
        ├─ assertNoMcpCollisions (MC-4)                        (unchanged)
        ├─ AS-8 noop short-circuit                             (unchanged)
        │
        └─ stampServers(servers, …, subCtx)   ← THE CHANGE LANDS HERE
                for each own entry:
                  non-object?  → {} + marker            (tolerance kept)
                  object?      → deepSubstitute(entry, {ROOT,DATA,[PROJECT_DIR]})
                                 → if stdio (command:string): env = {...injected, ...declared}
                                 → { ...substituted, [MARKER]: marker }
        │
        ▼
merged doc { ...doc, mcpServers: { ...theirs, ...stamped } }
        ▼
commitPreparedMcp → atomicWriteJson(mcpJsonPath)   (NFR-1, unchanged)
```

### Recommended Project Structure

```
bridges/mcp/
├── stage.ts          # stampServers gains a substitution/injection call
├── substitute.ts     # NEW — pure deep walker + env injection (bridge-local)
├── types.ts          # StageMcpInput gains pluginRoot, pluginData
└── marker.ts         # unchanged
```

### Pattern 1: Single-pass alternation substitution for string leaves (RECOMMENDED)

**What:** Replace all three known vars in ONE pass via a regex alternation with a
replacer function that looks up the value; unmatched `${...}` tokens are never
touched.

**When to use:** Every string leaf in the walk.

**Why single-pass over 3× sequential `replaceAll`:** `shared/vars.ts` chains two
`replaceAll` calls (`vars.ts:33-35` `[VERIFIED: shared/vars.ts:32-36]`). That is
safe for the SAME-var re-expansion property its test pins
(`[VERIFIED: tests/shared/vars.test.ts:45]`), but chaining N sequential
`replaceAll` calls is NOT safe against **cross-variable** re-expansion: if the
`pluginRoot` value literally contained `${CLAUDE_PLUGIN_DATA}`, the second
`replaceAll` would expand it. Real install paths never contain `${...}`, so this
is latent-only — but a single-pass alternation eliminates the class entirely and
is the cleaner primitive for a 3-var set with a scope-conditional member.

**Example:**
```typescript
// Source: pattern derived from shared/vars.ts one-pass discipline (T-03-01)
const VAR_RE = /\$\{(CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|CLAUDE_PROJECT_DIR)\}/g;

function substituteLeaf(s: string, map: ReadonlyMap<string, string>): string {
  return s.replace(VAR_RE, (whole, name: string) => {
    const v = map.get(name);
    return v === undefined ? whole : v; // unknown/omitted var → pass through untouched
  });
}
```
Project-scope builds `map` with all three keys; user-scope omits
`CLAUDE_PROJECT_DIR`, so `${CLAUDE_PROJECT_DIR}` falls through the `undefined`
branch and passes through verbatim (documented user-scope absence, MENV-03).

> Note on the Sonar `replaceAll` string-literal rule: that rule targets
> `replaceAll(/literal/g)` where a plain string arg would do. Here the pattern is
> a genuine dynamic alternation with a function replacement — a legitimate regex
> need, not a literal-pattern smell. `[ASSUMED]` — confirm the rule stays quiet
> when the plan runs `npm run lint`.

### Pattern 2: Deep walk — string leaves only, keys never

**What:** Recurse arrays and plain objects; substitute string leaves; leave
numbers/booleans/null and object KEYS untouched.

**Example:**
```typescript
function deepSubstitute(node: unknown, map: ReadonlyMap<string, string>): unknown {
  if (typeof node === "string") return substituteLeaf(node, map);
  if (Array.isArray(node)) return node.map((el) => deepSubstitute(el, map));
  if (typeof node === "object" && node !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = deepSubstitute(v, map);
    return out;                       // keys copied verbatim — never substituted
  }
  return node;                        // non-string leaf untouched
}
```
The `_piClaudeMarketplace` marker is stamped AFTER substitution
(`stampServers` currently spreads then adds the marker key,
`[VERIFIED: bridges/mcp/stage.ts:151-155]`), so the marker never enters the walk
— no special-casing needed as long as ordering is preserved.

### Pattern 3: Env injection with declared-wins spread (stdio only)

**What:** For entries with a string `command`, build
`env = { ...injected, ...declaredEnv }`. Injected first → declared spreads over →
"declared wins" is structural (matches Claude Code spread order).

**Example:**
```typescript
// injected built from the same map used for substitution
const injected: Record<string, string> = {
  CLAUDE_PLUGIN_ROOT: pluginRoot,
  CLAUDE_PLUGIN_DATA: pluginData,
  ...(scope === "project" ? { CLAUDE_PROJECT_DIR: cwd } : {}),
};
if (typeof entry.command === "string") {
  const declared = isPlainObject(entry.env) ? entry.env : {};
  entry = { ...entry, env: { ...injected, ...declared } };
}
```
`declared` is the ALREADY-substituted env (the walk ran first), so a declared
`CLAUDE_PLUGIN_ROOT: "${CLAUDE_PLUGIN_ROOT}/x"` resolves and still wins the key.

### Pattern 4: Scope arm — `CLAUDE_PROJECT_DIR` = project root = `cwd`

**What:** Project-scope value for `${CLAUDE_PROJECT_DIR}` (substitution) and the
injected `CLAUDE_PROJECT_DIR` key is the **project root**, i.e. `input.cwd` —
NOT `scopeRoot` (which is `<cwd>/.pi` for project scope,
`[VERIFIED: persistence/locations.ts:145]`).

**Verification of the mirror:** The hook lane sets
`CLAUDE_PROJECT_DIR: transCtx.cwd`
`[VERIFIED: bridges/hooks/dispatch-exec.ts:315]`. `StageMcpInput.cwd` is the same
project cwd (`[VERIFIED: bridges/mcp/types.ts:53-54]`,
"Used by MC-4 collision check … the four-slot list"; passed as `c.cwd` at
`install.ts:1069`). Mirror the hook lane: project-scope `CLAUDE_PROJECT_DIR = cwd`.
Scope is read from `locations.scope` (`Scope = "user" | "project"`,
`[VERIFIED: persistence/locations.ts:40]`), which is a frozen field on the
`ScopedLocations` bundle (`[VERIFIED: persistence/locations.ts:192-195]`).

### Pattern 5: MENV-04 re-derivation — no threading gap

Both re-stage paths ALREADY pass the freshly-resolved root and a freshly-computed
data dir; only the two new fields need adding:

| Call site | Line | pluginRoot in hand | pluginData in hand |
|-----------|------|--------------------|--------------------|
| install | `install.ts:1066-1073` | `c.resolved.pluginRoot` (also used at `install.ts:1072` `sourcePath`, `:1049`, `:1125`) | `c.pluginDataDir` (`install.ts:865,880`) |
| update | `update.ts:1170-1177` | `installable.pluginRoot` (`update.ts:1176`) | `pluginDataDir` computed `update.ts:1135` |
| reinstall | `reinstall.ts:1528-1535` | `input.installable.pluginRoot` (`reinstall.ts:1534`) | `input.pluginDataDir` (`reinstall.ts:1494,1505`) |

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1066-1073]`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1135-1177]`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1494-1535]`

The sibling bridges already thread exactly this pair — e.g. `prepareStageSkills`
receives `pluginRoot: installable.pluginRoot, pluginDataDir`
(`[VERIFIED: orchestrators/plugin/update.ts:1139-1147]`). MCP is the only bridge
NOT receiving them. `locations.pluginDataDir(mp, plugin)` is async and does
`assertSafeName` + `assertPathInside` containment
(`[VERIFIED: persistence/locations.ts:106,216-226]`), but the callers already
awaited it and hold the resolved string — the bridge receives the plain path,
not the method.

### Anti-Patterns to Avoid

- **Touching `theirs`:** Substitution/injection must apply ONLY to the plugin's
  own `servers` argument (which becomes `stamped`). `theirs` is merged verbatim
  (`[VERIFIED: bridges/mcp/stage.ts:208]` `{ ...theirs, ...stamped }`).
- **Substituting object keys or the marker:** keys copied verbatim; marker
  stamped after the walk.
- **Creating `env` on url-type entries:** only stdio (has `command`) gets an
  `env`; a url-type entry with no `env` must stay without one (D-92-02).
- **Extending `substituteClaudeVars` for MCP:** Phase 93 owns that signature with
  a different (content) variable set; MCP's set includes the project-scope
  `${CLAUDE_PROJECT_DIR}` arm. Keep separable (D-11 / discretion).
- **Reading back `mcp.json` as the substitution source:** always substitute the
  resolver's SOURCE `servers` (placeholders intact) — see Pitfall 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic write | custom tmp+rename | `atomicWriteJson` (already wired at `stage.ts:251`) | NFR-1 already satisfied; commit path untouched |
| Containment check | manual path prefix logic | `locations.pluginDataDir` did it upstream | callers already resolved + containment-checked the data dir |
| Deep clone for immutability | `structuredClone` then mutate | the recursive `deepSubstitute` returns fresh objects | walk already produces new nodes; no separate clone pass |

**Key insight:** The only genuinely new code is a ~30-line pure function. Everything
around it (partition, collision, commit, rollback, marker) is unchanged.

## Common Pitfalls

### Pitfall 1: Double-substitution on re-stage
**What goes wrong:** A re-stage substitutes already-substituted paths, or an
already-real path gets re-walked and corrupted.
**Why it doesn't happen here:** `prepareStageMcpServers` receives
`servers: installable.mcpServers` — the resolver's SOURCE output, which still
carries the literal `${CLAUDE_PLUGIN_ROOT}` placeholders. It does NOT read the
previously-written `mcp.json` (that read, `readScopedDoc`, feeds only the
ours/theirs partition, `[VERIFIED: bridges/mcp/stage.ts:174-178]`). The old ours
entries are dropped and fully replaced by freshly-stamped ones
(`[VERIFIED: bridges/mcp/stage.ts:207-208]`). **Verify** `installable.mcpServers`
is verbatim resolver output at all three sites (it is the same value passed to
`sourcePath`).
**Warning signs:** a substituted absolute path appearing inside a `${...}` after
re-stage; a real path fed through the walker twice.

### Pitfall 2: T-03-01 cross-variable re-expansion
**What goes wrong:** Sequential `replaceAll` for 3 vars could re-expand a
substituted value that literally contains another var's token.
**How to avoid:** Single-pass alternation regex (Pattern 1) — each `${VAR}` site
is resolved exactly once against the map; output is never re-scanned.
**Warning signs:** a test where `pluginData = "${CLAUDE_PLUGIN_ROOT}/data"`
produces a doubly-expanded value.

### Pitfall 3: Injecting env onto url-type entries
**What goes wrong:** A remote http/sse entry gains a `CLAUDE_*` env block that is
dead weight (pi-mcp-adapter doesn't spawn it).
**How to avoid:** Gate injection on `typeof entry.command === "string"`
(`McpServerEntry.command?: string`, `[VERIFIED: bridges/mcp/types.ts:17]`).
Do NOT synthesize `env` on a non-stdio entry that had none.
**Warning signs:** a url-only fixture emerging with an `env` key post-stage.

### Pitfall 4: Non-object entry tolerance regression
**What goes wrong:** The walker crashes or drops the marker on a malformed
(non-object / array / primitive) entry.
**How to avoid:** Keep the existing guard — non-object entries become `{}` + marker
(`[VERIFIED: bridges/mcp/stage.ts:152-154]`). Skip substitution/injection for
them; they still get the marker.
**Warning signs:** a `servers: { bad: 42 }` fixture throwing instead of producing
`{ _piClaudeMarketplace: {...} }`.

## Runtime State Inventory

Not applicable — this is a feature-addition phase (new staging behavior), not a
rename/refactor/migration. No stored keys, service config, OS registrations,
secrets, or build artifacts embed a string being renamed.

- **Stored data:** None — no datastore key changes.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** The env-var NAMES (`CLAUDE_PLUGIN_ROOT` etc.) are Claude
  Code contract strings written INTO `mcp.json`; they are new output, not a
  rename of existing state.
- **Build artifacts:** None.

## Code Examples

### Where the call lands in `stampServers`
```typescript
// bridges/mcp/stage.ts — stampServers gains a subCtx param
function stampServers(
  servers: Record<string, unknown>,
  pluginName: string,
  marketplaceName: string,
  subCtx: { pluginRoot: string; pluginData: string; scope: Scope; cwd: string },
): Record<string, unknown> {
  const marker = buildMarker(pluginName, marketplaceName);
  const map = buildVarMap(subCtx); // ROOT, DATA, +PROJECT_DIR if project scope
  const stamped: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(servers)) {
    const entryObj =
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
        ? substituteAndInject(entry as Record<string, unknown>, map, subCtx)
        : {};
    stamped[name] = { ...entryObj, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker };
  }
  return stamped;
}
```
`prepareStageMcpServers` already destructures `input`
(`[VERIFIED: bridges/mcp/stage.ts:172]`); pull `pluginRoot`, `pluginData`, and
derive `scope` from `input.locations.scope`, `cwd` from `input.cwd`, and pass
the `subCtx` at the single `stampServers` call
(`[VERIFIED: bridges/mcp/stage.ts:204]`).

### `StageMcpInput` additions
```typescript
// bridges/mcp/types.ts
export interface StageMcpInput {
  readonly locations: ScopedLocations;   // carries scope (locations.scope)
  readonly cwd: string;                   // project root — CLAUDE_PROJECT_DIR (project scope)
  readonly marketplaceName: string;
  readonly pluginName: string;
  readonly servers: Record<string, unknown>;
  readonly pluginRoot: string;            // NEW
  readonly pluginData: string;            // NEW
  readonly sourcePath?: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `stampServers` writes entries verbatim + marker | substitute + inject before marker | this phase | Closes MENV-01..04 |

**Deprecated/outdated:** none.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Single-pass alternation regex with a function replacement does not trip the Sonar `replaceAll` string-literal rule | Pattern 1 | Low — lint would flag at `npm run check`; swap to a guarded helper if it fires |
| A2 | `installable.mcpServers` at all three call sites is verbatim resolver output (placeholders intact), never a read-back of `mcp.json` | Pitfall 1 | Medium — if a path already read back substituted values, re-stage could double-substitute; plan should assert source provenance in a test |
| A3 | "stdio-shaped" == `typeof entry.command === "string"` matches pi-mcp-adapter's stdio-vs-remote spawn decision | Pattern 3 / Pitfall 3 | Low — matches the `McpServerEntry` type shape and D-92-02 wording; url/http entries lack `command` |

## Open Questions (RESOLVED)

1. **Should `scope`/`cwd` be passed explicitly or derived inside the bridge?**
   - What we know: `locations.scope` and `input.cwd` are both already on
     `StageMcpInput`; only `pluginRoot`/`pluginData` are missing.
   - What's unclear: whether to add an explicit `scope` field or read
     `input.locations.scope`.
   - Recommendation: derive from `input.locations.scope` and `input.cwd` (already
     present, frozen, authoritative) — add ONLY `pluginRoot` + `pluginData`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), Node >= 20.19.0 |
| Config file | none — glob in `package.json` `test` script |
| Quick run command | `node --test "tests/bridges/mcp/stage.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format + test + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MENV-01 | deep substitution in command/args/env/cwd/headers; unknown `${...}` pass-through; keys & marker untouched; non-object tolerance | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (extend) |
| MENV-02 | stdio env carries ROOT+DATA; declared key wins | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (extend) |
| MENV-03 | project-scope injects PROJECT_DIR=cwd; user-scope omits it (both substitution + injection arms) | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (extend) |
| MENV-04 | re-stage with a new pluginRoot leaves no old-root substring in mcp.json | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `node --test "tests/bridges/mcp/stage.test.ts"`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- Existing `tests/bridges/mcp/stage.test.ts` provides the fixture machinery
  (`withTmpScope` at `stage.test.ts:31`, `locationsFor("project", cwd)` at
  `stage.test.ts:33`) `[VERIFIED: tests/bridges/mcp/stage.test.ts:26-39]`. A
  user-scope arm needs `locationsFor("user", cwd)` fixtures for the MENV-03
  absence test.
- If the walker lives in `bridges/mcp/substitute.ts`, add a focused
  `tests/bridges/mcp/substitute.test.ts` for the pure walker (nesting, arrays,
  non-string leaves, unknown-var pass-through, T-03-01 cross-var) — cheaper and
  more targeted than driving everything through `prepareStageMcpServers`.
- No framework install needed.

## Security Domain

`security_enforcement` not disabled in config → enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Substitution operates on plugin-declared data written to `mcp.json`; unknown `${...}` pass through untouched (no eval, no template engine). Only literal token replacement — no injection surface introduced |
| V6 Cryptography | no | — |
| V2/V3/V4 (auth/session/access) | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path escape via crafted plugin values | Tampering | `mcpJsonPath` is a hard-coded suffix on `scopeRoot` (NFR-10, `[VERIFIED: persistence/locations.ts:153]`); `pluginData` already containment-checked by `pluginDataDir` upstream. Substitution writes strings into a JSON value slot — it cannot redirect the write target |
| Substitution re-expansion / token injection | Tampering | Single-pass alternation; unknown tokens untouched; keys never substituted (Pattern 1/2) |
| Marker forgery / stripping | Tampering | Marker stamped after the walk from `buildMarker`; never walked or substituted |

## Sources

### Primary (HIGH confidence — in-repo source read this session)
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` — `stampServers`,
  `prepareStageMcpServers`, partition/commit/AS-8 noop
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts` — `StageMcpInput`,
  `McpServerEntry`
- `extensions/pi-claude-marketplace/bridges/mcp/marker.ts` — marker shape/stamp
- `extensions/pi-claude-marketplace/shared/vars.ts` +
  `tests/shared/vars.test.ts:45` — `substituteClaudeVars`, T-03-01 property
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `scope`,
  `scopeRoot`, `pluginDataDir`
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:315` —
  `CLAUDE_PROJECT_DIR: transCtx.cwd` mirror
- `orchestrators/plugin/{install,update,reinstall}.ts` — three call sites
- `tests/bridges/mcp/stage.test.ts` — fixture machinery
- `.planning/REQUIREMENTS.md` (MENV-01..04), `.planning/STATE.md`,
  `.planning/phases/92-mcp-staging-parity/92-CONTEXT.md`

### Secondary (MEDIUM confidence)
- `.claude/rules/typescript-comments.md` — comment policy (decision/requirement
  IDs allowed; no phase/plan refs)

### Tertiary (LOW confidence)
- Sonar `replaceAll` rule behavior on dynamic alternation (A1) — verify at lint
  time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external deps; all primitives read in source
- Architecture: HIGH — every seam (call sites, types, scope, mirror) verified in
  source this session
- Pitfalls: HIGH — double-substitution and tolerance guards traced to exact lines

**Research date:** 2026-08-03
**Valid until:** 2026-09-03 (stable — in-repo surface, no fast-moving externals)
