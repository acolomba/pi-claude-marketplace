---
phase: quick-260814-fqf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/BACKLOG.md
autonomous: true
requirements: [SRCP-01]

estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - "A reader of the SRCP-01/02 entry learns, before reaching any recommendation, that SRCP-01 was withdrawn on 2026-08-14 and why."
    - "The entry cites the live claude CLI v2.1.232 probes verbatim, so the next reader who finds the same upstream changelog line cannot re-file the item from prose alone."
    - "The entry no longer recommends teaching parsePluginSource a scheme-less host-prefixed form, and states positively that adding one would accept input upstream itself rejects."
    - "SRCP-02 survives with its substance and its official-docs citation intact, and its direction reads self-containedly now that the sentence it borrowed from is gone."
    - "GAUTH-01 and the frozen spike 008 README are byte-identical after the edit."
  artifacts:
    - .planning/BACKLOG.md
  key_links:
    - "The current 'Direction for later' paragraph is a single coupled unit: its SRCP-02 sentence says 'Reuse the SAME ... expansion', whose antecedent is the SRCP-01 sentence being deleted, and its closing sentence says 'BOTH are domain/source.ts-only changes'. Deleting the SRCP-01 half without restating the other two orphans SRCP-02's direction and leaves a dangling plural. This is the one place a naive insert-only edit breaks the file."
    - "The heading token `SRCP-01/02` is the cross-reference target of the frozen spike README (`.planning/spikes/008-gitlab-bare-source-parsing/README.md:121`, 'Filed to BACKLOG.md as SRCP-01/02'). That README must not be edited, so the token must survive in the heading or the cross-reference dangles."
---

<objective>
Record, inside the existing `SRCP-01/02` BACKLOG.md entry, that SRCP-01 is not a real
parity gap: live probes against the installed claude CLI v2.1.232 show upstream itself
rejects the scheme-less host-prefixed source form that SRCP-01 proposed we learn to accept.

Purpose: SRCP-01 was filed from spike 008, which took an upstream changelog line at face
value without probing the shipped binary. Implementing it as scoped would make our parser
accept input upstream rejects -- a parity regression sold as a parity fix. The correction
has to live where the next reader meets the same changelog line, with the evidence
attached, or the item gets re-filed from the same prose a second time.

Output: one amended entry in `.planning/BACKLOG.md`. No source changes, no test changes,
no other file touched.
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/BACKLOG.md
@.planning/STATE.md

Do NOT open `.planning/spikes/008-gitlab-bare-source-parsing/README.md` for editing. It is
a frozen historical investigation record. Its conclusion is the thing being corrected, and
it stays wrong on purpose -- the correction lives in BACKLOG.md, which is the live document.
</context>

<research_findings>

## The evidence (all gathered 2026-08-14, against the installed claude CLI v2.1.232)

These are live probes of the shipped upstream binary, not of our own reimplementation. Four
results, and they are the substance of the correction:

1. `claude plugin marketplace add "gitlab.com/acolomba/pi-cm-test-marketplace"`
   -> rejected: `not a valid GitHub owner/repo shorthand. For a git repo, use the full
   https:// clone URL from your host...`
2. The same string with a `.git` suffix appended -> identical rejection.
3. `claude plugin marketplace add "acolomba/pi-cm-test-marketplace"` (host-less shorthand)
   -> routes to github.com, attempting `git@github.com:acolomba/pi-cm-test-marketplace.git`.
   It does not consider GitLab at all.
4. `https://gitlab.com/acolomba/nonexistent-repo` and
   `https://gitlab.com/somegroup/somesubgroup/nonexistent-repo` (full scheme, flat and
   nested-subgroup) BOTH passed source-format validation and reached a real clone attempt,
   with the auth-failure message correctly naming `gitlab.com` as the host.

## What that means for the changelog line

The upstream line spike 008 was filed from -- "bare gitlab.com repo URLs (including nested
subgroups) now clone like github.com URLs" -- read against probes 1-4 describes the full
`https://gitlab.com/...` form receiving GitHub-URL-equivalent treatment: nested-subgroup-safe
parsing, and host-aware auth hints. It does not announce a new scheme-less input syntax.
Probe 3 shows the host-less shorthand is still GitHub-only upstream, exactly as it is here
(D-76-04). Probes 1 and 2 show the scheme-less host-prefixed form is rejected outright.

So SRCP-01's premise inverts: our `unknown` classification of `gitlab.com/group/project`
is not a gap behind upstream, it is agreement with upstream. Implementing SRCP-01 as scoped
would move us AHEAD of upstream into accepting input upstream refuses.

## What is NOT affected

- **Probe 4's auth-hint half.** That the failure message named `gitlab.com` confirms the
  OTHER half of the same changelog line. That half is GAUTH-01's territory (spike 009) and
  is unaffected by this correction. Mention it inside the SRCP correction as a pointer;
  do NOT edit the GAUTH-01 entry.
- **SRCP-02.** The git-subdir `url` field's owner/repo shorthand expansion is confirmed
  independently by upstream's own published git-subdirectories schema, which the bullet
  already cites by URL. Nothing in probes 1-4 bears on it. Its disposition does not change.
- **Spike 008's full-scheme finding.** Probe 4 CONFIRMS it (full-scheme GitLab URLs with
  nested subgroups already work here with no change). Only the bare-form half was wrong.

## Convention precedent in this file (checked, do not re-derive)

Three ways BACKLOG.md already records a changed disposition:

- **In-place correction with a bolded lead-in (COV-01, lines 49-78).** The original premise
  stays stated, then `**The premise has already narrowed.**` opens a paragraph carrying the
  new dated measurement and says plainly what it removes from scope. This is the closest
  match and the one to follow: SRCP-01 was disproven, not shipped.
- **Trailing parenthetical for a sibling's disposition (GAUTH-01, lines 792-793).** Used to
  note GAUTH-02 already shipped. Wrong shape here -- too small to carry the evidence.
- **The pruned-items HTML comment (lines 795-803).** Reserved for items that SHIPPED and
  were removed from the body. Wrong shape here on two counts: SRCP-01 did not ship, and
  moving it into a comment would delete the very evidence that stops the next reader from
  re-filing it from the same changelog line.

Verdict: follow the COV-01 shape. Keep the item in the body, correct it in place.

## House style for the prose you add

BACKLOG.md uses ASCII `--` for the em dash throughout, never the `—` glyph. Backtick every
identifier, path and CLI string. Bold the lead-in of a correction paragraph. No emoji.
</research_findings>

<tasks>

<task type="auto">
  <name>Task 1: Record the SRCP-01 correction in .planning/BACKLOG.md</name>
  <files>.planning/BACKLOG.md</files>
  <read_first>
Read `.planning/BACKLOG.md` once, in full, before editing. Two regions matter:
- the `SRCP-01/02` entry (heading at line 742 through line 775, ending with the closing
  sentence of its `Direction for later` paragraph);
- the `COV-01` entry (lines 49-78), whose correction paragraph is the shape being copied.

Note while reading: line 742's heading has NO blank line before it -- it butts directly
against the closing paragraph of the ENVLIT-01 entry above. Every other heading in the file
has one.
  </read_first>
  <action>
Amend the `SRCP-01/02` entry so a reader learns SRCP-01 is withdrawn before reaching any
recommendation, and so no recommendation to change the parser's handling of scheme-less
host-prefixed strings survives anywhere in the entry. Follow the COV-01 in-place-correction
shape identified in `<research_findings>`. Five edits, all inside that entry plus one
adjacent blank line:

1. **Blank line before the heading.** Insert the missing blank line between the ENVLIT-01
   entry's closing paragraph and the `## SRCP-01/02:` heading, matching every other heading
   in the file. Adjacent hygiene inside the region being edited; nothing else about ENVLIT-01
   changes.

2. **Heading.** Keep the literal token `SRCP-01/02` at the start -- the frozen spike README
   cross-references it and cannot be edited. Amend only the descriptive tail so a reader
   scanning headings sees the split disposition. Suggested:
   `## SRCP-01/02: git-subdir url expansion (SRCP-01 withdrawn)`

3. **Mark the SRCP-01 bullet.** Leave the bullet's body text exactly as filed -- it is the
   record of what was believed and it is what the correction argues against. Add only a
   short marker at the head of the bullet so a skimmer cannot read it as live, e.g.
   `SRCP-01 (WITHDRAWN 2026-08-14 -- see the correction below):` followed by the existing
   text unchanged.

4. **Insert the correction paragraph** after the two-bullet list and BEFORE the
   `Direction for later` paragraph, so it is read first. Open with a bolded lead-in in the
   COV-01 manner. It must carry, verbatim where quoted: the CLI version probed
   (`v2.1.232`), the date, all four probe results from `<research_findings>` including the
   exact upstream rejection message string, the corrected reading of the changelog line,
   and the conclusion that implementing SRCP-01 as scoped is a parity regression rather than
   a parity fix. Include the one-clause pointer that probe 4 corroborates the auth-hint half
   of the same changelog line, which belongs to GAUTH-01, without editing that entry.
   Also record explicitly that probe 4 CONFIRMS spike 008's other, correct finding
   (full-scheme GitLab URLs with nested subgroups already resolve here with no change), so
   the correction is not read as discarding the whole spike.

   Suggested wording -- tighten the prose if you like, but the facts, quoted strings, date
   and version are fixed:

   > **SRCP-01 is withdrawn: upstream rejects this form too.** Probed 2026-08-14 against
   > the installed `claude` CLI v2.1.232 -- the shipped binary, not our reimplementation of
   > it. `claude plugin marketplace add "gitlab.com/acolomba/pi-cm-test-marketplace"` is
   > rejected outright: `not a valid GitHub owner/repo shorthand. For a git repo, use the
   > full https:// clone URL from your host...`, and identically so with a `.git` suffix.
   > The host-less `acolomba/pi-cm-test-marketplace` shorthand still routes to GitHub
   > (`git@github.com:acolomba/pi-cm-test-marketplace.git`), never to GitLab -- the same
   > already-assumed-GitHub rule we implement as D-76-04. Meanwhile
   > `https://gitlab.com/acolomba/nonexistent-repo` and
   > `https://gitlab.com/somegroup/somesubgroup/nonexistent-repo` both passed source-format
   > validation and reached a real clone attempt.
   >
   > Read against that behavior, the changelog line this item was filed from ("bare
   > `gitlab.com` repo URLs, including nested subgroups, now clone like `github.com` URLs")
   > describes the full `https://gitlab.com/...` form getting GitHub-URL-equivalent
   > treatment -- nested-subgroup-safe parsing and host-aware auth hints -- not a new
   > scheme-less input syntax. Our `{kind: "unknown"}` for `gitlab.com/group/project` is
   > therefore agreement with upstream, not a gap behind it, and teaching
   > `parsePluginSource` that form would leave us accepting input upstream refuses: a parity
   > regression, not a parity fix. The clone attempt above also named `gitlab.com` in its
   > auth-failure message, which corroborates the other half of the same changelog line --
   > that half is [GAUTH-01]'s territory and is unaffected here. Spike 008's other finding
   > stands confirmed: full-scheme GitLab URLs, nested subgroups included, already resolve
   > today with no change.

5. **Rewrite the `Direction for later` paragraph.** Treat it as one coupled unit, not as a
   paragraph to snip a sentence out of -- see the second `key_links` entry. Its middle
   sentence borrows its antecedent ("the SAME ... expansion") from the sentence being
   removed, and its closing sentence says "BOTH are `domain/source.ts`-only changes". After
   the rewrite the paragraph must:
   - carry no recommendation to teach the parser a scheme-less host-prefixed form, and
     instead state positively that none should be added, with the reason (upstream rejects
     it) so a later reader does not re-derive the recommendation;
   - restate SRCP-02's direction self-containedly -- expand a host-less `owner/repo` value
     in the `git-subdir` object source's `url` field to its full GitHub clone URL, the same
     already-assumed-GitHub rule D-76-04 applies to string sources -- rather than leaving a
     dangling back-reference;
   - make the closing scope sentence singular, since only one change remains.

**Preserve exactly:** the SRCP-02 bullet's body, including the official-docs URL it cites.
Its disposition does not change; only the direction paragraph gets restated, and only
because deleting the coupled sentence would otherwise orphan it. Call that restatement out
in the SUMMARY so the operator sees it was deliberate.

**Do not touch:** the `GAUTH-01` entry, any other backlog entry, any file under
`.planning/spikes/`, and any source or test file. This is a documentation correction only.

**Style:** ASCII `--` for dashes, never the `—` glyph, matching the rest of the file.
Backtick identifiers, paths and CLI strings. No emoji.
  </action>
  <verify>
    <automated>
Run from the repo root, BEFORE committing (the tracked-diff gates read the working tree):

set -euo pipefail
cd /Users/acolomba/src/pi-claude-marketplace

# only .planning/ changed, and BACKLOG.md is one of the changes
test "$(git diff --name-only | grep -cv '^\.planning/' || true)" -eq 0
git diff --name-only | grep -qx '\.planning/BACKLOG\.md'
git diff --quiet -- .planning/spikes/

# the evidence landed
grep -aq 'v2\.1\.232' .planning/BACKLOG.md
grep -aq 'not a valid GitHub owner/repo shorthand' .planning/BACKLOG.md
grep -aq 'WITHDRAWN' .planning/BACKLOG.md

# the withdrawn recommendation is gone (this identifier appears only in it)
test "$(grep -ac 'slashCount' .planning/BACKLOG.md || true)" -eq 0

# cross-reference target and SRCP-02's citation both survive
test "$(grep -ac '^## SRCP-01/02:' .planning/BACKLOG.md)" -eq 1
test "$(grep -ac 'plugin-marketplaces.md#git-subdirectories' .planning/BACKLOG.md)" -eq 1
test "$(git diff -U0 -- .planning/BACKLOG.md | grep -a '^-' | grep -ac 'plugin-marketplaces.md#git-subdirectories' || true)" -eq 0

# GAUTH-01 untouched; no em-dash glyph introduced (house style is ASCII --)
test "$(git diff -U0 -- .planning/BACKLOG.md | grep -a '^[+-]' | grep -ac 'GAUTH' || true)" -eq 0
test "$(git diff -U0 -- .planning/BACKLOG.md | grep -a '^+' | LC_ALL=C grep -ac $'\xe2\x80\x94' || true)" -eq 0

echo GATES-PASS
    </automated>
    <human-check>
Read the amended entry top to bottom once. A reader who arrives from the upstream changelog
line must hit the withdrawal before any recommendation, and must not be able to reconstruct
the withdrawn recommendation from what remains. The `Direction for later` paragraph must
read as a complete thought about SRCP-02 alone, with no dangling "the same" or "both".
    </human-check>
  </verify>
  <done>
- `.planning/BACKLOG.md` is the only changed tracked file; nothing outside `.planning/` moved.
- The `SRCP-01/02` heading still carries that literal token, and its tail signals SRCP-01's
  withdrawal.
- The SRCP-01 bullet body is unchanged apart from a withdrawal marker at its head.
- A bolded correction paragraph sits between the bullet list and `Direction for later`,
  carrying the CLI version, the date, all four probe results, the exact upstream rejection
  string, the corrected reading of the changelog line, the parity-regression conclusion, the
  GAUTH-01 pointer, and the note that spike 008's full-scheme finding stands confirmed.
- `Direction for later` recommends nothing about scheme-less host-prefixed strings, says so
  positively with the reason, restates SRCP-02's direction self-containedly, and is singular
  in its closing scope sentence.
- The SRCP-02 bullet and its official-docs URL are byte-identical.
- `GAUTH-01` and `.planning/spikes/008-gitlab-bare-source-parsing/README.md` are
  byte-identical.
- The gate script above prints `GATES-PASS`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none crossed) | Single-file edit to a planning document. No input parsed, no code path changed, no artifact materialized, no network, no credential, no disk path derived from user input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fqf-01 | Tampering | `.planning/BACKLOG.md` scope creep | low | mitigate | Diff-scoped gates in `<verify>` assert nothing outside `.planning/` changed, that `.planning/spikes/` is untouched, and that no `GAUTH` line appears on either side of the diff. |
| T-fqf-02 | Repudiation | correction without evidence | low | mitigate | The correction records the probed CLI version, the date, and the verbatim upstream rejection string, so the finding is re-checkable rather than asserted. Gated by the three positive greps. |
| T-fqf-03 | Information disclosure | probe strings in a committed doc | low | accept | The probe targets are the operator's own public test marketplace and a nonexistent public repo path. No token, credential or private host appears in any recorded string. |

No package-manager install is introduced by this plan, so no `T-fqf-SC` supply-chain
checkpoint applies.
</threat_model>

<verification>
- The gate script in Task 1's `<automated>` block prints `GATES-PASS`.
- `git diff -- .planning/BACKLOG.md` reviewed by eye: every hunk falls inside the
  `SRCP-01/02` entry, except the one added blank line before its heading.
- No `npm run check` needed -- zero source or test files are touched, and `.planning/` is
  excluded from both the `mdformat` and `markdownlint-cli2` pre-commit hooks
  (`.pre-commit-config.yaml`, `exclude: ^(tests/fixtures/|tests/bridges/_fixtures/|\.planning/)`),
  so no markdown formatter will rewrite the entry.
- `pre-commit run --files .planning/BACKLOG.md` before committing, per the project's
  commit discipline.
</verification>

<success_criteria>
- The next reader who meets the upstream changelog line inside this entry cannot re-file
  SRCP-01 from prose: the live-CLI counter-evidence is attached, dated and versioned.
- No recommendation to teach `parsePluginSource` a scheme-less host-prefixed form survives
  anywhere in `.planning/BACKLOG.md`.
- SRCP-02 is still actionable and still cites upstream's git-subdirectories schema; its
  direction reads on its own now that the sentence it borrowed from is gone.
- GAUTH-01 is untouched. `.planning/spikes/008-gitlab-bare-source-parsing/README.md` is
  untouched -- it stays a frozen record of what was investigated and concluded at the time.
- Exactly one tracked file changed. No source change, no test change.
</success_criteria>

<output>
Create `.planning/quick/260814-fqf-correct-backlog-md-item-srcp-01-based-on/260814-fqf-SUMMARY.md` when done.

Call out in the SUMMARY that SRCP-02's `Direction for later` text was restated (not left
byte-identical) because the removed SRCP-01 sentence was its antecedent -- so the operator
can see the one edit that reached beyond SRCP-01 and why it was unavoidable.
</output>
