Feature: Hook tool failure

  A failed tool call runs the plugin's PostToolUseFailure hooks with Claude
  Code's payload, and not its PostToolUse hooks; a call the user interrupts
  runs neither (D-BG-402). A scripted model makes the calls, a stub MCP
  server whose tool calls fail stands in for a plugin's MCP server, and hooks
  that record each run stand in for the plugin's hooks. The payload leaves out
  `tool_use_id`, `duration_ms`, and `mcp_server` (D-CF5-28, D-BG-403).

  Scenario: Failed edit hooks receive each pair and the same actual error
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher |
      | failure | PostToolUseFailure | Edit    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                             |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | Done. |      |                                                                                                                       |
    When the user prompts "edit a missing block"
    Then the hooks record these runs in any order:
      | event              | session | tool name | tool input                                                                            | error                                                                                                     | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | Could not find edits[1] in document.txt. The oldText must match exactly including all whitespace and newlines. | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | Could not find edits[1] in document.txt. The oldText must match exactly including all whitespace and newlines. | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "first\nmiddle\n" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                                                                                                     |
      | 1    | user        | edit a missing block                                                                                                     |
      | 2    | user        | edit a missing block                                                                                                     |
      | 2    | assistant   | tool call edit {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | 2    | tool result | edit failed: Could not find edits[1] in document.txt. The oldText must match exactly including all whitespace and newlines. |

  Scenario: A failed edit hook cannot replace the failed result
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher | form   | output                                                                                                                                             |
      | replace | PostToolUseFailure | Edit    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUseFailure","updatedToolOutput":{"content":[{"type":"text","text":"replaced"}],"isError":false}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                             |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | Done. |      |                                                                                                                       |
    When the user prompts "edit a missing block"
    Then the hooks record these runs in any order:
      | event              | session | tool name | tool input                                                                            | error                                                                                                     | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | Could not find edits[1] in document.txt. The oldText must match exactly including all whitespace and newlines. | false        | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | Could not find edits[1] in document.txt. The oldText must match exactly including all whitespace and newlines. | false        | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "first\nmiddle\n" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                                                                                                     |
      | 1    | user        | edit a missing block                                                                                                     |
      | 2    | user        | edit a missing block                                                                                                     |
      | 2    | assistant   | tool call edit {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | 2    | tool result | edit failed: Could not find edits[1] in document.txt. The oldText must match exactly including all whitespace and newlines. |

  Scenario: A failed Read hook receives a Claude file input
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher |
      | before  | PreToolUse         | Read    |
      | failure | PostToolUseFailure | Read    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                   |
      |       | read | {"path":"missing.txt"}     |
      | Done. |      |                             |
    When the user prompts "read a missing file"
    Then the hooks record these runs:
      | event              | session | tool name | tool input                                    | error                                                                           | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse         | first   | Read      | {"file_path":"{project dir}/missing.txt"}   |                                                                                 |              | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Read      | {"file_path":"{project dir}/missing.txt"}   | ENOENT: no such file or directory, access '{project dir}/missing.txt'           | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

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
      | PostToolUseFailure | first   | Read      | {"file_path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | PostToolUseFailure | first   | Read      | {"file_path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Read      | {"file_path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | either    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

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
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

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
      | PostToolUseFailure | first   | Read      | {"file_path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | context   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | PostToolUseFailure | first   | Read      | {"file_path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | notice    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | PostToolUseFailure | first   | Read      | {"file_path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | exit      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | PostToolUseFailure | first   | Read      | {"file_path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9} | Offset 9 is beyond end of file (3 lines total) | false        | {project dir} |                 | block     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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

  @builtin-only
  Scenario: A failed plugin MCP tool call through Pi's built-in MCP runs the PostToolUseFailure hooks its matchers select (MHK-01)
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
      | event              | session | tool name                               | tool input      | error     | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | echo:ping | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | echo:ping | false        | {project dir} |                 | prefixed  | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |

  @mcp
  Scenario: A failed MCP result ignores both replacement fields
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event       | matcher                                 | form   | output |
      | failure | PostToolUseFailure | mcp__plugin_hook-demo_stub-server__echo | script | {"hookSpecificOutput":{"hookEventName":"PostToolUseFailure","updatedToolOutput":[{"type":"text","text":"MALICIOUS_MODERN"}],"updatedMCPToolOutput":[{"type":"text","text":"MALICIOUS_LEGACY"}]}} |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the rich stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model, the mcp implementation and a downstream result observer
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text":"fail"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these complete mcp inputs:
      | profile | record |
      | adapter | {"event":"PostToolUseFailure","stdin":{"session_id":"first","transcript_path":"","cwd":"{project dir}","hook_event_name":"PostToolUseFailure","tool_name":"mcp__plugin_hook-demo_stub-server__echo","tool_input":{"text":"fail"},"error":"Error: echo:fail","is_interrupt":false},"arguments":["failure"],"environment":{"CLAUDE_CODE_SESSION_ID":"first","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/hook-demo","CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/hook-demo","CLAUDE_PROJECT_DIR":"{project dir}","CLAUDE_SESSION_ID":"first","CLAUDECODE":"1"}} |
      | builtin | {"event":"PostToolUseFailure","stdin":{"session_id":"first","transcript_path":"","cwd":"{project dir}","hook_event_name":"PostToolUseFailure","tool_name":"mcp__plugin_hook-demo_stub-server__echo","tool_input":{"text":"fail"},"error":"echo:fail","is_interrupt":false},"arguments":["failure"],"environment":{"CLAUDE_CODE_SESSION_ID":"first","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/hook-demo","CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/hook-demo","CLAUDE_PROJECT_DIR":"{project dir}","CLAUDE_SESSION_ID":"first","CLAUDECODE":"1"}} |
    Then another pi handler observes these complete mcp results:
      | profile | record |
      | adapter | {"toolName":"mcp__plugin_hook-demo_stub-server__echo","content":[{"type":"text","text":"Error: echo:fail"}],"details":{"mode":"call","server":"plugin_hook-demo_stub-server_","tool":"echo","canonicalTool":"mcp__plugin_hook-demo_stub-server__echo","error":"tool_error","mcpResult":{"content":[{"type":"text","text":"echo:fail"}],"isError":true}},"structuredContent":{"content":[{"type":"text","text":"Error: echo:fail"}],"isError":true},"isError":true} |
| adapter | {"toolName":"mcp","content":[{"type":"text","text":"Error: echo:fail"}],"details":{"mode":"call","server":"plugin_hook-demo_stub-server_","tool":"echo","canonicalTool":"mcp__plugin_hook-demo_stub-server__echo","error":"tool_error","mcpResult":{"content":[{"type":"text","text":"echo:fail"}],"isError":true}},"structuredContent":null,"isError":true} |
      | builtin | {"toolName":"tool_search","content":[{"type":"text","text":"Loaded 1 tool. They are available from your next call:\\n- mcp__plugin_hook_demo_stub_server__echo: Answers with its own name and the text it is given."}],"details":{"loaded":["mcp__plugin_hook_demo_stub_server__echo"]},"structuredContent":null,"isError":false} |
| builtin | {"toolName":"mcp__plugin_hook_demo_stub_server__echo","content":[{"type":"text","text":"echo:fail"}],"details":{"server":"plugin_hook-demo_stub-server","tool":"echo"},"structuredContent":{"content":[{"type":"text","text":"echo:fail"}],"isError":true},"isError":true} |
    Then the model receives these complete mcp calls:
      | profile | call | role        | text |
      | adapter | 1    | user        | call the stub |
      | adapter | 2    | user        | call the stub |
      | adapter | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_hook-demo_stub-server__echo","args":{"text":"fail"}} |
      | adapter | 2    | tool result | mcp failed: Error: echo:fail |
      | builtin | 1    | user        | call the stub |
      | builtin | 2    | user        | call the stub |
      | builtin | 2    | assistant   | tool call tool_search {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |
      | builtin | 2    | tool result | tool_search returned: Loaded 1 tool. They are available from your next call:\n- mcp__plugin_hook_demo_stub_server__echo: Answers with its own name and the text it is given. |
      | builtin | 3    | user        | call the stub |
      | builtin | 3    | assistant   | tool call tool_search {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |
      | builtin | 3    | tool result | tool_search returned: Loaded 1 tool. They are available from your next call:\n- mcp__plugin_hook_demo_stub_server__echo: Answers with its own name and the text it is given. |
      | builtin | 3    | assistant   | tool call mcp__plugin_hook_demo_stub_server__echo {"text":"fail"} |
      | builtin | 3    | tool result | mcp__plugin_hook_demo_stub_server__echo failed: echo:fail |
