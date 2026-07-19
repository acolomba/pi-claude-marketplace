---
created: 2026-06-12T19:18:17.524Z
title: "Coverage sweep: test rare failure arms in update/reinstall/install"
area: testing
files:
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
---

## Problem

Deferred 2026-06-12 (post PR #51 sonar pass). Overall coverage is 95.9%
(line 96.7%, branch 90.5%, ~876 uncovered lines). The uncovered remainder
clusters in rare failure/rollback arms of the mutating orchestrators —
exactly the paths where a silent regression hurts most. SonarCloud
per-file standings at time of capture:

| File | Coverage | Uncovered lines |
| --- | --- | --- |
| orchestrators/edge-deps.ts | 49.7% | 94 |
| orchestrators/plugin/update.ts | 87.9% | 213 |
| orchestrators/plugin/reinstall.ts | 93.1% | 83 |
| orchestrators/plugin/install.ts | 93.4% | 77 |
| orchestrators/marketplace/update.ts | 93.7% | 49 |
| orchestrators/import/execute.ts | 94.1% | 34 |

## Solution

Targeted sweep, biggest absolute chunks first: update.ts failure arms
(three-phase update rollback paths), then reinstall.ts / install.ts /
marketplace/update.ts / import/execute.ts. Separately decide whether
orchestrators/edge-deps.ts (DI wiring glue, 49.7%) gets tests or a
`sonar.coverage.exclusions` entry in sonar-project.properties — an
exclusion inflates the metric without adding safety, so make it an
explicit call. Estimated landing point: ~97% overall.
