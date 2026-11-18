---
phase: 11-skills-commands-and-records
iteration: 3
reviewed: 2026-11-15T00:00:00Z
depth: standard
diff_base: c2724cfd
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/file-mentions.ts
  - test/domain/file-mentions.test.ts
  - features/slash-command/invocation.feature
  - features/slash-command/aliases.feature
  - docs/skills-commands-compatibility.md
findings:
  critical: 0
  warning: 2
  info: 9
  total: 11
  necessity: 0
status: issues_found
---

# Phase 11: Code Review Report (iteration 3)

**Reviewed:** 2026-11-15T00:00:00Z
**Depth:** standard
**Diff:** `c2724cfd..HEAD`: `8b1c0eb1` (WR-03), `bfca1330` (IN-06), `259f969a` (IN-07), `b574dd55` (records)
**Files Reviewed:** 5. I also read the D-PG11-03 record in `11-CONTEXT.md` to check its claims. It is a planning file, so it is not in the list.
**Status:** issues_found

## Summary

The three iteration-2 fixes hold for the cases they name. All 27 new or nearby unit expectations agree with commonmark.js 0.31. I ran each body through the reference parser. But the new paragraph rules in `bfca1330` add three regressions that `c2724cfd` handled correctly. Two of them are outside lists, which the documented residual does not cover.

**Red/green.** I copied the module from `c2724cfd`, `8b1c0eb1`, and HEAD into a scratch directory outside the working tree. Then I ran HEAD's `test/domain/file-mentions.test.ts` against each copy:

- `c2724cfd`: 94 pass, 15 fail. The four WR-03 rows fail (thematic `---`, `***`, `___`, and setext `===`), and 11 IN-06 rows fail.
- `8b1c0eb1`: 98 pass, 11 fail. The WR-03 rows pass, and the IN-06 rows still fail.
- HEAD: 109 pass, 0 fail.

The controls pass at every commit. The two new cucumber rows fail without their fix: `Run \`lint\n---\nReview @…` attaches nothing at `c2724cfd`, and `Step \`a\n2. b\` then review @…` attaches nothing at `8b1c0eb1`. Both attach at HEAD. I did not run cucumber. I checked these rows on the module, and the fixer recorded red and green cucumber runs. The IN-07 Outline adds positive controls (`/demo:ship`, `/demo:fancy`, `/fancy`) beside the negative row on the same `demo-ship.md` fixture. Its citations (`aliases.feature:147`, `invocation.feature:336/373/398`) match the current lines.

**Linearity.** The mask stays linear. I timed `findFileMentions` on 18 hostile shapes at 25k, 50k, 100k, and 200k characters. The shapes include `> ` chains, long `- - -` lines that fail the thematic-break test, `=…=x`, odd backtick runs, growing runs, backslash runs, escaped runs, list and blank-line floods, tab runs, and `@` chains. Each time roughly doubles when the size doubles, and the worst is 343 ms for 200,000 blank lines. Each new regex is anchored, and its quantifiers do not overlap. `QUOTE_MARKERS` always succeeds, so it never backtracks. In `THEMATIC_BREAK`, each iteration matches in only one way.

**Regressions (fuzz against commonmark.js).** I generated random 2- to 5-line bodies with exactly one `@b.md` at a token start, kept the cases where CommonMark puts it in text or in a code span, and compared the results:

- Without lists, tabs, or fences: 0 mismatches at HEAD in 20,781 bodies, against 216 at `c2724cfd`.
- With lists: HEAD drops 167 and over-attaches 176 in 55,805 bodies. Most of these are the documented residual. But 14 over-attaches are new against `c2724cfd`. Eight come from a column-0 setext underline under a list item (WR-04). The others come from in-list breaks at any indentation (IN-10).
- With fences, no lists: HEAD drops plain-text mentions that `c2724cfd` attached, after a fence inside a blockquote (WR-05).
- With tabs, no lists: `>\t` is counted as four columns of indentation, so both drops and over-attaches appear (IN-09).

I wrote prototype fixes for WR-04, WR-05, and IN-09 in the scratch copy. They bring the no-list fuzz to 0 mismatches with tabs or with fences, and all 109 unit rows still pass.

**Docs.** The compatibility page and the D-PG11-03 record name the list residual only in the skip direction. They also do not mention the cases above (IN-10).

## Earlier iteration dispositions

| ID    | Disposition | Notes |
| ----- | ----------- | ----- |
| WR-01 | Fixed (iter 1), verified | Unchanged in this diff. |
| WR-02 | Fixed (iter 1, completed by WR-03/IN-06) | Escapes, list items, ATX headings, and blockquotes are boundaries, and thematic breaks and setext underlines now are too. |
| WR-03 | Fixed, verified (`8b1c0eb1`) | 4 rows red at `c2724cfd`, green at `8b1c0eb1` and at HEAD. The cucumber row's body is red at `c2724cfd`. |
| IN-06 | Fixed, verified (`bfca1330`) | Both counterexamples now attach, which matches CommonMark. The false "only lets more mentions through" comment is gone. New regressions from this commit: WR-04, WR-05, IN-09. |
| IN-07 | Fixed (`259f969a`) | 3 positive controls and 1 negative row on the `demo-ship` fixture. The fixer recorded red as 3 pass and 1 fail with the WR-01 guard reverted. I traced it and did not rerun it. |
| IN-01 | **Open** (Info) | `file-mentions.ts:478-499`: `renderMentionBlock` attaches a zero-byte file as `<file name="…">\n\n</file>`, but Pi's own form skips an empty file. Fix: return `undefined` for `bytes.length === 0`, or record the choice in D-PG11-06. |
| IN-02 | **Open** (Info) | `file-mentions.ts:51,424,492`: `#L5-3` gives `slice(4, 3)` and `#L0` gives `slice(0, 0)`. Both attach an empty block, which tells the model the file is empty. Fix: clamp `end` to at least `start`, and pin the rule with a test. |
| IN-03 | **Open** (Info) | `orchestrators/skill-invocation.ts:174-179,224-228`: an attached `</skill>` line followed by a blank line splits Pi's `parseSkillBlock` display. Not in this diff. |
| IN-04 | **Open** (Info) | `file-mentions.ts:434-447`: dedup is by text, so `@a.md`, `@./a.md`, and `@${CLAUDE_PROJECT_DIR}/a.md` all attach. Fix: dedupe on the resolved path plus the range, or state the rule in D-PG11-04. |
| IN-05 | **Open** (Info) | `domain/name.ts:546-548`, `bridges/commands/discover.ts:579,610`: map key `tools/lint` gets the name `plugin:tools:lint`, but upstream gives `plugin:tools/lint`. Not in this diff. |
| IN-08 | **Open** (Info) | `bridges/skills/skill-names.ts:165-170,195-206,272-288`: `commandUpstreamNames` ignores the frontmatter `name`, so it suppresses `demo:ship` and not `demo:fancy`. The upstream conflict rule is not verified. Not in this diff. |

## Narrative Findings (AI reviewer)

## Warnings

### WR-04: A column-0 `===` or `--` line under a list item ends the paragraph, so a mention CommonMark puts in a code span is attached (regression)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:326-334` (`underlines`, line 332). The comment at `:339` claims CommonMark parity for "one level of list".

**Issue:** `underlines()` returns true for any setext-shaped line when `paragraph.inList` is set, at any indentation. In CommonMark, an underline ends a list item's paragraph only when it sits inside the item's content. A column-0 `===` or `--` line cannot be a lazy underline, so CommonMark reads it as lazy paragraph text, and the code span runs on across it. Results at each commit:

```text
body                         CommonMark                         c2724cfd  8b1c0eb1  HEAD
"- a `x\n===\n@b.md `y"      <li>a <code>x === @b.md </code>y   []        [b.md]    [b.md]
"- a `x\n--\n@b.md `y"       <li>a <code>x -- @b.md </code>y    []        [b.md]    [b.md]
"+ `` x `\n===\n\ta `x` @b.md `"  @b.md inside <code>          []        [b.md]    [b.md]
```

The mention is inside a code span, and D-PG11-03 and the compatibility page say such a mention is not attached. `c2724cfd` got this right. `8b1c0eb1` added an unconditional underline boundary, and `bfca1330` kept the `inList ||` bypass. The failure needs only one list level, so the comment at `:339` ("follows CommonMark for text, blockquotes, and one level of list") is false. The documented residual covers only nested items and headings, and only the skip direction. So neither the page nor D-PG11-03 describes this case. In the list fuzz, 8 of HEAD's 176 over-attaches come from this rule alone.

**Fix:** Inside a list, require the underline to be indented, which approximates "inside the item's content":

```ts
function underlines(line: LineShape, paragraph: ParagraphStart): boolean {
  return (
    line.underline &&
    line.quoteDepth === paragraph.quoteDepth &&
    (paragraph.inList ? line.indent > 0 : line.indent < CODE_INDENT)
  );
}
```

In the scratch copy this keeps all 109 rows green, including `- a \`x\n  ===\n@b.md \`y`. It removes 8 over-attaches from the list fuzz. Add the first two bodies above as rows that expect `[]`.

### WR-05: After a fence inside a blockquote, an unquoted line is read as lazy text, so a plain-text mention in the next blockquote is dropped (regression)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:286-291,317-323` (the quote depth is now taken from the paragraph's first line). The interaction is with `maskFences` at `:169-190`, where `FENCE_RUN` at `:69` is tested on the raw line.

**Issue:** `bfca1330` compares a line's quote depth with the depth of the paragraph's first line, not of the line before it, so that a lazy line keeps a blockquote paragraph open. That is correct only when the quoted lines form a paragraph. `maskFences` does not recognize a fence behind `>` markers, so a quoted fence reaches `paragraphs()` as text. The unquoted line after the quoted fence is then treated as lazy. And the next `>` line no longer counts as deeper, so it does not split:

```text
body                                                  CommonMark                               c2724cfd  HEAD
"> ```\n> code\n> ```\nText with `x\n> @b.md `y"       <p>Text with `x</p><blockquote><p>@b.md `y  [b.md]    []
"> -\nfoo `a\n> @b.md `y"                              <p>foo `a</p><blockquote><p>@b.md `y      [b.md]    []
```

The first body is an ordinary shape: a quoted code sample, then prose, then a quoted note. The mention is plain text in CommonMark, so dropping it is the silent D-PG11-03 overreach that WR-02 and WR-03 were about. D-PG11-06 prints only a debug line. `c2724cfd` attached it. The documented residual is about lists, so neither the page nor D-PG11-03 mentions this. The fuzz with fences and no tabs found 26 such drops against `c2724cfd`, all of the quoted-fence shape.

**Fix:** Recognize a fence behind blockquote markers, and end it when the quote depth drops, as CommonMark does. The masked fence lines are then blank, and a blank line already resets the paragraph:

```ts
function maskFences(text: string): string {
  const masked: string[] = [];
  let open: string | undefined;
  let openDepth = 0;
  for (const line of text.split("\n")) {
    const content = line.replace(QUOTE_MARKERS, "");
    const quote = line.slice(0, line.length - content.length);
    const depth = quote.length - quote.replaceAll(">", "").length;
    const fence = fenceLineOf(content);
    if (open !== undefined && depth < openDepth) {
      open = undefined;
    }
    if (open === undefined) {
      open = openingRun(fence);
      openDepth = depth;
      masked.push(open === undefined ? line : " ".repeat(line.length));
      continue;
    }
    if (closesFence(fence, open)) {
      open = undefined;
    }
    masked.push(" ".repeat(line.length));
  }
  return masked.join("\n");
}
```

With WR-04's fix also applied in the scratch copy, the fuzz with fences and no lists or tabs gives 0 mismatches. All 109 rows pass, and `> \`\`\`\n> see @b.md\n>\n> more\n> \`\`\`` is no longer attached (see IN-11). Pin the first body above as a row that expects `[whole("b.md")]`. The empty-item body is a list shape and falls under the residual.

## Info

### IN-09: A tab after `>` counts as four columns, so a quoted line can be read as indented code (regression)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:73` (`QUOTE_MARKERS` takes only a space), `:274` (`replaceAll("\t", "    ")`)

**Issue:** CommonMark treats a tab as moving to the next column that is a multiple of 4, and the optional space of a `>` marker can be taken from a tab. So `>\t` and `> \t` leave 2 columns of indentation. The bridge counts 4, so the line is "code" or "indented like code":

```text
"> Note `x\n>\t- @b.md `y"    CommonMark: <p>Note `x</p><ul><li>@b.md `y   c2724cfd [b.md]  HEAD []
">\tUse `x\n#tag @b.md `y"    CommonMark: <code>x #tag @b.md </code>       c2724cfd []      HEAD [b.md]
```

The rule fails in both directions. It is rare in plugin markdown. In the fuzz with tabs and no lists or fences, HEAD had 22 drops and 154 over-attaches, almost all with `>\t`.

**Fix:** Expand tabs to tab stops before you strip the markers in `lineShape`. The masked text keeps the raw line.

```ts
function expandTabs(line: string): string {
  let out = "";
  for (const char of line) {
    out += char === "\t" ? " ".repeat(4 - (out.length % 4)) : char;
  }
  return out;
}
// lineShape: const content = expandTabs(line).replace(QUOTE_MARKERS, ""); ...
```

In the scratch copy, with the WR-04 and WR-05 fixes, this brings the no-list fuzz with tabs to 0 mismatches. All 109 rows pass.

### IN-10: The docs and the D-PG11-03 record state the list residual in one direction only, and they overstate two rules

**File:** `docs/skills-commands-compatibility.md:74`; `.planning/phases/11-skills-commands-and-records/11-CONTEXT.md:123-133`; `extensions/pi-claude-marketplace/domain/file-mentions.ts:336-340`

**Issue:**

- Both texts say the list approximation "can end a span too early and skip a mention that CommonMark leaves outside code". An early end can also attach a mention that CommonMark puts inside a span. For example, `- a \`x\n    2. @b.md \`y` attaches at HEAD (and at `c2724cfd`), but CommonMark reads `2.` as paragraph text and gives `<code>x 2. @b.md </code>`. In the list fuzz, HEAD over-attaches 176 times and drops 167 times. This is the IN-06 mistake in reverse: the text again claims that a split has only one effect.
- "Inside a list … every list item and heading ends a code span, at any indentation." The code also ends one at any thematic break, through the `heading` flag, and at any setext underline (WR-04). The page lists the thematic break separately from the heading two sentences earlier, so a reader cannot infer it.
- "On a line that leaves a blockquote, any list item can start there." The code still requires an indent under 4 (`startsBlock`, `:312`). That is right: `> text \`a\n    - @b.md \`y` is paragraph text in CommonMark, and HEAD masks it correctly. But the sentence says "any". The D-PG11-03 record repeats "any item".
- In "So a mention after such a backtick or past such a line is attached", the phrase "such a backtick" refers to the escaped backtick three sentences earlier, past the paragraph-end sentences.
- The code comment at `:339` claims parity for "blockquotes, and one level of list". WR-04 (one list level) and WR-05 (blockquotes) contradict it.

**Fix:** State the residual in both directions ("can end a span early or late, so a mention can be skipped or attached"). Add thematic breaks and underlines to the in-list sentence. Keep the under-4 rule in the blockquote sentence. Move the escaped-backtick consequence next to its own sentence. Fix the comment after WR-04 and WR-05, or drop its parity claim.

### IN-11: A fence inside a blockquote, or indented 4 or more columns in a list item, is not masked, so a mention in it is attached when the fence holds a blank line (pre-existing)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:69` (`FENCE_RUN = /^ {0,3}…/` on the raw line), `:147-190`

**Issue:** `maskFences` tests each raw line against `^ {0,3}` and a run of backticks or tildes. A fence behind `>` is never a fence. Neither is a fence in a list item whose content starts at column 4 or later, such as a `1.` item indented with four spaces, which is a common editor default, or a nested item. The bridge then masks the fence only when its two backtick runs land in one bridge paragraph. A blank line inside the fence breaks that:

```text
"> ```\n> see @b.md\n>\n> more\n> ```"                 CommonMark: in <pre><code>   HEAD [b.md]
"1. Step:\n\n    ```\n    see @b.md\n\n    more\n    ```" CommonMark: in <pre><code>   HEAD [b.md]
```

`c2724cfd` behaved the same way, so this is not a regression. But it contradicts the page's sentence "A mention inside fenced code … is not attached", and the attachment goes in upstream's direction. The cause is the same as WR-05's. WR-05's fix covers the blockquote half. The list half needs the item's content column.

**Fix:** Apply WR-05's `maskFences` change. For lists, either track the content column of the open item, or allow up to 3 columns past the current paragraph's indent when `inList`. Otherwise, add "a fence inside a list item indented four or more columns is not recognized" to the page and to D-PG11-03.

---

_Reviewed: 2026-11-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3_
