@builtin-only
Feature: MCP server builtin trust

  A plugin installed in both scopes registers one server with Pi's built-in MCP, the project record's
  while Pi trusts the project and the user record's otherwise (BLT-03, D-MB-09, P2-DC-07, P2-DC-14).
  A stdio stub server that echoes its environment, a scripted model, and a local marketplace stand in.

  Scenario: An untrusted project leaves the user-scope server of a plugin installed in both scopes (BLT-03, P2-DC-07)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" that echoes its "CLAUDE_PLUGIN_ROOT" and "CLAUDE_PLUGIN_DATA" environment variables
    Given the marketplace "fixtures" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the project holds a pi settings file
    Given pi runs with the scripted model in an untrusted project
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user prompts "call the stub"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                                                                           |
      | 1    | user        | call the stub                                                                                                                                  |
      | 2    | user        | call the stub                                                                                                                                  |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                                                                                         |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given.                                                          |
      | 3    | user        | call the stub                                                                                                                                  |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                                                                                         |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given.                                                          |
      | 3    | assistant   | tool call mcp__plugin_demo_stub__echo {"text":"ping"}                                                                                          |
      | 3    | tool result | mcp__plugin_demo_stub__echo returned: {home}/marketplaces/fixtures/plugins/demo,{agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping |

  Scenario: A trusted project registers one server for a plugin installed in both scopes (BLT-03, P2-DC-14)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" that echoes its "CLAUDE_PLUGIN_ROOT" and "CLAUDE_PLUGIN_DATA" environment variables
    Given the marketplace "fixtures" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the project holds a pi settings file
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name             |
      | plugin_demo_stub |

  Scenario: A trusted project's server replaces the user-scope server of a plugin installed in both scopes (BLT-03, P2-DC-14)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" that echoes its "CLAUDE_PLUGIN_ROOT" and "CLAUDE_PLUGIN_DATA" environment variables
    Given the marketplace "fixtures" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the project holds a pi settings file
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user prompts "call the stub"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                                                                                 |
      | 1    | user        | call the stub                                                                                                                                        |
      | 2    | user        | call the stub                                                                                                                                        |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                                                                                               |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given.                                                                |
      | 3    | user        | call the stub                                                                                                                                        |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                                                                                               |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given.                                                                |
      | 3    | assistant   | tool call mcp__plugin_demo_stub__echo {"text":"ping"}                                                                                                |
      | 3    | tool result | mcp__plugin_demo_stub__echo returned: {home}/marketplaces/fixtures/plugins/demo,{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo:echo:ping |
