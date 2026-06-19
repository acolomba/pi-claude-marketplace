# Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 58-matcher-parser-tool-name-mapping-supportability-gate
**Areas discussed:** HOOK-04 reason byte form, TOOL-02 gate placement, matcher-model shape (Pi-form lowercase question reframed), find↔Glob mapping, non-tool-event matcher semantics

---

## Initial gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| find ↔ Glob mapping | LOW-confidence flag from research; include in v1.13 or defer to PROM-01 in v1.14+? | ✓ |
| TOOL-02 reason byte form: pull HOOK-04 rename forward | Phase 58 emits `{unsupported hooks}` atomically (atomic-supersession) or defer rename to Phase 63? | ✓ |
| Pi-form lowercase matcher behavior | TOOL-02(b) unavailable-flip vs silent never-fires vs hybrid whitelist | ✓ |
| TOOL-02 gate placement | Extend `parseHooksConfig` vs sibling function vs new `bridges/hooks/` module | ✓ |

**User's choice:** All four selected.

---

## HOOK-04 reason byte form (D-58-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Pull HOOK-04 forward (atomic with TOOL-02) | Rename `"hooks"` → `"unsupported hooks"` + catalog + fixtures + manifest-field carve-out drop atomically; ROADMAP SC#4 wording truthful from Phase 58. REQUIREMENTS amendment: HOOK-04 moves Phase 63 → Phase 58. | ✓ |
| Defer HOOK-04 to Phase 63 | Phase 58 emits legacy `{hooks}` byte form; Phase 63 renames. Two catalog updates total. | |
| Split HOOK-04: rename now, MANIFEST_FIELD_REASONS cleanup in Phase 63 | Smallest atomic change here; HOOK-04 split across two phases. | |

**User's choice:** Pull HOOK-04 forward.
**Notes:** Atomic-supersession lesson (v1.3 / v1.10 `will * NOT to *` / v1.11 GRAM-01..05). Single commit lands rename + catalog + byte-equality fixtures.

## MANIFEST_FIELD_REASONS carve-out cleanup (D-58-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Land carve-out cleanup in Phase 58 too | Drop `"hooks"` from `MANIFEST_FIELD_REASONS` + `MANIFEST_FIELD_TO_REASON` in install.ts atomically. HOOK-04 fully closes in Phase 58. | ✓ |
| Keep carve-out until Phase 63 (HOOK-04 split) | Dead-code preserved until Phase 63. | |

**User's choice:** Land carve-out cleanup in Phase 58 too.
**Notes:** Under v1.13 `hooks` is a SUPPORTED component kind; the manifest-field-rejection branch is dead code.

---

## TOOL-02 gate placement (D-58-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `parseHooksConfig`'s discriminated result | Third arm covers TOOL-02 supportability. Single seam the resolver consumes. Same module (`domain/components/hooks.ts`) grows. | ✓ |
| Sibling `checkHooksSupportability` in `domain/components/hooks.ts` | Two functions, resolver calls in sequence. Cleaner separation, two error-flip sites. | |
| Carve `bridges/hooks/supportability.ts` (matches research arch) | New bridges/ directory; Phase 59 dispatch core lives here too. domain/ → bridges/ direction inverted. | |

**User's choice:** Extend `parseHooksConfig`'s discriminated result.
**Notes:** Resolver doesn't branch on which gate fired; both flip `installable: false` with `"unsupported hooks"` reason. Per-condition detail goes to `hookDebugLog`.

## Tool-name table location (D-58-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Move to `domain/components/hook-tool-names.ts` | Domain stays leaf-pure; Phase 60 payload translators import from `domain/`. REQUIREMENTS amendment moves TOOL-01's path. | ✓ |
| Keep `bridges/hooks/tool-names.ts` as REQ says | Matches research SUMMARY + REQ wording verbatim; introduces a `domain/` → `bridges/` import (first reverse-direction). | |
| Closed set in `domain/components/hooks.ts`; re-export from `bridges/` | Single source, thin re-export at `bridges/hooks/tool-names.ts`. Some redundancy. | |

**User's choice:** Move to `domain/components/hook-tool-names.ts`.
**Notes:** Architecture invariant preserved (domain leaf-pure). REQUIREMENTS TOOL-01 path amends in lockstep with this CONTEXT.md commit.

---

## Pi-form lowercase matcher behavior (reframed)

The user clarified the question was misframed. The actual architecture:

- Claude plugins declare hooks in Claude form (`matcher: "Edit"`, `event: "SessionStart"`).
- At REGISTRATION time, the bridge translates Claude → Pi using a static table.
- Pi fires events in Pi form (`event.toolName === "edit"`, `pi.on("session_start", ...)`).
- Pi-form handlers consume Pi events directly. NO runtime Claude↔Pi translation.
- Unsupported = unavailable; no need to catch or translate at runtime.

| Option | Description | Selected |
|--------|-------------|----------|
| Store Claude form; translate Pi→Claude at dispatch | Forward-direction translation each event. | |
| Store Pi form; translate Claude→Pi at parse time | Pi-form `Set<string>` at parse; Phase 59 wires `pi.on("tool_call", h => piFormSet.has(h.toolName))` directly. | ✓ (implicit from reframed model) |
| Store both forms in the matcher model | Memory + sync invariant. | |

**User's choice:** Effectively option B — Pi-form output, Claude→Pi translation at parse time.
**Notes:** User explicitly stated: "if a hook is not supported, the plugin is unavailable, so we don't allow installation. there is no need to catch or translate anything at runtime." For hooks with inputs (e.g. `Bash(...)` or `find`), registration-time translation produces Pi-form handler code. TOOL-02(b) catches Claude-form tokens with no Pi analog BEFORE translation.

---

## find ↔ Glob mapping (D-58-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Include `find ↔ Glob` in v1.13 | Adds row with paired fixture test; semantic-mismatch risk accepted; no first-party plugin blocked solely on `Glob`. | ✓ |
| Exclude `find` from the table (leave unmapped) | Plugins matchering `Glob` flip unavailable; safer; trades coverage for confidence. | |
| Include `find ↔ Glob` + `find ↔ LS` both directions | Breaks bidirectional 1:1; needs escape clause. Overcomplicated. | |

**User's choice:** Include `find ↔ Glob` in v1.13.
**Notes:** v1.14+ may refine if real plugin use surfaces a divergence.

---

## Non-tool-event matcher semantics (D-58-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Match-all only; non-empty matcher = TOOL-02 unavailable | Non-tool events accept only `""` / `"*"`; any other matcher value flips unavailable. UserPromptSubmit same. Zero first-party regression. v1.14+ may relax. | |
| Strict closed-set + Pi-payload mapping (research now) | Phase 58 verifies Pi event payloads; ships per-event Claude→Pi field-name + value-set maps. Supportable matcher values install; unsupportable flip unavailable. Bigger Phase 58 scope. | ✓ |
| Lenient — accept any matcher, ignore at runtime | Violates strict-supportability; same silent-never-fires / over-fires failure mode TOOL-02 was designed to prevent. | |

**User's choice:** Strict closed-set + Pi-payload mapping (research now).
**Notes:** SessionStart `source` ∈ {startup, resume, clear, compact}; SessionEnd `reason` ∈ {clear, resume, logout, prompt_input_exit, bypass_permissions_disabled, other}; PreCompact/PostCompact `trigger` ∈ {manual, auto}; UserPromptSubmit any non-empty matcher = unavailable. Planner verifies Pi event-payload surface (`session_start` / `session_shutdown` / `session_before_compact` / `session_compact`) for source/reason/trigger field equivalents at research time.

---

## Claude's Discretion

- Bucket-A event closed-set tuple location: sibling export in `domain/components/hooks.ts` or `domain/components/hook-events.ts`.
- Per-non-tool-event source/reason/trigger maps file placement: co-locate in `hook-tool-names.ts` or sibling `hook-events.ts`.
- Matcher parser internal API split: likely `parseMatcher(rawString)` + `checkMatcherSupportability(parsedMatcher, eventName, eventBucket)` mirroring Phase 57's pattern.
- Pipe-OR parser edge case: matcher `""` vs matcher `"|"` (pipe with no left/right).
- Catalog-state count + taxonomy per orchestrator surface.
- Architecture-test source-of-truth for TOOL-01 completeness: static `Type.Static<...>` introspection vs hard-coded const tuple with `satisfies` proof.

## Deferred Ideas

- MATCH-V2-01 (full regex matchers) — v1.14+.
- PROM-01 (Pi-side analogs for `MultiEdit` / `NotebookEdit` / `WebFetch` / `WebSearch` / `Task` / `TodoWrite` / `TodoRead` / `ExitPlanMode`) — v1.14+.
- Per-non-tool-event matcher value-set extensions when upstream Claude Code adds new source/reason/trigger values.
- MATCH-03 (`if` field) — Phase 61.
- HOOK-06 + EXEC-05 (`asyncRewake` registry + background-spawn) — Phase 62.
- SURF-01 / SURF-02 (`info <plugin>` hooks line rendering, typed `HookSummary`) — Phase 63.
- Catalog state count reduction by surface consolidation — at planner's discretion.

### Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md` — v1.12 orchestrator-coverage backlog; out of v1.13 scope.
