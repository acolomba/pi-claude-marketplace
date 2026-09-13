# Phase 4: Hermetic Test Infrastructure - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 makes the confirmed test infrastructure isolated, typed, and faithful
to production collaborators. It implements only the terminal Phase 1 work
routed to `AUTH-01`, `TREF-01`, `TREF-02`, or `TREF-03` by the active scope
changes in `01-REVALIDATION.json`.

This phase covers case-owned temporary user state, faithful function-bearing
external-failure doubles, hostile-host and optional-collaborator auth coverage,
typed production values, and role-named doubles. It does not authorize
production test seams, unrelated fake-family rewrites, enable/disable product
refactors, or Phase 7 gate-integrity work.

</domain>

<decisions>
## Implementation Decisions

### Scope authority and sequencing

- **D-01:** Derive the work inventory from the active Phase 4 scope changes and
  terminal finding records in `01-REVALIDATION.json`. Historical review files
  provide provenance only and cannot revive struck, superseded, evidence-only,
  or differently routed work.
- **D-02:** Keep every correction in the owning test-support module or test
  suite. Production APIs and production behavior remain unchanged unless a
  terminal Phase 4 record explicitly requires otherwise.
- **D-03:** Prove the infrastructure correction through the affected owner
  tests, then run the repository's full quality and test gates. Do not mix this
  work with later coverage, unused-member, or module-size cleanup.

### Hermetic filesystem and environment boundaries (`TREF-01`)

- **D-04:** Give every affected test case a unique temporary root. Any path that
  can resolve user-scoped state must point at a case-owned directory and must
  never inspect the developer's real home, Pi agent directory, or MCP config.
- **D-05:** Pin `PI_CODING_AGENT_DIR` explicitly because it has precedence over
  `HOME`. Where the production path can also consult the operating-system home,
  pin both inputs beneath the same temporary root.
- **D-06:** Snapshot whether each environment variable existed and its exact
  value. Restore it through `t.after` or an equivalent guaranteed cleanup path,
  deleting a variable that was originally absent rather than assigning an
  artificial value.
- **D-07:** Prefer a small test-owned helper only where multiple affected suites
  genuinely share the same boundary. Do not add a production-only switch,
  export, path override, or global bootstrap mutation for test isolation.
- **D-08:** Preserve project-scope semantics while isolating effective MCP
  lookups. Project tests may use their case-owned `cwd`, but they must also
  neutralize every higher-precedence user location the production lookup can
  merge.

### Function-bearing collaborator snapshots (`TREF-02`)

- **D-09:** Make the shared Git operations fake accept and record the real
  `GitAuthBundle`, including callback functions. A valid production collaborator
  must never fail merely because a generic snapshot mechanism cannot clone a
  function.
- **D-10:** Record call options with an explicit, typed snapshot. Copy data-only
  fields as needed while retaining the auth bundle and its callbacks as usable
  values. Tests must be able to inspect callback identity and invoke the
  recorded collaborator.
- **D-11:** Remove caller-side adapters that strip `auth`, call the fake, and
  reattach or separately observe it. The shared double owns the faithful call
  contract once, and consumers use it directly.
- **D-12:** Preserve the fake's existing offline and fail-closed behavior, fresh
  per-case state, call ordering, and public result contract. Do not serialize,
  stringify, erase, or replace function-bearing inputs for convenience.

### Authentication behavior (`AUTH-01`)

- **D-13:** Prove exact provider-host matching with independently authored
  hostile neighbors. Include prefixed, suffixed, and subdomain-shaped strings
  around both supported hosts; none may select a provider.
- **D-14:** Preserve the installed production policy for case, ports, and URL
  parsing. Tests assert that policy from public auth-host behavior rather than
  broadening host matching to make fixtures pass.
- **D-15:** Exercise the optional device-flow HTTP collaborator through the
  production auth-building path. Prove both the explicitly injected function
  and the omitted/default path without deriving the expected value from the
  fixture under test.
- **D-16:** Model realistic auth failure by invoking the function-bearing
  callback through the shared fake or recorded production-shaped bundle.
  Assert the original error and relevant credential interactions, with network
  work prevented by injected collaborators.

### Typed values and role-named doubles (`TREF-02`, `TREF-03`)

- **D-17:** Rename exactly the 16 traced factory definitions selected by
  `MF-DEC-08`: nine `makeMockGitOps`, four `makeMockCredentialOps`, and three
  `makeMockDeviceFlowHttp` definitions across the ten terminally traced files.
  Use names that describe the collaborator's role or configured behavior, not
  whether it is a mock, fake, or test helper.
- **D-18:** Leave `makeMockPi` and unrelated `Fake` families unchanged. A naming
  pattern elsewhere in the repository is not authority to expand this phase.
- **D-19:** Replace broad assertions such as fabricated
  `as ExtensionContext`/`as ExtensionAPI` values with typed builders,
  production-domain values, or a narrowly typed public dependency shape.
  Preserve runtime behavior and the exact observations each case needs.
- **D-20:** Remove only the traced test-shaped production comments, casts,
  mutable discriminators, and dishonest fixtures. Preserve real safety checks,
  public compatibility, and reachable failure handling; do not suppress the
  compiler or linter.
- **D-21:** Update `.planning/codebase/CONVENTIONS.md` to record role-based
  collaborator naming and the exception that established domain fakes may keep
  `Fake` when the type itself is the intentional reusable abstraction.

### the agent's Discretion

- Choose exact helper and collaborator names, provided each name expresses a
  role or configured behavior and the 16-definition boundary remains exact.
- Choose whether the typed auth-bearing snapshot is shallow, selectively deep,
  or readonly, provided callback identity and invocation remain observable and
  mutable input cannot corrupt unrelated call records.
- Choose local helper placement and implementation order to minimize overlap
  across the affected test suites.
- Add narrowly necessary regression cases discovered while implementing a
  terminal record, but do not use incidental cleanup to broaden phase scope.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Active scope and evidence authority

- `.planning/ROADMAP.md` § Phase 4 — phase goal, boundary, dependencies, and
  success criteria.
- `.planning/REQUIREMENTS.md` § Authentication and Test Infrastructure —
  authoritative `AUTH-01`, `TREF-01`, `TREF-02`, and `TREF-03` requirements.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` —
  canonical terminal findings, source/test references, scope changes, and
  resolved decisions, especially `SCOPE-REQ-AUTH-01`, `SCOPE-REQ-TREF-01`,
  `SCOPE-REQ-TREF-02`, `SCOPE-REQ-TREF-03`, and `SCOPE-ROUTE-PHASE-04`.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` —
  interpretation rules for terminal status, routes, and scope changes.
- `.planning/phases/01-live-evidence-revalidation/01-CONTEXT.md` — evidence
  authority, direct-owner regression, and hermetic-probe constraints.
- `.planning/phases/03-production-defect-corrections/03-CONTEXT.md` — prior
  production-first sequencing and trace-preserving removal rules.

### Historical finding dossiers

- `.planning/reviews/unit-test-adversarial/adversarial/domain-core.md` — exact
  auth-provider host matching and hostile-neighbor evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-root.md` —
  optional auth collaborator and realistic failure-path evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/platform.md` — shared Git
  fake function-cloning failure and production-shaped call requirements.
- `.planning/reviews/unit-test-adversarial/adversarial/bridges-mcp.md` — project
  MCP test escape into user-scoped state.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-list-uninstall-a.md`
  — hermetic user-home precedence evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-enable-fetch.md`
  — traced role naming and production-comment evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-marketplace-add-update-b.md`
  — marketplace collaborator naming and environment-isolation evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-a.md`
  — typed-value and install collaborator evidence.
- `.planning/reviews/unit-test-adversarial/META-FINDINGS.md` — `MF-004`,
  `MF-005`, and `MF-DEC-08` provenance; only Phase 4-routed portions apply.

### Current codebase guidance

- `.planning/codebase/TESTING.md` — direct-owner tests, real temporary
  filesystems, injected collaborators, restoration, and strong-mock patterns.
- `.planning/codebase/CONVENTIONS.md` — current naming and type conventions to
  refine after the selected role-name migration.
- `.planning/codebase/STRUCTURE.md` — module ownership and integration points.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `tests/orchestrators/scope-fanout.test.ts` already demonstrates a case-owned
  temporary agent directory with exact `PI_CODING_AGENT_DIR` restoration.
- `tests/platform/git-ops-fake.ts` is the shared strict Git collaborator whose
  call ledger already uses production `GitAuthBundle` types; only its generic
  function-hostile snapshot is unfaithful.
- `tests/platform/credential-ops-fake.ts` already preserves credential function
  contracts and call observations.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` owns URL-host
  extraction, provider selection, and optional device-flow collaborator wiring.
- `extensions/pi-claude-marketplace/domain/auth-registry.ts` owns exact GitHub
  and GitLab host predicates.

### Established Patterns

- Use public production interfaces, case-owned temporary filesystems, and
  injected doubles at external boundaries.
- Register environment restoration when the mutation is made, including the
  originally-absent case.
- Prefer strong typed doubles for interaction-heavy dependencies and real
  domain values for value-oriented inputs.
- Assert externally visible calls, state, bytes, and error identity instead of
  asserting helper implementation details.

### Integration Points

- Effective MCP server discovery combines project locations with user
  locations resolved from the Pi agent directory.
- User-scope plugin and marketplace paths resolve through
  `PI_CODING_AGENT_DIR` before home-derived fallbacks.
- Clone auth flows from URL host parsing through provider selection and
  credential callbacks into Git operation options.
- The shared Git fake's call ledger is consumed by plugin install and
  marketplace orchestration tests, including local wrappers that currently
  strip function-bearing auth.

</code_context>

<specifics>
## Specific Ideas

- Use visibly hostile hosts such as `evilgithub.com`, `github.com.evil`, and
  `api.github.com`, with equivalent GitLab neighbors, so equality bugs cannot be
  hidden by friendly fixtures.
- Invoke a recorded auth callback and compare the thrown object by identity;
  checking only that an `auth` key exists is not a realistic propagation test.
- Poison the ambient real-home path in hermetic tests where practical, then
  prove the operation reads only case-owned state.
- Keep environment helpers local to test infrastructure unless at least two
  affected suites need the identical contract.

</specifics>

<deferred>
## Deferred Ideas

- `MF-005` gate-audit and unused-member integrity work remains assigned to
  Phase 7.
- `OPEF-F12` and `OPEFR-F004` production enable/disable cleanup are outside the
  authoritative Phase 4 requirement routes.
- The unrelated unused type-member TODO remains deferred until its dedicated
  terminal finding or later gate phase.
- `makeMockPi` and other untraced fake families are excluded from the selected
  16-definition rename.
- General production module splitting remains assigned to Phase 6.

</deferred>

---

_Phase: 04-hermetic-test-infrastructure_
_Context gathered: 2026-09-07_
