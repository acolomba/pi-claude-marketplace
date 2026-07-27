# Issue #101 -- Pi-incompatible `SKILL.md` frontmatter: diagnosis and design

Status: diagnosis complete, not implemented. No code changed. Reported by: fank (Florian Kinder). Investigated 2026-07-24.

## Summary

The skills bridge writes `SKILL.md` bytes without ever checking that Pi can parse them. An install reports success; Pi then rejects the generated skill at the next startup and the skill silently does not exist.

The same gap exists in the commands bridge, where the failure is fully silent.

______________________________________________________________________

## Root cause

`prepareStageSkills` treats `SKILL.md` as opaque text:

```text
bridges/skills/stage.ts:161-164
  readFile → rewriteFrontmatterName() → substituteClaudeVars() → writeFile
```

`rewriteFrontmatterName` (`bridges/skills/rewrite-frontmatter.ts:33-42`) is a regex replace on the `name:` line -- it never parses. Discovery (`bridges/skills/discover.ts:56-59`) only checks that `SKILL.md` exists as a regular file. So an install can fail for reasons the bridge invents (RN-6 collisions, path safety, fs errors) but never for *"the consumer cannot read what we just wrote."*

The consumer is strict. Pi's `core/skills.js::loadSkillFromFile` → `utils/frontmatter.js::parseFrontmatter` → `yaml.parse()`, which throws on a plain (unquoted) scalar containing an unquoted `:` followed by a space:

```text
name: example
description: Use this skill for checks. Triggers on: "test", "lint".
→ YAMLParseError: Nested mappings are not allowed in compact mappings at line 2, column 14
```

Pi catches the throw, downgrades it to a **warning** diagnostic and returns `skill: null`. `orchestrators/discover.ts:99-101` has already handed Pi the path, so the user sees a YAML error at startup and a skill that does not exist.

## Why the gap exists

The agents bridge already solves this class of problem correctly: `bridges/agents/frontmatter.ts` parses source frontmatter with a parser mirroring the consumer's (pi-subagents' line-based reader) and **re-emits** every scalar through `emitYamlScalar`, so what lands on disk is readable by construction.

The skills bridge never got that treatment. `rewrite-frontmatter.ts:5` records the choice as deliberate ("Pure string manipulation -- no YAML parsing, no eval") for injection-safety (T-03-17). That reasoning conflates two concerns: injection-safety says *don't evaluate untrusted input*; output-validity says *don't emit bytes your consumer will reject*. The current code buys the first at the cost of the second -- for the one component kind whose consumer is strictest (real YAML vs. line-based).

______________________________________________________________________

## Blast radius

| kind               | exposed?                                                   | symptom                                                                                                                                 |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| skills             | yes                                                        | Pi warning at startup; skill absent                                                                                                     |
| commands / prompts | yes -- `bridges/commands/stage.ts:159-160` copies verbatim | **fully silent**: `core/prompt-templates.js::loadTemplateFromFile` wraps everything in `try { … } catch { return null }`, no diagnostic |
| agents             | no                                                         | round-tripped through `emitYamlScalar`; AG-6 contract tolerates `:` in values                                                           |

Two adjacent members of the same family (bridge reports success, Pi rejects at load):

- **Missing `description`** -- Pi returns `skill: null` when absent or empty. `rewrite-frontmatter.ts:22-23` *manufactures* this case: it synthesizes a frontmatter block containing only `name:` when the source has none.
- **Silent name corruption** -- a multi-line `name:` has only its first line replaced. Verified: `name: >\n  my\n  skill` → `name: acme-skill my skill`. Still valid YAML, so no error anywhere; Pi's `validateName` warns, the skill loads under a name that is not the generated one, `/skill:<generated-name>` does not resolve, and RN-6's uniqueness guarantee no longer holds on disk.

## Prevalence

Scanned the 190 `SKILL.md` under `~/.claude`: **2 fail Pi's parser**, 1 has no usable frontmatter. Both failures are in the maintainer's own marketplace (`acolomba-claude-plugins`): `stocks/skills/stocks-murphy-technical-analysis` and `llm-wiki/skills/llm-wiki-scaffold`. Offending prose:

> `… Runs Murphy-style technical analysis: trend (Dow Theory), support/resistance, …`

An unquoted `:` followed by a space mid-sentence. Commands corpus: 0/84 locally -- the code gap is identical, but command descriptions are short, whereas skills' trigger-prose is what hits it.

______________________________________________________________________

## Upstream: how Claude Code actually parses this

Verified directly; do not re-derive (Claude Code ships as a compiled binary, not an npm package).

**Parser: js-yaml, strict -- Claude Code is NOT lenient.** Fingerprinted `~/.local/share/claude/versions/2.1.212`:

| signature                                              | hits |
| ------------------------------------------------------ | ---- |
| js-yaml (`bad indentation of a mapping entry`, …)      | 1    |
| `yaml` / eemeli (`Nested mappings are not allowed`, …) | 0    |
| gray-matter                                            | 0    |

js-yaml rejects the same input Pi rejects:

```text
description: Runs analysis: trend and volume.     → FAIL bad indentation of a mapping entry (2:27)
description: Use for checks. Triggers on: "test". → FAIL bad indentation of a mapping entry (2:41)
```

**Failure policy is the real divergence** -- code.claude.com/docs/en/skills.md, verbatim:

> "If the frontmatter YAML is malformed, Claude Code loads the skill body with empty metadata, so `/skill-name` still works but Claude has no `description` to match against. Run with `--debug` to see the parse error."

|              | parse           | on failure                                                                            |
| ------------ | --------------- | ------------------------------------------------------------------------------------- |
| Claude Code  | js-yaml, strict | body loads, metadata empty, `/name` works, no auto-invoke; error only under `--debug` |
| Pi           | `yaml`, strict  | empty description ⇒ `skill: null`, skill gone; warning at startup                     |
| bridge today | none            | reports success, defers to Pi                                                         |

**Consequence:** the two offending plugins are broken in Claude Code too -- their descriptions have always been empty there, so Claude never auto-invokes them. Neither host tells the plugin author, which is why the defect ships into published marketplaces.

**Field contract:** `description` is *Recommended*, not required -- "If omitted, uses the first paragraph of markdown content." `when_to_use` is a Claude Code extension appended to `description` in the listing; combined text truncated at 1,536 chars. Pi requires a non-empty `description`, so a spec-conformant description-less Claude skill silently vanishes in Pi.

______________________________________________________________________

## Design

### Rejected: quote repair

An earlier proposal parsed leniently and re-quoted only the offending top-level plain scalars, then verified. It measured well (2 fixed, 187 byte-identical, 0 regressions on the corpus) but was rejected: it rewrites third-party content -- which the issue author explicitly flagged as undesirable -- and adds a heuristic to maintain and test for inputs outside the sampled corpus.

Also rejected: whole-block re-emit in the agents-bridge style. Skills' target format is real YAML with real structure, and flattening it would damage ~13% of real skills (19/190 nested maps or lists, 6 block scalars, 2 flow collections, 24 continuation lines). The agents bridge gets away with it only because pi-subagents' target format is flat.

### Chosen: mirror Claude Code's behavior via Pi's own machinery

Literal parity fails. Claude Code's "empty metadata" leaves `/skill-name` working; in Pi, empty metadata means the skill does not exist (the `!frontmatter.description` guard returns `skill: null` before the skill object is built). Same mechanism, opposite outcome.

Claude Code's observable behavior decomposes into two properties -- **(a)** invocable by name, **(b)** never auto-invoked, because there is no description to match. Pi has a first-class field for exactly that pair:

```js
// pi-coding-agent core/skills.js
disableModelInvocation: frontmatter["disable-model-invocation"] === true
```

`formatSkillsForPrompt` filters those out, with Pi's own comment: *"they can only be invoked explicitly via /skill:name commands."*

So on unparseable frontmatter, replace the block -- **body untouched** -- with:

```yaml
---
name: <generated-name>
description: <plugin> skill "<source>" -- source frontmatter could not be parsed.
disable-model-invocation: true
---
```

`/skill:<generated-name>` works, the model never auto-invokes it, and because disabled skills are excluded from the listing the placeholder description costs zero context -- it exists only to clear Pi's non-empty gate.

This mutates metadata we could not read, not the author's values, and does not hard-fail: a one-bad-skill plugin still installs.

### Work items

| item                                                             | notes                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| strict-parse gate on **staged** bytes                            | post-substitution, so a `${CLAUDE_PLUGIN_ROOT}` expansion that breaks YAML is also caught. Seams: `skills/stage.ts:163-164`, `commands/stage.ts:159-160`                                                                                   |
| use Pi's own `parseFrontmatter`                                  | public root export (`dist/index.d.ts:29`); import via the existing `platform/pi-api.ts` boundary for byte-identical accept/reject semantics. **Verify** it was already exported at the declared peer floor `>=0.74.0` (dev dep is 0.79.10) |
| unparseable → synthesized `disable-model-invocation` frontmatter | body preserved verbatim                                                                                                                                                                                                                    |
| install-time warning row                                         | names the source skill and the parse error -- the `--debug` analog, surfaced rather than hidden. Satisfies the issue's core ask                                                                                                            |
| `name` must equal generated name post-rewrite                    | catches the folded-scalar corruption                                                                                                                                                                                                       |
| absent `description` → first-paragraph fallback                  | separate case; genuine parity; skill stays fully model-invocable                                                                                                                                                                           |
| commands bridge                                                  | same seam, same helper                                                                                                                                                                                                                     |

Files that already parse and already satisfy Pi's load requirements are written **verbatim** -- no rewriting, no behavior change for the ~99% that work today.

### Classification

A malformation of a *supported* component, not an unsupported kind -- so failure-class, not soft-degrade. Precedent: `malformed mcp` (MCPR-03 / D-02) at `shared/notify-reasons.ts:110-113`, which files a broken `mcpServers` string reference under `FAILURE_REASONS` and comments explicitly that it does **not** belong in `UNSUPPORTED_REASONS` for exactly this reason. `"unparseable"` already exists in the closed set; a dedicated token paralleling `malformed mcp` would be an OUT-08 catalog amendment (the `REASONS` tuple must stay byte-stable).

### Open questions

1. Placeholder description: fixed string, or does it name the parse error? Leaning fixed and short, with the parse error carried by the install-time warning where it is actionable.
2. `when_to_use` is a Claude Code extension appended to `description` in the listing. Pi does not know the field, so that text is currently lost. Adjacent; decide separately.
