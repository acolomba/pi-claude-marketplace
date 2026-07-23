# Phase 85: `mcpServers` string file-path references - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Teach the resolver to accept `mcpServers` declared as a `./`-relative **string
path** (from a `marketplace.json` plugin entry or a `plugin.json`) in addition
to the existing inline-object form. The string points at a **wrapped** `.mcp.json`
(`{ "mcpServers": {...} }`) inside the plugin root; the resolver reads it,
unwraps it, and installs the declared servers at full parity with the inline
form. A broken reference degrades that one plugin to `(unavailable)` — never the
whole marketplace read. Resolution happens in `domain/resolver.ts::applyStrictMcp`,
before `applyMcpValue`. Requirements MCPR-01..04.

</domain>

<decisions>
## Implementation Decisions

### Path validation (MCPR-01, MCPR-02, MCPR-04)
- **D-01:** Resolve the string reference by **reusing the existing
  `validateComponentPath` pattern** — reject absolute paths, then
  `path.resolve(pluginRoot, str)` + `assertPathInside(pluginRoot, candidate)`
  (which enforces the no-`../`-escape rule and the stricter D-14 all-symlink
  refusal). Any relative form is accepted: `./x.mcp.json` and `config/x.mcp.json`
  alike; a literal `./` prefix is **not** required.
  - Rationale: semantic (containment) parity with Claude's rule, and internal
    consistency with the five sibling component-path fields
    (`skills`/`commands`/`agents`/`hooks`/`lspServers`), which the repo's
    `validateComponentPath` already validates the same lenient way. Containment —
    the security-critical guarantee — is identical either way.
  - **Documented divergence:** Claude's docs literally state "all paths must be
    relative to the plugin root and start with `./`". We follow *semantic*
    containment parity, not *literal* syntactic parity (no `./`-prefix
    enforcement), matching existing repo behavior. Enforcing `./` is arguably a
    repo-wide decision for all path fields, not a per-field bolt-on.
  - **Reversibility:** reversible — a local validation predicate.

### Reason surface (MCPR-03, MCPR-04)
- **D-02:** A broken/malformed mcp string reference surfaces a **new
  failure-class reason token `{malformed mcp}`** — *not* an "unsupported"-family
  token.
  - Rationale: the `UNSUPPORTED_REASONS` family (`unsupported hooks` / `lsp` /
    `unsupported source`) semantically means a **well-formed but unsupported
    component KIND** — lsp / monitors / themes / etc. — whose content the
    resolver never parses (for an unsupported kind, malformed-vs-well-formed is a
    non-question). `mcpServers` is a **supported** feature the resolver actively
    parses, so a broken reference is a **malformation**, semantically parallel to
    `{invalid manifest}` / `{unparseable}` in `FAILURE_REASONS`. Reusing
    `{unsupported source}` would be a category error.
  - One **umbrella** token covers all four failure modes (missing file /
    malformed JSON / missing `mcpServers` wrapper / out-of-root escape); the
    **specific cause** is carried in `notes[]` and surfaced by `info`.
  - Inline malformed `mcpServers` stays **as-is** (still `{unsupported source}`)
    — out of scope; see deferred REASON-01.
  - **Planner note (mechanical):** resolver `notes[]` currently narrow **only**
    to the unsupported family via `narrowResolverNotes` (returns the local
    `UnsupportedReason`); failure-class tokens today come from the separate
    `narrowProbeError` path. Emitting `{malformed mcp}` for a resolver defect
    means either widening `narrowResolverNotes` to carry a failure-class member
    or classifying that one note at the orchestrator layer. Small but real.
  - **Reversibility:** costly — a closed-set reason token touches the
    `notify-reasons.ts` catalog, `narrowResolverNotes`, every exhaustive reason
    consumer, the closed-set test, and the reason-catalog docs; renaming later is
    a coordinated multi-file change.

### Resolution mode (roadmap scope)
- **D-03:** Add string-reference resolution to **`applyStrictMcp` only** (strict
  mode). `resolveLoose` / `applyLooseMcp` is exported from `domain/index.ts` but
  has **no wired dispatch caller** — every real resolution flows through
  `resolveStrict`. No speculative work on unreachable code; matches the roadmap
  goal exactly.
  - **Reversibility:** reversible.

### Referenced-file shape (MCPR-03, locked by requirements)
- **D-04:** The referenced file MUST be a **wrapped** `.mcp.json`
  (`{ "mcpServers": {...} }`). A bare server map (no wrapper) degrades as
  malformed → `{malformed mcp}`. This is **distinct** from the conventional
  standalone `<pluginRoot>/.mcp.json` read by `readStandaloneMcp`, which keeps
  its existing unwrapped-superset tolerance **unchanged** (regression guard,
  success criterion 5). Implication: the referenced-file read needs wrapped-only
  strictness, distinct from `readStandaloneMcp`'s tolerant
  `"mcpServers" in parsed ? parsed.mcpServers : parsed`.
  - **Reversibility:** reversible (locked by requirement regardless).

### Claude's Discretion
- Reader factoring: a separate `readReferencedMcp` vs. a wrapped-only flag on
  `readStandaloneMcp` — correctness is identical; pick the cleaner factoring.
- Exact `notes[]` wording per sub-case (as long as the token is `{malformed mcp}`
  and the note distinguishes missing / malformed-JSON / unwrapped / escape).
- Which exported group `{malformed mcp}` is filed under, subject to D-02's
  semantic intent (failure-class, not unsupported).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Specs / requirements
- `.planning/REQUIREMENTS.md` — MCPR-01..04 (+ Future MCPR-F1 array form; + Out
  of Scope table locking loader-inlining, marketplace-entry array form, unwrapped
  referenced files, `${CLAUDE_PLUGIN_ROOT}` substitution, non-local sources).
- `.planning/ROADMAP.md` §Phase 85 — goal + five success criteria (criterion 5 is
  the standalone-`.mcp.json` unwrapped-tolerance regression guard).
- `code.claude.com/docs/en/plugins-reference` (external, verified 2026-07-22) —
  `mcpServers` is `string|array|object` (plugin.json) / `string|object`
  (marketplace entry); "All paths must be relative to the plugin root and start
  with `./`"; "Installed plugins cannot reference files outside their directory
  … `../shared-utils` will not work". Drives the D-01 divergence note.

### Source seam (the code this phase edits)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `applyStrictMcp`
  (~L1124, the edit site, before `applyMcpValue`), `applyMcpValue` (~L1104),
  `readStandaloneMcp` (~L905, tolerant read to contrast), `validateComponentPath`
  (~L795, the reuse pattern), `UNSUPPORTED_COMPONENT_KINDS` (~L347, why lsp is
  never parsed).
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` —
  `narrowResolverNotes` (~L95, the note→reason narrower; unsupported-only today).
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` —
  `UNSUPPORTED_REASONS` (~L85) / `FAILURE_REASONS` (~L99) closed reason catalog;
  `{malformed mcp}` lands here.
- `extensions/pi-claude-marketplace/shared/path-safety.ts` — `assertPathInside`
  / `PathContainmentError` (D-14 symlink refusal).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validateComponentPath` (resolver.ts): the exact reject-absolute +
  `path.resolve` + `assertPathInside` pattern D-01 reuses for the string path.
- `assertPathInside` / `PathContainmentError` (path-safety.ts): containment +
  D-14 all-symlink refusal, reused verbatim for MCPR-04.
- `applyMcpValue` (resolver.ts): validates a server map via
  `MCP_SERVERS_VALIDATOR` and assigns `partial.mcpServers`; the string branch
  feeds the unwrapped map into this unchanged, giving inline-parity for free.
- `readStandaloneMcp` (resolver.ts): JSON read shape to mirror — but it is
  *tolerant* of unwrapped files; the reference reader must be wrapped-only (D-04).

### Established Patterns
- Entry-over-manifest precedence via `??`:
  `declaredMcp = entry.mcpServers ?? manifest.mcpServers` — the string branch
  keys off `typeof declaredMcp === "string"` before the object path.
- Dirty accumulator → `decideResolution` → `unavailable`: pushing a note +
  returning `true` from `applyStrictMcp` is the existing structural-defect route.
- Two-layer reason model: `narrowResolverNotes` (unsupported-family) vs.
  `narrowProbeError` (failure-family) — relevant to placing `{malformed mcp}`.

### Integration Points
- New branch in `applyStrictMcp`, before `applyMcpValue`: when `declaredMcp` is a
  string → validate path (D-01) → read + JSON.parse + require `mcpServers`
  wrapper (D-04) → hand the unwrapped map to `applyMcpValue`; on any failure push
  a `malformed mcp …` note and return dirty (→ `{malformed mcp}`, D-02).

</code_context>

<specifics>
## Specific Ideas

- Token text is exactly **`malformed mcp`** (renders `{malformed mcp}`) — terse,
  matching the lowercase house style of the existing reason catalog.

</specifics>

<deferred>
## Deferred Ideas

- **REASON-01** (filed in `.planning/BACKLOG.md`): unify malformed-input failures
  under a `{malformed <feature>}` failure-class family and reroute the existing
  mislabeled cases (inline malformed `mcpServers` → `{unsupported source}`,
  malformed `hooks.json` → `{unsupported hooks}`) off the "unsupported" tokens.
  Requires re-auditing `narrowResolverNotes`. Out of scope for v1.14.
- **MCPR-F1** (in REQUIREMENTS Future): `plugin.json` `mcpServers` as an **array**
  of string paths / inline configs. Extends the same resolver seam later.

### Reviewed Todos (not folded)
- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  (score 0.6) — keyword-only match (install/claude/marketplace/plugin); it is a
  broad update/reinstall/install failure-arm coverage sweep, not specific to mcp
  string refs. Deferred to its own coverage effort.

</deferred>

---

*Phase: 85-mcpservers-string-file-path-references*
*Context gathered: 2026-07-22*
