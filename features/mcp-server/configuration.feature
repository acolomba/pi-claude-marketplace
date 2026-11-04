Feature: MCP server configuration

  A plugin's MCP server receives its configuration as Claude Code gives it, through either MCP
  implementation: pi-mcp-adapter, through its mcp tool and its own OAuth entry (D-CF6-05, D-08-04),
  and Pi's built-in MCP, through the servers the extension registers and Pi's tool search (BLT-02,
  AVAR-02, MENV-01, MENV-02). A stdio stub server and a loopback HTTP server stand in for real
  servers, a scripted model for a real model, and a local marketplace for a published one.

  @adapter-only
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model, pi-mcp-adapter, and the environment variable "PI_CM_TEAM" set to "core"
    Given pi-mcp-adapter has listed the tools of the http mcp server "web"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                        |
      |       | mcp  | {"tool": "mcp__plugin_demo_web__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                  |
    When the user prompts "call the web server"
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | call the web server                                                        |
      | 2    | user        | call the web server                                                        |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_web__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                    |
    Then the http mcp server "web" receives these json-rpc requests:
      | request                        | authorization | x-team | mcp-protocol-version |
      | POST initialize                | Bearer t0k3n  | core   | (none)               |
      | POST notifications/initialized | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  | core   | 2025-11-25           |
      | POST initialize                | Bearer t0k3n  | core   | (none)               |
      | POST notifications/initialized | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/call                | Bearer t0k3n  | core   | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | authorization | x-team | mcp-protocol-version |
      | GET     | Bearer t0k3n  | core   | 2025-11-25           |
      | GET     | Bearer t0k3n  | core   | 2025-11-25           |

  @adapter-only
  Scenario: Under the OAuth entry of D-08-04, a remote server whose headers hold no Authorization key connects with no sign-in
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the http mcp server "web" with these headers:
      | header | value |
      | X-Team | core  |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the http mcp server "web"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                        |
      |       | mcp  | {"tool": "mcp__plugin_demo_web__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                  |
    When the user prompts "call the web server"
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | call the web server                                                        |
      | 2    | user        | call the web server                                                        |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_web__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                    |
    Then the http mcp server "web" receives these json-rpc requests:
      | request                        | authorization | x-team | mcp-protocol-version |
      | POST initialize                | (none)        | core   | (none)               |
      | POST notifications/initialized | (none)        | core   | 2025-11-25           |
      | POST tools/list                | (none)        | core   | 2025-11-25           |
      | POST initialize                | (none)        | core   | (none)               |
      | POST notifications/initialized | (none)        | core   | 2025-11-25           |
      | POST tools/list                | (none)        | core   | 2025-11-25           |
      | POST tools/call                | (none)        | core   | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | authorization | x-team | mcp-protocol-version |
      | GET     | (none)        | core   | 2025-11-25           |
      | GET     | (none)        | core   | 2025-11-25           |

  @adapter-only
  Scenario: A header whose variable is unset when the server connects reaches it empty, a documented Pi gap where Claude Code keeps the literal
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the http mcp server "web" with these headers:
      | header        | value               |
      | Authorization | Bearer t0k3n        |
      | X-Team        | ${PI_CM_UNSET_TEAM} |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the http mcp server "web"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                        |
      |       | mcp  | {"tool": "mcp__plugin_demo_web__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                  |
    When the user prompts "call the web server"
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | call the web server                                                        |
      | 2    | user        | call the web server                                                        |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_web__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                    |
    Then the http mcp server "web" receives these json-rpc requests:
      | request                        | authorization | x-team | mcp-protocol-version |
      | POST initialize                | Bearer t0k3n  |        | (none)               |
      | POST notifications/initialized | Bearer t0k3n  |        | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  |        | 2025-11-25           |
      | POST initialize                | Bearer t0k3n  |        | (none)               |
      | POST notifications/initialized | Bearer t0k3n  |        | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  |        | 2025-11-25           |
      | POST tools/call                | Bearer t0k3n  |        | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | authorization | x-team | mcp-protocol-version |
      | GET     | Bearer t0k3n  |        | 2025-11-25           |
      | GET     | Bearer t0k3n  |        | 2025-11-25           |

  @adapter-only
  Scenario Outline: A server's env value reaches it as Claude Code expands it
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tag": {"stub": {"env": {"STUB_TAG": "<env value>"}}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "tag" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                        |
      |       | mcp  | {"tool": "mcp__plugin_demo_tag__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                  |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | call the stub                                                              |
      | 2    | user        | call the stub                                                              |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_tag__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: <echo>                                                       |

    Examples:
      | env value                          | echo                                                           |
      | literal                            | literal:echo:ping                                              |
      | ${CLAUDE_PLUGIN_DATA}              | {agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping |
      | ${CLAUDE_PLUGIN_ROOT}              | {home}/marketplaces/fixtures/plugins/demo:echo:ping            |
      | ${PI_CM_STUB_TAG:-install-default} | install-default:echo:ping                                      |

  @adapter-only
  Scenario: A variable reference in env reaches the server with the value Pi starts with
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tag": {"stub": {"env": {"STUB_TAG": "${PI_CM_STUB_TAG}"}}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned that the mcp server "tag" of the plugin "demo" reads the unset variable "PI_CM_STUB_TAG"
    Given pi runs with the scripted model, pi-mcp-adapter, and the environment variable "PI_CM_STUB_TAG" set to "late"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "tag" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                        |
      |       | mcp  | {"tool": "mcp__plugin_demo_tag__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                  |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | call the stub                                                              |
      | 2    | user        | call the stub                                                              |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_tag__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: late:echo:ping                                               |

  @builtin-only
  Scenario: A variable set when Pi starts reaches the server's env (BLT-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tag": {"stub": {"env": {"STUB_TAG": "${PI_CM_STUB_TAG}"}}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model, pi's built-in mcp, and the environment variable "PI_CM_STUB_TAG" set to "late"
    Given the mcp implementation has listed the tools of the stub mcp server "tag" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                       | arguments         |
      |       | tool_search                | {"query": "echo"} |
      |       | mcp__plugin_demo_tag__echo | {"text": "ping"}  |
      | Done. |                            |                   |
    When the user prompts "call the stub"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                 |
      | 1    | user        | call the stub                                                                        |
      | 2    | user        | call the stub                                                                        |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_tag__echo: Echoes the text it is given. |
      | 3    | user        | call the stub                                                                        |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_tag__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_tag__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_tag__echo returned: late:echo:ping                                  |

  @adapter-only
  Scenario: The plugin root variable in args reaches the server as the plugin's directory
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"root": {"stub": {"plugin": "${CLAUDE_PLUGIN_ROOT}"}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "root" of the plugin "{home}/marketplaces/fixtures/plugins/demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                         |
      |       | mcp  | {"tool": "mcp__plugin_demo_root__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                   |
    When the user prompts "call the stub"
    Then the stub mcp server "root" of the plugin "{home}/marketplaces/fixtures/plugins/demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_root_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_root_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}                                                                                                                                             |
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_root__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                     |

  @adapter-only
  Scenario: A stdio server's environment holds the plugin's root and data directories as Claude Code sets them
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" that echoes its "CLAUDE_PLUGIN_ROOT" and "CLAUDE_PLUGIN_DATA" environment variables
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                         |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                   |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                                                                   |
      | 1    | user        | call the stub                                                                                                          |
      | 2    | user        | call the stub                                                                                                          |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}                                            |
      | 2    | tool result | mcp returned: {home}/marketplaces/fixtures/plugins/demo,{agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping |
