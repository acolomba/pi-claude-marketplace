# Phase 86: Skill and command frontmatter compliance - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 9 (7 modified, 2 new)
**Analogs found:** 9 / 9

All analogs are in-repo under `extensions/pi-claude-marketplace/`. Paths below are
repo-relative to that root unless otherwise noted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `platform/pi-api.ts` (MODIFY: re-export `parseFrontmatter`) | config / API boundary | transform | its own existing `export { getAgentDir }` (`pi-api.ts:15`) | exact |
| `bridges/skills/stage.ts` (MODIFY: gate 1 + gate 2 + degrade arm) | bridge / staging | file-I/O + transform | itself (`stage.ts:159-164` read→rewrite→substitute→write seam) | exact |
| `bridges/commands/stage.ts` (MODIFY: gate 1 + gate 2 + neutralize arm) | bridge / staging | file-I/O + transform | itself (`stage.ts:158-160` read→substitute→write seam) | exact |
| `bridges/skills/rewrite-frontmatter.ts` (MODIFY: SKILL-03 verify) | utility | transform | itself (line-regex `name:` rewrite) | exact |
| NEW `bridges/skills/frontmatter-degrade.ts` (or similar: synth/fold/first-paragraph/truncate + safe dq-scalar emit) | utility | transform | `bridges/agents/frontmatter.ts::emitYamlScalar` (conceptual precedent, NOT copy) | role-match |
| `shared/notify.ts` (MODIFY: append 2 REASONS + `PluginInstalledMessage.reasons?`) | config / catalog | transform | `malformed mcp` addition (`notify.ts:143-152`); `orphan rewake` reason field (`notify.ts:120-129`, `:621-629`) | exact |
| `shared/notify-reasons.ts` (MODIFY: add 2 FAILURE_REASONS) | config / catalog | transform | `malformed mcp` in `FAILURE_REASONS` (`notify-reasons.ts:111-115`) + `_ReasonsCoverageProof` (`:166-169`) | exact |
| `orchestrators/plugin/install.ts` (MODIFY: carry degrade flag → reasons[] standalone + outcome) | orchestrator | event-driven | `orphan rewake` push (`install.ts:1708-1711`, `:1760`); `agentForeignFailures` detail (`:374`, `:967`, `:1637-1646`) | exact |
| `orchestrators/reconcile/{apply-outcomes.ts, apply.ts, notify.ts}` (MODIFY: degrade flag on `PluginInstalledOutcome` + push token on orchestrated row) | orchestrator | event-driven | `PluginInstalledOutcome` (`apply-outcomes.ts:80-95`); reconcile `plugin-installed` arm (`notify.ts:497-509`) | role-match (new wire) |

## Pattern Assignments

### `platform/pi-api.ts` (API boundary, transform)

**Analog:** its own existing named re-export at line 15.

**Re-export pattern** (`pi-api.ts:15`):
```typescript
export { getAgentDir } from "@earendil-works/pi-coding-agent";
```
Add a sibling line for `parseFrontmatter`. Signature (VERIFIED, RESEARCH §Code Examples):
`<T extends Record<string, unknown>>(content: string) => { frontmatter: T; body: string }`.
This is the ONLY production file allowed to import from `@earendil-works/pi-coding-agent`
(file header, `pi-api.ts:3-5`); every gate must import `parseFrontmatter` from here, not the peer.

**Semantics to encode in a doc comment** (RESEARCH Pattern 1, VERIFIED):
- content NOT starting with `---` → `{ frontmatter: {}, body }` (NO throw)
- opening `---` but no closing `\n---` → `{ frontmatter: {}, body }` (NO throw)
- closed `---` block, malformed YAML inside → THROWS (the degrade trigger)
- returned `body` is CRLF→LF normalized and `.trim()`ed

---

### `bridges/skills/stage.ts` (bridge, file-I/O + transform)

**Analog:** the existing per-skill mutation seam, `stage.ts:159-164`.

**The seam to wrap** (`stage.ts:160-164`):
```typescript
const skillMdPath = path.join(stagedDir, "SKILL.md");
let content = await readFile(skillMdPath, "utf8");
content = rewriteFrontmatterName(content, skill.generatedName);
content = substituteClaudeVars(content, { pluginRoot, pluginData: pluginDataDir });
await writeFile(skillMdPath, content, "utf8");
```
- **Gate 1 (source, before rewrite):** call `parseFrontmatter(content)` inside a try.
  THROW → unparseable source → synthesize `disable-model-invocation` block (SKILL-01, body
  verbatim, fixed-const description). RETURN → inspect `frontmatter.description` /
  `frontmatter.when_to_use`: empty desc → first-paragraph fill (SKILL-02); `when_to_use`
  present → fold + truncate 1536 (WTU-01/02); do the surgical single-key `description:` set.
- **Gate 2 (staged, after `writeFile`):** re-`parseFrontmatter(content)`. THROW on the
  augment/happy arm → OUR bug → **throw** (D-86-04 / PARSE-02), do not mask as author degradation.

**Import + error idioms already in this file to match:**
- Imports of `readFile`/`writeFile` from `node:fs/promises` (`stage.ts:20`); add
  `parseFrontmatter` import from `../../platform/pi-api.ts`.
- Partial-staging cleanup on throw: `throw appendLeakToError(err, await cleanupStaging(...))`
  (`stage.ts:174-176`) — a gate-2 throw rides this same catch.

**Degrade-signal collection:** this loop is where a per-component degrade record
(`{ generatedName, reason }`, mirroring `agentForeignFailures`) is pushed for the
orchestrator to consume. The bridge returns it up through its result/warnings channel.

---

### `bridges/commands/stage.ts` (bridge, file-I/O + transform)

**Analog:** the existing per-command mutation seam, `stage.ts:158-160`.

**The seam to wrap** (`commands/stage.ts:158-160`):
```typescript
let content = await readFile(command.commandFile, "utf8");
content = substituteClaudeVars(content, { pluginRoot, pluginData: pluginDataDir });
await writeFile(stagedFile, content, "utf8");
```
- **Gate 1 (source):** `parseFrontmatter(content)`. THROW → CMD-01 neutralize = **strip the
  entire malformed frontmatter block** (opening `---` through closing `---`) so a re-parse
  RETURNS empty (D-86-07); Pi then takes name-from-filename + first-body-line (60-char cap,
  RESEARCH §Pi command loader). RETURN → no augment work for commands (WTU is skills-only).
- **Gate 2 (staged):** re-parse; THROW → OUR bug → **throw** (D-86-04). Note the neutralized
  output is designed to RETURN, so a gate-2 throw here is always a defect.

**Error idiom to match:** same `appendLeakToError` cleanup catch (`commands/stage.ts:165-167`).

---

### `bridges/skills/rewrite-frontmatter.ts` (utility, transform)

**Analog:** itself — the pure-string `name:` rewrite.

**Current corruption-prone core** (`rewrite-frontmatter.ts:33-40`):
```typescript
const nameRegex = /^name:.*$/m;
let newFrontmatter: string;
if (nameRegex.test(frontmatter)) {
  newFrontmatter = frontmatter.replace(nameRegex, `name: ${newName}`);
} else {
  newFrontmatter = `\nname: ${newName}` + frontmatter;
}
```
- SKILL-03: after rewrite, the written `name` must equal `newName` when re-parsed. The
  `/^name:.*$/m` line replace corrupts a folded/block-scalar `name:` (leaves orphaned
  continuation lines) — verify against gate-1's parsed value, or replace the full node span.
- Keep the T-03-17 injection-safety property (file header `rewrite-frontmatter.ts:1-6`): the
  new parse is READ-ONLY (validate + extract), never `eval`.

---

### NEW helper module (utility, transform) — synth / fold / first-paragraph / truncate / safe scalar

**Analog (conceptual ONLY, do NOT copy):** `bridges/agents/frontmatter.ts::emitYamlScalar`
(`frontmatter.ts:48-59`).

```typescript
export function emitYamlScalar(value: string): string {
  const oneLine = value.replace(/\r?\n/g, " ");
  if (oneLine.startsWith('"') && oneLine.endsWith('"')) return `'${oneLine}'`;
  if (oneLine.startsWith("'") && oneLine.endsWith("'")) return `"${oneLine}"`;
  return oneLine;
}
```
**Why this is the anti-pattern, not the template** (RESEARCH §Anti-Patterns, Map row "Safe YAML
scalar emit"): the agents emitter targets pi-subagents' **flat, line-based** format
(`emitGeneratedAgentFile`, `frontmatter.ts:258-340` re-emits the WHOLE block). Skills' target is
**real structured YAML** — whole-block re-emit flattens nested maps / block scalars and damages
~13% of real skills (NREG-01 violation). Build a NEW safe **double-quoted** scalar emitter
(escape `\` and `"`, `\n`-encode/collapse embedded newlines) and do a **surgical single-key
`description:` set**, then rely on gate 2 to prove correctness. Do NOT re-emit siblings.

Helper responsibilities (all pure string, unit-testable in isolation — RESEARCH Wave 0):
- first-paragraph extraction (skip blank lines, ATX `#` headings, fenced ` ``` `/`~~~` blocks;
  take contiguous body text to next blank line — D-86-06 / A3)
- `when_to_use` fold: `description + "\n" + when_to_use` (A1)
- hard-cut truncate at 1536, no ellipsis (A2 / WTU-02)
- synthesized unparseable-skill block: fixed-const description + `disable-model-invocation: true`
  + verbatim body (D-86-02 / A4)

---

### `shared/notify.ts` (catalog, transform)

**Analog:** the `malformed mcp` member and the `orphan rewake` reason-on-row precedent.

**REASONS append pattern** — add AFTER `"malformed mcp"` at `notify.ts:151` (positions 36, 37;
existing 35 stay byte-identical, OUT-08). Mirror the `malformed mcp` comment block
(`notify.ts:143-151`) which documents the failure-class-not-unsupported rationale:
```typescript
  "malformed mcp",
  "malformed skill",     // parallels malformed mcp: malformation of a SUPPORTED component (skill)
  "malformed command",   // parallels malformed mcp: malformation of a SUPPORTED component (command)
] as const;
```

**Reason-on-`(installed)`-row precedent** — `PluginInstalledMessage.reasons?` already exists
(`notify.ts:627`):
```typescript
export interface PluginInstalledMessage extends TransitionMessageBase {
  readonly status: "installed";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];   // ← orphan rewake rides this; malformed skill/command joins
  readonly description?: string;
}
```
No structural change to this interface needed — the new tokens are `ContentReason` members and
ride the existing field. One token per plugin (mirrors `orphan rewake`, `notify.ts:121-129`).

**Free-text detail channel** — `notifyDiagnostic` (`notify.ts:339-349`), unchanged, reused:
```typescript
export function notifyDiagnostic(ctx: ExtensionContext, header: string, lines: readonly string[]): void {
  if (lines.length === 0) return;
  ctx.ui.notify(`${header}\n\n${lines.join("\n")}`, "warning");
}
```
Orchestrated-mode only (D-19-01); carries `<plugin>/<component>: <parse error>` lines (WARN-01).

---

### `shared/notify-reasons.ts` (catalog, transform)

**Analog:** `malformed mcp` in `FAILURE_REASONS`.

**FAILURE_REASONS add** (`notify-reasons.ts:111-115`) — add both here, NOT `UNSUPPORTED_REASONS`
(malformation of a *supported* component). Mirror the existing comment:
```typescript
  "malformed mcp",
  "malformed skill",
  "malformed command",
```

**Completeness proof self-guard** (`notify-reasons.ts:166-169`) — no manual edit; adding to
`REASONS` without a home here makes `_UncoveredReason ≠ never` → TS2344 compile error:
```typescript
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
```
Update `notify.ts::REASONS` and `notify-reasons.ts::FAILURE_REASONS` in lockstep — the compile
error is the guardrail (D-86-01).

---

### `orchestrators/plugin/install.ts` (orchestrator, event-driven)

**Analog A — reason-on-row (standalone):** the `orphan rewake` push (`install.ts:1708-1711`):
```typescript
const reasons: ContentReason[] = [];
if (installCtx.resolved.orphanRewake === true) {
  reasons.push("orphan rewake");
}
```
…then spread onto the row (`install.ts:1760`): `...(reasons.length > 0 && { reasons })`.
Add a `pushIf` for the bridge-reported degrade flag here (`reasons.push("malformed skill")` /
`"malformed command"`), one token per plugin regardless of N degraded components.

**Analog B — per-component structured detail carrier:** `agentForeignFailures`
(`install.ts:374`, collected `:967`, surfaced `:1637-1646`):
```typescript
agentForeignFailures: { generatedName: string; reason: string }[];   // install.ts:374
// ...
if (installCtx.agentForeignFailures.length > 0) {                    // install.ts:1637
  const detail = installCtx.agentForeignFailures
    .map((f) => `${f.generatedName}: ${f.reason}`).join("; ");
  const msg = `Plugin "${plugin}" installed; ... preserved on disk: ${detail}`;
  if (orchestrated) { postCommitWarnings.push(msg); }
  // else: D-19-01 -- dropped in standalone mode.
}
```
Copy this shape for a new `installCtx` list of `{ component, parseError }` degrade records fed by
the two bridges; format `<plugin>/<component>: <parse error>` into `postCommitWarnings`
(orchestrated only) → `notifyDiagnostic` (WARN-01 part 2).

**Outcome plumbing:** `InstallPluginOutcome` installed arm (`install.ts:219-227`) already carries
`postCommitWarnings?`; add a `degraded`/reason flag alongside so the reconcile composer can push
the row token.

---

### `orchestrators/reconcile/{apply-outcomes.ts, apply.ts, notify.ts}` (orchestrator — NEW wire)

**Analog:** `PluginInstalledOutcome` (`apply-outcomes.ts:80-95`) and the reconcile
`plugin-installed` arm (`notify.ts:497-509`).

**The gap (VERIFIED, RESEARCH Pitfall "orchestrated reason-token has no existing wire"):** the
reconcile installed row carries NO `reasons` today:
```typescript
case "plugin-installed":                     // reconcile/notify.ts:497
  block.plugins.push({
    status: "installed",
    name: outcome.plugin,
    ...(outcome.version !== undefined && { version: outcome.version }),
    dependencies: outcome.dependencies,
    severity: "info",
    needsReload: true,
  });
  return;
```
New work:
1. Add a degrade flag (e.g. `readonly malformed?: "skill" | "command"` or a `reasons` field) to
   `PluginInstalledOutcome` (`apply-outcomes.ts:80-95`), alongside the existing
   `postCommitWarnings?` (`:94`).
2. Propagate it from `InstallPluginOutcome` through `apply.ts` (the outcome-builder;
   `apply.ts:314` derives `dependencies` from install flags — same seam).
3. Push the `{malformed skill|command}` token + raise `severity` to `"warning"` in the
   `plugin-installed` arm (`notify.ts:497-509`). Row stays `(installed)` NOT
   `(partially-installed)` (D-86-03: degraded-but-installed, not dropped-supported-component).

---

## Shared Patterns

### Two read-only parse gates (applies to both stage.ts files)
**Source:** RESEARCH Pattern 1; seams `skills/stage.ts:159-164`, `commands/stage.ts:158-160`.
Gate 1 = attribution ground truth + degrade trigger (branch on THROW vs RETURN, before any
mutation). Gate 2 = Pi-acceptability backstop (after `writeFile`; a throw on the non-degrade arm
is OUR bug → PARSE-02 loud throw). Import `parseFrontmatter` from `platform/pi-api.ts` only.

### Failure-class catalog amendment (applies to both notify files)
**Source:** `malformed mcp` (`notify.ts:143-152`, `notify-reasons.ts:111-115`). Append to
`REASONS` after position 35; file under `FAILURE_REASONS` (never `UNSUPPORTED_REASONS`); the
`_ReasonsCoverageProof` (`notify-reasons.ts:166-169`) compile-fails if either file is out of sync.

### One-token-per-plugin reason on the `(installed)` row (applies to both orchestrators)
**Source:** `orphan rewake` (`install.ts:1708-1711`, `notify.ts:121-129`,
`PluginInstalledMessage.reasons?` `:627`). Standalone rides `PluginInstalledMessage.reasons?`
directly; orchestrated needs the new `PluginInstalledOutcome` flag + reconcile-composer push.

### Structured per-component detail → notifyDiagnostic (applies to install.ts + bridges)
**Source:** `agentForeignFailures` (`install.ts:374`, `:1637-1646`) → `postCommitWarnings` →
`notifyDiagnostic` (`notify.ts:339-349`). Orchestrated-only (D-19-01); the reason token is the
standalone surface.

## No Analog Found

None. Every touched file has an in-repo precedent. The single genuinely new artifact is the skills
degrade helper module, whose *shape* has a conceptual precedent (`agents/frontmatter.ts`) but whose
YAML-emit strategy must diverge (surgical single-key set vs whole-block re-emit) — flagged above and
in RESEARCH Open Question 1 as the phase's central technical risk.

## Test Analogs

| New/extended test | Analog file | Covers |
|-------------------|-------------|--------|
| skills gate + degrade arms | `tests/bridges/skills/stage.test.ts` (extend) | PARSE-01/02, SKILL-01, NREG-01 |
| SKILL-03 name verify | `tests/bridges/skills/rewrite-frontmatter.test.ts` (extend) | SKILL-03 |
| helper: first-paragraph / fold / truncate / safe scalar | NEW (Wave 0) | SKILL-02, WTU-01, WTU-02 |
| commands neutralize | `tests/bridges/commands/stage.test.ts` (extend) | CMD-01 |
| catalog + row token | `tests/shared/notify-v2.test.ts` (extend) | CLASS-01, WARN-01 |

Fixtures needed (RESEARCH Wave 0 gaps): unquoted-`: `-mid-scalar skill (throws), description-less
skill, `>-`/`|` block-scalar description skill, folded multi-line `name` skill, throwing command.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{platform,bridges,shared,orchestrators}`
**Files read this session:** `bridges/skills/stage.ts`, `bridges/commands/stage.ts`,
`bridges/skills/rewrite-frontmatter.ts`, `bridges/agents/frontmatter.ts`, `platform/pi-api.ts`,
`shared/notify.ts` (89-254, 330-349, 615-644), `shared/notify-reasons.ts` (95-169),
`orchestrators/plugin/install.ts` (219-240, 1630-1764), `orchestrators/reconcile/notify.ts`
(485-524), `orchestrators/reconcile/apply-outcomes.ts` (70-109)
**Pattern extraction date:** 2026-07-26
</content>
</invoke>
