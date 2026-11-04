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
