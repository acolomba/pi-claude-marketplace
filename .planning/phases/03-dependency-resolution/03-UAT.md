---
status: testing
phase: 03-dependency-resolution
source: [03-VERIFICATION.md]
started: 2026-09-15T00:00:00Z
updated: 2026-09-15T00:00:00Z
---

## Current Test

number: 1
name: Read the rendered cascade block in a live Pi session
expected: |
  One legible row per cascade member beside the requesting plugin's row;
  wrapping is readable; row ordering makes sense against a closure longer
  than two members; a failure's remedy sentence (e.g. `Run marketplace add
  <source> to add it.`) is a sentence an operator would actually act on.
awaiting: user response

## Tests

### 1. Read the rendered cascade block in a live Pi session

Install a plugin that declares dependencies against a real Claude marketplace
over the network, and read the rendered cascade block in a live Pi session.

expected: One legible row per cascade member beside the requesting plugin's row; wrapping is readable; row ordering makes sense against a closure longer than two members; a failure's remedy sentence (e.g. `Run marketplace add <source> to add it.`) is a sentence an operator would actually act on.
why_human: Every case in the cascade messaging test drives a seeded fixture or a composed row through a fake host. No fixture settles subjective legibility, wrapping, or whether prose reads as actionable — that is a judgment call requiring a human reading real terminal output (03-06 SUMMARY D10, human_judgment: true).
result: [pending]

### 2. Resolve a constrained dependency against a real git host

List a real repository's tags (including at least one annotated tag), and drive
a private-repository credential challenge through the tag probe.

expected: `listRemoteTags` (platform/git.ts) correctly reads the real wire protocol's tag advertisement and peels an annotated tag to its commit; a private source's credential challenge is answered by the existing host credential bundle with no separate prompt.
why_human: Every `dependency-tag-probe.test.ts` and `git.test.ts` case in this phase drives a faulted/fake transport double, never a live `isomorphic-git` wire exchange. The real `listServerRefs({ prefix, peelTags })` behavior against a real remote, and a real credential challenge, are unobserved (03-04 SUMMARY D8, 03-05 SUMMARY D12, both human_judgment: true).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
