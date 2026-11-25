# Phase 4: SSH Sources and Transport Selection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-25
**Phase:** 04-ssh-sources-and-transport-selection
**Areas discussed:** Address forms, Plugin transport, Base URL override, Progress lines, Identity (asked); Address forms on the add command line, Probe, Variables, Windows retry, Identity mechanics, Network policy, Harness (decided autonomously)

Smart discuss, autonomous mode. Upstream evidence was gathered first (`04-EVIDENCE.md`, Claude Code 2.1.332 binary grepped 2026-11-25 and checked against 2.1.330, git 2.43.0 experiments, no ssh binary available).

---

## Address forms (Q6)

| Option | Description | Selected |
|--------|-------------|----------|
| Accept `http://` for git (recommended) | Parity; amend D-PL5-04/05/33; hosted catalogs stay https-only | ✓ |
| Keep refusing `http://` | D-PL5-04/05/33 as the license for the divergence | |

**User's choice:** accept for git sources (D-SG-17).

## Plugin install surface (Q7)

| Option | Description | Selected |
|--------|-------------|----------|
| Shell `claude plugin install` (recommended) | Probe, HTTPS first when SSH is not configured, fallback; dependencies inherit | ✓ |
| In-session `/plugin` | SSH only, no probe | |

**User's choice:** shell install (D-SG-18).

## Update, reinstall, dependency moves (Q7)

| Option | Description | Selected |
|--------|-------------|----------|
| Follow install (recommended) | Same probe and fallback; a recorded divergence | ✓ |
| SSH only (parity) | Upstream's `updatePluginOp` and repair | |

**User's choice:** follow install (D-SG-19).

## Base URL override (Q18)

| Option | Description | Selected |
|--------|-------------|----------|
| HTTPS only, no probe (recommended) | Treat GitHub as HTTPS while the variable is set | |
| Also map SSH to the mirror | Rewrite `git@github.com:` forms to the base too; new feature | ✓ |

**User's choice:** also map SSH forms to the base (D-SG-21). **Orchestrator note:** to fit the answer, the probe does not run while the variable is set, because it would contact the real github.com and every form already reaches the base. The planner may revisit this detail; it is recorded in D-SG-21.

## Tag reads and git-subdir shorthand (Q7)

| Option | Description | Selected |
|--------|-------------|----------|
| Same as the command's clone | Pi-internal choice | |
| SSH by default (parity) | Upstream's `zmt`; no-key users fall back to the current copy | ✓ |

**User's choice:** parity (D-SG-20).

## Progress lines

| Option | Description | Selected |
|--------|-------------|----------|
| Retry and failure only | Transport in the debug log | |
| Always show transport | A note naming the transport on every GitHub clone | ✓ |

**User's choice:** always show transport (D-SG-22).

## Identity case fold (SG-SSH-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Fold to lower case | Parity; closes IN-05 | ✓ |
| Keep exact compare | D-3-01 as the license | |

**User's choice:** fold (D-SG-23).

## Decided autonomously

[auto] [Address forms] — Q: "Does `marketplace add ssh://...` parse on the add command line?" → Selected: "No, as upstream; scp and `http(s)://...git` do" (reversible technical — decided autonomously: parity default; accepting later only widens the parser)
[auto] [Address forms] — Q: "Is `git://` accepted?" → Selected: "Refused, as upstream" (reversible technical — decided autonomously: parity, no recorded user)
[auto] [Probe] — Q: "What is the probe?" → Selected: "Upstream's exact `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com`, 3000 ms, from `platform/git-process.ts`" (reversible technical — decided autonomously: internal launch with upstream's observable result)
[auto] [Probe] — Q: "Is the probe result cached?" → Selected: "As upstream: plugin path once per command, marketplace path per clone, nothing across commands" (reversible technical — decided autonomously: a memo can be added invisibly)
[auto] [Variables] — Q: "How are `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` and `CLAUDE_CODE_REMOTE` read?" → Selected: "PREFER_HTTPS by name with D-SG-15's reader; `CLAUDE_CODE_REMOTE` not read (capability gap), D-SG-24" (reversible technical — decided autonomously: one variable read)
[auto] [Windows] — Q: "Is the Windows retry in scope?" → Selected: "Yes, through the shell install surface (D-SG-18)" (reversible technical — decided autonomously: one platform branch with unit rows)
[auto] [Identity] — Q: "Where does the fold apply?" → Selected: "Port `Ort` into `domain/clone-key.ts`; origin compare, `deriveMarketplaceUrl`, scp-safe `hostFromCloneUrl`, source-ordered swap URLs; `canonicalCloneUrl` unchanged" (reversible technical — decided autonomously: internal matching, keys unchanged)
[auto] [Network policy] — Q: "What does NFR-5 say about the probe?" → Selected: "Amend NFR-5 and AGENTS.md to name the probe and the retry" (reversible technical — decided autonomously: text matches code)
[auto] [Harness] — Q: "How do scenarios exercise SSH?" → Selected: "A stub `ssh` first on Pi's PATH, loopback only" (reversible technical — decided autonomously: test harness only)
