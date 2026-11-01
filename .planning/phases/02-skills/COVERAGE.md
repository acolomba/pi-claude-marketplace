No external API integration: the phase changes the local skills bridge and Pi input handling and tests them with local stand-ins (a scripted faux model, a local marketplace); it adds no external service.

## Edge coverage (spec-less probe fallback)

Source: the deterministic edge probe over SKL-01..SKL-06 (no phase SPEC, so
`EDGE_ABSENT=1` and `PROHIB_ABSENT=1`). The probe reported 14 applicable items,
0 resolved, 14 unresolved, 2 unclassified. Every item is accounted for below:
an explicit truth in a plan's `must_haves.truths`, a structured backstop marker
(`verification: backstop`), or a flagged assumption in the plan's "Flagged
assumptions" section. None is dropped or dismissed.

| requirement | probe category | resolution | where |
|---|---|---|---|
| SKL-01 | adjacency | explicit truth: a 100-character first line is listed whole, a 101-character one as 97 characters plus `...` | 02-01 truths; Task 2 Outline rows |
| SKL-01 | empty | explicit truth: a body with no non-blank line is listed as `Plugin skill` | 02-01 truths; Task 2 Outline row |
| SKL-01 | encoding | backstop: length in UTF-16 code units, as Claude Code's `A2e`; frozen core unit test | 02-01 truths (backstop marker) |
| SKL-01 | ordering | explicit truth: the listing compares the whole skill set in Pi's `get_commands` order | 02-01 truths |
| SKL-02 | adjacency | backstop: a field present with an empty or null value is reported (`Object.keys`); frozen core unit test | 02-02 truths (backstop marker) |
| SKL-02 | empty | explicit truth: no listed field gives no line; the four never-reported fields give no line | 02-02 truths; Task 2 negative control |
| SKL-02 | encoding | flagged assumption: field names match case-sensitively, as Claude Code's keys (not probed) | 02-02 flagged assumptions |
| SKL-02 | ordering | explicit truth: fields listed in frontmatter key order | 02-02 truths; Task 2 scenario |
| SKL-03 | unclassified | flagged assumption: `""` for no arguments, trimmed arguments, empty-body framing, read errors propagate | 02-03 flagged assumptions |
| SKL-04 | empty | explicit truth: no matching command or no commands directory shadows no skill | 02-04 truths; Task 1 negative control |
| SKL-04 | encoding | flagged assumption (research A4): command names `<plugin>:<basename>` unnormalized, exact comparison | 02-04 flagged assumptions |
| SKL-05 | unclassified | flagged assumption: built-in-name residual, cross-plugin bare-alias order, case-sensitive names, qualified-only autocomplete | 02-06 flagged assumptions |
| SKL-06 | idempotency | backstop: repeated disable or enable is skipped; lifecycle features pin it | 02-05 truths (backstop marker) |
| SKL-06 | concurrency | backstop: verbs run under the state lock and roll back; lifecycle features and the concurrent-install integration test pin it | 02-05 truths (backstop marker) |

**Tally:** 14 applicable = 6 explicit truths + 4 backstop markers + 4 flagged
assumptions (2 of them the unclassified SKL-03 and SKL-05 rows). No-silent-drop
equality holds: 14 surfaced, 14 authored or flagged.

## Prohibitions (spec-less recall)

Recall ran per requirement in the planner prompt (no compiled engine). Kept
prohibitions are authored descriptor-less in each plan's
`must_haves.prohibitions` (no `check_*` field), so each disposes
flagged-unverified downstream:

| requirement | prohibition | plan |
|---|---|---|
| SKL-02 | MUST NOT silently ignore a skill frontmatter field Pi cannot honor | 02-02 |
| SKL-03 | MUST NOT run a plugin skill's `!` command for input the user did not type | 02-03 |
| SKL-03 | MUST NOT send the model any part of a skill invocation that failed | 02-03 |
| SKL-04 | MUST NOT drop a user's skill without telling them | 02-04 |
| SKL-05 | MUST NOT let a skill alias take a name a Pi command of another source already has | 02-06 |

Dropped as routine engineering (owned by the edge probe or code review): the
listing's correctness itself (SKL-01), removal after a verb (SKL-06). Canon
referral, not minted: argument injection into shell commands (OWASP injection)
is covered by `/gsd-secure-phase` and the threat models (T-02-08 carries
T-01-22).
