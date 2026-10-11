# Phase 9: Address tech debt: redact LLM tool error text - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the phase 04 deferred item recorded in
`.planning/phases/04-wire-schema-and-json-strategy/deferred-items.md`: text that
the two LLM tools in `extensions/pi-claude-marketplace/edge/handlers/tools.ts`
return to the model does not pass through `redactCredentials`. The milestone
audit (`.planning/json-output-MILESTONE-AUDIT.md`, Verdict item 1) names this as
the only prior action item with no disposition.

The scout found three channels that carry tool text to the LLM without
redaction. This phase closes all three:

1. **Catch text (the deferred item).** The plugin-list catch returns
   `Failed to load plugin list: ${errorMessage(err)}` as `content`. Today the
   thrown value is a `state.json` error, so this leak is theoretical.
2. **Uncaught throws.** `pi_claude_marketplace_list` has no catch, and
   `marketplaceExists` in `pi_claude_marketplace_plugin_list` runs before the
   try. Pi relays a thrown error to the model as `error.message` text
   (`executePreparedToolCall` -> `createErrorToolResult` in the
   `@earendil-works/pi-coding-agent` bundle, observed 2026-10-10 in
   `node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks/chunk-OJP47DM6.js`).
3. **Content line, a confirmed leak.** `pi_claude_marketplace_list` writes
   `sourceLogical(source)` into each content line. A `url` source keeps its
   userinfo, so a marketplace added as
   `https://user:ghp_...@git.example.com/o/r.git` prints that credential to the
   model. Probe on 2026-10-10: `parsePluginSource` on that string returns
   `{kind:"url", url:"https://user:ghp_...@git.example.com/o/r"}`, and
   `sourceLogical` returns the same URL. The same result's `details` are
   already redacted, because `presentCascade` redacts `source.url`.

Out of scope: notification presentations (PMOD-04 already covers them), the
`details` payloads (already redacted through `presentCascade`), and absolute
path redaction.

**Upstream parity:** no Claude Code position applies. The two LLM tools exist
only in Pi, and Claude Code has no counterpart.

</domain>

<decisions>
## Implementation Decisions

The user said "none, make your best decisions" when offered the four gray
areas on 2026-10-10. Claude made every decision below.

### Redaction reach
- **D-01:** Redact every string the two tools return to the model in
  `content` text: the content lines, the empty-state lines, the
  marketplace-not-found line, and every error line. Rationale: the phase's job
  is to make credentials absent from LLM tool text. Fixing only channel 1
  would close the theoretical leak and leave the confirmed one (channel 3)
  open. `redactCredentials` changes only credential spans, so text without a
  credential keeps its bytes, and every existing tool test expectation holds.
- **D-02:** Do not change `details`. They already go through `presentCascade`,
  which redacts `source.url` and the subject names (PMOD-04). Adding a second
  pass would duplicate work without changing any output.

### Uncaught throws
- **D-03:** Neither tool's `execute` may let a thrown value reach Pi. Each tool
  catches everything its execute body can throw and returns
  `{ content: [{ type: "text", text: <redacted error line> }], isError: true, details: { marketplaces: [] } }`,
  the shape TC-9 already uses for the plugin-list tool.
  - Plugin-list tool: move the `marketplaceExists` call inside the existing
    try, so one catch covers the whole body. The error line stays
    `Failed to load plugin list: <message>`.
  - Marketplace-list tool: add the same catch. The error line is
    `Failed to load marketplace list: <message>`, which mirrors the plugin-list
    wording.

  Rationale: Pi's generic path sends the raw `error.message` to the model,
  and redaction cannot run on text the extension never sees.

### Redaction seam
- **D-04:** Redact at the tool return boundary in `edge/handlers/tools.ts`,
  using `redactCredentials` from `shared/redact-credentials.ts`. The tools stay
  out of the notification resolve step. Rationale: tool `content` is not a
  notification presentation. PMOD-04 D-07 places redaction "in resolve at every
  serialization site", and for the tool surface that serialization site is the
  tool's return value. The `edge` zone may import `shared/`, so no boundary or
  rule-pack change is needed. The planner chooses the exact form: a single
  module-private helper that builds the text part, or a call at each return
  site. With either form, no return path may skip redaction.
- **D-05:** Redact credentials only, not absolute paths. The TC-9 test asserts
  that the `state.json` path appears in the error text. Path redaction is a
  separate policy (`shared/redact-absolute-paths.ts`) that applies at chosen
  sites, and a path is not a secret.

### Proof and closure
- **D-06:** Prove the fix with owner tests in `tests/edge/handlers/tools.test.ts`.
  Use the existing hermetic-scope helpers (`createHermeticScope`, `seedScope`,
  `registerToolUnderTest`). Include at least:
  - a marketplace whose `url` source carries userinfo and a `ghp_` token. The
    content line shows `https://***@host/...`, and the token is absent from
    the whole result;
  - a plugin-list load failure whose message carries a credential. The error
    line is redacted, and `isError: true`;
  - a marketplace-list load failure (for example, an unsupported `state.json`
    schema). The tool returns the `isError` result and does not throw;
  - a `marketplaceExists` failure. The plugin-list tool returns the `isError`
    result and does not throw.

  `tools.ts` keeps 100% direct coverage. Do not extend the AUTH-09
  architecture gate (`tests/architecture/no-credential-leak.test.ts`). That
  gate statically scans named state-write and credential files, and
  project policy forbids planted-violation tests for gates.
- **D-07:** Change the deferred item's status in
  `.planning/phases/04-wire-schema-and-json-strategy/deferred-items.md` from
  `open` to `closed` and point it at phase 9. Add no new REQUIREMENTS.md ID:
  trace the work to PMOD-04, whose goal (credentials absent from what the
  extension emits) now also covers LLM tool text, and to the audit's Verdict
  item 1. After this phase, re-run the milestone audit before
  `/gsd-complete-milestone`.
- **D-08:** The milestone invariants hold unchanged. The notify wire corpus
  and `docs/output-catalog.md` re-diff empty, because tool output is not part
  of either. `npm run check` stays green, with no new fallow suppression.

### Claude's Discretion
- Every decision above (the user delegated all four areas).
- How the redaction is shaped inside `tools.ts`: one helper or per-site calls
  (D-04).
- The fixture used to make a load throw a credential-bearing message (D-06),
  as long as it stays hermetic and makes no network call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The deferred item and its audit
- `.planning/phases/04-wire-schema-and-json-strategy/deferred-items.md` — the open item this phase closes
- `.planning/json-output-MILESTONE-AUDIT.md` — Verdict item 1 and the table row "Decide the two deferred items"

### Redaction policy
- `.planning/REQUIREMENTS.md` — PMOD-04
- `.planning/phases/04-wire-schema-and-json-strategy/04-CONTEXT.md` — D-05..D-09 (redaction forms, the single redaction function, the LLM tools' details)
- `extensions/pi-claude-marketplace/shared/redact-credentials.ts` — `redactCredentials`, the one redactor
- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts` — the separate path policy, not applied here (D-05)

### Code under change
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — both LLM tools
- `extensions/pi-claude-marketplace/domain/source.ts` — `sourceLogical` (keeps url userinfo; do not change it, because other callers rely on it)
- `tests/edge/handlers/tools.test.ts` — the TC-9 test ("reports a tool error when the recorded state declares an unknown schema") and the hermetic helpers

### Project policy
- `skills/local-verification/SKILL.md` — gate runs
- `skills/typescript-google-style-review/SKILL.md`, `skills/typescript-comments/SKILL.md`, `skills/typescript-unit-testing/SKILL.md` — style rules for the edit

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `redactCredentials(text)`: replaces URL userinfo with `***@` and token
  shapes with `***`. Text without a credential keeps its bytes.
- `errorMessage(err)` (`shared/errors.ts`): the existing non-Error narrowing
  that the catch already uses.
- Hermetic test scaffolding in `tools.test.ts`: `createHermeticScope`,
  `seedScope`, `locationsFor`, `registerToolUnderTest`, and the
  `networkCallCount` assertion.

### Established Patterns
- The plugin-list catch (TC-9) sets the error-result shape:
  `isError: true`, a `Failed to load ...: <message>` line, and
  `details: { marketplaces: [] }`.
- `details` go through `openNotificationSnapshot` -> `presentCascade` ->
  `toWireMarketplaces`, so they are already redacted.

### Integration Points
- Only `edge/handlers/tools.ts` changes in production. Both tools are
  registered through `registerClaudeMarketplaceTools` in `edge/register.ts`,
  which does not change.

</code_context>

<specifics>
## Specific Ideas

- Probe input that reproduces channel 3:
  `https://user:ghp_abcdefghijklmnopqrstuv@git.example.com/o/r.git` added as a
  marketplace source. The expected content line ends
  `-- https://***@git.example.com/o/r`.

</specifics>

<deferred>
## Deferred Ideas

- Absolute-path redaction for LLM tool error text (D-05). This is a separate
  policy question, so it was not raised as a backlog item.

</deferred>

---

*Phase: 09-address-tech-debt-redact-llm-tool-error-text*
*Context gathered: 2026-10-10*
