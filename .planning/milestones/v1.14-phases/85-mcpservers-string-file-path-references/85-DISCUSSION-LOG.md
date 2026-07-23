# Phase 85: `mcpServers` string file-path references - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 85-mcpservers-string-file-path-references
**Areas discussed:** Path validation, Reason token, Resolution mode

---

## Path validation

| Option | Description | Selected |
|--------|-------------|----------|
| Any relative (reuse `validateComponentPath`) | Reject absolute, then `path.resolve(pluginRoot, str)` + `assertPathInside` (D-14 symlink refusal). Accepts `./x.mcp.json` and `config/x.mcp.json` alike. | ✓ |
| Require literal `./` prefix | Only `./`-prefixed strings resolve; bare relative degrades as malformed. Matches Claude's literal doc wording but stricter than the repo's five sibling path fields. | |

**User's choice:** Reuse `validateComponentPath` (semantic containment parity).
**Notes:** User asked to follow Claude's spec; live docs
(`code.claude.com/docs/en/plugins-reference`) say "all paths must be relative to
the plugin root and start with `./`" and forbid escaping the plugin root. We take
*semantic* (containment) parity — the security-critical rule — and keep the repo's
existing leniency on the `./` prefix (consistent with skills/commands/agents/
hooks/lspServers). Documented as a deliberate divergence.

---

## Reason token

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `{unsupported source}` | The current catch-all for a malformed inline `mcpServers`. Zero catalog change. | |
| New `{unresolved mcp reference}` (unsupported-family) | A distinct token, initially proposed inside the unsupported family. | |
| New `{malformed mcp}` (failure-class) | A failure-class token naming the malformation, parallel to `{invalid manifest}`. | ✓ |

**User's choice:** New failure-class token, wording **`malformed mcp`**.
**Notes:** User observed that `unsupported hooks` / `lsp` / `unsupported source`
denote *well-formed but unsupported KINDS*, and probed "what do we do if an lsp
definition is malformed?" — confirmed in code that `lspServers` is an unsupported
kind whose content is never parsed, so malformedness is a non-concept there.
`mcpServers` is a *supported* feature, so a broken reference is a malformation, not
an unsupported kind → it belongs with the failure family. Umbrella token over all
four failure modes; specific cause in `notes[]`. Inline malformed `mcpServers`
left as-is. User also asked to file a backlog item to unify all parse errors under
a "malformed X" family → filed as REASON-01 in `.planning/BACKLOG.md`.

---

## Resolution mode

| Option | Description | Selected |
|--------|-------------|----------|
| Strict mode only (`applyStrictMcp`) | `resolveLoose` is exported but has no wired dispatch caller — all real resolution runs through `resolveStrict`. Matches the roadmap goal. | ✓ |
| Both strict and loose | Add the same resolution to `applyLooseMcp` for symmetry, though loose mode is unreachable at runtime. | |

**User's choice:** Strict-only (captured as the recommended default; not contested).
**Notes:** No speculative work on unreachable code.

## Claude's Discretion

- Reader factoring (separate `readReferencedMcp` vs. a wrapped-only flag on `readStandaloneMcp`).
- Exact `notes[]` wording per failure sub-case.
- Which exported reason group `{malformed mcp}` is filed under (subject to failure-class intent).

## Deferred Ideas

- **REASON-01** (`.planning/BACKLOG.md`): unify malformed-input failures under a
  `{malformed <feature>}` family; reroute inline malformed `mcpServers` and
  malformed `hooks.json` off the "unsupported" tokens.
- **MCPR-F1** (REQUIREMENTS Future): `plugin.json` `mcpServers` array form.
