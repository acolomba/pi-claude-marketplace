Feature: Hook MCP tool names

  A hook of a bridged plugin sees a plugin MCP tool under Claude Code's name,
  whichever MCP implementation serves it. A scripted model, the hooks' stub MCP
  servers, and hooks that record each run stand in for real ones.

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
