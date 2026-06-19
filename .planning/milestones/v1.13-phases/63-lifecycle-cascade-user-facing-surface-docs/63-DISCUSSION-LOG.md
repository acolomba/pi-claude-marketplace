# Phase 63: Lifecycle Cascade, User-Facing Surface & Docs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 63-Lifecycle Cascade, User-Facing Surface & Docs
**Areas discussed:** Hook staging mechanics (LIFE-01/03), info <plugin> hooks line format (SURF-01), HookSummary type shape (SURF-02), SURF-05 warning + docs/hooks.md (SURF-06)

---

## Hook staging mechanics (LIFE-01/03)

### Q1: 5th bridge slot position

| Option | Description | Selected |
|--------|-------------|----------|
| `[skills, commands, agents, hooks, mcp, state]` | Slot hooks between agents and mcp; state stays last. Mirrors SURF-01 alphabetical render order. | ✓ |
| `[skills, commands, agents, mcp, hooks, state]` | Append hooks after mcp; preserve existing 4-bridge order. | |
| Alphabetical `[agents, commands, hooks, mcp, skills]` then state | Fully sort. Breaks D-01 PRD-fixed sequence. | |

**User's choice:** `[skills, commands, agents, hooks, mcp, state]` (Recommended)
**Notes:** Slot position aligned with SURF-01 alphabetical info-render position keeps cascade-position and render-position consistent.

### Q2: Staging mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Direct atomic-write -- no staging dir | Single tmp+rename per atomic-json pattern. Smaller surface for the one-file-per-plugin artifact. | ✓ |
| Mirror agents bridge two-phase commit | Staging dir + atomic tree rename. Uniform with agents/skills/commands. | |
| In-state-only -- no on-disk write | Conflicts with event-router hydrate path. | |

**User's choice:** Direct atomic-write (Recommended)
**Notes:** Hooks have ONE file per plugin (vs N skills/agents); multi-file staging adds LoC without safety benefit. Commit = rename; unstage = rmdir; matches NFR-1.

### Q3: Symlink-escape check placement

| Option | Description | Selected |
|--------|-------------|----------|
| At install only -- per-handler walk in stage.ts | Inside hooksPhase.do; ledger unwinds on first escape. | initially recommended |
| At install AND dispatch-exec spawn | Defense in depth; doubles realpath surface. | |
| At dispatch only -- lazy check on first fire | Violates REQ "rejected at install". | |

**Reformulation Q3a: Containment scope** (after user clarified upstream semantics)

| Option | Description | Selected |
|--------|-------------|----------|
| Walk `pluginRoot/hooks/` subtree, reject any symlink whose realpath escapes | Single FS walk over plugin's bundled hooks dir. Independent of command-string parsing. | ✓ |
| Parse each command, expand `${CLAUDE_PLUGIN_ROOT}`, only realpath tokens inside pluginRoot | Closer to REQ literal wording. Needs shell tokenizer; misses transitive `source ./helper.sh` from inside scripts. | |
| Both -- subtree walk AND per-command expansion check | Defense in depth. Duplicate work. | |

**User's choice:** Subtree walk over `pluginRoot/hooks/`
**Notes:** User pointed out upstream semantics -- cwd=CLAUDE_PROJECT_DIR (not pluginRoot), absolute paths allowed, $PATH applies, `${CLAUDE_PLUGIN_ROOT}` interpolation is the plugin-relative idiom. The threat model is plugin shipping a symlink-escape script; subtree walk catches this without rejecting legitimate system-tool references.

---

## info <plugin> hooks line format (SURF-01)

### Q1: Hook row shape

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-line block: `hooks:` header then one indented entry per line | Per-entry on own line; preserves declaration order; scales to security-guidance-style plugins. | ✓ |
| Single line: `hooks: PreToolUse(Bash), PostToolUse(Edit), SessionStart` | Symmetrical with skills/commands/agents/mcp. Loses readability for long matchers. | |
| Grouped by event: one line per unique event with matcher list | Condenses repeated events. Loses declaration order. | |

**User's choice:** Multi-line block (Recommended)
**Notes:** Hook entries carry more structure than skill/command name atoms; multi-line format keeps long matcher patterns readable.

### Q2: Inline handler-field flags

| Option | Description | Selected |
|--------|-------------|----------|
| Event + matcher only -- omit all flags | Terse. Matches REQ literal wording. | ✓ |
| Event + matcher + `[async]` marker for asyncRewake | Surfaces fire-and-forget vs blocking distinction. | |
| Event + matcher + every declared optional field | Maximum info. Clutters catalog. | |

**User's choice:** Event + matcher only ("don't render those")
**Notes:** Plugin authors who need detail read source hooks.json; end users don't need it. Locks catalog grammar to no new per-flag tokens.

---

## HookSummary type shape (SURF-02)

### Q1: Discriminated union shape

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated by event class -- matcher required iff tool event | Compiler statically pins matcher-with-tool-event; assertNever arm pins NFR-7. | ✓ |
| Flat -- matcher always optional | Simplest; weakens v1.4 "no string re-derivation" guarantee. | |
| Per-event variant -- 8 arms | Tightest typing; over-engineered for v1.13. | |

**User's choice:** Discriminated by event class (Recommended)
**Notes:** Statically eliminates the v1.3 string-API failure mode. Reuses Phase 58's BUCKET_A_EVENTS / TOOL_EVENTS tuples.

### Q2: Carrier seam in PluginInfoMessage

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `components.hooks?: readonly HookSummaryEntry[]` | 5th member of components; COMPONENT_KINDS 4-tuple becomes 5-tuple. | ✓ |
| New sibling field `hookSummary?: HookSummary` | Separate from components. Breaks SURF-01 "alphabetical between commands and mcp" symmetry. | |
| Both seams | Two sources of truth. | |

**User's choice:** Extend `components.hooks?` (Recommended)
**Notes:** Aligns with SURF-01's alphabetical-between-commands-and-mcp implication. Single renderer seam.

---

## SURF-05 warning + docs/hooks.md (SURF-06)

### Q1: SURF-05 warning emission

| Option | Description | Selected |
|--------|-------------|----------|
| Per-plugin row token in existing install cascade | New REASONS token on success row; one row per plugin. | ✓ |
| Standalone notify() warning call | Breaks RECON-04 / IL-2 single-notify-per-orchestrator. | |
| Debug-log only | Violates REQ "emits one install-time warning". | |

**User's choice:** Per-plugin row token in existing cascade (Recommended)
**Notes:** Rides v1.4 NotificationMessage cascade; one row per plugin regardless of N orphan handlers.

### Q2: REASONS token wording

| Option | Description | Selected |
|--------|-------------|----------|
| `"orphan rewake fields"` | Initial proposal. | |
| `"missing asyncRewake"` | Names absent field directly. | |
| `"rewake config"` | Shortest; ambiguous. | |

**Reformulation Q2a (after user clarified what "orphan" indicates):**

**User's choice:** `"orphan rewake"` (user proposed)
**Notes:** User clarified the orphan-field concept -- a child field whose required parent (asyncRewake: true) is missing. The picked token `"orphan rewake"` is concise, names the upstream Command-hook-fields "rewake" family, and signals the parent-missing relationship without verbose qualifier.

### Q3: docs/hooks.md section ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Events-first -- supported -> examples -> unsupported -> mappings -> what-happens | Plugin author reads top-down; CLI user jumps via TOC. | ✓ |
| Use-cases-first -- examples upfront | Optimizes for "I want to do X" framing; weakens CLI-user diagnostic path. | |
| Diagnostic-first -- what-happens + unavailable up top | Optimizes for end-user landing; inverts plugin author's natural order. | |

**User's choice:** Events-first (Recommended)
**Notes:** Both target readers benefit from reference-style reading order; CLI-user diagnostic path via TOC.

### Q4: Worked examples set

| Option | Description | Selected |
|--------|-------------|----------|
| Top 5: drop compaction snapshot | Cover all distinct bucket-A patterns; balanced doc length. | |
| All 6 -- ship every REQ candidate | Maximum coverage including niche PreCompact. | ✓ |
| Minimum 4: drop UserPromptSubmit + PreCompact | Tightest doc; weakest non-tool-event coverage. | |

**User's choice:** All 6 candidates
**Notes:** Doc's value compounds with breadth; each example covers a distinct event pattern.

### Q5: Authority docs cross-referenced

| Option | Description | Selected |
|--------|-------------|----------|
| Upstream Claude Code hooks reference + project audited research doc | Upstream truth + project-specific decisions. | |
| Upstream + REQUIREMENTS.md | REQUIREMENTS.md is REQ-jargon-heavy; banned by SURF-06. | |
| Upstream + Pi extension API docs | Upstream truth + host runtime injection model. | ✓ |

**User's choice:** Upstream + Pi extension API docs
**Notes:** Anchors plugin authors building asyncRewake hooks in Pi's actual injection model. Plugin authors building asyncRewake hooks particularly benefit (the "Re-evaluating after..." injection model is a Pi-side concept).

---

## Claude's Discretion

Areas where the planner / executor has flexibility:

- Stage / commit / unstage function signatures inside `bridges/hooks/stage.ts` (mcp-bridge verb pattern vs flatter writeHookConfig / removeHookConfig).
- TypeBox runtime schema for `HookSummary` -- compile-time type only in v1.13.
- Per-plugin hooks-subtree walk implementation (`fs.readdir({recursive})` vs hand-rolled).
- Orphan-rewake detection site -- resolver vs install orchestrator.
- README.md "Hook support" section placement (alphabetical near component-kind docs vs sibling of "Configuration files").
- Per-event description wording in docs/hooks.md (plain English, no internal jargon).
- Per-worked-example doc length (~15-30 lines each).
- catalog-UAT row landing -- atomic with REASONS token addition per D-58-01.
- Phase 62 manual-only verifications carry-forward (live /reload orphan reap, exit-code-2 observability, rewakeSummary UI visibility).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:

- SURF-03 install-time `<lossy synthesis>` warnings (v1.14+ with bucket-D promotion)
- Standalone `/claude:plugin hooks <plugin>` command (perma-deferred per SURF-04)
- `list` hook-count column (perma-deferred per SURF-04)
- Per-handler info render flags `[async]`, `[timeout: 30s]` (v1.14+)
- `HookSummary` runtime schema validator (v1.14+ if ingest surface emerges)
- Cross-plugin orphan-rewake aggregation (v1.14+)
- Hook author scaffolder / init-hooks command (v1.14+)
- i18n for docs/hooks.md (post-v1.x per IL-1)
- In-line catalog cross-link from docs/hooks.md to output-catalog.md row (v1.14+)

## Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md` (score 0.6) -- coverage sweep on mutating orchestrators. Mechanically overlaps Phase 63's 5th-cascade-slot touch but is its own testing-focused concern. Carries forward as a future testing-phase candidate.
