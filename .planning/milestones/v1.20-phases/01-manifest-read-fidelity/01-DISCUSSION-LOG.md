# Phase 1: Manifest read fidelity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-12
**Phase:** 1-Manifest read fidelity
**Areas discussed:** Object dependency render form, Manifest-path agreement mechanism, Component-path normalization, Dependency source for info

---

## Object dependency render form

### Q1 — Render form for `{name, version, marketplace}`

| Option | Description | Selected |
|--------|-------------|----------|
| `secrets-vault@security-mp (~2.1.0)` | `@` keeps meaning marketplace, matching the project-wide address form; constraint in parens | ✓ |
| `secrets-vault@~2.1.0` | Upstream/npm-style, `@` means version; collides with `<plugin>@<marketplace>` | |
| `secrets-vault ~2.1.0 [security-mp]` | Brackets for marketplace; overloads the `[scope]` token instead | |

**Notes:** The deciding argument was token collision — `@` already addresses a marketplace in `install`, `uninstall`, and the existing `dependencies:` line.

### Q2 — Object omits `marketplace`

| Option | Description | Selected |
|--------|-------------|----------|
| Bare name + constraint | Render only what was declared; absence stays absent | |
| Fill in declaring marketplace | State the real resolution target, matching upstream semantics | ✓ |

### Q3 — Do bare strings get the same fill-in?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fill in both | One rule for both shapes; line never mixes filled and unfilled forms | ✓ |
| No — objects only | Leaves the existing catalogued byte form untouched | |
| Fill only if no `@` present | Treats an author-written address as authoritative | |

**Notes:** Q3's "fill in both" did not cover a bare string that already carries an `@`, which would have produced `helper@utils-mp@utils-mp` and rewritten the catalogued example at `docs/output-catalog.md:1765`. Raised as Q4 rather than resolved silently.

### Q4 — Bare string that already contains `@`

| Option | Description | Selected |
|--------|-------------|----------|
| Append unconditionally | Whole string is the name, per upstream's "a string is a name" reading | |
| Append only when no `@` | Author-written address stays verbatim; catalogued example stays valid | ✓ |

### Q5 — Sort key for a mixed array

| Option | Description | Selected |
|--------|-------------|----------|
| Rendered string | One code path; printed line is visibly in order | |
| Dependency name | Identity ordering that survives a change to the render form | ✓ |

### Q6 — Object with no usable `name`

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it silently | Narrower version of today's filter; `info` never errors on manifest content | ✓ |
| Render a placeholder | Keeps the count truthful, but adds a new catalog token | |

---

## Manifest-path agreement mechanism

### Q1 — What the two readers share

| Option | Description | Selected |
|--------|-------------|----------|
| Ordered candidate constant | Each site keeps its own read, validation, and error contract; smallest diff | ✓ |
| Shared path picker | Same verdict on WHICH file; adds a stat to the version path | |
| Full shared reader | Strongest no-drift guarantee, but puts the schema validator in the version path | |

### Q2 — What proves they agree

| Option | Description | Selected |
|--------|-------------|----------|
| Behavioral test over both readers | Plants a bare-manifest fixture; proves behavior, not wiring | ✓ |
| Source-grep architecture test | Catches a future third call site; breaks when code moves | |
| Both | Behavioral test plus a grep barring a fourth hardcoded join | |

### Q3 — Loop stop condition when candidate 1 exists but is malformed

| Option | Description | Selected |
|--------|-------------|----------|
| Stop — first existing file wins | Matches criterion 2; both loops identical in shape | |
| Continue — first parsable file wins | More forgiving; lets a bare file rescue a broken wrapped one | ✓ (initially) |

**Notes:** "Continue" was selected first, then reversed. It contradicted ROADMAP criterion 2 ("the bare file cannot change the outcome") in exactly one case — malformed wrapped plus valid bare — which would have required amending the criterion. Surfaced explicitly rather than reconciled silently; see the follow-up below.

### Q3b — Reconciling with criterion 2

| Option | Description | Selected |
|--------|-------------|----------|
| Amend the criterion — fallback is total | Keep "first parsable wins"; reword criterion 2 | |
| Keep the criterion — fallback is absence-only | A present-but-broken candidate stops the loop; criterion 2 and MANF-04 stand | ✓ |
| Split it — forgiving for version, strict for resolve | Honest about two contracts, but the readers-disagree shape criterion 1 warns about | |

### Q4 — Schema rejection vs parse failure

| Option | Description | Selected |
|--------|-------------|----------|
| Same rule as parse failure | One rule; a manifest we cannot use is a manifest we cannot use | ✓ |
| Stop on schema rejection only | Distinguishes "not a manifest" from "a manifest declaring something wrong" | |

### Q5 — EACCES on a present candidate

| Option | Description | Selected |
|--------|-------------|----------|
| Fall through silently | Matches today's treatment of an unreadable file as absent | |
| Surface as malformed | An unreadable manifest becomes a stated reason | ✓ |

**Notes:** Already the resolver's behavior today — `readManifest`'s `try` wraps the read, so an EACCES throw already lands on the malformed arm. The decision pins it so the version reader matches.

### Q6 — Where the constant lives

| Option | Description | Selected |
|--------|-------------|----------|
| New `domain/manifest-path.ts` | Small dedicated leaf; keeps existing files' purposes intact | ✓ |
| `domain/plugin-root.ts` | Adjacent subject matter, but scoped to the `CLAUDE_PLUGIN_ROOT` security brand | |
| `domain/components/plugin.ts` | Schema and location together, but it is a schema module, not a filesystem one | |

### Q7 — Telling absent from unreadable in the version reader

| Option | Description | Selected |
|--------|-------------|----------|
| Stat each candidate first | Mirrors `readManifest`; two structurally identical loops | ✓ |
| Branch on `err.code === "ENOENT"` | One syscall per candidate; readers stop looking alike | |

---

## Component-path normalization

### Q1 — Normalized dedup form

| Option | Description | Selected |
|--------|-------------|----------|
| `path.relative` from the resolved path | Reuses the resolve already computed; canonicalizes `./`, trailing `/`, `..`, separators | ✓ |
| String-level strip | Predictable, but leaves `a/../skills` as a distinct key | |

### Q2 — Stored value or dedup key only

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the stored value | One canonical form flows to every bridge; no user-visible bytes change | ✓ |
| Dedup key only | Preserves the declaration verbatim, at the cost of two spellings downstream | |

### Q3 — Case folding

| Option | Description | Selected |
|--------|-------------|----------|
| Case-sensitive key | Unchanged from today; correct on Linux | ✓ |
| Case-fold the key | Removes the warning everywhere, but collapses distinct Linux directories | |
| Out of scope | No known plugin declares a case-variant path | |

### Q4 — Empty string when the path resolves to `pluginRoot`

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize to `"."` | Preserves today's stored byte; array never holds an empty string | ✓ |
| Reject as invalid | A root-pointing component path is unactionable, but this changes an existing verdict | |
| Store the empty string | Fewest special cases; reads as a bug | |

---

## Dependency source for info

### Q1 — Read `dependencies` from `plugin.json`?

| Option | Description | Selected |
|--------|-------------|----------|
| Entry-only — status quo | Preserves warm/cold render symmetry; DEPS-01/02 is purely the filter fix | ✓ |
| Entry wins, `plugin.json` fills silence | Catches the upstream-primary case; breaks warm/cold symmetry | |
| Union of both sources | Most informative; same asymmetry cost plus a precedence question | |

**Notes:** Weighed against the fact that the resolver deliberately does not carry the manifest on its result (D-23-02 / NFR-7) and `info` re-resolves independently, so reading `plugin.json` here would mean a third independent manifest read.

### Q2 — Is Phase 3 bound to info's source?

| Option | Description | Selected |
|--------|-------------|----------|
| Free to differ — record why | Display and resolution are different contracts | ✓ |
| Same source, decided here | One answer for both, but decides Phase 3 before it is discussed | |

### Q3 — Where dependency parsing lives

| Option | Description | Selected |
|--------|-------------|----------|
| Extract `domain/dependencies.ts` now | Phase 3 reuses it instead of writing a second parser | ✓ |
| Keep it in `info.ts` | Smallest Phase 1 diff; risks a duplicate parser in Phase 3 | |

---

## Claude's Discretion

- Doc-comment wording and which requirement IDs each cites.
- Whether `MANIFEST_CANDIDATES` is typed as nested segment arrays or pre-joined relative paths.
- Test file placement and naming within the existing `tests/` layout.
- Whether `domain/dependencies.ts` exposes one function or a parse/render pair, so long as the marketplace fill-in stays out of the parse step.

## Deferred Ideas

- Case-variant component paths on case-insensitive filesystems — no known plugin declares one.
- PDEP-01's other half: whether the dependency note should also appear on `install` and `list`. DEPS-01/02 name `info` and only `info`.
- MIGR-01's staleness gate — named in REQUIREMENTS as a Phase 4 (PROV-04) dependency.
- Todo `2026-09-02-detect-unused-code-and-type-members.md` — matched on generic keywords, not subject matter. Not folded.
