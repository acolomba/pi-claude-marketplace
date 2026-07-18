# Phase 79: Provider-auth registry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 79-provider-auth-registry
**Areas discussed:** Plugin-install auth UX (PROV-03), No-provider error wording (PROV-04), Registry config shape (PROV-01/06), Expired-credential rotation (PROV-03)

---

## Plugin-install auth UX (PROV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-run, once per host | 401 triggers the device flow inline (marketplace-add parity); at most one flow per host per command; bulk installs reuse the fresh credential | ✓ |
| Fail first, auth on retry | No surprise prompts mid-bulk, but diverges from established github UX | |

**User's choice:** Auto-run, once per host

---

## No-provider error wording (PROV-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Host + no-provider + supported list | Two cause lines including `(supported: github.com)` | |
| Host + no-provider only | One cause line: `no auth provider is registered for <host>` | ✓ |

**User's choice:** Host + no-provider only — terser single line; row reason stays `authentication required`.

---

## Registry config shape (PROV-01/06)

| Option | Description | Selected |
|--------|-------------|----------|
| In-code data descriptors | Plain constants (id, host match, endpoints, client_id, scope, credential mapping) + one generic engine; GitLab v2 = one descriptor; no user config in v1 | ✓ |
| User-editable config now | Self-hosted hosts without a release, but schema/containment/migration burden a version early | |

**User's choice:** In-code data descriptors

---

## Expired-credential rotation (PROV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-rotate via provider flow | reject(old) → flow → approve(new) → one retry; second 401 fails clean | ✓ |
| Fail and require explicit re-auth | Predictable but routine expiry becomes a two-step chore | |

**User's choice:** Auto-rotate via provider flow

---

## Claude's Discretion

- Registry seam placement + clone-cache auth hook threading (respect network gates)
- Byte-identical github wrap verification mechanics
- no-credential-leak gate extension pattern
- Host matching mechanics (exact match, github.com only in v1)
- Public passthrough shape (no provider lookup unless 401/403 challenge)

## Deferred Ideas

- GitLab descriptor (PROV-06 v2); per-source provider declaration (PROV-07 v2)
- User-editable provider config (rejected v1)
- Supported-hosts list in no-provider message (rejected — terse form chosen)
