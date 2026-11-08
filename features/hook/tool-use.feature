Feature: Hook tool use

  A hook of a bridged plugin runs on a tool call the model makes, with the
  tool call in Claude's shape on its stdin. A scripted model stands in for a
  real one, and a hook that records each run stands in for a plugin's hook.
  The MCP scenarios differ by implementation: pi-mcp-adapter's proxy call runs
  no hook of its own (D-CF5-12), and under Pi's built-in MCP no call is a
  proxy call (MHK-02).

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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | bash-guard | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                 |
      | 1    | user        | run the echo                                                                                                                         |
      | 2    | user        | run the echo                                                                                                                         |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                         |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block"\nboom |

  Scenario: A PreToolUse hook with onFailure block that fails after printing more than 1 MB blocks the tool call
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output bytes | exit code | on failure |
      | guard | PreToolUse | Bash    | script | 1048577      | 1         | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                           |
      | 1    | user        | run the echo                                                                                                                   |
      | 2    | user        | run the echo                                                                                                                   |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                   |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block" |

  Scenario: A PreToolUse hook that exits 2 after printing more than 1 MB blocks the tool call with its stderr
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | stderr            | output bytes | exit code |
      | guard | PreToolUse | Bash    | script | blocked by policy | 1048577      | 2         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                               |
      | 1    | user        | run the echo                                                                                       |
      | 2    | user        | run the echo                                                                                       |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                       |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: blocked by policy |

  Scenario: A PreToolUse hook's deny decision larger than 1 MB blocks the tool call
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                                                                                                                      | output bytes | trailing output |
      | guard | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"too large to skip"},"padding":" | 1048577      | "}              |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                       |
      | 1    | user        | run the echo                                               |
      | 2    | user        | run the echo                                               |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}               |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: too large to skip |

  Scenario: A PreToolUse hook's deny decision keeps its own reason when the hook exits 1 with onFailure block
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | stderr | output                                                                                                                 | on failure |
      | guard | PreToolUse | Bash    | script | 1         | boom   | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no echo"}} | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                             |
      | 1    | user        | run the echo                                     |
      | 2    | user        | run the echo                                     |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}     |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: no echo |

  Scenario: A PreToolUse hook with onFailure block that prints an unclosed JSON object lets the tool call run
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output    | on failure |
      | guard | PreToolUse | Bash    | script | {not json | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |

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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | left met  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | right met | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                         | CLAUDE_PLUGIN_DATA                                          | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/alpha | {project dir}/.pi/pi-claude-marketplace/data/fixtures/alpha | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/beta  | {project dir}/.pi/pi-claude-marketplace/data/fixtures/beta  | first                  | first             | 1          |

  @adapter-only
  Scenario: A hook on a plugin MCP tool runs once per call through pi-mcp-adapter's proxy (D-CF5-12, MHK-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                 |
      | literal | PreToolUse  | mcp__plugin_hook-demo_stub-server__echo |
      | any     | PreToolUse  | *                                       |
      | after   | PostToolUse | *                                       |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the hooks' stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                     |
      |       | mcp  | {"tool": "mcp__plugin_hook-demo_stub-server__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                               |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input      | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |

  @builtin-only
  Scenario: A hook on a plugin MCP tool runs on every built-in call, the tool search included (MHK-01, MHK-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                 |
      | literal | PreToolUse  | mcp__plugin_hook-demo_stub-server__echo |
      | any     | PreToolUse  | *                                       |
      | after   | PostToolUse | mcp__plugin_hook-demo_stub-server__echo |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model plays these steps:
      | reply | tool                                    | arguments                                                        |
      |       | tool_search                             | {"query": "mcp__plugin_hook_demo_stub_server__echo", "limit": 1} |
      |       | mcp__plugin_hook_demo_stub_server__echo | {"text": "ping"}                                                 |
      | Done. |                                         |                                                                  |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input                                                    | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | tool_search                             | {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"}                                               |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"}                                               |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"}                                               | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |

  @builtin-only
  Scenario: A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name                                          | version |
      | hook-proxy-shaped-tool-names-of-a-long-plugin | 1.0.0   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                                                     |
      | any     | PreToolUse  | *                                                                           |
      | literal | PreToolUse  | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo |
      | after   | PostToolUse | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-proxy-shaped-tool-names-of-a-long-plugin@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin"
    Given the scripted model plays these steps:
      | reply | tool                                                             | arguments                                                                                 |
      |       | tool_search                                                      | {"query": "mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d", "limit": 1} |
      |       | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text": "ping", "tool": "echo"}                                                          |
      | Done. |                                                                  |                                                                                           |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                                                        | tool input                                                                             | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                                                                 | CLAUDE_PLUGIN_DATA                                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | tool_search                                                      | {"query":"mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d","limit":1} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text":"ping","tool":"echo"}                                                          |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text":"ping","tool":"echo"}                                                          |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text":"ping","tool":"echo"}                                                          | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |

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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event       | session | tool name | tool input                                 | tool response                           | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | Bash      | {"command":"echo from-model","timeout":30} |                                         | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Bash      | {"command":"echo rewritten"}               | [{"type":"text","text":"rewritten\\n"}] | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event       | session | tool name | tool input                    | tool response                            | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | [{"type":"text","text":"from-model\\n"}] | {project dir} |                 | post      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                    |
      | 1    | user        | run the echo                                                                                                                            |
      | 2    | user        | run the echo                                                                                                                            |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                            |
      | 2    | tool result | bash returned: from-model\n\nPostToolUse:Bash hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/post.sh": check the output |

  Scenario: A PostToolUse hook's updated tool output replaces what the model reads
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                                                     |
      | replace | PostToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"content":[{"type":"text","text":"replaced"}]}}} |
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
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | [{"type":"text","text":"from-model\\n"}] | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: replaced                      |

  Scenario: A tool hook's additional context reaches the model after the tool result
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event       | matcher | form   | output                                                                                       |
      | ctx  | PostToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"checked by hook"}} |
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
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | [{"type":"text","text":"from-model\\n"}] | {project dir} |                 | ctx       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                      |
      | 1    | user        | run the echo                                              |
      | 2    | user        | run the echo                                              |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}              |
      | 2    | tool result | bash returned: from-model\n                               |
      | 2    | user        | PostToolUse:Bash hook additional context: checked by hook |

  Scenario: A denied tool call's hook context still reaches the model
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                                                                                                                                      |
      | guard | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no echo","additionalContext":"denied by hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                    |
      | 1    | user        | run the echo                                            |
      | 2    | user        | run the echo                                            |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}            |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: no echo        |
      | 2    | user        | PreToolUse:Bash hook additional context: denied by hook |

  Scenario: A failed tool call runs PostToolUseFailure and not PostToolUse
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
      | reply | tool | arguments             |
      |       | bash | {"command": "exit 3"} |
      | Done. |      |                       |
    When the user prompts "run the failing command"
    Then the hooks record these runs:
      | event              | session | tool name | tool input           | error                                     | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | Bash      | {"command":"exit 3"} | (no output)\n\nCommand exited with code 3 | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
