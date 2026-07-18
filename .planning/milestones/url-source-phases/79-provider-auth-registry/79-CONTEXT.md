# Phase 79: Provider-auth registry - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A Pi user can clone public repos from any host without authentication, authenticate
against private/self-hosted hosts that have a registered provider, and receive a
clean actionable error for hosts with no provider — all with no credential ever
leaking into output.

In scope: the `GitAuthProvider` registry (PROV-01), unauthenticated public-host
passthrough (PROV-02), provider-flow auth + host-keyed credential storage on both
the marketplace clone path and the plugin clone-cache path (PROV-03), the
no-provider actionable failure (PROV-04), and the no-credential-leak architecture
gate covering every provider file (PROV-05).

Out of scope (v2): GitLab provider implementation (PROV-06 — the registry is merely
config-SHAPED for it), per-source explicit provider declarations for enterprise
hosts (PROV-07), SSH URLs, any user-editable provider config surface.

</domain>

<decisions>
## Implementation Decisions

### Plugin-install auth UX (PROV-03)
- **D-79-01:** A 401/403 on a provider-registered host during a git-source plugin
  clone AUTO-runs that provider's flow inline (parity with marketplace add on
  github.com), stores the credential host-keyed, and retries the clone ONCE.
- **D-79-02:** Within a single command invocation (including bulk installs), the
  provider flow runs AT MOST ONCE PER HOST. Subsequent clones in the same command
  reuse the fresh credential; if one still 401s, that item fails with the existing
  `authentication required` reason — no second prompt, no retry loop.

### No-provider failure (PROV-04)
- **D-79-03 (amended during execution, user decision 2026-07-11):** The row reason
  stays the existing closed-set token `authentication required` — NO new REASONS
  token. The cause line `no auth provider is registered for <host>` renders ONLY
  where the grammar already supports cause chains (the update path's synthetic
  failed-plugin child row). The marketplace `add` failure path shows the bare
  `(failed) {authentication required}` row with NO cause line — add's
  no-child-rows invariant (D-01/D-10) is preserved (Option C at the 79-02
  checkpoint). No supported-hosts list. Fail-clean, no isomorphic-git retry loop.

### Registry shape (PROV-01 / PROV-06-readiness)
- **D-79-04:** Providers are in-code data descriptors — plain constants carrying
  id, host match, device-flow endpoints, client_id, scope, and credential mapping —
  consumed by ONE generic device-flow engine. The GitHub descriptor parameterizes
  the existing RFC-8628 machine with byte-identical github.com behavior (success
  criterion 1). GitLab v2 = add one descriptor. NO user-editable provider config in
  v1 (no new persistence surface, no schema/migration burden).

### Expired-credential rotation (PROV-03)
- **D-79-05:** Stored credential + still-401 ⇒ `reject(host, old)` → run provider
  flow → `approve(host, new)` → retry the clone once. Generalizes the existing
  CredentialOps rotation discipline host-keyed; parity with current github
  marketplace behavior. A second 401 after the fresh credential fails clean.

### Claude's Discretion
- Seam placement for the registry (likely domain tier beside github-auth.ts, with
  orchestrator-tier wiring) and how the plugin clone-cache path (clone-cache.ts)
  receives the auth hook — respect the no-orchestrator-network gate boundaries.
- Byte-identical github verification mechanics (existing device-flow tests must
  stay green unchanged; add an explicit parity test if cheap).
- The no-credential-leak gate extension pattern (`tests/architecture/
  no-credential-leak.test.ts` must cover every provider file — follow its existing
  coverage rules).
- Host extraction/matching mechanics (exact-host match for v1; github.com only).
- Public-host passthrough shape (PROV-02): no provider lookup unless the clone
  actually challenges with 401/403 — public repos on ANY host never touch auth.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase definition
- `.planning/workstreams/url-source/ROADMAP.md` — Phase 79 goal + success criteria
- `.planning/workstreams/url-source/REQUIREMENTS.md` — PROV-01..05 texts; PROV-06/07
  v2 deferrals; out-of-scope table

### Prior phase decisions this phase builds on
- `.planning/workstreams/url-source/phases/76-marketplace-git-url-sources/76-CONTEXT.md`
  — D-76-07 (public url clones carry no auth bundle), D-76-08 (`authentication
  required` classification)
- `.planning/workstreams/url-source/phases/77-plugin-clone-cache-install/77-CONTEXT.md`
  — D-77-06 (github-object plugins public-only THIS far; Phase 79 wires providers
  into that single seam)
- `.planning/workstreams/url-source/phases/78-plugin-git-source-lifecycle/78-RESEARCH.md`
  — network-gate map (which orchestrators may touch gitOps)

### Authority spec
- `docs/prd/pi-claude-marketplace-prd.md` — AUTH requirements lineage, NFR-5 network
  policy, IL-2 output channel (credential leak surface)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `domain/github-auth.ts` — the RFC-8628 device-flow state machine
  (`initiateDeviceFlow`, `DeviceFlowHttp`, `DEFAULT_DEVICE_FLOW_HTTP`,
  `DeviceFlowResult`). The generic engine already exists; Phase 79 parameterizes
  its endpoints/client_id/scope via provider descriptors.
- `platform/git-credential.ts` — `CredentialOps` is ALREADY host-keyed
  (fill/approve/reject all take a host string; attribute block builds
  `protocol=https` + `host=<host>`). PROV-03's storage requirement is mostly
  satisfied — callers just stop hardcoding "github.com".
- `orchestrators/marketplace/add.ts` (:262) — the HttpError 401/403 →
  `authentication required` classification; the existing device-flow trigger
  wiring to generalize.
- `orchestrators/plugin/clone-cache.ts` — `materializePluginClone` — the single
  plugin-side seam that gains the auth hook (D-77-06 planned exactly this).
- `platform/git.ts` — `CloneOptions.auth` (optional; absent = public).

### Established Patterns
- Duck-typed HttpError detection at orchestrator boundary (D-13).
- Closed-set REASONS tokens; cause chains carry detail lines (SNM-10 grammar).
- Architecture gates grep comment-stripped source (no-orchestrator-network
  precedent) — the no-credential-leak gate presumably similar; extend coverage
  to every new provider file.
- Injection bundles/seams for cross-gate calls (InstallCloneCacheSeam precedent).

### Integration Points
- `orchestrators/marketplace/add.ts` / `update.ts` — replace direct
  `initiateDeviceFlow` + hardcoded github.com with registry lookup.
- `orchestrators/plugin/clone-cache.ts` + `install.ts`/`update.ts` plugin paths —
  auth hook threading (once-per-host memo lives at command scope, D-79-02).
- `tests/architecture/no-credential-leak.test.ts` — coverage list gains every
  provider file (PROV-05).

</code_context>

<specifics>
## Specific Ideas

- Success criterion 1 is BYTE-IDENTICAL github.com behavior — the GitHub descriptor
  must reproduce the current device-flow UX exactly (same prompts, same timing,
  same credential mapping). Existing device-flow tests keep passing unchanged.
- Once-per-host-per-command memo (D-79-02) prevents bulk-install prompt storms.

</specifics>

<deferred>
## Deferred Ideas

- GitLab provider descriptor (PROV-06, v2) — registry shape must admit it as pure
  data addition.
- Per-source provider declaration for enterprise hosts (PROV-07, v2).
- User-editable provider config (rejected for v1 per D-79-04).
- Supported-hosts list in the no-provider message (rejected per D-79-03 — terse
  single cause line).

</deferred>

---

*Phase: 79-provider-auth-registry*
*Context gathered: 2026-07-11*
