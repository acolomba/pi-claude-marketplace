# Revalidation Ledger Schema

The canonical ledger is strict JSON with `version`, `inventoryMode`, `files`,
`sourceClaims`, `findings`, `decisions`, and `scopeChanges`. Arrays use stable
bytewise identity order. Stored paths are repository-relative POSIX paths.
Absolute paths, `.`/`..` segments, missing targets, and symlink escapes are
invalid.

## Identities and links

- A file path is its identity and appears exactly once.
- A source claim ID is `<corpus-path>#<label>`. Unlabelled claims use
  `CLAIM-001`, `CLAIM-002`, and so on in document order.
- Every source claim links to exactly one canonical finding. Equal prose does
  not merge claims. Duplicate findings use `duplicateOf`; the link must be
  acyclic and terminate at a non-duplicate finding.
- Finding, decision (`MF-DEC-NN`), and scope-change IDs are unique.

## Closed vocabularies

- File categories: `first-pass`, `adversarial`, `control`.
- Review status: `pending`, `complete`, `superseded`.
- Derived outcomes: `unreviewed`, `live findings`, `no live findings`,
  `control document`, `superseded`.
- Evidence status: `confirmed`, `stale`, `superseded`, `duplicate`,
  `inconclusive`.
- Routes: `Phase N`, `evidence-only closure`, `deferred backlog`, or
  `operator decision`.
- Validation methods: `behavioral-probe`, `surviving-mutation`, or
  `static-proof`.

## Evidence and completion

Every finding records current source and test references, validation details,
rationale, and destination. An unavailable reference is `{ "path": "N/A",
"reason": "..." }`; omission is invalid. Behavioral probes and mutations
record a redacted command, integer exit code, and observation. Static proof
records a tool and observation. Commands and observations must not contain
credentials, tokens, home paths, or network authorization.

A file is complete only when its enumerated `claimIds` exactly match linked
source claims and each claim reaches a reconciled finding. A zero-claim file
must explicitly finish as `control document`, `no live findings`, or
`superseded`. `inconclusive` evidence remains blocking unless incomplete mode
is explicitly requested.

## Decisions, scope, and shards

A resolved decision requires terminal premise findings, proof, at least two
options, one selection, rejected alternatives, affected IDs, a recommendation,
and downstream consequences. Scope changes link requirements/phases to the
findings and decisions that justify them and preserve historical IDs.

Each shard names exactly one assigned plan and only its assigned file paths.
Merging requires every assignment shard and follows assignment order. Missing,
extra, repeated, or interrupted shards cannot yield a complete ledger.

`01-REVALIDATION.md` is generated only by the renderer. Validation compares it
byte-for-byte with the canonical JSON rendering and requires a final newline.
