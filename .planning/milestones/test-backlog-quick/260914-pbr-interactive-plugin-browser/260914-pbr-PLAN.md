---
quick_id: 260914-pbr
slug: interactive-plugin-browser
date: 2026-09-14
status: planned
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: ["#152", "TC-1", "AP-3"]
files_modified:
  - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - demos/browse-demo.ts
  - demos/run-browse-demo.sh
  - tests/edge/browser/plugin-browser.test.ts
  - tests/edge/handlers/plugin/browse.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/router.test.ts
  - .fallowrc.json
  - CHANGELOG.md
  - README.md
  - README.es.md
  - docs/prd/pi-claude-marketplace-prd.md
estimate:
  tokens: 40000
  raw_tokens: 40000
  tasks: 4
  confidence: high
must_haves:
  truths:
    - "`npm run check` exits 0 against the working tree"
    - "Direct coverage gate achieves 100% lines, branches, and functions for plugin-browser.ts and browse.ts"
    - "Four clean commits exist on `features/plugin-browser` separating feature, tests, docs, and quick-task artifacts"
  artifacts:
    - "Interactive 4-screen SelectList browser component in `extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts`"
    - "Browse command handler with TUI guard and non-interactive list fallback in `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts`"
    - "Full unit tests in `tests/edge/browser/plugin-browser.test.ts` and `tests/edge/handlers/plugin/browse.test.ts`"
---

# Quick Task 260914-pbr: Interactive Plugin Browser

Deliver the interactive `/claude:plugin browse` picker and bare `/claude:plugin` entrypoint
mirroring Claude Code's `/plugin` command.

## Scope

1. **Pure UI component**: `PluginBrowser` uses `@earendil-works/pi-tui` SelectList across four screens:
   - Screen 1: Marketplaces list
   - Screen 2: Plugins list with status badges (`[installed]`, `[available]`, `[disabled]`, `[partially-available]`)
   - Screen 3: Action picker (Install, Enable, Disable, Info, Uninstall)
   - Screen 4: Scope selector (Project local, Project, User)
2. **Edge handler & routing**:
   - `makeBrowseHandler` checks `ctx.mode === 'tui'`
   - Interactive mode delegates to `ui.custom`
   - Non-interactive mode falls back to `list`
   - Bare `/claude:plugin` routes to browse
3. **Platform chokepoint**:
   - `platform/pi-api.ts` exports `DynamicBorder` and `Theme`
4. **Testing**:
   - 100% direct line, branch, and function coverage on both `plugin-browser.ts` and `browse.ts`
