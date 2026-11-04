Feature: Hook MCP tool names

  A hook of a bridged plugin sees a plugin MCP tool under Claude Code's name,
  whichever MCP implementation serves it. A scripted model, the hooks' stub MCP
  server, and hooks that record each run stand in for real ones.

  @mcp
  Scenario: Hooks on a plugin MCP tool match it and see it under Claude Code's name
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher                                 |
      | literal | PreToolUse | mcp__plugin_hook-demo_stub-server__echo |
      | prefix  | PreToolUse | mcp__plugin_hook-demo_stub-server__.*   |
      | folded  | PreToolUse | mcp__plugin_hook_demo_stub_server__echo |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event      | session | tool name                               | tool input      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | {project dir} |                 | prefix    | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
