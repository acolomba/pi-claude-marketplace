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

  Scenario: A failed read runs the PostToolUseFailure hooks its matchers select and no PostToolUse hook
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
      | name    | event              | matcher    |
      | literal | PostToolUseFailure | Read       |
      | either  | PostToolUseFailure | Read\|Edit |
      | other   | PostToolUseFailure | Write      |
      | after   | PostToolUse        | Read       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                    |
      |       | read | {"path": "{home}/marketplaces/fixtures/plugins/demo/notes.txt", "offset": 9} |
      | Done. |      |                                                                              |
    When the user prompts "read past the end of the notes"
    Then the hooks record these runs in any order:
      | event              | session | tool name | tool input                                                                | error                                          | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | Read      | {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Read      | {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | either    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A successful call runs its PostToolUse hook and no PostToolUseFailure hook
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
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                    | tool response                            | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | [{"type":"text","text":"from-model\\n"}] | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A PostToolUseFailure hook's additional context reaches the model after the failed result
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
      | name    | event              | matcher | form   | output                                                                                                |
      | context | PostToolUseFailure | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUseFailure","additionalContext":"checked the error"}} |
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
      | PostToolUseFailure | first   | Read      | {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | context   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                     |
      | 1    | user        | read past the end of the notes                                                           |
      | 2    | user        | read past the end of the notes                                                           |
      | 2    | assistant   | tool call read {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} |
      | 2    | tool result | read failed: Offset 9 is beyond end of file (3 lines total)                              |
      | 2    | user        | PostToolUseFailure:Read hook additional context: checked the error                       |

  Scenario: A PostToolUseFailure hook's system message is shown to the user and not sent to the model
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
      | name   | event              | matcher | form   | output                                      |
      | notice | PostToolUseFailure | Read    | script | {"systemMessage":"checked the failed read"} |
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
      | PostToolUseFailure | first   | Read      | {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | notice    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                  |
      | info     | PostToolUseFailure:Read says: checked the failed read |
    Then the model receives these calls:
      | call | role        | text                                                                                     |
      | 1    | user        | read past the end of the notes                                                           |
      | 2    | user        | read past the end of the notes                                                           |
      | 2    | assistant   | tool call read {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} |
      | 2    | tool result | read failed: Offset 9 is beyond end of file (3 lines total)                              |

  Scenario: A PostToolUseFailure hook that exits 2 sends its stderr to the model after the failed result
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
      | name | event              | matcher | form   | stderr          | exit code |
      | exit | PostToolUseFailure | Read    | script | check the error | 2         |
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
      | PostToolUseFailure | first   | Read      | {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | exit      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                 |
      | 1    | user        | read past the end of the notes                                                                                                                                                                                       |
      | 2    | user        | read past the end of the notes                                                                                                                                                                                       |
      | 2    | assistant   | tool call read {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9}                                                                                                                             |
      | 2    | tool result | read failed: Offset 9 is beyond end of file (3 lines total)\nPostToolUseFailure:Read hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/exit.sh": [${CLAUDE_PLUGIN_ROOT}/hooks/exit.sh]: check the error |

  Scenario: A PostToolUseFailure hook's block decision sends its reason to the model after the failed result
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
      | name  | event              | matcher | form   | output                                             |
      | block | PostToolUseFailure | Read    | script | {"decision":"block","reason":"look at the offset"} |
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
      | PostToolUseFailure | first   | Read      | {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | block     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                              |
      | 1    | user        | read past the end of the notes                                                                                                                                                    |
      | 2    | user        | read past the end of the notes                                                                                                                                                    |
      | 2    | assistant   | tool call read {"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9}                                                                                          |
      | 2    | tool result | read failed: Offset 9 is beyond end of file (3 lines total)\nPostToolUseFailure:Read hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/block.sh": look at the offset |

  @adapter-only
  Scenario: A failed plugin MCP tool call through pi-mcp-adapter runs the PostToolUseFailure hooks its matchers select (D-BG-404)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name     | event              | matcher                                  |
      | failure  | PostToolUseFailure | mcp__plugin_hook-demo_stub-server__echo  |
      | prefixed | PostToolUseFailure | mcp__plugin_hook-demo_stub-server__.*    |
      | other    | PostToolUseFailure | mcp__plugin_hook-demo_stub-server__other |
      | after    | PostToolUse        | mcp__plugin_hook-demo_stub-server__echo  |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks, whose tool calls fail
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event              | session | tool name                               | tool input      | error            | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | Error: echo:ping | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | Error: echo:ping | false        | {project dir} |                 | prefixed  | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
