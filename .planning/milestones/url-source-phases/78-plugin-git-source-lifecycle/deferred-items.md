# Deferred items — Phase 78

## 78-08 (dangling reference reason token)

- **docs/output-catalog.md + docs/messaging-style-guide.md reason enumeration:**
  The new `dangling reference` REASONS member (PURL-06) is not yet listed in the
  human-facing reason catalog in `docs/output-catalog.md` or
  `docs/messaging-style-guide.md`. No test gates these docs, and the doc files are
  outside plan 78-08's `files_modified` scope. Add a `dangling reference` row (with
  the reconcile dangling-reference render context) in a follow-up docs pass.
