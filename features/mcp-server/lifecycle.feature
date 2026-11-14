Feature: MCP server lifecycle

  Each plugin verb changes the MCP servers of a session started after it, as
  Pi's /reload would, under pi-mcp-adapter and under Pi's built-in MCP (BLT-06,
  D-MB-10). The two implementations show it through different tools, so each
  verb has a scenario for each. The three scenarios about a user's disabled
  choice in mcp-adapter.json exist only for pi-mcp-adapter, whose file keeps
  that choice (D-08-01, D-08-02). Four request-timeout scenarios also use the
  adapter's file; Pi's built-in MCP sets its timeout at session start and reads
  no user value from that file (D-PG1-11 to D-PG1-13). A stdio stub server stands in for a real one,
  a scripted model for a real model, and a local marketplace for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope

  @adapter-only
  Scenario: Disabling a plugin removes its server from what pi-mcp-adapter offers
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
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
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | user        | call the stub                                                               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | assistant   | tool call mcp {}                                                            |
      | 3    | tool result | mcp returned: no servers                                                    |
    Then no stub mcp server receives a message

  @builtin-only
  Scenario: A plugin disabled during a session keeps its server registered until the next session (BLT-06, D-MB-10)
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name             |
      | plugin_demo_stub |

  @builtin-only
  Scenario: A plugin disabled during a session has no server in the next session under Pi's built-in MCP (BLT-06, D-MB-10)
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has started a new pi session
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name |
    Then pi offers these plugin mcp tools:
      | tool | active |

  @adapter-only
  Scenario: Uninstalling a plugin removes its server from what pi-mcp-adapter offers
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user"
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
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | user        | call the stub                                                               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | assistant   | tool call mcp {}                                                            |
      | 3    | tool result | mcp returned: no servers                                                    |
    Then no stub mcp server receives a message

  @builtin-only
  Scenario: A plugin uninstalled during a session has no server in the next session under Pi's built-in MCP (BLT-06, D-MB-10)
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user"
    Given the user has started a new pi session
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name |
    Then pi offers these plugin mcp tools:
      | tool | active |

  @adapter-only
  Scenario: Enabling a disabled plugin offers its server again
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has run "/claude:plugin enable demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                    |
    When the user prompts "call the stub"
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}                                                                                                                                             |
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                     |

  @builtin-only
  Scenario: Enabling a disabled plugin registers its server again under Pi's built-in MCP (BLT-06)
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has run "/claude:plugin enable demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user prompts "call the stub"
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                    |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}} |
      | notification | notifications/initialized |                                                                                                           |
      | request      | tools/list                |                                                                                                           |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"progressToken":3}}                                   |
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

  @adapter-only
  Scenario: Updating a plugin replaces its server with the new version's
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"stub": {"stub": {"env": {"STUB_TAG": "v2"}}}}
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                    |
    When the user prompts "call the stub"
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}                                                                                                                                             |
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: v2:echo:ping                                                  |

  @builtin-only
  Scenario: Updating a plugin registers the new version's server under Pi's built-in MCP (BLT-06)
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"stub": {"stub": {"env": {"STUB_TAG": "v2"}}}}
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user prompts "call the stub"
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
      | 3    | tool result | mcp__plugin_demo_stub__echo returned: v2:echo:ping                                    |

  @adapter-only
  Scenario: A published change to the server reaches no session until the plugin updates
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"stub": {"stub": {"env": {"STUB_TAG": "v2"}}}}
      """
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                    |
    When the user prompts "call the stub"
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}                                                                                                                                             |
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                     |

  @builtin-only
  Scenario: A published change to the server reaches no built-in session until the plugin updates (BLT-06)
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"stub": {"stub": {"env": {"STUB_TAG": "v2"}}}}
      """
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user prompts "call the stub"
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

  @adapter-only
  Scenario: A user's disabled choice for a plugin server survives an update
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has disabled the mcp server "plugin_demo_stub_" in the mcp-adapter.json file of the user scope
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"stub": {"stub": {"env": {"STUB_TAG": "v2"}}}}
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope user"
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
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | user        | call the stub                                                               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | assistant   | tool call mcp {}                                                            |
      | 3    | tool result | mcp returned: server plugin_demo_stub_ disabled                             |
    Then no stub mcp server receives a message

  @adapter-only
  Scenario: A user's disabled choice for a plugin server survives a disable and enable
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has disabled the mcp server "plugin_demo_stub_" in the mcp-adapter.json file of the user scope
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has run "/claude:plugin enable demo@fixtures --scope user"
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
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | user        | call the stub                                                               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | assistant   | tool call mcp {}                                                            |
      | 3    | tool result | mcp returned: server plugin_demo_stub_ disabled                             |
    Then no stub mcp server receives a message

  @adapter-only
  Scenario: A user's disabled choice for a plugin server survives an uninstall and install
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has disabled the mcp server "plugin_demo_stub_" in the mcp-adapter.json file of the user scope
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
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
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | user        | call the stub                                                               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | assistant   | tool call mcp {}                                                            |
      | 3    | tool result | mcp returned: server plugin_demo_stub_ disabled                             |
    Then no stub mcp server receives a message

  @adapter-only
  Scenario: A request timeout the user wrote for a plugin server survives an update (PG-MCP-01, D-PG1-11)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"kept":{"command":"pi-features-absent-mcp-server","args":["v1"]},"plain":{"command":"pi-features-absent-mcp-server","args":["v1"]}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has set the request timeout of the mcp server "plugin_demo_kept_" to 45000 ms in the mcp-adapter.json file of the user scope
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"kept":{"command":"pi-features-absent-mcp-server","args":["v2"]},"plain":{"command":"pi-features-absent-mcp-server","args":["v2"]}}}
      """
    When the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_kept_": {
            "command": "pi-features-absent-mcp-server",
            "args": [
              "v2"
            ],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 45000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          },
          "plugin_demo_plain_": {
            "command": "pi-features-absent-mcp-server",
            "args": [
              "v2"
            ],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: A plugin server that changes from stdio to remote in an update gets the remote idle window (PG-MCP-01, D-PG1-13)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"srv":{"command":"pi-features-absent-mcp-server"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"srv":{"type":"http","url":"https://example.invalid/mcp"}}}
      """
    When the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "url": "https://example.invalid/mcp",
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 300000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 300000
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: A disable and an enable write the default timeout again as the extension's own (PG-MCP-01, D-PG1-13)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"srv":{"command":"pi-features-absent-mcp-server"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    When the user has run "/claude:plugin enable demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: An entry that an earlier release wrote gets the default timeout at the plugin's next reinstall (PG-MCP-01, D-PG1-12)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"srv":{"command":"pi-features-absent-mcp-server"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the mcp-adapter.json file of the user scope holds the entry "plugin_demo_srv_" as release 0.23.0 wrote it
    When the user has run "/claude:plugin reinstall demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: A new session offers the plugin's tool again (BLT-01)
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has started a new pi session
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |

  @builtin-only
  Scenario: A plugin that autoapply installs during a load registers its server in the same session (BLT-01, D-MB-10)
    Given a config in scope user and layer local, with this text:
      """
      { "autoapply": true }
      """
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name             |
      | plugin_demo_stub |
