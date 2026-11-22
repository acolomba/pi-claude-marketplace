Feature: MCP server lifecycle

  Each plugin verb changes the MCP servers of a session started after it, as
  Pi's /reload would, under pi-mcp-adapter and under Pi's built-in MCP (BLT-06,
  D-MB-10). The two implementations show it through different tools, so each
  verb has a scenario for each. Three scenarios show through pi-mcp-adapter's
  tools that a user's disabled choice in mcp-adapter.json survives a plugin
  verb (D-08-01, D-08-02). The extension writes that file the same way under
  either implementation, so the scenarios that read only the file run under
  both: a project install keeps the user's stub for a server's key and an
  uninstall writes it back (AFILE-06), the choices the user wrote there
  survive each plugin verb (D-08-01, D-08-02), and a stub's own timeout is
  kept for the uninstall to write back while the plugin's applies (ANAME-07).
  Four request-timeout scenarios also use the adapter's file; Pi's built-in
  MCP sets its timeout at session start and reads no user value from that file
  (D-PG1-11 to D-PG1-13). They also show the
  `lifecycle: "lazy-keep-alive"` default of a stdio server, which keeps it
  connected for the session as Claude Code does, and which a restage writes
  again as the extension's own (D-PG9-01, D-PG9-03, D-PG9-04). No `openUi`
  default is written, because pi-subagents 0.88.1 does not hash it as
  pi-mcp-adapter 7.0.1 does, and an entry holding it stops an agent granted
  the server's tools from launching (D-PG9-07, D-CF6-10). Beside the
  request-timeout scenarios, the scenarios of D-PG9-03 and D-PG9-05 show that
  a value the user wrote beats this extension's defaults and survives an
  update and a reinstall; Pi's built-in MCP reads none of these fields from
  mcp-adapter.json. A user's idleTimeout stands for the lifecycle too,
  because pi-mcp-adapter never stops a started lazy-keep-alive server for
  idle time (D-PG9-15). A caFile is kept only while the server stays an https
  server at the same origin, because pi-mcp-adapter refuses one anywhere else,
  and the choices kept across an uninstall hold none (D-PG9-14). A reinstall
  leaves out a plugin server that names an option with no value, and says so,
  as an install does (D-PG10-21). A stdio stub server stands in for a real
  one, a scripted model for a real model, and a local marketplace for a
  published one.

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
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.1"}} |
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
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "lifecycle": "lazy-keep-alive"
              }
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
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: A plugin server that changes from stdio to remote in an update gets the remote idle window and loses the stdio lifecycle (PG-MCP-01, PG-MCP-06, D-PG1-13, D-PG9-03)
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
  Scenario: An update refuses a plugin server whose recorded default list holds a malformed member and leaves the file unchanged (PG-MCP-06, D-PG9-03)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"srv":{"command":"pi-features-absent-mcp-server"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the user scope:
      """
      {"_piClaudeMarketplace":{"plugin":"demo","marketplace":"fixtures","defaultFields":{"requestTimeoutMs":1800000,"lifecycle":["lazy-keep-alive"]}}}
      """
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"srv":{"type":"http","url":"https://example.invalid/mcp"}}}
      """
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope | from  | version | cause chain | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | unreadable | user  | 1.0.0 | 1.1.0   | MCP config {agent dir}/mcp-adapter.json has the entry "plugin_demo_srv_" whose "_piClaudeMarketplace.defaultFields" is not valid; it was left unchanged. | false           |       |                  |
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
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": [
                  "lazy-keep-alive"
                ]
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: A disable and an enable write the default timeout and lifecycle again as the extension's own (PG-MCP-01, PG-MCP-06, D-PG1-13, D-PG9-04)
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
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: An entry that release 0.23.0 wrote gets the default timeout and lifecycle at the plugin's next reinstall (PG-MCP-01, PG-MCP-06, D-PG1-12, D-PG9-04)
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
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: A protocolVersion, tasks, exposeResources, and caFile the user wrote for a plugin server survive an update that changes its url (PG-MCP-09, D-PG9-05)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"https://example.invalid/v1/mcp"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_remote_" in the mcp-adapter.json file of the user scope:
      """
      {"protocolVersion":"auto","tasks":true,"exposeResources":false,"caFile":"/etc/pki/user/ca-bundle.pem"}
      """
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"https://example.invalid/v2/mcp"}}}
      """
    When the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_remote_": {
            "url": "https://example.invalid/v2/mcp",
            "directTools": "search",
            "toolPrefix": "mcp",
            "protocolVersion": "auto",
            "tasks": true,
            "exposeResources": false,
            "caFile": "/etc/pki/user/ca-bundle.pem",
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
  Scenario: A protocolVersion, tasks, exposeResources, and caFile the user wrote for a plugin server survive a reinstall (PG-MCP-09, D-PG9-05)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"https://example.invalid/mcp"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_remote_" in the mcp-adapter.json file of the user scope:
      """
      {"protocolVersion":"auto","tasks":true,"exposeResources":false,"caFile":"/etc/pki/user/ca-bundle.pem"}
      """
    When the user has run "/claude:plugin reinstall demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_remote_": {
            "url": "https://example.invalid/mcp",
            "directTools": "search",
            "toolPrefix": "mcp",
            "protocolVersion": "auto",
            "tasks": true,
            "exposeResources": false,
            "caFile": "/etc/pki/user/ca-bundle.pem",
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
  Scenario: A caFile the user wrote for a plugin server whose url starts with a variable survives a reinstall (PG-MCP-09, D-PG9-14)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"${PI_CM_BASE}/mcp"}}}
      """
    Given pi runs with the scripted model, pi-mcp-adapter, and the environment variable "PI_CM_BASE" set to "https://example.invalid"
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_remote_" in the mcp-adapter.json file of the user scope:
      """
      {"caFile":"/etc/pki/user/ca-bundle.pem"}
      """
    When the user runs "/claude:plugin reinstall demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | reinstalled |         | user  | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_remote_": {
            "url": "${PI_CM_BASE}/mcp",
            "directTools": "search",
            "toolPrefix": "mcp",
            "caFile": "/etc/pki/user/ca-bundle.pem",
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

  @mcp
  Scenario: A reinstall leaves out a plugin server that names an option the manifest does not declare, and says so (D-PG10-21)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"stub": {"command": "pi-features-absent-mcp-server"}, "keyed": {"command": "pi-features-absent-mcp-server", "args": ["--region", "${user_config.region}"]}}}
      """
    When the user runs "/claude:plugin reinstall demo@fixtures --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                             |
      | cascade            | info     | true         |                                                                                                                                     |
      | mcp-config-notices | warning  | false        | [{"kind":"option-blocked","scope":"user","file":"mcp-adapter.json","plugin":"demo","server":"keyed","names":["region"],"reason":"unset"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | reinstalled |         | user  | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_stub_": {
            "command": "pi-features-absent-mcp-server",
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: An install after an uninstall does not give a plugin server at another origin the caFile the user wrote (PG-MCP-09, D-08-02, D-PG9-14)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"https://example.invalid/mcp"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_remote_" in the mcp-adapter.json file of the user scope:
      """
      {"caFile":"/etc/pki/user/ca-bundle.pem"}
      """
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"https://other.example.invalid/mcp"}}}
      """
    When the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_remote_": {
            "url": "https://other.example.invalid/mcp",
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
  Scenario: A disable that removes a plugin server says that the caFile the user wrote is not kept (PG-MCP-09, D-08-02, D-PG9-14)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"https://example.invalid/mcp"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_remote_" in the mcp-adapter.json file of the user scope:
      """
      {"tasks":true,"caFile":"/etc/pki/user/ca-bundle.pem"}
      """
    When the user runs "/claude:plugin disable demo@fixtures --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                                        |
      | cascade            | info     | true         |                                                                                                                                                |
      | mcp-config-notices | warning  | false        | [{"kind":"ca-file-removed","scope":"user","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_remote_","reason":"entry-removed"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | disabled |         | user  | 1.0.0   |

  @adapter-only
  Scenario: An update that makes a plugin server a stdio server removes the caFile the user wrote and says so (PG-MCP-09, D-PG9-14)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"type":"http","url":"https://example.invalid/mcp"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_remote_" in the mcp-adapter.json file of the user scope:
      """
      {"tasks":true,"caFile":"/etc/pki/user/ca-bundle.pem"}
      """
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"remote":{"command":"pi-features-absent-mcp-server"}}}
      """
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                                    |
      | cascade            | info     | true         |                                                                                                                                            |
      | mcp-config-notices | warning  | false        | [{"kind":"ca-file-removed","scope":"user","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_remote_","reason":"not-https"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | updated |         | user  | 1.0.0 | 1.1.0 |
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_remote_": {
            "command": "pi-features-absent-mcp-server",
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "tasks": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: A lifecycle and an openUi the user wrote for a plugin server survive an update (PG-MCP-06, PG-SEC-03, D-PG9-03)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"kept":{"command":"pi-features-absent-mcp-server","args":["v1"]},"plain":{"command":"pi-features-absent-mcp-server","args":["v1"]}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_kept_" in the mcp-adapter.json file of the user scope:
      """
      {"lifecycle":"lazy","openUi":true}
      """
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
            "lifecycle": "lazy",
            "openUi": true,
            "requestTimeoutMs": 1800000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000
              }
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
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: An idleTimeout the user wrote for a stdio plugin server survives an update in place of the lifecycle default (PG-MCP-06, D-PG9-15)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"kept":{"command":"pi-features-absent-mcp-server","args":["v1"]},"plain":{"command":"pi-features-absent-mcp-server","args":["v1"]}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_kept_" in the mcp-adapter.json file of the user scope:
      """
      {"idleTimeout":5}
      """
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
            "idleTimeout": 5,
            "requestTimeoutMs": 1800000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000
              }
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
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @adapter-only
  Scenario: An idleTimeout of zero the user wrote for a stdio plugin server replaces the lifecycle default (PG-MCP-06, D-PG9-15)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"srv":{"command":"pi-features-absent-mcp-server"}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the user scope:
      """
      {"idleTimeout":0}
      """
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
            "idleTimeout": 0,
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

  @mcp
  Scenario: A project install keeps the user's override of a plugin server's key, applies its disabled choice, and names the fields that stop applying (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "mine" in the mcp-adapter.json file of the project scope:
      """
      {"command": "my-server"}
      """
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                             |
      | cascade            | info     | true         |                                                                                                                                     |
      | mcp-config-notices | warning  | false        | [{"kind":"override-kept","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_srv_","fields":["env"]}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "my-server"
          },
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              },
              "keptOverride": {
                "disabled": true,
                "env": {
                  "STUB_TOKEN": "stub-secret"
                }
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope does not exist
    Then the mcp configuration file "mcp.json" of the user scope does not exist

  @mcp
  Scenario: An uninstall writes the user's override of a plugin server's key back as the user wrote it (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "mine" in the mcp-adapter.json file of the project scope:
      """
      {"command": "my-server"}
      """
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "my-server"
          },
          "plugin_demo_srv_": {
            "disabled": true,
            "env": {
              "STUB_TOKEN": "stub-secret"
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope does not exist
    Then the mcp configuration file "mcp.json" of the user scope does not exist

  @mcp
  Scenario: A project install of a plugin the user scope also installs keeps the project's disable stub and leaves the user scope's files alone (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                             |
      | cascade            | info     | true         |                                                                                                                                     |
      | mcp-config-notices | warning  | false        | [{"kind":"override-kept","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_srv_","fields":["env"]}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              },
              "keptOverride": {
                "disabled": true,
                "env": {
                  "STUB_TOKEN": "stub-secret"
                }
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope does not exist
    Then the files of the user scope are unchanged

  @mcp
  Scenario: A project update keeps the project's disable stub of a plugin the user scope also installs and leaves the user scope's files alone (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              },
              "keptOverride": {
                "disabled": true,
                "env": {
                  "STUB_TOKEN": "stub-secret"
                }
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope does not exist
    Then the files of the user scope are unchanged

  @mcp
  Scenario: A project reinstall keeps the project's disable stub of a plugin the user scope also installs and leaves the user scope's files alone (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              },
              "keptOverride": {
                "disabled": true,
                "env": {
                  "STUB_TOKEN": "stub-secret"
                }
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope does not exist
    Then the files of the user scope are unchanged

  @mcp
  Scenario: A project uninstall writes the project's disable stub back and leaves the user scope's files alone (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "disabled": true,
            "env": {
              "STUB_TOKEN": "stub-secret"
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope does not exist
    Then the files of the user scope are unchanged

  @mcp
  Scenario: A plugin disable after the user enabled the plugin's server writes back the override without the disabled choice (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has enabled the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | disabled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "env": {
              "STUB_TOKEN": "stub-secret"
            }
          }
        }
      }

      """

  @mcp
  Scenario: A plugin enable after a disable keeps the user's enable of the plugin's server (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has enabled the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                             |
      | cascade            | info     | true         |                                                                                                                                     |
      | mcp-config-notices | warning  | false        | [{"kind":"override-kept","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_srv_","fields":["env"]}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              },
              "keptOverride": {
                "env": {
                  "STUB_TOKEN": "stub-secret"
                }
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An uninstall after the user enabled the plugin's server writes back the override without the disabled choice (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has enabled the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "env": {
              "STUB_TOKEN": "stub-secret"
            }
          }
        }
      }

      """

  @mcp
  Scenario: A project install over a disable stub applies the timeout the plugin's entry declares (AFILE-06, ANAME-07)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "timeout": 5000}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "requestTimeoutMs": 5000,
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "pluginSetFields": [
                "requestTimeoutMs"
              ],
              "defaultFields": {
                "lifecycle": "lazy-keep-alive"
              },
              "keptOverride": {
                "disabled": true
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An uninstall writes back no timeout that only the plugin's entry declared (AFILE-06, ANAME-07)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "timeout": 5000}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "disabled": true
          }
        }
      }

      """

  @mcp
  Scenario: A project install over a stub with a timeout applies the plugin's timeout, keeps the user's for later, and says so (ANAME-07)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"type": "http", "url": "https://127.0.0.1:9/mcp", "timeout": 60000}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"requestTimeoutMs": 5000, "disabled": true}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                                          |
      | cascade            | info     | true         |                                                                                                                                                  |
      | mcp-config-notices | warning  | false        | [{"kind":"override-kept","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_srv_","fields":["requestTimeoutMs"]}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "url": "https://127.0.0.1:9/mcp",
            "requestTimeoutMs": 60000,
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "pluginSetFields": [
                "requestTimeoutMs"
              ],
              "keptOverride": {
                "requestTimeoutMs": 5000,
                "disabled": true
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An uninstall after the user enabled the plugin's server writes back only the user's timeout (ANAME-07)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"type": "http", "url": "https://127.0.0.1:9/mcp", "timeout": 60000}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"requestTimeoutMs": 5000, "disabled": true}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has enabled the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "requestTimeoutMs": 5000
          }
        }
      }

      """

  @mcp
  Scenario: An uninstall keeps the disabled and openUi choices the user wrote for a plugin server (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "openUi": true}
      """
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {},
        "_piClaudeMarketplace": {
          "serverChoices": {
            "plugin_demo_srv_": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "fields": {
                "disabled": true,
                "openUi": true
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An install after an uninstall gives the plugin's server back the user's disabled and openUi choices (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "openUi": true}
      """
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "openUi": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: A plugin disable keeps the disabled and trace choices the user wrote for a plugin server (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "trace": true}
      """
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | disabled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {},
        "_piClaudeMarketplace": {
          "serverChoices": {
            "plugin_demo_srv_": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "fields": {
                "disabled": true,
                "trace": true
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: A second plugin disable leaves the user's kept choices as the first left them (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "trace": true}
      """
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | false        |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons          | scope   |
      | fixtures         | project           | demo@fixtures | demo | skipped | already disabled | project |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {},
        "_piClaudeMarketplace": {
          "serverChoices": {
            "plugin_demo_srv_": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "fields": {
                "disabled": true,
                "trace": true
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: A plugin enable gives the plugin's server back the user's disabled and trace choices (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "trace": true}
      """
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "disabled": true,
            "trace": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An update that drops a plugin server keeps the user's choice for it (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"openUi": true}
      """
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {}}
      """
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {},
        "_piClaudeMarketplace": {
          "serverChoices": {
            "plugin_demo_srv_": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "fields": {
                "openUi": true
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An update that restores a plugin server gives it back the user's choice (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"openUi": true}
      """
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {}}
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope project", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.2.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": ["v3"]}}}
      """
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.1.0 | 1.2.0 |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [
              "v3"
            ],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "openUi": true,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: A reinstall keeps the openUi and trace the user wrote for a plugin server (D-08-01)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"trace": false, "openUi": true}
      """
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "openUi": true,
            "trace": false,
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An install neither applies nor removes a choice another plugin stored under the server's key (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written the mcp-adapter.json file of the project scope with this text:
      """
      {"_piClaudeMarketplace": {"serverChoices": {"plugin_demo_srv_": {"plugin": "other", "marketplace": "fixtures", "fields": {"approveTools": true}}}}}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "_piClaudeMarketplace": {
          "serverChoices": {
            "plugin_demo_srv_": {
              "plugin": "other",
              "marketplace": "fixtures",
              "fields": {
                "approveTools": true
              }
            }
          }
        },
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An install neither applies nor removes a choice the same-named plugin of another marketplace stored under the server's key (D-08-02)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written the mcp-adapter.json file of the project scope with this text:
      """
      {"_piClaudeMarketplace": {"serverChoices": {"plugin_demo_srv_": {"plugin": "demo", "marketplace": "elsewhere", "fields": {"approveTools": false}}}}}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "_piClaudeMarketplace": {
          "serverChoices": {
            "plugin_demo_srv_": {
              "plugin": "demo",
              "marketplace": "elsewhere",
              "fields": {
                "approveTools": false
              }
            }
          }
        },
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An uninstall removes a disable stub that the user's enable emptied while the plugin was installed (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    Given the user has written these fields on the mcp server "mine" in the mcp-adapter.json file of the project scope:
      """
      {"command": "mine"}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has enabled the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "mine"
          }
        }
      }

      """

  @mcp
  Scenario: A user-scope install after a project install and uninstall over the project's disable stub writes no kept override into the user entry (AFILE-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has written these fields on the mcp server "plugin_demo_srv_" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true, "env": {"STUB_TOKEN": "stub-secret"}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user"
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
