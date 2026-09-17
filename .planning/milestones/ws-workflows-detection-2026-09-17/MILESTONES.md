# Milestones

## workflows-detection Workflow Detection (Shipped: 2026-08-29)

**Phases completed:** 1 phases, 4 plans, 8 tasks

**Key accomplishments:**

- Fixed-directory workflow detection now reaches partial install without materializing or executing workflow files.
- Both schemas admit opaque workflow declarations, and both resolver modes classify every local workflow signal identically.
- Workflow sentinels stay source-only across rejection, rollback, retry, persistence, and reload discovery.
- One deduplicated `{workflows}` reason now has exact parity across consumers and three byte-locked terminal states.

---
