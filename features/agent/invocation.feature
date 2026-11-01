Feature: Agent invocation

  Running a bridged agent through pi-subagents starts a child whose system
  prompt is the agent's body. A scripted model stands in for a real one, and
  a local marketplace for a published one.

  Scenario: A foreground agent run starts a child whose system prompt is the agent body
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "reviewer" described as "Reviews the files it is given." with this body:
      """
      Review the files named in the task and report every problem you find.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the model call 2 receives this system prompt:
      """
      <active_agent name="demo:reviewer"/>

      Review the files named in the task and report every problem you find.

      Intercom orchestration channel:
      The inherited thread is reference-only. Do not continue that conversation or send questions, status updates, or completion handoffs to the supervisor in normal assistant text.

      Use contact_supervisor first. It resolves the supervisor session and run metadata automatically.
      - Need a decision, blocked, approval, or product/API/scope ambiguity: contact_supervisor({ reason: "need_decision", message: "<question>" })
      - Need structured supervisor input rather than a freeform reply: contact_supervisor({ reason: "interview_request", message: "<what input is needed>", interview: { title: "...", questions: [] } })
      - After contact_supervisor with reason "need_decision" or "interview_request", stay alive and continue only after the reply arrives. Do not finish your final response with a choose-one question.
      - Do not ask for clarification when the only conflict is review-only/no-edit versus progress-writing or artifact-writing instructions. If an output path is configured but no write-capable tool is available, return the complete artifact in your final response; the runtime will persist it. Do not contact the supervisor merely because you cannot write that output path directly.
      - Meaningful progress or unexpected discoveries that change the plan: contact_supervisor({ reason: "progress_update", message: "UPDATE: <summary>" })

      Do not use contact_supervisor for routine completion handoffs. If no coordination is needed, return a focused task result.

      ## Acceptance Contract
      Acceptance level: attested
      Completion is not accepted from prose alone. End with a structured acceptance report.

      Criteria:
      - criterion-1: Return a concise result and residual risks when applicable

      Required evidence: manual-notes, residual-risks

      Finish with a fenced JSON block tagged `acceptance-report` in this shape:
      Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
      Empty-string entries (`[""]`) are ignored; use `[]` when nothing applies.
      `criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
      `commandsRun[].result` must be exactly one of: passed, failed, not-run.
      `manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
      ```acceptance-report
      {
        "criteriaSatisfied": [
          {
            "id": "criterion-1",
            "status": "satisfied",
            "evidence": "specific proof"
          }
        ],
        "changedFiles": [
          "src/file.ts"
        ],
        "testsAddedOrUpdated": [
          "test/file.test.ts"
        ],
        "commandsRun": [
          {
            "command": "command",
            "result": "passed",
            "summary": "short result"
          }
        ],
        "validationOutput": [
          "validation output or concise summary"
        ],
        "residualRisks": [
          "none"
        ],
        "noStagedFiles": true,
        "diffSummary": "short description of the diff",
        "reviewFindings": [
          "blocker: file.ts:12 - issue found, or no blockers"
        ],
        "manualNotes": "anything else the parent should know"
      }
      ```

      <cwd>
      {project dir}
      </cwd>

      You are a child subagent, not the parent orchestrator.
      The parent session owns delegation, orchestration, review fanout, and follow-up worker launches.
      Ignore prior parent-only orchestration instructions in inherited conversation history.
      Do not propose or run subagents. Complete only your assigned role-specific task with the tools available to you.
      If you need to edit files, use the available editing tools. Do not print tool-call syntax, patches, or pseudo-tool calls as text.
      """
    Then the model receives these calls:
      | call | role        | text                                                                                                              |
      | 1    | user        | Ask the reviewer to check the README.                                                                             |
      | 2    | user        | Task: Review the README.                                                                                          |
      | 3    | user        | Ask the reviewer to check the README.                                                                             |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false}                            |
      | 3    | tool result | subagent returned: Run fan-out: 1/64 used, 63 remaining\nThe README has no problems.\nMission: {uuid} (completed) |
