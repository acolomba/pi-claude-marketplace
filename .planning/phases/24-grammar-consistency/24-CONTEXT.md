# Phase 24: Grammar Consistency - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the lone camelCase token leak in the user-rendered `REASONS` closed
set. Of the 28 reasons in `shared/notify.ts:69-98`, every one is lowercase
(space- or hyphen-separated) **except** `"lspServers"` (`:79`) -- the sole
camelCase outlier. Renaming just that one member closes the grammar leak so a
plugin whose manifest declares unsupported `lspServers` renders its reason
brace as `{lsp}`, never `{lspServers}`.

**The manifest JSON key `lspServers` is NOT touched** -- it is the actual
`.claude-plugin/plugin.json` field name. The resolver reads it, mentions it in
degradation notes (`"contains lspServers"`), and the typebox schema validates
it. Changing it would break parsing of real Claude plugin manifests.

**In scope:** the closed-set member rename + its two emission seams +
JSDoc/comment corrections + the catalog/fixture/doc byte-form updates required
to keep catalog-UAT byte-equality GREEN + the stale-`shared/grammar/` doc
hygiene fold-in.

**Out of scope:** the manifest-side field name (`plugin.ts:31` schema,
`resolver.ts:142,160`), any other reason in the closed set, runtime
publish/verification (Phase 25), the GREEN-gate close (Phase 26). No new
commands, no new reasons.
</domain>

<decisions>
## Implementation Decisions

### Rendered token (user-locked)
- **D-24-01:** The renamed reason renders as **`"lsp"`** -- NOT `"lsp servers"`.
  User decision during discussion (2026-05-29), made after reviewing the full
  28-entry closed set: `{lsp}` parallels the single-word `{hooks}` carve-out
  and is terser. The one trade-off acknowledged and accepted: `{lsp servers}`
  would be marginally more self-explanatory (the field means "LSP servers"),
  but `{lsp}` is the chosen form.
- **D-24-02:** **Strategy = option (a)** from SNM-36 (rename the closed-set
  discriminator), NOT option (b) (renderer-side translation). Option (b)
  (keep `"lspServers"` in `REASONS`, swap only inside `composeReasons` at
  `notify.ts:863`) was presented and **rejected**: it would re-hide the
  camelCase-through-the-closed-set smell in the renderer and violate the
  closed-set-purity invariant (every Reason renders verbatim). Option (a)
  keeps the set pure.
- **D-24-03 (amendment, lockstep):** ROADMAP SC #1, SC #3, and REQUIREMENTS
  SNM-36 all currently spell the new token `"lsp servers"`. **Amend that
  wording to `"lsp"`** in lockstep with the code change -- same correction
  pattern Phase 23 applied to SNM-34. The design endorsement of option (a) in
  SNM-36 still holds; only the literal token string changes. The 8+4 = 13
  consumer-call-site framing in SNM-36/SC#3 is also imprecise (see D-24-04) --
  note that in the amendment.

### The detection-vs-emission seam (the load-bearing decision)
- **D-24-04:** This is **NOT a blanket find/replace**. The resolver emits
  degradation notes derived from the manifest JSON key -- they literally
  contain the camelCase substring `lspServers` (`"contains lspServers"`). Two
  seams match that substring, then push a closed-set Reason. The rule:
  **detection substrings STAY camelCase `lspServers`; only the EMITTED Reason
  becomes `"lsp"`.** Concretely:
  - **`orchestrators/plugin/list.ts` -- `narrowResolverNotes` (`:270-296`):**
    `note.includes("lspServers")` (`:283`) and the `seen` bookkeeping **stay
    camelCase** (matching the resolver note). The pushed value (`:284`) and
    the local emitted-union types (`ListReason` `:169-176`; the return type +
    accumulator at `:272-273`) change their `lspServers` slot to `"lsp"`.
  - **`orchestrators/plugin/install.ts` -- carve-out (`:1221-1244`):**
    `MANIFEST_FIELD_REASONS = new Set(["hooks", "lspServers"])` (`:1221`)
    **stays camelCase** (it matches the bare token sliced from the resolver's
    `"contains lspServers"` note). But `manifestFieldTokenFromNote` (`:1231`)
    can no longer `return token as Reason` directly for `lspServers` -- it must
    **map** `lspServers → "lsp"` (and `hooks → "hooks"`) so the detected
    manifest token translates to the renamed emitted Reason.
- **D-24-05 (Claude's discretion within the principle):** The exact seam
  mechanism -- a small `MANIFEST_FIELD_TO_REASON` lookup (e.g.
  `{ hooks: "hooks", lspServers: "lsp" }`) applied at both seams vs. an inline
  conditional at each push site -- is the planner's/executor's call. The
  PRINCIPLE in D-24-04 (detect-camelCase / emit-`"lsp"`, never blanket-rename)
  is locked.

### Test / catalog fixture partition (locked per discussion)
- **D-24-06:** Every `lspServers` occurrence partitions into two buckets. The
  planner MUST honor this split (do not rename the KEEP bucket):
  - **RENAME → `"lsp"`** (closed-set Reason value / rendered byte form):
    - `tests/architecture/catalog-uat.test.ts:246,490` -- structured
      `reasons: ["hooks", "lspServers"]` fed to `notify()` → `["hooks","lsp"]`;
      the expected byte output `{hooks, lspServers}` → `{hooks, lsp}`.
    - `tests/orchestrators/plugin/install.test.ts:1589` -- narrowed `row.reasons`
      output `["hooks","lspServers"]` → `["hooks","lsp"]`.
    - `tests/orchestrators/plugin/install.test.ts:1698,1712` -- the **expected
      output** of `__test_narrowResolverReasons(...)`: `["lspServers"]` →
      `["lsp"]` (the `["contains lspServers"]` INPUT on the same lines STAYS).
    - `docs/output-catalog.md:158,300` byte forms + the carve-out prose at
      `:58` and `:118`.
  - **KEEP camelCase `lspServers`** (manifest / resolver-note / error-message /
    detection-input layer):
    - `tests/shared/errors.test.ts:201,204,208` -- `PluginShapeError` raw
      `reasons` + the composed message `…is not installable: hooks; lspServers`
      (built from manifest field names, pre-narrowing).
    - `tests/domain/resolver-loose.test.ts:194` +
      `tests/domain/resolver-strict.test.ts:163` -- `kind: "lspServers"`
      manifest-component fixtures.
    - `tests/orchestrators/plugin/install.test.ts:1579` -- `["contains hooks",
      "contains lspServers"]` resolver-note INPUTS.

### Catalog byte-form lockstep
- **D-24-07:** Per the v1.4.1 cross-cutting constraint (ROADMAP `:85-91`) and
  the precedent from Phase 22 (D-22-06) and Phase 23 (D-23-06): any rendered
  byte-form change updates `docs/output-catalog.md` + `catalog-uat.test.ts` +
  `notify-v2.test.ts` in the **same commit**. Catalog UAT byte-equality must
  be GREEN at the phase boundary.

### Stale `shared/grammar/reasons.ts` hygiene (user-locked: fold all 6)
- **D-24-08:** `shared/grammar/` was retired in Phase 21 (confirmed absent),
  but **6 stale references** still point to `shared/grammar/reasons.ts`. Fold
  ALL of them into this phase (user decision) -- they cite the exact token
  being renamed, so correcting them here keeps the grammar docs/comments
  truthful. Re-point each to `shared/notify.ts::REASONS`:
  - `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1219`
    (carve-out comment) and `:1239` (cast-safety comment) -- already in a file
    this phase edits.
  - `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:99`.
  - `docs/messaging-style-guide.md:54` and `:146`.
  - `docs/output-catalog.md:58` -- already in a file this phase edits.
  - (`shared/notify.ts:192` already correctly says "previously imported from
    `shared/grammar/reasons.ts`" -- leave it; it is accurate history, not a
    live pointer.)

### Manifest-side boundary (restated -- SC #4)
- **D-24-09:** Do NOT touch: `domain/components/plugin.ts:31`
  (`lspServers: Type.Optional(Type.Unknown())` -- typebox schema) or
  `domain/resolver.ts:142,160` (manifest-field detection + test fixture). Only
  the JSDoc at `domain/components/plugin.ts:46` (which lists `lspServers` as an
  example of an opaquely-declared unsupported component) is reviewed -- it
  references the manifest field name, so it can STAY as-is OR be left untouched
  (it is describing the JSON field, not the rendered reason). Planner confirms;
  default is leave it (it is manifest-side prose).

### Claude's Discretion
- Seam mechanism (lookup table vs inline) per D-24-05.
- Plan/wave decomposition. Single SNM-36; everything converges on
  `notify.ts` + `list.ts` + `install.ts` + catalog/fixtures -- likely one or
  two serialized plans, planner owns the split.
- Whether `plugin.ts:46` JSDoc stays verbatim (D-24-09) -- it is manifest-side.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement & gap source
- `.planning/REQUIREMENTS.md` §SNM-36 (`:24`) -- the requirement this phase
  closes. **NOTE:** its `"lsp servers"` token and the "13 consumer call-sites"
  framing are CORRECTED by D-24-01 (`"lsp"`) and D-24-04 (detection seam) --
  amend in lockstep.
- `.planning/ROADMAP.md` -- Phase 24 goal + SC#1-#4 (`:445-458`); cross-cutting
  v1.4.1 constraints (`:85-91`). SC#1/#3's `"lsp servers"` wording is amended
  to `"lsp"` per D-24-01/D-24-03.

### Closed set + renderer
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `REASONS` tuple
  (`:69-98`); the member to rename is `"lspServers"` (`:79`) → `"lsp"`.
  `type Reason` (`:100`) derives from it. `composeReasons` (`:863`) is the sole
  reason-brace render point (the option-(b) seam that was REJECTED, D-24-02).
  `notify.ts:192` already documents the Phase-21 grammar retirement (leave).

### Emission seams (the D-24-04 split -- most important)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` --
  `narrowResolverNotes` (`:263-296`): detection `note.includes("lspServers")`
  (`:283`) STAYS; emitted value (`:284`) + union types (`ListReason` `:169-176`,
  return/accumulator `:272-273`) → `"lsp"`. JSDoc at `:164` mentions `lspServers`
  as a produced reason -- update to `lsp`. Comments at `:310`, `:393` also
  mention `lspServers` in prose -- review for the rename.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` --
  `MANIFEST_FIELD_REASONS` (`:1221`) STAYS camelCase; `manifestFieldTokenFromNote`
  (`:1231-1244`) must MAP `lspServers → "lsp"` instead of `return token as Reason`.
  JSDoc/comments at `:1141`, `:1208`, `:1238`, `:1254`, `:1277` mention
  `lspServers` -- partition each (detection-describing vs reason-describing).

### Manifest side (DO NOT TOUCH -- SC #4)
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` -- `lspServers`
  typebox schema field (`:31`, STAY); JSDoc example (`:46`, manifest-side prose,
  default leave per D-24-09).
- `extensions/pi-claude-marketplace/domain/resolver.ts` -- `lspServers` in
  `UNSUPPORTED_COMPONENT_KINDS`-style list (`:142`) + test fixture (`:160`),
  both STAY.

### Catalog + tests (byte-equality lockstep, D-24-07)
- `docs/output-catalog.md` -- byte forms `{hooks, lspServers}` (`:158`, `:300`)
  → `{hooks, lsp}`; carve-out prose (`:58`, `:118`); stale `shared/grammar/`
  pointer (`:58`, D-24-08).
- `extensions/pi-claude-marketplace/tests/architecture/catalog-uat.test.ts` --
  `:246`, `:490` (RENAME side, D-24-06).
- `extensions/pi-claude-marketplace/tests/orchestrators/plugin/install.test.ts`
  -- `:1579` (KEEP input), `:1589` (RENAME output), `:1697-1712` (RENAME the
  expected output, KEEP the input), per D-24-06.
- `extensions/pi-claude-marketplace/tests/shared/errors.test.ts` -- `:201,204,208`
  (KEEP camelCase, D-24-06).
- `extensions/pi-claude-marketplace/tests/domain/resolver-loose.test.ts:194` +
  `resolver-strict.test.ts:163` -- `kind: "lspServers"` (KEEP, D-24-06).
- `extensions/pi-claude-marketplace/tests/shared/notify-v2.test.ts` -- add/adjust
  any `lsp` reason byte fixtures in lockstep (D-24-07).

### Stale-path hygiene (D-24-08)
- `docs/messaging-style-guide.md:54,146`;
  `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:99`;
  `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1219,1239`;
  `docs/output-catalog.md:58` -- re-point all to `shared/notify.ts::REASONS`.

### Precedent to mirror
- `.planning/phases/23-version-display-bundle/23-CONTEXT.md` -- the
  requirement-text-correction-in-lockstep pattern (D-23-01/03) this phase
  repeats for the `"lsp"` token (D-24-03), and the catalog/fixture byte-equality
  lockstep (D-23-06 → D-24-07).
- `.planning/phases/22-reload-hint-discipline-family/22-CONTEXT.md` -- D-22-06
  catalog/fixture lockstep origin.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `REASONS` (`shared/notify.ts:69`) is the single closed-set source of truth
  (D-21-01); `type Reason` derives from it via indexed access, so the rename is
  one tuple edit + a type-driven compile cascade that surfaces every emission
  site the type touches.
- `composeReasons` (`:863`) is the SOLE reason-brace render chokepoint -- proof
  that option (b) was viable but rejected (D-24-02): purity beats a hidden
  render-time swap.

### Established Patterns
- **Detection vs. emission separation** is the core pattern here, exactly
  paralleling Phase 23's persistence-vs-display separation (PI-7 `hash-<12hex>`
  persists; `v#<7hex>` renders). Here: the manifest key `lspServers` is read &
  matched verbatim; the user-facing reason renders as `"lsp"`.
- The resolver populates `r.notes` as `"contains <kind>"` strings keyed on the
  raw manifest field name (`install.ts:1208-1218` documents this) -- which is
  precisely why detection substrings must stay camelCase (D-24-04).
- Catalog UAT byte-equality is the user-contract gate; rendered-output changes
  ship with catalog + fixtures in one commit (D-24-07, mirrors 22/23).

### Integration Points
- One tuple edit at `notify.ts:79` propagates through `type Reason` to two
  emission seams (`list.ts` `narrowResolverNotes`, `install.ts`
  `manifestFieldTokenFromNote`) and the structured fixtures fed to `notify()`.
- No edge-handler, completion-provider, resolver-logic, or persistence-layer
  behavior changes -- the resolver, schema, and state.json are all untouched.
</code_context>

<specifics>
## Specific Ideas

- Canonical example: a plugin manifest declaring `lspServers` renders
  `⊘ <name> (unavailable) {lsp}` (single carve-out) or
  `⊘ <name> (unavailable) {hooks, lsp}` (with `hooks`) -- replacing today's
  `{lspServers}` / `{hooks, lspServers}` byte forms at
  `docs/output-catalog.md:158,300`.
- The resolver note that drives detection is literally `"contains lspServers"`
  (camelCase, from the JSON key) -- the substring match against it must NOT
  change.
- Mapping shape (discretion): `{ hooks: "hooks", lspServers: "lsp" }` at the
  manifest-token→reason boundary.
</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope. (Scope was, if anything,
*tightened*: the rendered token shrank from the ROADMAP's `"lsp servers"` to
the user's `"lsp"`, and the stale-`shared/grammar/` hygiene was explicitly
pulled IN rather than deferred.)
</deferred>

---

*Phase: 24-grammar-consistency*
*Context gathered: 2026-05-29*
