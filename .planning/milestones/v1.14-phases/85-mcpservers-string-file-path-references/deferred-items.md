# Deferred items — Phase 85

Out-of-scope discoveries logged during execution (not fixed; SCOPE BOUNDARY rule).

## Pre-existing integration-test failures (unrelated to this phase)

`npm run test:integration` reports 2 failures that also fail on the base commit
`2aa29a15` (before any Phase 85 work), confirming they are pre-existing and
environmental (pi-subagents companion-extension integration), not caused by the
mcpServers string-reference changes:

- `tests/integration/provenance-invisibility.test.ts` —
  `T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser`
- `tests/integration/skill-path-resolution.test.ts` —
  `SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents'
  resolveSkillsWithFallback and stays out of the global catalog`

These touch skill staging / pi-subagents `resolveSkillsWithFallback`, with no
connection to `domain/resolver.ts` or `domain/components/plugin.ts`. Left
untouched.
