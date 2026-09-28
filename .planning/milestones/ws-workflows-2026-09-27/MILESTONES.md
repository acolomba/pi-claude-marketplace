# Milestones

## workflows-replay -- Workflow Bridge Replay onto main (Completed: 2026-09-21 on `features/workflow`; unmerged, no npm release yet)

**Phases completed:** 9 phases (109-117), 39 plans, 83 tasks; executed 2026-09-04
to 2026-09-09, debt cleared and archived 2026-09-21

**Driver:** Phases 101-105 shipped the `workflows` bridge on
`features/workflows-spike`, and that branch was never merged: main had since
admitted `workflows` as an *unsupported* kind (PR #154) and deleted the test
architecture the spike was written against (PR #167). A merge would have been
re-deriving the wiring while calling it a merge, so the bridge was replayed
phase by phase onto main -- the 36 requirements, phase records and spike
evidence carried over, the wiring and every test rewritten -- and the three gaps
the original bridge shipped with were closed in the same milestone.

**Key accomplishments:**

- `workflows` inverted from `UNSUPPORTED_COMPONENT_KINDS` to both supported
  tuples, with every closed set, classifier arm, doc and locking test that #154
  wrote turned with it; a plugin carrying workflows now resolves `installable`.
- The bridge re-landed against the owner-test convention with no test-only
  seams: one acorn parse decides a script's fate (command name from `meta.name`,
  nine non-admission causes, a determinism blocklist), naming is engine-parity
  gated, the three `$HOME`-derived roots and the `workflowArtifactPath`
  chokepoint are containment-checked, and prepare/commit/abort staging refuses
  an occupied target before its first rename and rolls back both ways.
- Every lifecycle verb owns its workflow envelopes: install's sixth ledger phase,
  cascade unstage across all four removal verbs, reinstall re-materialization,
  update's two-write inventory that can strand no executable code, enable and
  disable, the `info` and `list` read surfaces, and one `stale workflow command`
  reason token stamped by six verbs.
- The host engine became the third soft dependency -- `requires
  pi-dynamic-workflows` on every marker-bearing row, envelope bytes proven
  independent of the probe, marker coverage held by a gate rather than a grep --
  and `docs/workflows-compatibility.md` writes down the contract of the one
  bridge that installs executable code.
- The three original gaps closed: an author whose script the engine will refuse
  learns which of six gates refuses it at install time, and nothing a gate reads
  can block; a plugin installed before the kind was admitted converges after one
  reload, exactly once, with `components now supported` saying why; and the
  degrade-or-die claim was measured against a real engine 3.10.1 -- which
  refuted the source read (a recoverable `agent()` failure resolves to `null`)
  -- with every document restated at the grade that holds.
- Closed with no accepted debt: 46/46 requirements, 9/9 phases verified,
  threat-verified (`threats_open: 0`) and Nyquist-validated; all twelve
  `[workflows-replay]` ledger entries fixed or waived with named `BACKLOG.md`
  carriers (VSTALE-01, WLREC-01, RLHINT-01, PCERR-01, WSTOR-01, WPIN-01). The
  close-out itself fixed a held-lock reason token (#82), a saved-directory
  symlink asymmetry (#75), and a ledger citation the #202 merge had renumbered
  out from under phase 117.

---

## workflows Claude workflows Component-Kind Bridge (Shipped: 2026-08-16)

**Phases completed:** 5 phases, 20 plans, 39 tasks

**Key accomplishments:**

- `workflows` admitted to both resolver tuples on the convention axis as well as the manifest axis, with a required `componentPaths.workflows` member and a `workflows:` line on `/claude:plugin info`
- Twelve cases across both resolution modes pin the `workflows` admission matrix the shared collector delivers for free — declared forms, union order, dedup comparator, silent absent path, containment parity, and the loose-mode negative
- A rendered `workflows:` line is now under the project's binding byte-equality contract, landed with its paired fixture in one commit, and every surviving `info` prose statement of the render order names all six kinds
- The two behaviors that shift as a consequence of admitting `workflows` -- the reconcile self-heal and the disabled-record pin refresh -- are pinned as intended, one-time, and non-materializing, with no production file edited
- A workflow script now names its own command: acorn parses the source, `meta.name` is read off the AST, and `generatedWorkflowName` joins it to the plugin under both the RN-2 rules and the host engine's length and trim rules.
- Every non-admitted shape now has its own verdict: an unreadable name is skipped, a broken or nondeterministic script is refused by file with the real reason, and two scripts claiming one command name fail loudly instead of one silently winning.
- The home-directory seam.
- The parity suite.
- The soft-fail warnings.
- One stem rule, exported.
- Extracted the hermetic workflow-home double into `tests/helpers/workflow-home.ts` and taught `update.test.ts`'s fixture builders to name individual workflow scripts, so the rest of the phase can write its assertions without duplicating a function ESLint forbids duplicating.
- `cascadeUnstagePlugin` now calls six bridges instead of five, so `uninstall`, `disable` and `marketplace remove --cascade` physically remove the workflow envelopes they used to orphan — and a removal that fails reports per-name reasons through a typed error instead of vanishing.
- `previousWorkflowNames` finally has a production supplier, so the bridge's re-stage branch runs for the first time — and in the same commit a workflow commit stopped renaming over content the plugin does not own.
- `update` now prepares, aborts, commits and records workflows as a sixth bridge, so an author's workflow fix reaches the user and a withdrawn workflow stops running — and the closed phase set turned out to have three mirrors, not two.
- Reinstall now re-materializes workflow envelopes from the plugin source and records the names it actually wrote, and the commit-in-place choice is documented as a decision with its residual window named rather than left to be read as an oversight.
- A removal that took a workflow now says so on its own row -- the removed command stays registered and runnable until reload, because the host exposes no unregister call -- and it says so only when a workflow was actually removed.
- The host workflow engine becomes the third soft dependency: probed by its distinctive `workflow_control` tool, marked as `requires pi-dynamic-workflows` on the install / update / reinstall / enable rows, and byte-pinned in two new catalog states — while the envelopes are still written and the install still succeeds.
- Every surface that can render a soft-dependency marker now renders the host-engine one, and a gate — not a grep — is what says so: reverting any one of the seven `Dependency[]` derivations turns exactly one case red.
- "The artifacts do not depend on the probe" stops being a claim: two installs differing only in the session's tool list now write the same envelope bytes, the workflows bridge is structurally forbidden from naming a probe symbol, and the live canary carries an assertion that a real engine finds an envelope installed without it.
- The contract of the one bridge that installs executable code is now written down: which engine runs a third party's JavaScript, how tightly that engine is sandboxed against the alternative it was chosen over, which script shapes install and then refuse to run, and which of those claims were measured versus read.

---
