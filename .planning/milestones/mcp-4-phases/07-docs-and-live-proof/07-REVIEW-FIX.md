---
phase: 07-docs-and-live-proof
fixed_at: 2026-10-09T00:00:00Z
review_path: .planning/phases/07-docs-and-live-proof/07-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-10-09
**Source review:** .planning/phases/07-docs-and-live-proof/07-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (WR-01, WR-02, IN-01 to IN-06)
- Fixed: 8 (IN-06 only for its stub-stderr item; see Skipped Issues)
- Skipped: 0 findings, 1 sub-item (the IN-06 absolute-path item)

## Fixed Issues

### WR-01: "Project-scope servers" misstates when a headless session runs an unapproved server, and when the prompt repeats

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 135b0ed8
**Applied fix:** Checked against pi-mcp-adapter 5.2.0 first (`project-server-trust.ts:204` skips approval when the project is trusted, `!ctx.hasUI`, and the policy is `allow`; `approveProjectServer` at line 215 is the only write, so `Don't allow` is not saved; `config.ts:501-509` reads the policy only from a non-project source, as `settings.projectServers`, and ignores it in a project file). The review's suggested key name `projectServerPolicy` is the internal field name. The user-facing key is `settings.projectServers`, so the doc uses that name. The interactive bullet now says that the adapter asks again at each load until the user allows the server. The headless bullet names the exception: the user-global adapter configuration sets `settings.projectServers` to `allow`, and the adapter ignores this setting in a project file. Per D-07-06, the text only describes the behavior. It does not recommend the setting or tell users to edit approval files.

### WR-02: The canary leaves its sandbox, and can leave Pi process groups, after Ctrl-C or SIGTERM

**Files modified:** `tests/live-uat/mcp-adapter-canary.mjs`, `tests/live-uat/README.md`
**Commit:** bc97e128
**Applied fix:** Added `process.once` handlers for `SIGINT` and `SIGTERM`. `signalTeardown` kills every live Pi process group directly (`killGroup`, no 15 s `closeSession` wait), kills the stub, and removes the sandbox (`sandboxRoot`, set right after `mkdtemp`). The process then exits 130 or 143. The main `finally` skips its own teardown while a signal teardown runs. The top level awaits the interruption, so the process cannot exit early with the run's code. Exit codes 0, 1 and 2 are unchanged. The header and the README (Prerequisites row, exit-code section) now name the signal exits. Live check: a driver sent SIGTERM after 25 s and SIGINT after 20 s to a real run. The results were exit 143 and exit 130, no `mcp-adapter-canary-*` sandbox left under TMPDIR, and no leftover `--mode rpc`, `openai-stub-server` or `echo-canary` processes.

### IN-01: A teardown failure replaces the verdict

**Files modified:** `tests/live-uat/mcp-adapter-canary.mjs`
**Commit:** 5356b62a
**Applied fix:** The `finally` teardown now ends in `.catch(...)`, which prints `[mcp-adapter-canary] teardown: <message>` on stderr. A teardown error can no longer replace the in-flight `CanaryExit`.

### IN-02: "Every update ... changes the entry" holds only for stdio servers on a new commit

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** fdbcd56a
**Applied fix:** Checked `withInjectedEnv` (`bridges/mcp/substitute.ts`, stdio only) and `pluginCloneKey` (`<urlhash>-<sha12>`). The sentence now reads: "An update of a plugin from its own git source changes the entry of each stdio server when the commit changes, because the plugin moves to a new clone directory."

### IN-03: Two different Claude Code versions are cited as evidence on one page

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** e073d337
**Applied fix:** The source paragraph now says that the `_meta["anthropic/alwaysLoad"]` row was checked later, on the 2.1.294 binary. The rest of the column still reflects 2.1.291.

### IN-04: The "Entries that stay in mcp.json" table leaves out an unreadable `mcp.json`

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 99cae0d3
**Applied fix:** Checked `readOwnersOrReport` (`mcp-migration.ts:704`, a `file-unreadable` row for `mcp.json`, and nothing moves). Added the row "The `mcp.json` file of the scope is not a valid MCP configuration. | Fix the file, then run `/reload`. No server of that scope moves." It sits beside the `mcp-adapter.json` row.

### IN-05: A recaptured fixture fails `format:check`, and the README does not say so

**Files modified:** `tests/live-uat/README.md`
**Commit:** ed8fbcd7
**Applied fix:** Confirmed that the committed fixture is not in `JSON.stringify(..., null, 2)` layout and that `.prettierignore` does not exclude it. "Capturing the legacy fixture" now ends with a step to run `npx prettier --write tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json` before the commit.

### IN-06: The stub's stderr is piped and never read, so its failure reason is lost (stub-stderr item)

**Files modified:** `tests/live-uat/mcp-adapter-canary.mjs`
**Commit:** 22d621ef
**Applied fix:** `startStub` collects the stub's stderr. When no port arrives, it passes the stderr as the `detail` of the `humanNeeded` call (`Stub stderr:` and the text). Running the stub by hand with `STUB_SCRIPT=/nonexistent` printed `openai-stub: STUB_SCRIPT /nonexistent is unusable: ENOENT ...` on stderr, which is the diagnostic that the canary now shows.

## Skipped Issues

### IN-06 (sub-item): absolute checkout path in the README Observed result

**File:** `tests/live-uat/README.md:583, 610`; `tests/live-uat/mcp-adapter-canary.mjs` (`mask()`)
**Reason:** Out of scope by instruction. The README transcript is verbatim evidence of a recorded run. A `REPO_ROOT` mask in `mask()` would change the M0 output line, and the recorded transcript would then no longer match the canary's output. The path is not a secret.
**Original issue:** The verbatim Observed result commits the operator's absolute checkout path, which the capture path refuses to write into the fixture.

## Verification

All checks ran in the **main checkout** (`/home/acolomba/src/pi-claude-marketplace-mcp-4`, branch `features/mcp-4`). No worktree was used, per the orchestrator's instruction. The results can be reproduced from this tree.

- Every commit: `SKIP=npm-check pre-commit run --files <files>` clean (mdformat reformatted two README/doc tables and was re-run), then a foreground `git commit` with its hooks.
- `node --check` and `npx prettier --check` on `tests/live-uat/mcp-adapter-canary.mjs` after each canary edit.
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.
- Live canary, after all canary commits (WR-02, IN-01, IN-06): `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/mcp4-p7-fix node tests/live-uat/mcp-adapter-canary.mjs` gave **exit 0**. With `--invert`, it gave **exit 2** at A3, after A2 passed. Each exit status was read directly, not through a pipe. Logs: `/var/tmp/mcp4-p7-fix/run.log` and `/var/tmp/mcp4-p7-fix/invert.log`. Each line of both logs appears verbatim in the README Observed result, once the M0 line's sandbox parent (`/var/tmp/mcp4-p7-fix`, the TMPDIR of this run) is read as `/var/tmp/mcp4-p7-04`. The output did not change, so the README transcript was not edited. No sandbox was left after either run.
- Live signal checks (WR-02): SIGTERM gave exit 143 and SIGINT gave exit 130. Both removed the sandbox and left no Pi or stub processes.
- Every Pi run stayed in the canary's hermetic `mkdtemp` sandbox under `/var/tmp/mcp4-p7-fix`. The real `~/.pi/agent` was never read or written.

---

_Fixed: 2026-10-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
