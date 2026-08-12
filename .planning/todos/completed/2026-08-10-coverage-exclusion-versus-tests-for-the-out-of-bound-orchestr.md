---
created: 2026-08-10T17:40:00.000Z
title: "Coverage: exclusion versus tests for the out-of-bound orchestrators"
area: testing
files:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - sonar-project.properties
---

## Problem

The 2026-06-12 sweep carrier left one question explicitly open: does
`orchestrators/edge-deps.ts` (dependency-injection wiring, then measured at
49.7%) earn tests or a `sonar.coverage.exclusions` entry in
`sonar-project.properties`? That question sat outside the bound D-99-05b
locked (update / reinstall / install only), so it was re-filed here rather
than answered inside a diff that could not carry it.

A fresh unit-coverage run on 2026-08-10 changes the premise:

| File | Line % | Uncovered lines | 2026-06-12 capture |
| --- | --- | --- | --- |
| orchestrators/edge-deps.ts | 100.00 | 0 | 49.7%, 94 uncovered |
| orchestrators/import/execute.ts | 94.53 | 59 | 94.1%, 34 uncovered |
| orchestrators/marketplace/update.ts | 95.49 | 50 | 93.7%, 49 uncovered |

`edge-deps.ts` is fully covered. Whatever landed between the two captures
answered the question by measurement: no exclusion is needed, and adding one
now would exclude a module that already carries real tests.

## Solution

Two things remain to decide, neither of them inside the closed bound.

**1. The exclusion policy itself.** Record the reasoning, not just the verdict,
because the next low-coverage wiring module will raise the same question. A
`sonar.coverage.exclusions` entry raises the reported percentage without
executing one additional line: the excluded file's uncovered arms are still
uncovered, they simply stop being counted. That trades a true statement about
the tree for a flattering one, and it does it silently — a later reader sees a
high number and infers safety the tests do not provide. An exclusion is
defensible only for code that genuinely cannot regress in a way tests would
catch (generated files, type-only declarations). Wiring glue does not qualify:
a mis-wired dependency is exactly the defect an integration test catches. So
the default answer is tests, and any exclusion should carry its justification
in `sonar-project.properties` next to the entry.

**2. The two remaining orchestrators.** `import/execute.ts` (59 uncovered) and
`marketplace/update.ts` (50 uncovered) were named by the original carrier but
sit outside D-99-05b. Their uncovered remainder is the same shape as the one
the bounded sweep worked — rare failure and cascade-diagnostic arms. Decide
whether they get a follow-on bounded sweep or are accepted as-is; do not decide
it by exclusion.
