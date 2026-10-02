# Phase 1: Pi 1.0 floor and adapter-only detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-02
**Phase:** 01-pi-1-0-floor-and-adapter-only-detection
**Areas discussed:** Missing-adapter marker, Detection proof depth, Canary outcomes, features/mcp carry-over

---

## Missing-adapter marker

| Option | Description | Selected |
|--------|-------------|----------|
| `{requires pi-mcp-adapter}` | Names the package to install, like the other two markers; no clash with Pi 1.0's own `pi-mcp`; closed-catalog amendment across ~40 files plus docs | ✓ |
| Keep `{requires pi-mcp}` | No churn; ambiguous on Pi 1.0 | |

| Option | Description | Selected |
|--------|-------------|----------|
| README, this phase | One sentence in the soft-dependency paragraph PIFL-03 already edits | ✓ |
| Phase 7 docs pass | Leave it for ADOC-01 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same marker always | No built-in probe in the renderer; bytes identical on every surface | ✓ |
| Extra built-in hint | Built-in probe, a new token, a second matrix | |

**User's choice:** rename to `{requires pi-mcp-adapter}`; README note this phase; same marker always.
**Notes:** Evidence shown: npm registry, `@earendil-works/pi-coding-agent@1.0.0` depends on `@earendil-works/pi-mcp@^1.0.0`. Claude noted that the existing tests match the substring `"{requires pi-mcp"` without the closing brace, so they must pin the full token.

---

## Detection proof depth

| Option | Description | Selected |
|--------|-------------|----------|
| Mock, shape captured live | Mock matrices plant the built-in's inventory captured once from real Pi 1.0 | ✓ |
| Real Pi 1.0 e2e now | New RPC-driven e2e test in this phase | |
| Mock from research only | Plant the tarball-read shape, no live capture | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, keep the tool arm | Matches ADET-02 wording; foreign `mcp` false positive pinned as a known limitation | |
| No, drop the bare tool arm | Detect by `mcp-adapter` command or adapter source; amends ADET-02 | ✓ |

**User's choice:** mock matrix with a live-captured shape; drop the bare `mcp` tool arm.
**Notes:** ADET-02 text amended in REQUIREMENTS.md. The later carry-over choice (RPC harness) added a real-Pi RPC test on top of the mock matrix.

---

## Canary outcomes

| Option | Description | Selected |
|--------|-------------|----------|
| Both engine canaries | Agent-failure and storage at 3.13.1 on Pi 1.0 | ✓ |
| Agent-failure only | Storage claims stay at 3.13.0 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Record and narrow | Verbatim failing run, BACKLOG/ledger entry, narrowed claim, PIFL-07 amended | ✓ |
| Block the phase | Wait for every canary to pass | |
| Try latest engine, then record | One retry on the newest engine | |

| Option | Description | Selected |
|--------|-------------|----------|
| Executor, sandboxed | Scratch prefix, `tmp/pi-uat` agent dir, stub provider, negative controls, verbatim output | ✓ |
| Human checkpoint | Operator runs and pastes output | |

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime + diffed bodies | Runtime claims to 3.13.1; source-read claims stamped only after diffing cited bodies | ✓ |
| Runtime grades only | Source-read claims keep "unchanged at 3.13.0" | |

**User's choice:** both engine canaries; record and narrow on upstream failure; executor runs them; runtime grades plus diffed bodies.
**Notes:** The engine canaries drive the engine outside Pi with credentials unreachable, so ledger 84 does not apply to them.

---

## features/mcp carry-over

| Option | Description | Selected |
|--------|-------------|----------|
| Stop canary verdicts | IN-01, IN-08, IN-09, IN-10 | ✓ |
| pi-subagents floor proof | IN-05, IN-06, IN-07 | ✓ |
| Duplication and comments | IN-02, IN-03, IN-04 | ✓ |
| RPC harness | Port `tests/e2e/_rpc.ts` with its fixes | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| `tests/live-uat/` | Beside its consumer, standard `fallow-ignore-file unused-file` marker | ✓ |
| Renamed spike dir | Outside fallow and lint scope, under planning docs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Real-Pi detection test | Port `builtin-mcp-rpc.test.ts` with inverted semantics; doubles as the live shape capture | ✓ |
| Capture only, park it | One capture, then a fallow-ignore marker until Phase 6/7 | |
| Defer the port | Port when Phase 6/7 needs it | |

**User's choice:** all four finding groups; stub server in `tests/live-uat/`; the RPC harness drives a real-Pi detection test.
**Notes:** Claude raised the follow-up because an RPC harness with no consumer would fail fallow's unused-file check.

---

## Claude's Discretion

- Plan split and wave order, with pins moved once.
- The new name for `ToolInventory`.
- How the IN-05 gate reads `package.json`.

## Deferred Ideas

None.
