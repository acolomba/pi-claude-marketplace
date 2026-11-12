Feature: Hook MCP tool names

  A hook of a bridged plugin sees a plugin MCP tool under Claude Code's name,
  whichever MCP implementation serves it. A scripted model, the hooks' stub MCP
  servers, and hooks that record each run stand in for real ones.
  pi-mcp-adapter shortens a tool name over 64 characters. A hook that names
  the full name still runs and receives it.

  @mcp
  Scenario: Hooks on a plugin MCP tool match it and see it under Claude Code's name
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                 | if                                      |
      | literal | PreToolUse  | mcp__plugin_hook-demo_stub-server__echo |                                         |
      | prefix  | PreToolUse  | mcp__plugin_hook-demo_stub-server__.*   |                                         |
      | folded  | PreToolUse  | mcp__plugin_hook_demo_stub_server__echo |                                         |
      | iffed   | PreToolUse  | *                                       | mcp__plugin_hook-demo_stub-server__echo |
      | after   | PostToolUse | mcp__plugin_hook-demo_stub-server__echo |                                         |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input      | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | prefix    | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | iffed     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |

  @adapter-only
  Scenario: A successful adapter tool with a 64-character hash-tail name runs its server-prefix hook (D-PG1-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name     | event       | matcher                                                    |
      | prefixed | PostToolUse | mcp__plugin_demo_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx__.* |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" for its hooks with tool "deadbeef"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" of the plugin "demo"
    Given the scripted model calls the tool "deadbeef" of the hooks' stub mcp server "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" of the plugin "demo" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                                                        | tool input      | tool response                            | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                   | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | mcp__plugin_demo_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx__deadbeef | {"text":"ping"} | [{"type":"text","text":"deadbeef:ping"}] | {project dir} |                 | prefixed  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  @adapter-only
  Scenario: Hooks on a plugin MCP tool that pi-mcp-adapter shortened run by its full Claude Code name and receive that name (PG-MCP-02, D-PG1-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name                                          | version |
      | hook-proxy-shaped-tool-names-of-a-long-plugin | 1.0.0   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                                                       | if                                                                           |
      | literal | PreToolUse  | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo   |                                                                              |
      | any     | PreToolUse  | *                                                                             |                                                                              |
      | iffed   | PreToolUse  | *                                                                             | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo  |
      | prefix  | PreToolUse  | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__.*     |                                                                              |
      | after   | PostToolUse | *                                                                             |                                                                              |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-proxy-shaped-tool-names-of-a-long-plugin@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                                                        | tool input      | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                                                                 | CLAUDE_PLUGIN_DATA                                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | iffed     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | prefix    | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |

  @adapter-only
  Scenario: A failed call of a plugin MCP tool that pi-mcp-adapter shortened runs the PostToolUseFailure hooks that name its full Claude Code name (PG-MCP-02, D-PG1-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name                                          | version |
      | hook-proxy-shaped-tool-names-of-a-long-plugin | 1.0.0   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name     | event              | matcher                                                                     |
      | failure  | PostToolUseFailure | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo |
      | any      | PostToolUseFailure | *                                                                           |
      | prefixed | PostToolUseFailure | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__.*   |
      | after    | PostToolUse        | *                                                                           |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks, whose tool calls fail
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-proxy-shaped-tool-names-of-a-long-plugin@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event              | session | tool name                                                                  | tool input      | error | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                                                                 | CLAUDE_PLUGIN_DATA                                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} | Error: echo:ping | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUseFailure | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} | Error: echo:ping | false        | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUseFailure | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} | Error: echo:ping | false        | {project dir} |                 | prefixed  | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |

  @adapter-only
  Scenario: With no hook that names the tool, PreToolUse hooks see the name pi-mcp-adapter shortened and PostToolUse hooks its full Claude Code name, a pi-mcp-adapter capability gap (PG-MCP-02, D-PG1-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name                                          | version |
      | hook-proxy-shaped-tool-names-of-a-long-plugin | 1.0.0   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name            | event       | matcher                                                                     |
      | before          | PreToolUse  | *                                                                           |
      | prefixed-before | PreToolUse  | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__.*   |
      | after           | PostToolUse | *                                                                           |
      | prefixed-after  | PostToolUse | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__.*   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-proxy-shaped-tool-names-of-a-long-plugin@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                                                                  | tool input      | tool response                        | cwd           | transcript path | arguments      | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                                                                 | CLAUDE_PLUGIN_DATA                                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plug_aa6b8bc3          | {"text":"ping"} |                                      | {project dir} |                 | before         | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | after          | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping"} | [{"type":"text","text":"echo:ping"}] | {project dir} |                 | prefixed-after | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |

  @adapter-only
  Scenario: With no hook that names the tool, a PostToolUseFailure hook sees the name pi-mcp-adapter shortened, a pi-mcp-adapter capability gap (PG-MCP-02, D-PG1-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name                                          | version |
      | hook-proxy-shaped-tool-names-of-a-long-plugin | 1.0.0   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name     | event              | matcher                                                                   |
      | any      | PostToolUseFailure | *                                                                         |
      | prefixed | PostToolUseFailure | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__.* |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks, whose tool calls fail
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-proxy-shaped-tool-names-of-a-long-plugin@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event              | session | tool name                                                         | tool input      | error            | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                                                                 | CLAUDE_PLUGIN_DATA                                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plug_aa6b8bc3 | {"text":"ping"} | Error: echo:ping | false        | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |

  @builtin-only
  Scenario: A hook on a built-in tool matches the server as Pi registered it and sees the tool segment folded (MHK-01, D-MB-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event      | matcher                     |
      | claude-name | PreToolUse | mcp__echo-server__echo-text |
      | folded-tool | PreToolUse | mcp__echo-server__echo_text |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user"
    Given pi's mcp.json configures the server "echo-server" with the hooks' stub mcp tool "echo-text"
    Given pi runs with the scripted model and the mcp implementation
    Given the scripted model plays these steps:
      | reply | tool                        | arguments        |
      |       | mcp__echo_server__echo_text | {"text": "ping"} |
      | Done. |                             |                  |
    When the user prompts "call the echo tool"
    Then the hooks record these runs in any order:
      | event      | session | tool name                   | tool input      | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | mcp__echo-server__echo_text | {"text":"ping"} | {project dir} |                 | claude-name | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse | first   | mcp__echo-server__echo_text | {"text":"ping"} | {project dir} |                 | folded-tool | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |

  @mcp
  Scenario: A hook's notice on a plugin MCP tool names the tool as Claude Code does
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event      | matcher                                 | form   | output                               |
      | notice | PreToolUse | mcp__plugin_hook-demo_stub-server__echo | script | {"systemMessage":"checked the stub"} |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks show the user these messages:
      | severity | text                                                                      |
      | info     | PreToolUse:mcp__plugin_hook-demo_stub-server__echo says: checked the stub |
