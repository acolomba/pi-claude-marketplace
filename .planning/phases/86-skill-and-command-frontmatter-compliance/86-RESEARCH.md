# Phase 86: Skill and command frontmatter compliance - Research

**Researched:** 2026-07-26
**Domain:** Frontmatter parse/degrade parity between Claude Code and Pi's skill/command loaders; a closed-set notification-catalog amendment
**Confidence:** HIGH (all load-bearing claims verified against installed Pi package source, the 0.74.0 npm tarball, the extension source, and upstream docs)

## Summary

This is a codebase-and-upstream-verification phase, not a package-selection one. No new runtime
dependency is required. The entire delivery lands in the extension's existing skills/commands
staging seams plus the closed `REASONS` catalog. The five critical unknowns are now resolved with
direct evidence:

1. **`parseFrontmatter` is a public root export at the peer floor.** Verified in the `0.74.0` npm
   tarball (`dist/index.d.ts:26`) and the installed `0.79.10` (`dist/index.d.ts:29`). Signature:
   `<T extends Record<string, unknown>>(content: string) => { frontmatter: T; body: string }`. It
   **throws** (via `yaml.parse`) on malformed YAML *inside* `---` delimiters, and **returns empty
   frontmatter without throwing** when the content lacks an opening `---` or a closing `\n---`.
   `platform/pi-api.ts` does **not** surface it yet — new re-export plumbing is needed there.

2. **Upstream parity mechanics are documented, but three sub-behaviors are NOT** — those absences
   are themselves decisive (they become Claude's discretion, not invented fact). `when_to_use` is
   "Appended to `description`" with **no documented separator**; the 1,536-char cap is a plain
   "truncated at 1,536 characters" with **no documented ellipsis** (so a hard cut); "first paragraph
   of markdown content" has **no documented heading/blank-line rule**.

3. **A hard cross-loader discrepancy exists that the plan must confront:** Pi caps a skill
   `description` at **1024** chars (`MAX_DESCRIPTION_LENGTH`, a non-fatal warning diagnostic), while
   the locked WTU-02 truncates the combined text at **1,536** to match Claude Code's listing. A
   combined description in the 1025–1536 range loads fine in Pi but emits a Pi startup length-warning.

4. **Both surfacing channels already exist; one is fully wired, one needs new plumbing for
   orchestrated mode.** The free-text detail (D-86-03 part 2) rides the existing
   `bridgeWarnings → postCommitWarnings → notifyDiagnostic` channel (orchestrated mode only, per
   D-19-01). The `{malformed skill}`/`{malformed command}` reason token (D-86-03 part 1) rides the
   existing `PluginInstalledMessage.reasons?` field — but the `orphan rewake` precedent only wires
   the **standalone** row; the **orchestrated** reconcile `plugin-installed` arm carries no reasons
   today, so cross-mode reason-token plumbing is genuinely new work.

5. **The catalog amendment is mechanical and compile-guarded.** Append `malformed skill` +
   `malformed command` to `REASONS` (35 → 37) and to `FAILURE_REASONS`; the `_ReasonsCoverageProof`
   fails to compile if either is added to `REASONS` without a home in a topic group.

**Primary recommendation:** Insert two read-only `parseFrontmatter` gates (source-before-rewrite,
staged-after-write) at both staging seams via a new `platform/pi-api.ts` re-export. For the
augment cases (SKILL-02 first-paragraph fill, WTU-01 fold) do a **surgical single-key set** of
`description:` using a **safe double-quoted YAML scalar emitter** (never whole-block re-emit, never
add the `yaml` package as a direct dep); backstop every write with gate 2. Keep the existing
pure-string `name:` rewrite but verify the written name equals the parsed generated name (SKILL-03).
Do not touch the 99% happy path — the gates are read-only and only the degrade/augment arms mutate.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-86-01 (CLASS-01):** Add **two dedicated per-kind tokens** — `malformed skill` and
  `malformed command` — paralleling `malformed mcp`. NOT a single shared token, NOT a reuse of the
  generic `unparseable`. Append both to `REASONS` in `notify.ts` **after** the existing 35 entries
  (existing order stays byte-identical, OUT-08); file both under `FAILURE_REASONS` in
  `notify-reasons.ts` (NOT `UNSUPPORTED_REASONS`). Update `_ReasonsCoverageProof` in lockstep (the
  compile error is the guardrail). Closed set grows 35 → 37. Reversibility: costly (published catalog
  contract + completeness proof + byte-stability tests).

- **D-86-02 (SKILL-01):** The synthesized `description` on an unparseable skill is a **short fixed
  constant** (e.g. `Source frontmatter could not be parsed.`) — not interpolated with plugin/source
  names. The skill carries `disable-model-invocation: true`, so it is excluded from the model's
  listing and costs zero context; it exists only to clear Pi's non-empty-`description` gate. Body is
  preserved verbatim; install does not hard-fail. Exact wording is Claude's discretion within "short
  fixed constant."

- **D-86-03 (WARN-01):** A degraded skill / neutralized command still installs; the failure stops
  being silent via a **two-part surface**: (1) the closed-set reason token rides the plugin's
  `(installed)` row at **`warning`** severity — **one token per plugin** regardless of how many
  components degraded (mirrors `orphan rewake`); (2) the per-component free-text detail
  (`<plugin>/<component>: <parse error>`) rides the existing post-cascade `notifyDiagnostic` warning
  channel. Planner to confirm the row is `(installed)` (installed in degraded form), NOT
  `(partially-installed)` (which is for *dropped* supported components). Severity is a per-row stamp;
  degraded-but-installed → `warning`.

- **D-86-04 (PARSE-02):** If a source parses cleanly but the **staged** output (post-rewrite +
  post-substitution) fails to parse, that is **our** bug — **throw** and fail that plugin's install
  loudly (test-guarded), never mask it as author degradation.

### Claude's Discretion

- **Upstream-parity mechanics — research MUST verify before planning, do not invent:** `when_to_use`
  fold separator/format (WTU-01); the 1,536-char truncation style and which side truncates (WTU-02);
  the precise "first paragraph of markdown content" extraction (SKILL-02). Source of truth:
  `code.claude.com/docs/en/skills.md`. *(All three fetched and reported verbatim below; three
  sub-behaviors are undocumented upstream — see State of the Art + Assumptions Log.)*
- Exact placeholder-description string (within D-86-02's "short fixed constant").
- Whether `parseFrontmatter` needs re-export plumbing in `platform/pi-api.ts` or is already surfaced
  there — **verify it was exported at the declared peer floor `>=0.74.0`**. *(Resolved: exported at
  0.74.0; NOT yet surfaced in `platform/pi-api.ts` — plumbing needed.)*

### Deferred Ideas (OUT OF SCOPE)

- **REASON-01** (v1.14 backlog): unify all parse-error reasons under a single `{malformed <feature>}`
  family. This phase adds two more failure-class members; the broad unification stays deferred.
- `when_to_use` folding for **commands** is out of scope — WTU is skills-only (Pi's command loader
  reads name + first-body-line, has no description-listing surface for triggers).
- The `2026-06-12-coverage-sweep-...` todo (broad pre-existing update/reinstall coverage sweep) stays
  deferred; this phase adds only its own parse-failure-arm tests.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARSE-01 | Source frontmatter parsed with Pi's `parseFrontmatter` before rewrite/substitution, at both seams | `parseFrontmatter` re-export path + signature/throw semantics verified; seams located (`skills/stage.ts:161-164`, `commands/stage.ts:158-160`) |
| PARSE-02 | Staged bytes re-parsed as Pi-acceptability backstop; self-inflicted defect → loud throw | Gate-2 insertion points identified; `parseFrontmatter` throw-on-malformed confirmed as the trigger |
| SKILL-01 | Unparseable skill → synthesized `disable-model-invocation` block, body verbatim, no hard-fail | Pi `disableModelInvocation` key + `formatSkillsForPrompt` filter + `!description → skill:null` guard verified in `core/skills.js` |
| SKILL-02 | Absent/empty `description` → first-paragraph-of-body fallback | Upstream "first paragraph" wording cited; Pi `body` (trimmed) available from `parseFrontmatter`; exact extraction rule is undocumented upstream (discretion) |
| SKILL-03 | Written `name` always equals generated name; folded scalar cannot corrupt | Current `rewrite-frontmatter.ts` line-regex corruption confirmed; gate-1 parsed value is the check oracle |
| WTU-01 | `when_to_use` folded (appended) into Pi `description` | Upstream "Appended to `description`" cited; **no separator documented** (discretion) |
| WTU-02 | Combined `description`+`when_to_use` truncated at 1,536 chars | Upstream cap cited; **hard cut vs ellipsis undocumented** (hard cut assumed); Pi's 1024 warning discrepancy flagged |
| CMD-01 | Unparseable command → neutralized (name-from-filename, description-from-first-body-line) | Pi `prompt-templates.js` loader path verified (name = basename−`.md`; desc = first non-empty body line, 60-char cap) |
| WARN-01 | Each degraded/neutralized component → install-time warning naming component + parse error | `notifyDiagnostic` + `postCommitWarnings`/`bridgeWarnings` channel fully traced; `agentForeignFailures` is the structured precedent |
| CLASS-01 | Failure-class token paralleling `malformed mcp` under `FAILURE_REASONS`; byte-stable amendment | `REASONS` (35) + `FAILURE_REASONS` + `_ReasonsCoverageProof` machinery read; amendment mechanics confirmed |
| NREG-01 | Already-valid components written byte-for-byte unchanged | Gates are read-only; only degrade/augment arms mutate — happy path untouched by construction |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source-frontmatter validity check (gate 1) | Bridge staging (`skills/stage.ts`, `commands/stage.ts`) | Pi API boundary (`platform/pi-api.ts`) | Attribution ground truth is established where the bytes are first read, before any mutation |
| Staged-byte backstop (gate 2) | Bridge staging | Pi API boundary | We must not ship bytes Pi rejects; the check belongs immediately after the write |
| Degrade/neutralize synthesis | Bridge (skills: synthesize block; commands: neutralize) | — | The bridge owns the byte transformation; it alone knows the generated name and the substitution result |
| Safe YAML scalar emit (description set) | Bridge (new helper alongside `rewrite-frontmatter.ts`) | — | Output-validity concern local to the skills bridge; agents' flat emitter is not reusable (real-YAML target) |
| Reason-token classification | Notification catalog (`shared/notify.ts`, `shared/notify-reasons.ts`) | — | Closed-set contract owned centrally; per-kind attribution is a catalog concern |
| Reason token on the install row | Install orchestrator (standalone) + reconcile notify composer (orchestrated) | Install-outcome types | Row composition is a two-mode concern; the degrade signal must reach both composers |
| Free-text parse-error detail | `notifyDiagnostic` via `postCommitWarnings` | Reconcile/import cascade appliers | The detail has no cascade-body representation; the sanctioned out-of-band warning seam owns it |

## Standard Stack

No new dependencies. Everything is built on already-present modules.

### Core (already present — carry forward, no version change)
| Module | Source | Purpose | Why Standard |
|--------|--------|---------|--------------|
| `parseFrontmatter` | `@earendil-works/pi-coding-agent` (peer `>=0.74.0`) | Read-only parse for gate 1 + gate 2; extract `description`/`name`/`when_to_use`/body | Byte-identical accept/reject semantics with Pi's own loaders — the whole point of "observable parity" [VERIFIED: dist/index.d.ts:26 in 0.74.0 tarball, :29 in installed 0.79.10] |
| `node:fs/promises` (`readFile`/`writeFile`) | built-in | Existing staging read/write | Already the seam [VERIFIED: skills/stage.ts:161-164, commands/stage.ts:158-160] |

### Supporting (already present)
| Module | Source | Purpose | When to Use |
|--------|--------|---------|-------------|
| `substituteClaudeVars` | `shared/vars.ts` | `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` expansion | Unchanged; gate 2 runs *after* it so a substitution that breaks YAML is caught (D-86-04) [VERIFIED: stage.ts] |
| `rewriteFrontmatterName` | `bridges/skills/rewrite-frontmatter.ts` | Existing pure-string `name:` rewrite | Keep; add a parsed-value verification (SKILL-03) [VERIFIED: source read] |
| `notifyDiagnostic` | `shared/notify.ts:339-349` | Post-cascade `warning` channel for free-text detail | D-86-03 part 2 [VERIFIED: source read] |
| `emitYamlScalar` (reference only, do NOT reuse) | `bridges/agents/frontmatter.ts` | Agents' line-based scalar emit | Conceptual precedent ONLY — targets pi-subagents' flat format, wrong for skills' real YAML [VERIFIED: source read] |

### Do NOT add
| Candidate | Verdict | Why |
|-----------|---------|-----|
| `yaml` (2.9.0) as a **direct** dependency | Avoid | Present only transitively via the Pi peer; the extension imports it nowhere. Adding it as a direct dep to get the `Document`/CST round-trip API reintroduces the whole-block-re-emit risk the diagnosis rejected and is unnecessary — a small safe double-quoted-scalar emitter + gate 2 backstop covers the need [VERIFIED: `node_modules/yaml@2.9.0` present; `grep` shows zero `from "yaml"` in `extensions/`] |

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. `parseFrontmatter` is a root export of
the already-declared peer dependency `@earendil-works/pi-coding-agent`; `yaml` is already resolved
transitively and is explicitly *not* being adopted as a direct dependency. No registry additions.

## Architecture Patterns

### System Architecture Diagram

```
                         SOURCE SKILL.md / COMMAND.md bytes (untrusted plugin author)
                                              │
                                              ▼
   ┌──────────────────────── GATE 1: parseFrontmatter(source)  [read-only] ────────────────────────┐
   │                                          │                                                     │
   │             throws (malformed YAML in ---)│              returns {frontmatter, body}            │
   │                     ▼                     │                          ▼                          │
   │   ┌── SKILL: synthesize block ──┐         │        extract name / description / when_to_use     │
   │   │  name=<generated>           │         │                          │                          │
   │   │  description=<fixed const>  │         │      ┌───────────────────┴───────────────────┐      │
   │   │  disable-model-invocation   │         │      │ desc empty? → first-paragraph(body)    │      │
   │   │  body verbatim              │         │      │ when_to_use present? → append to desc  │      │
   │   └── COMMAND: neutralize ──────┘         │      │ combined desc → truncate 1536          │      │
   │   │  strip/defuse frontmatter,  │         │      │ SURGICAL single-key SET description:   │      │
   │   │  Pi reads name-from-file +  │         │      │   (safe dq-scalar emit)                │      │
   │   │  first-body-line (60-cap)   │         │      │ rewrite name: (verify == generated)    │      │
   │   └─── degrade token + detail ──┘         │      └───────────────────┬───────────────────┘      │
   │              │                            │                          │                          │
   └──────────────┼────────────────────────────────────substituteClaudeVars()──────────────────────┘
                  │                                                       │
                  ▼                                                       ▼
   ┌──────────────────────── GATE 2: parseFrontmatter(staged bytes)  [read-only] ───────────────────┐
   │   degraded path: staged must parse (else our bug → THROW)   augmented path: must parse → THROW  │
   └────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                                 ▼   writeFile(staged)
                        ┌────────────────────────┴────────────────────────┐
             degrade signal (per component)                     staged bytes on disk
                        │                                                  │
           ┌────────────┴───────────┐                                      ▼
           ▼                        ▼                              atomic rename → target
   reasons[] token            postCommitWarnings                          │
   {malformed skill|command}  "<plugin>/<comp>: <err>"                     ▼
   on (installed) row         → notifyDiagnostic (orchestrated)      Pi loads at /reload
   (one per plugin)                                                  (byte-identical to Pi's own parse)
```

### Recommended Structure (files touched)
```
extensions/pi-claude-marketplace/
├── platform/pi-api.ts                      # ADD: re-export parseFrontmatter (+ type)
├── bridges/skills/
│   ├── stage.ts                            # insert gate 1 (pre-rewrite) + gate 2 (post-write); degrade arm
│   ├── rewrite-frontmatter.ts              # keep name rewrite; ADD safe description-set + SKILL-03 verify
│   └── (new helper module for synth/fold/first-paragraph/truncate + safe scalar emit)
├── bridges/commands/stage.ts               # insert gate 1 + gate 2; neutralize arm
├── orchestrators/plugin/install.ts         # carry degrade signal → reasons[] (standalone) + outcome
├── orchestrators/reconcile/apply.ts,       # propagate degrade signal into PluginInstalledOutcome
│   apply-outcomes.ts, notify.ts            # push {malformed *} token on the orchestrated installed row
├── shared/notify.ts                        # append 2 tokens to REASONS (36,37)
└── shared/notify-reasons.ts                # add 2 to FAILURE_REASONS; proof self-updates
```

### Pattern 1: Two read-only parse gates
**What:** `parseFrontmatter(source)` before any mutation (gate 1 = attribution + degrade trigger);
`parseFrontmatter(stagedBytes)` after write (gate 2 = Pi-acceptability backstop).
**When:** Both seams, every component.
**Key semantics** (drive the branch logic):
```
// core behavior of parseFrontmatter (utils/frontmatter.js, VERIFIED)
// - content NOT starting with "---"        → { frontmatter: {}, body }   (NO throw)
// - opening "---" but no closing "\n---"    → { frontmatter: {}, body }   (NO throw)
// - closed --- block, malformed YAML inside → THROWS (yaml.parse)         (the degrade trigger)
// - body is normalized (CRLF→LF) and .trim()'ed on return
```
Gate 1 branches on **throw** (→ synthesize/neutralize) vs **return** (→ inspect `frontmatter.description`
/ `when_to_use`). Gate 2 branches on **throw** → for the degrade arm the throw is impossible if we
synthesized a known-good block; for the augment/happy arm a throw is **our** defect → PARSE-02 loud throw.

### Pattern 2: Surgical single-key `description:` set (augment cases only)
**What:** For SKILL-02 (fill from first paragraph) and WTU-01 (append `when_to_use`), set exactly the
`description` node without whole-block re-emit, emitting the value as a **safe double-quoted YAML
scalar** (escape `\` and `"`, collapse/`\n`-encode embedded newlines). Gate 2 backstops correctness.
**Why not whole-block re-emit:** the diagnosis measured that flattening damages ~13% of real skills
(nested maps, block scalars, flow collections). NREG-01 requires byte-for-byte for the untouched 99%.
**Caution (surfaced as open question):** if a source `description` is itself a multi-line block scalar
(`>-`/`|`), a naive line regex replacing only the first line corrupts it — the exact SKILL-03 class of
bug. The planner must locate the full node span, not just the `description:` line. See Open Questions.

### Pattern 3: Reason token rides the existing `reasons?` field, one per plugin
**What:** Push `"malformed skill"` / `"malformed command"` into `PluginInstalledMessage.reasons`
(already `readonly ContentReason[]`, already rendered via `composeReasons`). One token per plugin
regardless of N degraded components — mirrors `orphan rewake`.

### Anti-Patterns to Avoid
- **Re-emitting the whole frontmatter block** (agents-bridge style) — rejected in the diagnosis.
- **Quote-repair of author scalars** — rejected (rewrites third-party content, unbounded heuristic).
- **Blind `/^name:.*$/m` / `/^description:.*$/m` line replace on multi-line scalars** — the SKILL-03
  corruption; verify against the parsed value.
- **Treating a staged-parse failure as author degradation** — D-86-04: that is our bug; throw.
- **Adding the reason token per-component** — one per plugin (MSG-GR-4 brace share).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deciding if bytes are Pi-parseable | A bespoke YAML validator | `parseFrontmatter` (re-exported) | Only byte-identical semantics guarantee parity; a second parser drifts |
| Full YAML round-trip to set one key | Import `yaml` `Document` API | Surgical single-key set + safe dq-scalar emit + gate 2 | Round-trip reformats siblings (breaks NREG-01); direct dep is unnecessary |
| Post-cascade free-text warning surface | A new notify variant | `notifyDiagnostic` + `postCommitWarnings` | Already the sanctioned out-of-band warning seam |
| Structured per-component failure carrier | Ad-hoc string list | An `installCtx` list like `agentForeignFailures` (`{generatedName, reason}`) | Established precedent already threaded to `postCommitWarnings` |
| Catalog completeness enforcement | Manual review | `_ReasonsCoverageProof` (compile error) | Adding to `REASONS` without a topic-group home already fails `tsc` |

**Key insight:** the hard part of this phase is *not* new machinery — it is threading a stage-time
degrade signal into two different row composers (standalone + orchestrated) and doing a NREG-safe
single-key YAML set. Both existing precedents (`orphan rewake` reason, `agentForeignFailures` detail)
solve *half* the propagation each; neither covers the orchestrated reason-row.

## Runtime State Inventory

This is a code/behavior change to the staging pipeline, not a rename/migration. No stored data, live
service config, OS-registered state, secrets, or build artifacts embed a renamed identifier.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore keys change. Already-installed skills/commands on disk are re-materialized only on the next install/update; this phase does not migrate existing target bytes. | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — no package rename; `parseFrontmatter` is a peer-provided export | None |

**Note (not a runtime-state item but a behavioral one):** already-installed malformed skills/commands
stay broken until the plugin is re-installed/updated; this phase fixes the *write path*, not existing
on-disk output. Confirm this matches the intended scope (it aligns with NREG-01 and the diagnosis).

## Common Pitfalls

### Pitfall: Pi's 1024-char description cap vs the locked 1,536-char truncation
**What goes wrong:** WTU-02 truncates the combined `description`+`when_to_use` at 1,536 to match
Claude Code's listing. But Pi's skill loader validates `description.length > 1024` and pushes a
`warning` diagnostic ("description exceeds 1024 characters"). A combined value in the 1025–1536 range
therefore loads and stays model-invocable in Pi **but emits a Pi startup warning**.
**Why it happens:** the two hosts use different listing budgets; the requirement pins the Claude Code
number (1,536), which is the correct parity target for the *source-of-truth* combined text.
**How to avoid:** honor the locked 1,536 (the requirement), and treat the Pi 1024 warning as a
known, non-fatal divergence — do NOT secretly truncate to 1024 (that would diverge from Claude Code
and silently drop trigger keywords). Document the divergence; consider a test asserting the >1024
skill still loads (Pi returns a Skill, not `null`, when description is non-empty).
**Warning signs:** a Pi `--debug`/startup warning on a long-triggered skill. [VERIFIED: `core/skills.js`
`MAX_DESCRIPTION_LENGTH = 1024`, `validateDescription` pushes a warning; the `skill:null` guard fires
only on **empty**, not on over-length]

### Pitfall: gate 1 does NOT throw on missing delimiters
**What goes wrong:** treating "no frontmatter" as an unparseable-source degrade. `parseFrontmatter`
returns `{ frontmatter: {}, body }` (no throw) for content with no `---` block.
**How to avoid:** the unparseable-source degrade (SKILL-01/CMD-01) triggers on a **throw**, not on an
empty result. An empty-frontmatter skill is the SKILL-02 case (fill description from first paragraph),
not the SKILL-01 case. [VERIFIED: `utils/frontmatter.js` `extractFrontmatter`]

### Pitfall: multi-line source `description` node corruption
**What goes wrong:** appending `when_to_use` (WTU-01) or replacing an empty description (SKILL-02) by
replacing only the `description:` line, when the source used a `>-`/`|` block scalar spanning several
lines — leaving orphaned continuation lines, exactly the SKILL-03 folded-`name` corruption class.
**How to avoid:** compute the value from the parsed object, then replace the full node span; verify
with gate 2. Add fixtures with block-scalar and folded descriptions.

### Pitfall: orchestrated reason-token has no existing wire
**What goes wrong:** copying only the `orphan rewake` precedent (`install.ts:1709`) surfaces the token
in **standalone** install but not in the **orchestrated** reconcile cascade — where most installs run.
The reconcile `plugin-installed` arm (`reconcile/notify.ts:497-509`) carries no `reasons` today.
**How to avoid:** add a degrade flag to `InstallPluginOutcome` → `PluginInstalledOutcome`, and push
the token in the reconcile notify composer. [VERIFIED: `reconcile/notify.ts` plugin-installed arm has
no reasons; `grep orphanRewake` shows it only in `resolver.ts`, `install.ts:1709`, comments]

### Pitfall: free-text detail is dropped in standalone mode (D-19-01)
**What goes wrong:** expecting the `<plugin>/<component>: <parse error>` line to appear on a bare
`/claude:plugin install foo@mp`. `postCommitWarnings`/`bridgeWarnings` are collected only when
`orchestrated`; standalone drops them per D-19-01.
**How to avoid:** confirm the target install path is orchestrated (reconcile), or accept that the
reason token (on the row, both modes) is the standalone surface and the detail line is orchestrated-only.
[VERIFIED: `install.ts:1604/1624/1643/1654` all guard on `if (orchestrated)`]

## Code Examples

### `parseFrontmatter` re-export (new plumbing in `platform/pi-api.ts`)
```typescript
// Source: dist/index.d.ts:29 (installed 0.79.10) / :26 (0.74.0 tarball) — VERIFIED
export { parseFrontmatter } from "@earendil-works/pi-coding-agent";
// signature: <T extends Record<string, unknown> = Record<string, unknown>>
//   (content: string) => { frontmatter: T; body: string }
```

### Pi skills loader — the degrade targets (VERIFIED, `core/skills.js`)
```javascript
// loadSkillFromFile (dist/core/skills.js:208-247), abridged
const { frontmatter } = parseFrontmatter(rawContent);          // THROWS on malformed → catch below
const name = frontmatter.name || parentDirName;
if (!frontmatter.description || frontmatter.description.trim() === "") {
    return { skill: null, diagnostics };                        // empty desc ⇒ skill GONE
}
return { skill: { name, description: frontmatter.description,
    disableModelInvocation: frontmatter["disable-model-invocation"] === true, ... } };
// catch (parse throw) → diagnostics.push({type:"warning",...}); return { skill: null }
// MAX_DESCRIPTION_LENGTH = 1024; validateDescription pushes a NON-FATAL warning when exceeded
// formatSkillsForPrompt filters s.disableModelInvocation (excluded from model listing)
```

### Pi command loader — the neutralize target (VERIFIED, `core/prompt-templates.js`)
```javascript
// loadTemplateFromFile (dist/core/prompt-templates.js:81-108), abridged
try {
  const { frontmatter, body } = parseFrontmatter(rawContent);  // THROWS → catch → return null (SILENT)
  const name = basename(filePath).replace(/\.md$/, "");        // name-from-filename
  let description = frontmatter.description || "";
  if (!description) {
    const firstLine = body.split("\n").find((line) => line.trim());
    if (firstLine) { description = firstLine.slice(0, 60);       // first non-empty body line, 60-cap
      if (firstLine.length > 60) description += "..."; }
  }
  return { name, description, ... };
} catch { return null; }                                        // fully silent today
```
CMD-01 neutralize must make `parseFrontmatter` **return** (not throw) so Pi takes the
name-from-filename + first-body-line path — i.e. defuse the frontmatter so it is no longer a closed,
malformed `---` block (e.g. drop the delimiters so the block reads as body).

### Catalog amendment (`shared/notify.ts` + `shared/notify-reasons.ts`)
```typescript
// notify.ts REASONS — append AFTER "malformed mcp" (positions 36, 37); existing 35 unchanged (OUT-08)
  "malformed mcp",
  "malformed skill",     // parallels malformed mcp: malformation of a SUPPORTED component (skill)
  "malformed command",   // parallels malformed mcp: malformation of a SUPPORTED component (command)
] as const;
// notify-reasons.ts FAILURE_REASONS — add both here (NOT UNSUPPORTED_REASONS)
//   → _ReasonsCoverageProof self-satisfies; omit one and _UncoveredReason ≠ never → TS2344
```

## State of the Art

### Upstream parity mechanics (fetched verbatim from code.claude.com/docs/en/skills.md, 2026-07-26)

| Behavior | Documented upstream text (verbatim) | Status |
|----------|-------------------------------------|--------|
| `description` fallback | "If omitted, uses the first paragraph of markdown content." | **Documented** — SKILL-02 confirmed |
| Combined truncation | "the combined `description` and `when_to_use` text is truncated at 1,536 characters in the skill listing to reduce context usage." | **Documented** — WTU-02 cap confirmed |
| `when_to_use` fold | "Additional context for when Claude should invoke the skill... **Appended to `description`** in the skill listing and counts toward the 1,536-character cap." | **Documented that it is appended** — WTU-01 confirmed |
| Malformed policy | "If the frontmatter YAML is malformed, Claude Code loads the skill body with empty metadata, so `/skill-name` still works but Claude has no `description` to match against. Run with `--debug` to see the parse error." | **Documented** — SKILL-01/CMD-01 parity target confirmed |

### Upstream ABSENCES (decisive findings — these become Claude's discretion, not fact)

| Sub-behavior | What is NOT documented | Consequence for the plan |
|--------------|------------------------|--------------------------|
| `when_to_use` separator | The docs say "Appended" but give **no** separator/label/ordering between `description` and `when_to_use`. | Choose a separator (recommend a single `\n` or `. ` / space) as a discretionary decision; mark `[ASSUMED]`. Whatever is chosen, it is a source-side detail Claude Code does not pin. |
| Truncation style | "truncated at 1,536 characters" — **no** mention of an ellipsis or which end. Since `when_to_use` is *appended*, the tail (i.e. `when_to_use` first, then description tail) is what overflows. | Implement a **hard cut** at 1,536 of `description + <sep> + when_to_use`; no ellipsis. Mark `[ASSUMED]` on "hard cut." |
| First-paragraph extraction | "first paragraph of markdown content" — **no** rule for skipping a leading `#` heading or the exact blank-line boundary. | Choose a rule (recommend: skip a leading ATX `#` heading line if present, then take text up to the first blank line). Mark `[ASSUMED]`. |

**Deprecated/outdated:** none. The diagnosis's parser fingerprinting (Claude Code = js-yaml strict;
Pi = `yaml` strict) is still accurate; both reject the same `: `-in-plain-scalar inputs. Exhaustive
`yaml ≡ js-yaml` equivalence is explicitly out of scope (safe divergence).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `when_to_use` is folded with a single-`\n` (or space) separator | WTU-01 | Low — cosmetic; Claude Code itself does not pin a separator. Confirm the chosen char with the operator. |
| A2 | The 1,536-char truncation is a **hard cut** (no ellipsis), applied to `description + sep + when_to_use` with the tail dropped | WTU-02 | Low — upstream says only "truncated at 1,536"; a hard cut is the literal reading. |
| A3 | First-paragraph = skip a leading ATX `#` heading, then text to the first blank line | SKILL-02 | Medium — a wrong boundary yields an unhelpful description (still loads; still model-invocable). Confirm the rule with the operator. |
| A4 | The exact placeholder string for an unparseable skill (D-86-02 leaves wording to discretion) | SKILL-01 | Low — disabled skill, zero context cost; must be a YAML-safe short constant. |
| A5 | CMD-01 neutralize = defuse the `---` block so `parseFrontmatter` returns empty (Pi then uses name-from-filename + first-body-line) | CMD-01 | Medium — the exact defuse transform (drop delimiters vs comment out) affects the body Pi reads for its first-line description; verify with a fixture. |

**These five need operator confirmation in discuss/plan before they become locked.** All other claims
in this document are `[VERIFIED]` or `[CITED]`.

## Open Questions

1. **NREG-safe multi-line `description` replacement.**
   - What we know: happy-path skills stay byte-identical (gates are read-only); only augment arms
     (SKILL-02, WTU-01) rewrite `description`; whole-block re-emit is rejected.
   - What's unclear: how to replace a `description` that is a **multi-line block scalar** without a
     full YAML round-trip and without corrupting sibling fields. A single-line regex is unsafe (the
     SKILL-03 class). `parseFrontmatter` returns values but not source ranges.
   - Recommendation: replace the full `description` node span (scan from `^description:` to the next
     top-level key or the block-scalar dedent boundary), emit the new value as a safe double-quoted
     single-line scalar, and **rely on gate 2** to prove correctness. Add block-scalar/folded fixtures.
     Escalate to the planner as the phase's central technical risk.

2. **Which install path is the primary surface — orchestrated or standalone?**
   - What we know: the reason token can ride both rows; the free-text detail rides orchestrated only.
   - What's unclear: whether a bare single-plugin install runs orchestrated (reconcile) in practice.
   - Recommendation: plan the orchestrated wiring as the required path (that is where reconcile-driven
     installs and imports run) and treat standalone reason-token parity as a smaller add.

3. **Does the plan re-materialize already-installed malformed components?**
   - What we know: this phase fixes the write path; existing on-disk output is untouched until re-install.
   - Recommendation: confirm scope is write-path-only (aligns with NREG-01); do not add a migration.

## Environment Availability

Not applicable — this phase makes code and behavior changes only. `parseFrontmatter` is provided by
the already-declared peer dependency; no external tools, services, runtimes, or CLIs are introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict` [VERIFIED: existing tests] |
| Config file | none — glob-driven via `package.json` `test` script |
| Quick run command | `node --test "tests/bridges/skills/**/*.test.ts" "tests/bridges/commands/**/*.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + `npm test` + `npm run test:integration`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | source gate rejects/reads before rewrite | unit | `node --test "tests/bridges/skills/stage.test.ts"` | ✅ (extend) |
| PARSE-02 | staged self-inflicted breakage throws | unit | `node --test "tests/bridges/skills/stage.test.ts"` | ✅ (extend) |
| SKILL-01 | unparseable skill → disable-model-invocation block, body verbatim | unit | `node --test "tests/bridges/skills/stage.test.ts"` | ✅ (extend) |
| SKILL-02 | empty desc → first-paragraph fill | unit | new helper test + `stage.test.ts` | ❌ Wave 0 (new helper module) |
| SKILL-03 | written name == generated name; folded scalar can't corrupt | unit | `node --test "tests/bridges/skills/rewrite-frontmatter.test.ts"` | ✅ (extend) |
| WTU-01 | `when_to_use` appended into description | unit | new helper test | ❌ Wave 0 |
| WTU-02 | combined truncated at 1,536 (hard cut); >1024 still loads in Pi | unit | new helper test | ❌ Wave 0 |
| CMD-01 | unparseable command → neutralized (name-from-file, first-body-line) | unit | `node --test "tests/bridges/commands/stage.test.ts"` | ✅ (extend) |
| WARN-01 | degrade → reason token on row + detail via notifyDiagnostic | unit | `tests/shared/notify-v2.test.ts` + orchestrator test | ✅ (extend) |
| CLASS-01 | REASONS 35→37, byte-stable; FAILURE_REASONS membership; proof compiles | unit + typecheck | `npm run typecheck` + `tests/shared/notify-v2.test.ts` | ✅ (extend) |
| NREG-01 | valid + non-empty desc + no when_to_use → byte-for-byte identical | unit | `stage.test.ts` byte-equality assertion | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the quick run command above (skills + commands bridge tests) plus `npm run typecheck`
- **Per wave merge:** `npm test` (full unit set) + `npm run test:integration`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New skills helper module test (first-paragraph extraction, `when_to_use` fold, 1,536 truncation,
      safe scalar emit) — covers SKILL-02, WTU-01, WTU-02
- [ ] Fixtures: a skill whose source frontmatter throws (unquoted `: ` mid-scalar); a description-less
      skill; a skill with a `>-`/`|` block-scalar description; a folded multi-line `name`; a command
      whose frontmatter throws — covers PARSE/SKILL/CMD arms
- [ ] Byte-equality (NREG-01) assertion helper for the happy path
- [ ] Framework install: none — `node:test` already present

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (treat as enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Parse untrusted plugin-author YAML with `parseFrontmatter` in a **read-only** capacity — extract values, never `eval`/execute. Preserves the T-03-17 injection-safety property that the "no YAML parsing" comment guarded, because reading-to-validate is not evaluating (the diagnosis explicitly separates these two concerns). |
| V6 Cryptography | no | — |
| V2/V3/V4 (authn/session/access) | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious frontmatter that executes on parse | Tampering / Elevation | Use `parseFrontmatter` (data-only `yaml.parse`, no tags/`!!` execution surface in the `yaml` package's default schema); never emit author scalars unescaped — the safe dq-scalar emitter + gate 2 prevent an author string from re-forming a new YAML key (the same class as the AG-8 provenance-injection guard in the agents bridge) |
| Path escape via crafted skill/command dir | Tampering | Unchanged — existing `assertPathInside` + `verbatimSymlinks:true, dereference:false` guards remain; this phase touches only file *content*, not path selection |
| Description used to smuggle a huge context payload | DoS (context) | The 1,536 truncation (WTU-02) plus Pi's own 1024 cap bound listing size; unparseable skills carry `disable-model-invocation` so a placeholder costs zero model context |

## Sources

### Primary (HIGH confidence)
- Installed `@earendil-works/pi-coding-agent@0.79.10`: `dist/utils/frontmatter.{d.ts,js}` (signature + throw/return semantics), `dist/core/skills.js` (loader, `MAX_DESCRIPTION_LENGTH=1024`, `!description→null` guard, `disableModelInvocation`, `formatSkillsForPrompt` filter), `dist/core/prompt-templates.js` (command loader), `dist/index.d.ts:29` (root export)
- `@earendil-works/pi-coding-agent@0.74.0` npm tarball: `dist/index.d.ts:26` (parseFrontmatter exported at peer floor), `dist/core/skills.js:12` (`MAX_DESCRIPTION_LENGTH=1024` at floor)
- Extension source (this repo): `bridges/skills/stage.ts`, `bridges/skills/rewrite-frontmatter.ts`, `bridges/commands/stage.ts`, `platform/pi-api.ts`, `shared/notify.ts` (REASONS 89-152; notifyDiagnostic 339-349; PluginInstalledMessage 621-629), `shared/notify-reasons.ts` (FAILURE_REASONS 99-128; proof 166-169), `orchestrators/plugin/install.ts` (1590-1786), `orchestrators/reconcile/{apply.ts,apply-outcomes.ts,notify.ts}`, `bridges/agents/frontmatter.ts`
- `code.claude.com/docs/en/skills.md` (fetched 2026-07-26) — `description`/`when_to_use` field table (lines 253-254), malformed policy (line 897), 1,536-char listing cap (lines 253-254, 914)

### Secondary (MEDIUM confidence)
- `docs/research/issue-101-skill-frontmatter-diagnosis.md` — cross-checked against upstream and codebase; parser fingerprinting and rejected-approach rationale

### Tertiary (LOW confidence)
- None — every load-bearing claim was verified against a primary source this session.

## Metadata

**Confidence breakdown:**
- Stack / no-new-deps: HIGH — verified `parseFrontmatter` export at floor + installed; `yaml` not a direct dep
- Loader degrade targets (Pi): HIGH — read directly from installed `core/skills.js` and `core/prompt-templates.js`
- Upstream parity: HIGH for what is documented; the three undocumented sub-behaviors are flagged `[ASSUMED]` with recommendations
- Catalog amendment: HIGH — machinery and compile-guard read directly
- Propagation plumbing: HIGH — both channels traced end to end; the orchestrated reason-row gap is a confirmed new-work finding
- Central technical risk (NREG-safe multi-line description set): MEDIUM — resolved to a recommended approach, escalated as Open Question 1 for the planner

**Research date:** 2026-07-26
**Valid until:** ~2026-08-25 (stable; re-verify only if the peer dep floor or Claude Code skills docs change)
