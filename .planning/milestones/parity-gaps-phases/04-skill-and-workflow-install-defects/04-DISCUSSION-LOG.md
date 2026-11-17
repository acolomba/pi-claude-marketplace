# Phase 4: Skill and Workflow Install Defects - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-11-13
**Phase:** 04-skill-and-workflow-install-defects
**Areas discussed:** Root-source skill selection, Sibling skill links, Workflow references, Workflow agent tool restriction
**Mode:** autonomous smart discuss. The user said "just go ahead without asking me", so no question was asked. Each question that smart discuss would ask took its recommended answer, marked **pending maintainer review**.

---

## Root-source skill selection (PG-CORE-01)

### Q1 (hard to reverse): Which rule selects the skills of a root-source entry that lists `skills`?

| Option | Description | Selected |
|--------|-------------|----------|
| Exact 2.1.323 rule | String source with all-empty or `.` segments plus non-empty `skills`. Listed paths replace `skills/` and the manifest paths. `skills/` stays only when it is listed or the root is listed. Only traversal refusals: no skills. Nothing valid and no traversal: normal rule. | ✓ |
| Simplified rule | Same rule, but when nothing valid remains, install no skills in every case | |
| Also object-form path sources | Apply the rule to `{source: "path"}` objects that resolve to the root | |

**Choice:** Exact 2.1.323 rule. **Pending maintainer review.**
**Notes:** Upstream parity is the default. The odd fallback (no valid path and no traversal falls back to the whole folder) is kept, because "upstream looks wrong" is not a license to diverge. It amends D-CF1-06.

### Q2 (product): What happens to plugins that are already installed with the extra skills?

| Option | Description | Selected |
|--------|-------------|----------|
| Next update or reinstall | The existing `previousSkillNames` unstage path removes them. No load-time change (APL-D1). CHANGELOG tells users to reinstall. | ✓ |
| Load-time warning | The load names the stale skills and suggests `reinstall`. This adds a new notice and a new resolution pass at load. | |
| Apply convergence detects drift | `apply` compares the resolved skill set with the record and re-materializes. This adds a new drift class. | |

**Choice:** Next update or reinstall. **Pending maintainer review.**
**Notes:** Matches the ROADMAP note. Research item: whether `update` sees an entry-only `skills` change in `marketplace.json`.

### Q3 (reversible): Do plugins that share one `skills/` folder get de-duplicated?

Decided autonomously: no. Each plugin installs its own listed skills under its own prefix.

---

## Sibling skill links (PG-SKILL-04)

### Q1 (reversible): How is a sibling link recognized?

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve by source path | Resolve a `../` token against the file's source location. Rewrite only when it lands in a discovered sibling skill folder. | ✓ |
| Match folder names | Rewrite `../<folder>/` when `generatedSkillName(plugin, folder)` is staged | |

**Choice:** decided autonomously, resolve by source path. It handles subfolders and declared skill paths outside `skills/`.

### Q2 (reversible): Where in the text are paths rewritten?

Decided autonomously: everywhere in staged `SKILL.md` and supporting `.md`, including code spans and fences, before `${CLAUDE_*}` substitution. `${CLAUDE_SKILL_DIR}/../b/` is included.

### Q3 (reversible): What happens to paths outside a sibling skill?

Decided autonomously: they are left unchanged. That covers `../../docs`, an unstaged sibling, and `${CLAUDE_PLUGIN_ROOT}` paths.

### Q4 (reversible): How does the staging context get the sibling map?

Decided autonomously: the orchestrators that build `InstalledReferenceNames` pass a map from source folder to generated name. The record-only fallback leaves sibling paths alone.

---

## Workflow references (PG-WF-01)

### Q1 (reversible): What does a workflow reference become?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the source's slash state | Bare in the source stays bare; a slash in the source keeps the slash | ✓ |
| Bare only inside tool-call syntax | Detect `Workflow({ name: ... })` and `Workflow(...)`, and keep adding `/` in prose | |

**Choice:** decided autonomously, keep the source's slash state. This is the requirement's wording, upstream leaves the text as written, and it needs no syntax detection.

### Q2 (reversible): Does any existing fixture depend on bare-to-slash?

Decided autonomously: no cucumber fixture does. Two unit tests in `test/domain/skill-tokens.test.ts` do, and they change to expect the bare name.

### Q3 (reversible): Documentation correction

Decided autonomously: correct `docs/workflows-compatibility.md:174` and name the §8.4 residuals.

---

## Workflow agent tool restriction (PG-SEC-01)

### Q1 (reversible): What triggers the note?

Decided autonomously: an admitted script with a literal `agentType` that names an agent of the same plugin, where the agent's source declares a non-empty `tools` or `disallowedTools`. The note appears whether or not the agent was staged. A non-literal `agentType` or an agent of another plugin gives no note.

### Q2 (product): Wording and granularity of the note

| Option | Description | Selected |
|--------|-------------|----------|
| One note per (script, agent type) pair, naming the reachable built-ins | `workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write` | ✓ |
| One note per script listing all agent types | Shorter, but harder to match with PG-WF-02's per-name notes | |
| One plugin-level note | Least noise, but the script and the agent are lost | |

**Choice:** one note per pair. **Pending maintainer review.**

### Q3 (reversible): Where are the notes computed?

Decided autonomously: a domain helper extracts `agentType` literals, an orchestrator joins them with agents discovery, and the notes travel in `discoveryWarnings`. They are recomputed for `info` and never persisted.

### Q4 (reversible): Upstream request

Decided autonomously: draft `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md` in the existing draft shape, for the maintainer to file. A patch is optional.

---

## Decided autonomously

[auto] [Root-source skill selection] — Q: "Do plugins sharing one skills folder get de-duplicated?" → Selected: "No; each plugin installs its own listed skills under its own prefix" (reversible technical — decided autonomously: no persisted data; matches upstream per-plugin loading)
[auto] [Sibling skill links] — Q: "How is a sibling link recognized?" → Selected: "Resolve ../ tokens against the source file location; rewrite only into a discovered sibling skill folder" (reversible technical — decided autonomously: one pure function)
[auto] [Sibling skill links] — Q: "Where in the text are paths rewritten?" → Selected: "Everywhere in staged SKILL.md and supporting .md, before variable substitution, including ${CLAUDE_SKILL_DIR}/../" (reversible technical — decided autonomously: staged copies are rebuilt on reinstall)
[auto] [Sibling skill links] — Q: "What happens to paths outside a sibling skill?" → Selected: "Left unchanged" (reversible technical — decided autonomously: same as today)
[auto] [Sibling skill links] — Q: "How does staging get the sibling map?" → Selected: "Orchestrators pass a source-folder-to-generated-name map beside InstalledReferenceNames" (reversible technical — decided autonomously: internal type)
[auto] [Workflow references] — Q: "What does a workflow reference become?" → Selected: "Keep the source's leading-slash state" (reversible technical — decided autonomously: one line in rewriteMarkdownReferences)
[auto] [Workflow references] — Q: "Does any existing fixture depend on bare-to-slash?" → Selected: "No cucumber fixture; two unit tests change" (reversible technical — decided autonomously: test expectations only)
[auto] [Workflow references] — Q: "Documentation correction" → Selected: "Correct workflows-compatibility.md:174 and name the 8.4 residuals" (reversible technical — decided autonomously: documentation)
[auto] [Workflow agent tool restriction] — Q: "What triggers the note?" → Selected: "Literal agentType naming a same-plugin agent with a non-empty tools or disallowedTools field" (reversible technical — decided autonomously: advisory note, never refuses)
[auto] [Workflow agent tool restriction] — Q: "Where are the notes computed?" → Selected: "Domain helper plus orchestrator join, carried in discoveryWarnings, recomputed and not persisted" (reversible technical — decided autonomously: no schema change)
[auto] [Workflow agent tool restriction] — Q: "Upstream request" → Selected: "Draft under .planning/upstream/ in the existing shape for the maintainer to file" (reversible technical — decided autonomously: an unfiled draft)
[auto] [Behavioral evidence] — Q: "What tests prove each requirement?" → Selected: "One failing-without-change cucumber scenario per requirement plus owner unit tests for edge arms, in a hermetic home" (reversible technical — decided autonomously: test approach)

## Claude's Discretion

Token grammar, internal type names, final documentation wording within the stated content, whether the upstream draft carries a patch, and plan splits.

## Deferred Ideas

Paths that climb to the plugin root. Version-gating the PG-SEC-01 note after an engine fix. Keeping command and skill references bare in tool calls. PG-WF-02, WF-03, and WF-05. The other §8.4 engine requests.
