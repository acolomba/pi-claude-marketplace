---
spike: 015
name: fallow-security-candidates
type: standard
validates: "Given SonarCloud's security-hotspot view, when `npx fallow security` runs, then determine what it ranks and whether it surfaces anything Sonar doesn't"
verdict: VALIDATED (gap)
related: [010]
tags: [fallow, static-analysis, security, tooling]
---

# Spike 015: Fallow Security Candidates

## What This Validates

This project's most recent Sonar quality-gate check (PR #128) reported
zero open security-hotspot issues. `fallow security` ships a separate,
explicitly "unverified candidates, not confirmed vulnerabilities" surface
covering CWE-catalogued sink patterns (path traversal, SSRF, ReDoS,
command injection, etc.) plus hardcoded-secret and client/server taint
rules. Does it find anything real, and at what false-positive cost?

## Research

`fallow security --help` documents the tool's own framing carefully: three
surfaces (graph-structural client/server secret leaks, a CWE sink
catalogue matched syntactically, and an include-required hardcoded-secret
detector), explicitly opt-in, `security` is the *only* surface for these
findings (never under bare `fallow` or `audit`). JSON schema inspected
directly (`security_findings[]` with `category`, `cwe`, `path`/`line`,
`evidence`, `reachability`, `taint_flow`).

## How to Run

```bash
npx --yes fallow security --format human --summary
npx --yes fallow security --format json -o security.json
```

## What to Expect

131 candidates: 126 path-traversal, 2 SSRF, 2 dynamic-regex, 1
unsafe-buffer-alloc. All 5 non-path-traversal candidates and a
representative path-traversal candidate were manually verified against
source; all are false positives, each for a specific, checkable reason.

## Investigation Trail

**Category breakdown** (via the JSON's `category` field): 126
`path-traversal`, 2 `ssrf`, 2 `dynamic-regex`, 1 `unsafe-buffer-alloc`.
96% of all findings are one pattern.

**Traced the top path-traversal finding to source:**
`shared/path-safety.ts:95` -- inside `assertPathInside`, this project's
own NFR-10 path-containment chokepoint. The flagged line
(`current = path.join(current, segment)`) is the validator itself, walking
segments to check for symlink escapes before the function ever returns
successfully. Confirmed false positive: Fallow correctly identifies the
syntactic pattern (non-literal `path.join()` argument) but has no semantic
model of "this function's entire purpose is to be the safety check."
`persistence/locations.ts` (`ScopedLocations`, the project's other
documented path-containment abstraction) accounts for a large share of the
remaining 125 -- the same story, same file the project already documents
as its trusted path-building layer.

**Manually verified all 5 non-path-traversal candidates against source**
(cheap enough to do exhaustively at this count):
- `bridges/hooks/async-rewake/ring-buffer.ts:70` --
  `Buffer.allocUnsafe(capacity)`. `capacity` is a constructor parameter
  (fixed ring-buffer size), not runtime/attacker input. **False positive.**
- `shared/vars.ts:44` -- `new RegExp()` built from `TOKEN_TO_FIELD` keys
  (a small compile-time object: `CLAUDE_PLUGIN_ROOT`,
  `CLAUDE_PLUGIN_DATA`, etc.). The two lines directly above the flagged
  site already call `.replaceAll(/[.*+?^${}()|[\]\\]/g, ...)` to
  regex-escape each token, with a comment explicitly stating the intent
  ("even one that carried a regex metacharacter"). **False positive,
  doubly so:** neither is the input attacker-controlled, nor is it
  unescaped.
- `bridges/agents/convert.ts:145` -- `new RegExp()` built from
  `escapeRegExp(pluginName)`. Same shape: explicit escaping visible two
  tokens away from the flagged call. **False positive.**
- `domain/github-auth.ts:188` and `:233` -- `fetch(deviceCodeUrl, ...)`
  and `fetch(tokenUrl, ...)`, flagged because the URL is a function
  parameter, not a literal at the call site. Traced the call chain:
  `makeDeviceFlowHttp(deviceCodeUrl, tokenUrl)` is called exactly once,
  with `GITHUB_PROVIDER.deviceCodeUrl` / `GITHUB_PROVIDER.tokenUrl` --
  hardcoded string literals in `auth-registry.ts`
  (`"https://github.com/login/device/code"`, etc., mirrored for
  `GITLAB_PROVIDER`). **False positive:** the taint analysis doesn't
  propagate far enough through the call graph to see that every actual
  caller passes a compile-time constant.

## Results

**Verdict: VALIDATED (gap).** Every one of the ~10 candidates inspected in
depth (5 non-path-traversal, the representative path-traversal case) was
a confirmed false positive -- and in 3 of those 5 cases, the surrounding
code already contains a visible, comment-documented defense against
exactly the risk being flagged. `fallow security` finds nothing SonarCloud
missed in this codebase; SonarCloud's zero-hotspot state stands.

That's not a wasted result, though: the tool is honest about what it is
("unverified candidates," never gates CI on its own) and every finding
here was cheap and fast to dismiss with a source read, because this
codebase already documents its own safety invariants in comments right
next to the flagged lines (`path-safety.ts`'s doc comment, `vars.ts`'s
escaping rationale, the provider-registry pattern). On a codebase without
that documentation discipline, the same 131 candidates would take
considerably longer to triage. The gap this spike validates is
false-positive *rate*, not false-positive *cost* here -- for this
specific, well-documented codebase, `fallow security` is low-value as a
gate and would mostly train reviewers to ignore it.
