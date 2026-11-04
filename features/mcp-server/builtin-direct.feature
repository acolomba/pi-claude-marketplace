@builtin-only
Feature: MCP server builtin direct

  A plugin server that sets alwaysLoad offers its tools to the model from the first call under Pi's
  built-in MCP, with no tool search, as Claude Code loads it (BLT-01, D-MB-02). A stdio stub server
  stands in for a real one, a scripted model for a real model, and a local marketplace for a published one.

  Scenario: A server with alwaysLoad offers its tool to the model from the first call, and the model calls it directly (BLT-01, D-MB-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with these fields:
      """
      {"alwaysLoad": true}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments        |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"} |
      | Done. |                             |                  |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                  |
      | 1    | user        | call the stub                                         |
      | 2    | user        | call the stub                                         |
      | 2    | assistant   | tool call mcp__plugin_demo_stub__echo {"text":"ping"} |
      | 2    | tool result | mcp__plugin_demo_stub__echo returned: echo:ping       |
    Then the model calls are offered these marketplace tools:
      | call | tools                                                                                      |
      | 1    | mcp__plugin_demo_stub__echo, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
      | 2    | mcp__plugin_demo_stub__echo, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
