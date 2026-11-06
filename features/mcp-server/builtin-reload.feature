@builtin-only
Feature: MCP server builtin reload

  A /reload in Pi's terminal rebuilds Pi's runtime, which drops every MCP server an extension registered, so the
  plugin's server must register again for its tool to answer under Pi's built-in MCP (BLT-01, D-MB-10). A terminal Pi
  reloads beside the idle profile Pi, with a stdio stub server, a scripted model, and a local marketplace standing in.

  Scenario: The plugin's tool answers through tool search after a reload in the terminal (BLT-01, D-MB-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user reloads pi in the terminal and then prompts "call the stub"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                  |
      | 1    | user        | call the stub                                                                         |
      | 2    | user        | call the stub                                                                         |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 3    | user        | call the stub                                                                         |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_stub__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_stub__echo returned: echo:ping                                       |
