# workflows-detection — Workflow Detection

**Milestone:** `workflows-detection`

## Overview

Workflow Detection finds declared and conventional workflow components. Affected plugins become partially available and show the exact `{workflows}` reason. With `--partial`, the extension installs only supported components and never materializes or executes workflows.

The six requirements form one resolver-to-install workflow, so standard granularity keeps them in one phase.

## Phases

**Phase numbering:** Phase 106 continues the global sequence after the completed Phase 105.

- [x] **Phase 106: Workflow Detection and Partial Install** - Users can identify workflow-bearing plugins and install only their supported components with explicit consent. (completed 2026-08-29)

## Phase Details

### Phase 106: Workflow Detection and Partial Install

**Goal**: Users can identify plugins that contain unsupported workflows and install only their supported components with explicit `--partial` consent.
**Depends on**: Phase 105
**Requirements**: WDET-01, WDET-02, WDET-03, WDET-04, WDET-05, WDET-06
**Success Criteria** (what must be TRUE):

  1. Marketplace entries and `plugin.json` files that declare `workflows` load successfully and expose the declaration to the resolver.
  2. The resolver finds conventional `<pluginRoot>/workflows/` directories without declarations, including the current `claude-security` and `code-modernization` layouts.
  3. `list`, `info`, install rejection, and all other unsupported-reason outputs show affected plugins as `(partially-available) {workflows}`.
  4. A normal install rejects an affected plugin. `--partial` installs only its supported components.
  5. After `/reload`, supported artifacts work, but Pi has no materialized workflow files and does not execute workflows.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 106-01-PLAN.md - Resolver-to-install tracer with workflow classification, exact reason output, partial consent, and structural precedence

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 106-02-PLAN.md - Opaque schema admission plus strict and loose resolver coverage
- [x] 106-03-PLAN.md - Rejection, rollback, retry, persistence, and no-materialization boundaries

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 106-04-PLAN.md - Cross-surface reason parity, byte-level catalog contracts, and full phase gates

**UI hint**: yes

## Progress

**Execution Order:** Phase 106

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 106. Workflow Detection and Partial Install | 4/4 | Complete    | 2026-08-29 |
