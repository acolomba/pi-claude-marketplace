# Feature Research — v1.13 Claude Hook Bridge

**Domain:** Hook/event-translation bridge inside an existing Pi extension; user-facing surface for a new `hooks` plugin component type alongside the v1.0–v1.12 skills / commands / agents / mcpServers bridges.
**Researched:** 2026-06-13
**Confidence:** HIGH (grounded in `docs/research/claude-hooks-vs-pi-events.md` authority; existing v1.0–v1.12 catalog and notify-types; Claude Code hook docs at `code.claude.com/docs/en/hooks`; live pi-coding-agent `types.d.ts`; pi-subagents / pi-mcp-adapter / pi-worktrees source audits dated 2026-06-13).

## Orientation: the bridge inherits an existing user surface

This is a **subsequent milestone** in a shipped extension. The relevant ecosystem is not "general event-routing tools" — it is the existing `pi-claude-marketplace` user surface (v1.0–v1.12) plus Claude Code's own hook contract. Three framing facts drive every feature decision below:

1. **The bridge is read-only at runtime.** `pi.on(...)` returns `void` (verified in `types.d.ts`); there is no unsubscribe. Every install / uninstall / enable / disable goes through `/reload`, exactly like v1.12. No live hot-swap surface is even possible — so any feature that implies one is structurally an anti-feature.
2. **The hook surface MUST FEEL like the existing four bridges.** Subject-first row grammar (`<glyph> <name> [scope] (status) {reason}`), closed-set tokens, `notify(ctx, pi, message)` chokepoint, soft-dep markers via `dependencies` field at render time, byte-locked catalog UAT (`docs/output-catalog.md`). The hooks surface extends the existing renderer; it does not invent new shapes.
3. **The authority doc has already locked the wire-level scope.** 16 supported events (bucket A direct, B/D synthesized, A/B soft-dep), 9 upstream-fixable blockers (E/F/G), 5 H-bucket silently dropped. The user-facing surface decisions are about **how the user sees** that scope — what `info` shows, what install warns on, what `list` exposes — not which events to support.

The dominant external precedent is **Claude Code's own `/plugin` surface**, because the v1.0 PRD intentionally aligned `/claude:plugin` with `/plugin`. Where Claude Code shows or hides hook detail, the bridge should default to matching unless a Pi-specific concern justifies deviation. The secondary precedent is the existing v1.8 `info` and `list` surfaces in this codebase — the new hook surface must compose under the same `MarketplaceNotificationMessage` / `PluginInfoMessage` discriminated unions, not bolt a parallel one on the side.

## Feature Landscape

### Table Stakes (Users Expect These)

Features the bridge would feel incomplete without. Maps to the seven question-areas in the research brief.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **`info <plugin>@<marketplace>` shows a `hooks:` section** | The existing info surface lists `agents:`, `commands:`, `mcp:`, `skills:`. Adding a fifth component type without surfacing it in `info` would silently hide install-time decisions. v1.8's catalog already locks per-kind alphabetical ordering (`agents, commands, mcp, skills`); `hooks` inserts cleanly between `commands` and `mcp`. | LOW | Extends `composeResolvedComponents` in `orchestrators/plugin/info.ts`. Hook entries are read from each plugin's `hooks/hooks.json` (per the authority doc's State Layout). The line lists one entry per hook config row in declaration order, keyed on the Claude event name: `hooks: SessionStart, PostToolUse:Edit\|Write, Stop`. Matcher rendered as `:literal` or `:literal\|literal` when present. No new orchestrator file; reuses the existing `PluginInfoRow` shape with one extra optional `hooks?: readonly string[]` field on the per-kind components block. |
| **`info` row carries a per-hook soft-dep marker when the hook's target event is gated** | The existing soft-dep mechanism (per-row `{requires pi-subagents}` / `{requires pi-mcp}`) is the canonical way the bridge tells the user "this row's behavior is conditional on a companion extension." Subagent hooks (`SubagentStart` / `SubagentStop`) already have a `requires pi-subagents` story; the user must see it on the same surface they see for skills/agents/MCP. | LOW–MEDIUM | The hook entry's target Pi event determines the marker (`SubagentStart` / `SubagentStop` → `{requires pi-subagents}` when probe reports unloaded). For G-bucket events (Elicitation, WorktreeCreate/Remove) the v1.13 bridge does NOT register a dispatcher at all — so they do NOT appear in the per-row marker surface. They surface separately as a `(unavailable)` row reason — see next feature. The bridge reuses the existing `Dependency` union and `softDepStatus(pi)` probe; no new tokens. |
| **`info` row reasons brace surfaces non-fireable hooks via the closed-set REASONS** | The `(unavailable)` plugin row already uses closed-set reasons (`{hooks}`, `{lsp}`, `{unsupported source}`). v1.13 moves `hooks` OUT of `(unavailable)`-reason space (the plugin becomes installable), but a per-hook row in the `hooks:` line needs a way to mark "this hook is parsed but never fires" — H-bucket and G-bucket entries. Without it, the user has no offline way to learn that a configured hook is dead. | MEDIUM | Use a parenthetical suffix on the per-entry hook-line tokens, not a new top-level row reason. Form: `hooks: SessionStart, Notification (never fires) {requires pi-coding-agent runtime}` and `hooks: WorktreeCreate (never fires) {requires pi-worktrees}`. H-bucket: `hooks: ConfigChange (never fires) {inapplicable to Pi}`. New REASONS members: `inapplicable to Pi`, `requires pi-worktrees`, `requires pi-mcp` (already in REASONS), `requires pi-subagents` (already in REASONS), `requires pi-coding-agent runtime`. Closed set; structurally enforced via the typebox / shared/notify.ts pattern from v1.4 / v1.10. **Doc-only-vs-info-surface decision:** putting the gating on `info` (not a debug log) is what the existing v1.8 contract leads users to expect — `info` is the read-only diagnostic surface; debug logs are for the operator, not the plugin author. |
| **`install <plugin>` install-time warning for partial-fidelity hook entries** | Existing precedent: install soft-degrades on absent companion extensions but emits a structured warning. v1.12 reconcile emits per-entry `{requires pi-subagents}` markers at reconcile-applied cascade. Hook entries that map to bucket D (lossy synthesis) or carry a hook-payload extension field (`asyncRewake` etc.) MUST surface at install or the user has no way to learn there is a caveat short of reading the README. The authority doc explicitly calls out `asyncRewake` as needing a one-shot install-time warning. | MEDIUM | Reuse the existing `notify(ctx, pi, NotificationMessage)` cascade. New `Marker` member: `<lossy synthesis>` (single token, marker grammar; positioned alongside `<autoupdate>` / `<no autoupdate>` per MSG-GR-5). New `Reason` member: `payload extension <field-name> ignored` (closed-set BUT carries a manifest field name verbatim, matching the established `{lsp}` / `{requires pi-mcp}` carve-out pattern where manifest tokens are inlined). One warning emitted per install per (event, caveat) pair, deduped across hook entries within the same plugin (matches the v1.5 UXG-02 benign-softening philosophy). |
| **`list` shows hook-using plugins identically to other plugins, with no hook-count column** | The list grammar is steady-state inventory (`PluginPresentMessage` per v1.4 SNM-15); it deliberately stays terse. Adding a hook-count column would be additive surface that no other component type gets (no skill-count column today). Symmetry preserves the catalog's invariants. | LOW | NO change to `orchestrators/plugin/list.ts` row composition. The presence of a hook component is invisible at list time — the user must run `info` to see hook detail, mirroring how `skills:` / `commands:` are invisible at list time today. **Differentiator question rejected:** the brief asks whether `list` needs a hook-count column. Verdict: anti-feature (see below). |
| **Hook execution context: cwd = Pi `ctx.cwd` snapshot at dispatch time; env mirrors Claude `CLAUDE_*` → `PI_*`; bridge-wide 60s default timeout** | Claude Code documents `cwd` as the project root at dispatch; the bridge must give plugin authors a working directory that matches their mental model. `CLAUDE_*` env vars (`CLAUDE_PROJECT_DIR`, `CLAUDE_SESSION_ID`, `CLAUDE_TOOL_NAME`, etc.) are documented hook-author API; omitting them would silently break every non-trivial hook script. A timeout is required so a hanging hook cannot wedge the Pi agent loop. | MEDIUM | `cwd`: snapshot from `pi.ctx.cwd` at dispatcher entry; do NOT use the plugin install dir (per Claude Code semantics; matches `ralph-wiggum` expectations) and do NOT use the Pi agent dir. Env: bridge spawns child with **both** the `CLAUDE_*` originals AND `PI_*` equivalents (`PI_PROJECT_DIR = CLAUDE_PROJECT_DIR = ctx.cwd`, `PI_SESSION_ID = CLAUDE_SESSION_ID`, etc.) — Claude-shaped names so hook scripts ported from Claude Code work unchanged, Pi-shaped names so Pi-native authors have a non-foreign API. Timeout: 60s bridge-wide default (mirrors Claude Code's `timeout` field default); per-hook override read from the hook entry's `timeout` field when present (Claude Code parity). NO per-plugin timeout config (would diverge from Claude Code without precedent). |
| **Hook stdout / exit-code contract round-trips JSON `{"decision": ...}` for `Stop` (canary: ralph-wiggum)** | The authority doc identifies this as **the single biggest correctness risk** — 3 of 5 first-party hook-using plugins exercise the `Stop` JSON contract, and the bridge's bucket-D synthesis for `Stop` is what makes the canary work. Without faithful round-trip of `{"decision": "block", "reason": "..."}`, `ralph-wiggum` does not loop. | MEDIUM–HIGH | Bridge's stdout parser is per-event (D-bucket-aware) and version-aware per the authority doc's "Return-shape evolution risk" note. For `Stop`: parse stdout as JSON if it begins with `{`, fall back to exit-code semantics (0 = continue, 2 = block, non-zero non-2 = error). Block + reason → bridge calls `pi.sendUserMessage(reason)` per the authority doc's synthesis approach. Unknown JSON `decision` values: ignore + debug-log; do NOT warn-per-dispatch (would be runtime spam in agent loops; matches the H-bucket silent-drop philosophy). For non-`Stop` events: standard exit-code semantics with the same JSON-when-present parsing path. |
| **Lifecycle reconcile parity with v1.12: hooks reconcile through the existing config + reconcile planner** | v1.12 locked the reconcile-on-`/reload` model (`claude-plugins.json` → plan → apply). The bridge must NOT introduce a parallel reconcile path for hooks; it joins the existing one. From the user's perspective, `claude-plugins.json` controls enable/disable; the bridge's hook dispatch tables are rebuilt as part of the existing reconcile output. | MEDIUM | Reconcile's per-plugin `install` / `uninstall` / `enable` / `disable` actions trigger a bridge-internal `rebuildHookDispatchTables()` on the affected scope's `state.json`. The reconcile-applied cascade already emits one composed `notify`; the hook bridge contributes ZERO new cascade rows — its work is observable only through `info` (per-plugin) and through whatever install-time warnings the new caveats surface. This is the right boundary: reconcile reports what changed in `claude-plugins.json` terms (plugin entries added/removed/enabled/disabled); the hook bridge's table rebuild is an implementation detail, not a user-facing event. |
| **`/reload`-driven recovery — no live unsubscribe surface** | NFR-2 ("`Run /reload` must suffice") plus `pi.on()` returning void make this mandatory. The user's mental model from v1.0–v1.12 is already `/reload to pick up changes`; the bridge MUST inherit that trailer for hook-affecting mutations. | LOW | Hook-state-changing operations (install / uninstall / enable / disable of any hook-using plugin) emit the existing `reload-hint` trailer per the v1.4 SNM-15 state-change ladder. No new trailer text. The trailer fires identically whether the plugin has hooks or not — the user does not need to know "this one had hooks" to act on the hint. |

### Differentiators (Competitive Advantage)

Features that distinguish this bridge from Claude Code's native hook surface or from other plugin-system event bridges. Align with v1.0's Core Value (atomic, recoverable, soft-degrading, never blocks install).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Bucket-D synthesis caveats surfaced AT INSTALL, not just in the README** | Claude Code itself has no bucket-D concept — its hooks are first-class. Other event bridges studied (claude-code-router, mcp-bridge) document caveats only in README. The bridge can teach the user about the synthesis loss-mode at the point of install, when they still have a decision to make, instead of leaving them to discover quietly-not-firing hooks later. Per the brief's question 3: install-time warning IS right for bucket D (rejected for bucket H because H is silent at parse). | LOW–MEDIUM | One install-time warning per (plugin, bucket-D event) pair, surfaced via the existing cascade as a per-row brace addition: `● ralph-wiggum v1.0.0 (installed) <lossy synthesis> {Stop: timing-shift synthesis}`. Per-event reason strings are short, closed-set, and reflect the authority doc's loss-mode column verbatim. **Per-event recommendation matrix:** `Stop` → `{Stop: timing-shift synthesis}` (the load-bearing one); `StopFailure` → no warning (bridge-owned classifier is invisible to the user); `CwdChanged` → `{CwdChanged: bash-only}` (the future-fragility is real); `PostToolBatch` → no warning (timing-approximation is invisible at the plugin level); `UserPromptExpansion` → `{UserPromptExpansion: false-positive on transform}` (visible to a plugin author who writes input-transforming hooks themselves). |
| **Plugin-author-grade install-time warning on hook-payload extensions** | The authority doc identifies this as a NEW compatibility category (`asyncRewake` on `security-guidance` is the audit-surfaced example). No event bridge studied has a generalized story for this — most either fail-on-unknown-field or silently swallow. The bridge can be tolerant-at-parse, loud-at-install: forward-compatible with future Claude Code payload extensions without surprising users when an extension does something they expected. | LOW | Bridge maintains a known-extension allow-list (start with `asyncRewake` / `rewakeMessage` / `rewakeSummary`). On install, for each hook entry carrying a recognized-but-unsupported field, emit one row with `{payload extension <field> ignored}` reason. Unknown payload fields: silently ignored + debug-logged (per the authority doc; the bridge's hook-entry parser tolerates them). This split (known→warn, unknown→debug-log) prevents bridge from spamming on every future Claude Code addition while still surfacing the audit-known ones. |
| **Per-row gating disclosure for soft-dep-conditional hooks (`SubagentStart` / `SubagentStop`)** | Distinct from the per-plugin soft-dep marker for skills/agents/MCP because the hook entry is not the gate — the EVENT is. A plugin can have many hook entries; only the ones targeting `SubagentStart` / `SubagentStop` need the marker. Per the brief's question 4: surface this on the `hooks:` line of `info`, not as a top-level plugin row marker. | LOW | When `pi-subagents` probe reports unloaded: in the `hooks:` line of `info`, append the existing `{requires pi-subagents}` reason to each entry whose event is in the soft-dep set. Example: `hooks: SessionStart, SubagentStart {requires pi-subagents}, SubagentStop {requires pi-subagents}, Stop`. When the probe reports loaded: no marker (no noise on the healthy path; matches v1.4 SNM-15 reload-suppression philosophy). |
| **Hook-config surface is a typed discriminated subset of `PluginInfoRow.components`, not a free-form string** | The existing info surface composes from `PluginInfoMessage` → `PluginInfoRow` → typed `components` block. Adding hook info as a typed `hooks?: readonly HookSummary[]` field (`{ event: ClaudeHookEvent; matcher?: string; gating?: GatingReason; fidelity?: FidelityNote }`) keeps the catalog-UAT (`docs/output-catalog.md` byte equality) honest and lets the type system catch render drift. v1.4's discriminated-union pattern (TYPE-01..04) explicitly chose this over render-time string composition. | MEDIUM | New `HookSummary` interface in `shared/notify.ts`; new `ClaudeHookEvent` closed-set tuple (16 supported + 14 unsupported = 30); new `GatingReason` and `FidelityNote` closed-set tuples. Renderer composes the `hooks:` line from this typed structure. catalog-UAT gains a new state per (gating, fidelity) combination — adds ~10–15 catalog states. Cost is real but pays back across every future hook-related surface change. |
| **Match-trace is an anti-feature now, but the typed surface above makes it CHEAP to add later** | A dedicated `/claude:plugin hooks <plugin>` command (per brief question 1) or a `--why` matcher trace (per brief question 2) would be useful to the operator persona but not to the table-stakes user persona. v1.13 should NOT ship either, but the typed-surface differentiator above ensures they can be added in v1.14+ without rebuilding the model. | n/a (deferred) | Recorded explicitly because the typed surface investment de-risks the deferral. The brief's "compare to claude-code-router, mcp-bridge, vscode extension event proxies" question: none of those tools ship match-trace as a primary surface either; debug-log dispatch lines are the universal pattern. Adopt that pattern (it's table-stakes for the operator persona — see below). |

### Operator-Persona Table Stakes (Debug Logging)

Separate row because the operator persona (CLAUDE.md "Developer Profile") has different needs from the plugin-author persona that the `info`/`list` surface serves.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **One debug-log line per hook dispatch decision** | The brief's question 2: when a hook fires (or doesn't fire) for a tool, the user needs to be able to tell why. Debug logs are the universal pattern across claude-code-router, mcp-bridge, and Pi's own bridges. v1.0–v1.12 already uses `console.warn` for the single sanctioned legacy-migration case (IL-3); the bridge can extend the debug-log surface (NOT through `console`; through whatever `pi.log` / `ctx.log.debug` API the host exposes — verify at impl time). | LOW | Per-dispatch format: `[pi-claude-marketplace/hooks] <piEvent> matcher=<matcher> plugin=<id>:<entry> fired=<bool> reason=<bool-rationale>`. The `reason` field is the operator's "why didn't this fire?" answer (matcher-miss, plugin-disabled, dispatcher-gated, dispatch-success, dispatch-error). Verbose by default; gated by an env var (`PI_CLAUDE_MARKETPLACE_HOOK_DEBUG=1`) if the bridge's general debug surface is silent — verify the existing convention at impl time. NOT through `ctx.ui.notify` (which is for user-visible output per IL-2). |
| **One debug-log line per H-bucket / G-bucket drop at parse time** | The authority doc locks this: "Log once at debug level: `dropped <plugin>:<event> -- semantically inapplicable to Pi`". Operator-visible without being install-time noise. | LOW | Per-plugin-load format: `[pi-claude-marketplace/hooks] dropped <plugin>:<event> -- <reason>` where reason is one of the H/G bucket rationales. Emitted exactly once per plugin per `/reload` (not per dispatch — there are no dispatches for these). |

### Anti-Features (Commonly Requested, Often Problematic)

Features the milestone should explicitly NOT include. Each carries a rejection reason tied to a constraint, principle, or established v1.0–v1.12 decision.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Per-hook telemetry / metrics (counts, latencies, last-fired timestamps)** | "We should know how often hooks fire to spot performance problems." | **Violates IL-4 (No telemetry V1).** The PRD constraint is unambiguous: no metrics, no event sink, no analytics endpoint. The authority doc Open Questions even flags this ("should the bridge keep a per-plugin counter and surface it via `/claude:plugin info`?") — the answer in v1.13 is no, because the constraint is project-wide. | Debug-log dispatch lines (above) give the operator persona enough to diagnose without a structured telemetry surface. Per-plugin counters are a v2 concern only after telemetry policy changes. |
| **Hook-execution TUI surface (real-time dispatch viewer / live tail)** | "Pi has interactive surfaces; show me hooks firing in real time." | The bridge is **headless by construction** — it lives below `ctx.ui.notify`. A TUI surface would require a separate `pi.registerCommand` channel and would not match any existing v1.0–v1.12 pattern (no command in the extension renders interactively). Also fights NFR-2 (`/reload` is the recovery surface, not a live UI). | If a user needs to watch dispatches, the debug-log lines + `tail -F` on Pi's log file give them the equivalent without inventing a new surface. |
| **Hot-reload of hook configs without `/reload`** | "Editing `hooks.json` should take effect immediately." | **Structurally impossible.** `pi.on()` returns void; there is no unsubscribe; the bridge cannot remove a registered dispatcher mid-session. NFR-2 already established `/reload` as the recovery primitive; the v1.12 reconcile model already established `/reload` as the apply-config primitive. A hot-reload illusion would be a lie. | The existing `/reload to pick up changes` trailer (v1.4 SNM-15) already tells the user what to do. v1.13 does not change this. |
| **Hook-config DSL extensions beyond Claude Code's contract** | "We could add a `pi-only` matcher type, or a `priority` field, or pre-hook chaining ..." | **Defeats the bridge's value proposition** — the user-contract is "Claude plugins work under Pi." Extending the DSL means Claude hooks authored under Pi no longer work under Claude Code; this is regressive. The authority doc's matcher-translation note ("trivial; both globally-scoped") is load-bearing — keep it trivial. | Pi-native hook surface (if ever wanted) lives in a separate Pi extension that consumes `pi.on(...)` directly, not in this bridge. The bridge is a translator, not a superset. |
| **`/claude:plugin hooks <plugin>` dedicated inspection command** | "Hooks are complex; give them their own command." | The brief's question 1 explicitly calls this out as a likely anti-feature, and that's right. `info <plugin>` is the canonical read-only diagnostic surface; adding `hooks <plugin>` doubles the surface for one component type without doubling it for the others (no `agents <plugin>` exists). Inconsistent. | The `hooks:` section on `info` (table-stakes above) IS the inspection surface. If the volume of hook detail later overflows the `info` row (e.g., a plugin with 30 hook entries), the conversation is about wrapping/indentation rules, not a new command. |
| **`--verbose` flag on `info` / `list` for hook detail** | "Hide hook detail by default, opt in via flag." | No precedent — no other component type has a per-kind verbose toggle on these surfaces. Adding one for hooks creates an asymmetry the catalog UAT can't enforce uniformly. v1.0–v1.12's design language is "info is always full detail; list is always terse." | `list` does not show hooks (table-stakes above); `info` always does. Two surfaces, two contracts, no flag. |
| **Per-hook `enable`/`disable` (toggle individual hook entries within a plugin)** | "I want to disable just the `Stop` hook on this plugin without disabling the whole plugin." | Defeats the per-plugin enable/disable model from v1.12. Hook entries are PART OF the plugin's manifest; disabling one is editing the plugin, which the v1.0 PRD's containment rules (NFR-10) forbid. Also would require a write path into `<plugin-id>/hooks/hooks.json`, which the authority doc explicitly forbids ("treats the plugin tree as read-only after extraction"). | Disable the whole plugin (v1.12 `disable`) or uninstall + maintain a fork. The user can author their own `claude-plugins.local.json` override if they need per-machine variation. |
| **Match-trace command (`/claude:plugin hooks-trace <event-payload>`)** | "Given this event payload, which hooks would fire?" — useful for plugin authors debugging matchers. | Implementation requires a runtime synthetic-event injection path; nothing in v1.0–v1.12 has anything like it. Adding it for v1.13 would be a major new surface for a small operator-persona need that the debug-log per-dispatch surface already covers when the operator runs a real event. | Operator runs the workload normally with `PI_CLAUDE_MARKETPLACE_HOOK_DEBUG=1`; debug-log lines tell them which hooks fired and why. Sufficient for v1.13; revisit if third-party plugin authors hit a real need. |
| **Per-plugin hook timeout in `claude-plugins.json`** | "Some plugins need longer timeouts; let me configure it." | Diverges from Claude Code's contract (Claude Code's `timeout` field is per-hook-entry, not per-plugin). v1.0's PRD aligns `/claude:plugin` with `/plugin`; per-plugin timeout is a divergence the user has to learn separately. Also bloats `claude-plugins.json` schema for one component type. | Honor Claude Code's per-hook-entry `timeout` field (table-stakes above); bridge-wide default 60s. If a plugin needs longer, it sets `timeout` in `hooks.json` — same answer as under Claude Code. |
| **Synthesizing G-bucket events anyway (e.g., subscribing to `pi-worktrees` command output and fabricating `WorktreeCreate` from logs)** | "Better than nothing — at least try." | The authority doc is explicit: G-bucket needs an upstream PR + soft-dep installation; neither is sufficient alone. Fabricating from logs would be parse-fragile in a way the bucket-D synthesis caveats already warn against, and would set a precedent ("the bridge will guess") that violates the truth-in-attribution principle (v1.10 ATTR-NN line). | Bridge does NOT register a dispatcher for G-bucket events. They show as `(never fires) {requires pi-<extname>}` per the table-stakes row gating disclosure above. When the upstream PR lands, the bridge promotes them out of G-bucket in a future milestone. |
| **Refusing to install plugins whose hooks include H-bucket or G-bucket events** | "If the hook will never fire, fail loudly." | The authority doc's audit shows H-bucket inclusion is incidental in real plugins — `security-guidance` ships `ConfigChange` etc. without depending on them under non-Claude runtimes. Refusing install would block legitimate plugins. Also violates the project's soft-degrade-never-block principle (PRD §1, Pi-style). | Silently parse + drop (H-bucket) or register-but-mark-never-fires (G-bucket). User learns via `info`, not via install refusal. |

## Feature Dependencies

```
[Hooks component type in resolver + state schema (PROJECT.md target)]
    └──requires──> [State split: state.json hooks[] + per-plugin hooks/hooks.json]
                       └──enables──> [Bridge dispatch core (composite pi.on per piEvent)]
                                          └──requires──> [Per-event payload translators (16 events)]
                                                             └──requires──> [Stop JSON contract round-trip (ralph-wiggum canary)]
                                                                                └──requires──> [pi.sendUserMessage seam (verify at impl)]

[Hook-config typed surface (HookSummary in shared/notify.ts)]
    └──enables──> [info: hooks: line in PluginInfoRow]
    └──enables──> [info: per-entry gating disclosure (G/H-bucket markers)]
    └──enables──> [info: per-entry soft-dep marker (SubagentStart/Stop)]
    └──enables──> [Bucket-D install-time warning surface]
    └──enables──> [Hook-payload extension install-time warning surface]
    └──defers──> [Match-trace command (v1.14+; cheap given typed model)]

[Per-event matcher compilation (literal + pipe-OR; NO regex per locked scope)]
    └──required-by──> [Bridge dispatch core]
    └──required-by──> [info: hooks: line matcher rendering]

[Lifecycle: install / uninstall / enable / disable reconcile through v1.12 planner]
    └──requires──> [rebuildHookDispatchTables() on reconcile-apply]
    └──must-stay-consistent-with──> [v1.12 reconcile-applied cascade (no new cascade rows)]
    └──inherits──> [/reload to pick up changes trailer (v1.4 SNM-15)]

[Hook execution context (cwd / env / timeout)]
    └──requires──> [Pi ctx.cwd snapshot at dispatch entry]
    └──requires──> [Env composer: CLAUDE_* + PI_* dual surface]
    └──requires──> [Per-hook-entry timeout (Claude Code parity) with 60s default]

[Debug-log dispatch surface]
    └──must-bypass──> [ctx.ui.notify (IL-2 reserves notify for user-visible)]
    └──enables──> [Operator-persona debugging without TUI surface]

[Hook-payload extension tolerance (parser ignores unknown fields)]
    └──required-by──> [Bridge dispatch core]
    └──enables──> [Forward-compatibility with future Claude Code hook fields]
    └──enables──> [Install-time warning for known-but-unsupported fields (asyncRewake et al.)]
```

### Dependency Notes

- **Typed HookSummary must land with the dispatch core, not after.** The `info` surface depends on the typed model, and the install-time warnings depend on the typed model. Without it, every surface re-derives hook detail from `hooks.json` strings at render time; that's the v1.3-string-API failure mode v1.4 explicitly fixed. Land the type with the bridge.
- **The `Stop` JSON contract is the load-bearing test case for the dispatch core.** The authority doc names `ralph-wiggum` as the canary. The dispatch core ships incomplete if `Stop` block-to-continue doesn't round-trip. This is upstream of every UI feature.
- **G-bucket and H-bucket gating disclosure are CHEAP add-ons IF the typed HookSummary lands first.** Without it, they require render-time string manipulation; with it, they're a closed-set field on each `HookSummary` entry. This is the strongest argument for the differentiator-row typed model.
- **Reconcile parity is the lifecycle correctness rail.** Without `rebuildHookDispatchTables()` in the reconcile apply path, an enable/disable cycle would not affect the dispatch tables until the next full `/reload` — fighting the v1.12 reconcile contract. With it, the existing v1.12 cascade still emits one composed `notify`; the bridge contributes zero new rows.

## MVP Definition

### Launch With (v1.13)

These are the table-stakes + differentiators required for the milestone to deliver its Core Value ("Claude plugin hooks fire under Pi at first-party fidelity").

- [ ] **`hooks` component type in resolver + state schema** — the artifact itself; the v1.0 PRD §9.3 dependency.
- [ ] **Bridge dispatch core** — one composite `pi.on(...)` per Pi event the bridge bridges; per-plugin routing inside; literal + pipe-OR matcher translation.
- [ ] **Per-event payload translators for the 16 supported events** — bucket A (8 direct), bucket B (`FileChanged`), bucket D (5 lossy: `CwdChanged` / `PostToolBatch` / `UserPromptExpansion` / `Stop` / `StopFailure`), conditional soft-dep (`SubagentStart` / `SubagentStop`).
- [ ] **Typed `HookSummary` in `shared/notify.ts`** — closed-set `ClaudeHookEvent` (30 events), `GatingReason`, `FidelityNote`, `payload extension <field> ignored` reason variant — without this the info / install surfaces fight the v1.4 type model.
- [ ] **`info <plugin>@<marketplace>` shows `hooks:` line** — with per-entry matcher, gating disclosure for G/H-bucket entries (`(never fires) {requires pi-<dep>}` / `{inapplicable to Pi}`), and per-entry soft-dep marker for `SubagentStart` / `SubagentStop` when probe reports unloaded.
- [ ] **Install-time warning for bucket-D synthesis caveats** — per (plugin, bucket-D event) pair, surfaced via cascade row marker + reason (`<lossy synthesis>` marker + `{Stop: timing-shift synthesis}` etc.); per-event matrix locked above.
- [ ] **Install-time warning for hook-payload extensions** — known-allow-list (`asyncRewake` / `rewakeMessage` / `rewakeSummary` initial set); unknown fields tolerated + debug-logged.
- [ ] **Hook execution context: cwd / env / timeout** — Pi `ctx.cwd` snapshot; dual `CLAUDE_*` + `PI_*` env vars; per-hook-entry `timeout` with 60s bridge-wide default.
- [ ] **Stop JSON contract round-trip (ralph-wiggum canary)** — `{"decision": "block", "reason": "..."}` synthesized via `pi.sendUserMessage(reason)` per authority-doc bucket-D approach. Canary plugin must pass an end-to-end test.
- [ ] **Lifecycle: install / uninstall / enable / disable reconcile through v1.12 planner** — `rebuildHookDispatchTables()` joins the existing reconcile-apply path; no new cascade rows; existing reload-hint trailer inherited.
- [ ] **Debug-log dispatch surface (operator-persona)** — one line per dispatch decision; one line per H/G-bucket drop at parse time. Through Pi's `ctx.log.debug` (verify at impl), NEVER through `ctx.ui.notify` (IL-2).
- [ ] **H-bucket silent drop** — debug-log only at parse time; no install-time warning (would be noise).

### Add After Validation (v1.14+)

Features deferred to the next milestone, with concrete triggers.

- [ ] **Match-trace command (`/claude:plugin hooks-trace <event-payload>`)** — trigger: a real third-party plugin author files an issue saying matchers are opaque to debug. Cheap given the typed-HookSummary investment.
- [ ] **Plugin-compatibility matrix in repo (CI-refreshed against live marketplace)** — trigger: third-party hook-using plugins start appearing in the marketplace. Authority doc Open Questions row.
- [ ] **G-bucket promotion as soft-dep PRs land** — trigger: `pi-mcp-adapter` lands `ElicitRequestSchema` + `pi.events.emit("mcp:elicit-request" / "mcp:elicit-result", ...)`, OR `pi-worktrees` lands `pi.events.emit("worktree:created" / "worktree:removed", ...)`. Per-event promotion; each gated on a peer-dep floor bump for the affected soft-dep.
- [ ] **Full regex matcher support** — trigger: a third-party plugin in the wild uses a non-literal-OR matcher. The first-party catalog uses zero regex (literal + pipe-OR only); deferring is safe.

### Future Consideration (v2+)

- [ ] **E-bucket promotion (`Notification` / `PermissionRequest` / `PermissionDenied` / `MessageDisplay`)** — defer: the authority doc explicitly does not commit to sending the `pi-coding-agent` PRs. Urgency stays low until a third-party plugin actually exercises one.
- [ ] **F-bucket promotion (`TeammateIdle`)** — defer: needs a whole new Pi product surface (agent teams). Not a bridge concern.
- [ ] **Per-hook performance metrics / per-plugin dispatch counters** — defer: blocked by IL-4 telemetry policy. Revisit only if telemetry policy changes.
- [ ] **Hook-execution TUI / live-tail surface** — defer: bridge is headless by construction; would require a separate Pi extension to consume the bridge's debug stream.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `hooks` component type in resolver + state schema | HIGH | MEDIUM | P1 |
| Bridge dispatch core (composite pi.on per piEvent) | HIGH | HIGH | P1 |
| Per-event payload translators (16 events) | HIGH | HIGH | P1 |
| Stop JSON contract round-trip (ralph-wiggum canary) | HIGH | MEDIUM–HIGH | P1 |
| Typed `HookSummary` in shared/notify.ts | HIGH | MEDIUM | P1 (load-bearing for every UI surface) |
| `info`: `hooks:` line with matcher + gating | HIGH | LOW–MEDIUM | P1 |
| Install-time bucket-D synthesis warning | HIGH | LOW–MEDIUM | P1 |
| Install-time hook-payload extension warning | MEDIUM–HIGH | LOW | P1 |
| Hook execution context (cwd / env / timeout) | HIGH | MEDIUM | P1 |
| Lifecycle: reconcile through v1.12 planner | HIGH | MEDIUM | P1 |
| Debug-log dispatch surface (operator-persona) | MEDIUM (operator only) | LOW | P1 (defaults to off; gated by env var) |
| H-bucket silent drop + debug-log | LOW (correctness) | LOW | P1 |
| Per-entry soft-dep marker for SubagentStart/Stop | MEDIUM | LOW | P1 |
| Match-trace command | LOW–MEDIUM | MEDIUM | P2 |
| Plugin-compatibility matrix CI job | LOW–MEDIUM | MEDIUM | P2 |
| Full regex matcher support | LOW | MEDIUM | P3 |
| G-bucket promotion (per soft-dep PR landing) | LOW (per-event) | LOW (per-event) | P3 |
| E-bucket promotion | LOW | MEDIUM (per-event) | P3 |
| F-bucket / TeammateIdle | LOW | HIGH (Pi product feature) | P3 |
| Per-hook telemetry / counters | n/a | n/a | ANTI (IL-4) |
| Per-hook enable/disable | LOW | MEDIUM | ANTI (defeats v1.12 model) |
| Hot-reload without /reload | n/a | n/a | ANTI (structurally impossible) |
| `/claude:plugin hooks <plugin>` dedicated command | LOW | MEDIUM | ANTI (info covers it) |
| Hook-config DSL extensions | n/a | n/a | ANTI (defeats fidelity value-prop) |

**Priority key:**
- P1: Must have for v1.13 launch
- P2: Should have, add post-validation in v1.14+
- P3: Defer to v2+ pending external trigger
- ANTI: Explicit anti-feature; do not implement

## Competitor / Precedent Feature Analysis

| Feature | Claude Code (native `/plugin`) | claude-code-router (third-party event router) | VS Code extension activation events | Our Approach (v1.13) |
|---------|-------------------------------|----------------------------------------------|-------------------------------------|----------------------|
| Hook detail in plugin-info surface | Yes (via `claude /plugin info`) — terse list | N/A (not a plugin manager) | Yes (`onCommand:` / `onLanguage:` listed in extension manifest viewer) | **Yes — `hooks:` line on `info` with matcher + gating** |
| Per-event hook count in plugin-list | No | N/A | No (extensions listed by name only) | **No (anti-feature; symmetry with skills/commands)** |
| Dedicated hook-inspection command | No | No | No | **No (anti-feature; info covers it)** |
| Match-trace / why-didn't-this-fire surface | No | Logging-only | No | **No (debug-log lines cover the operator persona)** |
| Install-time warning on partial-fidelity events | N/A (no fidelity concept) | N/A | N/A | **Yes (bucket-D synthesis warning; unique to a bridge architecture)** |
| Install-time warning on payload-extension fields | N/A (native) | N/A | N/A | **Yes (asyncRewake et al. allow-list)** |
| Per-hook timeout from manifest | Yes (`timeout` field per entry) | Yes | N/A | **Yes (Claude Code parity) + 60s bridge default** |
| `CLAUDE_*` env vars exposed to hooks | Yes | Mirrored | N/A | **Yes + `PI_*` mirror (dual surface for portability)** |
| Hook stdout JSON contract for Stop / decision: block | Yes (load-bearing for ralph-wiggum etc.) | Yes (passthrough) | N/A | **Yes (bucket-D synthesis via `pi.sendUserMessage`)** |
| Hot-reload of hook configs | Yes (Claude Code file-watches `hooks.json`) | Yes | Yes (`onDidChangeConfiguration`) | **No (anti-feature; `pi.on()` void-return precludes)** |
| Per-hook telemetry / metrics | No | Per-router | N/A | **No (IL-4)** |
| Live-tail dispatch UI | No | Optional | N/A | **No (anti-feature; headless bridge)** |
| Tolerance for unknown payload fields | Yes (silent) | Varies | N/A | **Yes (silent + debug-log; warn at install for known-but-unsupported)** |
| Hook-config DSL extensions beyond Claude Code | n/a | Some routers extend | N/A | **No (anti-feature; defeats fidelity value-prop)** |

## Per-Bucket Synthesis-Caveat Disclosure Matrix (answers brief Q3)

Authority-doc cross-reference: each row uses the loss-mode column verbatim from the doc's "How each bucket B/C/D synthesizes" section.

| Bucket | Events | Disclosure surface | Rationale |
|--------|--------|-------------------|-----------|
| A (direct 1:1) | 8 events | None | No caveats; fires at perfect fidelity. |
| B (stable synthesis) | `FileChanged` | None at install; doc-only in bridge README | Authority doc: "synthesis is structurally complete and won't break as Pi adds new tools." No caveat to disclose. |
| D — `Stop` | 1 event | **Install-time warning per plugin** (`<lossy synthesis>` marker + `{Stop: timing-shift synthesis}` reason) | Load-bearing for `ralph-wiggum`; user must know the timing shift exists. 3/5 first-party hook-using plugins exercise this. |
| D — `CwdChanged` | 1 event | **Install-time warning per plugin** (`<lossy synthesis>` marker + `{CwdChanged: bash-only}` reason) | Future-fragility is real — silent miss if Pi grows a non-bash cwd-changing tool. Author needs to know the contract is "bash-only" so they don't depend on what won't fire. |
| D — `UserPromptExpansion` | 1 event | **Install-time warning per plugin** (`<lossy synthesis>` marker + `{UserPromptExpansion: false-positive on transform}` reason) | False-positive visible to a plugin author who writes input-transforming hooks themselves. |
| D — `PostToolBatch` | 1 event | None at install; doc-only in bridge README | Timing-approximation is invisible at the plugin level (the bridge's safety-net fire from `turn_end` covers the race). No user-visible loss. |
| D — `StopFailure` | 1 event | None at install; doc-only in bridge README | Bridge-owned error-type classifier is implementation detail; plugin author sees the standard payload. No user-visible loss to disclose. |
| Soft-dep (`SubagentStart` / `SubagentStop`) | 2 events | **Per-entry `{requires pi-subagents}` marker on `info` `hooks:` line** when probe reports unloaded | Matches the established soft-dep marker pattern from skills/agents/MCP. NOT an install-time warning (would be redundant — the existing `{requires pi-subagents}` per-row plugin marker already covers the case). |
| G (upstream-PR-blocked) | 4 events (Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove) | **Per-entry `(never fires) {requires pi-<dep>}` on `info` `hooks:` line** | The bridge does NOT register a dispatcher; the entry surfaces as never-fires. Plugin author has actionable info (install the soft dep — but the upstream PR is also required; the reason brace says so). NOT an install-time warning (would noise on plugins that ship these without depending on them — same logic as bucket H). |
| H (semantically inapplicable) | 5 events (ConfigChange, Setup, InstructionsLoaded, TaskCreated, TaskCompleted) | **Per-entry `(never fires) {inapplicable to Pi}` on `info` `hooks:` line** + debug-log at parse | Authority doc locks: no install-time warning ("would be noise"). User who looks for hook detail via `info` learns the truth; user who doesn't is not bothered. |

## Hook Execution Context Decisions (answers brief Q5)

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Working directory | Pi `ctx.cwd` snapshot at dispatcher entry | Claude Code semantics; matches `ralph-wiggum` expectations; matches plugin-author mental model. NOT plugin install dir (would be foreign); NOT Pi agent dir (would change behavior of any path-relative hook). |
| Environment | `CLAUDE_*` originals (e.g., `CLAUDE_PROJECT_DIR`, `CLAUDE_SESSION_ID`, `CLAUDE_TOOL_NAME`) + `PI_*` mirrors (`PI_PROJECT_DIR`, `PI_SESSION_ID`, etc.) | Dual surface: Claude-shaped names so hook scripts ported from Claude Code work unchanged (the bridge's value prop); Pi-shaped names so Pi-native authors have a non-foreign API. Cost is one extra env-var write per child spawn — trivial. |
| Per-hook timeout | Read `timeout` field from hook entry (Claude Code parity); 60s bridge-wide default when absent | Aligns with Claude Code's contract so the per-hook-entry contract is identical. 60s default matches Claude Code's documented default. |
| Per-plugin timeout config | Not implemented (anti-feature row above) | Diverges from Claude Code without precedent; bloats `claude-plugins.json` schema. |
| Timeout enforcement | SIGTERM after timeout; SIGKILL after 5s grace | Standard child-process kill ladder; matches what Claude Code does. |
| Concurrent dispatch | Bridge serializes per-event but parallel across events | Multiple `PostToolUse` hooks from one event are chained in plugin-declaration order (authority doc Aggregation Rules); independent events fire concurrently. NO global serialization (would create head-of-line blocking). |

## Hook Stdout / Exit-Code Contract Round-Trip (answers brief Q6)

The bridge's stdout parser is per-event and version-aware (per the authority doc "Return-shape evolution risk" note).

| Event | Stdout shape | Bridge response |
|-------|-------------|-----------------|
| `Stop` | `{"decision": "block", "reason": "..."}` JSON; exit 0 = continue; exit 2 = block (legacy) | Parse JSON if stdout begins with `{`; fall back to exit-code semantics. Block + reason → `pi.sendUserMessage(reason)` (bucket-D synthesis). The canary case. |
| `PreToolUse` | `{"hookSpecificOutput": {"permissionDecision": "allow"\|"deny", "updatedInput": {...}}}` | Parse JSON; write `updatedInput` mutably back onto `event.input` (authority doc's mutability footgun). Deny → `{ block: true, reason: "..." }`. |
| `PostToolUse` | `{"hookSpecificOutput": {"updatedToolOutput": "..."}}` | Parse JSON; return partial patch `{ content }` per Pi `tool_result` middleware semantics. |
| `SessionStart` | `{"hookSpecificOutput": {"additionalContext": "...", "initialUserMessage": "..."}}` | Inject via Pi's `session_start` return shape where supported; concatenate `additionalContext` across plugins in declaration order. |
| All other A/B/D events | Per Claude Code docs per event | Standard JSON-when-present parsing path; exit-code fallback. |
| Unknown JSON `decision` value | Ignore the field; preserve other fields if structurally valid; debug-log once per (plugin, event, value) | Matches H-bucket silent-drop philosophy; avoids runtime spam in agent loops. NOT a per-dispatch warning. |
| Malformed JSON (begins with `{` but parse fails) | Treat as plain stdout; exit-code semantics only; debug-log the parse failure | Hook script bug; bridge stays alive; operator sees the parse failure in debug log. |
| Hook script crash (non-zero exit, no JSON, no exit-2) | Surface to operator via debug-log; do NOT fail the agent loop; do NOT count as block | Hook is best-effort by Claude Code's contract; the bridge inherits. |
| Hook script timeout | SIGTERM the child; debug-log; do NOT count as block; do NOT fail the agent loop | Same as crash. |

## Sources

### Authoritative (HIGH confidence)

- **`/home/acolomba/pi-claude-marketplace/docs/research/claude-hooks-vs-pi-events.md`** — the project's locked authority doc. All bucket assignments, synthesis approaches, soft-dep audits, and Stop-canary identification flow from this. Read in full.
- **`/home/acolomba/pi-claude-marketplace/docs/prd/pi-claude-marketplace-prd.md`** — locked NFR/IL constraints (NFR-2 reload-only recovery; NFR-5 network policy; NFR-10 containment; IL-1 English-only; IL-2 ctx.ui.notify chokepoint; IL-3 single sanctioned console.warn; IL-4 no telemetry; SC-1 two-scope model).
- **`/home/acolomba/pi-claude-marketplace/.planning/PROJECT.md`** — v1.13 milestone scope, target features, locked decisions; reflects D-21-01..D-49-01 across v1.0–v1.12.
- **`/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`** + **`list.ts`** — the existing surface the new hooks line must compose under; PluginInfoMessage / MarketplaceNotificationMessage shapes; per-scope fan-out; soft-dep marker contract.
- **`/home/acolomba/pi-claude-marketplace/docs/output-catalog.md`** — byte-locked catalog UAT; existing row-grammar examples (`hooks:`-bearing rows will be lockstep-added per v1.4 type-driven pattern).
- **Claude Code hook docs at `code.claude.com/docs/en/hooks`** — primary source for hook events, payload shapes, JSON stdout contract, exit-code semantics, `CLAUDE_*` env vars, `timeout` field semantics. Authority doc fetched this 2026-06-12.
- **`@earendil-works/pi-coding-agent` `types.d.ts`** — `pi.on()` void return verified at the peer-dep version this project targets; `pi.events: EventBus` is the soft-dep extension event surface; `pi.sendUserMessage` is the bucket-D Stop synthesis primitive (verify exact signature at impl).

### Cross-referencing (MEDIUM confidence — used for pattern signal, not load-bearing)

- VS Code extension `activationEvents` and extension-host activation surface — comparable "extension declares events it wants to subscribe to" model; informs the no-`--verbose`-flag decision (VS Code never gated extension detail behind a flag).
- Homebrew Bundle, nix home-manager, asdf — comparable declarative-config tools studied in v1.12 research; reinforce the "soft-degrade-never-block" + "loud truthful report" pattern that v1.13 inherits.
- Authority-doc-cited evidence: `anthropics/claude-code` `marketplace.json` at commit `ca9f6045fc90c8244f9e787fb57d54b380f9a27c` — 5/5 hook-using plugins supportable under v1.13's scope; 5 distinct hook events in use; `ralph-wiggum` as the Stop canary.
- pi-subagents v0.24.3 + pi-mcp-adapter v2.6.1 + pi-worktrees source audits (authority doc § "Soft-dep extension event surfaces") — drives the G-bucket gating reason set.

---
*Feature research for: v1.13 Claude Hook Bridge — `pi-claude-marketplace` subsequent milestone*
*Researched: 2026-06-13*
