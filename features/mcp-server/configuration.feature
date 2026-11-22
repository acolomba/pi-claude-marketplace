Feature: MCP server configuration

  A plugin's MCP server receives its configuration as Claude Code gives it, through either MCP
  implementation: pi-mcp-adapter, through its mcp tool and its own OAuth entry (D-CF6-05, D-08-04),
  and Pi's built-in MCP, through the servers the extension registers and Pi's tool search (BLT-02,
  AVAR-02, MENV-01, MENV-02). A stdio stub server and a loopback HTTP server stand in for real
  servers, a scripted model for a real model, a local marketplace for a published one, and a
  registry probe for the configuration Pi holds.

  @mcp
  Scenario: A server that declares no timeout is written to mcp-adapter.json with the idle window of Claude Code, 30 minutes for stdio and 5 minutes for a remote server (PG-MCP-01, D-PG1-11)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"stub": {"command": "pi-features-absent-mcp-server"}, "remote": {"type": "http", "url": "http://127.0.0.1:9/mcp"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
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
          },
          "plugin_demo_remote_": {
            "url": "http://127.0.0.1:9/mcp",
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
  Scenario: An install writes the lifecycle that keeps a stdio plugin server for the session, and no lifecycle for a remote server (PG-MCP-06, D-PG9-01, D-PG9-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"plain": {"command": "pi-features-absent-mcp-server"}, "typed": {"type": "stdio", "command": "pi-features-absent-mcp-server"}, "events": {"type": "sse", "url": "https://example.invalid/sse"}, "stream": {"type": "streamable-http", "url": "https://example.invalid/mcp"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_plain_": {
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
          },
          "plugin_demo_typed_": {
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
          },
          "plugin_demo_events_": {
            "url": "https://example.invalid/sse",
            "httpTransport": "sse",
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
          },
          "plugin_demo_stream_": {
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

  @builtin-only
  Scenario: A server that declares no timeout is registered with the idle window of Claude Code, 30 minutes for stdio and 5 minutes for a remote server (PG-MCP-01, D-PG1-11)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"stub": {"stub": {}}, "remote": {"type": "http", "url": "http://127.0.0.1:9/mcp"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name               | config                                                                                                                                                                                     |
      | plugin_demo_stub   | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"timeout":1800,"exposure":"deferred"} |
      | plugin_demo_remote | {"type":"http","url":"http://127.0.0.1:9/mcp","timeout":300,"exposure":"deferred"}                                                                                                          |

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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned that the mcp server "web" of the plugin "demo" reads the unset variable "PI_CM_TEAM"
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

  @builtin-only
  Scenario: A remote server receives the plugin's headers, a variable among them expanded at registration (BLT-02)
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
    Given pi runs with the scripted model, pi's built-in mcp, and the environment variable "PI_CM_TEAM" set to "core"
    Given pi's built-in mcp has listed the tools of the http mcp server "web" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                       | arguments         |
      |       | tool_search                | {"query": "echo"} |
      |       | mcp__plugin_demo_web__echo | {"text": "ping"}  |
      | Done. |                            |                   |
    When the user prompts "call the web server"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                 |
      | 1    | user        | call the web server                                                                  |
      | 2    | user        | call the web server                                                                  |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_web__echo: Echoes the text it is given. |
      | 3    | user        | call the web server                                                                  |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_web__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_web__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_web__echo returned: echo:ping                                       |
    Then the http mcp server "web" receives these json-rpc requests:
      | request                        | authorization | x-team | mcp-protocol-version |
      | POST initialize                | Bearer t0k3n  | core   | (none)               |
      | POST notifications/initialized | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  | core   | 2025-11-25           |
      | POST tools/call                | Bearer t0k3n  | core   | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | authorization | x-team | mcp-protocol-version |
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

  @builtin-only
  Scenario: A remote server whose headers hold no Authorization key connects with no sign-in (BLT-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the http mcp server "web" with these headers:
      | header | value |
      | X-Team | core  |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given pi's built-in mcp has listed the tools of the http mcp server "web" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                       | arguments         |
      |       | tool_search                | {"query": "echo"} |
      |       | mcp__plugin_demo_web__echo | {"text": "ping"}  |
      | Done. |                            |                   |
    When the user prompts "call the web server"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                 |
      | 1    | user        | call the web server                                                                  |
      | 2    | user        | call the web server                                                                  |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_web__echo: Echoes the text it is given. |
      | 3    | user        | call the web server                                                                  |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_web__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_web__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_web__echo returned: echo:ping                                       |
    Then the http mcp server "web" receives these json-rpc requests:
      | request                        | authorization | x-team | mcp-protocol-version |
      | POST initialize                | (none)        | core   | (none)               |
      | POST notifications/initialized | (none)        | core   | 2025-11-25           |
      | POST tools/list                | (none)        | core   | 2025-11-25           |
      | POST tools/call                | (none)        | core   | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | authorization | x-team | mcp-protocol-version |
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned that the mcp server "web" of the plugin "demo" reads the unset variable "PI_CM_UNSET_TEAM"
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

  @builtin-only
  Scenario: A header whose variable is unset reaches the server as Claude Code's literal reference (BLT-02, AVAR-02)
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
    Given pi runs with the scripted model and the mcp implementation
    Given pi's built-in mcp has listed the tools of the http mcp server "web" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                       | arguments         |
      |       | tool_search                | {"query": "echo"} |
      |       | mcp__plugin_demo_web__echo | {"text": "ping"}  |
      | Done. |                            |                   |
    When the user prompts "call the web server"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                 |
      | 1    | user        | call the web server                                                                  |
      | 2    | user        | call the web server                                                                  |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_web__echo: Echoes the text it is given. |
      | 3    | user        | call the web server                                                                  |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                               |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_web__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_web__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_web__echo returned: echo:ping                                       |
    Then the http mcp server "web" receives these json-rpc requests:
      | request                        | authorization | x-team              | mcp-protocol-version |
      | POST initialize                | Bearer t0k3n  | ${PI_CM_UNSET_TEAM} | (none)               |
      | POST notifications/initialized | Bearer t0k3n  | ${PI_CM_UNSET_TEAM} | 2025-11-25           |
      | POST tools/list                | Bearer t0k3n  | ${PI_CM_UNSET_TEAM} | 2025-11-25           |
      | POST tools/call                | Bearer t0k3n  | ${PI_CM_UNSET_TEAM} | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | authorization | x-team              | mcp-protocol-version |
      | GET     | Bearer t0k3n  | ${PI_CM_UNSET_TEAM} | 2025-11-25           |

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

  @builtin-only
  Scenario Outline: A server's env value reaches it as Claude Code expands it, with nothing Pi reinterprets (BLT-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tag": {"stub": {"env": {"STUB_TAG": "<env value>"}}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
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
      | 3    | tool result | mcp__plugin_demo_tag__echo returned: <echo>                                          |

    Examples:
      | env value                          | echo                                                           |
      | literal                            | literal:echo:ping                                              |
      | ${CLAUDE_PLUGIN_DATA}              | {agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping |
      | ${CLAUDE_PLUGIN_ROOT}              | {home}/marketplaces/fixtures/plugins/demo:echo:ping            |
      | ${PI_CM_STUB_TAG:-install-default} | install-default:echo:ping                                      |
      | cost $5 and $HOME                  | cost $5 and $HOME:echo:ping                                    |
      | !echo pwned                        | !echo pwned:echo:ping                                          |

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
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}                                                                                                                                             |
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_root__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                     |

  @builtin-only
  Scenario: The plugin root variable in args reaches the server as the plugin's directory (BLT-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"root": {"stub": {"plugin": "${CLAUDE_PLUGIN_ROOT}"}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "root" of the plugin "{home}/marketplaces/fixtures/plugins/demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_root__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user prompts "call the stub"
    Then the stub mcp server "root" of the plugin "{home}/marketplaces/fixtures/plugins/demo" receives these messages:
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
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_root__echo: Echoes the text it is given. |
      | 3    | user        | call the stub                                                                         |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_root__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_root__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_root__echo returned: echo:ping                                       |

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

  @builtin-only
  Scenario: A stdio server's environment holds the plugin's root and data directories as Claude Code sets them (MENV-01, MENV-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" that echoes its "CLAUDE_PLUGIN_ROOT" and "CLAUDE_PLUGIN_DATA" environment variables
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
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

  @mcp
  Scenario: A remote server's headers never hold a set credential that Claude Code keeps from remote servers, and the install says so (AVAR-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"type": "http", "url": "https://127.0.0.1:9/mcp", "headers": {"Authorization": "Bearer ${ANTHROPIC_API_KEY}", "X-Fallback": "${ANTHROPIC_API_KEY:-unused}"}}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given pi runs with the scripted model, the mcp implementation, and the environment variable "ANTHROPIC_API_KEY" set to "avar-sentinel-04-03"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                                  |
      | cascade            | info     | true         |                                                                                                                                          |
      | mcp-config-notices | warning  | false        | [{"kind":"credentials-blanked","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_srv_","names":["ANTHROPIC_API_KEY"]}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "url": "https://127.0.0.1:9/mcp",
            "headers": {
              "Authorization": "Bearer ",
              "X-Fallback": ""
            },
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
