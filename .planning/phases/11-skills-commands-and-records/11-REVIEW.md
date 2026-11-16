---
phase: 11-skills-commands-and-records
iteration: 1
reviewed: 2026-11-15T00:00:00Z
depth: standard
diff_base: 1944a414
files_reviewed: 29
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/file-mentions.ts
  - extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts
  - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - extensions/pi-claude-marketplace/bridges/commands/command-record.ts
  - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
  - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
  - features/skill/aliases.feature
  - features/skill/invocation.feature
  - features/slash-command/aliases.feature
  - features/slash-command/frontmatter.feature
  - features/slash-command/invocation.feature
  - features/mcp-server/sources.feature
  - test/bridges/commands/command-record.test.ts
  - test/bridges/commands/stage.test.ts
  - test/bridges/commands/staged-command.test.ts
  - test/domain/file-mentions.test.ts
  - test/domain/name.test.ts
  - test/edge/skill-aliases.test.ts
  - test/orchestrators/command-invocation.test.ts
  - test/orchestrators/mention-attachments.test.ts
  - test/orchestrators/skill-alias-state.test.ts
  - test/orchestrators/skill-invocation.test.ts
  - test/orchestrators/typed-expansion.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
  necessity: 0
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-11-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

I reviewed the diff `1944a414..HEAD` for the 29 scoped files. The scope covers the Claude Code command name alias (PG-CMD-09 / D-PG11-01), the alias menu text (PG-SKILL-11 / D-PG11-09), and `@file` attachment (PG-SKILL-01 / D-PG11-02..08).

I checked these points and found them sound:

- The D-PG11-02 trust rule holds on both invocation paths. `authored` is the body with only the variables filled. Arguments and `!` output never reach the scan. Reads happen only after the trust gate, the Bash check, and the `!` commands, and `expandStagedCommand` and the skill-read fill do not attach.
- The span pairing in `maskParagraphSpans` and `closingRuns` handles nested and interleaved runs of different lengths correctly.
- The stat-then-read path reads one byte over the limit, so a file that grows after its `stat` is still refused.
- The record is written through `JSON.stringify`, so a colon name round-trips through YAML.
- `menuDescription` matches pi-tui 1.5.0's `${hint} — ${desc}` rule, including the empty-string cases, because `menuString` maps `""` to `undefined`.

The 647 unit tests in scope pass under the isolated home.

There are two Warnings:

- **WR-01:** the stored Claude Code name ignores a frontmatter `name`. I checked the 2.1.323 binary: upstream replaces the path-derived name in that case, so the alias is extra.
- **WR-02:** the code-span mask spans block boundaries and treats an escaped backtick as a delimiter, so it drops mentions that are not in code.

The Info items are small differences from Pi's file form or from upstream.

`necessity-review.md` was read; no necessity findings.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The stored "Claude Code name" is not Claude Code's name when the command sets frontmatter `name`

**File:** `extensions/pi-claude-marketplace/bridges/commands/staged-command.ts:292-298` (with `extensions/pi-claude-marketplace/domain/name.ts:546-548`, `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts:181-198`)

**Issue:** `buildStagedCommand` always stores `claudeName: claudeCommandName(pluginName, sourceName)`, which is the path-derived `<plugin>:<path>:<file>`. The alias reader then adds it as an alias for every command. Claude Code 2.1.323 does not register that name when the command's frontmatter sets `name`. The plugin command builder in the installed binary reads:

```js
ln=dBt(q.name,...), Ft=e.slice(0,e.lastIndexOf(":")+1),
Zt=ln ? (ln.startsWith(Ft) ? ln : `${Ft}${ln}`) : e,
wn=ln && !ln.includes(":") ? (...? [ln, e.slice(Ft.length)] : [ln]) : void 0
```

`e` is the path-derived name. When `ln` (frontmatter `name`) is set, the command's name becomes `Zt` (`Ft + ln`), and `e` is not a name or an alias.

Here is a concrete case. `demo/commands/demo-ship.md` with `name: fancy`:

- Upstream answers to `/demo:fancy` (and `/fancy`).
- This build also answers to `/demo:demo-ship`, which upstream rejects as an unknown command.

The record's doc comment ("the name Claude Code gives the command") and D-PG11-01's evidence record are wrong for this case. The extra alias can also claim a name before a later entry does (first-claim-wins in `claimedAliases`). AGENTS.md "Upstream parity" allows no divergence without a recorded decision. When the Pi name is not elided, the extra name equals the Pi name and `reserved` drops it, which is why the existing `ship`/`fancy` scenario does not show the bug.

**Fix:** Store the path name only when the source frontmatter has no usable `name`. Alternatively, store upstream's `Zt`, but that duplicates what `frontmatterNameAliases` already gives. For example, in `buildStagedCommand`:

```ts
const declaredName = parsed.frontmatter.name;
const claudeName =
  typeof declaredName === "string" && declaredName.trim() !== ""
    ? undefined // the frontmatter name replaces the path name upstream (2.1.323 `Zt`)
    : claudeCommandName(context.pluginName, command.sourceName);
```

Then make `withCommandRecord` accept an optional `claudeName` and leave the member out when it is `undefined`. Add a scenario row to `features/slash-command/aliases.feature`: `demo-ship` with `name: fancy`, where typing `/demo:demo-ship` reaches the model as plain text. Update the D-PG11-01 evidence record.

### WR-02: The code-span mask hides mentions outside code (escaped backticks, spans across list items or headings)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:72-74,156-187`

**Issue:** `maskCode` splits the body only on blank lines (`PARAGRAPH_BREAK`). It then pairs every backtick run inside each chunk. CommonMark differs on two points:

1. A backslash-escaped backtick is a literal character and does not open a span.
2. A code span cannot cross a block boundary. A list item, a heading, or a blockquote line starts a new block even without a blank line.

The mask therefore blanks plain text between such runs, and the mentions there are dropped silently. I checked this against the module:

```text
findFileMentions("Use \\` then @a.md then `x`")    => []   // CommonMark: @a.md is plain text
findFileMentions("- item `one\n- @b.md two`")       => []   // two list items; no span crosses them
```

D-PG11-03 licenses skipping only mentions that are really inside fenced code or a code span. Everywhere else, D-PG11-04 requires parity, and upstream attaches these. One stray backtick in an earlier list item is enough to make an author's `@file` vanish, with no notice (D-PG11-06 prints only a debug line).

**Fix:**

- Before pairing, drop runs that a backslash precedes. In `maskParagraphSpans`, filter matches whose preceding character is an unescaped `\`.
- Also split chunks at block starts, not only at blank lines. One approach is a split regex on `\n(?=[^\S\n]{0,3}(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>))`, which keeps the separator so lengths are preserved.
- Add both cases above to `test/domain/file-mentions.test.ts`.

## Info

### IN-01: An empty file is attached as an empty block; Pi's own form skips it

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:296-317`

**Issue:** D-PG11-05 says the block is "Pi's own form" (`PI/dist/cli/file-processor.js`). That processor skips an empty file (`// Skip empty files; continue`). `renderMentionBlock` returns `<file name="...">\n\n</file>` for zero bytes. Claude Code's Read reports an empty file with a reminder instead of empty content.

**Fix:** Return `undefined` for `bytes.length === 0`, with a debug cause ("it is empty"). Or record the choice in D-PG11-06.

### IN-02: A reversed or zero line range attaches an empty block

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:51,235-243,306-310`

**Issue:** `@x.md#L5-3` gives `{start: 5, end: 3}`, and `slice(4, 3)` is empty. `@x.md#L0` gives `slice(0, 0)`. Both attach `<file name="...">\n\n</file>`, which tells the model the file is empty. I did not verify what upstream's `sls` consumer does with these ranges.

**Fix:** Treat `end < start` as a single-line range, or as no range. Clamp a `0` start to line 1 for `end` too, for example `end: Math.max(end, start)`. Add a test that pins the chosen rule.

### IN-03: Attached file text can split Pi's skill block display

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:174-179,224-228`

**Issue:** The file blocks go inside `<skill>...</skill>`, so Pi does not show them as the user's message (D-PG11-05). Pi's `parseSkillBlock` (`agent-session.js:64`) uses a lazy `([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$`. A mentioned file that contains a line `</skill>` followed by a blank line (for example, plugin-authoring docs) ends the parsed block there. The rest of the file then shows as the user's typed message. The model still gets the whole text, so the effect is display-only. `!` output already had the same exposure.

**Fix:** Record the limitation in the compatibility page. Or neutralize a bare `</skill>` line inside attached content (for example, a zero-width break), if a display fix is wanted.

### IN-04: Dedup is by mention text, not by resolved file

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:252-265`

**Issue:** `@a.md`, `@./a.md`, and `@${CLAUDE_PROJECT_DIR}/a.md` are three texts that resolve to one file, and all three are attached. D-PG11-04 says "A mention is attached once even if it repeats". The code reads that as a repeat of the same text, and I did not verify upstream's rule.

**Fix:** Either dedupe on the resolved absolute path plus range in `appendMentionedFiles`, or state in D-PG11-04 that dedup is textual.

### IN-05: A command map key with `/` gets a Claude name that splits the key

**File:** `extensions/pi-claude-marketplace/domain/name.ts:546-548`; `extensions/pi-claude-marketplace/bridges/commands/discover.ts:579,610`

**Issue:** For a D-CF3-03 map entry, `sourceName` is the key itself. `commandMapKeyRefusal` does not refuse `/`. `claudeCommandName` splits on `/`, so the key `tools/lint` is stored as `plugin:tools:lint`. The plugins reference quoted in D-PG11-01 says "each key becomes the command name after the plugin prefix", which gives `plugin:tools/lint`. This is rare, and the Pi name splits the same way, so the main effect is that the record's "Claude Code name" is not the upstream one for this input.

**Fix:** For `inline` and map-`file` commands, which carry a key, store `${plugin}:${key}`. Use the segment join only for walked files.

---

_Reviewed: 2026-11-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
