---
phase: "111"
slug: "workflows-bridge"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-09-09"
---

# Phase 111 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Run retroactively. All four plans carried a `<threat_model>` block, so the
register is plan-time authored and complete.

This is the bridge that **writes executable third-party JavaScript to disk**,
and the only bridge that deliberately writes **outside every scope root**. Two
properties therefore carry the phase, and each gets an explicit verdict below:
what confines the bridge instead of `assertPathInside`-to-scope-root, and
whether a partial failure can leave a half-written executable.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `meta.name` to artifact path | An untrusted declared name becomes a filesystem path under the engine home | Attacker-controlled string, screened by one composer |
| Plugin root to workflows dir | A declared `componentPaths.workflows` may point anywhere | Attacker-controlled relative path |
| Script bytes to envelope | Source is copied verbatim into an envelope the engine will execute | Fully attacker-controlled JavaScript |
| Staging to saved dir | Envelopes are staged then committed by rename | Same-filesystem move inside the engine home |
| Engine home vs scope root | Writes land in `~/.pi/workflows`, outside `<scopeRoot>` | The NFR-10 exception this phase creates |

---

## Threat Register

`T-111-SC` appears once per plan, which is what makes 25 numbered IDs total 29
rows.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-111-01 | Tampering | `workflowArtifactPath` composing an untrusted name | high | mitigate | `locations.ts:370-377` — `assertSafeName` before `path.join`, `assertPathInside` after; one refusal case per class at `locations.test.ts:598-644` | closed |
| T-111-02 | Elevation of privilege | symlink at the artifact leaf | high | mitigate | `path-safety.ts:105-116` lstats each segment, throws `SymlinkRefusedError`; `locations.test.ts:662-680` plants the link, asserts by class plus `linkPath`/`linkTarget` | closed |
| T-111-03 | Tampering | a second unguarded composer | high | mitigate | Sole composer `locations.ts:362-378`; exhaustive consumer set `stage.ts:230`, `:303`, `unstage.ts:50`. Closed at HEAD but **unguarded against reintroduction** — see Divergences | closed |
| T-111-04 | Tampering | project key climbing out of workflow home | medium | mitigate | `workflow-project-key.ts:47-56`; measured-literal parity rows `workflow-project-key.test.ts:89-107` | closed |
| T-111-05 | Information disclosure | key leaking the absolute project path | low | accept | `workflow-project-key.ts:60-64` is basename slug + 12 hex sha256, no salt, by engine-parity requirement | closed |
| T-111-06 | Tampering | `HOME`/`PI_CODING_AGENT_DIR` leaking out of a case | low | mitigate | `locations.test.ts:100-114` — saved, `t.after()` registered before mutation, `delete` for an absent variable | closed |
| T-111-SC (01) | Tampering | npm/pip/cargo installs | low | accept | Every import in the phase-111 files resolves to a `node:` builtin or an in-repo relative specifier | closed |
| T-111-07 | Information disclosure | absolute or parent-relative declared `workflows` path | high | mitigate | `discover.ts:423-427` — `assertPathInside(pluginRoot, workflowsDir)` on every declared entry, throws rather than warns; `discover.test.ts:648`, `:673` | closed |
| T-111-08 | Information disclosure | symlink under the workflows dir | high | mitigate | `discover.ts:88-90` — `lstat` then `admit: !isSymbolicLink()`, **before any read**; `discover.test.ts:277-306` also asserts the outside body never appears in the serialized discovery | closed |
| T-111-09 | Tampering | a silently mutated copy of executable code | high | mitigate | `discover.ts:261-268` — `Buffer.from(source,"utf8").equals(raw)` soft-fail; `discover.test.ts:386-411` writes `0xff 0xfe` and asserts the exact reason | closed |
| T-111-10 | DoS | one bad script failing a whole plugin | medium | mitigate | `discover.ts:466-469`, `:487-490` push a warning and `continue`; three tests each pair a failing file with an admissible sibling | closed |
| T-111-11 | Tampering | cross-bridge-kind import | medium | mitigate | `.fallowrc.json:119-120` restricts `bridges-workflows`; `npm run fallow` is a member of `npm run check` | closed |
| T-111-12 | Tampering | unstage removing a file we did not install | high | mitigate | `unstage.ts:41-53` loops over `previousWorkflowNames` only, path from the sole composer, **no `readdir` in the module**; `unstage.test.ts:59-86` asserts byte-identical foreign content | closed |
| T-111-13 | DoS | an unlink failure abandoning later names | medium | mitigate | `unstage.ts:74-81` accumulates non-ENOENT into `failed[]` and continues; `unstage.test.ts:130` | closed |
| T-111-14 | Tampering | process-global relocation leaking out | low | mitigate | `discover.test.ts:620-629` — descriptor captured, restore registered at `:626` **before** the mutation at `:629`. Mechanism differs from the plan — see Divergences | closed |
| T-111-SC (02) | Tampering | npm/pip/cargo installs | low | accept | Same import audit | closed |
| T-111-15 | Tampering | overwriting a hand-saved or foreign envelope | high | mitigate | `stage.ts:346-354` `assertTargetsUnoccupied`, called `:418` after displacement `:416` and before the first rename `:421`; `stage.test.ts:646-683` asserts all five promised properties | closed |
| T-111-16 | Elevation of privilege | symlink at the staging directory | high | mitigate | `stage.ts:215-216` anchors `assertPathInside` one level up so the staging segment is itself lstat'ed, and runs before `mkdir`; `stage.test.ts:405`, plus the `.previous` analog `stage.ts:313` / `stage.test.ts:1143` | closed |
| T-111-17 | DoS to Tampering | a concurrent scan seeing a partial envelope | medium | mitigate | The only `writeFile` is `stage.ts:232` into `stagingRoot`; the only scanned-directory touch is the `rename` at `:421`; `stage.test.ts:294`, `:562`, `:567` | closed |
| T-111-18 | DoS | a failed commit leaving untracked executables | high | mitigate | `stage.ts:432-438` reversal loop, `:487` `reportPlaced` on the throw path, `:491` on success; `stage.test.ts:908`, `:951` | closed |
| T-111-19 | Tampering | rollback deleting the only surviving copy | high | mitigate | `stage.ts:461-465` replaces cleanup with a leak string when any restore failed; `stage.test.ts:1064-1141` asserts the staging tree survives and the `.previous/` bytes are readable | closed |
| T-111-20 | Tampering | a silently mutated copy of executable code | high | mitigate | `stage.ts:99-105` — `script: admitted.source`, nothing evaluates it; `stage.test.ts:562` compares the whole committed file to a transcribed literal, so a reformat or EOL change fails | closed |
| T-111-21 | Spoofing | two scripts racing for one name | medium | mitigate | `stage.ts:183` runs `assertNoWorkflowNameCollisions` over the full verdict array **before** the staging root is created at `:206`; `stage.test.ts:354-379` asserts the staging dir was never made | closed |
| T-111-SC (03) | Tampering | npm/pip/cargo installs | low | accept | Same import audit | closed |
| T-111-22 | Tampering | a partial version bump | medium | mitigate | `extension-version.test.ts:9` hard-codes the version; `extension-version-sync.test.ts:24-27` compares constant to manifest; three sites agree | closed |
| T-111-23 | DoS | a bump firing convergence re-materialization | low | accept | Bump commit `b524524c` touches only version records | closed |
| T-111-24 | Repudiation | an assertion green while meaning the opposite | high | mitigate | `workflow-kind-inversion.test.ts:174-188` keeps the positive precondition and `:190-207` carries the inverted assertion. Module header now stale — see Divergences | closed |
| T-111-25 | Tampering | fixture text diverging from the envelope | medium | mitigate | `workflow-kind-inversion.test.ts:104` writes the body; `:200-204` compares the whole parsed envelope | closed |
| T-111-SC (04) | Tampering | npm/pip/cargo installs | low | accept | `git show b524524c -- package.json` is a version line only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-111-01 | T-111-05 | The project key is a basename slug plus a 12-hex sha256, unsalted, so it leaks the absolute project path to a reader of the key. The salt is omitted by **engine-parity requirement** — the host engine computes the same key, and diverging would put envelopes where the engine will not look for them. See also `[[R-110-01]]` in the Phase 110 artifact, which accepts the same property from the derivation side. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-111-02 | T-111-23 | The version bump cannot fire load-time convergence re-materialization, because the bump commit touches only version records. Rationale at `111-04-PLAN.md:134`. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-111-03 | T-111-SC (plans 01-04) | No package-manager install occurs. Verified by resolving **every** import in the phase's files: each is a `node:` builtin (`crypto`, `fs`, `fs/promises`, `os`, `path`) or an in-repo relative specifier. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-111-04 | IN-06 (adjacent to T-111-18) | A caller-supplied `onPlaced` that throws destroys the original error and every rollback leak string. Recorded at `111-VERIFICATION.md:137-147` and accepted as a non-blocking Info-level carry-forward. Not a register row. | operator (via verification), re-confirmed by gsd-security-auditor | 2026-09-09 |

---

## Verdict — containment

**Sound.** The bridge writes outside every scope root by design, so what
confines it instead was verified rather than asserted:

- **Not steerable by env override.** `platform/workflow-home.ts:28-30` is
  `path.join(os.homedir(), ".pi", "workflows")`, and the module imports only
  `node:os` and `node:path` — it reads no `process.env` at all, so
  `PI_CODING_AGENT_DIR` cannot relocate it. `locations.test.ts:498-530` proves
  this positively by building two bundles under two different
  `PI_CODING_AGENT_DIR` values and one home, then asserting the workflow roots
  are identical.
- **Not steerable by `cwd`.** Only `workflowsSavedDir`'s project middle segment
  derives from `cwd`, through `workflowProjectKey`, whose output character class
  is `[a-z0-9._-]` with an `|| "project"` fallback — a lone `.`, a `..` and every
  separator are unreachable outputs, pinned by measured-literal parity rows.
- **Not steerable by plugin input.** The untrusted `meta.name` reaches the
  filesystem through exactly one composer, which runs `assertSafeName` before
  `path.join` and `assertPathInside` after.
- **WPTH-02 holds.** `locations.test.ts:476-496` uses a relocated home **and a
  distinct project directory**, so the assertion cannot pass incidentally, and
  asserts both `underProjectDirectory: false` and `legacyProjectPath: false` —
  `<cwd>/.pi/workflows/saved` is never the value.

### One asymmetry, recorded rather than counted

`stage.ts:215` anchors the staging-root containment check one level **above** the
staging directory, precisely so a symlink planted at that segment is lstat'ed.
The **saved** directory gets no equivalent treatment: `commitPreparedWorkflows`
calls `mkdir(prepared.locations.workflowsSavedDir, {recursive: true})` at
`stage.ts:414` with nothing anchored above it, and `workflowArtifactPath` trusts
`workflowsSavedDir` as its own boundary. A symlink at `~/.pi/workflows/saved`
(or at `projects/<key>/saved`) would therefore be followed.

Practical significance is low — an attacker who can plant that link already has
write access to the user's home, which is outside the "careless or malicious
plugin author" model recorded at `path-safety.ts:70-74`. It is **not** a register
row and is **not** counted in `threats_open`; the register is closed and the
auditor was instructed not to invent rows. It is recorded here because the
reasoning at `stage.ts:207-214` was applied to the staging root and not to its
sibling, which is the kind of asymmetry that reads as deliberate later.

---

## Verdict — atomicity and rollback

**Sound.** A partial failure cannot leave a half-written executable envelope, and
a rename cannot land on content the plugin does not own:

- **No partial envelope is reachable.** Every byte is written by the single
  `writeFile` at `stage.ts:232`, whose destination is under `stagingRoot`; the
  only operation touching a directory the engine scans is the `rename` at `:421`.
  Staging is a sibling of the target under the engine's own root
  (`locations.ts:248`), keeping the rename same-filesystem rather than EXDEV —
  the property `stage.test.ts:615` pins by comparing `.dev`, not by asserting a
  rename succeeded.
- **Nothing renames over unowned content.** `assertTargetsUnoccupied` checks the
  **whole** target set after displacement and before the first rename
  (`stage.ts:418`), which is why `stage.test.ts:646` can assert `placed === [[]]`
  rather than a post-hoc reversal.
- **The CR-01 restore-failure branch is real.** `stage.ts:461-465` substitutes a
  leak message for `cleanupStaging` when any restore failed, and the message
  names `prepared.stagingRoot` — the path that **holds** the bytes, not the one
  they were headed for. `stage.test.ts:1064-1141` asserts the staging tree
  survives, the message names it, the `.previous/` copy is readable, and the two
  endpoints are distinguishable by directory.
- **The displacement/restore loop is ordered correctly.** Previous targets are
  moved aside rather than unlinked (`stage.ts:287-326`), the `displaced` array is
  caller-owned so a mid-loop throw still exposes completed moves (`:408`),
  restore runs **after** the new envelopes are reversed out (`:440-455`), and
  CR-02 filters a reclaimed target out of both the placement report and the leak
  text through one predicate (`:482-487`), so a caller's removal payload cannot
  delete bytes the rollback just recovered.

---

## Divergences

1. **T-111-03's declared regression control does not exist.** The mitigation
   plan (`111-01-PLAN.md:206`) says "a prohibition in this plan **and a source
   assertion in the acceptance criteria** keep a bare join out of the bridge."
   No such acceptance criterion exists in either plan, and no persisted
   architecture gate scans the workflows bridge for a bare join —
   `no-probe-in-workflows-bridge.test.ts` covers probe surface only. The
   substantive property was verified exhaustively at HEAD (one composer, three
   consumers, zero bare joins), so the threat is closed **now**; it has no guard
   against reintroduction. A durable gate belongs beside the existing
   `assertNoForbiddenSurface` pattern in `tests/architecture/source-scan.ts`.

2. **T-111-14 was delivered by a different mechanism than declared, and the
   substitute is better.** The plan promised "the relocating cases are marked
   non-concurrent." The implementation deliberately does not, and says why at
   `discover.test.ts:600-605`: a `concurrency` option governs a case's
   **subtests**, and this case has none, so isolation comes from `node:test`
   running one file's top-level cases in sequence. The descriptor-capture half is
   present as written.

3. **T-111-24's test module header now contradicts its own assertion.**
   `workflow-kind-inversion.test.ts:24-26` still reads "WLIF-01 is not wired, so
   the install still writes nothing under the engine's storage root," while
   `:190-196` asserts "the install itself now drives the bridge." Later lifecycle
   wiring re-inverted the assertion and left the header behind. The assertion is
   correct and both halves survive, so the threat is closed — but this is exactly
   the drift class T-111-24 exists to prevent, one layer up in the comment rather
   than in the assertion.

4. **No summary carries a `## Threat Flags` section.** That is absent, not empty:
   the executor's new-attack-surface channel produced nothing to cross-check, so
   the register's completeness rests entirely on
   `register_authored_at_plan_time: true` rather than on executor confirmation.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 29 | 29 | 0 | gsd-security-auditor (retroactive, opus) |

Register parse: 29 rows across 4 plans — 7 / 9 / 8 / 5. Matches the
orchestrator's independent mechanical count, so no plan was audited as a subset.
This is the largest register of the five phases audited in this batch.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
