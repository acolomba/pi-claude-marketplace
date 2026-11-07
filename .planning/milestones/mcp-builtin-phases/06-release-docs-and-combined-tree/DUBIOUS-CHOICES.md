# Phase 6: Dubious Choices

Choices made without the user during the autonomous run. The parent session
copies each entry into the root log.

## Smart discuss (06-CONTEXT.md)

- **P6-DC-01 (Medium):** DUAL-04 extends Phase 2's switch scenario with a
  `{requires mcp}` read after the adapter is removed (D-P6-05), and adds no
  separate scenario. The alternative is a new scenario that repeats the
  install and the restarts.
- **P6-DC-02 (Medium):** a frozen export that still has no consumer loses its
  `export` or is deleted, and is not kept under `ignoreExports` (D-P6-08). The
  alternative is to keep it for a future consumer.
- **P6-DC-03 (Medium):** the parent lines that are not docs or records go to
  BACKLOG.md, except the eight code changes D-P6-10 lists (D-P6-12). The
  alternative is to apply more of them now, such as P5-DC-15.
- **P6-DC-04 (Low):** the Pi 1.5.0 RPC defect is drafted in BACKLOG.md and is
  not filed upstream (D-P6-11).
- **P6-DC-05 (Low):** the previous milestone's root log moves to
  `.planning/milestones/component-features-DUBIOUS-CHOICES.md`, and the new
  root log takes its path (D-P6-14).
- **P6-DC-06 (Low):** the codebase maps get targeted edits, and
  `/gsd-map-codebase` is not re-run (D-P6-15).
- **P6-DC-07 (Low):** a CI behavioral timeout changes only above 80% use
  (D-P6-16).
- **P6-DC-08 (Low):** the version bump and the PR wait for the user review
  (D-P6-17).
- **P6-DC-09 (Low):** the CHANGELOG folds the existing Pi 1.5.0 bullet into
  one milestone lead bullet with sub-bullets (D-P6-01).

## After research (06-RESEARCH.md)

- **P6-DC-10 (Medium):** the DUAL-04 read is `/claude:plugin list`, and a
  read-only `list` does not count as a "plugin command" (D-P6-18). The
  alternative is reading through the extension's LLM tool in a model turn,
  which renumbers every later call.
- **P6-DC-11 (Medium):** all nine stale `requires: pi-mcp-adapter` catalog
  blocks change, not only the two the parent lines name (D-P6-19).
- **P6-DC-12 (Low):** no closed-set entry is removed, since each has an
  emitter (D-P6-20).
- **P6-DC-13 (Low):** `StoredMcpCompatibility` and `LegacyServers` stay
  exported, against the letter of D-P6-08. `LegacyServersUnreadableError`
  is unexported, so its test moves from `instanceof` to matching `name` and
  `reason` (D-P6-21).
- **P6-DC-14 (Medium):** P3-DC-22 gets a cucumber pair that calls the
  completion provider in-process with the profile's implementation. The
  observation does not go through Pi's terminal UI (D-P6-22).
- **P6-DC-15 (Medium):** UF-1 (a low-severity advisory) changes the former
  frozen `LegacyServersSource` interface across about nine call sites
  (D-P6-23). The alternative is to accept the risk in SECURITY.md.
- **P6-DC-16 (Low):** D-MB IDs are minted for seven more cited P2-DC IDs
  (D-P6-24).
- **P6-DC-17 (Medium):** D-CF1-16's 1.5-times rule replaces D-P6-16's 80% rule
  (D-P6-25).
- **P6-DC-18 (Low):** the 02-08 status examples become prose and table rows,
  not counted catalog states (D-P6-26).
- **P6-DC-19 (Low):** P2-DC-18 is only a file move to
  `features/lib/upstream/tool-search.ts`. The separate projection step
  stays, which leaves a second projection path.
- **P6-DC-20 (Low):** the Elicitation rows in `docs/hooks-compatibility.md` may
  be reworded to name Pi's built-in MCP. That wording is not checked against
  a source.

## After pattern mapping (06-PATTERNS.md)

- **P6-DC-21 (Low):** the completion cache keys its file name by the MCP
  implementation, so the file shape does not change and `schemaVersion`
  stays 6. The alternative is a new field with a schema bump.
- **P6-DC-22 (Low):** a containment failure in the legacy reader gets its own
  internal reason, `uncontained`, if no notification closed set carries the
  reasons. Otherwise it maps to `root-mismatch`. The planner checks the lock
  tests.
