# Phase 71: Partial Hook Force-Install - Discussion Log

> **Audit trail only.** Not consumed by downstream agents — decisions live in CONTEXT.md.

**Date:** 2026-06-28
**Phase:** 71-partial-hook-force-install
**Areas discussed:** scope/home, granularity, reason rendering, info detail, matcher-mix

**Origin:** Follow-up to the official-marketplace force-installability analysis. The only plugins with real partial value (skills/commands + hooks) are blocked `unavailable` solely by a non-bucket-A `Stop` hook. User wants those force-installable, installing only the supported hooks.

---

## Scope / home

| Option | Description | Selected |
|--------|-------------|----------|
| New phase in force-install | Phase 71; reopens the not-yet-closed milestone; defers v1.14 close. | ✓ |
| Separate next milestone | Close v1.14 first, do this as v1.15. | |
| Quick task | Too large (resolver + bridge + reasons + catalog). | |

**User's choice:** New phase in force-install.

---

## Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Event-level only | Drop whole unsupported events; matcher failures still -> unavailable. | |
| Event + matcher-level | Also drop unsupported matcher groups within a supported event. | ✓ |

**User's choice:** Event + matcher-level → D-71-01.

---

## Reason rendering (list row)

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate marker | Single `{unsupported hooks}` regardless of count; no closed-set change. | ✓ |
| Enumerate dropped events | `{unsupported hooks: Stop}`; expands byte catalog. | |

**User's choice:** Aggregate marker → D-71-04.

---

## info detail

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, list dropped handlers | info enumerates each dropped event/matcher (FSTAT-07 style). | ✓ |
| Aggregate only | info shows only the aggregate marker. | |

**User's choice:** Yes, list dropped handlers → D-71-05.

---

## Matcher mix within a supported event

| Option | Description | Selected |
|--------|-------------|----------|
| Install supported groups only | Drop only the unsupported matcher groups; event survives partially. | ✓ |
| Drop the whole event | Any bad group drops the whole event. | |

**User's choice:** Install supported groups only → D-71-02.

## Claude's Discretion

- Partition result type, where the filtered HooksConfig is produced/threaded (resolver vs bridge), info detail wording — deferred to research/planning.

## Deferred Ideas

- Expanding BUCKET_A_EVENTS to natively dispatch Stop/SubagentStop/Notification (would make these plugins fully installable, no --force) — separate concern.
