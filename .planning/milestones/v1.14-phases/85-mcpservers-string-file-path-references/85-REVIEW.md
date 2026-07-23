---
phase: 85-mcpservers-string-file-path-references
reviewed: 2026-07-22T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/components/plugin.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - tests/domain/resolver-strict.test.ts
  - tests/domain/manifest.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/shared/probe-classifiers.test.ts
  - docs/output-catalog.md
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 85: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 85 widens `mcpServers` to accept a `./`-relative string reference to a
wrapped `.mcp.json`, adds the `readReferencedMcp` / `validateReferencePath`
readers on the resolver, introduces the `malformed mcp` closed-set REASON, and
wires the `narrowResolverNotes` classifier to emit it. The containment story is
solid: `validateReferencePath` runs `assertPathInside` (with its D-14 per-segment
symlink refusal) BEFORE any `stat`/`read`, so no input can read outside
`pluginRoot` (NFR-10 holds — the `../` traversal and symlink tests prove it). The
schema widening, the `entry.mcpServers ?? manifest.mcpServers` precedence in
`applyStrictMcp`, the wrapped-only vs. tolerant-standalone split, and the
`malformed mcp reference:` collision-proofing against the inline
`malformed mcpServers` note are all correct as described.

The defects are on the RENDER/classification side, not the read side. The most
serious is a cross-surface parity break: the new `malformed mcp` REASON is emitted
by the shared probe classifier (list/info/fetch) but the phase did NOT update the
mirror classifier `install.ts::narrowResolverReasons`, so `/claude:plugin install`
of a plugin with a broken string reference renders the WRONG reason token. This
directly violates the SURF-01 same-plugin-same-reason invariant the codebase
enforces everywhere else, and the parity test that is supposed to catch such drift
has no `malformed mcp` case.

## Critical Issues

### CR-01: `malformed mcp` REASON is never emitted on the install-failure surface (cross-surface parity break, SURF-01)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:2164-2245` (mirror classifier `narrowResolverReasons`); consumed at `install.ts:2066`

**Issue:** The phase added the `malformed mcp reference:` → `malformed mcp` arm to
the shared classifier (`shared/probe-classifiers.ts::classifyResolverNote:143`),
which is what `list` / `info` / `fetch` use. But `install.ts` carries its own
hand-mirrored classifier `narrowResolverReasons`, and it was NOT updated. Its
JSDoc (install.ts:2174-2181) explicitly requires the two classifiers stay "in
lockstep ... if a prefix is added or renamed on one side, the other side MUST
follow."

Trace a broken string reference through the install failure path: a broken ref
resolves `unavailable` with note `malformed mcp reference: ...`; `requireInstallable`
throws `PluginShapeError{ kind:"not-installable", reasons:r.notes }`;
`classifyEntityShapeError` (install.ts:2052-2066) calls
`narrowResolverReasons(err.shape.reasons, ...)`. Walking that function for each
broken-reference note:

- `malformed mcp reference: file not found: "x"` — matches no arm →
  `out.length===0` fallback → renders **`{unsupported source}`**.
- `malformed mcp reference: missing top-level "mcpServers": "x"` — no arm →
  **`{unsupported source}`**.
- `malformed mcp reference: escapes plugin root: "x"` — no arm →
  **`{unsupported source}`**.
- `malformed mcp reference: invalid JSON in "x": Unexpected token n ...` — hits the
  `reason.includes("Unexpected token")` arm (install.ts:2229) → renders
  **`{unparseable}`**.

Meanwhile `list`/`info` render **`{malformed mcp}`** for all four. Same on-disk
condition, different `{<reason>}` brace depending on which command the user runs —
exactly the invariant SURF-01 forbids. `/claude:plugin install` is a primary path,
and `{malformed mcp}` is the headline deliverable of this phase, so it is
effectively unreachable on the surface where the user most needs it.

The parity test does not catch this: `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`
`PARITY_CASES` has no `malformed mcp reference:` entry (verified — the array stops
at `contains lspServers` + a generic catch-all).

**Fix:** Add the mirror arm to `narrowResolverReasons` BEFORE the `includes("source")`
/ errno / `Unexpected token` fallbacks (order matters — the JSON variant must not
be pre-empted by the `Unexpected token` arm):

```ts
// install.ts::narrowResolverReasons, before the includes("source") arm:
if (reason.startsWith("malformed mcp reference")) {
  out.push("malformed mcp");
  continue;
}
```

Then add a parity case to lock it:

```ts
// cross-surface-reason-parity.test.ts PARITY_CASES:
{ note: 'malformed mcp reference: file not found: "x.mcp.json"', expected: "malformed mcp" },
```

## Warnings

### WR-01: `classifyResolverNote` arm order misclassifies a `malformed mcp` note whose path contains `lspServers` as `{lsp}`

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:129-148`

**Issue:** The arm order is (1) hooks prefixes, (2) `note.includes("lspServers")` →
`lsp`, (3) `note.startsWith("malformed mcp reference")` → `malformed mcp`,
(4) catch-all. Arm 2 is a loose substring match and runs BEFORE the specific
mcp-reference prefix arm. The reference notes embed the author-controlled raw path
verbatim, so a broken reference such as `mcpServers: "config/lspServers/servers.mcp.json"`
produces the note `malformed mcp reference: file not found: "config/lspServers/servers.mcp.json"`,
which contains the substring `lspServers` → classified as `{lsp}` instead of
`{malformed mcp}`. The `../lspServers/...` escape variant misclassifies the same
way. This is the exact substring-false-positive class the HOOK-04 `startsWith`
tightening was meant to eliminate, but the `lspServers` arm is still a bare
`includes`. The function's own comment claims the mcp arm is ordered before "the
permissive catch-all" — true, but it is NOT before the `lspServers` substring arm.

**Fix:** Move the `malformed mcp reference` (specific prefix) arm above the
`lspServers` (broad substring) arm, or tighten the lsp arm to a prefix check
(`note.startsWith("contains lspServers")`, matching the resolver's actual
`contains <kind>` note shape):

```ts
if (isHooksNote) return "unsupported hooks";
if (note.startsWith("malformed mcp reference")) return "malformed mcp";
if (note.includes("lspServers")) return "lsp";
return "unsupported source";
```

### WR-02: `applyLooseMcp` does not handle string `mcpServers` references — asymmetric with strict mode

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:1268-1292`

**Issue:** `applyStrictMcp` (resolver.ts:1213) branches on `typeof declaredMcp === "string"`
and reads the wrapped reference. `applyLooseMcp` has no such branch: a string
`entry.mcpServers` is handed straight to `applyMcpValue(partial, entryMcp, false)`
(resolver.ts:1291), which runs `MCP_SERVERS_VALIDATOR.Check` (object-only) against
the string, fails, and pushes a `malformed mcpServers` note → resolves
`unavailable`. So a legal string reference that installs fine in strict mode
resolves broken in loose mode (and with the wrong reason token,
`unsupported source`, not `malformed mcp`). The schema now accepts strings on the
entry for both modes, and loose mode already handles the inline-object form, so the
string form is an unhandled asymmetry.

`resolveLoose` currently has no production caller (verified — only `domain/index.ts`
re-exports it and the loose test suite exercises it), which is why this is a
Warning rather than a Blocker. But it is exported public API and a tested path, and
the gap will surface silently if/when loose mode is wired up.

**Fix:** Mirror the string branch from `applyStrictMcp` into `applyLooseMcp` (read
the wrapped reference via `readReferencedMcp`, then `applyMcpValue` for inline
parity), or, if loose-mode string refs are deliberately out of scope, add an
explicit rejection with a distinct reason and a test documenting the decision.

### WR-03: `readReferencedMcp` mislabels I/O/permission read failures as `invalid JSON`

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:984-999`

**Issue:** The `stat` guard (resolver.ts:980) rules out ENOENT, but the
`readFileText` call sits INSIDE the same `try` as `JSON.parse`, so a real read
failure on an existing-but-unreadable file (EACCES/EPERM) is caught and wrapped as
`malformed mcp reference: invalid JSON in "..."`. That is both a false message
(the file is not invalid JSON — it is unreadable) and it defeats truthful
classification: on the read surfaces (`list`/`info`) `narrowProbeError` would
otherwise map EACCES → `{permission denied}`, but here the resolver swallows the
`.code` into the `malformed mcp` bucket. This diverges from the deliberate WR-02
hooks treatment (`readStandaloneHooks`, resolver.ts:1044-1048), where read errors
are re-thrown unchanged precisely so the outer classifier can attribute them by
`.code`. (Note: it is consistent with the pre-existing `readStandaloneMcp`
wrapping, but a string reference is an author-explicit path, so the mislabel is
more misleading here.)

**Fix:** Read the file outside the `try`, or narrow the `catch` so only
`SyntaxError` (JSON parse) is wrapped and non-syntax I/O errors are re-thrown for
`.code`-based classification, mirroring `readStandaloneHooks`:

```ts
const raw = await readFileTextOf(ctx)(v.absPath); // let EACCES/EPERM propagate
try {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  ...
} catch (err) {
  if (!(err instanceof SyntaxError)) throw err;
  return { ok: false, reason: `malformed mcp reference: invalid JSON in "${raw}": ...` };
}
```

## Info

### IN-01: Test-coverage gaps for enumerated string-reference edges

**File:** `tests/domain/resolver-strict.test.ts` (MCPR block, lines 576-752) and
`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`

**Issue:** Three edges are unexercised:

1. **Absolute-path reference** — `validateReferencePath`'s `path.isAbsolute(raw)`
   reject arm (resolver.ts:940) has no test; MCPR-04 only covers `../` and symlink.
   This is a security-relevant branch and should be pinned.
2. **Wrapped reference whose INNER map is malformed** (e.g. `{ "mcpServers": [1,2,3] }`)
   — `readReferencedMcp` succeeds (wrapper present) and delegates to the inline
   `applyMcpValue`, which emits `malformed mcpServers` → classified as
   `{unsupported source}`, NOT `{malformed mcp}`. This behavior is defensible as
   "inline parity" per the code comment, but the reason-token divergence is subtle
   and untested; a test would document the intended boundary.
3. **`malformed mcp reference:` cross-surface parity case** — absent from
   `PARITY_CASES`; adding it is the concrete lock for CR-01.

**Fix:** Add the three tests. The parity case is required to prevent CR-01
regressing after the install-side fix.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
