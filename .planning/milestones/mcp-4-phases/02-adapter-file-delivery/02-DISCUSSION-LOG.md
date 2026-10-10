# Phase 2: Adapter-file delivery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-02
**Phase:** 02-adapter-file-delivery
**Areas discussed:** Carry-over fields, Comment warning, Override stubs on uninstall

---

## Carry-over fields (AFILE-06)

| Option | Description | Selected |
|--------|-------------|----------|
| User set, we own 2 | Carry `disabled`, `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `debug`, `searchKeywords`; always rewrite `directTools`/`toolPrefix` | ✓ |
| Also keep changed stamps | Same, plus `directTools`/`toolPrefix` when they differ from the previous entry | |
| Only `disabled` | Smallest set | |

**Notes:** The first ask came back unanswered and was re-asked once.

---

## Comment warning (AFILE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Each rewrite of a commented file | Warn when read bytes had comments and we rewrite; no persisted state | ✓ |
| Plus a .bak first | Also save `mcp-adapter.json.bak` before the first rewrite | |

---

## Override stubs on uninstall

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it | Uninstall removes only marked entries | ✓ |
| Remove matching stubs | Also delete transport-less stubs on our names | |

---

## Claude's Discretion

- Module split for the JSONC reader and entry handling; warning wording; JSONC parse implementation.

## Deferred Ideas

None.
