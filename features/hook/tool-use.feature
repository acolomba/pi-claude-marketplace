Feature: Hook tool use

  A hook of a bridged plugin runs on a tool call the model makes, with the
  tool call in Claude's shape on its stdin. A scripted model stands in for a
  real one, and a hook that records each run stands in for a plugin's hook.

  Scenario: A PreToolUse hook runs once for a scripted bash call with Claude's tool name and input
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event      | matcher |
      | bash-guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | bash-guard | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |

  Scenario: A PreToolUse hook's deny decision blocks the tool call even when the hook exits 1
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | output                                                                                                                 |
      | guard | PreToolUse | Bash    | script | 1         | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no echo"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                             |
      | 1    | user        | run the echo                                     |
      | 2    | user        | run the echo                                     |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}     |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: no echo |

  Scenario: A PreToolUse hook that exits 2 blocks the tool call with its command and stderr
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | stderr            |
      | guard | PreToolUse | Bash    | script | 2         | blocked by policy |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                               |
      | 1    | user        | run the echo                                                                                       |
      | 2    | user        | run the echo                                                                                       |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                       |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: blocked by policy |

  Scenario: A PreToolUse hook that fails with onFailure block shows the model Claude Code's message
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | stderr | on failure |
      | guard | PreToolUse | Bash    | script | 1         | boom   | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                 |
      | 1    | user        | run the echo                                                                                                                         |
      | 2    | user        | run the echo                                                                                                                         |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                         |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block"\nboom |

  Scenario: Matching PreToolUse hooks run in parallel
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | meets |
      | left  | PreToolUse | Bash    | script | right |
      | right | PreToolUse | Bash    | script | left  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | left met  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | right met | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario: Identical hooks of one plugin run once
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
      | guard | PreToolUse | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario: The same hook in two plugins runs once for each plugin
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
    Given the published plugin "alpha" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
    Given the published plugin "beta" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install alpha@fixtures --scope project"
    Given the user has run "/claude:plugin install beta@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                         | CLAUDE_PLUGIN_DATA                                 | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/alpha | {project dir}/.pi/pi-claude-marketplace/data/alpha | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/beta  | {project dir}/.pi/pi-claude-marketplace/data/beta  | first                  | first             | 1          |

  Scenario: A hook on a plugin MCP tool runs once per call under the real tool name
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                     |
      | literal | PreToolUse  | mcp__plugin_demo_stub__echo |
      | any     | PreToolUse  | *                           |
      | after   | PostToolUse | *                           |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the hooks' stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                         |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                   |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                   | tool input      | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                          | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | mcp__plugin_demo_stub__echo | {"text":"ping"} |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_demo_stub__echo | {"text":"ping"} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_demo_stub__echo | {"text":"ping"} | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario: A PreToolUse ask decision blocks the tool call when pi has no terminal
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                                                                                                       |
      | guard | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"please confirm"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash failed: please confirm                  |

  Scenario: A PreToolUse hook's updatedInput replaces the tool's whole input
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name     | event       | matcher | form   | output                                                                                                                         |
      | rewrite  | PreToolUse  | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"echo rewritten"}}} |
      | observer | PostToolUse | Bash    |        |                                                                                                                                |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                     |
      |       | bash | {"command": "echo from-model", "timeout": 30} |
      | Done. |      |                                               |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                                 | tool response                           | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | Bash      | {"command":"echo from-model","timeout":30} |                                         | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | PostToolUse | first   | Bash      | {"command":"echo rewritten"}               | [{"type":"text","text":"rewritten\\n"}] | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                      |
      | 1    | user        | run the echo                                              |
      | 2    | user        | run the echo                                              |
      | 2    | assistant   | tool call bash {"command":"echo from-model","timeout":30} |
      | 2    | tool result | bash returned: rewritten\n                                |

  Scenario: A PreToolUse hook's continue false ends the turn
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                 |
      | guard | PreToolUse | Bash    | script | {"continue":false,"stopReason":"halt"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text         |
      | 1    | user | run the echo |

  Scenario: A PostToolUse block keeps the tool output and adds the hook's feedback
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event       | matcher | form   | output                                           |
      | post | PostToolUse | Bash    | script | {"decision":"block","reason":"check the output"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                    | tool response                            | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | [{"type":"text","text":"from-model\\n"}] | {project dir} |                 | post      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                    |
      | 1    | user        | run the echo                                                                                                                            |
      | 2    | user        | run the echo                                                                                                                            |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                            |
      | 2    | tool result | bash returned: from-model\n\nPostToolUse:Bash hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/post.sh": check the output |
