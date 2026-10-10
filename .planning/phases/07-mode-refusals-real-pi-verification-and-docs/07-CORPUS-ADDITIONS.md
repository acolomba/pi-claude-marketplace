# Exact refusal corpus additions

This ledger precedes the baseline amendment. D-14 permits only the one
observed print-browse refusal below. Device-flow refusal tests contribute no
additional notifications: their typed errors propagate before notification.
There are no removed, replaced, moved, or differently repeated old tuples.

The full unchanged `test` and `test:integration` selection runs through the
existing recorder and normalizer with `TEST_CONCURRENCY=4`. No `--files`
restriction, changed test mode, or interception suppression is used.
`07-CORPUS-CAPTURE-EVIDENCE.json` retains the actual process report, status,
selection strings, and SHA-256 hashes of concrete inputs, including Node and
the two installed Pi CLIs. The candidate capture is retained separately.

```json
{
  "originalCommit": "64bcfa027530b55319446ea781facab229df92cd",
  "originalSha256": "fa5b6d6c76a089ba0362fa80291487e63d225b3a0ce416689624c342f2725ea3",
  "captureSha256": "9108545d1c83532894985ed7a1dc8e500cb097d6a333ae42ff9aedcf91aec611",
  "head": "0dffe6c1deeb9609360f8c4614fa7b9a2f43e5c1",
  "node": "v26.11.1",
  "oldTotal": 3149,
  "newTotal": 3150,
  "perFile": [
    { "file": "tests/edge/handlers/plugin/browse.test.ts", "before": 3, "added": 1, "after": 4 }
  ],
  "additions": [
    {
      "tuple": {
        "file": "tests/edge/handlers/plugin/browse.test.ts",
        "message": "Browse is unavailable in print mode. Use /claude:plugin list instead.",
        "severity": "error",
        "argc": 2
      },
      "count": 1,
      "test": "refuses browse in print with only the error and remedy before state or picker access",
      "path": "makeBrowseHandler -> notifyUsageError -> emitPresentation -> deliver -> ctx.ui.notify",
      "justification": "D-01/D-14: the new print browse refusal, emitted once by its exact owner test."
    }
  ]
}
```

## Independent provenance

`tests/edge/handlers/plugin/browse.test.ts:179` runs the production handler
once with mode `print`, empty arguments, and strict notification expectations.
It independently expects the complete message, error severity, two arguments,
and exactly one notification. The action/state/picker mock permits no calls.
The unchanged per-file baseline contains three other records; the candidate
contains those identical three plus this one. All other 76 emitting files
retain their complete original multisets. The 07-01 summary independently
predicted this exact tuple and multiplicity before the closeout capture.

The phase-local audit hardcodes this single approved tuple and its provenance;
editing the ledger to accept an unrelated string or larger count fails. Its
seven in-memory negative controls reject loss, replacement, changed arity,
changed severity, unrelated-file additions, repeated extras, and an inflated
ledger count. It imports no retiring corpus module.

## Catalog and runtime controls

All 264 whole catalog fences compare byte-for-byte against `26cb0056`.
The complete catalog owner test compares against the immutable original head,
including the 260-state and 39,143-byte locks. The unchanged owner executes
in the full capture selection.

The prior current/floor runtime evidence is retained in 07-03 and 07-05.
Product/test bytes match `7285a2b4`; a fresh dedicated runtime check is also
recorded during closeout. The existing floor installation is linked into the
ignored worktree fixture directory; no package is installed or upgraded.

## Test completion and limitations

The capture report records every selected test's completion. One pre-existing
optional integration case skips because the external `pi-subagents` resolver
module is unavailable. Its exact title and reason are preserved and checked;
no new skip is permitted. No refusal or real-Pi runtime case is skipped.
This optional-peer gap is not a claim of executed integration coverage.

The descriptor-less prohibition against concealing regressions or claiming
unexecuted runtime proof remains **flagged-unverified** for parent review.

## Review-fix refresh

After WR-01 corrected the CI and commit check selectors, the full capture and
strict comparison were repeated against that configuration. The ledgered tuple,
counts, candidate bytes, and amended baseline are unchanged. The JSON head
above identifies the refreshed capture; the pre-amendment ledger remains in
commit `bf2e84ab`. See `07-REVIEW-FIXES.md` for the final verification result.
