Feature: MCP server listing

  Pi names and lists a plugin's MCP server tools the way Claude Code names them,
  through pi-mcp-adapter's mcp tool (D-CF6-05) or through Pi's built-in MCP, where
  the extension registers each server and Pi's tool search activates its tools
  (BLT-01, BLT-04). A stdio stub server stands in for a real one, a scripted model
  for a real model, and a local marketplace for a published one.

  @adapter-only
  Scenario: A search through the mcp tool activates the plugin's tool under Claude Code's name
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
      | reply | tool | arguments          |
      |       | mcp  | {"search": "echo"} |
      | Done. |      |                    |
    When the user prompts "find the echo tool"
    Then the model receives these calls:
      | call | role        | text                                                                          |
      | 1    | user        | find the echo tool                                                            |
      | 2    | user        | find the echo tool                                                            |
      | 2    | assistant   | tool call mcp {"search":"echo"}                                               |
      | 2    | tool result | mcp returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
    Then the model calls are offered these marketplace tools:
      | call | tools                                                                                      |
      | 1    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list                              |
      | 2    | mcp__plugin_demo_stub__echo, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |

  @builtin-only
  Scenario: A search through pi's tool search activates the plugin's tool under Claude Code's name (BLT-01)
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
      | reply | tool        | arguments         |
      |       | tool_search | {"query": "echo"} |
      | Done. |             |                   |
    When the user prompts "find the echo tool"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                  |
      | 1    | user        | find the echo tool                                                                    |
      | 2    | user        | find the echo tool                                                                    |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
    Then the model calls are offered these marketplace tools:
      | call | tools                                                                                      |
      | 1    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list                              |
      | 2    | mcp__plugin_demo_stub__echo, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                    |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}} |
      | notification | notifications/initialized |                                                                                                           |
      | request      | tools/list                |                                                                                                           |

  @adapter-only
  Scenario: The mcp tool lists the plugin's server under its generated key
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
      | reply | tool | arguments                        |
      |       | mcp  | {}                               |
      |       | mcp  | {"connect": "plugin_demo_stub_"} |
      |       | mcp  | {"server": "plugin_demo_stub_"}  |
      | Done. |      |                                  |
    When the user prompts "list the mcp servers"
    Then the model receives these calls:
      | call | role        | text                                                                                                  |
      | 1    | user        | list the mcp servers                                                                                  |
      | 2    | user        | list the mcp servers                                                                                  |
      | 2    | assistant   | tool call mcp {}                                                                                      |
      | 2    | tool result | mcp returned: server plugin_demo_stub_                                                                |
      | 3    | user        | list the mcp servers                                                                                  |
      | 3    | assistant   | tool call mcp {}                                                                                      |
      | 3    | tool result | mcp returned: server plugin_demo_stub_                                                                |
      | 3    | assistant   | tool call mcp {"connect":"plugin_demo_stub_"}                                                         |
      | 3    | tool result | mcp returned: server plugin_demo_stub_ tool mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 4    | user        | list the mcp servers                                                                                  |
      | 4    | assistant   | tool call mcp {}                                                                                      |
      | 4    | tool result | mcp returned: server plugin_demo_stub_                                                                |
      | 4    | assistant   | tool call mcp {"connect":"plugin_demo_stub_"}                                                         |
      | 4    | tool result | mcp returned: server plugin_demo_stub_ tool mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 4    | assistant   | tool call mcp {"server":"plugin_demo_stub_"}                                                          |
      | 4    | tool result | mcp returned: server plugin_demo_stub_ tool mcp__plugin_demo_stub__echo: Echoes the text it is given. |

  @mcp
  Scenario: Pi registers the plugin's tool under Claude Code's name, inactive until a search
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |

  @builtin-only
  Scenario: Pi lists the plugin's server under Claude Code's name (BLT-04, D-MB-13)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name             |
      | plugin_demo_stub |

  @adapter-only
  Scenario: Under pi-mcp-adapter the extension registers no server with Pi (MSEL-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name |
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |

  @adapter-only
  Scenario: Each server of a plugin gets tools named after the plugin and the server
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"api": {"stub": {}}, "my.db": {"stub": {}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "api" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "my.db" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                         | active |
      | mcp__plugin_demo_api__echo   | no     |
      | mcp__plugin_demo_my_db__echo | no     |

  @adapter-only
  Scenario: A plugin without MCP servers adds no server to pi-mcp-adapter
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      |       | mcp  | {}        |
      | Done. |      |           |
    When the user prompts "list the mcp servers"
    Then the model receives these calls:
      | call | role        | text                     |
      | 1    | user        | list the mcp servers     |
      | 2    | user        | list the mcp servers     |
      | 2    | assistant   | tool call mcp {}         |
      | 2    | tool result | mcp returned: no servers |
    Then no stub mcp server receives a message

  @adapter-only
  Scenario: A search that matches no tool activates none
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
      | reply | tool | arguments             |
      |       | mcp  | {"search": "nothing"} |
      | Done. |      |                       |
    When the user prompts "find a tool"
    Then the model receives these calls:
      | call | role        | text                               |
      | 1    | user        | find a tool                        |
      | 2    | user        | find a tool                        |
      | 2    | assistant   | tool call mcp {"search":"nothing"} |
      | 2    | tool result | mcp returned: found no tools       |
    Then the model calls are offered these marketplace tools:
      | call | tools                                                         |
      | 1    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
      | 2    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |

  @builtin-only
  Scenario: A search that matches no tool loads none and sends the server no call (BLT-01)
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
      | reply | tool        | arguments            |
      |       | tool_search | {"query": "nothing"} |
      | Done. |             |                      |
    When the user prompts "find a tool"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                      |
      | 1    | user        | find a tool                               |
      | 2    | user        | find a tool                               |
      | 2    | assistant   | tool call tool_search {"query":"nothing"} |
      | 2    | tool result | tool_search returned: found no tools      |
    Then the model calls are offered these marketplace tools:
      | call | tools                                                         |
      | 1    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
      | 2    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                    |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}} |
      | notification | notifications/initialized |                                                                                                           |
      | request      | tools/list                |                                                                                                           |
