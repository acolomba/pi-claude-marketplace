Feature: MCP server implementation switch

  An installed plugin's servers run through whichever MCP implementation Pi loads after a restart,
  with no plugin command (MSEL-02, MSEL-03, MSEL-04), and a record an earlier release wrote needs
  no reinstall (MREC-02); the user, never the extension, turns Pi's built-in MCP on (D-MB-01).
  A stdio stub server, a scripted model, and a local marketplace stand in for real ones.

  @mcp
  Scenario: A plugin an earlier release installed reaches its server with no reinstall (MREC-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the installation record of the plugin "demo@fixtures" in the user scope has no recorded mcp servers, as an earlier release wrote it
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |

  @own-implementation
  Scenario: A plugin installed under pi's built-in mcp runs through pi-mcp-adapter after a restart, with no rewrite at load (MSEL-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given pi runs with the scripted model
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                    |
    When the user restarts pi with pi-mcp-adapter
    Then the session reports no results
    Then pi-mcp-adapter lists the tools of the stub mcp server "stub" of the plugin "demo"
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                     |

  @own-implementation
  Scenario: A plugin's server moves from pi-mcp-adapter to pi's built-in mcp and back with no plugin command (MSEL-02, MSEL-03, D-MB-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments                                                          |
      |       | mcp                         | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |                             |                                                                    |
      |       | tool_search                 | {"query": "echo"}                                                  |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}                                                   |
      | Done. |                             |                                                                    |
      |       | mcp                         | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |                             |                                                                    |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                     |
    When the user restarts pi without pi-mcp-adapter
    Then the session reports no results
    Then pi reports no extension error
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name |
    Then pi offers these plugin mcp tools:
      | tool | active |
    When the user restarts pi with pi's built-in mcp turned on
    Then the session reports no results
    Then pi's built-in mcp lists the tools of the stub mcp server "stub" of the plugin "demo"
    When the user prompts "call the stub"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                  |
      | 3    | user        | call the stub                                                                         |
      | 4    | user        | call the stub                                                                         |
      | 4    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 4    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 5    | user        | call the stub                                                                         |
      | 5    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 5    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 5    | assistant   | tool call mcp__plugin_demo_stub__echo {"text":"ping"}                                 |
      | 5    | tool result | mcp__plugin_demo_stub__echo returned: echo:ping                                       |
    When the user restarts pi with pi-mcp-adapter
    Then the session reports no results
    Then pi-mcp-adapter lists the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 6    | user        | call the stub                                                               |
      | 7    | user        | call the stub                                                               |
      | 7    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 7    | tool result | mcp returned: echo:ping                                                     |
