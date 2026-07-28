# Phase 86: Skill and command frontmatter compliance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 86-skill-and-command-frontmatter-compliance
**Areas discussed:** Reason token, Placeholder description, Warning detail, Self-inflicted staged-parse failure

---

## Reason token (CLASS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-kind: skill + command | Two dedicated tokens (`malformed skill`, `malformed command`) paralleling `malformed mcp`'s per-feature attribution; catalog grows by 2 (OUT-08 amendment, existing 35 keep order). | ✓ |
| Single: malformed frontmatter | One token shared by both bridges; matches CLASS-01's singular wording; catalog grows by 1; doesn't name the component kind. | |
| Reuse existing unparseable | No catalog growth, but drops the per-feature attribution the codebase insists on. | |

**User's choice:** Per-kind: `malformed skill` + `malformed command`
**Notes:** Matches the established pattern of adding dedicated tokens for truthful attribution (`dangling reference`, `authentication required`, `malformed mcp`).

---

## Placeholder description (SKILL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Short fixed constant | e.g. `Source frontmatter could not be parsed.` Zero model context (skill is `disable-model-invocation`); actionable detail rides the warning row. | ✓ |
| Name plugin + source skill | More informative to a human opening the file, but duplicates the warning row. | |

**User's choice:** Short fixed constant
**Notes:** The skill is hidden from the model's listing, so the description exists only to clear Pi's non-empty gate.

---

## Warning detail (WARN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Post-cascade notifyDiagnostic | Token `{malformed skill}` rides the `(installed)` row at warning severity; per-component `<plugin>/<component>: <error>` detail rides the existing `notifyDiagnostic` channel. | ✓ |
| Cause-chain trailer on row | Attach parse errors as a `cause` chain under the row, but `(installed)` rows carry no `cause` — needs a new field, more invasive. | |

**User's choice:** Post-cascade notifyDiagnostic
**Notes:** One token per plugin regardless of N degraded components (mirrors orphan-rewake). The closed-set token can't carry free text, so the detail needs the diagnostic channel.

---

## Self-inflicted staged-parse failure (PARSE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Throw — fail plugin loudly | A staged-parse failure is our bug; throw (test-guarded), never mask as author degradation. | ✓ |
| Degrade like author failure | Install never blocks, but mis-attributes our bug as the author's malformation. | |

**User's choice:** Throw — fail plugin loudly
**Notes:** Truthful attribution — the author-facing synthesize/neutralize degrade path fires only on an unparseable *source*, not on our own broken staged output.

---

## Claude's Discretion

- Upstream-parity mechanics (research verifies via `code.claude.com/docs`, does not invent): `when_to_use` fold separator/format (WTU-01), 1,536-char truncation style (WTU-02), first-paragraph extraction for the description-less fallback (SKILL-02).
- Exact placeholder-description string (within "short fixed constant").
- Whether `parseFrontmatter` needs new re-export plumbing in `platform/pi-api.ts` (verify it was exported at peer floor `>=0.74.0`).

## Deferred Ideas

- REASON-01 (v1.14 backlog): unify all parse-error reasons under a single `{malformed <feature>}` family — this phase adds two members; broad unification stays deferred.
- `when_to_use` folding for commands — out of scope (WTU is skills-only).
- Reviewed-not-folded todo: `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in` — broad pre-existing coverage sweep, tangential to this focused compliance phase.
