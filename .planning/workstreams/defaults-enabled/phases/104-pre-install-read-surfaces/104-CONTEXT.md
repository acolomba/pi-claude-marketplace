# Phase 104: Pre-install read surfaces - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Two read surfaces — `/claude:plugin list` and `/claude:plugin info` — gain the
ability to say, on a NOT-INSTALLED plugin's row, that installing it would leave
it disabled. The fact is stated in the established subject-first row grammar
(`<glyph> <name> [scope] (status) {reason}`) through the reason token Phase 102
already minted, and both surfaces stay network-free while saying it (NFR-5 /
OUT-05).

The phase changes only what these two surfaces READ and RENDER. It does not
change what `install` does, does not change any resolver arm's shape, and does
not introduce a fetch on a read path.

**Out of scope:** the no-op parity sweep (DFEN-08) and the contract divergence
write-up, both of which belong to Phase 105.

</domain>

<decisions>
## Implementation Decisions

### Value Source and Warm/Cold Symmetry

- **The marketplace entry is the ONLY source** these two surfaces read for the
  claim (`entry.defaultEnabled` from the cached `marketplace.json`). They never
  read `plugin.json`, not even where a warm clone makes it readable fs-only. The
  entry is the one source readable for EVERY plugin regardless of clone state,
  which is what lets an unfetched `(remote)` row carry the claim (criterion 3),
  and it makes the same plugin render identically warm and cold.

- **When the entry is silent, neither surface claims anything**, even if a warm
  clone's `plugin.json` declares `defaultEnabled: false`. Criterion 4 names
  declining the correct answer, not a gap. This is the deliberate divergence
  from `install`, which DOES read `plugin.json` through `resolveDefaultEnabled`
  — Phase 105 records it as a contract divergence (DOC-02).

- **One shared helper answers the question**, exported from `domain/` beside
  `resolveDefaultEnabled` (e.g. `entryDeclaresInstallDisabled(entry)`), consumed
  by both `list` and `info`. This carries forward the Phase 101 anchor that the
  `defaultEnabled` question is answered in exactly one place per read mode, and
  matches the house pattern of a single shared classifier
  (`orchestrators/plugin/plugin-state-classifier.ts`).

- **A non-boolean or malformed `defaultEnabled` on the entry counts as silent.**
  Only a literal `false` claims. This mirrors `resolveDefaultEnabled`'s existing
  `typeof entry.defaultEnabled === "boolean"` guard
  (`domain/resolver.ts:655`), so the read surfaces and the install path agree on
  what counts as a declaration. No separate malformed-manifest reason is
  introduced.

### Row Arms That Carry the Token

- **`(available)` — YES.** Criterion 1's direct target.
  `PluginAvailableMessage` (`shared/notify.ts:824`) gains an OPTIONAL `reasons`
  field, and the `available` arm in
  `orchestrators/plugin/list.messaging.ts` stops passing a hard-coded
  `undefined` into `composeReasons` and forwards `p.reasons` instead.

- **`(remote)` — YES.** Criterion 3 names the unfetched remote row explicitly,
  and the entry is readable with no clone at all. D-80-03's "bare row — NO
  reasons brace" note NARROWS to "no probe- or soft-dep-derived reasons", not
  "no reasons ever": the remote arm gains a reasons brace fed only by this
  entry-derived token. `PluginRemoteMessage` (`shared/notify.ts:842`) gains the
  same optional `reasons` field.

- **`(partially-available)` — YES.** It is a not-installed row whose install
  would land disabled, so the claim is true there. The arm already forwards
  `p.reasons`, so this costs no plumbing beyond the orchestrator stamping it.

- **`(unavailable)` — NO.** Nothing will install at all, so `{installs
  disabled}` would be a claim about an install that cannot happen; the row's
  brace already carries why it cannot. The arm is left alone.

- **Criterion 5 falls out of the above rather than needing its own guard:** the
  `installed`, `disabled`, `partially-installed`, `partially-installed-upgradable`,
  `upgradable`, `partially-upgradable` and `failed` arms are untouched, so an
  installed plugin's row cannot acquire the token.

### Token Choice and the info Surface

- **Reuse the EXISTING `installs disabled` member** of `DECLARED_STATE_REASONS`
  (`shared/notify-reasons.ts:157`). No new token is minted, so COMPAT-01's
  locked reason-token tuple (`tests/architecture/compat-01-no-expansion.test.ts`)
  needs no amendment, and the read surface says exactly the words the install
  surface will say when the user runs the install. The rejected alternative was
  a new `will install disabled` token following the `will uninstall`
  deferred-action precedent — it costs a COMPAT-01 amendment, a catalog token
  row and a fixture, to restate a fact the existing token already states.

- **`info` expresses the fact through the SAME `{installs disabled}` reason
  brace on its plugin row**, not through a new body line. `info` already renders
  the subject-first row grammar with a reason brace; a body line would be a
  second grammar for one fact.

- **`info --fetch` changes nothing about the claim's source.** A fetch may flip
  a row from `(remote)` to `(available)`, but the token still comes from the
  entry. The surface does not read the newly materialized `plugin.json`.

- **The `docs/output-catalog.md` blocks land in THIS phase**, not deferred to
  Phase 105's DOC-01 sweep: the catalog carries a byte-equality runner over what
  it documents, so an undocumented row is an unguarded row. New blocks cover the
  `(available)` and `(remote)` list rows and the `info` row.

### Claude's Discretion

- The exact name and signature of the shared `domain/` helper.
- Whether the orchestrator stamps the reason at the row-build site or through a
  small composer, so long as both surfaces reach the same single helper.
- Test file placement and fixture naming, following the existing
  `tests/orchestrators/plugin/` and `tests/architecture/catalog-uat.test.ts`
  conventions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `resolveDefaultEnabled` (`domain/resolver.ts:655`) — the Phase 101 precedence
  function (entry wins, then `plugin.json`), with the `typeof === "boolean"`
  guard this phase's silent-vs-declared rule mirrors.
- `DECLARED_STATE_REASONS` / `installs disabled`
  (`shared/notify-reasons.ts:157`) — the token, already closed-set-locked and
  already rendered by `install` and by the reconcile cascade.
- `composeReasons` + `joinTokens` (`shared/notify.ts`) — the row composer every
  `list` arm already calls; the `available` and `remote` arms need only to start
  feeding it.
- `plugin-state-classifier.ts` — the single shared classifier both `list` and
  the completion bucketizer derive from, with a parity drift-guard test
  (`tests/orchestrators/edge-deps.test.ts`). Precedent for the "one shared
  helper, two surfaces" shape this phase adds.

### Established Patterns

- Row rendering is a TOTAL render map keyed by status (`LIST_RENDER` in
  `list.messaging.ts`), pinned by `as const satisfies CommandContext<...>` so a
  missing arm is a compile error.
- Reason tokens are closed sets; COMPAT-01 asserts the exact tuple and order,
  and a new token must arrive with its catalog row, renderer arm and fixture in
  the same change.
- `list` / `info` purity is enforced by a source-grep architectural test
  (`tests/architecture/no-orchestrator-network.test.ts`) — the NFR-5 boundary is
  structural, not just behavioral.
- The output catalog (`docs/output-catalog.md`) pairs each documented state with
  a `<!-- catalog-state: ... -->` marker consumed by a byte-equality runner
  (`tests/architecture/catalog-uat.test.ts`).

### Integration Points

- `shared/notify.ts:824` (`PluginAvailableMessage`) and `:842`
  (`PluginRemoteMessage`) — the two message shapes gaining an optional
  `reasons`.
- `orchestrators/plugin/list.messaging.ts` — the `available` and `remote` render
  arms.
- `orchestrators/plugin/list.ts` — where the not-installed rows are built and
  the reason would be stamped.
- `orchestrators/plugin/info.ts` — the standalone `PluginInfoRow` build path
  (`buildNotInstalledRow` and the `(remote)` branch near `:1918`).
- `domain/resolver.ts` — home of the new shared entry-read helper.
- `docs/output-catalog.md` — new catalog blocks.

</code_context>

<specifics>
## Specific Ideas

- The claim is about a FUTURE action, which is why it is confined to
  not-installed rows. This follows the durable-vs-transient guidance recorded at
  the Phase 95 discuss session (D-95-01/02/03): steady-state inventory rows state
  durable facts about a record, and `{installs disabled}` is not one.

- The deliberate asymmetry between what `install` reads (entry, then
  `plugin.json`) and what `list`/`info` read (entry only) is a KNOWN divergence,
  not an oversight. It exists because closing it would either require a fetch
  (forbidden by OUT-05) or make the same plugin render differently depending on
  whether a clone happens to be warm. Phase 105 documents it under DOC-02.

</specifics>

<deferred>
## Deferred Ideas

- **Reading `plugin.json` on a warm clone** so `list`/`info` match `install`
  exactly. Rejected here for warm/cold symmetry; recorded so a later reader does
  not re-open it as an oversight.

- **A `will install disabled` token** distinct from the install surface's
  `installs disabled`. Rejected for COMPAT-01 cost against no gain in
  information.

- **DFEN-08 parity sweep and the DOC-02 divergence write-up** — Phase 105 owns
  both.

</deferred>
