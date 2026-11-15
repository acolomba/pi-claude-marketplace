Feature: MCP server options

  A plugin's MCP servers receive the plugin's options under both MCP implementations, and a server
  that names an option with no value is left out and reported (PG-CORE-03, D-PG10-11, D-PG10-12,
  D-PG10-21). A stdio stub server and a loopback HTTP server stand in for real servers, and a local
  marketplace for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  @mcp
  Scenario: A server that names a plugin option with no value is left out of mcp-adapter.json, and the install says so (PG-CORE-03, D-PG10-21)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "token": { "type": "string", "title": "Token", "description": "The token.", "required": true }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"keyed": {"command": "pi-features-absent-mcp-server", "args": ["--token", "${user_config.token}"]}, "plain": {"command": "pi-features-absent-mcp-server"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user --partial"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                            |
      | cascade            | info     | true         |                                                                                                                                    |
      | mcp-config-notices | warning  | false        | [{"kind":"option-blocked","scope":"user","file":"mcp-adapter.json","plugin":"demo","server":"keyed","names":["token"],"reason":"unset"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | scope | version |
      | fixtures         | user              | demo@fixtures | demo | partially-installed | options not set | user  | 1.0.0   |
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
          }
        }
      }

      """

  @mcp
  Scenario: A server of a plugin with no options keeps its option reference as written (D-PG10-21)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"keyed": {"command": "pi-features-absent-mcp-server", "args": ["--token", "${user_config.token}"]}}}
      """
    Given the marketplace "fixtures" is added to the user scope
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
          "plugin_demo_keyed_": {
            "command": "pi-features-absent-mcp-server",
            "args": [
              "--token",
              "${user_config.token}"
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

  @mcp
  Scenario: A server whose command a plugin option would turn into a home path is left out, and the install says so (D-PG10-11)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "tool": { "type": "string", "title": "Tool", "description": "The tool.", "default": "~/bin/tool" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"homed": {"command": "${user_config.tool}"}, "plain": {"command": "pi-features-absent-mcp-server"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                                    |
      | cascade            | info     | true         |                                                                                                                                            |
      | mcp-config-notices | warning  | false        | [{"kind":"option-blocked","scope":"user","file":"mcp-adapter.json","plugin":"demo","server":"homed","names":["tool"],"reason":"home-path"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
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
          }
        }
      }

      """

  @mcp
  Scenario: A server whose argument starts with a plugin option that holds a home path is left out, and the install says so (D-PG10-11)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "tool": { "type": "string", "title": "Tool", "description": "The tool.", "default": "~/bin/tool" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"homed": {"command": "pi-features-absent-mcp-server", "args": ["--tool", "${user_config.tool}"]}, "plain": {"command": "pi-features-absent-mcp-server"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                                                    |
      | cascade            | info     | true         |                                                                                                                                            |
      | mcp-config-notices | warning  | false        | [{"kind":"option-blocked","scope":"user","file":"mcp-adapter.json","plugin":"demo","server":"homed","names":["tool"],"reason":"home-path"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
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
          }
        }
      }

      """

  @adapter-only
  Scenario: The entry of a server that names a plugin option holds a reference and no option value (PG-CORE-03, D-PG10-11)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "tool": { "type": "string", "title": "Tool", "description": "The tool.", "default": "reverse" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"keyed": {"command": "pi-features-absent-mcp-server", "args": ["--tool", "${user_config.tool}"]}}}
      """
    Given the marketplace "fixtures" is added to the user scope
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
          "plugin_demo_keyed_": {
            "command": "pi-features-absent-mcp-server",
            "args": [
              "--tool",
              "${PI_CLAUDE_MARKETPLACE_OPTION_8fd4b1ce5a5f54e0}"
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

  @mcp
  Scenario: A plugin option reaches an argument of a stdio server (PG-CORE-03)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "tool": { "type": "string", "title": "Tool", "description": "The tool.", "default": "reverse" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "picker" whose tool name argument is "${user_config.tool}"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "picker" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                             | active |
      | mcp__plugin_demo_picker__reverse | no     |

  @adapter-only
  Scenario: A plugin option reaches the command and the environment of a stdio server (PG-CORE-03)
    Given the published plugin "demo" of the marketplace "fixtures" has this manifest, with the default of the option "node" set to the node executable that runs stub mcp servers:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "node": { "type": "string", "title": "Node", "description": "The node executable." },
          "tag": { "type": "string", "title": "Tag", "description": "The tag.", "default": "opted" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "tagged" with these fields:
      """
      {"command": "${user_config.node}", "env": {"STUB_TAG": "${user_config.tag}"}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "tagged" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                           |
      |       | mcp  | {"tool": "mcp__plugin_demo_tagged__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                     |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                          |
      | 1    | user        | call the stub                                                                 |
      | 2    | user        | call the stub                                                                 |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_tagged__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: opted:echo:ping                                                 |

  @adapter-only
  Scenario: A plugin option reaches the url and a header of a remote server (PG-CORE-03)
    Given the published plugin "demo" of the marketplace "fixtures" has this manifest, with the default of the option "url" set to the address of the http mcp server "web":
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "url": { "type": "string", "title": "Url", "description": "The server address." },
          "team": { "type": "string", "title": "Team", "description": "The team.", "default": "core" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"web": {"type": "http", "url": "${user_config.url}", "headers": {"X-Team": "${user_config.team}"}}}}
      """
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
      | request                        | x-team | mcp-protocol-version |
      | POST initialize                | core   | (none)               |
      | POST notifications/initialized | core   | 2025-11-25           |
      | POST tools/list                | core   | 2025-11-25           |
      | POST initialize                | core   | (none)               |
      | POST notifications/initialized | core   | 2025-11-25           |
      | POST tools/list                | core   | 2025-11-25           |
      | POST tools/call                | core   | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | x-team | mcp-protocol-version |
      | GET     | core   | 2025-11-25           |
      | GET     | core   | 2025-11-25           |

  @builtin-only
  Scenario: A plugin option reaches the command and the environment of a stdio server under Pi's built-in MCP (PG-CORE-03, D-PG10-12)
    Given the published plugin "demo" of the marketplace "fixtures" has this manifest, with the default of the option "node" set to the node executable that runs stub mcp servers:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "node": { "type": "string", "title": "Node", "description": "The node executable." },
          "tag": { "type": "string", "title": "Tag", "description": "The tag.", "default": "opted" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "tagged" with these fields:
      """
      {"command": "${user_config.node}", "env": {"STUB_TAG": "${user_config.tag}"}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "tagged" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                          | arguments         |
      |       | tool_search                   | {"query": "echo"} |
      |       | mcp__plugin_demo_tagged__echo | {"text": "ping"}  |
      | Done. |                               |                   |
    When the user prompts "call the stub"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                    |
      | 1    | user        | call the stub                                                                           |
      | 2    | user        | call the stub                                                                           |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                                  |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_tagged__echo: Echoes the text it is given. |
      | 3    | user        | call the stub                                                                           |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                                  |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_tagged__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_tagged__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_tagged__echo returned: opted:echo:ping                                 |

  @builtin-only
  Scenario: A plugin option reaches the url and a header of a remote server under Pi's built-in MCP (PG-CORE-03, D-PG10-12)
    Given the published plugin "demo" of the marketplace "fixtures" has this manifest, with the default of the option "url" set to the address of the http mcp server "web":
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "url": { "type": "string", "title": "Url", "description": "The server address." },
          "team": { "type": "string", "title": "Team", "description": "The team.", "default": "core" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"web": {"type": "http", "url": "${user_config.url}", "headers": {"X-Team": "${user_config.team}"}}}}
      """
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
      | request                        | x-team | mcp-protocol-version |
      | POST initialize                | core   | (none)               |
      | POST notifications/initialized | core   | 2025-11-25           |
      | POST tools/list                | core   | 2025-11-25           |
      | POST tools/call                | core   | 2025-11-25           |
    Then the http mcp server "web" receives these other requests in any order:
      | request | x-team | mcp-protocol-version |
      | GET     | core   | 2025-11-25           |
