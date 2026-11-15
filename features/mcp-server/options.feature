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
