# Phase 10: Plugin Options, Variables, and Trust - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 10-plugin-options-variables-and-trust
**Areas discussed:** Project trust gap (decision 23), PATH, `userConfig` step 1 (decision 17), `${CLAUDE_PROJECT_DIR}` at user scope (decision 10)
**Mode:** autonomous discuss (`--auto`). The user told this run to proceed without asking and to take the reversible upstream-parity default. Decisions 23, 17, and 10 are marked **pending maintainer review**. No todo matched the phase.

---

## Project trust gap (PG-SEC-02, decision 23)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm D-LOC-01's gap | Keep every project gate on `ctx.isProjectTrusted()`; add `PATH`; draft the Pi trust-paths request. | ✓ |
| Reopen: extension consent record | Treat the project as trusted only after a saved Pi decision or one confirmation kept by this extension. Safer; second prompt; breaks print/JSON/RPC project plugins until approved; user-scope state that D-LOC-01 forbids; new requirement. | |

**Choice:** confirm. **Pending maintainer review; security-sensitive.**
**Notes:** Pi 1.5.0 trusts a folder with none of its own protected paths without asking (`project-trust.js:21-24`, `trust-manager.js:8-17`). Upstream gates repository plugins on trust. The divergence is licensed by D-LOC-01 and a Pi capability gap. Option B is the safer posture and is recorded for the maintainer.

## PATH (PG-CORE-06, PG-CORE-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Gate the project scope on the load's trust answer; add only an existing `bin` directory; drop metacharacter paths | Upstream 2.1.322 parity; PENV-01 corrected | ✓ |
| Gate only, keep adding a missing `bin` | Parity with 2.1.212 only | |

**Choice:** the first (reversible).

## `userConfig` step 1 (PG-CORE-03, decision 17)

| Option | Description | Selected |
|--------|-------------|----------|
| Support defaults and export now | Amends USRCFG-01; steps 2 and 3 stay open | ✓ |
| Keep USRCFG-01 | PG-CORE-03 moves to Out of Scope | |

**Choice:** support step 1. **Pending maintainer review.**
Sub-choices taken autonomously (reversible): malformed `userConfig` is `unavailable` (fail closed); a required option without a default is `partially-available`; value text is `String(value)`; an unset reference stays literal in content and fails the hook or server elsewhere, as upstream throws; a sensitive option is a placeholder in content; hooks get `CLAUDE_PLUGIN_OPTION_<KEY>` on both lanes; a shell-form hook naming `${user_config.` is refused; adapter entries reference a per-plugin process variable and hold no value (bash inherits it, as AVAR-01; pending review); built-in fills at registration; content is filled at staging, commands included; existing installs get it at the next restage.

## `${CLAUDE_PROJECT_DIR}` at user scope (PG-CORE-05, decision 10)

| Option | Description | Selected |
|--------|-------------|----------|
| Fill at invocation, model read, and `run_plugin_command` | Amends SUB-02; agents unchanged | ✓ |
| Keep SUB-02 | PG-CORE-05 moves to Out of Scope | |

**Choice:** fill at invocation. **Pending maintainer review.**

## Claude's Discretion

Reason token name, process variable naming and its ledger, schema storage (manifest re-read or record), module placement, scenario wording, plan splits.

## Deferred Ideas

CORE-03 steps 2 and 3 (decision 30); the consent record of option B; a load-time notice for a project trusted by default; bash-only plugin `bin`; the env-vars PATH matrix column (Phase 11).
