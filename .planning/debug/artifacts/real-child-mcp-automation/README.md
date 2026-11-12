# Detached-child MCP companion reproduction

This artifact records the locally patched `pi-subagents` companion result. It does not change the installed or published `pi-subagents` 0.88.0 package.

## Provenance

- Companion repository: `https://github.com/nicobailon/pi-subagents.git`
- Installed 0.88.0 tag: `c84d4a817db9e6e49179ec202ba6c619322eb767`
- Current upstream base used for the patch: `7e2794efba0b727af51d08c36614ea939f1a827b`
- Local branch: `features/ambient-mcp-direct-tools`
- Local commit: `1e79b864159430cc124783a7d7c9e4e5daa2a7bf`
- `companion.patch.gz` SHA-256: `f695741ccfaaf0a7c4da04a7c3b1e98182204b549b5fca68ed644cd1ea117358` (the uncompressed patch SHA-256 is `cfffdf01ad77fcb0a9a42e6a59d57cbd36c900f7cfa77fd600546577a6e258e1`)
- `run.mjs` SHA-256: `2ce89d7a3d8ff5400001ea12e2ca5c68a9872fa9acf496c9bee1768c72b2822c`
- Node: `v26.13.0`; adapter: installed `pi-mcp-adapter` 7.0.1

The patch changes one child environment branch and adds one regression test. No branch was pushed or package published.

## Reproduce with a fresh companion checkout

From this repository's root:

```sh
git clone https://github.com/nicobailon/pi-subagents.git /tmp/pi-subagents-mcp-repro
git -C /tmp/pi-subagents-mcp-repro switch -c features/ambient-mcp-direct-tools 7e2794efba0b727af51d08c36614ea939f1a827b
gzip -dc .planning/debug/artifacts/real-child-mcp-automation/companion.patch.gz | git -C /tmp/pi-subagents-mcp-repro apply
npm --prefix /tmp/pi-subagents-mcp-repro ci --ignore-scripts
npm --prefix /tmp/pi-subagents-mcp-repro run typecheck
npm --prefix /tmp/pi-subagents-mcp-repro run build:pkg
PG_COMPANION_INDEX=/tmp/pi-subagents-mcp-repro/dist-pkg/index.js node .planning/debug/artifacts/real-child-mcp-automation/run.mjs
```

The last command creates a fresh isolated Pi home and local MCP/model stand-ins under `/tmp/pg1-live-companion-*`. It runs the actual detached `demo:runner`, `demo:control`, and `demo:restricted` children, checks every child provider request's tool inventory, checks each child's echo output, and checks the MCP server's `tools/call` record. It prints the fixture path, complete tool inventories, and the driver log path. It needs local loopback binding. `PG_AGENT=demo:restricted` selects one child for diagnosis. Without `PG_COMPANION_INDEX`, it uses this project's installed 0.88.0 package, whose unrestricted and restricted cases are expected to fail the assertions.

## Recorded checks

| Check | Command | Result |
| --- | --- | --- |
| Regression before fix | `node --experimental-strip-types --import ./test/support/isolated-temp-root.mjs test/unit/child-tool-plan.test.ts` in the companion checkout | Failed: ambient `MCP_DIRECT_TOOLS` was `__none__`, expected undefined |
| Regression after fix | Same command | Passed: 25/25 |
| Type check | `npm run typecheck` | Passed |
| Package build | `npm run build:pkg` | Passed; local package at `/tmp/pi-subagents-mcp-fix/dist-pkg/index.js` |
| Full unit suite | `timeout 600s npm run test:unit` | 4,416 passed, 3 failed, 16 skipped. All three failures reproduced with the source hunk reverted; see logs below. |
| Adjacent async MCP integration | `timeout 60s node --experimental-strip-types --import ./test/support/register-loader.mjs --test-name-pattern 'with Pi.*MCP|selected tools|extension-registered servers|project.*mcp.json' test/integration/async-execution.part-1.test.ts` | Passed: 3/3 |
| Full adjacent integration module | `timeout 120s node --experimental-strip-types --import ./test/support/register-loader.mjs --test test/integration/async-execution.part-1.test.ts` | Timed out at 120 seconds after the three MCP cases had passed. The focused MCP rerun above completed. |
| Revert and reapply | Temporarily restore `child-launch.ts` from the base commit, run the owner module, reapply the patch, run it again | Red on revert (`__none__`), green on reapply (25/25) |
| Fixed local detached children | `timeout 180s node /tmp/pg1-live-fixed-local/drive.mjs` | Passed all three children; exact inventories and calls below |
| Durable runner | `PG_COMPANION_INDEX=/tmp/pi-subagents-mcp-fix/dist-pkg/index.js node .planning/debug/artifacts/real-child-mcp-automation/run.mjs` | Passed all three children in fresh fixture `/tmp/pg1-live-companion-sLPPSp` |

The three full-unit failures are the two package-agent expectations in `agent-eject-disable.test.ts` (`package` versus `builtin` or `undefined`) and the linked-worktree expectation in `agent-memory.test.ts` (null versus `/tmp`). The exact same assertions fail with the companion source patch reverted. Stryker is not configured in the companion checkout; the mutation signal is skipped. The manual revert/reapply check killed the equivalent fallback mutation.

The original installed 0.88.0 logs are `live-pinned-runner.out.gz`, `live-pinned-control.out.gz`, and `live-pinned-restricted.out.gz`. The fixed-build provider and detached status log is `live-fixed-all.out.gz` (SHA-256 `0944f258e712595288042b255402b34e941187b909bb473202d0f01fbed34b09`; uncompressed SHA-256 `994952383a3c7816c25b353e3dfdd097740103056d9da32784dcd1e38be23241`); its MCP server log is `live-fixed-mcp-requests.jsonl`. The self-contained replay output is `pi-subagents-mcp-self-contained-run.out.gz`. The full unit, baseline, red/green, and focused integration logs are named `pi-subagents-mcp-*.out.gz` beside this file. Use `gzip -dc <file>` to read a compressed log without changing it.

The fixed child inventories were:

| Child | Exact direct MCP names in every provider request | Actual MCP call |
| --- | --- | --- |
| `demo:runner` | short echo only | `echo:pg1-live-short` |
| `demo:control` | short echo and `mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c` | `echo:pg1-live-long-control` |
| `demo:restricted` | short echo; long name absent | `echo:pg1-live-restricted` |

Every fixed child completed. The restricted child received its allowed short tool while Pi's `excludeTools` removed the exact long name. Published 0.88.0 still has the suppressing fallback and has not passed this acceptance check.
