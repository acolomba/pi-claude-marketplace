No external API integration: the phase changes the local agents bridge, two orchestrator call sites, and the cucumber agent features, and tests them with local stand-ins (a scripted faux model, a local marketplace, pi-subagents from the optional peer cache); it adds no external service.

## Edge coverage (spec-less probe fallback)

Source: the deterministic edge probe over AGT-01..AGT-07 and XK-01 (no phase SPEC, so
`EDGE_ABSENT=1` and `PROHIB_ABSENT=1`). The probe reported 13 applicable items,
0 resolved, 13 unresolved, 6 unclassified. Every item is accounted for below:
an explicit truth in a plan's `must_haves.truths`, a structured backstop marker
(`verification: backstop`), or a flagged assumption in the plan's "Flagged
assumptions" section. None is dropped or dismissed.

| requirement | probe category | resolution | where |
|---|---|---|---|
| AGT-01 | adjacency | explicit truth: a nested `review/security.md` and a flat `review-security.md` flatten to one generated name; the nested file is kept and the flat one reported; two plugins' same-name agents list separately | 04-01 truths; Task 2 scenario (i), Task 1 scenario (d) |
| AGT-01 | empty | explicit truth: an agent with no description is listed as `Agent from demo plugin`; an empty list reads `Executable agents:` then `- (none)` | 04-01 truths; 04-04 truths |
| AGT-01 | encoding | explicit truth: `.md` matched case-insensitively, only a lower-case `.md` stripped, generated names compared byte for byte | 04-01 truths; Task 2 unit rows and scenario (f) |
| AGT-01 | ordering | explicit truth: each folder read in `localeCompare` order, depth first, interleaved; list scenarios compare pi-subagents' whole output in its order | 04-01 truths; Task 2 unit rows |
| AGT-01 | concurrency | backstop: discovery only reads; staging and commit roll back under the state lock; existing rollback and state-lock pins | 04-01 truths (backstop marker) |
| AGT-02 | unclassified | flagged assumption: the child's tools hold pi-subagents' runtime tools; the `--map-model` run can only show the unknown-model error | 04-02 and 04-05 flagged assumptions |
| AGT-03 | unclassified | flagged assumption: `[1m]` stripped from every alias, the full-ID pass-through refuses `:` and whitespace, `thinking` matched exactly, integer effort dropped, `Tool(spec)` loses its spec | 04-02 flagged assumptions |
| AGT-04 | unclassified | flagged assumption: closes on the recorded D-CF4-10 gap | 04-05 flagged assumptions; 04-06 closing record |
| AGT-05 | unclassified | flagged assumption (research A6): a new profile Pi with the companion stands in for loading it and running `/reload` | 04-03 flagged assumptions |
| AGT-06 | unclassified | flagged assumption: the untrusted default-scope run is not pinned (repository path); the trust-blind list is a defect report | 04-03 flagged assumptions |
| AGT-07 | idempotency | backstop: repeated disable or enable is skipped; lifecycle features pin it | 04-04 truths (backstop marker) |
| AGT-07 | concurrency | backstop: verbs run under the state lock and roll back; lifecycle features and the concurrent-install integration test pin it | 04-04 truths (backstop marker) |
| XK-01 | unclassified | flagged assumption: `$ARGUMENTS` and inline `!` commands stay literal, no cross-plugin fallback or frontmatter-name lookup, a colon-repaired source is skipped, the source can differ from the staged copy | 04-05 flagged assumptions |

**Tally:** 13 applicable = 4 explicit truths + 3 backstop markers + 6 flagged
assumptions (the six unclassified rows). No-silent-drop equality holds: 13
surfaced, 13 authored or flagged.

## Prohibitions (spec-less recall)

Recall ran per requirement in the planner prompt (no compiled engine). Kept
prohibitions are authored descriptor-less in each plan's
`must_haves.prohibitions` (no `check_*` field), so each disposes
flagged-unverified downstream:

| requirement | prohibition | plan |
|---|---|---|
| AGT-01 | MUST NOT drop a plugin agent without telling the user (a flattened duplicate is named in the diagnostic) | 04-01 |
| AGT-03 | MUST NOT silently drop a plugin agent field Claude Code reads | 04-02 |
| AGT-02 | MUST NOT run a bridged agent in the background when neither its source nor the call asks for it | 04-02 |
| AGT-06 | MUST NOT write a project-scope plugin's agents where pi-subagents reads user agents to get past project trust | 04-03 |
| AGT-06 | MUST NOT pin pi-subagents' trust-blind list as desired behavior | 04-03 |
| AGT-05 | MUST NOT fail or block an install because pi-subagents is missing | 04-03 |
| AGT-07 | MUST NOT leave a disabled or uninstalled plugin's agent in pi-subagents' list | 04-04 |
| XK-01 | MUST NOT put a skill the author kept from the model into an agent's prompt | 04-05 |
| XK-01 | MUST NOT run a preloaded skill's inline `!` commands | 04-05 |
| AGT-04 | MUST NOT ship a scenario that launches a background agent run | 04-05 |

Dropped as routine engineering (owned by the edge probe or code review): the
list's correctness itself (AGT-01), the conversion table values (AGT-03), the
lifecycle verbs' own correctness (AGT-07). Canon referral, not minted: path
traversal through nested folder names and symlinks (OWASP path traversal) is
covered by `/gsd-secure-phase` and the threat models (T-04-01, T-04-02, T-04-15).
