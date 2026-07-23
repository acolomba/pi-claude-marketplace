# Phase 4: Concern-module extraction & open-closed proof - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 9 (2 created TS, 1 created doc, 6 modified)
**Analogs found:** 9 / 9

> Output-neutral move-and-rewire. The "patterns to copy" are mostly **verbatim
> lifts** of existing spans inside `shared/notify.ts` plus the existing
> intra-shared module-shape precedent `shared/notify-reasons.ts`. There is no new
> behavior; the analog excerpts below ARE the source bytes the new files inherit.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/concerns/soft-dep.ts` (CREATE) | utility (presentation concern) | transform (pure: declares-flags + probe → markers) | `shared/notify-reasons.ts` (module shape) + `shared/notify.ts:1619-1770` (lifted logic) | exact |
| `shared/concerns/hooks.ts` (CREATE) | utility (presentation concern) | transform (entries → `string[]` mutation) | `shared/notify-reasons.ts` (module shape) + `shared/notify.ts:177-200, 2873-2888` (lifted logic) | exact |
| `shared/notify.ts` (MODIFY) | utility (renderer spine + shared vocabulary) | request-response (dispatcher) | self — remove two blocks, add two imports + delegating calls | self |
| `orchestrators/plugin/info.ts` (MODIFY) | orchestrator (info projector) | transform | self — repoint `HookSummaryEntry`/`ClaudeHookEvent` import | mechanical |
| `domain/components/hook-events.ts` (MODIFY) | domain (closed-set tables) | n/a | self — repoint `ClaudeHookEvent` import (preserves fence) | mechanical |
| `orchestrators/**` (MODIFY, ~8 files) | orchestrator | transform | self — repoint `Dependency` import IF `Dependency` moves | mechanical |
| `docs/open-closed-proof.md` (CREATE) | documentation (durable artifact) | n/a | `docs/messaging-style-guide.md` | role-match (doc tone/structure) |

## Shared Patterns

These three cross-cutting conventions apply to BOTH new `shared/concerns/*.ts`
files. They are extracted once here; the per-file sections below reference them.

### Module-shape / file-doc-comment style (intra-shared leaf module)

**Source:** `shared/notify-reasons.ts:1-22` — the existing intra-shared module
that imports a type from `notify.ts` and passes lint today. The two new concern
files MUST match this header shape.

```typescript
import type { Reason } from "./notify.ts";

/**
 * shared/notify-reasons.ts -- the topic-grouped organization of the closed
 * reasons set (D-09). The byte-critical runtime tuple `REASONS` stays declared
 * in `notify.ts` as the SINGLE source of catalog truth ...
 */
```

Conventions to copy verbatim:
- **File-leading block comment** opens with the relative module path
  (`shared/concerns/soft-dep.ts -- ...`) then a one-paragraph statement of what
  the module owns and what stays in `notify.ts`. Decision-ID anchors (`D-01`)
  are allowed; GSD phase/plan references are NOT (per
  `.claude/rules/typescript-comments.md`).
- **Explicit `.ts` extension** in every import specifier (`"./notify.ts"`,
  `"../../platform/pi-api.ts"`) — project is ESM, NodeNext resolution.
- **`as const` tuple + `(typeof X)[number]` literal-union idiom** for closed
  sets (`notify-reasons.ts:30-38` shows it; `DEPENDENCIES`/`Dependency` use the
  same shape).

### `import type` discipline (the real cycle-safeguard)

**Source:** `shared/notify-reasons.ts:1` — `import type { Reason } from "./notify.ts"`.

There is NO `import-x/no-cycle` rule configured (research §7 Risk 1
`[VERIFIED: grep no-cycle eslint.config.js]`), so type-only imports are the
only thing preventing a runtime cycle when `notify.ts` imports the concern AND
the concern references `notify.ts` types. **Every cross-module type the concern
files pull from `notify.ts` MUST use `import type`** (erased at runtime → no
cycle). `notify-reasons.ts` is the living proof this passes lint.

Anti-pattern (research §7): never have a concern `import` a *value/function*
from `notify.ts` — the call direction is one-way `notify.ts → concern`.

### Import-order (ESLint `import-x/order`, eslint.config.js:53-69)

**Source:** `shared/notify.ts:1-6` — the canonical ordered import block:

```typescript
import { softDepStatus } from "../platform/pi-api.ts";

import { assertNever, causeChainTrailer, ManualRecoveryError } from "./errors.ts";

import type { Scope } from "./types.ts";
import type { ExtensionAPI, ExtensionContext, SoftDepStatus } from "../platform/pi-api.ts";
```

Groups (`builtin/external/internal/parent/sibling/index/object/type`),
`newlines-between: always`, alphabetized: **value imports before `type`
imports**, parent (`../`) before sibling (`./`), blank line between groups. Run
`eslint --fix` + `prettier --write` on every new/edited file before commit
(research §7 Risk 3). The `import-x/no-restricted-paths` fence (eslint.config.js
BLOCK C, :256-267) restricts what imports INTO `shared/`; intra-`shared/` and
`shared/→platform/` imports are unrestricted — both concern files stay inside
those allowances.

---

## Pattern Assignments

### `shared/concerns/soft-dep.ts` (CREATE — utility, transform)

**Analog (module shape):** `shared/notify-reasons.ts`
**Analog (lifted logic):** `shared/notify.ts` — `DEPENDENCIES` (:476),
`SOFT_DEP_MARKER_AGENTS`/`_MCP` (:1619-1621), and the soft-dep branch inside
`composeReasons` (:1755-1763).

**Imports pattern** (apply the `import type` discipline + import-order shared
patterns above). The two cross-module types both come in type-only:

```typescript
import type { Reason } from "../notify.ts";              // intra-shared, type-only
import type { SoftDepStatus } from "../../platform/pi-api.ts"; // shared→platform, type-only
```

Note the depth change: from `shared/concerns/`, `notify.ts` is `../notify.ts`
and `pi-api.ts` is `../../platform/pi-api.ts` (one level deeper than the
`notify.ts` originals at `./notify.ts` / `../platform/pi-api.ts`).

**`DEPENDENCIES` + `Dependency` lift** (verbatim from notify.ts:470-476, :491-495):

```typescript
/**
 * Runtime tuple of every dependency literal (SNM-06). 2 entries. Drives the
 * renderer's per-dependency soft-dep probe path (`requires pi-subagents` /
 * `requires pi-mcp` reason emission).
 *
 * Pattern: closed-set `as const` tuple + `(typeof X)[number]` literal-union.
 */
export const DEPENDENCIES = ["agents", "mcp"] as const;
export type Dependency = (typeof DEPENDENCIES)[number];
```

**Marker constants lift** (verbatim from notify.ts:1619-1621):

```typescript
/** Soft-dep marker literals -- both are REASONS members (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents";
const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";
```

**Core pattern — the pure `softDepMarkers` helper.** This is the soft-dep
*branch* lifted out of `composeReasons` (notify.ts:1755-1763) into a pure
function. Order MUST stay agents-before-mcp (byte-critical — catalog-uat catches
drift, research §7 Risk 5):

```typescript
/** Pure given the probe result. Returns the soft-dep markers to append, in
 * canonical order (agents before mcp). */
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];
  if (declaresAgents && !probe.piSubagentsLoaded) {
    markers.push(SOFT_DEP_MARKER_AGENTS);
  }
  if (declaresMcp && !probe.piMcpAdapterLoaded) {
    markers.push(SOFT_DEP_MARKER_MCP);
  }
  return markers;
}
```

**Probe source (NOT moved — consumed as a type only):** `SoftDepStatus` /
`softDepStatus(pi)` stay in `platform/pi-api.ts:83-126`. The concern imports the
`SoftDepStatus` *type* only; the renderer keeps calling `softDepStatus(pi)`.

---

### `shared/concerns/hooks.ts` (CREATE — utility, transform)

**Analog (module shape):** `shared/notify-reasons.ts`
**Analog (lifted logic):** `shared/notify.ts` — hook types (:177-200) and
`appendHooksBlock` (:2873-2888).

**Imports pattern:** `hooks.ts` owns its types, so it imports **nothing** from
`notify.ts` (research §4) — strongest no-cycle position of the two concerns.
(If the planner chooses to move `COMPONENT_KINDS` too, it would need to import
`ComponentKind`/`PluginInfoComponentsResolved` type-only from `../notify.ts`;
research §1 + Assumption A1 recommend AGAINST that — leave `COMPONENT_KINDS` +
`appendResolvedComponentLines` in notify.ts, move only `appendHooksBlock` + the
hook types.)

**Hook types lift** (verbatim from notify.ts:177-200, including the file-leading
fence-rationale block at :139-175 which travels with the types):

```typescript
export type ClaudeHookEvent =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "PreCompact"
  | "PostCompact"
  | "SessionEnd";

type _ToolEvent = "PreToolUse" | "PostToolUse" | "PostToolUseFailure";

export type HookSummaryEntry =
  | { readonly event: _ToolEvent; readonly matcher: string }
  | { readonly event: Exclude<ClaudeHookEvent, _ToolEvent> }
  | {
      readonly kind: "lenient";
      readonly event: string;
      readonly supported: boolean;
    };

export interface HookSummary {
  readonly entries: readonly HookSummaryEntry[];
}
```

> **Fence note (preserve verbatim):** the `notify.ts:139-175` comment explains
> these types live on the `shared/` side so `domain/components/hook-events.ts`
> can `satisfies`-pin downward without breaching the `shared/→domain/` fence.
> Moving them to `shared/concerns/hooks.ts` keeps them on the `shared/` side →
> fence preserved identically. Carry the rationale comment into the new file
> (it documents WHY the types are not in `domain/`).

**Core pattern — `appendHooksBlock` lift** (verbatim from notify.ts:2873-2888;
must be `export`ed so `appendResolvedComponentLines` in notify.ts can import it).
Signature is exact — the one call-site at notify.ts:2909 must stay byte-identical:

```typescript
export function appendHooksBlock(
  lines: string[],
  entries: readonly HookSummaryEntry[] | undefined,
): void {
  if (entries === undefined || entries.length === 0) {
    return;
  }

  lines.push("    hooks:");
  for (const entry of entries) {
    if ("kind" in entry) {
      lines.push(`      ${entry.event}${entry.supported ? "" : " (unsupported)"}`);
    } else if ("matcher" in entry) {
      lines.push(`      ${entry.event}(${entry.matcher})`);
    } else {
      lines.push(`      ${entry.event}`);
    }
  }
}
```

---

### `shared/notify.ts` (MODIFY — renderer spine + shared vocabulary)

**Pattern:** remove the two moved blocks; add two static imports; replace the
soft-dep branch with a delegating call. `composeReasons` keeps its exact 4-arg
signature (the 13+ orchestrator callers are untouched — research §7 Non-risk).

**Add imports** (value import for the function, type imports for relocated
types still referenced by message interfaces / `PluginInfoComponentsResolved`):

```typescript
import { softDepMarkers } from "./concerns/soft-dep.ts";
import { appendHooksBlock } from "./concerns/hooks.ts";
// plus, if Dependency/HookSummaryEntry moved, type-only re-imports for the
// interfaces that still declare them in notify.ts:
import type { DEPENDENCIES, Dependency } from "./concerns/soft-dep.ts"; // value DEPENDENCIES if still referenced
import type { HookSummaryEntry } from "./concerns/hooks.ts";
```

**`composeReasons` soft-dep branch → delegating call** (replace notify.ts:1755-1763):

Source (current):
```typescript
const composed: Reason[] = reasons === undefined ? [] : [...reasons];

if (declaresAgents && !probe.piSubagentsLoaded) {
  composed.push(SOFT_DEP_MARKER_AGENTS);
}
if (declaresMcp && !probe.piMcpAdapterLoaded) {
  composed.push(SOFT_DEP_MARKER_MCP);
}
```
Target (delegated — byte-identical output, agents-before-mcp order preserved):
```typescript
const composed: Reason[] = reasons === undefined ? [] : [...reasons];
composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe));
```

**`appendResolvedComponentLines` call-site (notify.ts:2909) — UNCHANGED:**
```typescript
appendHooksBlock(lines, components.hooks); // now imported from ./concerns/hooks.ts
```
`COMPONENT_KINDS` (:2851-2857) + `appendResolvedComponentLines` (:2902-2922) STAY.

**Do NOT touch:** `redactAbsolutePaths` (:223-238, security primitive — research
§Security), the reducer spine, the envelope, the rest of the shared vocabulary
(`joinTokens`/`renderScopeBracket`/`renderVersion`/`composeVersionArrow`/
`pluginRow`, anchored by the D-11 comment at :1628-1632).

---

### `orchestrators/plugin/info.ts` (MODIFY — mechanical import repoint)

**Pattern:** repoint the relocated hook types from `notify.ts` to the concern.
The types currently arrive in a `import type {...}` block (info.ts:51-58):

```typescript
import type {
  ClaudeHookEvent,
  ContentReason,
  HookSummaryEntry,
  NotificationMessage,
  PluginInfoMessage,
  PluginInfoRow,
} from "../../shared/notify.ts";
```
Split out `ClaudeHookEvent` + `HookSummaryEntry` into a new
`import type {...} from "../../shared/concerns/hooks.ts"` line (orchestrators→
shared, allowed); the non-hook types stay sourced from `notify.ts`. Re-sort the
import block with `eslint --fix`.

---

### `domain/components/hook-events.ts` (MODIFY — mechanical import repoint, fence-critical)

**Pattern:** repoint the `satisfies`-pin type. Source (hook-events.ts:5):
```typescript
import type { ClaudeHookEvent } from "../../shared/notify.ts";
```
→ `import type { ClaudeHookEvent } from "../../shared/concerns/hooks.ts";`
Still a `domain/ → shared/` import → fence preserved. The `satisfies readonly
ClaudeHookEvent[]` pin at :46 is unchanged.

---

### `orchestrators/**` Dependency importers (MODIFY — conditional, mechanical)

**Pattern:** IF `Dependency`/`DEPENDENCIES` move to the concern (recommended,
research §4 / Assumption A2), repoint the `import type { Dependency }` in each of
the ~8 importers from `notify.ts` to `../../shared/concerns/soft-dep.ts`.
`Dependency` arrives type-only at every site (e.g. `list.ts:77`, `install.ts:145`
are inside `import type {...}` blocks). Importers grepped:
`orchestrators/reconcile/{apply-outcomes,apply}.ts`,
`orchestrators/marketplace/update.ts`, `orchestrators/plugin/{reinstall,install,list,update}.ts`,
`orchestrators/import/execute.ts`. **Grep both symbol families before the move
(research §7 Risk 4) and update all in the same commit — a missed repoint is a
`npm run typecheck` error, not a silent failure:**
```bash
grep -rn "HookSummaryEntry\|ClaudeHookEvent\|HookSummary\b" extensions/pi-claude-marketplace --include="*.ts"
grep -rn "\bDependency\b\|DEPENDENCIES" extensions/pi-claude-marketplace --include="*.ts"
```

---

### `docs/open-closed-proof.md` (CREATE — documentation, D-02 + D-03)

**Analog:** `docs/messaging-style-guide.md` — same directory, normative-doc tone,
the most structurally similar durable artifact. (`docs/adr/v2-001-structured-notify.md`
is a viable secondary analog if the planner chooses ADR-style framing.)

**Structure pattern to copy** (from messaging-style-guide.md):
- **Bolded front-matter line** stating status + audience:
  `**Status:** Normative -- ... **Audience:** ...` (style-guide line 3).
- **`## Overview`** paragraph naming the binding artifacts and what supersedes
  what.
- **Decision-ID anchoring in prose** (`per D-16-15`, `per ADR-v2-001`) — use
  `D-01`/`D-02`/`D-03`, `MOD-04`/`MOD-05`/`MOD-06` anchors; NO GSD phase/plan
  references (`.claude/rules/typescript-comments.md`).
- **Reference, don't duplicate, the source/byte tables** — point at
  `edge/router.ts`, `edge/register.ts`, `docs/output-catalog.md` and the
  `research/MESSAGING-COUPLING.md` baseline rather than re-pasting line spans
  (mirrors the style-guide's "Read the source" stance).

**Content the doc must carry** (research §5, verbatim-citable):
- The **3-central-files** post-extraction touch matrix: `edge/router.ts`
  (interface field + tuple + switch + usage, :26-49/:55-85/:143-213/:87-110),
  `edge/register.ts` (one wiring line, :78-97), one `docs/output-catalog.md` H2
  section. = **3 central files, 0 `notify.ts` edits**.
- The **baseline** it measures against (cite MESSAGING-COUPLING.md §A.3 prose,
  not its stale line numbers): 5 no-grammar / 9-11 new-grammar, 6 of those
  inside `notify.ts`.
- The **honest caveat** (Assumption A4): `completions/provider.ts` and the
  catalog-uat `FIXTURES` map are "partially irreducible" — state this rather
  than claiming absolute zero-touch.
- The **D-03 catalog floor**: catalog stays hand-authored, one section per
  rendered state, no generation/aggregation seam (deferred) — the explicit
  accepted 3rd central file.

**Hard constraint:** the proof must NOT be appended to `docs/output-catalog.md`
(byte-frozen by `git diff --exit-code`, research §6) and must NOT be a code
comment (D-02/D-03).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | Every file has a strong analog (the lifted source spans or `notify-reasons.ts` module shape or `messaging-style-guide.md`). |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/`,
`extensions/pi-claude-marketplace/platform/`,
`extensions/pi-claude-marketplace/orchestrators/`,
`extensions/pi-claude-marketplace/domain/`, `docs/`, `docs/adr/`, `eslint.config.js`.
**Files scanned:** notify.ts (targeted spans), notify-reasons.ts (full),
pi-api.ts (:80-127), info.ts (:40-64), hook-events.ts (:1-50), install.ts/list.ts
(grep), messaging-style-guide.md (:1-40), docs/ + docs/adr/ listing.
**Pattern extraction date:** 2026-06-24
