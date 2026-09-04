---
spike: 008
idea: claude-workflows-bridge
name: workflow-demand-signal
type: standard
validates: "Given real Claude Code plugins and marketplaces in the wild, when scanned for a `workflows/` directory or a `workflows` manifest field, then determine whether anyone actually ships the component kind yet"
verdict: VALIDATED
related: [004]
tags: [claude-code, workflows, demand-signal, research]
---

# Spike 021: workflow-demand-signal

## What This Validates

Given real Claude Code plugins and marketplaces in the wild, when scanned for a
`workflows/` directory or a `workflows` manifest field, then determine whether
anyone actually ships the component kind yet.

This is the cheapest kill-shot for the `claude-workflows-bridge` idea. Backlog
WFLW-01 records that `domain/resolver.ts` recognizes `workflows` in neither
`SUPPORTED_COMPONENT_KINDS` nor `UNSUPPORTED_COMPONENT_KINDS`, so a plugin
declaring it is silently ignored. If nothing in the wild ships the kind, the
correct answer is the mechanical closed-set fix and the remaining spikes
(009-011, bridging it for real) are moot.

## Research

### Upstream contract (primary source)

`code.claude.com/docs/en/plugins-reference` and `code.claude.com/docs/en/workflows`,
fetched directly:

- `workflows` is `string|array` in the manifest: "Custom workflow script files
  or directories, **replaces** default `workflows/`".
- Distribution: "Place the script in a `workflows/` directory at the plugin
  root, or point to a different location with the `workflows` manifest field."
- Plugin workflows are namespaced by plugin name: a plugin `acme-tools` with a
  script whose `meta.name` is `release-audit` runs as `/acme-tools:release-audit`.
- Script contract: plain `.js`, `export const meta = { name, description }`
  (optionally `whenToUse`, `phases: [{title, detail}]`), then a JS body with
  top-level `await` and a trailing `return`. Injected globals: `agent()`,
  `parallel()`, `pipeline()`, `phase()`, `log()`, `args`, `budget`.
- Runtime constraints upstream: no `import()` (a script containing it fails
  before the run starts), no direct filesystem or shell access from the script
  itself, <=16 concurrent agents, 1000 agents per run.
- Requires Claude Code v2.1.154+.

### Search method, and the false start that shaped it

The obvious query is the manifest field. It does not work:

```text
gh api search/code -f q='"workflows" filename:plugin.json path:.claude-plugin'
-> total_count: 1248
```

Sampling six of those hits (`MiniMax-AI/skills`, `BuilderIO/skills`,
`figma/mcp-server-guide`, `classmethod/tsumiki`, `strands-agents/agent-sop`,
`czlonkowski/n8n-skills`) and parsing each `plugin.json`: **zero** had a
`workflows` key. GitHub code search matched the word "workflows" inside
`description` and `keywords` prose. The 1248 is noise.

The query that works searches for the **script contract signature** instead --
`export const meta` inside a `workflows/` path -- then classifies each distinct
repo by whether it has a `.claude-plugin/plugin.json` at all. That is what
`scan.sh` implements.

## How to Run

```bash
cd .planning/spikes/021-workflow-demand-signal
./scan.sh              # PAGES=4 by default (100 code-search results)
PAGES=8 ./scan.sh      # widen the sample
```

Requires an authenticated `gh`, `python3`, and `curl`. Code search is rate
limited to 10 requests/minute, hence the sleeps between pages.

## What to Expect

A per-repo classification table and a summary counting Claude plugins that ship
`workflows/`, split by whether they declare the manifest field or rely on the
default convention scan.

## Investigation Trail

1. **Fetched the upstream contract first** (per the spike-004 convention:
   primary sources, not search summaries). Established that a plugin may ship
   workflows *either* by manifest field *or* by the default `workflows/`
   convention -- which turned out to be the whole finding.
2. **Searched by manifest field. Over-matched at 1248 hits.** Sampled six and
   found zero real field declarations. Discarded the query rather than
   reporting the number.
3. **Re-searched by script contract signature** (`"export const meta" path:workflows`)
   -- 680 hits. Sampled 44 distinct repos across 4 pages.
4. **Classified each repo** by presence of `.claude-plugin/plugin.json`.
   16 of 44 are real Claude plugins; 28 are loose script collections, dotfiles,
   or harnesses that are not installable plugins.
5. **Checked how the 16 declare the kind.** All 16 rely on the default
   convention scan. Not one declares the manifest field. This inverted the
   expected shape of the fix, so it was worth verifying against real scripts
   rather than trusting the classifier.
6. **Pulled two actual scripts** to confirm they are genuinely Claude-contract
   and not some other tool's `workflows/` directory:
   - `boshu2/agentops/workflows/rpi.js` opens with
     `export const meta = { name, description, whenToUse, phases: [{title, detail}] }`
     -- the exact upstream shape including the optional fields.
   - `Spark-To-Paper-Skills/paperjury/workflows/drafter.workflow.js` carries the
     comment *"The Workflow sandbox cannot write files, so the drafter only
     PROPOSES a patch {before, after}; the ORCHESTRATOR applies it"*. A real
     plugin author writing against Claude's no-filesystem sandbox guarantee.
7. **Traced the finding into our own resolver** to see whether the "mechanical
   fix" WFLW-01 describes would actually catch these plugins.

## Results

**VERDICT: VALIDATED.** The component kind is really shipped, by real plugins,
today.

### Demand is real

| Measure | Count |
| --- | --- |
| Code-search hits for the script contract in a `workflows/` path | 680 |
| Distinct repos sampled | 44 |
| **Real Claude plugins shipping `workflows/`** | **16** |
| ... declaring the `workflows` manifest field | **0** |
| ... relying on the default `workflows/` convention scan | **16** |
| Script collections that are not installable plugins | 28 |

The 16: `AnastasiyaW/codex-claude-code-config`, `bitcraft-apps/spec-first`,
`boshu2/agentops`, `briannaworkman/pitcrew`, `cou723/issue_loop`,
`ghostshift-content/ARCHON`, `liatrio-labs/claude-code-gauntlet`,
`luisgui1757/helix-cc`, `micherra/canon`, `oeftimie/vv-claude-harness`,
`pjt222/agent-almanac`, `richkuo/rk-skills`, `sehoon787/my-claude`,
`Spark-To-Paper-Skills/paperjury`, `ysyecust/everything-claude-code`,
`YuanpingSong/ultracodex`.

### The surprise: WFLW-01's stated fix would detect none of them

The backlog item proposes "add `workflows` to `UNSUPPORTED_COMPONENT_KINDS` (the
mechanical fix that restores the closed-set guarantee)". Against this data, that
alone catches **0 of 16** real-world plugins, because none declares the field.

`domain/resolver.ts`'s `collectUnsupportedKinds` (line 517) already gates on
both axes:

```ts
for (const kind of UNSUPPORTED_COMPONENT_KINDS) {
  if (declaresUnsupportedKind(kind, entry, manifest)) { found.push(kind); continue; }
  if (await hasUnsupportedConvention(ctx, pluginRoot, kind)) { found.push(kind); }
}
```

So the house machinery is already the right shape -- but the convention half is
driven by a *separate* table, `UNSUPPORTED_COMPONENT_CONVENTIONS` (line 365),
which is `Partial<Record<...>>` and currently has no `workflows` entry. The fix
is therefore **two** additions, not one:

```ts
// domain/resolver.ts:354
export const UNSUPPORTED_COMPONENT_KINDS = [..., "workflows"] as const;

// domain/resolver.ts:365
const UNSUPPORTED_COMPONENT_CONVENTIONS = {
  ...,
  workflows: [{ relativePath: "workflows", kind: "dir" }],
};
```

Only the second one moves the needle on anything shipping today. This mirrors
how `themes` (`themes` dir) and `outputStyles` (`output-styles` dir) are already
handled, so it is a table entry, not new machinery.

### Signal for the remaining spikes

- The idea survives. 009-011 are not moot.
- Because adoption runs through the convention directory rather than the
  manifest field, any future *bridge* must discover `<pluginRoot>/workflows/**`
  by convention too, exactly as the skills/commands/agents bridges already do
  for their own default directories.
- The paperjury comment is direct evidence for spike 022's premise: script
  authors write against Claude's sandbox guarantee ("cannot write files"). The
  question of what happens to that assumption under a Pi engine with full Node
  access is a real one, and now demonstrably not hypothetical.

### Caveats bounding this result

- GitHub code search returns a relevance-ranked sample, not an exhaustive
  index; 44 repos out of 680 hits is a sample, so the 16/44 ratio is
  indicative, not a census. The `PAGES` env var widens it.
- Code search covers public, indexed repositories only. Private and
  enterprise plugins are invisible to this method.
- "Not a plugin" here means "no `.claude-plugin/plugin.json` on `main` or
  `master`". A repo using a non-default branch would be misclassified; none
  was spot-checked to be.
