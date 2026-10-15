# Reviewing

Part of the `typescript-unit-tests` skill: `.agents/skills/typescript-unit-tests/SKILL.md`.

A review reads the rules files the pair touches; a revision produces the **Good** form in `.agents/skills/typescript-unit-tests/rules/cases.md`. A revision that weakens assertions is a finding even when the tests still pass.

Require passing owner tests and direct coverage for the pair (all pairs after a shared contract, fake, or harness change). Use the writer's or commit hook's evidence when it covers the reviewed inputs under `.agents/skills/local-verification/SKILL.md`; otherwise run the pair's owner tests and direct coverage. A failed command or missing applicable evidence is a finding. An ordinary task review may accept focused evidence; do not imply that it proves the full project passed.

## Classifying findings

- **BLOCKER** -- the suite lies or breaks: a case a wrong implementation would pass (weak, missing, or replaced assertions; expected values computed by production code; an unawaited async assertion), a changed source module with no paired test module, direct pair coverage below 100%, a hermeticity break (live network, shared global state, leaked filesystem writes), a committed `only`/`skip`/`todo`, or a test-only hook added to production code.
- **WARNING** -- structure and readability: naming, phase comments, `describe()` shape, data style, support organization, a double named after its kind.
