# Phase 86: Skill and command frontmatter compliance - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

The skills and commands bridges reach **observable parity** with Claude Code's
frontmatter-loading behavior. Source frontmatter is parsed with Pi's own
`parseFrontmatter` (re-exported through `platform/pi-api.ts`) **before**
name-rewrite and variable substitution — establishing attribution ground truth
and the degrade trigger — and the staged bytes are re-parsed afterward as a
Pi-acceptability backstop. Unparseable skill → synthesized
`disable-model-invocation` block (body verbatim); unparseable command →
neutralized (name-from-filename, description-from-first-body-line);
description-less skill → first-paragraph fallback; `when_to_use` folded into the
Pi `description`. Every degraded/neutralized component surfaces an install-time
warning classified under a new failure-class reason token. The ~99% of
already-valid components are written byte-for-byte unchanged.

Delivers all 11 requirements: PARSE-01/02, SKILL-01/02/03, WTU-01/02, CMD-01,
WARN-01, CLASS-01, NREG-01.

</domain>

<decisions>
## Implementation Decisions

### Reason-token catalog (CLASS-01)

- **D-86-01:** Add **two dedicated per-kind tokens** — `malformed skill` and
  `malformed command` — paralleling the `malformed mcp` truthful-attribution
  precedent (`notify.ts:143-151`, `notify-reasons.ts:110-115`). NOT a single
  shared token and NOT a reuse of the existing generic `unparseable`. Rationale:
  this codebase consistently adds a dedicated token when truthful attribution
  demands it (`dangling reference` over `source mismatch`, `authentication
  required` over `network unreachable`, `malformed mcp` over a generic bucket).
  The reason row should tell the operator *which component kind* malformed.
  - Mechanics: append both tokens to the `REASONS` tuple in `notify.ts` **after**
    the existing 35 entries (order of the existing 35 stays byte-identical —
    OUT-08), and file both under `FAILURE_REASONS` in `notify-reasons.ts` (NOT
    `UNSUPPORTED_REASONS` — this is a malformation of a *supported* component,
    exactly the `malformed mcp` rationale). The `_ReasonsCoverageProof`
    completeness proof in `notify-reasons.ts` must be updated in lockstep or it
    fails to compile — that compile error is the guardrail.
  - Closed set grows 35 → 37.
  — **Reversibility:** costly — the `REASONS` tuple is a published catalog
    contract with a compile-time completeness proof and byte-stability tests;
    renaming/removing a token later touches the tuple, the topic-group view, the
    proof, and every test that asserts the rendered row bytes.

### Unparseable-skill placeholder description (SKILL-01)

- **D-86-02:** The synthesized `description` on an unparseable skill is a **short
  fixed constant** (e.g. `Source frontmatter could not be parsed.`) — not
  interpolated with plugin/source names. The skill carries
  `disable-model-invocation: true`, so it is excluded from the model's skill
  listing and the description costs zero context; it exists only to clear Pi's
  non-empty-`description` gate. The actionable detail (plugin, source skill,
  parse error) rides the install-time warning instead (see D-86-03). Body is
  preserved verbatim; install does not hard-fail.
  - Exact string wording is Claude's discretion within "short fixed constant."

### Warning surface (WARN-01)

- **D-86-03:** A degraded skill / neutralized command still installs; the failure
  stops being silent via a **two-part surface**:
  1. The closed-set reason token (`{malformed skill}` / `{malformed command}`)
     rides the plugin's `(installed)` row at **`warning`** severity — parallel to
     the `(installed) {orphan rewake}` component-defect precedent. **One token
     per plugin** regardless of how many of its components degraded (mirrors
     orphan-rewake's "one row per plugin regardless of N handlers").
  2. The per-component free-text detail (`<plugin>/<component>: <parse error>`)
     rides the existing **post-cascade `notifyDiagnostic`** warning channel
     (`notify.ts:339-349`) — the sanctioned seam for warnings that have no
     representation in the cascade body. This is where WARN-01's "name the source
     component and the parse error" requirement is satisfied (the closed-set
     token cannot carry free text).
  - Planner to confirm: the row is `(installed)` (component installed in degraded
    form), NOT `(partially-installed)` (which is for *dropped* supported
    components). Severity is a per-row stamp (SEV-01/SEV-02); a degraded-but-
    installed component is "carried out but short of ideal" → `warning`.

### Self-inflicted staged-parse failure (PARSE-02)

- **D-86-04:** If a source parses cleanly but the **staged** output (after
  name-rewrite + `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` substitution)
  fails to parse, that is **our** bug — **throw** and fail that plugin's install
  loudly (test-guarded), never mask it as author degradation. Truthful
  attribution: we do not knowingly ship bytes Pi rejects, and we do not
  mis-attribute our defect to the plugin author. This is the "loud failure /
  test-guarded" arm PARSE-02 calls for — distinct from the author-facing
  synthesize/neutralize degrade path (D-86-01..03), which fires only on an
  unparseable **source**.

### Research-confirmed decisions (post-RESEARCH.md, operator-confirmed 2026-07-26)

Research (`86-RESEARCH.md`) resolved the upstream-parity unknowns and surfaced a
Pi divergence; the operator confirmed the following:

- **D-86-05:** Truncation cap stays **1,536** (WTU-02 / Claude Code parity), even
  though Pi's skill loader emits a **non-fatal** startup warning when
  `description` exceeds 1,024 chars. A combined `description`+`when_to_use` of
  1025–1536 loads in Pi and stays model-invocable — do NOT secretly truncate to
  1,024 (that would silently drop trigger keywords and diverge from Claude Code).
  Treat the Pi >1024 warning as a documented, known divergence; add a test that a
  >1024-combined skill still loads (Pi returns a `Skill`, not `null`). — **Reversibility:** reversible.
- **D-86-06:** First-paragraph fallback (SKILL-02) = derive the description from
  the **first genuine body line** — skip blank lines, ATX `#` headings, and fenced
  code blocks (` ``` ` / `~~~` and their contents) and similar non-prose
  constructs; land on the first plain body line. (Operator's words: "the first
  line that's a body — not header, not code block, … just a body.") Take the
  paragraph starting at that first body line (contiguous body text to the next
  blank line), consistent with Claude Code's "first paragraph of markdown
  content." Lead the implementation with a robust body-line detector, not a naive
  "skip one heading." — **Reversibility:** reversible.
- **D-86-07:** CMD-01 neutralize = **strip the entire malformed frontmatter block**
  (opening `---` through the closing `---`), leaving the real body, so
  `parseFrontmatter` returns empty and Pi takes name-from-filename + the real
  body's first non-empty line — matching Claude Code's "loads the body with empty
  metadata." NOT "strip only the delimiter lines" (that would leave ex-frontmatter
  junk as the first body line and produce a poor description). — **Reversibility:** reversible.

**Scope confirmations (research Open Questions Q2/Q3 — sensible defaults, no real
tradeoff):**
- The **orchestrated** (reconcile) install path is the primary/required wiring
  surface for the reason token AND the free-text `notifyDiagnostic` detail — that
  is where reconcile-driven installs and imports run. The reconcile
  `plugin-installed` arm carries no `reasons` today, so wiring the token there is
  new work (add a degrade flag to `InstallPluginOutcome` → `PluginInstalledOutcome`
  and push the token in the reconcile notify composer). Standalone reason-token
  parity is a smaller add (rides `PluginInstalledMessage.reasons?` like `orphan
  rewake`); standalone drops the free-text detail per D-19-01.
- Scope is **write-path-only** (aligns with NREG-01): fix the staging write path;
  do NOT re-materialize or migrate already-installed malformed components. They
  are corrected on next re-install.

**`parseFrontmatter` (VERIFIED by research):** public root export of
`@earendil-works/pi-coding-agent` at the peer floor `>=0.74.0` (confirmed in the
0.74.0 tarball, `dist/index.d.ts`). It **throws** on malformed YAML inside `---`
delimiters but **returns empty (no throw)** when delimiters are absent — this
split is the SKILL-01 (throw → synthesize) vs SKILL-02 (empty → first-paragraph)
branch trigger. Not yet surfaced in `platform/pi-api.ts` → new re-export plumbing.

### Claude's Discretion (low-stakes planner defaults — research A1/A2/A4)

- **A1 — `when_to_use` fold separator:** append with a single `\n` separator
  (Claude Code documents only that it is "appended"; it pins no separator, so this
  is a source-side detail).
- **A2 — truncation style:** a **hard cut** at 1,536 (no ellipsis); since
  `when_to_use` is appended after `description`, the tail overflows and is dropped.
- **A4 — placeholder-description string** (within D-86-02's "short fixed
  constant"): a short YAML-safe constant, e.g. `Source frontmatter could not be
  parsed.`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative design + requirements
- `docs/research/issue-101-skill-frontmatter-diagnosis.md` — the authoritative
  design: root cause, rejected approaches (quote-repair; whole-block re-emit),
  the chosen "mirror Claude Code via Pi's own machinery" approach, work-items
  table, classification rationale, and the two open questions (both now resolved:
  placeholder = fixed short via D-86-02; `when_to_use` fold = WTU-01/02).
- `.planning/REQUIREMENTS.md` — the 11 requirements + Out-of-Scope table (which
  non-`description` fields are intentionally dropped, why quote-repair and
  whole-block re-emit are rejected).

### Notification surface (the catalog + warning channels)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `REASONS` closed-set
  source of truth (currently 35 entries; §89-152), the `malformed mcp` token +
  its truthful-attribution comment (§143-151), the `orphan rewake` reason-on-
  `(installed)`-row precedent (§121-129 and `PluginInstalledMessage.reasons?`
  §621-629), the `Severity`/`computeSeverity` model (SEV-01/02), and the
  `notifyDiagnostic` post-cascade warning channel (§339-349).
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — the topic-group
  views; `FAILURE_REASONS` (§99-128, where the two new tokens go) and the
  `_ReasonsCoverageProof` completeness proof (§166-169, must update in lockstep).

### Staging seams (where the parse gates + degrade logic land)
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` §159-164 — the
  `readFile → rewriteFrontmatterName → substituteClaudeVars → writeFile` seam;
  gate 1 (source) before rewrite, gate 2 (staged) after write.
- `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts` — the
  pure-string `name:` rewrite (T-03-17 injection-safety note). Today it
  *manufactures* a name-only frontmatter block when the source has none (the
  missing-`description` bug), and only replaces the first line of a folded
  `name:` (the SKILL-03 corruption). SKILL-03: verify the written `name` equals
  the parsed generated name.
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` §158-160 — the
  command `readFile → substituteClaudeVars → writeFile` seam; CMD-01 neutralize
  lands here.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` — the Pi-API boundary;
  re-export `parseFrontmatter` here for byte-identical accept/reject semantics
  (verify it was exported at peer floor `>=0.74.0`).

### Precedent (reference, not a copy target)
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` — the bridge
  that already parses source frontmatter and re-emits scalars correctly. It is
  the *conceptual* precedent (parse-your-own-output-before-shipping), NOT a
  template: it flattens to pi-subagents' flat target format; skills' target is
  real structured YAML, so whole-block re-emit is explicitly rejected.

### Upstream (research fetches to verify parity)
- `code.claude.com/docs/en/skills.md` — failure policy ("malformed → body loads,
  metadata empty, `/name` works, no auto-invoke; error only under `--debug`") and
  field contract (`description` Recommended, first-paragraph fallback,
  `when_to_use` appended, 1,536-char listing cap).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `notifyDiagnostic(ctx, header, lines)` (`notify.ts:339-349`) — the post-cascade
  `warning`-severity channel for the per-component parse-error detail lines
  (D-86-03 part 2). Already used for post-commit hygiene warnings.
- `orphan rewake` reason-on-`(installed)`-row pattern — the shape D-86-03 part 1
  copies: a component-level config/format defect surfacing as a `{token}` brace on
  an otherwise-successful plugin install row.
- The closed-set `as const` tuple + `(typeof X)[number]` literal-union machinery
  and its topic-group completeness proof — the two new tokens plug into it.

### Established Patterns
- **`REASONS` is the single byte-stable source of truth** (OUT-08): membership +
  order of the existing entries must not change; new tokens append at the end.
  The topic groups in `notify-reasons.ts` are typed *views* with a compile-time
  proof — adding a token to `REASONS` without giving it a home in a group (or a
  typo) is a compile error. Update both files together.
- **Failure-class vs unsupported vs soft-degrade are distinct axes.** A malformed
  supported component is failure-class (`FAILURE_REASONS`), never
  `UNSUPPORTED_REASONS` (that family is for unsupported *kinds* — hooks/lsp/soft
  deps). This is the exact `malformed mcp` classification precedent.
- **Pure-string rewrite for injection-safety (T-03-17) is preserved.** The new
  parse is READ-ONLY — parse to validate + extract field values, never `eval`.
  Reading input to check output-validity does not reintroduce the injection
  surface the "no YAML parsing" comment guards against.

### Integration Points
- Two parse gates inserted into both `bridges/skills/stage.ts` and
  `bridges/commands/stage.ts` (source-before-rewrite, staged-after-write).
- `parseFrontmatter` sourced through `platform/pi-api.ts`.
- Two new tokens in `notify.ts::REASONS` + `notify-reasons.ts::FAILURE_REASONS`.
- Warning rows: reason token on the install-cascade `(installed)` row + detail
  lines through `notifyDiagnostic`.

</code_context>

<specifics>
## Specific Ideas

- The `malformed mcp` member (MCPR-03 / D-02) is the explicit model to mirror —
  both for classification (failure-class, not unsupported) and for the
  truthful-per-feature-attribution rationale that drove D-86-01 to two dedicated
  tokens.
- The chosen degrade primitive for unparseable skills is Pi's
  `disable-model-invocation: true` (Pi `core/skills.js`) — it reproduces Claude
  Code's observable "invocable by `/name`, never auto-invoked" pair, which literal
  empty-metadata parity cannot (Pi returns `skill: null` on empty description).

</specifics>

<deferred>
## Deferred Ideas

- **REASON-01** (v1.14 backlog): unify all parse-error reasons under a single
  `{malformed <feature>}` family. This phase adds two more failure-class members
  paralleling `malformed mcp`; the broad unification stays deferred.
- `when_to_use` folding for **commands** is out of scope — WTU is skills-only
  (Pi's command loader reads name + first-body-line, has no description-listing
  surface for triggers).

### Reviewed Todos (not folded)
- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in`
  (testing, match score 0.6) — a broad pre-existing coverage sweep over
  *existing* update/reinstall/install failure arms. Tangential to this focused
  compliance phase; this phase adds its own parse-failure-arm tests as required
  by PARSE/SKILL/CMD/WARN/CLASS. Left deferred to keep the phase scoped.

</deferred>

---

*Phase: 86-skill-and-command-frontmatter-compliance*
*Context gathered: 2026-07-26*
