---
phase: 112
slug: hook-runtime
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-08-31
verified: 2026-08-31T15:34:12Z
---

# Phase 112 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|---|---|---|
| Hook configuration → process spawn | Exec-form arguments must not enter shell interpretation; shell form remains explicit. | Commands, arguments, shell selection |
| Hook event → translated stdin | Untrusted event payloads must remain valid JSON and stay within the 256 KiB UTF-8 cap. | Session, tool, prompt, and lifecycle data |
| Child process → host runtime | Output, errors, exits, timers, and signals must settle once without leaks or unbounded buffering. | stdout, stderr, exit state, process IDs |
| Persisted PID table → process signaling | Only contained state paths and positively owned live processes may be signaled. | PID, start marker, plugin identity |
| Plugin declaration → filesystem | Hook paths, glob targets, staged files, and state files must remain within approved roots. | Paths, symlinks, staged hook files |
| Hook result → public event response | Only supported decisions and response fields may affect host behavior. | Decisions, content, errors, mutations |
| Reload boundary → live runtime state | Epoch, pending context, children, routes, and caches must reset in a safe order. | In-memory lifecycle state |

## Threat Register

All 40 authored threat rows are closed. Duplicate threat IDs remain plan-qualified because each plan owns a separate component-level threat.

| Plan | Threat ID | Category | Component | Severity | Disposition | Mitigation and Evidence | Status |
|---|---|---|---|---|---|---|---|
| 112-01 | T-112-02 | Tampering | PID-table persistence | high | mitigate | Hardcoded contained paths in `async-rewake/pid-table.ts`; scoped lifecycle and failure cases in `async-rewake/pid-table.test.ts`. | closed |
| 112-02 | T-112-03 | Denial of service / Elevation | Persisted-process reaping | high | mitigate | Liveness and exact Linux start-marker checks in `async-rewake/registry.ts`; ownership and soft-skip cases in its owner test. | closed |
| 112-02 | T-112-04 | Denial of service | Async child lifecycle | high | mitigate | Independent ring buffers, timer ladder, one-shot finalization, and cleanup in `async-rewake/registry.ts`; lifecycle cases in its owner test. | closed |
| 112-02 | T-112-05 | Information disclosure | Async environment and epochs | high | mitigate | Shared contained environment builder plus epoch discard and shutdown; precedence and lifecycle owner cases. | closed |
| 112-03 | T-112-04 | Denial of service | Ring buffer | high | mitigate | Fixed-cap chronological buffer; zero, exact, overflow, and oversized-write owner cases. | closed |
| 112-04 | T-112-01 | Tampering / Elevation | Synchronous spawn mode | high | mitigate | Args-present commands force `shell: false` through `planSpawn`; literal process-boundary owner case. | closed |
| 112-04 | T-112-04 | Denial of service | Synchronous child lifecycle | high | mitigate | Settlement latch, exact timer cancellation, listener removal, and escalation; terminal-ordering owner cases. | closed |
| 112-04 | T-112-05 | Information disclosure | Synchronous environment | high | mitigate | Environment preparation delegates to the contained shared builder; precedence and restoration owner cases. | closed |
| 112-05 | T-112-06 | Tampering | Hook decision reduction | high | mitigate | Ordered reducer and terminal handling; composition and terminal owner cases. | closed |
| 112-06 | T-112-06 | Tampering | Event result adaptation | high | mitigate | Object guards and `content`/`isError` whitelist; wrong-type and preservation owner cases. | closed |
| 112-07 | T-112-02 | Tampering / Disclosure | Hook routing paths | high | mitigate | Disabled refusal, contained hook paths, and branded roots; scope/refusal owner matrix. | closed |
| 112-07 | T-112-03 | Denial of service / Elevation | Reload process cleanup | high | mitigate | Reload shuts down in-memory children before persisted reaping; ownership and ordering proof. | closed |
| 112-07 | T-112-05 | Information disclosure / Tampering | Reload state reset | high | mitigate | Epoch bump, pending clear, settle reset, shutdown, and hydration ordering; full lifecycle owner case. | closed |
| 112-08 | T-112-N/A-08 | Tampering | Exec-result types | low | accept | Closed result discriminants and permission vocabulary are compiler- and runtime-proved. | closed |
| 112-09 | T-112-04 | Denial of service | Execution timers | high | mitigate | Clamped, unrefed SIGTERM/SIGKILL ladder with idempotent cancellation; deadline and race owner cases. | closed |
| 112-10 | T-112-05 | Information disclosure / Tampering | Hook environment | high | mitigate | Contained paths and authoritative session precedence; presence, absence, inheritance, and restoration cases. | closed |
| 112-11 | T-112-01 | Tampering / Elevation | Bash `if` parser | high | mitigate | Pure parsing and matching without subprocess execution; literal, recursion, wrapper, and fail-open cases. | closed |
| 112-12 | T-112-02 | Tampering / Information disclosure | Glob `if` evaluator | high | mitigate | Normalized bases and outside-base refusal; sibling-prefix, containment, and globstar cases. | closed |
| 112-13 | T-112-01 | Tampering / Elevation | Composite Bash predicates | high | mitigate | Bash strings are parsed and matched without execution; recursion and fail-open cases. | closed |
| 112-13 | T-112-02 | Tampering / Disclosure | Composite tool/glob predicates | high | mitigate | Tool membership, cwd fallback, target resolution, and contained glob evaluation; complete matrix. | closed |
| 112-14 | T-112-N/A-14 | Information disclosure | Hook barrel | low | accept | Exactly seven public exports and 22 compiler-negative private-symbol checks. | closed |
| 112-15 | T-112-NA-15 | Tampering | PostCompact payload | low | accept | Fixed translator with exact whole-object and empty-value owner cases. | closed |
| 112-16 | T-112-06 | Tampering | PostToolUseFailure payload | high | mitigate | Fixed envelope, identity, and non-mutation owner cases. | closed |
| 112-17 | T-112-06 | Tampering | PostToolUse payload | high | mitigate | Exact mapping and source non-mutation owner cases. | closed |
| 112-18 | T-112-NA-18 | Tampering | PreCompact payload | low | accept | Exact five-key envelope and empty-value owner cases. | closed |
| 112-19 | T-112-06 | Tampering | PreToolUse payload | high | mitigate | Exact envelope and tool-input identity owner cases. | closed |
| 112-20 | T-112-05 | Spoofing | SessionEnd payload | high | mitigate | Reason, identity, path, and empty-context owner matrix. | closed |
| 112-21 | T-112-05 | Spoofing | SessionStart payload | high | mitigate | Source and case-local identity owner matrix. | closed |
| 112-22 | T-112-06 | Tampering | StopFailure payload | high | mitigate | Fixed envelope and ordered bounded classifier; precedence and status-boundary owner cases. | closed |
| 112-23 | T-112-05 | Spoofing | Stop payload | high | mitigate | Identity/context envelope with active, inactive, and empty-value cases. | closed |
| 112-24 | T-112-NA-24 | Tampering | UserPromptSubmit payload | low | accept | Exact key set plus empty and multibyte text preservation. | closed |
| 112-25 | T-112-05 | Spoofing | Routing-state reset | high | mitigate | Composite reset clears epoch, cache, routes, and pending context; public-state owner proof. | closed |
| 112-26 | T-112-05 | Spoofing | Settle lifecycle | high | mitigate | Reset, entry/post-await epoch guards, one-shot cache, and shared cap; lifecycle owner cases. | closed |
| 112-26 | T-112-06 | Tampering | Settle response delivery | high | mitigate | Exact rendering, stop precedence, bounded re-entry, and observation-only failure delivery; owner cases. | closed |
| 112-27 | T-112-01 | Elevation of Privilege | Spawn planning | high | mitigate | Exec/shell separation in `spawn-helpers.ts`; args-present, empty-args, default-shell, and explicit-shell cases. | closed |
| 112-27 | T-112-04 | Denial of service | Bounded serialization | high | mitigate | Commit `9bfe1a8b` bounds final object, array, primitive, and multibyte JSON to 256 KiB with authoritative metadata; both dispatch lanes share the helper; direct coverage is 48/48 branches, 15/15 functions, and 223/223 lines. | closed |
| 112-28 | T-112-02 | Elevation of Privilege | Hook staging | high | mitigate | `lstat`, `realpath`, safe-name validation, and contained write/remove; direct and buried escape cases. | closed |
| 112-29 | T-112-04 | Denial of service | Timeout selection | high | mitigate | Finite-positive validation, safe event/lane defaults, and timer-API clamping; partition owner cases. | closed |
| 112-30 | T-112-05 | Spoofing | Translation context | high | mitigate | Per-dispatch session and path snapshot; exact and in-memory-session owner cases. | closed |
| 112-31 | T-112-06 | Tampering | Wire protocol | high | mitigate | Malformed-input containment, fixed precedence, typed omission, and four-field mutation builder; exhaustive owner cases. | closed |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---|---|---|---|---|
| AR-112-01 | 112-08 / T-112-N/A-08 | Closed TypeScript discriminants and compiler-negative evidence constrain the type-only surface. | Phase 112 authored plan | 2026-08-31 |
| AR-112-02 | 112-14 / T-112-N/A-14 | The barrel exposes only the seven intentional runtime bindings; private symbols are compiler-negative. | Phase 112 authored plan | 2026-08-31 |
| AR-112-03 | 112-15 / T-112-NA-15 | The fixed PostCompact translator has exact whole-object proof and no additional trust boundary. | Phase 112 authored plan | 2026-08-31 |
| AR-112-04 | 112-18 / T-112-NA-18 | The fixed PreCompact translator has exact five-key proof and no additional trust boundary. | Phase 112 authored plan | 2026-08-31 |
| AR-112-05 | 112-24 / T-112-NA-24 | The fixed UserPromptSubmit translator has exact key, text, and encoding proof. | Phase 112 authored plan | 2026-08-31 |

## Post-review Security Fixes

| Fix | Evidence | Status |
|---|---|---|
| Close-safe late stdio | Finalization waits for owned stdout and stderr with a close fallback; late-stdio regression passes. | closed |
| Rejection-safe serialized PID persistence | Success/rejection continuations preserve the queue and terminal failures are contained; regression cases pass. | closed |
| Bounded PID-table waits | Test polling has a two-second deadline and 1,000-iteration ceiling. | closed |
| No-PID asynchronous error containment | Error listener is installed before kill/return and removed on close; host-error regression passes. | closed |
| Strict stdin serialization cap | Commit `9bfe1a8b` eliminates the previously permitted unbounded metadata overshoot. | closed |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|---|---:|---:|---:|---|
| 2026-08-31 | 40 | 39 | 1 | `gsd-security-auditor` — initial ASVS Level 1 audit |
| 2026-08-31 | 40 | 40 | 0 | `gsd-security-auditor` — post-remediation re-audit |

Fresh post-remediation evidence:

- `node --test tests/bridges/hooks/spawn-helpers.test.ts` — passed.
- Direct owner coverage — 48/48 branches, 15/15 functions, and 223/223 lines.
- `node --test tests/bridges/hooks/dispatch-exec.test.ts` — passed.
- `node --test tests/bridges/hooks/async-rewake/registry.test.ts` — passed.
- `npm run typecheck` — passed.
- No unregistered threat flags were found.

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are documented in the Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-08-31
