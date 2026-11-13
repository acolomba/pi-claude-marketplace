---
phase: "02"
slug: "hook-payloads-matchers-and-stop-limit"
status: verified
threats_open: 0
threats_open_nonblocking: 0
threats_total: 27
threats_closed: 27
asvs_level: 1
block_on: high
created: "2026-11-13"
---

# Phase 02 — Security

All 27 declared threats are closed: 19 high and 8 medium. The independent auditor inspected implementation and test evidence at `cff1fbc6`, then rechecked the documentation correction at `10750a0e`. This report does not claim a new full-suite run after that documentation correction; the phase gate follows code review.

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Plugin hook to native tool | Input decisions authorize one native operation | Untrusted JSON proposals and decisions |
| Native result to hook and model | Projection and replacement preserve provenance and clear stale output | Content, images, details and structured data |
| Pending hook to active runtime | Cancellation and reload invalidate stale operations | Generation and continuation state |
| Matcher to routing | Native regex and exact lists select canonical identities | Plugin patterns and tool names |
| Implementation to support claims | Documentation reflects measured contracts and limits | Compatibility claims and evidence |

## Threat Register

Paths without a prefix below are relative to `extensions/pi-claude-marketplace/bridges/hooks/`; `domain/` is relative to `extensions/pi-claude-marketplace/`. Test, feature and documentation paths are repository-relative. Detailed tests and behavioral commands are indexed in `02-VALIDATION.md` and each plan summary.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-02-01 | Tampering | input decoder and adapter | high | mitigate | tool-input.ts:214 validates shape and unsafe keys before decoding; event-adapters.ts:319 decodes before own-key replacement at :145. | closed |
| T-02-02 | Information disclosure | ignored-rewrite notice | high | mitigate | event-adapters.ts:339 emits fixed rejection categories; shared/notification-dispatch.ts:622 selects one transport; four-mode privacy tests and secret scenario pass. | closed |
| T-02-03 | Elevation of privilege | decision fold and adapter | high | mitigate | wire-protocol.ts:249 preserves denial; dispatch.ts:407 prioritizes stop/block; event-adapters.ts:313 resolves ask before decoding. | closed |
| T-02-SC | Tampering | package installation | high | mitigate | Auditor inspected all 41 exact task/correction commits: no package manifest or lockfile changes. Separately authorized quick 261113-8yn adopted verified published pi-subagents 0.88.1 outside Phase 2 scope. | closed |
| T-02-04 | Tampering | search decoder | high | mitigate | tool-input-search.ts:74,87,153,173 validates equivalent modes/context/caps and rebuilds a complete candidate; event-adapters.ts:319 applies all-or-original. | closed |
| T-02-05 | Spoofing | payload identity | medium | mitigate | tool-input.ts:72 uses native names; dispatch.ts:1329 retains recovered identity; all three payload translators and async registry share the mapper. | closed |
| T-02-06 | Elevation of privilege | batch decision | high | mitigate | dispatch.ts:979,986,997 selects any pair stop/block and rejected ask before batch decoding; real later-pair scenarios pass. | closed |
| T-02-07 | Tampering | batch input commit | high | mitigate | tool-batch.ts:121,154,158 compares every accepted and unchanged target before fallback; dispatch.ts:1001,1016 commits one decision. | closed |
| T-02-08 | Tampering | pending generation | high | mitigate | dispatch.ts:963,913,993 checks generation/cancellation after awaits and before synchronous commit; cancellation/reload regressions pass. | closed |
| T-02-09 | Tampering | result fan-out/fold | high | mitigate | dispatch.ts:1136 derives every pair from actual shared carriers; :1168 folds once in stable order; :425 validates against original event. | closed |
| T-02-10 | Tampering | async registry | high | mitigate | dispatch-exec.ts:185 returns noop for background execution; async-rewake/registry.ts:466,486,510 enforces once-only completion, generation checks and nonretroactive delivery. | closed |
| T-02-11 | Spoofing | failure event | medium | mitigate | dispatch.ts:1038,1097 preserves actual failure and cancellation; payloads/post-tool-use-failure.ts:49 emits real error; event-adapters.ts:470 does not mutate failed output. | closed |
| T-02-12 | Information disclosure | result patch | high | mitigate | tool-output-files.ts:29,96 replaces content and clears details/structured data; test/integration/hooks-result-boundary.test.ts:56,98 verifies downstream secret absence. | closed |
| T-02-13 | Tampering | file result decoder | high | mitigate | tool-output-files.ts:34,53,99,165,197 validates fields/images/hunks; :193,216 renders paths as data without file reads or execution. | closed |
| T-02-14 | Spoofing | available-fact projection | medium | mitigate | tool-result-files.ts:23,44,82 validates actual unified patches; :130,191 omits unsupported provenance and ambiguous counts; owner counterexamples pass. | closed |
| T-02-15 | Information disclosure | search/shell patch | high | mitigate | tool-output-search-shell.ts:206,216 replaces content and clears details/structured data, including intentional empties; downstream scenarios pass. | closed |
| T-02-16 | Tampering | output path handling | high | mitigate | tool-output-search-shell.ts:126,152,170 validates and renders metadata without I/O; owner :177 proves secret paths and URLs are not fetched. | closed |
| T-02-17 | Spoofing | display projection | medium | mitigate | tool-result-search-shell.ts:14,60,90,108 checks native notice evidence, omits ambiguous counts, and preserves combined shell output; collision counterexamples pass. | closed |
| T-02-18 | Spoofing | alias selector | high | mitigate | wire-protocol.ts:272 preserves both output fields; dispatch.ts:431,438 selects legacy only for recovered MCP identity and absent modern value; falsy/non-MCP cases pass. | closed |
| T-02-19 | Information disclosure | MCP patch | high | mitigate | event-adapters.ts:217 whitelists validated server/tool routing details; :266 replaces content and structured output; both-profile redaction/image scenarios pass. | closed |
| T-02-20 | Tampering | output fold | high | mitigate | dispatch.ts:425 validates ordered candidates against original and retains the last accepted patch; event-adapters.ts:183,470 constrains patch slots and failed output. | closed |
| T-02-21 | Tampering | matcher classification/routing | high | mitigate | domain/components/hooks/matcher.ts:4,56,71 classifies whole patterns; partition.ts:35,99 drops invalid groups; dispatch.ts:154 tests canonical identity; event-router.ts:397 ignores prompt/Stop matchers. | closed |
| T-02-22 | Denial of service | JavaScript regex | medium | mitigate | event-router.ts:397 compiles routing matchers once; domain/components/hooks/matcher.ts:63 uses native RegExp with no flags and catches syntax errors; dispatch.ts:161 reuses it. Native-regex complexity residual is retained under D-PG2-10. | closed |
| T-02-23 | Spoofing | recovered MCP name | medium | mitigate | dispatch.ts:1335 retains proxy exclusion; domain/components/hooks/builtin-mcp-tool-names.ts:66,165 validates fitted identity; mcp-tool-view.ts:47 checks loader provenance. | closed |
| T-02-24 | Denial of service | Stop counter | high | mitigate | runtime.ts:18,276 caps at eight and gives a terminal ninth transition; settle.ts:365 consumes bounded continuation; boundary and real nine-run checks pass. | closed |
| T-02-25 | Tampering | lifecycle reset | medium | mitigate | dispatch.ts:838,843 checks generation and resets at native entry; runtime.ts:186,191,290 separates budget/active flags; event-router.ts:1073 resets registration; settle.ts:342 rejects stale completions. | closed |
| T-02-26 | Spoofing | compatibility claims | medium | mitigate | docs/hooks-compatibility.md:148,398 corrected in 10750a0e and independently rechecked against matcher.ts:63, dispatch.ts:161 and partition.ts:37. Other divergence and evidence limits remain explicit. | closed |

## Accepted Risks Log

No new risk accepted by this audit. D-PG2-10 already records the native JavaScript regex complexity residual under T-02-22. Compile-once, finite tool-name inputs and syntax rejection mitigate the declared vector; they do not guarantee bounded execution for every valid pattern. See `02-08-SUMMARY.md` Threat Flags. No unregistered threat flags were found.

## Security Audit Trail

| Audit date | Threats total | Closed | Open blocking | Open nonblocking | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-11-13 | 27 | 26 | 0 | 1 | gsd-security-auditor: two contradictory current matcher claims under T-02-26 |
| 2026-11-13 | 27 | 27 | 0 | 0 | gsd-security-auditor: targeted recheck of 10750a0e |

## Sign-Off

- [x] Every threat has a declared disposition and implementation evidence.
- [x] Existing residual risk remains documented; no new acceptance inferred.
- [x] No blocking or nonblocking threat remains open.
- [x] `status: verified`; `threats_open: 0`.

**Approval:** verified 2026-11-13 by independent source audit and targeted recheck.
