# Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate - Research

**Researched:** 2026-06-14
**Domain:** Static parser + closed-set lookup tables + supportability gate inside the existing `domain/components/hooks.ts` leaf module, plus a lockstep `REASONS` rename and catalog/byte-equality update across the orchestrator surfaces.
**Confidence:** HIGH

## Summary

Phase 58 layers four pure-functional contracts on top of Phase 57's leaf
foundation: a matcher parser (MATCH-01), a regex-rejection gate (MATCH-02),
a static bidirectional Claude ↔ Pi tool-name table (TOOL-01), and a
per-PLUGIN supportability gate (TOOL-02). It also pulls HOOK-04 forward
from Phase 63 to land a single atomic byte-form rename
(`"hooks"` → `"unsupported hooks"`) in lockstep with the new TOOL-02
emissions — the v1.3 / v1.10 / v1.11 atomic-supersession lesson applies.

The work is **pure parser + closed-set + discriminated-result extension**;
no I/O, no Pi runtime wiring, no `bridges/` code. Phase 58 extends
`parseHooksConfig`'s D-57-04 discriminated result (D-58-03 single seam),
ships two new sibling files in `domain/components/` (TOOL-01 map and the
bucket-A event tuple + per-non-tool-event field maps), and reaches out to
the existing not-installable cascade through `resolver.ts::applyHooksConfig`
without changing its shape.

The bytestream rename is bigger than the parser work in surface-area count:
**13 catalog-uat fixture rows + 8 docs occurrences + 4 source files
(`notify.ts`, `install.ts`, `probe-classifiers.ts`, `list.ts`)** all flip
in one commit. **The `probe-classifiers.ts::narrowResolverNotes`
`note.includes("hooks")` substring match is a SECOND
HOOK-04 site that the CONTEXT.md decision list does NOT call out** — the
planner MUST schedule its update alongside the `install.ts` carve-out drop.

**Primary recommendation:** Keep all parser code in
`domain/components/hooks.ts` (grows from 180 → ~450 lines but stays a
leaf-pure single-file scope per D-58-03). Add TWO new sibling files:
`domain/components/hook-tool-names.ts` (TOOL-01 bidirectional map) and
`domain/components/hook-events.ts` (bucket-A 8-event closed-set tuple +
per-non-tool-event source/reason/trigger field-name + value-set maps).
Extend `parseHooksConfig`'s discriminated result via the existing
`{ ok: false, reason }` arm (NOT a third arm) so resolver consumers
narrow on the same discriminator. The per-condition TOOL-02 detail
(`(a)`/`(b)`/`(c)`/`(d)`) goes to `hookDebugLog` only; the user-facing
reason is the single `"unsupported hooks"` literal.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Matcher tokenization (split on `\|`, trim, classify) | Domain (leaf-pure) | — | Pure parser; no I/O. Lives in `domain/components/hooks.ts`. |
| Regex detection (MATCH-02 char-class gate) | Domain (leaf-pure) | — | Static regex over the matcher token; no runtime context. |
| Claude → Pi tool-name reverse map | Domain (closed-set table) | — | A `Record<ClaudeTool, PiTool>` `as const` in `domain/components/hook-tool-names.ts`. |
| Bucket-A 8-event closed set | Domain (closed-set tuple) | — | A `readonly [...]` `as const` in `domain/components/hook-events.ts`. |
| Per-non-tool-event field-name + value-set maps | Domain (closed-set tables) | — | Same sibling file as the bucket-A tuple. |
| Supportability gate (TOOL-02 4-arm check) | Domain (parse-time check) | — | `checkMatcherSupportability` runs inside `parseHooksConfig`. |
| Discriminated-result extension (D-58-03 single seam) | Domain (parser return shape) | — | Resolver consumes the existing `ok: false` arm unchanged. |
| Resolver not-installable cascade (existing) | Domain (resolver glue) | — | `applyHooksConfig` already records the reason via `partial.notes.push`. |
| Reason narrowing (free-form note → `"unsupported hooks"`) | Shared (closed-set classifier) | — | `shared/probe-classifiers.ts::narrowResolverNotes` substring check. |
| User-facing render (`(unavailable) {unsupported hooks}`) | Shared (notify renderer) | — | `shared/notify.ts::REASONS` member + existing render path. |

**Why this matters:** The phase's center of mass is `domain/components/`.
The `bridges/` tier and the `orchestrators/reconcile/` tier are NOT
touched. The planner should not introduce bridge-layer files — the parser
output is consumed at parse time (resolver) only. Phase 59 will own the
Pi runtime registration; Phase 58 only ships the static tables Phase 59
will reach into.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typebox | `^1.1.38` (peer dep — already installed) | Closed-set static introspection (`Type.Static<typeof TUPLE[number]>`) for architecture tests | Established pattern across `SUPPORTED_COMPONENT_KINDS`, `REASONS`, `STATUS_TOKENS`, `MARKERS` — Phase 58 reuses, does not introduce. [VERIFIED: codebase grep `domain/resolver.ts:151`, `shared/notify.ts:72`] |
| `@earendil-works/pi-coding-agent` types | `^0.73.1` (peer dep — installed at `0.73.x`) | `ToolCallEvent` discriminated union exports the 7 Pi `toolName` literals (`bash` / `read` / `edit` / `write` / `grep` / `find` / `ls`) plus `CustomToolCallEvent` | Sole source of truth for TOOL-01's left column; the architecture test's completeness gate reads from this. [VERIFIED: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:613-651`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` (built-in) | bundled | Test framework for new architecture tests | Existing pattern: `tests/architecture/hooks-foundation.test.ts` already uses it. |
| `node:assert/strict` (built-in) | bundled | Equality and deep-equality assertions | Same pattern as `hooks-foundation.test.ts`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-line parser in `hooks.ts` (180 → ~450 lines) | Extract to sibling `hook-matcher.ts` | The CONTEXT.md D-58-03 locks the in-line path (single-seam discriminated result). Splitting would require re-exporting the discriminated result and would create a second module that consumers narrow against — extra surface area for a leaf-pure pure-functional concern. RECOMMENDATION: keep in-line. |
| Two separate sibling files (`hook-tool-names.ts` + `hook-events.ts`) | One sibling file (`hook-tool-names.ts` carries everything) | Sibling-file split keeps TOOL-01 (tool-name map) separable from D-58-06's per-non-tool-event maps. The architecture-test invariants are different (tool-name completeness vs. event-set completeness vs. per-event field-value closed sets). RECOMMENDATION: TWO files. |

**Installation:** None. Phase 58 introduces no new runtime dependencies;
all stack pieces are already on disk via `npm install` from prior phases.

## Package Legitimacy Audit

> **Skipped.** Phase 58 installs no external packages. The two tools the
> phase reaches into (`typebox`, `@earendil-works/pi-coding-agent`) are
> peer deps already locked at the project root and audited under v1.13's
> prior phases.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────────────────────────────┐
                     │ <pluginRoot>/hooks/hooks.json (raw)  │
                     └─────────────────┬────────────────────┘
                                       │ read by resolver
                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │ domain/resolver.ts                                   │
        │  ├─ readStandaloneHooks (Phase 57 — unchanged)       │
        │  └─ applyHooksConfig    (Phase 57 — unchanged)       │
        └──────────────┬───────────────────────────────────────┘
                       │ calls parseHooksConfig(raw)
                       ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ domain/components/hooks.ts  (Phase 58 extension — same file)   │
   │                                                                │
   │  parseHooksConfig(raw)                                         │
   │    │                                                           │
   │    ├─ JSON.parse + HOOKS_VALIDATOR.Check  (Phase 57)           │
   │    │     fail → { ok: false, reason: "hooks.json …" }          │
   │    │                                                           │
   │    └─ NEW: walk events × groups × handlers                     │
   │          ├─ event ∈ BUCKET_A_EVENTS?           (TOOL-02 c)     │
   │          ├─ handler.type === "command"?        (TOOL-02 d)     │
   │          ├─ parseMatcher(group.matcher) →                      │
   │          │     {kind: "match-all"}     (empty / "*")           │
   │          │     {kind: "tool-set", piTools: Set<PiTool>}        │
   │          │     {kind: "mcp-literal", literal}                  │
   │          │     {kind: "regex"}                  (TOOL-02 a)    │
   │          │     {kind: "unmapped", token}        (TOOL-02 b)    │
   │          │                                                     │
   │          ├─ non-tool event AND non-empty matcher?              │
   │          │     check value against per-event closed set        │
   │          │     (D-58-06 — SessionStart source, SessionEnd      │
   │          │      reason, PreCompact/PostCompact trigger,        │
   │          │      UserPromptSubmit → always trip)                │
   │          │                                                     │
   │          └─ first failure → { ok: false,                       │
   │                               reason: "unsupported hooks: …",  │
   │                               debugDetail (→ hookDebugLog) }   │
   └────────────────────────────────────────────────────────────────┘
                       │ imports static maps from
                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ domain/components/hook-tool-names.ts  (NEW — Phase 58)      │
   │   PI_TO_CLAUDE_TOOL_NAMES  : Record<PiTool, ClaudeTool>     │
   │   CLAUDE_TO_PI_TOOL_NAMES  : Record<ClaudeTool, PiTool>     │
   │   (mirror of Pi peer-dep's 7-tool closed set + Glob/LS)     │
   └─────────────────────────────────────────────────────────────┘
                       │ also imports from
                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ domain/components/hook-events.ts  (NEW — Phase 58)          │
   │   BUCKET_A_EVENTS              : readonly [8 events]        │
   │   TOOL_EVENTS                  : readonly [3 events]        │
   │   NON_TOOL_EVENT_FIELDS        : map: event → field-name    │
   │   NON_TOOL_EVENT_CLOSED_SETS   : map: event → value set     │
   └─────────────────────────────────────────────────────────────┘

                       │ resolver records partial.notes.push(reason)
                       ▼
   ┌───────────────────────────────────────────────────────────┐
   │ shared/probe-classifiers.ts::narrowResolverNotes          │
   │   note.includes("hooks") → emit "unsupported hooks"       │
   │   (HOOK-04 — UPDATE THIS SUBSTRING-MATCH ALONGSIDE        │
   │    install.ts MANIFEST_FIELD_REASONS — second rename site)│
   └───────────────────────────────────────────────────────────┘
                       │
                       ▼
                shared/notify.ts::REASONS
                   "hooks" → "unsupported hooks" (HOOK-04 rename)
                       │
                       ▼
              (unavailable) {unsupported hooks}  ← user sees
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/domain/components/
├── hooks.ts                  # EXTENDED (180 → ~450 lines)
│                             #   + parseMatcher
│                             #   + checkMatcherSupportability
│                             #   + parseHooksConfig extension (D-58-03)
├── hook-tool-names.ts        # NEW — TOOL-01 bidirectional map (D-58-04)
└── hook-events.ts            # NEW — bucket-A 8-event tuple + per-non-tool-event maps (D-58-06)

extensions/pi-claude-marketplace/shared/
└── notify.ts                 # REASONS rename: "hooks" → "unsupported hooks" (HOOK-04)

extensions/pi-claude-marketplace/shared/
└── probe-classifiers.ts      # narrowResolverNotes substring-match update (HOOK-04 — second site)

extensions/pi-claude-marketplace/orchestrators/plugin/
└── install.ts                # MANIFEST_FIELD_REASONS drops "hooks" (D-58-02)
                              # MANIFEST_FIELD_TO_REASON drops the "hooks" entry

docs/
├── output-catalog.md         # 8 occurrences re-keyed (HOOK-04)
└── messaging-style-guide.md  # closed-set REASONS doc updated

tests/architecture/
├── catalog-uat.test.ts                       # 13 fixture rows re-keyed
├── hooks-foundation.test.ts                  # unchanged
├── hooks-matcher-parser.test.ts              # NEW (MATCH-01/MATCH-02)
├── hooks-tool-name-map.test.ts               # NEW (TOOL-01 completeness)
├── hooks-supportability.test.ts              # NEW (TOOL-02 closed-set + per-event)
└── notify-types.test.ts                      # REASONS length lock STAYS at 31 (rename, not +1)
```

### Pattern 1: Discriminated `parseMatcher` result

Following Phase 57's `HookConfigParseResult` shape:

```typescript
// Source: domain/components/hooks.ts (NEW additions, Phase 58)

export type ParsedMatcher =
  | { kind: "match-all" }                       // "", "*"
  | { kind: "tool-set"; piTools: ReadonlySet<PiToolName> }
  | { kind: "mcp-literal"; literal: string }    // "mcp__server__tool"
  | { kind: "regex" }                           // TOOL-02(a)
  | { kind: "unmapped"; token: string };        // TOOL-02(b)

/**
 * Tokenize the Claude-form matcher and classify into ParsedMatcher.
 * Pure: no I/O, no error throws.
 */
export function parseMatcher(raw: string): ParsedMatcher {
  if (raw === "" || raw === "*") return { kind: "match-all" };
  // ... tokenize pipe-OR, classify each token
}
```

**When to use:** Inside `parseHooksConfig`'s new traversal, once per
matcher-group `matcher` field.

### Pattern 2: D-58-03 single-seam discriminated result extension

The existing `HookConfigParseResult` already has a `{ ok: false, reason }`
arm. Fold the supportability failure into the SAME arm — the resolver code
narrows on `ok: false` and reads `reason` either way. No new third arm.

```typescript
// Source: domain/components/hooks.ts (revised return shape)

export type HookConfigParseResult =
  | { ok: true; value: HooksConfig }
  | { ok: false; reason: string; /* debugDetail routed to hookDebugLog */ };

// In parseHooksConfig — after the existing JSON.parse + HOOKS_VALIDATOR check:
//   const support = checkMatcherSupportability(parsed);
//   if (!support.ok) {
//     const reason = `unsupported hooks: ${support.debugDetail}`;
//     hookDebugLog(reason);
//     return { ok: false, reason };
//   }
//   return { ok: true, value: parsed };
```

**Why single-arm:** The resolver doesn't care whether the parse failed
because of malformed JSON or because of a regex matcher. Both flip
`installable: false` with reason `{unsupported hooks}`. Discriminating
at the parser would force a corresponding switch in the resolver that
delivers no behavioral difference.

### Pattern 3: TOOL-01 bidirectional map as `as const` Record

```typescript
// Source: domain/components/hook-tool-names.ts (NEW)

/**
 * D-58-05: `find ↔ Glob` mapping accepted with LOW-confidence flag —
 * semantic mismatch risk (Pi find is Unix-find-style; Claude Glob is
 * glob-pattern file-finder) is bounded by zero first-party plugin
 * exposure under v1.13.
 */
export const PI_TO_CLAUDE_TOOL_NAMES = {
  bash:  "Bash",
  read:  "Read",
  edit:  "Edit",
  write: "Write",
  grep:  "Grep",
  find:  "Glob",
  ls:    "LS",
} as const satisfies Record<PiToolName, string>;

// Reverse map derived at module load — keeps source of truth single-sited.
export const CLAUDE_TO_PI_TOOL_NAMES = {
  Bash:  "bash",
  Read:  "read",
  Edit:  "edit",
  Write: "write",
  Grep:  "grep",
  Glob:  "find",
  LS:    "ls",
} as const satisfies Record<string, PiToolName>;
```

`PiToolName` is the literal union `"bash" | "read" | "edit" | "write" |
"grep" | "find" | "ls"` mirrored from the peer-dep
`ToolCallEvent.toolName` discriminated union (see Pi peer-dep
verification below).

### Pattern 4: Bucket-A event closed-set tuple

```typescript
// Source: domain/components/hook-events.ts (NEW)

/**
 * v1.13 supported bucket-A events. Referenced from Phase 58 (TOOL-02(c)),
 * Phase 59 (DISP-01 pi.on registration), and Phase 63 (SURF-02 typed
 * notify model). Order is irrelevant — membership is the only contract.
 */
export const BUCKET_A_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
] as const;

export type BucketAEvent = (typeof BUCKET_A_EVENTS)[number];

/** Tool-events: matcher targets the tool name. */
export const TOOL_EVENTS = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;
export type ToolEvent = (typeof TOOL_EVENTS)[number];
```

### Anti-Patterns to Avoid

- **Translating Claude → Pi at runtime in the dispatcher.** Phase 58's
  parser MUST translate Claude form → Pi form at PARSE TIME via TOOL-01's
  reverse map. Phase 59's dispatcher reads pre-translated Pi-form sets.
  Runtime translation re-introduces Pitfall 8 (matcher silent-mis-handling)
  and adds a hot-path TOOL-01 lookup per event.
- **Per-entry skip on regex matcher.** TOOL-02 is strict per-PLUGIN.
  A single regex matcher anywhere in the file flips the entire plugin to
  `(unavailable) {unsupported hooks}`. No silent half-installs.
- **Distinguishing TOOL-02(a)/(b)/(c)/(d) in the user-facing reason.**
  All four conditions render the SAME `"unsupported hooks"` reason; the
  per-condition detail goes to `hookDebugLog` only (CONTEXT.md D-58-03).
- **Discriminating `parseHooksConfig` callers on which condition tripped.**
  The resolver already narrows on `ok: false` and pushes `reason` into
  `partial.notes`. Adding a third arm forces a downstream switch with no
  payoff.
- **Throwing on regex / unmapped matcher.** `parseHooksConfig` returns
  a discriminated result, never throws (D-57-04 contract); Phase 58 must
  preserve.
- **Promoting `find ↔ Glob` to HIGH confidence.** D-58-05 explicitly
  accepted the semantic-mismatch risk at LOW confidence with the
  understanding that v1.14+ may refine.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Matcher token parser | A regex/PEG/parser-combinator for hook matcher syntax | Plain `String.prototype.split("\|")` + char-class regex test | Claude's matcher grammar is "literal tool name OR pipe-OR alternation of literal tool names OR `mcp__...` literal". A character-class gate (`/^[A-Za-z0-9_|\-]+$/.test(token)`) is enough to detect regex; pipe-OR splits on the literal `\|`. Anything more is over-engineering. |
| Reverse map derivation | Compute `CLAUDE_TO_PI` from `PI_TO_CLAUDE` at load time via `Object.entries` reduce | Two hand-written `as const` Records with paired `satisfies` proofs | A computed reverse map loses literal-type information; the architecture test for TOOL-01 completeness needs literal-type introspection. Two hand-written maps + an architecture-test invariant locking their inverse-relationship is cleaner than computed types with branded keys. |
| Bucket-A event tuple as schema | TypeBox `Type.Union([...Literal(8)])` for the event closed set | Plain `as const` tuple + `Type.Static<...>` indexed-access type | The bucket-A set is reference data, not a validator input. No `Check` call ever runs against it. The existing pattern (`SUPPORTED_COMPONENT_KINDS`, `REASONS`, `STATUS_TOKENS`) is `as const` tuple — match it. |
| MCP literal parser | A grammar parser for `mcp__server__tool` shape | One regex: `/^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/` | The CONTEXT.md MATCH-02 character-set definition already encodes this. A grammar parser would add zero validation power. |
| Pi-side runtime tool-name translation | Translate `event.toolName` to Claude form on every dispatch | Pre-translated `Set<PiToolName>` at parse time | Phase 59's dispatcher will do `piFormSet.has(event.toolName)` directly — zero runtime translation cost, zero footgun for the user-facing matcher semantics. |

**Key insight:** Phase 58's "work" is almost entirely declarative
closed-set data + a thin parse-time gate. The instinct to "build a hook
matcher library" is wrong; the bar is "parse the literal subset of
Claude's grammar, reject everything else."

## Runtime State Inventory

> **Skipped — greenfield parser + closed-set extension.** Phase 58 is a
> pure-source-code phase: no databases, no live service config, no OS-
> registered state, no secrets/env vars, no installed packages affected.
> The HOOK-04 byte-form rename does NOT touch any persisted user state
> (no v1.0–v1.12 state.json record carries `hooks` as a resource because
> Phase 57 only landed days ago and no plugin has yet been installed with
> the new `hooks` resource).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `hooks` resource was added by Phase 57 / D-57-03 (`generatedName` strings) and no installable hook-using plugin has shipped yet. | None. |
| Live service config | None — no external services. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | None — pure source code changes inside `extensions/pi-claude-marketplace/`. | None. |

## Common Pitfalls

### Pitfall 1: Pi-form lowercase matchers silently never match

**What goes wrong:** A user, drawing from `@earendil-works/pi-coding-agent`
extension docs, writes `matcher: "edit"` in `hooks.json`. The bridge
silently accepts it (passes character-class gate, passes TOOL-01
reverse-map lookup as "not a Claude tool"), and the hook never fires.

**Why it happens:** The matcher is supposed to be Claude form. If the
parser doesn't reject unknown Claude-form tokens, lowercase Pi-form
slips through unmatched.

**How to avoid:** TOOL-02(b) — unmapped Claude-form tokens flip the
plugin to `(unavailable) {unsupported hooks}`. The check uses
`CLAUDE_TO_PI_TOOL_NAMES`'s key set: a token like `"edit"` is NOT a
key (the keys are `Edit` / `Bash` / etc.), so the check fires.

**Warning signs:** Test fixture that writes `matcher: "edit"` and
expects the plugin to install — that's the wrong contract. The plugin
MUST be unavailable.

### Pitfall 2: Substring-match `note.includes("hooks")` triggers TOOL-02 false-positives after HOOK-04 rename

**What goes wrong:** `probe-classifiers.ts:81` does
`note.includes("hooks") → emit "hooks" reason`. After HOOK-04, the emitted
reason becomes `"unsupported hooks"`. If the substring match is left as
`includes("hooks")`, an unrelated free-form note containing the word
"hooks" (e.g. resolver diagnostic strings) would map to
`"unsupported hooks"` incorrectly.

**Why it happens:** The substring match is permissive by design (Phase 57
intentionally went lenient on the prefix form). Tightening to
`note.startsWith("malformed hooks.json:")` OR
`note.startsWith("unsupported hooks:")` is required.

**How to avoid:** Update `probe-classifiers.ts::narrowResolverNotes` in
the same commit as the REASONS rename:
1. Rename the emitted token: `out.push("hooks")` → `out.push("unsupported hooks")`.
2. Tighten the detection: `note.includes("hooks")` →
   `note.startsWith("malformed hooks.json:") || note.startsWith("unsupported hooks:")`.
3. Update the return-type union: `"hooks" | "lsp" | "unsupported source"` → `"unsupported hooks" | "lsp" | "unsupported source"`.

**Warning signs:** Any catalog-uat fixture row that previously emitted
`{hooks}` and now emits `{unsupported hooks}` — but the underlying note
test still uses the loose substring. CI should byte-compare.

### Pitfall 3: SessionStart matcher value-set mismatch — Pi has no `clear` or `compact` reason

**What goes wrong:** D-58-06 claims SessionStart Claude `source ∈
{startup, resume, clear, compact}` maps to Pi `session_start.reason`.
But Pi's `SessionStartEvent.reason` is
`"startup" | "reload" | "new" | "resume" | "fork"` — there is NO Pi
value matching Claude's `clear` or `compact`.

**Why it happens:** Authority research doc
`docs/research/claude-hooks-vs-pi-events.md:123` notes
"Pi has no `clear`/`compact` reason." The CONTEXT.md
treats the Claude value set as the closed set; the mapping table to
Pi-side filter must encode the partial-mapping reality.

**How to avoid:** The per-event closed-set tables in `hook-events.ts`
MUST record TWO axes:
1. **Claude-side closed set** (used for the supportability check —
   reject Claude values outside the documented set as TOOL-02-equivalent).
2. **Pi-side translation table** (used by Phase 59's registration —
   `startup → "startup"`, `resume → "resume"`, `clear → ???`,
   `compact → ???`). The two unmappable Claude values either
   (a) flip TOOL-02 unavailable at parse time, or (b) translate to
   a Pi-side filter that never fires (semantic dead-letter).

**Recommendation:** Treat `clear` and `compact` as TOOL-02 unavailable
under v1.13 (strict-supportability stance — silent never-fires is the
documented failure mode). Document the v1.14+ unblock path: if Pi adds
the corresponding `session_start.reason` values, the mapping becomes
1:1 and the plugin flips installable.

**Warning signs:** The fixture in `hooks-supportability.test.ts` for
SessionStart matcher `clear` must assert `ok: false` with reason
containing the per-condition detail.

### Pitfall 4: PreCompact / PostCompact trigger values not exposed by Pi peer-dep

**What goes wrong:** Claude's PreCompact/PostCompact matcher target is
`trigger ∈ {manual, auto}`. Pi's `SessionBeforeCompactEvent` and
`SessionCompactEvent` carry NO `manual`/`auto` trigger field — only
`preparation` (PreCompact) and `compactionEntry` (PostCompact).

**Why it happens:** The Pi peer-dep does not expose the trigger source.
A matcher value `"manual"` on PreCompact has nothing to filter against.

**How to avoid:** Treat the entire matcher set `{manual, auto}` on
PreCompact/PostCompact as TOOL-02 unavailable under v1.13 — strict
supportability says silent over-fire (treat as match-all) AND silent
never-fire are both failure modes. Only the empty/`*` match-all path
is supportable.

**Warning signs:** A plugin with `PreCompact` matcher `"manual"` that
installs cleanly under v1.13 — that contradicts strict supportability.

### Pitfall 5: UserPromptSubmit matcher unconditional reject

**What goes wrong:** A plugin author writes a matcher under
UserPromptSubmit thinking it filters prompts. Claude Code has NO matcher
support for UserPromptSubmit upstream (`docs/research/claude-hook-config-syntax.md`
§ "Matcher target field per event type" — UserPromptSubmit is in the
"no matcher support" row).

**How to avoid:** Per CONTEXT.md D-58-06, ANY non-empty matcher on
UserPromptSubmit trips TOOL-02. Match-all (`""` or `"*"`) is the only
supportable form. Encode UserPromptSubmit's `NON_TOOL_EVENT_FIELDS`
entry as a sentinel (e.g. `null` field name → "no matcher support").

### Pitfall 6: Pipe-OR edge case `"|"` (lone pipe, no left/right)

**What goes wrong:** A matcher value of literal `"|"` splits into
`["", ""]` — two empty tokens. Neither is a valid Claude tool name.

**Recommendation (Claude's Discretion in CONTEXT.md):** Treat `"|"` as
TOOL-02-tripping (regex-like / malformed). The CONTEXT.md leaves this
to the planner; the strict-supportability stance favors loud failure
over silent match-all. The MATCH-02 character-set definition admits
`|` as a safe character, so the bare-pipe case isn't caught by the
regex gate — it must be caught by a separate "no empty token after
split" check.

**Warning signs:** Fixture row for matcher `"|"` that expects the
plugin to install — that's the wrong choice.

### Pitfall 7: Catalog-uat fixture rename collisions

**What goes wrong:** 13 fixture rows in `catalog-uat.test.ts` currently
use `reasons: ["hooks"]`. After the REASONS rename, every literal
`"hooks"` in fixtures becomes `"unsupported hooks"`. The
`notify-types.test.ts` `_Assert_ReasonsLen extends 31` lock stays
unchanged (rename, not addition), but per-variant `Reason`-literal
references (if any) need updating.

**How to avoid:** `grep -rn '"hooks"' tests/` catches both the
`reasons: ["hooks"]` and the `narrowResolverNotes` return-type union;
plan the rename via a single search-and-replace, then byte-compare
catalog-uat output.

**Warning signs:** A test that compiles after the REASONS tuple member
rename but produces wrong output bytes — the fixture row matched the
old emitted-bytes string `{hooks}`.

### Pitfall 8: Architecture-test source-of-truth mirror drifts

**What goes wrong:** The TOOL-01 completeness test must assert "every
Pi `toolName` literal in the peer-dep types has a mapping entry." If the
peer-dep bumps and adds a new tool (`mv`?), the architecture test must
red-fail. If the test uses a hard-coded `const PI_TOOLS = [...]` mirror
of the peer-dep union, the mirror itself can drift.

**How to avoid:** Use TypeScript's type-level introspection. Approach:

```typescript
// Compile-time exhaustiveness via Pick:
import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";

type _Exhaustive = Exclude<ToolCallEvent["toolName"], "string"> extends
  keyof typeof PI_TO_CLAUDE_TOOL_NAMES ? true : never;
const _: _Exhaustive = true;  // type error if any literal missing
```

The `Exclude<..., "string">` drops the `CustomToolCallEvent.toolName:
string` open-ended arm — only the 7 literals participate. This is the
mechanism Phase 57's `hooks-foundation.test.ts` already uses (the
`@ts-expect-error` directive locks NFR-7).

**Recommendation:** TypeScript-level exhaustiveness > hard-coded const
tuple mirror. The compile-time check is load-bearing; runtime
`deepEqual` is supplementary.

## Code Examples

### parseMatcher (NEW — Phase 58)

```typescript
// Source: domain/components/hooks.ts (proposed addition; pseudocode shape)

import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "./hook-tool-names.ts";

export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; piTools: ReadonlySet<PiToolName> }
  | { kind: "mcp-literal"; literal: string }
  | { kind: "regex" }
  | { kind: "unmapped"; token: string };

const SAFE_TOKEN_CHARS = /^[A-Za-z0-9_-]+$/;
const MCP_LITERAL = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/;
const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|\-]+$/;

export function parseMatcher(raw: string): ParsedMatcher {
  if (raw === "" || raw === "*") {
    return { kind: "match-all" };
  }

  // MATCH-02 char-class gate. Any char outside the safe set (and not
  // matching the MCP literal extension) is regex.
  if (!SAFE_MATCHER_CHARS.test(raw)) {
    // MCP literals can contain a single embedded `_` repeated pair, which
    // the safe set already admits; the MCP-specific shape is checked below.
    if (MCP_LITERAL.test(raw)) {
      return { kind: "mcp-literal", literal: raw };
    }
    return { kind: "regex" };
  }

  // Split on pipe-OR. Empty tokens (e.g. from "|" or "Edit|") trip TOOL-02
  // — choose strict (regex-equivalent rejection) per strict-supportability.
  const tokens = raw.split("|");
  if (tokens.some((t) => t === "")) {
    return { kind: "regex" }; // malformed pipe-OR
  }

  // Each token is either a Claude tool name (mapped via TOOL-01 reverse map)
  // or an MCP literal (passes through) or unmapped (TOOL-02(b)).
  const piTools = new Set<PiToolName>();
  for (const token of tokens) {
    if (MCP_LITERAL.test(token)) {
      // Mixed MCP + tool tokens: MCP literal cannot mix with tool-name
      // alternation in Claude's grammar. Reject per strict-supportability.
      return { kind: "regex" };
    }
    if (!SAFE_TOKEN_CHARS.test(token)) {
      return { kind: "regex" };
    }
    const piName = CLAUDE_TO_PI_TOOL_NAMES[token];
    if (piName === undefined) {
      return { kind: "unmapped", token };
    }
    piTools.add(piName);
  }

  return { kind: "tool-set", piTools };
}
```

**Notes for the planner:**
- The single-MCP-literal path (no pipe-OR) is the simple form — handle
  before the split.
- Mixed `Edit|mcp__server__tool` is malformed under Claude's grammar;
  the parser above rejects it via the per-token MCP test. Verify against
  authority doc § 2 matcher-semantics table.
- The "empty token from `|` split" check is the Pitfall 6 mitigation.

### checkMatcherSupportability (NEW — Phase 58)

```typescript
// Source: domain/components/hooks.ts (proposed addition; pseudocode shape)

import {
  BUCKET_A_EVENTS,
  TOOL_EVENTS,
  NON_TOOL_EVENT_FIELDS,        // map: event → field-name | null
  NON_TOOL_EVENT_CLOSED_SETS,   // map: event → ReadonlySet<string>
  type BucketAEvent,
} from "./hook-events.ts";

interface SupportabilityFailure {
  ok: false;
  // Per-condition detail for hookDebugLog only. NOT user-facing.
  debugDetail: string;
}
interface SupportabilityOk { ok: true; }
type Supportability = SupportabilityOk | SupportabilityFailure;

export function checkMatcherSupportability(config: HooksConfig): Supportability {
  for (const [eventName, groups] of Object.entries(config)) {
    // TOOL-02(c) — non-bucket-A event.
    if (!(BUCKET_A_EVENTS as readonly string[]).includes(eventName)) {
      return { ok: false, debugDetail: `(c) non-bucket-A event: ${eventName}` };
    }
    const bucketA = eventName as BucketAEvent;

    for (const group of groups) {
      const rawMatcher = group.matcher ?? "";

      // Tool-event path: parse matcher tokens, reject regex/unmapped.
      if ((TOOL_EVENTS as readonly string[]).includes(bucketA)) {
        const parsed = parseMatcher(rawMatcher);
        if (parsed.kind === "regex") {
          return { ok: false, debugDetail: `(a) regex matcher in ${bucketA}: ${rawMatcher}` };
        }
        if (parsed.kind === "unmapped") {
          return { ok: false, debugDetail: `(b) unmapped tool in ${bucketA}: ${parsed.token}` };
        }
      } else {
        // Non-tool event path: empty/`*` is always supportable.
        // Non-empty matcher must hit the per-event closed value set
        // — UserPromptSubmit has NO matcher support upstream (Pitfall 5).
        if (rawMatcher !== "" && rawMatcher !== "*") {
          const allowed = NON_TOOL_EVENT_CLOSED_SETS[bucketA];
          if (allowed === undefined) {
            return { ok: false, debugDetail: `(c) matcher on no-matcher-support event: ${bucketA}` };
          }
          if (!allowed.has(rawMatcher)) {
            return { ok: false, debugDetail: `(c) matcher value not in closed set for ${bucketA}: ${rawMatcher}` };
          }
        }
      }

      // TOOL-02(d) — handler.type !== "command".
      for (const handler of group.hooks) {
        if (handler.type !== "command") {
          return { ok: false, debugDetail: `(d) non-command handler in ${bucketA}: ${handler.type}` };
        }
      }
    }
  }
  return { ok: true };
}
```

### Architecture test pattern — TOOL-01 completeness (NEW)

```typescript
// Source: tests/architecture/hooks-tool-name-map.test.ts (NEW — proposed)

import assert from "node:assert/strict";
import test from "node:test";

import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import {
  PI_TO_CLAUDE_TOOL_NAMES,
  CLAUDE_TO_PI_TOOL_NAMES,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts";

// Compile-time exhaustiveness: every Pi tool literal must be a key of
// PI_TO_CLAUDE_TOOL_NAMES. The `satisfies Record<PiToolName, string>`
// constraint at the const-declaration site is the load-bearing check;
// the `npm run typecheck` task is the gate.

// Runtime invariant: TOOL-01's two maps are inverses of each other.
test("TOOL-01: PI_TO_CLAUDE_TOOL_NAMES and CLAUDE_TO_PI_TOOL_NAMES are inverses", () => {
  for (const [pi, claude] of Object.entries(PI_TO_CLAUDE_TOOL_NAMES)) {
    assert.equal(
      CLAUDE_TO_PI_TOOL_NAMES[claude],
      pi,
      `mapping disagreement at ${pi} ↔ ${claude}`,
    );
  }
  for (const [claude, pi] of Object.entries(CLAUDE_TO_PI_TOOL_NAMES)) {
    assert.equal(
      PI_TO_CLAUDE_TOOL_NAMES[pi],
      claude,
      `reverse mapping disagreement at ${claude} ↔ ${pi}`,
    );
  }
});

// Peer-dep coverage runtime check — assert every type-guard variant
// the peer dep exports has a TOOL-01 entry by name. This catches a
// peer-dep bump that adds a new tool literal AT RUNTIME (in addition
// to the compile-time exhaustiveness gate). The seven `isToolCallEventType`
// overloads in `node_modules/@earendil-works/pi-coding-agent/dist/core/
// extensions/types.d.ts:720-726` are the source of truth.
test("TOOL-01: every Pi tool literal in peer-dep has a TOOL-01 entry", () => {
  const piTools = ["bash", "read", "edit", "write", "grep", "find", "ls"] as const;
  for (const tool of piTools) {
    assert.ok(
      tool in PI_TO_CLAUDE_TOOL_NAMES,
      `Pi tool "${tool}" is missing from PI_TO_CLAUDE_TOOL_NAMES`,
    );
  }
  // Lock the count so a peer-dep bump adding an 8th tool red-fails CI.
  assert.equal(Object.keys(PI_TO_CLAUDE_TOOL_NAMES).length, 7);
});
```

## State of the Art

| Old Approach (Phase 57 baseline) | Phase 58 Approach | When Changed | Impact |
|----------------------------------|-------------------|--------------|--------|
| `parseHooksConfig` only checks JSON shape + REQUIRED `command` on `type: "command"` | + matcher parse + per-handler `type` gate + bucket-A event gate + per-event closed-set gate | Phase 58 | Same discriminated-result shape (no breaking change); resolver consumers unchanged. |
| `MANIFEST_FIELD_REASONS` carve-out emits `{hooks}` for `contains hooks` notes | Carve-out drops `"hooks"` entirely; `lspServers → lsp` remains | D-58-02 | Dead-code removal. Under v1.13, `hooks` is a SUPPORTED component kind so the manifest-field-rejection branch never fires. |
| `narrowResolverNotes` emits `"hooks"` | Emits `"unsupported hooks"` + tighter detection | HOOK-04 | Two-site update (`narrowResolverNotes` substring + REASONS member rename). CONTEXT.md only lists one site — second site is the gap this research surfaces. |
| `REASONS` tuple member `"hooks"` | Renamed to `"unsupported hooks"` | HOOK-04 | Tuple LENGTH unchanged (31). `notify-types.test.ts::_Assert_ReasonsLen` stays. |

**Deprecated/outdated:**
- The `{hooks}` user-facing brace form retires across the entire output
  surface in this commit. Catalog-uat fixtures (13 rows), output-catalog
  docs (8 occurrences), messaging-style-guide closed-set doc — all
  re-keyed to `{unsupported hooks}` in lockstep.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pipe-OR with empty token (e.g. `"\|"` or `"Edit\|"`) should trip TOOL-02 rather than be treated as match-all | Pattern 1 / Pitfall 6 | LOW — strict-supportability stance prefers loud rejection; Claude Code's actual behavior on these forms is not documented. If Claude treats them as match-all, our strict rejection is more conservative (no plugin breakage; some plugins flip unavailable that wouldn't upstream). [ASSUMED] |
| A2 | A mixed token list like `"Edit\|mcp__server__tool"` is malformed under Claude's grammar | Pattern 1 / parseMatcher example | MEDIUM — `docs/research/claude-hook-config-syntax.md` § 2 doesn't explicitly forbid mixing. If Claude allows it, our parser rejects valid input as regex. [ASSUMED] |
| A3 | The `clear` and `compact` Claude SessionStart source values map to no Pi `session_start.reason` value and thus trip TOOL-02 | Pitfall 3 / D-58-06 | MEDIUM — authority doc `claude-hooks-vs-pi-events.md:123` confirms "Pi has no `clear`/`compact` reason" but doesn't prescribe the v1.13 disposition. The planner / discuss-phase should confirm: trip TOOL-02 unavailable, OR map to a Pi-side no-fire filter? Strict-supportability favors trip TOOL-02. [ASSUMED] |
| A4 | The `manual` and `auto` Claude PreCompact/PostCompact trigger values map to no Pi `session_before_compact` / `session_compact` field and thus trip TOOL-02 | Pitfall 4 / D-58-06 | MEDIUM — verified from peer-dep `types.d.ts:423-434` that no `trigger` field exists. Strict-supportability says trip TOOL-02; planner should confirm. [ASSUMED] |
| A5 | The `find ↔ Glob` mapping is bidirectional even though semantics differ (Unix-find vs glob-pattern file-finder) | Pattern 3 / D-58-05 | LOW — D-58-05 explicitly accepted the risk at LOW confidence; v1.14+ may refine. [VERIFIED: 58-CONTEXT.md D-58-05] |
| A6 | The `probe-classifiers.ts::narrowResolverNotes` site needs updating in Phase 58 alongside the REASONS rename | Pitfall 2 / "What V1 Should Reconsider" | HIGH — verified from source `shared/probe-classifiers.ts:81`. Failure to update produces compile errors (return-type union mismatch). [VERIFIED: codebase grep] |
| A7 | No installable plugin currently carries `hooks` as a persisted resource (so no state.json migration needed for the rename) | Runtime State Inventory | HIGH — verified: Phase 57 landed days ago and no v1.13 hook-using plugin is yet installable end-to-end (still pending Phase 59-63). [VERIFIED: git log + persistence/migrate.ts inspection] |
| A8 | Keeping the parser in-line in `hooks.ts` (~450 lines total) is preferred over extracting to a sibling helper | Standard Stack / Alternatives Considered | LOW — D-58-03 locks this leaning. CONTEXT.md explicitly says "stays at single-file leaf-pure scope." [VERIFIED: 58-CONTEXT.md D-58-03] |

**Resolution of A3 and A4 is a planner / discuss-phase action item.** The
strict-supportability stance + authority doc → strongly recommend
TOOL-02-trip for both, but the user has not explicitly locked this in
CONTEXT.md.

## Open Questions

1. **Should `clear` / `compact` SessionStart matcher values trip TOOL-02 (Pitfall 3) or pass with a Pi-side no-fire filter?**
   - What we know: Pi peer-dep does NOT expose `clear` or `compact` as
     `session_start.reason` values. Strict-supportability says silent
     never-fire is a failure mode.
   - What's unclear: Whether the discuss-phase locked the strict-trip
     stance for these specific values, or only locked it at the abstract
     "if we can't fully honor the matcher" level.
   - Recommendation: Trip TOOL-02 unavailable. Document the v1.14+
     unblock path (Pi adds the reason values).

2. **Should `manual` / `auto` PreCompact/PostCompact matchers trip TOOL-02 (Pitfall 4)?**
   - What we know: Pi peer-dep has NO `trigger` field on either
     compact event. The only Pi-side filter axis is none — handler fires
     on every compact regardless of trigger.
   - What's unclear: Same as #1 — needs explicit planner confirmation.
   - Recommendation: Trip TOOL-02 unavailable for any matcher value
     other than empty / `*`.

3. **Should `parseMatcher` distinguish "regex" vs "unmapped" vs "malformed pipe-OR" in the returned discriminator?**
   - What we know: TOOL-02 renders the SAME user-facing reason for all
     three; the debug detail is the only differentiator.
   - What's unclear: Does the architecture-test gate need separate
     ParsedMatcher arms to test "regex" vs "malformed pipe-OR"
     separately?
   - Recommendation: Yes, keep them separate at the parser layer.
     Easier per-condition fixture tests. The `checkMatcherSupportability`
     caller collapses them all into the same `ok: false` reason.

4. **How many new catalog states does TOOL-02 introduce per surface?**
   - What we know: 13 fixture rows currently carry `reasons: ["hooks"]`
     across install / preview / reconcile-apply / info / list surfaces.
     Re-keying is mechanical; NEW fixtures for the four TOOL-02 trigger
     conditions (per surface) are additive.
   - What's unclear: Whether each trigger condition gets a separate
     fixture (4 × 5 surfaces = 20 new rows) or one fixture per surface
     (5 new rows) since all four conditions render the SAME bytes.
   - Recommendation: ONE new fixture per surface (5 new rows), since
     byte equality is the only contract. Per-condition fixtures belong
     in `hooks-supportability.test.ts` (architecture-test scope), not
     catalog-uat (byte-equality scope).

## Environment Availability

> **Skipped — no external dependencies.** Phase 58 is pure source-code
> work: TypeScript parser logic + closed-set tables + architecture tests.
> All required tools (`typebox`, `node:test`, peer-dep types) are already
> on disk via prior phases' `npm install`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) — Node 20.19+ |
| Config file | none — `node:test` self-configures via `node --test` |
| Quick run command | `node --test --test-name-pattern="hooks|TOOL|MATCH" tests/architecture/hooks-*.test.ts tests/domain/components/hooks.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MATCH-01 | `parseMatcher("Edit")` → `{kind:"tool-set", piTools:Set(["edit"])}` | unit | `node --test tests/domain/components/hooks.test.ts` | ❌ Wave 0 (extend existing) |
| MATCH-01 | `parseMatcher("Edit\|Write")` → `{kind:"tool-set", piTools:Set(["edit","write"])}` | unit | same | ❌ Wave 0 |
| MATCH-01 | `parseMatcher("")` / `parseMatcher("*")` → `{kind:"match-all"}` | unit | same | ❌ Wave 0 |
| MATCH-01 | `parseMatcher("mcp__server__tool")` → `{kind:"mcp-literal", literal:"mcp__server__tool"}` | unit | same | ❌ Wave 0 |
| MATCH-01 | `parseMatcher("edit")` (Pi-form lowercase) → `{kind:"unmapped"}` (Pitfall 1) | unit | same | ❌ Wave 0 |
| MATCH-02 | `parseMatcher("Edit.*")` → `{kind:"regex"}` | unit | same | ❌ Wave 0 |
| MATCH-02 | `parseMatcher("\|")` → `{kind:"regex"}` (Pitfall 6) | unit | same | ❌ Wave 0 |
| TOOL-01 | TypeScript exhaustiveness — every Pi tool literal in peer-dep has a `PI_TO_CLAUDE_TOOL_NAMES` entry | architecture | `npm run typecheck` | ❌ Wave 0 (new file `hooks-tool-name-map.test.ts`) |
| TOOL-01 | Runtime invariant — `PI_TO_CLAUDE_TOOL_NAMES` and `CLAUDE_TO_PI_TOOL_NAMES` are inverses | architecture | `node --test tests/architecture/hooks-tool-name-map.test.ts` | ❌ Wave 0 |
| TOOL-02 (a) | Regex matcher in `hooks.json` → `parseHooksConfig` returns `ok: false, reason: "unsupported hooks: …"` | unit | `node --test tests/domain/components/hooks.test.ts` | ❌ Wave 0 |
| TOOL-02 (b) | Unmapped Claude tool (`MultiEdit`) in matcher → same | unit | same | ❌ Wave 0 |
| TOOL-02 (c) | Non-bucket-A event (`Stop`) → same | unit | same | ❌ Wave 0 |
| TOOL-02 (c) | UserPromptSubmit with non-empty matcher (Pitfall 5) → same | unit | same | ❌ Wave 0 |
| TOOL-02 (d) | Handler `type: "http"` → same | unit | same | ❌ Wave 0 |
| TOOL-02 closed-set | `BUCKET_A_EVENTS` tuple is exactly the 8 documented events; architecture-test deepEqual lock | architecture | `node --test tests/architecture/hooks-supportability.test.ts` | ❌ Wave 0 |
| HOOK-04 | `REASONS` tuple member is now `"unsupported hooks"`; tuple length unchanged at 31 | architecture | `npm run typecheck` (`_Assert_ReasonsLen extends 31`) | ✅ `tests/architecture/notify-types.test.ts:912` |
| HOOK-04 | Resolver flow: malformed hooks.json → renders `(unavailable) {unsupported hooks}` via existing notify cascade | integration (catalog-uat) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (re-key 13 fixtures) |
| HOOK-04 | `narrowResolverNotes` emits `"unsupported hooks"` for both `"malformed hooks.json: …"` and `"unsupported hooks: …"` notes | unit | new test in `tests/shared/probe-classifiers.test.ts` (if file exists) or extend `tests/architecture/notify-grammar-invariant.test.ts` | ❌ Wave 0 (verify file existence) |
| D-58-02 | `MANIFEST_FIELD_REASONS` set no longer contains `"hooks"` | unit | existing `install.ts` tests — check coverage | ⚠️ verify |
| D-58-06 | Per-non-tool-event closed-set membership lock; architecture-test deepEqual | architecture | `node --test tests/architecture/hooks-supportability.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/domain/components/hooks.test.ts tests/architecture/hooks-*.test.ts` (sub-second)
- **Per wave merge:** `npm run check` (full lint + typecheck + tests + format)
- **Phase gate:** Full `npm run check` green before `/gsd-verify-work`; catalog-uat byte-equality MUST pass.

### Wave 0 Gaps
- [ ] `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` — TOOL-01 source-of-truth (D-58-04)
- [ ] `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — bucket-A tuple + per-non-tool-event maps (D-58-06)
- [ ] `tests/architecture/hooks-tool-name-map.test.ts` — TOOL-01 completeness + inverse-invariant
- [ ] `tests/architecture/hooks-supportability.test.ts` — TOOL-02 closed-set + per-event invariants
- [ ] Extend `tests/domain/components/hooks.test.ts` — `parseMatcher` + `checkMatcherSupportability` unit tests
- [ ] Verify or create `tests/shared/probe-classifiers.test.ts` for the narrowed substring-match update
- [ ] All 13 catalog-uat `reasons: ["hooks"]` fixture rows re-keyed
- [ ] All 8 `docs/output-catalog.md` `{hooks}` occurrences re-keyed
- [ ] `docs/messaging-style-guide.md` closed-set REASONS section updated

## Security Domain

> **Skipped — no security-relevant work.** Phase 58 is pure pure-functional
> static-data + parser logic. No new I/O, no new network, no new
> child-process spawning, no new file-system access. The matcher parser
> only inspects in-memory strings; no untrusted file is read by this
> phase that wasn't already read by Phase 57.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (indirect) | TypeBox `Compile` (already in Phase 57) — the new matcher parser is downstream of `HOOKS_VALIDATOR.Check`; untrusted strings pass through validated shape before reaching `parseMatcher`. |
| V6 Cryptography | no | — |

No new threat patterns are introduced. The strict-supportability stance
itself is a defense-in-depth choice (silent never-fire / silent over-fire
are explicit anti-patterns) but is a UX / correctness invariant, not a
security control.

## Project Constraints (from CLAUDE.md)

- **Git policy:** branch `features/v1.13-hook-bridge` (already active);
  pre-commit hooks MUST pass before commit; commits to worktrees use
  `SKIP=trufflehog`. Phase 58 will not introduce a worktree (sequential
  mode given the lockstep byte-equality update spans 4 source files +
  catalog + docs + 13 fixture rows in one atomic commit).
- **Commit policy:** Conventional Commits; title ≤72 chars; body ≤80
  chars per line. Body should reference D-58-01..06 + MATCH-01 / MATCH-02
  / TOOL-01 / TOOL-02 / HOOK-04 IDs (NOT phase / plan / wave IDs per
  `.claude/rules/typescript-comments.md`).
- **Quality bar:** `npm run check` must stay green — typecheck + ESLint
  + Prettier + tests (NFR-6).
- **Versioning:** Phase 58 closure is a milestone-internal step;
  package.json bump waits for the v1.13 milestone close (per
  `milestone-close-uat-before-archive` memory).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MATCH-01 | Parse literal Claude tool names + pipe-OR + empty/`*` + MCP literals; Pi-form lowercase never matches | `parseMatcher` discriminated result + `CLAUDE_TO_PI_TOOL_NAMES` reverse map. Empty token in pipe-OR → regex (Pitfall 6). |
| MATCH-02 | Regex matcher (any char outside `[A-Za-z0-9_\|\-]` not part of MCP prefix) → TOOL-02 trip | `SAFE_MATCHER_CHARS` regex + `MCP_LITERAL` regex; matcher with both fails per-token reclassification. |
| TOOL-01 | Bidirectional Claude↔Pi tool-name map at `domain/components/hook-tool-names.ts` (D-58-04); architecture test covers every peer-dep Pi tool literal | `PI_TO_CLAUDE_TOOL_NAMES` + `CLAUDE_TO_PI_TOOL_NAMES` + `satisfies Record<PiToolName, string>` compile-time exhaustiveness + runtime inverse invariant test. |
| TOOL-02 | Plugin unavailable with `{unsupported hooks}` if ANY entry trips (a) regex / (b) unmapped tool / (c) non-bucket-A event / (d) non-`command` handler; per-condition detail to debug-log only | `checkMatcherSupportability` returns `Supportability` with `debugDetail`; reason rendered by existing not-installable cascade. |
| HOOK-04 (pull-forward, D-58-01) | REASONS `"hooks"` → `"unsupported hooks"` atomic byte-form rename + carve-out drop + catalog + docs + fixtures in one commit | TWO source-rename sites identified: (1) `shared/notify.ts::REASONS:81`; (2) `shared/probe-classifiers.ts::narrowResolverNotes:81` (Pitfall 2 — gap in CONTEXT.md). 13 catalog-uat fixtures + 8 docs occurrences + `MANIFEST_FIELD_REASONS` / `MANIFEST_FIELD_TO_REASON` carve-out drop per D-58-02. |

## Sources

### Primary (HIGH confidence)

- **Pi peer-dep types** — `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  - `:613-651` — `ToolCallEvent` discriminated union with 7 literal-toolName variants + `CustomToolCallEvent` open-ended fallback. Source of truth for TOOL-01's left column.
  - `:403-409` — `SessionStartEvent.reason: "startup" | "reload" | "new" | "resume" | "fork"`. **CRITICAL FINDING:** No `clear` or `compact` reason exists. Pitfall 3.
  - `:423-434` — `SessionBeforeCompactEvent` / `SessionCompactEvent` carry NO `trigger` field. Pitfall 4.
  - `:437-442` — `SessionShutdownEvent.reason: "quit" | "reload" | "new" | "resume" | "fork"`. **NO `clear` / `logout` / `prompt_input_exit` / `bypass_permissions_disabled` / `other`** — Claude's SessionEnd reason values are mostly unmappable. Per-event closed-set table must record this.
  - `:587-598` — `InputEvent` (Pi's UserPromptSubmit equivalent) has NO matcher field. Pitfall 5.
- **Phase 57 baseline source** — `extensions/pi-claude-marketplace/domain/components/hooks.ts` (180 lines) — sole module Phase 58 extends.
- **Catalog UAT fixture inventory** — `tests/architecture/catalog-uat.test.ts:272,276,507,582,829,1175,1708` (8 source-line hits; 13 fixture-row hits when expanding multi-reason arrays).
- **Output catalog source-of-truth** — `docs/output-catalog.md:59,136,182,301,534,750,1138,1144` (8 doc occurrences).
- **`narrowResolverNotes` substring-match site** — `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:75-100` (the second HOOK-04 rename site not called out in CONTEXT.md).
- **MANIFEST_FIELD carve-out** — `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1478-1488` (verified line numbers match CONTEXT.md D-58-02).
- **Authority research** — `docs/research/claude-hook-config-syntax.md` § 2 (matcher semantics summary table + per-event matcher target table), § 7 (per-field IMPLEMENT/TOLERATE/ESCALATE).
- **Authority research** — `docs/research/claude-hooks-vs-pi-events.md:123-152` (per-event Pi ↔ Claude mapping fidelity table — confirms `clear` / `compact` SessionStart reason gap and `manual` / `auto` PreCompact trigger gap).
- **Phase 57 architecture-test pattern** — `tests/architecture/hooks-foundation.test.ts` (5 invariants: STATE_SCHEMA literal, resources.hooks shape, HOOK-03 lenience, SUPPORTED/UNSUPPORTED tuples, NFR-7 type-level guard).

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` § Pitfall 8 (matcher silent-mis-handling — confirms regex detect-and-reject is the v1.13 stance), § Pitfall 10 (tool-name mapping drift — recommends architecture-test introspection).
- `.planning/REQUIREMENTS.md:24-44` (HOOK-04 + MATCH-01..03 + TOOL-01 / TOOL-02 prose, including the deliberate Phase 58 path-amendment of TOOL-01).
- `.planning/ROADMAP.md:178,183,214,306` — Phase 58 / Phase 63 boundaries; Phase 63 loses HOOK-04 per D-58-01.

### Tertiary (LOW confidence)

- The exact closure semantics of `"Edit|"` (trailing pipe) and `"|"` (lone pipe) under Claude Code's upstream parser — not documented in authority doc § 2; the strict-supportability stance lets Phase 58 reject them safely without needing upstream verification. Pitfall 6 captures the assumption.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already on disk and version-locked; no new package introductions.
- Architecture: HIGH — D-58-03 / D-58-04 / D-58-06 fully lock file placement and the single-seam discriminated result. The two NEW sibling files in `domain/components/` follow the established closed-set tuple pattern.
- TOOL-01 mapping table contents: HIGH — verified against Pi peer-dep `types.d.ts` 7-literal closed set + Claude tool-name spellings from authority doc § 6 (per-plugin audit).
- Per-non-tool-event closed-set membership (D-58-06): MEDIUM — the Claude-side closed sets are HIGH (authority doc § 2 table); the Pi-side translation table has LOW-confidence entries for `SessionStart.{clear, compact}` and `PreCompact/PostCompact.{manual, auto}` (no Pi field exposes the value — Pitfall 3 / 4). Strict-supportability stance recommends trip-TOOL-02 for these; planner / discuss-phase to confirm.
- HOOK-04 byte-equality coverage: HIGH — exact source-rename sites enumerated (notify.ts:72 + probe-classifiers.ts:81 + install.ts:1478,1486-1488); exact catalog-uat row count enumerated (13 source-line hits); exact docs occurrence count enumerated (8 hits).
- Pitfalls: HIGH — all 8 pitfalls derived from authority docs, codebase grep, or Pitfall 8 / 10 from the v1.13 research summary.

**Research date:** 2026-06-14
**Valid until:** Phase 58 closes (estimated 2026-06-21) or peer-dep major bump (whichever first).
