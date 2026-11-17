# Phase 9: Adapter Entries and MCP Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 09-adapter-entries-and-mcp-features
**Areas discussed:** Stdio lifecycle, Fields the user wrote, Powers the adapter gives a plugin server, Features beyond tools
**Mode:** autonomous smart discuss. The user told this run to proceed without asking, and to decide decisions 5 and 20 by upstream parity and the pi-mcp-adapter version the suites install (7.0.1). Each such answer is marked **pending maintainer review**.

---

## Stdio lifecycle (PG-MCP-06)

### Q1 (decision 5): What lifecycle does a stdio plugin server's adapter entry get?

| Option | Description | Selected |
|--------|-------------|----------|
| `lazy-keep-alive` | Starts on first use, then stays for the session. The PRD's proposal. | ✓ |
| `keep-alive` | Starts at every session start and stays. Closest to upstream's start time, but starts every plugin server in every session. | |
| Keep ANAME-05 (`lazy`) | No change; PG-MCP-06 moves to Out of Scope. | |

**Choice:** `lazy-keep-alive`. **Pending maintainer review.**
**Notes:** Upstream keeps a stdio plugin server connected for the session. Checked against pi-mcp-adapter 7.0.1 (`init.ts:349-350`, `docs/servers.md:49`). Amends ANAME-05.

### Q2 (reversible): What do remote servers get?

Decided autonomously: nothing; the adapter default `lazy` applies, which matches upstream's `cached` state.

### Q3 (reversible): How do the user's value and an earlier install behave?

Decided autonomously: as the D-PG1-11..13 timeout does. The user's carried `lifecycle` wins; the marker records the default so a restage recomputes it; existing installs get it at the next restage.

---

## Fields the user wrote (PG-MCP-09)

### Q1 (reversible): Which fields join the carried set?

Decided autonomously: `protocolVersion`, `tasks`, `exposeResources`, `caFile`, as the requirement names.

### Q2 (security): Does a user's `caFile` survive a change of the plugin's `url`?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always carried | A CA bundle replaces the default roots for that entry; with a new origin it can only refuse the connection. | ✓ |
| Drop it when the url changes | Needs a url comparison in the carry step. | |

**Choice:** Always carried. Fails closed.

### Q3 (reversible): Write `protocolVersion: "auto"` by default?

Decided autonomously: no. Deferred.

---

## Powers the adapter gives a plugin server (PG-SEC-03)

### Q1 (decision 20, UI): Withhold the MCP UI extension?

| Option | Description | Selected |
|--------|-------------|----------|
| Write `openUi: false` | Per-server field in adapter 7.0.1. Claude Code 2.1.323 CLI declares the UI extension only under a host application. | ✓ |
| Record the divergence | Keep the adapter default. | |

**Choice:** Write `openUi: false`, user's value wins. **Pending maintainer review.**

### Q2 (decision 20, sampling): Withhold `sampling`?

| Option | Description | Selected |
|--------|-------------|----------|
| Record the divergence | Adapter 7.0.1 has only the global `settings.sampling`; draft a per-server request upstream. | ✓ |
| Write `settings.sampling: false` | Removes sampling from every server, the user's own included; this project does not own `settings`. | |

**Choice:** Record the divergence (D-PG9-08). **Pending maintainer review.**
**Notes:** Claude Code 2.1.323 declares no sampling capability. Adapter mitigations: per-request confirmation in UI sessions; off without UI unless `samplingAutoApprove`.

---

## Features beyond tools (PG-MCP-08)

### Q1 (reversible): How are unproven cells shown?

Decided autonomously: every cell names its evidence; a cell no scenario or run backs says "unmeasured" and names its source.

### Q2 (reversible): What do the two resource scenarios prove?

Decided autonomously: they are regression guards and are expected to pass on today's code; VALIDATION says so.

---

## the agent's Discretion

Marker type names, where the defaults live, the stub resource's URI and text, scenario wording, plan splits.

## Deferred Ideas

`protocolVersion: "auto"` default; prompt hint at install; per-server sampling once the adapter ships it; bare elicitation; `keep-alive`.
