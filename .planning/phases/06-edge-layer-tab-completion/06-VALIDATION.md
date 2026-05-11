---
phase: 6
slug: edge-layer-tab-completion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 6 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in to Node >=22) |
| **Config file** | None -- `node --test "tests/**/*.test.ts"` |
| **Quick run command** | `node --test "tests/edge/**/*.test.ts" "tests/shared/completion-cache.test.ts"` |
| **Full suite command** | `npm test` (== `node --test "tests/**/*.test.ts"`) |
| **Estimated runtime** | ~5s quick / ~30-45s full (current ~592 tests + ~80-120 Phase 6 additions) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (typically <5 seconds)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full `npm run check` (typecheck + ESLint + Prettier + tests) must be green
- **Max feedback latency:** <5s quick / <60s full

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| AP-1 | Tokenizer handles single/double quotes, no escapes | unit | `node --test tests/edge/args.test.ts` | W0 | pending |
| AP-2 | `--scope` validation: invalid value throws | unit | `node --test tests/edge/args.test.ts` | W0 | pending |
| AP-3 | Router emits Usage on empty/unknown subcommand | unit | `node --test tests/edge/router.test.ts` | W0 | pending |
| AP-4 | `--scope` accepted at any position | unit | `node --test tests/edge/args.test.ts` | W0 | pending |
| TC-1 | First positional -> top-level keywords | unit | `node --test tests/edge/completions/provider.test.ts` | W0 | pending |
| TC-2 | After `marketplace` -> nested keywords (`rm` accepted but not surfaced) | unit | `node --test tests/edge/completions/provider.test.ts` + `node --test tests/edge/router.test.ts` (for `rm` routing) | W0 | pending |
| TC-3 | `-`/`--` prefix -> flags | unit | `node --test tests/edge/completions/provider.test.ts` | W0 | pending |
| TC-4 | After `--scope` -> `user`/`project` | unit | `node --test tests/edge/completions/provider.test.ts` | W0 | pending |
| TC-5 | `list <here>` / `marketplace <verb> <here>` -> marketplace names from cache | integration | `node --test tests/edge/completions/provider.test.ts` | W0 | pending |
| TC-6 | `install/uninstall/update <here>` -> status-aware `<plugin>@<marketplace>` | integration | `node --test tests/edge/completions/provider.test.ts` | W0 | pending |
| TC-7 | Fish-style whitespace normalization scoped to `/claude:plugin` | unit | `node --test tests/edge/completions/normalize.test.ts` | W0 | pending |
| TC-8 | Manifest soft-fail per-marketplace -> empty list, no throw | integration | `node --test tests/shared/completion-cache.test.ts` + `node --test tests/edge/completions/provider.test.ts` | W0 | pending |
| TC-9 | state.json error propagates | integration | `node --test tests/shared/completion-cache.test.ts` + `node --test tests/edge/completions/provider.test.ts` | W0 | pending |
| D-02 | Two LLM tools registered; PL-1 union filter semantics | unit | `node --test tests/edge/handlers/tools.test.ts` | W0 | pending |
| D-03-INV | Each mutating orchestrator fires cache invalidation post-state-commit | integration | `node --test tests/orchestrators/marketplace/{add,remove,update}.test.ts tests/orchestrators/plugin/{install,uninstall}.test.ts` | exists; MODIFY | pending |
| D-03-TTL | 10-min TTL re-reads file on plugin index | unit | `node --test tests/shared/completion-cache.test.ts` (clock-injected `now: () => number`) | W0 | pending |
| D-04 | `registerClaudePluginCommand` + `registerClaudeMarketplaceTools` wire up correctly | unit | `node --test tests/edge/register.test.ts` (mock `pi`) | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All Phase 6 test files are NEW. Wave 0 (test scaffolding) MUST create:

- [ ] `tests/edge/args.test.ts` -- covers AP-1, AP-2, AP-4
- [ ] `tests/edge/args-schema.test.ts` -- covers schema-driven positional validation
- [ ] `tests/edge/router.test.ts` -- covers AP-3 + dispatch routing (including `rm` alias)
- [ ] `tests/edge/completions/provider.test.ts` -- covers TC-1..6
- [ ] `tests/edge/completions/normalize.test.ts` -- covers TC-7 + `isClaudePluginCommandLine` regex
- [ ] `tests/shared/completion-cache.test.ts` -- covers cache primitives + TC-8, TC-9 + TTL with clock injection
- [ ] `tests/edge/handlers/plugin/{install,uninstall,update,list}.test.ts` -- shim parse + delegate
- [ ] `tests/edge/handlers/marketplace/{add,remove,list,update,autoupdate}.test.ts` -- shim parse + delegate
- [ ] `tests/edge/handlers/tools.test.ts` -- LLM tool execute bodies + filter logic
- [ ] `tests/edge/register.test.ts` -- Pi `registerCommand`/`registerTool`/`on(session_start)` integration with mock `pi`

No new framework install needed -- `node:test` already used through Phases 1-5.

**Clock injection seam:** The cache module accepts a `now: () => number` parameter (default `Date.now`) so the TTL test can inject a fake clock without requiring Node >=23's `t.mock.timers`. This keeps the Node floor at 22 per the project's `engines` pin.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live `/claude:plugin` slash command typing in a real Pi session (autocomplete behavior, fish-style whitespace collapse, Usage emission rendering) | AP-3, TC-1..9 (end-to-end UX) | Pi-tui rendering and the autocomplete keystroke loop are not exercised by `pi.registerCommand`+`pi.registerTool` unit tests; the in-process mock `pi` proves the wiring, not the rendered behavior | After Wave 4 merges and Phase 7 wires `index.ts`, launch Pi, type `/claude:plugin ` (trailing space), confirm top-level keywords appear; type `marketplace `, confirm nested keywords appear; type `--scope `, confirm `user` / `project` appear; type `install some-plugin@`, confirm `<marketplace>` completion list; double-space anywhere, confirm collapse. Note: this is mostly a Phase 7 verification, but the autocomplete provider lifecycle is owned by Phase 6's `register.ts` |
| Real LLM-agent invocation of `claude_marketplace_list` and `claude_marketplace_plugin_list` | D-02 | Tool registration and execute bodies are unit-tested, but the LLM agent's call-shape (param marshaling, response rendering in chat) is end-to-end | After Phase 7 wires Pi, ask the agent "list configured marketplaces" and "list installed plugins in <marketplace>", confirm the tool fires and returns the expected line-format text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (10 new test files listed above)
- [ ] No watch-mode flags (all commands single-shot)
- [ ] Feedback latency <5s quick / <60s full
- [ ] `nyquist_compliant: true` set in frontmatter after planner finishes per-task mapping

**Approval:** pending
