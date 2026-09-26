---
spike: 013
idea: claude-workflows-bridge
name: meta-name-extraction
type: standard
validates: "Given a Claude workflow script, when meta.name is extracted statically with acorn rather than by regex or filename, then confirm it survives comment/string decoys, reports its failure modes precisely, and matches upstream's command naming on real plugin scripts"
verdict: ✓ VALIDATED
related: ["008", "011", "012"]
tags: [pi-extension, workflows, naming, parser, prototype]
---

# Spike 026: meta-name-extraction

## What This Validates

Operator decision (2026-08-14): derive a bridged workflow's command name from
**`meta.name` inside the script**, parsed with acorn, rather than from the
filename stem.

Claude Code names a plugin workflow `/<plugin>:<meta.name>` -- the filename
plays no part. Every bridge in this repo names from the filename
(`generatedCommandName(plugin, source)` with `source` a file stem). This spike
measures how often that diverges in the wild, and de-risks the extraction the
decision now requires.

## Research

The name is the whole artifact contract: the envelope's `name` field becomes
both the saved filename stem and the argument to `pi.registerCommand(wf.name)`,
i.e. the command the user types (spike 023). Nothing else reads it, so whatever
the bridge writes there is the name -- there is no second chance to correct it.

**Divergence is per-plugin convention, not noise.** Measured across the two
plugins from spike 021 that ship the most workflows:

| Plugin | file | stem | `meta.name` | |
| --- | --- | --- | --- | --- |
| agentops | `rpi.js` | `rpi` | `rpi` | match |
| agentops | `implement-wave.js` | `implement-wave` | `implement-wave` | match |
| agentops | `bdd-foundry.js` | `bdd-foundry` | `bdd-foundry` | match |
| paperjury | `drafter.workflow.js` | `drafter.workflow` | `drafter` | **DIVERGES** |
| paperjury | `review-panel.workflow.js` | `review-panel.workflow` | `review-panel` | **DIVERGES** |
| paperjury | `merge.workflow.js` | `merge.workflow` | `merge` | **DIVERGES** |

agentops names files `<meta.name>.js`, so they agree. paperjury uses a
`<name>.workflow.js` suffix, so *every* one diverges. It is all-or-nothing per
plugin: filename naming would misname six of six paperjury commands
(`/paperjury:drafter.workflow` instead of `/paperjury:drafter`), and the
plugin's own README would document names that do not work.

It would not error, either: a dot passes both our `assertSafeName` and their
`isSafeSavedWorkflowName`, so the wrong name installs silently.

## How to Run

```bash
node extract.mjs                  # built-in case table, acorn vs regex
node extract.mjs <file.js> ...    # extract from real workflow scripts
```

Needs `acorn` resolvable. It is already present transitively (via eslint), but
**is not a declared runtime dependency** -- `dependencies` is currently
`isomorphic-git`, `proper-lockfile`, `write-file-atomic`. A bridge must declare
it, making it the fourth.

## Investigation Trail

1. **Measured the divergence rate before designing anything**, using the real
   plugin corpus from spike 021 rather than hypotheticals.
2. **Wrote the extractor as a static AST walk** -- `ExportNamedDeclaration` ->
   `VariableDeclaration` -> declarator named `meta` -> `ObjectExpression` ->
   property `name` -> string `Literal`. No evaluation: the script is untrusted
   third-party code and must never run at install time.
3. **Built a case table that attacks the extractor**, including the two decoy
   shapes that defeated *both* engines' text-level preprocessors in spike 022:
   a name-like phrase in a comment, and one in a string literal.
4. **Ran the naive regex alongside** as a control, to show the failure concretely
   instead of asserting it.
5. **Enumerated the failure modes** a bridge must handle, rather than only the
   happy path.
6. **Corrected a misleading local result.** The first real-file run reported
   `drafter.js -> match`, because the local copy had been saved without its
   upstream `.workflow` suffix. Re-run against the true filename it reports
   `DIVERGES`. The artifact under test was my fixture, not the plugin.

## Results

**VERDICT: VALIDATED.** Static extraction is correct, and the regex alternative
is demonstrably unsafe.

```text
  case                acorn                         regex
  plain               release-audit                 release-audit
  suffix-style file   drafter                       drafter
  decoy in comment    right-from-ast                WRONG-from-comment   <-- regex WRONG
  decoy in string     right-again                   WRONG-from-string    <-- regex WRONG
  double-quoted key   quoted-key                    (none)
  no meta at all      (no meta declaration)         (none)
  meta without name   (meta has no name property)   (none)
  computed name       (meta.name is not a string literal)  (none)
  syntax error        (unparseable: SyntaxError)    oops
```

Four rows carry the argument:

- **Comment and string decoys.** A header comment mentioning a name silently
  wins under regex. Real Claude scripts carry long explanatory headers -- the
  `meta` declaration in `drafter.workflow.js` starts at **line 26**, after 25
  lines of prose. This is the same defect class that made both engines reject
  valid scripts in spike 022, and it is why "just regex it" is not available.
- **Double-quoted key.** `{"name": "..."}` is valid and the regex misses it
  entirely, returning `(none)` -- a silent fallback rather than a wrong answer,
  but still wrong.
- **Syntax error.** The regex confidently returns `oops` from a file that does
  not parse. acorn reports it as unparseable, which is the only safe answer:
  a script that cannot parse cannot run, and the bridge should refuse it rather
  than install it under a scavenged name.

Against the real scripts:

```text
  rpi.js                stem=rpi               meta.name=rpi        match
  drafter.workflow.js   stem=drafter.workflow  meta.name=drafter    DIVERGES
```

### Failure modes the bridge must handle

The extractor returns a discriminated result rather than a bare string, because
four distinct things can go wrong and they do not all mean the same thing:

| Outcome | Meaning | Suggested handling |
| --- | --- | --- |
| `no meta declaration` | not a Claude workflow, or malformed | skip the file with a warning; do not install |
| `meta has no name property` | `meta` present but nameless | fall back to the file stem |
| `meta.name is not a string literal` | e.g. `name: someVar` -- not statically knowable | fall back to the file stem; never evaluate |
| `unparseable: SyntaxError` | broken script | refuse; it cannot run anyway |

Two of the four fall back to the file stem, so the filename-based path is not
discarded -- it becomes the fallback rather than the primary.

### A collision axis filenames do not have

Filenames are unique within a directory by construction. `meta.name` values are
not: two files in one plugin may both declare `name: 'audit'`. Adopting
`meta.name` therefore introduces a duplicate-name case that needs an explicit
hard error, mirroring `assertNoCommandCollisions` (RN-6) in the commands bridge.
Filename naming would never have surfaced it.

### Cost

One new runtime dependency (`acorn`, 8.16.0, already in the tree transitively
via eslint). It is the same parser `@quintinshaw/pi-dynamic-workflows` uses for
the same job, which is a mild consistency argument.

### Caveats

- The extractor handles the documented contract shape (`export const meta = {}`
  as a top-level object literal) plus a bare `const meta = {}`. Exotic but legal
  forms -- `export { meta }` after a separate declaration, spread properties,
  `Object.assign` -- return a failure result and fall back. That is deliberate,
  but it means "fallback to stem" is a live path, not a theoretical one.
- The divergence measurement covers 6 scripts across 2 plugins, chosen as the
  highest-volume workflow shippers in spike 021's sample. It establishes that
  divergence is real and systematic, not its population rate.
