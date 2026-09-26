---
status: resolved
trigger: "wait no i don't want to test with anthropic credentials. this needs to work with an openai model too. why are you asking me that? and you can prepare a sandbox, like you did before. or i can uninstall the plugin and reinstall it"
created: 2026-09-22
updated: 2026-09-22
---

## Current Focus

hypothesis: CONFIRMED — the original OpenAI child-tool failure was the Pi 0.85.1/0.87.0 ModelRuntime protocol skew, and the real Pi 0.86.1 UAT now proves native child tools work. The completed run's pending delivery, stale status heading, and contradictory credential disposition are independent follow-up defects.
test: Completed canonical run/result/event/session inspection plus installed pi-dynamic-workflows 3.13.0 delivery and status code tracing.
expecting: Observed 12/12 native structured outputs with no fallback markers; observed a completed run with a durable pending-delivery marker; located the stale-heading call and fail-closed no-send delivery branch; located line-sensitive finding dedup that lets the same ignored credential receive conflicting verdicts.
next_action: Terminal for openai-workflow-child-tools. Track delivery/status and security-result semantic dedup as separate defects; no further human checkpoint is required for native OpenAI child-tool execution.
bug_class: bohrbug
reasoning_checkpoint:
  hypothesis: Engine 3.13.0 drops workflow-child tools because its Pi 0.87.0 child encodes tools as transcript system-message declarations while the injected Pi 0.85.1 host ModelRuntime serializes only context.tools.
  confirming_evidence:
    - A clean Pi 0.85.1 host reproduced SCHEMA_NONCOMPLIANCE with a populated child registry and no tool calls.
    - The identical clean workflow succeeded under Pi 0.86.1, and also succeeded under Pi 0.85.1 after only the disposable engine's host-ModelRuntime injection was removed.
  falsification_test: If the unchanged clean Pi 0.85.1 host serialized any child tools, or if removing only its ModelRuntime injection still produced NO_TOOLS, the hypothesis would be false.
  fix_rationale: Keeping the child session and provider runtime on the same transcript-tool protocol preserves the declared tools; Pi 0.86.1 already uses the compatible protocol, while the durable upstream engine fix is to avoid injecting an incompatible host runtime.
  blind_spots: The synthetic probe covers the required OpenAI child path but not every third-party provider or every future Pi protocol revision; the original multi-agent workflow still needs user confirmation in its real workload.
  candidate_causes:
    - code: pi-dynamic-workflows passes a host ModelRuntime into createAgentSession from a separately resolved Pi SDK.
    - environment: separately installed Pi 0.85.1 and engine-nested Pi 0.87.0 straddle the tool-context protocol change.
    - config: old sandbox model-store overrides could have removed tools, but a clean auth-only Pi 0.85.1 sandbox reproduced the failure.
    - data: the original project prompt could have confused the model, but a harmless one-line synthetic file reproduced under 0.85.1 and passed after runtime alignment.
  and_gate: yes; both the cross-SDK runtime injection and the 0.85.1/0.87.0 protocol skew are required. Either a compatible host runtime or a child-owned runtime succeeds.
tdd_checkpoint: null

## Symptoms

expected: An official Claude plugin workflow running through pi-dynamic-workflows with an OpenAI model gives each workflow child agent its declared filesystem tools and the engine's structured_output tool, and the child returns valid structured results.
actual: The workflow completes orchestration, but every child reports that no tools are available and types a structured_output tag as prose. The full code-modernization workflow returns no useful findings, and the minimal one-agent probe fails the same way.
errors: The engine reports "Subagent did not produce valid structured_output", "structured_output recovered from prose extraction (the model never called the tool)", or SCHEMA_NONCOMPLIANCE. The child transcript contains no offered tool definitions.
reproduction: In a disposable Pi sandbox authenticated only with openai-codex, load the worktree extension and pi-dynamic-workflows 3.13.0, then run either code-modernization:modernize-harden-scan or the minimal one-agent file-reading probe and inspect the run events JSONL.
started: First measured on 2026-09-22. Tool calling works in the main Pi session with the same OpenAI provider; whether engine-spawned OpenAI child sessions ever worked is unknown.

## Eliminated

- hypothesis: The bridged workflow agentType is unknown to the engine.
  evidence: The naming defect was fixed; the engine resolves the declared colon-qualified name and binds the configured allowlist, while the minimal probe still fails.
- hypothesis: OpenAI tool-search deferral hides the tools.
  evidence: Disabling supportsToolSearch for all available models in the sandbox changed nothing.
- hypothesis: A different OpenAI model fixes the failure.
  evidence: gpt-5.5 and gpt-5.6-terra fail identically; model selection is not the discriminating boundary.
- hypothesis: The workflow plugin or bridge causes the failure.
  evidence: A minimal one-agent probe that only asks for one file name fails identically.
- hypothesis: The engine calls a removed Pi API.
  evidence: Pi 0.85.1 still declares customTools on createAgentSession, matching the engine call.
- hypothesis: Tool definitions disappear between the engine customTools array, Pi child-session registry, and the OpenAI Codex request serializer.
  evidence: The instrumented clean probe showed read and structured_output in the engine list, active child registry, transcript declarations, and final OpenAI request body on every turn; the OpenAI model then called both tools and returned the expected structured value.
- hypothesis: Old sandbox model configuration or tool-search overrides removed the tools.
  evidence: A clean auth-only sandbox with no copied settings or model-store overrides reproduced the failure under Pi 0.85.1.
- hypothesis: The original repository prompt or project data caused the model to decline tool use.
  evidence: The Pi 0.85.1 failure reproduced against a one-line synthetic file outside the repository, and the identical prompt passed after only runtime alignment changed.

## Evidence

- timestamp: 2026-09-22
  checked: Exact run and session identifiers under the standard /home/acolomba/.pi workflow root and repository tmp/pi-uat root.
  found: The workflow run has a primary JSON record, backup JSON record, and JSONL event stream at /home/acolomba/.pi/workflows/projects/demo-3cf4f721dd6d/runs/. The exact session UUID does not occur as file content under tmp/pi-uat.
  implication: Execution evidence is in the normal homedir-backed workflow store; the Pi session must be resolved from the session-store directory or filename convention rather than content search.
- timestamp: 2026-09-22
  checked: All three persisted events and the materialized index for run modernize-harden-scan-mudf8du9-7revtc.
  found: Sequence 1 started the run with args {_raw: "", _: ""}; sequence 2 persisted a pending failure message for missing {system}; sequence 3 set status failed, errorCode WORKFLOW_ABORTED, completedAt, and durationMs 72. The agents array remained empty and all agent summary counters are zero.
  implication: Execution is finished and no child agent or child tool call started. Pending delivery describes only the failed notification to the parent session; it does not mean computation continues in the background.
- timestamp: 2026-09-22
  checked: Exact parent-session filename across /home/acolomba and the tmp/pi-uat sessions directory named by the run record.
  found: No JSONL file exists for session 01a0cbdd-3747-7089-be43-a9430f6848ce; tmp/pi-uat/sessions contains only older sessions. The run record is the sole persistent record for this new session.
  implication: The host assigned a session id and prospective file path but did not persist a transcript before the slash-command workflow failed. Delivery therefore cannot be validated from session JSONL; the absence is compatible with Pi's lazy session persistence and is separate from run execution state.

- timestamp: 2026-09-22
  checked: code-modernization:modernize-harden-scan under pi-dynamic-workflows 3.13.0 and Pi 0.85.1.
  found: The staged envelope loaded, the unmodified Claude workflow parsed, five agents ran, later workflow stages executed, and a JSON return value came back, but the agents called no tools.
  implication: Storage, parsing, orchestration, and result transport work; substantive child-agent execution does not.
- timestamp: 2026-09-22
  checked: Engine run history for failing child agents.
  found: The model typed structured_output markup as prose and was offered no tool definitions, including no structured_output tool.
  implication: The summary error is downstream of missing tool registration, not merely poor schema compliance.
- timestamp: 2026-09-22
  checked: Repository CodeGraph trace for createAgentSession, customTools, and the OpenAI provider request path.
  found: The worktree extension contains no child-session or provider implementation; those boundaries live in the separately installed pi-dynamic-workflows and Pi distributions.
  implication: Instrumentation must remain in the disposable external packages; changing this repository before locating the loss would target the wrong layer.
- timestamp: 2026-09-22
  checked: Runtime package resolution for the installed workflow engine.
  found: Engine 3.13.0 resolves its createAgentSession import from its own nested pi-coding-agent 0.87.0, while the interactive pi command is 0.86.1 and a separate npm-global Pi package is 0.85.1.
  implication: The engine child path is isolated from the interactive host Pi version; the clean probe must instrument the nested 0.87.0 runtime actually executing createAgentSession.
- timestamp: 2026-09-22
  checked: Instrumented direct WorkflowAgent schema probe in an OpenAI-only disposable home with a synthetic file.
  found: The request carried read, bash, edit, write, and structured_output; the child called read, then structured_output, and returned {"text":"workflow-tool-probe"}.
  implication: OpenAI Codex supports the required workflow child-agent tool path. The earlier failure is not a provider limitation or a loss in the current engine-to-Pi-to-Codex boundary.
- timestamp: 2026-09-22
  checked: Full installed-workflow path using the worktree extension, engine 3.13.0, its nested Pi 0.87.0 runtime, and OpenAI-only credentials.
  found: The extension installed probe-plugin:read-fixture, the run events recorded a read call and a structured_output call, and the workflow completed with {"text":"workflow-tool-probe"}.
  implication: The repository bridge and current engine workflow path work end to end with OpenAI; the discriminating difference is the earlier host/runtime composition.
- timestamp: 2026-09-22
  checked: Installation timestamps and preserved failing run events.
  found: The failed runs used the then-current Pi 0.85.1 host while engine 3.13.0 already carried nested Pi 0.87.0; the later Pi 0.86.1 host was installed after those failures. Failing child input was only 594 tokens across three turns and contained no tool calls, while the current aligned probe recorded the full tool sequence.
  implication: Version-skewed host ModelRuntime injection is now the leading environment-plus-code boundary hypothesis.
- timestamp: 2026-09-22
  checked: Pi 0.85.1 versus 0.86.1/0.87.0 agent-loop and OpenAI Codex provider contracts.
  found: Pi 0.85.1 passes tools in context.tools and its Codex provider reads context.tools; Pi 0.86.1 and 0.87.0 declare tools in transcript system messages and their Codex providers replay those declarations. The 0.87 child trace showed context.tools empty by design.
  implication: Passing a 0.85.1 host ModelRuntime into a 0.87.0 child deterministically drops all tools because the producer and consumer use different context protocols.
- timestamp: 2026-09-22
  checked: Actual Pi 0.86.1 host with the worktree extension, copied engine 3.13.0, and the installed synthetic workflow.
  found: The host invoked the workflow and returned {"text":"workflow-tool-probe"}; the child boundary trace retained read and structured_output.
  implication: A transcript-protocol-compatible host fixes the exact end-to-end path, not only direct WorkflowAgent usage.
- timestamp: 2026-09-22
  checked: Clean Pi 0.85.1 host with the same worktree extension, engine, OpenAI credential, workflow, prompt, and synthetic file.
  found: The engine and child registry contained seven tools, but all three child turns emitted prose and the run ended SCHEMA_NONCOMPLIANCE with no tool calls.
  implication: The old host version alone is sufficient to reproduce the reported failure outside the original sandbox and workload.
- timestamp: 2026-09-22
  checked: One-variable compatibility experiment on the disposable engine copy.
  found: With Pi 0.85.1 still hosting the run, omitting only injection of its ModelRuntime caused the nested Pi 0.87.0 Codex request to contain all seven tools and the workflow returned {"text":"workflow-tool-probe"}.
  implication: Host ModelRuntime injection across the Pi tool-context protocol change is the causal mechanism, not a correlation with version or prompt.
- timestamp: 2026-09-22
  checked: Canonical record, event stream, result sidecar, log, and Pi session transcript for run modernize-harden-scan-mudg4xpq-55wkzi and session 01a0cbf5-0cd8-74fd-a3de-e2b3e178932a.
  found: The run record is terminal completed after 221056 ms with 12/12 agents done, zero errors, 435206 input tokens, 26024 output tokens, 2158592 cache-read tokens, and cost 4.036046; pendingDelivery remains {kind: complete, deliveryId: e4e4cc4d-539e-44e9-87fb-0b6f9eec580e}.
  implication: Child execution finished successfully; pending delivery is a separate notification/status defect and cannot mean the workflow is still running.
- timestamp: 2026-09-22
  checked: Final history for every child agent in the run event stream, ordered by agent id and within each history by timestamp.
  found: All 12 OpenAI gpt-5.5 agents made real native calls and ended with exactly one structured_output call each. In total they made 50 read calls, 76 bash calls, and 12 structured_output calls; no tool result has isError=true, and NO_TOOLS, SCHEMA_NONCOMPLIANCE, and prose-recovery markers are absent from run, result, log, and parent-session artifacts.
  implication: The real multi-agent UAT verifies the OpenAI child-tool path end to end and falsifies any claim that this run recovered typed prose instead of using structured_output.
- timestamp: 2026-09-22
  checked: Materialized result and parent-session custom workflow status for the completed run.
  found: The result is substantive (four surviving findings, one refuted, 20% reported false-positive rate), but it retains a High/credentialFindings CWE-798 claim at auth.json:4 while refuting a Critical CWE-798 claim at auth.json:5 because the same tmp/auth.json is gitignored and untracked. The parent session later persisted a panel headed "Workflow running" despite showing 12/12 done and both phases complete.
  implication: Output quality is not trustworthy without human triage for the credential disposition, and the stale running heading is delivery/status projection drift rather than incomplete execution.
- timestamp: 2026-09-22
  checked: Ordered native tool calls in each terminal child history for modernize-harden-scan-mudg4xpq-55wkzi.
  found: "1 find:injection read×3→bash×4→structured_output; 2 find:auth read×9→bash×6→structured_output; 3 find:secrets bash→read→bash→read×6→bash×6→structured_output; 4 find:deps bash→read→bash×13→structured_output; 5 find:input bash×2→read×2→bash→read×4→bash→structured_output; 6 refute:CWE-94 read×3→bash×2→read×2→bash×2→read×2→bash→read→structured_output; 7 refute:CWE-798 bash×6→structured_output; 8 refute:CWE-284 bash×3→read×6→bash×3→read→bash→structured_output; 9 refute:CWE-367 bash→read×3→bash×4→read→bash→read→structured_output; 10 refute:CWE-798 bash×6→structured_output; 11 confirm:CWE-94 bash×7→structured_output; 12 confirm:CWE-798 read→bash×3→read×3→bash→structured_output."
  implication: Every finder, refuter, and confirmer used tools and terminated through the native structured_output tool; this is direct UAT evidence rather than inference from agent status.
- timestamp: 2026-09-22
  checked: pi-dynamic-workflows 3.13.0 task-panel delivery binding and the host Pi 0.86.1 send contract.
  found: Completion first persists pendingDelivery, then deliverAndAck leaves it pending and emits the exact observed warning when endpoint.send is absent. bindSessionDelivery supplies send only from an explicit stableSend or boundSessionSends capture; this run reached the no-send branch, proving the capture map had no thenable for the session. Pi's ExtensionAPI sendMessage wrapper is intentionally void, while AgentSession.sendCustomMessage is Promise-returning.
  implication: Delivery did not fail because execution was incomplete or because the result was invalid. The engine failed closed at its session-transport capture boundary and correctly retained the result marker for later delivery.
- timestamp: 2026-09-22
  checked: pi-dynamic-workflows 3.13.0 /workflows status renderer.
  found: workflow-commands.ts calls renderWorkflowText(recomputeWorkflowSnapshot(live), false) for every non-running live snapshot, and display.ts maps false to the literal heading "Workflow running". The completed run therefore showed a stale heading even though its record and 12/12 body were terminal.
  implication: The heading is a deterministic presentation bug independent of both execution and result delivery.
- timestamp: 2026-09-22
  checked: Embedded workflow aggregation logic and the two final CWE-798 dispositions.
  found: Findings are deduplicated by the exact key `${f.source}::${f.cwe}`. The same auth.json credential was reported at line 4 and line 5, so both entered separate judge paths; one path treated the live local token as a real High credential exposure while the other refuted the committed-source claim because tmp/ is gitignored and untracked.
  implication: The output-quality contradiction is caused by line-sensitive syntactic dedup plus judges applying different threat questions. Credential findings need semantic artifact-level dedup and one explicit policy for ignored local secrets before this result can drive remediation automatically.
- timestamp: 2026-09-22
  checked: Availability of the canonical run artifacts after evidence extraction.
  found: The exact run JSON, event stream, result sidecar, backup, and log disappeared from the workflow run directory during the investigation; the parent session transcript remained. Their contents above were extracted before disappearance, but no process or artifact remained to attribute the cleanup.
  implication: The debug checkpoint now carries the durable evidence summary; the unobserved cleanup is not evidence about execution or delivery and should not be assigned a cause without a separate reproduction.

## Resolution

root_cause: pi-dynamic-workflows 3.13.0 injects the host Pi ModelRuntime into a child created by its separately resolved Pi SDK; with host Pi 0.85.1 and nested Pi 0.87.0, the child declares tools in transcript system messages while the old runtime serializes only context.tools, so the OpenAI request contains no tools.
fix: Use a protocol-compatible host (verified with Pi 0.86.1) or change pi-dynamic-workflows upstream so it does not inject a host ModelRuntime whose tool-context protocol differs from the child SDK. No repository production code was changed because the defect is in the external engine/runtime composition.
verification:
  target_test: { result: pass, details: "Real modernize-harden-scan UAT completed 12/12 OpenAI gpt-5.5 agents with 50 read, 76 bash, and 12 native structured_output calls; no NO_TOOLS, SCHEMA_NONCOMPLIANCE, or prose recovery." }
  mutation_check: { result: skipped, reason_if_skipped: no repository fix site; the candidate change is in a disposable copy of a third-party package, mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true }
  adjacent_tests: { result: skipped, suites_run: [], reason_if_skipped: no repository production code changed }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  human_uat: { result: pass, run_id: modernize-harden-scan-mudg4xpq-55wkzi, session_id: 01a0cbf5-0cd8-74fd-a3de-e2b3e178932a, caveats: "Result delivery remained pending; status heading and credential verdict quality are separate follow-up defects." }
  guardrail_verdict: accepted
oracle_type: specified
files_changed: []

## Prevention

why_not_caught:
recurrence_guard:
