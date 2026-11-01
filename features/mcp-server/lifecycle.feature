Feature: MCP server lifecycle

  Each plugin verb changes the MCP servers pi-mcp-adapter offers in a session
  started after it, as Pi's /reload would. A stdio stub server stands in for a
  real one, a scripted model for a real model, and a local marketplace for a
  published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned

  Scenario: Disabling a plugin removes its server from what pi-mcp-adapter offers
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      |       | mcp  | {}                                                                 |
      | Done. |      |                                                                    |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                                                   |
      | 1    | user        | call the stub                                                                                          |
      | 2    | user        | call the stub                                                                                          |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}                            |
      | 2    | tool result | mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.      |
      | 3    | user        | call the stub                                                                                          |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}                            |
      | 3    | tool result | mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.      |
      | 3    | assistant   | tool call mcp {}                                                                                       |
      | 3    | tool result | mcp returned: MCP: 0/0 servers, 0 tools                                                                |
    Then no stub mcp server receives a message
