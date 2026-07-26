---
phase: 86-skill-and-command-frontmatter-compliance
reviewed: 2026-07-26T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 86: Code Review Report

**Reviewed:** 2026-07-26
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 86 frontmatter-compliance change set: the skills degrade/augment
helpers, the two staging gates (source-parse gate-1, staged-byte gate-2), the command
neutralize path, the `malformed skill` / `malformed command` catalog additions, and the
degrade thread from `install.ts` through the reconcile projection.

The gate boundaries, catalog additions, dedup ("one token per plugin"), warning-severity
stamping, and `redactAbsolutePaths` info-disclosure containment are all correct. Gate-2 is
correctly inside the outer cleanup `try` in both `bridges/skills/stage.ts` and
`bridges/commands/stage.ts`, so a gate-2 throw propagates loudly (D-86-04 holds — no
Pi-rejected bytes can ship). The command neutralize `\n---` search matches
`parseFrontmatter`'s own delimiter search and preserves body bytes (including CRLF)
verbatim. The completeness proof in `notify-reasons.ts` correctly covers the two new
reasons.

One BLOCKER: the `description` node-span replacement recognizes only `>`/`|` block
scalars, so a **valid, gate-1-parseable** skill whose `description` is a multi-line plain
or quoted scalar is mis-rewritten when augmentation triggers — orphaning continuation
lines and producing invalid YAML. Gate-2 contains the damage (no corrupt bytes ship) but
the whole plugin install hard-fails and rolls back. Verified against the `yaml` parser.

## Critical Issues

### CR-01: `descriptionValueEnd` only spans `>`/`|` block scalars — multi-line plain / quoted descriptions are corrupted, failing the whole install

**File:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts:173-195` (and `211-242`)

**Issue:**
`descriptionValueEnd` decides how many lines the `description` node spans by testing only
`/^[>|]/` on the inline value. YAML scalars also span multiple lines as **plain** scalars
(indented continuation) and as **quoted** scalars (single/double). For those, the inline
value does not start with `>` or `|`, so `descriptionValueEnd` returns `keyIndex` and
`setDescriptionScalar` replaces only the `description:` line, leaving the continuation
lines orphaned.

This is reachable with idiomatic input whenever augmentation changes the value
(`augmentSkillDescription` calls `setDescriptionScalar` only when `effective !== sourceDescription`):

- a multi-line **plain** description plus a `when_to_use` (folded in), or
- a description longer than 1,536 chars (almost always wrapped across lines) that gets
  truncated, or
- a non-string / multi-line `description` (list/map) where `sourceDescription` collapses
  to `""` and is refilled from the body.

Example source (valid; gate-1 parses `description` = `"This is a fairly long plain scalar that wraps"`):

```yaml
---
name: my-skill
description: This is a fairly long
  plain scalar that wraps
when_to_use: Use for X
---
```

`setDescriptionScalar` rewrites only line 3, producing:

```yaml
---
name: my-skill
description: "This is a fairly long plain scalar that wraps\nUse for X"
  plain scalar that wraps
when_to_use: Use for X
---
```

Confirmed against the `yaml` parser: gate-2 throws
`All mapping items must start at the same column at line 3, column 1`. The skills phase
throw unwinds the ledger, so a **valid** plugin fails to install entirely. Gate-2 does its
job (no corrupt bytes ship), but a should-succeed install becomes a hard rollback — the
opposite of the WTU-01 / SKILL-02 "augment, never reject" intent. Unlike the `name` path
(CR/WR-01 below), `setDescriptionScalar` has no post-write value verification, so gate-2 is
the only backstop.

**Fix:** Detect the full node span for every multi-line scalar, not just block scalars.
Drop the `/^[>|]/` gate and always absorb subsequent more-indented (non-key) continuation
lines up to `blockEnd`:

```ts
function descriptionValueEnd(lines: readonly string[], keyIndex: number, blockEnd: number): number {
  // A description value spans continuation lines for block (`>`/`|`),
  // multi-line plain, AND multi-line quoted scalars — all continue via
  // deeper indentation than the col-0 key. Absorb every indented, non-blank
  // continuation line; stop at the first line that returns to column 0.
  let lastReplaced = keyIndex;
  for (let i = keyIndex + 1; i < blockEnd; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      continue; // trailing blank spacing preserved (not absorbed)
    }
    if (/^\s/.test(line)) {
      lastReplaced = i;
      continue;
    }
    break;
  }
  return lastReplaced;
}
```

(Apply the same broadening to `nameValueEnd` in `rewrite-frontmatter.ts` — see WR-01.)

## Warnings

### WR-01: `nameValueEnd` has the same block-scalar-only span gap for the `name` field

**File:** `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts:39-61`

**Issue:** Identical root cause as CR-01: `nameValueEnd` tests only `/^[>|]/`, so a source
`name` written as a multi-line plain/quoted scalar orphans its continuation lines.
Confirmed behavior: the orphaned line folds into the inline replacement
(`name: <gen>\n  continued` parses `name` = `"<gen> continued"`), which the SKILL-03
verification at line 118-124 (`frontmatter.name !== newName`) correctly rejects with a
loud throw. So no wrong-named skill ships, but the install still hard-fails on an otherwise
valid skill. Lower likelihood than CR-01 (skill names are single-token slugs), but same
defect class and should be fixed together.

**Fix:** Broaden `nameValueEnd` the same way as CR-01's `descriptionValueEnd` fix (absorb
all indented continuation lines regardless of the inline indicator).

### WR-02: Stale "35-entry" catalog-size comments in `notify-reasons.ts` contradict the code and the sibling file

**File:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts:7-8,14`

**Issue:** This phase grew the `REASONS` closed set from 35 to 37 (adding `"malformed skill"`
and `"malformed command"`) and updated `notify.ts:80` to "37-entry membership", but left
two "35-entry" claims in `notify-reasons.ts`:

- line 7-8: `OUT-08: the 35-entry membership AND order must stay byte-identical...`
- line 14: `...instead of the flat 35-entry set.`

These now misstate the size of the very closed set the module is documenting as
catalog-stable, and disagree with `notify.ts`. A maintainer reading the stability contract
gets the wrong count.

**Fix:** Update both occurrences to `37-entry` (or make them count-agnostic, e.g. "the
full closed `REASONS` set"), matching `notify.ts:80`.

## Info

### IN-01: `emitSafeDoubleQuotedScalar` collapses only `\r?\n`; a lone `\r` (or U+2028/U+2029) survives into the scalar

**File:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts:146-150`

**Issue:** The one-line collapse uses `value.replace(/\r?\n/g, " ")`. A description value
containing a bare carriage return (not part of a CRLF) or a Unicode line/paragraph
separator is not collapsed and is emitted inside the double-quoted scalar, where a YAML
parser may treat it as a line break — tripping gate-2 and hard-failing the install. Very
low likelihood (parsed values rarely contain lone `\r`), and it fails safe via gate-2, but
the collapse is not fully newline-agnostic as the comment implies.

**Fix:** Collapse all line-break forms, e.g. `value.replace(/\r\n|\r|\n|\u2028|\u2029/g, " ")`.

### IN-02: `truncate1536` can split a UTF-16 surrogate pair at the boundary

**File:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts:135-137`

**Issue:** The hard cut `text.slice(0, 1536)` operates on UTF-16 code units, so a
supplementary-plane character straddling indices 1535/1536 is split into a lone high
surrogate. When the staged file is written with `utf8` encoding, Node replaces the lone
surrogate with U+FFFD, so the emitted skill listing ends in a replacement character.
Cosmetic only (gate-2 accepts it; no structural corruption) and acknowledged by the
"hard cut on code units" comment, but noted for completeness against the "multi-byte
content" concern.

**Fix (optional):** If exactness matters, trim a trailing lone high surrogate after slicing
(`if (0xd800 <= cut.charCodeAt(cut.length-1) <= 0xdbff) cut = cut.slice(0, -1)`).

---

_Reviewed: 2026-07-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
