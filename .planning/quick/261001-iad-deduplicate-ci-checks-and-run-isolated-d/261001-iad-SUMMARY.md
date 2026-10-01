---
quick_id: 261001-iad
status: complete
description: Deduplicate CI checks and run isolated direct coverage pairs concurrently
---

# CI deduplication and parallel direct coverage

CI now runs unit coverage, integration tests, and pinned end-to-end tests once
each. Sonar consumes the successful check job's unit report from the same workflow
run. The lint workflow keeps the unique repository hooks and separate Fallow
audit. Local commit hooks and the full npm check remain enabled.

Direct coverage now runs independent pairs through a bounded asynchronous worker
pool. Each pair keeps a separate process, temporary directory, and coverage file.
The default limit is the smaller of four and the available CPUs;
`TEST_CONCURRENCY=1` restores serial execution. The reporting command uses the
same pool. Output stays grouped by pair, results retain input order, and failed
workers stop new work while active workers finish and clean up.

## Commits

- `aedc153a`: CI ownership, same-run coverage reuse, and workflow assertions.
- `b0d45f4f`: concurrent coverage, negative controls, and contributor guidance.

## Verification

On Node 24.21.0, all 251 production/test pairs passed the parallel gate. The
serial report measured the same 251 pairs: 241 complete and 10 type-only. Every
source path, test path, coverage reading, and runtime matched exactly.

The four-worker gate took 145.13 seconds; the serial report took 571.54 seconds.
This is an observed 3.94x speedup. Other checks shared the machine, and the two
commands have slightly different reporting overhead, so this is an indicative
measurement rather than a controlled benchmark or a GitHub runner prediction.

The pool controls passed on Node 24 and Node 26. They cover bounded overlap,
serial execution, stable returned order, streamed completion order, invalid
limits, empty selections, worker failure, draining, and callback failure.
Existing pin and report-completeness controls also passed.

The full `npm run check` passed in 1,475.91 seconds. It passed 7,456 unit tests
with 100% production line, function, and branch coverage, plus 36 integration
tests. All seven member negative controls passed. The member gate passed with
its four existing exceptions.

All applicable pre-commit hooks passed after their YAML and Markdown formatters
were rerun. This includes ESLint, type checking, formatting, Fallow, workflow
checks, changed-pair coverage, the member gate, and zizmor. The Fallow audit
passed before each code commit; its reported duplicate was inherited.

Socket tests ran outside the sandbox. Node 24 was installed under `/tmp` to match
CI; no project dependency or lockfile changed. Workflow assertions and security
validation passed locally. Artifact transfer and the nested Sonar job still need
a real GitHub Actions run. No push, PR, version bump, or publish was performed.

## Deviations

The publish workflow now grants its reusable CI call read access to pull request
metadata, so the nested Sonar workflow cannot request permissions beyond its
caller. Sonar remains skipped on release tags and receives no release secret.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was
introduced. Coverage downloads remain scoped to the current run. Fork and
Dependabot guards remain in place; no privileged trigger was added.

## Follow-up

The approved local-work improvements remain in the plan: incremental TypeScript
checking, changed-file formatting, conservative affected-file checks, separate
module/architecture/analyzer test commands, and local gate scheduling. Full
uncached typed ESLint remains required at the completion boundary.
