# Phase 1: Suite Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 01-suite-foundation
**Areas discussed:** Todo fold, Payload-kind assertions, Run-specific tokens, Smoke vs unused gate, Usage gate scope

---

## Todo fold (`2026-10-13-cucumber-rules-trial`)

| Option | Description | Selected |
|--------|-------------|----------|
| Gherkin+layout gate (§2.3) | `scripts/check-features.mjs` in `check:static` enforcing features.md/layout.md | ✓ |
| ESLint blocks (§2.1-2.2) | Step modules export nothing, no regex; `features/lib` registers nothing; stale bullets dropped | ✓ |
| Upstream port (§3) | Port to blueprint-typescript PR #7 | |

**User's choice:** fold §2.1-2.3; §3 stays in the todo.

---

## Payload-kind assertions

| Option | Description | Selected |
|--------|-------------|----------|
| kind row in the table | Un-hide `kind`; plugin scenarios gain `| kind | cascade |` | ✓ |
| Kind in the step text | `the result is a marketplace info with these fields:` | |
| Separate kinds step | `the command emits these results:` then detail steps | |

| Option | Description | Selected |
|--------|-------------|----------|
| Envelope table + rows | One row per payload, then rows across payloads | ✓ |
| One row per payload | Single wide table; breaks with plugin rows | |
| Ordinal steps | `the first result ...`, `the second result ...` | |

---

## Run-specific tokens

| Option | Description | Selected |
|--------|-------------|----------|
| {home}-style braces | No clash with Outline placeholders or payload text | ✓ |
| <home>-style angles | Clashes with placeholders and usage text | |
| $HOME-style | Would capture a literal `$HOME` test | |

| Option | Description | Selected |
|--------|-------------|----------|
| Absolute, via {home} | Common user form; `~/` only in ADD-14 | ✓ |
| ~/ form everywhere | Research Pattern 3; absolute paths untested | |
| Relative to the project | `./marketplaces/tools` | |

| Option | Description | Selected |
|--------|-------------|----------|
| {scenario time} | Any timestamp within the scenario | ✓ |
| {command time} | Only within the last command | |
| Both tokens | Most precise, one more concept | |

---

## Smoke vs unused gate

| Option | Description | Selected |
|--------|-------------|----------|
| Seed verb files | First use in real scenarios in the verb files | ✓ |
| Foundation-owned feature | Phase 1's own feature | |
| Reserved-steps allowlist | Gate tolerates listed unused steps until Phase 10 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Read steps only | No config-write Given until needed | ✓ |
| Read and write | Write step plus a scenario nobody asked for | |

| Option | Description | Selected |
|--------|-------------|----------|
| Promote to shared | Second user moves the step to the shared module | ✓ |
| Verb-specific phrasing | Near-duplicate steps per verb | |

---

## Usage gate scope

| Option | Description | Selected |
|--------|-------------|----------|
| Check all rows | Dry run ignores the tag exclusion | ✓ |
| Respect the exclusion | Kind-only steps read unused until the tag lifts | |

| Option | Description | Selected |
|--------|-------------|----------|
| check:static | Commit hook, CI static job, `npm run check` | ✓ |
| With test:cucumber | Only `npm run check` and CI behavioral job | |

**Notes:** the user asked for an explanation of the placement choice before answering, then chose "keep" (check:static).

## Claude's Discretion

Step wording, module split, token set beyond `{home}`, `{scenario time}` tolerance, `PluginWorld` rename, setup-driver strictness.

## Deferred Ideas

- Config-write Given, when a requirement needs it.
- Todo §3 upstream port.
