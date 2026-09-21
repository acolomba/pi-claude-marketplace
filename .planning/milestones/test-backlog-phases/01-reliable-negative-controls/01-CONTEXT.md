# Phase 1: Reliable Negative Controls — Context

<domain>
Repair NEGCTL-01 and reconcile E2EIMP-01, TESTQ-01, FLOW-07, COV-01 from live evidence.
</domain>
<decisions>
- User authorized all backlog work, autonomous routine decisions, existing branch only.
- Preserve 100% aggregate unit coverage and all direct-pair pin readings/assertions.
- Observe child launch, signal, exit status, and intended diagnostic independently.
- Do not treat arbitrary nonzero exit as a valid negative control.
- No substantive product choice is needed for this phase.
</decisions>
<code_context>
`test-coverage-direct.negative.mjs` spawns the CLI twice and ignores `error`.
The mapping CLI emits the exact diagnostic with process.stderr.write and sets exitCode=1.
Node 26.8.2 under this sandbox reports EPERM for default pipes; ignoring stdin removes
that parent error but still loses diagnostic bytes. Both CLI and a one-line sentinel
capture correctly outside the sandbox. stdout/stderr union cannot repair missing bytes.
</code_context>
