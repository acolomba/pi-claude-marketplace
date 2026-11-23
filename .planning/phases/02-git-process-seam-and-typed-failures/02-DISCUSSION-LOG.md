# Phase 2: Git Process Seam and Typed Failures - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-23
**Phase:** 02-git-process-seam-and-typed-failures
**Areas discussed:** Transport and constraint amendments (asked); Git detection, Hardening, Version floor, Typed errors, Seam and gates, Test hermeticity (decided autonomously)

Smart discuss, autonomous mode. Upstream evidence was gathered first (`02-EVIDENCE.md`, Claude Code 2.1.330 binary grepped 2026-11-23).

---

## Transport and constraint amendments

| Option | Description | Selected |
|--------|-------------|----------|
| Q1: Git only (Claude Code) | No fallback; error naming the requirement, xcode-select form on macOS | ✓ |
| Q1: isomorphic-git HTTPS-only fallback | Two transports, no SSH on the fallback; needs a divergence ID | |
| Q11: upstream network-free lane (`GIT_ALLOW_PROTOCOL=/` ...) | Survives user `protocol.*.allow=always`; amends SG-PRC-04 | ✓ |
| Q11: static lint gates only (Claude Code for plugin commands) | No runtime guarantee | |
| Q11: per-protocol `-c protocol.*.allow=never` | Open-ended list; user config can override | |
| Q12: amend NFR-10 (Claude Code) | Writes through the user's own git/ssh config are out of scope | ✓ |
| Q12: amend plus `-o UpdateHostKeys=no` | Needs a divergence ID and an ssh version guard | |

**User's choice:** Accept all (recommended answers), 2026-11-23.

---

## Decided autonomously

[auto] [Git detection] — Q: "How does the extension detect a missing or unusable git (Q3)?" → Selected: "Claude Code's method (cached positive lookup, macOS xcrun-shim check, Windows absolute-PATH lookup refusing cwd matches and .cmd/.bat), classify-after-spawn as backstop" (reversible technical — decided autonomously: internal module behavior) — alternatives: spawn first and classify only; a `git --version` probe.
[auto] [Hardening] — Q: "Which in-checkout hardening does every git command carry (Q14 part)?" → Selected: "One builder with upstream's combined set on every command, plus LC_MESSAGES=C everywhere and init.templateDir=" (reversible technical — decided autonomously: adding keys is local) — alternatives: upstream's exact per-command split; extra keys from the pitfalls research, each needing an ID.
[auto] [Version floor] — Q: "Does the extension enforce a git version floor (Q17)?" → Selected: "No probe; document 2.25; classifier row for unknown option / exit 129; git version in debug log" (reversible technical — decided autonomously: documentation plus one classifier row) — alternatives: probe and refuse below a floor (needs an ID); a CI floor-version leg.
[auto] [Typed errors] — Q: "What shape do typed git failures take (SG-PRC-05)?" → Selected: "One GitCommandError with a closed kind union, narrowed by instanceof and kind" (reversible technical — decided autonomously: an internal error type) — alternative: one class per kind.
[auto] [Seam and gates] — Q: "How do the gates change with the module?" → Selected: "Chokepoint names platform/git-process.ts and drops git-credential.ts once its spawn moves; BLOCK C zone; async spawn, arrays, no shell, closed stdin, --end-of-options, group kill" (reversible technical — decided autonomously: gate edits change together).
[auto] [Test hermeticity] — Q: "How does a unit test give production git spawns a hermetic environment?" → Selected: "Injected base environment defaulting to process.env" (reversible technical — decided autonomously: a parameter with a default) — alternative: a node --test preload.

## Claude's Discretion

- File split inside `platform/`; which first consumer lands with the module.

## Deferred Ideas

- Error wording: Phase 6. Old-clone settings: Phase 3. `UpdateHostKeys=no` and a CI floor leg: declined.
