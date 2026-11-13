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

All 27 declared threats are closed: 19 high and 8 medium. The independent recheck at `e421cb3a61996f959922953912ed26ab0e2e38cd` supersedes the earlier audit conclusions. The earlier audit missed same-text structured-output retention, path-normalization failures, custom-tool identity confusion and remaining contradictory matcher prose. The code-review fixes and their regression assertions were independently inspected against current source. Unchanged mitigations retain their earlier source verification. The full-suite gate is separate.

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
| T-02-01 | Tampering | input decoder and adapter | high | mitigate | tool-input.ts:156 catches failed candidate file-URL normalization and returns ignored/value; event-adapters.ts:325 mutates only accepted input. Shape and unsafe-key validation remains. | closed |
| T-02-02 | Information disclosure | ignored-rewrite notice | high | mitigate | event-adapters.ts:330,352 reports only rejection categories; malformed Read/Write URL assertions at test/bridges/hooks/event-adapters.test.ts:244 prove no candidate-value disclosure. Four-mode single-transport checks remain. | closed |
| T-02-03 | Elevation of privilege | decision fold and adapter | high | mitigate | wire-protocol.ts:249 preserves denial; dispatch.ts:407 prioritizes stop/block; event-adapters.ts:313 resolves ask before decoding. | closed |
| T-02-SC | Tampering | package installation | high | mitigate | Auditor inspected all 48 exact task/correction commits: no package manifest or lockfile changes. The separately authorized pi-subagents 0.88.1 upgrade remains outside Phase 2 scope. | closed |
| T-02-04 | Tampering | search decoder | high | mitigate | tool-input-search.ts:74,87,153,173 validates equivalent modes/context/caps and rebuilds a complete candidate; event-adapters.ts:319 applies all-or-original. | closed |
| T-02-05 | Spoofing | payload identity | medium | mitigate | tool-input.ts:82 uses exact native identities; tool-result-files.ts:176 and tool-result-search-shell.ts:131 now do likewise; payloads/post-tool-use.ts:61 preserves generic custom schemas. | closed |
| T-02-06 | Elevation of privilege | batch decision | high | mitigate | dispatch.ts:979,986,997 selects any pair stop/block and rejected ask before batch decoding; real later-pair scenarios pass. | closed |
| T-02-07 | Tampering | batch input commit | high | mitigate | tool-batch.ts:121,154,158 compares every accepted and unchanged target before fallback; dispatch.ts:1001,1016 commits one decision. | closed |
| T-02-08 | Tampering | pending generation | high | mitigate | dispatch.ts:963,913,993 checks generation/cancellation after awaits and before synchronous commit; cancellation/reload regressions pass. | closed |
| T-02-09 | Tampering | result fan-out/fold | high | mitigate | dispatch.ts:1136 derives every pair from actual shared carriers; :1168 folds once in stable order; :425 validates against original event. | closed |
| T-02-10 | Tampering | async registry | high | mitigate | dispatch-exec.ts:185 returns noop for background execution; async-rewake/registry.ts:466,486,510 enforces once-only completion, generation checks and nonretroactive delivery. | closed |
| T-02-11 | Spoofing | failure event | medium | mitigate | dispatch.ts:1038,1097 preserves actual failure and cancellation; payloads/post-tool-use-failure.ts:49 emits real error; event-adapters.ts:470 does not mutate failed output. | closed |
| T-02-12 | Information disclosure | result patch | high | mitigate | event-adapters.ts:258 compares both content and structured content before no-op; :265 emits sanitized patches. Installed Pi runner.js:910,913,917 clears omitted structured output and replaces details; test/integration/hooks-result-boundary.test.ts:128 checks downstream and returned results. | closed |
| T-02-13 | Tampering | file result decoder | high | mitigate | File-output field/image/hunk validators remain; tool-output-files.ts:229 selects exact native identities so custom Read retains its generic schema. Output paths remain data only. | closed |
| T-02-14 | Spoofing | available-fact projection | medium | mitigate | tool-result-files.ts:130,191 retains conservative available-fact projection; exact discriminator at :176 preserves custom schemas. | closed |
| T-02-15 | Information disclosure | search/shell patch | high | mitigate | tool-output-search-shell.ts:197 selects exact native identities; :209,217 clears details for accepted replacements. Custom Bash uses generic replacement through event-adapters.ts:253. | closed |
| T-02-16 | Tampering | output path handling | high | mitigate | tool-output-search-shell.ts:126,152,170 validates and renders metadata without I/O; owner :177 proves secret paths and URLs are not fetched. | closed |
| T-02-17 | Spoofing | display projection | medium | mitigate | tool-result-search-shell.ts:87 normalizes the actual root through requestedPath before resolving filenames; tool-input.ts:22 implements native aliases. Ambiguity/truncation omissions remain at :75,83; home, at-prefix, file-URL and Unicode-space cases pass. | closed |
| T-02-18 | Spoofing | alias selector | high | mitigate | wire-protocol.ts:272 preserves both output fields; dispatch.ts:431,438 selects legacy only for recovered MCP identity and absent modern value; falsy/non-MCP cases pass. | closed |
| T-02-19 | Information disclosure | MCP patch | high | mitigate | event-adapters.ts:217 retains only validated MCP routing fields; :258 treats omitted old structured output as a change; :265 emits the clearing patch. Same-text MCP scenario passes under both profiles. | closed |
| T-02-20 | Tampering | output fold | high | mitigate | dispatch.ts:425 retains the ordered accepted-candidate fold. event-adapters.ts:258 no longer discards valid same-text redaction; failed output remains immutable. | closed |
| T-02-21 | Tampering | matcher classification/routing | high | mitigate | domain/components/hooks/matcher.ts:4,56,71 classifies whole patterns; partition.ts:35,99 drops invalid groups; dispatch.ts:154 tests canonical identity; event-router.ts:397 ignores prompt/Stop matchers. | closed |
| T-02-22 | Denial of service | JavaScript regex | medium | mitigate | event-router.ts:397 compiles routing matchers once; domain/components/hooks/matcher.ts:63 uses native RegExp with no flags and catches syntax errors; dispatch.ts:161 reuses it. Native-regex complexity residual is retained under D-PG2-10. | closed |
| T-02-23 | Spoofing | recovered MCP name | medium | mitigate | dispatch.ts:1335 retains proxy exclusion; domain/components/hooks/builtin-mcp-tool-names.ts:66,165 validates fitted identity; mcp-tool-view.ts:47 checks loader provenance. | closed |
| T-02-24 | Denial of service | Stop counter | high | mitigate | runtime.ts:18,276 caps at eight and gives a terminal ninth transition; settle.ts:365 consumes bounded continuation; boundary and real nine-run checks pass. | closed |
| T-02-25 | Tampering | lifecycle reset | medium | mitigate | dispatch.ts:838,843 checks generation and resets at native entry; runtime.ts:186,191,290 separates budget/active flags; event-router.ts:1073 resets registration; settle.ts:342 rejects stale completions. | closed |
| T-02-26 | Spoofing | compatibility claims | medium | mitigate | docs/hooks-compatibility.md:148,173,175 describes whole unanchored regex matching; :198,199 separately describes unchanged literal if identities; :400 limits regex partition drops to invalid syntax. Auditor compared matcher.ts:61, dispatch.ts:161 and builtin-mcp-tool-names.ts:120,141. | closed |

## Accepted Risks Log

No new risk accepted by this audit. D-PG2-10 already records the native JavaScript regex complexity residual under T-02-22. Compile-once, finite tool-name inputs and syntax rejection mitigate the declared vector; they do not guarantee bounded execution for every valid pattern. See `02-08-SUMMARY.md` Threat Flags. No unregistered threat flags were found.

## Security Audit Trail

| Audit date | Threats total | Closed | Open blocking | Open nonblocking | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-11-13 | 27 | 26 | 0 | 1 | gsd-security-auditor: two contradictory current matcher claims under T-02-26 |
| 2026-11-13 | 27 | 27 | 0 | 0 | gsd-security-auditor: targeted recheck of 10750a0e; superseded after code review found missed edge cases |
| 2026-11-13 | 27 | 27 | 0 | 0 | gsd-security-auditor: current-source and regression-assertion recheck at e421cb3a after all five code-review findings were fixed |

## Sign-Off

- [x] Every threat has a declared disposition and implementation evidence.
- [x] Existing residual risk remains documented; no new acceptance inferred.
- [x] No blocking or nonblocking threat remains open.
- [x] `status: verified`; `threats_open: 0`.

**Approval:** verified 2026-11-13 by independent current-source recheck at e421cb3a. No test suite was rerun by the auditor; the parent owns the combined-tree gate.
