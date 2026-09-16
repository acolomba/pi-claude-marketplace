---
quick_id: 260914-pbr
slug: interactive-plugin-browser
date: 2026-09-14
status: complete
type: execute
subsystem: edge/browser
tags: [browser, picker, tui, selectlist, claude-code-parity, pr-152]
requires:
  - "@earendil-works/pi-tui for SelectList component and keyboard navigation"
  - "@earendil-works/pi-coding-agent >= 0.80.5"
provides:
  - "Interactive 4-screen browser for marketplaces, plugins, actions, and install scopes"
  - "Bare `/claude:plugin` and `/claude:plugin browse` default to the interactive browser in TUI mode"
  - "Graceful non-TUI fallback to `/claude:plugin list`"
  - "100% direct line, branch, and function coverage on all added browser code"
affects:
  - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
tech-stack:
  added: []
  patterns:
    - "Injected plugin loader decouples the UI component from extension runtime state"
    - "Four-screen finite state machine (marketplaces -> plugins -> actions -> scope)"
    - "Action dispatch constructs standard command arguments and forwards them to existing edge handlers"
key-files:
  created:
    - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - demos/browse-demo.ts
    - demos/run-browse-demo.sh
    - tests/edge/browser/plugin-browser.test.ts
    - tests/edge/handlers/plugin/browse.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - tests/edge/completions/provider.test.ts
    - tests/edge/router.test.ts
    - .fallowrc.json
    - CHANGELOG.md
    - README.md
    - README.es.md
    - docs/prd/pi-claude-marketplace-prd.md
decisions:
  - "Keep PluginBrowser decoupled from Pi runtime by injecting pluginLoader"
  - "Route bare `/claude:plugin` to browse, falling back to list in non-TUI mode"
  - "Split into four granular commits for clear auditability"
metrics:
  completed: 2026-09-14
  tasks: 4
  commits: 4
---

# Quick Task 260914-pbr: Interactive Plugin Browser Summary

Implemented an interactive picker UI for `/claude:plugin` matching Claude Code's `/plugin` command.

## Key Outcomes

- **Interactive Browser**: Built `PluginBrowser` with `@earendil-works/pi-tui` `SelectList`, featuring a 4-screen flow:
  1. Marketplaces: browse configured marketplaces.
  2. Plugins: view plugins with status tags and descriptions.
  3. Actions: context-filtered actions (`Install`, `Enable`, `Disable`, `Info`, `Uninstall`).
  4. Scope: choose install scope (`Project local (Recommended)`, `Project`, `User (global)`).
- **Graceful Fallback**: `makeBrowseHandler` detects TUI mode (`ctx.mode === 'tui'`). In non-interactive mode, it forwards to `list`.
- **Direct Test Coverage**:
  - `plugin-browser.ts`: 100% lines (478/478), 100% branches (94/94), 100% functions (41/41).
  - `browse.ts`: 100% lines (188/188), 100% branches (35/35), 100% functions (15/15).
  - All 27 browser and handler tests pass.
- **Verification Gates**:
  - `npm run typecheck`: clean
  - `npm run lint`: clean
  - `npm run fallow`: clean
  - `npm run format:check`: clean
  - `npm run test:corresponding`: clean
  - `node scripts/test-coverage-direct.mjs --base upstream/main`: clean (0 unpinned shortfalls)
