---
phase: quick-261113-8yn
plan: 01
subsystem: testing
tags: [pi-subagents, ambient-mcp, detached-children]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: six installed-peer characterizations and real-child runner
provides:
  - published pi-subagents 0.88.1 suite and local launcher selection
  - positive ambient launch checks and three actual-child MCP calls
  - retired AGTAMBIENT-01 release trigger with retained history
affects: [PG-MCP-02, companion upgrades, Phase 1 acceptance]
actuals:
  tokens: 11132
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [exact-version optional-peer cache, real detached-child MCP replay]
key-files:
  created: []
  modified:
    - test/integration/optional-peer-suite-versions.json
    - test/integration/pi-subagents-child-launch-conformance.test.ts
    - scripts/pi.sh
    - docs/mcp-compatibility.md
    - .planning/seeds/SEED-261112-81c-adopt-pi-subagents-ambient-mcp-fix.md
key-decisions:
  - Keep the general optional pi-subagents peer floor at >=0.87.0; ambient direct MCP requires >=0.88.1.
  - Keep PG-MCP-02 open until the parent's merged-tree npm run check passes.
patterns-established: []
requirements-completed: []
requirements-pending: [PG-MCP-02]
coverage:
  - id: D1
    description: The suite and local launcher select published pi-subagents 0.88.1 while the peer floor remains >=0.87.0.
    verification:
      - kind: integration
        ref: node --import ./test/platform/isolated-pi-home.ts --test test/architecture/peer-floor.test.ts test/integration/agents-adapter-grant-conformance.test.ts test/integration/adapter-tool-name-conformance.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Two positive ambient launch checks and three real detached children pass on the installed release.
    verification:
      - kind: integration
        ref: node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap test/integration/pi-subagents-child-launch-conformance.test.ts
        status: pass
      - kind: integration
        ref: env -u PG_COMPANION_INDEX -u PG_AGENT node .planning/debug/artifacts/real-child-mcp-automation/run.mjs
        status: pass
    human_judgment: false
  - id: D3
    description: The release trigger is retired and dated 0.88.0 failure evidence remains available.
    verification:
      - kind: other
        ref: seed status and trigger assertion plus git diff --check
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-11-13
status: complete
plan_head_before: a8de0aa5e2bf38277ae23cc5c59eabf54b47dcf2
plan_head_after: 5bd4cbeb5c23694fa43f4dbc9e3120247c818921
---

# Quick Task 261113-8yn: Adopt pi-subagents 0.88.1

**Published pi-subagents 0.88.1 restores ambient direct MCP tools to real detached children and permits selective exclusion of the long tool.**

## Performance

- Completed: 2026-11-13T12:07:25Z; Node: v26.13.0.
- Tasks: 3; changed files: 14; task commits: 3.
- The executor tasks are complete. Parent merge and the combined-tree gate remain pending.

## Accomplishments

- Selected 0.88.1 for the integration suite and local Pi launcher. The optional peer range remains >=0.87.0; package.json and package-lock.json are unchanged, and no companion entered the root lockfile.
- Replaced two 0.88.0 defect characterizations with exact positive ambient contracts. All four explicit controls and independent adapter naming and long-grant checks remain intact.
- Verified actual published-package children and retired the AGTAMBIENT-01 release trigger, preserving dated 0.88.0 and local-patch evidence.

## Task Commits

1. Task 1 — b730d0b3948ac024e9f2c5d7d87c6700f777f703 — test(subagents): adopt published ambient MCP fix.
2. Task 2 — 5f5720f39e2a40f7038941dea6deb20206ef7164 — docs(subagents): describe ambient MCP release.
3. Task 3 — 5bd4cbeb5c23694fa43f4dbc9e3120247c818921 — docs(subagents): retire ambient MCP release trigger.

## Package Identity

npm view pi-subagents@0.88.1 name version repository dist.integrity dist.tarball time --json exited 0. The registry names pi-subagents 0.88.1, git+https://github.com/nicobailon/pi-subagents.git, tarball https://registry.npmjs.org/pi-subagents/-/pi-subagents-0.88.1.tgz, published 2026-11-13T07:21:28.163Z, and integrity sha512-Yrt0kBT+ChgnmcVzBu2004lwuwmRTHdr1jGUdLd9X7+TAdpLaCILCRFHQhnM9u4fnyOPDLE8wASnedp0nuXc9g==. The installed cache manifest and npm lock entry match that name, version, tarball, and integrity. The installed src/runs/shared/child-launch.js sets its owned MCP_DIRECT_TOOLS key to undefined for an unrestricted runner without a capability ceiling. The existing installer fetched both versions with registry integrity checking, --ignore-scripts, and a publish-time cutoff into this worktree's private cache.

## Focused Verification

| Command | Exit | Result and retained log |
| --- | ---: | --- |
| node scripts/install-test-peers.mjs with 0.88.0 suite pin | 0 | Private baseline cache; /tmp/261113-8yn-optional-peers-0880 |
| Detailed focused launch command on unchanged 0.88.0 characterization | 0 | 6 pass, 0 skip; /tmp/261113-8yn-baseline-0880.tap |
| node scripts/install-test-peers.mjs with 0.88.1 suite pin | 0 | Published 0.88.1 installed with integrity checks |
| Detailed focused launch command with unchanged characterization on 0.88.1 | 1 expected | Only two ambient assertions failed on undefined versus __none__; four controls passed; /tmp/261113-8yn-characterization-0881.tap |
| Detailed focused launch command with final positive tests on intact 0.88.0 | 1 expected | Exactly two ambient cases failed on __none__ versus undefined; four controls passed, 0 skip; /tmp/261113-8yn-positive-old-red.tap |
| Detailed focused launch command with final positive tests on restored 0.88.1 | 0 | 6 pass, 0 fail, 0 skip; /tmp/261113-8yn-positive-new-green.tap |
| node --import ./test/platform/isolated-pi-home.ts --test test/architecture/peer-floor.test.ts test/integration/agents-adapter-grant-conformance.test.ts test/integration/adapter-tool-name-conformance.test.ts | 0 | All three modules passed; /tmp/261113-8yn-focused-conformance.tap |
| env -u PG_COMPANION_INDEX -u PG_AGENT node .planning/debug/artifacts/real-child-mcp-automation/run.mjs | 0 | All three actual children passed; /tmp/261113-8yn-real-child-0881.log |
| npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature | 0 | 14 scenarios, 210 steps passed; /tmp/261113-8yn-agent-grants-adapter.log |
| npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature | 0 | 6 scenarios, 95 steps passed; /tmp/261113-8yn-agent-grants-builtin.log |
| Seed status/trigger assertion; git diff --check | 0 | status completed; trigger_when none; no whitespace errors |

The detailed focused command is node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap test/integration/pi-subagents-child-launch-conformance.test.ts. The old-version switch ran in a fresh process with matching temporary suite JSON and an intact saved cache. A finally trap restored the 0.88.1 cache and suite JSON; both versions were checked before the final green run.

The real-child fixture is /tmp/pg1-live-companion-pHdbmd. Its summary.json contains every provider tool inventory; drive.out records completion, output, and provider requests; server-home/harness/mcp-stub-requests.jsonl records actual tools/call requests. demo:runner made two requests offering only mcp__plugin_demo_stub__echo and received echo:pg1-live-short. demo:control made three requests offering the short and mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c tools, called long, and received echo:pg1-live-long-control. demo:restricted made three requests offering short and omitting long, called short, and received echo:pg1-live-restricted. All three statuses were complete. AGTLONGNAME-01 remains a separate explicit-grant defect.

## Hook Results and Issues Encountered

Task 1's first normal-hook commit attempt stopped because documentation changed while check:commit was running. The staged files remained intact. The retry ran with no concurrent edits: typecheck, ESLint, Fallow, format, feature, unpaired-test, and direct-coverage checks passed, then the normal commit completed. Task 2 and Task 3 normal hooks passed; they staged documentation only, so npm-check had no files to check. No hook was skipped with --no-verify. No parent full gate was run in this isolated worktree, as instructed.

## Decisions Made

- Keep the general optional peer floor at >=0.87.0 because the adopted behavior uses no new companion API. Document 0.88.1 as the minimum for ambient direct MCP tools.
- Leave PG-MCP-02 unchecked and the Phase 1 active override/deferred entry in place until the parent's combined-tree gate passes. This summary's status: complete means the executor's three tasks are complete.

## Deviations from Plan

None — the plan's product and evidence scope was executed as written. The first hook attempt and normal retry are recorded above.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was introduced.

## Parent Handoff

The parent must review and merge these three commits into features/gaps without rewriting history, then run npm run check in the parent checkout with the configured 2400-second limit. A failure or timeout is not acceptance. Record command, exit status, merged commit, Node version, and log path. The 0.88.0 gate cannot cover this change.

Only after that gate passes:

1. Check PG-MCP-02 in REQUIREMENTS.md and mark its traceability row Complete, citing this runtime proof and the combined-tree gate.
2. In 01-VERIFICATION.md, retire only the AGTAMBIENT-01 active override and deferred entry; retain dated history and label the new evidence a PG-MCP-02 adoption supplement. Keep the old verification date, score, and fingerprint.
3. In the seed, BACKLOG AGTAMBIENT-01, and 01-UAT.md, replace final-gate-pending wording with the actual gate reference. Keep the seed completed with trigger_when none.
4. Add a dated Phase 1 adoption note to STATE.md: 0.88.1 passed six launch checks and all three real-child controls; PG-MCP-02 was accepted after the cited full check; AGTLONGNAME-01 and PG1-TIMING-01 remain. Preserve Phase 2 position and audits.
5. Add a brief superseding adoption note with this summary link to ROADMAP.md. Preserve the dated 2026-11-12 closeout and other phase entries.
6. Add the final gate and acceptance amendments to this summary. Planning-only changes may reuse the passing gate only under the local-verification unchanged-input rule.

No merge, push, PR, version bump, or release was performed by this executor.

## Self-Check: PASSED

All 14 declared changed files exist, the three task commits descend from the starting head, the seed assertion passes, both cache and suite pin are 0.88.1, and the worktree was clean before this summary write.
