# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **Behavior corrected vs V1 (COMP-01 / Gap 3):** Custom component-path arrays in plugin manifests (`componentPaths.skills`, `.commands`, `.agents`) now SUPPLEMENT the implicit-by-convention defaults rather than replace them. Previously, declaring `componentPaths.skills: "custom/skills"` would suppress detection of the default `skills/` directory; with this change, both the declared path AND the default convention path are included (deduplicated, first-wins on collisions). Resolver schema migrated from optional-string- per-kind to readonly-string-array-per-kind. PRD §6.4 PR-4 superseded by Phase 5 D-07. See `.planning/PROJECT.md` Key Decisions row D-24 and `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` D-07. Behavior change landed in Plan 05-03; documentation supersession trail landed in Plan 05-10.
