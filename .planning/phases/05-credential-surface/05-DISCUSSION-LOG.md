# Phase 5: Credential Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-27
**Phase:** 05-credential-surface
**Areas discussed:** Device Flow (Q2), Migration notice (Q5), GitLab token expiry (Q5)

---

## Device Flow (Q2)

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | Upstream parity; delete the auth modules, threading, fetch exemption, feature and stand-in | ✓ |
| Keep as an explicit login | Recorded divergence; a separate login command that stores the token in the helper | |
| Keep the automatic retry | Today's D-SG-14 shape; largest divergence | |

**User's choice:** Remove it (D-SG-27).

---

## Migration notice (Q5)

| Option | Description | Selected |
|--------|-------------|----------|
| No notice; docs only | Parity; README, README.es and CHANGELOG explain the change and manual token removal | ✓ |
| One notice on first auth failure | Pi-only; marker file; shown to every user | |
| Notice on every auth failure | Overlaps Phase 6 | |

**User's choice:** No notice; docs only (D-SG-28).

---

## GitLab token expiry (Q5)

| Option | Description | Selected |
|--------|-------------|----------|
| Document it | README and CHANGELOG name `glab auth setup-git`, GCM, or an ssh key | ✓ |
| Nothing special | Covered by the general auth-failure message | |

**User's choice:** Document it (D-SG-29).

---

## Claude's Discretion

- Plan split and order; whether `auth-host.ts` survives; which Device Flow scenarios move to `credential.helper=store`.

## Deferred Ideas

- Auth-failure wording and hints: Phase 6.
