Feature: Hook tool failure

  A failed tool call runs the plugin's PostToolUseFailure hooks with Claude
  Code's payload, and not its PostToolUse hooks; a call the user interrupts
  runs neither (D-BG-402). A scripted model makes the calls, and hooks that
  record each run stand in for the plugin's hooks. The payload leaves out
  `tool_use_id` and `duration_ms` (D-CF5-28, D-BG-403).

  Scenario: Interrupting a running command runs no PostToolUseFailure hook (D-BG-402)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher |
      | after   | PostToolUse        | Bash    |
      | failure | PostToolUseFailure | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                           |
      |       | bash | {"command": "touch tool-running; i=0; while [ -e tool-running ] && [ $i -lt 200 ]; do sleep 0.1; i=$((i+1)); done"} |
    When the user prompts "run the slow command" and interrupts the running tool once it has created "tool-running"
    Then the hooks record no runs

  Scenario: A PostToolUseFailure hook's updated tool output leaves the error the model reads (D-BG-405)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "notes.txt" with this text:
      """
      one
      two
      three
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher | form   | output                                                                                                                                      |
      | replace | PostToolUseFailure | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUseFailure","updatedToolOutput":{"content":[{"type":"text","text":"replaced"}],"isError":false}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                    |
      |       | read | {"path": "{home}/marketplaces/fixtures/plugins/demo/notes.txt", "offset": 9} |
      | Done. |      |                                                                              |
    When the user prompts "read past the end of the notes"
    Then the hooks record these runs:
      | event              | session | tool name | tool input                                                                | error                                          | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | Read      | {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                     |
      | 1    | user        | read past the end of the notes                                                           |
      | 2    | user        | read past the end of the notes                                                           |
      | 2    | assistant   | tool call read {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} |
      | 2    | tool result | read failed: Offset 9 is beyond end of file (3 lines total)                              |
