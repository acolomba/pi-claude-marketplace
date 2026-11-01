Feature: MCP server configuration

  A plugin's MCP server receives its configuration as Claude Code gives it.
  A stdio stub server and a loopback HTTP server stand in for real servers,
  a scripted model for a real model, and a local marketplace for a published
  one.

  Scenario: A loopback remote server receives the plugin's headers, a variable among them expanded when it connects
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the http mcp server "web" with these headers:
      | header        | value         |
      | Authorization | Bearer t0k3n  |
      | X-Team        | ${PI_CM_TEAM} |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model, pi-mcp-adapter, and the environment variable "PI_CM_TEAM" set to "core"
    Given pi-mcp-adapter has listed the tools of the http mcp server "web"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                         |
      |       | mcp  | {"tool": "mcp__plugin_demo_web__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                   |
    When the user prompts "call the web server"
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | call the web server                                                        |
      | 2    | user        | call the web server                                                        |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_web__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                    |
    Then the http mcp server "web" receives these json-rpc requests:
      | request                        | authorization | x-team | mcp-protocol-version |
      | POST initialize                | Bearer t0k3n  | core   |                      |
      | POST notifications/initialized | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  | core   | 2025-11-25           |
      | POST initialize                | Bearer t0k3n  | core   |                      |
      | POST notifications/initialized | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/call                | Bearer t0k3n  | core   | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | authorization | x-team | mcp-protocol-version |
      | GET     | Bearer t0k3n  | core   | 2025-11-25           |
      | GET     | Bearer t0k3n  | core   | 2025-11-25           |
