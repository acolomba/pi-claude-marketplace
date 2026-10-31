---
phase: 01-pi-1-0-floor-and-adapter-only-detection
fixed_at: 2026-10-02T00:00:00Z
review_path: .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-02T00:00:00Z
**Source review:** .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (CR-01, WR-01..WR-04; Info findings out of scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `scripts/pi.sh` runs pi-mcp-adapter 5.0.0 against the developer's real Pi settings

**Files modified:** `scripts/pi.sh`, `CONTRIBUTING.md`
**Commit:** cd50c39b
**Applied fix:** When neither `--home` nor `PI_CODING_AGENT_DIR` is set, the
script sets the Pi home to `<prefix>/home` (the private npm prefix, already
outside the checkout). It then exports `PI_CODING_AGENT_DIR` and
`PI_CODING_AGENT_SESSION_DIR` below it, as `--home` does. An explicit
`PI_CODING_AGENT_DIR` still wins, so an operator can still choose
`~/.pi/agent` on purpose. `--home` is unchanged. A default sandbox keeps the
script usable without flags. Refusing would have broken the plain
`scripts/pi.sh` invocation. The usage text explains the adapter's
`settings.json` write and the default. The `CONTRIBUTING.md` `--home`
paragraph also names the default. Verified with `bash -n` and `--help`.
shellcheck is not installed.

### WR-01: The command source arm counts prompt templates and skills

**Files modified:** `extensions/pi-claude-marketplace/platform/pi-api.ts`, `tests/platform/pi-api.test.ts`, `docs/prd/pi-claude-marketplace-prd.md`
**Commit:** d1e24ebd
**Applied fix:** `isAdapterCommand` returns false unless
`command.source === "extension"`, then accepts either signal (adapter source or
`mcp-adapter[:n]` name). Two new matrix rows (a `prompt` and a `skill` entry
whose `sourceInfo.source` is `npm:pi-mcp-adapter`) expect
`piMcpAdapterLoaded: false`. Both rows failed against the old probe (negative
control: 51 pass / 2 fail) and pass now (53/53). The PRD glossary entry, RH-4
row and the 9.3 probe diagram now say "extension command". The edit is below
every `pi-api.ts` contract pin (lines 100-124). `npm run lint:type-members`
passes, and direct coverage of `pi-api.ts` is 24/24 branches, 13/13 functions
and 250/250 lines. Status: fixed, but the probe condition changed, so a human
should confirm the logic.

### WR-02: The RPC adapter-detection states pass even when their inventory evidence is missing

**Files modified:** `tests/e2e/adapter-detection-rpc.test.ts`
**Commit:** 440968b4
**Applied fix:** `assertCleanSession` now asserts that the `commands`
(`get_commands`) response succeeded and that the `inventory`
(`/inventory-probe`) prompt was `handled`. `inventoryEntries` calls
`assert.fail("the inventory probe did not notify")` when no notify followed
the inventory step. It no longer parses `"{}"`. Negative control: renaming the
probe command to `/inventory-nope` fails all five real-Pi states. The
unmodified file passes 7/7.

### WR-03: The built-in RPC case registers sentinel cleanup only after a read that can throw

**Files modified:** `tests/e2e/adapter-detection-rpc.test.ts`
**Commit:** 440968b4 (committed with WR-02: same file and the same evidence-check change)
**Applied fix:** The test reads the sentinel PID and registers its
`t.after` SIGKILL cleanup right after the session ends. It reads the stub PID
later, in the assert section, and a missing file becomes
`assert.fail("the built-in MCP never started the stub server: ...")`.

### WR-04: The PIFL-02 peer test says it checks that pi-subagents is optional, but it does not

**Files modified:** `tests/architecture/peer-floor.test.ts`
**Commit:** c3488792
**Applied fix:** Added
`assert.deepStrictEqual(pkg.peerDependenciesMeta?.[SUBAGENTS_PEER], { optional: true })`,
matching the pi-mcp-adapter peer test.

## Verification

All checks ran in the main checkout
(`/home/acolomba/src/pi-claude-marketplace-mcp-4`, branch `features/mcp-4`).
No worktree was used.

- `SKIP=trufflehog pre-commit run --files <all 7 changed paths>`. The npm
  changed-checks hook passed, and mdformat realigned the PRD RH table. The
  re-run on the reformatted markdown ended with `PRECOMMIT_EXIT=0`, and its npm
  changed-checks hook passed again over the full working-tree diff.
- `node --test tests/e2e/adapter-detection-rpc.test.ts`: 7/7 against the
  real pinned Pi.
- `node --test tests/platform/pi-api.test.ts`: 53/53.
- `node --test tests/architecture/peer-floor.test.ts`: 6/6.
- `fallow audit --gate-marker agent`: verdict `warn` (inherited duplicates
  only), not `fail`.

Focused task verification passed. Full phase or PR verification is still
pending.

---

_Fixed: 2026-10-02T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
