# Live baseline — 2026-09-14

Runtime: Node v26.8.2. Branch: features/test-backlog.

- Unit suite outside the sandbox: 6003 tests, 6003 pass, 0 fail, 0 skipped.
- Production unit LCOV: 227 records, lines 63345/63349, functions 1851/1851,
  branches 9112/9113. Sole shortfall: bridges/agents/convert.ts (4 lines, 1 branch).
- This differs from the handoff's 100% baseline. The current pin documents an
  unreachable AG-11 toolsFields guard added by the issue-179 correction. Phase 3
  must restore exact 100% by legitimate production restructuring, without test
  weakening, exclusions or reduced thresholds.
- Import e2e: 3 pass, 0 fail with PI_CODING_AGENT_DIR removed.
- Fallow 3.22.0 production probe: 111 findings, awaiting individual triage.
- Direct negative control reproduces empty stderr under sandboxed pipe capture.
  The same tiny sentinel and invalid-path CLI capture expected stderr outside
  the sandbox. Default spawnSync also reports EPERM, which the old assertion
  ignores. Setting stdin to ignore alone does not restore stderr.

The aggregate unit report includes test/support files too. The production
figures above filter only extensions/pi-claude-marketplace, matching Sonar's
TypeScript source surface. Direct-pair pins remain a distinct measurement.
